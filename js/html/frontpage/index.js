import Api from "../../util/backend.js";
import { Product, ProductsManager } from "../../payment/products/manager.js";
import { ensureChecksOrNotify } from "../../util/guard.js";

// Only run tab logic on homepage
const isHomepage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');

if (isHomepage) {
    // tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const href = tab.getAttribute('href');
            if (!href || href === '#') {
                e.preventDefault();
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                return;
            }
            
            const targetPath = new URL(href, window.location.origin).pathname.replace(/\/$/, '') || '/';
            
            if (targetPath === currentPath) {
                e.preventDefault();
                navTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            }
        });
    });
}

// pricing
const productsContainer = document.getElementById('products-grid');

function RenderProductsError() {
    if (!productsContainer) return;

    productsContainer.innerHTML = `
        <div class="glass-card p-5 rounded-2xl flex flex-col items-center justify-center text-center col-span-full min-h-[200px]">
            <div class="text-[10px] font-bold uppercase tracking-widest text-[#c7b18f] mb-2">Couldn't load products</div>
            <div class="text-neutral-400 text-sm mb-4">The game servers aren't reachable right now. Once the connection recovers, the page reloads automatically.</div>
            <button class="products-retry-btn bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg px-5 py-2.5 font-bold uppercase text-[10px] tracking-wider transition-all">Retry</button>
        </div>
    `;

    const retryBtn = productsContainer.querySelector('.products-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => { LoadProducts(); });
}

async function LoadProducts() {
    if (!productsContainer) return;

    productsContainer.innerHTML = '';

    let products;
    try {
        products = await ProductsManager.FetchProducts();
    } catch (e) {
        RenderProductsError();
        return;
    }

    products.forEach((product, index) => {
        let cardClass = 'glass-card p-5 rounded-2xl flex flex-col justify-between h-full min-h-[280px]';
        if (product.IsLifetime) cardClass += ' border border-[#c7b18f]/40';

        const staggerClass = `stagger-${Math.min(index + 1, 4)}`;

        const tickSvg = '<span class="perk-tick"><svg fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>';
        const crossSvg = '<span class="perk-tick is-muted"><svg fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></span>';

        const perks = product.IsFree ? `
                    <li class="perk-row">
                        ${tickSvg}
                        All features included
                    </li>
                    <li class="perk-row">
                        ${tickSvg}
                        Watermark shown in-app
                    </li>
                    <li class="perk-row is-muted">
                        ${crossSvg}
                        No Discord role
                    </li>` : `
                    <li class="perk-row">
                        ${tickSvg}
                        All features included
                    </li>
                    <li class="perk-row">
                        ${tickSvg}
                        No watermark
                    </li>
                    <li class="perk-row">
                        ${tickSvg}
                        Discord buyer role
                    </li>`;

        const html = `
            <div class="${cardClass} animate-on-scroll ${staggerClass}" style="transition-delay: ${index * 0.1}s;">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-[#c7b18f]">${product.FormatDuration()}</span>
                    ${product.IsFree
                    ? '<span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/40">Free</span>'
                    : product.IsLifetime ? '<span class="text-[10px] font-bold text-[#c7b18f]">★</span>' : ''}
                </div>
                <div class="text-center py-4">
                    <span class="text-4xl font-black text-white">${product.FormatPrice()}</span>
                </div>
                <ul class="perk-list mb-4 px-1">
                    ${perks}
                </ul>
                <button class="product-btn w-full py-2.5 rounded-lg font-bold uppercase text-[10px] tracking-wider transition-all ${product.IsFree
                ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                : 'bg-[#c7b18f] hover:bg-[#b59f7d] text-black'
            }" data-product="${product.key}">
                    ${product.IsFree ? 'GET KEY' : 'BUY NOW'}
                </button>
            </div>
        `;

        productsContainer.insertAdjacentHTML('beforeend', html);
    });

    document.querySelectorAll('.product-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const productKey = this.getAttribute('data-product');
            window.location.href = `/checkout/?product=${productKey}`;
        });
    });

    if (window.animateOnScrollObserver) {
        document.querySelectorAll('#products-grid .glass-card').forEach(el => {
            window.animateOnScrollObserver.observe(el);
        });
    }
}
document.addEventListener('DOMContentLoaded', LoadProducts);

