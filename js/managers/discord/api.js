import { GetApiUrl, GetCookie } from "../../global.js";

let _sessionCache = {
    token: null,
    user: null,
    ts: 0,
    promise: null,
    ttl: 600000
};

const DiscordApi = {
    GetSessionToken() {
        return GetCookie('session');
    },
    async DeleteSessionToken() {
        const token = this.GetSessionToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        try {
            await fetch(`${await GetApiUrl()}sheldon/discord/logout`, {
                method: "POST",
                headers,
                credentials: "include"
            });
        } catch (e) { }

        // Cleanup legacy client-accessible cookie variants.
        const cookieName = "session";
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;

        this.ClearSessionCache();
        window.location.reload();
    },
    ClearSessionCache() {
        _sessionCache = { token: null, user: null, ts: 0, promise: null, ttl: 600000 };
    },

    async GetSessionInfo(force = false) {
        const token = this.GetSessionToken();
        const cacheToken = token || "__cookie__";

        const now = Date.now();

        if (!force && _sessionCache.token === cacheToken) {
            if (_sessionCache.user && (now - _sessionCache.ts) < _sessionCache.ttl) {
                return _sessionCache.user;
            }
            if (_sessionCache.promise) {
                return await _sessionCache.promise;
            }
        }

        const fetchPromise = (async () => {
            try {
                const headers = {};
                if (token) headers.Authorization = `Bearer ${token}`;

                const res = await fetch(`${await GetApiUrl()}sheldon/discord/me`, {
                    method: "GET",
                    headers,
                    credentials: "include"
                });
                if (!res.ok) return null;
                const json = await res.json();
                _sessionCache.token = cacheToken;
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
            _sessionCache.token = cacheToken;
            _sessionCache.user = null;
            _sessionCache.ts = Date.now();
            _sessionCache.promise = null;
        }
        return result;
    }
}
export default DiscordApi;
