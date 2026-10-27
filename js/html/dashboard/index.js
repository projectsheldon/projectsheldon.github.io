// Dashboard page script
import Api from "../../util/backend.js";
import { DiscordAuth } from "../../discord/auth.js";

const COLLAPSE_KEY = 'sheldon.sidebar.collapsed';
const MOBILE_QUERY = '(max-width: 900px)';

let state = {
    data: null,
    tab: 'overview',
    filter: 'all',
    range: 14,
    end: '',
    expanded: null,
    view: 'daily'
};

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

// Formatting helpers

// Exact hours with a sensible precision, so "Total usage" never rounds down to a
// vague "2 days" next to the chart's "35h". Matches the chart's own scale.
function formatHours(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    if (s < 60) return Math.round(s) + 's';
    const h = s / 3600;
    if (h < 1) return Math.round(s / 60) + 'm';
    if (h < 10) return h.toFixed(1) + 'h';
    return Math.round(h) + 'h';
}

function formatDate(ms) {
    if (!ms || ms <= 0) return 'Unknown';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLastSeen(ts) {
    if (!ts || ts <= 0) return 'Never';
    const diff = Date.now() - ts;
    if (diff < 60 * 1000) return 'now';
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 30 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + 'd ago';
    return formatDate(ts);
}

// Athens YYYY-MM-DD from a timestamp (the server buckets by Europe/Athens).
function athensDateStrClient(ts) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Number(ts)));
}

function licenseStatus(lic) {
    if (lic.banned) return 'banned';
    if (lic.disabled) return 'disabled';
    if (lic.expires_at !== -1 && Date.now() > lic.expires_at) return 'expired';
    return 'active';
}

function isActiveLicense(lic) {
    return licenseStatus(lic) === 'active';
}

// Profile / stats

