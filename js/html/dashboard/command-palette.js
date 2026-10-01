// Command palette (Ctrl/Cmd+K) – jump between tabs, copy license keys, quick links.
// Pattern adapted from the admin panel's CommandPalette component.
(function() {
    if (window.__DashCommandPaletteLoaded) return;
    window.__DashCommandPaletteLoaded = true;

    const bridge = () => window.DashBridge || {};

    const ICONS = {
        grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/></svg>',
        key: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/></svg>',
        copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>',
        cart: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
        discord: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 00-4.89-1.52.07.07 0 00-.08.04c-.21.37-.44.85-.6 1.23a18.27 18.27 0 00-5.5 0 12.6 12.6 0 00-.6-1.23.08.08 0 00-.08-.04 19.74 19.74 0 00-4.88 1.52.07.07 0 00-.04.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 00.03.05 19.9 19.9 0 006 3.03.08.08 0 00.08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 00-.04-.11 13.1 13.1 0 01-1.87-.9.08.08 0 010-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01 14.2 14.2 0 0012.1 0 .07.07 0 01.08.01c.12.1.25.2.37.29a.08.08 0 010 .13 13.2 13.2 0 01-1.87.9.08.08 0 00-.04.11c.36.7.77 1.37 1.23 2a.08.08 0 00.08.03 19.83 19.83 0 006-3.03.08.08 0 00.03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 00-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.22 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42z"/></svg>',
        search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:rgba(255,255,255,0.35);flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    };

    const STATIC_ACTIONS = [
        { id: 'tab:overview', title: 'Overview', sub: 'Stats, usage progress and activity', icon: 'grid', run: () => bridge().switchTab('overview') },
        { id: 'tab:licenses', title: 'Licenses', sub: 'View and copy your license keys', icon: 'key', run: () => bridge().switchTab('licenses') },
        { id: 'act:checkout', title: 'Buy a license', sub: 'Open the checkout page', icon: 'cart', run: () => { window.location.href = '/checkout/'; } },
        { id: 'act:discord', title: 'Join Discord', sub: 'Open the Discord server', icon: 'discord', run: () => { if (window.RedirectToPlatform) window.RedirectToPlatform('discord_invite'); } }
    ];

    let _open = false;
    let _items = [];
    let _active = 0;
    let _input = null;
    let _list = null;
    let _modal = null;

    function fuzzyScore(needle, hay) {
        needle = needle.toLowerCase();
        hay = hay.toLowerCase();
        let hi = 0, score = 0, streak = 0;
        for (let i = 0; i < needle.length; i++) {
            const idx = hay.indexOf(needle[i], hi);
            if (idx === -1) return -1;
            streak = (idx === hi) ? streak + 1 : 0;
            score += 10 - Math.min(idx - hi, 10) + streak * 3;
            hi = idx + 1;
        }
        if (hay.startsWith(needle)) score += 40;
        return score;
    }

    function statusOf(lic) {
        if (lic.banned) return 'banned';
        if (lic.disabled) return 'disabled';
        if (lic.expires_at !== -1 && Date.now() > lic.expires_at) return 'expired';
        return 'active';
    }

    function dynamicItems(query) {
        const out = [];
        const licenses = bridge().getLicenses() || [];
        const q = query.trim().toLowerCase();

        if (q) {
            licenses.forEach((lic, i) => {
                const hay = (lic.key + ' ' + (lic.product || '')).toLowerCase();
                if (hay.indexOf(q) !== -1) {
                    out.push({
                        id: 'lic:' + i,
                        title: lic.key,
                        sub: (lic.product || 'License') + ' · ' + statusOf(lic) + ' – copy to clipboard',
                        icon: 'copy',
                        run: () => bridge().copyText(lic.key)
                    });
                }
            });
        } else {
            licenses.slice(0, 3).forEach((lic, i) => {
                out.push({
                    id: 'lic:' + i,
                    title: 'Copy ' + (lic.product || 'license') + ' key',
                    sub: lic.key,
                    icon: 'copy',
                    run: () => bridge().copyText(lic.key)
                });
            });
        }
        return out;
    }

    function render() {
        const q = _input.value.trim();
        const staticItems = STATIC_ACTIONS.map(a => ({ ...a }));

        let scored;
        if (!q) {
            scored = staticItems;
        } else {
            scored = staticItems
                .map(a => ({ item: a, score: Math.max(fuzzyScore(q, a.title), fuzzyScore(q, a.sub || '')) }))
                .filter(x => x.score > -1)
                .sort((a, b) => b.score - a.score)
                .map(x => x.item);
        }

        const dynamic = dynamicItems(q);
        const combined = [...scored, ...dynamic];
        _items = combined;
        _active = 0;

        if (combined.length === 0) {
            _list.innerHTML = '<div class="cmdp-empty">No matches. Try a tab name or a license key.</div>';
            return;
        }

        _list.innerHTML = combined.map((item, i) => `
            <div class="cmdp-item ${i === 0 ? 'active' : ''}" data-cmdp-idx="${i}">
                <div class="cmdp-icon">${ICONS[item.icon] || ''}</div>
                <div class="cmdp-body">
                    <div class="cmdp-title">${escapeHtml(item.title)}</div>
                    <div class="cmdp-sub">${escapeHtml(item.sub || '')}</div>
                </div>
                <span class="cmdp-kbd-enter">↵</span>
            </div>
        `).join('');

        _list.querySelectorAll('.cmdp-item').forEach(el => {
            el.addEventListener('mouseenter', () => setActive(parseInt(el.dataset.cmdpIdx, 10)));
            el.addEventListener('click', () => run(parseInt(el.dataset.cmdpIdx, 10)));
        });
    }

    function setActive(i) {
        _active = i;
        _list.querySelectorAll('.cmdp-item').forEach((el, idx) => {
            el.classList.toggle('active', idx === i);
        });
    }

    function run(i) {
        const item = _items[i];
        if (!item || typeof item.run !== 'function') return;
        close();
        item.run();
    }

    function onKey(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (_items.length) setActive((_active + 1) % _items.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (_items.length) setActive((_active - 1 + _items.length) % _items.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            run(_active);
        }
    }

    function open() {
        if (!_modal) return;
        _open = true;
        _modal.classList.add('show');
        _modal.setAttribute('aria-hidden', 'false');
        _input.value = '';
        render();
        setTimeout(() => _input.focus(), 30);
    }

    function close() {
        if (!_modal) return;
        _open = false;
        _modal.classList.remove('show');
        _modal.setAttribute('aria-hidden', 'true');
    }

    function toggle() {
        _open ? close() : open();
    }

    function init() {
        _input = document.getElementById('cmdpInput');
        _list = document.getElementById('cmdpList');
        _modal = document.getElementById('commandPalette');
        if (!_input || !_list || !_modal) return;

        document.getElementById('dash-cmdp-btn')?.addEventListener('click', () => toggle());

        _input.addEventListener('input', () => render());
        _input.addEventListener('keydown', onKey);

        document.addEventListener('keydown', (e) => {
            const isPaletteKey = (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey);
            if (isPaletteKey) {
                e.preventDefault();
                toggle();
            } else if (e.key === 'Escape' && _open) {
                e.preventDefault();
                close();
            }
        });

        _modal.addEventListener('mousedown', (e) => {
            if (e.target === _modal) close();
        });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();