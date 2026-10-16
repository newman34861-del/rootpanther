"""Capture every screen in both apps for visual review and build contact sheets.

Usage: python3 scripts/capture_screens.py OUT_DIR [--only app|portal] [--sheet-cols 3]
Defaults to the dev servers (5173 learner app, 5174 portal); pass --app-base and
--portal-base to point at preview builds instead.
"""

import argparse
import asyncio
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

APP = "http://127.0.0.1:5173"
PORTAL = "http://127.0.0.1:5174"

LEARNER = [
    ("home", "/"),
    ("home-none", "/", {"lab": "none"}),
    ("home-new", "/", {"user": "new"}),
    ("catalogue", "/catalogue"),
    ("catalogue-filtered", "/catalogue?tier=C2&technique=kerberoasting"),
    ("scenario", "/catalogue/meridian"),
    ("path", "/path"),
    ("labs", "/labs"),
    ("labs-none", "/labs", {"lab": "none"}),
    ("reports", "/reports"),
    ("report-builder", "/reports/rep-basalt"),
    ("debrief", "/reports/debriefs/deb-basalt"),
    ("onyx", "/onyx"),
    ("onyx-primers", "/onyx/primers"),
    ("onyx-drills", "/onyx/drills"),
    ("onyx-playbooks", "/onyx/playbooks"),
    ("onyx-history", "/onyx/history"),
    ("profile", "/account/profile"),
    ("settings-preferences", "/settings/preferences"),
    ("settings-security", "/settings/security"),
    ("settings-lab", "/settings/lab-defaults"),
    ("billing", "/billing"),
    ("payment-failed", "/billing/payment-failed"),
    ("pricing", "/pricing"),
    ("checkout", "/checkout?plan=practitioner&interval=month&mode=elements"),
    ("checkout-hosted", "/checkout?plan=practitioner&interval=month&mode=hosted"),
    ("checkout-success", "/checkout/success"),
    ("checkout-cancelled", "/checkout/cancelled"),
    ("checkout-processing", "/checkout/processing"),
    ("signin", "/signin"),
    ("signup", "/signup"),
    ("verify", "/verify"),
    ("reset", "/reset"),
    ("reset-new", "/reset/new"),
    ("2fa", "/2fa"),
    ("onboarding", "/onboarding?step=1"),
    ("onboarding-3", "/onboarding?step=3"),
    ("lab", "/lab/ses_4QmX9a"),
]

PORTAL_ROUTES = [
    ("p-signin", "/signin"),
    ("p-overview", "/"),
    ("p-users", "/users"),
    ("p-user", "/users/usr_7Hk2pQ"),
    ("p-billing", "/billing"),
    ("p-fleet", "/fleet"),
    ("p-content", "/content"),
    ("p-onyx", "/onyx"),
    ("p-finance", "/finance"),
    ("p-system", "/system"),
]


async def shoot(ctx_args, base, key, items, out, width, height, theme, state=None, full=True):
    results = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for item in items:
            name, path = item[0], item[1]
            flags = item[2] if len(item) > 2 else {}
            ctx = await b.new_context(viewport={"width": width, "height": height})
            init = f"localStorage.setItem({json.dumps(key)}, {json.dumps(json.dumps(theme))});"
            if flags:
                init += f"localStorage.setItem('rp-review', {json.dumps(json.dumps(flags))});"
            await ctx.add_init_script(init)
            pg = await ctx.new_page()
            errors = []
            pg.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
            pg.on("console", lambda m, errors=errors: errors.append(m.text) if m.type == "error" else None)
            url = base + path
            if state:
                url += ("&" if "?" in url else "?") + f"state={state}"
            try:
                await pg.goto(url, wait_until="networkidle", timeout=30000)
                await pg.evaluate("document.fonts.ready")
                await pg.wait_for_timeout(900 if name == "lab" else 400)
                overflow = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                dest = out / f"{name}-{theme}-{width}{'-' + state if state else ''}.png"
                await pg.screenshot(path=str(dest), full_page=full)
                results.append((dest, overflow, errors))
            except Exception as e:
                results.append((None, 0, [f"capture failed: {e}"]))
            await ctx.close()
        await b.close()
    return results


def sheet(paths, dest, cols=3, thumb_w=460):
    imgs = [Image.open(p) for p in paths]
    thumbs = []
    for im in imgs:
        ratio = thumb_w / im.width
        h = min(int(im.height * ratio), 900)
        t = im.resize((thumb_w, int(im.height * ratio))).crop((0, 0, thumb_w, h))
        thumbs.append(t)
    rows = [thumbs[i : i + cols] for i in range(0, len(thumbs), cols)]
    label_h = 22
    H = sum(max(t.height for t in r) + label_h + 10 for r in rows)
    W = cols * (thumb_w + 10) + 10
    canvas = Image.new("RGB", (W, H), (128, 128, 128))
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    y = 0
    k = 0
    for r in rows:
        x = 10
        for t in r:
            d.text((x, y + 4), Path(paths[k]).stem, fill=(0, 0, 0), font=font)
            canvas.paste(t, (x, y + label_h))
            x += thumb_w + 10
            k += 1
        y += max(t.height for t in r) + label_h + 10
    canvas.save(dest)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--only", default=None)
    ap.add_argument("--names", default=None, help="comma list of route names")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--theme", default="dark")
    ap.add_argument("--state", default=None)
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--viewport-only", action="store_true")
    ap.add_argument("--app-base", default=APP)
    ap.add_argument("--portal-base", default=PORTAL)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    jobs = []
    if a.only in (None, "app"):
        jobs.append((a.app_base, "rp-theme", LEARNER))
    if a.only in (None, "portal"):
        jobs.append((a.portal_base, "rp-portal-theme", PORTAL_ROUTES))
    shots = []
    for base, key, items in jobs:
        if a.names:
            wanted = a.names.split(",")
            items = [i for i in items if i[0] in wanted]
        res = await shoot(None, base, key, items, out, a.width, a.height, a.theme, a.state, full=not a.viewport_only)
        for dest, overflow, errors in res:
            flag = f" OVERFLOW {overflow}px" if overflow > 0 else ""
            errs = [e for e in errors if "Future Flag" not in e]
            print(f"{dest.name if dest else '?'}{flag}" + (f" ERRORS: {errs[:3]}" if errs else ""))
            if dest:
                shots.append(dest)
    if shots:
        tag = f"{a.theme}-{a.width}{'-' + a.state if a.state else ''}"
        for i in range(0, len(shots), 9):
            sheet(shots[i : i + 9], out / f"_sheet-{tag}-{i // 9 + 1}.png", cols=a.cols)


asyncio.run(main())
