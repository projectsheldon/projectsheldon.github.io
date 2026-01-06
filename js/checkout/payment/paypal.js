const apiHost = (window.location.protocol === 'https:') ? 'https://localhost:8443' : 'http://localhost';

paypal.Buttons({
    style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal'
    },

    createOrder: async () => {
        try {
            const res = await fetch(`${apiHost}/sheldon/paypal/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: new URLSearchParams(window.location.search).get("type") })
            });

            console.log('createOrder response status:', res.status);
            const body = await res.text();
            let data;
            try { data = JSON.parse(body); } catch (e) { data = body; }
            console.log('createOrder response body:', data);

            if (!res.ok) throw new Error('Server returned ' + res.status);

            // If server returned an object with `id`, use it; otherwise assume body itself is the id string
            const orderId = (data && data.id) ? data.id : data;
            console.log('Returning orderId to PayPal SDK:', orderId);
            return orderId;
        } catch (err) {
            console.error('createOrder failed:', err);
            throw err;
        }
    },

    onApprove: async (data, actions) => {
        console.log('onApprove data:', data);
        try {
            const res = await fetch(`${apiHost}/sheldon/paypal/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID || data.id || data })
            });
            const details = await res.json();
            console.log('capture response:', details);
        } catch (err) {
            console.error('capture error:', err);
        }
    },

    onError: (err) => {
        console.error('PayPal Buttons error:', err);
    }

}).render('#paypal');
