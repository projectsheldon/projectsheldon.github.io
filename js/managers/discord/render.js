// render.js
import DiscordApi from "./api.js";
import { GetApiUrl, discord_client_id } from "../../global.js";

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
