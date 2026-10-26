// Season resolver: today's date -> which icon variant to serve.
//
// Mirrored by Sheldon-Api/Api/src/managers/season/season.js, which drives the Discord
// server icon and the logo in Sheldon and the Loader, so all of them flip on the same
// day. Both use UTC (the GitHub Actions runner that calls this is UTC anyway).
//
// Windows are inclusive [month, day] ranges; an end before the start wraps the new year.

const DAY = 86400000;

export const VARIANTS = ["default", "christmas", "easter", "summer", "halloween"];

const WINDOWS = [
    { id: "christmas", from: [12, 1],  to: [1, 6] },
    { id: "summer",    from: [6, 21],  to: [8, 31] },
    { id: "halloween", from: [10, 1],  to: [11, 5] }
];

// Easter straddles the real holiday: a lead-in, the day itself, then a short tail.
const EASTER_LEAD_DAYS = 9;
const EASTER_TRAIL_DAYS = 16;

// Easter Sunday, anonymous Gregorian algorithm.
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

function within(month, day, from, to) {
    const t = month * 100 + day;
    const s = from[0] * 100 + from[1];
    const e = to[0] * 100 + to[1];
    return s <= e ? t >= s && t <= e : t >= s || t <= e;
}

export function resolveSeason(date = new Date()) {
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();

    for (const win of WINDOWS) {
        if (within(month, day, win.from, win.to)) return win.id;
    }

    const easter = easterSunday(year);
    const noon = Date.UTC(year, easter.month - 1, easter.day, 12);
    const t = date.getTime();
    if (t >= noon - (EASTER_LEAD_DAYS + 0.5) * DAY && t <= noon + (EASTER_TRAIL_DAYS + 0.5) * DAY) return "easter";

    return "default";
}
