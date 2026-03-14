import { DiscordAuth, DiscordUser } from "../../discord/auth.js";
import Api from "../../util/backend.js";

export function CreatePaypalButtons() 
{
    if(!window.paypal)
    {
        console.log('PayPal SDK not loaded yet');
        return null;
    }
    return window.paypal.Buttons({
        style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'pay' },

        createOrder: async () => 
        {
            const user = await DiscordAuth.GetUser();
            if(!user)
            {
                window.NotifyError('Please login first');
                return null;
            }

            const discordId = user.id;
            const product = new URLSearchParams(window.location.search).get('product');

            const req = await fetch(`${await Api.GetApiUrl()}/paypal/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discordId: discordId,
                    product: product,
                    quantity: window.quantity
                })
            });
            const response = await req.json();

            if(!response.ok)
            {
                window.Notify("Your order failed. Message: " + response.message, "error");
                return;
            }

            return response.id;
        },
        onApprove: async (data, actions) => 
        {
            const orderId = data.orderID;
            
            try {
                const req = await fetch(`${await Api.GetApiUrl()}/paypal/capture`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        orderId: orderId
                    })
                });
                const response = await req.json();

                if(response.ok)
                {
                    window.NotifySuccess('Payment successful! Your license has been generated.');
                } else
                {
                    window.NotifyError('Payment failed: ' + response.message);
                }
            } catch(e)
            {
                window.NotifyError('Payment error: ' + e.message);
            }
        }
    });
}