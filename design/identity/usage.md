# MASHINA Fold M

Selected by the owner on 26 October 2026 after reviewing three vector directions.
Soft shoulders and a precise central fold preserve the M in the calm Dusk system.
This supersedes the earlier green Apex identity.

## Artwork and color

Use `masters/mashina-horizontal.svg` on slate and
`masters/mashina-horizontal-light.svg` on bone. Symbol, wordmark and stacked
masters contain outlined paths with no font, raster, filter or gradient dependency.

| Role | HEX | RGB | Approximate CMYK |
|---|---|---|---|
| Periwinkle mark | `#B9B5F4` | 185, 181, 244 | 24, 26, 0, 4 |
| Slate background | `#11141C` | 17, 20, 28 | 39, 29, 0, 89 |
| Bone background | `#F1EEEB` | 241, 238, 235 | 0, 1, 2, 5 |
| Daytime ink | `#292C3C` | 41, 44, 60 | 32, 27, 0, 76 |

The dark wordmark uses warm off-white `#F3F0ED`. Screen RGB is authoritative;
CMYK is approximate, with no Pantone or print-proof match claimed. Use ink on
pale surfaces: periwinkle alone lacks contrast for a small functional symbol on
bone. Black/white exports support single-color reproduction. Keep the logo flat;
glass belongs to the interface.

## Space and size

Keep clear space of one stem width (40/256 of the symbol canvas). Use the symbol
from 16px and horizontal lockup from 120px. Favicon artwork has a slate tile and
larger optical scale. App icons use a 68% drawing; maskable artwork stays inside
the central safe area at 50% canvas width. Preserve exported proportions and
spacing. Avoid stretching, rotation, outlines, glow, bevels and busy photography.

## Files and rebuilding

`exports/` includes black/white/periwinkle/ink SVGs, dark/light README headers,
16/32/48px favicon PNGs and ICO, 180px Apple icon, 192/512px PWA icons and 512px
maskable icon. The app and site use local copies.

Run `python tools/build_brand.py` to rebuild SVGs. Add `--web-icons` for PNG/ICO
through installed Chromium; use `CHROME_PATH` or `--chrome` if needed. No network,
fonttools installation or production dependency is required.
`wordmark-geometry.json` preserves the licensed Manrope outlines;
[Manrope's SIL OFL](../../backend/assets/fonts/OFL.txt) applies.

Earlier `concepts/` files and exports explicitly named `c1ee79` are historical,
not active artwork. The three Dusk proposals remain in `dusk-concepts/`.
Symbols were inspected at 16/24px and in monochrome/reversed views. SVG audit is
heuristic, not trademark clearance; no registration or endorsement is claimed.
