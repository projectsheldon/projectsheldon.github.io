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

// Card art is optional – guides without an uploaded image render text-only
// instead of a generated placeholder.
function thumbFor(guide)
{
    if(!guide.thumb) return "";
    return `${apiUrl}/guides/img?file=${encodeURIComponent(guide.thumb)}`;
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

// Image title → per-image options. Unknown keys are ignored so the format can
// grow without breaking guides already in the database.
function parseImgTitle(title)
{
    const out = { width: "", align: "" };
    for(const token of String(title).trim().split(/\s+/))
    {
        const kv = token.match(/^(width|align):(.+)$/);
        if(!kv) continue;
        if(kv[1] === "width")
        {
            // A bare number means percent, matching what the editor writes.
            const w = kv[2].match(/^(\d+(?:\.\d+)?)(px|%)?$/);
            if(w) out.width = w[1] + (w[2] || "%");
        }
        else if(kv[2] === "left" || kv[2] === "right") out.align = kv[2];
    }
    return out;
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
    const thumb = thumbFor(g);
    return `
        <a href="./?slug=${encodeURIComponent(g.slug)}" class="guide-card glass-card rounded-[1.5rem] overflow-hidden flex flex-col">
            ${thumb ? `<div class="aspect-video overflow-hidden bg-black/40">
                <img src="${esc(thumb)}" alt="" loading="lazy" class="w-full h-full object-cover">
            </div>` : ""}
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
        // Splice the marker out of its own text node. Rebuilding from
        // textContent used to flatten every link and styled span inside a callout.
        const head = first.firstChild;
        if(!head || head.nodeType !== 3) return;
        const m = head.data.match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i);
        if(!m) return;
        const kind = kinds[m[1].toLowerCase()] || "note";
        bq.classList.add("callout", "callout-" + kind);
        const label = document.createElement("span");
        label.className = "callout-label";
        label.textContent = m[1];
        head.data = head.data.slice(m[0].length);
        first.insertBefore(label, head);
    });
}

function fixRelativeImgs(root)
{
    root.querySelectorAll("img").forEach(img =>
    {
        const src = img.getAttribute("src") || "";
        if(src.startsWith("guides/")) img.src = apiUrl + "/" + src;
        // The editor stores per-image width and alignment in the title:
        // ![alt](url "width:50% align:left"). Centre is the default and is left
        // unwritten, so guides saved before alignment existed are untouched.
        const attrs = parseImgTitle(img.getAttribute("title") || "");
        if(attrs.width) img.setAttribute("width", attrs.width);
        if(attrs.align) img.setAttribute("data-align", attrs.align);
        img.removeAttribute("title");
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

        document.title = `${g.title} – Sheldon Guides`;

        const meta = document.getElementById("guide-meta");
        meta.innerHTML = `
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
        // style/data-size carry the author's font-size choice; anything else stays scrubbed.
        const clean = DOMPurify.sanitize(raw, {
            ADD_ATTR: ["target", "style", "data-size"],
            ALLOWED_ATTR: ["target", "href", "src", "alt", "title", "width", "height", "class", "id", "style", "data-size", "colspan", "rowspan", "align", "rel", "open"],
        });
        const body = document.getElementById("guide-body");
        body.innerHTML = clean;
        fixRelativeImgs(body);
        enhanceCallouts(body);
        initLightbox(body);
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

// ---- image lightbox ----
// Guides are screenshot-heavy, and a 50%-width image inside the reader hides the
// detail people are actually trying to read. Clicking any image opens it here at
// its real pixel size, with pan and zoom.

const LB = { el: null, img: null, stage: null, pct: null, scale: 1, nw: 0, nh: 0, restore: null };

function buildLightbox()
{
    if(LB.el) return;
    const el = document.createElement("div");
    el.className = "glb";
    el.hidden = true;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Image preview");
    el.innerHTML =
        '<div class="glb-stage"><img class="glb-img" alt=""></div>' +
        '<button class="glb-close" type="button" aria-label="Close preview">&times;</button>' +
        '<div class="glb-bar">' +
            '<button type="button" data-z="out" aria-label="Zoom out">&minus;</button>' +
            '<span class="glb-pct">100%</span>' +
            '<button type="button" data-z="in" aria-label="Zoom in">+</button>' +
            '<span class="glb-div"></span>' +
            '<button type="button" data-z="fit">Fit</button>' +
            '<button type="button" data-z="one" title="Show at original size">1:1</button>' +
        "</div>";
    document.body.append(el);
    LB.el = el;
    LB.img = el.querySelector(".glb-img");
    LB.stage = el.querySelector(".glb-stage");
    LB.pct = el.querySelector(".glb-pct");

    el.querySelector(".glb-close").addEventListener("click", closeLightbox);
    // Clicking the backdrop closes, but a click that lands on the image or on the
    // controls must not.
    el.addEventListener("click", e =>
    {
        if(e.target === el || e.target === LB.stage) closeLightbox();
    });
    el.querySelectorAll("[data-z]").forEach(b => b.addEventListener("click", () =>
    {
        const z = b.dataset.z;
        if(z === "in") setScale(LB.scale * 1.25);
        else if(z === "out") setScale(LB.scale / 1.25);
        else if(z === "fit") setScale(fitScale());
        else setScale(1);
    }));
    LB.stage.addEventListener("wheel", e =>
    {
        if(!LB.nw) return;
        e.preventDefault();
        setScale(LB.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    }, { passive: false });
    LB.img.addEventListener("dblclick", () => setScale(LB.scale === 1 ? fitScale() : 1));

    // Drag to pan once the image is larger than the stage. Native scrolling still
    // handles touch, so this only covers mouse users.
    let drag = null;
    LB.stage.addEventListener("pointerdown", e =>
    {
        if(e.button !== 0) return;
        if(LB.stage.scrollWidth <= LB.stage.clientWidth && LB.stage.scrollHeight <= LB.stage.clientHeight) return;
        drag = { x: e.clientX, y: e.clientY, l: LB.stage.scrollLeft, t: LB.stage.scrollTop };
        LB.stage.setPointerCapture(e.pointerId);
        LB.stage.classList.add("grabbing");
    });
    LB.stage.addEventListener("pointermove", e =>
    {
        if(!drag) return;
        LB.stage.scrollLeft = drag.l - (e.clientX - drag.x);
        LB.stage.scrollTop = drag.t - (e.clientY - drag.y);
    });
    const endDrag = () => { drag = null; LB.stage.classList.remove("grabbing"); };
    LB.stage.addEventListener("pointerup", endDrag);
    LB.stage.addEventListener("pointercancel", endDrag);

    document.addEventListener("keydown", e =>
    {
        if(LB.el.hidden) return;
        if(e.key === "Escape") { closeLightbox(); return; }
        if(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        if(e.key === "+" || e.key === "=") { e.preventDefault(); setScale(LB.scale * 1.25); }
        else if(e.key === "-" || e.key === "_") { e.preventDefault(); setScale(LB.scale / 1.25); }
        else if(e.key === "0") { e.preventDefault(); setScale(fitScale()); }
        else if(e.key === "1") { e.preventDefault(); setScale(1); }
    });
}

function fitScale()
{
    if(!LB.nw || !LB.nh) return 1;
    const pad = 48;
    const availW = Math.max(80, LB.stage.clientWidth - pad);
    const availH = Math.max(80, LB.stage.clientHeight - pad);
    // Never blow a small image up past 100% - "fit" should mean fully visible.
    return Math.min(availW / LB.nw, availH / LB.nh, 1);
}

function setScale(v)
{
    LB.scale = Math.max(0.1, Math.min(8, v));
    LB.img.style.width = Math.round(LB.nw * LB.scale) + "px";
    LB.pct.textContent = Math.round(LB.scale * 100) + "%";
    LB.el.classList.toggle("zoomed", LB.scale > fitScale() + 0.001);
}

function openLightbox(img)
{
    buildLightbox();
    LB.nw = img.naturalWidth || img.width || 0;
    LB.nh = img.naturalHeight || img.height || 0;
    LB.img.src = img.currentSrc || img.src;
    LB.img.alt = img.alt || "";
    LB.restore = document.activeElement;
    LB.el.hidden = false;
    // The stage has no measurable size until the overlay is displayed.
    document.body.style.overflow = "hidden";
    LB.stage.scrollLeft = 0;
    LB.stage.scrollTop = 0;
    setScale(fitScale());
    LB.el.querySelector(".glb-close").focus({ preventScroll: true });
}

function closeLightbox()
{
    if(!LB.el || LB.el.hidden) return;
    LB.el.hidden = true;
    LB.img.removeAttribute("src");
    document.body.style.overflow = "";
    if(LB.restore && LB.restore.focus) LB.restore.focus({ preventScroll: true });
    LB.restore = null;
}

function initLightbox(root)
{
    // Delegated on the article, which survives re-renders - so bind exactly once
    // or a retry / language switch would stack duplicate listeners.
    if(root.dataset.lbReady) return;
    root.dataset.lbReady = "1";
    root.addEventListener("click", e =>
    {
        const img = e.target.closest ? e.target.closest("img") : null;
        if(!img || !root.contains(img)) return;
        e.preventDefault();
        openLightbox(img);
    });
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
