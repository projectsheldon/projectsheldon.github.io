# Seasonal OG image

`favicon/og-image.png` is what every page on the site advertises as its Open Graph
image, which is the picture Discord, Slack and WhatsApp show when someone drops a
Project Sheldon link.

That image now has seven variants and follows the calendar.

| Variant    | Shows          | Window                        |
|------------|----------------|-------------------------------|
| `default`  | no seasonal art | everything not listed below  |
| `newyear`  | party popper   | 26 Dec – 6 Jan                |
| `valentine`| heart + rose   | 7 – 15 Feb                    |
| `april`    | clown + dice   | 1 – 2 Apr                     |
| `easter`   | egg + blossom  | Easter − 9 days → Easter + 16 |
| `halloween`| pumpkin + webs | 20 Oct – 5 Nov                |
| `christmas`| tree + gifts   | 15 Nov – 25 Dec               |

Easter is computed, not hardcoded, using the anonymous Gregorian algorithm.

## Why the URL has a query string

Discord caches an embed image by URL. Serve the right bytes at the same URL and an
embed that already exists still shows the old picture. So `pick.mjs` also stamps
`?v=<season>-<year>w<week>` on every `og:image` / `twitter:image` tag. Each season
flip hands Discord a URL it has never fetched, and the weekly component is a
safety net for windows that get retuned later.

The one thing this cannot fix: messages that were already posted keep the embed
they were created with. Only new posts pick up a change.

## Files

    build-og.mjs     renders a variant to SVG and rasterises it to 1200x630 PNG
    season.mjs       date -> variant id, plus the Easter calculation
    pick.mjs         copies the current variant into place and stamps the HTML
    variants/        the rendered PNGs
    emoji/           Twemoji vectors used by build-og.mjs
    logo.png         the Sheldon mark

## Regenerating by hand

Needs Node and a Chromium build. The rasteriser looks for the headless shell in
the local Playwright cache (`%LOCALAPPDATA%\ms-playwright`).

    node favicon/og/build-og.mjs                    # all variants
    node favicon/og/build-og.mjs --only=halloween   # one variant
    node favicon/og/pick.mjs --dry                  # show what today would change
    node favicon/og/pick.mjs --date=2026-12-25      # stage a specific day

`build-og.mjs` writes the SVG and the PNG side by side in `variants/`, and drops a
`_contact-sheet.png` in `favicon/og/`, which is the fastest way to eyeball a
change across every season at once.

## Adding a season

1. Download the emoji you want from
   [twemoji](https://github.com/jdecked/twemoji/tree/main/assets/svg) into `emoji/`,
   named `<codepoint>.svg`.
2. Add an entry to `SEASONS` in `build-og.mjs` with `emblem`, `marks` and the accent
   colours. Reuse an existing codepoint rather than adding near-duplicates.
3. Add the window to `WINDOWS` in `season.mjs`.
4. `node favicon/og/build-og.mjs` and check the contact sheet. Narrow windows go
   above wide ones, first match wins.

## Artwork licence

The emoji are [Twemoji](https://github.com/jdecked/twemoji) by Twitter, Inc,
licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). Everything
else here is original to the project.