// render.js
import DiscordApi from "./api.js";
import { GetApiUrl, discord_client_id, SetCookie } from "../../global.js";

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

    // Clicking avatar container logs out
    container.addEventListener('click', () => {
        DiscordRender.LoginLogic();
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
        overlay.innerHTML = `<div>Logging in with Discord... Please wait</div>`;
        document.body.appendChild(overlay);
    },

    RemoveLoginOverlay() {
        const overlay = document.getElementById("login-overlay");
        if (overlay) overlay.remove();
    },

    async LoginDiscord() {
        this.ShowLoginOverlay();

        const redirectUri = encodeURIComponent(`${await GetApiUrl()}sheldon/discord/callback`);
        const discordUrl = `https://discord.com/oauth2/authorize?client_id=${discord_client_id}&response_type=code&redirect_uri=${redirectUri}&scope=identify`;

        const loginTab = window.open(discordUrl, "_blank");

        const loginPromise = new Promise((resolve, reject) => {
            const handleMessage = (evt) => {
                try {
                    const msg = evt.data;
                    if (msg && msg.loggedIn && msg.session) {
                        try {
                            SetCookie('session', msg.session, { days: 3650, path: '/' });
                        } catch {
                            document.cookie = `session=${msg.session}; Path=/; Max-Age=${3650*24*60*60}`;
                        }

                        window.removeEventListener('message', handleMessage);
                        this.RemoveLoginOverlay();
                        try { loginTab?.close(); } catch {}

                        resolve(msg.session);
                    }
                } catch {}
            };

            window.addEventListener('message', handleMessage);

            const fallbackInterval = setInterval(() => {
                if (!loginTab || loginTab.closed) {
                    clearInterval(fallbackInterval);
                    window.removeEventListener('message', handleMessage);
                    this.RemoveLoginOverlay();
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
        const token = DiscordApi.GetSessionToken();

        // LOGOUT
        if (token) {
            DiscordApi.DeleteSessionToken();
            DiscordApi.ClearSessionCache();
            ClearAuthUser();
            SetAuthButtonText(false);
            return;
        }

        // LOGIN
        await this.LoginDiscord();
        const user = await DiscordApi.GetSessionInfo(true);
        if (user) {
            SetAuthUsername(user);
            SetAuthButtonText(true);
            // Update checkout status if on checkout page
            if (window.checkLoginStatus) {
                window.checkLoginStatus();
            }
        }
    }
};

export default DiscordRender;
window.DiscordRender = DiscordRender;

// Auto-run on page load
(async () => {
    const token = DiscordApi.GetSessionToken();
    if (!token) return ClearAuthUser();

    try {
        const user = await DiscordApi.GetSessionInfo();
        if (user) SetAuthUsername(user);
        else ClearAuthUser();
    } catch {
        ClearAuthUser();
    }

    SetAuthButtonText(!!token);
})();
