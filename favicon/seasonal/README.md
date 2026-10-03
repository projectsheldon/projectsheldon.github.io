# Seasonal brand assets

Everything the site shows when someone drops a Project Sheldon link, or opens the
tab, follows the calendar. Seven variants, swapped automatically.

| Variant     | OG art          | Icon / logo      | Window                        |
|-------------|-----------------|------------------|-------------------------------|
| `default`   | no seasonal art | the shipped logo | everything not listed below  |
| `newyear`   | party popper    | party popper     | 26 Dec – 6 Jan                |
| `valentine` | heart + rose    | heart with ribbon| 7 – 15 Feb                    |
| `april`     | clown + dice    | clown face       | 1 – 2 Apr                     |
| `easter`    | egg + blossom   | cherry blossom   | Easter − 9 days → Easter + 16 |
| `halloween` | pumpkin + webs  | jack-o'-lantern  | 20 Oct – 5 Nov                |
| `christmas` | tree + gifts    | christmas tree   | 15 Nov – 25 Dec               |

Easter is computed, not hardcoded, using the anonymous Gregorian algorithm.

## What gets swapped

| Live file              | Source in `variants/`            |
|------------------------|----------------------------------|
| `favicon/og-image.png` | `og-<season>.png`                |
| `favicon/favicon.ico`  | `favicon-<season>.ico`           |
| `favicon/logo.png`     | `logo-<season>.png`              |
| `favicon/apple-touch-icon.png` | `apple-touch-<season>.png` |

Out of season `default` copies the shipped assets byte for byte rather than
re-rendering, so nothing about the logo changes when no holiday is running.

## Why the URLs have a query string

Discord caches an embed image by URL, and browsers cache favicons the same way.
Serve the right bytes at the same URL and every existing embed and every installed
home screen icon keeps what it already has. So `pick.mjs` also stamps
`?v=<season>-<year>w<week>` on every `og:image`, `twitter:image`, `rel="icon"` and
`rel="apple-touch-icon"` reference. Each season flip hands every cache a URL it has
never fetched, and the weekly component is a safety net for windows retuned later.

The one thing this cannot fix: messages that were already posted keep the embed
they were created with. Only new posts pick up a change.

## Files

    build-og.mjs     renders the OG art to SVG, rasterises to 1200x630 PNG
    build-logo.mjs   renders the icon tiles, assembles the multi-size .ico
    season.mjs       date -> variant id, plus the Easter calculation
    pick.mjs         swaps the live files and stamps the HTML
    variants/        the rendered assets
    emoji/           Twemoji vectors used by both builders
    logo.png         the Sheldon mark, the source for everything logo-side

## Regenerating by hand

Needs Node and a Chromium build. The rasterisers look for the headless shell in the
local Playwright cache (`%LOCALAPPDATA%\ms-playwright`).

    node favicon/seasonal/build-og.mjs                   # all OG variants
    node favicon/seasonal/build-logo.mjs                 # all logo variants
    node favicon/seasonal/build-og.mjs --only=halloween  # one variant
    node favicon/seasonal/pick.mjs --dry                 # what today would change
    node favicon/seasonal/pick.mjs --date=2026-12-25     # stage a specific day

`build-og.mjs` writes the SVG and the PNG side by side in `variants/` and drops a
`_contact-sheet.png` here, which is the fastest way to eyeball a change across
every season at once.

## Icon construction

`favicon.ico` is a real multi-size icon: 16, 32 and 48 px, each rendered
separately rather than downscaled, with PNG-compressed entries, which every browser
worth supporting reads. `build-logo.mjs` writes the ICO itself (`ICONDIR` plus a
directory entry per size) so the build needs no image library.

The seasonal glyph in the corner of the tile is only drawn at 180 px and up.
Below that it turns to mush, so the small sizes get the tile and the mark alone.

## Adding a season

1. Download the emoji you want from
   [twemoji](https://github.com/jdecked/twemoji/tree/main/assets/svg) into `emoji/`,
   named `<codepoint>.svg`.
2. Add an entry to `SEASONS` in **both** builders with the emblem, marks and accent
   colours. They are two tables on purpose: the OG puts the mark beside the
   wordmark, the icon puts it in a corner of the tile.
3. Add the window to `WINDOWS` in `season.mjs`.
4. Run both builders and check the contact sheet. Narrow windows go above wide
   ones, first match wins.

## Artwork licence

The emoji are [Twemoji](https://github.com/jdecked/twemoji) by Twitter, Inc,
licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). Everything
else here is original to the project.