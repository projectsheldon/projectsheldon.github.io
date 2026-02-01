import DiscordApi from "./api.js";
import { GetApiUrl, discord_client_id, SetCookie } from "../../global.js";

function SetAuthButtonText(loggedIn) {
    const authBtn = document.getElementById('auth-btn');
    authBtn.innerText = loggedIn ? 'SIGN OUT' : 'LOGIN';
}
function SetAuthUsername(user) {
    const authBtn = document.getElementById('auth-btn');
    if (!authBtn) return;

    // Remove old info if it exists
    ClearAuthUser();

    // Create a container for Avatar + Name
    const container = document.createElement('div');
    container.id = 'auth-user-info';
    container.className = 'flex items-center gap-3 mr-4 animate-fadeIn'; // Tailwind classes

    // 1. Setup Avatar
    // Check if the API gives a full URL, or if we need to construct it from ID + Hash
    let avatarSrc = "https://cdn.discordapp.com/embed/avatars/0.png"; // Default

    if (user.avatar_url) {
        avatarSrc = user.avatar_url;
    } else if (user.avatar && user.id) {
        // Construct standard Discord avatar URL
        avatarSrc = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }

    const img = document.createElement('img');
    img.src = avatarSrc;
    img.alt = user.username;
    img.className = "w-8 h-8 rounded-full border border-hacker-blue/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]";

    // 2. Setup Username
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-sm font-bold text-gray-200 hidden sm:block'; // Hidden on very small screens
    nameSpan.textContent = user.username || "User";

    // Add to container
    container.appendChild(img);
    container.appendChild(nameSpan);

    // Insert before the button
    authBtn.parentNode.insertBefore(container, authBtn);
}
function ClearAuthUser() {
    const el = document.getElementById('auth-user-info');
    if (el) el.remove();
}

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

            function handleMessage(evt) {
                try {
                    const msg = evt.data;
                    if (msg && msg.loggedIn && msg.session) {
                        try { SetCookie('session', msg.session, { days: 3650, path: '/' }); } catch (e) { document.cookie = `session=${msg.session}; Path=/; Max-Age=${3650 * 24 * 60 * 60}`; }

                        window.removeEventListener('message', handleMessage);
                        this.removeOverlay();
                        try { loginTab?.close(); } catch (e) { }

                        resolve(msg.session);
                    }
                } catch (e) {
                    console.error('Error handling login message', e);
                }
            }

            window.addEventListener('message', handleMessage);

            const fallbackInterval = setInterval(() => {
                if (!loginTab || loginTab.closed) {
                    clearInterval(fallbackInterval);
                    window.removeEventListener('message', handleMessage);
                    this.removeOverlay();
                    reject(new Error("Login cancelled"));
                }
            }, 500);
        });

        const session = await loginPromise;
        try {
            const user = await GetSessionInfo();
            if (user) setAuthUsername(user);
        } catch (e) { }

        return session;
    },

    async LoginLogic() {
        let hasToken = DiscordApi.GetSessionToken();

        if (hasToken) {
            DiscordApi.DeleteSessionToken();
            DiscordApi.ClearSessionCache();
            hasToken = false;
        } else {
            await this.LoginDiscord();
            hasToken = !hasToken;
        }

        window.location.reload();
        SetAuthButtonText(hasToken);
    },
}
export default DiscordRender;

window.DiscordRender = DiscordRender;

(async () => {
    const token = DiscordApi.GetSessionToken();
    if (!token) return ClearAuthUser();
    try {
        const user = await DiscordApi.GetSessionInfo();
        if (user) SetAuthUsername(user);
        else ClearAuthUser();
    } catch (e) {
        ClearAuthUser();
    }

    SetAuthButtonText(DiscordApi.GetSessionToken());
})();
