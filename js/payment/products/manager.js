import Api from "../../util/backend.js";

class Product
{
    constructor (data)
    {
        this.name = data.name || 'Unknown';
        this.price = data.price;
        this.duration = data.duration || 0;
        this.key = data.key || '';
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
        return String(this.duration).toUpperCase();
    }
}

const ProductsManager =
{
    async FetchProducts() 
    {
        const response = await fetch(`${await Api.GetApiUrl()}/products/getall`);
        const rawProducts = await response.json();

        let products = [];
        if(Array.isArray(rawProducts))
        {
            products = rawProducts.map(p => new Product(p));
        } 
        else
        {
            products = Object.entries(rawProducts).map(([ key, value ]) =>
            {
                const product = new Product(value);
                product.key = key;
                return product;
            });
        }
        return products;
    }
};

export { Product, ProductsManager };