import DiscordApi from "../managers/discord/api.js";
import DiscordRender from "../managers/discord/render.js";
import AuthApi from "../managers/auth/api.js";

const authEl = document.getElementById("resell-auth");
const contentEl = document.getElementById("resell-content");

// Resizable columns functionality
const resellColumnWidths = {};
const resellColumnMinWidths = [150, 100, 80];
let _resellColResizeActive = false;
let _resellFitRaf = 0;
let _resellResizersInited = false;

function scheduleFitResellColumns() {
    if (_resellColResizeActive) return;
    if (_resellFitRaf) cancelAnimationFrame(_resellFitRaf);
    _resellFitRaf = requestAnimationFrame(() => {
        _resellFitRaf = 0;
        fitResellColumnsToContainer();
    });
}

function fitResellColumnsToContainer() {
    const tableWrap = document.querySelector('#resell-licenses-table')?.parentElement;
    const table = document.getElementById('resell-licenses-table');
    const colgroup = document.getElementById('resell-licenses-colgroup');
    if (!tableWrap || !table || !colgroup) return;

    const cols = [...colgroup.querySelectorAll('col')];
    if (cols.length === 0) return;

    const target = tableWrap.clientWidth;
    if (!target) return;

    const current = cols.map(c => c.getBoundingClientRect().width || 0);
    const total = current.reduce((a, b) => a + b, 0);
    if (!total) return;

    if (Math.abs(total - target) < 2) return;

    const ratios = current.map(w => w / total);
    let mins = cols.map((_, i) => resellColumnMinWidths[i] || 80);
    const minSum = mins.reduce((a, b) => a + b, 0);
    if (minSum > target) {
        const scale = target / minSum;
        mins = mins.map(m => Math.max(60, Math.floor(m * scale)));
    }

    let next = ratios.map((r, i) => Math.max(mins[i] || 60, Math.floor(r * target)));

    let sum = next.reduce((a, b) => a + b, 0);
    let delta = target - sum;
    let guard = 0;
    while (delta !== 0 && guard++ < 3000) {
        const step = delta > 0 ? 1 : -1;
        for (let i = 0; i < next.length && delta !== 0; i++) {
            if (step < 0 && next[i] <= (mins[i] || 60)) continue;
            next[i] += step;
            delta -= step;
        }
        if (step < 0 && delta !== 0) break;
    }

    next.forEach((w, i) => resellColumnWidths[i] = w);
    applyResellColumnWidths();
}

function applyResellColumnWidths() {
    const colgroup = document.getElementById('resell-licenses-colgroup');
    if (!colgroup) return;
    const cols = colgroup.querySelectorAll('col');
    cols.forEach((col, idx) => {
        const width = resellColumnWidths[idx];
        if (width) col.style.width = `${width}px`;
    });
}

