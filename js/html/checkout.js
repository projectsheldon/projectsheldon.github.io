import { GetApiUrl, GetProducts } from "../global.js";
import { createPayPalButtons } from "../managers/payment/paypal/paypal.js";
import DiscordApi from "../managers/discord/api.js";
import DiscordRender from "../managers/discord/render.js";
import AuthApi from "../managers/auth/api.js";

let cryptoStatusClearTimer = null;
let cryptoStatusSequence = 0;
let paypalSdkLoadPromise = null;
let paypalButtonsRendered = false;

async function GetPaypalClientConfig() {
    const baseUrl = await GetApiUrl();
    const response = await fetch(`${baseUrl}sheldon/paypal/client_id`);
    if (!response.ok) {
        throw new Error(`PayPal config request failed (${response.status})`);
    }

    const data = await response.json().catch(() => null);
    const clientId = data?.clientId;
    const currency = data?.currency || "EUR";

    if (!clientId || typeof clientId !== "string") {
        throw new Error("Missing PayPal client id");
    }

    return { clientId, currency };
}

async function LoadPaypalSdk() {
    if (window.paypal) return true;
    if (paypalSdkLoadPromise) return paypalSdkLoadPromise;

    paypalSdkLoadPromise = (async () => {
        const { clientId, currency } = await GetPaypalClientConfig();

        await new Promise((resolve, reject) => {
            const existingScript = document.getElementById("paypal-sdk-script");
            if (existingScript) {
                existingScript.addEventListener("load", () => resolve(), { once: true });
                existingScript.addEventListener("error", () => reject(new Error("PayPal SDK failed to load")), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.id = "paypal-sdk-script";
            script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("PayPal SDK failed to load"));
            document.head.appendChild(script);
        });

        return true;
    })();

    try {
        return await paypalSdkLoadPromise;
    } catch (error) {
        paypalSdkLoadPromise = null;
        console.error(error);
        return false;
    }
}

async function InitPaypalButtons() {
    const paypalContainer = document.getElementById('paypal-button-container');
    if (!paypalContainer || paypalContainer.style.display === 'none' || paypalButtonsRendered) return;

    const sdkLoaded = await LoadPaypalSdk();
    if (!sdkLoaded || !window.paypal) {
        paypalContainer.innerHTML = '<p class="text-sm text-red-400">PayPal is currently unavailable.</p>';
        return;
    }

    const paypalButtons = createPayPalButtons();
    await paypalButtons.render('#paypal-button-container');
    paypalButtonsRendered = true;
}

async function CheckDiscordLoginStatus() {
    const authUser = await DiscordApi.GetSessionInfo().catch(() => null);
    const loginOverlay = document.getElementById('login-overlay');
    const paypalContainer = document.getElementById('paypal-button-container');

    if (!authUser || !authUser.id) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        if (paypalContainer) paypalContainer.style.display = 'none';

        return false;
    }
    else {
        if (loginOverlay) loginOverlay.classList.add('hidden');
        if (paypalContainer) paypalContainer.style.display = 'block';
        await InitPaypalButtons();

        return true;
    }
}

function GetProductFromUrl() {
    const typeParam = new URLSearchParams(window.location.search).get('type') || '';
    const type = typeParam.toLowerCase();
    return type;
}

function SetCryptoTicketStatus(message, isError = false) {
    const statusEl = document.getElementById('crypto-ticket-status');
    if (!statusEl) return;

    cryptoStatusSequence += 1;
    const sequence = cryptoStatusSequence;

    if (cryptoStatusClearTimer) {
        clearTimeout(cryptoStatusClearTimer);
        cryptoStatusClearTimer = null;
    }

    statusEl.style.transition = "opacity 250ms ease";
    statusEl.style.opacity = "0";

    setTimeout(() => {
        if (sequence !== cryptoStatusSequence) return;

        statusEl.textContent = message;
        statusEl.classList.remove('text-gray-500', 'text-red-400', 'text-hacker-blue');
        statusEl.classList.add(isError ? 'text-red-400' : 'text-hacker-blue');
        statusEl.style.opacity = "1";
    }, 60);

    cryptoStatusClearTimer = setTimeout(() => {
        if (sequence !== cryptoStatusSequence) return;

        statusEl.style.opacity = "0";

        setTimeout(() => {
            if (sequence !== cryptoStatusSequence) return;

            statusEl.textContent = "";
            statusEl.classList.remove('text-red-400', 'text-hacker-blue');
            statusEl.classList.add('text-gray-500');
        }, 260);
    }, 10000);
}

