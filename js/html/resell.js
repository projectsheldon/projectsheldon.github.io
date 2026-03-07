import DiscordApi from "../managers/discord/api.js";
import DiscordRender from "../managers/discord/render.js";
import AuthApi from "../managers/auth/api.js";

const authEl = document.getElementById("resell-auth");
const contentEl = document.getElementById("resell-content");

function SetAuthHtml(html) {
    if (!authEl) return;
    authEl.innerHTML = html;
}

function ShowAuth() {
    if (!authEl) return;
    authEl.classList.remove("hidden");
}

function HideAuth() {
    if (!authEl) return;
    authEl.classList.add("hidden");
}

function ShowContent() {
    if (contentEl) contentEl.classList.remove("hidden");
}

function HideContent() {
    if (contentEl) contentEl.classList.add("hidden");
}

function EscapeHtml(s) {
    if (!s) return "";
    var result = "";
    for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === "&") result += String.fromCharCode(38, 97, 109, 112, 59);
        else if (c === "<") result += String.fromCharCode(60, 108, 116, 59);
        else if (c === ">") result += String.fromCharCode(62, 103, 116, 59);
        else if (c === '"') result += String.fromCharCode(34, 113, 117, 111, 116, 59);
        else if (c === "'") result += String.fromCharCode(35, 48, 51, 57, 59);
        else result += c;
    }
    return result;
}

function FormatExpiry(value) {
    if (value === -1 || value === '-1' || value === 'Lifetime' || value === 'lifetime') return 'Lifetime';
    const num = Number(value);
    if (!num || isNaN(num)) return String(value);

    const remaining = num - Date.now();
    if (remaining <= 0) return 'Expired';

    const seconds = Math.floor(remaining / 1000);
    if (seconds < 1) return 'Less than a second';

    const units = [
        ['year', 365 * 24 * 60 * 60],
        ['month', 30 * 24 * 60 * 60],
        ['week', 7 * 24 * 60 * 60],
        ['day', 24 * 60 * 60],
        ['hour', 60 * 60],
        ['minute', 60],
        ['second', 1]
    ];

    for (const [name, unitSeconds] of units) {
        if (seconds >= unitSeconds) {
            const v = Math.floor(seconds / unitSeconds);
            return `${v} ${name}${v === 1 ? '' : 's'}`;
        }
    }
    return 'Less than a second';
}

function GetPasswordRequirements(password) {
    const s = String(password || "");
    const hasLower = /[a-z]/.test(s);
    const hasUpper = /[A-Z]/.test(s);
    const hasNumber = /[0-9]/.test(s);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(s);

    return {
        minLen: s.length >= 6,
        hasLower,
        hasUpper,
        hasNumber,
        hasSpecial,
    };
}

function PasswordStrengthScore(password) {
    const req = GetPasswordRequirements(password);
    let score = 0;

    if (req.minLen) score += 1;
    if (req.hasLower) score += 1;
    if (req.hasUpper) score += 1;
    if (req.hasNumber) score += 1;
    if (req.hasSpecial) score += 2;

    return { score, req };
}

function StrengthUi(score) {
    if (score <= 1) return { pct: 20, label: "Weak", color: "bg-red-500" };
    if (score <= 3) return { pct: 45, label: "Fair", color: "bg-yellow-500" };
    if (score <= 5) return { pct: 70, label: "Good", color: "bg-blue-500" };
    return { pct: 100, label: "Strong", color: "bg-green-500" };
}

function RenderLoginRequired() {
    ShowAuth();
    HideContent();
    SetAuthHtml(`
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <div class="text-white font-bold mb-1">Login required</div>
            <button id="resell-login-btn"
                class="px-4 py-2 border border-hacker-blue text-hacker-blue font-bold hover:bg-hacker-blue hover:text-black transition-colors">
                Login with Discord
            </button>
        </div>
    `);

    document.getElementById("resell-login-btn")?.addEventListener("click", async () => {
        await DiscordRender.LoginDiscord();
    });
}

