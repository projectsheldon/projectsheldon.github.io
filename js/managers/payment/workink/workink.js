const WorkInk = {
    async ValidateToken(token) {
        try {
            const response = await fetch(`https://work.ink/_api/v2/token/isValid/${token}?deleteToken=0`, {
                method: "POST"
            });
            
            if (!response.ok) {
                console.error(`[WorkInk] Response status: ${response.status}`);
                return false;
            }
            
            const data = await response.json();
            return data.valid === true;
        } catch (error) {
            console.error(`[WorkInk] Validation error:`, error);
            return false;
        }
    }
};

export default WorkInk;
