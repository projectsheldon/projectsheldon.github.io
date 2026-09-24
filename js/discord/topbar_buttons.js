import Api from '../util/backend.js';
import { CheckAuthStatus, DiscordAuth, UpdateUI } from './auth.js';
// Consent banner loaded lazily: it (transitively) touches device identity, and
// a blocked static import would abort THIS module too — leaving the login
// button with no click handler at all. Dynamic import keeps login working.
import('../util/site_notice.js').catch(() => {});

let cookieChoiceFinal = false; // a Sure/No choice was recorded → the menu button never returns

let userMenu = null;
let acctMenuClosing = false;
let acctMenuCloseTimer = 0;
let acctLastFocus = null;

function prefersReducedMotion()
{
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e) { return false; }
}

// Lively glass styling + open/close animation for the account popup.
// Kept here (not a global stylesheet) per storm isolation: only topbar files.
function ensureAccountMenuStyles()
{
    if(document.getElementById('account-menu-styles')) return;
    const st = document.createElement('style');
    st.id = 'account-menu-styles';
    st.textContent = `
#user-dropdown-menu.sheldon-acct-menu{
  position:fixed;width:300px;z-index:10000;display:none;
  background:linear-gradient(160deg,rgba(38,34,28,0.96),rgba(20,20,22,0.97));
  backdrop-filter:blur(22px) saturate(1.25);-webkit-backdrop-filter:blur(22px) saturate(1.25);
  border:1px solid rgba(199,177,143,0.22);border-radius:18px;padding:14px;
  box-shadow:0 24px 60px rgba(0,0,0,0.55),0 0 0 1px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.07);
  opacity:0;transform:scale(0.94) translateY(-6px);transform-origin:top right;
}
#user-dropdown-menu.sheldon-acct-menu.open{
  opacity:1;transform:scale(1) translateY(0);
  transition:opacity 180ms ease-out,transform 180ms ease-out;
}
#user-dropdown-menu.sheldon-acct-menu.closing{
  opacity:0;transform:scale(0.96) translateY(-4px);
  transition:opacity 140ms ease-in,transform 140ms ease-in;
}
#user-dropdown-menu .acct-head{display:flex;align-items:center;gap:12px;padding:6px 4px 13px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:10px;}
#user-dropdown-menu .acct-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;flex:none;border:2px solid rgba(199,177,143,0.55);box-shadow:0 0 0 3px rgba(199,177,143,0.12);}
#user-dropdown-menu .acct-avatar-fallback{width:42px;height:42px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#e9dcc3;background:linear-gradient(135deg,#4a4136,#2a2620);border:2px solid rgba(199,177,143,0.45);}
#user-dropdown-menu .acct-name{font-size:14px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.01em;}
#user-dropdown-menu .acct-sub{font-size:9.5px;color:#c7b18f;text-transform:uppercase;letter-spacing:0.16em;font-weight:800;margin-top:3px;display:flex;align-items:center;gap:6px;}
#user-dropdown-menu .acct-sub::before{content:"";width:6px;height:6px;border-radius:50%;background:#7ee2a8;box-shadow:0 0 8px rgba(126,226,168,0.9);}
#user-dropdown-menu .acct-item{display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.85);text-decoration:none;font-size:13px;font-weight:600;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease;font-family:'Inter',sans-serif;box-sizing:border-box;}
#user-dropdown-menu .acct-item:hover,#user-dropdown-menu .acct-item:focus-visible{background:rgba(199,177,143,0.12);border-color:rgba(199,177,143,0.35);color:#fff;outline:none;transform:translateX(2px);}
#user-dropdown-menu .acct-item.danger:hover,#user-dropdown-menu .acct-item.danger:focus-visible{background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.35);color:#fca5a5;}
#user-dropdown-menu .acct-item svg{flex:none;opacity:0.75;}
#user-dropdown-menu .acct-cookie{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);}
#user-dropdown-menu .acct-cookie-btn{width:100%;padding:9px 0;border-radius:10px;border:1px dashed rgba(199,177,143,0.4);background:rgba(199,177,143,0.07);color:#c7b18f;font-size:10.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;transition:background .16s ease;}
#user-dropdown-menu .acct-cookie-btn:hover{background:rgba(199,177,143,0.15);}
@media (prefers-reduced-motion: reduce){
  #user-dropdown-menu.sheldon-acct-menu.open,#user-dropdown-menu.sheldon-acct-menu.closing{transition:none;transform:none;}
}`;
    document.head.appendChild(st);
}

