// render.js
import DiscordApi from "./api.js";
import AuthApi from "../auth/api.js";
import { GetApiUrl, discord_client_id } from "../../global.js";

/**
 * Format license expiration date
 * @param {number} expiresAt - Unix timestamp or -1 for lifetime
 * @returns {string}
 */
function FormatLicenseExpiry(expiresAt) {
    if (expiresAt === -1) return "Lifetime";
    
    const date = new Date(expiresAt);
    const now = new Date();
    
    if (date < now) return "Expired";
    
    const diffMs = date - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
        const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
        return `${diffHours}h remaining`;
    } else if (diffDays <= 30) {
        return `${diffDays} days remaining`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * Show licenses modal
 * @param {Object} user - Discord user object
 */
async function ShowLicensesModal(user) {
    // Remove existing modal if any
    const existing = document.getElementById('licenses-modal');
    if (existing) existing.remove();

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'licenses-modal';
    overlay.style = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'JetBrains Mono', monospace;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style = `
        background: #0a0a0a;
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 0 40px rgba(59, 130, 246, 0.2);
    `;

    // Header
    const header = document.createElement('div');
    header.style = `
        padding: 20px;
        border-bottom: 1px solid rgba(59, 130, 246, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

    // User info in header
    const userInfo = document.createElement('div');
    userInfo.style = 'display: flex; align-items: center; gap: 12px;';
    
    let avatarSrc = "https://cdn.discordapp.com/embed/avatars/0.png";
    if (user.avatar) avatarSrc = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    
    userInfo.innerHTML = `
        <img src="${avatarSrc}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #3b82f6;">
        <div>
            <div style="color: white; font-weight: bold;">${user.username || 'User'}</div>
            <div style="color: #6b7280; font-size: 12px;">Your Licenses</div>
        </div>
    `;

    // Close and logout buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style = 'display: flex; gap: 8px;';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style = `
        background: transparent;
        border: none;
        color: #6b7280;
        font-size: 20px;
        cursor: pointer;
        padding: 8px;
        line-height: 1;
    `;
    closeBtn.onclick = () => overlay.remove();

    buttonsContainer.appendChild(closeBtn);

    header.appendChild(userInfo);
    header.appendChild(buttonsContainer);

    // Content area
    const content = document.createElement('div');
    content.style = `
        padding: 20px;
        overflow-y: auto;
        flex: 1;
    `;
    
    // Add custom scrollbar styling
    content.style.scrollbarWidth = 'thin';
    content.style.scrollbarColor = '#3b82f6 #1f2937';
    
    // Inject scrollbar CSS
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
        #licenses-modal-content::-webkit-scrollbar {
            width: 8px;
        }
        #licenses-modal-content::-webkit-scrollbar-track {
            background: #1f2937;
            border-radius: 4px;
        }
        #licenses-modal-content::-webkit-scrollbar-thumb {
            background: #3b82f6;
            border-radius: 4px;
        }
        #licenses-modal-content::-webkit-scrollbar-thumb:hover {
            background: #2563eb;
        }
    `;
    document.head.appendChild(scrollbarStyle);
    content.id = 'licenses-modal-content';

    // Loading state
    content.innerHTML = '<div style="color: #3b82f6; text-align: center; padding: 40px;">Loading licenses...</div>';

// Fetch licenses (pass discordId for server-side validation)
    let licenses = [];
    try {
        const data = await AuthApi.GetMyLicenses(user.id);
        licenses = data?.licenses || [];
    } catch (e) {
        console.error("Failed to fetch licenses:", e);
    }

    // Render licenses
    if (licenses.length === 0) {
        content.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                <div style="color: #6b7280; margin-bottom: 8px;">No licenses found</div>
            </div>
        `;
    } else {
        const licensesList = document.createElement('div');
        licensesList.style = 'display: flex; flex-direction: column; gap: 12px;';

        for (const license of licenses) {
            const expiry = FormatLicenseExpiry(license.expires_at);
            
            // Check if license is expired
            const isExpired = license.expires_at !== -1 && new Date(license.expires_at) < new Date();
            
            // Different styling for expired vs active licenses - expired is transparent/faded
            const itemStyle = isExpired ? `
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(59, 130, 246, 0.1);
                border-radius: 6px;
                padding: 16px;
                text-align: center;
                opacity: 0.5;
            ` : `
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(59, 130, 246, 0.2);
                border-radius: 6px;
                padding: 16px;
                text-align: center;
            `;

            // Expiry text styling - red for expired
            const expiryStyle = isExpired ? `
                color: #ef4444;
                font-size: 13px;
                font-weight: bold;
            ` : `
                color: rgba(156, 163, 175, 0.6);
                font-size: 13px;
            `;

            const licenseKeyColor = isExpired ? '#60a5fa' : '#3b82f6';
            const buttonStyle = isExpired ? `
                background: rgba(59, 130, 246, 0.05);
                border: 1px solid rgba(59, 130, 246, 0.1);
                color: #60a5fa;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            ` : `
                background: rgba(59, 130, 246, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.3);
                color: #3b82f6;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
            `;

            const licenseItem = document.createElement('div');
            licenseItem.style = itemStyle;

            licenseItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                        <div style="font-family: monospace; color: ${licenseKeyColor}; font-size: 14px; word-break: break-all; margin-bottom: 4px;">${license.license_key}</div>
                        <div style="${expiryStyle}">
                            ${expiry}
                        </div>
                    </div>
                    <button class="copy-license-btn" data-key="${license.license_key}" style="${buttonStyle}">Copy Key</button>
                </div>
            `;

            licensesList.appendChild(licenseItem);
        }

        content.innerHTML = '';
        content.appendChild(licensesList);

        // Add copy functionality
        content.querySelectorAll('.copy-license-btn').forEach(btn => {
            btn.onclick = async () => {
                const key = btn.dataset.key;
                try {
                    await navigator.clipboard.writeText(key);
                    const originalText = btn.textContent;
                    const originalBackground = btn.style.background;
                    const originalBorder = btn.style.borderColor;
                    const originalColor = btn.style.color;
                    
                    btn.textContent = 'Copied!';
                    btn.style.background = 'rgba(34, 197, 94, 0.2)';
                    btn.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                    btn.style.color = '#22c55e';
                    
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = originalBackground;
                        btn.style.borderColor = originalBorder;
                        btn.style.color = originalColor;
                    }, 2000);
                } catch (e) {
                    console.error('Failed to copy:', e);
                }
            };
            
            // Add hover effect
            btn.addEventListener('mouseenter', () => {
                if (!btn.textContent.includes('Copied')) {
                    btn.style.transform = 'scale(1.05)';
                    btn.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.3)';
                }
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
            });
        });
    }

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    document.body.appendChild(overlay);
}

