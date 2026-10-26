// Points the site icon at the current season.
//
// The favicon, the iOS touch icon and the in-page logo are swapped for the
// seasonal render (Santa hat, bunny ears, sunglasses, pumpkin, or the bare mark).
// The Discord embed art (og-image.png) is NOT touched: one card all year.
//
// Browsers cache a favicon by URL far past any HTTP max-age, so every
// rel="icon" / rel="apple-touch-icon" link is stamped with ?v=<season>-<year>r<rev>.
// Each flip hands every cache a URL it has never fetched.
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

const date = forced ? new Date(`${forced}T12:00:00Z`) : new Date();
const season = resolveSeason(date);

// Bump when build-logo.mjs output changes inside one season, so the stamps move.
const ART_REV = 3;

const stamp = `${season}-${date.getUTCFullYear()}r${ART_REV}`;
const variants = path.join(HERE, "variants");

// `out` is relative to favicon/, `src` to variants/.
const ASSETS = [
    { out: "favicon.ico",          src: `favicon-${season}.ico` },
    { out: "apple-touch-icon.png", src: `apple-touch-${season}.png` },
    { out: "icon.png",             src: `icon-${season}-512.png` },
    { out: "logo.png",             src: `logo-${season}.png` }
];

let changed = false;
for (const asset of ASSETS) {
    const src = path.join(variants, asset.src);
    const dst = path.join(FAVICON, asset.out);
    if (!fs.existsSync(src)) {
        console.error(`missing variant: ${src}`);
        process.exit(1);
    }
    const same = fs.existsSync(dst) && fs.readFileSync(src).equals(fs.readFileSync(dst));
    if (same) continue;
    changed = true;
    if (!DRY) fs.copyFileSync(src, dst);
    console.log(`${asset.out} <- ${asset.src}`);
}

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

const ICON_REF = /(rel="(?:icon|apple-touch-icon)"[^>]*?href="[^"]*?(?:favicon\.ico|apple-touch-icon\.png))(\?v=[^"]*)?"/g;

for (const file of htmlFiles(ROOT)) {
    const before = fs.readFileSync(file, "utf-8");
    let after = before.replace(ICON_REF, (m, ref) => `${ref}?v=${stamp}"`);

    // iOS takes its home screen icon from apple-touch-icon only. Derive the href
    // from the page's own favicon link so the relative path is always right.
    if (!/rel="apple-touch-icon"/.test(after)) {
        const icon = after.match(/<link rel="icon"[^>]*href="([^"]*favicon\.ico)(?:\?v=[^"]*)?"/);
        if (icon) {
            const href = icon[1].replace(/favicon\.ico$/, "apple-touch-icon.png");
            const link = `<link rel="apple-touch-icon" href="${href}?v=${stamp}">`;
            const at = after.match(/<link rel="icon"[^>]*>\r?\n/);
            after = at ? after.replace(at[0], at[0] + "    " + link + "\n") : after;
        }
    }

    if (after !== before) {
        changed = true;
        if (!DRY) fs.writeFileSync(file, after);
        console.log(`stamp ${path.relative(ROOT, file)} -> ?v=${stamp}`);
    }
}

console.log(`season=${season} stamp=${stamp} changed=${changed}${DRY ? " (dry run)" : ""}`);
