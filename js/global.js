export async function GetApiUrl() {
    const candidates = [
        'http://localhost:3350',
        'https://5.249.161.40:3350'
    ];

    for (const base of candidates) {
        try {
            const response = await fetch(`${base}/sheldon/getApiUrl`);
            if (!response.ok) {
                console.warn('GetApiUrl non-ok response from', base, response.status);
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

export function TaskWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const discord_client_id = "1429915624653459657";