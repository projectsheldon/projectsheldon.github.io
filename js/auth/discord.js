import { API_URL, discord_client_id, GetCookie, TaskWait } from "../global.js";

function showOverlay() {
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
}

function removeOverlay() {
    const overlay = document.getElementById("login-overlay");
    if (overlay) overlay.remove();
}

export function GetSessionToken() {
    return GetCookie("session");
}

export function DeleteSessionToken() {
    const cookieName = "session";
    const cookies = document.cookie.split(";");

    cookies.forEach(cookie => {
        const [name] = cookie.split("=");
        if (name.trim() === cookieName) {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        }
    });
}

export async function GetSessionInfo() {
    const token = GetSessionToken();
    if (!token) return null;
    const res = await fetch(`${API_URL}sheldon/discord/me?token=${token}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json;
}

export async function LoginDiscord() {
    showOverlay();

    const redirectUri = encodeURIComponent(`${API_URL}sheldon/discord/callback`);
    // Added prompt=consent to ensure we get fresh data if needed
    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${discord_client_id}&response_type=code&redirect_uri=${redirectUri}&scope=identify`;

    const loginTab = window.open(discordUrl, "_blank");
    const loginPromise = new Promise((resolve, reject) => {

        function handleMessage(evt) {
            try {
                const msg = evt.data;
                if (msg && msg.loggedIn && msg.session) {
                    document.cookie = `session=${msg.session}; Path=/; Max-Age=604800`;

                    window.removeEventListener('message', handleMessage);
                    removeOverlay();
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
                removeOverlay();
                reject(new Error("Login cancelled"));
            }
        }, 500);
    });

    const session = await loginPromise;
    try {
        const user = await GetSessionInfo();
        if (user) setAuthUsername(user);
    } catch (e) {}

    return session;
}

function setAuthUsername(user) {
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

// Exported function to clear the UI (called from index.js on logout)
export function ClearAuthUser(){
    const el = document.getElementById('auth-user-info');
    if (el) el.remove();
}

// On module load
(async () => {
    const token = GetSessionToken();
    if (!token) return ClearAuthUser();
    try {
        const user = await GetSessionInfo();
        if (user) setAuthUsername(user);
        else ClearAuthUser();
    } catch (e) {
        console.error('Failed to get session user on load', e);
        ClearAuthUser();
    }
})();