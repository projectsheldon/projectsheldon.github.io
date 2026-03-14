import Api from "../util/backend.js";

class Product
{
    constructor (data)
    {
        this.name = data.name || 'Unknown';
        this.price = data.price;
        this.duration = data.duration || 0;
    }

    get IsFree()
    {
        return typeof this.price !== 'number';
    }

    get IsLifetime()
    {
        return this.duration === 'Forever';
    }

    FormatPrice()
    {
        if(typeof this.price !== 'number') return this.price;
        return `€${this.price.toFixed(2)}`;
    }
    FormatDuration()
    {
        if(this.IsLifetime) return 'LIFETIME';
        if(this.duration === '3 hours') return 'FREE';
        return this.duration.toUpperCase();
    }
}

const ProductsManager =
{
    async FetchProducts() 
    {
        const response = await fetch(`${await Api.GetApiUrl()}/products/getall`);
        const rawProducts = await response.json();

        const products = rawProducts.map(p => new Product(p));
        return products;
    }
};

export { Product, ProductsManager };