// Points the Discord embed art at the current season, and gives it a new value
// whenever it changes.
//
// Discord caches an embed image by URL. Serve the right bytes at the same URL and
// an embed that already exists still shows the old picture, so the query string is
// stamped with <season>-<iso week>r<rev>: each flip hands every cache a URL it has
// never fetched, the weekly component is a safety net for windows retuned later,
// and the revision busts the cache when the art is redrawn inside one season.
//
// The icon and the in-page logo are not in this table. They are the bare mark in
// every season, so they are committed once and never swapped.
//
//   node favicon/seasonal/pick.mjs [--date=YYYY-MM-DD] [--dry]
//
// Intended to run from the repo root, daily, from
// .github/workflows/seasonal-brand.yml.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveSeason } from "./season.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAVICON = path.resolve(HERE, "..");
const ROOT = path.resolve(HERE, "..", "..");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const forced = (args.find(a => a.startsWith("--date=")) || "").slice(7);

const date = forced ? new Date(`${forced}T12:00:00`) : new Date();
const season = resolveSeason(date);

// ISO week, so the stamp also moves for seasons we did not anticipate.
function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

// Art revision. The season and the week only change when the calendar moves, so
// redrawing the OG art inside the same season would keep serving the URL every
// cache already has, and Discord would go on showing the old picture. Bump this
// whenever build-og.mjs output changes and the stamps follow.
const ART_REV = 3;

const stamp = `${season}-${date.getFullYear()}w${String(isoWeek(date)).padStart(2, "0")}r${ART_REV}`;
const variants = path.join(HERE, "variants");

// ---------------------------------------------------------------- assets
// The swap table. `out` is relative to favicon/, `src` to the variants dir.
// The embed art is the only seasonal file left.
const ASSETS = [
    { out: "og-image.png", src: `og-${season}.png` }
];

let changed = false;
for (const asset of ASSETS) {
    const src = path.join(variants, asset.src);
    const dst = path.join(FAVICON, asset.out);
    if (!fs.existsSync(src)) {
        if (asset.optional) {
            console.warn(`skip ${asset.out}: ${asset.src} not built`);
            continue;
        }
        console.error(`missing variant: ${src}`);
        process.exit(1);
    }
    const same = fs.existsSync(dst) && fs.readFileSync(src).equals(fs.readFileSync(dst));
    if (same) continue;
    changed = true;
    if (!DRY) fs.copyFileSync(src, dst);
    console.log(`${asset.out} <- ${asset.src}`);
}

// ---------------------------------------------------------------- html
function htmlFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".opencode")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...htmlFiles(full));
        else if (entry.name.endsWith(".html")) out.push(full);
    }
    return out;
}

// Only the Discord embed art is stamped. The icon files hold the same bytes in
// every season, so a stamp on them would hand every cache a new URL for an image
// it already has - and would keep the site logo pinned to whatever mark shipped
// the day the query string was last added.
const ASSET_REF = /((?:property|name)="(?:og:image|twitter:image)")(\s+[^>]*?content)="([^"]*?og-image\.png)(\?v=[^"]*)?"/g;

for (const file of htmlFiles(ROOT)) {
    const before = fs.readFileSync(file, "utf-8");
    let after = before.replace(ASSET_REF, (m, tag, attr, url) => `${tag}${attr}="${url}?v=${stamp}"`);

    // iOS takes its home screen icon from apple-touch-icon only. Derive the href
    // from the page's own favicon link so the relative path is always right.
    if (!/rel="apple-touch-icon"/.test(after)) {
        const icon = after.match(/<link rel="icon"[^>]*href="([^"]*favicon\.ico)(?:\?v=[^"]*)?"/);
        if (icon) {
            const href = icon[1].replace(/favicon\.ico$/, "apple-touch-icon.png");
            const link = `<link rel="apple-touch-icon" href="${href}">`;
            const at = after.match(/<link rel="icon"[^>]*>\r?\n/);
            after = at ? after.replace(at[0], at[0] + "    " + link + "\n") : after;
        }
    }

    // Older pages still carry a stamp left over from when the icon was seasonal.
    after = after.replace(/((?:rel="(?:icon|apple-touch-icon)")[^>]*?href="[^"]*?)(\?v=[^"]*)?"/g, "$1\"");

    if (after !== before) {
        changed = true;
        if (!DRY) fs.writeFileSync(file, after);
        console.log(`stamp ${path.relative(ROOT, file)} -> ?v=${stamp}`);
    }
}

console.log(`season=${season} stamp=${stamp} changed=${changed}${DRY ? " (dry run)" : ""}`);