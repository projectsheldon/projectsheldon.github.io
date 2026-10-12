// Minimal zero-dependency QR encoder for the quick-login modal.
//
// Byte mode, ECC level L, versions 1-5 (up to 106 payload chars – plenty for a
// login URL), fixed mask 0. No CDN, no dependency, ~10KB. Fixed mask 0 is fully
// spec-compliant (the format info declares it); penalty-based mask selection
// only optimises readability for dense codes.
//
// Deliberately capped at version 5: every ECC-L version up to 5 uses a single
// data block, so no interleaving is needed, and no version-info block exists
// below version 7. Longer payloads throw and the caller falls back to the
// typed short code, which always works.
const ECC_LEVEL_BITS = 1; // L = 01
const MASK = 0;
const MAX_VERSION = 5;

// [totalCodewords, ecCodewordsPerBlock, alignmentCenter] – single block each.
const VERSIONS = {
    1: { total: 26, ec: 7, align: [] },
    2: { total: 44, ec: 10, align: [ 6, 18 ] },
    3: { total: 70, ec: 15, align: [ 6, 22 ] },
    4: { total: 100, ec: 20, align: [ 6, 26 ] },
    5: { total: 134, ec: 26, align: [ 6, 30 ] },
};

const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7 };

// ── Galois field GF(256) / x^8 + x^4 + x^3 + x^2 + 1 ──────────────────────────
const EXP = new Array(512);
const LOG = new Array(256);
(function initTables()
{
    let x = 1;
    for(let i = 0; i < 255; i++)
    {
        EXP[ i ] = x;
        LOG[ x ] = i;
        x <<= 1;
        if(x & 0x100) x ^= 0x11D;
    }
    for(let i = 255; i < 512; i++) EXP[ i ] = EXP[ i - 255 ];
})();

function gmul(a, b)
{
    if(a === 0 || b === 0) return 0;
    return EXP[ LOG[ a ] + LOG[ b ] ];
}

// ── Reed-Solomon ─────────────────────────────────────────────────────────────
function rsGenerator(degree)
{
    // Highest-degree-first: poly[0] is the x^degree coefficient (always 1).
    let poly = [ 1 ];
    for(let i = 0; i < degree; i++)
    {
        const next = new Array(poly.length + 1).fill(0);
        for(let j = 0; j < poly.length; j++)
        {
            next[ j ] ^= poly[ j ];
            next[ j + 1 ] ^= gmul(poly[ j ], EXP[ i ]);
        }
        poly = next;
    }
    return poly;
}

function rsRemainder(data, degree)
{
    const gen = rsGenerator(degree);
    const msg = data.concat(new Array(degree).fill(0));
    for(let i = 0; i < data.length; i++)
    {
        const coef = msg[ i ];
        if(coef === 0) continue;
        // j = 0 cancels msg[i] itself (gen[0] is 1), so it is skipped.
        for(let j = 1; j < gen.length; j++) msg[ i + j ] ^= gmul(gen[ j ], coef);
    }
    return msg.slice(data.length);
}

// ── format info: 5 data bits -> 15-bit BCH code ──────────────────────────────
export function formatInfoBits(ecBits, mask)
{
    const data = ((ecBits & 3) << 3) | (mask & 7);
    let d = data << 10;
    const g = 0x537;
    function bitlen(n) { let l = 0; while(n > 0) { l++; n >>= 1; } return l; }
    while(bitlen(d) - 1 >= 10) d ^= g << (bitlen(d) - 11);
    return (((data << 10) | d) ^ 0x5412) & 0x7FFF;
}

function pickVersion(charCount)
{
    for(let v = 1; v <= MAX_VERSION; v++)
    {
        const dataCw = VERSIONS[ v ].total - VERSIONS[ v ].ec;
        if(Math.floor((dataCw * 8 - 12) / 8) >= charCount) return v;
    }
    return 0;
}

