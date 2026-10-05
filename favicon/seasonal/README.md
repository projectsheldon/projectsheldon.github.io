# Seasonal brand assets

One thing on this site follows the calendar: the Discord embed art, which is what
you see when someone pastes a Project Sheldon link into a chat. Seven variants,
swapped automatically.

| Variant     | OG art          | Window                        |
|-------------|-----------------|-------------------------------|
| `default`   | no seasonal art | everything not listed below  |
| `newyear`   | party popper    | 26 Dec – 6 Jan                |
| `valentine` | heart + rose    | 7 – 15 Feb                    |
| `april`     | clown + dice    | 1 – 2 Apr                     |
| `easter`    | egg + blossom   | Easter − 9 days → Easter + 16 |
| `halloween` | pumpkin + webs  | 1 Oct – 5 Nov                 |
| `christmas` | tree + gifts    | 15 Nov – 25 Dec               |

Easter is computed, not hardcoded, using the anonymous Gregorian algorithm.

The favicon, the apple-touch icon, `icon.png` and the in-page logo are **not**
seasonal. They are the bare mark on transparency, byte for byte identical in all
seven variants, so the calendar never touches them. That used to be a seasonal
tinted tile; it is now just the mark.

## What gets swapped

| Live file              | Source in `variants/`            |
|------------------------|----------------------------------|
| `favicon/og-image.png` | `og-<season>.png`                |

That is the whole list. `favicon.ico`, `apple-touch-icon.png`, `icon.png` and
`logo.png` are committed once and never swapped.

## Why the URLs have a query string

Discord caches an embed image by URL. Serve the right bytes at the same URL and
every existing embed keeps the picture it was created with. So `pick.mjs` also
stamps `?v=<season>-<year>w<week>` on every `og:image` and `twitter:image`
reference. Each season flip hands every cache a URL it has never fetched, and the
weekly component is a safety net for windows retuned later.

The icon links carry no query string at all. The icon is the bare mark and its
bytes never change, so a stamp would only hand caches a new URL for an image they
already hold, and the query string would pin the site logo to whatever mark
shipped on the day it was last added.

The one thing this cannot fix: messages that were already posted keep the embed
they were created with. Only new posts pick up a change.

## Files

    build-og.mjs     renders the OG art to SVG, rasterises to 1200x630 PNG
    build-logo.mjs   renders the mark: the favicon, the touch icon, icon.png, logo.png
    season.mjs       date -> variant id, plus the Easter calculation
    pick.mjs         swaps the embed art and stamps the HTML
    variants/        the rendered assets
    emoji/           Twemoji vectors, used by build-og.mjs
    logo.png         the Sheldon mark, the source for everything logo-side

## Regenerating by hand

Needs Node and a Chromium build. The rasterisers look for the headless shell in the
local Playwright cache (`%LOCALAPPDATA%\ms-playwright`).

    node favicon/seasonal/build-og.mjs                   # all OG variants
    node favicon/seasonal/build-logo.mjs                 # all mark renders
    node favicon/seasonal/build-og.mjs --only=halloween  # one variant
    node favicon/seasonal/pick.mjs --dry                 # what today would change
    node favicon/seasonal/pick.mjs --date=2026-12-25     # stage a specific day

`build-logo.mjs` writes the same bytes for all seven variants, so running it once
is enough. If `logo.png` (the source) is replaced with artwork with different
padding, rerun it and copy `variants/favicon-default.ico`, `apple-touch-default.png`,
`icon-default-512.png` and `logo-default.png` up into `favicon/` – they are no
longer swapped by `pick.mjs`.

`build-og.mjs` writes the SVG and the PNG side by side in `variants/` and drops a
`_contact-sheet.png` here, which is the fastest way to eyeball a change across
every season at once.

## Embed art construction

The OG art fills the whole 1200x630 canvas. There is no frame and no rounded
border: an inner stroke made Discord show a picture inside a picture, and the
seasonal art is meant to reach the edges, not sit in a box inside them. The
supporting glyphs live in four named slots (`SLOTS` in `build-og.mjs`) rather
than hand-placed coordinates, so a new season picks slots instead of doing
arithmetic. One of the slots, `bleed`, is deliberately positioned off-canvas and
is cropped by the canvas edge, which is what stops the corners reading as empty.

The seasonal emblem perches on the left shoulder of the wordmark: its foot lands
on the cap line and it hangs over the space to the left of the S. It is painted
*before* the wordmark, so if the two overlap it is the glyph that gets covered,
never the letter. The layout numbers in `LAYOUT` are the single source of truth –
wordmark metrics were measured (150 px Segoe UI 900 gives a 685 px advance and a
107 px cap height), so the S starts at x 257 and the caps top out at y 359. If
the wordmark size changes, re-measure and update `word.width` and `word.capTop`,
and check the contact sheet.

## Icon construction

The icon is the mark on transparency and nothing else: no tile, no glow, no
hairline border, no seasonal emblem, no seasonal tint. Anything behind the mark
made the 16 px entry illegible and tinted the browser tab, which is not what a
favicon is for.

`logo.png` – the source – carries transparent padding on all four sides, which
left the mark filling only ~77% of the canvas and reading as small. The builder
decodes the source alpha channel, finds the tightest box around the ink, widens
it to a square and uses that as the SVG viewBox. So the mark touches the top and
bottom edges of the icon, and the leftover margin lands on the left and right,
where the mark is naturally narrower. No resampling: the image is placed at its
own pixel size and only the viewport is smaller.

`favicon.ico` is a real multi-size icon: 16, 32 and 48 px, each rendered
separately rather than downscaled, with PNG-compressed entries, which every browser
worth supporting reads. `build-logo.mjs` writes the ICO itself (`ICONDIR` plus a
directory entry per size) so the build needs no image library.

`icon.png` (512) is what the pages render in the topbar and footer, so the mark is
drawn from a large render rather than upscaled out of the 48 px ICO entry.

## Adding a season

Only the OG art is seasonal now.

1. Download the emoji you want from
   [twemoji](https://github.com/jdecked/twemoji/tree/main/assets/svg) into `emoji/`,
   named `<codepoint>.svg`.
2. Add an entry to `SEASONS` in `build-og.mjs` with the emblem, marks and accent
   colours. `build-logo.mjs` has a plain list of the seven ids and nothing else –
   the mark does not change per season, so there is nothing to configure there.
3. Add the window to `WINDOWS` in `season.mjs`.
4. Run `build-og.mjs` and check the contact sheet. Narrow windows go above wide
   ones, first match wins.

## Artwork licence

The emoji are [Twemoji](https://github.com/jdecked/twemoji) by Twitter, Inc,
licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). Everything
else here is original to the project.