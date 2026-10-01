(function()
{
    if(document.getElementById('bottom-nav-styles')) return;

    const css = `
/* Bottom navigation bar – mobile only (≤768px) */
.bottom-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    height: 56px;
    background: rgba(5, 5, 5, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid rgba(255,255,255,0.08);
    padding: 0 12px;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.bottom-nav-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    text-decoration: none;
    color: rgba(255,255,255,0.35);
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}

.bottom-nav-link svg {
    width: 20px;
    height: 20px;
}

.bottom-nav-link.active {
    color: #c7b18f;
    background: rgba(199,177,143,0.1);
}

.bottom-nav-link:active {
    transform: scale(0.92);
}

.bottom-nav-discord {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(88, 101, 242, 0.12);
    border: 1px solid rgba(88, 101, 242, 0.2);
    color: #5865F2;
    cursor: pointer;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    position: absolute;
    right: 16px;
}

.bottom-nav-discord svg {
    width: 18px;
    height: 18px;
}

.bottom-nav-discord:active {
    transform: scale(0.92);
}

@media (max-width: 768px) {
    .bottom-nav {
        display: flex;
    }

    body {
        padding-bottom: 56px !important;
    }

    /* Hide hamburger menu button – bottom nav replaces it */
    .mobile-menu-btn {
        display: none !important;
    }

    /* Hide the dropdown mobile menu entirely */
    .mobile-menu {
        display: none !important;
    }

    /* Shrink the top nav on mobile */
    nav {
        padding: 0.4rem !important;
    }

    nav > div {
        height: 2.5rem !important;
        padding: 0 0.6rem !important;
        border-radius: 0.6rem !important;
        overflow: hidden;
    }

    .logo-box {
        width: 1.75rem !important;
        height: 1.75rem !important;
    }

    .logo-box img {
        width: 1.25rem !important;
        height: 1.25rem !important;
    }

    /* Hide the topbar login button on mobile – it's in bottom nav */
    #discord-login-btn {
        display: none !important;
    }

    /* Hide user profile in topbar on mobile */
    #user-profile-trigger {
        display: none !important;
    }
}
`;

    const style = document.createElement('style');
    style.id = 'bottom-nav-styles';
    style.textContent = css;
    document.head.appendChild(style);

    const DISCORD_SVG = '<svg viewBox="0 0 127.14 96.36" fill="#5865F2"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a.41.41,0,0,0-.43.2,72.48,72.48,0,0,0-3.17,6.52,97.26,97.26,0,0,0-29,0,72.84,72.84,0,0,0-3.19-6.52.4.4,0,0,0-.43-.2A105.09,105.09,0,0,0,19.44,8.07a.44.44,0,0,0-.2.07C2.12,34,1.15,59.39,3.46,84.41a.48.48,0,0,0,.19.34A105.77,105.77,0,0,0,35.77,96.36a.42.42,0,0,0,.46-.22,74.22,74.22,0,0,0,6.42-10.38.4.4,0,0,0-.22-.56,68.7,68.7,0,0,1-10-4.76.41.41,0,0,1,0-.69c.83-.62,1.67-1.28,2.46-1.95a.39.39,0,0,1,.41-.05,73.4,73.4,0,0,0,57.48,0,.39.39,0,0,1,.41.05c.79.67,1.63,1.33,2.46,1.95a.41.41,0,0,1,0,.69,68.61,68.61,0,0,1-10,4.76.41.41,0,0,0-.22.56,74.8,74.8,0,0,0,6.43,10.38.42.42,0,0,0,.46.22,105.48,105.48,0,0,0,32.11-11.61.45.45,0,0,0,.19-.34c2.72-28.53-4.67-53.59-20-76.27A.39.39,0,0,0,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.07,65.69,84.69,65.69Z"/></svg>';

    const USER_SVG = '<svg viewBox="0 0 24 24" fill="#c7b18f"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

    function isLoggedIn()
    {
        if(localStorage.getItem('discord_session_token')) return true;
        const trigger = document.getElementById('user-profile-trigger');
        if(trigger && !trigger.classList.contains('hidden') && getComputedStyle(trigger).display !== 'none') return true;
        return false;
    }

    function updateDiscordBtn()
    {
        const btn = document.getElementById('bottom-nav-discord-btn');
        if(!btn) return;

        if(isLoggedIn())
        {
            btn.innerHTML = USER_SVG;
            btn.classList.remove('discord-login-btn');
            btn.classList.add('logged-in');
            btn.onclick = function() { window.location.href = '/dashboard/'; };
        }
        else
        {
            btn.innerHTML = DISCORD_SVG;
            btn.classList.add('discord-login-btn');
            btn.classList.remove('logged-in');
            btn.onclick = null;
        }
    }

    function markActiveTab()
    {
        const path = (window.location.pathname.replace(/\/+$/, '') || '/');
        const tabForPath = path === '/luavm' || path.startsWith('/luavm/')
            ? '/luavm/'
            : (path.startsWith('/resellers') ? '/resellers' : '/');

        document.querySelectorAll('.bottom-nav-link').forEach(function(link)
        {
            const href = link.getAttribute('data-tab');
            link.classList.toggle('active', href === tabForPath);
        });
    }

    function injectBottomNav()
    {
        if(document.getElementById('bottom-nav')) return;

        const nav = document.createElement('nav');
        nav.className = 'bottom-nav';
        nav.id = 'bottom-nav';

        nav.innerHTML =
            '<a href="/" class="bottom-nav-link" data-tab="/">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
                    '<polyline points="9 22 9 12 15 12 15 22"/>' +
                '</svg>' +
            '</a>' +
            '<a href="/luavm/" class="bottom-nav-link" data-tab="/luavm/">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<polyline points="16 18 22 12 16 6"/>' +
                    '<polyline points="8 6 2 12 8 18"/>' +
                '</svg>' +
            '</a>' +
            '<a href="/resellers/directory/" class="bottom-nav-link" data-tab="/resellers">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
                    '<circle cx="9" cy="7" r="4"/>' +
                    '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
                    '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
                '</svg>' +
            '</a>' +
            '<button class="bottom-nav-discord discord-login-btn" id="bottom-nav-discord-btn" aria-label="Login with Discord">' +
                DISCORD_SVG +
            '</button>';

        document.body.appendChild(nav);
        markActiveTab();
        updateDiscordBtn();
    }

    if(document.readyState === 'loading')
    {
        document.addEventListener('DOMContentLoaded', injectBottomNav);
    }
    else
    {
        injectBottomNav();
    }

    // Observe #user-profile-trigger for auth state changes
    function observeAuthChanges()
    {
        const target = document.getElementById('user-profile-trigger');
        if(!target) return;

        const observer = new MutationObserver(function()
        {
            updateDiscordBtn();
        });

        observer.observe(target, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    if(document.readyState === 'loading')
    {
        document.addEventListener('DOMContentLoaded', observeAuthChanges);
    }
    else
    {
        observeAuthChanges();
    }
})();
