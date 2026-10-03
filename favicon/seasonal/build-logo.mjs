// Logo/icon builder for Project Sheldon.
//
// Everything this writes is the bare Sheldon mark on transparency: no tile, no
// glow, no border, no seasonal badge, no seasonal tint. The mark is the brand
// and it is the same in December as it is in October.
//
// The Discord embed art is the one seasonal thing left, and it lives in
// build-og.mjs. This builder has no opinion about the calendar, so it writes the
// same bytes whatever `--only` says.
//
//   logo-<s>.png           256px mark for in-page use
//   favicon-<s>.ico        multi-size icon (16/32/48), PNG entries
//   apple-touch-<s>.png    180px mark for the iOS home screen
//   icon-<s>-512.png       512px mark, high-dpi and in-page use
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

// The variant ids, kept so `--only=halloween` still resolves. Nothing seasonal
// happens per id any more; the table is just the list of files to write.
const SEASONS = ["default", "newyear", "valentine", "april", "easter", "halloween", "christmas"];

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
function render(name, size) {
    const svgPath = path.join(WORK, `${name}.svg`);
    fs.writeFileSync(svgPath, markSvg(size));
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
    fs.writeFileSync(logoSvgPath, markSvg(LOGO_SIZE));
    shot(logoSvgPath, path.join(OUT, `logo-${id}.png`), LOGO_SIZE);

    // Big to small, so the ico can be assembled from real renders.
    const sizes = [...new Set([ICON_SIZE, APPLE_SIZE, ...ICO_SIZES])].sort((a, b) => b - a);
    const renders = new Map();
    for (const size of sizes) renders.set(size, render(`icon-${id}-${size}`, size));

    fs.writeFileSync(path.join(OUT, `favicon-${id}.ico`), buildIco(ICO_SIZES.map(size => ({ size, data: renders.get(size) }))));
    fs.writeFileSync(path.join(OUT, `apple-touch-${id}.png`), renders.get(APPLE_SIZE));
    fs.writeFileSync(path.join(OUT, `icon-${id}-${ICON_SIZE}.png`), renders.get(ICON_SIZE));

    written.push(`logo-${id}.png`, `favicon-${id}.ico`, `apple-touch-${id}.png`, `icon-${id}-${ICON_SIZE}.png`);
    console.log(`${id.padEnd(10)} logo ${LOGO_SIZE} + favicon.ico [${ICO_SIZES.join("/")}] + apple-touch ${APPLE_SIZE} + icon ${ICON_SIZE}`);
}

console.log(`\n${written.length} files in ${path.relative(process.cwd(), OUT) || OUT}`);
