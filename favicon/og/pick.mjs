// Points the published og:image at the right seasonal art, and gives the URL a new
// value whenever it changes.
//
// Discord caches an embed image by URL. Same URL means the same bitmap no matter
// what the file now contains, so a season flip alone would never reach an embed
// that already exists. Rewriting the query string to <season>-<iso week> means
// every flip (plus a weekly safety bump) hands Discord a URL it has never fetched.
//
//   node favicon/og/pick.mjs [--date=YYYY-MM-DD] [--dry]
//
// Intended to run from the repo root, daily, from .github/workflows/og-image.yml.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveSeason } from "./season.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const forced = (args.find(a => a.startsWith("--date=")) || "").slice(7);

const date = forced ? new Date(`${forced}T12:00:00`) : new Date();
const season = resolveSeason(date);

// ISO week, so the cache-buster also moves for seasons we did not anticipate.
function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

const stamp = `${season}-${date.getFullYear()}w${String(isoWeek(date)).padStart(2, "0")}`;

// 1. the image itself
const variant = path.join(HERE, "variants", `og-${season}.png`);
const live = path.join(HERE, "..", "og-image.png");
if (!fs.existsSync(variant)) {
    console.error(`missing variant: ${variant}`);
    process.exit(1);
}
let changed = false;
if (!fs.existsSync(live) || !fs.readFileSync(variant).equals(fs.readFileSync(live))) {
    changed = true;
    if (!DRY) fs.copyFileSync(variant, live);
    console.log(`og-image.png <- og-${season}.png`);
}

// 2. the cache-buster in every page that advertises the image
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

const TAG = /((?:property|name)="(?:og:image|twitter:image)"\s+content="[^"]*og-image\.png)(\?v=[^"]*)?"/g;
for (const file of htmlFiles(ROOT)) {
    const before = fs.readFileSync(file, "utf-8");
    const after = before.replace(TAG, (m, head, old) => `${head}?v=${stamp}"`);
    if (after !== before) {
        changed = true;
        if (!DRY) fs.writeFileSync(file, after);
        console.log(`stamp ${path.relative(ROOT, file)} -> ?v=${stamp}`);
    }
}

console.log(`season=${season} stamp=${stamp} changed=${changed}${DRY ? " (dry run)" : ""}`);