function sparklineSvg(values, w, h) {
    w = w || 96;
    h = h || 26;
    const max = Math.max(...values, 1);
    const pts = values.map((v, i) => {
        const x = values.length > 1 ? (i / (values.length - 1)) * (w - 2) + 1 : 1;
        const y = h - 2 - (v / max) * (h - 4);
        return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return `
        <svg class="dash-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
            <polygon points="0,${h} ${pts.join(' ')} ${w},${h}" fill="rgba(199,177,143,0.08)"/>
            <polyline points="${pts.join(' ')}" fill="none" stroke="#c7b18f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

const SPARK_HINT = 'Each point is one day in the activity range below. The percentage compares the last 7 days of usage with the 7 days before that.';

// The sparkline is decorative, so the explanation lives on a focusable wrapper.
function sparklineBlock(values) {
    return `
        <span class="dash-spark-wrap" tabindex="0" role="img"
              aria-label="${escapeHtml(SPARK_HINT)}"
              title="${escapeHtml(SPARK_HINT)}">
            ${sparklineSvg(values)}
        </span>
    `;
}

// Last 7 days vs the previous 7, from the daily array.
function last7vsPrev7(daily) {
    if (!Array.isArray(daily) || daily.length < 14) return null;
    const bySecond = daily.map(d => Number(d.seconds) || 0);
    const recent = bySecond.slice(-7).reduce((a, b) => a + b, 0);
    const prev = bySecond.slice(-14, -7).reduce((a, b) => a + b, 0);
    if (prev <= 0) return null;
    const pct = Math.round(((recent - prev) / prev) * 100);
    if (pct === 0) return { dir: 'flat', pct: 0 };
    return { dir: pct > 0 ? 'up' : 'down', pct };
}

function deltaHtml(delta) {
    if (!delta) return '';
    if (delta.dir === 'flat') return `<span class="dash-delta flat" title="${escapeHtml(SPARK_HINT)}">– no change</span>`;
    const arrow = delta.dir === 'up' ? '↑' : '↓';
    return `<span class="dash-delta ${delta.dir}" title="${escapeHtml(SPARK_HINT)}">${arrow} ${Math.abs(delta.pct)}% 7d</span>`;
}

function memberAge(ms) {
    if (!ms || ms <= 0) return '';
    const days = Math.floor((Date.now() - ms) / 86400000);
    if (days < 1) return 'joined today';
    if (days < 60) return days + (days === 1 ? ' day' : ' days') + ' ago';
    const months = Math.floor(days / 30.4);
    if (months < 24) return months + ' months ago';
    return Math.floor(months / 12) + ' years ago';
}

// One hairline strip of four facts: usage (with its trend), licenses, wallet, tenure.
function renderStats() {
    const { user, memberSince, usage } = state.data;
    const daily = (state.data.activity && state.data.activity.daily) || [];
    const licenses = state.data.licenses || [];
    const active = licenses.filter(isActiveLicense).length;
    const delta = last7vsPrev7(daily);

    const tiles = [
        {
            label: 'Total usage',
            aside: deltaHtml(delta),
            value: escapeHtml(formatHours((usage && usage.totalSeconds) || 0)),
            extra: daily.length > 1 ? sparklineBlock(daily.map(d => Number(d.seconds) || 0)) : '',
            sub: 'all time'
        },
        {
            label: 'Active licenses',
            value: `${active}<small>/ ${licenses.length}</small>`,
            subHtml: licenses.length ? '<button type="button" data-goto="licenses">View licenses →</button>' : '<a href="/checkout/">Get a license →</a>'
        },
        {
            label: 'Balance',
            value: `${escapeHtml(Number((user && user.balance) || 0).toFixed(1))}<small>credits</small>`,
            sub: 'wallet credits'
        },
        {
            label: 'Member since',
            value: escapeHtml(formatDate(memberSince)),
            text: true,
            sub: memberAge(memberSince)
        }
    ];

    const stats = document.getElementById('dash-stats');
    stats.innerHTML = tiles.map(t => `
        <div class="stat">
            <span class="stat-label"><span>${escapeHtml(t.label)}</span>${t.aside || ''}</span>
            <div class="stat-value${t.text ? ' is-text' : ''}">${t.value}</div>
            ${t.extra || ''}
            ${t.subHtml ? `<span class="stat-sub">${t.subHtml}</span>` : (t.sub ? `<span class="stat-sub">${escapeHtml(t.sub)}</span>` : '')}
        </div>
    `).join('');
    stats.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.goto)));
}

// ---------- progress-bar runner ----------
// A chrome-dino easter egg inside the weekly-goal bar. The dino's position
// along the track is the real progress, so the bar literally is the run.
// Jumps are manual only (click / tap / space, down-arrow or hold to duck) –
// hovering never jumps. Hitting anything plays a chrome-style game over and
// the run restarts on its own after 2 seconds. Progress itself is untouched:
// only the obstacles and score reset, never the bar. HI score persists in
// localStorage; nothing else is stored.
//
// Sprites are the exact Chrome offline-game sheet (BSD, (c) The Chromium
// Authors, extracted by wayou/t-rex-runner), vendored at
// /js/html/dashboard/dino-sprite-2x.png (2x art, smoothly downscaled) and
// recolored at load so the dark art reads on the dark lane. All source rects
// below are Chrome's own HDPI coords, as are the multi-box hitboxes, the
// cactus group layout, the bird bands and the gap formula – only scaled to
// the lane (SCALE) with real seconds.
//
// Canvas rather than CSS animation because the dino, the obstacles and the
// scroll have to share one clock, and a canvas costs nothing while paused.
const RUNNER = (() => {
    const TRACK_H = 80;
    const GROUND_PAD = 11;
    const MARGIN = 8;

    // Lane scale for Chrome's art (dino stands ~26px tall here).
    const SCALE = 0.55;

    // Exact 2x source rects in dino-sprite-2x.png (Chrome's HDPI coords).
    // Game units (hitboxes, dest sizes) stay in 1x space – only the blits
    // read double-resolution art, so edges stay clean instead of pixelated.
    const SX = { TREX: 1678, SMALL: 446, LARGE: 652, BIRD: 260, SY: 2 };
    const FR = { JUMP: 0, RUN_A: 176, RUN_B: 264, DEAD: 440, DUCK_A: 528, DUCK_B: 646 };
    const SRC = { DINO_W: 88, DINO_H: 94, DUCK_W: 118, SMALL_W: 34, SMALL_H: 70, LARGE_W: 50, LARGE_H: 100, BIRD_W: 92, BIRD_H: 80 };
    const DINO_W = 44, DINO_H = 47, DUCK_W = 59;
    const SMALL_W = 17, SMALL_H = 35, LARGE_W = 25, LARGE_H = 50;
    const BIRD_W = 46, BIRD_H = 40;
    // Bird lanes (dest top edge) with ground at 69 and a 26px dino, matching
    // Chrome's three heights: the high bird flies over a standing dino, the mid
    // bird has to be ducked, the low bird has to be jumped.
    const BIRD_BANDS = [{ y: 15, w: 1 }, { y: 33, w: 1.2 }, { y: 47, w: 1 }];

    const SPEED = 300;      // logical px per second
    const GRAVITY = 2400;
    const JUMP_V = -449;    // apex 42px: clears every cactus group and the low bird
    const FAST_DROP_V = 1100; // down-while-airborne slam, like Chrome's speed drop
    // Every gap leaves a full jump plus a reaction beat after the previous
    // obstacle, so no spawn sequence can be impossible.
    const MIN_GAP_S = 0.72;
    const MAX_GAP_S = 1.35;
    const DEATH_MS = 2000;  // game-over pause before the run restarts
    const DEATH_FLASH_MS = 500; // red tint at the start of game over
    const PHYSICS_STEP = 1 / 120;
    const SPRINT_AT = 0.985;
    const HI_KEY = 'sheldon.dino.hi';

    function roundRect(ctx, x, y, w, h, r) {
        const rr = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
        ctx.fill();
    }

    const ROAD_INK = 'rgba(255, 255, 255, .05)';
    const ROAD_FILLED_INK = 'rgba(0, 0, 0, .07)';
    const DASH_INK = 'rgba(255, 255, 255, .13)';
    const DASH_FILLED_INK = 'rgba(0, 0, 0, .18)';
    const SCORE_INK = 'rgba(255, 255, 255, .55)';
    const SCORE_INK_DARK = 'rgba(29, 25, 19, .75)';

    // Chrome's own hitboxes (1x units), scaled to the lane at draw time.
    // Forgiving on purpose: the boxes hug the art, never the full sprite.
    const BX = b => [b[0] * SCALE, b[1] * SCALE, b[2] * SCALE, b[3] * SCALE];
    const DINO_RUN_BOXES = [[22, 0, 17, 16], [1, 18, 30, 9], [10, 35, 14, 8], [1, 24, 29, 5], [5, 30, 21, 4], [9, 34, 15, 4]].map(BX);
    const DINO_DUCK_BOXES = [[1, 18, 55, 25]].map(BX);
    const SMALL_BOXES = [[0, 7, 5, 27], [4, 0, 6, 34], [10, 4, 7, 14]];
    const LARGE_BOXES = [[0, 12, 7, 38], [8, 0, 7, 49], [13, 10, 10, 38]];
    const BIRD_BOXES = [[15, 15, 16, 5], [18, 21, 24, 6], [2, 14, 4, 3], [6, 10, 4, 7], [10, 8, 6, 9]].map(BX);

    // Cactus groups share Chrome's rule: the middle box stretches across the
    // joined units, the last box pins to the right edge (ASCII art in the
    // original: 1-wide, 2-wide, 3-wide central boxes).
    function groupBoxes(base, unitW, size) {
        const boxes = base.map(b => b.slice());
        if (size > 1) {
            const full = unitW * size;
            boxes[1][2] = full - boxes[0][2] - boxes[2][2];
            boxes[2][0] = full - boxes[2][2];
        }
        return boxes.map(BX);
    }

    // ---- Chrome sprite sheet (recolored tints of dino-sprite.png) ----
    // The dark sheet art is recolored once at load so it reads on the dark
    // lane; gold for the finished sprint, red for the death flash. Chrome's
    // sheet wraps every sprite in an opaque white halo (and paints the eye
    // white); tinting the raw alpha turned that halo into a thick outline and
    // filled the eye in, so only the dark ink is kept before tinting.
    const SPR_URL = '/js/html/dashboard/dino-sprite-2x.png';
    const SPR_IMG = new Image();
    const TINTS = { light: '#f2e7cd', gold: '#1d1913', red: '#ff9d8a' };
    const tintSheets = {};
    let sheetReady = false;

    function inkOnly(img) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        try {
            const data = g.getImageData(0, 0, c.width, c.height);
            const px = data.data;
            for (let i = 0; i < px.length; i += 4) {
                const lum = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
                if (lum > 150) px[i + 3] = 0;
                else if (lum > 110) px[i + 3] = Math.round(px[i + 3] * (150 - lum) / 40);
            }
            g.putImageData(data, 0, 0);
        } catch (e) {}
        return c;
    }

    function buildTints() {
        if (!SPR_IMG.complete || !SPR_IMG.naturalWidth || sheetReady) return;
        const ink = inkOnly(SPR_IMG);
        for (const key of Object.keys(TINTS)) {
            const c = document.createElement('canvas');
            c.width = ink.width;
            c.height = ink.height;
            const g = c.getContext('2d');
            g.drawImage(ink, 0, 0);
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = TINTS[key];
            g.fillRect(0, 0, c.width, c.height);
            tintSheets[key] = c;
        }
        sheetReady = true;
    }

    SPR_IMG.onload = buildTints;
    SPR_IMG.src = SPR_URL;
    buildTints();

    // Blit one sheet cell, or a silhouette rect while the sheet loads so the
    // game stays playable on a slow first paint.
    function blit(ctx, tint, sx, sy, sw, sh, dx, dy, dw, dh) {
        const sheet = sheetReady ? tintSheets[tint] : null;
        if (!sheet) {
            ctx.save();
            ctx.fillStyle = tint === 'gold' ? 'rgba(29, 25, 19, .8)' : 'rgba(242, 231, 205, .8)';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.restore();
            return;
        }
        ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function drawDinoSprite(ctx, tint, dx, dy, dead, ducking, grounded, now) {
        let ox, w1x;
        if (dead) {
            ox = FR.DEAD;
            w1x = DINO_W;
        } else if (!grounded) {
            ox = FR.JUMP;
            w1x = DINO_W;
        } else if (ducking) {
            const alt = Math.floor(now / 125) % 2;
            ox = alt ? FR.DUCK_B : FR.DUCK_A;
            w1x = DUCK_W;
        } else {
            ox = Math.floor(now / 83) % 2 ? FR.RUN_B : FR.RUN_A;
            w1x = DINO_W;
        }
        const srcW = w1x === DUCK_W ? SRC.DUCK_W : SRC.DINO_W;
        blit(ctx, tint, SX.TREX + ox, SX.SY, srcW, SRC.DINO_H, dx, dy, w1x * SCALE, DINO_H * SCALE);
    }

    // Cactus groups share Chrome's source layout: [1x][2x][3x] contiguous
    // (in sheet pixels here, game units everywhere else).
    function drawCactusSprite(ctx, tint, o) {
        const unitW = o.large ? LARGE_W : SMALL_W;
        const unitH = o.large ? LARGE_H : SMALL_H;
        const base = o.large ? SX.LARGE : SX.SMALL;
        const srcUnit = unitW * 2;
        const sx = base + (srcUnit * o.size) * (0.5 * (o.size - 1));
        blit(ctx, tint, sx, SX.SY, srcUnit * o.size, unitH * 2, o.x, o.y, o.w, o.h);
    }

    function drawBirdSprite(ctx, tint, o, now) {
        const frame = Math.floor(now / (1000 / 6)) % 2;
        blit(ctx, tint, SX.BIRD + SRC.BIRD_W * frame, SX.SY, SRC.BIRD_W, SRC.BIRD_H, o.x, o.y, o.w, o.h);
    }

    function drawFlag(ctx, x, ground, ink) {
        ctx.save();
        ctx.fillStyle = ink;
        ctx.fillRect(x, ground - 22, 2, 22);
        ctx.beginPath();
        ctx.moveTo(x + 2, ground - 22);
        ctx.lineTo(x + 12, ground - 17.5);
        ctx.lineTo(x + 2, ground - 13);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function fmtScore(n) {
        n = Math.max(0, Math.floor(n));
        const s = String(n);
        return s.length > 5 ? s : s.padStart(5, '0');
    }

    function drawScore(ctx, w, fillRight, score, hi) {
        const label = hi > 0 ? 'HI ' + fmtScore(hi) + ' ' + fmtScore(score) : fmtScore(score);
        ctx.save();
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = fillRight > w - tw - 10 ? SCORE_INK_DARK : SCORE_INK;
        ctx.fillText(label, w - 8, 6);
        ctx.restore();
    }

    function drawGameOverPanel(ctx, w, score, hi) {
        const title = 'GAME OVER';
        const mid = fmtScore(score) + ' PTS · HI ' + fmtScore(hi);
        const sub = 'restarting…';
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '800 13px Inter, sans-serif';
        const bw = Math.min(w - 4, Math.max(
            ctx.measureText(title).width,
            (ctx.font = '700 11px "JetBrains Mono", monospace', ctx.measureText(mid).width)
        ) + 40);
        const bh = 62;
        const bx = Math.max(2, (w - bw) / 2);
        const by = Math.max(1, (TRACK_H - bh) / 2);
        ctx.fillStyle = 'rgba(8, 9, 13, .92)';
        roundRect(ctx, bx, by, bw, bh, 10);
        const cx = bx + bw / 2;
        ctx.fillStyle = '#c7b18f';
        ctx.font = '800 13px Inter, sans-serif';
        ctx.fillText(title, cx, by + 15);
        ctx.fillStyle = '#fff';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillText(mid, cx, by + 33);
        ctx.fillStyle = 'rgba(255, 255, 255, .45)';
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillText(sub, cx, by + 50);
        ctx.restore();
    }

    function loadHi() {
        try {
            return Math.max(0, parseInt(localStorage.getItem(HI_KEY), 10) || 0);
        } catch (e) {
            return 0;
        }
    }

    function saveHi(v) {
        try {
            localStorage.setItem(HI_KEY, String(v));
        } catch (e) {}
    }

    function create(canvas) {
        const track = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        // Smooth downscale of the 2x art: clean edges, no pixelation.
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

        const s = {
            w: 0,
            progress: 0,
            target: 0,
            y: 0,
            vy: 0,
            acc: 0,
            grounded: true,
            keyDuck: false,
            touchDuck: false,
            ducking: false,
            obstacles: [],
            spawnIn: 0.9,
            scroll: 0,
            dist: 0,
            hi: loadHi(),
            lastScore: 0,
            dead: false,
            deathAt: 0,
            deadUntil: 0,
            last: 0,
            raf: 0,
            running: false,
            onscreen: true
        };

        const ground = () => TRACK_H - GROUND_PAD;
        const filled = () => s.progress * s.w;
        // Dino footprint follows the sprite: wide when ducking.
        const dinoCellW = () => (s.ducking ? DUCK_W : DINO_W) * SCALE;
        // Just ahead of the fill edge, so the sprite always has the dark
        // lane behind it instead of straddling the gold.
        const dinoX = () => Math.min(filled() + 3, s.w - dinoCellW() - MARGIN);
        const dinoTopY = () => ground() - DINO_H * SCALE + s.y;

        function resize() {
            const w = track.getBoundingClientRect().width;
            if (!w) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            // Anything still queued past the new right edge would land on top of
            // the next spawn, so a narrower lane drops it.
            if (w < s.w) s.obstacles = s.obstacles.filter(o => o.x < w);
            s.w = w;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(TRACK_H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // Resizing resets context state – keep the smooth downscale.
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            paint(0);
        }

        function paint(now) {
            const gy = ground();
            const finished = s.target > SPRINT_AT;
            const dead = s.dead;

            ctx.clearRect(0, 0, s.w, TRACK_H);

            // The road darkens over the filled half so the dashes read on both.
            const f = filled();
            ctx.fillStyle = ROAD_INK;
            ctx.fillRect(0, gy - 5, s.w, 6);
            ctx.fillStyle = ROAD_FILLED_INK;
            ctx.fillRect(0, gy - 5, f, 6);
            for (let x = -(s.scroll % 30); x < s.w; x += 30) {
                ctx.fillStyle = x + 13 < f ? DASH_FILLED_INK : DASH_INK;
                ctx.fillRect(x, gy, 13, 1.5);
            }

            const tint = finished ? 'gold' : (dead && (now - s.deathAt) < DEATH_FLASH_MS ? 'red' : 'light');
            for (const o of s.obstacles) {
                if (o.kind === 'bird') drawBirdSprite(ctx, tint, o, now);
                else drawCactusSprite(ctx, tint, o);
            }

            if (finished) drawFlag(ctx, s.w - MARGIN - 2, gy, 'rgba(29, 25, 19, .6)');

            drawDinoSprite(ctx, tint, dinoX(), dinoTopY(), dead, s.ducking, s.grounded, now);
            drawScore(ctx, s.w, f, score(), s.hi);
            if (dead && !finished) drawGameOverPanel(ctx, s.w, s.lastScore, s.hi);
        }

        function score() {
            return Math.floor(s.dist * 0.025);
        }

        function hop() {
            if (s.dead || !s.grounded) return;
            // Jumping stands back up, like the real game.
            s.keyDuck = false;
            s.touchDuck = false;
            s.ducking = false;
            s.grounded = false;
            s.vy = JUMP_V;
            s.y = -0.01;
        }

        function pressDuck() {
            if (s.dead) return;
            if (!s.grounded) {
                // Down mid-air slams down, like Chrome's speed drop.
                s.vy = Math.max(s.vy, FAST_DROP_V);
            }
            s.keyDuck = true;
        }

        // A lost run freezes for the death beat, then only the obstacles
        // and score reset – progress is data-driven and never touched here.
        function die(now) {
            if (s.dead) return;
            s.dead = true;
            s.deathAt = now;
            s.deadUntil = now + DEATH_MS;
            s.lastScore = score();
            if (s.lastScore > s.hi) {
                s.hi = s.lastScore;
                saveHi(s.hi);
            }
        }

        function revive() {
            s.dead = false;
            s.deathAt = 0;
            s.deadUntil = 0;
            s.lastScore = 0;
            s.dist = 0;
            s.obstacles.length = 0;
            s.spawnIn = 1.1;
            s.y = 0;
            s.vy = 0;
            s.acc = 0;
            s.grounded = true;
            s.ducking = false;
        }

        // Chrome-style hit test: cheap outer boxes first, then the forgiving
        // per-sprite boxes. Origins carry Chrome's 1px inset, scaled down.
        function boxHit(a, b) {
            return a[0] < b[0] + b[2] && a[0] + a[2] > b[0] &&
                a[1] < b[1] + b[3] && a[1] + a[3] > b[1];
        }

        function checkCollision() {
            const dw = (s.ducking ? DUCK_W : DINO_W) * SCALE;
            const dh = DINO_H * SCALE;
            const dx = dinoX();
            const dy = dinoTopY();
            const outer = [dx + 0.5, dy + 0.5, dw - 1, dh - 1];
            const dBoxes = s.ducking ? DINO_DUCK_BOXES : DINO_RUN_BOXES;
            for (const o of s.obstacles) {
                if (o.x > dx + dw || o.x + o.w < dx) continue;
                if (!boxHit(outer, [o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1])) continue;
                for (const t of dBoxes) {
                    const tb = [t[0] + dx + 0.5, t[1] + dy + 0.5, t[2], t[3]];
                    for (const c of o.boxes) {
                        if (boxHit(tb, [c[0] + o.x + 0.5, c[1] + o.y + 0.5, c[2], c[3]])) return true;
                    }
                }
            }
            return false;
        }

        // Every obstacle moves at the lane speed (birds used to fly 15% faster
        // and could catch up with the cactus in front of them, leaving a jump
        // and a duck at the same spot). The next spawn waits for this
        // obstacle's width plus a fixed jump-and-react window.
        function spawnObstacle() {
            let w;
            const lastBird = s.obstacles.length && s.obstacles[s.obstacles.length - 1].kind === 'bird';
            if (s.dist > 900 && !lastBird && Math.random() < 0.28) {
                const band = BIRD_BANDS[(Math.random() * BIRD_BANDS.length) | 0];
                w = BIRD_W * SCALE;
                s.obstacles.push({
                    kind: 'bird',
                    x: s.w + 12,
                    y: band.y,
                    w, h: BIRD_H * SCALE,
                    boxes: BIRD_BOXES,
                    gapScale: band.w
                });
            } else {
                const large = Math.random() < 0.4;
                const r = Math.random();
                const size = large ? (r < 0.65 ? 1 : 2) : (r < 0.5 ? 1 : (r < 0.82 ? 2 : 3));
                const unitW = large ? LARGE_W : SMALL_W;
                const unitH = large ? LARGE_H : SMALL_H;
                w = unitW * size * SCALE;
                s.obstacles.push({
                    kind: 'cactus',
                    large, size,
                    x: s.w + 12,
                    y: ground() - unitH * SCALE,
                    w, h: unitH * SCALE,
                    boxes: groupBoxes(large ? LARGE_BOXES : SMALL_BOXES, unitW, size)
                });
            }
            const last = s.obstacles[s.obstacles.length - 1];
            const gap = MIN_GAP_S * (last.gapScale || 1) + Math.random() * (MAX_GAP_S - MIN_GAP_S);
            s.spawnIn = (w + 24) / SPEED + gap;
        }

        function step(dt, now) {
            s.progress += (s.target - s.progress) * Math.min(1, dt * 1000 / 260);

            // Ducking is held-down + grounded, like the real game.
            s.ducking = (s.keyDuck || s.touchDuck) && s.grounded && !s.dead;

            if (!s.dead) {
                s.dist += SPEED * dt;
                if (s.target > SPRINT_AT) {
                    s.obstacles.length = 0;
                } else {
                    s.scroll += SPEED * dt;
                    s.spawnIn -= dt;
                    if (s.spawnIn <= 0) spawnObstacle();
                    for (const o of s.obstacles) {
                        o.x -= SPEED * dt;
                    }
                    if (checkCollision()) die(now);
                    s.obstacles = s.obstacles.filter(o => o.x + o.w > -30);
                }
            }

            // Fixed substeps: plain Euler at frame dt undershot the apex by ~10%,
            // which is exactly the margin the hop needs. Frozen while dead.
            s.acc += dt;
            while (!s.dead && s.acc >= PHYSICS_STEP) {
                if (!s.grounded || s.y < 0) {
                    s.vy += GRAVITY * PHYSICS_STEP;
                    s.y += s.vy * PHYSICS_STEP;
                    if (s.y >= 0) {
                        s.y = 0;
                        s.vy = 0;
                        s.grounded = true;
                    }
                }
                s.acc -= PHYSICS_STEP;
            }
        }

        function frame(now) {
            const dt = Math.min(0.05, (now - s.last) / 1000) || 0;
            s.last = now;
            // Dead: the world stays frozen behind the panel; after 2s the
            // obstacles reset and the run continues with progress intact.
            if (s.dead && now >= s.deadUntil) revive();
            if (!s.dead) step(dt, now);
            paint(now);
            s.raf = requestAnimationFrame(frame);
        }

        function play() {
            if (s.running) return;
            s.running = true;
            if (reduced.matches) { resize(); return; }
            s.last = performance.now();
            s.raf = requestAnimationFrame(frame);
        }

        function pause() {
            s.running = false;
            cancelAnimationFrame(s.raf);
        }

        // Mouse clicks jump at once. Touch is tap-to-jump, hold-to-duck:
        // a quick tap jumps on release, holding past 180ms ducks instead.
        // preventDefault on pointerdown also blocks the browser's own focus, and
        // the keyboard handlers live on the track – so ducking with the arrow key
        // never worked after a click. Focus it explicitly.
        let holdTimer = 0;
        track.addEventListener('focus', () => track.classList.add('is-armed'));
        track.addEventListener('blur', () => {
            track.classList.remove('is-armed');
            s.keyDuck = false;
        });
        track.addEventListener('pointerdown', e => {
            e.preventDefault();
            try { track.focus({ preventScroll: true }); } catch (err) { track.focus(); }
            if (s.dead) return;
            if (e.pointerType === 'mouse') {
                if (e.button !== 0) return;
                hop();
                return;
            }
            const pid = e.pointerId;
            holdTimer = setTimeout(() => {
                holdTimer = 0;
                if (s.dead) return;
                if (!s.grounded) s.vy = Math.max(s.vy, FAST_DROP_V);
                s.touchDuck = true;
            }, 180);
            const up = ev => {
                if (ev.pointerId !== pid) return;
                track.removeEventListener('pointerup', up);
                track.removeEventListener('pointercancel', up);
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = 0;
                    hop();
                }
                s.touchDuck = false;
            };
            track.addEventListener('pointerup', up);
            track.addEventListener('pointercancel', up);
        });
        track.addEventListener('keydown', e => {
            if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.key === 'Enter') {
                e.preventDefault();
                if (!e.repeat || s.grounded) hop();
            } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                pressDuck();
            } else if (e.key === 'Escape') {
                track.blur();
            }
        });
        track.addEventListener('keyup', e => {
            if (e.code === 'ArrowDown' || e.code === 'KeyS') s.keyDuck = false;
        });
        track.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('blur', () => {
            s.keyDuck = false;
            s.touchDuck = false;
        });

        new ResizeObserver(resize).observe(track);

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(entries => {
                s.onscreen = entries[0].isIntersecting;
                if (s.onscreen && !document.hidden) play();
                else pause();
            }, { threshold: 0.01 }).observe(track);
        }
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && s.onscreen) play();
            else pause();
        });
        reduced.addEventListener('change', () => { pause(); play(); });

        play();

        return {
            setProgress(pct) {
                s.target = Math.max(0, Math.min(1, pct / 100));
                if (reduced.matches) { s.progress = s.target; resize(); }
            }
        };
    }

    let instance = null;

    return {
        setProgress(pct) {
            if (!instance) {
                const canvas = document.getElementById('dash-usage-canvas');
                if (!canvas) return;
                instance = create(canvas);
            }
            instance.setProgress(pct);
        }
    };
})();

// Weekly usage progress

function renderUsageProgress() {
    const card = document.getElementById('dash-usage-card');
    if (!card || !state.data || !state.data.usage) return;

    const seconds = Number(state.data.usage.weeklySeconds) || 0;
    const threshold = Number(state.data.usage.thresholdSeconds) || 0;
    if (!threshold || threshold <= 0) {
        card.style.display = 'none';
        return;
    }

    const totalHours = Math.round(threshold / 3600);
    const doneHours = Math.min(totalHours, Math.floor(seconds / 3600));
    const pct = Math.min(100, Math.round((seconds / threshold) * 100));
    const rewarded = sessionStorage.getItem('usage_reward') === '1';

    let title;
    let caption;
    const goalReached = !rewarded && doneHours >= totalHours;
    const left = Math.max(0, totalHours - doneHours);
    if (rewarded) {
        title = 'Free license claimed';
        caption = `Your counter has reset. Reach ${totalHours} hours again for the next one.`;
    } else if (goalReached) {
        title = 'Goal reached';
        caption = 'Claim your free license now – no ad needed.';
    } else {
        title = 'Earn a free license';
        caption = `Use Sheldon for ${totalHours} hours in a week and the license is yours, no ad required. ${left} ${left === 1 ? 'hour' : 'hours'} to go.`;
    }

    document.getElementById('dash-usage-title').textContent = title;
    document.getElementById('dash-usage-done').textContent = doneHours;
    document.getElementById('dash-usage-total').textContent = `/ ${totalHours} h`;
    document.getElementById('dash-usage-pct').textContent = `${pct}% complete`;
    document.getElementById('dash-usage-fill').style.width = pct + '%';
    RUNNER.setProgress(pct);
    document.getElementById('dash-usage-caption').textContent = caption;
    // Direct claim – no ad, no checkout hunt. Calls POST /workink/claim-usage.
    const actionEl = document.getElementById('dash-usage-action');
    if (actionEl) {
        if (goalReached) {
            actionEl.style.display = '';
            actionEl.innerHTML = '';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Claim free license';
            btn.className = 'btn btn-primary';
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                const original = btn.textContent;
                btn.textContent = 'Claiming…';
                try {
                    const token = DiscordAuth.GetSessionToken();
                    if (!token) {
                        window.location.href = '/';
                        return;
                    }
                    const apiUrl = await Api.GetApiUrl();
                    const res = await fetch(`${apiUrl}/workink/claim-usage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionToken: token })
                    });
                    const data = await res.json().catch(() => null);
                    if (data && data.ok && data.license) {
                        try { sessionStorage.setItem('usage_reward', '1'); } catch (e) {}
                        const params = `${encodeURIComponent(data.license.key)}:${encodeURIComponent(data.license.product || 'License')}`;
                        window.location.href = `/license/?showKeys=${params}`;
                        return;
                    }
                    const reason = (data && data.message) || 'Could not claim your free key. Please try again.';
                    document.getElementById('dash-usage-caption').textContent = reason;
                    btn.disabled = false;
                    btn.textContent = original;
                } catch (e) {
                    document.getElementById('dash-usage-caption').textContent = 'Could not claim your free key. Please try again.';
                    btn.disabled = false;
                    btn.textContent = original;
                }
            });
            actionEl.appendChild(btn);
        } else {
            actionEl.style.display = 'none';
            actionEl.innerHTML = '';
        }
    }
    card.style.display = '';
}

