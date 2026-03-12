const Api = {
    GetApiUrl()
    {
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if(isLocalHost)
        {
            return 'http://localhost:3350';
        }
        return 'http://localhost:3350';
    }
};
export default Api;