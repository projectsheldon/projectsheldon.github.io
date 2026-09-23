// Adblock / content-blocker detection + strict device-check gate.
//
// FILE-NAME NOTE: this file is deliberately called `guard.js`. Filter lists
// block requests whose URL contains words like "adblock" or "fingerprint", so
// naming this `adblock.js` would get the detector itself blocked. (Same reason
// the implementation lives in `device.js`, not `fingerprint.js`.)
//
// DESIGN:
// - This module has NO static imports, so importing it can never break a page
//   even under the most aggressive blocker. The device module is loaded via a
//   guarded dynamic import only when a gated feature is used.
// - Browsing the site (login, products, downloads, navigation) always works, and
//   the one-time cookie choice saves without any checks.
//   Only REWARD-GRANTING actions (WorkInk claim, free-key purchase) go through
//   `ensureChecksOrNotify()`, which reverts to the strict checks: a complete
//   device identity is REQUIRED, and when it can't be produced the user gets a
//   clear "turn off your adblocker" notice instead of a silent fallback.

let cachedResult = null; // per-page-load cache; cleared by "Check again"
let modalEl = null;

function absUrl(name)
{
    try { return new URL('./' + name, import.meta.url).href; }
    catch(e)
    {
        const base = (document.currentScript && document.currentScript.src) || window.location.href;
        return new URL('../util/' + name, base).href;
    }
}

// ── Signal 1: bait DOM elements (cosmetic filtering) ─────────────────────────
// EasyList-style cosmetic rules hide elements with ad-ish classes/ids. We plant
// a few visibly-sized, off-screen baits and see if the blocker eats them.

function baitBlocked()
{
    return new Promise((resolve) =>
    {
        try
        {
            if(!document.body)
            {
                document.addEventListener('DOMContentLoaded', () => resolve(baitBlockedSync(), { once: true }));
                return;
            }
            resolve(baitBlockedSync());
        }
        catch(e) { resolve(false); }
    });
}

function baitBlockedSync()
{
    let host = null;
    try
    {
        host = document.createElement('div');
        host.id = 'sheldon-guard-probe';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;overflow:hidden;pointer-events:none;';

        const mk = (tag, id, cls, w, h) =>
        {
            const el = document.createElement(tag);
            if(id) el.id = id;
            if(cls) el.className = cls;
            el.style.cssText = `width:${w}px;height:${h}px;display:block;visibility:visible;`;
            el.textContent = 'probe';
            return el;
        };

        // Classic EasyList bait shapes.
        host.append(
            mk('div', 'adsbox', '', 300, 250),
            mk('div', '', 'adsbygoogle ad-banner textads sponsored', 728, 90),
            mk('ins', '', 'adsbygoogle', 300, 250)
        );
        document.body.appendChild(host);
    }
    catch(e) { return false; }

    return new Promise((resolve) =>
    {
        setTimeout(() =>
        {
            let blocked = false;
            try
            {
                if(!document.body.contains(host)) blocked = true;
                else
                {
                    const kids = host.children;
                    for(let i = 0; i < kids.length && !blocked; i++)
                    {
                        const el = kids[i];
                        if(!document.body.contains(el)) { blocked = true; break; }
                        let cs = null;
                        try { cs = window.getComputedStyle(el); } catch(e) {}
                        const r = el.getBoundingClientRect();
                        if((cs && (cs.display === 'none' || cs.visibility === 'hidden')) ||
                           (r.width === 0 && r.height === 0 && el.offsetHeight === 0))
                        {
                            blocked = true;
                        }
                    }
                }
            }
            catch(e) {}
            try { host.remove(); } catch(e) {}
            resolve(blocked);
        }, 450);
    });
}

// ── Signal 2: blocked-URL probe ──────────────────────────────────────────────
// `fingerprint.js` still exists as a compat shim and its URL matches EasyPrivacy,
// so blockers refuse to fetch it. `device.js` (the real code) must load fine.
// control OK + probe blocked  => content blocker. Both fail => offline, not adblock.

async function urlProbeBlocked()
{
    const probe = absUrl('fingerprint.js');
    const control = absUrl('device.js');

    // A blocker/network middlebox may STALL a request instead of rejecting it —
    // without our own timeout the gate would hang forever and the claim would
    // die silently. Abort each probe fast; a timeout is "no evidence", and the
    // local bait test (which needs no network) still gets its vote.
    async function loadable(url)
    {
        let timer = null;
        try
        {
            const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            if(ctrl) timer = setTimeout(() => { try { ctrl.abort(); } catch(e) {} }, 4000);
            const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now(), {
                cache: 'no-store',
                signal: ctrl ? ctrl.signal : undefined
            });
            try { await res.text(); } catch(e) {}
            return res.ok;
        }
        catch(e) { return false; }
        finally { if(timer) clearTimeout(timer); }
    }

    try
    {
        const [ probeOk, controlOk ] = await Promise.all([ loadable(probe), loadable(control) ]);
        if(controlOk && !probeOk) return true;   // blocker confirmed
        return false;                            // both fine, or offline — not our call
    }
    catch(e) { return false; }
}

