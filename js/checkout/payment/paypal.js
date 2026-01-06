import { API_URL } from "../../global.js";

paypal.Buttons({
    style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

    createOrder: async () => {
        // const type = new URLSearchParams(window.location.search).get("type") || "";

        // const createRes = await fetch(`${API_URL}sheldon/paypal/create/${type}`, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" }
        // });
        // const createData = await createRes.json();
        // const orderId = createData.id;
        // console.log(JSON.stringify({ "save": "pending", id: orderId, "type": type }));

        const orderId = 123;
        const type2 = "lifetime";

        fetch(`${API_URL}sheldon/paypal/savedata`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ "save": "pending", id: orderId, "type": type2 })
        });

        return "TEMPO";
    }

}).render("#paypal");
