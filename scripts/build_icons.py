"""Generate brand assets from theme.css and the claw geometry in Logo.tsx.

Outputs packages/ui/brand/* and copies favicons into each app's public/ folder.
Requires: fonttools, brotli, uharfbuzz, playwright (chromium).
"""

import asyncio
import io
import re
import shutil
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
UI = ROOT / "packages" / "ui"
OUT = UI / "brand"


def read_tokens():
    css = (UI / "theme.css").read_text()
    blocks = {}
    for name, sel in (("dark", r":root\s*\{"), ("light", r'\[data-theme="light"\]\s*\{')):
        m = re.search(sel + r"(.*?)\n\}", css, re.S)
        blocks[name] = dict(re.findall(r"(--[\w-]+):\s*([^;]+);", m.group(1)))
    light = {**blocks["dark"], **blocks["light"]}

    def resolve(table, key):
        v = table[key].strip()
        while v.startswith("var("):
            v = table[v[4:-1].strip()].strip()
        return v

    keys = ["--logo-from", "--logo-to", "--primary", "--premium", "--logo-tile", "--logo-edge", "--text-header", "--bg-panel", "--border-hover", "--chrome-bg", "--chrome-text"]
    return {k: resolve(blocks["dark"], k) for k in keys}, {k: resolve(light, k) for k in keys}


def claw_paths():
    tsx = (UI / "components" / "Logo.tsx").read_text()
    block = re.search(r"CLAW_PATHS = \[(.*?)\];", tsx, re.S).group(1)
    return re.findall(r'"([^"]+)"', block)


def mark_svg(t, size=32, tile=True, full_bleed=False, inset=0.0):
    paths = claw_paths()
    grad = (
        '<defs><linearGradient id="g" x1="26" y1="5" x2="6" y2="27" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{t["--logo-from"]}"/><stop offset="1" stop-color="{t["--logo-to"]}"/></linearGradient></defs>'
    )
    if full_bleed:
        bg = f'<rect width="32" height="32" fill="{t["--logo-tile"]}"/>'
    elif tile:
        bg = f'<rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="{t["--logo-tile"]}" stroke="{t["--logo-edge"]}"/>'
    else:
        bg = ""
    body = "".join(f'<path d="{d}" fill="url(#g)"/>' for d in paths)
    if inset:
        s = 1 - 2 * inset
        o = 32 * inset
        body = f'<g transform="translate({o} {o}) scale({s})">{body}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 32 32">{grad}{bg}{body}</svg>'


def wordmark_paths(text="Rootpanther", size=30.0, tracking=-0.025):
    font_bytes = (UI / "fonts" / "Geist-Variable.woff2").read_bytes()
    font = TTFont(io.BytesIO(font_bytes))
    font = instancer.instantiateVariableFont(font, {"wght": 600})
    buf = io.BytesIO()
    font.flavor = None
    font.save(buf)
    data = buf.getvalue()
    upem = font["head"].unitsPerEm
    face = hb.Face(data)
    hbfont = hb.Font(face)
    hbuf = hb.Buffer()
    hbuf.add_str(text)
    hbuf.guess_segment_properties()
    hb.shape(hbfont, hbuf, {"kern": True, "liga": True})
    gs = font.getGlyphSet()
    order = font.getGlyphOrder()
    scale = size / upem
    x = 0.0
    out = []
    for info, pos in zip(hbuf.glyph_infos, hbuf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, 0))
        gs[name].draw(tp)
        out.append(pen.getCommands())
        x += pos.x_advance * scale + tracking * size
    ascent = font["hhea"].ascent * scale
    return " ".join(out), x - tracking * size, ascent


def lockup_svg(t, word_fill):
    d, width, _ = wordmark_paths()
    mark = 40
    gap = 14
    cap = 30 * 0.7
    h = mark
    baseline = h / 2 + cap / 2
    total = mark + gap + width
    paths = claw_paths()
    claw = "".join(f'<path d="{p}" fill="url(#g)"/>' for p in paths)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total:.0f}" height="{h}" viewBox="0 0 {total:.1f} {h}">'
        '<defs><linearGradient id="g" x1="26" y1="5" x2="6" y2="27" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{t["--logo-from"]}"/><stop offset="1" stop-color="{t["--logo-to"]}"/></linearGradient></defs>'
        f'<g transform="scale({mark / 32})"><rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="{t["--logo-tile"]}" stroke="{t["--logo-edge"]}"/>{claw}</g>'
        f'<path transform="translate({mark + gap} {baseline:.2f})" d="{d}" fill="{word_fill}"/>'
        "</svg>"
    )


async def rasterise(jobs):
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page()
        for svg, size, dest in jobs:
            await pg.set_viewport_size({"width": size, "height": size})
            html = f'<html><body style="margin:0;background:transparent">{svg}</body></html>'
            await pg.set_content(html)
            await pg.screenshot(path=str(dest), omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size})
        await b.close()


def main():
    dark, light = read_tokens()
    light_tab = {**light, "--logo-tile": light["--bg-panel"], "--logo-edge": light["--border-hover"], "--logo-from": light["--primary"], "--logo-to": light["--premium"]}
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    files = {
        "mark-dark.svg": mark_svg(dark),
        "mark-light.svg": mark_svg(light),
        "mark-bare-dark.svg": mark_svg(dark, tile=False),
        "mark-bare-light.svg": mark_svg(light, tile=False),
        "favicon.svg": mark_svg(dark),
        "favicon-light.svg": mark_svg(light_tab),
        "lockup-dark.svg": lockup_svg(dark, dark["--text-header"]),
        "lockup-light.svg": lockup_svg(light, light["--text-header"]),
        "lockup-on-navy.svg": lockup_svg(light, light["--chrome-text"]),
        "app-icon.svg": mark_svg(dark, full_bleed=True, inset=0.08),
    }
    for name, svg in files.items():
        (OUT / name).write_text(svg)
    jobs = []
    for variant, t in (("dark", dark), ("light", light_tab)):
        for size in (16, 32, 180, 512):
            jobs.append((mark_svg(t, size=size), size, OUT / f"favicon-{variant}-{size}.png"))
    jobs.append((mark_svg(dark, size=1024, full_bleed=True, inset=0.08), 1024, OUT / "app-icon-1024.png"))
    jobs.append((mark_svg(dark, size=512, full_bleed=True, inset=0.08), 512, OUT / "app-icon-512.png"))
    asyncio.run(rasterise(jobs))
    for app in ("app", "portal"):
        pub = ROOT / "apps" / app / "public"
        pub.mkdir(parents=True, exist_ok=True)
        shutil.copy(OUT / "favicon.svg", pub / "favicon.svg")
        shutil.copy(OUT / "favicon-light.svg", pub / "favicon-light.svg")
        shutil.copy(OUT / "favicon-dark-32.png", pub / "favicon-32.png")
        shutil.copy(OUT / "favicon-dark-180.png", pub / "apple-touch-icon.png")
        shutil.copy(OUT / "favicon-dark-512.png", pub / "icon-512.png")
    print(f"wrote {len(list(OUT.iterdir()))} files to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
