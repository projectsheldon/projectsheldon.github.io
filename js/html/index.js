import { GetProducts } from '../global.js';

async function RenderProducts() {
    const container = document.getElementById('pricing-grid');
    if (!container) return;

    const products = await GetProducts();
    
    if (!products) {
        container.innerHTML = `<p class="text-gray-500 col-span-3 text-center">Failed to load products.</p>`;
        return;
    }

    container.innerHTML = '';

    Object.values(products).forEach(product => {
        let priceDisplay;

        if (typeof product.price === 'string') {
            priceDisplay = product.price;
        } else if (typeof product.price === 'number') {
            priceDisplay = `€${product.price.toFixed(2)}`;
        } else {
            priceDisplay = '-';
        }

        const productCard = document.createElement('div');
        productCard.className = 'bg-hacker-black border border-gray-800 p-6 hover:border-hacker-blue transition-colors duration-300 group flex flex-col';
        
        productCard.innerHTML = `
            <h3 class="text-xl font-bold mb-2 group-hover:text-hacker-blue transition-colors">${product.name}</h3>
            <p class="text-gray-400 text-sm mb-2">Duration: ${product.duration}</p>
            <p class="text-hacker-blue font-bold text-lg mb-4">${priceDisplay}</p>
            
            <!-- FIXED: Removed sm:w-[340px]. Used w-full to fill the card container. -->
            <!-- Added mt-auto to push button to bottom if descriptions vary in length -->
            <button class="mt-auto w-full px-6 py-2 border border-hacker-blue text-hacker-blue font-bold bg-transparent transition-all duration-300 hover:bg-hacker-blue hover:text-black hover:shadow-[0_0_15px_rgba(59,130,246,0.8)]">
                GET
            </button>
        `;

        const button = productCard.querySelector('button');
        button.addEventListener('click', () => {
            window.location.href = `/checkout?type=${encodeURIComponent(product.name)}`;
        });

        container.appendChild(productCard);
    });
}

document.addEventListener('DOMContentLoaded', RenderProducts);