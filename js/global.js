export async function GetApiUrl() {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

    if (isHttps) {
        return 'https://projectsheldon.xyz/';
    } else {
        return 'http://localhost:3350/';
    }
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
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const { days, maxAge, path = '/', domain, secure = isHttps, sameSite = "Lax" } = options;
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
export const paypal_client_id = "AVrmU1ZomUtdo48O0oUmt8tU0tU1wxjYjYc0g6RxZZJnF9LWS6haPVap6RQiZB7vf2SHjf-TBqa4acPp";
export const paypal_currency = "EUR";

(async () => {
    try {
        const products = await GetProducts();
    } catch (err) {
       alert(`head to ${await GetApiUrl()} and allow the cert`);
    }
})();
