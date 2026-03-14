import Api from "../../util/backend.js";

const SandboxHosts = [ 'sandbox', 'test', 'localhost' ];

const PaypalManager =
{
    async GetRemoteInfo()
    {
        const apiUrl = await Api.GetApiUrl();
        const req = await fetch(`${apiUrl}/paypal/info`);
        const reqJ = await req.json();

        return reqJ;
    },
    async GetClientId() 
    {
        const info = await this.GetRemoteInfo();
        return info.clientId || '';
    },
    async GetCurrency() 
    {
        const info = await this.GetRemoteInfo();
        return info.currency || 'USD';
    },
    async IsSandbox()
    {
        const info = await this.GetRemoteInfo();
        return info.sandbox || false;
    },

    async LoadSDK()
    {
        return new Promise(async (resolve, reject) =>
        {
            const existingScript = document.getElementById("paypal-sdk-script");
            if(existingScript && window.paypal)
            {
                resolve(true);
                return;
            }

            const clientId = await this.GetClientId();
            const currency = await this.GetCurrency();
            const sandbox = await this.IsSandbox();

            if(!clientId)
            {
                resolve(false);
                return;
            }

            const baseUrl = sandbox ? 'https://www.paypal.com/sdk/js' : 'https://www.paypal.com/sdk/js';
            const script = document.createElement("script");
            script.id = "paypal-sdk-script";
            script.src = `${baseUrl}?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}`;
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error("PayPal SDK failed to load"));
            document.head.appendChild(script);
        });
    },
};
export default PaypalManager;