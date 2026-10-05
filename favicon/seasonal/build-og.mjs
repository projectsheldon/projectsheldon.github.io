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

// One vertical stack, measured in one place. Every number here is derived, not
// eyeballed, so the lockup stays centred when a value changes.
//
// The mark is drawn at its own pixel size with no resampling, and the source
// `logo.png` has transparent padding: the ink occupies y 17..238 of its 256px
// canvas (86% of the height, measured by the same alpha scan build-logo.mjs
// does), so a `mark.size` box shows MARK_INK tall of actual artwork, inset
// MARK_INK_TOP from the top of the box.
//
// The wordmark metrics come from Segoe UI 900 at `word.size`: 150px gives a
// 685px advance and a 107px cap height, so the S starts at x 257.
const MARK_SIZE = 176;
const MARK_INK = 152;                                   // 176 * 221/256
const MARK_INK_TOP = 12;                                // 176 * 17/256
const WORD_CAP = 107;                                   // measured cap height
const WORD_BLOCK = 211;                                 // cap top -> label baseline + descent
const STACK_GAP = 72;                                   // mark ink bottom -> cap top
const STACK_TOP = Math.round((H - (MARK_INK + STACK_GAP + WORD_BLOCK)) / 2);
const CAP_TOP = STACK_TOP + MARK_INK + STACK_GAP;
const EMBLEM_DROP = 20;                                   // how far the glyph sits below the cap line

const LAYOUT = {
    mark: { size: MARK_SIZE, cx: 600, y: STACK_TOP - MARK_INK_TOP },
    word: { size: 150, ls: -5, y: CAP_TOP + WORD_CAP, width: 685 },
    tag: { size: 26, y: CAP_TOP + 150 },
    rule: { y: CAP_TOP + 172, width: 420 },
    label: { size: 14, y: CAP_TOP + 208, ls: 8 },
    // The seasonal glyph perches on the left shoulder of the wordmark: it hangs
    // over the empty space to the left of the S and drops EMBLEM_DROP past the
    // cap line, so it reads as tucked into the corner of the wordmark rather
    // than floating beside it. Painted before the wordmark, so where the two do
    // touch it is the glyph that gets covered, never the letter.
    emblem: { size: 150, x: 196, y: CAP_TOP - 150 + EMBLEM_DROP }
};

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
// The viewBox is read out of the file rather than assumed, so an emoji from
// another set (OpenMoji, Noto, Fluent) drops in beside the Twemoji ones.
const emojiCache = new Map();
function emoji(code, x, y, size, opacity = 1, transform = "") {
    if (!emojiCache.has(code)) {
        const raw = fs.readFileSync(path.join(EMOJI_DIR, `${code}.svg`), "utf-8");
        const open = raw.match(/<svg[^>]*>/);
        const view = open && open[0].match(/viewBox="([^"]+)"/);
        emojiCache.set(code, {
            inner: raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""),
            viewBox: view ? view[1] : "0 0 36 36"
        });
    }
    const { inner, viewBox } = emojiCache.get(code);
    return `<svg x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" viewBox="${viewBox}"` +
        ` opacity="${opacity}"${transform ? ` transform="${transform}"` : ""}>${inner}</svg>`;
}

// ---------------------------------------------------------------- mark slots
// The supporting glyphs never get hand-placed: each one names a slot and the
// slot decides where it sits. Every slot is chosen to reach an edge of the
// canvas, so the seasonal art fills the frame instead of huddling in the middle.
const SLOTS = {
    topLeft: { x: 40, y: 36, size: 136, opacity: 0.95 },
    topRight: { x: 1022, y: 40, size: 128, opacity: 0.95 },
    botRight: { x: 1040, y: 392, size: 116, opacity: 0.78 },
    // Deliberately off-canvas: the canvas crops it, which is what makes the
    // artwork read as a window onto something bigger rather than a framed card.
    bleed: { x: -128, y: 396, size: 300, opacity: 0.14 }
};

