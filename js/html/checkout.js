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

async function OnLoad() {
    const loginStatus = await CheckDiscordLoginStatus();

    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();

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
    }
}

window.checkLoginStatus = CheckDiscordLoginStatus;

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

    await OnLoad();
});