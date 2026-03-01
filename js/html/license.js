import { GetApiUrl } from "../global.js";
import DiscordApi from "../managers/discord/api.js";

let apiKey;

function IsLikelyWorkInkToken(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

async function GenerateBackendKey(discordId) {
    if (!discordId || !apiKey) return null;

    try {
        const baseUrl = await GetApiUrl();
        const response = await fetch(`${baseUrl}sheldon/license/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey,
                discordId
            })
        });
        if (!response.ok) return null;

        const data = await response.json().catch(() => null);
        return data?.key ?? null;
    } catch (err) {
        return null;
    }
}

async function AssignLicense(licenseKey, discordId) {
    if (!licenseKey || !discordId) return null;

    try {
        const response = await fetch(`${await GetApiUrl()}sheldon/license/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey: licenseKey,
                discordId
            })
        });

        const data = await response.json().catch(() => null);
        return { ok: response.ok, data };
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

    const backendKey = await GenerateBackendKey(sessionInfo.id);
    const finalKey = backendKey || apiKey;

    if (!backendKey && IsLikelyWorkInkToken(apiKey)) {
        keyTextEl.textContent = "Token is invalidated";
        return;
    }

    keyTextEl.textContent = finalKey;

    await AssignLicense(finalKey, sessionInfo.id);
}

document.addEventListener("DOMContentLoaded", InitLicensePage);

function CopyToClipboard() {
    const keyText = document.getElementById("key-text")?.textContent;
    if (!keyText) return;

    navigator.clipboard.writeText(keyText);
}

window.CopyToClipboard = CopyToClipboard;