// ---------------------------------------------------------------- season table
// emblem – the big seasonal glyph, tucked on the left shoulder of the wordmark
// marks  – supporting glyphs, one per slot in SLOTS
const SEASONS = [
    {
        id: "default", label: "PROJECT SHELDON", accent: "#e8b767", soft: "#f7e3ba",
        emblem: null, marks: []
    },
    {
        id: "newyear", label: "NEW YEAR", accent: "#ffd478", soft: "#d8e8ff",
        emblem: { code: "1f389" },
        marks: [
            { code: "1f942", slot: "topLeft" },
            { code: "1f38a", slot: "topRight" },
            { code: "2728", slot: "botRight", rot: 12 },
            { code: "1f389", slot: "bleed" }
        ]
    },
    {
        id: "valentine", label: "VALENTINE", accent: "#ff5a76", soft: "#ffd2dc",
        emblem: { code: "1f49d" },
        marks: [
            { code: "1f339", slot: "topLeft" },
            { code: "1f494", slot: "topRight" },
            { code: "2728", slot: "botRight", rot: 12 },
            { code: "1f49d", slot: "bleed" }
        ]
    },
    {
        id: "april", label: "APRIL FOOLS", accent: "#9ee84a", soft: "#ff6fd8",
        emblem: { code: "1f921" },
        marks: [
            { code: "1f3b2", slot: "topLeft" },
            { code: "1f3b2", slot: "topRight", rot: -14 },
            { code: "1f3b2", slot: "botRight", rot: 22 },
            { code: "1f921", slot: "bleed" }
        ]
    },
    {
        id: "easter", label: "SPRING BLOOM", accent: "#63e0bd", soft: "#ffb2ce",
        emblem: { code: "1f95a" },
        marks: [
            { code: "1f338", slot: "topLeft" },
            { code: "1f423", slot: "topRight" },
            { code: "1f338", slot: "botRight", rot: 18 },
            { code: "1f95a", slot: "bleed" }
        ]
    },
    {
        id: "halloween", label: "SPOOKY SEASON", accent: "#ff8a1f", soft: "#b07bff",
        emblem: { code: "1f383" },
        marks: [
            { code: "1f577", slot: "topLeft", size: 120 },
            { code: "1f987", slot: "topRight", rot: -12 },
            { code: "1f987", slot: "botRight", rot: 14 },
            { code: "1f383", slot: "bleed" }
        ]
    },
    {
        id: "christmas", label: "HOLIDAYS", accent: "#e63c52", soft: "#3fae77",
        emblem: { code: "1f384" },
        marks: [
            { code: "2744", slot: "topLeft" },
            { code: "1f381", slot: "topRight" },
            { code: "2744", slot: "botRight", rot: 16 },
            { code: "1f384", slot: "bleed" }
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
      <path d="M100 0v46" opacity="0.55"/>
      ${spiderWeb(6, 6, 300, 11, [48, 88, 132, 178, 226, 276, 322], false, 0.42)}
      ${spiderWeb(1194, 6, 240, 9, [46, 84, 126, 170, 216], true, 0.32)}
    </g>`;
    } else {
        art = `<g stroke="none">${sparkField(id.length * 17, 34, 40, 60, 1120, 500)}</g>`;
    }

    // Painted before the wordmark on purpose: the emblem may disappear behind the
    // S, the S never disappears behind the emblem.
    const emblemMarkup = emblem
        ? `<g>
      <circle cx="${n(LAYOUT.emblem.x + LAYOUT.emblem.size / 2)}" cy="${n(LAYOUT.emblem.y + LAYOUT.emblem.size / 2)}" r="${n(LAYOUT.emblem.size * 0.72)}" fill="url(#markGlow)"/>
      ${emoji(emblem.code, LAYOUT.emblem.x, LAYOUT.emblem.y, LAYOUT.emblem.size, 1)}
    </g>`
        : "";

    const marksMarkup = marks.map(m => {
        const s = SLOTS[m.slot];
        const size = m.size || s.size;
        return emoji(m.code, s.x, s.y, size, m.opacity ?? s.opacity,
            m.rot ? `rotate(${m.rot} ${n(s.x + size / 2)} ${n(s.y + size / 2)})` : "");
    }).join("\n    ");

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
  <circle cx="600" cy="230" r="300" fill="url(#halo)"/>

  <g>
    ${watermark(accent)}
  </g>

  ${art}

  ${emblemMarkup}
  <g>
    ${marksMarkup}
  </g>

  <image href="data:image/png;base64,${logo}" x="${n(LAYOUT.mark.cx - LAYOUT.mark.size / 2)}" y="${LAYOUT.mark.y}" width="${LAYOUT.mark.size}" height="${LAYOUT.mark.size}"/>

  <rect x="${n(600 - LAYOUT.rule.width / 2)}" y="${LAYOUT.rule.y}" width="${LAYOUT.rule.width}" height="2" rx="1" fill="url(#rule)"/>

  <text x="600" y="${LAYOUT.word.y}" font-family='${FONT}' font-size="${LAYOUT.word.size}" font-weight="900" fill="url(#word)" text-anchor="middle" letter-spacing="${LAYOUT.word.ls}">SHELDON</text>
  <text x="600" y="${LAYOUT.tag.y}" font-family='${FONT}' font-size="${LAYOUT.tag.size}" font-weight="500" fill="#b6b6bb" text-anchor="middle" letter-spacing="0.4">${BASE_TAGLINE}</text>
  <text x="600" y="${LAYOUT.label.y}" font-family='${FONT}' font-size="${LAYOUT.label.size}" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="${LAYOUT.label.ls}" opacity="0.6">${label}</text>
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