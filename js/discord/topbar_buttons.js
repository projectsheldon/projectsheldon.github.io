import Api from "../util/backend.js";
import { DiscordAuth, CheckAuthStatus, UpdateUI } from "./auth.js";

const discordBtn = document.getElementById('discord-login-btn');
const userProfileTrigger = document.getElementById('user-profile-trigger');

window.addEventListener('message', function(event)
{
    if(event.data && event.data.type === 'discord_session')
    {
        DiscordAuth.SetSessionToken(event.data.token);
        CheckAuthStatus();
    }
});

if(discordBtn)
{
    discordBtn.addEventListener('click', function()
    {
        if(DiscordAuth.currentUser)
        {
            DiscordAuth.DeleteSessionToken();
            DiscordAuth.currentUser = null;
            UpdateUI();
        } else
        {
            DiscordAuth.LoginPopup();
        }
    });
}

document.addEventListener('DOMContentLoaded', CheckAuthStatus);