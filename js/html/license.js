import { GetApiUrl, GetCookie } from "../global.js";
import DiscordApi from "../managers/discord/api.js";
import AuthApi from "../managers/auth/api.js";

// Store token and discordId globally for API calls
let sessionToken = null;
let discordId = null;

let apiKey;

function IsLikelyWorkInkToken(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

async function GenerateBackendKey(discordId) {
    // Get the current apiKey from URL
    const currentApiKey = new URLSearchParams(window.location.search).get('key');
    
    // If there's NO apiKey in the URL, we need to create one (for WorkInk token redemption)
    // If there IS an apiKey in the URL, don't create a duplicate (for PayPal flow)
    if (!discordId) {
        return null;
    }
    
    // If apiKey exists in URL and it's NOT a WorkInk token, skip creating a new license
    // This prevents duplicate license creation when coming from payment flows
    if (currentApiKey && !IsLikelyWorkInkToken(currentApiKey)) {
        console.log('GenerateBackendKey: skipping - valid license key exists in URL');
        return null;
    }
    
    // If we get here, either:
    // 1. There's no apiKey in URL (direct access to /license)
    // 2. The apiKey is a WorkInk token that needs to be exchanged
    try {
        // Use the new unencrypted auth API endpoint
        // Pass forceNew: true to bypass existing license check - needed for WorkInk redemptions
        const data = await AuthApi.CreateLicense(null, { forceNew: true }).catch(() => null);
        return data?.license ?? null;
    } catch (err) {
        return null;
    }
}

async function AssignLicense(licenseKey, discordId) {
    if (!licenseKey || !discordId) return null;

    try {
        // Use the new unencrypted auth API endpoint
        const data = await AuthApi.AssignLicenseByKey(licenseKey, discordId).catch(() => null);
        return { ok: data?.ok, data };
    } catch (err) {
        return null;
    }
}

async function InitLicensePage() {
    apiKey = new URLSearchParams(window.location.search).get('key');

    const keyTextEl = document.getElementById("key-text");
    if (!keyTextEl) return;

    if (!apiKey) {
        keyTextEl.textContent = "Missing key";
        return;
    }

    const sessionInfo = await DiscordApi.GetSessionInfo().catch(() => null);
    if (!sessionInfo?.id) {
        keyTextEl.textContent = "Login required";
        return;
    }

    // Store Discord ID and session token for server-side validation
    discordId = sessionInfo.id;
    // Get token from sessionStorage first, then fallback to cookie
    sessionToken = DiscordApi.GetSessionToken() || GetCookie('session');

    // Check if user is a verified reseller
    // If they are, only redirect to resell page if this is unassigned inventory (not their personal license)
    try {
        const rs = await AuthApi.GetResellerStatus().catch(() => null);
        if (rs?.verified === true) {
            try {
                const licenseData = await AuthApi.GetLicense(apiKey, { discordId, token: sessionToken }).catch(() => null);
                const license = licenseData?.license;
                const isUnassignedInventory = license?.is_unassigned === 1 || license?.is_unassigned === true;
                if (isUnassignedInventory) {
                    window.location.href = "/resell/";
                    return;
                }
            } catch (err) {
                try {
                    const licenseData = await AuthApi.GetLicense(apiKey, { discordId, token: sessionToken }).catch(() => null);
                    const license = licenseData?.license;
                    if (!license || !license.discord_id) {
                        window.location.href = "/resell/";
                        return;
                    }
                } catch (fallbackErr) {
                    window.location.href = "/resell/";
                    return;
                }
            }
        }
    } catch { }

    // Decide whether we actually need to touch the backend at all.  The only
    // times we use GenerateBackendKey are when the query parameter is missing
    // (e.g. landing directly on /license with no key) or when the parameter is
    // a *WorkInk token* that needs to be exchanged.  We no longer override a
    // valid licence key returned by PayPal or any other source.
    let finalKey = apiKey;
    let backendKey = null;

    if (!finalKey || IsLikelyWorkInkToken(finalKey)) {
        backendKey = await GenerateBackendKey(sessionInfo.id);
        if (backendKey) finalKey = backendKey;
    }

    // if the original parameter looked like a WorkInk token but we ended up
    // still displaying that same value then the exchange failed (token
    // invalidated).
    if (IsLikelyWorkInkToken(apiKey) && finalKey === apiKey) {
        keyTextEl.textContent = "Token is invalidated";
        return;
    }

    keyTextEl.textContent = finalKey;

    // try to assign key to current user and report any problems
    const assignRes = await AssignLicense(finalKey, sessionInfo.id);
    if (!assignRes || !assignRes.ok) {
        const errMsg = assignRes?.data?.error || assignRes?.reason || "assignment_failed";
        // display a warning next to the key so the user knows something went wrong
        keyTextEl.textContent = `${finalKey} (assignment error: ${errMsg})`;
        console.warn("License assignment failed:", errMsg, assignRes);
    }
}

document.addEventListener("DOMContentLoaded", InitLicensePage);

function CopyToClipboard() {
    const keyText = document.getElementById("key-text")?.textContent;
    if (!keyText) return;

    navigator.clipboard.writeText(keyText);
}

window.CopyToClipboard = CopyToClipboard;

