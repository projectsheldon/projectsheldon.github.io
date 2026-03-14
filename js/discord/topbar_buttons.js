import Api from "../util/backend.js";
import { CheckAuthStatus, UpdateUI } from "./auth.js";

const discordBtn = document.getElementById('discord-login-btn');
const userProfileTrigger = document.getElementById('user-profile-trigger');

window.addEventListener('message', function(event)
{
    if(event.data && event.data.type === 'discord_session')
    {
        window.DiscordAuth.SetSessionToken(event.data.token);
        CheckAuthStatus();
    }
});

function handleDiscordBtnClick() {
    if(window.DiscordAuth.currentUser)
    {
        window.DiscordAuth.DeleteSessionToken();
        window.DiscordAuth.currentUser = null;
        UpdateUI();
    } else
    {
        window.DiscordAuth.LoginPopup();
    }
}

if(discordBtn)
{
    discordBtn.addEventListener('click', handleDiscordBtnClick);
}

document.querySelectorAll('.discord-login-btn').forEach(btn => {
    btn.addEventListener('click', handleDiscordBtnClick);
});

document.addEventListener('DOMContentLoaded', CheckAuthStatus);