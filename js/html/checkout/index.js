import { CheckAuthStatus } from "../../discord/auth.js";
import PaypalManager from "../../payment/paypal/manager.js";
import { CreatePaypalButtons } from "../../payment/paypal/paypal.js";
import Api from "../../util/backend.js";

const urlParams = new URLSearchParams(window.location.search);
const productKey = urlParams.get('product') || 'lifetime';

window.selectedCurrency = 'BTC';
window.quantity = 1;
window.basePrice = 0;

const loginRequiredEl = document.getElementById('login-required');
const paymentFormEl = document.getElementById('payment-form');

document.addEventListener("DOMContentLoaded", async function()
{
    // Auth & Status
    {
        CheckAuthStatus();

        await new Promise(resolve => setTimeout(resolve, 400));

        if(window.DiscordAuth?.currentUser)
        {
            TogglePaymentForm(true);
            LoadProductInfo();
        }
        else
        {
            ShowLoginForm();
        }
    }

    // Payment Buttons
    {
        // crypto
        const payCrypto = document.getElementById('connect-wallet');
        if(payCrypto)
        {
            payCrypto.addEventListener('click', async () =>
            {
                console.log('Payment clicked - currency:', window.selectedCurrency, 'quantity:', window.quantity);
            });
        }

        // paypal
        await PaypalManager.LoadSDK();
        const paypalButtons = CreatePaypalButtons();
        await paypalButtons.render('#paypal-button-container');
    }
});

function ShowLoginForm()
{
    TogglePaymentForm(false);

    const loginBtn = document.querySelector('.discord-login-btn');
    if(loginBtn)
    {
        loginBtn.addEventListener('click', () =>
        {
            window.DiscordAuth.LoginPopup();
        });
    }

    window.addEventListener('message', function handleLogin(event)
    {
        if(event.data && event.data.type === 'discord_session')
        {
            window.DiscordAuth.SetSessionToken(event.data.token);
            CheckAuthStatus();

            setTimeout(() =>
            {
                if(window.DiscordAuth?.currentUser)
                {
                    window.removeEventListener('message', handleLogin);
                    TogglePaymentForm(true);
                    LoadProductInfo();
                }
            }, 200);
        }
    });
}
function TogglePaymentForm(enabled)
{
    if(loginRequiredEl) loginRequiredEl.style.display = enabled ? 'none' : 'flex';
    if(paymentFormEl) paymentFormEl.style.display = enabled ? 'flex' : 'none';
}

async function LoadProductInfo()
{
    if(productKey === "free")
    {
        window.location.href = "/workink";
        return;
    }

    const nameEl = document.getElementById('product-name');
    const priceEl = document.getElementById('final-price');

    try
    {
        const response = await fetch(`${await Api.GetApiUrl()}/products/get?product=${productKey}`);
        const product = await response.json();

        if(product && product.name)
        {
            if(nameEl) nameEl.textContent = product.name;
            if(priceEl) priceEl.textContent = '€' + parseFloat(product.price).toFixed(2);
            window.basePrice = parseFloat(product.price) || 0;
            window.updatePriceDisplay();
        }
    } catch(error)
    {
        console.error('Failed to load product:', error);
    }
}

window.updatePriceDisplay = function()
{
    const subtotal = window.basePrice * window.quantity;
    const amountEl = document.getElementById('amount-count');
    const subtotalEl = document.getElementById('subtotal-price');

    if(amountEl) amountEl.textContent = window.quantity;
    if(subtotalEl) subtotalEl.textContent = '€' + subtotal.toFixed(2);
};