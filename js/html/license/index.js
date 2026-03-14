// License page script

let keys = [];

const copyIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`;
const checkIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;

function copyKey(btn, val) {
    const el = document.createElement('textarea');
    el.value = val;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    btn.innerHTML = checkIcon;
    btn.classList.add('success');

    setTimeout(() => {
        btn.innerHTML = copyIcon;
        btn.classList.remove('success');
    }, 2000);
}

function render() {
    const list = document.getElementById('license-list');
    if (!list) return;
    
    if (keys.length === 0) {
        list.innerHTML = '<p class="text-neutral-500">No licenses found.</p>';
        return;
    }
    list.innerHTML = keys.map(item => `
        <div class="license-item">
            <div style="min-width: 0;">
                <div class="key-text truncate">${item.key}</div>
                <span class="tier-label">${item.tier || item.product || 'License'}</span>
            </div>
            <div class="copy-btn" title="Copy Key" onclick="copyKey(this, '${item.key}')">
                ${copyIcon}
            </div>
        </div>
    `).join('');
}

async function loadLicenses() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const showKeys = urlParams.get('showKeys');
    if (showKeys) {
        const keyList = showKeys.split(',').map(k => k.trim()).filter(k => k);
        keys = keyList.map(key => ({ key: key, tier: 'License' }));
        render();
        return;
    }

    const token = urlParams.get('token');
    if (token) {
        try {
            let discordId = window.DiscordAuth?.currentUser?.id || null;

            if (!discordId) {
                const sessionToken = localStorage.getItem('discord_session');
                if (sessionToken) {
                    try {
                        const userRes = await fetch('http://localhost:3350/discord/me?token=' + encodeURIComponent(sessionToken));
                        const userData = await userRes.json();
                        if (userData.success && userData.user) {
                            discordId = userData.user.id;
                        }
                    } catch (e) {
                        console.log('Could not fetch user:', e);
                    }
                }
            }

            const response = await fetch('http://localhost:3350/workink/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, discordId: discordId })
            });
            const data = await response.json();
            if (data.ok && data.license) {
                keys = [{ key: data.license.key, tier: data.license.product }];
            } else {
                keys = [];
            }
        } catch (e) {
            console.error('Failed to generate license:', e);
            keys = [];
        }
        render();
        return;
    }

    render();
}

// Initialize
window.onload = () => {
    if (typeof initParticles === 'function') {
        initParticles();
    }
    loadLicenses();
};
