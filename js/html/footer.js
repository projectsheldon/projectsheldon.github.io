(function()
{
    // Canonical site footer. Lives here so every page renders the identical block –
    // the same approach js/html/topbar.js takes for the nav. Host pages only need
    // <div id="shared-footer"></div> plus this script.
    function footerLink(platform, label, extraClass)
    {
        return '<a href="javascript:void(0)" onclick="RedirectToPlatform(\'' + platform + '\')" ' +
            'class="text-neutral-400 hover:text-white transition-colors' + (extraClass || '') + '">' + label + '</a>';
    }

    function footerMarkup()
    {
        return '<footer class="site-footer pt-16 sm:pt-32 pb-16 border-t border-white/5 relative bg-black/40">' +
            '<div class="max-w-6xl mx-auto px-6">' +
                '<div class="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">' +
                    '<div class="space-y-6 max-w-sm">' +
                        '<div class="text-3xl font-black tracking-tighter text-white flex items-center gap-3">' +
                            '<div class="logo-box w-8 h-8 flex items-center justify-center">' +
                                '<img src="/favicon/icon.png" alt="Logo" class="w-8 h-8">' +
                            '</div>' +
                            '</div>SHELDON' +
                        '</div>' +
                        '<p class="text-neutral-500 text-sm font-medium leading-relaxed">' +
                            'Have fun using Project Sheldon, and also if you can support me by purchasing a license!' +
                        '</p>' +
                    '</div>' +
                    '<div class="grid grid-cols-2 md:grid-cols-3 gap-8 sm:gap-12 md:gap-24">' +
                        '<div class="space-y-6">' +
                            '<h4 class="text-[0.65rem] font-black text-white uppercase tracking-[0.2em]">Community</h4>' +
                            '<ul class="space-y-4 text-sm font-bold">' +
                                '<li>' + footerLink('personal_youtube', 'YouTube') + '</li>' +
                                '<li>' + footerLink('discord_invite', 'Discord Server') + '</li>' +
                            '</ul>' +
                        '</div>' +
                        '<div class="space-y-6">' +
                            '<h4 class="text-[0.65rem] font-black text-white uppercase tracking-[0.2em]">Legal</h4>' +
                            '<ul class="space-y-4 text-sm font-bold">' +
                                '<li><a href="/terms/" class="text-neutral-400 hover:text-white transition-colors">Terms of Service</a></li>' +
                            '</ul>' +
                        '</div>' +
                        '<div class="space-y-6">' +
                            '<h4 class="text-[0.65rem] font-black text-white uppercase tracking-[0.2em]">System</h4>' +
                            '<ul class="space-y-4 text-sm font-bold">' +
                                '<li>' + footerLink('status', '<span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Status',
                                    ' flex items-center gap-2') + '</li>' +
                            '</ul>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="pt-8 border-t border-white/5 flex justify-center md:justify-start">' +
                    '<p class="text-neutral-600 text-[0.6rem] font-bold tracking-[0.1em] uppercase">' +
                        '&copy; <span data-footer-year>2026</span> PROJECT SHELDON &bull; ALL RIGHTS RESERVED' +
                    '</p>' +
                '</div>' +
            '</div>' +
        '</footer>';
    }

    function ensureFooterStyles()
    {
        if(document.getElementById('sheldon-footer-styles')) return;
        // Shipped with the footer so no host page has to repeat these rules. Scoped
        // to .site-footer so a page's own `footer {}` layout rules still apply
        // (the dashboard offsets the footer by its sidebar width).
        const css =
            '.site-footer a{position:relative}' +
            '.site-footer a::after{content:"";position:absolute;bottom:-2px;left:0;width:0;height:1px;' +
                'background:#c7b18f;transition:width .3s ease}' +
            '.site-footer a:hover::after{width:100%}';
        const el = document.createElement('style');
        el.id = 'sheldon-footer-styles';
        el.textContent = css;
        document.head.appendChild(el);
    }

    // The footer links through RedirectToPlatform, which lives in
    // js/util/redirect.js. Several pages never loaded it, so their footer buttons
    // threw on click – resolve it next to this file (works at any hosting depth)
    // and load it once.
    function redirectScriptURL()
    {
        try {
            const scripts = document.getElementsByTagName('script');
            for(let i = scripts.length - 1; i >= 0; i--)
            {
                const src = scripts[i].getAttribute('src') || '';
                if(src.includes('html/footer.js')) return src.replace('html/footer.js', 'util/redirect.js');
            }
        } catch(e) {}
        return '/js/util/redirect.js';
    }

    function ensureRedirect()
    {
        try
        {
            if(window.RedirectToPlatform) return;
            if(document.getElementById('sheldon-redirect-script')) return;
            const s = document.createElement('script');
            s.type = 'module';
            s.id = 'sheldon-redirect-script';
            s.src = redirectScriptURL();
            document.head.appendChild(s);
        } catch(e) {}
    }

    function stampYear()
    {
        document.querySelectorAll('[data-footer-year]').forEach(el =>
        {
            try { el.textContent = String(new Date().getFullYear()); } catch(e) {}
        });
    }

    function injectFooter()
    {
        ensureFooterStyles();
        const placeholder = document.getElementById('shared-footer');
        if(!placeholder || placeholder.dataset.footerInjected) return;
        placeholder.dataset.footerInjected = '1';
        placeholder.outerHTML = footerMarkup();
        ensureRedirect();
        stampYear();
    }

    // Inject now so deferred scripts can capture the footer links.
    if(document.getElementById('shared-footer')) injectFooter();
    else if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectFooter);
    else injectFooter();
})();