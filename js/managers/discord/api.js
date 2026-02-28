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
        try {
            const storageToken = sessionStorage.getItem("session");
            if (storageToken) return storageToken;
        } catch (err) { }
        return GetCookie('session');
    },
    async DeleteSessionToken() {
        const token = this.GetSessionToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        try {
            await fetch(`${await GetApiUrl()}sheldon/discord/logout`, {
                method: "POST",
                credentials: "include",
                headers
            });
        } catch (err) { }

        const cookieName = "session";
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        try { sessionStorage.removeItem("session"); } catch (err) { }

        try {
            this.ClearSessionCache();
        } catch (e) { }
        window.location.reload();
    },
    ClearSessionCache() {
        _sessionCache = { token: null, user: null, ts: 0, promise: null, ttl: 600000 };
    },

    async GetSessionInfo(force = false) {
        const token = this.GetSessionToken();
        const cacheToken = token || "__cookie_session__";

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
                if (token) headers["Authorization"] = `Bearer ${token}`;
                const res = await fetch(`${await GetApiUrl()}sheldon/discord/me`, {
                    method: "GET",
                    credentials: "include",
                    headers
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
