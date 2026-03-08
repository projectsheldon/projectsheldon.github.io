import { GetApiUrl } from "../../global.js";
import DiscordApi from "../discord/api.js";

function BuildAuthHeaders(options = {}) {
    const token = DiscordApi.GetSessionToken({ allowCookie: options?.allowCookie !== false });
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

const AuthApi = {
    async GetStatus(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/status`, {
            method: "GET",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        if (!res.ok) return { loggedIn: false };
        return await res.json();
    },

    async SetPassword(password, currentPassword = null, options = {}) {
        const payload = { password };
        if (typeof currentPassword === "string" && currentPassword.trim().length > 0) {
            payload.current_password = currentPassword;
        }

        const res = await fetch(`${await GetApiUrl()}sheldon/auth/set-password`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options),
            body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async VerifyPassword(password, options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/verify-password`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options),
            body: JSON.stringify({ password })
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async GetResellerStatus(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/reseller-status`, {
            method: "GET",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async GetResellLicenses(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/resell-licenses`, {
            method: "GET",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async GetResellerApiToken(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/reseller-api-token`, {
            method: "GET",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async ResetResellerApiToken(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/reset-reseller-api-token`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async GetDeletionStatus(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/deletion-status`, {
            method: "GET",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async RequestDeletion(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/request-deletion`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async CancelDeletion(options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/cancel-deletion`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    async AssignResellLicense(discordId, options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/assign-license`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options),
            body: JSON.stringify({ discordId })
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    // Create license - returns plain JSON without encryption
    async CreateLicense(duration = null, options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/create-license`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options),
            body: JSON.stringify({ duration })
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    // Get license - returns plain JSON without encryption
    // Pass discordId and token for server-side validation to prevent unauthorized access
    async GetLicense(key, options = {}) {
        const discordId = options?.discordId;
        const explicitToken = options?.token;
        
        let url = `${await GetApiUrl()}sheldon/auth/get-license?key=${encodeURIComponent(key)}`;
        
        // Add discordId to query string for server-side validation
        if (discordId) {
            url += `&discordId=${encodeURIComponent(discordId)}`;
        }
        
        // Build headers - use explicit token if provided, otherwise let BuildAuthHeaders handle it
        const headers = { "Content-Type": "application/json" };
        if (explicitToken) {
            headers["Authorization"] = `Bearer ${explicitToken}`;
        } else {
            // Fallback to BuildAuthHeaders which gets token from sessionStorage/cookies
            const authHeaders = BuildAuthHeaders(options);
            Object.assign(headers, authHeaders);
        }
        
        const res = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

    // Assign license by key - returns plain JSON without encryption
    async AssignLicenseByKey(licenseKey, discordId, options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/assign-license-by-key`, {
            method: "POST",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options),
            body: JSON.stringify({ key: licenseKey, discordId })
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    },

// Get all licenses for the logged-in user (requires discordId for server-side validation)
    async GetMyLicenses(discordId, options = {}) {
        const res = await fetch(`${await GetApiUrl()}sheldon/auth/my-licenses?discordId=${discordId}`, {
            method: "GET",
            credentials: options?.allowCookie !== false ? "include" : "omit",
            headers: BuildAuthHeaders(options)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw json || { error: "request_failed" };
        return json;
    }
};

export default AuthApi;

