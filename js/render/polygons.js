const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
const heroSection = document.getElementById('hero');

let width, height;
let particles = [];
const particleCount = 180; // Number of particles
const connectionDistance = 150; // Distance to connect particles
const mouseDistance = 200; // Distance to connect mouse

const mouse = { x: null, y: null };

// Track mouse relative to the canvas
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

// Reset mouse when leaving window to stop lines sticking to edge
window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

window.addEventListener('resize', resize);

function resize() {
    width = canvas.width = heroSection.offsetWidth;
    height = canvas.height = heroSection.offsetHeight;
    initParticles();
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 1, // Velocity X
            vy: (Math.random() - 0.5) * 1, // Velocity Y
            size: Math.random() * 2 + 1
        });
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p, index) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw particle (dot)
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // Hacker blue
        ctx.fill();

        // Connect to mouse
        if (mouse.x != null && mouse.y != null) {
            let dx = mouse.x - p.x;
            let dy = mouse.y - p.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouseDistance) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(59, 130, 246, ${1 - distance / mouseDistance})`;
                ctx.lineWidth = 1;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }
        }

        // Connect to other particles
        for (let j = index + 1; j < particles.length; j++) {
            let p2 = particles[j];
            let dx = p.x - p2.x;
            let dy = p.y - p2.y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - distance / connectionDistance)})`; // Fainter
                ctx.lineWidth = 0.5;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    });

    requestAnimationFrame(animate);
}

// Initialize
resize();
animate();