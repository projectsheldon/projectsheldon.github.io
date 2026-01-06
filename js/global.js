// export const API_URL = "http://localhost:64/";
export const API_URL = "https://5.249.161.40:3350/";

export async function GetProducts() {
    try {
        const response = await fetch(`${API_URL}sheldon/products`); // replace with your API URL
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json(); // parse JSON
        return data;
    } catch (err) {
        console.error('Error fetching products:', err);
        return null;
    }
}