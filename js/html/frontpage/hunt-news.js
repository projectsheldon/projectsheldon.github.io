import Api from "../../util/backend.js";

// Front-page news pill for the seasonal hunt. Asks the backend's public
// /hunt/info (only real hunts, never test mode) and stays invisible otherwise.

const HUNT_LOOK = {
    halloween: { emoji: "🎃", title: "Halloween", color: "#ff8a2a" },
    christmas: { emoji: "🎁", title: "Christmas", color: "#e5484d" },
    easter:    { emoji: "🥚", title: "Easter",    color: "#b48ce8" },
    summer:    { emoji: "🐚", title: "Summer",    color: "#f5b942" }
};

const HUNT_CSS = `
.hunt-pill{display:inline-flex;align-items:center;gap:.55rem;margin-bottom:1.4rem;padding:.4rem .45rem .4rem .8rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--hc) 40%,transparent);background:color-mix(in srgb,var(--hc) 9%,rgba(10,10,12,.6));color:#f3efe6;font-size:.78rem;font-weight:600;cursor:pointer;backdrop-filter:blur(8px);transition:transform .2s,background .2s,border-color .2s;animation:huntPillIn .7s cubic-bezier(.22,1,.36,1) both}
.hunt-pill:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--hc) 15%,rgba(10,10,12,.6));border-color:color-mix(in srgb,var(--hc) 65%,transparent)}
.hunt-pill .hp-dot{width:7px;height:7px;border-radius:50%;background:var(--hc);box-shadow:0 0 0 0 var(--hc);animation:huntPulse 1.8s infinite}
.hunt-pill .hp-go{display:inline-flex;align-items:center;gap:.25rem;padding:.25rem .6rem;border-radius:999px;background:var(--hc);color:#140c05;font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
@keyframes huntPillIn{from{opacity:0;transform:translateY(-8px)}}
@keyframes huntPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--hc) 60%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.hunt-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.2rem;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:huntFade .25s ease}
.hunt-modal.out{animation:huntFadeOut .2s ease forwards}
@keyframes huntFade{from{opacity:0}}
@keyframes huntFadeOut{to{opacity:0}}
.hunt-card{position:relative;width:min(460px,100%);max-height:100%;overflow-y:auto;padding:2rem 1.6rem 1.4rem;border-radius:1.4rem;background:#111114;border:1px solid rgba(255,255,255,.08);box-shadow:0 30px 80px rgba(0,0,0,.6);text-align:center;color:#ececec;animation:huntCardIn .35s cubic-bezier(.22,1,.36,1)}
@keyframes huntCardIn{from{opacity:0;transform:translateY(12px) scale(.97)}}
.hunt-card .hc-x{position:absolute;top:.8rem;right:.8rem;width:2rem;height:2rem;border:0;border-radius:.6rem;background:transparent;color:#888;font-size:1.2rem;cursor:pointer}
.hunt-card .hc-x:hover{background:rgba(255,255,255,.08);color:#fff}
.hunt-card .hc-emoji{font-size:3.4rem;line-height:1;margin-bottom:.6rem;animation:huntBob 1.6s ease-in-out infinite;filter:drop-shadow(0 8px 24px color-mix(in srgb,var(--hc) 45%,transparent))}
@keyframes huntBob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-6px) rotate(4deg)}}
.hunt-card h3{font-size:1.4rem;font-weight:900;color:#fff;margin-bottom:.35rem}
.hunt-card .hc-lead{font-size:.9rem;color:#a3a3a3;margin-bottom:1.1rem}
.hunt-card .hc-lead b{color:var(--hc)}
.hunt-card ul{list-style:none;padding:0;margin:0 0 1.1rem;display:flex;flex-direction:column;gap:.5rem;text-align:left}
.hunt-card li{display:flex;gap:.75rem;padding:.7rem .8rem;border-radius:.85rem;background:rgba(255,255,255,.035);font-size:.82rem;color:#a3a3a3;line-height:1.45}
.hunt-card li b{display:block;color:#fff;font-size:.86rem;margin-bottom:.1rem}
.hunt-card li .n{flex:none;width:1.45rem;height:1.45rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:var(--hc);background:color-mix(in srgb,var(--hc) 16%,transparent)}
.hunt-card .hc-btns{display:flex;gap:.6rem}
.hunt-card .hc-btns button{flex:1;padding:.85rem 1rem;border-radius:1rem;font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:background .2s,transform .2s}
.hunt-card .hc-dl{background:#fff;color:#000;border:0}
.hunt-card .hc-dl:hover{background:var(--hc);transform:scale(1.02)}
.hunt-card .hc-dc{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.12)}
.hunt-card .hc-dc:hover{background:rgba(255,255,255,.06)}
.hunt-card .hc-foot{margin-top:.9rem;font-size:.72rem;color:#6b6b6b}
@media (prefers-reduced-motion:reduce){.hunt-pill,.hunt-pill .hp-dot,.hunt-card,.hunt-card .hc-emoji,.hunt-modal{animation:none}}
`;

