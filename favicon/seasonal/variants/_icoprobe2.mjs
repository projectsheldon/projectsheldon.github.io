import fs from "fs";
const b = fs.readFileSync("favicon-halloween.ico");
for (const i of [0, 1, 2]) {
  const o = 6 + i * 16, off = b.readUInt32LE(o + 12);
  const w = b.readUInt32BE(off + 16), h = b.readUInt32BE(off + 20);
  console.log(`entry ${i}: ${w}x${h} depth=${b[off + 24]} colorType=${b[off + 25]} interlace=${b[off + 28]}`);
}
