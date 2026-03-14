import Api from "../../util/backend.js";

class Product
{
    constructor (data)
    {
        this.name = data.name || 'Unknown';
        this.price = data.price;
        this.duration = data.duration;
        this.duration_text = data["duration_text"];
        this.key = data.key || '';
    }

    get IsFree()
    {
        return typeof this.price !== 'number';
    }

    get IsLifetime()
    {
        return this.duration === -1;
    }

    FormatPrice()
    {
        if(typeof this.price !== 'number') return this.price;
        return `€${this.price.toFixed(2)}`;
    }
    FormatDuration()
    {
        if(this.IsLifetime) return 'LIFETIME';
        if(this.IsFree) return 'FREE';
        return String(this.duration_text).toUpperCase();
    }
}

const ProductsManager =
{
    async FetchProducts() 
    {
        const response = await fetch(`${await Api.GetApiUrl()}/products/getall`);
        const rawProducts = await response.json();

        let products = rawProducts.map(p => new Product(p));
        console.log(products);

        return products;
    }
};

export { Product, ProductsManager };