// Notification system
// Usage: window.Notify(message, type, duration)
// Types: 'success', 'error', 'info', 'warning'
// Default duration: 4000ms

(function() {
    const containerId = 'notify-container';
    let container = null;

    function getContainer() {
        if (!container) {
            container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 350px;
                `;
                document.body.appendChild(container);
            }
        }
        return container;
    }

    function createNotification(message, type = 'info', duration = 4000) {
        const colors = {
            success: { bg: 'rgba(34, 197, 94, 0.9)', border: '#22c55e' },
            error: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444' },
            warning: { bg: 'rgba(234, 179, 8, 0.9)', border: '#eab308' },
            info: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' }
        };

        const style = colors[type] || colors.info;

        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${style.bg};
            color: white;
            padding: 14px 18px;
            border-radius: 10px;
            border-left: 4px solid ${style.border};
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: notifySlideIn 0.3s ease;
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
        `;

        // Icon
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
        };

        notification.innerHTML = `
            <span style="flex-shrink: 0;">${icons[type] || icons.info}</span>
            <span style="flex: 1;">${message}</span>
        `;

        // Click to dismiss
        notification.addEventListener('click', () => {
            removeNotification(notification);
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                removeNotification(notification);
            }, duration);
        }

        getContainer().appendChild(notification);
        return notification;
    }

    function removeNotification(notification) {
        if (notification && notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                notification.remove();
            }, 200);
        }
    }

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes notifySlideIn {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Global function
    window.Notify = function(message, type = 'info', duration = 4000) {
        if (typeof message === 'object' && message !== null) {
            // Support { message, type, duration } object
            return createNotification(message.message, message.type, message.duration);
        }
        return createNotification(message, type, duration);
    };

    // Convenience methods
    window.NotifySuccess = (message, duration) => window.Notify(message, 'success', duration);
    window.NotifyError = (message, duration) => window.Notify(message, 'error', duration);
    window.NotifyWarning = (message, duration) => window.Notify(message, 'warning', duration);
    window.NotifyInfo = (message, duration) => window.Notify(message, 'info', duration);
})();
