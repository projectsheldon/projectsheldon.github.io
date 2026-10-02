// Seasonal logo builder for Project Sheldon.
//
// The brain mark stays exactly as it is - it is the brand and it reads at 256px.
// What changes with the calendar is the tile it sits on, plus a hue shift on the
// transparent logo used inside the page.
//
//   favicon.ico            multi-size icon (16/32/48), PNG entries
//   apple-touch-<s>.png    180px tile for the iOS home screen
//   icon-<s>-512.png       512px tile, high-dpi and future og use
//   logo-<s>.png           256px transparent mark, tinted toward the season
//
//   node build-logo.mjs [outDir] [--only=halloween]
//
// The default season copies the shipped assets byte for byte rather than
// re-rendering them, so nothing about the logo changes outside a season.

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAVICON = path.resolve(HERE, "..");
const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
const OUT = path.resolve(positional[0] || path.join(HERE, "variants"));
const WORK = path.join(HERE, "_icon-work");
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);

const SOURCE = path.resolve(HERE, "logo.png");
const EMOJI_DIR = path.resolve(HERE, "emoji");

// Sizes that ship inside the .ico, and the two standalone tiles.
const ICO_SIZES = [16, 32, 48];
const APPLE_SIZE = 180;
const TILE_SIZE = 512;

const SEASONS = [
    { id: "default", accent: "#e8b767", soft: "#f7e3ba", glyph: null },
    { id: "newyear", accent: "#ffd478", soft: "#d8e8ff", glyph: "1f389" },
    { id: "valentine", accent: "#ff5a76", soft: "#ffd2dc", glyph: "1f49d" },
    { id: "april", accent: "#9ee84a", soft: "#ff6fd8", glyph: "1f921" },
    { id: "easter", accent: "#63e0bd", soft: "#ffb2ce", glyph: "1f338" },
    { id: "halloween", accent: "#ff8a1f", soft: "#b07bff", glyph: "1f383" },
    { id: "christmas", accent: "#e63c52", soft: "#3fae77", glyph: "1f384" }
];

const n = v => Number(v).toFixed(1);

