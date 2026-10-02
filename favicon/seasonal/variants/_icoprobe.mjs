import fs from "fs";
const b = fs.readFileSync("favicon-halloween.ico");
console.log("total", b.length, "reserved", b.readUInt16LE(0), "type", b.readUInt16LE(2), "count", b.readUInt16LE(4));
const count = b.readUInt16LE(4);
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16;
  const w = b[o] === 0 ? 256 : b[o], h = b[o + 1] === 0 ? 256 : b[o + 1];
  const size = b.readUInt32LE(o + 8), off = b.readUInt32LE(o + 12);
  const sig = b.subarray(off, off + 8).toString("hex");
  const pngOk = sig === "89504e470d0a1a0a";
  const ihdr = pngOk ? b.readUInt32BE(off + 16) : 0, bitDepth = pngOk ? b[off + 24] : 0;
  console.log(`  ${w}x${h} planes=${b.readUInt16LE(o + 4)} bpp=${b.readUInt16LE(o + 6)} size=${size} off=${off} end=${off + size} png=${pngOk} ihdr=${ihdr}x? depth=${bitDepth}`);
}
console.log("declared-vs-actual:", b.length === 6 + 16 * count + [0,1,2].reduce((a, i) => a + b.readUInt32LE(6 + i * 16 + 8), 0));