document.getElementById('hero-cta')?.addEventListener('click', async () => {
    const loggedIn = !!(window.DiscordAuth && window.DiscordAuth.currentUser);
    if (!loggedIn) {
        if (typeof window.Notify === 'function') window.Notify('You must log in with Discord to download Sheldon.', 'warning', 6000);

        // Wait for the auth module, else fall back to full-page Discord OAuth.
        if (!window.DiscordAuth) {
            const startedAt = Date.now();
            while (!window.DiscordAuth && Date.now() - startedAt < 3000) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (window.DiscordAuth && typeof window.DiscordAuth.LoginPopup === 'function') {
            try { await window.DiscordAuth.LoginPopup(); } catch (e) {}
        } else {
            try {
                const apiUrl = await Api.GetApiUrl();
                const res = await fetch(`${apiUrl}/discord/login`);
                const data = await res.json();
                if (data && typeof data.url === 'string' && /^https:\/\/discord\.com\//i.test(data.url))
                {
                    window.location.href = data.url;
                }
            } catch (e) {}
        }
        return;
    }

    try {
        const mod = await import('./install.js');
        await mod.runInstall();
    } catch (e) {
        if (typeof window.Notify === 'function') window.Notify('Could not start the installer. Please try again.', 'error', 5000);
    }
});

function getCachedServerCount() {
    try {
        const raw = localStorage.getItem('cache_server_count');
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() - item.timestamp < 600000) return item.data;
        localStorage.removeItem('cache_server_count');
    } catch (e) {}
    return null;
}

function setCachedServerCount(count) {
    try {
        localStorage.setItem('cache_server_count', JSON.stringify({ data: count, timestamp: Date.now() }));
    } catch (e) {}
}

async function updateMemberCount() {
    try {
        const cached = getCachedServerCount();
        const el = document.getElementById('discord-count');
        if (cached) {
            if (el) el.textContent = cached.toLocaleString();
            return;
        }

        const apiUrl = await Api.GetApiUrl();
        const res = await fetch(`${apiUrl}/discord/servercount`);
        const data = await res.json();
        if (el && data.count !== undefined) {
            el.textContent = data.count.toLocaleString();
            setCachedServerCount(data.count);
        }
    } catch (e) {
    }
}

updateMemberCount();
setInterval(updateMemberCount, 600000);

// Backend came back (visitor solved the connection check) – reload what failed.
if (window.SheldonBackend) {
    window.SheldonBackend.OnRecovered(() => {
        LoadProducts();
        updateMemberCount();
    });
}

// WorkInk reward claim, handled inline on the homepage.

// Read localStorage directly: currentUser lags behind Cloudflare, the token is enough.
function waitForLogin(timeoutMs) {
    const readToken = () => {
        try { const t = localStorage.getItem('discord_session'); if (t) return t; } catch (e) {}
        try { return window.DiscordAuth?.GetSessionToken?.() || null; } catch (e) { return null; }
    };
    return new Promise(resolve => {
        const start = Date.now();
        (function check() {
            const t = readToken();
            if (t) return resolve(t);
            if (Date.now() - start > timeoutMs) return resolve(null);
            setTimeout(check, 200);
        })();
    });
}

// Fire the homepage balance-gain animation once the balance chip is visible.
function playBalanceGain(added, oldBalance) {
    if (!(added > 0)) return;
    const poll = setInterval(() => {
        const el = document.querySelector('.user-balance');
        if (el && el.offsetParent !== null) {
            clearInterval(poll);
            setTimeout(() => { try { window.animateBalanceGain(added, oldBalance); } catch (e) {} }, 600);
        }
    }, 100);
    setTimeout(() => clearInterval(poll), 10000);
}

// Minimal, XSS-safe modal for the rare usage-reward free key.
function showRewardKey(key, product) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:2rem;max-width:420px;width:90%;text-align:center;';
    const title = document.createElement('div');
    title.textContent = 'Free key unlocked';
    title.style.cssText = 'font-size:1rem;font-weight:800;color:#22c55e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;';
    const sub = document.createElement('div');
    sub.textContent = product || 'License';
    sub.style.cssText = 'font-size:0.7rem;color:#666;margin-bottom:1.25rem;';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:1rem;';
    const input = document.createElement('input');
    input.type = 'text'; input.readOnly = true; input.value = key;
    input.style.cssText = 'flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:0.75rem 1rem;color:#c7b18f;font-size:0.8rem;letter-spacing:1px;outline:none;';
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'background:rgba(199,177,143,0.12);border:1px solid rgba(199,177,143,0.2);color:#c7b18f;border-radius:12px;padding:0 1rem;font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'padding:0.5rem 1.5rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#888;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;cursor:pointer;';
    wrap.append(input, copyBtn);
    box.append(title, sub, wrap, closeBtn);
    overlay.append(box);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(String(key)); copyBtn.textContent = 'Copied'; } catch (e) {}
    });
    if (window.confetti) { try { window.confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } }); } catch (e) {} }
}

