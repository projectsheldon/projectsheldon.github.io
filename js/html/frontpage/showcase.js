// Showcase videos: every .yt-lazy[data-yt] becomes a thumbnail that swaps to the
// YouTube player on click, so no iframe loads until someone asks for it.
// #showcase-track is an endless strip: its cards are cloned once and the CSS
// animation slides the doubled row by half its width, so the loop never jumps.
(function () {
    const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>';
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const track = document.getElementById('showcase-track');

    if (track && !reduceMotion) {
        const cards = [...track.children];
        cards.forEach(card => {
            const clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.setAttribute('data-clone', '');
            track.append(clone);
        });
        track.style.setProperty('--marquee-duration', `${Math.max(cards.length, 1) * 7}s`);
    }

    function videoTitle(item) {
        const caption = item.closest('figure')?.querySelector('.showcase-title');
        return (caption && caption.textContent.trim()) || item.getAttribute('data-title') || 'Sheldon showcase video';
    }

    function mount(item) {
        const id = item.getAttribute('data-yt');
        if (!/^[\w-]{11}$/.test(id)) {
            (item.closest('figure') || item).remove();
            return;
        }

        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = '';
        img.addEventListener('error', () => { img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }, { once: true });
        img.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'showcase-play';
        play.setAttribute('aria-label', `Play: ${videoTitle(item)}`);
        if (item.closest('[data-clone]')) play.tabIndex = -1;
        play.innerHTML = playIcon;

        item.prepend(img);
        item.append(play);

        item.addEventListener('click', () => {
            if (item.querySelector('iframe')) return;
            if (track && track.contains(item)) track.classList.add('is-playing');
            const frame = document.createElement('iframe');
            frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
            frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            frame.allowFullscreen = true;
            frame.title = videoTitle(item);
            item.replaceChildren(frame);
        });
    }

    document.querySelectorAll('.yt-lazy[data-yt]').forEach(mount);
})();