function RenderSetPassword() {
    ShowAuth();
    HideContent();
    SetAuthHtml(`
        <div class="mb-4">
            <div class="text-white font-bold mb-1">Set a password</div>

        <form id="resell-setpw-form" class="space-y-3">
            <div>
                <input id="newpw" type="password" autocomplete="new-password" placeholder="Enter new password..."
                    class="w-full bg-black border border-gray-700 px-3 py-2 text-white outline-none focus:border-hacker-blue">
            </div>
            <div>
                <input id="confirmpw" type="password" autocomplete="new-password" placeholder="Confirm new password..."
                    class="w-full bg-black border border-gray-700 px-3 py-2 text-white outline-none focus:border-hacker-blue">
            </div>

            <div class="pt-1">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-gray-500 text-xs">Strength</span>
                    <span id="pw-strength-label" class="text-gray-400 text-xs">—</span>
                </div>
                <div class="w-full h-2 bg-gray-800 border border-gray-700">
                    <div id="pw-strength-bar" class="h-full bg-gray-600" style="width: 0%"></div>
            </div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit"
                    class="px-4 py-2 border border-hacker-blue text-hacker-blue font-bold hover:bg-hacker-blue hover:text-black transition-colors">
                    Save
                </button>
                <span id="resell-setpw-msg" class="text-gray-500 text-sm"></span>
            </div>
        </form>
    `);

    const form = document.getElementById("resell-setpw-form");
    const msg = document.getElementById("resell-setpw-msg");
    const newPwInput = document.getElementById("newpw");
    const strengthLabel = document.getElementById("pw-strength-label");
    const strengthBar = document.getElementById("pw-strength-bar");

    const updateStrength = () => {
        const pw = newPwInput?.value || "";
        const { score } = PasswordStrengthScore(pw);
        const ui = StrengthUi(score);
        if (strengthLabel) strengthLabel.textContent = pw.length ? ui.label : "—";
        if (strengthBar) {
            strengthBar.style.width = pw.length ? `${ui.pct}%` : "0%";
            strengthBar.className = `h-full ${pw.length ? ui.color : "bg-gray-600"}`;
        }
    };

    newPwInput?.addEventListener("input", updateStrength);
    updateStrength();

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (msg) msg.textContent = "Working...";

        const newpw = document.getElementById("newpw")?.value || "";
        const confirmpw = document.getElementById("confirmpw")?.value || "";

        if (newpw.trim().length < 6) {
            if (msg) { msg.textContent = "Password must be at least 6 characters."; msg.className = "text-red-400 text-sm"; }
            return;
        }
        if (newpw !== confirmpw) {
            if (msg) { msg.textContent = "Passwords do not match."; msg.className = "text-red-400 text-sm"; }
            return;
        }

        try {
            await AuthApi.SetPassword(newpw, null, { allowCookie: true });
            if (msg) msg.textContent = "Saved.";
            await RenderGate();
        } catch (err) {
            const code = err?.error ? String(err.error) : "request_failed";
            if (msg) msg.textContent = `Error: ${EscapeHtml(code)}`;
        }
    });
}

function RenderVerifyPassword() {
    ShowAuth();
    HideContent();
    SetAuthHtml(`
        <div class="mb-2">
        <form id="resell-verify-form" class="space-y-3">
            <div>
                <input id="pw" type="password" autocomplete="current-password" placeholder="Enter your password..."
                    class="w-full bg-black border border-gray-700 px-3 py-2 text-white outline-none focus:border-hacker-blue">
            </div>
            <div class="flex items-center gap-3 pt-2">
                <button type="submit"
                    class="px-4 py-2 border border-hacker-blue text-hacker-blue font-bold hover:bg-hacker-blue hover:text-black transition-colors">
                    Continue
                </button>
                <span id="resell-verify-msg" class="text-gray-500 text-sm"></span>
            </div>
        </form>
    `);

    const form = document.getElementById("resell-verify-form");
    const msg = document.getElementById("resell-verify-msg");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pw = document.getElementById("pw")?.value || "";

        try {
            await AuthApi.VerifyPassword(pw, { allowCookie: true });
            const rs = await AuthApi.GetResellerStatus({ allowCookie: true }).catch(() => ({ verified: false }));
            if (!rs?.verified) {
                RenderNotVerified();
                return;
            }
            if (msg) msg.textContent = "";
            await OpenResellPortal();
        } catch (err) {
            const code = err?.error ? String(err.error) : "request_failed";
            if (code === "no_password_set") {
                RenderSetPassword();
                return;
            }
            if (code.includes("bad_password") || code.includes("invalid")) {
                if (msg) { msg.textContent = "Incorrect password."; msg.className = "text-red-400 text-sm"; }
                return;
            }
            if (msg) { msg.textContent = "Error: " + code; msg.className = "text-red-400 text-sm"; }
        }
    });
}

