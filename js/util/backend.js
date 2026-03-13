const Api = {
    _backendUrl: null,
    
    async _fetchBackendUrl() {
        if (this._backendUrl) return this._backendUrl;
        
        try {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const fallbackUrl = isLocalhost ? 'http://localhost:3350' : 'https://projectsheldon.xyz';
            
            const response = await fetch(`${fallbackUrl}/config/backend`);
            if (response.ok) {
                const data = await response.json();
                this._backendUrl = isLocalhost ? data.localhost : data.server;
            } else {
                this._backendUrl = fallbackUrl;
            }
        } catch (e) {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            this._backendUrl = isLocalhost ? 'http://localhost:3350' : 'https://projectsheldon.xyz';
        }
        
        return this._backendUrl;
    },
    
    async GetApiUrl()
    {
        if (!this._backendUrl) {
            await this._fetchBackendUrl();
        }
        return this._backendUrl;
    }
};
export default Api;
