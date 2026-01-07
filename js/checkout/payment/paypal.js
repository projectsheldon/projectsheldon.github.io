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
                body: JSON.stringify({ productId: type, discordId: GetSessionToken() })
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
            throw e; // let PayPal SDK handle the rejection
        }
    },
    onApprove: async (data, actions) => {
        const captureRes = await fetch(`${await GetApiUrl()}sheldon/paypal/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data.orderID })
        });

        const captureData = await captureRes.json();
    },

}).render("#paypal");