function initResellColumnResizers() {
    const table = document.getElementById('resell-licenses-table');
    const colgroup = document.getElementById('resell-licenses-colgroup');
    if (!table || !colgroup) return;

    const cols = colgroup.querySelectorAll('col');
    const headers = table.querySelectorAll('thead th');

    headers.forEach((th, index) => {
        if (index >= headers.length - 1) return;
        if (th.querySelector('.col-resizer')) return;

        const resizer = document.createElement('div');
        resizer.className = 'col-resizer';
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (index >= cols.length - 1) return;
            _resellColResizeActive = true;

            const startX = e.clientX;
            const tableWidth = table.offsetWidth;
            const startWidth = cols[index].getBoundingClientRect().width;
            const nextStartWidth = cols[index + 1].getBoundingClientRect().width;
            const minWidth = resellColumnMinWidths[index] || 90;
            const nextMinWidth = resellColumnMinWidths[index + 1] || 90;
            resizer.classList.add('active');

            const onMouseMove = (ev) => {
                const delta = ev.clientX - startX;
                let newWidth = startWidth + delta;
                let newNextWidth = nextStartWidth - delta;

                if (newWidth < minWidth) {
                    newWidth = minWidth;
                    newNextWidth = nextStartWidth - (minWidth - startWidth);
                }
                if (newNextWidth < nextMinWidth) {
                    newNextWidth = nextMinWidth;
                    newWidth = startWidth + (nextStartWidth - nextMinWidth);
                }

                if (newWidth + newNextWidth > tableWidth) {
                    const overflow = (newWidth + newNextWidth) - tableWidth;
                    newWidth -= overflow / 2;
                    newNextWidth -= overflow / 2;
                }

                resellColumnWidths[index] = newWidth;
                resellColumnWidths[index + 1] = newNextWidth;
                applyResellColumnWidths();
            };

            const onMouseUp = () => {
                resizer.classList.remove('active');
                _resellColResizeActive = false;
                scheduleFitResellColumns();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        th.appendChild(resizer);
    });

    if (!Object.keys(resellColumnWidths).length) {
        cols.forEach((col, idx) => {
            const w = col.getBoundingClientRect().width;
            if (w) resellColumnWidths[idx] = w;
        });
    }

    window.addEventListener('resize', scheduleFitResellColumns);
    scheduleFitResellColumns();
}

function ensureResellResizers() {
    if (_resellResizersInited) {
        scheduleFitResellColumns();
        return;
    }
    _resellResizersInited = true;
    requestAnimationFrame(() => initResellColumnResizers());
}

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
        <div class="p-6 md:p-8">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-hacker-blue/10 border border-hacker-blue/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-hacker-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                    </svg>
                </div>
                <h2 class="text-white font-bold text-xl mb-2">Welcome Back</h2>
                <p class="text-gray-500 text-sm">Login to manage your reseller licenses</p>
            </div>
            <button id="resell-login-btn"
                class="w-full px-4 py-3 border border-hacker-blue text-hacker-blue font-bold hover:bg-hacker-blue hover:text-black transition-all duration-300">
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
        <div class="p-6 md:p-8">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-hacker-blue/10 border border-hacker-blue/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-hacker-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
                    </svg>
                </div>
                <h2 class="text-white font-bold text-xl mb-2">Set Your Password</h2>
                <p class="text-gray-500 text-sm">Create a password to secure your account</p>
            </div>
            <form id="resell-setpw-form" class="space-y-4">
                <div>
                    <input id="newpw" type="password" autocomplete="new-password" placeholder="Enter new password..."
                        class="w-full bg-black border border-gray-700 px-4 py-3 text-white outline-none focus:border-hacker-blue rounded">
                </div>
                <div>
                    <input id="confirmpw" type="password" autocomplete="new-password" placeholder="Confirm new password..."
                        class="w-full bg-black border border-gray-700 px-4 py-3 text-white outline-none focus:border-hacker-blue rounded">
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-gray-500 text-xs">Strength</span>
                        <span id="pw-strength-label" class="text-gray-400 text-xs">—</span>
                    </div>
                    <div class="w-full h-2 bg-gray-800 border border-gray-700 rounded">
                        <div id="pw-strength-bar" class="h-full bg-gray-600 rounded" style="width: 0%"></div>
                    </div>
                </div>
                <div class="pt-2">
                    <button type="submit"
                        class="w-full px-4 py-3 border border-hacker-blue text-hacker-blue font-bold hover:bg-hacker-blue hover:text-black transition-all duration-300 rounded">
                        Save Password
                    </button>
                    <span id="resell-setpw-msg" class="text-gray-500 text-sm block text-center mt-3"></span>
                </div>
            </form>
        </div>
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
            strengthBar.className = `h-full ${pw.length ? ui.color : "bg-gray-600"} rounded`;
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
            if (msg) { msg.textContent = "Password must be at least 6 characters."; msg.className = "text-red-400 text-sm block text-center mt-3"; }
            return;
        }
        if (newpw !== confirmpw) {
            if (msg) { msg.textContent = "Passwords do not match."; msg.className = "text-red-400 text-sm block text-center mt-3"; }
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
        <div class="p-6 md:p-8">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-hacker-blue/10 border border-hacker-blue/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-hacker-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                </div>
                <h2 class="text-white font-bold text-xl mb-2">Welcome Back</h2>
                <p class="text-gray-500 text-sm">Enter your password to continue</p>
            </div>
            <form id="resell-verify-form" class="space-y-4">
                <div>
                    <input id="pw" type="password" autocomplete="current-password" placeholder="Enter your password..."
                        class="w-full bg-black border border-gray-700 px-4 py-3 text-white outline-none focus:border-hacker-blue rounded">
                </div>
                <div class="pt-2">
                    <button type="submit"
                        class="w-full px-4 py-3 border border-hacker-blue text-hacker-blue font-bold hover:bg-hacker-blue hover:text-black transition-all duration-300 rounded">
                        Continue
                    </button>
                    <span id="resell-verify-msg" class="text-gray-500 text-sm block text-center mt-3"></span>
                </div>
            </form>
        </div>
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
                if (msg) { msg.textContent = "Incorrect password."; msg.className = "text-red-400 text-sm block text-center mt-3"; }
                return;
            }
            if (msg) { msg.textContent = "Error: " + code; msg.className = "text-red-400 text-sm block text-center mt-3"; }
        }
    });
}