// Resolve elements lazily — topbar may be injected asynchronously via topbar.js
function getDiscordBtn()
{
    return document.getElementById('discord-login-btn');
}
function getUserProfileTrigger()
{
    return document.getElementById('user-profile-trigger');
}
const discordBtn = getDiscordBtn();
const userProfileTrigger = getUserProfileTrigger();

window.addEventListener('message', function (event)
{
    // Only accept messages from our own origin — the OAuth-callback popup — so third-party
    // pages can't plant a session token by postMessage from an attacker-controlled window.
    if(event.origin !== window.location.origin) return;
    if(event.data && event.data.type === 'discord_session')
    {
        window.DiscordAuth.SetSessionToken(event.data.token);
        CheckAuthStatus();
    }
});


async function DiscordBtnHandler(e)
{
    // Use the closest discord button so clicks on inner SVG/span still resolve
    const btn = (e && e.currentTarget && e.currentTarget.closest) ? e.currentTarget.closest('#discord-login-btn, .discord-login-btn') : null
        || (e && e.target ? e.target.closest?.('#discord-login-btn, .discord-login-btn') : null)
        || document.getElementById('discord-login-btn');

    // Guard against double-clicks while an action is already in flight.
    if(btn && btn.classList.contains('is-loading')) return;
    // If the login popup is already open, bring it to focus instead of ignoring silently
    if(window._discordLoginPopupOpen && !window.DiscordAuth?.currentUser)
    {
        const overlay = document.getElementById('discord-app-overlay');
        if(overlay) { overlay.style.opacity='1'; try{ overlay.querySelector('button')?.focus(); }catch(e){} return; }
    }

    if(window.DiscordAuth.currentUser)
    {
        // Logout: invalidate the session server-side first (best-effort), then clear locally.
        if(btn) btn.classList.add('is-loading');
        try
        {
            await window.DiscordAuth.Logout();
        }
        catch(err) {}

        window.DiscordAuth.DeleteSessionToken();
        window.DiscordAuth.currentUser = null;
        UpdateUI();

        if(typeof window.Notify !== 'undefined') window.Notify('Logged out', 'info', 2500);
    }
    else
    {
        // Login: show a spinner while the OAuth popup is being prepared (client id +
        // init-auth fetches). The popup itself drives the rest of the flow.
        // If DiscordAuth hasn't loaded yet (module load race), wait briefly before failing.
        if(!window.DiscordAuth || typeof window.DiscordAuth.LoginPopup !== 'function')
        {
            if(btn) btn.classList.add('is-loading');
            const start = Date.now();
            while((!window.DiscordAuth || typeof window.DiscordAuth.LoginPopup !== 'function') && Date.now() - start < 2500)
            {
                await new Promise(r => setTimeout(r, 120));
            }
        }
        if(btn) btn.classList.add('is-loading');
        try
        {
            if(window.DiscordAuth && typeof window.DiscordAuth.LoginPopup === 'function')
            {
                await window.DiscordAuth.LoginPopup();
            }
            else
            {
                // Fallback: direct redirect via backend so the click always does something
                try {
                    const apiUrl = await Api.GetApiUrl();
                    const res = await fetch(`${apiUrl}/discord/login`);
                    const data = await res.json();
                    if(data && typeof data.url === 'string' && /^https:\/\/discord\.com\//i.test(data.url)) window.location.href = data.url;
                    else if(typeof Notify !== 'undefined') Notify('Login unavailable — please try again.', 'error', 3500);
                } catch(err) { if(typeof Notify !== 'undefined') Notify('Could not reach login server.', 'error', 3500); }
            }
        }
        finally
        {
            if(btn) btn.classList.remove('is-loading');
        }
    }
}
function attachDiscordButtons()
{
    // id button (topbar)
    const mainBtn = document.getElementById('discord-login-btn');
    if(mainBtn && !mainBtn.dataset.sheldonBound)
    {
        mainBtn.dataset.sheldonBound = '1';
        mainBtn.addEventListener('click', DiscordBtnHandler);
    }
    // any .discord-login-btn (checkout, etc.)
    document.querySelectorAll('.discord-login-btn').forEach(btn =>
    {
        if(btn.dataset.sheldonBound) return;
        btn.dataset.sheldonBound = '1';
        btn.addEventListener('click', DiscordBtnHandler);
    });
}
if(discordBtn)
{
    attachDiscordButtons();
}
// Delegated fallback — catches buttons added after this module ran (shared-topbar injection, dynamic content)
document.addEventListener('click', function (e)
{
    const target = e.target && e.target.closest ? e.target.closest('#discord-login-btn, .discord-login-btn') : null;
    if(!target) return;
    // If this button already has a direct listener, let that handle it and don't double-fire.
    // We detect by checking if the click already propagated via direct handler — to avoid
    // double-login, just ensure we only handle when direct didn't run. Simplest: if
    // target has dataset bound, the direct handler will already run, so we no-op here.
    // But for buttons that were missed (no dataset), handle here.
    if(target.dataset.sheldonBound) return;
    e.preventDefault();
    DiscordBtnHandler(e);
});
// Re-attach when topbar is injected later
if(typeof MutationObserver !== 'undefined')
{
    const obs = new MutationObserver(() => { attachDiscordButtons(); attachProfileTrigger(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });
}

function CreateAccountMenu()
{
    ensureAccountMenuStyles();
    if(userMenu) return userMenu;

    userMenu = document.createElement('div');
    userMenu.id = 'user-dropdown-menu';
    userMenu.className = 'sheldon-acct-menu';
    userMenu.setAttribute('role', 'menu');
    userMenu.setAttribute('aria-label', 'Account menu');
    userMenu.tabIndex = -1;
    userMenu.style.display = 'none';
    document.body.appendChild(userMenu);
    return userMenu;
}
function ToggleAccountMenu(show, opts)
{
    const menu = CreateAccountMenu();
    opts = opts || {};

    if(show)
    {
        if(acctMenuCloseTimer) { clearTimeout(acctMenuCloseTimer); acctMenuCloseTimer = 0; }
        acctMenuClosing = false;
        try { acctLastFocus = document.activeElement || null; } catch(e) { acctLastFocus = null; }
        const trigger = document.getElementById('user-profile-trigger');
        if(trigger)
        {
            const rect = trigger.getBoundingClientRect();
            const w = 300;
            menu.style.left = Math.max(8, Math.min(rect.right - (w - 40), window.innerWidth - w - 8)) + 'px';
            menu.style.top = (rect.bottom + 10) + 'px';
            menu.style.right = 'auto';
        }
        menu.style.display = 'block';
        menu.classList.remove('closing');
        // Force reflow so the open transition plays.
        void menu.offsetWidth;
        RenderAccountMenu().catch(() => {});
        requestAnimationFrame(() =>
        {
            if(!prefersReducedMotion()) menu.classList.add('open');
            else { menu.classList.add('open'); }
            if(!opts.noFocus)
            {
                try
                {
                    const first = menu.querySelector('a, button');
                    if(first) first.focus({ preventScroll: true });
                } catch(e) {}
            }
        });
    } else
    {
        if(!menu || menu.style.display !== 'block' || acctMenuClosing) return;
        const done = () =>
        {
            menu.style.display = 'none';
            menu.classList.remove('open', 'closing');
            acctMenuClosing = false;
            acctMenuCloseTimer = 0;
            // Focus retention: return focus to the trigger / prior element.
            try
            {
                const trg = document.getElementById('user-profile-trigger');
                const back = (trg && trg.contains(acctLastFocus)) || !acctLastFocus || !document.contains(acctLastFocus) ? trg : acctLastFocus;
                if(back && document.contains(back))
                {
                    if(!back.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT)$/i.test(back.tagName)) back.setAttribute('tabindex', '-1');
                    back.focus({ preventScroll: true });
                }
            } catch(e) {}
        };
        if(prefersReducedMotion()) { done(); return; }
        acctMenuClosing = true;
        menu.classList.remove('open');
        menu.classList.add('closing');
        acctMenuCloseTimer = setTimeout(done, 140);
    }
}

function SignOut()
{
    const close = () => { ToggleAccountMenu(false); };
    if(!window.DiscordAuth.currentUser) { close(); return; }

    DiscordAuth.Logout().catch(() => {})
        .finally(() =>
        {
            DiscordAuth.DeleteSessionToken();
            DiscordAuth.currentUser = null;
            UpdateUI();
            close();
            if(typeof window.Notify !== 'undefined') window.Notify('Logged out', 'info', 2500);
        });
}

// "Cookie settings" row in the account menu: shown while consent is undecided or declined
// (a way to read/re-open the prompt without the banner auto-showing). Once the user
// proceeds with Sure or No, the row is removed forever.
function appendCookieSettingsButton(menu)
{
    if(cookieChoiceFinal) return;
    let status = null;
    try { status = window.SheldonCookies?.GetConsentStatus?.() ?? null; } catch(e) {}
    if(status === 'accepted') return;

    const wrap = document.createElement('div');
    wrap.id = 'cookie-settings-btn';
    wrap.className = 'acct-cookie';

    const btn = document.createElement('button');
    btn.textContent = status === 'declined' ? 'Cookie settings \u2014 declined' : 'Cookie settings';
    btn.title = 'Show the cookie / fingerprint consent prompt again';
    btn.className = 'acct-cookie-btn';
    btn.addEventListener('click', () =>
    {
        try { window.SheldonCookies?.ShowCookiePrompt?.(); } catch(e) {}
    });
    wrap.append(btn);
    menu.append(wrap);
}

window.addEventListener('sheldon-consent', function ()
{
    cookieChoiceFinal = true;
    const btn = document.getElementById('cookie-settings-btn');
    if(btn) btn.remove();
});

window.addEventListener('sheldon-consent-state', function (e)
{
    if(e && e.detail && e.detail.consent === 'accepted')
    {
        cookieChoiceFinal = true;
        const btn = document.getElementById('cookie-settings-btn');
        if(btn) btn.remove();
    }
});

function accountMenuIcon(svg)
{
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;">${svg}</svg>`;
}

async function RenderAccountMenu()
{
    const menu = CreateAccountMenu();

    const token = DiscordAuth.GetSessionToken();
    if(!token)
    {
        menu.innerHTML = '<div class="text-neutral-400 text-sm text-center py-4">Please log in to view your account</div>';
        return;
    }

    let user = window.DiscordAuth.currentUser;
    if(!user)
    {
        try { user = await DiscordAuth.GetUser(); } catch(e) {}
    }

    const name = (user && (user.globalName || user.username)) || 'Account';
    const initial = (name.charAt(0) || 'A').toUpperCase();
    const avatar = user && user.avatar
        ? `<img class="acct-avatar" src="${user.avatar}" alt="">`
        : `<div class="acct-avatar-fallback">${window.escapeHtml ? window.escapeHtml(initial) : initial}</div>`;

    menu.innerHTML = `
        <div class="acct-head">
            ${avatar}
            <div style="min-width:0;">
                <div class="acct-name">${window.escapeHtml ? window.escapeHtml(name) : name}</div>
                <div class="acct-sub">Account Menu</div>
            </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
            <a href="/dashboard/" class="acct-item" role="menuitem">
                ${accountMenuIcon('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>')}
                <span>Dashboard</span>
            </a>
            <button id="account-menu-signout" class="acct-item danger" role="menuitem">
                ${accountMenuIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')}
                <span>Sign out</span>
            </button>
        </div>
    `;

    const signOutBtn = document.getElementById('account-menu-signout');
    if(signOutBtn) signOutBtn.addEventListener('click', SignOut);

    appendCookieSettingsButton(menu);
}

function attachProfileTrigger()
{
    const trg = getUserProfileTrigger();
    if(trg && !trg.dataset.sheldonBound)
    {
        trg.dataset.sheldonBound = '1';
        trg.addEventListener('click', function (e)
        {
            e.stopPropagation();
            const menu = CreateAccountMenu();
            const isVisible = menu.style.display === 'block';
            ToggleAccountMenu(!isVisible);
        });
    }
}
attachProfileTrigger();
// Delegated fallback for profile trigger that wasn't bound yet
document.addEventListener('click', function (e)
{
    const trg = e.target && e.target.closest ? e.target.closest('#user-profile-trigger') : null;
    if(trg)
    {
        if(trg.dataset.sheldonBound) return;
        e.stopPropagation();
        const menu = CreateAccountMenu();
        const isVisible = menu.style.display === 'block';
        ToggleAccountMenu(!isVisible);
        return;
    }
    const curTrigger = getUserProfileTrigger();
    if(userMenu && !userMenu.contains(e.target) && !curTrigger?.contains(e.target))
    {
        ToggleAccountMenu(false);
    }
});
// Escape closes the popup and returns focus to the trigger.
document.addEventListener('keydown', function (e)
{
    if(e.key !== 'Escape' && e.key !== 'Esc') return;
    if(userMenu && userMenu.style.display === 'block') ToggleAccountMenu(false);
});
// Ensure both button types are bound after topbar injection
attachDiscordButtons();
document.addEventListener('DOMContentLoaded', () => { attachDiscordButtons(); attachProfileTrigger(); CheckAuthStatus(); });
// Also run immediately if DOM already ready
if(document.readyState !== 'loading') { attachDiscordButtons(); attachProfileTrigger(); }

// Presence heartbeat: while a logged-in tab is open, keep touching /discord/me
// so the backend's "Website Active Now" counts the visitor the whole time they
// are on the site — not just on the initial page load.
(function ()
{
    const HEARTBEAT_MS = 30000;
    setInterval(async () =>
    {
        try
        {
            if(DiscordAuth.GetSessionToken()) await CheckAuthStatus();
        } catch(e) {}
    }, HEARTBEAT_MS);
})();