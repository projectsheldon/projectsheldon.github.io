import { Product } from "../../products/manager.js";
import { DiscordAuth, CheckAuthStatus } from "../../discord/auth.js";
import RedirectToPlatform from "../../util/redirect.js";

// Check login status
CheckAuthStatus();

const urlParams = new URLSearchParams(window.location.search);
const productKey = urlParams.get('product') || 'lifetime';

async function LoadProduct()
{
    if(productKey == "free")
    {
        await RedirectToPlatform("workink", false);
    }
    else
    {
        const nameEl = document.getElementById('product-name');
        const priceEl = document.getElementById('final-price');

        const response = await fetch('http://localhost:3350/products/get?product=' + productKey);
        const product = await response.json();

        if(product && product.name)
        {
            if(nameEl) nameEl.textContent = product.name;
            if(priceEl) priceEl.textContent = '€' + parseFloat(product.price).toFixed(2);
            window.basePrice = parseFloat(product.price) || 0;
            window.updatePriceDisplay();
        }
    }
}

LoadProduct();
window.updatePriceDisplay();

// payment
document.getElementById("connect-wallet").addEventListener("click", async function() {
    alert("fahh");
});