import { API_URL } from "../../global.js";

paypal.Buttons({
    style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

    createOrder: async () => {
        const type = new URLSearchParams(window.location.search).get("type") || "";

        const createRes = await fetch(`${API_URL}sheldon/paypal/create/${type}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const createData = await createRes.json();
        const orderId = createData.id;

        // fetch(`${API_URL}sheldon/paypal/savedata`, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ "save": "pending", id: orderId, "type": type })
        // });

        return "TEMPO";
    }

}).render("#paypal");
