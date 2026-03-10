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
    if (!discordId || !apiKey) return null;

    try {
        // Use the new unencrypted auth API endpoint
        const data = await AuthApi.CreateLicense().catch(() => null);
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
            // Check if this license is reseller inventory (unassigned)
            // If is_unassigned = 1, it's reseller inventory - redirect to resell page
            // If is_unassigned = 0 or null, it's a personal license - don't redirect
            try {
                // Use the new unencrypted auth API endpoint with discordId and token for validation
                const licenseData = await AuthApi.GetLicense(apiKey, { discordId, token: sessionToken }).catch(() => null);
                
                // Only redirect to resell if the license is actually unassigned reseller inventory
                // Check is_unassigned flag - if it's 1, it's inventory that needs to be assigned
                const license = licenseData?.license;
                const isUnassignedInventory = license?.is_unassigned === 1 || license?.is_unassigned === true;
                
                if (isUnassignedInventory) {
                    window.location.href = "/resell/";
                    return;
                }
                // Otherwise, it's a personal license - continue to show it
            } catch (err) {
                // If we can't check the license details, check discord_id as fallback
                // If license exists and has a discord_id assigned, it's a personal license
                try {
                    // Pass discordId and token for server-side validation
                    const licenseData = await AuthApi.GetLicense(apiKey, { discordId, token: sessionToken }).catch(() => null);
                    const license = licenseData?.license;
                    
                    // If license has no discord_id assigned, redirect to resell as safety
                    // (it might be unassigned inventory that couldn't be detected)
                    if (!license || !license.discord_id) {
                        window.location.href = "/resell/";
                        return;
                    }
                    // Otherwise, continue to show the personal license
                } catch (fallbackErr) {
                    // If we can't even check, redirect to resell for safety
                    window.location.href = "/resell/";
                    return;
                }
            }
        }
    } catch { }

    const backendKey = await GenerateBackendKey(sessionInfo.id);
    const finalKey = backendKey || apiKey;

    if (!backendKey && IsLikelyWorkInkToken(apiKey)) {
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

