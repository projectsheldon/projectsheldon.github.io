// Cloudflare challenge auto-recovery for backend calls.
//
// backend.projectsheldon.me sits behind Cloudflare, which *adaptively* issues a "Managed
// Challenge" to some clients (notably VPN / datacenter IPs, or first-contact bursts). A
// cross-origin fetch() can't solve that challenge itself, so the call fails with
// "Failed to fetch". This wraps window.fetch so that, for backend requests only, we:
//
//   1. always send credentials, so the cf_clearance cookie rides along; and
//   2. on failure, load the backend once in a hidden *same-site* iframe – which runs
//      Cloudflare's (usually non-interactive) challenge and sets cf_clearance – then retry.
//
// www.projectsheldon.me is same-site with the API, so the clearance cookie applies to the
// retried fetches, and Cloudflare "caches" it for the cookie's lifetime. Limits: this can't
// solve an *interactive* challenge from a hidden iframe, and does nothing for the native
// Loader (a separate client that also can't solve challenges – protect it via Cloudflare
// rules, not a browser workaround).

const BACKEND_HOSTS = new Set([
    'backend.projectsheldon.me',
    'localhost:3350',
    '127.0.0.1:3350'
]);

function isBackendUrl(url)
{
    try { return BACKEND_HOSTS.has(new URL(url, location.href).host); }
    catch(e) { return false; }
}

function backendBase()
{
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://localhost:3350'
        : 'https://backend.projectsheldon.me';
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Load the backend in a hidden same-site iframe so Cloudflare can run (and clear) a pending
// challenge, setting cf_clearance. De-duped: concurrent failures share one clearance pass.
let clearing = null;
function runClearance()
{
    if(clearing) return clearing;
    clearing = new Promise((resolve) =>
    {
        let done = false;
        const iframe = document.createElement('iframe');
        const finish = () =>
        {
            if(done) return;
            done = true;
            try { iframe.remove(); } catch(e) {}
            clearing = null;
            resolve();
        };
        iframe.setAttribute('aria-hidden', 'true');
        iframe.referrerPolicy = 'no-referrer';
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
        iframe.src = backendBase() + '/config/backend?cb=' + Date.now();
        // Give the challenge JS a moment to run and set cf_clearance after the frame loads.
        iframe.onload = () => setTimeout(finish, 1500);
        iframe.onerror = () => setTimeout(finish, 500);
        setTimeout(finish, 9000); // hard cap in case onload never fires
        (document.body || document.documentElement).appendChild(iframe);
    });
    return clearing;
}

export function installBackendFetchGuard()
{
    if(typeof window === 'undefined' || window.__backendFetchGuard) return;
    window.__backendFetchGuard = true;

    const orig = window.fetch.bind(window);

    window.fetch = async function (input, init)
    {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if(!isBackendUrl(url)) return orig(input, init);

        init = init ? { ...init } : {};
        // cf_clearance is same-site to the API but still cross-origin, so it only rides along
        // when credentials are included. Preserve an explicit choice if the caller set one.
        if(init.credentials === undefined) init.credentials = 'include';

        // Only auto-retry idempotent methods. A non-idempotent request (POST) may have already
        // reached the backend and had a side effect before the response was lost – retrying it
        // would double-submit. For /workink/generate that means the token gets consumed twice
        // and the 2nd try returns "expired or invalid"; for purchases it'd double-charge. So we
        // still run the clearance pass (sets cf_clearance for the NEXT request) but do not retry.
        const method = (init.method || 'GET').toUpperCase();
        // Narrow allow-list of POST endpoints that are safe to retry after a clearance pass:
        // consent choice recording and device identity are idempotent server-side, and init-auth
        // merely mints a login code (a lost response costs nothing). Everything else keeps the
        // no-retry rule.
        const SAFE_RETRY_POST = /^\/(workink\/(consent|identity)|discord\/init-auth)(\?|$)/;
        const canRetry = method === 'GET' || method === 'HEAD' || (
            method === 'POST' && SAFE_RETRY_POST.test(new URL(url, location.href).pathname)
        );

        try
        {
            return await orig(input, init);
        }
        catch(err)
        {
            // Opaque failure – most often a Cloudflare challenge (the 403 challenge response
            // has no CORS headers, so the browser surfaces it as "Failed to fetch"), sometimes
            // a transient network blip. Clear once so the client is evaluated/cleared.
            try { await runClearance(); } catch(e) {}
            // Let the page (banner / retry UI) know the backend is unreachable, and fire the
            // operation-specific recovery callbacks once a probe succeeds.
            try { window.SheldonBackend && window.SheldonBackend.NotifyBackendFailure(); } catch(e) {}
            if(!canRetry) throw err;
            for(let attempt = 0; attempt < 2; attempt++)
            {
                try { return await orig(input, init); }
                catch(e) { if(attempt === 0) await sleep(900); else throw e; }
            }
            throw err;
        }
    };
}

installBackendFetchGuard();
