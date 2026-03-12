const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
const particleCount = 150;

function resize()
{
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle
{
    constructor() {this.init();}
    init()
    {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = (Math.random() - 0.5) * 0.25;
        this.size = Math.random() * 2;
        this.opacity = Math.random() * 0.4;
    }
    update()
    {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.init();
    }
    draw()
    {
        ctx.fillStyle = `rgba(199, 177, 143, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles()
{
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    animate();
}

function animate()
{
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {p.update(); p.draw();});
    requestAnimationFrame(animate);
}
window.onload = initParticles;