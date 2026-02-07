import { GetApiUrl } from "../global.js";
import DiscordApi from "../managers/discord/api.js";

let apiKey;

async function GenerateBackendKey() {
    const sessionInfo = await DiscordApi.GetSessionInfo();

    if (!sessionInfo?.id) {
        return null;
    }
    if (!apiKey) {
        return null;
    }

    try {
        const url = `${await GetApiUrl()}sheldon/license/create?apiKey=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url, {
            body: JSON.stringify({
                discordId: sessionInfo.id
            })
        });
        const text = await response.text();
        const data = JSON.parse(text);
        return data.key ?? null;
    } catch (err) {
        return null;
    }
}

async function AssignLicense() {
    try {
        const sessionInfo = await DiscordApi.GetSessionInfo();

        if (!sessionInfo?.id) {
            console.error("login discord bruh");
            return null;
        }

        const response = await fetch(`${await GetApiUrl()}sheldon/license/assign`, {
            body: JSON.stringify({
                apiKey,
                discordId: sessionInfo.id
            })
        });

        const text = await response.text();
        const data = JSON.parse(text);
        return data;
    } catch (err) {
    }
}

async function InitLicensePage() {
    apiKey = new URLSearchParams(window.location.search).get('key');

    const keyTextEl = document.getElementById("key-text");

    const backendKey = await GenerateBackendKey();
    const finalKey = backendKey || apiKey;

    keyTextEl.textContent = apiKey;
    await AssignLicense(finalKey);
}

document.addEventListener("DOMContentLoaded", InitLicensePage);

function CopyToClipboard() {
    const keyText = document.getElementById("key-text")?.textContent;
    if (!keyText) return;

    navigator.clipboard.writeText(keyText);
}

window.CopyToClipboard = CopyToClipboard;