// Activity

// One bucket per chart column, driven by the Daily / Weekly / Cumulative tabs.
function activityBuckets() {
    const daily = (state.data.activity && state.data.activity.daily) || [];

    if (state.view === 'weekly') {
        const out = [];
        for (let i = 0; i < daily.length; i += 7) {
            const chunk = daily.slice(i, i + 7);
            out.push({
                seconds: chunk.reduce((a, d) => a + (Number(d.seconds) || 0), 0),
                sessions: chunk.reduce((a, d) => a + (Number(d.sessions) || 0), 0),
                label: (chunk[0] && chunk[0].label) || ('Week ' + (out.length + 1))
            });
        }
        return out;
    }

    if (state.view === 'cumulative') {
        let run = 0;
        return daily.map(d => {
            run += Number(d.seconds) || 0;
            return { seconds: run, sessions: 0, label: d.label };
        });
    }

    return daily.map(d => ({
        seconds: Number(d.seconds) || 0,
        sessions: Number(d.sessions) || 0,
        label: d.label,
        ts: d.ts,
        date: d.date
    }));
}

// KPIs stay day-based in every view so the numbers do not shift under the tabs.
function renderActivityKpis() {
    const el = document.getElementById('dash-activity-kpis');
    if (!el) return;
    const daily = (state.data.activity && state.data.activity.daily) || [];

    if (!daily.length) {
        el.innerHTML = '';
        return;
    }

    const total = daily.reduce((a, d) => a + (Number(d.seconds) || 0), 0);
    let peakSeconds = 0;
    let peakLabel = '';
    let active = 0;
    daily.forEach(d => {
        const s = Number(d.seconds) || 0;
        if (s > 0) active++;
        if (s > peakSeconds) {
            peakSeconds = s;
            peakLabel = d.label;
        }
    });

    const avg = daily.length ? total / daily.length : 0;
    const cells = [
        { label: 'Total', value: formatHours(total), sub: daily.length + (daily.length === 1 ? ' day' : ' days'), accent: true },
        { label: 'Peak day', value: peakSeconds > 0 ? formatHours(peakSeconds) : '–', sub: peakLabel || 'no activity' },
        { label: 'Avg / day', value: total > 0 ? formatHours(avg) : '0s', sub: 'across range' },
        { label: 'Active days', value: active + ' / ' + daily.length, sub: total > 0 ? Math.round((active / daily.length) * 100) + '% of range' : '–' }
    ];

    el.innerHTML = cells.map(c => `
        <div class="kpi">
            <span class="kpi-label">${escapeHtml(c.label)}</span>
            <span class="kpi-value${c.accent ? ' accent' : ''}">${escapeHtml(c.value)}</span>
            <span class="kpi-sub">${escapeHtml(c.sub)}</span>
        </div>
    `).join('');
}

