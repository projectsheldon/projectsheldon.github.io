// Dashboard page script
import Api from "../../util/backend.js";
import { DiscordAuth } from "../../discord/auth.js";

let state = {
    data: null,
    filter: 'all',
    range: 14,
    end: '',
    expanded: null,
    heatMode: 'daily'
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
    if (lic.banned || lic.disabled) return 'disabled';
    if (lic.expires_at !== -1 && Date.now() > lic.expires_at) return 'expired';
    return 'active';
}

function isActiveLicense(lic) {
    return licenseStatus(lic) === 'active';
}

// Profile / stats

function setAvatar(imgEl, fallbackEl, avatarUrl, name) {
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
    h = h || 28;
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
    if (delta.dir === 'flat') return '<span class="dash-delta flat">— no change</span>';
    const arrow = delta.dir === 'up' ? '▲' : '▼';
    return `<span class="dash-delta ${delta.dir}">${arrow} ${Math.abs(delta.pct)}% last 7d</span>`;
}

function renderProfile() {
    const { user, banned, memberSince, usage, licenses } = state.data;
    const name = user.globalName || user.username || 'Account';

    setAvatar(document.getElementById('dash-avatar'), document.getElementById('dash-avatar-fallback'), user.avatar, name);
    document.getElementById('dash-username').textContent = name;
    document.getElementById('dash-user-sub').textContent = '@' + (user.username || 'unknown');

    const balanceEl = document.getElementById('dash-side-balance');
    if (balanceEl) balanceEl.textContent = '$' + Number(user.balance || 0).toFixed(2);

    const dot = document.getElementById('dash-status-dot');
    if (dot) {
        dot.className = 'dash-status-dot ' + (banned ? 'red' : 'green');
        dot.title = banned ? 'Banned' : 'Active';
    }

    // Centered profile header (mirrors sidebar identity, same data source).
    const pAvatar = document.getElementById('dash-profile-avatar');
    const pFallback = document.getElementById('dash-profile-avatar-fallback');
    if (pAvatar && pFallback) setAvatar(pAvatar, pFallback, user.avatar, name);
    const pName = document.getElementById('dash-profile-name');
    if (pName) pName.textContent = name;
    const pSub = document.getElementById('dash-profile-sub');
    if (pSub) pSub.textContent = '@' + (user.username || 'unknown') + ' · Member since ' + formatDate(memberSince);
    const pStatus = document.getElementById('dash-profile-status');
    if (pStatus) {
        pStatus.textContent = banned ? 'Banned' : 'Active';
        pStatus.className = 'dash-pill ' + (banned ? 'red' : 'green');
    }
    const pBal = document.getElementById('dash-profile-balance');
    if (pBal) pBal.textContent = '$' + Number(user.balance || 0).toFixed(2) + ' balance';

    const daily = (state.data.activity && state.data.activity.daily) || [];
    const dailySeconds = daily.map(d => Number(d.seconds) || 0);

    const activeCount = (licenses || []).filter(isActiveLicense).length;
    const planLabel = banned ? 'Banned' : (activeCount > 0 ? 'Active plan' : 'No plan');

    const stats = document.getElementById('dash-stats');
    stats.innerHTML = '';
    const cards = [
        { label: 'Status', value: banned ? 'Banned' : 'Active', cls: banned ? '' : '' },
        { label: 'Current plan', value: planLabel },
        { label: 'Total usage', value: formatDuration(usage.totalSeconds), cls: 'gold', spark: dailySeconds, delta: last7vsPrev7(daily) },
        { label: 'Balance', value: '$' + Number(user.balance || 0).toFixed(2), sub: 'wallet credits', cls: 'gold' },
        { label: 'Member since', value: formatDate(memberSince) }
    ];
    cards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'dash-stat';

        const label = document.createElement('div');
        label.className = 'dash-stat-label';
        label.textContent = card.label;

        const value = document.createElement('div');
        value.className = 'dash-stat-value' + (card.cls ? ' ' + card.cls : '');
        value.appendChild(document.createTextNode(card.value));

        el.appendChild(label);
        el.appendChild(value);

        if (card.spark && card.spark.length) el.insertAdjacentHTML('beforeend', sparklineSvg(card.spark));
        if (card.delta) el.insertAdjacentHTML('beforeend', deltaHtml(card.delta));
        if (card.sub) {
            const sub = document.createElement('div');
            sub.className = 'dash-stat-sub';
            sub.textContent = card.sub;
            el.appendChild(sub);
        }

        stats.appendChild(el);
    });

    const actions = document.getElementById('dash-quick-actions');
    if (actions) actions.style.display = 'flex';

    const copyBtn = document.getElementById('dash-action-copykey');
    if (copyBtn && licenses.length > 0) {
        const newest = licenses
            .filter(isActiveLicense)
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0] || licenses[0];
        copyBtn.disabled = false;
        copyBtn.style.opacity = '';
        copyBtn.style.cursor = '';
        copyBtn.title = 'Copy key: ' + newest.key;
        copyBtn.onclick = () => {
            copyKey(copyBtn, newest.key);
            if (window.NotifySuccess) window.NotifySuccess('License key copied');
        };
    }
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
        ? 'Free key claimed. Counter reset — use Sheldon another ' + thresholdHours + ' hours this week for the next.'
        : (remaining > 0
            ? 'Use Sheldon ' + remaining + ' more hour' + (remaining === 1 ? '' : 's') + ' this week to earn a free license without watching an ad.'
            : 'Threshold met! Your next ad grants a free license.');
    card.style.display = 'block';
}