function RenderNotVerified() {
    ShowAuth();
    HideContent();
    SetAuthHtml(`
        <div class="py-6 px-4">
            <div class="mb-2 text-white font-bold text-lg">You have not been verified yet</div>
            <div class="text-gray-500 text-sm mt-2">Your reseller access is pending approval.</div>
            <div class="text-gray-600 text-xs mt-4">If you just signed up, a staff ticket was created for review.</div>
            
            <div class="mt-8 pt-6 border-t border-gray-800">
                <h3 class="text-white font-bold mb-2">Delete Account</h3>
                <p class="text-gray-400 text-sm mb-4">If you delete your account, you won't be able to make a new reseller account for <span class="text-yellow-400 font-bold">3 days</span>. This action cannot be undone.</p>
                <button id="resell-delete-btn-unverified" class="px-4 py-2 border border-red-500 text-red-500 font-bold hover:bg-red-500 hover:text-black">Delete Account</button>
            </div>
    `);

    document.getElementById("resell-delete-btn-unverified")?.addEventListener("click", () => {
        const deleteModal = document.getElementById("delete-modal");
        if (deleteModal) deleteModal.classList.remove("hidden");
    });
}

function RenderResellerBanned(bannedUntil) {
    ShowAuth();
    HideContent();
    const banDate = new Date(bannedUntil);
    const timeLeft = banDate.getTime() - Date.now();
    const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));
    const dateStr = banDate.toLocaleDateString() + " " + banDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    SetAuthHtml(`
        <div class="py-6 px-4">
            <div class="mb-2 text-red-400 font-bold text-lg">Reseller Access Banned</div>
            <div class="text-gray-500 text-sm mt-2">You are temporarily banned from becoming a reseller.</div>
            <div class="text-gray-400 text-sm mt-3">Time remaining: approximately ${hoursLeft} hours</div>
            <div class="text-gray-600 text-xs mt-2">Ban expires: ${dateStr}</div>
    `);
}

async function OpenResellPortal() {
    HideAuth();
    ShowContent();
    document.getElementById("resell-hero")?.classList.add("hidden");

    const refreshBtn = document.getElementById("resell-refresh-btn");
    if (refreshBtn) refreshBtn.onclick = async () => { await FetchResellLicenses(); };

    SetupSettingsTab();
    await FetchResellLicenses();
}

