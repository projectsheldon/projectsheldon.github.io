import { GetSessionToken, GetSessionInfo } from "../../auth/discord.js";
import { GetApiUrl, SetCookie } from "../../global.js";

function createPayPalButtons() {
    return paypal.Buttons({
        style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

        createOrder: async () => {
            const type = new URLSearchParams(window.location.search).get("type") || "";

            try {
                // try to resolve the Discord user id (not the session token)
                const authUser = await GetSessionInfo().catch(() => null);
                const discordIdToSend = authUser && authUser.id ? authUser.id : null;

                const createRes = await fetch(`${await GetApiUrl()}sheldon/paypal/create`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productId: type,
                        discordId: discordIdToSend
                    })
                });

                if (!createRes.ok) {
                    let err = null;
                    try { err = await createRes.json(); } catch (e) { }
                    window.AddNotification?.('Failed to create payment. Please try again.', { type: 'error' });
                    throw new Error('Create order failed: ' + (err && err.message ? err.message : createRes.status));
                }

                const createData = await createRes.json();
                if (!createData || !createData.id) {
                    window.AddNotification?.('Payment creation returned no order id.', { type: 'error' });
                    throw new Error('No order id returned');
                }

                return createData.id;
            } catch (e) {
                console.error('createOrder error', e);
                throw e;
            }
        },

        onApprove: async (data, actions) => {
            const authUser = await GetSessionInfo().catch(() => null);
            const discordIdToSend = authUser && authUser.id ? authUser.id : null;

            const captureRes = await fetch(`${await GetApiUrl()}sheldon/paypal/capture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: data.orderID,
                    discordId: discordIdToSend
                })
            });

            const captureData = await captureRes.json();
            if (captureData.licenseKey) {
                let key = null;
                try {
                    if (typeof captureData.licenseKey === 'string') key = captureData.licenseKey;
                    else if (captureData.licenseKey && typeof captureData.licenseKey === 'object') {
                        if (captureData.licenseKey.k) key = captureData.licenseKey.k;
                        else if (captureData.licenseKey.key) key = captureData.licenseKey.key;
                    }
                } catch (e) {
                }

                if (key) {
                    SetCookie("license", key);
                    window.location.href = `/license?key=${encodeURIComponent(key)}`;
                    return;
                }
            }
        },
    });
}

async function ensureLoggedInAndInit() {
    const container = document.getElementById('paypal');
    const authUser = await GetSessionInfo().catch(() => null);

    if (!authUser) {
        if (container) {
            container.innerHTML = `
                <div class="text-center">
                    <p class="mb-3 text-sm text-gray-300">You must be logged in with Discord to checkout.</p>
                    <button id="checkout-login-btn" class="px-4 py-2 bg-hacker-blue text-white rounded">Login with Discord</button>
                </div>`;
            const btn = document.getElementById('checkout-login-btn');
            if (btn) btn.addEventListener('click', async () => {
                try {
                    if (window.LoginButton) await window.LoginButton();
                    const u = await GetSessionInfo().catch(() => null);
                    if (u) {
                        // replace container and initialize PayPal
                        container.innerHTML = '<div id="paypal-buttons-container"></div>';
                        createPayPalButtons().render('#paypal');
                    } else {
                        window.AddNotification?.('Login failed or was cancelled', { type: 'error' });
                    }
                } catch (e) {
                    console.error('Login/init error', e);
                    window.AddNotification?.('Login failed', { type: 'error' });
                }
            });
        }
        return;
    }

    // already logged in -> init
    createPayPalButtons().render('#paypal');
}

ensureLoggedInAndInit();
