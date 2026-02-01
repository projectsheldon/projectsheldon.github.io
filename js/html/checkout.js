import { GetProducts } from "../global.js";
import { createPayPalButtons } from "../managers/checkout/payment/paypal.js";

async function OnLoad() {
    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();

    const serverProducts = await GetProducts();

    if (type === "free") {
        window.location.href = 'https://work.ink/236z/sheldon-license';
    } else {
        if (!await GetSessionToken()) {
            LoginDiscord();
        }

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

document.addEventListener('DOMContentLoaded', () => {
    OnLoad();

    const paypalContainer = document.getElementById('paypal');
    if (paypalContainer && window.paypal) {
        const paypalButtons = createPayPalButtons();
        paypalButtons.render('#paypal');
    }
});
