// Cache for the API URL fetched from backend
let cachedApiUrl = null;

// Check if we're in local development
function isLocalDevelopment() {
    if (typeof window === 'undefined') return false;
    const host = window.location.host;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:');
}

async function fetchApiUrlFromBackend() {
    try {
        // Use relative URL to fetch from current origin
        const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
        const host = typeof window !== 'undefined' ? window.location.host : 'projectsheldon.xyz';
        const baseUrl = `${protocol}//${host}/`;
        
        const res = await fetch(`${baseUrl}sheldon/getApiUrl`);
        if (!res.ok) throw new Error('Failed to fetch API URL');
        const data = await res.json();
        return data.url;
    } catch (err) {
        console.error('Failed to fetch API URL from backend:', err);
        return null;
    }
}

export async function GetApiUrl() {
    // Return cached URL if already fetched
    if (cachedApiUrl) {
        return cachedApiUrl;
    }

    // For local development, directly use localhost:3350
    if (isLocalDevelopment()) {
        cachedApiUrl = 'http://localhost:3350/';
        return cachedApiUrl;
    }

    // Try to fetch URL from backend
    const backendUrl = await fetchApiUrlFromBackend();
    if (backendUrl) {
        cachedApiUrl = backendUrl;
        return cachedApiUrl;
    }

    // Fallback to hardcoded URLs if fetch fails
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    cachedApiUrl = isHttps ? 'https://projectsheldon.xyz/' : 'http://localhost:3350/';
    return cachedApiUrl;
}

export async function GetProducts() {
    try {
        const response = await fetch(`${await GetApiUrl()}sheldon/products`);
        const data = await response.json();
        return data;
    } catch (err) {
        return null;
    }
}

export function GetCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
}

export function SetCookie(name, value, options = {}) {
    const { days, maxAge, path = '/', domain, secure = false, sameSite } = options;
    let cookie = `${name}=${encodeURIComponent(String(value))}; Path=${path};`;
    if (typeof maxAge === 'number') {
        cookie += ` Max-Age=${Math.floor(maxAge)};`;
    } else if (typeof days === 'number') {
        cookie += ` Max-Age=${Math.floor(days * 24 * 60 * 60)};`;
    }
    if (domain) cookie += ` Domain=${domain};`;
    if (secure) cookie += ' Secure;';
    if (sameSite) cookie += ` SameSite=${sameSite};`;
    document.cookie = cookie;
}

export function TaskWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const discord_client_id = "1429915624653459657";

(async () => {
    try {
        const products = await GetProducts();
    } catch (err) {
       alert(`head to ${await GetApiUrl()} and allow the cert`);
    }
})();