async function CreateCryptoTicket() {
    const btn = document.getElementById('crypto-ticket-btn');
    const authUser = await DiscordApi.GetSessionInfo().catch(() => null);

    if (!authUser || !authUser.id) {
        SetCryptoTicketStatus("Login required.", true);
        DiscordRender.LoginLogic();
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.classList.add("opacity-60", "cursor-not-allowed");
    }

    try {
        const baseUrl = await GetApiUrl();
        const productId = GetProductFromUrl();

        if (!productId || productId === "free") {
            SetCryptoTicketStatus("Invalid product.", true);
            return;
        }

        // Get quantity and reseller status for the payload
        const personalUseCheckbox = document.getElementById("reseller-personal-use");
        const isPersonalUse = personalUseCheckbox?.checked === true;
        const qtyInput = document.getElementById("reseller-qty");
        const qty = isPersonalUse ? 1 : Math.max(1, Math.min(100, Number.parseInt(qtyInput?.value || "1", 10) || 1));
        
        // Check if user is a reseller (need to fetch this info)
        let isReseller = false;
        try {
            const rs = await AuthApi.GetResellerStatus().catch(() => null);
            isReseller = rs?.verified === true;
        } catch {
            isReseller = false;
        }

        const payload = {
            discordId: authUser.id,
            productId: productId,
            quantity: qty,
            isReseller: isReseller && !isPersonalUse
        };

        const res = await fetch(`${baseUrl}sheldon/crypto/create_ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = data?.message || data?.error || "Ticket request failed.";
            SetCryptoTicketStatus(msg, true);
            return;
        }

        const isValid = data?.valid === true;
        if (isValid) {
            SetCryptoTicketStatus("Ticket created. Check the Discord server for your ticket.");
        } else {
            const msg = data?.message || "Ticket request failed.";
            SetCryptoTicketStatus(msg, true);
        }
    } catch (error) {
        SetCryptoTicketStatus("Connection failed.", true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove("opacity-60", "cursor-not-allowed");
        }
    }
}

async function OnLoad() {
    const loginStatus = await CheckDiscordLoginStatus();

    const type = GetProductFromUrl();

    const serverProducts = await GetProducts();

    if (type === "free") {
        if (loginStatus)
            window.location.href = 'https://work.ink/2jEb/sheldon-free-license';
    } else {
        const priceElement = document.querySelector('.total-price');
        const nameElement = document.getElementById('product-name');
        const resellerPanel = document.getElementById('reseller-bulk-panel');
        const qtyInput = document.getElementById('reseller-qty');
        const discountNote = document.getElementById('reseller-discount-note');

        const product = serverProducts?.[type];
        if (!product) return;

        const unitPrice = typeof product.price === "number" ? product.price : null;

        if (nameElement) nameElement.textContent = product.name;

        const isReseller = await (async () => {
            if (!loginStatus) return false;
            try {
                const rs = await AuthApi.GetResellerStatus().catch(() => null);
                return rs?.verified === true;
            } catch {
                return false;
            }
        })();

        const compute = () => {
            const personalUseCheckbox = document.getElementById("reseller-personal-use");
            const isPersonalUse = personalUseCheckbox?.checked === true;
            
            // If personal use is checked, quantity is always 1
            const qty = isPersonalUse ? 1 : Math.max(1, Math.min(100, Number.parseInt(qtyInput?.value || "1", 10) || 1));
            if (qtyInput && !isPersonalUse) qtyInput.value = String(qty);

            const discountPct = isReseller && !isPersonalUse && qty > 3 ? 20 : 0;
            const subtotal = unitPrice !== null ? (unitPrice * qty) : null;
            const discountAmount = subtotal !== null ? (subtotal * discountPct / 100) : null;
            const total = subtotal !== null ? (subtotal - discountAmount) : null;

            // Update price display
            if (priceElement) {
                if (total !== null) {
                    priceElement.textContent = `€${total.toFixed(2)}`;
                } else {
                    priceElement.textContent = typeof product.price === "string" ? product.price : "-";
                }
            }

            // Update stacked price breakdown
            const priceBreakdown = document.getElementById("price-breakdown");
            const discountRow = document.getElementById("discount-row");
            const qtyDisplay = document.getElementById("qty-display");
            
            if (priceBreakdown) {
                if (isReseller && !isPersonalUse && qty > 1) {
                    priceBreakdown.classList.remove("hidden");
                    const subtotalEl = priceBreakdown.querySelector(".price-subtotal");
                    if (subtotalEl && subtotal !== null) {
                        subtotalEl.textContent = `€${subtotal.toFixed(2)}`;
                    }
                } else {
                    priceBreakdown.classList.add("hidden");
                }
            }
            
            if (discountRow) {
                if (isReseller && !isPersonalUse && discountPct > 0) {
                    discountRow.classList.remove("hidden");
                    const discountEl = discountRow.querySelector(".price-discount");
                    if (discountEl && discountAmount !== null) {
                        discountEl.textContent = `-€${discountAmount.toFixed(2)}`;
                    }
                } else {
                    discountRow.classList.add("hidden");
                }
            }
            
            if (qtyDisplay) {
                if (isReseller && !isPersonalUse && qty > 1) {
                    qtyDisplay.classList.remove("hidden");
                    const qtyEl = qtyDisplay.querySelector(".qty-value");
                    if (qtyEl) {
                        qtyEl.textContent = `x${qty}`;
                    }
                } else {
                    qtyDisplay.classList.add("hidden");
                }
            }

            // Hide/show quantity container based on Personal Use
            const qtyContainer = document.getElementById("reseller-qty-container");
            if (qtyContainer) {
                qtyContainer.classList.toggle("hidden", isPersonalUse || !isReseller);
            }

            // Handle the discount text in the panel header
            const discountTextEl = document.getElementById("reseller-discount-text");
            if (discountTextEl) {
                if (!isReseller || isPersonalUse) {
                    discountTextEl.classList.add("hidden");
                } else {
                    discountTextEl.innerHTML = 'Buy 4+ for <span class="text-hacker-blue font-bold">20% off</span>.';
                    discountTextEl.classList.remove("hidden");
                }
            }

            if (discountNote) {
                discountNote.className = "hidden";
            }
        };

if (resellerPanel) resellerPanel.classList.toggle("hidden", !isReseller);
        if (qtyInput) {
            qtyInput.disabled = !isReseller;
            qtyInput.addEventListener("input", compute);
            qtyInput.addEventListener("change", compute);
        }
        
        // Handle personal use checkbox
        const personalUseCheckbox = document.getElementById("reseller-personal-use");
        if (personalUseCheckbox) {
            personalUseCheckbox.addEventListener("change", () => {
                const isPersonalUse = personalUseCheckbox.checked;
                if (qtyInput) {
                    qtyInput.disabled = isPersonalUse || !isReseller;
                    if (isPersonalUse) {
                        qtyInput.value = "1";
                    }
                }
                compute();
            });
        }

        if (!isReseller && unitPrice !== null && priceElement) {
            priceElement.textContent = `€${unitPrice.toFixed(2)}`;
        }
        compute();
    }
}

async function CryptoTestRequest() {
    await CryptoInitRequest(GetProductFromUrl());
}

window.checkLoginStatus = CheckDiscordLoginStatus;
window.CryptoTestRequest = CryptoTestRequest;

document.addEventListener('DOMContentLoaded', async () => {
    {
        const overlayLoginBtn = document.getElementById('overlay-login-btn');
        if (overlayLoginBtn) {
            overlayLoginBtn.addEventListener('click', () => {
                DiscordRender.LoginLogic();
            });
        }
    }

    const authBtn = document.getElementById('auth-btn');
    if (authBtn) authBtn.addEventListener('click', () => DiscordRender.LoginLogic());

    const cryptoTestBtn = document.getElementById('crypto-test-btn');
    if (cryptoTestBtn) cryptoTestBtn.addEventListener('click', () => CryptoTestRequest());

    const cryptoTicketBtn = document.getElementById('crypto-ticket-btn');
    if (cryptoTicketBtn) cryptoTicketBtn.addEventListener('click', () => CreateCryptoTicket());

    await OnLoad();
});
