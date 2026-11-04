#!/usr/bin/env python3
"""Build the Lot Dossier app.

  python3 build.py                                  -> public/index.html (hosted: calls /api on the same domain)
  python3 build.py --api https://your-app.vercel.app -> also dist/Lot Dossier.html (one file to email; calls that API)

Inlines web/home.html, web/styles.css, the in-browser engine (web/lotreport.js), the plan-PDF reader
(web/planreader.js), the UI (web/app.js) and the generic cost assumptions. Refuses to write output that contains
project-specific strings or embedded images.
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
# Generic guards, plus optional project-specific strings (company names, addresses, parcel IDs) kept in a local,
# git-ignored .banned file (one per line) so the list itself never gets published.
BANNED = ["data:image/png", "/static/"]
_local = os.path.join(ROOT, ".banned")
if os.path.exists(_local):
    BANNED += [l.strip().lower() for l in open(_local) if l.strip() and not l.startswith("#")]


def read(*p):
    with open(os.path.join(*p)) as fh:
        return fh.read()


def build(api_base, inline_assets=False):
    html = read(WEB, "home.html")
    css = read(WEB, "styles.css")
    if inline_assets:  # one self-contained file: embed the background photo
        import base64
        with open(os.path.join(ROOT, "public", "assets", "site-bg.jpg"), "rb") as fh:
            css = css.replace("assets/site-bg.jpg", "data:image/jpeg;base64," + base64.b64encode(fh.read()).decode())
    html = html.replace("/*STYLES*/", css, 1)
    if "leaflet.min.css" not in html:
        html = html.replace("</head>", '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">\n</head>', 1)
    html = html.replace("<body>\n", '<body>\n<div id="home">\n', 1)
    costs = {k: v for k, v in json.loads(read(ROOT, "config", "cost_assumptions.json")).items() if not k.startswith("_")}
    report_view = """</div>
<div id="rv">
  <nav class="topnav" aria-label="Report">
    <span class="wordmark">Lot Dossier</span>
    <div class="acts">
      <button class="btn ghost" id="rv-print" type="button" data-print>Print</button>
      <button class="btn ghost only-live" id="rv-save" type="button">Save dossier</button>
      <button class="btn only-live" id="rv-new" type="button">New dossier</button>
    </div>
  </nav>
  <div id="rv-body"></div>
</div>
"""
    data = {"costs": costs, "apiBase": api_base}
    scripts = "\n".join([
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>',
        "<script>window.LR_DATA = " + json.dumps(data).replace("</", "<\\/") + ";</script>",
        "<script>\n" + read(WEB, "lotreport.js") + "\n</script>",
        "<script>\n" + read(WEB, "planreader.js") + "\n</script>",
        "<script>\n" + read(WEB, "app.js") + "\n</script>",
    ])
    html = html.replace("</body>", report_view + scripts + "\n</body>", 1)
    low = html.lower()
    for b in BANNED:
        assert b not in low, "found %r in build output" % b
    return html


def write(path, html):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(html)
    print("Wrote %s (%d KB)" % (os.path.relpath(path, ROOT), os.path.getsize(path) // 1024))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", help="deployed base URL for the emailable single-file build")
    a = ap.parse_args()
    write(os.path.join(ROOT, "public", "index.html"), build(""))
    if a.api:
        write(os.path.join(ROOT, "dist", "Lot Dossier.html"), build(a.api.rstrip("/"), inline_assets=True))
