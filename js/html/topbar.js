(function()
{
    function chevron()
    {
        return '<svg class="w-3 h-3 opacity-60 group-hover:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>';
    }

    function globeIcon(cls)
    {
        return '<svg class="' + (cls || 'w-3.5 h-3.5') + '" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5 0 4.5-4 4.5-9S14.5 3 12 3 7.5 7 7.5 12s2 9 4.5 9zm-9-9h18" /></svg>';
    }

    function panelLink(href, key, title, sub, onclick)
    {
        const click = onclick ? ' onclick="' + onclick + '"' : '';
        const tag = onclick && href === 'javascript:void(0)' ? 'a href="javascript:void(0)"' + click : 'a href="' + href + '"';
        return '<' + tag + ' class="block px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">' +
            '<span class="block text-[14px] font-semibold text-neutral-200" data-i18n="' + key + '.t">' + title + '</span>' +
            '<span class="block text-[12px] text-neutral-500" data-i18n="' + key + '.s">' + sub + '</span></a>';
    }

    function drop(key, label, inner)
    {
        return '<div class="relative group">' +
            '<button class="top-link"><span data-i18n="' + key + '">' + label + '</span>' + chevron() + '</button>' +
            '<div class="absolute top-full left-0 pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200">' +
                '<div class="min-w-[240px] bg-[#111] border border-white/10 rounded-2xl p-2 shadow-2xl">' + inner + '</div>' +
            '</div></div>';
    }

    function langButton(desktop)
    {
        if (desktop)
        {
            return '<button data-lang-btn class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-wide border border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white transition-all" aria-label="Select language">' +
                globeIcon('w-3.5 h-3.5') +
                '<span data-lang-current>English</span>' +
                '<svg class="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg></button>';
        }
        return '<div><div class="mobile-section-label" data-i18n="lang.language">Language</div>' +
            '<button data-lang-btn class="mobile-link w-full text-left flex items-center gap-2">' +
            globeIcon('w-4 h-4 text-neutral-500') +
            '<span data-lang-current>English</span></button></div>';
    }

    function navMarkup()
    {
        const drops =
            drop('nav.product', 'Product',
                panelLink('/', 'nav.product.overview', 'Overview', 'Get Sheldon today') +
                panelLink('/terms/', 'nav.product.terms', 'Terms of Service', 'Usage agreement') +
                panelLink('javascript:void(0)', 'nav.product.status', 'Status', 'Service health', "RedirectToPlatform('status')")) +
            drop('nav.docs', 'Documentation',
                panelLink('/luavm/', 'nav.docs.luavm', 'Lua VM docs', 'Guides and reference')) +
            drop('nav.download', 'Download',
                '<button data-nav-download class="w-full text-left block px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">' +
                    '<span class="block text-[14px] font-semibold text-neutral-200" data-i18n="nav.download.win.t">Windows</span>' +
                    '<span class="block text-[12px] text-neutral-500" data-i18n="nav.download.win.s">Download for Windows</span></button>' +
                panelLink('/dashboard/', 'nav.download.dash', 'Dashboard', 'Keys and account')) +
            drop('nav.pricing', 'Pricing',
                panelLink('/#pricing', 'nav.pricing.plans', 'Plans', 'Compare licenses') +
                panelLink('/resellers/directory/', 'nav.pricing.resellers', 'Resellers', 'Verified sellers')) +
            drop('nav.community', 'Community',
                panelLink('javascript:void(0)', 'nav.community.discord', 'Discord server', 'Chat and support', "RedirectToPlatform('discord_invite')") +
                panelLink('/guides/', 'nav.community.guides', 'Guides', 'Step-by-step tutorials'));

        return '<nav class="fixed top-0 w-full z-[100] bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10">' +
            '<div class="max-w-[1400px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">' +
                '<div class="flex items-center gap-6 min-w-0">' +
                    '<a href="/" class="flex items-center shrink-0" aria-label="Sheldon home">' +
                        '<div class="logo-box w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden">' +
                            '<img src="/favicon/favicon.ico" alt="Logo" class="w-7 h-7 rounded-lg">' +
                        '</div></a>' +
                    '<div class="hidden lg:flex items-center gap-0.5 nav-tabs-desktop">' + drops + '</div>' +
                '</div>' +

                '<div class="flex items-center gap-2 sm:gap-3 shrink-0">' +
                    '<div id="user-profile-trigger" class="hidden flex items-center gap-2 cursor-pointer group" style="position: relative;">' +
                        '<div class="flex flex-col leading-none text-right gap-0.5">' +
                            '<div class="user-name text-[0.7rem] font-bold text-neutral-400 transition-colors">Username</div>' +
                            '<div class="user-balance text-[0.6rem] font-bold text-[#c7b18f] tracking-wider hidden leading-none" style="margin-top: 1px"></div>' +
                        '</div>' +
                        '<div class="flex items-center gap-2 cursor-pointer group" style="position:relative;">' +
                            '<button class="flex items-center gap-2 bg-white/7 border border-white/15 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-widest uppercase text-white/80 cursor-pointer transition-all duration-200 hover:bg-white/12 hover:border-white/30" style="padding:5px 14px 5px 5px;">' +
                                '<div class="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:bg-white/10 transition-all group-hover:scale-105 ">' +
                                    '<img class="user-avatar w-full h-full object-cover hidden" src="" alt="Avatar">' +
                                    '<svg class="default-avatar w-full h-full text-neutral-400" fill="#ffffff" viewBox="0 0 24 24">' +
                                        '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />' +
                                    '</svg>' +
                                '</div>' +
                                '<span class="text-white/80 transition-colors duration-200 group-hover:text-[#c7b18f]">Account</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +

                    '<button id="discord-login-btn" class="btn-discord px-5 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-wide transition-all" aria-label="Sign in with Discord">' +
                        '<svg class="discord-login-icon w-3.5 h-3.5" viewBox="0 0 127.14 96.36" fill="#ffffff" aria-hidden="true">' +
                            '<path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a.41.41,0,0,0-.43.2,72.48,72.48,0,0,0-3.17,6.52,97.26,97.26,0,0,0-29,0,72.84,72.84,0,0,0-3.19-6.52.4.4,0,0,0-.43-.2A105.09,105.09,0,0,0,19.44,8.07a.44.44,0,0,0-.2.07C2.12,34,1.15,59.39,3.46,84.41a.48.48,0,0,0,.19.34A105.77,105.77,0,0,0,35.77,96.36a.42.42,0,0,0,.46-.22,74.22,74.22,0,0,0,6.42-10.38.4.4,0,0,0-.22-.56,68.7,68.7,0,0,1-10-4.76.41.41,0,0,1,0-.69c.83-.62,1.67-1.28,2.46-1.95a.39.39,0,0,1,.41-.05,73.4,73.4,0,0,0,57.48,0,.39.39,0,0,1,.41.05c.79.67,1.63,1.33,2.46,1.95a.41.41,0,0,1,0,.69,68.61,68.61,0,0,1-10,4.76.41.41,0,0,0-.22.56,74.8,74.8,0,0,0,6.43,10.38.42.42,0,0,0,.46.22,105.48,105.48,0,0,0,32.11-11.61.45.45,0,0,0,.19-.34c2.72-28.53-4.67-53.59-20-76.27A.39.39,0,0,0,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.07,65.69,84.69,65.69Z" />' +
                        '</svg>' +
                        '<svg class="discord-logout-icon w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                            '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />' +
                            '<polyline points="16 17 21 12 16 7" />' +
                            '<line x1="21" y1="12" x2="9" y2="12" />' +
                        '</svg>' +
                        '<svg class="discord-login-spinner w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                            '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />' +
                            '<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />' +
                        '</svg>' +
                        '<span id="discord-login-txt" class="hidden sm:inline">Sign in</span>' +
                    '</button>' +

                    langButton(true) +

                    '<button class="mobile-menu-btn lg:hidden" onclick="toggleMobileMenu()" aria-label="Menu">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
                            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +

            '<div class="mobile-menu" id="mobileMenu">' +
                '<div><div class="mobile-section-label" data-i18n="nav.product">Product</div>' +
                    '<a href="/" class="mobile-link" data-i18n="nav.product.overview.t">Overview</a>' +
                    '<a href="/terms/" class="mobile-link" data-i18n="nav.product.terms.t">Terms of Service</a>' +
                    '<a href="javascript:void(0)" onclick="RedirectToPlatform(\'status\')" class="mobile-link" data-i18n="nav.product.status.t">Status</a></div>' +
                '<div><div class="mobile-section-label" data-i18n="nav.docs">Documentation</div>' +
                    '<a href="/luavm/" class="mobile-link" data-i18n="nav.docs.luavm.t">Lua VM docs</a></div>' +
                '<div><div class="mobile-section-label" data-i18n="nav.download">Download</div>' +
                    '<a href="/dashboard/" class="mobile-link" data-i18n="nav.download.dash.t">Dashboard</a></div>' +
                '<div><div class="mobile-section-label" data-i18n="nav.pricing">Pricing</div>' +
                    '<a href="/#pricing" class="mobile-link" data-i18n="nav.pricing.plans.t">Plans</a>' +
                    '<a href="/resellers/directory/" class="mobile-link" data-i18n="nav.pricing.resellers.t">Resellers</a></div>' +
                '<div><div class="mobile-section-label" data-i18n="nav.community">Community</div>' +
                    '<a href="javascript:void(0)" onclick="RedirectToPlatform(\'discord_invite\')" class="mobile-link" data-i18n="nav.community.discord.t">Discord server</a>' +
                    '<a href="/guides/" class="mobile-link" data-i18n="nav.community.guides.t">Guides</a></div>' +
                langButton(false) +
            '</div>' +
        '</nav>';
    }

    function injectTopbar()
    {
        ensureTopbarStyles();
        const placeholder = document.getElementById('shared-topbar');
        if(!placeholder || placeholder.dataset.topbarInjected) return;
        placeholder.dataset.topbarInjected = '1';
        placeholder.outerHTML = navMarkup();
        wireTryButtons();
        ensureLanguage();
    }

    // Language selector lives in js/util/language.js — resolve it next to this
    // file (works at any hosting depth), fall back to site-absolute. Load once.
    function langScriptURL()
    {
        try {
            const scripts = document.getElementsByTagName('script');
            for (let i = scripts.length - 1; i >= 0; i--)
            {
                const src = scripts[i].getAttribute('src') || '';
                if (src.includes('topbar.js')) return src.replace('html/topbar.js', 'util/language.js');
            }
        } catch (e) {}
        return '/js/util/language.js';
    }

    function ensureLanguage()
    {
        try {
            if(window.SheldonLang) { window.SheldonLang.init(); return; }
            if(document.getElementById('sheldon-lang-script')) return;
            const s = document.createElement('script');
            s.id = 'sheldon-lang-script';
            s.src = langScriptURL();
            s.onload = function() { try { window.SheldonLang.init(); } catch(e) {} };
            document.head.appendChild(s);
        } catch(e) {}
    }

    function ensureTopbarStyles()
    {
        if(document.getElementById('sheldon-topbar-styles')) return;
        // Everything the injected topbar needs to look right, so it never depends
        // on the host page shipping its own copy of these rules.
        const css =
            '.top-link{display:flex;align-items:center;gap:.35rem;padding:.5rem .75rem;font-size:14px;font-weight:600;color:rgba(255,255,255,.7);transition:color .2s;white-space:nowrap;background:none;border:none;cursor:pointer}' +
            '.top-link:hover{color:#fff}' +
            '.logo-box{transition:transform .3s ease}' +
            '.logo-box:hover{transform:rotate(10deg) scale(1.05)}' +
            '#discord-login-btn.btn-discord{background:#5865F2;color:#fff;display:inline-flex;align-items:center;gap:.5rem;transition:all .3s ease;border:0;cursor:pointer;font-family:inherit}' +
            // The ID selector above outranks Tailwind's `.hidden`, so auth.js could
            // never hide the button when signed in — both buttons showed at once.
            '#discord-login-btn.hidden{display:none!important}' +
            '#discord-login-btn.btn-discord:hover{background:#4752c4;transform:translateY(-2px);box-shadow:0 10px 30px rgba(88,101,242,.3)}' +
            '#discord-login-btn.btn-discord.is-authed{background:#fff;color:#000}' +
            '#discord-login-btn.btn-discord.is-authed:hover{background:#c7b18f;box-shadow:0 10px 30px rgba(199,177,143,.3)}' +
            '#discord-login-btn.btn-discord.is-loading{pointer-events:none;opacity:.85}' +
            '.discord-logout-icon,.discord-login-spinner{display:none}' +
            '#discord-login-btn.is-authed .discord-login-icon{display:none}' +
            '#discord-login-btn.is-authed .discord-logout-icon{display:inline-block}' +
            '#discord-login-btn.is-loading .discord-login-icon,#discord-login-btn.is-loading .discord-logout-icon{display:none}' +
            '#discord-login-btn.is-loading .discord-login-spinner{display:inline-block;animation:discordSpin .7s linear infinite}' +
            '@keyframes discordSpin{to{transform:rotate(360deg)}}' +
            '.mobile-section-label{font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.2em;color:#525252;padding:0 .25rem}' +
            '.mobile-link{display:block;padding:.65rem .75rem;border-radius:.75rem;font-size:.9rem;font-weight:600;color:#d4d4d4;transition:all .2s}' +
            '.mobile-link:hover{background:rgba(255,255,255,.06);color:#fff}' +
            '.mobile-menu{top:64px!important;max-height:calc(100vh - 64px);overflow-y:auto;gap:1rem!important;padding:1rem 1.25rem 1.5rem!important}' +
            '@media (max-width:1023px){.nav-tabs-desktop{display:none!important}.mobile-menu-btn{display:block!important}}' +
            '@media (min-width:1024px){.mobile-menu{display:none!important}}';
        const el = document.createElement('style');
        el.id = 'sheldon-topbar-styles';
        el.textContent = css;
        document.head.appendChild(el);
    }

    function wireTryButtons()
    {
        // Landing page owns the download flow via #hero-cta (login-aware) —
        // don't also fire the generic /#pricing navigation there.
        if (document.getElementById('hero-cta')) return;
        document.querySelectorAll('[data-nav-download]').forEach(btn =>
        {
            btn.addEventListener('click', () =>
            {
                document.getElementById('mobileMenu')?.classList.remove('show');
                window.location.href = '/#pricing';
            });
        });
    }

    // Inject now so deferred scripts can capture login nodes.
    if(document.getElementById('shared-topbar'))
    {
        injectTopbar();
    }
    else if(document.readyState === 'loading')
    {
        document.addEventListener('DOMContentLoaded', injectTopbar);
    }
    else
    {
        injectTopbar();
    }

    window.toggleMobileMenu = function()
    {
        const menu = document.getElementById('mobileMenu');
        if(menu) menu.classList.toggle('show');
    };

    // Close mobile menu on link click (language button manages the menu itself —
    // it needs the anchor rect before the menu collapses).
    document.addEventListener('click', function(e)
    {
        if(e.target && e.target.closest && e.target.closest('[data-lang-btn]')) return;
        const link = e.target && e.target.closest ? e.target.closest('#mobileMenu a, #mobileMenu button') : null;
        if(link)
        {
            const menu = document.getElementById('mobileMenu');
            if(menu) menu.classList.remove('show');
            return;
        }

        const menu = document.getElementById('mobileMenu');
        if(!menu || !menu.classList.contains('show')) return;
        if(menu.contains(e.target) || (e.target.closest && e.target.closest('.mobile-menu-btn'))) return;
        menu.classList.remove('show');
    });

    window.addEventListener('resize', function()
    {
        const menu = document.getElementById('mobileMenu');
        if(menu && window.innerWidth > 1023) menu.classList.remove('show');
    });
})();
