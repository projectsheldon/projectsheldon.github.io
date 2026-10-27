import Api from '../util/backend.js';
import { CheckAuthStatus, DiscordAuth, UpdateUI } from './auth.js';
// Consent banner loaded lazily: it (transitively) touches device identity, and
// a blocked static import would abort THIS module too – leaving the login
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
  position:fixed;width:272px;z-index:10000;display:none;box-sizing:border-box;
  background:#141416;border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:6px;
  box-shadow:0 18px 50px rgba(0,0,0,0.6),0 2px 8px rgba(0,0,0,0.35);
  font-family:'Inter',sans-serif;
  opacity:0;transform:translateY(-4px);transform-origin:top right;
}
#user-dropdown-menu.sheldon-acct-menu.open{opacity:1;transform:none;transition:opacity 150ms ease-out,transform 150ms ease-out;}
#user-dropdown-menu.sheldon-acct-menu.closing{opacity:0;transform:translateY(-3px);transition:opacity 110ms ease-in,transform 110ms ease-in;}
#user-dropdown-menu .acct-head{display:flex;align-items:center;gap:11px;padding:10px 10px 12px;}
#user-dropdown-menu .acct-avatar,#user-dropdown-menu .acct-avatar-fallback{width:38px;height:38px;border-radius:50%;flex:none;object-fit:cover;border:1px solid rgba(199,177,143,0.35);}
#user-dropdown-menu .acct-avatar-fallback{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#e9dcc3;background:linear-gradient(135deg,#4a4136,#2a2620);}
#user-dropdown-menu .acct-name{font-size:13.5px;font-weight:650;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#user-dropdown-menu .acct-handle{font-size:12px;color:#7a7a7a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#user-dropdown-menu .acct-balance{display:flex;align-items:center;justify-content:space-between;margin:0 4px 6px;padding:8px 10px;border-radius:9px;background:rgba(199,177,143,0.07);border:1px solid rgba(199,177,143,0.14);font-size:12px;color:#a3a3a3;}
#user-dropdown-menu .acct-balance b{font:600 12.5px 'JetBrains Mono',monospace;color:#c7b18f;}
#user-dropdown-menu .acct-sep{height:1px;background:rgba(255,255,255,0.07);margin:5px 4px;}
#user-dropdown-menu .acct-item{display:flex;align-items:center;gap:10px;width:100%;height:34px;padding:0 10px;border:0;border-radius:8px;background:none;color:#d4d4d4;text-decoration:none;font:500 13px 'Inter',sans-serif;cursor:pointer;text-align:left;box-sizing:border-box;transition:background .12s ease,color .12s ease;}
#user-dropdown-menu .acct-item svg{flex:none;width:16px;height:16px;color:#8a8a8a;transition:color .12s ease;}
#user-dropdown-menu .acct-item:hover,#user-dropdown-menu .acct-item:focus-visible{background:rgba(255,255,255,0.06);color:#fff;outline:none;}
#user-dropdown-menu .acct-item:hover svg,#user-dropdown-menu .acct-item:focus-visible svg{color:#c7b18f;}
#user-dropdown-menu .acct-item .acct-hint{margin-left:auto;font:500 11px 'JetBrains Mono',monospace;color:#5f5f5f;}
#user-dropdown-menu .acct-item.danger:hover,#user-dropdown-menu .acct-item.danger:focus-visible{background:rgba(248,113,113,0.1);color:#fca5a5;}
#user-dropdown-menu .acct-item.danger:hover svg,#user-dropdown-menu .acct-item.danger:focus-visible svg{color:#fca5a5;}
#user-dropdown-menu .acct-cookie .acct-item{color:#8a8a8a;font-size:12.5px;}
@media (prefers-reduced-motion: reduce){
  #user-dropdown-menu.sheldon-acct-menu.open,#user-dropdown-menu.sheldon-acct-menu.closing{transition:none;transform:none;}
}`;
    document.head.appendChild(st);
}

// Resolve elements lazily – topbar may be injected asynchronously via topbar.js
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
    // Only accept messages from our own origin – the OAuth-callback popup – so third-party
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
                    else if(typeof Notify !== 'undefined') Notify('Login unavailable – please try again.', 'error', 3500);
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
// Delegated fallback – catches buttons added after this module ran (shared-topbar injection, dynamic content)
document.addEventListener('click', function (e)
{
    const target = e.target && e.target.closest ? e.target.closest('#discord-login-btn, .discord-login-btn') : null;
    if(!target) return;
    // If this button already has a direct listener, let that handle it and don't double-fire.
    // We detect by checking if the click already propagated via direct handler – to avoid
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
            const w = 272;
            menu.style.left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8)) + 'px';
            menu.style.top = (rect.bottom + 8) + 'px';
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
    btn.innerHTML = accountMenuIcon('<path d="M12 2a10 10 0 1010 10 4 4 0 01-5-5 4 4 0 01-5-5"/><path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01"/>') +
        `<span>Cookie settings</span>${status === 'declined' ? '<span class="acct-hint">declined</span>' : ''}`;
    btn.title = 'Show the cookie / fingerprint consent prompt again';
    btn.className = 'acct-item';
    btn.setAttribute('role', 'menuitem');
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

    const esc = s => window.escapeHtml ? window.escapeHtml(s) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const handle = user && user.username ? '@' + user.username : '';
    const balance = user && user.balance !== undefined ? Number(user.balance || 0).toFixed(1) : null;
    // On the dashboard itself the tab links switch tabs in place via the hash.
    const onDash = location.pathname.replace(/\/+$/, '') === '/dashboard';
    const dashHref = tab => (onDash ? '' : '/dashboard/') + (tab ? '#' + tab : '');

    menu.innerHTML = `
        <div class="acct-head">
            ${avatar}
            <div style="min-width:0;">
                <div class="acct-name">${esc(name)}</div>
                ${handle && handle.slice(1) !== name ? `<div class="acct-handle">${esc(handle)}</div>` : '<div class="acct-handle">Signed in with Discord</div>'}
            </div>
        </div>
        ${balance !== null ? `<div class="acct-balance"><span>Balance</span><b>${esc(balance)} credits</b></div>` : ''}

        <a href="${onDash ? '#' : '/dashboard/'}" class="acct-item" role="menuitem" data-acct-tab="overview">
            ${accountMenuIcon('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>')}
            <span>Dashboard</span>
        </a>
        <a href="${dashHref('licenses')}" class="acct-item" role="menuitem" data-acct-tab="licenses">
            ${accountMenuIcon('<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/>')}
            <span>Licenses</span>
        </a>
        <a href="${dashHref('settings')}" class="acct-item" role="menuitem" data-acct-tab="settings">
            ${accountMenuIcon('<circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>')}
            <span>Settings</span>
        </a>
        <button id="account-menu-link-device" class="acct-item" role="menuitem">
            ${accountMenuIcon('<rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>')}
            <span>Link new device</span>
        </button>
        <div class="acct-sep" role="separator"></div>
        <div id="acct-cookie-slot"></div>
        <button id="account-menu-signout" class="acct-item danger" role="menuitem">
            ${accountMenuIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')}
            <span>Sign out</span>
        </button>
    `;

    menu.querySelectorAll('[data-acct-tab]').forEach(a => a.addEventListener('click', e =>
    {
        if(!onDash) return;
        e.preventDefault();
        const tab = a.dataset.acctTab;
        if(window.DashBridge && typeof window.DashBridge.switchTab === 'function') window.DashBridge.switchTab(tab);
        else location.hash = tab === 'overview' ? '' : tab;
        ToggleAccountMenu(false);
    }));

    const signOutBtn = document.getElementById('account-menu-signout');
    if(signOutBtn) signOutBtn.addEventListener('click', SignOut);

    // Direction B entry point: mint a pre-bound QR + PIN for MY account so a
    // second browser can claim straight in. No-op when the auth module has not
    // loaded – the click must never die silently.
    const linkBtn = document.getElementById('account-menu-link-device');
    if(linkBtn) linkBtn.addEventListener('click', () =>
    {
        ToggleAccountMenu(false);
        try
        {
            if(window.DiscordAuth && typeof window.DiscordAuth.LinkNewDevice === 'function')
            {
                window.DiscordAuth.LinkNewDevice().catch(() => {});
            }
            else if(typeof window.Notify !== 'undefined')
            {
                window.Notify('Login module still loading – try again in a moment.', 'warning', 2500);
            }
        } catch(e) {}
    });

    appendCookieSettingsButton(menu.querySelector('#acct-cookie-slot') || menu);

    // Arrow keys walk the items like a native menu.
    menu.onkeydown = e =>
    {
        if(!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        const items = [...menu.querySelectorAll('.acct-item')];
        if(!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
            : e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next].focus();
    };
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
// are on the site – not just on the initial page load.
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