function huntDuration(h)
{
    return h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`;
}

function huntAdj(h)
{
    return h % 24 === 0 ? `${h / 24}-day` : `${h}-hour`;
}

function huntLeft(ts)
{
    const ms = Math.max(0, ts - Date.now());
    const d = Math.floor(ms / 86400000);
    const h = Math.floor(ms % 86400000 / 3600000);
    return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function openHuntModal(info, look)
{
    if(document.querySelector(".hunt-modal")) return;
    const ends = new Date(info.endsAt - 1).toLocaleDateString(undefined, { month: "long", day: "numeric" });
    const wrap = document.createElement("div");
    wrap.className = "hunt-modal";
    wrap.style.setProperty("--hc", look.color);
    wrap.innerHTML = `
        <div class="hunt-card" role="dialog" aria-modal="true" aria-labelledby="hunt-card-title">
            <button class="hc-x" type="button" aria-label="Close">×</button>
            <div class="hc-emoji">${look.emoji}</div>
            <h3 id="hunt-card-title">The ${look.title} hunt is live</h3>
            <p class="hc-lead">${info.total} ${info.item}s are hidden inside the Sheldon Loader. Find them all before <b>${ends}</b>.</p>
            <ul>
                <li><span class="n">1</span><div><b>They hide under buttons</b>Hover over buttons, tabs and menu items in the Loader. The ${info.item}s only peek out while your mouse is on them.</div></li>
                <li><span class="n">2</span><div><b>A few are in plain sight</b>Small and faint somewhere on a page, and some are fakes. Spots change every time you open the Loader.</div></li>
                <li><span class="n">3</span><div><b>Free time on your key</b>+${huntDuration(info.rewardHours)} on your key, or a ${huntAdj(info.giftHours)} key for a friend if yours is lifetime, plus the ${info.role} role on Discord.</div></li>
            </ul>
            <div class="hc-btns">
                <button class="hc-dl" type="button">Download Loader</button>
                <button class="hc-dc" type="button">Join Discord</button>
            </div>
            <p class="hc-foot">One reward per Discord account · ${huntLeft(info.endsAt)}</p>
        </div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = "hidden";

    const close = () =>
    {
        if(wrap.classList.contains("out")) return;
        wrap.classList.add("out");
        document.body.style.overflow = "";
        document.removeEventListener("keydown", onKey);
        setTimeout(() => wrap.remove(), 220);
    };
    const onKey = e => { if(e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", e => { if(e.target === wrap) close(); });
    wrap.querySelector(".hc-x").addEventListener("click", close);
    wrap.querySelector(".hc-dl").addEventListener("click", () =>
    {
        close();
        document.getElementById("hero-cta")?.click();
    });
    wrap.querySelector(".hc-dc").addEventListener("click", () =>
    {
        if(typeof window.RedirectToPlatform === "function") window.RedirectToPlatform("discord_invite");
    });
}

async function LoadHuntNews()
{
    const title = document.querySelector("section .hacker-text");
    if(!title) return;

    let info;
    try
    {
        const apiUrl = await Api.GetApiUrl();
        const res = await fetch(`${apiUrl}/hunt/info`);
        info = await res.json();
    }
    catch(e)
    {
        return;
    }
    if(!info || !info.active) return;
    const look = HUNT_LOOK[info.season];
    if(!look) return;

    if(!document.getElementById("hunt-news-css"))
    {
        const style = document.createElement("style");
        style.id = "hunt-news-css";
        style.textContent = HUNT_CSS;
        document.head.appendChild(style);
    }

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "hunt-pill";
    pill.style.setProperty("--hc", look.color);
    pill.innerHTML = `<span class="hp-dot"></span><span>${look.emoji} ${look.title} hunt is live · win ${huntDuration(info.rewardHours)} free</span><span class="hp-go">How it works →</span>`;
    pill.addEventListener("click", () => openHuntModal(info, look));
    title.parentElement.insertBefore(pill, title);
}

LoadHuntNews();
