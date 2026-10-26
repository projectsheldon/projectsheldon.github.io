// Logo/icon builder for Project Sheldon.
//
// Everything this writes is the Sheldon mark on transparency. `default` is the
// bare mark; the seasonal ids put one vector accessory on it (Santa hat, bunny
// ears, sunglasses, pumpkin), drawn in the mark's own thick-outline style so it
// still reads at 16px. The Discord embed art is NOT seasonal: one card all year.
//
//   logo-<s>.png           256px mark for in-page use
//   favicon-<s>.ico        multi-size icon (16/32/48), PNG entries
//   apple-touch-<s>.png    180px mark for the iOS home screen
//   icon-<s>-512.png       512px mark, high-dpi and in-page use
//   discord-<s>.png        512px on the gradient tile, fitted inside Discord's circle crop
//
//   node build-logo.mjs [outDir] [--only=halloween]

import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
const OUT = path.resolve(positional[0] || path.join(HERE, "variants"));
const WORK = path.join(HERE, "_icon-work");
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);

const SOURCE = path.resolve(HERE, "logo.png");

// Sizes that ship inside the .ico, and the two standalone renders.
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;
const ICON_SIZE = 512;
const LOGO_SIZE = 256;

// Keep in sync with season.mjs and Sheldon-Api/Api/src/managers/season/season.js.
const SEASONS = ["default", "christmas", "easter", "summer", "halloween"];

// ---------------------------------------------------------------- source bounds
// The shipped mark sits inside a 256px canvas with transparent padding on all
// four sides, so drawing it 1:1 leaves the mark filling only ~77% of the icon and
// it reads as small at 16px. Decoding the alpha channel gives the real bounds, and
// the icon renders exactly that square instead: the mark touches the top and
// bottom edges, and keeps its own left/right margin because the mark is taller
// than it is wide.
//
// Just enough PNG to find the edge of the ink - 8-bit, non-interlaced, with or
// without an alpha channel. Node's zlib does the rest.
function decodeRgba(file) {
    const buf = fs.readFileSync(file);
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + file);

    let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
    const idat = [];
    for (let o = 8; o < buf.length;) {
        const len = buf.readUInt32BE(o);
        const type = buf.toString("ascii", o + 4, o + 8);
        const body = buf.subarray(o + 8, o + 8 + len);
        if (type === "IHDR") {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            depth = body[8];
            colorType = body[9];
            interlace = body[12];
        } else if (type === "IDAT") idat.push(body);
        else if (type === "IEND") break;
        o += 12 + len;
    }

    if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2))
        throw new Error(`unsupported PNG (depth ${depth}, color ${colorType}, interlace ${interlace}): ${file}`);

    const channels = colorType === 6 ? 4 : 3;
    const stride = width * channels;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const px = Buffer.alloc(stride * height);

    // Undo the per-scanline filters. Each row is prefixed with its filter type and
    // refers to the pixel to the left (Sub/Average/Paeth) or the row above.
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
        const out = px.subarray(y * stride, (y + 1) * stride);
        const up = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? out[i - channels] : 0;
            const b = up ? up[i] : 0;
            const c = up && i >= channels ? up[i - channels] : 0;
            let v = line[i];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            }
            out[i] = v & 0xff;
        }
    }

    return { width, height, channels, px };
}

// Tightest box containing every pixel with any ink in it.
function inkBounds(img) {
    const { width, height, channels, px } = img;
    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width * channels + x * channels;
            // Without an alpha channel there is nothing to threshold: any pixel counts.
            if (channels === 4 && px[i + 3] <= 8) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < 0) throw new Error("source has no visible pixels: " + SOURCE);
    return { minX, maxX, minY, maxY };
}

