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
// The wordmark metrics come from Segoe UI 900 at `word.size`, measured per glyph
// so a perch can be pinned to the S itself rather than to a guess: "SHELDON" is
// 720px wide starting at x 255, and the S is 86px of that. The caps top out at
// CAP_TOP and the baseline is 107px below it.
const MARK_SIZE = 176;
const MARK_INK = 152;                                   // 176 * 221/256
const MARK_INK_TOP = 12;                                // 176 * 17/256
const WORD_CAP = 107;                                   // measured cap height
const WORD_BLOCK = 211;                                 // cap top -> label baseline + descent
const STACK_GAP = 24;                                   // mark ink bottom -> cap top
const STACK_TOP = Math.round((H - (MARK_INK + STACK_GAP + WORD_BLOCK)) / 2);
const CAP_TOP = STACK_TOP + MARK_INK + STACK_GAP;
const S_LEFT = 255;                                       // left edge of the S
const S_WIDTH = 86;                                       // advance width of the S
const EMBLEM_DROP = 20;                                   // shoulder perch: how far below the cap line

// ---------------------------------------------------------------- emblem perches
// The seasonal glyph is pinned to the letter, not to the canvas, so each season
// can hang its own thing off the S in a way that suits the glyph. Anchors are
// fractions of the S box, which is S_LEFT..S_LEFT+S_WIDTH by CAP_TOP..baseline.
//
//   shoulder   above and left of the S, dropping past the cap line
//   topLeft    perched on the top-left corner of the S
//   botLeft    tucked against the bottom-left of the S
//   botRight   tucked against the bottom-right of the S
//
// `lift` pulls the glyph up off the anchor, `over` pushes it into the letter.
// Both are in px, and a negative `over` leaves a deliberate gap.
const PERCH = {
    shoulder: { x: S_LEFT - 59, y: CAP_TOP - 150 + EMBLEM_DROP, size: 150, over: 0 },
    topLeft: { x: S_LEFT - 26, y: CAP_TOP - 104, size: 132, over: 12 },
    // botLeft and botRight straddle the baseline: the glyph's foot lands on it, so
    // it must not reach past the descender line (CAP_TOP + 140) or it collides
    // with the tagline.
    botLeft: { x: S_LEFT - 30, y: CAP_TOP - 26, size: 128 },
    botRight: { x: S_LEFT + 30, y: CAP_TOP - 26, size: 128 }
};