// Activity chart

function chartHours(daily) {
    // Map API daily entries (seconds) to whole hours for the chart.
    return (daily || []).map(d => ({
        ts: d.ts,
        date: d.date,
        label: d.label,
        count: Math.round((Number(d.seconds) || 0) / 3600),
        sessions: d.sessions || 0
    }));
}

function barChartHtml(daily, getSub, opts) {
    const max = Math.max(...daily.map(d => d.count), 1);
    const min = Math.min(...daily.map(d => d.count));
    const hasData = daily.some(d => d.count > 0);
    const last = daily.length - 1;
    const bars = daily.map((d, i) => {
        const h = d.count > 0 ? Math.max((d.count / max) * 100, 4) : 0;
        const cls = d.count > 0 ? 'bar' : 'bar bar-empty';
        const today = d.count > 0 && i === last && opts?.highlightLast !== false ? ' bar-today' : '';
        const sub = typeof getSub === 'function' ? getSub(d) : '';
        return `
            <div class="bar-col">
                <div class="${cls}${today}" style="height:0" data-h="${h.toFixed(1)}" data-label="${escapeHtml(d.label)}" data-count="${escapeHtml(d.count + 'h')}"${d.ts ? ` data-ts="${d.ts}"` : ''}${d.date ? ` data-date="${escapeHtml(d.date)}"` : ''}${sub ? ` data-sub="${escapeHtml(sub)}"` : ''}></div>
            </div>
        `;
    }).join('');
    return `
        <div class="stats-chart">
            ${hasData ? `<span class="chart-max">Peak: ${max}h · Lowest: ${min}h</span>` : ''}
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
        count: Math.round((Number(n.seconds) || 0) / 3600)
    }));
}

function dateRangeText(daily) {
    if (!Array.isArray(daily) || daily.length === 0 || !daily.some(d => d.count > 0)) return 'No data yet.';
    const first = daily[0].label;
    const last = daily[daily.length - 1].label;
    return first === last ? first : `${first} – ${last}`;
}

// X-axis labels, thinned on long ranges.
function chartLabelsHtml(daily) {
    const step = Math.max(1, Math.ceil(daily.length / 7));
    const items = daily.map((d, i) => {
        const show = i % step === 0 || i === daily.length - 1;
        return `<span>${show ? escapeHtml(d.label) : ''}</span>`;
    }).join('');
    return `<div class="chart-xlabels">${items}</div>`;
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
            <div class="flex flex-col items-center gap-2 text-center px-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-600"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                <p class="text-xs text-neutral-500">${escapeHtml(text)}</p>
            </div>
        </div>
    `;
}

