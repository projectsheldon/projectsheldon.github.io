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
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
const INFO_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

// The sparkline is decorative, so the explanation lives on a focusable wrapper
// plus an explicit hint row - native title alone is unreachable by keyboard.
function sparklineBlock(values, delta) {
    return `
        <span class="dash-spark-wrap" tabindex="0" role="img"
              aria-label="${escapeHtml(SPARK_HINT)}"
              title="${escapeHtml(SPARK_HINT)}">
            ${sparklineSvg(values)}
        </span>
        ${deltaHtml(delta)}
        <span class="dash-spark-hint" title="${escapeHtml(SPARK_HINT)}">${INFO_ICON}Daily usage, last ${values.length} days</span>
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
    const arrow = delta.dir === 'up' ? '▲' : '▼';
    return `<span class="dash-delta ${delta.dir}" title="${escapeHtml(SPARK_HINT)}">${arrow} ${Math.abs(delta.pct)}% last 7d</span>`;
}

function renderStats() {
    const { user, memberSince, usage } = state.data;
    const daily = (state.data.activity && state.data.activity.daily) || [];
    const dailySeconds = daily.map(d => Number(d.seconds) || 0);

    // Balance and member age are both small, static facts, so they share one card
    // split by a hairline instead of each taking a quarter of the row.
    const cards = [
        { label: 'Total usage', value: formatHours((usage && usage.totalSeconds) || 0), cls: 'gold', sub: 'all time', spark: dailySeconds, delta: last7vsPrev7(daily) },
        {
            cells: [
                { label: 'Balance', value: Number(user.balance || 0).toFixed(1), cls: 'gold', sub: 'wallet credits' },
                { label: 'Member since', value: formatDate(memberSince), compact: true }
            ]
        }
    ];

    const stats = document.getElementById('dash-stats');
    stats.innerHTML = '';
    cards.forEach(card => {
        const el = document.createElement('div');
        el.className = card.cells ? 'dash-stat dash-stat--split' : 'dash-stat';
        // `cells` means one card split into hairline-separated halves.
        (card.cells || [card]).forEach(part => {
            const host = card.cells ? document.createElement('div') : el;
            if (card.cells) {
                host.className = 'dash-stat-cell';
                el.appendChild(host);
            }
            renderStatCell(host, part);
        });
        stats.appendChild(el);
    });
}

function renderStatCell(host, card) {
    const label = document.createElement('span');
    label.className = 'dash-stat-label';
    label.textContent = card.label;

    const value = document.createElement('div');
    value.className = 'dash-stat-value' + (card.cls ? ' ' + card.cls : '') + (card.compact ? ' compact' : '');
    value.textContent = card.value;

    host.appendChild(label);
    host.appendChild(value);

    if (card.spark && card.spark.length) host.insertAdjacentHTML('beforeend', sparklineBlock(card.spark, card.delta));
    else if (card.delta) host.insertAdjacentHTML('beforeend', deltaHtml(card.delta));
    if (card.sub) {
        const sub = document.createElement('span');
        sub.className = 'dash-stat-sub';
        sub.textContent = card.sub;
        host.appendChild(sub);
    }
}

// ---------- progress-bar runner ----------
// An endless-runner easter egg inside the weekly-goal bar. The dino's position
// along the track is the real progress, so the bar literally is the run. It is
// deliberately not a game you can lose: a cactus only makes it blink and hop
// again, and nothing is stored.
//
// Canvas rather than CSS animation because the dino, the obstacles and the
// scroll have to share one clock, and a canvas costs nothing while paused.
const RUNNER = (() => {
    const TRACK_H = 64;
    const GROUND_PAD = 9;
    const SPRITE = 1.6;     // the sprite is authored at 16 units
    const DINO_W = Math.round(16 * SPRITE);
    const DINO_H = Math.round(16 * SPRITE);
    const MARGIN = 8;

    // Collision box around a cactus, relative to its x.
    const CACTUS_L = -5;
    const CACTUS_R = 9;
    const CACTUS_H = 14;

    const SPEED = 300;      // logical px per second
    const GRAVITY = 2000;
    const JUMP_V = -310;    // apex 24px at t=0.155s, back down at t=0.31s
    const JUMP_REACH = 55;  // hop distance that puts the cactus inside the air window
    const HIT_FLASH = 520;  // ms of red tint after a hit
    const PHYSICS_STEP = 1 / 120;
    const SPRINT_AT = 0.985;

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

    const BODY_INK = '#f2e7cd';
    const BODY_INK_GOLD = '#1d1913';
    const BODY_INK_HURT = '#ff9d8a';
    const CACTUS_INK = 'rgba(242, 231, 205, .34)';
    const CACTUS_INK_GOLD = 'rgba(29, 25, 19, .3)';
    const ROAD_INK = 'rgba(255, 255, 255, .05)';
    const ROAD_FILLED_INK = 'rgba(0, 0, 0, .07)';
    const DASH_INK = 'rgba(255, 255, 255, .13)';
    const DASH_FILLED_INK = 'rgba(0, 0, 0, .18)';

    // Two frames only - the legs swap. Proportioned so the head, snout, arm
    // and stride all survive the 1.6x downscale.
    function drawDino(ctx, x, y, frame, ink) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(SPRITE, SPRITE);
        ctx.fillStyle = ink;

        ctx.beginPath();                         // tail
        ctx.moveTo(3.4, 9);
        ctx.lineTo(0, 6.8);
        ctx.lineTo(3.4, 12.4);
        ctx.closePath();
        ctx.fill();

        const stride = frame ? 5.2 : 2.8;
        roundRect(ctx, 4.2, 10.8, 2.4, frame ? 2.8 : 5.2, 1.2);   // back leg
        roundRect(ctx, 8.6, 10.8, 2.4, stride, 1.2);               // front leg
        roundRect(ctx, 3, 6.4, 8.6, 5.4, 2.2);                     // body
        roundRect(ctx, 9.4, 5.8, 3, 2.4, 1.1);                    // neck
        roundRect(ctx, 12.2, 8.2, 2.6, 1.9, 0.9);                  // arm
        roundRect(ctx, 8.2, 1, 6.2, 5.6, 2.1);                     // head
        roundRect(ctx, 13.2, 3.2, 3.4, 2.4, 1.1);                  // snout

        ctx.save();                             // eye punched out so it reads at 1x
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(11.7, 2.7, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    function drawCactus(ctx, x, ground, ink) {
        ctx.save();
        ctx.translate(x, ground);
        ctx.scale(SPRITE, SPRITE);
        ctx.fillStyle = ink;
        roundRect(ctx, 0.5, -9, 2.2, 9, 1.1);
        roundRect(ctx, -2.6, -6.8, 2.4, 1.7, 0.85);
        roundRect(ctx, 2.9, -4.8, 2.4, 1.7, 0.85);
        ctx.restore();
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

    function create(canvas) {
        const track = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

        const s = {
            w: 0,
            progress: 0,
            target: 0,
            y: 0,
            vy: 0,
            acc: 0,
            grounded: true,
            obstacles: [],
            spawnIn: 0.9,
            scroll: 0,
            hitUntil: 0,
            last: 0,
            raf: 0,
            running: false,
            onscreen: true
        };

        const ground = () => TRACK_H - GROUND_PAD;
        const filled = () => s.progress * s.w;
        // Just ahead of the fill edge, so the light sprite always has the dark
        // lane behind it instead of straddling the gold.
        const dinoX = () => Math.min(filled() + 3, s.w - DINO_W - MARGIN);

        function resize() {
            const w = track.getBoundingClientRect().width;
            if (!w) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            s.w = w;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(TRACK_H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            paint(0);
        }

        function paint(now) {
            const gy = ground();
            const finished = s.target > SPRINT_AT;

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

            for (const o of s.obstacles) {
                drawCactus(ctx, o.x, gy, o.x < f ? CACTUS_INK_GOLD : CACTUS_INK);
            }

            // Finished: the bar is all gold, so the runner inverts with it.
            // A hit tints it red for a beat rather than blinking it out of existence.
            const hurt = now < s.hitUntil;
            if (finished) drawFlag(ctx, s.w - MARGIN - 2, gy, 'rgba(29, 25, 19, .6)');

            if (!finished) {
                ctx.shadowColor = 'rgba(0, 0, 0, .8)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetY = 1;
            }
            const ink = finished ? BODY_INK_GOLD : (hurt ? BODY_INK_HURT : BODY_INK);
            drawDino(ctx, dinoX(), gy - DINO_H + s.y, Math.floor(performance.now() / 110) % 2, ink);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        }

        function hop() {
            if (!s.grounded) return;
            s.grounded = false;
            s.vy = JUMP_V;
            s.y = -0.01;
        }

        function step(dt, now) {
            s.progress += (s.target - s.progress) * Math.min(1, dt * 1000 / 260);

            if (s.target > SPRINT_AT) {
                s.obstacles.length = 0;
            } else {
                s.scroll += SPEED * dt;
                s.spawnIn -= dt;
                if (s.spawnIn <= 0) {
                    s.spawnIn = 0.7 + Math.random() * 0.8;
                    s.obstacles.push({ x: s.w + 12 });
                }

                const dx = dinoX();
                let nearest = Infinity;
                for (const o of s.obstacles) {
                    o.x -= SPEED * dt;
                    const gap = o.x - dx;
                    if (gap > -8 && gap < nearest) nearest = gap;
                }
                if (nearest < JUMP_REACH && s.grounded) hop();

                // a cactus still standing where the dino's feet are is a hit
                const feet = ground() + s.y;
                s.obstacles = s.obstacles.filter(o => {
                    if (o.x + CACTUS_R < dx || o.x - CACTUS_L > dx + DINO_W) return o.x > -30;
                    if (feet > ground() - CACTUS_H) {
                        s.hitUntil = now + HIT_FLASH;
                        hop();
                        return false;
                    }
                    return true;
                });
            }

            // Fixed substeps: plain Euler at frame dt undershot the apex by ~10%,
            // which is exactly the margin the hop needs.
            s.acc += dt;
            while (s.acc >= PHYSICS_STEP) {
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
            step(dt, now);
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

        track.addEventListener('pointerdown', e => { e.preventDefault(); hop(); });
        track.addEventListener('keydown', e => {
            if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'Enter') {
                e.preventDefault();
                hop();
            }
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

    // Say what the bar is for, then the exact progress, in one sentence.
    let caption;
    if (rewarded) {
        caption = `Free key claimed. Your counter has reset – reach ${totalHours} hours again this week for the next one. (${doneHours}/${totalHours} hours completed)`;
    } else if (doneHours >= totalHours) {
        caption = `Goal reached. Watch an ad now to claim your free license. (${doneHours}/${totalHours} hours completed)`;
    } else {
        caption = `Use Sheldon for ${totalHours} hours this week to earn a free license, no ad required. (${doneHours}/${totalHours} hours completed)`;
    }

    document.getElementById('dash-usage-ratio').textContent = `${doneHours} / ${totalHours} hours`;
    document.getElementById('dash-usage-fill').style.width = pct + '%';
    RUNNER.setProgress(pct);
    document.getElementById('dash-usage-caption').textContent = caption;
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
        const hours = (Number(b.seconds) || 0) / 3600;
        const h = b.seconds > 0 ? Math.max((hours / (max / 3600)) * 100, 4) : 0;
        const cls = b.seconds > 0 ? 'bar' : 'bar bar-empty';
        const today = b.seconds > 0 && i === last && opts.highlightLast !== false ? ' bar-today' : '';
        const sub = b.sessions > 0 ? b.sessions + ' session' + (b.sessions === 1 ? '' : 's') : '';
        return `
            <div class="bar-col">
                <div class="${cls}${today}" style="height:0" data-h="${h.toFixed(1)}" data-label="${escapeHtml(b.label)}" data-count="${escapeHtml(formatHours(b.seconds))}"${sub ? ` data-sub="${escapeHtml(sub)}"` : ''}${b.ts ? ` data-ts="${escapeHtml(b.ts)}"` : ''}${b.date ? ` data-date="${escapeHtml(b.date)}"` : ''}></div>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-chart">
            ${hasData ? `<span class="chart-max">Peak: ${escapeHtml(formatHours(max))} · Lowest: ${escapeHtml(formatHours(Math.min(...buckets.map(b => Number(b.seconds) || 0))))}</span>` : ''}
            <span class="chart-gridline" style="top:25%"></span>
            <span class="chart-gridline" style="top:50%"></span>
            <span class="chart-gridline" style="top:75%"></span>
            <span class="chart-gridline chart-gridline-base"></span>
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
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding-bottom:.6rem;margin-bottom:.5rem;border-bottom:1px solid var(--dash-line);">
                <span class="panel-meta">${escapeHtml(label)} &mdash; hourly</span>
                <button class="hourly-back">← back</button>
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
    return `<span class="license-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

// The page sub-line is shared by both tabs: licenses shows live counts there,
// overview keeps its own copy. Anything that renders data must go through this so
// the licenses numbers never leak onto the overview tab.
function setPageSub() {
    const sub = document.getElementById('dash-page-sub');
    if (!sub) return;
    if (state.tab !== 'licenses') {
        // the stat row no longer carries a card, so the ban state lives here
        sub.textContent = (state.data && state.data.banned) ? 'Access revoked on this account' : 'Your usage, stats and licenses';
        return;
    }
    const licenses = (state.data && state.data.licenses) || [];
    if (licenses.length === 0) {
        sub.textContent = 'No licenses yet';
        return;
    }
    const active = licenses.filter(isActiveLicense).length;
    const shown = licenses.filter(l => {
        if (state.filter === 'active') return isActiveLicense(l);
        if (state.filter === 'inactive') return !isActiveLicense(l);
        return true;
    }).length;
    sub.textContent = `${shown} shown · ${active} active · ${licenses.length - active} inactive`;
}

function renderLicenses() {
    const list = document.getElementById('dash-license-list');
    if (!list || !state.data) return;

    const licenses = state.data.licenses || [];
    const filtered = licenses.filter(l => {
        if (state.filter === 'active') return isActiveLicense(l);
        if (state.filter === 'inactive') return !isActiveLicense(l);
        return true;
    }).sort((a, b) => {
        const sa = isActiveLicense(a) ? 0 : 1;
        const sb = isActiveLicense(b) ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return (b.created_at || 0) - (a.created_at || 0);
    });

    setPageSub();

    list.innerHTML = '';
    if (filtered.length === 0) {
        const p = document.createElement('p');
        p.className = 'empty';
        p.textContent = licenses.length === 0 ? 'No licenses found.' : 'No licenses match this filter.';
        list.appendChild(p);
        return;
    }

    const table = document.createElement('table');
    table.className = 'dash-table';
    table.id = 'dash-license-table';
    table.setAttribute('data-resizable', '');
    table.style.minWidth = '760px';

    const colgroup = document.createElement('colgroup');
    ['27%', '13%', '10%', '14%', '14%', '15%', '7%'].forEach(w => {
        const col = document.createElement('col');
        col.style.width = w;
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    [
        { label: 'Key' },
        { label: 'Product' },
        { label: 'Status' },
        { label: 'Expires', cls: 'td-num' },
        { label: 'Created', cls: 'td-num' },
        { label: 'Last activity', cls: 'td-num' },
        { label: '' }
    ].forEach(cell => {
        const th = document.createElement('th');
        th.className = 'is-sticky';
        th.textContent = cell.label;
        if (cell.cls) th.classList.add(cell.cls);
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    filtered.forEach(lic => {
        const tr = document.createElement('tr');

        const tdKey = document.createElement('td');
        tdKey.className = 'td-mono';
        tdKey.textContent = lic.key;
        tdKey.title = lic.key;

        const tdProd = document.createElement('td');
        tdProd.textContent = lic.product || 'License';

        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = licenseStatusBadge(licenseStatus(lic));

        const tdExp = document.createElement('td');
        tdExp.className = 'td-num';
        tdExp.textContent = lic.expires_at === -1 ? 'Never' : formatDate(lic.expires_at);

        const tdCr = document.createElement('td');
        tdCr.className = 'td-num';
        tdCr.textContent = formatDate(lic.created_at);

        const tdLa = document.createElement('td');
        tdLa.className = 'td-num';
        tdLa.textContent = formatLastSeen(lic.last_activity);

        const tdCopy = document.createElement('td');
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copy key';
        copyBtn.dataset.key = lic.key;
        copyBtn.innerHTML = copyIcon + checkIcon;
        copyBtn.addEventListener('click', function () {
            copyKey(this, this.dataset.key);
            if (window.NotifySuccess) window.NotifySuccess('License key copied');
        });
        tdCopy.appendChild(copyBtn);

        tr.append(tdKey, tdProd, tdStatus, tdExp, tdCr, tdLa, tdCopy);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    list.appendChild(table);

    if (window.ResizableColumns) window.ResizableColumns.attach(table);
}

// Data loading

async function loadDashboard(extra) {
    const token = DiscordAuth.GetSessionToken();
    const user = await DiscordAuth.GetUser();
    if (!token || !user) return null;

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
        p.textContent = message || 'Failed to load.';
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

function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.nav-tab[data-tab]').forEach(b => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    document.getElementById('tab-overview').classList.toggle('hidden', tab !== 'overview');
    document.getElementById('tab-licenses').classList.toggle('hidden', tab !== 'licenses');
    // The header search is always there; only the license filter is tab-specific.
    document.getElementById('dash-license-tools').hidden = tab !== 'licenses';
    // table-heavy tabs use the full available width
    document.getElementById('dash-reader').classList.toggle('is-wide', tab === 'licenses');
    document.getElementById('dash-page-title').textContent = tab === 'licenses' ? 'Licenses' : 'Overview';
    setPageSub();
}

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
