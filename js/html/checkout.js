import { GetApiUrl, GetProducts, paypal_client_id, paypal_currency } from "../global.js";
import { createPayPalButtons } from "../managers/payment/paypal/paypal.js";
import DiscordApi from "../managers/discord/api.js";
import DiscordRender from "../managers/discord/render.js";

let cryptoStatusClearTimer = null;
let cryptoStatusSequence = 0;
let paypalSdkLoadPromise = null;
let paypalButtonsRendered = false;

async function GetPaypalClientConfig() {
    const clientId = paypal_client_id;
    const currency = paypal_currency || "EUR";

    if (!clientId || typeof clientId !== "string") {
        throw new Error("Missing PayPal client id");
    }

    return { clientId, currency };
}

async function LoadPaypalSdk() {
    if (window.paypal) return true;
    if (paypalSdkLoadPromise) return paypalSdkLoadPromise;

    paypalSdkLoadPromise = (async () => {
        const { clientId, currency } = await GetPaypalClientConfig();

        await new Promise((resolve, reject) => {
            const existingScript = document.getElementById("paypal-sdk-script");
            if (existingScript) {
                existingScript.addEventListener("load", () => resolve(), { once: true });
                existingScript.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.id = "paypal-sdk-script";
            script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("PayPal SDK failed to load"));
            document.head.appendChild(script);
        });

        return true;
    })();

    try {
        return await paypalSdkLoadPromise;
    } catch (error) {
        paypalSdkLoadPromise = null;
        console.error(error);
        return false;
    }
}

async function InitPaypalButtons() {
    const paypalContainer = document.getElementById('paypal-button-container');
    if (!paypalContainer || paypalContainer.style.display === 'none' || paypalButtonsRendered) return;

    const sdkLoaded = await LoadPaypalSdk();
    if (!sdkLoaded || !window.paypal) {
        paypalContainer.innerHTML = '<p class="text-sm text-red-400">PayPal is currently unavailable.</p>';
        return;
    }

    const paypalButtons = createPayPalButtons();
    await paypalButtons.render('#paypal-button-container');
    paypalButtonsRendered = true;
}

async function CheckDiscordLoginStatus() {
    const authUser = await DiscordApi.GetSessionInfo().catch(() => null);
    const loginOverlay = document.getElementById('login-overlay');
    const paypalContainer = document.getElementById('paypal-button-container');

    if (!authUser || !authUser.id) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        if (paypalContainer) paypalContainer.style.display = 'none';

        return false;
    }
    else {
        if (loginOverlay) loginOverlay.classList.add('hidden');
        if (paypalContainer) paypalContainer.style.display = 'block';
        await InitPaypalButtons();

        return true;
    }
}

function GetProductFromUrl() {
    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();
    return type;
}

function SetCryptoTicketStatus(message, isError = false) {
    const statusEl = document.getElementById('crypto-ticket-status');
    if (!statusEl) return;

    cryptoStatusSequence += 1;
    const sequence = cryptoStatusSequence;

    if (cryptoStatusClearTimer) {
        clearTimeout(cryptoStatusClearTimer);
        cryptoStatusClearTimer = null;
    }

    statusEl.style.transition = "opacity 250ms ease";
    statusEl.style.opacity = "0";

    setTimeout(() => {
        if (sequence !== cryptoStatusSequence) return;

        statusEl.textContent = message;
        statusEl.classList.remove('text-gray-500', 'text-red-400', 'text-hacker-blue');
        statusEl.classList.add(isError ? 'text-red-400' : 'text-hacker-blue');
        statusEl.style.opacity = "1";
    }, 60);

    cryptoStatusClearTimer = setTimeout(() => {
        if (sequence !== cryptoStatusSequence) return;

        statusEl.style.opacity = "0";

        setTimeout(() => {
            if (sequence !== cryptoStatusSequence) return;

            statusEl.textContent = "";
            statusEl.classList.remove('text-red-400', 'text-hacker-blue');
            statusEl.classList.add('text-gray-500');
        }, 260);
    }, 10000);
}

async function CreateCryptoTicket() {
    const btn = document.getElementById('crypto-ticket-btn');
    const authUser = await DiscordApi.GetSessionInfo().catch(() => null);

    if (!authUser || !authUser.id) {
        SetCryptoTicketStatus("Login required.", true);
        DiscordRender.LoginLogic();
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.classList.add("opacity-60", "cursor-not-allowed");
    }

    try {
        const baseUrl = await GetApiUrl();
        const productId = GetProductFromUrl();

        if (!productId || productId === "free") {
            SetCryptoTicketStatus("Invalid product.", true);
            return;
        }
        const payload = {
            discordId: authUser.id,
            productId: productId
        };

        const res = await fetch(`${baseUrl}sheldon/crypto/create_ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = data?.message || data?.error || "Ticket request failed.";
            SetCryptoTicketStatus(msg, true);
            return;
        }

        const isValid = data?.valid === true;
        if (isValid) {
            SetCryptoTicketStatus("Ticket created. Check the Discord server for your ticket.");
        } else {
            const msg = data?.message || "Ticket request failed.";
            SetCryptoTicketStatus(msg, true);
        }
    } catch (error) {
        SetCryptoTicketStatus("Connection failed.", true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove("opacity-60", "cursor-not-allowed");
        }
    }
}

async function OnLoad() {
    const loginStatus = await CheckDiscordLoginStatus();

    const type = GetProductFromUrl();

    const serverProducts = await GetProducts();

    if (type === "free") {
        if (loginStatus)
            window.location.href = 'https://work.ink/2jEb/sheldon-free-license';
    } else {
        const priceElement = document.querySelector('.total-price');
        const nameElement = document.getElementById('product-name');

        const product = serverProducts[type];

        let priceDisplay;

        if (typeof product.price === 'string') {
            priceDisplay = product.price;
        } else if (typeof product.price === 'number') {
            priceDisplay = `€${product.price.toFixed(2)}`;
        }

        if (priceElement) priceElement.textContent = priceDisplay;
        if (nameElement) nameElement.textContent = product.name;

    }
}

async function CryptoTestRequest() {
    await CryptoInitRequest(GetProductFromUrl());
}

window.checkLoginStatus = CheckDiscordLoginStatus;
window.CryptoTestRequest = CryptoTestRequest;

document.addEventListener('DOMContentLoaded', async () => {
    {
        const overlayLoginBtn = document.getElementById('overlay-login-btn');
        if (overlayLoginBtn) {
            overlayLoginBtn.addEventListener('click', () => {
                DiscordRender.LoginLogic();
            });
        }
    }

    const authBtn = document.getElementById('auth-btn');
    if (authBtn) authBtn.addEventListener('click', () => DiscordRender.LoginLogic());

    const cryptoTestBtn = document.getElementById('crypto-test-btn');
    if (cryptoTestBtn) cryptoTestBtn.addEventListener('click', () => CryptoTestRequest());

    const cryptoTicketBtn = document.getElementById('crypto-ticket-btn');
    if (cryptoTicketBtn) cryptoTicketBtn.addEventListener('click', () => CreateCryptoTicket());

    await OnLoad();
});
