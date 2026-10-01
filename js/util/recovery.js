/* Backend connectivity recovery – classic (non-module) script, loaded on the homepage
   and checkout only. backend.projectsheldon.me sits behind Cloudflare's adaptive
   Managed Challenge; for challenged clients (VPN / datacenter IPs) the hidden
   clearance iframe in clearance.js cannot pass an *interactive* challenge, so every
   API-backed action fails and the site looks dead. This module gives those visitors
   a visible, solvable pass: a small banner plus a modal that shows the challenge in a
   real iframe. The moment a backend probe succeeds, the modal clears, a
   'sheldon-backend-recovered' event fires on window, and every pending callback runs
   so the page can reload what had failed.

   Deliberately has no imports: clearance.js/backend.js call window.SheldonBackend
   through optional chaining, so pages without this script stay silent – and adding an
   import would create a circular dependency (recovery → backend → clearance). */

(function () {
    'use strict';
    if (window.SheldonBackend) return;

    var BACKEND_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        ? 'http://localhost:3350'
        : 'https://backend.projectsheldon.me';

    var BANNER_Z = 9500;
    var MODAL_Z = 99996;

    var bannerEl = null;
    var modalEl = null;
    var lastNotifiedAt = 0;
    var pendingRetries = [];

    function probeBackend()
    {
        return fetch(BACKEND_BASE + '/config/backend?cb=' + Date.now(), { mode: 'cors', credentials: 'include' })
            .then(function (r) { return r.ok; })
            .catch(function () { return false; });
    }

    // ── Banner ────────────────────────────────────────────────────────────────────

    function hideBanner()
    {
        if(bannerEl)
        {
            bannerEl.remove();
            bannerEl = null;
        }
    }

    function showBanner()
    {
        if(bannerEl) return;

        var b = document.createElement('div');
        b.id = 'sheldon-recovery-banner';
        b.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:' + BANNER_Z +
            ';display:flex;align-items:center;gap:10px;background:rgba(18,18,18,0.97);backdrop-filter:blur(14px);' +
            'border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px 12px;' +
            'font-family:Inter,sans-serif;color:#fff;font-size:12px;box-shadow:0 10px 40px rgba(0,0,0,0.5);' +
            'max-width:min(580px,calc(100vw - 32px));';

        var dot = document.createElement('span');
        dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0;';

        var txt = document.createElement('span');
        txt.style.cssText = 'color:rgba(255,255,255,0.75);line-height:1.4;';
        txt.textContent = "Can't reach the game servers. If this keeps failing, solve the connection check below.";

        var solveBtn = document.createElement('button');
        solveBtn.textContent = 'Solve Connection';
        solveBtn.style.cssText = 'flex-shrink:0;background:#c7b18f;color:#050505;border:none;border-radius:8px;' +
            'padding:8px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;' +
            'transition:background .2s;';
        solveBtn.addEventListener('mouseenter', function () { solveBtn.style.background = '#d9c29e'; });
        solveBtn.addEventListener('mouseleave', function () { solveBtn.style.background = '#c7b18f'; });
        solveBtn.addEventListener('click', openSolveModal);

        var dismissBtn = document.createElement('button');
        dismissBtn.textContent = '\u00d7';
        dismissBtn.title = 'Dismiss (you will be asked again)';
        dismissBtn.style.cssText = 'flex-shrink:0;background:none;border:none;color:rgba(255,255,255,0.4);' +
            'font-size:16px;cursor:pointer;line-height:1;padding:2px 4px;';
        dismissBtn.addEventListener('click', hideBanner);

        b.append(dot, txt, solveBtn, dismissBtn);
        document.body.appendChild(b);
        bannerEl = b;
    }

    document.addEventListener('sheldon-backend-recovered', hideBanner);

    // ── Solve modal ───────────────────────────────────────────────────────────────

    function openSolveModal()
    {
        if(modalEl) return;

        var overlay = document.createElement('div');
        overlay.id = 'sheldon-recovery-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:' + MODAL_Z +
            ';background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;' +
            'font-family:Inter,sans-serif;padding:20px;';
        overlay.addEventListener('click', function (e) { if(e.target === overlay) closeSolveModal(); });

        var box = document.createElement('div');
        box.style.cssText = 'background:#151515;border:1px solid rgba(255,255,255,0.14);border-radius:16px;' +
            'padding:22px;width:min(640px,calc(100vw - 40px));text-align:center;';

        var title = document.createElement('div');
        title.textContent = 'Connection check';
        title.style.cssText = 'font-size:16px;font-weight:800;color:#fff;margin-bottom:6px;';

        var body = document.createElement('div');
        body.textContent = "Our servers want you to pass a quick security check. If you see a puzzle below, solve it, then press Retry – the page will finish loading by itself.";
        body.style.cssText = 'font-size:12.5px;line-height:1.5;color:rgba(255,255,255,0.65);margin-bottom:14px;';

        var frame = document.createElement('iframe');
        frame.title = 'Security check';
        frame.style.cssText = 'width:100%;height:260px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;' +
            'background:#000;margin-bottom:12px;';
        frame.src = BACKEND_BASE + '/config/backend?cb=' + Date.now();

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;';

        var retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry now';
        retryBtn.style.cssText = 'flex:1;min-width:120px;background:#c7b18f;color:#050505;border:none;border-radius:10px;' +
            'padding:10px 14px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;';
        retryBtn.addEventListener('click', function ()
        {
            var btn = retryBtn;
            btn.disabled = true;
            btn.textContent = 'Checking\u2026';
            probeBackend().then(function (ok)
            {
                if(ok)
                {
                    resolveRecovery();
                    return;
                }
                btn.disabled = false;
                btn.textContent = 'Retry now';
                // Refresh the frame so a fresh challenge (or a cleared one) is visible.
                frame.src = BACKEND_BASE + '/config/backend?cb=' + Date.now();
            });
        });

        var tabLink = document.createElement('a');
        tabLink.href = BACKEND_BASE + '/config/backend';
        tabLink.target = '_blank';
        tabLink.rel = 'noopener';
        tabLink.textContent = 'Open in new tab';
        tabLink.style.cssText = 'color:#c7b18f;font-size:11px;font-weight:700;text-decoration:underline;padding:10px;';

        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cancel';
        closeBtn.style.cssText = 'padding:10px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);' +
            'border-radius:10px;color:rgba(255,255,255,0.8);font-size:12px;font-weight:700;cursor:pointer;';
        closeBtn.addEventListener('click', closeSolveModal);

        row.append(retryBtn, tabLink, closeBtn);
        box.append(title, body, frame, row);
        overlay.append(box);
        document.body.appendChild(overlay);
        modalEl = overlay;

        startAutoDetect();
    }

    function closeSolveModal()
    {
        modalEl = null;
        var overlay = document.getElementById('sheldon-recovery-overlay');
        if(overlay) overlay.remove();
    }

    function startAutoDetect()
    {
        var tries = 0;
        var timer = setInterval(function ()
        {
            // Modal closed or solved – stop the loop.
            if(!modalEl) { clearInterval(timer); return; }
            tries += 1;
            if(tries > 25) { clearInterval(timer); return; }
            probeBackend().then(function (ok)
            {
                if(ok && modalEl) resolveRecovery();
            });
        }, 1500);
    }

    // ── Recovery ──────────────────────────────────────────────────────────────────

    function resolveRecovery()
    {
        closeSolveModal();
        hideBanner();
        var cbs = pendingRetries;
        pendingRetries = [];
        window.dispatchEvent(new CustomEvent('sheldon-backend-recovered'));
        for(var i = 0; i < cbs.length; i++)
        {
            try { cbs[i](); } catch(e) {}
        }
    }

    window.SheldonBackend = {
        // Called by the fetch guard whenever a backend request fails after its retries.
        // Rate-limited so a storm of failed fetches shows exactly one banner.
        NotifyBackendFailure: function ()
        {
            var now = Date.now();
            if(now - lastNotifiedAt < 10000) return;
            lastNotifiedAt = now;
            showBanner();
        },
        // Register an operation to re-run once the connection is recovered.
        OnRecovered: function (cb)
        {
            pendingRetries.push(cb);
        }
    };
})();