function barChartHtml(buckets, opts) {
    opts = opts || {};
    const max = Math.max(...buckets.map(b => b.seconds), 1);
    const hasData = buckets.some(b => b.seconds > 0);
    const last = buckets.length - 1;

    const bars = buckets.map((b, i) => {
        const h = b.seconds > 0 ? Math.max((b.seconds / max) * 100, 3) : 0;
        const cls = b.seconds > 0 ? 'bar' : 'bar bar-empty';
        const today = b.seconds > 0 && i === last && opts.highlightLast !== false ? ' bar-today' : '';
        const sub = b.sessions > 0 ? b.sessions + ' session' + (b.sessions === 1 ? '' : 's') : '';
        return `
            <div class="bar-col">
                <div class="${cls}${today}" style="height:0" data-h="${h.toFixed(1)}" data-label="${escapeHtml(b.label)}" data-count="${escapeHtml(formatHours(b.seconds))}"${sub ? ` data-sub="${escapeHtml(sub)}"` : ''}${b.ts ? ` data-ts="${escapeHtml(b.ts)}"` : ''}${b.date ? ` data-date="${escapeHtml(b.date)}"` : ''}></div>
            </div>
        `;
    }).join('');

    // Y-axis labels sit on the gridlines, so the bars read as hours without a hover.
    const tick = f => hasData ? `<em>${escapeHtml(formatHours(max * f))}</em>` : '';
    return `
        <div class="stats-chart">
            <span class="chart-gridline" style="top:0">${tick(1)}</span>
            <span class="chart-gridline" style="top:50%">${tick(.5)}</span>
            <span class="chart-gridline chart-gridline-base"><em>0</em></span>
            ${bars}
        </div>
    `;
}

