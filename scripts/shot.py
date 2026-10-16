import argparse, asyncio, json
from playwright.async_api import async_playwright

p = argparse.ArgumentParser(description="Screenshot a page for visual review")
p.add_argument("url")
p.add_argument("out")
p.add_argument("--width", type=int, default=1440)
p.add_argument("--height", type=int, default=900)
p.add_argument("--theme", default="dark")
p.add_argument("--full", action="store_true")
p.add_argument("--storage-key", default="rp-theme")
p.add_argument("--click", action="append", default=[], help="CSS selector to click before the shot")
p.add_argument("--press", action="append", default=[], help="Keys to press before the shot")
p.add_argument("--wait", type=int, default=500)
p.add_argument("--reduced-motion", action="store_true")
p.add_argument("--review", default=None, help="JSON for rp-review flags")
a = p.parse_args()

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        ctx = await b.new_context(viewport={"width": a.width, "height": a.height}, device_scale_factor=1, reduced_motion="reduce" if a.reduced_motion else "no-preference")
        init = f"localStorage.setItem({json.dumps(a.storage_key)}, {json.dumps(json.dumps(a.theme))});"
        if a.review:
            init += f"localStorage.setItem('rp-review', {json.dumps(a.review)});"
        await ctx.add_init_script(init)
        pg = await ctx.new_page()
        errors = []
        pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        await pg.goto(a.url, wait_until="networkidle")
        await pg.evaluate("document.fonts.ready")
        for sel in a.click:
            await pg.click(sel)
            await pg.wait_for_timeout(250)
        for k in a.press:
            await pg.keyboard.press(k)
            await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(a.wait)
        await pg.screenshot(path=a.out, full_page=a.full)
        for e in errors:
            print(e)
        await b.close()

asyncio.run(main())
