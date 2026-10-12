import Api from '../util/backend.js';

export async function CheckAuthStatus()
{
    const token = DiscordAuth.GetSessionToken();
    const apiUrl = await Api.GetApiUrl();

    try
    {
        const endpoint = `${apiUrl}/discord/me`;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
        const response = await fetch(endpoint, {
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
            headers: token
                ? { Authorization: `Bearer ${token}` }
                : undefined,
            signal: controller ? controller.signal : undefined
        });
        if(timer) clearTimeout(timer);

        const data = await response.json();

        if(data.success && data.loggedIn)
        {
            DiscordAuth.currentUser = data.user;
            UpdateUI(true, data.user);
            return true;
        } else
        {
            DiscordAuth.currentUser = null;
            if(token)
            {
                DiscordAuth.DeleteSessionToken();
            }
            UpdateUI();
            return false;
        }
    }
    catch(error)
    {
        // Network error: do NOT assume the token is valid. Returning `true` here previously
        // let a planted token survive validation just because the backend was unreachable,
        // which cements a session-fixation attack whenever the network flaps.
        UpdateUI();
        return false;
    }
}
function UpdateUI(loggedIn, user = null)
{
    // The loading veil stays up until the auth check settles on a definite
    // answer (logged in or not) – never leave the page covered.
    if(window.AuthLoading) window.AuthLoading.hide();

    const discordBtn = document.getElementById('discord-login-btn');
    const userProfileTrigger = document.getElementById('user-profile-trigger');

    // Hero call-to-action keeps the translated "Download" label in both states.
    // The click behaviour reads login state at click time (prompts Discord login
    // when logged out), so we only ensure the label is never clobbered here.
    const heroCta = document.getElementById('hero-cta');
    if(heroCta)
    {
        let want = 'Download for Windows';
        try { if(window.SheldonLang) want = window.SheldonLang.t('hero.download'); } catch(e) {}
        if(heroCta.textContent.trim() !== want)
            heroCta.textContent = want;
    }

    if(loggedIn)
    {
        if(userProfileTrigger)
        {
            userProfileTrigger.classList.remove('hidden');

            const nameEl = userProfileTrigger.querySelector('.user-name');
            if(nameEl)
            {
                nameEl.textContent = user.globalName || user.username;
            }

            const avatarEl = userProfileTrigger.querySelector('.user-avatar');
            const defaultAvatarEl = userProfileTrigger.querySelector('.default-avatar');

            if(avatarEl && user.avatar)
            {
                avatarEl.src = user.avatar;
                avatarEl.classList.remove('hidden');
                if(defaultAvatarEl) defaultAvatarEl.classList.add('hidden');
            }

            // Show balance next to username
            const balanceEl = userProfileTrigger.querySelector('.user-balance');
            if(balanceEl)
            {
                const balance = user.balance !== undefined ? user.balance : 0;
                balanceEl.textContent = `Balance: ${Number(balance).toFixed(1)}`;
                balanceEl.classList.remove('hidden');
            }
            else
            {
                const balanceSpan = document.createElement('span');
                balanceSpan.className = 'user-balance text-[0.6rem] font-bold text-[#c7b18f] tracking-wider leading-none';
                balanceSpan.style.marginTop = '1px';
                balanceSpan.textContent = `Balance: ${Number(user.balance || 0).toFixed(1)}`;
                const textRight = userProfileTrigger.querySelector('.text-right');
                if(textRight) textRight.appendChild(balanceSpan);
            }
        }

        if(discordBtn)
        {
            // Logged in: hide the button – the account menu's "Sign out" is the
            // logout path now. The logged-out branch below removes `hidden` and
            // restores the "Login" label, so the button reappears after sign-out.
            discordBtn.classList.add('hidden');
            discordBtn.classList.remove('is-authed', 'is-loading');
        }
    }
    else
    {
        DiscordAuth.currentUser = null;

        if(userProfileTrigger)
        {
            userProfileTrigger.classList.add('hidden');
            const balanceEl = userProfileTrigger.querySelector('.user-balance');
            if(balanceEl) balanceEl.classList.add('hidden');
        }
        if(discordBtn)
        {
            discordBtn.classList.remove('hidden', 'is-authed', 'is-loading');
            discordBtn.setAttribute('aria-label', 'Sign in with Discord');

            const loginTxt = discordBtn.querySelector('#discord-login-txt');
            if(loginTxt)
            {
                loginTxt.textContent = 'Sign in';
                // Restore the mobile-hidden behaviour (icon-only on small screens).
                loginTxt.classList.add('hidden');
            }
        }
    }
}

class DiscordUser {
    constructor(id, username, globalName, avatar) {
        this.id = id;
        this.username = username;
        this.globalName = globalName;
        this.avatar = avatar;
    }

    get Avatar() {
        if(this.avatar) {
            return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.png?size=256`;
        }
        return null;
    }

    get Displayname() {
        return this.globalName || this.username;
    }
}

const DiscordAuth = {
    currentUser: null,
    
    // api request
    async Login()
    {
        const apiUrl = await Api.GetApiUrl();
        const response = await fetch(`${apiUrl}/discord/login`);
        const data = await response.json();

        // Only follow the URL if it actually points at Discord's OAuth endpoint. Guards
        // against a compromised backend response (or a cache-poisoned Api.GetApiUrl)
        // returning `javascript:...` or an off-domain phishing URL.
        if(typeof data.url === 'string' && /^https:\/\/discord\.com\//i.test(data.url)) {
            window.location.href = data.url;
        }
    },
    async Logout()
    {
        const apiUrl = await Api.GetApiUrl();
        const token = this.GetSessionToken();

        // Send the session token (and cookie) so the backend can invalidate THIS
        // session server-side. Best-effort: a network failure must not block the
        // local sign-out that follows in the click handler.
        try
        {
            await fetch(`${apiUrl}/discord/logout`, {
                method: "POST",
                mode: 'cors',
                credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
        }
        catch(e) {}
    },
    async GetUser()
    {
        const apiUrl = await Api.GetApiUrl();
        const token = this.GetSessionToken();

        const headers = {};
        if(token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${apiUrl}/discord/me`, { headers });
        const data = await response.json();

        if(!data.success || !data.user) {
            return null;
        }

        const u = data.user;
        return new DiscordUser(u.id, u.username, u.global_name || u.globalName, u.avatar);
    },

