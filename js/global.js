export async function GetProducts() {
    try {
        const response = await fetch('http://localhost:80/sheldon/products'); // replace with your API URL
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json(); // parse JSON
        return data;
    } catch (err) {
        console.error('Error fetching products:', err);
        return null;
    }
}