function hourlyWrapHtml(label, items) {
    return `
        <div class="hourly-wrap">
            <div class="flex items-center justify-between gap-3 pb-2 mb-1 border-b border-white/10">
                <span class="text-xs text-neutral-400 font-mono">${escapeHtml(label)} &mdash; hourly</span>
                <button class="hourly-back flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors">← back</button>
            </div>
            ${barChartHtml(items, null, { highlightLast: false })}
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
    renderHeatmap();
    const daily = chartHours(state.data.activity.daily);
    if (daily.length === 0) {
        el.innerHTML = emptyStateHtml('No activity yet.');
        document.getElementById('dash-activity-date-range').textContent = 'No data yet.';
        return;
    }
    el.innerHTML = barChartHtml(daily, d => d.count > 0
        ? `${d.count}h · ${d.sessions} session${d.sessions === 1 ? '' : 's'}`
        : '');
    el.insertAdjacentHTML('beforeend', chartLabelsHtml(daily));
    bindChartTooltips(el, bar => expandHourly(Number(bar.dataset.ts), bar));
    animateBars(el);

    const rangeText = dateRangeText(daily);
    const totalSessions = daily.reduce((a, d) => a + (d.sessions || 0), 0);
    document.getElementById('dash-activity-date-range').textContent =
        rangeText === 'No data yet.' ? rangeText : `${rangeText} · ${totalSessions} session${totalSessions === 1 ? '' : 's'} · EU/Athens`;
}

// Activity heatmap (Daily / Weekly / Cumulative) — same daily payload, no new endpoint.
function heatLevel(v, max) {
    if (!(v > 0) || !(max > 0)) return '';
    const r = v / max;
    if (r <= 0.25) return 'l1';
    if (r <= 0.5) return 'l2';
    if (r <= 0.8) return 'l3';
    return 'l4';
}

function heatmapValues() {
    const daily = (state.data && state.data.activity && state.data.activity.daily) || [];
    const secs = daily.map(d => Number(d.seconds) || 0);
    if (state.heatMode === 'weekly') {
        const weeks = [];
        for (let i = 0; i < secs.length; i += 7) {
            weeks.push({
                seconds: secs.slice(i, i + 7).reduce((a, b) => a + b, 0),
                label: (daily[i] && daily[i].label ? daily[i].label + ' week' : 'Week ' + (weeks.length + 1)),
                sessions: daily.slice(i, i + 7).reduce((a, d) => a + (Number(d.sessions) || 0), 0)
            });
        }
        return weeks;
    }
    if (state.heatMode === 'cumulative') {
        let run = 0;
        return secs.map((s, i) => {
            run += s;
            return { seconds: run, label: (daily[i] && daily[i].label) || ('Day ' + (i + 1)), sessions: Number((daily[i] && daily[i].sessions) || 0) };
        });
    }
    return secs.map((s, i) => ({ seconds: s, label: (daily[i] && daily[i].label) || ('Day ' + (i + 1)), sessions: Number((daily[i] && daily[i].sessions) || 0) }));
}

function renderHeatmap() {
    const el = document.getElementById('dash-heatmap');
    if (!el || !state.data) return;
    const vals = heatmapValues();
    if (!vals.length || !vals.some(v => v.seconds > 0)) {
        el.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'text-neutral-500 text-xs py-2';
        p.textContent = 'No activity yet — your heatmap will appear here.';
        el.appendChild(p);
        return;
    }
    const max = Math.max(...vals.map(v => v.seconds), 1);
    el.innerHTML = '';
    // 7-row GitHub-style columns; weekly/cumulative collapse to one row per bucket.
    const perCol = state.heatMode === 'daily' ? 7 : 1;
    for (let i = 0; i < vals.length; i += perCol) {
        const col = document.createElement('div');
        col.className = 'dash-heat-col';
        vals.slice(i, i + perCol).forEach(v => {
            const c = document.createElement('span');
            c.className = 'dash-heat-cell ' + heatLevel(v.seconds, max);
            const hrs = (v.seconds / 3600);
            const hrsText = hrs < 1 ? Math.round(v.seconds / 60) + 'm' : hrs.toFixed(hrs < 10 ? 1 : 0) + 'h';
            c.title = v.label + ' · ' + hrsText + (v.sessions ? ' · ' + v.sessions + ' sessions' : '');
            col.appendChild(c);
        });
        el.appendChild(col);
    }
    document.querySelectorAll('.dash-heat-btn').forEach(b => {
        const on = b.dataset.mode === state.heatMode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
}

// Licenses

const copyIcon = `<svg class="copy-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="check-icon w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

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
    if (summary) {
        const active = licenses.filter(isActiveLicense).length;
        const inactive = licenses.length - active;
        summary.textContent = licenses.length === 0
            ? 'No licenses yet.'
            : `${licenses.length} key${licenses.length === 1 ? '' : 's'} · ${active} active · ${inactive} inactive`;
    }

    list.innerHTML = '';
    if (filtered.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-neutral-500 text-sm py-6 text-center';
        p.textContent = licenses.length === 0 ? 'No licenses found.' : 'No licenses match this filter.';
        list.appendChild(p);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'admin-table-wrapper';

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.setAttribute('data-resizable', '');
    table.style.minWidth = '900px';

    const colgroup = document.createElement('colgroup');
    ['26%', '14%', '11%', '15%', '14%', '15%', '5%'].forEach(w => {
        const col = document.createElement('col');
        col.style.width = w;
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const headCells = [
        { label: 'Key', cls: '' },
        { label: 'Product', cls: '' },
        { label: 'Status', cls: '' },
        { label: 'Expires', cls: 'td-num' },
        { label: 'Created', cls: 'td-num' },
        { label: 'Last activity', cls: 'td-num' },
        { label: '', cls: '' }
    ];
    headCells.forEach(cell => {
        const th = document.createElement('th');
        th.textContent = cell.label;
        if (cell.cls) th.classList.add(cell.cls);
        if (cell.label) {
            const resizer = document.createElement('span');
            resizer.className = 'col-resizer';
            th.appendChild(resizer);
        }
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

        let status;
        if (lic.banned) status = 'banned';
        else if (lic.disabled) status = 'disabled';
        else if (lic.expires_at !== -1 && Date.now() > lic.expires_at) status = 'expired';
        else status = 'active';

        const tdStatus = document.createElement('td');
        tdStatus.innerHTML = licenseStatusBadge(status);

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
        copyBtn.title = 'Copy Key';
        copyBtn.dataset.key = lic.key;
        copyBtn.innerHTML = copyIcon + checkIcon;
        copyBtn.addEventListener('click', function() { copyKey(this, this.dataset.key); });
        tdCopy.appendChild(copyBtn);

        tr.appendChild(tdKey);
        tr.appendChild(tdProd);
        tr.appendChild(tdStatus);
        tr.appendChild(tdExp);
        tr.appendChild(tdCr);
        tr.appendChild(tdLa);
        tr.appendChild(tdCopy);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    list.appendChild(wrapper);

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
        p.className = 'text-neutral-500 text-sm py-6 text-center';
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
        renderProfile();
        renderUsageProgress();
        renderChart(chart);
        renderLicenses();
    } catch (e) {
        console.error('Dashboard load failed:', e);
        showError();
    }
}

// Init

function switchTab(tab) {
    document.querySelectorAll('.side-nav-btn[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('tab-overview').classList.toggle('hidden', tab !== 'overview');
    document.getElementById('tab-licenses').classList.toggle('hidden', tab !== 'licenses');
    const title = document.getElementById('dash-page-title');
    const sub = document.getElementById('dash-page-sub');
    if (title) title.textContent = tab === 'licenses' ? 'Licenses' : 'Overview';
    if (sub) sub.textContent = tab === 'licenses' ? 'View and copy your license keys' : 'Your usage, stats and licenses';
}

// Bridge for the command palette (and anything else) to reuse dashboard internals.
window.DashBridge = {
    switchTab,
    copyKey,
    getLicenses: () => (state.data && state.data.licenses) || [],
    getState: () => state,
    copyText: function(val) {
        const done = () => window.NotifySuccess && window.NotifySuccess('Copied to clipboard');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(done).catch(() => fallbackCopy(val, done));
        } else {
            fallbackCopy(val, done);
        }
    }
};

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

document.querySelectorAll('.side-nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
        closeSidebarDrawer();
    });
});

// Sidebar: desktop collapse + mobile drawer

function closeSidebarDrawer() {
    const sb = document.getElementById('dash-sidebar');
    const bd = document.getElementById('dash-sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (bd) bd.classList.remove('show');
}

(function initSidebar() {
    const sb = document.getElementById('dash-sidebar');
    const toggle = document.getElementById('dash-sidebar-toggle');
    const backdrop = document.getElementById('dash-sidebar-backdrop');
    const drawerBtn = document.getElementById('dash-drawer-btn');

    if (sb && toggle) {
        if (localStorage.getItem('dash_sidebar_collapsed') === '1') {
            document.body.classList.add('sidebar-collapsed');
        }
        toggle.addEventListener('click', () => {
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('dash_sidebar_collapsed', collapsed ? '1' : '0');
        });
    }

    if (sb && drawerBtn && backdrop) {
        drawerBtn.addEventListener('click', () => {
            sb.classList.add('open');
            backdrop.classList.add('show');
        });
        backdrop.addEventListener('click', closeSidebarDrawer);
    }
})();

document.querySelectorAll('.dash-heat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        state.heatMode = btn.dataset.mode || 'daily';
        renderHeatmap();
    });
});

document.querySelectorAll('.dash-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderLicenses();
    });
});

document.getElementById('dash-activity-range').addEventListener('change', async function() {
    const raw = this.value;
    state.range = raw === 'all' ? 'all' : (parseInt(raw, 10) || 14);
    state.expanded = null;
    const chart = document.getElementById('dash-activity-chart');
    chart.innerHTML = skeletonChartHtml();
    try {
        const data = await loadDashboard();
        if (!data) { window.location.href = '/'; return; }
        state.data = data;
        renderChart(chart);
        renderLicenses();
    } catch (e) {
        showError();
    }
});

// End-date picker, Athens calendar.
const endInput = document.getElementById('dash-activity-end');
if (endInput) {
    endInput.max = athensDateStrClient(Date.now());
    endInput.addEventListener('change', async function() {
        state.end = this.value;
        state.expanded = null;
        const chart = document.getElementById('dash-activity-chart');
        chart.innerHTML = skeletonChartHtml();
        try {
            const data = await loadDashboard();
            if (!data) { window.location.href = '/'; return; }
            state.data = data;
            renderChart(chart);
            renderLicenses();
        } catch (e) {
            showError();
        }
    });
}