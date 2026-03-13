import Api from "../util/backend.js";

const DiscordAuth = {
    async login() {
        try {
            const apiUrl = await Api.GetApiUrl();
            const response = await fetch(`${apiUrl}/discord/login`);
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
            const apiUrl = await Api.GetApiUrl();
            await fetch(`${apiUrl}/discord/logout`, { method: "POST" });
        } catch (error) {
            console.error("Discord logout error:", error);
        }
    },

    async getUser() {
        try {
            const apiUrl = await Api.GetApiUrl();
            const response = await fetch(`${apiUrl}/discord/me`);
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
