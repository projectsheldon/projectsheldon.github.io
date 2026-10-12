import { CheckAuthStatus, DiscordAuth } from "../../discord/auth.js";
import { initStripe } from "../../payment/stripe/stripe.js";
import Api from "../../util/backend.js";
import { ensureChecksOrNotify } from "../../util/guard.js";

// Lazily loaded (see frontpage/index.js): a blocked static fingerprint import
// used to kill this whole module, leaving checkout dead for adblock users.
async function loadIdentityPayloadSafe()
{
    try
    {
        const mod = await import("../../util/device.js");
        if(mod && typeof mod.GetIdentityPayload === 'function') return await mod.GetIdentityPayload();
    }
    catch(e) {}
    return new URLSearchParams();
}

window.Api = Api;

const urlParams = new URLSearchParams(window.location.search);
const productKey = urlParams.get('product') || 'lifetime';
window.productKey = productKey;

const loginRequiredEl = document.getElementById('login-required');
const paymentFormEl = document.getElementById('payment-form');
const personalUseSection = document.getElementById('personal-use-section');

document.addEventListener('DOMContentLoaded', async function() {
    await LoadProductInfo();
    if (window.productUnavailable) return;

    const isLoggedIn = await CheckAuthStatus();

    if (isLoggedIn) {
        await ShowCheckout();
        return;
    }

    ShowLoginForm();
});

async function CheckResellerStatus() {
    const token = DiscordAuth.GetSessionToken();
    if (!token) return;

    try {
        localStorage.removeItem('cache_is_reseller');
        const response = await fetch(`${await Api.GetApiUrl()}/resellers/is-reseller`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.ok && data.isReseller) {
            window.isReseller = true;
            if (personalUseSection) {
                personalUseSection.classList.remove('hidden');
                const checkbox = document.getElementById('personal-use-checkbox');
                if (checkbox) {
                    checkbox.checked = window.personalUse;
                }
            }
            await CheckPlanBStatus();
            await window.fetchPriceFromApi();
        }
    } catch (error) {
    }
}

async function CheckPlanBStatus() {
    const token = DiscordAuth.GetSessionToken();
    if (!token) return;

    try {
        const response = await fetch(`${await Api.GetApiUrl()}/resellers/plan-b/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        window.planBEnabled = !!(data.ok && data.planB === true);
        window.planBCoinList = (data.ok && data.settings?.coins) || [];

        const planbSection = document.getElementById('planb-section');
        const ticketSection = document.getElementById('ticket-section');

        if (window.planBEnabled && planbSection) {
            // Plan B reseller: hide the resale toggle + classic ticket, show crypto flow.
            if (personalUseSection) personalUseSection.style.display = 'none';
            if (ticketSection) ticketSection.style.display = 'none';
            planbSection.style.display = 'block';
            SetupPlanB();
        }
    } catch (error) {
    }
}

function SetupPlanB() {
    const paidBtn = document.getElementById('planb-paid-btn');
    const submitBtn = document.getElementById('planb-submit-btn');
    const walletsEl = document.getElementById('planb-wallets');
    const coinSelect = document.getElementById('planb-coin-select');
    if (!walletsEl || !coinSelect) return;

    const coins = window.planBCoinList || [];

    // Refresh the on-screen amounts whenever the quantity changes.
    const refreshAmounts = () => window.refreshPlanBQuote();
    const qtyValue = document.getElementById('qty-value');
    qtyValue?.addEventListener('change', refreshAmounts);
    document.getElementById('qty-plus')?.addEventListener('click', refreshAmounts);
    document.getElementById('qty-minus')?.addEventListener('click', refreshAmounts);

    window.refreshPlanBQuote = async function() {
        const token = DiscordAuth.GetSessionToken();
        if (!token) return;
        try {
            const apiUrl = await Api.GetApiUrl();
            const qty = parseInt(qtyValue?.value || window.quantity || '1', 10);
            const res = await fetch(`${apiUrl}/resellers/plan-b/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ product_key: productKey, quantity: qty, coin: coins[0]?.coin || '' })
            });
            const data = await res.json();
            if (!data.ok || !data.coins) return;
            const quoteCoins = data.coins;
            walletsEl.innerHTML = quoteCoins.map(c => `
                <div class="crypto-option" data-coin="${escAttr(c.coin)}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;cursor:pointer;" onclick="window.copyPlanBWallet('${escAttr(c.coin)}')">
                    <span style="font-weight:800;color:#c7b18f;font-size:12px;">${esc(c.coin)}</span>
                    <span style="font-size:11px;color:rgba(255,255,255,0.9);font-weight:600;white-space:nowrap;">${c.coinAmount != null ? esc(String(c.coinAmount)) + ' ' + esc(c.coin) : '–'}</span>
                    <span style="font-family:monospace;font-size:11px;color:rgba(255,255,255,0.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.address)}</span>
                    <span style="font-size:10px;color:rgba(255,255,255,0.4);white-space:nowrap;">COPY</span>
                </div>
            `).join('');
        } catch (e) {}
    };

    coinSelect.innerHTML = coins.map(c =>
        `<option value="${escAttr(c.coin)}">${esc(c.coin)}</option>`
    ).join('');

    window.copyPlanBWallet = function(coin) {
        const info = coins.find(c => c.coin === coin);
        if (!info) return;
        try { navigator.clipboard.writeText(info.address || ''); } catch (e) {}
        const statusEl = document.getElementById('planb-status');
        if (statusEl) {
            statusEl.style.cssText = 'display:block;margin-top:10px;padding:10px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.2);';
            statusEl.textContent = `${coin} wallet copied to clipboard.`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 2500);
        }
    };

    refreshAmounts();

    if (paidBtn) paidBtn.addEventListener('click', function() {
        document.getElementById('planb-step-pay').style.display = 'none';
        document.getElementById('planb-step-submit').style.display = 'block';
    });

    if (submitBtn) submitBtn.addEventListener('click', SubmitPlanB);
}

function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'
    }[c]));
}

