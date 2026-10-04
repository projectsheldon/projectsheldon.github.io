// Dashboard page script
import Api from "../../util/backend.js";
import { DiscordAuth } from "../../discord/auth.js";

const COLLAPSE_KEY = 'sheldon.sidebar.collapsed';
const MOBILE_QUERY = '(max-width: 900px)';

let state = {
    data: null,
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

function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    if (s < 60) return '<1 minute';
    const units = [
        [ 31536000, 'year' ],
        [ 2592000, 'month' ],
        [ 604800, 'week' ],
        [ 86400, 'day' ],
        [ 3600, 'hour' ],
        [ 60, 'minute' ]
    ];
    for (const [ secs, name ] of units) {
        if (s >= secs) {
            const v = Math.floor(s / secs);
            return v + ' ' + name + (v === 1 ? '' : 's');
        }
    }
    return s + ' seconds';
}

// Hours with one decimal â€“ matches the topbar balance precision style and keeps
// sub-hour days from rendering as an empty bar.
function formatHours(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    if (s < 60) return Math.round(s) + 's';
    const h = s / 3600;
    if (h < 1) return Math.round(s / 60) + 'm';
    return (h >= 10 ? h.toFixed(0) : h.toFixed(1)) + 'h';
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

function setAvatar(imgEl, fallbackEl, avatarUrl, name) {
    if (!imgEl || !fallbackEl) return;
    if (avatarUrl) {
        imgEl.src = avatarUrl;
        imgEl.style.display = 'block';
        fallbackEl.style.display = 'none';
    } else {
        fallbackEl.textContent = (name || '?').charAt(0).toUpperCase();
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
    }
}

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
    if (delta.dir === 'flat') return '<span class="dash-delta flat">â€“ no change</span>';
    const arrow = delta.dir === 'up' ? 'â–²' : 'â–¼';
    return `<span class="dash-delta ${delta.dir}">${arrow} ${Math.abs(delta.pct)}% last 7d</span>`;
}

function renderStats() {
    const { user, banned, memberSince, usage, licenses } = state.data;
    const daily = (state.data.activity && state.data.activity.daily) || [];
    const dailySeconds = daily.map(d => Number(d.seconds) || 0);
    const activeCount = (licenses || []).filter(isActiveLicense).length;
    const balance = Number(user.balance || 0).toFixed(1);

    const cards = [
        { label: 'Status', value: banned ? 'Banned' : 'Active' },
        { label: 'Current plan', value: banned ? 'Banned' : (activeCount > 0 ? 'Active plan' : 'No plan') },
        { label: 'Total usage', value: formatDuration(usage.totalSeconds), cls: 'gold', spark: dailySeconds, delta: last7vsPrev7(daily) },
        { label: 'Balance', value: balance, cls: 'gold', sub: 'wallet credits' },
        { label: 'Member since', value: formatDate(memberSince), compact: true }
    ];

    const stats = document.getElementById('dash-stats');
    stats.innerHTML = '';
    cards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'dash-stat';

        const label = document.createElement('span');
        label.className = 'dash-stat-label';
        label.textContent = card.label;

        const value = document.createElement('div');
        value.className = 'dash-stat-value' + (card.cls ? ' ' + card.cls : '') + (card.compact ? ' compact' : '');
        value.textContent = card.value;

        el.appendChild(label);
        el.appendChild(value);

        if (card.spark && card.spark.length) el.insertAdjacentHTML('beforeend', sparklineSvg(card.spark));
        if (card.delta) el.insertAdjacentHTML('beforeend', deltaHtml(card.delta));
        if (card.sub) {
            const sub = document.createElement('span');
            sub.className = 'dash-stat-sub';
            sub.textContent = card.sub;
            el.appendChild(sub);
        }

        stats.appendChild(el);
    });
}

