import { GetSessionToken, GetSessionInfo } from "../auth/discord.js";
import { GetCookie, GetProducts } from "../global.js"

const params = new URLSearchParams(window.location.search);
const type = params.get('type');

(async () => {
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

// Ensure tab buttons respect login state for crypto
window.addEventListener('DOMContentLoaded', () => {
    const tabPaypal = document.getElementById('tab-paypal');
    const tabCrypto = document.getElementById('tab-crypto');
    const cryptoConfirm = document.getElementById('crypto-confirm-btn');

    if (tabPaypal) tabPaypal.addEventListener('click', () => switchMethod('paypal'));

    if (tabCrypto) tabCrypto.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = await GetSessionInfo().catch(() => null);
        if (!user) {
            // Ask user to login
            if (window.LoginButton) {
                await window.LoginButton();
            }
            const user2 = await GetSessionInfo().catch(() => null);
            if (!user2) {
                window.AddNotification?.('You must be logged in to use Litecoin checkout', { type: 'error' });
                return;
            }
        }
        switchMethod('crypto');
    });

    if (cryptoConfirm) cryptoConfirm.addEventListener('click', async (e) => {
        e.preventDefault();
        const user = await GetSessionInfo().catch(() => null);
        if (!user) {
            if (window.LoginButton) await window.LoginButton();
            const user2 = await GetSessionInfo().catch(() => null);
            if (!user2) {
                window.AddNotification?.('You must be logged in to confirm payment', { type: 'error' });
                return;
            }
        }
        // Proceed: instruct user to open a ticket with tx id or implement server verification here
        window.AddNotification?.('Thanks — open a ticket with your transaction id so we can verify.', { type: 'success' });
    });
});