// The ink box widened to a square, so scaling it into a square viewport cannot
// distort the mark. The extra room lands on the left and right, where the mark
// already has the most slack.
function squareCrop(img) {
    const { minX, maxX, minY, maxY } = inkBounds(img);
    const side = Math.max(maxX - minX, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const x = cx - side / 2;
    const y = cy - side / 2;
    return { x, y, size: side, ink: { minX, maxX, minY, maxY } };
}

const SRC = decodeRgba(SOURCE);
const CROP = squareCrop(SRC);

// ---------------------------------------------------------------- svg
// The image is placed at its own pixel size and the viewBox does the cropping, so
// there is no resampling step between the source and the render - only the
// viewport is smaller than the canvas.
function markSvg(size, crop) {
    const mark = fs.readFileSync(SOURCE).toString("base64");
    const c = crop || CROP;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${c.x} ${c.y} ${c.size} ${c.size}">` +
        `<image href="data:image/png;base64,${mark}" x="0" y="0" width="${SRC.width}" height="${SRC.height}"/>` +
        `</svg>`;
}

// ---------------------------------------------------------------- seasonal props
// Drawn on a 512 canvas. `brain` is [ink height, ink top, x shift]: the hats need the
// mark shrunk and pushed down to make room; the sunglasses sit on a full-size mark.
// `back` is painted under the mark (the ears go behind it), `front` over it.
const INK = "#1c1c1c";
const PROPS = {
    default: { brain: [512, 0], back: "", front: "" },
    christmas: {
        brain: [392, 116],
        back: "",
        front: `<g transform="rotate(-7 256 140)">
<path d="M146 138 C150 62 222 14 306 16 C384 18 436 70 448 168 L414 170 C404 118 382 96 356 96 C366 110 374 124 378 138 Z" fill="#d8323a" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
<path d="M200 60 C230 36 270 28 300 30" fill="none" stroke="#ff6f74" stroke-width="12" stroke-linecap="round" opacity=".7"/>
<rect x="120" y="116" width="272" height="52" rx="26" fill="#f6f2ea" stroke="${INK}" stroke-width="12"/>
<circle cx="434" cy="186" r="34" fill="#f6f2ea" stroke="${INK}" stroke-width="12"/></g>`
    },
    easter: {
        brain: [392, 116],
        back: `<g stroke="${INK}" stroke-width="12">
<g transform="rotate(-16 196 190)"><ellipse cx="196" cy="104" rx="44" ry="92" fill="#f3efe8"/><ellipse cx="196" cy="112" rx="20" ry="60" fill="#f2a7b8" stroke="none"/></g>
<g transform="rotate(14 316 190)"><ellipse cx="316" cy="104" rx="44" ry="92" fill="#f3efe8"/><ellipse cx="316" cy="112" rx="20" ry="60" fill="#f2a7b8" stroke="none"/></g></g>`,
        front: ""
    },
    summer: {
        brain: [512, 0],
        back: "",
        front: `<defs><clipPath id="lens"><rect x="96" y="184" width="150" height="104" rx="34"/><rect x="266" y="184" width="150" height="104" rx="34"/></clipPath></defs>
<path d="M96 206 L22 190 M416 206 L490 190" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
<path d="M240 214 Q256 198 272 214" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
<rect x="96" y="184" width="150" height="104" rx="34" fill="#20242c" stroke="${INK}" stroke-width="12"/>
<rect x="266" y="184" width="150" height="104" rx="34" fill="#20242c" stroke="${INK}" stroke-width="12"/>
<g clip-path="url(#lens)" fill="#ffffff" opacity=".35"><path d="M110 270 L170 184 L196 184 L136 270 Z"/><path d="M280 270 L340 184 L366 184 L306 270 Z"/></g>`
    },
    halloween: {
        brain: [452, 0],
        back: "",
        front: `<g transform="translate(-34 -18) translate(380 404) scale(0.8) translate(-380 -404)"><path d="M372 318 C368 292 374 274 394 260 L410 274 C396 286 392 300 394 320 Z" fill="#5d8a2f" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
<ellipse cx="380" cy="404" rx="124" ry="90" fill="#f28c28" stroke="${INK}" stroke-width="12"/>
<ellipse cx="380" cy="404" rx="58" ry="90" fill="none" stroke="#c9661a" stroke-width="9"/>
<path d="M300 340 C282 370 282 440 300 470 M460 340 C478 370 478 440 460 470" fill="none" stroke="#c9661a" stroke-width="9" stroke-linecap="round"/>
<ellipse cx="380" cy="404" rx="124" ry="90" fill="none" stroke="${INK}" stroke-width="12"/>
<g fill="#ffd36b" stroke="${INK}" stroke-width="8" stroke-linejoin="round">
<path d="M318 392 L352 392 L335 360 Z"/><path d="M408 392 L442 392 L425 360 Z"/>
<path d="M310 420 Q380 474 450 420 L432 422 L420 436 L404 424 L390 440 L374 424 L358 438 L344 424 L330 434 Z"/></g></g>`
    }
};

const GLOW = { default: "#e8b767", christmas: "#e63c52", easter: "#63e0bd", summer: "#ffc23d", halloween: "#ff8a1f" };

// The old tile: near-black diagonal gradient with a seasonal glow behind the
// mark. Only the Discord render gets it; the favicon and logos stay transparent.
function background(id, pad) {
    const box = `x="${-pad}" y="${-pad}" width="${512 + 2 * pad}" height="${512 + 2 * pad}"`;
    return `<defs><linearGradient id="tileBg" x1="0%" y1="0%" x2="30%" y2="100%">` +
        `<stop offset="0%" stop-color="#191920"/><stop offset="100%" stop-color="#07070a"/></linearGradient>` +
        `<radialGradient id="tileGlow" cx="50%" cy="42%" r="62%">` +
        `<stop offset="0%" stop-color="${GLOW[id]}" stop-opacity="0.55"/>` +
        `<stop offset="58%" stop-color="${GLOW[id]}" stop-opacity="0.12"/>` +
        `<stop offset="100%" stop-color="${GLOW[id]}" stop-opacity="0"/></radialGradient></defs>` +
        `<rect ${box} fill="url(#tileBg)"/><rect ${box} fill="url(#tileGlow)"/>`;
}

// The mark plus its prop, laid out on the 512 canvas exactly as PROPS describes,
// optionally wrapped in a transform.
function composeSvg(id, size, transform = "", discord = false) {
    const mark = fs.readFileSync(SOURCE).toString("base64");
    const p = PROPS[id];
    const { minX, maxX, minY, maxY } = CROP.ink;
    const [h, top, dx = 0] = p.brain;
    const s = h / (maxY - minY);
    const x = (512 - (maxX - minX) * s) / 2 - minX * s + dx;
    const y = top - minY * s;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">` +
        (discord ? background(id, 0) : "") +
        `<g transform="${transform}">` + p.back +
        `<image href="data:image/png;base64,${mark}" x="${x}" y="${y}" width="${SRC.width * s}" height="${SRC.height * s}"/>` +
        p.front + `</g></svg>`;
}

// Props make every composition a different shape (a hat adds height, the pumpkin
// sits off to one side), so placing them by hand left some icons high or off to the
// left. Each one is rendered once and its real ink is measured. The final render
// puts the brain on the vertical centre line (a prop hanging off one side must not
// drag the brain sideways) and centres the ink vertically; icons fill the canvas
// like the bare mark, Discord renders fit the ink inside the circle crop.
const MEASURED = new Map();
function measure(id) {
    if (MEASURED.has(id)) return MEASURED.get(id);
    const svgPath = path.join(WORK, `measure-${id}.svg`);
    const pngPath = path.join(WORK, `measure-${id}.png`);
    fs.writeFileSync(svgPath, composeSvg(id, 512));
    shot(svgPath, pngPath, 512);
    const img = decodeRgba(pngPath);
    const b = inkBounds(img);
    const cx = 256 + (PROPS[id].brain[2] || 0);
    const cy = (b.minY + b.maxY + 1) / 2;
    let r = 0;
    for (let py = b.minY; py <= b.maxY; py++) {
        for (let px = b.minX; px <= b.maxX; px++) {
            if (img.px[(py * img.width + px) * img.channels + 3] <= 8) continue;
            r = Math.max(r, Math.hypot(px + 0.5 - cx, py + 0.5 - cy));
        }
    }
    const m = { cx, cy, w: 2 * Math.max(cx - b.minX, b.maxX + 1 - cx), h: b.maxY - b.minY + 1, r };
    MEASURED.set(id, m);
    return m;
}

const DISCORD_FILL = 0.86;

function seasonSvg(id, size, discord = false) {
    const m = measure(id);
    const k = discord ? (256 * DISCORD_FILL) / m.r : 512 / Math.max(m.w, m.h);
    const t = `translate(${256 - m.cx * k} ${256 - m.cy * k}) scale(${k})`;
    return composeSvg(id, size, t, discord);
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

function shot(svgPath, pngPath, size) {
    const shell = findShell();
    if (!shell) throw new Error("chrome-headless-shell not found in the Playwright cache");
    if (fs.existsSync(pngPath)) fs.rmSync(pngPath);
    const res = spawnSync(shell, [
        "--headless", "--disable-gpu", "--hide-scrollbars", "--no-sandbox", "--force-device-scale-factor=1",
        // without this the page under a transparent SVG is white, and the
        // transparent logo comes out with an opaque white square behind it
        "--default-background-color=00000000",
        `--user-data-dir=${path.join(os.tmpdir(), "og-logo-profile")}`,
        `--screenshot=${pngPath}`, `--window-size=${size},${size}`,
        "file:///" + svgPath.replace(/\\/g, "/")
    ], { encoding: "utf8", timeout: 90000 });
    if (res.error) throw res.error;
    if (!fs.existsSync(pngPath)) throw new Error(`screenshot failed: ${svgPath}`);
    return fs.readFileSync(pngPath);
}

// Renders one size and returns the PNG bytes.
function render(name, size, id, discord = false) {
    const svgPath = path.join(WORK, `${name}.svg`);
    fs.writeFileSync(svgPath, seasonSvg(id, size, discord));
    return shot(svgPath, path.join(WORK, `${name}.png`), size);
}

// ---------------------------------------------------------------- ico writer
// ICONDIR + one 16-byte directory entry per size, then the PNG payloads. Every
// browser that can run this site reads PNG-compressed ICO entries.
function buildIco(entries) {
    const dir = Buffer.alloc(6);
    dir.writeUInt16LE(0, 0);
    dir.writeUInt16LE(1, 2);
    dir.writeUInt16LE(entries.length, 4);

    let offset = 6 + 16 * entries.length;
    const table = Buffer.alloc(16 * entries.length);
    entries.forEach((e, i) => {
        const o = i * 16;
        table.writeUInt8(e.size >= 256 ? 0 : e.size, o);
        table.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1);
        table.writeUInt8(0, o + 2);
        table.writeUInt8(0, o + 3);
        table.writeUInt16LE(1, o + 4);
        table.writeUInt16LE(32, o + 6);
        table.writeUInt32LE(e.data.length, o + 8);
        table.writeUInt32LE(offset, o + 12);
        offset += e.data.length;
    });

    return Buffer.concat([dir, table, ...entries.map(e => e.data)]);
}

// ---------------------------------------------------------------- run
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const { minX, maxX, minY, maxY } = CROP.ink;
console.log(
    `source ${SRC.width}x${SRC.height}, ink x[${minX}..${maxX}] y[${minY}..${maxY}] ` +
    `-> crop ${CROP.size}px square at ${CROP.x.toFixed(1)},${CROP.y.toFixed(1)} ` +
    `(mark was ${Math.round(100 * (maxY - minY) / SRC.height)}% of the canvas tall)\n`
);

const picked = SEASONS.filter(id => !ONLY.length || ONLY.includes(id));
const written = [];

for (const id of picked) {
    const logoSvgPath = path.join(WORK, `logo-${id}.svg`);
    fs.writeFileSync(logoSvgPath, seasonSvg(id, LOGO_SIZE));
    shot(logoSvgPath, path.join(OUT, `logo-${id}.png`), LOGO_SIZE);
    fs.writeFileSync(path.join(OUT, `discord-${id}.png`), render(`discord-${id}`, ICON_SIZE, id, true));

    // Big to small, so the ico can be assembled from real renders.
    const sizes = [...new Set([ICON_SIZE, APPLE_SIZE, ...ICO_SIZES])].sort((a, b) => b - a);
    const renders = new Map();
    for (const size of sizes) renders.set(size, render(`icon-${id}-${size}`, size, id));

    fs.writeFileSync(path.join(OUT, `favicon-${id}.ico`), buildIco(ICO_SIZES.map(size => ({ size, data: renders.get(size) }))));
    fs.writeFileSync(path.join(OUT, `apple-touch-${id}.png`), renders.get(APPLE_SIZE));
    fs.writeFileSync(path.join(OUT, `icon-${id}-${ICON_SIZE}.png`), renders.get(ICON_SIZE));

    written.push(`logo-${id}.png`, `favicon-${id}.ico`, `apple-touch-${id}.png`, `icon-${id}-${ICON_SIZE}.png`, `discord-${id}.png`);
    console.log(`${id.padEnd(10)} logo ${LOGO_SIZE} + favicon.ico [${ICO_SIZES.join("/")}] + apple-touch ${APPLE_SIZE} + icon ${ICON_SIZE}`);
}

console.log(`\n${written.length} files in ${path.relative(process.cwd(), OUT) || OUT}`);
