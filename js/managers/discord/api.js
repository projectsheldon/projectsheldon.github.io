import { GetApiUrl, discord_client_id, GetCookie, TaskWait, SetCookie } from "../../global.js";

let _sessionCache = {
    token: null,
    user: null,
    ts: 0,
    promise: null,
    ttl: 600000
};

const DiscordApi = {
    GetSessionToken() {
          return localStorage.getItem('session') || GetCookie('session');
    },
    DeleteSessionToken() {
        const cookieName = "session";
        try { localStorage.removeItem('session'); } catch (e) {}
        const cookies = document.cookie.split(";");

        cookies.forEach(cookie => {
            const [name] = cookie.split("=");
            if (name.trim() === cookieName) {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
            }
        });
        try { ClearSessionCache(); } catch (e) { }
        window.location.reload();
    },
    ClearSessionCache() {
        _sessionCache = { token: null, user: null, ts: 0, promise: null, ttl: 0 };
    },

    async GetSessionInfo(force = false) {
        const token = this.GetSessionToken();
        if (!token) return null;

        const now = Date.now();

        if (!force && _sessionCache.token === token) {
            if (_sessionCache.user && (now - _sessionCache.ts) < _sessionCache.ttl) {
                return _sessionCache.user;
            }
            if (_sessionCache.promise) {
                return await _sessionCache.promise;
            }
        }

        const fetchPromise = (async () => {
            try {
                const res = await fetch(`${await GetApiUrl()}sheldon/discord/me?token=${token}`);
                if (!res.ok) return null;
                const json = await res.json();
                _sessionCache.token = token;
                _sessionCache.user = json;
                _sessionCache.ts = Date.now();
                _sessionCache.promise = null;
                return json;
            } catch (err) {
                _sessionCache.promise = null;
                return null;
            }
        })();

        _sessionCache.promise = fetchPromise;
        const result = await fetchPromise;
        if (!result) {
            _sessionCache.user = null;
            _sessionCache.ts = Date.now();
            _sessionCache.promise = null;
        }
        return result;
    }
}
export default DiscordApi;
window.DiscordApi = DiscordApi;
