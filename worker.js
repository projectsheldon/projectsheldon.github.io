const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-inline' https://www.paypal.com https://www.paypalobjects.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: https://cdn.discordapp.com https://www.paypalobjects.com https://*.paypal.com",
    "connect-src 'self' https://projectsheldon.xyz https://raw.githubusercontent.com https://www.paypal.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
    "frame-src https://www.paypal.com https://*.paypal.com",
    "form-action 'self' https://www.paypal.com"
].join("; ");

const SECURITY_HEADERS = {
    "Content-Security-Policy": CSP,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};

export default {
    async fetch(request, env) {
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);

        for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
            headers.set(name, value);
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    }
};
