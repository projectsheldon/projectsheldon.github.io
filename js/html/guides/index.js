import Api from "../../util/backend.js";

const params = new URLSearchParams(window.location.search);
const slug = (params.get("slug") || "").trim();

const listView = document.getElementById("guides-list-view");
const readerView = document.getElementById("guides-reader-view");
const loadingEl = document.getElementById("guides-loading");
const errorEl = document.getElementById("guides-error");

let apiUrl = "";
let allGuides = [];
let activeCat = "";

function showLoading(on)
{
    loadingEl.style.display = on ? "flex" : "none";
}

function showError(on)
{
    errorEl.classList.toggle("hidden", !on);
}

function thumbFor(guide)
{
    if(guide.thumb) return `${apiUrl}/guides/img?file=${encodeURIComponent(guide.thumb)}`;
    return `${apiUrl}/guides/thumb?slug=${encodeURIComponent(guide.slug)}`;
}

function t(key)
{
    try { if(window.SheldonLang) return window.SheldonLang.t(key); } catch(e) {}
    return key;
}

// Dates follow the picked site language, not the browser's.
function fmtDate(ts)
{
    if(!ts) return "";
    try
    {
        const lang = (window.SheldonLang && window.SheldonLang.get()) || undefined;
        return new Date(ts).toLocaleDateString(lang, { year: "numeric", month: "short", day: "numeric" });
    }
    catch(e) { return ""; }
}

function esc(s)
{
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---- list view ----

function renderCats()
{
    const wrap = document.getElementById("guides-cats");
    const cats = [...new Set(allGuides.map(g => g.category).filter(Boolean))].sort();
    wrap.innerHTML = "";
    const all = document.createElement("button");
    all.className = "chip" + (activeCat === "" ? " active" : "");
    all.textContent = t("guides.all");
    all.addEventListener("click", () => { activeCat = ""; renderCats(); renderGrid(); });
    wrap.append(all);
    for(const c of cats)
    {
        const b = document.createElement("button");
        b.className = "chip" + (activeCat === c ? " active" : "");
        b.textContent = c;
        b.addEventListener("click", () => { activeCat = c; renderCats(); renderGrid(); });
        wrap.append(b);
    }
}

function cardHTML(g)
{
    const tags = (g.tags || []).slice(0, 3).map(t =>
        `<span class="text-[0.6rem] font-bold text-neutral-500">#${esc(t)}</span>`).join(" ");
    return `
        <a href="./?slug=${encodeURIComponent(g.slug)}" class="guide-card glass-card rounded-[1.5rem] overflow-hidden flex flex-col">
            <div class="aspect-video overflow-hidden bg-black/40">
                <img src="${esc(thumbFor(g))}" alt="" loading="lazy" class="w-full h-full object-cover">
            </div>
            <div class="p-5 flex flex-col gap-2 flex-1">
                ${g.category ? `<span class="text-[0.6rem] font-black uppercase tracking-[0.2em] text-[#c7b18f]">${esc(g.category)}</span>` : ""}
                <div class="text-lg font-extrabold leading-snug">${esc(g.title)}</div>
                <div class="text-sm text-neutral-500 leading-relaxed flex-1">${esc(g.excerpt)}</div>
                <div class="flex items-center justify-between pt-1">
                    <div class="flex gap-2">${tags}</div>
                    <span class="text-[0.65rem] text-neutral-600 font-semibold">${esc(fmtDate(g.published_at))}</span>
                </div>
            </div>
        </a>`;
}

function renderGrid()
{
    const q = (document.getElementById("guides-search").value || "").trim().toLowerCase();
    const grid = document.getElementById("guides-grid");
    const empty = document.getElementById("guides-empty");
    const rows = allGuides.filter(g =>
        (!activeCat || g.category === activeCat) &&
        (!q || (g.title + " " + g.excerpt + " " + (g.tags || []).join(" ")).toLowerCase().includes(q)));
    grid.innerHTML = rows.map(cardHTML).join("");
    empty.classList.toggle("hidden", rows.length > 0);
}

async function loadList()
{
    showLoading(true);
    showError(false);
    try
    {
        apiUrl = await Api.GetApiUrl();
        const res = await fetch(`${apiUrl}/guides/list?limit=200`);
        const data = await res.json();
        if(!data || !data.ok) throw new Error("bad response");
        allGuides = data.guides || [];
        renderCats();
        renderGrid();
    }
    catch(e)
    {
        showError(true);
    }
    showLoading(false);
}

// ---- reader view ----

function enhanceCallouts(root)
{
    const kinds = { note: "note", tip: "tip", warning: "warning", important: "note", caution: "caution" };
    root.querySelectorAll("blockquote").forEach(bq =>
    {
        const first = bq.querySelector("p");
        if(!first) return;
        const m = first.textContent.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i);
        if(!m) return;
        const kind = kinds[m[1].toLowerCase()] || "note";
        bq.classList.add("callout", "callout-" + kind);
        first.innerHTML = `<span class="callout-label">${esc(m[1])}</span>` +
            esc(first.textContent.slice(m[0].length)).replace(/\n/g, "<br>");
    });
}