function animateBars(container) {
    if (!container) return;
    const bars = container.querySelectorAll('.bar');
    requestAnimationFrame(() => requestAnimationFrame(() => {
        bars.forEach(bar => {
            bar.style.height = (bar.dataset.h || '0') + '%';
        });
    }));
}

let barTooltipEl = null;

function getBarTooltip() {
    if (!barTooltipEl) {
        barTooltipEl = document.createElement('div');
        barTooltipEl.className = 'bar-tooltip';
        document.body.appendChild(barTooltipEl);
        document.addEventListener('scroll', hideBarTooltip, true);
        document.addEventListener('resize', hideBarTooltip);
    }
    return barTooltipEl;
}

function moveBarTooltip(e) {
    const tip = getBarTooltip();
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 12;
    let y = e.clientY - r.height - 10;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 12;
    if (y < 8) y = e.clientY + 12;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
}

function showBarTooltip(e) {
    const bar = e.currentTarget.querySelector('.bar') || e.currentTarget;
    const tip = getBarTooltip();
    tip.innerHTML =
        (bar.dataset.label ? `<p class="bar-tooltip-label">${escapeHtml(bar.dataset.label)}</p>` : '') +
        `<p class="bar-tooltip-count">${escapeHtml(bar.dataset.count || '0')}</p>` +
        (bar.dataset.sub ? `<p class="bar-tooltip-sub">${escapeHtml(bar.dataset.sub)}</p>` : '');
    tip.style.opacity = '1';
    tip.style.visibility = 'visible';
    moveBarTooltip(e);
}

function hideBarTooltip() {
    if (barTooltipEl) {
        barTooltipEl.style.opacity = '0';
        barTooltipEl.style.visibility = 'hidden';
    }
}

function bindChartTooltips(container, onClick) {
    if (!container) return;
    container.querySelectorAll('.bar-col').forEach(col => {
        const bar = col.querySelector('.bar');
        if (!bar) return;
        col.addEventListener('mousemove', moveBarTooltip);
        col.addEventListener('mouseenter', showBarTooltip);
        col.addEventListener('mouseleave', hideBarTooltip);
        if (typeof onClick === 'function' && !bar.classList.contains('bar-empty')) {
            col.addEventListener('click', () => onClick(bar));
        }
    });
}

function fmtHour(h) {
    return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
}

function hourlyItems(hourly) {
    const ordered = hourly.slice(1).concat(hourly[0]);
    return ordered.map((n, idx) => ({
        label: fmtHour((idx + 1) % 24),
        seconds: Number(n.seconds) || 0,
        sessions: 0
    }));
}

function dateRangeText(daily) {
    if (!Array.isArray(daily) || daily.length === 0 || !daily.some(d => (Number(d.seconds) || 0) > 0)) return 'No data yet.';
    const first = daily[0].label;
    const last = daily[daily.length - 1].label;
    return first === last ? first : `${first} – ${last}`;
}

// X-axis labels, thinned on long ranges.
function chartAxisHtml(buckets) {
    const step = Math.max(1, Math.ceil(buckets.length / 8));
    const cells = buckets.map((b, i) => {
        const isLast = i === buckets.length - 1;
        const show = i % step === 0 || isLast;
        const cls = i === 0 ? ' class="is-start"' : (isLast ? ' class="is-end"' : '');
        return `<span${cls}>${show ? escapeHtml(b.label) : ''}</span>`;
    }).join('');
    return `<div class="chart-axis">${cells}</div>`;
}

function skeletonChartHtml() {
    const bars = [38, 62, 45, 78, 54, 68, 40, 64, 50, 72, 34, 58, 70, 46].map(h =>
        `<div class="bar-col"><div class="bar skel-bar" style="height:${h}%"></div></div>`
    ).join('');
    return `<div class="stats-chart"><span class="chart-gridline" style="top:25%"></span><span class="chart-gridline" style="top:50%"></span><span class="chart-gridline" style="top:75%"></span><span class="chart-gridline chart-gridline-base"></span>${bars}</div>`;
}

function emptyStateHtml(text) {
    return `
        <div class="chart-empty">
            <div style="display:flex;flex-direction:column;align-items:center;gap:.5rem;text-align:center;padding:0 1.5rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <p class="empty" style="padding:0;">${escapeHtml(text)}</p>
            </div>
        </div>
    `;
}

function hourlyWrapHtml(label, items) {
    return `
        <div class="hourly-wrap">
            <div class="hourly-head">
                <span class="panel-meta" style="margin:0;">${escapeHtml(label)} – by hour</span>
                <button class="btn btn-sm hourly-back">← Back to days</button>
            </div>
            ${barChartHtml(items, { highlightLast: false })}
            ${chartAxisHtml(items)}
        </div>
    `;
}

async function expandHourly(ts, bar) {
    const el = document.getElementById('dash-activity-chart');
    if (!el || !ts) return;
    if (state.expanded && state.expanded.ts === ts) {
        collapseHourly();
        return;
    }
    const dateStr = (bar && bar.dataset && bar.dataset.date) || '';
    if (!dateStr) return;
    const dayLabel = bar.dataset.label || dateStr;
    let hourly = null;
    try {
        const data = await loadDashboard({ day: dateStr });
        hourly = (data.activity && data.activity.hourly) || null;
    } catch (e) { return; }
    if (!Array.isArray(hourly)) return;
    const items = hourlyItems(hourly);
    hideBarTooltip();
    el.innerHTML = hourlyWrapHtml(dayLabel, items);
    bindChartTooltips(el, () => collapseHourly());
    el.querySelector('.hourly-back')?.addEventListener('click', () => collapseHourly());
    animateBars(el);
    state.expanded = { ts: Number(ts) };
}

