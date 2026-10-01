(function() {
    if (window.__EnhancedSelectLoaded) return;
    window.__EnhancedSelectLoaded = true;

    const CSS = `
.esel { position: relative; display: inline-block; min-width: 140px; font-family: inherit; }
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
    min-width: 100%;
    background: #0d0d0d;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 4px;
    max-height: 280px;
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

        // Intercept programmatic .value sets so `select.value = "x"` updates the UI.
        try {
            const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
            Object.defineProperty(nativeSelect, 'value', {
                configurable: true,
                get: function() { return desc.get.call(this); },
                set: function(v) { desc.set.call(this, v); syncValueDisplay(); }
            });
        } catch (e) { /* older browsers: skip */ }

        // Also refresh when options are replaced (e.g. innerHTML swap on native).
        const optionsObserver = new MutationObserver(() => { buildOptions(); syncValueDisplay(); positionMenu(); });
        optionsObserver.observe(nativeSelect, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected'] });

        function positionMenu() {
            const rect = trigger.getBoundingClientRect();
            const menuHeight = Math.min(280, nativeSelect.options.length * 40 + 12);
            const spaceBelow = window.innerHeight - rect.bottom;
            const flip = spaceBelow < menuHeight + 20 && rect.top > menuHeight + 20;
            wrap.classList.toggle('is-flip-up', flip);
            const width = Math.max(rect.width, 140);
            const maxH = Math.max(60, Math.min(280, (flip ? rect.top : spaceBelow) - 8));
            menu.style.position = 'fixed';
            menu.style.left = rect.left + 'px';
            menu.style.width = width + 'px';
            menu.style.minWidth = '0';
            menu.style.maxHeight = maxH + 'px';
            menu.style.top = flip ? 'auto' : (rect.bottom + 4) + 'px';
            menu.style.bottom = flip ? (window.innerHeight - rect.top + 4) + 'px' : 'auto';
        }

        function open() {
            if (openInstance && openInstance !== close) openInstance();
            positionMenu();
            wrap.classList.add('is-open');
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
})();
