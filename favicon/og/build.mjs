// Renders og-image.html to favicon/og-image.png (1200x630), the one embed card
// used for og:image / twitter:image and the Discord bot's info banner.
//
//   node favicon/og/build.mjs
//
// Needs chrome-headless-shell from the Playwright cache and network access for
// the Google Fonts the card uses.

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "og-image.html");
const OUT = path.resolve(HERE, "..", "og-image.png");

function findShell() {
    const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright");
    if (!fs.existsSync(root)) return null;
    const dirs = fs.readdirSync(root).filter(d => d.startsWith("chromium_headless_shell")).sort().reverse();
    for (const d of dirs) {
        const exe = path.join(root, d, "chrome-headless-shell-win64", "chrome-headless-shell.exe");
        if (fs.existsSync(exe)) return exe;
    }
    return null;
}

const shell = findShell();
if (!shell) throw new Error("chrome-headless-shell not found in the Playwright cache");
const tmp = path.join(os.tmpdir(), "og-wall.png");
if (fs.existsSync(tmp)) fs.rmSync(tmp);
const res = spawnSync(shell, [
    "--headless", "--disable-gpu", "--hide-scrollbars", "--no-sandbox", "--force-device-scale-factor=1",
    "--allow-file-access-from-files", "--virtual-time-budget=8000",
    `--user-data-dir=${path.join(os.tmpdir(), "og-wall-profile")}`,
    `--screenshot=${tmp}`, "--window-size=1200,630",
    "file:///" + SRC.replace(/\\/g, "/")
], { encoding: "utf8", timeout: 90000 });
if (res.error) throw res.error;
if (!fs.existsSync(tmp)) throw new Error("screenshot failed:\n" + res.stderr);
fs.copyFileSync(tmp, OUT);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${fs.statSync(OUT).size} bytes)`);
