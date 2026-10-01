import './clearance.js'; // installs a window.fetch guard that auto-recovers backend calls from Cloudflare challenges

const TEN_MINUTES = 10 * 60 * 1000;

// Allow-list of backend origins that this static site is permitted to talk to.
// Any URL loaded from localStorage cache OR from the /config/backend response is
// validated against this list – so a compromised localStorage entry can't redirect
// every fetch (including the Discord session token in the Authorization header) to
// an attacker's host. Add localhost variants for dev.
const ALLOWED_BACKEND_ORIGINS = new Set([
    'https://backend.projectsheldon.me',
    'http://localhost:3350',
    'http://127.0.0.1:3350'
]);

function isAllowedBackendUrl(candidate)
{
    if(typeof candidate !== 'string' || candidate.length === 0) return false;
    try
    {
        const u = new URL(candidate);
        return ALLOWED_BACKEND_ORIGINS.has(u.origin);
    }
    catch(e)
    {
        return false;
    }
}

(function migrateOldCache()
{
    try
    {
        const old = localStorage.getItem('cache_backend_url');
        if(old)
        {
            const parsed = JSON.parse(old);
            if(typeof parsed.data === 'string' && parsed.data.endsWith('/'))
            {
                parsed.data = parsed.data.replace(/\/+$/, '');
                localStorage.setItem('cache_backend_url', JSON.stringify(parsed));
            }
            // Purge if the cached URL isn't in the allow-list (defence against a poisoned cache).
            if(typeof parsed.data === 'string' && !isAllowedBackendUrl(parsed.data))
            {
                localStorage.removeItem('cache_backend_url');
            }
        }
    }
    catch(e) {}
})();

function stripTrailingSlash(url) {
    return url.replace(/\/+$/, '');
}

const Cache = {
    get(key, maxAge = TEN_MINUTES)
    {
        try
        {
            const raw = localStorage.getItem(`cache_${key}`);
            if(!raw) return null;
            const item = JSON.parse(raw);
            if(Date.now() - item.timestamp < maxAge) return item.data;
            localStorage.removeItem(`cache_${key}`);
        }
        catch(e) {}
        return null;
    },
    set(key, data)
    {
        try
        {
            localStorage.setItem(`cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
        }
        catch(e) {}
    },
    remove(key)
    {
        try { localStorage.removeItem(`cache_${key}`); } catch(e) {}
    }
};

const Api = {
    _backendUrl: null,
    _discordConfig: null,

    async _fetchBackendUrl()
    {
        const cached = Cache.get('backend_url');
        if(cached && isAllowedBackendUrl(cached))
        {
            this._backendUrl = stripTrailingSlash(cached);
            return this._backendUrl;
        }
        // Cache is unusable – clear it so we don't keep falling through.
        Cache.remove('backend_url');

        const remoteServer = stripTrailingSlash('https://backend.projectsheldon.me');
        const localServer = stripTrailingSlash('http://localhost:3350');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const fallbackUrl = isLocalhost ? localServer : remoteServer;

        try
        {
            const response = await fetch(`${fallbackUrl}/config/backend`);
            if(response.ok)
            {
                const data = await response.json();
                const candidate = stripTrailingSlash(isLocalhost ? data.localhost : data.server);
                // Only trust the config-backend response if it points at an allow-listed origin;
                // otherwise the fallback wins.
                this._backendUrl = isAllowedBackendUrl(candidate) ? candidate : fallbackUrl;
            } else
            {
                this._backendUrl = fallbackUrl;
            }
        } catch(e)
        {
            this._backendUrl = fallbackUrl;
        }

        Cache.set('backend_url', this._backendUrl);
        return this._backendUrl;
    },

    async GetApiUrl()
    {
        if(!this._backendUrl)
        {
            await this._fetchBackendUrl();
        }
        this._backendUrl = stripTrailingSlash(this._backendUrl);
        return this._backendUrl;
    },

    async GetDiscordConfig()
    {
        const cached = Cache.get('discord_config');
        if(cached)
        {
            this._discordConfig = cached;
            return cached;
        }

        const apiUrl = await this.GetApiUrl();
        const response = await fetch(`${apiUrl}/config/discord`);
        const data = await response.json();

        this._discordConfig = data;
        Cache.set('discord_config', data);
        return data;
    },

    async GetApiKey()
    {
        return localStorage.getItem('admin_api_key') || '';
    },

    async GetLink(platform)
    {
        const cached = Cache.get(`link_${platform}`, 600000);
        if(cached) return cached;

        const apiUrl = await Api.GetApiUrl();
        const endpoint = `${apiUrl}/links/${platform}`;

        const response = await fetch(endpoint);
        const data = await response.json();

        if(data.link) Cache.set(`link_${platform}`, data.link);
        return data.link;
    },

    async BulkUserInfo(discordId, sessionToken)
    {
        const apiUrl = await this.GetApiUrl();
        const response = await fetch(`${apiUrl}/auth/bulk-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId, sessionToken })
        });
        const data = await response.json();
        if(data.ok)
        {
            if(data.user) Cache.set('discord_user', data.user);
            if(data.licenses) Cache.set('licenses', data.licenses);
            Cache.set('bulk_info_timestamp', Date.now());
        }
        return data;
    }
};
export default Api;