/**
 * Update auth button text
 * @param {boolean} loggedIn
 */
function SetAuthButtonText(loggedIn) {
    const authBtn = document.getElementById('auth-btn');
    if (!authBtn) return;
    authBtn.innerText = loggedIn ? 'SIGN OUT' : 'LOGIN';
}

/**
 * Display user's avatar + username in the topbar
 * @param {Object} user
 */
function SetAuthUsername(user) {
    const authBtn = document.getElementById('auth-btn');
    if (!authBtn) return;

    ClearAuthUser(); // remove old info if exists

    // Container for avatar + username
    const container = document.createElement('div');
    container.id = 'auth-user-info';
    container.className = 'flex items-center gap-3 mr-4 animate-fadeIn cursor-pointer';

    // Avatar
    let avatarSrc = "https://cdn.discordapp.com/embed/avatars/0.png";
    if (user.avatar_url) avatarSrc = user.avatar_url;
    else if (user.avatar && user.id)
        avatarSrc = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;

    const img = document.createElement('img');
    img.src = avatarSrc;
    img.alt = user.username;
    img.className = "w-8 h-8 rounded-full border border-hacker-blue/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]";

    // Username
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-sm font-bold text-gray-200 hidden sm:block';
    nameSpan.textContent = user.username || "User";

    // Add to container
    container.appendChild(img);
    container.appendChild(nameSpan);

    // Insert before the auth button
    authBtn.parentNode.insertBefore(container, authBtn);

    // Store user globally for the modal
    window._currentDiscordUser = user;

    // Clicking avatar container shows licenses modal (with logout option inside)
    container.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ShowLicensesModal(window._currentDiscordUser);
    });
}

