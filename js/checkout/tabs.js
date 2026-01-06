function switchMethod(method) {
    const paypalTab = document.getElementById('tab-paypal');
    const cryptoTab = document.getElementById('tab-crypto');
    const paypalContent = document.getElementById('content-paypal');
    const cryptoContent = document.getElementById('content-crypto');
    const emailSection = document.getElementById('email-section');

    if (method === 'paypal') {
        // Style Tabs
        paypalTab.classList.add('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
        paypalTab.classList.remove('border-gray-700', 'bg-hacker-black', 'text-gray-400');

        cryptoTab.classList.add('border-gray-700', 'bg-hacker-black', 'text-gray-400');
        cryptoTab.classList.remove('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');

        // Content
        paypalContent.classList.remove('hidden');
        cryptoContent.classList.add('hidden');
    } else {
        // Style Tabs
        cryptoTab.classList.add('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');
        cryptoTab.classList.remove('border-gray-700', 'bg-hacker-black', 'text-gray-400');

        paypalTab.classList.add('border-gray-700', 'bg-hacker-black', 'text-gray-400');
        paypalTab.classList.remove('border-hacker-blue', 'bg-hacker-blue/10', 'text-hacker-blue');

        // Content
        cryptoContent.classList.remove('hidden');
        paypalContent.classList.add('hidden');
    }
}