function SetupSettingsTab() {
    const changePwForm = document.getElementById("resell-changepw-form");
    const changePwMsg = document.getElementById("resell-changepw-msg");
    const newPwInput = document.getElementById("newpw");
    const strengthLabel = document.getElementById("pw-strength-label");
    const strengthBar = document.getElementById("pw-strength-bar");

    // Add placeholders to settings password inputs
    const currentPwInput = document.getElementById("currentpw");
    const confirmPwInput = document.getElementById("confirmpw");
    if (currentPwInput) currentPwInput.placeholder = "Enter current password...";
    if (newPwInput) newPwInput.placeholder = "Enter new password...";
    if (confirmPwInput) confirmPwInput.placeholder = "Confirm new password...";

    const updateStrength = () => {
        const pw = newPwInput?.value || "";
        const { score } = PasswordStrengthScore(pw);
        const ui = StrengthUi(score);
        if (strengthLabel) strengthLabel.textContent = pw.length ? ui.label : "—";
        if (strengthBar) {
            strengthBar.style.width = pw.length ? `${ui.pct}%` : "0%";
            strengthBar.className = `h-full ${pw.length ? ui.color : "bg-gray-600"}`;
        }
    };

    newPwInput?.addEventListener("input", updateStrength);

    changePwForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (changePwMsg) changePwMsg.textContent = "Working...";

        const currentPw = document.getElementById("currentpw")?.value || "";
        const newPw = document.getElementById("newpw")?.value || "";
        const confirmPw = document.getElementById("confirmpw")?.value || "";

        if (!currentPw.trim()) {
            if (changePwMsg) changePwMsg.textContent = "Current password required.";
            return;
        }
        if (newPw !== confirmPw) {
            if (changePwMsg) changePwMsg.textContent = "Passwords do not match.";
            return;
        }
        if (newPw.trim().length < 6) {
            if (changePwMsg) changePwMsg.textContent = "Password must be at least 6 characters.";
            return;
        }

        try {
            await AuthApi.SetPassword(newPw, currentPw, { allowCookie: true });
            if (changePwMsg) changePwMsg.textContent = "Password updated.";
            document.getElementById("currentpw").value = "";
            document.getElementById("newpw").value = "";
            document.getElementById("confirmpw").value = "";
            updateStrength();
        } catch (err) {
            const code = err?.error ? String(err.error) : "request_failed";
            if (code.includes("bad_password")) {
                if (changePwMsg) changePwMsg.textContent = "Current password is incorrect.";
                return;
            }
            if (changePwMsg) changePwMsg.textContent = `Error: ${EscapeHtml(code)}`;
        }
    });

    // Delete modal elements
    const deleteModal = document.getElementById("delete-modal");
    const deleteSection = document.getElementById("resell-delete-section");
    const deleteConfirm = document.getElementById("resell-delete-confirm");
    const deletePending = document.getElementById("resell-delete-pending");
    const deleteBtn = document.getElementById("resell-delete-btn");
    const deleteCancel = document.getElementById("resell-delete-cancel");
    const deleteConfirmBtn = document.getElementById("resell-delete-confirm-btn");
    const deleteNo = document.getElementById("resell-delete-cancel");
    const deletePasswordInput = document.getElementById("delete-password-input");
    const deleteErrorMsg = document.getElementById("delete-error-msg");

    // Check deletion status
    AuthApi.GetDeletionStatus({ allowCookie: true }).then(data => {
        if (data?.pending) {
            if (deleteSection) deleteSection.classList.add("hidden");
            if (deleteConfirm) deleteConfirm.classList.add("hidden");
            if (deletePending) deletePending.classList.remove("hidden");
        }
    }).catch(() => { });

    // Open delete modal from settings
    document.getElementById("open-delete-modal-btn")?.addEventListener("click", () => {
        if (deleteModal) deleteModal.classList.remove("hidden");
    });

    // Close delete modal
    document.getElementById("close-delete-modal-btn")?.addEventListener("click", () => {
        if (deleteModal) deleteModal.classList.add("hidden");
    });
    document.getElementById("delete-modal-overlay")?.addEventListener("click", () => {
        if (deleteModal) deleteModal.classList.add("hidden");
    });

    // Click delete account button - show confirmation
    deleteBtn?.addEventListener("click", () => {
        if (deleteSection) deleteSection.classList.add("hidden");
        if (deleteConfirm) deleteConfirm.classList.remove("hidden");
        setTimeout(() => deletePasswordInput?.focus(), 100);
    });

    // Cancel button - go back
    deleteNo?.addEventListener("click", () => {
        if (deleteSection) deleteSection.classList.remove("hidden");
        if (deleteConfirm) deleteConfirm.classList.add("hidden");
        if (deletePasswordInput) deletePasswordInput.value = "";
        if (deleteErrorMsg) {
            deleteErrorMsg.textContent = "";
            deleteErrorMsg.classList.add("hidden");
        }
    });

    // Confirm delete with password
    deleteConfirmBtn?.addEventListener("click", async () => {
        const password = deletePasswordInput?.value || "";

        if (!password.trim()) {
            if (deleteErrorMsg) {
                deleteErrorMsg.textContent = "Please enter your password.";
                deleteErrorMsg.classList.remove("hidden");
            }
            return;
        }

        if (deleteErrorMsg) {
            deleteErrorMsg.textContent = "Verifying...";
            deleteErrorMsg.className = "text-gray-400 text-sm mb-3";
        }

        try {
            // Verify password first
            await AuthApi.VerifyPassword(password, { allowCookie: true });

            // Request deletion
            await AuthApi.RequestDeletion({ allowCookie: true });

            // Success
            if (deleteModal) deleteModal.classList.add("hidden");
            window.location.href = "/";
        } catch (err) {
            const code = err?.error ? String(err.error) : "request_failed";

            if (code.includes("bad_password") || code.includes("invalid") || code.includes("incorrect")) {
                if (deleteErrorMsg) {
                    deleteErrorMsg.textContent = "Incorrect password.";
                    deleteErrorMsg.className = "text-red-400 text-sm mb-3";
                }
                return;
            }

            if (deleteErrorMsg) {
                deleteErrorMsg.textContent = "Error: " + code;
                deleteErrorMsg.className = "text-red-400 text-sm mb-3";
            }
        }
    });

    // Enter key to submit
    deletePasswordInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            deleteConfirmBtn?.click();
        }
    });

    // Cancel pending deletion
    document.getElementById("resell-delete-cancel-request")?.addEventListener("click", async () => {
        try {
            await AuthApi.CancelDeletion({ allowCookie: true });
            if (deletePending) deletePending.classList.add("hidden");
            if (deleteSection) deleteSection.classList.remove("hidden");
        } catch (err) {
            alert("Failed to cancel deletion: " + (err?.error || "Unknown error"));
        }
    });

    // API Token Section
    const apiNoToken = document.getElementById("resell-api-no-token");
    const apiHasToken = document.getElementById("resell-api-has-token");
    const apiTokenMsg = document.getElementById("resell-api-token-msg");
    const apiTokenDisplay = document.getElementById("resell-api-token-display");
    const generateTokenBtn = document.getElementById("resell-generate-token-btn");
    const resetTokenBtn = document.getElementById("resell-reset-token-btn");

    const loadApiToken = async () => {
        try {
            const data = await AuthApi.GetResellerApiToken({ allowCookie: true });
            if (data?.hasToken) {
                if (apiNoToken) apiNoToken.classList.add("hidden");
                if (apiHasToken) apiHasToken.classList.remove("hidden");
                if (apiTokenDisplay) apiTokenDisplay.value = "••••••••••••••••••••••••••••••••";
            } else {
                if (apiNoToken) apiNoToken.classList.remove("hidden");
                if (apiHasToken) apiHasToken.classList.add("hidden");
            }
        } catch (err) { }
    };

    const showApiMessage = (msg, isError = false) => {
        if (apiTokenMsg) {
            apiTokenMsg.textContent = msg;
            apiTokenMsg.className = "mt-3 text-sm " + (isError ? "text-red-400" : "text-hacker-blue");
        }
    };

    generateTokenBtn?.addEventListener("click", async () => {
        if (generateTokenBtn) generateTokenBtn.disabled = true;
        showApiMessage("Generating token...");
        try {
            const data = await AuthApi.ResetResellerApiToken({ allowCookie: true });
            if (data?.token) {
                if (apiNoToken) apiNoToken.classList.add("hidden");
                if (apiHasToken) apiHasToken.classList.remove("hidden");
                if (apiTokenDisplay) apiTokenDisplay.value = data.token;
                showApiMessage("Token generated!");
            } else {
                showApiMessage("Failed to generate token", true);
            }
        } catch (err) {
            showApiMessage("Error: " + (err?.error || "Unknown"), true);
        } finally {
            if (generateTokenBtn) generateTokenBtn.disabled = false;
        }
    });

    resetTokenBtn?.addEventListener("click", async () => {
        const resetTokenModal = document.getElementById("reset-token-modal");
        const passwordInput = document.getElementById("reset-token-password-input");
        const errorMsg = document.getElementById("reset-token-error-msg");

        // Clear previous values
        if (passwordInput) passwordInput.value = "";
        if (errorMsg) {
            errorMsg.textContent = "";
            errorMsg.classList.add("hidden");
        }

        // Open the modal
        if (resetTokenModal) resetTokenModal.classList.remove("hidden");
        setTimeout(() => passwordInput?.focus(), 100);
    });

    // Reset Token Modal handlers
    const resetTokenModal = document.getElementById("reset-token-modal");
    const resetTokenPasswordInput = document.getElementById("reset-token-password-input");
    const resetTokenErrorMsg = document.getElementById("reset-token-error-msg");
    const resetTokenConfirmBtn = document.getElementById("reset-token-confirm-btn");
    const resetTokenCancelBtn = document.getElementById("reset-token-cancel-btn");

    const closeResetTokenModal = () => {
        if (resetTokenModal) resetTokenModal.classList.add("hidden");
        if (resetTokenPasswordInput) resetTokenPasswordInput.value = "";
        if (resetTokenErrorMsg) {
            resetTokenErrorMsg.textContent = "";
            resetTokenErrorMsg.classList.add("hidden");
        }
    };

    resetTokenCancelBtn?.addEventListener("click", closeResetTokenModal);

    resetTokenConfirmBtn?.addEventListener("click", async () => {
        const password = resetTokenPasswordInput?.value || "";

        if (!password.trim()) {
            if (resetTokenErrorMsg) {
                resetTokenErrorMsg.textContent = "Please enter your password.";
                resetTokenErrorMsg.classList.remove("hidden");
            }
            return;
        }

        if (resetTokenConfirmBtn) resetTokenConfirmBtn.disabled = true;

        try {
            // Verify password first
            await AuthApi.VerifyPassword(password, { allowCookie: true });

            // Then reset the token
            const data = await AuthApi.ResetResellerApiToken({ allowCookie: true });
            if (data?.token) {
                if (apiTokenDisplay) apiTokenDisplay.value = data.token;
                closeResetTokenModal();
            } else {
                if (resetTokenErrorMsg) {
                    resetTokenErrorMsg.textContent = "Failed to reset token";
                    resetTokenErrorMsg.classList.remove("hidden");
                }
            }
        } catch (err) {
            const code = err?.error ? String(err.error) : "request_failed";
            if (code.includes("bad_password") || code.includes("incorrect")) {
                if (resetTokenErrorMsg) {
                    resetTokenErrorMsg.textContent = "Incorrect password.";
                    resetTokenErrorMsg.classList.remove("hidden");
                }
            } else {
                if (resetTokenErrorMsg) {
                    resetTokenErrorMsg.textContent = "Error: " + code;
                    resetTokenErrorMsg.classList.remove("hidden");
                }
            }
        } finally {
            if (resetTokenConfirmBtn) resetTokenConfirmBtn.disabled = false;
        }
    });

    // Enter key to submit
    resetTokenPasswordInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            resetTokenConfirmBtn?.click();
        }
    });

    loadApiToken();
}

