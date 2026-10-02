// Seasonal Open Graph image generator for Project Sheldon (prototype).
//
// Real emoji artwork (Twemoji vectors) does the seasonal work, one shared layout
// does the branding, and only geometry that cannot be faked (the Halloween web,
// the sparkle field) is drawn by hand.
//
//   node build-og.mjs [outDir] [--only=halloween,christmas]
//
// Emoji artwork: Twemoji, CC-BY 4.0, github.com/jdecked/twemoji
//
// Nothing outside the chosen outDir is written.

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
const OUT = path.resolve(positional[0] || path.join(HERE, "variants"));
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);

const W = 1200;
const H = 630;
const LOGO = path.resolve(HERE, "logo.png");
const EMOJI_DIR = path.resolve(HERE, "emoji");

const FONT = '"Segoe UI","Inter","Poppins","Helvetica Neue",Arial,sans-serif';
const MONO = '"Cascadia Mono","Consolas","SF Mono",monospace';
const BASE_TAGLINE = "Undetected · Feature-rich · Actively maintained";

const n = v => Number(v).toFixed(1);

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------- emoji vectors
const emojiCache = new Map();
function emoji(code, x, y, size, opacity = 1, transform = "") {
    if (!emojiCache.has(code)) {
        const raw = fs.readFileSync(path.join(EMOJI_DIR, `${code}.svg`), "utf-8");
        const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
        emojiCache.set(code, inner);
    }
    return `<svg x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" viewBox="0 0 36 36"` +
        ` opacity="${opacity}"${transform ? ` transform="${transform}"` : ""}>${emojiCache.get(code)}</svg>`;
}

// ---------------------------------------------------------------- season table
// emblem  – the big seasonal glyph, hung on the left edge of the wordmark
// marks   – supporting glyphs placed in the quiet corners
const SEASONS = [
    {
        id: "default", label: "PROJECT SHELDON", accent: "#e8b767", soft: "#f7e3ba",
        emblem: null, marks: []
    },
    {
        id: "newyear", label: "NEW YEAR", accent: "#ffd478", soft: "#d8e8ff",
        emblem: { code: "1f389", size: 132, x: 222, y: 330 },
        marks: [
            { code: "1f942", x: 236, y: 112, size: 82, opacity: 0.95 },
            { code: "1f38a", x: 1012, y: 168, size: 88, opacity: 0.95 },
            { code: "2728", x: 1082, y: 424, size: 62, opacity: 0.8 }
        ]
    },
    {
        id: "valentine", label: "VALENTINE", accent: "#ff5a76", soft: "#ffd2dc",
        emblem: { code: "1f49d", size: 126, x: 226, y: 332 },
        marks: [
            { code: "1f339", x: 236, y: 118, size: 88, opacity: 0.95 },
            { code: "1f494", x: 1024, y: 186, size: 66, opacity: 0.85 },
            { code: "2728", x: 1074, y: 430, size: 58, opacity: 0.75 }
        ]
    },
    {
        id: "april", label: "APRIL FOOLS", accent: "#9ee84a", soft: "#ff6fd8",
        emblem: { code: "1f921", size: 126, x: 226, y: 332 },
        marks: [
            { code: "1f3b2", x: 234, y: 116, size: 84, opacity: 0.95 },
            { code: "1f3b2", x: 1022, y: 184, size: 72, opacity: 0.85, rot: -14 },
            { code: "1f3b2", x: 1086, y: 424, size: 56, opacity: 0.7, rot: 22 }
        ]
    },
    {
        id: "easter", label: "SPRING BLOOM", accent: "#63e0bd", soft: "#ffb2ce",
        emblem: { code: "1f95a", size: 128, x: 224, y: 330 },
        marks: [
            { code: "1f338", x: 232, y: 110, size: 84, opacity: 0.95 },
            { code: "1f423", x: 1006, y: 166, size: 92, opacity: 0.95 },
            { code: "1f338", x: 1080, y: 424, size: 64, opacity: 0.8, rot: 18 }
        ]
    },
    {
        id: "halloween", label: "SPOOKY SEASON", accent: "#ff8a1f", soft: "#b07bff",
        emblem: { code: "1f383", size: 134, x: 220, y: 330 },
        marks: [
            { code: "1f577", x: 122, y: 118, size: 58, opacity: 0.9 },
            { code: "1f987", x: 1006, y: 168, size: 86, opacity: 0.95, rot: -12 },
            { code: "1f987", x: 1084, y: 428, size: 58, opacity: 0.75, rot: 14 }
        ]
    },
    {
        id: "christmas", label: "HOLIDAYS", accent: "#e63c52", soft: "#3fae77",
        emblem: { code: "1f384", size: 134, x: 220, y: 330 },
        marks: [
            { code: "2744", x: 236, y: 112, size: 74, opacity: 0.95 },
            { code: "1f381", x: 1004, y: 174, size: 86, opacity: 0.95 },
            { code: "2744", x: 1082, y: 430, size: 60, opacity: 0.8, rot: 16 }
        ]
    }
];

