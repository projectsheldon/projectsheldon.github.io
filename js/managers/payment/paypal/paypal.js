import DiscordApi from "../../discord/api.js"
import { GetApiUrl, SetCookie } from "../../../global.js";

export function createPayPalButtons() {
    return paypal.Buttons({
        style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

        // fundingSource: paypal.FUNDING.CARD,

createOrder: async () => {
            const type = new URLSearchParams(window.location.search).get("type") || "";
            const qtyInput = document.getElementById("reseller-qty");
            const personalUseCheckbox = document.getElementById("reseller-personal-use");
            const isPersonalUse = personalUseCheckbox?.checked === true;
            
            // If personal use is checked, quantity is 1 and not for resell
            const qty = isPersonalUse ? 1 : Math.max(1, Math.min(100, Number.parseInt(qtyInput?.value || "1", 10) || 1));
            const forResell = (() => {
                const panel = document.getElementById("reseller-bulk-panel");
                if (!panel) return false;
                // If personal use is checked, don't treat as resell
                if (isPersonalUse) return false;
                return !panel.classList.contains("hidden");
            })();

            try {
                const authUser = await DiscordApi.GetSessionInfo().catch(() => null);
                const discordIdToSend = authUser && authUser.id ? authUser.id : null;

                const createRes = await fetch(`${await GetApiUrl()}sheldon/paypal/create`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productId: type.toLowerCase(),
                        discordId: discordIdToSend,
                        quantity: qty,
                        forResell,
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
            const authUser = await DiscordApi.GetSessionInfo().catch(() => null);
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
            if (Array.isArray(captureData?.licenseKeys) && captureData.licenseKeys.length > 0) {
                // Redirect to success page with licenses
                const keysParam = encodeURIComponent(JSON.stringify(captureData.licenseKeys));
                window.location.href = `/resell/success?keys=${keysParam}`;
                return;
            }
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