function fixRelativeImgs(root)
{
    root.querySelectorAll("img").forEach(img =>
    {
        const src = img.getAttribute("src") || "";
        if(src.startsWith("guides/")) img.src = apiUrl + "/" + src;
        // Editor stores per-image widths in the title: ![alt](url "width:50%").
        const title = img.getAttribute("title") || "";
        const m = title.match(/^width:(\d+%?)$/);
        if(m)
        {
            img.setAttribute("width", m[1].endsWith("%") ? m[1] : m[1] + "%");
            img.removeAttribute("title");
        }
        img.loading = "lazy";
    });
}

async function loadReader()
{
    listView.classList.add("hidden");
    readerView.classList.remove("hidden");
    showLoading(true);
    showError(false);
    try
    {
        apiUrl = await Api.GetApiUrl();
        const res = await fetch(`${apiUrl}/guides/get?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if(!data || !data.ok || !data.guide) throw new Error("not found");
        const g = data.guide;

        document.title = `${g.title} — Sheldon Guides`;

        const meta = document.getElementById("guide-meta");
        meta.innerHTML = `
            <div class="rounded-[1.5rem] overflow-hidden border border-white/10 mb-6">
                <img src="${esc(thumbFor(g))}" alt="" class="w-full aspect-[16/7] object-cover">
            </div>
            ${g.category ? `<div class="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#c7b18f] mb-2">${esc(g.category)}</div>` : ""}
            <h1 class="text-3xl sm:text-4xl font-black tracking-tight mb-3">${esc(g.title)}</h1>
            <div class="flex items-center gap-3 text-sm text-neutral-500">
                <span>${esc(fmtDate(g.published_at))}</span>
                ${(g.tags || []).map(t => `<span class="text-[0.65rem] font-bold">#${esc(t)}</span>`).join(" ")}
            </div>`;

        if(typeof marked === "undefined" || typeof DOMPurify === "undefined")
        {
            throw new Error("renderer libs failed to load");
        }
        // The Luau grammar registers as "luau"; map the common "lua" tag onto it.
        try
        {
            if(window.hljs && window.hljs.getLanguage && !window.hljs.getLanguage("lua"))
                window.hljs.registerAliases([ "lua", "luau" ], { languageName: "luau" });
        }
        catch(e) {}
        // A guide that opens with a heading repeating its own title would print
        // the title twice (page header + first heading), so drop that one line.
        const source = String(g.markdown || "");
        const firstLine = source.split(/\r?\n/)[ 0 ];
        const heading = firstLine.match(/^\s*#{1,3}\s+(.+?)\s*$/);
        const md = heading && heading[ 1 ].trim().toLowerCase() === String(g.title).trim().toLowerCase()
            ? source.slice(firstLine.length).replace(/^\s*\r?\n/, "")
            : source;
        const raw = marked.parse(md, { breaks: true, gfm: true });
        const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] });
        const body = document.getElementById("guide-body");
        body.innerHTML = clean;
        fixRelativeImgs(body);
        enhanceCallouts(body);
        if(window.hljs) body.querySelectorAll("pre code").forEach(el =>
        {
            try { window.hljs.highlightElement(el); } catch(e) {}
        });
    }
    catch(e)
    {
        showError(true);
    }
    showLoading(false);
}

document.getElementById("guides-retry")?.addEventListener("click", () =>
{
    if(slug) loadReader();
    else loadList();
});

document.getElementById("guides-search")?.addEventListener("input", renderGrid);

// The category chips and card dates are built in JS, so a language switch has to
// ask us to rebuild rather than only re-run the data-i18n pass.
window.addEventListener("sheldon:lang", () =>
{
    renderCats();
    renderGrid();
});

if(window.SheldonBackend)
{
    window.SheldonBackend.OnRecovered(() =>
    {
        if(slug) loadReader();
        else loadList();
    });
}

if(slug) loadReader();
else loadList();
