// Theme previews: each [data-theme-stage] crossfades its screenshots with the
// [data-theme-step] arrows on top of it. The images carry their own name and
// colour (data-theme-name / data-theme-color), so adding a theme is just adding
// an <img>. Cycles on its own until someone uses the arrows.
(function () {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('[data-theme-stage]').forEach(stage => {
        const images = [...stage.querySelectorAll('img[data-theme]')];
        if (!images.length) return;

        const nameEl = stage.querySelector('.theme-name');
        const countEl = stage.querySelector('.theme-count');
        let index = Math.max(0, images.findIndex(img => img.classList.contains('is-active')));
        let timer = null;

        function show(i) {
            index = (i + images.length) % images.length;
            images.forEach((img, n) => {
                const on = n === index;
                img.classList.toggle('is-active', on);
                img.setAttribute('aria-hidden', on ? 'false' : 'true');
                if (on) img.loading = 'eager';
            });
            const img = images[index];
            const color = img.dataset.themeColor || '#c7b18f';
            if (nameEl) nameEl.textContent = img.dataset.themeName || img.dataset.theme;
            if (countEl) countEl.textContent = `${index + 1} / ${images.length}`;
            stage.style.setProperty('--dot', color);
            stage.style.setProperty('--accent', color);
        }

        stage.querySelectorAll('[data-theme-step]').forEach(btn => btn.addEventListener('click', () => {
            if (timer) { clearInterval(timer); timer = null; }
            show(index + Number(btn.dataset.themeStep));
        }));

        show(index);
        if (!reduceMotion && images.length > 1) timer = setInterval(() => show(index + 1), 4500);
    });
})();
