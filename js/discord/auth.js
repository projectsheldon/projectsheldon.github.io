import Api from "../util/backend.js";

export async function CheckAuthStatus()
{
    const token = DiscordAuth.GetSessionToken();

    if(!token)
    {
        UpdateUI();
        return;
    }

    const apiUrl = await Api.GetApiUrl();

    try
    {
        const response = await fetch(`${apiUrl}/discord/me?token=${encodeURIComponent(token)}`, {
            method: 'GET',
            mode: 'cors'
        });

        const data = await response.json();

        if(data.success && data.loggedIn)
        {
            DiscordAuth.currentUser = data.user;
            UpdateUI(true, data.user);
        } else
        {
            DiscordAuth.currentUser = null;
            DiscordAuth.DeleteSessionToken();
            UpdateUI();
        }
    }
    catch(error)
    {
        UpdateUI();
    }
}
function UpdateUI(loggedIn, user = null)
{
    const discordBtn = document.getElementById('discord-login-btn');
    const userProfileTrigger = document.getElementById('user-profile-trigger');

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
        }

        if(discordBtn)
        {
            discordBtn.classList.remove('hidden');
            discordBtn.className = 'bg-white text-black font-black px-5 py-2 rounded-xl text-[0.65rem] uppercase tracking-wider transition-all hover:bg-[#c7b18f] flex items-center justify-center';
            discordBtn.style.display = 'flex';
            discordBtn.style.justifyContent = 'center';
            discordBtn.style.alignItems = 'center';

            const loginTxt = discordBtn.querySelector('#discord-login-txt');
            if(loginTxt)
            {
                loginTxt.textContent = 'Logout';
                loginTxt.classList.remove('hidden');
            }
            const discordIcon = discordBtn.querySelector('svg');
            if(discordIcon)
            {
                discordIcon.remove();
            }
        }
    }
    else
    {
        DiscordAuth.currentUser = null;

        if(userProfileTrigger)
        {
            userProfileTrigger.classList.add('hidden');
        }
        if(discordBtn)
        {
            discordBtn.classList.remove('hidden');
            discordBtn.className = 'btn-discord px-5 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all';

            const loginTxt = discordBtn.querySelector('#discord-login-txt');
            if(loginTxt) loginTxt.textContent = 'Login';
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
        if (this.avatar) {
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

        window.location.href = data.url;
    },
    async Logout()
    {
        const apiUrl = await Api.GetApiUrl();
        await fetch(`${apiUrl}/discord/logout`, { method: "POST" });
    },
    async GetUser()
    {
        const apiUrl = await Api.GetApiUrl();
        const token = this.GetSessionToken();
        
        const url = token ? `${apiUrl}/discord/me?token=${encodeURIComponent(token)}` : `${apiUrl}/discord/me`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success || !data.user) {
            return null;
        }

        const u = data.user;
        return new DiscordUser(u.id, u.username, u.global_name, u.avatar);
    },

    // bot
    async GetClientId()
    {
        const apiUrl = await Api.GetApiUrl();
        const response = await fetch(`${apiUrl}/config/discord`);
        const data = await response.json();

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
    },

    // window
    async LoginPopup()
    {
        const width = 600;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;

        const apiUrl = await Api.GetApiUrl();

        const clientId = await this.GetClientId();
        const redirectUri = encodeURIComponent(`${apiUrl}/discord/callback`);
        const scope = "identify";

        const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

        const popup = window.open(oauthUrl, 'Discord Login', `width=${width},height=${height},left=${left},top=${top}`);

        const checkClosed = setInterval(() =>
        {
            if(popup.closed)
            {
                clearInterval(checkClosed);
                CheckAuthStatus();
            }
        }, 500);
    }
};

window.DiscordAuth = DiscordAuth;

export { DiscordAuth, UpdateUI, DiscordUser };