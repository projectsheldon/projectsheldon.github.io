import { API_URL } from "../../global.js";

paypal.Buttons({
    style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

    createOrder: async () => {
        const type = new URLSearchParams(window.location.search).get("type") || "";

        const createRes = await fetch(`${API_URL}sheldon/paypal/create`, {
            body: {
                productId: type,
                discordId: "0"
            }
        });
        const createData = await createRes.json();
        return createData.id;
    },
    onApprove: async (data, actions) => {
        const captureRes = await fetch(`${API_URL}sheldon/paypal/capture`, {
            body: JSON.stringify({ id: data.orderID })
        });

        const captureData = await captureRes.json();
    },

}).render("#paypal");