function RenderNotVerified() {
    ShowAuth();
    HideContent();
    SetAuthHtml(`
        <div class="p-6 md:p-8 text-center">
            <div class="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
            </div>
            <h2 class="text-white font-bold text-xl mb-2">Verification Pending</h2>
            <p class="text-gray-500 text-sm mb-4">Your reseller access is pending approval.</p>
            
            <div class="pt-6 border-t border-gray-800">
                <h3 class="text-white font-bold mb-2">Delete Account</h3>
                <p class="text-gray-400 text-sm mb-4">If you delete your account, you won't be able to make a new reseller account for <span class="text-yellow-400 font-bold">3 days</span>. This action cannot be undone.</p>
                <button id="resell-delete-btn-unverified" class="px-4 py-2 border border-red-500 text-red-500 font-bold hover:bg-red-500 hover:text-black">Delete Account</button>
            </div>
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
        <div class="p-6 md:p-8 text-center">
            <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                </svg>
            </div>
            <h2 class="text-red-400 font-bold text-xl mb-2">Access Banned</h2>
            <p class="text-gray-500 text-sm mb-4">You are temporarily banned from becoming a reseller.</p>
            <p class="text-gray-400 text-sm">Time remaining: approximately ${hoursLeft} hours</p>
            <p class="text-gray-600 text-xs mt-2">Ban expires: ${dateStr}</p>
        </div>
    `);
}