    // bot
    async GetClientId()
    {
        const data = await Api.GetDiscordConfig();
        return data.clientId;
    },

    // token
    GetSessionToken()
    {
        return localStorage.getItem('discord_session');
    },
    SetSessionToken(token)
    {
        localStorage.setItem('discord_session', token);
    },
    DeleteSessionToken()
    {
        localStorage.removeItem('discord_session');
        localStorage.removeItem('cache_discord_user');
        localStorage.removeItem('cache_bulk_info_timestamp');
    },

    // prompt
    _PromptDiscordApp(callback)
    {
        const previouslyFocused = document.activeElement;
        const previousBodyOverflow = document.body.style.overflow;
        let minCloseTime = 0;

        const overlay = document.createElement('div');
        overlay.id = 'discord-app-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'discord-app-title');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;transition:opacity 0.2s ease;opacity:0;';

        const modal = document.createElement('div');
        modal.id = 'discord-app-modal';
        modal.style.cssText = 'position:relative;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);transform:scale(0.96);transition:transform 0.2s cubic-bezier(0.16,1,0.3,1);';

        modal.innerHTML =
            '<div style="width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:#5865F2;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(88,101,242,0.35);">' +
                '<svg width="28" height="28" viewBox="0 0 127.14 96.36" fill="#ffffff" aria-hidden="true"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a.41.41,0,0,0-.43.2,72.48,72.48,0,0,0-3.17,6.52,97.26,97.26,0,0,0-29,0,72.84,72.84,0,0,0-3.19-6.52.4.4,0,0,0-.43-.2A105.09,105.09,0,0,0,19.44,8.07a.44.44,0,0,0-.2.07C2.12,34,1.15,59.39,3.46,84.41a.48.48,0,0,0,.19.34A105.77,105.77,0,0,0,35.77,96.36a.42.42,0,0,0,.46-.22,74.22,74.22,0,0,0,6.42-10.38.4.4,0,0,0-.22-.56,68.7,68.7,0,0,1-10-4.76.41.41,0,0,1,0-.69c.83-.62,1.67-1.28,2.46-1.95a.39.39,0,0,1,.41-.05,73.4,73.4,0,0,0,57.48,0,.39.39,0,0,1,.41.05c.79.67,1.63,1.33,2.46,1.95a.41.41,0,0,1,0,.69,68.61,68.61,0,0,1-10,4.76.41.41,0,0,0-.22.56,74.8,74.8,0,0,0,6.43,10.38.42.42,0,0,0,.46.22,105.48,105.48,0,0,0,32.11-11.61.45.45,0,0,0,.19-.34c2.72-28.53-4.67-53.59-20-76.27A.39.39,0,0,0,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.07,65.69,84.69,65.69Z"/></svg>' +
            '</div>' +
            '<h3 id="discord-app-title" style="color:white;font-size:19px;font-weight:700;margin:0 0 8px;">Login with Discord</h3>' +
            '<p style="color:rgba(255,255,255,0.55);font-size:13px;line-height:1.5;margin:0 0 24px;">How would you like to continue?</p>' +
            '<div style="display:flex;gap:12px;">' +
                '<button id="discord-app-yes" style="flex:1;background:#5865F2;color:white;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s ease;">Open App</button>' +
                '<button id="discord-app-no" style="flex:1;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s ease;">Use Browser</button>' +
            '</div>' +
            '<button id="discord-app-quick" style="width:100%;margin-top:12px;background:transparent;border:1px solid rgba(199,177,143,0.4);color:#c7b18f;border-radius:10px;padding:11px 16px;font-size:13px;font-weight:700;cursor:pointer;transition:background 0.2s ease;">Quick login – scan with your phone</button>';

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });

        // Single teardown for scroll lock, key listener and focus restore. Called both from
        // closeOverlay() here and from _PollForToken's removeOverlay(), so cleanup happens no
        // matter which path tears the overlay down.
        window._discordOverlayCleanup = function ()
        {            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousBodyOverflow;
            if(previouslyFocused && typeof previouslyFocused.focus === 'function')
            {
                try { previouslyFocused.focus(); } catch(e) {}
            }
            window._discordOverlayCleanup = null;
        };

        function closeOverlay()
        {
            window._discordLoginPopupOpen = false;
            if(window._discordOverlayCleanup) window._discordOverlayCleanup();
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }

        function onKeyDown(e)
        {
            if(e.key === 'Escape' && Date.now() >= minCloseTime)
            {
                callback(null);
                closeOverlay();
            }
        }
        document.addEventListener('keydown', onKeyDown);

        overlay.onclick = (e) => {
            if(e.target === overlay && Date.now() >= minCloseTime) {
                callback(null);
                closeOverlay();
            }
        };

        const yesBtn = document.getElementById('discord-app-yes');
        const noBtn = document.getElementById('discord-app-no');
        const quickBtn = document.getElementById('discord-app-quick');

        yesBtn.onmouseenter = () => yesBtn.style.background = '#4752c4';
        yesBtn.onmouseleave = () => yesBtn.style.background = '#5865F2';
        noBtn.onmouseenter = () => noBtn.style.background = 'rgba(255,255,255,0.14)';
        noBtn.onmouseleave = () => noBtn.style.background = 'rgba(255,255,255,0.08)';
        if(quickBtn)
        {
            quickBtn.onmouseenter = () => quickBtn.style.background = 'rgba(199,177,143,0.1)';
            quickBtn.onmouseleave = () => quickBtn.style.background = 'transparent';
        }

        yesBtn.onclick = () => {
            minCloseTime = Date.now() + 2000;
            callback('app');
        };
        if(quickBtn) quickBtn.onclick = () => { callback('quick'); };
        noBtn.onclick = () => {
            callback('browser');
            // Do NOT closeOverlay here – the poll keeps the same overlay alive as a
            // "Waiting for Discord…" state so the user sees progress instead of a
            // vanished popup polluting the background. _PollForToken will transform
            // this modal in place, and removeOverlay() there is the single close path.
        };

        // Give the primary action keyboard focus so Enter/Escape work immediately.
        requestAnimationFrame(() => { try { yesBtn.focus(); } catch(e) {} });

        // Expose a helper so LoginPopup's fallback can still force-close if needed.
        window._discordForceCloseOverlay = closeOverlay;
    },

    // window
    async LoginPopup()
    {
        if(window._discordLoginPopupOpen) return;
        window._discordLoginPopupOpen = true;

        // Fetch critical config. If it fails we STILL open the chooser overlay so the
        // click always produces visible feedback – the old early-return here was the
        // classic "click does nothing" bug when the backend hiccupped and the flag
        // reset silently with only a toast (or no toast if Notify hadn't loaded).
        let apiUrl, clientId;
        let configOk = true;
        try
        {
            apiUrl = await Api.GetApiUrl();
            clientId = await this.GetClientId();
            if(!apiUrl || !clientId) throw new Error('missing config');
        }
        catch(e)
        {
            configOk = false;
            // Try one more time for apiUrl so we at least have a fallback origin
            try { if(!apiUrl) apiUrl = await Api.GetApiUrl(); } catch(_) {}
            if(!apiUrl) apiUrl = 'https://backend.projectsheldon.me';
            if(!clientId) { try { clientId = await this.GetClientId(); } catch(_) {} }
        }

        const redirectUri = encodeURIComponent(`${String(apiUrl||'https://backend.projectsheldon.me').replace(/\/+$/, '')}/discord/callback`);
        const scope = "identify";
        const origin = window.location.origin;

        // Mint a login nonce and stash it in localStorage. The hash-token receiver below
        // requires this flag to exist before accepting `#discord_token=…`. Without it,
        // an attacker-sent link like `?…#discord_token=THEIR_TOKEN` can't plant a session
        // (session fixation). Cleared after use or on TTL.
        try {
            localStorage.setItem('discord_login_pending', String(Date.now()));
        } catch(e) {}

        let authCode = '';
        try
        {
            const res = await fetch(`${apiUrl}/discord/init-auth?origin=${encodeURIComponent(origin)}`);
            const data = await res.json();
            if(data.ok) authCode = data.code;
        } catch(e) {}

        const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(origin)}`;
        const discordAppUrl = `discord://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${encodeURIComponent(authCode)}`;

        this._PromptDiscordApp(function (choice) {
            // Phone-approval flow: needs only the backend URL, not the Discord
            // client id, so it runs even when the OAuth config failed to load.
            if(choice === 'quick')
            {
                DiscordAuth._QuickLogin(apiUrl);
                return;
            }
            if(!configOk || !clientId)
            {
                const modal = document.querySelector('#discord-app-modal');
                if(modal)
                {
                    modal.innerHTML = '<h3 style="color:#ef4444;font-size:17px;margin:0 0 8px;">Login service unavailable</h3>' +
                        '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;">Could not reach the login server. Check your connection and try again.</p>' +
                        '<div style="display:flex;gap:10px;"><button id="cfg-retry" style="flex:1;background:#5865F2;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;">Try Again</button><button id="cfg-close" style="flex:1;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;cursor:pointer;">Close</button></div>';
                    const r=document.getElementById('cfg-retry'), c=document.getElementById('cfg-close');
                    if(r) r.onclick = ()=>{ if(window._discordForceCloseOverlay) window._discordForceCloseOverlay(); else { const o=document.querySelector('#discord-app-overlay'); if(o) o.remove(); } window._discordLoginPopupOpen=false; DiscordAuth.LoginPopup(); };
                    if(c) c.onclick = ()=>{ if(window._discordForceCloseOverlay) window._discordForceCloseOverlay(); else { const o=document.querySelector('#discord-app-overlay'); if(o) o.remove(); } window._discordLoginPopupOpen=false; };
                }
                return;
            }
            if(choice === 'app')
            {
                const modal = document.querySelector('#discord-app-modal');
                if(modal)
                {
                    modal.innerHTML = '<h3 style="color:white;font-size:18px;margin:0 0 8px;">Opening Discord...</h3>' +
                        '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;">Authorize in the Discord app.</p>' +
                        (authCode
                            ? '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:14px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08);">' +
                                '<p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0 0 8px;text-align:left;">If a new browser tab opens, enter the code from there:</p>' +
                                '<div style="display:flex;gap:8px;">' +
                                    '<input id="auth-code-input" type="text" maxlength="6" placeholder="Enter code" style="flex:1;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;color:white;font-size:14px;text-align:center;letter-spacing:3px;text-transform:uppercase;outline:none;">' +
                                    '<button id="auth-code-submit" style="background:#5865F2;color:white;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;">Verify</button>' +
                                '</div>' +
                                '<div id="auth-code-hint" style="margin-top:8px;font-size:11px;color:rgba(255,255,255,0.45);min-height:14px;"></div>' +
                            '</div>'
                            : '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);border-radius:8px;padding:12px;margin-bottom:8px;font-size:12px;color:rgba(255,255,255,0.75);">Could not reach the authentication server. You can still try the browser flow – it may recover.</div>');
                }


                if(authCode)
                {
                    const input = document.getElementById('auth-code-input');
                    const submitBtn = document.getElementById('auth-code-submit');
                    const hint = document.getElementById('auth-code-hint');
                    let submitting = false;
                    let lastSubmit = 0;

                    const setHint = (msg, color) => { if(hint){ hint.textContent = msg || ''; hint.style.color = color || 'rgba(255,255,255,0.45)'; } };

                    const doSubmit = async () =>
                    {
                        if(submitting) return;
                        if(Date.now() - lastSubmit < 1200) { setHint('Wait a moment before trying again.', '#fbbf24'); return; }
                        const raw = input ? input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'') : '';
                        if(!raw || raw.length !== 6) { setHint('Enter the 6-character code.', '#f87171'); if(input) input.focus(); return; }
                        submitting = true; lastSubmit = Date.now();
                        if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = '…'; submitBtn.style.opacity='0.7'; }
                        setHint('Checking code…', 'rgba(255,255,255,0.55)');
                        try
                        {
                            const res = await fetch(`${apiUrl}/discord/poll-auth?code=${encodeURIComponent(raw)}`);
                            const is429 = res.status === 429;
                            const data = await res.json().catch(()=> ({}));
                            if(data.ok && data.status === 'success')
                            {
                                setHint('Code accepted – signing you in…', '#22c55e');
                                if(window._resolveAuthPoll) window._resolveAuthPoll(data.token);
                            }
                            else if(data.ok && data.status === 'error')
                            {
                                if(window._resolveAuthPoll) window._resolveAuthPoll(null, 'Login cancelled');
                                else setHint('Login was cancelled.', '#f87171');
                            }
                            else if(data.status === 'pending')
                            {
                                setHint('Code not ready yet – finish authorizing in the other tab, then try again.', '#fbbf24');
                            }
                            else if(data.status === 'rate_limited' || is429)
                            {
                                setHint('Too many attempts – wait 30s and try again.', '#fbbf24');
                                if(typeof Notify !== 'undefined') Notify('Too many attempts – wait a moment.', 'warning', 3000);
                            }
                            else if(data.status === 'expired')
                            {
                                setHint('That code expired. Close and start login again.', '#f87171');
                                if(typeof Notify !== 'undefined') Notify('That code expired. Start login again.', 'error', 3000);
                            }
                            else
                            {
                                setHint('Invalid code. Check and try again.', '#f87171');
                            }
                        } catch(e) { setHint('Network error – try again.', '#f87171'); }
                        finally { submitting = false; if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent='Verify'; submitBtn.style.opacity='1'; } }
                    };

                    if(submitBtn) submitBtn.onclick = doSubmit;
                    if(input){
                        input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') doSubmit(); });
                        input.addEventListener('input', ()=>{ input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); setHint('', ''); });
                        // paste helper
                        input.addEventListener('paste', ()=> setTimeout(()=>{ input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); }, 10));
                        setTimeout(()=> { try{ input.focus(); }catch(e){} }, 120);
                    }
                }

                const a = document.createElement('a');
                a.href = discordAppUrl;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                DiscordAuth._PollForToken(oauthUrl, authCode, apiUrl);
            }
            else if(choice === 'browser')
            {
                const modal = document.querySelector('#discord-app-modal');
                if(modal)
                {
                    modal.innerHTML = '<div style="width:42px;height:42px;margin:0 auto 14px;border:3px solid rgba(255,255,255,0.12);border-top-color:#5865F2;border-radius:50%;animation:discordSpin 0.7s linear infinite;"></div>' +
                        '<h3 style="color:white;font-size:17px;margin:0 0 6px;">Waiting for Discord…</h3>' +
                        '<p style="color:rgba(255,255,255,0.55);font-size:13px;margin:0 0 16px;">A popup should have opened. Authorize there and you’ll be signed in automatically.</p>' +
                        '<div style="display:flex;gap:10px;justify-content:center;"><button id="browser-popup-retry" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:white;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;">Re-open popup</button><button id="browser-cancel" style="background:transparent;border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;">Cancel</button></div>' +
                        '<p style="margin-top:14px;font-size:11px;color:rgba(255,255,255,0.35);">Keep this window open – you’ll be signed in automatically.</p>';
                }
                const retryBtn = document.getElementById('browser-popup-retry');
                const cancelBtn = document.getElementById('browser-cancel');
                let popupRef = null;

                const openPopup = () => {
                    const p = window.open(oauthUrl, 'sheldon_discord_auth', 'popup=1,width=480,height=700');
                    if(!p)
                    {
                        // Popup blocked – fall back to navigating this tab, but warn first.
                        if(typeof Notify !== 'undefined') Notify('Popup blocked – redirecting this tab to Discord.', 'warning', 4000);
                        setTimeout(()=> { window.location.href = oauthUrl; }, 600);
                        return null;
                    }
                    return p;
                };
                popupRef = openPopup();
                if(retryBtn) retryBtn.onclick = () => { popupRef = openPopup(); if(popupRef) retryBtn.textContent='Popup opened'; setTimeout(()=> retryBtn.textContent='Re-open popup', 2000); };
                if(cancelBtn) cancelBtn.onclick = () => {
                    if(window._discordForceCloseOverlay) window._discordForceCloseOverlay();
                    else { const o=document.querySelector('#discord-app-overlay'); if(o) o.remove(); window._discordLoginPopupOpen=false; }
                };

                // Browser flow completes via hash/postMessage (state is the return URL, not the
                // 6-char code), so we don't poll poll-auth with authCode here – that only
                // spammed the backend with pending checks that could never succeed and hit
                // the rate limit. Just wait for the token to appear via the hash listener.
                DiscordAuth._PollForToken(oauthUrl, null, apiUrl, popupRef);
            }
            else if(choice === null)
            {
                // User dismissed the chooser (ESC / click outside) – ensure flag is cleared.
                window._discordLoginPopupOpen = false;
                window._quickLoginCancelled = true;
                if(window._discordOverlayCleanup) window._discordOverlayCleanup();
            }
        });

        // /discord/init-auth failed (backend unreachable / challenged) – the code box will be
        // missing from the modal. Tell the visitor instead of silently degrading.
        if(!authCode)
        {
            setTimeout(() =>
            {
                const modal = document.querySelector('#discord-app-modal');
                if(!modal) return;
                const already = modal.querySelector('#init-auth-warning');
                if(already) return;
                const note = document.createElement('div');
                note.id = 'init-auth-warning';
                note.textContent = "Can't reach the authentication server. The browser popup may still work – try \"Use Browser\" or close and try again.";
                note.style.cssText = 'margin-top:14px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-size:11px;color:rgba(255,255,255,0.75);';
                modal.appendChild(note);
            }, 80);
        }
    },

    async _PollForToken(fallbackOauthUrl, authCode, apiUrl, popupRef)
    {
        await new Promise(resolve =>
        {
            // We only tear the overlay down once the backend CONFIRMS a real session. Any
            // other outcome (cancelled, expired, unconfirmed, timed out) keeps the overlay
            // open so the user can retry or finish via the code – we never auto-dismiss or
            // navigate them away.
            let settled = false;
            let verifying = false;
            let attempt = 0;
            let pollTimer = null;
            let fallbackTimer = null;
            let rateLimitedUntil = 0;

            function cleanup()
            {
                if(pollTimer) clearTimeout(pollTimer);
                if(fallbackTimer) clearTimeout(fallbackTimer);
                pollTimer = null; fallbackTimer = null;
                window._resolveAuthPoll = null;
            }

            function removeOverlay(delay)
            {
                window._discordLoginPopupOpen = false;
                if(window._discordOverlayCleanup) window._discordOverlayCleanup();
                const o = document.querySelector('#discord-app-overlay');
                if(!o) return;
                if(delay > 0) { o.style.opacity = '0'; setTimeout(() => o.remove(), delay); }
                else o.remove();
            }

            // Not logged in: keep the overlay up with a retry/close so the user is never stuck.
            function keepOpen(title, sub)
            {
                if(settled) return;
                cleanup();
                // If polling was started from the browser popup, try to close that popup too.
                try { if(popupRef && !popupRef.closed) popupRef.close(); } catch(e) {}
                const modal = document.querySelector('#discord-app-modal');
                if(!modal) { resolve(); return; }
                modal.innerHTML =
                    '<h3 style="color:#ef4444;font-size:18px;margin:0 0 8px;">' + title + '</h3>' +
                    '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 20px;">' + sub + '</p>' +
                    '<div style="display:flex;gap:12px;">' +
                        '<button id="discord-retry-btn" style="flex:1;background:#5865F2;color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:bold;cursor:pointer;">Try Again</button>' +
                        '<button id="discord-cancel-btn" style="flex:1;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer;">Close</button>' +
                    '</div>';
                const retry = document.getElementById('discord-retry-btn');
                const cancel = document.getElementById('discord-cancel-btn');
                if(retry) retry.onclick = () => { removeOverlay(0); resolve(); DiscordAuth.LoginPopup(); };
                if(cancel) cancel.onclick = () => { removeOverlay(0); resolve(); };
            }

            // Confirm the session with /discord/me before closing. If it doesn't check out,
            // keep the overlay open rather than closing on a token we can't trust.
            async function tryFinish(token)
            {
                if(settled || verifying) return;
                verifying = true;
                try
                {
                    if(token) DiscordAuth.SetSessionToken(token);

                    let loggedIn = false;
                    try { loggedIn = await CheckAuthStatus(); } catch(e) { loggedIn = false; }

                    if(!loggedIn)
                    {
                        if(token) DiscordAuth.DeleteSessionToken();
                        keepOpen('Login failed', 'We could not confirm your login. Please try again.');
                        return;
                    }

                    settled = true;
                    cleanup();
                    try { if(popupRef && !popupRef.closed) popupRef.close(); } catch(e) {}
                    const modal = document.querySelector('#discord-app-modal');
                    if(modal)
                    {
                        modal.innerHTML = '<h3 style="color:#22c55e;font-size:18px;margin:0 0 8px;">Login Successful!</h3>' +
                            '<p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0;">You are now logged in.</p>';
                    }
                    removeOverlay(700);
                    resolve();
                }
                finally { verifying = false; }
            }

            // Resolver used by the manual code-entry Submit button.
            window._resolveAuthPoll = function (token, error)
            {
                if(token) tryFinish(token);
                else keepOpen('Login Cancelled', error || 'You are not logged in yet. Try again.');
            };

            // Adaptive polling with backoff. Starts at ~1.2s and grows to 4s, so we don't
            // hammer the backend. If the server returns 429 we back off much longer.
            async function doPoll()
            {
                if(settled || verifying) { schedule(); return; }

                // Respect server-requested backoff.
                if(Date.now() < rateLimitedUntil)
                {
                    schedule(rateLimitedUntil - Date.now() + 400);
                    return;
                }

                // If the hash receiver already dropped a token into localStorage (popup
                // redirect fallback), consume it immediately – don't wait for the poll.
                const existing = DiscordAuth.GetSessionToken();
                if(existing)
                {
                    // Only auto-finish if we weren't already logged in – avoids re-verifying
                    // in a tight loop after a successful tryFinish that already set the token.
                    // Check whether currentUser is still null; if so, we need to verify.
                    if(!DiscordAuth.currentUser)
                    {
                        await tryFinish(existing);
                        if(settled) return;
                    }
                    // Already logged in – we are done, but keep the timer to avoid spamming.
                    schedule(5000);
                    return;
                }

                if(authCode)
                {
                    try
                    {
                        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                        const t = controller ? setTimeout(()=>controller.abort(), 8000) : null;
                        const res = await fetch(`${apiUrl}/discord/poll-auth?code=${encodeURIComponent(authCode)}`, { signal: controller ? controller.signal : undefined });
                        if(t) clearTimeout(t);
                        if(res.status === 429)
                        {
                            const d429 = await res.json().catch(()=>({}));
                            rateLimitedUntil = Date.now() + ((d429.retry_after || 30) * 1000);
                            if(typeof Notify !== 'undefined') Notify('Too many checks – slowing down for a moment.', 'warning', 3000);
                            schedule(8000);
                            return;
                        }
                        const data = await res.json().catch(()=> ({}));
                        if(data.ok && data.status === 'success') { await tryFinish(data.token); return; }
                        if(data.ok && data.status === 'error') { keepOpen('Login Cancelled', 'You cancelled the Discord authorization.'); return; }
                        if(data.status === 'expired') { keepOpen('Code expired', 'That login code expired. Please try again.'); return; }
                        if(data.status === 'rate_limited') { rateLimitedUntil = Date.now() + 30000; if(typeof Notify !== 'undefined') Notify('Too many attempts – wait a moment.', 'warning', 3000); schedule(8000); return; }
                        // pending => continue with backoff
                    } catch(e) {
                        // Network hiccup: don't treat as fatal, just back off and retry.
                        if(e && e.name === 'AbortError') { /* timeout – retry */ }
                    }
                }

                try
                {
                    const err = localStorage.getItem('discord_error');
                    if(err)
                    {
                        localStorage.removeItem('discord_error');
                        keepOpen('Login Cancelled', 'You cancelled the Discord authorization.');
                        return;
                    }
                } catch(e) {}

                schedule();
            }

            function schedule(delayOverride)
            {
                if(settled) return;
                attempt++;
                let delay = delayOverride != null ? delayOverride : Math.min(1200 + attempt * 280, 4000);
                if(Date.now() < rateLimitedUntil) delay = Math.max(delay, 6000);
                pollTimer = setTimeout(doPoll, delay);
            }

            // Kick off first poll after a short delay so the user sees the modal first.
            pollTimer = setTimeout(doPoll, 1100);

            // Also watch hash changes (popup redirect fallback may land here via hash).
            const onHash = () => {
                if(settled || verifying) return;
                const h = window.location.hash;
                if(h.startsWith('#discord_token=')) {
                    const tok = decodeURIComponent(h.substring('#discord_token='.length));
                    if(tok) tryFinish(tok);
                }
            };
            window.addEventListener('hashchange', onHash);

            // Wrap cleanup to also remove hash listener
            const origCleanup = cleanup;
            cleanup = function () { window.removeEventListener('hashchange', onHash); origCleanup(); };

            // Safety net: after the code's server-side lifetime, stop polling but KEEP the
            // overlay with a retry. We deliberately do NOT redirect the user anywhere.
            fallbackTimer = setTimeout(() =>
            {
                keepOpen('Still waiting…', 'Finish in Discord, or try again. The code expires after 5 minutes.');
            }, 300000);

            // If the page is hidden (user switched tabs to Discord), throttle but keep polling.
            document.addEventListener('visibilitychange', function vis(){
                if(document.hidden) { /* throttled by schedule anyway */ }
            });
        });

        CheckAuthStatus();
    },

    // Quick login: this device shows a QR + short code, the phone approves,
    // this tab polls /discord/quick-status until it can claim the session.
    // Link mode (direction B, caller already logged in): the start call carries
    // this browser's sessionToken so the row is pre-bound to my account, and
    // the other browser claims straight in – no approval step. The minter's
    // poll ends when the row flips to consumed (claimed on the new device).
    // Everything rendered here comes from the server, so all of it goes
    // through textContent/createElement – never innerHTML with live data.
    async LinkNewDevice()
    {
        const apiUrl = await Api.GetApiUrl();
        // The topbar menu calls this directly with no chooser overlay open, so
        // #discord-app-modal does not exist and _QuickLogin used to return
        // silently – the classic "button does nothing" bug. Mint the same
        // overlay _PromptDiscordApp uses so the QR flow always has a host.
        if(!document.querySelector('#discord-app-modal'))
        {
            const previouslyFocused = document.activeElement;
            const previousBodyOverflow = document.body.style.overflow;
            const overlay = document.createElement('div');
            overlay.id = 'discord-app-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'discord-app-title');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;transition:opacity 0.2s ease;opacity:0;';
            const modal = document.createElement('div');
            modal.id = 'discord-app-modal';
            modal.style.cssText = 'position:relative;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);transform:scale(0.96);transition:transform 0.2s cubic-bezier(0.16,1,0.3,1);';
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });
            window._discordOverlayCleanup = function ()
            {
                document.removeEventListener('keydown', onKeyDown);
                document.body.style.overflow = previousBodyOverflow;
                if(previouslyFocused && typeof previouslyFocused.focus === 'function')
                {
                    try { previouslyFocused.focus(); } catch(e) {}
                }
                window._discordOverlayCleanup = null;
            };
            function onKeyDown(e)
            {
                if(e.key === 'Escape')
                {
                    window._quickLoginCancelled = true;
                    window._discordLoginPopupOpen = false;
                    if(window._discordOverlayCleanup) window._discordOverlayCleanup();
                    overlay.remove();
                }
            }
            document.addEventListener('keydown', onKeyDown);
            overlay.onclick = (e) => {
                if(e.target === overlay)
                {
                    window._quickLoginCancelled = true;
                    window._discordLoginPopupOpen = false;
                    if(window._discordOverlayCleanup) window._discordOverlayCleanup();
                    overlay.remove();
                }
            };
            window._discordLoginPopupOpen = true;
        }
        return DiscordAuth._QuickLogin(apiUrl, true);
    },
    async _QuickLogin(apiUrl, linkMode)
    {
        window._quickLoginCancelled = false;
        const modal = document.querySelector('#discord-app-modal');
        if(!modal) { window._discordLoginPopupOpen = false; return; }
        modal.dataset.quick = '1';

        const alive = () => !window._quickLoginCancelled
            && document.body.contains(modal)
            && modal.dataset.quick === '1';

        let pollTimer = null;
        let countTimer = null;
        const stopTimers = () => {
            if(pollTimer) clearTimeout(pollTimer);
            if(countTimer) clearInterval(countTimer);
            pollTimer = null; countTimer = null;
        };

        function closeAll()
        {
            stopTimers();
            window._quickLoginCancelled = true;
            window._discordLoginPopupOpen = false;
            if(window._discordOverlayCleanup) window._discordOverlayCleanup();
            const o = document.querySelector('#discord-app-overlay');
            if(o) o.remove();
        }

        function paintLoading()
        {
            modal.innerHTML = '';
            const spin = document.createElement('div');
            spin.style.cssText = 'width:42px;height:42px;margin:0 auto 14px;border:3px solid rgba(255,255,255,0.12);border-top-color:#c7b18f;border-radius:50%;animation:discordSpin 0.7s linear infinite;';
            modal.appendChild(spin);
            const t = document.createElement('h3');
            t.style.cssText = 'color:white;font-size:17px;margin:0 0 6px;';
            t.textContent = 'Preparing quick login…';
            modal.appendChild(t);
        }

        function paintError(msg)
        {
            if(!alive()) return;
            stopTimers();
            modal.innerHTML = '';
            const t = document.createElement('h3');
            t.style.cssText = 'color:#ef4444;font-size:17px;margin:0 0 8px;';
            t.textContent = 'Quick login unavailable';
            modal.appendChild(t);
            const p = document.createElement('p');
            p.style.cssText = 'color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;';
            p.textContent = msg;
            modal.appendChild(p);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:10px;';
            modal.appendChild(row);
            const retry = document.createElement('button');
            retry.textContent = 'Try Again';
            retry.style.cssText = 'flex:1;background:#5865F2;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;';
            row.appendChild(retry);
            const close = document.createElement('button');
            close.textContent = 'Close';
            close.style.cssText = 'flex:1;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;cursor:pointer;';
            row.appendChild(close);
            retry.onclick = () => { DiscordAuth._QuickLogin(apiUrl, linkMode); };
            close.onclick = () => closeAll();
        }

        function paintEnd(title, sub, ok)
        {
            if(!alive()) return;
            stopTimers();
            modal.innerHTML = '';
            const t = document.createElement('h3');
            t.style.cssText = `color:${ok ? '#22c55e' : '#ef4444'};font-size:18px;margin:0 0 8px;`;
            t.textContent = title;
            modal.appendChild(t);
            const p = document.createElement('p');
            p.style.cssText = 'color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 20px;';
            p.textContent = sub;
            modal.appendChild(p);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:12px;';
            modal.appendChild(row);
            const retry = document.createElement('button');
            retry.textContent = 'Try Again';
            retry.style.cssText = 'flex:1;background:#5865F2;color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;font-weight:bold;cursor:pointer;';
            row.appendChild(retry);
            const close = document.createElement('button');
            close.textContent = 'Close';
            close.style.cssText = 'flex:1;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:8px;padding:10px 16px;font-size:14px;cursor:pointer;';
            row.appendChild(close);
            retry.onclick = () => { DiscordAuth._QuickLogin(apiUrl, linkMode); };
            close.onclick = () => closeAll();
        }

        paintLoading();

        let start = null;
        try
        {
            let fp = null;
            try { fp = localStorage.getItem('sheldon_fp'); } catch(e) {}
            const startBody = fp ? { device_id: fp } : {};
            const startHeaders = { 'Content-Type': 'application/json' };
            // Link mode proves the minter at mint time – without this the row
            // stays an approval-type row and the new device cannot claim it.
            if(linkMode)
            {
                try
                {
                    const t = DiscordAuth.GetSessionToken();
                    if(t)
                    {
                        startBody.sessionToken = t;
                        startHeaders.Authorization = 'Bearer ' + t;
                    }
                } catch(e) {}
            }
            const res = await fetch(`${apiUrl}/discord/quick-start`, {
                method: 'POST',
                headers: startHeaders,
                body: JSON.stringify(startBody)
            });
            start = await res.json().catch(() => ({}));
            if(res.status === 429) { paintError('Too many quick logins – wait a while and try again.'); return; }
        }
        catch(e) { start = null; }
        if(!alive()) return;
        if(!start || !start.ok || typeof start.qr_url !== 'string' || typeof start.user_code !== 'string' || typeof start.device_token !== 'string')
        {
            paintError('Could not reach the login server. Check your connection and try again.');
            return;
        }

        modal.innerHTML = '';
        const title = document.createElement('h3');
        title.style.cssText = 'color:white;font-size:18px;margin:0 0 4px;';
        title.textContent = linkMode ? 'Link new device' : 'Quick login';
        modal.appendChild(title);
        const sub = document.createElement('p');
        sub.style.cssText = 'color:rgba(255,255,255,0.55);font-size:13px;margin:0 0 14px;';
        // The bound flag is server-authoritative: when the mint fell back to an
        // approval row (dead session), say so instead of promising a claim.
        const boundRow = !!start.bound;
        sub.textContent = linkMode
            ? (boundRow
                ? 'On the new device, scan the code – the PIN fills in by itself, one tap signs it in as you.'
                : 'Session check failed – this code needs phone approval instead.')
            : 'Scan with your phone, then approve on it.';
        modal.appendChild(sub);

        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'border-radius:12px;margin:0 auto 12px;display:block;';
        modal.appendChild(canvas);
        // The QR lib is a dynamic import on purpose: if it ever fails to load,
        // the typed code below still completes the login – the button never dies.
        try
        {
            const qr = await import('../util/qrcode.js');
            if(alive()) qr.drawQRCode(canvas, start.qr_url, { scale: 5 });
        }
        catch(e) { canvas.style.display = 'none'; }

        const code = document.createElement('div');
        code.style.cssText = 'font-family:ui-monospace,monospace;font-size:30px;font-weight:800;letter-spacing:6px;color:#c7b18f;margin:0 0 4px;';
        code.textContent = start.user_code;
        modal.appendChild(code);
        const codeHint = document.createElement('p');
        codeHint.style.cssText = 'color:rgba(255,255,255,0.45);font-size:12px;margin:0 0 10px;';
        codeHint.textContent = linkMode
            ? 'Scan this on the new device – the PIN fills in by itself.'
            : 'Scan this with your phone – the PIN fills in by itself.';
        modal.appendChild(codeHint);

        const count = document.createElement('p');
        count.style.cssText = 'color:rgba(255,255,255,0.55);font-size:13px;margin:0 0 14px;font-variant-numeric:tabular-nums;';
        modal.appendChild(count);
        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel';
        cancel.style.cssText = 'width:100%;background:transparent;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);border-radius:8px;padding:10px;font-size:13px;cursor:pointer;';
        modal.appendChild(cancel);
        cancel.onclick = () => closeAll();

        function fmtLeft()
        {
            const s = Math.max(0, Math.ceil((Number(start.expires_at) - Date.now()) / 1000));
            return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }
        count.textContent = `Code expires in ${fmtLeft()}`;
        countTimer = setInterval(() =>
        {
            if(!alive()) { stopTimers(); return; }
            if(Date.now() >= Number(start.expires_at))
            {
                paintEnd('Code expired', 'That login code expired. Start again for a fresh one.', false);
                return;
            }
            count.textContent = `Code expires in ${fmtLeft()}`;
        }, 1000);

        async function poll()
        {
            if(!alive()) { stopTimers(); return; }
            try
            {
                const res = await fetch(`${apiUrl}/discord/quick-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device_token: start.device_token })
                });
                const data = await res.json().catch(() => ({}));
                if(!alive()) { stopTimers(); return; }
                if(data && data.ok && data.status === 'approved' && typeof data.sessionToken === 'string')
                {
                    stopTimers();
                    DiscordAuth.SetSessionToken(data.sessionToken);
                    modal.innerHTML = '';
                    const t = document.createElement('h3');
                    t.style.cssText = 'color:#22c55e;font-size:18px;margin:0 0 8px;';
                    t.textContent = 'Login Successful!';
                    modal.appendChild(t);
                    const p = document.createElement('p');
                    p.style.cssText = 'color:rgba(255,255,255,0.6);font-size:13px;margin:0;';
                    p.textContent = 'You are now logged in.';
                    modal.appendChild(p);
                    if(typeof Notify !== 'undefined') Notify('Logged in – welcome back.', 'success', 2500);
                    setTimeout(() => { try { location.reload(); } catch(e) {} }, 700);
                    window._discordLoginPopupOpen = false;
                    if(window._discordOverlayCleanup) window._discordOverlayCleanup();
                    return;
                }
                if(data && data.ok && data.status === 'denied')
                {
                    paintEnd(linkMode ? 'Link declined' : 'Login declined', 'The approval was declined on your phone.', false);
                    return;
                }
                // Link mode ends here: the new device claimed the row, so the
                // minter's poll sees consumed – that IS the success signal.
                if(linkMode && data && data.ok && data.status === 'consumed')
                {
                    stopTimers();
                    modal.innerHTML = '';
                    const t = document.createElement('h3');
                    t.style.cssText = 'color:#22c55e;font-size:18px;margin:0 0 8px;';
                    t.textContent = 'Device linked';
                    modal.appendChild(t);
                    const p = document.createElement('p');
                    p.style.cssText = 'color:rgba(255,255,255,0.6);font-size:13px;margin:0;';
                    p.textContent = 'The new device is now signed in as you.';
                    modal.appendChild(p);
                    if(typeof Notify !== 'undefined') Notify('New device linked.', 'success', 2500);
                    setTimeout(() => closeAll(), 1600);
                    return;
                }
                if(data && data.ok && (data.status === 'expired' || data.status === 'consumed'))
                {
                    paintEnd('Code expired', 'That login code expired. Start again for a fresh one.', false);
                    return;
                }
            }
            catch(e) { /* network hiccup – keep polling until the countdown ends */ }
            if(alive()) pollTimer = setTimeout(poll, 2000);
        }
        pollTimer = setTimeout(poll, 2000);
    }
};

window.DiscordAuth = DiscordAuth;

// Pick up token or error from URL hash (redirect fallback from callback.html)
(function () {
    const hash = window.location.hash;
    if(hash.startsWith('#discord_token='))
    {
        // Only accept a hash-delivered token if we recently opened the OAuth popup
        // ourselves. Without this pairing, anyone can craft
        //   https://projectsheldon.github.io/#discord_token=ATTACKER
        // send the victim, and they end up using the attacker's Discord session.
        // Nonce TTL: 15 min – plenty for a real OAuth round-trip.
        const pending = (() => { try { return Number(localStorage.getItem('discord_login_pending')) || 0; } catch(e) { return 0; } })();
        const NONCE_TTL_MS = 15 * 60 * 1000;
        const nonceValid = pending > 0 && (Date.now() - pending) < NONCE_TTL_MS;
        // Always clear the flag; a single hash-token consumes it.
        try { localStorage.removeItem('discord_login_pending'); } catch(e) {}

        if(!nonceValid) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
            return;
        }
        const token = decodeURIComponent(hash.substring('#discord_token='.length));
        if(token)
        {
            DiscordAuth.SetSessionToken(token);
            history.replaceState(null, '', window.location.pathname + window.location.search);
            setTimeout(() =>
            {
                CheckAuthStatus();
                try { window.close(); } catch(e) {}
            }, 0);
        }
    }
    else if(hash.startsWith('#discord_error='))
    {
        const err = decodeURIComponent(hash.substring('#discord_error='.length));
        history.replaceState(null, '', window.location.pathname + window.location.search);
        try { localStorage.setItem('discord_error', err); } catch(e) {}
        try { localStorage.removeItem('discord_login_pending'); } catch(e) {}
        setTimeout(() =>
        {
            if(typeof Notify !== 'undefined') Notify('Login cancelled', 'warning', 3000);
            try { window.close(); } catch(e) {}
        }, 500);
    }
})();

export { DiscordAuth, UpdateUI, DiscordUser };
