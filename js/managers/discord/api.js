import { GetApiUrl, GetCookie } from "../../global.js";

let _sessionCache = {
    token: null,
    user: null,
    ts: 0,
    promise: null,
    ttl: 600000
};

const DiscordApi = {
    GetSessionToken(options = {}) {
        const allowCookie = options?.allowCookie !== false;
        try {
            const storageToken = sessionStorage.getItem("session");
            if (storageToken) return storageToken;
        } catch (err) { }
        if (!allowCookie) return null;
        return GetCookie('session');
    },
    ClearSessionStorageToken() {
        try { sessionStorage.removeItem("session"); } catch (err) { }
        try { sessionStorage.removeItem("session_logged_in_at"); } catch (err) { }
        try { this.ClearSessionCache(); } catch (e) { }
    },
    async Logout(options = {}) {
        const reload = options?.reload !== false;
        const clearCookie = options?.clearCookie !== false;
        const token = this.GetSessionToken({ allowCookie: options?.allowCookie !== false });
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        try {
            await fetch(`${await GetApiUrl()}sheldon/discord/logout`, {
                method: "POST",
                credentials: "include",
                headers
            });
        } catch (err) { }

        if (clearCookie) {
            const cookieName = "session";
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        }
        try { sessionStorage.removeItem("session"); } catch (err) { }
        try { sessionStorage.removeItem("session_logged_in_at"); } catch (err) { }

        try {
            this.ClearSessionCache();
        } catch (e) { }

        if (reload) window.location.reload();
    },
    async DeleteSessionToken() {
        return await this.Logout({ reload: true });
    },
    ClearSessionCache() {
        _sessionCache = { token: null, user: null, ts: 0, promise: null, ttl: 600000 };
    },

    async GetSessionInfo(forceOrOptions = false, maybeOptions = null) {
        let force = false;
        let options = { allowCookie: true };

        if (typeof forceOrOptions === "boolean") {
            force = forceOrOptions;
            if (maybeOptions && typeof maybeOptions === "object") {
                options = { ...options, ...maybeOptions };
            }
        } else if (forceOrOptions && typeof forceOrOptions === "object") {
            force = Boolean(forceOrOptions.force);
            options = { ...options, ...forceOrOptions };
        }

        const token = this.GetSessionToken({ allowCookie: options.allowCookie !== false });
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
                    // If allowCookie is false, we must not rely on cookies for auth.
                    credentials: options.allowCookie !== false ? "include" : "omit",
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