function rgb(hex) {
    const h = hex.replace("#", "");
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

// Mixes the mark's greys toward the season hue without flattening the shading:
// every channel keeps its luminance response, the accent channels get a lift and
// a small floor so the darks pick up a tint instead of staying neutral black.
function tintMatrix(accent) {
    const [r, g, b] = rgb(accent);
    const k = 0.42;
    const floor = 0.10;
    return [
        (1 - k) + k * r, (1 - k) * 0.55, (1 - k) * 0.55, 0, r * floor,
        (1 - k) * 0.55, (1 - k) + k * g, (1 - k) * 0.55, 0, g * floor,
        (1 - k) * 0.55, (1 - k) * 0.55, (1 - k) + k * b, 0, b * floor,
        0, 0, 0, 1, 0
    ].map(v => n(v)).join(" ");
}

function emoji(code) {
    const raw = fs.readFileSync(path.join(EMOJI_DIR, `${code}.svg`), "utf-8");
    return raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

function svgWrap(size, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${body}</svg>`;
}

// The tile. `detail` adds the seasonal glyph, which only survives above 180px;
// below that it turns to mush and only makes the icon noisier.
function tileSvg(season, detail) {
    const { accent, glyph } = season;
    const mark = fs.readFileSync(SOURCE).toString("base64");
    const glyphSize = detail ? 168 : 0;

    return svgWrap(TILE_SIZE, `
  <defs>
    <linearGradient id="tileBg" x1="0%" y1="0%" x2="30%" y2="100%">
      <stop offset="0%" stop-color="#191920"/>
      <stop offset="100%" stop-color="#07070a"/>
    </linearGradient>
    <radialGradient id="tileGlow" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="58%" stop-color="${accent}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="squircle"><rect width="512" height="512" rx="118"/></clipPath>
  </defs>
  <g clip-path="url(#squircle)">
    <rect width="512" height="512" fill="url(#tileBg)"/>
    <rect width="512" height="512" fill="url(#tileGlow)"/>
    ${glyphSize ? `<g transform="translate(${n(512 - glyphSize - 34)} ${n(512 - glyphSize - 30)}) rotate(-8 ${n(glyphSize / 2)} ${n(glyphSize / 2)})" opacity="0.92"><svg width="${glyphSize}" height="${glyphSize}" viewBox="0 0 36 36">${emoji(glyph)}</svg></g>` : ""}
  </g>
  <rect x="1" y="1" width="510" height="510" rx="117" fill="none" stroke="#ffffff" stroke-opacity="0.09"/>
  <image href="data:image/png;base64,${mark}" x="122" y="122" width="268" height="268"/>`);
}

function logoSvg(season) {
    const mark = fs.readFileSync(SOURCE).toString("base64");
    return svgWrap(256, `
  <defs>
    <filter id="tint" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="${tintMatrix(season.accent)}"/>
    </filter>
  </defs>
  <image href="data:image/png;base64,${mark}" x="0" y="0" width="256" height="256" filter="url(#tint)"/>`);
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
        `--user-data-dir=${path.join(os.tmpdir(), "og-logo-profile")}`,
        `--screenshot=${pngPath}`, `--window-size=${size},${size}`,
        "file:///" + svgPath.replace(/\\/g, "/")
    ], { encoding: "utf8", timeout: 90000 });
    if (res.error) throw res.error;
    if (!fs.existsSync(pngPath)) throw new Error(`screenshot failed: ${svgPath}`);
    return fs.readFileSync(pngPath);
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

const picked = SEASONS.filter(s => !ONLY.length || ONLY.includes(s.id));
const written = [];

for (const season of picked) {
    const { id } = season;

    if (id === "default") {
        // out of season the site keeps the exact bytes it shipped before this
        const logo = path.join(FAVICON, "logo.png");
        const ico = path.join(FAVICON, "favicon.ico");
        if (!fs.existsSync(logo) || !fs.existsSync(ico)) throw new Error("shipped logo.png / favicon.ico missing");
        fs.copyFileSync(logo, path.join(OUT, `logo-${id}.png`));
        fs.copyFileSync(ico, path.join(OUT, `favicon-${id}.ico`));
        written.push(`logo-${id}.png`, `favicon-${id}.ico`);
        console.log(`${id.padEnd(10)} copied shipped assets unchanged`);
        continue;
    }

    // transparent, tinted mark for in-page use
    const logoSvgPath = path.join(WORK, `logo-${id}.svg`);
    fs.writeFileSync(logoSvgPath, logoSvg(season));
    shot(logoSvgPath, path.join(OUT, `logo-${id}.png`), 256);

    // tiles, big to small, so the ico can be assembled from real renders
    const sizes = [...new Set([TILE_SIZE, APPLE_SIZE, ...ICO_SIZES])].sort((a, b) => b - a);
    const renders = new Map();
    for (const size of sizes) {
        const svgPath = path.join(WORK, `tile-${id}-${size}.svg`);
        fs.writeFileSync(svgPath, tileSvg(season, size >= APPLE_SIZE));
        const data = shot(svgPath, path.join(WORK, `tile-${id}-${size}.png`), size);
        renders.set(size, data);
    }

    fs.writeFileSync(path.join(OUT, `favicon-${id}.ico`), buildIco(ICO_SIZES.map(size => ({ size, data: renders.get(size) }))));
    fs.writeFileSync(path.join(OUT, `apple-touch-${id}.png`), renders.get(APPLE_SIZE));
    fs.writeFileSync(path.join(OUT, `icon-${id}-${TILE_SIZE}.png`), renders.get(TILE_SIZE));

    written.push(`logo-${id}.png`, `favicon-${id}.ico`, `apple-touch-${id}.png`, `icon-${id}-${TILE_SIZE}.png`);
    console.log(`${id.padEnd(10)} logo.png + favicon.ico [${ICO_SIZES.join("/")}] + apple-touch ${APPLE_SIZE} + tile ${TILE_SIZE}`);
}

console.log(`\n${written.length} files in ${path.relative(process.cwd(), OUT) || OUT}`);