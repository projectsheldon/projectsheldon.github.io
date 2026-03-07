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
    }
};

export default AuthApi;

