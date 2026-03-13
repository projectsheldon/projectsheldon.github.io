import Api from "../util/backend.js";

const discordBtn = document.getElementById('discord-login-btn');
const userProfileTrigger = document.getElementById('user-profile-trigger');

let currentUser = null;

function getSessionToken() {
    return localStorage.getItem('discord_session');
}

function setSessionToken(token) {
    localStorage.setItem('discord_session', token);
}

function clearSessionToken() {
    localStorage.removeItem('discord_session');
}

window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'discord_session') {
        setSessionToken(event.data.token);
        checkAuthStatus();
    }
});

async function checkAuthStatus() {
    const token = getSessionToken();
    
    if (!token) {
        updateUIForLoggedOut();
        return;
    }
    
    const apiUrl = await Api.GetApiUrl();
    
    try {
        const response = await fetch(`${apiUrl}/discord/me?token=${encodeURIComponent(token)}`, {
            method: 'GET',
            mode: 'cors'
        });
        
        const data = await response.json();
        
        if (data.success && data.loggedIn) {
            currentUser = data.user;
            updateUIForLoggedIn(data.user);
        } else {
            currentUser = null;
            clearSessionToken();
            updateUIForLoggedOut();
        }
    } catch (error) {
        updateUIForLoggedOut();
    }
}

function updateUIForLoggedIn(user) {
    if (userProfileTrigger) {
        userProfileTrigger.classList.remove('hidden');
        
        const nameEl = userProfileTrigger.querySelector('.user-name');
        if (nameEl) {
            nameEl.textContent = user.globalName || user.username;
        }
        
        const avatarEl = userProfileTrigger.querySelector('.user-avatar');
        const defaultAvatarEl = userProfileTrigger.querySelector('.default-avatar');
        
        if (avatarEl && user.avatar) {
            avatarEl.src = user.avatar;
            avatarEl.classList.remove('hidden');
            if (defaultAvatarEl) defaultAvatarEl.classList.add('hidden');
        }
    }
    
    if (discordBtn) {
        discordBtn.classList.remove('hidden');
        discordBtn.className = 'bg-white text-black font-black px-5 py-2 rounded-xl text-[0.65rem] uppercase tracking-wider transition-all hover:bg-[#c7b18f] flex items-center justify-center';
        discordBtn.style.display = 'flex';
        discordBtn.style.justifyContent = 'center';
        discordBtn.style.alignItems = 'center';
        
        const loginTxt = discordBtn.querySelector('#discord-login-txt');
        if (loginTxt) {
            loginTxt.textContent = 'Logout';
            loginTxt.classList.remove('hidden');
        }
        const discordIcon = discordBtn.querySelector('svg');
        if (discordIcon) {
            discordIcon.remove();
        }
    }
}

function updateUIForLoggedOut() {
    currentUser = null;
    
    if (userProfileTrigger) {
        userProfileTrigger.classList.add('hidden');
    }
    if (discordBtn) {
        discordBtn.classList.remove('hidden');
        discordBtn.className = 'btn-discord px-5 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all';
        
        const loginTxt = discordBtn.querySelector('#discord-login-txt');
        if (loginTxt) loginTxt.textContent = 'Login';
    }
}

async function login() {
    const width = 600;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    const apiUrl = await Api.GetApiUrl();
    
    const clientId = "1429915624653459657";
    const redirectUri = encodeURIComponent(`${apiUrl}/discord/callback`);
    const scope = "identify";
    
    const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    
    const popup = window.open(oauthUrl, 'Discord Login', `width=${width},height=${height},left=${left},top=${top}`);
    
    const checkClosed = setInterval(() => {
        if (popup.closed) {
            clearInterval(checkClosed);
            checkAuthStatus();
        }
    }, 500);
}

function logout() {
    clearSessionToken();
    currentUser = null;
    updateUIForLoggedOut();
}

if (discordBtn) {
    discordBtn.addEventListener('click', function() {
        if (currentUser) {
            logout();
        } else {
            login();
        }
    });
}

if (userProfileTrigger) {
    userProfileTrigger.addEventListener('click', showLicensePopup);
} else {
    discordBtn.addEventListener('dblclick', showLicensePopup);
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);

async function showLicensePopup() {
    const token = getSessionToken();
    if (!token) return;
    
    const apiUrl = await Api.GetApiUrl();
    
    try {
        const response = await fetch(`${apiUrl}/license/my?token=${encodeURIComponent(token)}`, {
            method: 'GET',
            mode: 'cors'
        });
        
        const data = await response.json();
        
        if (!data.success) {
            alert(data.message || 'Failed to load licenses');
            return;
        }
        
        let licenseHtml = '<div style="color: white; padding: 20px;">';
        licenseHtml += '<h2 style="margin: 0 0 20px 0;">Your Licenses</h2>';
        
        if (data.licenses.length === 0) {
            licenseHtml += '<p>No licenses found.</p>';
        } else {
            data.licenses.forEach(lic => {
                const status = lic.banned ? 'Banned' : (lic.disabled ? 'Disabled' : (lic.expires_at === -1 ? 'Lifetime' : new Date(lic.expires_at).toLocaleDateString()));
                licenseHtml += `
                    <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #c7b18f;">${lic.product || 'Unknown Product'}</div>
                        <div style="font-size: 0.8em; color: #888;">Key: ${lic.key}</div>
                        <div style="font-size: 0.8em; color: #888;">Status: ${status}</div>
                    </div>
                `;
            });
        }
        licenseHtml += '</div>';
        
        const popup = window.open('', 'Licenses', 'width=400,height=500');
        popup.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Your Licenses</title>
                <style>
                    body { 
                        background: #1e1e1e; 
                        margin: 0; 
                        font-family: system-ui, sans-serif;
                    }
                    .close-btn {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: #333;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    .close-btn:hover { background: #444; }
                </style>
            </head>
            <body>
                <button class="close-btn" onclick="window.close()">Close</button>
                ${licenseHtml}
            </body>
            </html>
        `);
        popup.document.close();
        
    } catch (error) {
        alert('Failed to load licenses');
    }
}
