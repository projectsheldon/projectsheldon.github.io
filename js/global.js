// export const API_URL = "http://localhost:64/";
export const API_URL = "https://5.249.161.40:3350/";

export async function GetProducts() {
    try {
        const response = await fetch(`${API_URL}sheldon/products`); 
        const data = await response.json(); 
        return data;
    } catch (err) {
        alert("Please head to https://5.249.161.40:3350/ and allow the certificate.");
        return null;
    }
}