// ── Public: detection ────────────────────────────────────────────────────────

export async function detectAdblock()
{
    if(cachedResult !== null) return cachedResult;
    try
    {
        const [ bait, url ] = await Promise.all([
            baitBlocked().catch(() => false),
            urlProbeBlocked().catch(() => false)
        ]);
        cachedResult = !!(bait || url);
    }
    catch(e) { cachedResult = false; }
    return cachedResult;
}

export function resetAdblockCache()
{
    cachedResult = null;
}

// ── Strict identity (the "checks") ───────────────────────────────────────────
// Unlike the lenient `...Safe()` helpers used for read-only probes, this
// REQUIRES the full signal set. Missing pieces => the feature stays locked.

export async function getStrictIdentity()
{
    const out = { complete: false, blocked: false, deviceId: null, browserFp: null, payload: new URLSearchParams() };
    try
    {
        const mod = await import('./device.js');
        const payload = (mod && typeof mod.GetIdentityPayload === 'function')
            ? await mod.GetIdentityPayload()
            : new URLSearchParams();
        const deviceId = payload.get('fingerprint') || null;
        const browserFp = payload.get('browserFp') || null;
        out.deviceId = deviceId;
        out.browserFp = browserFp;
        out.payload = payload;
        out.complete = !!(deviceId && browserFp);
        return out;
    }
    catch(e)
    {
        // The dynamic import itself was refused — the blocker ate device.js.
        out.blocked = true;
        return out;
    }
}

// ── Notice UI ────────────────────────────────────────────────────────────────

function notifyToast(msg, type, ms)
{
    try { if(typeof window.Notify === 'function') window.Notify(msg, type || 'warning', ms || 8000); } catch(e) {}
}

export function showAdblockModal(featureLabel, opts)
{
    opts = opts || {};
    if(modalEl && document.body.contains(modalEl))
    {
        const hint = modalEl.querySelector('[data-guard-hint]');
        if(hint && opts.hint) hint.textContent = opts.hint;
        return modalEl;
    }

    const feature = featureLabel || 'this feature';
    const adblocked = opts.adblocked !== false; // default framing: content blocker

    const overlay = document.createElement('div');
    overlay.id = 'sheldon-adblock-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10004;background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;padding:20px;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#151515;border:1px solid rgba(199,177,143,0.35);border-radius:20px;padding:28px;width:min(430px,calc(100vw - 40px));text-align:center;box-shadow:0 20px 70px rgba(0,0,0,0.65);';

    const icon = document.createElement('div');
    icon.style.cssText = 'width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:rgba(199,177,143,0.12);border:1px solid rgba(199,177,143,0.35);display:flex;align-items:center;justify-content:center;';
    icon.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c7b18f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

    const title = document.createElement('div');
    title.textContent = 'Ad blocker detected';
    title.style.cssText = 'font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;';

    const body = document.createElement('div');
    body.textContent = adblocked
        ? `Free keys are funded by ads and guarded by device checks, so ${feature} needs your blocker turned off. Please disable your ad blocker (or whitelist projectsheldon.me), then press Check again.`
        : `We couldn't verify this device, so ${feature} is unavailable. A privacy extension may be interfering — please disable it for projectsheldon.me, then press Check again.`;
    body.style.cssText = 'font-size:13px;line-height:1.6;color:rgba(255,255,255,0.65);margin-bottom:8px;';

    const hint = document.createElement('div');
    hint.setAttribute('data-guard-hint', '1');
    hint.textContent = opts.hint || '';
    hint.style.cssText = 'font-size:12px;color:#c7b18f;min-height:16px;margin-bottom:14px;font-weight:600;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Check again';
    retryBtn.style.cssText = 'flex:1;padding:11px 0;border-radius:10px;border:none;background:#c7b18f;color:#050505;font-size:12px;font-weight:800;letter-spacing:0.05em;cursor:pointer;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'flex:1;padding:11px 0;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.75);font-size:12px;font-weight:700;cursor:pointer;';

    const close = () =>
    {
        try { overlay.remove(); } catch(e) {}
        if(modalEl === overlay) modalEl = null;
    };
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    retryBtn.addEventListener('click', async () =>
    {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Checking…';
        retryBtn.style.opacity = '0.7';
        try
        {
            resetAdblockCache();
            const [ stillBlocked, ident ] = await Promise.all([
                detectAdblock().catch(() => false),
                getStrictIdentity().catch(() => ({ complete: false }))
            ]);
            if(!stillBlocked && ident && ident.complete)
            {
                hint.textContent = 'All clear — reloading…';
                notifyToast('Blocker disabled — reloading to unlock the feature.', 'success', 3000);
                try { window.dispatchEvent(new CustomEvent('sheldon-adblock-cleared')); } catch(e) {}
                setTimeout(() => window.location.reload(), 700);
            }
            else
            {
                hint.textContent = stillBlocked
                    ? 'Still blocked — disable the ad blocker for this site, then try again.'
                    : 'Still unverified — a privacy extension may still be interfering.';
            }
        }
        catch(e) { hint.textContent = 'Check failed — please try again.'; }
        finally
        {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Check again';
            retryBtn.style.opacity = '1';
        }
    });

    row.append(retryBtn, closeBtn);
    box.append(icon, title, body, hint, row);
    overlay.append(box);
    document.body.appendChild(overlay);
    modalEl = overlay;
    return overlay;
}

