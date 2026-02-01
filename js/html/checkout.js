import { GetProducts } from "../global.js";
import { createPayPalButtons } from "../managers/checkout/payment/paypal.js";
import DiscordApi from "../managers/discord/api.js";
import DiscordRender from "../managers/discord/render.js";

async function OnLoad() {
    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();

    const serverProducts = await GetProducts();

    if (type === "free") {
        window.location.href = 'https://work.ink/236z/sheldon-license';
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

async function checkLoginStatus() {
    const authUser = await DiscordApi.GetSessionInfo().catch(() => null);
    const loginOverlay = document.getElementById('login-overlay');
    const paypalContainer = document.getElementById('paypal-button-container');

    if (!authUser || !authUser.id) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        if (paypalContainer) paypalContainer.style.display = 'none';
    } else {
        if (loginOverlay) loginOverlay.classList.add('hidden');
        if (paypalContainer) paypalContainer.style.display = 'block';
        // Render PayPal buttons if not already rendered
        if (paypalContainer && window.paypal && paypalContainer.children.length === 0) {
            const paypalButtons = createPayPalButtons();
            paypalButtons.render('#paypal-button-container');
        }
    }
}

window.checkLoginStatus = checkLoginStatus;

document.addEventListener('DOMContentLoaded', async () => {
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

    await OnLoad();
    await checkLoginStatus();
});
