const Api = {
    GetApiUrl()
    {
        const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const hostname = window.location.hostname;
        
        // If same origin, use current origin
        // Otherwise use the API server
        return `http://localhost:3350`;
    }
};
export default Api;