// ── The gate: call this before any reward-granting request ───────────────────
// Returns { ok:true, payload, deviceId, browserFp } when the checks pass, or
// { ok:false } after showing the notice (caller must abort WITHOUT consuming
// any single-use token).

export async function ensureChecksOrNotify(featureLabel)
{
    // Outer safety net: the gate must NEVER hang — a stuck gate looks exactly
    // like "rewards silently don't work". If anything inside stalls past the
    // budget, fail closed with a notice (never silence).
    const GATE_BUDGET_MS = 10000;
    let timedOut = false;
    const gateWork = (async () =>
    {
        let adblocked = false;
        let ident = { complete: false, payload: new URLSearchParams() };
        try
        {
            const [ b, i ] = await Promise.all([
                detectAdblock().catch(() => false),
                getStrictIdentity().catch(() => ({ complete: false, payload: new URLSearchParams() }))
            ]);
            adblocked = !!b;
            if(i) ident = i;
        }
        catch(e) {}
        return { adblocked, ident };
    })();

    let adblocked = false;
    let ident = { complete: false, payload: new URLSearchParams() };
    try
    {
        const res = await Promise.race([
            gateWork,
            new Promise((_, reject) => setTimeout(() => { timedOut = true; reject(new Error('guard-timeout')); }, GATE_BUDGET_MS))
        ]);
        adblocked = !!res.adblocked;
        if(res.ident) ident = res.ident;
    }
    catch(e)
    {
        try { console.warn('[sheldon] device verification timed out — blocking the action instead of hanging.'); } catch(_) {}
        notifyToast('Verification timed out — please check your connection and try again.', 'warning', 6000);
        return { ok: false, adblocked: false, complete: false, timeout: true };
    }

    if(adblocked || !ident.complete)
    {
        try { console.warn('[sheldon] reward action gated: adblocked=' + adblocked + ' identityComplete=' + !!ident.complete); } catch(_) {}
        const msg = adblocked
            ? `Turn off your ad blocker to use ${featureLabel || 'this feature'}.`
            : `We couldn't verify this device — disable privacy extensions for this site to use ${featureLabel || 'this feature'}.`;
        notifyToast(msg, 'warning', 8000);
        try { showAdblockModal(featureLabel, { adblocked }); } catch(e) {}
        return { ok: false, adblocked, complete: !!ident.complete };
    }
    return { ok: true, adblocked: false, payload: ident.payload, deviceId: ident.deviceId, browserFp: ident.browserFp };
}

// ── Passive heads-up (once per session, main pages only) ─────────────────────

const PASSIVE_PAGES = ['/', '/index.html', '/checkout/', '/checkout/index.html', '/license/', '/license/index.html'];

function maybePassiveNotice()
{
    try
    {
        if(!PASSIVE_PAGES.includes(window.location.pathname)) return;
        try { if(sessionStorage.getItem('sheldon_adblock_noticed')) return; } catch(e) {}
        setTimeout(async () =>
        {
            try
            {
                if(await detectAdblock())
                {
                    try { sessionStorage.setItem('sheldon_adblock_noticed', '1'); } catch(e) {}
                    notifyToast('Heads up: ad blocker is on — your cookie choice still saves, but free keys need ads, so whitelist us when you claim one.', 'warning', 9000);
                }
            } catch(e) {}
        }, 3000);
    } catch(e) {}
}

window.SheldonAdblock = {
    detectAdblock,
    resetAdblockCache,
    getStrictIdentity,
    ensureChecksOrNotify,
    showAdblockModal
};

maybePassiveNotice();
