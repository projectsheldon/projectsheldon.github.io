import Api from "./backend.js";

export async function RedirectToPlatform(platform, newTab = true)
{
    const apiUrl = await Api.GetApiUrl();
    const endpoint = `${apiUrl}/links/${platform}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if(data.link)
    {
        if(newTab)
            window.open(data.link, '_blank');
        else
            window.location.href = data.link;
    }
};
export default RedirectToPlatform;

window.RedirectToPlatform = RedirectToPlatform; 