const LAYOUT = {
    mark: { size: MARK_SIZE, cx: 600, y: STACK_TOP - MARK_INK_TOP },
    word: { size: 150, ls: -5, y: CAP_TOP + WORD_CAP, width: 720, left: S_LEFT },
    tag: { size: 26, y: CAP_TOP + 150 },
    rule: { y: CAP_TOP + 172, width: 420 },
    label: { size: 14, y: CAP_TOP + 208, ls: 8 }
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
// slot decides where it sits.
//
// Two rules from the research, both now enforced here:
//
// 1. Safe zone. Platforms crop OG images unpredictably, and the accepted keep-zone
//    is a centred 1080x600 inside the 1200x630 canvas. Every slot is placed so
//    its glyph fits *inside* that box - the artwork can touch the canvas edge,
//    but nothing that carries meaning may. An earlier version ran the corner
//    glyphs to x 40 and x 1156, which is 80px outside the keep-zone on one side.
// 2. Clear space. Brand lockup guidance (Android, JHU) asks for a margin of one
//    lowercase 'o' between the mark and the wordmark. The wordmark spans
//    x 255..945 at y 298..405, so botRight starts at 1024 - 79px of air, wider
//    than an 'o' at this size. The two top slots clear it vertically: the
//    wordmark's cap line is y 298 and they end at 167, so no slot can crowd it.
//
// There is deliberately no fourth slot. An earlier version had an off-canvas
// "bleed" slot, but it carried the same glyph as the emblem and landed on the
// same left-hand diagonal, so the embed showed two of the same picture - one
// solid, one ghosted - and read as a mistake. The lower left is left empty.
const SAFE = { x: 60, y: 15, w: 1080, h: 600 };           // centred 1080x600 keep-zone

const SLOTS = {
    topLeft: { x: SAFE.x, y: SAFE.y + 20, size: 132, opacity: 0.95 },
    topRight: { x: SAFE.x + SAFE.w - 128, y: SAFE.y + 24, size: 128, opacity: 0.95 },
    botRight: { x: SAFE.x + SAFE.w - 116, y: 392, size: 116, opacity: 0.78 }
};

// ---------------------------------------------------------------- season table
// emblem – the big seasonal glyph, pinned to the S via a PERCH anchor
// marks  – supporting glyphs, one per slot in SLOTS
const SEASONS = [
    {
        id: "default", label: "PROJECT SHELDON", accent: "#e8b767", soft: "#f7e3ba",
        emblem: null, marks: []
    },
    {
        id: "newyear", label: "NEW YEAR", accent: "#ffd478", soft: "#d8e8ff",
        // the popper bursts up and out of the top of the S
        emblem: { code: "1f389", perch: "topLeft", at: { size: 128, dx: -6, dy: 6 }, rot: -18 },
        marks: [
            { code: "1f942", slot: "topLeft" },
            { code: "1f38a", slot: "topRight" },
            { code: "2728", slot: "botRight", rot: 12 }
        ]
    },
    {
        id: "valentine", label: "VALENTINE", accent: "#ff5a76", soft: "#ffd2dc",
        // the heart sits on the S's top-left shoulder, tipped toward the letter
        emblem: { code: "1f49d", perch: "topLeft", at: { size: 122, dx: -4 }, rot: 12 },
        marks: [
            { code: "1f339", slot: "topLeft" },
            { code: "1f494", slot: "topRight" },
            { code: "2728", slot: "botRight", rot: 12 }
        ]
    },
    {
        id: "april", label: "APRIL FOOLS", accent: "#9ee84a", soft: "#ff6fd8",
        // the clown peeks out from behind the S's left leg
        emblem: { code: "1f921", perch: "botLeft", at: { size: 118, dx: -16, dy: 8 } },
        marks: [
            { code: "1f3b2", slot: "topLeft" },
            { code: "1f3b2", slot: "topRight", rot: -14 },
            { code: "1f3b2", slot: "botRight", rot: 22 }
        ]
    },
    {
        id: "easter", label: "SPRING BLOOM", accent: "#63e0bd", soft: "#ffb2ce",
        // the egg balances against the S's left leg, tipped over
        emblem: { code: "1f95a", perch: "botLeft", at: { size: 112, dx: -14, dy: 6 }, rot: -14 },
        marks: [
            { code: "1f338", slot: "topLeft" },
            { code: "1f423", slot: "topRight" },
            { code: "1f338", slot: "botRight", rot: 18 }
        ]
    },
    {
        id: "halloween", label: "SPOOKY SEASON", accent: "#ff8a1f", soft: "#b07bff",
        // the pumpkin stands on the baseline, tucked against the S's left leg
        emblem: { code: "1f383", perch: "botLeft", at: { size: 124, dx: -22, dy: 6 } },
        marks: [
            { code: "1f577", slot: "topLeft", size: 120 },
            { code: "1f987", slot: "topRight", rot: -12 },
            { code: "1f987", slot: "botRight", rot: 14 }
        ]
    },
    {
        id: "christmas", label: "HOLIDAYS", accent: "#e63c52", soft: "#3fae77",
        // the tree stands on the S's top-left corner, like it grew there
        emblem: { code: "1f384", perch: "topLeft", at: { size: 138, dx: -14, dy: 4 } },
        marks: [
            { code: "2744", slot: "topLeft" },
            { code: "1f381", slot: "topRight" },
            { code: "2744", slot: "botRight", rot: 16 }
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
        ? (() => {
            const p = { ...PERCH[emblem.perch || "shoulder"], ...(emblem.at || {}) };
            const size = p.size;
            const x = p.x + (p.dx || 0);
            const y = p.y + (p.dy || 0);
            const spin = emblem.rot
                ? `rotate(${emblem.rot} ${n(x + size / 2)} ${n(y + size / 2)})`
                : "";
            return `<g>
      <circle cx="${n(x + size / 2)}" cy="${n(y + size / 2)}" r="${n(size * 0.72)}" fill="url(#markGlow)"/>
      ${emoji(emblem.code, x, y, size, 1, spin)}
    </g>`;
        })()
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