async function claimWorkinkToken() {
    const params = new URLSearchParams(location.search);
    let token = params.get('token');

    if (token) {
        // Stash it so it survives a full-page login redirect, then strip it from the URL so a
        // refresh can't re-submit a single-use token.
        try { sessionStorage.setItem('pending_workink_token', token); } catch (e) {}
        history.replaceState({}, '', location.pathname + location.hash);
    } else {
        try { token = sessionStorage.getItem('pending_workink_token'); } catch (e) {}
    }
        // The token arrives with a leading space (" <uuid>") – trim it.
    if (token) token = token.trim();
    if (!token) return;

    let sessionToken = await waitForLogin(4000);
    if (!sessionToken) {
        if (typeof window.Notify === 'function') window.Notify('Log in with Discord to claim your reward.', 'info', 5000);
        try { window.DiscordAuth?.LoginPopup?.(); } catch (e) {}
        sessionToken = await waitForLogin(180000);
        if (!sessionToken) return;
    }

    // Strict device checks: the grant REQUIRES a complete identity (no silent
    // fallback). If a blocker eats the checks, the user is told to turn it off –
    // and the stashed token is KEPT so they can retry after whitelisting.
    let gate = null;
    try { gate = await ensureChecksOrNotify('the free-key claim'); } catch (e) { gate = null; }
    if (!gate || !gate.ok) return;

    // About to consume the token – clear the stash so it can't loop.
    try { sessionStorage.removeItem('pending_workink_token'); } catch (e) {}

    try {
        const apiUrl = await Api.GetApiUrl();

        // Prefer the loaded profile, else /discord/me (authoritative for this session).
        let discordId = window.DiscordAuth?.currentUser?.id || null;
        if (!discordId) {
            const startedAt = Date.now();
            while (!discordId && Date.now() - startedAt < 3000) {
                await new Promise(r => setTimeout(r, 150));
                discordId = window.DiscordAuth?.currentUser?.id || null;
            }
        }
        if (!discordId) {
            try {
                const meRes = await fetch(`${apiUrl}/discord/me`, {
                    headers: { Authorization: 'Bearer ' + sessionToken },
                    credentials: 'include'
                });
                const meData = await meRes.json();
                if (meData && meData.success && meData.user && meData.user.id) discordId = String(meData.user.id);
            } catch (e) {}
        }

        // Form-urlencoded keeps this a CORS simple request (no preflight).
        const body = new URLSearchParams();
        body.set('token', token);
        if (discordId) body.set('discordId', discordId);
        body.set('sessionToken', sessionToken);
        if (gate.deviceId) body.set('fingerprint', gate.deviceId);
        if (gate.browserFp) body.set('browserFp', gate.browserFp);

        const res = await fetch(`${apiUrl}/workink/generate`, { method: 'POST', body });
        const data = await res.json().catch(() => null);

        if (data && data.ok && data.license) {
            showRewardKey(data.license.key, data.license.product);
        } else if (data && data.ok && data.new_balance !== undefined) {
            const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
            const oldBalance = Math.max(0, data.new_balance - added);
            if (added > 0) playBalanceGain(added, oldBalance);
            if (data.capped && typeof window.Notify === 'function')
                window.Notify('Daily balance maxed – come back later.', 'info', 5000);
            else if (added <= 0 && typeof window.Notify === 'function')
                window.Notify('Balance updated.', 'success', 3000);
        } else if ((res.status === 429 || (data && data.rate_limited_until))) {
            if (typeof window.Notify === 'function')
                window.Notify((data && data.message) || 'Daily limit reached – try again later.', 'warning', 6000);
        } else if (data && data.message) {
            if (typeof window.Notify === 'function') window.Notify(data.message, 'error', 5000);
        }
    } catch (e) {
        if (typeof window.Notify === 'function') window.Notify('Could not claim your reward. Please try again.', 'error', 5000);
    }
}

claimWorkinkToken();

// LootLabs return pattern: checkout stores the click_id at start
// (sessionStorage sheldon_lootlabs_pending JSON {click_id, ts}, mirrored to
// localStorage), the wall returns to the homepage (bare homepage or
// /?lootlabs=done marker both work), and the homepage auto-claims with the
// same balance-gain animation. Server-side anti-bypass is untouched: claim
// still requires a postback-completed pending row. The modal Claim stays as fallback.

const LOOTLABS_PENDING_KEY = 'sheldon_lootlabs_pending';
const LOOTLABS_PENDING_TTL_MS = 6 * 60 * 60 * 1000;

