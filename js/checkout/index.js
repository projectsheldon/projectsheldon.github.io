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

    // Wait for global switchMethod to be available (tabs.js may load after this module)
    const waitForSwitch = async (timeout = 2000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (typeof window.switchMethod === 'function') return window.switchMethod;
            await new Promise(r => setTimeout(r, 50));
        }
        return null;
    };

    const localSwitch = (method) => {
        // fallback copy of switchMethod logic (kept minimal)
        const paypalTab = document.getElementById('tab-paypal');
        const cryptoTab = document.getElementById('tab-crypto');
        const paypalContent = document.getElementById('content-paypal');
        const cryptoContent = document.getElementById('content-crypto');
        if (method === 'paypal') {
            paypalTab?.classList.add('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
            paypalTab?.classList.remove('border-gray-700', 'bg-hacker-black', 'text-gray-400');
            cryptoTab?.classList.add('border-gray-700', 'bg-hacker-black', 'text-gray-400');
            cryptoTab?.classList.remove('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
            paypalContent?.classList.remove('hidden');
            cryptoContent?.classList.add('hidden');
        } else {
            cryptoTab?.classList.add('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
            cryptoTab?.classList.remove('border-gray-700', 'bg-hacker-black', 'text-gray-400');
            paypalTab?.classList.add('border-gray-700', 'bg-hacker-black', 'text-gray-400');
            paypalTab?.classList.remove('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
            cryptoContent?.classList.remove('hidden');
            paypalContent?.classList.add('hidden');
        }
    };

    (async () => {
        const switchFn = await waitForSwitch();

        if (tabPaypal) tabPaypal.addEventListener('click', () => (switchFn || localSwitch)('paypal'));

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
            (switchFn || localSwitch)('crypto');
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
    })();
});