// ---------------------------------------------------------------- drawn geometry
// A spider web is the one seasonal shape worth drawing: it is pure geometry, and
// Twemoji has no spiderweb to offer.
function spiderWeb(ox, oy, maxR, spokes, radii, mirror, opacity) {
    let out = "";
    for (let i = 0; i <= spokes; i++) {
        const a = (Math.PI / 2) * (i / spokes);
        out += `<path d="M${n(ox)} ${n(oy)}L${n(ox + Math.cos(a) * maxR)} ${n(oy + Math.sin(a) * maxR)}"/>`;
    }
    radii.forEach(r => {
        for (let i = 0; i < spokes; i++) {
            const a1 = (Math.PI / 2) * (i / spokes);
            const a2 = (Math.PI / 2) * ((i + 1) / spokes);
            const x1 = ox + Math.cos(a1) * r, y1 = oy + Math.sin(a1) * r;
            const x2 = ox + Math.cos(a2) * r, y2 = oy + Math.sin(a2) * r;
            const bulge = 0.05;
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            out += `<path d="M${n(x1)} ${n(y1)}Q${n(mx + (mx - ox) * bulge)} ${n(my + (my - oy) * bulge)} ${n(x2)} ${n(y2)}"/>`;
        }
    });
    const drops = radii.filter((_, i) => i % 2 === 1).map((r, k) => {
        const a = (Math.PI / 2) * (0.3 + k * 0.2);
        return `<circle cx="${n(ox + Math.cos(a) * r)}" cy="${n(oy + Math.sin(a) * r)}" r="${3 + (k % 2) * 1.6}" stroke="none"/>`;
    }).join("");
    return `<g opacity="${opacity}"${mirror ? ` transform="translate(${n(ox * 2)},0) scale(-1,1)"` : ""}>${out}${drops}</g>`;
}

const GLYPHS = ["{ }", "()", "#", "@", "::", "end", "local", "~=", "=>", "print", "[ ]", "*", "+", ";", "%", "do", "if", "#!"];

function watermark(accent) {
    const rand = rng(0x5eed);
    const out = [];
    for (let i = 0; i < 86; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const size = 12 + rand() * 17;
        const rot = Math.round((rand() - 0.5) * 60);
        const op = (0.026 + rand() * 0.042).toFixed(3);
        const txt = GLYPHS[Math.floor(rand() * GLYPHS.length)];
        const fill = rand() < 0.55 ? accent : "#ffffff";
        out.push(
            `<text x="${n(x)}" y="${n(y)}" font-family='${MONO}' font-size="${n(size)}" font-weight="600"` +
            ` fill="${fill}" opacity="${op}" text-anchor="middle" transform="rotate(${rot} ${n(x)} ${n(y)})">${txt}</text>`
        );
    }
    return out.join("\n    ");
}

function sparkField(seed, count, x0, y0, spreadX, spreadY) {
    const rand = rng(seed);
    let s = "";
    for (let i = 0; i < count; i++) {
        s += `<circle cx="${n(x0 + rand() * spreadX)}" cy="${n(y0 + rand() * spreadY)}" r="${n(0.7 + rand() * 1.9)}" opacity="${n(0.12 + rand() * 0.34)}"/>`;
    }
    return s;
}

