// export const API_URL = "http://localhost:3350/";
export const API_URL = "https://5.249.161.40:3350/";


export async function GetProducts() {
    try {
        const response = await fetch(`${API_URL}sheldon/products`); 
        const data = await response.json(); 
        return data;
    } catch (err) {
        // alert("Please head to https://5.249.161.40:3350/ and allow the certificate.");
        return null;
    }
}

export function GetCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
}

export async function CheckPermission(permissionName) {
    try {
        const status = await navigator.permissions.query({ name: permissionName });

        return status.state; 
    } catch (err) {
    }
}

export function TaskWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const discord_client_id = "1429915624653459657";