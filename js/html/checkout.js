import { GetApiUrl, GetProducts } from "../global.js";
import { createPayPalButtons } from "../managers/payment/paypal/paypal.js";
import DiscordApi from "../managers/discord/api.js";
import DiscordRender from "../managers/discord/render.js";

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

        return true;
    }
}

function GetProductFromUrl() {
    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();
    return type;
}

window.copyWalletAddress = function() {
    const input = document.getElementById('crypto-wallet-address');
    const btn = document.getElementById('copy-btn');
    
    if (!input || !input.value) return;

    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);

    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = "COPIED!";
        btn.classList.add("bg-hacker-blue", "text-black", "border-hacker-blue");
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove("bg-hacker-blue", "text-black", "border-hacker-blue");
        }, 2000);
    }
}

async function UpdateCryptoTab() {
    const discordId = await DiscordApi.GetSessionInfo().then(info => info?.id).catch(() => null);
    const productId = GetProductFromUrl();
    
    if (!discordId || !productId || productId === "free") return;

    const qrPlaceholder = document.getElementById('qr-placeholder');
    const qrWrapper = document.getElementById('crypto-qr-wrapper');
    const walletInput = document.getElementById('crypto-wallet-address');
    const qrEl = document.getElementById('crypto-qr');

    if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
    if (qrWrapper) qrWrapper.classList.add('hidden');
    if (walletInput) walletInput.value = "Generating address...";

    const baseUrl = await GetApiUrl();
    const payload = { productId, discordId };

    try {
        const res = await fetch(`${baseUrl}sheldon/crypto/seller_wallet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const info = await res.json();

        if (walletInput) walletInput.value = info?.wallet || "Error retrieving wallet";

        if (info?.wallet && qrEl) {
            qrEl.innerHTML = ""; 
            
            new QRCode(qrEl, {
                text: info.wallet,
                width: 110,  
                height: 110,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });

            if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
            if (qrWrapper) qrWrapper.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error("Crypto Error:", error);
        if (walletInput) walletInput.value = "Connection Failed";
    }
}

function SetCryptoTicketStatus(message, isError = false) {
    const statusEl = document.getElementById('crypto-ticket-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove('text-gray-500');
    statusEl.classList.toggle('text-red-400', isError);
    statusEl.classList.toggle('text-hacker-blue', !isError);
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
        const msg = data?.message || (isValid ? "Ticket created successfully." : "Ticket request failed.");
        SetCryptoTicketStatus(msg, !isValid);
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
            window.location.href = 'https://work.ink/236z/sheldon';
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

        if (loginStatus) {
            await UpdateCryptoTab();
        }
    }
}

async function CryptoTestRequest() {
    await CryptoInitRequest(GetProductFromUrl());
}

window.checkLoginStatus = CheckDiscordLoginStatus;
window.CryptoTestRequest = CryptoTestRequest;

document.addEventListener('DOMContentLoaded', async () => {
    // Paypal Buttons
    {
        const paypalContainer = document.getElementById('paypal-button-container');
        if (paypalContainer && window.paypal && paypalContainer.style.display !== 'none') {
            const paypalButtons = createPayPalButtons();
            paypalButtons.render('#paypal-button-container');
        }

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
