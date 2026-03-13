import Api from "./backend.js";

window.RedirectToPlatform = async function(platform)
{
    const apiUrl = await Api.GetApiUrl();
    const endpoint = `${apiUrl}/links/${platform}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if(data.link)
    {
        window.open(data.link, '_blank');
    }
};
