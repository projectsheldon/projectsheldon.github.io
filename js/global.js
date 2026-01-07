export async function GetApiUrl() {
    const defaultCandidates = [
        'http://localhost:3350',
        'https://5.249.161.40:3350'
    ];

    // Prefer a candidate that matches the current page (localhost when developing),
    // to avoid noisy connection attempts to unreachable hosts.
    let candidates = defaultCandidates.slice();
    try {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            candidates = ['http://localhost:3350', 'https://5.249.161.40:3350'];
        }
        else {
            candidates = ['https://5.249.161.40:3350', 'http://localhost:3350'];
        }
    } catch (e) {
        candidates = defaultCandidates.slice();
    }

    for (const base of candidates) {
        try {
            const response = await fetch(`${base}/sheldon/getApiUrl`);
            if (!response.ok) {
                continue;
            }
            const data = await response.json();
            const url = data && data.url ? String(data.url).replace(/\/+$/g, '') : null;
            if (url) return url + '/';
        } catch (err) {
            continue;
        }
    }

    return '';
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