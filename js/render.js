tailwind.config = {
    theme: {
        extend: {
            colors: {
                'hacker-black': '#050505',
                'hacker-dark': '#0a0a0a',
                'hacker-blue': '#3b82f6',
                'hacker-blue-dim': 'rgba(59, 130, 246, 0.1)',
            },
            fontFamily: {
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            boxShadow: {
                'neon': '0 0 10px #3b82f6, 0 0 20px #3b82f6',
                'neon-sm': '0 0 5px #3b82f6',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        }
    }
}

