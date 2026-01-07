import { GetSessionToken } from "../../auth/discord.js";
import { GetApiUrl } from "../../global.js";

paypal.Buttons({
    style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

    createOrder: async () => {
        const type = new URLSearchParams(window.location.search).get("type") || "";

        try {
            const createRes = await fetch(`${await GetApiUrl()}sheldon/paypal/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: type,
                    discordId: GetSessionToken()
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
        const captureRes = await fetch(`${await GetApiUrl()}sheldon/paypal/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: data.orderID,
                discordId: GetSessionToken()
            })
        });

        const captureData = await captureRes.json();
        if (captureData.licenseKey) {
            // Support server returning either an object or a key string
            let key = null;
            try {
                if (typeof captureData.licenseKey === 'string') key = captureData.licenseKey;
                else if (captureData.licenseKey && typeof captureData.licenseKey === 'object') {
                    if (captureData.licenseKey.k) key = captureData.licenseKey.k;
                    else if (captureData.licenseKey.key) key = captureData.licenseKey.key;
                }
            } catch (e) {
                console.error('Error parsing licenseKey', e);
            }

            if (key) {
                // Redirect user to license display page
                window.location.href = `/license?key=${encodeURIComponent(key)}`;
                return;
            }
        }
    },

}).render("#paypal");
