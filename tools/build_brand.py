"""Rebuild outlined MASHINA masters (development tool: pip install fonttools).

Manrope is licensed under SIL OFL; the existing local font/OFL lives in backend/assets/fonts.
Logo concept Apex M selected by the owner on 2026-10-12.
"""

from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "design/identity/masters"
OUT.mkdir(parents=True, exist_ok=True)
MARK = "M32 216V40h32l64 64 64-64h32v176h-40V104l-56 56-56-56v112Z"
font = TTFont(ROOT / "backend/assets/fonts/Manrope-Bold.ttf")
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
bounds = BoundsPen(glyphs)
glyphs[cmap[ord("H")]].draw(bounds)
scale = 96 / bounds.bounds[3]


def letters(origin, baseline):
    paths, x = [], origin
    for char in "MASHINA":
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        paths.append(f'<path d="{pen.getCommands()}"/>')
        x += font["hmtx"][name][0] * scale + 5
    return "".join(paths), round(x - 5)


def svg(body, width, height, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title"><title id="title">{title}</title><g fill="#c1ee79">{body}</g></svg>\n'


word, width = letters(0, 112)
(OUT / "mashina-wordmark.svg").write_text(svg(word, width, 128, "MASHINA wordmark"))
(OUT / "mashina-symbol.svg").write_text(svg(f'<path d="{MARK}"/>', 256, 256, "MASHINA Apex M"))
horizontal, right = letters(300, 176)
(OUT / "mashina-horizontal.svg").write_text(
    svg(f'<path d="{MARK}"/>{horizontal}', right + 24, 256, "MASHINA horizontal logo")
)
exports = ROOT / "design/identity/exports"
exports.mkdir(parents=True, exist_ok=True)
(exports / "mashina-header.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {right + 88} 320" '
    'role="img" aria-label="MASHINA"><rect width="100%" height="100%" rx="32" '
    'fill="#101211"/><g transform="translate(32 32)" fill="#c1ee79">'
    f'<path d="{MARK}"/>{horizontal}</g></svg>\n'
)
stacked, width = letters(0, 384)
(OUT / "mashina-stacked.svg").write_text(
    svg(
        f'<g transform="translate({(width - 256) / 2},0)"><path d="{MARK}"/></g>{stacked}',
        width,
        408,
        "MASHINA stacked logo",
    )
)
print("Four outlined masters generated from local licensed font.")