function buildDataCodewords(bytes, version)
{
    const dataCw = VERSIONS[ version ].total - VERSIONS[ version ].ec;
    const capacityBits = dataCw * 8;
    const bits = [];
    function push(val, len)
    {
        for(let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }
    push(4, 4); // byte mode
    push(bytes.length, 8); // char count (versions 1-9)
    for(const b of bytes) push(b, 8);
    const remaining = capacityBits - bits.length;
    const term = Math.min(4, Math.max(0, remaining));
    for(let i = 0; i < term; i++) bits.push(0);
    while(bits.length % 8 !== 0) bits.push(0);
    const out = [];
    for(let i = 0; i < bits.length; i += 8)
    {
        let b = 0;
        for(let j = 0; j < 8; j++) b = (b << 1) | bits[ i + j ];
        out.push(b);
    }
    for(let pad = 0xEC; out.length < dataCw; pad = pad === 0xEC ? 0x11 : 0xEC) out.push(pad);
    return out;
}

// ── matrix ───────────────────────────────────────────────────────────────────
function emptyMatrix(n)
{
    const modules = [];
    const func = [];
    for(let r = 0; r < n; r++)
    {
        modules.push(new Array(n).fill(false));
        func.push(new Array(n).fill(false));
    }
    return { modules, func };
}

function setFunc(m, r, c, dark)
{
    m.modules[ r ][ c ] = !!dark;
    m.func[ r ][ c ] = true;
}

function placeFinder(m, r0, c0)
{
    for(let dr = -1; dr <= 7; dr++)
    {
        for(let dc = -1; dc <= 7; dc++)
        {
            const r = r0 + dr;
            const c = c0 + dc;
            if(r < 0 || c < 0 || r >= m.modules.length || c >= m.modules.length) continue;
            const inFinder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
            const dark = inFinder && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
            setFunc(m, r, c, inFinder ? dark : false);
        }
    }
}

function buildBaseMatrix(version)
{
    const n = 21 + (version - 1) * 4;
    const m = emptyMatrix(n);
    placeFinder(m, 0, 0);
    placeFinder(m, 0, n - 7);
    placeFinder(m, n - 7, 0);
    // timing
    for(let i = 8; i < n - 8; i++)
    {
        setFunc(m, 6, i, i % 2 === 0);
        setFunc(m, i, 6, i % 2 === 0);
    }
    // alignment (single 5x5 – the three finder corners are skipped by construction)
    const centers = VERSIONS[ version ].align;
    if(centers.length > 0)
    {
        const last = centers[ centers.length - 1 ];
        for(let dr = -2; dr <= 2; dr++)
        {
            for(let dc = -2; dc <= 2; dc++)
            {
                const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
                setFunc(m, last + dr, last + dc, dark);
            }
        }
    }
    // format info, LSB first – copy 1 top-left, copy 2 split bottom-left/top-right
    const bits = formatInfoBits(ECC_LEVEL_BITS, MASK);
    function bit(i) { return ((bits >> i) & 1) === 1; }
    for(let i = 0; i < 6; i++) setFunc(m, i, 8, bit(i));
    setFunc(m, 7, 8, bit(6));
    setFunc(m, 8, 8, bit(7));
    setFunc(m, 8, 7, bit(8));
    for(let i = 9; i < 15; i++) setFunc(m, 8, 14 - i, bit(i));
    for(let i = 0; i < 7; i++) setFunc(m, n - 1 - i, 8, bit(i));
    for(let i = 7; i < 15; i++) setFunc(m, 8, n - 15 + i, bit(i));
    // dark module
    setFunc(m, 4 * version + 9, 8, true);
    return m;
}

function placeData(m, codewords, remainder)
{
    const n = m.modules.length;
    const totalBits = codewords.length * 8 + remainder;
    let bitIdx = 0;
    function nextBit()
    {
        if(bitIdx >= totalBits) return 0;
        if(bitIdx < codewords.length * 8)
        {
            const b = codewords[ bitIdx >> 3 ];
            return (b >> (7 - (bitIdx & 7))) & 1;
        }
        return 0;
    }
    let upward = true;
    for(let c = n - 1; c > 0; c -= 2)
    {
        if(c === 6) c = 5; // skip vertical timing
        for(let k = 0; k < n; k++)
        {
            const r = upward ? n - 1 - k : k;
            for(let dc = 0; dc < 2; dc++)
            {
                const cc = c - dc;
                if(m.func[ r ][ cc ]) continue;
                let dark = nextBit() === 1;
                if((r + cc) % 2 === 0) dark = !dark; // mask 0
                m.modules[ r ][ cc ] = dark;
                bitIdx++;
            }
        }
        upward = !upward;
    }
    return bitIdx;
}

// Returns { version, size, modules } – modules is size x size booleans.
export function makeQRModules(text)
{
    const bytes = [];
    for(let i = 0; i < text.length; i++)
    {
        const code = text.charCodeAt(i);
        if(code > 0xFF) throw new Error("qr payload must be latin-1");
        bytes.push(code);
    }
    const version = pickVersion(bytes.length);
    if(!version) throw new Error("qr payload too long");
    const data = buildDataCodewords(bytes, version);
    const full = data.concat(rsRemainder(data, VERSIONS[ version ].ec));
    const m = buildBaseMatrix(version);
    placeData(m, full, REMAINDER_BITS[ version ]);
    return { version, size: m.modules.length, modules: m.modules };
}

// Test/self-check hook: decodes modules back to the byte-mode payload by
// rebuilding the function map and walking the zigzag. Used by qr-matrix tests
// to prove every emitted matrix round-trips (mode, count, bytes, EC length).
export function decodeQR(modules)
{
    const n = modules.length;
    const version = (n - 21) / 4 + 1;
    if(!VERSIONS[ version ]) throw new Error("bad size");
    const base = buildBaseMatrix(version);
    const bits = [];
    let upward = true;
    for(let c = n - 1; c > 0; c -= 2)
    {
        if(c === 6) c = 5; // skip vertical timing, mirrored from placeData
        for(let k = 0; k < n; k++)
        {
            const r = upward ? n - 1 - k : k;
            for(let dc = 0; dc < 2; dc++)
            {
                const c2 = c - dc;
                if(base.func[ r ][ c2 ]) continue;
                let dark = modules[ r ][ c2 ];
                if((r + c2) % 2 === 0) dark = !dark;
                bits.push(dark ? 1 : 0);
            }
        }
        upward = !upward;
    }
    const total = VERSIONS[ version ].total;
    const words = [];
    for(let i = 0; i < total * 8; i += 8)
    {
        let b = 0;
        for(let j = 0; j < 8; j++) b = (b << 1) | bits[ i + j ];
        words.push(b);
    }
    let pos = 0;
    function take(len)
    {
        let v = 0;
        for(let i = 0; i < len; i++) v = (v << 1) | bits[ pos++ ];
        return v;
    }
    const mode = take(4);
    const count = take(8);
    const bytes = [];
    for(let i = 0; i < count; i++) bytes.push(take(8));
    const dataLen = total - VERSIONS[ version ].ec;
    return { version, mode, count, bytes, dataCodewords: words.slice(0, dataLen), ecCodewords: words.slice(dataLen) };
}
// the typed short code, which never depends on this.
export function drawQRCode(canvas, text, opts = {})
{
    const { version, size, modules } = makeQRModules(text);
    const margin = opts.margin ?? 2;
    const scale = Math.max(1, Math.floor(opts.scale ?? 6));
    const dark = opts.dark || "#000000";
    const light = opts.light || "#ffffff";
    const px = (size + margin * 2) * scale;
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if(!ctx) throw new Error("no 2d context");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = dark;
    for(let r = 0; r < size; r++)
    {
        for(let c = 0; c < size; c++)
        {
            if(modules[ r ][ c ]) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
        }
    }
    return { version, size };
}