async function FetchResellLicenses() {
    const body = document.getElementById("resell-licenses-body");
    if (!body) return;

    body.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-gray-500 text-sm">Loading...</td></tr>`;

    try {
        const data = await AuthApi.GetResellLicenses({ allowCookie: true });
        const licenses = Array.isArray(data?.licenses) ? data.licenses : [];

        if (!licenses.length) {
            body.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-gray-500 text-sm">No licenses available.</td></tr>`;
            return;
        }

        body.innerHTML = licenses.map(row => {
            const key = row?.license_key ? String(row.license_key) : "";
            if (!key) return "";
            const safeKey = EscapeHtml(key);
            const encoded = encodeURIComponent(key);
            const expiresAt = row?.expires_at;
            const expiryText = FormatExpiry(expiresAt);
            const isExpired = expiryText === 'Expired';
            const expiryClass = isExpired ? 'text-red-400' : 'text-gray-400';
            return `
                <tr>
                    <td class="px-4 py-3 font-mono text-xs text-gray-200 break-all">${safeKey}</td>
                    <td class="px-4 py-3 text-xs ${expiryClass}">${expiryText}</td>
                    <td class="px-4 py-3 text-right">
                        <button data-copy="${encoded}" class="px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-hacker-blue hover:text-hacker-blue transition-colors text-xs">Copy</button>
                    </td>
                </tr>
            `;
        }).join("");

        document.querySelectorAll("[data-copy]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const encoded = btn.getAttribute("data-copy") || "";
                let key = "";
                try { key = decodeURIComponent(encoded); } catch { key = encoded; }
                try {
                    await navigator.clipboard.writeText(key);
                    const prev = btn.textContent;
                    btn.textContent = "Copied";
                    setTimeout(() => { btn.textContent = prev || "Copy"; }, 800);
                } catch { }
            });
        });
    } catch (err) {
        const code = err?.error ? String(err.error) : "request_failed";
        body.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-red-400 text-sm">Error: ${EscapeHtml(code)}</td></tr>`;
    }
}

async function RenderGate() {
    if (!authEl) return;

    ShowAuth();
    HideContent();
    document.getElementById("resell-hero")?.classList.remove("hidden");

    const user = await DiscordApi.GetSessionInfo({ allowCookie: true }).catch(() => null);
    if (!user?.id) {
        RenderLoginRequired();
        return;
    }

    const status = await AuthApi.GetStatus({ allowCookie: true }).catch(() => ({ loggedIn: true, hasPassword: false }));
    if (!status?.hasPassword) {
        RenderSetPassword();
        return;
    }

    RenderVerifyPassword();
}

RenderGate();