function collapseHourly() {
    const el = document.getElementById('dash-activity-chart');
    state.expanded = null;
    if (!el) return;
    hideBarTooltip();
    renderChart(el);
}

function renderChart(el) {
    if (!el) return;
    renderActivityKpis();

    const daily = (state.data.activity && state.data.activity.daily) || [];
    const buckets = activityBuckets();

    if (buckets.length === 0) {
        el.innerHTML = emptyStateHtml('No activity yet.');
        document.getElementById('dash-activity-date-range').textContent = 'No data yet.';
        return;
    }

    el.innerHTML = barChartHtml(buckets);
    el.insertAdjacentHTML('beforeend', chartAxisHtml(buckets));
    // Hourly drill-down only makes sense on the daily view.
    bindChartTooltips(el, state.view === 'daily' ? bar => expandHourly(Number(bar.dataset.ts), bar) : null);
    animateBars(el);

    const rangeText = dateRangeText(daily);
    const totalSessions = daily.reduce((a, d) => a + (Number(d.sessions) || 0), 0);
    document.getElementById('dash-activity-date-range').textContent =
        rangeText === 'No data yet.'
            ? rangeText
            : `${rangeText} · ${totalSessions} session${totalSessions === 1 ? '' : 's'} · EU/Athens`;

    document.querySelectorAll('.stats-view-tab').forEach(btn => {
        const on = btn.dataset.mode === state.view;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
}

// Licenses

const copyIcon = `<svg class="copy-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="check-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`;

function copyKey(btn, val) {
    const done = () => {
        btn.classList.add('success');
        setTimeout(() => btn.classList.remove('success'), 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(done).catch(() => fallbackCopy(val, done));
    } else {
        fallbackCopy(val, done);
    }
}

function fallbackCopy(val, done) {
    const el = document.createElement('textarea');
    el.value = val;
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(el);
    done();
}

function licenseStatusBadge(status) {
    return `<span class="status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

function relativeDays(ms) {
    const days = Math.round((ms - Date.now()) / 86400000);
    if (days === 0) return 'today';
    if (days > 0) return days === 1 ? 'in 1 day' : `in ${days} days`;
    return days === -1 ? '1 day ago' : `${-days} days ago`;
}

function licenseMatches(lic, q) {
    if (!q) return true;
    return String(lic.key || '').toLowerCase().includes(q) || String(lic.product || '').toLowerCase().includes(q);
}

// The page sub-line is shared by both tabs: licenses shows live counts there,
// overview keeps its own copy. Anything that renders data must go through this so
// the licenses numbers never leak onto the overview tab.
function displayName() {
    const u = state.user;
    return (u && (u.globalName || u.username)) || '';
}

function setPageSub() {
    const sub = document.getElementById('dash-page-sub');
    const title = document.getElementById('dash-page-title');
    if (!sub) return;
    if (state.tab === 'settings') {
        sub.textContent = 'Your account, devices and session';
        return;
    }
    if (state.tab !== 'licenses') {
        const name = displayName();
        if (title) title.textContent = name ? `Welcome back, ${name}` : 'Overview';
        sub.textContent = (state.data && state.data.banned) ? 'Access revoked on this account' : 'Your weekly goal, usage and activity';
        return;
    }
    const licenses = (state.data && state.data.licenses) || [];
    if (licenses.length === 0) {
        sub.textContent = 'No licenses yet';
        return;
    }
    const active = licenses.filter(isActiveLicense).length;
    sub.textContent = `${active} active of ${licenses.length}`;
}

function copyButton(value, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = copyIcon + checkIcon;
    btn.addEventListener('click', () => {
        copyKey(btn, value);
        if (window.NotifySuccess) window.NotifySuccess(label.replace(/^Copy /, '').replace(/^./, c => c.toUpperCase()) + ' copied');
    });
    return btn;
}

const LICENSE_COLS = [
    { label: 'Key', width: '31%' },
    { label: 'Product', width: '16%' },
    { label: 'Status', width: '12%' },
    { label: 'Expires', width: '15%', num: true },
    { label: 'Created', width: '13%', num: true },
    { label: 'Last active', width: '13%', num: true }
];

function renderLicenses() {
    const list = document.getElementById('dash-license-list');
    if (!list || !state.data) return;

    const licenses = state.data.licenses || [];
    const counts = { all: licenses.length, active: licenses.filter(isActiveLicense).length };
    counts.inactive = counts.all - counts.active;
    document.querySelectorAll('[data-count]').forEach(el => { el.textContent = counts[el.dataset.count]; });

    const q = (state.query || '').trim().toLowerCase();
    const filtered = licenses.filter(l => {
        if (state.filter === 'active' && !isActiveLicense(l)) return false;
        if (state.filter === 'inactive' && isActiveLicense(l)) return false;
        return licenseMatches(l, q);
    }).sort((a, b) => {
        const sa = isActiveLicense(a) ? 0 : 1;
        const sb = isActiveLicense(b) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (b.created_at || 0) - (a.created_at || 0);
    });

    setPageSub();

    list.innerHTML = '';
    if (filtered.length === 0) {
        const none = licenses.length === 0;
        list.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/></svg>
                <b>${none ? 'No licenses yet' : 'Nothing matches'}</b>
                <span>${none ? 'Keys you buy or earn show up here.' : 'Try another filter or search.'}</span>
                ${none ? '<a class="btn btn-primary btn-sm" href="/checkout/">Buy a license</a>' : ''}
            </div>`;
        return;
    }

    const table = document.createElement('table');
    table.className = 'dash-table';
    table.id = 'dash-license-table';
    table.setAttribute('data-resizable', '');

    const colgroup = document.createElement('colgroup');
    LICENSE_COLS.forEach(c => {
        const col = document.createElement('col');
        col.style.width = c.width;
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    LICENSE_COLS.forEach(c => {
        const th = document.createElement('th');
        th.textContent = c.label;
        if (c.num) th.classList.add('td-num');
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const cell = (label, cls) => {
        const td = document.createElement('td');
        td.dataset.label = label;
        if (cls) td.className = cls;
        return td;
    };

    const tbody = document.createElement('tbody');
    filtered.forEach(lic => {
        const tr = document.createElement('tr');

        const tdKey = cell('Key', 'td-key');
        const keyWrap = document.createElement('div');
        keyWrap.className = 'key-cell';
        const code = document.createElement('code');
        code.textContent = lic.key;
        code.title = lic.key;
        keyWrap.append(code, copyButton(lic.key, 'Copy license key'));
        tdKey.appendChild(keyWrap);

        const tdProd = cell('Product');
        tdProd.textContent = lic.product || 'License';

        const tdStatus = cell('Status');
        tdStatus.innerHTML = licenseStatusBadge(licenseStatus(lic));

        const tdExp = cell('Expires', 'td-num');
        const expWrap = document.createElement('span');
        expWrap.textContent = lic.expires_at === -1 ? 'Never' : formatDate(lic.expires_at);
        if (lic.expires_at !== -1 && ['active', 'expired'].includes(licenseStatus(lic))) {
            const rel = document.createElement('span');
            rel.className = 'td-sub';
            rel.textContent = relativeDays(lic.expires_at);
            expWrap.appendChild(rel);
        }
        tdExp.appendChild(expWrap);

        const tdCr = cell('Created', 'td-num');
        tdCr.textContent = formatDate(lic.created_at);

        const tdLa = cell('Last active', 'td-num');
        tdLa.textContent = formatLastSeen(lic.last_activity);

        tr.append(tdKey, tdProd, tdStatus, tdExp, tdCr, tdLa);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    list.appendChild(table);

    if (window.ResizableColumns) window.ResizableColumns.attach(table, 'cols_dash_licenses_v2');
}

// Settings – the account card is filled from the session user plus the dashboard payload.
function renderAccount() {
    const u = state.user;
    const name = displayName() || 'Account';
    const avatar = document.getElementById('dash-profile-avatar');
    const raw = (u && u.avatar) || '';
    const src = /^https:\/\/cdn\.discordapp\.com\//.test(raw) ? raw
        : (/^(a_)?[a-f0-9]{16,}$/i.test(raw) && u.id ? `https://cdn.discordapp.com/avatars/${u.id}/${raw}.png?size=128` : '');
    if (avatar) {
        if (src) {
            const img = document.createElement('img');
            img.className = 'profile-avatar';
            img.src = src;
            img.alt = '';
            img.id = 'dash-profile-avatar';
            avatar.replaceWith(img);
        } else {
            avatar.textContent = name.charAt(0).toUpperCase();
        }
    }
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('dash-profile-name', name);
    set('dash-profile-handle', u && u.username ? '@' + u.username : '');
    const idEl = document.getElementById('dash-profile-id');
    if (idEl && u && u.id) {
        idEl.innerHTML = '';
        const code = document.createElement('code');
        code.textContent = u.id;
        idEl.append(code, copyButton(u.id, 'Copy Discord ID'));
    }
    if (state.data) {
        set('dash-profile-since', formatDate(state.data.memberSince));
        set('dash-profile-balance', Number((state.data.user && state.data.user.balance) || 0).toFixed(1) + ' credits');
    }
}

// Data loading

async function loadDashboard(extra) {
    const token = DiscordAuth.GetSessionToken();
    const user = state.user || await DiscordAuth.GetUser();
    if (!token || !user) return null;
    state.user = user;

    const body = {
        discordId: user.id,
        loginToken: token,
        days: String(state.range)
    };
    if (state.end) body.end = state.end;
    if (extra && extra.day) body.day = extra.day;

    const apiUrl = await Api.GetApiUrl();
    const response = await fetch(`${apiUrl}/auth/dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'Failed to load dashboard');
    return data;
}

function showError(message) {
    const chart = document.getElementById('dash-activity-chart');
    if (chart) chart.innerHTML = emptyStateHtml(message || 'Failed to load. Refresh to try again.');
    const list = document.getElementById('dash-license-list');
    if (list) {
        list.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'empty';
        p.textContent = message || 'Failed to load. Refresh to try again.';
        list.appendChild(p);
    }
}

async function loadAll() {
    const chart = document.getElementById('dash-activity-chart');
    try {
        const data = await loadDashboard();
        if (!data) {
            window.location.href = '/';
            return;
        }
        state.data = data;
        renderStats();
        renderUsageProgress();
        renderChart(chart);
        renderLicenses();
        renderAccount();
        setPageSub();
    } catch (e) {
        console.error('Dashboard load failed:', e);
        showError();
    }
}

// Reload the range without touching the rest of the page state.
async function reloadActivity() {
    const chart = document.getElementById('dash-activity-chart');
    state.expanded = null;
    chart.innerHTML = skeletonChartHtml();
    try {
        const data = await loadDashboard();
        if (!data) { window.location.href = '/'; return; }
        state.data = data;
        renderUsageProgress();
        renderChart(chart);
        renderLicenses();
    } catch (e) {
        showError();
    }
}

// Tabs

const TABS = ['overview', 'licenses', 'settings'];

// The hash mirrors the tab, so /dashboard/#licenses and #settings (used by the
// account menu) open straight onto that tab.
function switchTab(tab, opts) {
    if (!TABS.includes(tab)) tab = 'overview';
    state.tab = tab;
    document.querySelectorAll('.nav-tab[data-tab]').forEach(b => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    TABS.forEach(t => document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab));
    document.getElementById('dash-page-title').textContent = tab === 'licenses' ? 'Licenses' : (tab === 'settings' ? 'Settings' : 'Overview');
    setPageSub();
    if (!opts || opts.updateHash !== false) {
        const hash = tab === 'overview' ? '' : '#' + tab;
        if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
    }
}

function tabFromHash() {
    const t = location.hash.replace('#', '');
    return TABS.includes(t) ? t : 'overview';
}

switchTab(tabFromHash(), { updateHash: false });
window.addEventListener('hashchange', () => switchTab(tabFromHash(), { updateHash: false }));

// Sidebar – desktop collapse to an icon rail, mobile off-canvas drawer.

function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

function setCollapsed(collapsed, opts) {
    const sidebar = document.getElementById('dash-sidebar');
    const toggle = document.getElementById('dash-sidebar-toggle');
    const backdrop = document.getElementById('dash-sidebar-backdrop');
    const main = document.getElementById('dash-main');
    const footer = document.querySelector('.site-footer');
    const mobile = isMobile();

    if (mobile) {
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.toggle('open', !collapsed);
            // keep the off-canvas drawer out of the tab order while it is closed
            sidebar.toggleAttribute('inert', collapsed);
        }
        if (backdrop) backdrop.classList.toggle('show', !collapsed);
        document.body.classList.toggle('drawer-open', !collapsed);
    } else {
        document.body.classList.remove('drawer-open');
        if (sidebar) {
            sidebar.classList.remove('open');
            sidebar.removeAttribute('inert');
            sidebar.classList.toggle('collapsed', collapsed);
        }
        if (backdrop) backdrop.classList.remove('show');
    }

    // Empty string clears the inline value so the stylesheet breakpoint wins on mobile.
    const offset = mobile ? '' : (collapsed ? 'var(--dash-rail-w)' : 'var(--dash-sidebar-w)');
    if (main) main.style.marginLeft = offset;
    if (footer) footer.style.marginLeft = offset;

    if (toggle) {
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        toggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }

    if (!opts || opts.persist !== false) {
        try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('dash-sidebar');
    if (isMobile()) {
        // the nav toggle doubles as the drawer's close affordance
        closeSidebarDrawer();
        return;
    }
    setCollapsed(sidebar?.classList.contains('collapsed') !== true);
}

function restoreCollapsed() {
    if (isMobile()) {
        setCollapsed(true, { persist: false });
        return;
    }
    let collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) {}
    setCollapsed(collapsed, { persist: false });
}

function closeSidebarDrawer() {
    if (isMobile()) setCollapsed(true, { persist: false });
}

(function initSidebar() {
    const toggle = document.getElementById('dash-sidebar-toggle');
    const drawerBtn = document.getElementById('dash-drawer-btn');
    const backdrop = document.getElementById('dash-sidebar-backdrop');

    toggle?.addEventListener('click', toggleSidebar);
    // Opening the drawer is a mobile-only action: never let it overwrite the
    // desktop collapse preference.
    drawerBtn?.addEventListener('click', () => setCollapsed(false, { persist: false }));
    backdrop?.addEventListener('click', closeSidebarDrawer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMobile() && document.body.classList.contains('drawer-open')) {
            closeSidebarDrawer();
        }
    });

    document.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            closeSidebarDrawer();
        });
    });

    restoreCollapsed();
    window.matchMedia(MOBILE_QUERY).addEventListener('change', restoreCollapsed);
})();

// Arrow-key navigation between sidebar sections.
(function initSidebarKeyboardNav() {
    const nav = document.getElementById('dashSidebarNav');
    if (!nav) return;
    nav.addEventListener('keydown', (e) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
        const tabs = [...nav.querySelectorAll('.nav-tab:not(.hidden)')];
        if (!tabs.length) return;
        e.preventDefault();
        const idx = tabs.indexOf(document.activeElement);
        if (e.key === 'Home') tabs[0].focus();
        else if (e.key === 'End') tabs[tabs.length - 1].focus();
        else if (e.key === 'ArrowDown') tabs[(idx + 1 + tabs.length) % tabs.length].focus();
        else tabs[(idx - 1 + tabs.length) % tabs.length].focus();
    });
})();

// Bridge for the command palette (and anything else) to reuse dashboard internals.
window.DashBridge = {
    switchTab,
    copyKey,
    getLicenses: () => (state.data && state.data.licenses) || [],
    getState: () => state,
    copyText: function (val) {
        const done = () => window.NotifySuccess && window.NotifySuccess('Copied to clipboard');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(done).catch(() => fallbackCopy(val, done));
        } else {
            fallbackCopy(val, done);
        }
    }
};

// Activity controls

document.querySelectorAll('.stats-view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        state.view = btn.dataset.mode || 'daily';
        renderChart(document.getElementById('dash-activity-chart'));
    });
});

document.querySelectorAll('.dash-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!state.data) return;
        document.querySelectorAll('.dash-filter-btn').forEach(b => {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        state.filter = btn.dataset.filter;
        renderLicenses();
    });
});

const licenseSearch = document.getElementById('dash-license-search');
if (licenseSearch) {
    licenseSearch.addEventListener('input', () => {
        state.query = licenseSearch.value;
        if (state.data) renderLicenses();
    });
}

const signOutBtn = document.getElementById('dash-signout-btn');
if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
        signOutBtn.disabled = true;
        signOutBtn.textContent = 'Signing out…';
        try { await DiscordAuth.Logout(); } catch (e) {}
        try { DiscordAuth.DeleteSessionToken(); } catch (e) {}
        window.location.href = '/';
    });
}

const rangeInput = document.getElementById('dash-activity-range');
if (rangeInput) {
    rangeInput.addEventListener('change', function () {
        state.range = this.value === 'all' ? 'all' : (parseInt(this.value, 10) || 14);
        reloadActivity();
    });
}

// End-date picker, Athens calendar.
const endInput = document.getElementById('dash-activity-end');
if (endInput) {
    endInput.max = athensDateStrClient(Date.now());
    endInput.addEventListener('change', function () {
        state.end = this.value;
        reloadActivity();
    });
}

// Settings – Connections: one gold card that mints a real QR + PIN. Minting
// goes through DiscordAuth.MintLinkRow (the same call the quick-login modal
// uses) and the QR is drawn with the vendored js/util/qrcode.js lib.
(function initLinkCard() {
    const btn = document.getElementById('dash-link-device-btn');
    if (!btn) return;
    const idle = document.getElementById('dash-link-idle');
    const live = document.getElementById('dash-link-live');
    const done = document.getElementById('dash-link-done');
    const qr = document.getElementById('dash-link-qr');
    const codeEl = document.getElementById('dash-link-code');
    const countEl = document.getElementById('dash-link-count');
    const msg = document.getElementById('dash-link-card-msg');
    const refreshBtn = document.getElementById('dash-link-refresh');
    const hideBtn = document.getElementById('dash-link-hide');
    const doneHideBtn = document.getElementById('dash-link-hide-done');
    if (!idle || !live || !done || !qr || !codeEl) return;

    let row = null;
    let pollTimer = null;
    let countTimer = null;
    let busy = false;

    function say(text, type) {
        if (msg) msg.textContent = text || '';
        if (text && type && typeof Notify !== 'undefined') Notify(text, type, 3500);
    }

    function stopTimers() {
        if (pollTimer) clearTimeout(pollTimer);
        if (countTimer) clearInterval(countTimer);
        pollTimer = null;
        countTimer = null;
    }

    function clearDisplay() {
        codeEl.textContent = '';
        if (countEl) countEl.textContent = '';
        try {
            const ctx = qr.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, qr.width, qr.height);
        } catch (e) {}
        qr.style.display = '';
    }

    function showIdle() {
        clearDisplay();
        idle.hidden = false;
        live.hidden = true;
        done.hidden = true;
    }

    function showLive() {
        idle.hidden = true;
        live.hidden = false;
        done.hidden = true;
    }

    function showDone() {
        idle.hidden = true;
        live.hidden = true;
        done.hidden = false;
    }

    function fmtLeft() {
        const s = Math.max(0, Math.ceil((row.expires_at - Date.now()) / 1000));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    function tickCount() {
        if (countEl && row) countEl.textContent = 'Code expires in ' + fmtLeft();
    }

    function watchCountdown() {
        if (countTimer) clearInterval(countTimer);
        tickCount();
        countTimer = setInterval(() => {
            if (!row) { stopTimers(); return; }
            if (Date.now() >= row.expires_at) {
                stopTimers();
                row = null;
                showIdle();
                say('That code expired – generate a new one.');
                return;
            }
            tickCount();
        }, 1000);
    }

    function watchClaim(apiUrl) {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = setTimeout(async () => {
            if (!row) return;
            try {
                const res = await fetch(`${apiUrl}/discord/quick-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: row.device_token })
                });
                const data = await res.json().catch(() => ({}));
                if (!row) return;
                // The new device claimed the row, so the minter sees consumed.
                if (data && data.ok && data.status === 'consumed') {
                    stopTimers();
                    row = null;
                    showDone();
                    say('New device linked.', 'success');
                    return;
                }
                if (data && data.ok && (data.status === 'expired' || data.status === 'denied')) {
                    stopTimers();
                    row = null;
                    showIdle();
                    say(data.status === 'denied' ? 'The approval was declined.' : 'That code expired – generate a new one.');
                    return;
                }
            } catch (e) { /* network hiccup – keep polling until the countdown ends */ }
            if (row) watchClaim(apiUrl);
        }, 2000);
    }

    async function mint() {
        if (busy) return;
        busy = true;
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Preparing…';
        say('');
        try {
            const apiUrl = await Api.GetApiUrl();
            const minted = await DiscordAuth.MintLinkRow(apiUrl, true);
            const start = minted.start;
            if (minted.status === 429) {
                say('Too many codes – wait a while and try again.', 'warning');
                return;
            }
            if (!start || !start.ok || typeof start.qr_url !== 'string' ||
                typeof start.user_code !== 'string' || typeof start.device_token !== 'string') {
                say('Could not reach the login server. Check your connection and try again.', 'error');
                return;
            }
            stopTimers();
            row = { device_token: start.device_token, expires_at: Number(start.expires_at) };
            const pin = String(start.user_code).toUpperCase().replace(/[^0-9A-Z]/g, '');
            codeEl.textContent = pin.replace(/(.{4})(.{4})/, '$1–$2');
            qr.style.display = '';
            try {
                const qrLib = await import('../../util/qrcode.js');
                qrLib.drawQRCode(qr, start.qr_url, { scale: 3, dark: '#141210', light: '#e8d9bd' });
            } catch (e) { qr.style.display = 'none'; }
            showLive();
            watchCountdown();
            watchClaim(apiUrl);
            if (start.bound === false) say('Session check failed – this code needs approval instead.', 'warning');
        } catch (e) {
            say('Could not reach the login server. Check your connection and try again.', 'error');
        } finally {
            busy = false;
            btn.disabled = false;
            btn.textContent = original;
        }
    }

    btn.addEventListener('click', () => { mint().catch(() => {}); });
    if (refreshBtn) refreshBtn.addEventListener('click', () => { mint().catch(() => {}); });
    showIdle();
    if (hideBtn) hideBtn.addEventListener('click', () => {
        stopTimers();
        row = null;
        showIdle();
        say('Hidden – the code stays valid until it expires.');
    });
    if (doneHideBtn) doneHideBtn.addEventListener('click', () => {
        showIdle();
        say('');
    });
})();

