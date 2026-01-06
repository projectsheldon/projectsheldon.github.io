const params = new URLSearchParams(window.location.search);
        const key = params.get("key");
        const keyElement = document.getElementById("key-text");
        const keyContainer = document.getElementById("key-container");

        if (key) {
            keyElement.textContent = key;
            keyElement.classList.remove("opacity-50");
        } else {
            keyElement.textContent = "ERROR: NO KEY FOUND";
            keyElement.classList.add("text-red-500");
            keyContainer.classList.replace("border-hacker-blue/50", "border-red-500/50");
        }

        function copyToClipboard() {
            if (!key) return;

            navigator.clipboard.writeText(key).then(() => {
                const btn = document.getElementById("copy-btn");
                const originalText = btn.innerHTML;

                btn.style.backgroundColor = "#fff";
                btn.innerHTML = `<span class="text-black">COPIED!</span>`;

                setTimeout(() => {
                    btn.style.backgroundColor = "";
                    btn.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        }