async function SubmitPlanB() {
    const submitBtn = document.getElementById('planb-submit-btn');
    const statusEl = document.getElementById('planb-status');
    const resultEl = document.getElementById('planb-result');

    const coin = document.getElementById('planb-coin-select')?.value || '';
    const txHash = document.getElementById('planb-tx-hash')?.value?.trim() || '';
    const proofFile = document.getElementById('planb-proof')?.files?.[0];
    const customerDiscord = document.getElementById('planb-customer')?.value?.trim() || '';
    const saleProvider = document.getElementById('planb-sale-provider')?.value || 'manual';
    const saleTx = document.getElementById('planb-sale-tx')?.value?.trim() || '';

    if (!coin) { showPlanBError('Select the coin you paid with.'); return; }
    if (!txHash) { showPlanBError('Enter the transaction hash or explorer URL.'); return; }
    if (!proofFile) { showPlanBError('Upload a screenshot as payment proof.'); return; }
    // Buyer info is optional: shops using the sale webhook auto-link the sale.
    // DM sellers: fill it in so your key traces back to the buyer.

    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="install-spinner" style="border-top-color: #000;"></div> Verifying...';
    if (statusEl) statusEl.style.display = 'none';

    try {
        const token = DiscordAuth.GetSessionToken();
        if (!token) { showPlanBError('You must be logged in.'); submitBtn.disabled = false; submitBtn.innerHTML = originalText; return; }

        const apiUrl = await Api.GetApiUrl();
        const qty = parseInt(document.getElementById('qty-value')?.value || '1', 10);

        // Step 1: create the order (server computes the price + quotes the coin amount).
        const createRes = await fetch(`${apiUrl}/resellers/plan-b/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ product_key: productKey, quantity: qty, coin, customer_discord: customerDiscord, sale_provider: saleProvider, sale_tx: saleTx })
        });
        const createData = await createRes.json();
        if (!createData.ok) {
            showPlanBError(createData.message || 'Failed to start order.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        // Step 2: submit proof as multipart (order_id + proof image + tx info).
        const form = new FormData();
        form.append('order_id', createData.order.order_id);
        form.append('coin', coin);
        form.append('tx_hash', txHash);
        form.append('tx_url', txHash);
        form.append('proof', proofFile);

        const submitRes = await fetch(`${apiUrl}/resellers/plan-b/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });
        const submitData = await submitRes.json();

        if (statusEl) statusEl.style.display = 'none';
        if (submitData.ok) {
            const ver = submitData.verification || {};
            if (resultEl) {
                resultEl.style.cssText = 'display:block;margin-top:12px;padding:12px 14px;border-radius:10px;font-size:12px;font-weight:600;line-height:1.5;background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.2);';
                resultEl.innerHTML = `<strong>${submitData.message || 'Order submitted!'}</strong><br>${ver.status === 'valid' ? 'Your licenses will be delivered in the ticket created on Discord.' : 'An admin will review the payment manually.'}`;
            }
            submitBtn.innerHTML = 'Submitted';
            submitBtn.style.background = 'rgba(34,197,94,0.2)';
            submitBtn.style.color = '#22c55e';
            submitBtn.style.cursor = 'default';
        } else {
            showPlanBError(submitData.message || 'Failed to submit proof. Please make a ticket on Discord.');
            if (resultEl) {
                resultEl.style.cssText = 'display:block;margin-top:12px;padding:12px 14px;border-radius:10px;font-size:12px;font-weight:600;line-height:1.5;background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.2);';
                resultEl.textContent = submitData.message || 'Could not verify payment. Open a ticket on Discord if you believe this is a mistake.';
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (err) {
        console.error('Plan B submit failed:', err);
        showPlanBError('Something went wrong submitting your proof. Please try again.');
        const statusEl2 = document.getElementById('planb-status');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function showPlanBError(msg) {
    const statusEl = document.getElementById('planb-status');
    if (statusEl) {
        statusEl.style.cssText = 'display:block;margin-top:10px;padding:10px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);';
        statusEl.textContent = msg;
    }
}

function ShowLoginForm() {
    TogglePaymentForm(false);

    const loginBtn = loginRequiredEl?.querySelector('.discord-login-btn');
    if (loginBtn && !loginBtn.dataset.sheldonBound) {
        // Bound flag stops the topbar delegated handler double-firing; this is a fallback.
        loginBtn.dataset.sheldonBound = '1';
        loginBtn.addEventListener('click', async () => {
            if (loginBtn.classList.contains('is-loading')) return;
            if (window._discordLoginPopupOpen) {
                const ov = document.getElementById('discord-app-overlay');
                if (ov){ try{ ov.querySelector('button')?.focus(); }catch (e){} return; }
            }
            loginBtn.classList.add('is-loading');
            try { await window.DiscordAuth.LoginPopup(); } catch (e) {}
            finally { loginBtn.classList.remove('is-loading'); }
        });
    }

    window.addEventListener('message', async function handleLogin(event) {
        // Reject cross-origin messages so an attacker window can't plant a session token.
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'discord_session') {
            window.DiscordAuth.SetSessionToken(event.data.token);
            const isLoggedIn = await CheckAuthStatus();

            if (isLoggedIn) {
                window.removeEventListener('message', handleLogin);
                await ShowCheckout();
            }
        }
    });
}
function TogglePaymentForm(enabled) {
    if (loginRequiredEl) loginRequiredEl.style.display = enabled ? 'none' : 'flex';
    if (paymentFormEl) paymentFormEl.style.display = enabled ? 'flex' : 'none';
}

function UpdateLicensePerksNote() {
    // Perks note removed from checkout by request – hide any stale element
    // (e.g. cached HTML) so no watermark / Discord-role copy renders here.
    // Frontpage pricing cards still document the differences.
    const noteEl = document.getElementById('license-perks-note');
    if (noteEl) noteEl.remove();
}

async function LoadProductInfo() {
    UpdateLicensePerksNote();
    if (productKey === "free") {
        const nameEl = document.getElementById('product-name');
        if (nameEl) nameEl.textContent = 'Free Key';

        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const subtotalRow = document.getElementById('subtotal-price')?.parentElement;
            if (subtotalRow) subtotalRow.style.display = 'none';
            const discountRow = document.getElementById('discount-row');
            if (discountRow) discountRow.style.display = 'none';
            const couponSection = document.getElementById('coupon-section');
            if (couponSection) couponSection.style.display = 'none';
        }

        try
        {
            const response = await fetch(`${await Api.GetApiUrl()}/products/get?product=free`);
            if (!response.ok) { ShowProductUnavailable(); return; }
            const product = await response.json();
            if (product && product.price) {
                window.basePrice = parseFloat(product.price) || 0.9;
                const totalEl = document.getElementById('final-total-price');
                if (totalEl) totalEl.textContent = `${(window.basePrice * window.quantity).toFixed(1)} Balance`;
            }
        } catch (e) {
            ShowProductUnavailable();
        }

        return;
    }

    const nameEl = document.getElementById('product-name');
    const priceEl = document.getElementById('final-price');

    try
    {
        const response = await fetch(`${await Api.GetApiUrl()}/products/get?product=${productKey}`);
        if (response.status === 404) { ShowProductUnavailable(); return; }
        const product = await response.json();

        if (product && product.name) {
            if (nameEl) nameEl.textContent = product.name;
            if (priceEl) priceEl.textContent = '€' + parseFloat(product.price).toFixed(2);
            window.basePrice = parseFloat(product.price) || 0;
            await window.fetchPriceFromApi();
        }
        else
        {
            // Unknown / stale product key (e.g. an old ?product=… link) – no product data.
            ShowProductUnavailable();
        }
    } catch (error) {
        console.error('Failed to load product:', error);
        ShowProductUnavailable();
    }
}

// Covers stale product links and backend outages, no buttons left hanging.
function ShowProductUnavailable() {
    if (window.productUnavailable) return;
    window.productUnavailable = true;

    const loginEl = document.getElementById('login-required');
    TogglePaymentForm(false); // hides payment form – note this re-shows login-required, so hide it after
    if (loginEl) loginEl.style.display = 'none';
    const ticket = document.getElementById('ticket-section');
    if (ticket) ticket.style.display = 'none';

    const existing = document.getElementById('product-unavailable-card');
    if (existing) existing.remove();

    const mainContent = document.querySelector('.main-content');
    const card = document.createElement('div');
    card.id = 'product-unavailable-card';
    card.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'min-height:400px;text-align:center;padding:40px;';

    const title = document.createElement('h2');
    title.textContent = 'Product unavailable';
    title.style.cssText = 'font-size:20px;font-weight:800;color:#fff;margin-bottom:10px;';

    const body = document.createElement('p');
    body.textContent = "This product can't be found right now. The listed products are always up to date on the homepage.";
    body.style.cssText = 'color:rgba(255,255,255,0.55);font-size:13px;line-height:1.6;margin-bottom:24px;max-width:420px;';

    const backBtn = document.createElement('a');
    backBtn.href = '/#pricing';
    backBtn.textContent = 'View available products';
    backBtn.style.cssText = 'background:#c7b18f;color:#050505;border:none;border-radius:10px;padding:12px 26px;' +
        'font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;text-decoration:none;';
    backBtn.addEventListener('mouseenter', () => backBtn.style.background = '#d9c29e');
    backBtn.addEventListener('mouseleave', () => backBtn.style.background = '#c7b18f');

    card.append(title, body, backBtn);

    if (mainContent) mainContent.prepend(card);
}

function HideProductUnavailable() {
    window.productUnavailable = false;
    const card = document.getElementById('product-unavailable-card');
    if (card) card.remove();
}

async function ShowCheckout() {
    const ticketSection = document.getElementById('ticket-section');
    if (ticketSection) ticketSection.style.display = 'none';
    
    TogglePaymentForm(true);

    if (productKey === 'free') {
        await ShowBalanceCheckout();
        return;
    }
    
    SetupTicketButton();

    if (ticketSection) ticketSection.style.display = 'block';
    await CheckResellerStatus();
}

function SetupTicketButton() {
    const createBtn = document.getElementById('create-ticket-btn');
    if (!createBtn) return;

    createBtn.addEventListener('click', function() {
        const modal = document.getElementById('ticket-modal');
        if (modal) modal.classList.remove('hidden');
    });

    SetupTicketModal();
}

function SetupTicketModal() {
    const modal = document.getElementById('ticket-modal');
    const checkbox = document.getElementById('ticket-confirm-checkbox');
    const confirmBtn = document.getElementById('ticket-confirm-btn');
    const closeBtn = document.getElementById('ticket-modal-close');
    if (!modal || !checkbox || !confirmBtn) return;

    const FILL_DURATION = 3000;
    let fillTimer = null;
    let filling = false;

    function resetFill() {
        filling = false;
        if (fillTimer) {
            clearTimeout(fillTimer);
            fillTimer = null;
        }
        confirmBtn.classList.remove('filling', 'armed');
        void confirmBtn.offsetWidth;
        confirmBtn.disabled = true;
    }

    function closeModal() {
        checkbox.checked = false;
        resetFill();
        modal.classList.add('hidden');
    }

    checkbox.addEventListener('change', function() {
        if (!checkbox.checked) {
            resetFill();
            return;
        }

        confirmBtn.disabled = false;
        confirmBtn.classList.add('filling');
        filling = true;
        fillTimer = setTimeout(function() {
            fillTimer = null;
            if (!filling) return;
            // Fill completed: arm the button. No auto ticket – the user clicks to confirm.
            filling = false;
            confirmBtn.classList.add('armed');
        }, FILL_DURATION);
    });

    confirmBtn.addEventListener('click', function(e) {
        if (filling || confirmBtn.disabled) {
            e.preventDefault();
            return;
        }

        closeModal();
        CreatePurchaseTicket();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });
}

async function CreatePurchaseTicket() {
    const createBtn = document.getElementById('create-ticket-btn');
    if (!createBtn) return;

    const statusEl = document.getElementById('ticket-status');
    const originalText = createBtn.innerHTML;

    createBtn.disabled = true;
    createBtn.innerHTML = '<div class="install-spinner" style="border-top-color: #000;"></div> Creating...';
    if (statusEl) { statusEl.style.display = 'none'; }

    try
    {
        const token = window.DiscordAuth?.GetSessionToken();
        if (!token) {
            if (statusEl) {
                statusEl.style.cssText = 'display: block; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
                statusEl.textContent = 'You must be logged in to create a ticket.';
            }
            return;
        }

        const apiUrl = await Api.GetApiUrl();
        const qty = parseInt(document.getElementById('qty-value')?.value || '1', 10);

        const res = await fetch(`${apiUrl}/discord/create-purchase-ticket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                product: productKey,
                quantity: qty,
                is_personal_use: window.personalUse || false,
                coupon_code: window.couponCode || undefined
            })
        });

        const data = await res.json();

        if (data.ok) {
            createBtn.innerHTML = 'Ticket Created';
            createBtn.style.background = 'rgba(34,197,94,0.2)';
            createBtn.style.color = '#22c55e';
            createBtn.style.cursor = 'default';
        }
        else
        {
            if (statusEl) {
                statusEl.style.cssText = 'display: block; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
                statusEl.textContent = data.message || 'Failed to create ticket.';
            }
            createBtn.innerHTML = originalText;
            createBtn.disabled = false;
        }
    } catch (err) {
        const statusEl = document.getElementById('ticket-status');
        if (statusEl) {
            statusEl.style.cssText = 'display: block; margin-top: 12px; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2);';
            statusEl.textContent = 'Failed to create ticket. Please try again.';
        }
        createBtn.innerHTML = originalText;
        createBtn.disabled = false;
    }
}

function renderBalanceState(message, action) {
    const paymentForm = document.getElementById('payment-form');
    if (!paymentForm) return;

    let btn = '';
    if (action === 'login') btn = '<button id="balance-login-btn" class="btn-action" style="max-width:300px;padding-top:15px;padding-bottom:15px;">Log in with Discord</button>';
    else if (action === 'retry') btn = '<button id="balance-retry-btn" class="btn-action" style="max-width:300px;padding-top:15px;padding-bottom:15px;">Try Again</button>';

    paymentForm.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;width:100%;text-align:center;gap:22px;">
            <div style="font-size:15px;color:rgba(255,255,255,0.7);max-width:82%;line-height:1.45;">${message}</div>
            ${btn}
        </div>`;

    const loginBtn = document.getElementById('balance-login-btn');
    if (loginBtn) loginBtn.addEventListener('click', () => { try { window.DiscordAuth.LoginPopup(); } catch (e) {} });
    const retryBtn = document.getElementById('balance-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => { ShowBalanceCheckout(); });
}

// XSS helper for the ad-provider UI: window.Notify renders its message as HTML,
// so every backend message must be escaped before it reaches Notify. The modal
// DOM itself uses textContent / createElement only – never innerHTML with
// remote data.
function escapeHtmlAd(s)
{
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'
    }[c]));
}

function notifyAd(message, type, ms)
{
    try
    {
        if(typeof window.Notify === 'function') window.Notify(escapeHtmlAd(message), type || 'info', ms || 5000);
    }
    catch(e) {}
}

// Shared ad-button label – the same copy the old direct WorkInk link used, so
// the noCooldown / firstAdBoosted logic never drifts between button and modal.
function getAdButtonLabel(noCooldown, firstAdBoosted, adRewardBalance)
{
    if(noCooldown) return 'Watch Ads for 1 Free Key';
    if(firstAdBoosted) return 'Watch 1 Ad for your First Key';
    return `Watch Ads for +${adRewardBalance} balance`;
}

let adModalPollTimer = null;
let adModalTimeoutTimer = null;
let adModalEscapeHandler = null;
let adModalCtx = null;

function stopLootlabsPoll()
{
    if(adModalPollTimer) { clearInterval(adModalPollTimer); adModalPollTimer = null; }
    if(adModalTimeoutTimer) { clearTimeout(adModalTimeoutTimer); adModalTimeoutTimer = null; }
}

function closeAdProviderModal()
{
    stopLootlabsPoll();
    adModalCtx = null;
    if(adModalEscapeHandler)
    {
        try { document.removeEventListener('keydown', adModalEscapeHandler); } catch(e) {}
        adModalEscapeHandler = null;
    }
    try { document.getElementById('ad-provider-modal')?.remove(); } catch(e) {}
}

function ensureAdModalStyle()
{
    if(document.getElementById('ad-provider-modal-style')) return;
    const st = document.createElement('style');
    st.id = 'ad-provider-modal-style';
    // Static site, no build step – modal CSS lives here. V4 glow squares:
    // two equal squares with subtle provider-tinted fills, logos centered,
    // hover lift + colored ring. Stacked on narrow screens.
    st.textContent = '#ad-provider-providers{display:flex;gap:16px;justify-content:center;margin-top:20px;}' +
        '#ad-provider-providers .ad-sq{width:180px;height:150px;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;}' +
        '#ad-provider-providers .ad-sq.wi{background:rgba(199,177,143,0.07);border:1px solid rgba(199,177,143,0.22);}' +
        '#ad-provider-providers .ad-sq.ll{background:rgba(129,140,248,0.08);border:1px solid rgba(129,140,248,0.25);}' +
        '#ad-provider-providers .ad-sq.wi img{width:64px;height:64px;border-radius:50%;object-fit:contain;display:block;border:none;background:none;pointer-events:none;}' +
        '#ad-provider-providers .ad-sq.ll img{width:150px;height:auto;object-fit:contain;display:block;border:none;background:none;pointer-events:none;}' +
        '#ad-provider-providers .ad-sq.wi:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.5),0 0 0 2px rgba(199,177,143,0.7);}' +
        '#ad-provider-providers .ad-sq.ll:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,0.5),0 0 0 2px rgba(129,140,248,0.7);}' +
        '#ad-provider-providers .ad-sq:focus-visible{outline:none;}' +
        '#ad-provider-providers .ad-sq.wi:focus-visible{box-shadow:0 0 0 2px rgba(199,177,143,0.7);}' +
        '#ad-provider-providers .ad-sq.ll:focus-visible{box-shadow:0 0 0 2px rgba(129,140,248,0.7);}' +
        '@media (max-width:460px){#ad-provider-providers{flex-direction:column;align-items:center;}}';
    document.head.appendChild(st);
}

function isHttpUrl(u)
{
    return typeof u === 'string' && /^https?:\/\//i.test(u);
}

// V4 glow-square provider button: equal 180x150 squares with subtle
// provider-tinted fills, logo centered (workink 64px, lootlabs 150px wide),
// hover lift + colored ring via CSS. No visible button text – state rides on
// title/aria-label only. If the logo file is missing, the onerror fallback
// hides the <img> and shows a borderless square letter tile.
function makeProviderLogoButton(name, logoSrc, fallbackLetter, fallbackStyle, variant)
{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = name;
    btn.setAttribute('aria-label', name);
    btn.className = 'ad-sq ' + (variant || '');
    const img = document.createElement('img');
    img.alt = name;
    img.src = logoSrc;
    img.draggable = false;
    const fallback = document.createElement('div');
    fallback.textContent = fallbackLetter;
    fallback.setAttribute('aria-hidden', 'true');
    fallback.style.cssText = 'display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:44px;font-weight:900;border:none;background:none;box-shadow:none;' + fallbackStyle;
    img.addEventListener('error', () =>
    {
        img.style.display = 'none';
        fallback.style.display = 'flex';
    });
    btn.append(img, fallback);
    return btn;
}

function setProviderBtnLabel(btn, name, stateLabel)
{
    try
    {
        const label = stateLabel ? `${name} – ${stateLabel}` : name;
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }
    catch(e) {}
}

// Ad-provider picker modal. Docs: this is the ad-link slot for renderCheckout()
// below – the old direct <a href=workinkLink> became the #watch-ads-btn button
// that opens this modal, so WorkInk keeps its existing link flow and LootLabs
// runs start -> same-tab task -> homepage auto-claim. The LootLabs task URL
// always comes from POST /lootlabs/start (never hardcoded in JS).
function openAdProviderModal(opts)
{
    opts = opts || {};
    const workinkLink = opts.workinkLink || '';
    const apiUrl = opts.apiUrl || '';
    const authToken = opts.authToken || '';

    closeAdProviderModal();
    ensureAdModalStyle();

    const overlay = document.createElement('div');
    overlay.id = 'ad-provider-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10005;background:rgba(0,0,0,0.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#141414;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:22px 30px 30px;width:min(520px,calc(100vw - 40px));max-height:calc(100vh - 60px);overflow-y:auto;text-align:center;box-shadow:0 20px 70px rgba(0,0,0,0.65);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';

    const title = document.createElement('div');
    title.textContent = 'Watch Ads';
    title.style.cssText = 'font-size:15px;font-weight:800;color:#fff;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.4);font-size:24px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px;';

    // No subtitle – title only per design feedback.

    const providers = document.createElement('div');
    providers.id = 'ad-provider-providers';
    providers.style.cssText = 'display:flex;gap:16px;justify-content:center;margin-top:20px;';

    // Provider logo buttons – WorkInk keeps its existing link flow, LootLabs
    // runs start -> same-tab task -> homepage auto-claim. The claim row below
    // is kept only as an inert fallback and is never shown in the same-tab flow.
    // Fallbacks are borderless square letter tiles (no rect, no border).
    const wiBtn = makeProviderLogoButton('WorkInk', '/checkout/assets/workink-logo.png', 'W',
        'color:#c7b18f;', 'wi');
    const llBtn = makeProviderLogoButton('LootLabs', '/checkout/assets/lootlabs-logo.png', 'L',
        'color:#a5b4fc;', 'll');

    const status = document.createElement('div');
    status.id = 'ad-provider-status';
    status.style.cssText = 'display:none;margin-top:14px;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.65);';

    const claimRow = document.createElement('div');
    claimRow.style.cssText = 'display:none;margin-top:12px;gap:8px;justify-content:center;flex-wrap:wrap;';
    const claimBtn = document.createElement('button');
    claimBtn.textContent = 'Claim reward';
    claimBtn.disabled = true;
    claimBtn.style.cssText = 'flex:1;min-width:140px;padding:11px 0;border-radius:10px;border:none;background:#22c55e;color:#050505;font-size:11px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;cursor:pointer;opacity:0.5;';
    const reopenBtn = document.createElement('button');
    reopenBtn.textContent = 'Re-open task';
    reopenBtn.style.cssText = 'display:none;flex:1;min-width:140px;padding:11px 0;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;cursor:pointer;';

    providers.append(wiBtn, llBtn);
    claimRow.append(claimBtn, reopenBtn);
    header.append(title, closeBtn);
    card.append(header, providers, status, claimRow);
    overlay.append(card);
    document.body.appendChild(overlay);

    adModalCtx = { apiUrl, authToken, clickId: null, taskUrl: null, claiming: false,
        statusEl: status, claimRowEl: claimRow, claimBtnEl: claimBtn,
        reopenBtnEl: reopenBtn, wiBtnEl: wiBtn, llBtnEl: llBtn };

    const close = () => closeAdProviderModal();
    overlay.addEventListener('click', (e) => { if(e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    adModalEscapeHandler = (e) => { if(e.key === 'Escape') close(); };
    document.addEventListener('keydown', adModalEscapeHandler);

    wiBtn.addEventListener('click', () =>
    {
        if(!isHttpUrl(workinkLink))
        {
            notifyAd('Ad link is unavailable right now – please try again later.', 'error');
            return;
        }
        try { window.location.href = workinkLink; } catch(e) {}
    });

    llBtn.addEventListener('click', () => { startLootlabsFlow(adModalCtx); });
    claimBtn.addEventListener('click', () => { claimLootlabsReward(adModalCtx); });
    reopenBtn.addEventListener('click', () =>
    {
        if(adModalCtx && isHttpUrl(adModalCtx.taskUrl))
        {
            try { window.location.href = adModalCtx.taskUrl; } catch(e) {}
        }
    });

    return overlay;
}

// Form-urlencoded bodies keep these CORS-simple (no preflight), same as the
// frontpage workink/generate call.
async function startLootlabsFlow(ctx)
{
    if(!ctx) return;
    const { apiUrl, authToken, statusEl, claimRowEl, claimBtnEl, reopenBtnEl, wiBtnEl, llBtnEl } = ctx;
    if(!apiUrl || !authToken)
    {
        notifyAd('You must be logged in to use LootLabs.', 'error');
        return;
    }

    stopLootlabsPoll();
    ctx.clickId = null;
    wiBtnEl.disabled = true;
    llBtnEl.disabled = true;
    wiBtnEl.style.opacity = '0.5';
    llBtnEl.style.opacity = '0.5';
    setProviderBtnLabel(llBtnEl, 'LootLabs', 'starting');
    claimRowEl.style.display = 'none';
    reopenBtnEl.style.display = 'none';
    statusEl.style.display = 'block';
    statusEl.textContent = 'Starting LootLabs task…';

    try
    {
        const body = new URLSearchParams();
        body.set('sessionToken', authToken);
        try
        {
            const identity = await loadIdentityPayloadSafe();
            for(const [k, v] of identity.entries()) body.set(k, v);
        }
        catch(e) {}

        const res = await fetch(`${apiUrl}/lootlabs/start`, {
            method: 'POST',
            body,
            credentials: 'include'
        });
        const data = await res.json().catch(() => null);

        if(!data || !data.ok || !data.url || !data.click_id)
        {
            const msg = (data && data.message) || 'Could not start the LootLabs task. Please try again.';
            statusEl.textContent = msg;
            notifyAd(msg, 'error');
            wiBtnEl.disabled = false;
            llBtnEl.disabled = false;
            wiBtnEl.style.opacity = '1';
            llBtnEl.style.opacity = '1';
            setProviderBtnLabel(llBtnEl, 'LootLabs', null);
            return;
        }

        ctx.taskUrl = String(data.url);
        ctx.clickId = String(data.click_id);
        // Same-tab flow: sessionStorage survives the LootLabs round-trip in the
        // current tab; localStorage mirrors it for safety. Stored as JSON with
        // a timestamp so the homepage can expire abandoned flows (6h TTL).
        try { sessionStorage.setItem('sheldon_lootlabs_pending', JSON.stringify({ click_id: String(data.click_id), ts: Date.now() })); } catch(e) {}
        try { localStorage.setItem('sheldon_lootlabs_pending', JSON.stringify({ click_id: String(data.click_id), ts: Date.now() })); } catch(e) {}
        if(!isHttpUrl(ctx.taskUrl))
        {
            statusEl.textContent = 'Could not start task. Please try again.';
            wiBtnEl.disabled = false;
            llBtnEl.disabled = false;
            wiBtnEl.style.opacity = '1';
            llBtnEl.style.opacity = '1';
            setProviderBtnLabel(llBtnEl, 'LootLabs', null);
            return;
        }
        // Same-tab navigation: the LootLabs wall returns to the homepage
        // (bare homepage or ?lootlabs=* marker both work) where the return
        // handler auto-claims. No "Waiting for completion" polling here.
        statusEl.textContent = 'Opening LootLabs task…';
        setProviderBtnLabel(llBtnEl, 'LootLabs', 'opening');
        try { window.location.href = ctx.taskUrl; } catch(e) {}
        return;
    }
    catch(err)
    {
        statusEl.textContent = 'Could not start the LootLabs task. Please try again.';
        notifyAd('Could not start the LootLabs task. Please try again.', 'error');
        wiBtnEl.disabled = false;
        llBtnEl.disabled = false;
        wiBtnEl.style.opacity = '1';
        llBtnEl.style.opacity = '1';
        setProviderBtnLabel(llBtnEl, 'LootLabs', null);
    }
}

function startLootlabsPoll(ctx)
{
    stopLootlabsPoll();
    if(!ctx || !ctx.clickId) return;
    const MAX_MS = 10 * 60 * 1000;
    const startedAt = Date.now();

    const setExpired = (msg) =>
    {
        stopLootlabsPoll();
        if(!ctx.statusEl || !document.body.contains(ctx.statusEl)) return;
        ctx.statusEl.textContent = msg;
        notifyAd(msg, 'warning', 6000);
        ctx.claimBtnEl.disabled = true;
        ctx.claimBtnEl.style.opacity = '0.5';
        ctx.claimBtnEl.textContent = 'Claim reward';
        ctx.wiBtnEl.disabled = false;
        ctx.llBtnEl.disabled = false;
        ctx.wiBtnEl.style.opacity = '1';
        ctx.llBtnEl.style.opacity = '1';
        setProviderBtnLabel(ctx.llBtnEl, 'LootLabs', null);
    };

    const check = async () =>
    {
        if(!document.body.contains(ctx.statusEl)) { stopLootlabsPoll(); return; }
        if(Date.now() - startedAt > MAX_MS)
        {
            setExpired('Task expired – please start again.');
            return;
        }
        try
        {
            const body = new URLSearchParams();
            body.set('sessionToken', ctx.authToken);
            body.set('click_id', ctx.clickId);
            const res = await fetch(`${ctx.apiUrl}/lootlabs/status`, {
                method: 'POST',
                body,
                credentials: 'include'
            });
            const data = await res.json().catch(() => null);
            const st = (data && typeof data.status === 'string') ? data.status.toLowerCase() : '';
            if(data && data.ok && (st === 'complete' || st === 'completed' || st === 'ready' || st === 'done' || st === 'verified'))
            {
                stopLootlabsPoll();
                if(!document.body.contains(ctx.statusEl)) return;
                ctx.statusEl.textContent = 'Task complete – press Claim to collect your reward.';
                ctx.claimBtnEl.disabled = false;
                ctx.claimBtnEl.style.opacity = '1';
                ctx.claimBtnEl.textContent = 'Claim reward';
                notifyAd('LootLabs task complete – press Claim.', 'success', 4000);
                return;
            }
            if(data && data.ok === false && /expir|invalid|not found|unknown/i.test(String(data.message || '')))
            {
                setExpired(String(data.message) || 'Task expired – please start again.');
                return;
            }
        }
        catch(e) { /* transient network error – keep polling */ }
    };

    check();
    adModalPollTimer = setInterval(check, 3000);
    adModalTimeoutTimer = setTimeout(() => setExpired('Task expired – please start again.'), MAX_MS);
}

async function claimLootlabsReward(ctx)
{
    if(!ctx || ctx.claiming) return;
    if(!ctx.clickId)
    {
        notifyAd('Start the LootLabs task first.', 'warning');
        return;
    }
    ctx.claiming = true;
    ctx.claimBtnEl.disabled = true;
    ctx.claimBtnEl.style.opacity = '0.5';
    ctx.claimBtnEl.textContent = 'Claiming…';

    try
    {
        const body = new URLSearchParams();
        body.set('sessionToken', ctx.authToken);
        body.set('click_id', ctx.clickId);
        try
        {
            const identity = await loadIdentityPayloadSafe();
            for(const [k, v] of identity.entries()) body.set(k, v);
        }
        catch(e) {}

        const res = await fetch(`${ctx.apiUrl}/lootlabs/claim`, {
            method: 'POST',
            body,
            credentials: 'include'
        });
        const data = await res.json().catch(() => null);

        // Same success shape as workink/generate: a license redirects to the
        // license page, otherwise the new balance refreshes this checkout.
        if(data && data.ok && data.license)
        {
            stopLootlabsPoll();
            try { sessionStorage.removeItem('sheldon_lootlabs_pending'); } catch(e) {}
            try { localStorage.removeItem('sheldon_lootlabs_pending'); } catch(e) {}
            try { localStorage.removeItem('cache_licenses'); } catch(e) {}
            const params = `${encodeURIComponent(data.license.key)}:${encodeURIComponent(data.license.product || 'License')}`;
            window.location.href = `/license/?showKeys=${params}`;
            return;
        }
        if(data && data.ok && data.new_balance !== undefined)
        {
            stopLootlabsPoll();
            try { sessionStorage.removeItem('sheldon_lootlabs_pending'); } catch(e) {}
            try { localStorage.removeItem('sheldon_lootlabs_pending'); } catch(e) {}
            const added = (typeof data.added === 'number' && !isNaN(data.added)) ? data.added : 0;
            if(data.capped) notifyAd('Daily balance maxed – come back later.', 'info');
            else if(added > 0)
            {
                notifyAd(`Reward claimed: +${added} balance.`, 'success');
                try { if(typeof window.animateBalanceGain === 'function') window.animateBalanceGain(added, Math.max(0, data.new_balance - added)); } catch(e) {}
            }
            else notifyAd('Balance updated.', 'success', 3000);
            closeAdProviderModal();
            try { await ShowBalanceCheckout(); } catch(e) { try { window.location.reload(); } catch(_) {} }
            return;
        }

        const msg = (data && data.message) || 'Could not claim your reward yet – finish the task, then try again.';
        if(ctx.statusEl && document.body.contains(ctx.statusEl)) ctx.statusEl.textContent = msg;
        notifyAd(msg, (res && res.status === 429) ? 'warning' : 'error', 6000);
        ctx.claimBtnEl.disabled = false;
        ctx.claimBtnEl.style.opacity = '1';
        ctx.claimBtnEl.textContent = 'Claim reward';
    }
    catch(err)
    {
        if(ctx.statusEl && document.body.contains(ctx.statusEl)) ctx.statusEl.textContent = 'Could not claim your reward. Please try again.';
        notifyAd('Could not claim your reward. Please try again.', 'error');
        ctx.claimBtnEl.disabled = false;
        ctx.claimBtnEl.style.opacity = '1';
        ctx.claimBtnEl.textContent = 'Claim reward';
    }
    finally
    {
        ctx.claiming = false;
    }
}

async function ShowBalanceCheckout() {
    const authToken = DiscordAuth.GetSessionToken();
    if (!authToken) { renderBalanceState('Please log in to redeem your balance for a key.', 'login'); return; }

    const apiUrl = await Api.GetApiUrl();

    try
    {
        // Form body keeps this a CORS simple request (no preflight).
        const body = new URLSearchParams();
        if (authToken) body.set('sessionToken', authToken);
        const identity = await loadIdentityPayloadSafe();
        for (const [k, v] of identity.entries()) body.set(k, v);

        const response = await fetch(`${apiUrl}/discord/balance`, {
            method: 'POST',
            body,
            credentials: 'include'
        });
        const data = await response.json();

        if (!data || !data.ok) { renderBalanceState('Your session may have expired. Please log in again.', 'login'); return; }

        const balance = data.balance || 0;
        const adRewardBalance = data.ad_reward_balance || 0.1;
        const freeKeyCost = data.free_key_cost || 1.0;
        const noCooldown = data.no_cooldown ? true : false;
        const isRateLimited = data.rate_limited || false;
        const rateLimitedUntil = data.rate_limited_until || 0;
        const freeKeyCooldownUntil = data.free_key_cooldown_until || 0;
        const firstAdBoosted = data.first_ad_boosted ? true : false;
        const firstAdBoostBalance = (typeof data.first_ad_boost_balance === 'number' && !isNaN(data.first_ad_boost_balance)) ? data.first_ad_boost_balance : 0.9;

        let durationHours = 4.5;
        try
        {
            const productRes = await fetch(`${apiUrl}/products/get?product=free`);
            const productData = await productRes.json();
            if (productData && productData.duration) durationHours = productData.duration;
        }
        catch (e) {}

        const workinkLink = await Api.GetLink('workink');

        // Weekly usage goal (dashboard "Free license goal"). When reached, the next
        // ad grants a free key directly (usage_reward) – no balance needed. Checkout
        // must know this, otherwise a 12/12 user with 0 balance only sees
        // "Insufficient Balance" and thinks the goal is broken.
        let usageSeconds = 0;
        let usageThresholdSeconds = 12 * 60 * 60;
        try {
            const usageRes = await fetch(`${apiUrl}/workink/usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: authToken })
            });
            const usageData = await usageRes.json().catch(() => null);
            if (usageData && usageData.ok) {
                usageSeconds = Number(usageData.seconds) || 0;
                if (Number(usageData.threshold_seconds) > 0) usageThresholdSeconds = Number(usageData.threshold_seconds);
            }
        } catch (e) {}

        let cooldownTimer = null;
        let rateLimitTimer = null;

        function formatCooldown(ms) {
            const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
            if (minutes > 0) return `${minutes}m ${seconds}s`;
            return `${seconds}s`;
        }

        function renderCheckout() {
            const qty = window.quantity || 1;
            const totalCost = qty * freeKeyCost;
            const canAfford = balance >= totalCost;

            const now = Date.now();
            const isOnCooldown = freeKeyCooldownUntil > 0 && freeKeyCooldownUntil > now;
            const cooldownRemaining = isOnCooldown ? freeKeyCooldownUntil - now : 0;
            const rateLimitRemaining = (isRateLimited && rateLimitedUntil > now) ? rateLimitedUntil - now : 0;

            // Goal state mirrors the dashboard card: hours completed vs threshold.
            const usageThresholdHours = Math.max(1, Math.round(usageThresholdSeconds / 3600));
            const usageDoneHours = Math.min(usageThresholdHours, Math.floor(usageSeconds / 3600));
            const goalReached = usageThresholdSeconds > 0 && usageSeconds >= usageThresholdSeconds;

            const paymentForm = document.getElementById('payment-form');
            if (!paymentForm) return;

            if (rateLimitTimer) { clearInterval(rateLimitTimer); rateLimitTimer = null; }

            const goalBanner = goalReached
                ? `<div style="font-size: 12px; color: #34d399; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); border-radius: 10px; padding: 10px 14px; max-width: 85%; line-height: 1.5; margin-top: -12px; font-weight: 700;">
                        Goal reached (${usageDoneHours}/${usageThresholdHours} hours) – claim your free key now. No ad, no balance needed.
                       </div>`
                : (usageThresholdSeconds > 0
                    ? `<div style="font-size: 11px; color: rgba(255,255,255,0.5); max-width: 85%; line-height: 1.5; margin-top: -12px;">
                        Progress: ${usageDoneHours}/${usageThresholdHours} hours – reach ${usageThresholdHours} hours and claim directly here, no ad needed, or earn balance below.
                       </div>`
                    : '');

            paymentForm.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; width: 100%; text-align: center; gap: 24px;">
                    <div style="font-size: 22px; font-weight: 700; color: #e8d5b8;">Pay with your Balance</div>

                    <div style="font-size: 14px; color: rgba(255,255,255,0.6); max-width: 80%; line-height: 1.2; margin-top: -20px;">
                        Redeem your balance for ${qty} x ${durationHours} hours key${qty > 1 ? 's' : ''}
                    </div>

                    ${goalBanner}

                    ${goalReached
                        ? `<button id="claim-usage-btn" class="btn-action" style="max-width: 300px; padding-top: 17px; padding-bottom: 17px;">
                             CLAIM FREE KEY
                            </button>`
                        : (isOnCooldown
                        ? `<button id="purchase-balance-btn" class="btn-action" style="max-width: 300px; padding-top: 17px; padding-bottom: 17px; opacity: 0.4; cursor: not-allowed;" disabled>
                             COOLDOWN – ${formatCooldown(cooldownRemaining)}
                            </button>`
                        : `<button id="purchase-balance-btn" class="btn-action" style="max-width: 300px; padding-top: 17px; padding-bottom: 17px; ${canAfford ? '' : 'opacity: 0.5; cursor: not-allowed;'}" ${canAfford ? '' : 'disabled'}>
                             ${canAfford ? `PURCHASE KEY${qty > 1 ? 'S' : ''}` : 'Insufficient Balance'}
                            </button>`)
                    }

                    ${goalReached
                        ? `<span id="claim-usage-msg" style="font-size: 12px; color: rgba(255,255,255,0.5);">No ad needed – the key is yours for reaching the goal.${isOnCooldown ? ' Balance purchases are on cooldown, but the goal claim still works.' : ''}</span>`
                        : (isRateLimited
                        ? `<span id="rate-limit-msg" style="font-size: 12px; color: #ef4444; font-weight: 700;">Rate limited – max balance reached.${rateLimitRemaining > 0 ? ` Try again in ${formatCooldown(rateLimitRemaining)}.` : ' Come back later.'}</span>`
                        : (isOnCooldown ? '' : `<button id="watch-ads-btn" style="font-size: 13px; color: #c7b18f; text-decoration: underline; background: none; border: none; cursor: pointer; font-family: inherit;">
                             ${getAdButtonLabel(noCooldown, firstAdBoosted, adRewardBalance)}
                            </button>`))
                    }

                    ${!goalReached && firstAdBoosted && !noCooldown && !isOnCooldown
                        ? `<div style="font-size: 12px; color: #22c55e; font-weight: 700; max-width: 80%; line-height: 1.45;">
                             Your first ad grants +${firstAdBoostBalance.toFixed(1)} – only 1 stage of work for your first free key. After that it's 3 stages per key.
                            </div>`
                        : ''}
                </div>
            `;

            const totalEl = document.getElementById('final-total-price');
            if (totalEl) totalEl.textContent = `${totalCost.toFixed(1)} Balance`;

            if (isRateLimited && rateLimitRemaining > 0) {
                rateLimitTimer = setInterval(() => {
                    const remaining = rateLimitedUntil - Date.now();
                    if (remaining <= 0) {
                        clearInterval(rateLimitTimer);
                        rateLimitTimer = null;
                        renderCheckout();
                        return;
                    }
                    const msgEl = document.getElementById('rate-limit-msg');
                    if (msgEl) msgEl.textContent = `Rate limited – max balance reached. Try again in ${formatCooldown(remaining)}.`;
                }, 1000);
            }

            if (isOnCooldown && !goalReached) {
                if (cooldownTimer) clearInterval(cooldownTimer);
                cooldownTimer = setInterval(() => {
                    const remaining = freeKeyCooldownUntil - Date.now();
                    if (remaining <= 0) {
                        clearInterval(cooldownTimer);
                        cooldownTimer = null;
                        renderCheckout();
                        return;
                    }
                    const btn = document.getElementById('purchase-balance-btn');
                    if (btn) btn.textContent = `COOLDOWN – ${formatCooldown(remaining)}`;
                }, 1000);
            }
            else
            {
                if (cooldownTimer) {
                    clearInterval(cooldownTimer);
                    cooldownTimer = null;
                }

                const purchaseBtn = document.getElementById('purchase-balance-btn');
                const claimBtn = document.getElementById('claim-usage-btn');
                if (claimBtn) {
                    claimBtn.addEventListener('click', async () => {
                        claimBtn.disabled = true;
                        claimBtn.textContent = 'Claiming...';
                        const msgEl = document.getElementById('claim-usage-msg');

                        try
                        {
                            // Fingerprint is best-effort here (audit + deal bookkeeping):
                            // the claim must still work when the checks are blocked.
                            let deviceId = null;
                            let browserFp = null;
                            try {
                                const identity = await loadIdentityPayloadSafe();
                                deviceId = identity.get('fingerprint') || identity.get('deviceId') || null;
                                browserFp = identity.get('browserFp') || null;
                            } catch (e) {}

                            const claimRes = await fetch(`${apiUrl}/workink/claim-usage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    sessionToken: authToken,
                                    fingerprint: deviceId,
                                    browserFp: browserFp
                                }),
                                credentials: 'include'
                            });
                            const claimData = await claimRes.json().catch(() => null);

                            if (claimData && claimData.ok && claimData.license)
                            {
                                try { localStorage.removeItem('cache_licenses'); } catch (e) {}
                                try { sessionStorage.setItem('usage_reward', '1'); } catch (e) {}
                                const params = `${encodeURIComponent(claimData.license.key)}:${encodeURIComponent(claimData.license.product || 'License')}`;
                                window.location.href = `/license/?showKeys=${params}`;
                                return;
                            }

                            const reason = (claimData && claimData.message) || 'Could not claim your free key. Please try again.';
                            if (msgEl) {
                                msgEl.textContent = reason;
                                msgEl.style.color = '#ef4444';
                            } else {
                                alert(reason);
                            }
                            claimBtn.disabled = false;
                            claimBtn.textContent = 'CLAIM FREE KEY';
                        }
                        catch (err)
                        {
                            if (msgEl) {
                                msgEl.textContent = 'Could not claim your free key. Please try again.';
                                msgEl.style.color = '#ef4444';
                            } else {
                                alert('Claim failed');
                            }
                            claimBtn.disabled = false;
                            claimBtn.textContent = 'CLAIM FREE KEY';
                        }
                    });
                }
                if (purchaseBtn && canAfford) {
                    purchaseBtn.addEventListener('click', async () => {
                        purchaseBtn.disabled = true;
                        purchaseBtn.textContent = 'Processing...';

                        try
                        {
                            // Strict device checks: the grant REQUIRES a complete identity.
                            // Blocked checks => adblock notice, button restored, no request sent.
                            const restoreBtn = () =>
                            {
                                purchaseBtn.disabled = false;
                                purchaseBtn.textContent = `PURCHASE ${qty} KEY${qty > 1 ? 'S' : ''} (${totalCost.toFixed(1)} Balance)`;
                            };
                            let gate = null;
                            try { gate = await ensureChecksOrNotify('the free-key purchase'); } catch(e) { gate = null; }
                            if(!gate || !gate.ok) { restoreBtn(); return; }

                            const purchaseBody = new URLSearchParams();
                            purchaseBody.set('quantity', String(qty));
                            if (authToken) purchaseBody.set('sessionToken', authToken);
                            if (gate.deviceId) purchaseBody.set('fingerprint', gate.deviceId);
                            if (gate.browserFp) purchaseBody.set('browserFp', gate.browserFp);

                            const purchaseRes = await fetch(`${apiUrl}/discord/purchase-free-key`, {
                                method: 'POST',
                                body: purchaseBody,
                                credentials: 'include'
                            });
                            const purchaseData = await purchaseRes.json();

                            if (purchaseData.ok)
                            {
                                try { localStorage.removeItem('cache_licenses'); } catch (e) {}

                                if (purchaseData.licenses && purchaseData.licenses.length > 0)
                                {
                                    const params = purchaseData.licenses.map(l =>
                                        `${encodeURIComponent(l.key)}:${encodeURIComponent(l.product || 'License')}`
                                    ).join(',');
                                    window.location.href = `/license/?showKeys=${params}`;
                                }
                                else
                                {
                                    window.location.href = '/license/';
                                }
                            }
                            else
                            {
                                alert(purchaseData.message || 'Purchase failed');
                                purchaseBtn.disabled = false;
                                purchaseBtn.textContent = `PURCHASE ${qty} KEY${qty > 1 ? 'S' : ''} (${totalCost.toFixed(1)} Balance)`;
                            }
                        }
                        catch (err)
                        {
                            alert('Purchase failed');
                            purchaseBtn.disabled = false;
                            purchaseBtn.textContent = `PURCHASE ${qty} KEY${qty > 1 ? 'S' : ''} (${totalCost.toFixed(1)} Balance)`;
                        }
                    });
                }

                // Ad-link slot: the Watch Ads button (label matches the old direct
                // WorkInk link above) opens the WorkInk / LootLabs provider modal.
                const watchAdsBtn = document.getElementById('watch-ads-btn');
                if(watchAdsBtn)
                {
                    watchAdsBtn.addEventListener('click', () =>
                    {
                        openAdProviderModal({ workinkLink, apiUrl, authToken });
                    });
                }
            }
        }

        renderCheckout();

        // Re-render on quantity change
        const qtyMinus = document.getElementById('qty-minus');
        const qtyPlus = document.getElementById('qty-plus');
        const qtyValue = document.getElementById('qty-value');
        const rerender = () => setTimeout(renderCheckout, 50);
        if (qtyMinus) qtyMinus.addEventListener('click', rerender);
        if (qtyPlus) qtyPlus.addEventListener('click', rerender);
        if (qtyValue) qtyValue.addEventListener('change', rerender);
    } catch (error) {
        console.error('Failed to load balance:', error);
        renderBalanceState('Couldn\'t load your balance. Check your connection and try again.', 'retry');
    }
}

// Backend came back (visitor solved the connection check) – reload what failed.
if (window.SheldonBackend) {
    window.SheldonBackend.OnRecovered(async () =>
    {
        HideProductUnavailable();
        await LoadProductInfo();
        if (window.productUnavailable) return;
        const loggedIn = await CheckAuthStatus();
        if (loggedIn) await ShowCheckout();
    });
}
