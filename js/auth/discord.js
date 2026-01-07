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

export function GetSessionToken(){
    return GetCookie("session");
}

async function loginWithDiscord() {
    const session = GetSessionToken();

    if (!session) {
        AddNotification('User not logged in.', { type: 'warning', duration: 5000 });
        await TaskWait(1500);

        showOverlay();

        const redirectUri = encodeURIComponent(`${API_URL}sheldon/discord/callback`);
        const discordUrl = `https://discord.com/oauth2/authorize?client_id=${discord_client_id}&response_type=code&redirect_uri=${redirectUri}&scope=identify`;

        const loginTab = window.open(discordUrl, "_blank");
        if (!loginTab) {
            alert("Please allow popups for this site!");
            window.location.reload();
            return;
        }

        function handleMessage(evt) {
            try {
                const msg = evt.data;
                if (msg && msg.loggedIn && msg.session) {
                    document.cookie = `session=${msg.session}; Path=/; Max-Age=604800`;
                    window.removeEventListener('message', handleMessage);
                    removeOverlay();
                    try { loginTab?.close(); } catch (e) { }
                    window.location.reload();
                }
            } catch (e) {
                console.error('Error handling login message', e);
            }
        }
        window.addEventListener('message', handleMessage);

        const fallbackInterval = setInterval(async () => {
            if (!loginTab || loginTab.closed) {
                clearInterval(fallbackInterval);
                window.removeEventListener('message', handleMessage);
                removeOverlay();
                AddNotification('Login canceled.', { type: 'error', duration: 3000 });
                await TaskWait(1500);
                window.location.reload();
            }
        }, 500);
    } else {
        const res = await fetch(`${API_URL}sheldon/discord/me?token=${session}`);
        const json = await res.json();

        AddNotification(`Logged in as ${json.username}`, { type: 'success', duration: 3000 });
    }
}
loginWithDiscord();