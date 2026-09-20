// License page script
import Api from '../../util/backend.js';
import { DiscordAuth } from '../../discord/auth.js';
import { ensureChecksOrNotify } from '../../util/guard.js';

let keys = [];

const copyIcon = `<svg class="w-4 h-4 copy-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="w-4 h-4 check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

function copyKey(btn, val)
{
    const el = document.createElement('textarea');
    el.value = val;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    btn.classList.add('success');

    setTimeout(() =>
    {
        btn.classList.remove('success');
    }, 1200);
}
window.copyKey = copyKey;

function render()
{
    const list = document.getElementById('license-list');
    if(!list) return;

    if(keys.length === 0)
    {
        list.innerHTML = '<p class="text-neutral-500">No licenses found.</p>';
        return;
    }
    // Safe render: no user value touches HTML parsing.
    list.innerHTML = '';
    keys.forEach(item =>
    {
        const wrapper = document.createElement('div');
        wrapper.className = 'license-item';

        const info = document.createElement('div');
        info.style.minWidth = '0';

        const keyText = document.createElement('div');
        keyText.className = 'key-text truncate';
        keyText.textContent = item.key;

        const tier = document.createElement('span');
        tier.className = 'tier-label';
        tier.textContent = item.tier || item.product || 'License';

        info.appendChild(keyText);
        info.appendChild(tier);

        const copyBtn = document.createElement('div');
        copyBtn.className = 'copy-btn';
        copyBtn.title = 'Copy Key';
        copyBtn.dataset.key = item.key;
        copyBtn.innerHTML = copyIcon + checkIcon;
        copyBtn.addEventListener('click', function() { copyKey(this, this.dataset.key); });

        wrapper.appendChild(info);
        wrapper.appendChild(copyBtn);
        list.appendChild(wrapper);
    });
}

function renderRateLimited(list, message, until)
{
    function fmt(ms)
    {
        const s = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        if(h > 0) return h + 'h ' + m + 'm';
        if(m > 0) return m + 'm ' + sec + 's';
        return sec + 's';
    }
    function paint()
    {
        const remaining = until ? (until - Date.now()) : 0;
        const countdown = (until && remaining > 0)
            ? '<div style="font-size:34px;font-weight:800;color:#e8b04b;letter-spacing:-0.02em;margin:10px 0 2px;">' + fmt(remaining) + '</div>'
              + '<div style="font-size:12px;color:rgba(255,255,255,0.4);">until you can earn again</div>'
            : '';
        list.innerHTML =
            '<div style="text-align:center;padding:8px 4px;">'
          +   '<div style="font-size:18px;font-weight:800;color:#e8b04b;margin-bottom:8px;">Daily limit reached</div>'
          +   '<div style="font-size:13px;color:rgba(255,255,255,0.55);line-height:1.5;max-width:340px;margin:0 auto;">' + window.escapeHtml(message) + '</div>'
          +   countdown
          + '</div>';
    }
    paint();
    if(until)
    {
        const iv = setInterval(() =>
        {
            if(Date.now() >= until) { clearInterval(iv); paint(); return; }
            paint();
        }, 1000);
    }
}

async function loadLicenses()
{
    const urlParams = new URLSearchParams(window.location.search);
    const list = document.getElementById('license-list');

    // Trim: WorkInk token arrives with a leading space.
    const token = (urlParams.get('token') || '').trim();
    if(token)
    {
        try
        {
            let discordId = window.DiscordAuth?.currentUser?.id || null;
            let sessionToken = localStorage.getItem('discord_session');

            if(!sessionToken)
            {
                list.innerHTML = '<p class="text-neutral-500">Please log in with Discord first to claim your free license.</p>';
                return;
            }

            if(!discordId)
            {
                const sessionToken = localStorage.getItem('discord_session');
                if(sessionToken)
                {
                    const user = window.DiscordAuth?.currentUser || await DiscordAuth.GetUser();
                    if(user)
                    {
                        discordId = user.id;
                    }
                }
            }

            const apiUrl = await Api.GetApiUrl();

            // Strict device checks: the grant REQUIRES a complete identity. If a
            // blocker eats the checks the user is told to turn it off — and the
            // ?token= stays in the URL so they can retry after whitelisting.
            let gate = null;
            try { gate = await ensureChecksOrNotify('the free-key claim'); } catch(e) { gate = null; }
            if(!gate || !gate.ok)
            {
                list.innerHTML = '<p class="text-neutral-500">Turn off your ad blocker, then refresh this page to claim your reward.</p>';
                return;
            }

            // Simple request: avoids preflight so clearance cookie is sent.
            const genBody = new URLSearchParams();
            genBody.set('token', token);
            if(discordId) genBody.set('discordId', discordId);
            genBody.set('sessionToken', sessionToken);
            if(gate.deviceId) genBody.set('fingerprint', gate.deviceId);
            if(gate.browserFp) genBody.set('browserFp', gate.browserFp);

            const response = await fetch(`${apiUrl}/workink/generate`, {
                method: 'POST',
                body: genBody
            });
            const data = await response.json();
            if(data.ok && data.license)
            {
                keys = [ { key: data.license.key, tier: data.license.product } ];
                if(data.source === 'usage_reward' && data.usage)
                {
                    sessionStorage.setItem('usage_reward', '1');
                    sessionStorage.setItem('usage_seconds', String(data.usage.seconds || 0));
                    sessionStorage.setItem('usage_threshold', String(data.usage.threshold_seconds || 0));
                }
            } else if(data.ok && data.new_balance !== undefined)
            {
                const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
                const oldBalance = data.new_balance - added;
                sessionStorage.setItem('balance_added', String(added));
                sessionStorage.setItem('balance_old', String(Math.max(0, oldBalance)));
                if(data.usage)
                {
                    sessionStorage.setItem('usage_seconds', String(data.usage.seconds || 0));
                    sessionStorage.setItem('usage_threshold', String(data.usage.threshold_seconds || 0));
                }
                if(data.capped)
                {
                    list.innerHTML = '<p class="text-neutral-500">Max balance of 3.0 reached. Spend some balance first!</p>';
                    setTimeout(() => { window.location.href = '/?balance=' + added; }, 2000);
                    return;
                }
                window.location.href = '/?balance=' + added;
                return;
            } else
            {
                keys = [];
                if(data.message === 'Not logged in' || data.message === 'Invalid session')
                {
                    list.innerHTML = '<p class="text-neutral-500">Please log in with Discord first to claim your free license.</p>';
                    return;
                }
                if(response.status === 429 || data.rate_limited_until)
                {
                    renderRateLimited(list, data.message || 'You have reached your daily balance limit. Come back later.', data.rate_limited_until || 0);
                    return;
                }
                if(data.message)
                {
                    list.innerHTML = `<p class="text-neutral-500">${window.escapeHtml(data.message)}</p>`;
                    return;
                }
            }
        } catch(e)
        {
            console.error('Failed to generate license:', e);
            keys = [];
        }
        render();
        return;
    }

    const singleKey = urlParams.get('key');
    if(singleKey)
    {
        const colonIdx = singleKey.indexOf(':');
        if(colonIdx !== -1)
        {
            const key = singleKey.substring(0, colonIdx).trim();
            const tier = singleKey.substring(colonIdx + 1).trim();
            keys = [{ key, tier: tier || 'License' }];
        }
        else
        {
            keys = [{ key: singleKey.trim(), tier: 'License' }];
        }
        render();
        return;
    }

    const showKeys = urlParams.get('showKeys');
    if(showKeys)
    {
        try
        {
            const keyList = showKeys.split(',');
            keys = keyList.map(entry =>
            {
                const colonIdx = entry.indexOf(':');
                if(colonIdx === -1)
                {
                    const key = entry.trim();
                    return { key: key, tier: 'License' };
                }
                
                const key = entry.substring(0, colonIdx).trim();
                const tier = entry.substring(colonIdx + 1).trim();
                
                return { key: key, tier: tier || 'License' };
            })
            .filter(item => item.key.length > 0 && item.key.length <= 128);
        }
        catch(e)
        {
            keys = [];
        }
        
        render();
        return;
    }

    render();
}

function renderUsageProgress()
{
    const seconds = parseFloat(sessionStorage.getItem('usage_seconds') || '0');
    const threshold = parseFloat(sessionStorage.getItem('usage_threshold') || '0');
    if(!threshold || threshold <= 0) return;
    const list = document.getElementById('license-list');
    if(!list) return;

    const pct = Math.min(100, Math.round((seconds / threshold) * 100));
    const hours = Math.floor(seconds / 3600);
    const thresholdHours = Math.round(threshold / 3600);
    const rewarded = sessionStorage.getItem('usage_reward') === '1';
    const remaining = Math.max(0, thresholdHours - hours);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:20px;padding:16px 18px;background:rgba(199,177,143,0.05);border:1px solid rgba(199,177,143,0.2);border-radius:12px;text-align:left';
    wrap.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.4);margin-bottom:8px">
            <span>Weekly usage</span>
            <span style="color:#c7b18f;font-weight:700">${window.escapeHtml(hours + ' / ' + thresholdHours + ' hours')}</span>
        </div>
        <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#c7b18f,#e2c9a1);border-radius:3px;transition:width 0.5s ease"></div>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:8px;text-align:center">
            ${rewarded ? 'Free key claimed. Counter reset — use Sheldon another ' + thresholdHours + ' hours this week for the next.' : (remaining > 0 ? 'Use Sheldon ' + remaining + ' more hour' + (remaining === 1 ? '' : 's') + ' this week to earn a free key without watching an ad.' : 'Threshold met! Your next ad grants a free key.')}
        </div>
    `;
    list.appendChild(wrap);
}

// Confetti on license success
function triggerConfetti()
{
    if(typeof confetti !== 'undefined')
    {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#bb86fc', '#c7b18f', '#5865F2', '#22c55e', '#fbbf24']
        });
    }
}

// Initialize
window.onload = () =>
{
    if(typeof initParticles === 'function')
    {
        initParticles();
    }
    loadLicenses();
};

// Trigger confetti after render if success
const originalRender = render;
render = function()
{
    originalRender.apply(this, arguments);
    if(keys.length > 0)
    {
        setTimeout(triggerConfetti, 500);
    }
};

const originalLoadLicenses = loadLicenses;
loadLicenses = async function()
{
    await originalLoadLicenses.apply(this, arguments);
    renderUsageProgress();
    if(keys.length > 0)
    {
        setTimeout(triggerConfetti, 800);
    }
};