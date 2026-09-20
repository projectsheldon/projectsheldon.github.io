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
                    <span style="font-size:11px;color:rgba(255,255,255,0.9);font-weight:600;white-space:nowrap;">${c.coinAmount != null ? esc(String(c.coinAmount)) + ' ' + esc(c.coin) : '—'}</span>
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

    if (!coin) { showPlanBError('Select the coin you paid with.'); return; }
    if (!txHash) { showPlanBError('Enter the transaction hash or explorer URL.'); return; }
    if (!proofFile) { showPlanBError('Upload a screenshot as payment proof.'); return; }

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
            body: JSON.stringify({ product_key: productKey, quantity: qty, coin })
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

async function LoadProductInfo() {
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
            // Unknown / stale product key (e.g. an old ?product=… link) — no product data.
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
    TogglePaymentForm(false); // hides payment form — note this re-shows login-required, so hide it after
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
            // Fill completed: arm the button. No auto ticket — the user clicks to confirm.
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

            const paymentForm = document.getElementById('payment-form');
            if (!paymentForm) return;

            if (rateLimitTimer) { clearInterval(rateLimitTimer); rateLimitTimer = null; }

            paymentForm.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; width: 100%; text-align: center; gap: 24px;">
                    <div style="font-size: 22px; font-weight: 700; color: #e8d5b8;">Pay with your Balance</div>

                    <div style="font-size: 14px; color: rgba(255,255,255,0.6); max-width: 80%; line-height: 1.2; margin-top: -20px;">
                        Redeem your balance for ${qty} x ${durationHours} hours key${qty > 1 ? 's' : ''}
                    </div>

                    ${isOnCooldown
                        ? `<button id="purchase-balance-btn" class="btn-action" style="max-width: 300px; padding-top: 17px; padding-bottom: 17px; opacity: 0.4; cursor: not-allowed;" disabled>
                            COOLDOWN — ${formatCooldown(cooldownRemaining)}
                           </button>`
                        : `<button id="purchase-balance-btn" class="btn-action" style="max-width: 300px; padding-top: 17px; padding-bottom: 17px; ${canAfford ? '' : 'opacity: 0.5; cursor: not-allowed;'}" ${canAfford ? '' : 'disabled'}>
                            ${canAfford ? `PURCHASE KEY${qty > 1 ? 'S' : ''}` : 'Insufficient Balance'}
                           </button>`
                    }

                    ${isRateLimited
                        ? `<span id="rate-limit-msg" style="font-size: 12px; color: #ef4444; font-weight: 700;">Rate limited — max balance reached.${rateLimitRemaining > 0 ? ` Try again in ${formatCooldown(rateLimitRemaining)}.` : ' Come back later.'}</span>`
                        : (isOnCooldown ? '' : `<a href="${workinkLink}" style="font-size: 13px; color: #c7b18f; text-decoration: underline;">
                            ${noCooldown ? 'Watch Ads for 1 Free Key' : (firstAdBoosted ? 'Watch 1 Ad for your First Key' : `Watch Ads for +${adRewardBalance} balance`)}
                           </a>`)
                    }

                    ${firstAdBoosted && !noCooldown && !isOnCooldown
                        ? `<div style="font-size: 12px; color: #22c55e; font-weight: 700; max-width: 80%; line-height: 1.45;">
                            Your first ad grants +${firstAdBoostBalance.toFixed(1)} — only 1 stage of work for your first free key. After that it's 3 stages per key.
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
                    if (msgEl) msgEl.textContent = `Rate limited — max balance reached. Try again in ${formatCooldown(remaining)}.`;
                }, 1000);
            }

            if (isOnCooldown) {
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
                    if (btn) btn.textContent = `COOLDOWN — ${formatCooldown(remaining)}`;
                }, 1000);
            }
            else
            {
                if (cooldownTimer) {
                    clearInterval(cooldownTimer);
                    cooldownTimer = null;
                }

                const purchaseBtn = document.getElementById('purchase-balance-btn');
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

// Backend came back (visitor solved the connection check) — reload what failed.
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
