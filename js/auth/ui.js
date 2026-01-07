import * as Discord from "./discord.js";

const authBtn = document.getElementById('auth-btn');

function SetAuthButtonText(loggedIn) {
    authBtn.innerText = loggedIn ? 'SIGN OUT' : 'LOGIN';
}

export async function LoginButton() {
    let hasToken = !!Discord.GetSessionToken(); 

    if (hasToken) {
        Discord.DeleteSessionToken();
        Discord.ClearAuthUser();  
        hasToken = false;
    } else {
        await Discord.LoginDiscord(); 
        hasToken = !!Discord.GetSessionToken();
    }

    SetAuthButtonText(hasToken);
}

window.LoginButton = LoginButton;
SetAuthButtonText(!!Discord.GetSessionToken());