function renderSidebarUser() {
    const { user, banned } = state.data;
    const name = user.globalName || user.username || 'Account';

    setAvatar(
        document.getElementById('dash-side-avatar'),
        document.getElementById('dash-side-avatar-fallback'),
        user.avatar,
        name
    );
    document.getElementById('dash-side-name').textContent = name;
    document.getElementById('dash-side-handle').textContent = banned
        ? 'Banned'
        : '@' + (user.username || 'unknown');
    document.getElementById('dash-side-balance').textContent = Number(user.balance || 0).toFixed(1);
}

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

    const pct = Math.min(100, Math.round((seconds / threshold) * 100));
    const hours = Math.floor(seconds / 3600);
    const thresholdHours = Math.round(threshold / 3600);
    const rewarded = sessionStorage.getItem('usage_reward') === '1';
    const remaining = Math.max(0, thresholdHours - hours);

    document.getElementById('dash-usage-ratio').textContent = hours + ' / ' + thresholdHours + ' hours';
    document.getElementById('dash-usage-fill').style.width = pct + '%';
    document.getElementById('dash-usage-caption').textContent = rewarded
        ? 'Free key claimed. Counter reset â€“ use Sheldon another ' + thresholdHours + ' hours this week for the next.'
        : (remaining > 0
            ? 'Use Sheldon ' + remaining + ' more hour' + (remaining === 1 ? '' : 's') + ' this week to earn a free license without watching an ad.'
            : 'Threshold met! Your next ad grants a free license.');
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
                label: (chunk[0] && chunk[0].label) || ('Week ' + (out.length + 1)),
                range: chunk.length > 1 ? chunk[0].label + ' â€“ ' + chunk[chunk.length - 1].label : ''
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
        { label: 'Peak day', value: peakSeconds > 0 ? formatHours(peakSeconds) : 'â€“', sub: peakLabel || 'no activity' },
        { label: 'Avg / day', value: total > 0 ? formatHours(avg) : '0s', sub: 'across range' },
        { label: 'Active days', value: active + ' / ' + daily.length, sub: total > 0 ? Math.round((active / daily.length) * 100) + '% of range' : 'â€“' }
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
                <div class="${cls}${today}" style="height:0" data-h="${h.toFixed(1)}" data-label="${escapeHtml(b.label)}" data-count="${escapeHtml(formatHours(b.seconds))}"${sub ? ` data-sub="${escapeHtml(sub)}"` : ''}${b.ts ? ` data-ts="${b.ts}"` : ''}${b.date ? ` data-date="${escapeHtml(b.date)}"` : ''}></div>
            </div>
        `;
    }).join('');

    return `
        <div class="stats-chart">
            ${hasData ? `<span class="chart-max">Peak: ${escapeHtml(formatHours(max))} Â· Lowest: ${escapeHtml(formatHours(Math.min(...buckets.map(b => Number(b.seconds) || 0))))}</span>` : ''}
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
    return first === last ? first : `${first} â€“ ${last}`;
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
                <button class="hourly-back">â† back</button>
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
            : `${rangeText} Â· ${totalSessions} session${totalSessions === 1 ? '' : 's'} Â· EU/Athens`;

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

    const summary = document.getElementById('dash-license-summary');
    const count = document.getElementById('dash-license-count');
    const active = licenses.filter(isActiveLicense).length;
    if (summary) {
        summary.textContent = licenses.length === 0
            ? 'No licenses yet.'
            : `${active} active Â· ${licenses.length - active} inactive Â· ${filtered.length} shown`;
    }
    if (count) count.textContent = filtered.length ? String(filtered.length) : '';

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
        renderSidebarUser();
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
        renderSidebarUser();
        renderUsageProgress();
        renderChart(chart);
        renderLicenses();
    } catch (e) {
        showError();
    }
}

// Tabs

function switchTab(tab) {
    document.querySelectorAll('.nav-tab[data-tab]').forEach(b => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    document.getElementById('tab-overview').classList.toggle('hidden', tab !== 'overview');
    document.getElementById('tab-licenses').classList.toggle('hidden', tab !== 'licenses');
    // table-heavy tabs use the full available width
    document.getElementById('dash-reader').classList.toggle('is-wide', tab === 'licenses');
    document.getElementById('dash-page-title').textContent = tab === 'licenses' ? 'Licenses' : 'Overview';
    document.getElementById('dash-page-sub').textContent = tab === 'licenses'
        ? 'View and copy your license keys'
        : 'Your usage, stats and licenses';
}

// Sidebar â€“ desktop collapse to an icon rail, mobile off-canvas drawer.

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
        }
        if (backdrop) backdrop.classList.toggle('show', !collapsed);
        document.body.classList.toggle('drawer-open', !collapsed);
    } else {
        document.body.classList.remove('drawer-open');
        if (sidebar) {
            sidebar.classList.remove('open');
            sidebar.classList.toggle('collapsed', collapsed);
        }
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
    setCollapsed(!isMobile() && !document.getElementById('dash-sidebar').classList.contains('collapsed'));
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
    drawerBtn?.addEventListener('click', () => setCollapsed(false));
    backdrop?.addEventListener('click', closeSidebarDrawer);

    document.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            closeSidebarDrawer();
        });
    });

    restoreCollapsed();
    window.matchMedia(MOBILE_QUERY).addEventListener('change', restoreCollapsed);
})();

// Sidebar filter (same behaviour as /admin: narrows the nav groups).

(function initSidebarFilter() {
    const input = document.getElementById('dashSidebarFilter');
    const nav = document.getElementById('dashSidebarNav');
    if (!input || !nav) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        nav.querySelectorAll('[data-sidebar-group]').forEach(group => {
            let visible = 0;
            group.querySelectorAll('.nav-tab').forEach(tab => {
                const label = (tab.querySelector('.nav-label')?.textContent || '').toLowerCase();
                const hit = !q || label.includes(q);
                tab.classList.toggle('hidden', !hit);
                if (hit) visible++;
            });
            let label = group.previousElementSibling;
            while (label && !label.classList.contains('sidebar-group-label')) label = label.previousElementSibling;
            const divider = group.previousElementSibling?.classList.contains('sidebar-divider') ? group.previousElementSibling : null;
            if (label) label.classList.toggle('hidden', visible === 0);
            if (divider) divider.classList.toggle('hidden', visible === 0);
        });
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.value = '';
            input.dispatchEvent(new Event('input'));
            input.blur();
        }
        if (e.key === 'Enter') {
            const first = nav.querySelector('.nav-tab:not(.hidden)[data-tab]');
            if (first) {
                switchTab(first.dataset.tab);
                closeSidebarDrawer();
            }
        }
    });

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
        document.querySelectorAll('.dash-filter-btn').forEach(b => {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        state.filter = btn.dataset.filter;
        renderLicenses();
    });
});

document.getElementById('dash-activity-range').addEventListener('change', function () {
    state.range = this.value === 'all' ? 'all' : (parseInt(this.value, 10) || 14);
    reloadActivity();
});

// End-date picker, Athens calendar.
const endInput = document.getElementById('dash-activity-end');
if (endInput) {
    endInput.max = athensDateStrClient(Date.now());
    endInput.addEventListener('change', function () {
        state.end = this.value;
        reloadActivity();
    });
}

window.onload = () => {
    if (typeof initParticles === 'function') {
        initParticles();
    }
    if (!DiscordAuth.GetSessionToken()) {
        window.location.href = '/';
        return;
    }
    loadAll();
};
