# Seasonal brand assets

One thing follows the calendar: the **icon**. The brain mark picks up an
accessory for each season, and the same id is used everywhere:

| Variant     | Accessory   | Window (UTC)                  |
|-------------|-------------|-------------------------------|
| `default`   | none        | everything not listed below   |
| `christmas` | Santa hat   | 1 Dec – 6 Jan                 |
| `easter`    | bunny ears  | Easter − 9 days → Easter + 16 |
| `summer`    | sunglasses  | 21 Jun – 31 Aug               |
| `halloween` | witch hat   | 1 Oct – 5 Nov                 |

The Discord embed art (`favicon/og-image.png`) is **not** seasonal. It is one
card all year, built from `variants/og-default.*`.

Where the season is used:

- **Website** – `pick.mjs`, daily from `.github/workflows/seasonal-brand.yml`,
  copies the season's renders over the live icon files and stamps `?v=` on the
  icon links.
- **Discord server icon** – the bot (`Sheldon-Api/Api/src/managers/season/`)
  checks hourly and calls `guild.setIcon` only when the season flips. It uses
  `variants/discord-<season>.png`, copied to `Api/src/managers/season/icons/`.
- **Sheldon overlay + Loader** – all variants are embedded in the binaries; they
  ask `GET /season` once at startup and pick the matching one, falling back to
  `default` offline.

`season.mjs` and `Api/src/managers/season/season.js` hold the same windows. Change
both together.

## What gets swapped on the site

| Live file                      | Source in `variants/`      |
|--------------------------------|----------------------------|
| `favicon/favicon.ico`          | `favicon-<season>.ico`     |
| `favicon/apple-touch-icon.png` | `apple-touch-<season>.png` |
| `favicon/icon.png`             | `icon-<season>-512.png`    |
| `favicon/logo.png`             | `logo-<season>.png`        |

Browsers cache a favicon by URL well past its HTTP lifetime, so every
`rel="icon"` / `rel="apple-touch-icon"` link is stamped
`?v=<season>-<year>r<rev>`. Bump `ART_REV` in `pick.mjs` if the art is redrawn
inside a season.

## Files

    build-logo.mjs   renders every icon variant (the props live in PROPS)
    build-og.mjs     renders the OG card; only og-default is used
    season.mjs       date -> variant id, plus the Easter calculation
    pick.mjs         swaps the site icon and stamps the HTML
    variants/        the rendered assets
    logo.png         the bare Sheldon mark, the source for every icon

## Regenerating by hand

Needs Node and a Chromium build. The rasterisers look for the headless shell in the
local Playwright cache (`%LOCALAPPDATA%\ms-playwright`).

    node favicon/seasonal/build-logo.mjs                 # all icon variants
    node favicon/seasonal/build-logo.mjs --only=summer   # one variant
    node favicon/seasonal/build-og.mjs --only=default    # the embed card
    node favicon/seasonal/pick.mjs --dry                 # what today would change
    node favicon/seasonal/pick.mjs --date=2026-12-25     # stage a specific day

After changing an icon, also copy `variants/discord-<season>.png` to
`Sheldon-Api/Api/src/managers/season/icons/icon-<season>.png`, and regenerate the
embedded headers in the Sheldon repo.

## Icon construction

The props are plain SVG in `PROPS` in `build-logo.mjs`, drawn on a 512 canvas in
the mark's own style: flat fills, a 12px `#1c1c1c` outline. Hats need room on
top, so for those seasons the mark is shrunk to 392px and pushed down; the
sunglasses sit on the full-size mark. `discord-*` renders add 48 units of padding
on every side so Discord's circular crop never clips a hat brim or a pompom.

`favicon.ico` holds 16, 32 and 48 px entries, each rendered separately rather than
downscaled, with PNG-compressed entries.

## Artwork licence

The OG card's emoji are [Twemoji](https://github.com/jdecked/twemoji) by Twitter,
Inc, licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Everything else here is original to the project.
