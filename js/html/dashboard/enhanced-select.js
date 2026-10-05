(function() {
    if (window.__EnhancedSelectLoaded) return;
    window.__EnhancedSelectLoaded = true;

    const CSS = `
.esel { position: relative; display: inline-block; min-width: 140px; font-family: inherit; }
/* Stand-in for a native select that filled its parent (the modal .fld pickers).
   The wrapper is inline-block, so without this the trigger collapses to
   min-width and stops short of the field sitting next to it. */
.esel--fill { display: block; width: 100%; }
.esel-trigger {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    color: #fff;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    transition: background 0.15s ease, border-color 0.15s ease;
    outline: none;
    text-align: left;
    line-height: 1.2;
    min-height: 42px;
}
.esel-trigger:hover, .esel.is-open .esel-trigger, .esel-trigger:focus {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.2);
}
.esel.is-open .esel-trigger {
    border-color: #c7b18f;
    box-shadow: 0 0 0 3px rgba(199,177,143,0.1);
}
.esel-value { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.esel-value.is-placeholder { color: rgba(255,255,255,0.35); }
.esel-chevron {
    width: 14px; height: 14px;
    flex-shrink: 0;
    color: rgba(255,255,255,0.4);
    transition: transform 0.2s ease, color 0.15s ease;
}
.esel.is-open .esel-chevron { transform: rotate(180deg); color: #c7b18f; }

.esel-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    /* Never a percentage: the menu is pinned with position:fixed at open time,
       where 100% would resolve against the viewport and blow the box up to
       full screen width. The widget sets an explicit px min-width instead. */
    min-width: 0;
    background: #0d0d0d;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 4px;
    max-height: 440px;
    overflow-y: auto;
    z-index: 10000;
    display: none;
    box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03);
}
.esel.is-open .esel-menu {
    display: block;
    animation: eselMenuIn 0.15s ease-out;
}
.esel.is-flip-up .esel-menu { top: auto; bottom: calc(100% + 4px); }
.esel.is-flip-up.is-open .esel-menu { animation: eselMenuInUp 0.15s ease-out; }
@keyframes eselMenuIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes eselMenuInUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}
.esel-menu::-webkit-scrollbar { width: 6px; }
.esel-menu::-webkit-scrollbar-track { background: transparent; }
.esel-menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
.esel-menu::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
.esel-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    background: transparent;
    border: 0;
    padding: 0.55rem 0.75rem;
    color: rgba(255,255,255,0.7);
    font-size: 0.85rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.1s ease, color 0.1s ease;
    line-height: 1.3;
}
.esel-option:hover, .esel-option.is-active {
    background: rgba(255,255,255,0.05);
    color: #fff;
}
.esel-option.is-selected {
    color: #c7b18f;
    background: rgba(199,177,143,0.08);
}
.esel-option.is-selected:hover, .esel-option.is-selected.is-active {
    background: rgba(199,177,143,0.14);
    color: #c7b18f;
}
.esel-check {
    width: 14px; height: 14px;
    color: #c7b18f;
    opacity: 0;
    flex-shrink: 0;
}
.esel-option.is-selected .esel-check { opacity: 1; }
/* Narrow viewports cannot always fit a long label on one line (the menu is
   capped to the room beside the trigger), so wrap instead of ellipsising. */
@media (max-width: 520px) {
    .esel-option > span { white-space: normal; overflow-wrap: anywhere; }
}
`;

    if (!document.getElementById('enhanced-select-styles')) {
        const s = document.createElement('style');
        s.id = 'enhanced-select-styles';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    const CHEVRON = '<svg class="esel-chevron" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 8 10 12 14 8"/></svg>';
    const CHECK = '<svg class="esel-check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 10 8.5 13.5 15 7"/></svg>';

    let openInstance = null;

    function enhance(nativeSelect) {
        if (!nativeSelect || nativeSelect._enhanced || nativeSelect.multiple) return;
        nativeSelect._enhanced = true;

        const carryClass = nativeSelect.className || '';
        const styleWidth = nativeSelect.style.width;
        // Did the native control span its parent? Measured before it is hidden
        // (offsetWidth is 0 once display:none) so the trigger keeps the same
        // width the select had instead of falling back to min-width.
        let fillParent = false;
        try {
            fillParent = /(^|\s)fld(\s|$)/.test(carryClass);
            if (!fillParent && nativeSelect.parentElement) {
                const nw = nativeSelect.getBoundingClientRect().width;
                const pw = nativeSelect.parentElement.getBoundingClientRect().width;
                fillParent = nw > 0 && pw > 0 && nw >= pw - 2;
            }
        } catch (e) {}
        nativeSelect.style.display = 'none';
        nativeSelect.setAttribute('aria-hidden', 'true');
        nativeSelect.tabIndex = -1;

        const wrap = document.createElement('div');
        wrap.className = 'esel';
        // Copy width-related classes so layout (w-full, md:w-auto, flex-1) survives.
        if (/(^|\s)(w-full|md:w-auto|flex-1|flex-grow)(\s|$)/.test(carryClass)) {
            const layout = carryClass.match(/(?:^|\s)(w-full|md:w-auto|flex-1|flex-grow)(?=\s|$)/g);
            if (layout) wrap.className += ' ' + layout.join(' ').trim();
        }
        if (styleWidth) wrap.style.width = styleWidth;
        if (fillParent) wrap.classList.add('esel--fill');
        // Alignment: licenses filter opens left (right-aligned). Stats + filter
        // selects get wider menus so labels like "Without expired" never clip.
        const isLicFilter = nativeSelect.id === 'licFilter';
        const isStatsSel = nativeSelect.id === 'statsGlobalRange' || (nativeSelect.dataset && nativeSelect.dataset.statsRange);
        const isFilterSel = nativeSelect.id === 'auditFilter' || nativeSelect.id === 'devicesConsentFilter' || nativeSelect.id === 'bannedSort' || nativeSelect.id === 'sysBanType' || nativeSelect.id === 'lcProduct';
        if (isLicFilter) wrap.classList.add('esel--right');
        if (isStatsSel || isLicFilter || isFilterSel) wrap.classList.add('esel--wide');
        if (nativeSelect.dataset && nativeSelect.dataset.eselAlign === 'right') wrap.classList.add('esel--right');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'esel-trigger';
        trigger.innerHTML = '<span class="esel-value"></span>' + CHEVRON;

        const menu = document.createElement('div');
        menu.className = 'esel-menu';
        menu.setAttribute('role', 'listbox');

        function buildOptions() {
            menu.innerHTML = '';
            Array.from(nativeSelect.options).forEach((opt) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'esel-option';
                item.setAttribute('role', 'option');
                item.dataset.value = opt.value;
                item.innerHTML = '<span>' + escapeHtml(opt.textContent) + '</span>' + CHECK;
                item.addEventListener('mouseenter', () => setActive(item));
                // Native <select> sets the active option; mirror it so a highlight
                // ring follows keyboard/mouse without an extra render.
                item.setAttribute('data-opt', opt.value);
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectValue(opt.value, true);
                    close();
                });
                menu.appendChild(item);
            });
        }

        function syncValueDisplay() {
            const value = nativeSelect.value;
            const selectedOpt = Array.from(nativeSelect.options).find(o => o.value === value) || nativeSelect.options[0];
            const valueEl = trigger.querySelector('.esel-value');
            if (!selectedOpt || selectedOpt.value === '') {
                // Empty value – treat first option as placeholder if it looks like one.
                valueEl.textContent = selectedOpt ? selectedOpt.textContent : '';
                valueEl.classList.add('is-placeholder');
            } else {
                valueEl.textContent = selectedOpt.textContent;
                valueEl.classList.remove('is-placeholder');
            }
            menu.querySelectorAll('.esel-option').forEach(o => {
                o.classList.toggle('is-selected', o.dataset.value === value);
            });
        }

        function selectValue(v, fireEvent) {
            const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
            desc.set.call(nativeSelect, v);
            syncValueDisplay();
            if (fireEvent) {
                nativeSelect.dispatchEvent(new Event('input', { bubbles: true }));
                nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // Intercept programmatic .value assignments so external code that does
        // `select.value = "x"` also updates our custom UI.
        try {
            const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
            Object.defineProperty(nativeSelect, 'value', {
                configurable: true,
                get: function() { return desc.get.call(this); },
                set: function(v) { desc.set.call(this, v); syncValueDisplay(); }
            });
        } catch(e) { /* older browsers: skip */ }

        // Also refresh when options are replaced (e.g. innerHTML swap on native).
        const optionsObserver = new MutationObserver(() => { buildOptions(); syncValueDisplay(); positionMenu(); });
        optionsObserver.observe(nativeSelect, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected'] });

        // Menus size to their content so nothing is cut off: the only caps are
        // the viewport itself, and the option box is measured (not assumed) so
        // long product names and long filter lists both render in full.
        const MENU_ITEM_H = 34;
        const EDGE = 8, GAP = 4;
        const itemH = () => menu.querySelector('.esel-option')?.offsetHeight || MENU_ITEM_H;

        function positionMenu() {
            const rect = trigger.getBoundingClientRect();
            // innerWidth/innerHeight are 0 in a few embedded/headless contexts;
            // the cap maths must never degrade into negative sizes.
            const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
            const vh = window.innerHeight || document.documentElement.clientHeight || 768;
            const roomDown = vh - rect.bottom - GAP - EDGE;
            const roomUp = rect.top - GAP - EDGE;
            const needed = nativeSelect.options.length * itemH() + 16;
            // Prefer the roomier side, so the menu can open as tall as it likes
            // and only scroll when the viewport genuinely cannot hold it.
            const flip = roomDown < needed && roomUp > roomDown;
            wrap.classList.toggle('is-flip-up', flip);

            // Clear both edges first: the stylesheet ships `left:0;right:0` for
            // the in-flow fallback and a surviving `right:0` would stretch the
            // fixed box all the way to the viewport edge.
            menu.style.position = 'fixed';
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.left = 'auto';
            menu.style.right = 'auto';

            // Width is max-content in CSS; the only caps are the room actually
            // available on the side the menu opens towards, so a long option
            // gets the space it needs instead of an ellipsis. At least as wide as
            // the trigger it belongs to, but never wider than the room on screen
            // (min-width beats max-width, so an unclamped trigger width would
            // push the menu past the viewport edge).
            const rightAlign = wrap.classList.contains('esel--right');
            const roomL = Math.max(120, vw - rect.left - EDGE);
            const roomR = Math.max(120, rect.right - EDGE);
            menu.style.minWidth = Math.min(rect.width, vw - EDGE * 2, rightAlign ? roomR : roomL) + 'px';
            if (rightAlign) menu.style.maxWidth = Math.min(vw - EDGE * 2, Math.max(200, roomR)) + 'px';
            let mw = menu.offsetWidth;
            if (rightAlign && rect.right - mw >= EDGE) {
                // Pin the edge we don't measure: the menu's right edge sits
                // exactly on the trigger's right edge and opens left. A late
                // webfont swap that changes the width can't push it off anchor.
                menu.style.right = Math.max(0, vw - rect.right) + 'px';
            } else {
                menu.style.maxWidth = Math.min(vw - EDGE * 2, Math.max(200, roomL)) + 'px';
                mw = menu.offsetWidth;
                menu.style.left = Math.max(EDGE, Math.min(rect.left, vw - mw - EDGE)) + 'px';
            }
            menu.style.maxHeight = Math.max(120, flip ? roomUp : roomDown) + 'px';
            if (flip) { menu.style.top = 'auto'; menu.style.bottom = (vh - rect.top + GAP) + 'px'; }
            else { menu.style.top = (rect.bottom + GAP) + 'px'; menu.style.bottom = 'auto'; }
        }

        function open() {
            if (openInstance && openInstance !== close) openInstance();
            wrap.classList.add('is-open');
            // Open first so the menu box is measurable, then pin it.
            positionMenu();
            trigger.setAttribute('aria-expanded', 'true');
            const selectedItem = menu.querySelector('.esel-option.is-selected');
            setActive(selectedItem || menu.querySelector('.esel-option'));
            if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest' });
            openInstance = close;
            setTimeout(() => document.addEventListener('mousedown', outsideClick, true), 0);
            document.addEventListener('keydown', onKeydown, true);
            window.addEventListener('scroll', positionMenu, true);
            window.addEventListener('resize', positionMenu);
        }
        function close() {
            wrap.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
            document.removeEventListener('mousedown', outsideClick, true);
            document.removeEventListener('keydown', onKeydown, true);
            window.removeEventListener('scroll', positionMenu, true);
            window.removeEventListener('resize', positionMenu);
            openInstance = null;
        }
        function outsideClick(e) { if (!wrap.contains(e.target)) close(); }

        let activeItem = null;
        function setActive(item) {
            if (activeItem) activeItem.classList.remove('is-active');
            activeItem = item;
            if (item) {
                item.classList.add('is-active');
                item.scrollIntoView({ block: 'nearest' });
            }
        }

        function onKeydown(e) {
            const items = Array.from(menu.querySelectorAll('.esel-option'));
            const idx = activeItem ? items.indexOf(activeItem) : -1;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(items[(idx + 1) % items.length]);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(items[(idx - 1 + items.length) % items.length]);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (activeItem) { selectValue(activeItem.dataset.value, true); close(); }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
                trigger.focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                setActive(items[0]);
            } else if (e.key === 'End') {
                e.preventDefault();
                setActive(items[items.length - 1]);
            }
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrap.classList.contains('is-open')) close();
            else open();
        });
        trigger.addEventListener('keydown', (e) => {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key) && !wrap.classList.contains('is-open')) {
                e.preventDefault();
                open();
            }
        });

        wrap.appendChild(trigger);
        wrap.appendChild(menu);
        nativeSelect.parentElement.insertBefore(wrap, nativeSelect);
        buildOptions();
        syncValueDisplay();
    }

    function enhanceAll(root) {
        (root || document).querySelectorAll('select:not([data-native])').forEach(enhance);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    window.EnhancedSelect = { enhance, enhanceAll };

    if (document.readyState !== 'loading') enhanceAll();
    else document.addEventListener('DOMContentLoaded', () => enhanceAll());

    // Auto-upgrade selects rendered later (user checkup period, modal
    // product pickers, …) so every tab uses the same dropdown widget.
    new MutationObserver(muts => {
        for (const m of muts) {
            for (const n of m.addedNodes) {
                if (!(n instanceof Element)) continue;
                if (n.matches && n.matches('select:not([data-native])')) enhance(n);
                if (n.querySelectorAll) n.querySelectorAll('select:not([data-native])').forEach(enhance);
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true });
})();
