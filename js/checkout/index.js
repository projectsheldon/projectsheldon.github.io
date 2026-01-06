const params = new URLSearchParams(window.location.search);
        const type = params.get('type'); // e.g. "lifetime" or "daily" or "day"

       const products = {
            'daily': { 
                name: 'Day Pass',
                price: '€2.00',
                desc: '2 Days Access'
            },
            'lifetime': {
                name: 'Lifetime Access',
                price: '€14.99',
                desc: 'One-time payment'
            }
        };

        const selected = products[type];
        if (selected == null)
        {
            window.location.href = "/";
        }

        document.getElementById('product-name').textContent = selected.name;
        document.getElementById('product-desc').textContent = selected.desc;
        document.getElementById('total-price').textContent = selected.price;
        document.getElementById('crypto-amount').textContent = selected.price;

        // 2. Tabs Logic
        function switchMethod(method) {
            const paypalTab = document.getElementById('tab-paypal');
            const cryptoTab = document.getElementById('tab-crypto');
            const paypalContent = document.getElementById('content-paypal');
            const cryptoContent = document.getElementById('content-crypto');

            if (method === 'paypal') {
                // Style Tabs
                paypalTab.classList.add('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
                paypalTab.classList.remove('border-gray-700', 'bg-hacker-black', 'text-gray-400');
                
                cryptoTab.classList.add('border-gray-700', 'bg-hacker-black', 'text-gray-400');
                cryptoTab.classList.remove('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');

                // Show Content
                paypalContent.classList.remove('hidden');
                cryptoContent.classList.add('hidden');
            } else {
                // Style Tabs
                cryptoTab.classList.add('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
                cryptoTab.classList.remove('border-gray-700', 'bg-hacker-black', 'text-gray-400');

                paypalTab.classList.add('border-gray-700', 'bg-hacker-black', 'text-gray-400');
                paypalTab.classList.remove('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');

                // Show Content
                cryptoContent.classList.remove('hidden');
                paypalContent.classList.add('hidden');
            }
        }