async function OpenResellPortal() {
    HideAuth();
    ShowContent();
    document.getElementById("resell-hero")?.classList.add("hidden");
    document.getElementById("resell-auth-card")?.classList.add("hidden");

    // Switch to darker gradient background when logged in
    if (window.switchToLoggedInBackground) {
        window.switchToLoggedInBackground();
    }

    const refreshBtn = document.getElementById("resell-refresh-btn");
    if (refreshBtn) refreshBtn.onclick = async () => { await FetchResellLicenses(); };

    SetupSettingsTab();
    SetupAssignModal();
    ensureResellResizers();
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
    document.getElementById("resell-delete-confirm-btn")?.addEventListener("click", async () => {
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
            await AuthApi.VerifyPassword(password, { allowCookie: true });
            await AuthApi.RequestDeletion({ allowCookie: true });
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
            document.getElementById("resell-delete-confirm-btn")?.click();
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

        if (passwordInput) passwordInput.value = "";
        if (errorMsg) {
            errorMsg.textContent = "";
            errorMsg.classList.add("hidden");
        }

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
            await AuthApi.VerifyPassword(password, { allowCookie: true });
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
                        <button data-assign="${encoded}" class="px-3 py-1.5 border border-hacker-blue text-hacker-blue hover:bg-hacker-blue hover:text-black transition-colors text-xs mr-2">Assign</button>
                        <button data-copy="${encoded}" class="px-3 py-1.5 border border-gray-700 text-gray-300 hover:text-white hover:border-hacker-blue hover:text-hacker-blue transition-colors text-xs">Copy</button>
                    </td>
                </tr>
            `;
        }).join("");

        // Assign button handlers
        document.querySelectorAll("[data-assign]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const encoded = btn.getAttribute("data-assign") || "";
                let key = "";
                try { key = decodeURIComponent(encoded); } catch { key = encoded; }
                OpenAssignModal(key);
            });
        });

        // Copy button handlers
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

// Assign Modal Functions
let currentAssignKey = "";

function OpenAssignModal(key) {
    currentAssignKey = key;
    const modal = document.getElementById("assign-modal");
    const input = document.getElementById("assign-discord-id");
    const errorMsg = document.getElementById("assign-error-msg");
    
    if (modal) modal.classList.remove("hidden");
    if (input) {
        input.value = "";
        input.focus();
    }
    if (errorMsg) {
        errorMsg.textContent = "";
        errorMsg.classList.add("hidden");
    }
}

function CloseAssignModal() {
    const modal = document.getElementById("assign-modal");
    if (modal) modal.classList.add("hidden");
    currentAssignKey = "";
}

function SetupAssignModal() {
    const modal = document.getElementById("assign-modal");
    const input = document.getElementById("assign-discord-id");
    const errorMsg = document.getElementById("assign-error-msg");
    const confirmBtn = document.getElementById("assign-confirm-btn");
    const cancelBtn = document.getElementById("assign-cancel-btn");
    const closeBtn = document.getElementById("close-assign-modal-btn");
    const overlay = document.getElementById("assign-modal-overlay");

    // Close modal handlers
    closeBtn?.addEventListener("click", CloseAssignModal);
    overlay?.addEventListener("click", CloseAssignModal);
    cancelBtn?.addEventListener("click", CloseAssignModal);

    // Confirm assign
    confirmBtn?.addEventListener("click", async () => {
        const discordId = input?.value?.trim() || "";
        
        if (!discordId) {
            if (errorMsg) {
                errorMsg.textContent = "Please enter a Discord ID.";
                errorMsg.classList.remove("hidden");
            }
            return;
        }

        // Validate Discord ID format (should be numeric)
        if (!/^\d{17,20}$/.test(discordId)) {
            if (errorMsg) {
                errorMsg.textContent = "Invalid Discord ID format. Must be 17-20 digits.";
                errorMsg.classList.remove("hidden");
            }
            return;
        }

        if (confirmBtn) confirmBtn.disabled = true;
        if (errorMsg) {
            errorMsg.textContent = "Assigning...";
            errorMsg.className = "text-hacker-blue text-sm mb-3";
        }

        try {
            const result = await AuthApi.AssignResellLicense(discordId, { allowCookie: true });
            
            if (result?.ok) {
                CloseAssignModal();
                await FetchResellLicenses();
                alert(`License assigned successfully!\nLicense: ${result.licenseKey}\nExpires: ${FormatExpiry(result.expiresAt)}`);
            } else {
                throw new Error(result?.error || "Failed to assign license");
            }
        } catch (err) {
            const code = err?.error || err?.message || "request_failed";
            if (errorMsg) {
                errorMsg.textContent = "Error: " + EscapeHtml(String(code));
                errorMsg.className = "text-red-400 text-sm mb-3";
            }
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
        }
    });

    // Enter key to submit
    input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            confirmBtn?.click();
        }
    });
}

async function RenderGate() {
    if (!authEl) return;

    ShowAuth();
    HideContent();
    document.getElementById("resell-hero")?.classList.add("hidden");
    document.getElementById("resell-auth-card")?.classList.remove("hidden");

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