// sessionStorage is the primary store; localStorage mirrors it for safety.
// Same-tab navigation keeps sessionStorage alive across the LootLabs
// round-trip. Server ownership checks still apply.
function parsePendingLootlabsValue(v) {
    if (v == null) return null;
    const raw = String(v).trim();
    if (!raw) return null;
    try {
        const o = JSON.parse(raw);
        if (o && typeof o.click_id === 'string' && o.click_id.trim()) {
            const ts = Number(o.ts);
            return { clickId: o.click_id.trim(), ts: Number.isFinite(ts) ? ts : 0 };
        }
    } catch (e) {}
    return { clickId: raw, ts: 0 };
}

function getPendingLootlabsInfo() {
    let parsed = null;
    try { parsed = parsePendingLootlabsValue(sessionStorage.getItem(LOOTLABS_PENDING_KEY)); } catch (e) {}
    if (!parsed) {
        try { parsed = parsePendingLootlabsValue(localStorage.getItem(LOOTLABS_PENDING_KEY)); } catch (e) {}
    }
    if (!parsed) return null;
    if (parsed.ts > 0 && Date.now() - parsed.ts > LOOTLABS_PENDING_TTL_MS) {
        return { clickId: parsed.clickId, ts: parsed.ts, stale: true };
    }
    return { clickId: parsed.clickId, ts: parsed.ts, stale: false };
}

function getPendingLootlabsClick() {
    const info = getPendingLootlabsInfo();
    return info && !info.stale ? info.clickId : (info ? info.clickId : null);
}

function clearPendingLootlabsClick() {
    try { sessionStorage.removeItem(LOOTLABS_PENDING_KEY); } catch (e) {}
    try { localStorage.removeItem(LOOTLABS_PENDING_KEY); } catch (e) {}
}

function isTerminalLootlabsMessage(msg) {
    return /expir|consumed|already[- ]claimed|invalid|unknown|not found/i.test(String(msg || ''));
}

function isLootlabsCompleted(statusData) {
    const st = (statusData && typeof statusData.status === 'string') ? statusData.status.toLowerCase() : '';
    return !!(statusData && statusData.ok &&
        (st === 'complete' || st === 'completed' || st === 'ready' || st === 'done' || st === 'verified'));
}

async function loadLootlabsIdentitySafe() {
    try {
        const mod = await import('../../util/device.js');
        if (mod && typeof mod.GetIdentityPayload === 'function') return await mod.GetIdentityPayload();
    } catch (e) {}
    return new URLSearchParams();
}

function stripLootlabsMarker() {
    try {
        const u = new URL(location.href);
        if (!u.searchParams.has('lootlabs')) return;
        u.searchParams.delete('lootlabs');
        history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + (u.hash ? u.hash : ''));
    } catch (e) {
        try { history.replaceState({}, '', location.pathname + location.hash); } catch (_) {}
    }
}

