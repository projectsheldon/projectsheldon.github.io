// Minimal, dependency-free ZIP writer (STORE / no compression).
//
// We use it to repackage the files extracted from the loader's .7z into a single .zip –
// which every OS opens natively – so users never need a 7-Zip tool installed. STORE (no
// compression) is intentional: the payload is already the final installer files, and staying
// dependency-free keeps this bulletproof and easy to verify. Filenames are written UTF-8.

function crc32(bytes)
{
    let crc = 0xFFFFFFFF;
    for(let i = 0; i < bytes.length; i++)
    {
        crc ^= bytes[i];
        for(let b = 0; b < 8; b++)
        {
            crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

const _enc = new TextEncoder();

function u16(n) { return [ n & 0xff, (n >>> 8) & 0xff ]; }
function u32(n) { return [ n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff ]; }

// entries: [{ name: string (forward-slash relative path), data: Uint8Array }]
export function makeStoreZip(entries)
{
    const parts = [];      // local headers + file data, in order
    const central = [];    // central directory records
    let offset = 0;        // running byte offset into `parts`

    for(const entry of entries)
    {
        const nameBytes = _enc.encode(entry.name);
        const data = entry.data;
        const crc = crc32(data);
        const size = data.length;
        const localOffset = offset;

        const local = [];
        local.push(...u32(0x04034b50)); // local file header signature
        local.push(...u16(20));         // version needed to extract
        local.push(...u16(0x0800));     // general purpose flag: bit 11 = UTF-8 names
        local.push(...u16(0));          // compression method: 0 = store
        local.push(...u16(0), ...u16(0)); // mod time, mod date
        local.push(...u32(crc));
        local.push(...u32(size));       // compressed size
        local.push(...u32(size));       // uncompressed size
        local.push(...u16(nameBytes.length));
        local.push(...u16(0));          // extra field length
        const localHeader = new Uint8Array(local);

        parts.push(localHeader, nameBytes, data);
        offset += localHeader.length + nameBytes.length + size;

        const cen = [];
        cen.push(...u32(0x02014b50));   // central file header signature
        cen.push(...u16(20));           // version made by
        cen.push(...u16(20));           // version needed
        cen.push(...u16(0x0800));       // flags (UTF-8)
        cen.push(...u16(0));            // method: store
        cen.push(...u16(0), ...u16(0)); // time, date
        cen.push(...u32(crc));
        cen.push(...u32(size));         // compressed size
        cen.push(...u32(size));         // uncompressed size
        cen.push(...u16(nameBytes.length));
        cen.push(...u16(0));            // extra length
        cen.push(...u16(0));            // comment length
        cen.push(...u16(0));            // disk number start
        cen.push(...u16(0));            // internal attributes
        cen.push(...u32(0));            // external attributes
        cen.push(...u32(localOffset));  // relative offset of local header
        central.push(new Uint8Array(cen), nameBytes);
    }

    let centralSize = 0;
    for(const c of central) centralSize += c.length;
    const centralOffset = offset;

    const end = [];
    end.push(...u32(0x06054b50));       // end of central directory signature
    end.push(...u16(0));                // number of this disk
    end.push(...u16(0));                // disk with central directory
    end.push(...u16(entries.length));   // entries on this disk
    end.push(...u16(entries.length));   // total entries
    end.push(...u32(centralSize));
    end.push(...u32(centralOffset));
    end.push(...u16(0));                // comment length

    const all = [ ...parts, ...central, new Uint8Array(end) ];
    let total = 0;
    for(const p of all) total += p.length;

    const out = new Uint8Array(total);
    let pos = 0;
    for(const p of all) { out.set(p, pos); pos += p.length; }
    return out;
}
