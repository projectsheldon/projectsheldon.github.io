// Cookie / fingerprint consent banner. Bottom-right prompt on the main pages, "Sure" /
// "No" buttons that first ask for confirmation (misclick protection), with the choice
// saved SERVER-SIDE against the device identity — final once recorded. A dismiss (X)
// records nothing and the prompt returns on the next visit. Also exposes window.SheldonCookies
// so the "View Licenses" menu can re-open the prompt and read the consent status.
import Api from './backend.js';
import { ensureChecksOrNotify } from './guard.js';

// Device identity is loaded LAZILY via dynamic import (never a static import):
// adblockers block fingerprinting scripts, and a blocked static import would
// abort this entire module — and every module that imports it (login button,
// products, downloads). Dynamic import + fallback keeps the page fully working.
async function loadIdentityPayload()
{
    try
    {
        const mod = await import('./device.js');
        if(mod && typeof mod.GetIdentityPayload === 'function') return await mod.GetIdentityPayload();
    }
    catch(e) { /* blocked by content blocker — fall through to minimal payload */ }
    // Minimal fallback: random device id only, no browser signals. The backend
    // treats the enriched fields as optional.
    try
    {
        const payload = new URLSearchParams();
        let id = null;
        try { id = localStorage.getItem('sheldon_fp'); } catch(_) {}
        if(!id)
        {
            try
            {
                id = (window.crypto && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : (Date.now().toString(36) + Math.random().toString(36).slice(2));
                localStorage.setItem('sheldon_fp', id);
            } catch(_) {}
        }
        if(id) payload.set('fingerprint', id);
        return payload;
    }
    catch(_) { return new URLSearchParams(); }
}

let consentStatus = null; // null = undecided, 'accepted', 'declined'
let bannerEl = null;
let modalEl = null;
let promptVisible = false;

const MAIN_PAGES = [ '/', '/index.html', '/checkout/', '/checkout/index.html', '/license/', '/license/index.html' ];

function isMainPage()
{
    return MAIN_PAGES.includes(window.location.pathname);
}

async function postForm(url, payload)
{
    const apiUrl = await Api.GetApiUrl();
    const res = await fetch(apiUrl + url, { method: 'POST', body: payload });
    return res.json().catch(() => null);
}

export async function FetchConsentStatus()
{
    try
    {
        const payload = await loadIdentityPayload();
        const data = await postForm('/workink/identity', payload);
        if(data && data.ok)
        {
            consentStatus = data.consent || null;
            window.dispatchEvent(new CustomEvent('sheldon-consent-state', { detail: { consent: consentStatus } }));
            return consentStatus;
        }
    } catch(e) {}
    return consentStatus;
}

export function GetConsentStatus()
{
    return consentStatus;
}

export async function RecordChoice(choice)
{
    // Strict device checks: the choice is recorded server-side against the device
    // identity, so recording REQUIRES it. Blocked checks => adblock notice and the
    // confirm modal stays open so the user can retry after whitelisting.
    let gate = null;
    try { gate = await ensureChecksOrNotify('saving your choice'); } catch(e) { gate = null; }
    if(!gate || !gate.ok) return false;
    try
    {
        const payload = gate.payload;
        payload.set('choice', choice);
        const data = await postForm('/workink/consent', payload);
        if(data && data.ok)
        {
            consentStatus = data.consent || choice;
            hidePrompt();
            window.dispatchEvent(new CustomEvent('sheldon-consent', { detail: { consent: consentStatus } }));
            return true;
        }
    } catch(e) {}
    return false;
}

// ── UI ───────────────────────────────────────────────────────────────────────────

const BANNER_TEXT = 'We use device fingerprinting keep free keys fair. Accepting cookies is required to get a free key with only 1 stage of work - otherwise it takes 3 stages, After you get your free key this doesn\'t apply. Your choice is final.';

function buildBanner()
{
    if(bannerEl) return bannerEl;

    const wrap = document.createElement('div');
    wrap.id = 'sheldon-site-notice';
    wrap.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:10002;width:min(360px,calc(100vw - 40px));background:rgba(18,18,18,0.97);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:18px 18px 16px;box-shadow:0 14px 50px rgba(0,0,0,0.6);font-family:Inter,sans-serif;color:#fff;';

    const text = document.createElement('div');
    text.textContent = BANNER_TEXT;
    text.style.cssText = 'font-size:12.5px;line-height:1.55;color:rgba(255,255,255,0.75);margin-bottom:14px;padding-right:14px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Dismiss (you will be asked again)';
    closeBtn.style.cssText = 'position:absolute;top:10px;right:12px;background:none;border:none;color:rgba(255,255,255,0.4);font-size:18px;cursor:pointer;line-height:1;padding:4px;';
    closeBtn.addEventListener('click', hidePrompt);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';

    const sureBtn = document.createElement('button');
    sureBtn.textContent = 'Sure';
    sureBtn.style.cssText = 'flex:1;padding:9px 0;border-radius:10px;border:none;background:#c7b18f;color:#050505;font-size:12px;font-weight:800;letter-spacing:0.06em;cursor:pointer;transition:background .2s;';
    sureBtn.addEventListener('mouseenter', () => { sureBtn.style.background = '#d9c29e'; });
    sureBtn.addEventListener('mouseleave', () => { sureBtn.style.background = '#c7b18f'; });
    sureBtn.addEventListener('click', () => askConfirm('accepted'));

    const noBtn = document.createElement('button');
    noBtn.textContent = 'No';
    noBtn.style.cssText = 'flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8);font-size:12px;font-weight:700;letter-spacing:0.06em;cursor:pointer;transition:background .2s;';
    noBtn.addEventListener('mouseenter', () => { noBtn.style.background = 'rgba(255,255,255,0.09)'; });
    noBtn.addEventListener('mouseleave', () => { noBtn.style.background = 'rgba(255,255,255,0.04)'; });
    noBtn.addEventListener('click', () => askConfirm('declined'));

    row.append(sureBtn, noBtn);
    wrap.append(closeBtn, text, row);
    document.body.appendChild(wrap);
    bannerEl = wrap;
    return wrap;
}

function askConfirm(choice)
{
    buildConfirmModal(choice);
}

function buildConfirmModal(choice)
{
    const label = choice === 'accepted' ? 'accept cookies' : 'decline cookies';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.style.cssText = 'background:#151515;border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:24px;width:min(380px,calc(100vw - 40px));text-align:center;';

    const title = document.createElement('div');
    title.textContent = 'Are you sure?';
    title.style.cssText = 'font-size:16px;font-weight:800;color:#fff;margin-bottom:8px;';

    const body = document.createElement('div');
    body.textContent = `You're about to ${label}. This choice is saved on our server and is final — it can't be changed later.`;
    body.style.cssText = 'font-size:13px;line-height:1.5;color:rgba(255,255,255,0.65);margin-bottom:18px;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex:1;padding:9px 0;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.75);font-size:12px;font-weight:700;cursor:pointer;';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = choice === 'accepted' ? "Yes, I'm sure" : 'Yes, decline';
    confirmBtn.style.cssText = 'flex:1;padding:9px 0;border-radius:10px;border:none;background:#c7b18f;color:#050505;font-size:12px;font-weight:800;cursor:pointer;';
    confirmBtn.addEventListener('click', async () =>
    {
        const ok = await RecordChoice(choice);
        if(ok) overlay.remove();
    });

    row.append(cancelBtn, confirmBtn);
    box.append(title, body, row);
    overlay.append(box);
    document.body.appendChild(overlay);
    modalEl = overlay;
}

export function ShowCookiePrompt()
{
    promptVisible = true;
    buildBanner().style.display = 'block';
}

function hidePrompt()
{
    promptVisible = false;
    if(bannerEl) bannerEl.style.display = 'none';
}

// ── Exposed API (used by the View Licenses menu on other pages) ──────────────────

window.SheldonCookies = {
    ShowCookiePrompt,
    GetConsentStatus,
    FetchConsentStatus
};

// ── Init ─────────────────────────────────────────────────────────────────────────

(async function init()
{
    try
    {
        const status = await FetchConsentStatus();
        // Only show the automatic prompt to logged-in visitors (a Discord session exists)
        // with no recorded choice. Recorded choice (accepted or declined) → never auto-show
        // again. Undecided visitors on the main pages get the prompt.
        const loggedIn = (() => { try { return !!localStorage.getItem('discord_session'); } catch(e) { return false; } })();
        if(!status && loggedIn && isMainPage())
        {
            ShowCookiePrompt();
        }
    }
    catch(e)
    {
        // Backend unreachable — stay completely silent, never break the page.
    }
})();
