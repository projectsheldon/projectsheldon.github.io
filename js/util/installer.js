// Client-side loader "installer": takes the raw .7z bytes, extracts them in-browser with
// libarchive.js (WASM), and hands the user ready-to-use files – so nobody needs a 7-Zip
// tool. A single extracted file is saved as-is (e.g. the .exe); multiple files are
// repackaged into a natively-openable .zip.
//
// libarchive.js resolves its worker + wasm relative to js/lib/libarchive.js via
// import.meta.url, so no worker path config is needed as long as the three lib files stay
// together in js/lib/.

import { Archive } from '../lib/libarchive.js';
import { makeStoreZip } from './zipstore.js';

let _inited = false;
function ensureInit()
{
    if(_inited) return;
    Archive.init({});
    _inited = true;
}

// Extract archive bytes into a flat list: [{ path, name, data:Uint8Array }].
export async function extractArchive(bytes)
{
    ensureInit();

    const file = new File([ bytes ], 'Loader.7z', { type: 'application/x-7z-compressed' });
    const archive = await Archive.open(file);

    try
    {
        // extractFiles() returns a nested object mirroring the archive's directory tree,
        // with real File objects at the leaves. Walk it into a flat list.
        const tree = await archive.extractFiles();

        const flat = [];
        (function walk(node, prefix)
        {
            for(const key of Object.keys(node))
            {
                const val = node[key];
                if(val instanceof File) flat.push({ path: prefix + key, file: val });
                else if(val && typeof val === 'object') walk(val, prefix + key + '/');
            }
        })(tree, '');

        const out = [];
        for(const e of flat)
        {
            const buf = new Uint8Array(await e.file.arrayBuffer());
            out.push({ path: e.path, name: e.file.name || e.path.split('/').pop(), data: buf });
        }
        return out;
    }
    finally
    {
        try { await archive.close(); } catch(e) {}
    }
}

// Build the file we hand the user, without saving yet. Returns { blob, name }.
export function buildDeliverable(files, zipName = 'Sheldon-Loader.zip')
{
    if(!files || files.length === 0) throw new Error('The installer archive was empty.');

    if(files.length === 1)
    {
        const f = files[0];
        return {
            blob: new Blob([ f.data ], { type: 'application/octet-stream' }),
            name: f.name || 'Loader.exe'
        };
    }

    const zip = makeStoreZip(files.map(f => ({ name: f.path, data: f.data })));
    return { blob: new Blob([ zip ], { type: 'application/zip' }), name: zipName };
}

export function saveBlob(blob, filename)
{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
