"""Build single-file previews of both apps for hosting as static pages.

Usage: python3 scripts/build_preview.py OUT_DIR [--app-url URL] [--portal-url URL]
Writes OUT_DIR/rootpanther-app.html and OUT_DIR/rootpanther-portal.html as page
fragments (no doctype, html, head or body wrappers) with all JS, CSS and fonts inlined.
"""

import argparse
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build(app: str, out: Path, env_extra: dict) -> Path:
    dist = out / f"dist-{app}"
    env = {
        **os.environ,
        "VITE_SINGLE": "1",
        "VITE_ROUTER": "memory",
        "VITE_BASE": "./",
        "VITE_OUT_DIR": str(dist),
        **env_extra,
    }
    subprocess.run(["npx", "vite", "build", "--emptyOutDir", "--logLevel", "warn"], cwd=ROOT / "apps" / app, env=env, check=True)
    return dist


def fragment(dist: Path, title: str) -> str:
    html = (dist / "index.html").read_text()
    js_src = re.search(r'<script type="module" crossorigin src="\./(assets/[^"]+\.js)"></script>', html).group(1)
    css_href = re.search(r'<link rel="stylesheet" crossorigin href="\./(assets/[^"]+\.css)">', html).group(1)
    theme = re.search(r"<script>\s*(try \{.*?\} catch \(e\) \{\})\s*</script>", html, re.S).group(1)
    js = (dist / js_src).read_text().replace("</script", "<\\/script")
    css = (dist / css_href).read_text().replace("</style", "<\\/style")
    return "\n".join(
        [
            f"<title>{title}</title>",
            f"<style>{css}</style>",
            f"<script>{theme}</script>",
            '<div id="root"></div>',
            f'<script type="module">{js}</script>',
            "",
        ]
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--app-url", default="https://app.rootpanther.com")
    ap.add_argument("--portal-url", default="https://portal.rootpanther.com")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    targets = [("app", "Rootpanther Learner App", {"VITE_PORTAL_URL": a.portal_url}), ("portal", "Rootpanther Portal", {"VITE_APP_URL": a.app_url})]
    for app, title, env in targets:
        dist = build(app, out, env)
        page = out / f"rootpanther-{app}.html"
        page.write_text(fragment(dist, title))
        print(f"{page} {page.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