// Settings – "Link a device": approve the logged-OUT device's PIN with this
// browser's session, so the other screen signs in through its own poll.
const linkPinInput = document.getElementById('dash-link-pin');
const linkPinBtn = document.getElementById('dash-link-pin-btn');
const linkPinMsg = document.getElementById('dash-link-pin-msg');
if (linkPinInput) {
    linkPinInput.addEventListener('input', () => {
        linkPinInput.value = linkPinInput.value.toUpperCase().replace(/[^0-9A-Z-]/g, '').slice(0, 9);
    });
}
if (linkPinBtn) {
    linkPinBtn.addEventListener('click', async () => {
        const say = (msg, ok) => {
            if (linkPinMsg) {
                linkPinMsg.textContent = msg;
                linkPinMsg.classList.toggle('is-ok', !!ok);
            }
        };
        const pin = (linkPinInput ? linkPinInput.value : '').replace(/[^0-9A-Z]/g, '');
        if (pin.length !== 8) {
            say('Enter the 8-character PIN from the other screen.');
            return;
        }
        linkPinBtn.disabled = true;
        try {
            const apiUrl = await Api.GetApiUrl();
            const t = DiscordAuth.GetSessionToken();
            const res = await fetch(`${apiUrl}/discord/quick-approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
                body: JSON.stringify({ user_code: pin, sessionToken: t })
            });
            const data = await res.json().catch(() => ({}));
            if (data && data.ok) {
                say('Approved – the other device is signing in now.', true);
                if (linkPinInput) linkPinInput.value = '';
            } else if (data && data.error === 'wrong_code') {
                say(`Wrong PIN – ${data.remaining || 0} tries left. Check the other screen.`);
            } else if (data && data.error === 'too_many_attempts') {
                say('Too many wrong PINs – that code is burned. Make a new one.');
            } else {
                say('That PIN is not valid any more – start a new quick login.');
            }
        } catch (e) {
            say('Could not reach the login server. Check your connection and try again.');
        } finally {
            linkPinBtn.disabled = false;
        }
    });
}

// The injected topbar is 64px of content plus its own 1px bottom border, so the
// hand-written --dash-topbar-h was always a pixel short and the sidebar's top
// edge sat under that border. Measure it instead and publish it back.
function syncTopbarHeight() {
    const nav = document.querySelector('nav.fixed.top-0');
    if (!nav) return;
    const h = Math.round(nav.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--dash-topbar-h', h + 'px');
}

syncTopbarHeight();
window.addEventListener('load', syncTopbarHeight);
window.addEventListener('resize', syncTopbarHeight);

// addEventListener, not `window.onload =`: js/html/render/canvas.js registers its
// own onload handler and would be silently overwritten depending on script order.
window.addEventListener('load', () => {
    if (typeof initParticles === 'function') {
        initParticles();
    }
    if (!DiscordAuth.GetSessionToken()) {
        window.location.href = '/';
        return;
    }
    loadAll();
});
