// Device identity helpers (no dependencies — the site is a static no-build site).
//
// NOTE ON NAMING: this file used to be called `fingerprint.js`. Adblockers
// (uBlock Origin / EasyPrivacy et al.) block requests whose URL contains
// "fingerprint", so a static `import ... from 'fingerprint.js'` made every
// module that imported it fail to evaluate entirely — login button, products,
// downloads, checkout all dead at once. This file is deliberately named
// `device.js` so its URL matches no known filter list, and every consumer
// loads it via a guarded dynamic `import()` with a localStorage-only fallback,
// so even if it is ever blocked the page keeps working (just without the
// enriched browser signal, which the backend treats as optional).
//
// Combines renderer/hardware/screen/locale signals into a SHA-256 hash, cached in
// localStorage. The result is only ever sent to OUR backend, where it is re-hashed with a
// server-side salt together with the hashed client IP and a random device id.

const DEVICE_KEY = 'sheldon_fp';
const BFP_KEY = 'sheldon_bfp';

async function sha256Hex(text)
{
    try
    {
        if(window.crypto && crypto.subtle)
        {
            const data = new TextEncoder().encode(String(text));
            const digest = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(digest))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
    } catch(e) {}
    let hash = 0x811c9dc5;
    const str = String(text);
    for(let i = 0; i < str.length; i++)
    {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return 'fnv_' + (hash >>> 0).toString(16);
}

function canvasHash()
{
    try
    {
        const canvas = document.createElement('canvas');
        canvas.width = 220;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        if(!ctx) return null;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#c7b18f';
        ctx.fillRect(0, 0, 220, 40);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Sheldon-fp-7f3a', 4, 4);
        ctx.fillStyle = '#050505';
        ctx.fillText('\u03bb\u03c9\u30c6\u4e2d\u6587', 60, 4);
        return canvas.toDataURL();
    } catch(e) { return null; }
}

function webglInfo()
{
    try
    {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if(!gl) return null;
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return {
            renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : null,
            vendor: dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : null
        };
    } catch(e) { return null; }
}

function audioProbe()
{
    try
    {
        const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if(!Ctor) return null;
        const ctx = new Ctor(1, 44100, 44100);
        return String(ctx.sampleRate) + '|' + String(ctx.state);
    } catch(e) { return null; }
}

async function collectSignals()
{
    const gl = webglInfo();
    const screen = window.screen || {};
    let tz = null;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch(e) {}

    const signals = {
        ua: navigator.userAgent || null,
        platform: navigator.platform || null,
        lang: navigator.language || null,
        langs: (navigator.languages || []).slice(0, 5).join(',') || null,
        tz: tz,
        screen: (screen.width || 0) + 'x' + (screen.height || 0) + 'x' + (screen.colorDepth || 0),
        hardware: navigator.hardwareConcurrency || 0,
        memory: navigator.deviceMemory || 0,
        canvas: canvasHash(),
        webgl: (gl ? gl.renderer + '|' + gl.vendor : null),
        audio: audioProbe(),
        touch: ('ontouchstart' in window) ? 1 : 0
    };
    return JSON.stringify(signals);
}

export async function GetDeviceId()
{
    try
    {
        let id = localStorage.getItem(DEVICE_KEY);
        if(!id)
        {
            id = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch(e) { return null; }
}

export async function GetBrowserFingerprint()
{
    try
    {
        let fp = localStorage.getItem(BFP_KEY);
        if(!fp)
        {
            fp = await sha256Hex(await collectSignals());
            localStorage.setItem(BFP_KEY, fp);
        }
        return fp;
    } catch(e) { return null; }
}

// Form-urlencoded body (a CORS simple request — no preflight, so it works behind the
// Cloudflare challenge, same reason the rest of the site posts form bodies).
export async function GetIdentityPayload()
{
    const payload = new URLSearchParams();
    const [ deviceId, browserFp ] = await Promise.all([ GetDeviceId(), GetBrowserFingerprint() ]);
    if(deviceId) payload.set('fingerprint', deviceId);
    if(browserFp) payload.set('browserFp', browserFp);
    return payload;
}

// Sync compatibility shims for existing call sites that read the device id synchronously.
export function GetDeviceIdSync()
{
    try
    {
        let id = localStorage.getItem(DEVICE_KEY);
        if(!id)
        {
            id = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : (Date.now().toString(36) + Math.random().toString(36).slice(2));
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch(e) { return null; }
}

export function GetCachedBrowserFingerprint()
{
    try { return localStorage.getItem(BFP_KEY); } catch(e) { return null; }
}
