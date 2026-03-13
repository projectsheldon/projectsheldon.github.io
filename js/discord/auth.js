import Api from "../util/backend.js";

const DiscordAuth = {
    async login() {
        try {
            const response = await fetch(`${Api.GetApiUrl()}/discord/login`);
            const data = await response.json();
            
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Failed to get Discord login URL");
            }
        } catch (error) {
            console.error("Discord login error:", error);
        }
    },

    async logout() {
        try {
            await fetch(`${Api.GetApiUrl()}/discord/logout`, { method: "POST" });
        } catch (error) {
            console.error("Discord logout error:", error);
        }
    },

    async getUser() {
        try {
            const response = await fetch(`${Api.GetApiUrl()}/discord/me`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Discord getUser error:", error);
            return { success: false, loggedIn: false };
        }
    }
};

window.DiscordAuth = DiscordAuth;
export default DiscordAuth;
