/* Auth loading veil – covers the page from the very first paint until the
   Discord session has been confirmed (logged in or not). Loaded as a classic
   (non-module) script at the top of <body>, so it installs before any module
   script runs and the page never paints unauthenticated UI.

   The veil exposes window.AuthLoading.show() / hide(); auth.js calls hide()
   from UpdateUI() once CheckAuthStatus() has settled.
*/
(function () {
    'use strict';
    if (window.__authLoadingInstalled) return;
    window.__authLoadingInstalled = true;

    var V = 'auth-loading-veil';
    var BRAND_TILE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='28' fill='%23c7b18f'/%3E%3Ctext x='64' y='92' font-family='Inter,Arial,sans-serif' font-size='88' font-weight='900' fill='%23050505' text-anchor='middle'%3ES%3C/text%3E%3C/svg%3E";
    var STYLE =
        '#' + V + '{' +
            'position:fixed;inset:0;z-index:99990;' +
            'display:flex;align-items:center;justify-content:center;' +
            'background:#050505;' +
            "font-family:'Inter',sans-serif;" +
            'user-select:none;' +
            'opacity:1;' +
            'transition:opacity .45s ease,transform .45s ease;' +
        '}' +
        '#' + V + '.avl-hiding{opacity:0;transform:scale(1.04);pointer-events:none;}' +
        '#' + V + ' .avl-mesh{' +
            'position:absolute;inset:0;pointer-events:none;' +
            'background:radial-gradient(circle at 50% 50%,rgba(20,20,20,1) 0%,rgba(5,5,5,1) 100%);' +
        '}' +
        '#' + V + ' .avl-glow{' +
            'position:absolute;width:340px;height:340px;border-radius:50%;pointer-events:none;' +
            'background:#c7b18f;filter:blur(80px);opacity:0.15;' +
            'animation:avl-float 20s ease-in-out infinite alternate;' +
        '}' +
        '#' + V + ' .avl-glow.g1{top:32%;left:34%;}' +
        '#' + V + ' .avl-glow.g2{bottom:26%;right:31%;width:300px;height:300px;animation-duration:24s;animation-delay:-8s;}' +
        '@keyframes avl-float{from{transform:translate(0,0) scale(1);}to{transform:translate(24px,-32px) scale(1.1);}}' +
        '#' + V + ' .avl-particles{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.35;pointer-events:none;}' +
        '#' + V + ' .avl-stage{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:28px;padding:24px;text-align:center;' +
            'animation:avl-enter .5s cubic-bezier(.22,1,.36,1) both;' +
        '}' +
        '@keyframes avl-enter{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}' +
        '#' + V + ' .avl-logo{position:relative;width:56px;height:56px;flex-shrink:0;}' +
        '#' + V + ' .avl-logo img{' +
            'position:relative;z-index:1;width:100%;height:100%;object-fit:contain;' +
            'animation:avl-breathe 3s ease-in-out infinite alternate;' +
        '}' +
        '@keyframes avl-breathe{from{filter:drop-shadow(0 0 10px rgba(199,177,143,0.2));}to{filter:drop-shadow(0 0 26px rgba(199,177,143,0.4));}}' +
        '#' + V + ' .avl-row{display:flex;align-items:center;justify-content:center;gap:16px;}' +
        '#' + V + ' .avl-wordmark{' +
            "font-family:'Inter',sans-serif;font-weight:900;font-size:64px;" +
            'letter-spacing:-0.05em;line-height:1;' +
            'background:linear-gradient(to bottom,#fff 40%,#666 100%);' +
            '-webkit-background-clip:text;background-clip:text;' +
            '-webkit-text-fill-color:transparent;color:transparent;' +
        '}' +
        '#' + V + ' .avl-spinner{width:28px;height:28px;animation:avl-spin .7s linear infinite;}' +
        '@keyframes avl-spin{to{transform:rotate(360deg);}}' +
        '#' + V + ' .avl-caption{' +
            'font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.2em;' +
            'color:#c7b18f;' +
        '}' +
        '@media (prefers-reduced-motion:reduce){' +
            '#' + V + ' .avl-spinner{animation:none;}' +
            '#' + V + ' .avl-glow{animation:none;}' +
            '#' + V + ' .avl-stage{animation:none;}' +
            '#' + V + ' .avl-logo img{animation:none;}' +
        '}';

    function faviconHref()
    {
        // The bare mark, not the .ico - the ico tops out at 48px and this is the
        // fallback when logo.png is missing, so it wants the 512 render.
        var link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        if(link && link.href) return link.href.replace(/[^/]*$/, '') + 'icon.png';
        return location.origin + '/favicon/icon.png';
    }

    function brainHref()
    {
        // brain-transparent.png was never shipped; fall back to the logo that is.
        var link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        if(link && link.href) return link.href.replace(/[^/]*$/, '') + 'logo.png';
        return location.origin + '/favicon/logo.png';
    }

    var veil = null;
    var prevOverflow = '';

    function build()
    {
        if(veil && veil.parentNode) return veil;

        if(!document.getElementById('auth-loading-fonts'))
        {
            var fonts = document.createElement('link');
            fonts.id = 'auth-loading-fonts';
            fonts.rel = 'stylesheet';
            fonts.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&family=Inter:wght@300;400;500;600;700;800&display=swap';
            document.head.appendChild(fonts);
        }

        var style = document.createElement('style');
        style.id = 'auth-loading-styles';
        style.textContent = STYLE;
        document.head.appendChild(style);

        veil = document.createElement('div');
        veil.id = V;
        veil.setAttribute('role', 'status');
        var logo = document.createElement('img');
        logo.src = brainHref();
        logo.alt = '';
        logo.draggable = false;
        logo.onerror = function() {
            logo.src = faviconHref();
            logo.onerror = function() { logo.src = BRAND_TILE; };
        };
        veil.innerHTML =
            '<div class="avl-mesh"></div>' +
            '<div class="avl-glow g1"></div>' +
            '<div class="avl-glow g2"></div>' +
            '<div class="avl-stage">' +
                '<div class="avl-row">' +
                    '<div class="avl-logo"></div>' +
                    '<div class="avl-wordmark">SHELDON</div>' +
                '</div>' +
                '<svg class="avl-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                    '<circle cx="12" cy="12" r="9" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3"/>' +
                    '<path d="M21 12a9 9 0 0 0-9-9" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>' +
                '</svg>' +
                '<div class="avl-caption">Verifying session (bro just have patience and wait before website fully load)</div>' +
            '</div>' +
            '<canvas class="avl-particles"></canvas>';
        veil.querySelector('.avl-logo').appendChild(logo);
        document.body.appendChild(veil);

        var cv = veil.querySelector('.avl-particles');
        var ctx = cv.getContext('2d');
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var parts = [];
        function avlResize()
        {
            cv.width = window.innerWidth;
            cv.height = window.innerHeight;
        }
        window.addEventListener('resize', avlResize);
        avlResize();
        function avlParticle()
        {
            return {
                x: Math.random() * cv.width,
                y: Math.random() * cv.height,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                size: Math.random() * 2,
                opacity: Math.random() * 0.4
            };
        }
        for(var i = 0; i < 120; i++) parts.push(avlParticle());
        function avlFrame()
        {
            if(!cv.isConnected) return;
            ctx.clearRect(0, 0, cv.width, cv.height);
            for(var j = 0; j < parts.length; j++)
            {
                var p = parts[j];
                p.x += p.vx;
                p.y += p.vy;
                if(p.x < 0 || p.x > cv.width || p.y < 0 || p.y > cv.height) parts[j] = avlParticle();
                ctx.fillStyle = 'rgba(199,177,143,' + p.opacity + ')';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            if(!reduce) requestAnimationFrame(avlFrame);
        }
        avlFrame();
        return veil;
    }

    window.AuthLoading = {
        show: function()
        {
            var v = build();
            prevOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            v.classList.remove('avl-hiding');
        },
        hide: function()
        {
            if(!veil || veil.classList.contains('avl-hiding')) return;
            veil.classList.add('avl-hiding');
            document.body.style.overflow = prevOverflow || '';
            setTimeout(function()
            {
                if(veil && veil.parentNode) veil.parentNode.removeChild(veil);
            }, 500);
        }
    };

    window.AuthLoading.show();

    // Safety net: a hung auth check must never leave the site blocked.
    setTimeout(function() { if(window.AuthLoading) window.AuthLoading.hide(); }, 8000);
})();
