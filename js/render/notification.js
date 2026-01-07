// notifications.js
(function() {
    // Create container
    let container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'fixed top-5 right-5 flex flex-col gap-3 z-[9999]';
    document.body.appendChild(container);

    // AddNotification function
    window.AddNotification = function(message, options = {}) {
        const {
            type = 'info',      // info, success, error, warning
            duration = 3000     // how long the notification stays
        } = options;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `
            px-5 py-3 rounded-md text-black font-bold transition-all duration-500 transform
            translate-x-full opacity-0
        `;

        // Set background and shadow based on type
        switch(type) {
            case 'success':
                notification.classList.add('bg-green-500', 'shadow-[0_0_10px_#10b981,0_0_20px_#10b981]');
                break;
            case 'error':
                notification.classList.add('bg-red-500', 'shadow-[0_0_10px_#ef4444,0_0_20px_#ef4444]');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-500', 'shadow-[0_0_10px_#facc15,0_0_20px_#facc15]');
                break;
            default:
                notification.classList.add('bg-hacker-blue', 'shadow-[0_0_10px_#3b82f6,0_0_20px_#3b82f6]');
        }

        notification.textContent = message;
        container.appendChild(notification);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        });

        // Remove after duration
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
            notification.addEventListener('transitionend', () => notification.remove(), { once: true });
        }, duration);
    };
})();
