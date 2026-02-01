import { GetProducts } from "../global.js";
import { createPayPalButtons } from "../managers/checkout/payment/paypal.js";

async function OnLoad() {
    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();
    
    if (type === "free") {
        window.location.href = 'https://work.ink/236z/sheldon-license';
    } else {
        const price = document.querySelector('.total-price');
        const name = document.getElementById('product-name');
        
        const products = await GetProducts();
        const product = products[type];

        let priceDisplay;

        if (typeof product.price === 'string') {
            priceDisplay = product.price;
        } else if (typeof product.price === 'number') {
            priceDisplay = `€${product.price.toFixed(2)}`;
        } else {
            priceDisplay = '-';
        }

        if (price) price.textContent = priceDisplay;
        if (name) name.textContent = product.name; 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    OnLoad();
    
    // Render PayPal buttons
    const paypalContainer = document.getElementById('paypal-button-container');
    if (paypalContainer && window.paypal) {
        const paypalButtons = createPayPalButtons();
        paypalButtons.render('#paypal-button-container');
    }
});