/**
 * Remove user info from topbar
 */
function ClearAuthUser() {
    const el = document.getElementById('auth-user-info');
    if (el) el.remove();
}

/**
 * Discord login UI & logic
 */
const DiscordRender = {
    ShowLoginOverlay() {
        const overlay = document.createElement("div");
        overlay.id = "login-overlay";
        overlay.style = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.9);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: monospace;
            color: white;
            font-size: 1.2rem;
        `;
        const text = document.createElement("div");
        text.textContent = "Logging in with Discord... Please wait";
        overlay.appendChild(text);
        document.body.appendChild(overlay);
    },

    RemoveLoginOverlay() {
        const overlay = document.getElementById("login-overlay");
        if (overlay) overlay.remove();
    },

    async LoginDiscord() {
        this.ShowLoginOverlay();

        const apiBase = await GetApiUrl();
        const redirectUri = encodeURIComponent(`${apiBase}sheldon/discord/callback`);
        const apiOrigin = new URL(apiBase).origin;
        const discordUrl = `https://discord.com/oauth2/authorize?client_id=${discord_client_id}&response_type=code&redirect_uri=${redirectUri}&scope=identify`;

        const loginTab = window.open(discordUrl, "_blank");

        const loginPromise = new Promise((resolve) => {
            const handleMessage = (evt) => {
                try {
                    const msg = evt.data;
                    if (evt.origin !== apiOrigin) return;
                    if (msg && msg.loggedIn) {
                        if (typeof msg.session === "string" && msg.session.length > 0) {
                            try { sessionStorage.setItem("session", msg.session); } catch (err) { }
                            try { sessionStorage.setItem("session_logged_in_at", String(Date.now())); } catch (err) { }
                        }
                        window.removeEventListener('message', handleMessage);
                        this.RemoveLoginOverlay();
                        try { loginTab?.close(); } catch {}

                        resolve(true);
                        window.location.reload();
                    }
                } catch {}
            };

            window.addEventListener('message', handleMessage);

            const fallbackInterval = setInterval(() => {
                if (!loginTab || loginTab.closed) {
                    clearInterval(fallbackInterval);
                    window.removeEventListener('message', handleMessage);
                    this.RemoveLoginOverlay();
                    (async () => {
                        const user = await DiscordApi.GetSessionInfo(true).catch(() => null);
                        if (user?.id) {
                            try { sessionStorage.setItem("session_logged_in_at", String(Date.now())); } catch (err) { }
                            resolve(true);
                            window.location.reload();
                            return;
                        }
                        resolve(false);
                    })();
                }
            }, 500);
        });

        const session = await loginPromise;

        try {
            const user = await DiscordApi.GetSessionInfo(true);
            if (user) SetAuthUsername(user);
        } catch {}

        return session;
    },

    /**
     * Handles login/logout button click
     */
    async LoginLogic() {
        const user = await DiscordApi.GetSessionInfo().catch(() => null);

        // LOGOUT
        if (user?.id) {
            await DiscordApi.DeleteSessionToken();
            return;
        }

        // LOGIN
        await this.LoginDiscord();
    }
};

export default DiscordRender;

// Auto-run on page load
(async () => {
    const user = await DiscordApi.GetSessionInfo().catch(() => null);
    if (!user?.id) {
        ClearAuthUser();
        SetAuthButtonText(false);
        return;
    }

    try {
        SetAuthUsername(user);
    } catch {
        ClearAuthUser();
    }

    SetAuthButtonText(true);
})();