async function claimLootlabsReturn() {
    let params = null;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    const hasMarker = !!(params && params.has('lootlabs'));
    const pendingInfo = getPendingLootlabsInfo();
    if (pendingInfo && pendingInfo.stale) clearPendingLootlabsClick();
    const freshPending = (pendingInfo && !pendingInfo.stale) ? pendingInfo : null;
    // Trigger rule: marker present OR a fresh stored pending exists.
    if (!hasMarker && !freshPending) return;

    // Strip the marker first so a refresh can never re-submit (no infinite loop).
    if (hasMarker) stripLootlabsMarker();
    const clickId = freshPending ? freshPending.clickId : null;
    if (!clickId) return;

    let sessionToken = await waitForLogin(4000);
    if (!sessionToken) {
        if (typeof window.Notify === 'function') window.Notify('Log in with Discord to claim your reward.', 'info', 5000);
        try { window.DiscordAuth?.LoginPopup?.(); } catch (e) {}
        sessionToken = await waitForLogin(180000);
        if (!sessionToken) return;
    }

    let apiUrl = null;
    try { apiUrl = await Api.GetApiUrl(); } catch (e) { return; }
    if (!apiUrl) return;

    async function fetchLootlabsStatus() {
        const statusBody = new URLSearchParams();
        statusBody.set('sessionToken', sessionToken);
        statusBody.set('click_id', clickId);
        const statusRes = await fetch(`${apiUrl}/lootlabs/status`, { method: 'POST', body: statusBody });
        const statusData = await statusRes.json().catch(() => null);
        return { statusRes, statusData };
    }

    async function tryLootlabsClaim() {
        const claimBody = new URLSearchParams();
        claimBody.set('sessionToken', sessionToken);
        claimBody.set('click_id', clickId);
        try {
            const identity = await loadLootlabsIdentitySafe();
            for (const [k, v] of identity.entries()) claimBody.set(k, v);
        } catch (e) {}

        const res = await fetch(`${apiUrl}/lootlabs/claim`, { method: 'POST', body: claimBody });
        const data = await res.json().catch(() => null);

        if (data && data.ok && data.license) {
            clearPendingLootlabsClick();
            showRewardKey(data.license.key, data.license.product);
            return true;
        }
        if (data && data.ok && data.new_balance !== undefined) {
            clearPendingLootlabsClick();
            const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
            const oldBalance = Math.max(0, data.new_balance - added);
            if (added > 0) playBalanceGain(added, oldBalance);
            if (data.capped && typeof window.Notify === 'function')
                window.Notify('Daily balance maxed – come back later.', 'info', 5000);
            else if (typeof window.Notify === 'function')
                window.Notify(added > 0 ? `Reward claimed: +${added} balance.` : 'Balance updated.', 'success', 4000);
            return true;
        }
        if (res.status === 401 || res.status === 403) {
            if (typeof window.Notify === 'function')
                window.Notify((data && data.message) || 'Session expired – please log in again.', 'error', 5000);
            return true;
        }
        if (res.status === 429 || (data && data.rate_limited_until)) {
            if (typeof window.Notify === 'function')
                window.Notify((data && data.message) || 'Daily limit reached – try again later.', 'warning', 6000);
            return true;
        }
        if (data && isTerminalLootlabsMessage(data.message)) {
            clearPendingLootlabsClick();
            if (typeof window.Notify === 'function') window.Notify(data.message, 'info', 5000);
            return true;
        }
        if (data && data.message) {
            if (typeof window.Notify === 'function') window.Notify(data.message, 'error', 5000);
            return true;
        }
        return false;
    }

    // Returns 'completed' | 'terminal' | 'auth-error' | 'rate-limited' | 'pending' | 'transient'.
    async function checkOnce() {
        let statusRes = null;
        let statusData = null;
        try {
            ({ statusRes, statusData } = await fetchLootlabsStatus());
        } catch (e) { return 'transient'; }
        if (isLootlabsCompleted(statusData)) return 'completed';
        if (statusRes && (statusRes.status === 401 || statusRes.status === 403)) {
            if (typeof window.Notify === 'function')
                window.Notify((statusData && statusData.message) || 'Session expired – please log in again.', 'error', 5000);
            return 'auth-error';
        }
        if (statusRes && (statusRes.status === 429 || (statusData && statusData.rate_limited_until))) {
            if (typeof window.Notify === 'function')
                window.Notify((statusData && statusData.message) || 'Daily limit reached – try again later.', 'warning', 6000);
            return 'rate-limited';
        }
        if (statusData && statusData.ok === false && isTerminalLootlabsMessage(statusData.message)) {
            clearPendingLootlabsClick();
            if (typeof window.Notify === 'function') window.Notify(statusData.message, 'error', 5000);
            return 'terminal';
        }
        if (statusData && statusData.ok === false && statusData.message) {
            if (typeof window.Notify === 'function') window.Notify(statusData.message, 'error', 5000);
            return 'terminal';
        }
        return 'pending';
    }

    try {
        const first = await checkOnce();
        if (first === 'completed') {
            try { await tryLootlabsClaim(); } catch (e) {
                if (typeof window.Notify === 'function') window.Notify('Could not claim your reward. Please try again.', 'error', 5000);
            }
            return;
        }
        if (first !== 'pending' && first !== 'transient') return;
        // Still pending: poll every 3s up to ~90s, then stop silently. Only the
        // marker return shows one gentle waiting notice; bare-homepage polling
        // stays silent so abandoned flows never nag on refresh.
        if (hasMarker && typeof window.Notify === 'function') {
            try { window.Notify('Waiting for LootLabs confirmation – keep this tab open a moment.', 'info', 6000); } catch (e) {}
        }
        const MAX_POLLS = 30;
        for (let i = 0; i < MAX_POLLS; i++) {
            await new Promise(r => setTimeout(r, 3000));
            let outcome = 'transient';
            try { outcome = await checkOnce(); } catch (e) { outcome = 'transient'; }
            if (outcome === 'completed') {
                try { await tryLootlabsClaim(); } catch (e) {
                    if (typeof window.Notify === 'function') window.Notify('Could not claim your reward. Please try again.', 'error', 5000);
                }
                return;
            }
            if (outcome !== 'pending' && outcome !== 'transient') return;
        }
    } catch (e) {
        if (typeof window.Notify === 'function') window.Notify('Could not claim your reward. Please try again.', 'error', 5000);
    }
}

claimLootlabsReturn();