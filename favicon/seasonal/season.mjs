// Season resolver: today's date -> which OG variant to serve.
//
// Windows are inclusive day ranges in local time. Wrapping ranges (26 Dec -> 6 Jan)
// are allowed. First match wins, so put the narrow windows above the wide ones.

const DAY = 86400000;

export const VARIANTS = ["newyear", "valentine", "april", "easter", "halloween", "christmas", "default"];

// Easter Sunday, anonymous Gregorian algorithm (no Gauss/Butcher corrections needed,
// this is the one Meeus gives for the Gregorian calendar).
export function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
}

// [start, end] inclusive as [month, day]; end earlier than start means it wraps the new year.
const WINDOWS = [
    { id: "newyear",   from: [12, 26],  to: [1, 6] },
    { id: "valentine", from: [2, 7],    to: [2, 15] },
    { id: "april",     from: [4, 1],    to: [4, 2] },
    { id: "halloween", from: [10, 20],  to: [11, 5] },
    { id: "christmas", from: [11, 15],  to: [12, 25] }
];

// Easter art straddles the real holiday: a lead-in, the day itself, then a short
// spring tail so the blossom art is not a single-day flash.
const EASTER_LEAD_DAYS = 9;
const EASTER_TRAIL_DAYS = 16;

function easterWindow(year) {
    const easter = easterSunday(year);
    const noon = new Date(year, easter.month - 1, easter.day, 12);
    const from = new Date(noon.getTime() - EASTER_LEAD_DAYS * DAY);
    const to = new Date(noon.getTime() + EASTER_TRAIL_DAYS * DAY);
    return { from: [from.getMonth() + 1, from.getDate()], to: [to.getMonth() + 1, to.getDate()], wraps: to.getFullYear() !== year };
}

function within(month, day, from, to) {
    const t = month * 100 + day;
    const s = from[0] * 100 + from[1];
    const e = to[0] * 100 + to[1];
    return s <= e ? t >= s && t <= e : t >= s || t <= e;
}

export function resolveSeason(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    for (const win of WINDOWS) {
        if (within(month, day, win.from, win.to)) return win.id;
    }

    // Easter is checked after the fixed windows: a rare early-Easter in late March can
    // land next to nothing else, but it must never shadow newyear or the fixed set.
    const easter = easterWindow(year);
    if (!easter.wraps && within(month, day, easter.from, easter.to)) return "easter";

    return "default";
}

export function variantPath(variant, ext = "png") {
    return `favicon/og/variants/og-${variant}.${ext}`;
}