// ---------------------------------------------------------------- template
function buildSvg(season) {
    const { id, accent, soft, label, emblem, marks } = season;
    const logo = fs.readFileSync(LOGO).toString("base64");

    let art = "";
    if (id === "halloween") {
        // the spider dangles from the top edge on a thread; the webs stay in the
        // corners so they read as wallpaper, not as something in the wordmark
        art = `
    <g stroke="${accent}" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M151 0v122" opacity="0.55"/>
      ${spiderWeb(6, 6, 246, 11, [40, 74, 110, 148, 188, 228, 264], false, 0.42)}
      ${spiderWeb(1178, 6, 184, 9, [36, 66, 98, 132, 168], true, 0.32)}
    </g>`;
    } else {
        art = `<g stroke="none" transform="translate(0 0)">${sparkField(id.length * 17, 24, 720, 70, 440, 470)}</g>`;
    }

    const emblemMarkup = emblem
        ? `<g>
      <circle cx="${n(emblem.x + emblem.size / 2)}" cy="${n(emblem.y + emblem.size / 2)}" r="${n(emblem.size * 0.72)}" fill="url(#markGlow)"/>
      ${emoji(emblem.code, emblem.x, emblem.y, emblem.size, 1, emblem.rot ? `rotate(${emblem.rot} ${n(emblem.x + emblem.size / 2)} ${n(emblem.y + emblem.size / 2)})` : "")}
    </g>`
        : "";

    const marksMarkup = marks.map(m =>
        emoji(m.code, m.x, m.y, m.size, m.opacity,
            m.rot ? `rotate(${m.rot} ${n(m.x + m.size / 2)} ${n(m.y + m.size / 2)})` : "")
    ).join("\n    ");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="46%" r="72%">
      <stop offset="0%" stop-color="#141317"/>
      <stop offset="55%" stop-color="#0a0a0c"/>
      <stop offset="100%" stop-color="#040405"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.26"/>
      <stop offset="52%" stop-color="${accent}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="markGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.2"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="word" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="58%" stop-color="#fdf7ec"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <linearGradient id="rule" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0"/>
      <stop offset="24%" stop-color="${accent}" stop-opacity="0.8"/>
      <stop offset="76%" stop-color="${soft}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${soft}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="600" cy="222" r="230" fill="url(#halo)"/>
  <circle cx="110" cy="546" r="220" fill="url(#halo)" opacity="0.18"/>
  <circle cx="1100" cy="72" r="200" fill="url(#halo)" opacity="0.14"/>

  <g>
    ${watermark(accent)}
  </g>

  ${art}

  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="20" fill="none" stroke="#ffffff" stroke-opacity="0.07"/>

  ${emblemMarkup}
  <g>
    ${marksMarkup}
  </g>

  <image href="data:image/png;base64,${logo}" x="528" y="146" width="144" height="144"/>

  <rect x="410" y="504" width="380" height="2" rx="1" fill="url(#rule)"/>

  <text x="600" y="452" font-family='${FONT}' font-size="120" font-weight="900" fill="url(#word)" text-anchor="middle" letter-spacing="-4">SHELDON</text>
  <text x="600" y="492" font-family='${FONT}' font-size="23" font-weight="500" fill="#b6b6bb" text-anchor="middle" letter-spacing="0.4">${BASE_TAGLINE}</text>
  <text x="600" y="538" font-family='${FONT}' font-size="13" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="7" opacity="0.6">${label}</text>
</svg>`;
}

// ---------------------------------------------------------------- rasterise
function findShell() {
    const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright");
    if (!fs.existsSync(root)) return null;
    const dirs = fs.readdirSync(root).filter(d => d.startsWith("chromium_headless_shell")).sort();
    for (const d of dirs.reverse()) {
        const exe = path.join(root, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
        if (fs.existsSync(exe)) return exe;
    }
    return null;
}

function shot(args) {
    const shell = findShell();
    if (!shell) throw new Error("chrome-headless-shell not found in the Playwright cache");
    const res = spawnSync(shell, [
        "--headless", "--disable-gpu", "--hide-scrollbars", "--no-sandbox", "--force-device-scale-factor=1",
        `--user-data-dir=${path.join(os.tmpdir(), "og-shot-profile")}`, ...args
    ], { encoding: "utf8", timeout: 90000 });
    if (res.error) throw res.error;
    return res;
}

function rasterise(svgPath, pngPath) {
    if (fs.existsSync(pngPath)) fs.rmSync(pngPath);
    shot([`--screenshot=${pngPath}`, `--window-size=${W},${H}`, "file:///" + svgPath.replace(/\\/g, "/")]);
    if (!fs.existsSync(pngPath)) throw new Error(`screenshot failed for ${svgPath}`);
    return fs.statSync(pngPath).size;
}

function contactSheet(pngs, outPath) {
    const cols = 2, cell = 560, pad = 26;
    const rows = Math.ceil(pngs.length / cols);
    const cw = cols * cell + (cols + 1) * pad;
    const ch = rows * (cell * H / W + 44) + (rows + 1) * pad;
    const imgs = pngs.map(p =>
        `<div class="c"><img src="data:image/png;base64,${fs.readFileSync(p.file).toString("base64")}"/><span>${p.id}</span></div>`
    ).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#111114;font-family:'Segoe UI',Arial;color:#ddd}
      #w{width:${cw}px;padding:${pad}px;display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:${pad + 22}px}
      .c img{width:100%;display:block;border-radius:10px;border:1px solid #2c2c33}
      .c span{display:block;margin-top:9px;font-size:15px;letter-spacing:2px;color:#9a9aa4;text-transform:uppercase}
    </style></head><body><div id="w">${imgs}</div></body></html>`;
    const htmlPath = path.join(HERE, "_sheet.html");
    fs.writeFileSync(htmlPath, html);
    shot([`--screenshot=${outPath}`, `--window-size=${cw},${ch}`, "file:///" + htmlPath.replace(/\\/g, "/")]);
    if (!fs.existsSync(outPath)) throw new Error("contact sheet failed");
    return outPath;
}

// ---------------------------------------------------------------- run
fs.mkdirSync(OUT, { recursive: true });
const picked = SEASONS.filter(s => !ONLY.length || ONLY.includes(s.id));
for (const season of picked) {
    const svgPath = path.join(OUT, `og-${season.id}.svg`);
    fs.writeFileSync(svgPath, buildSvg(season));
    const pngPath = path.join(OUT, `og-${season.id}.png`);
    console.log(`${season.id.padEnd(10)} ${(rasterise(svgPath, pngPath) / 1024).toFixed(0)} KB  ${pngPath}`);
}
contactSheet(picked.map(s => ({ id: s.id, file: path.join(OUT, `og-${s.id}.png`) })), path.join(HERE, "_contact-sheet.png"));
console.log("sheet      " + path.join(HERE, "_contact-sheet.png"));