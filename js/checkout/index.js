import { GetSessionToken, LoginDiscord } from "../auth/discord.js";
import { GetCookie, GetProducts } from "../global.js"

const params = new URLSearchParams(window.location.search);
const type = params.get('type');

(async () => {
    if (!await GetSessionToken()) {
        LoginDiscord();
    }

    const products = await GetProducts();

    let selected = products ? products[type] : null;
    if (type === "free") {
        selected = null;
    }

    if (selected != null) {
        const productNameEl = document.getElementById('product-name');
        if (productNameEl) productNameEl.textContent = selected.name;

        const priceElements = document.querySelectorAll('.total-price');
        priceElements.forEach(el => {
            el.textContent = selected.price_display;
        });
    }
})();