#!/usr/bin/env python3
"""Build the Cornerpin app.

  python3 build.py                                  -> public/index.html (hosted: calls /api on the same domain)
  python3 build.py --api https://your-app.vercel.app -> also dist/Cornerpin.html (one file to email; calls that API)

Inlines web/home.html, web/styles.css, the in-browser engine (web/lotreport.js), the plan-PDF reader
(web/planreader.js), the UI (web/app.js) and the generic cost assumptions. Refuses to write output that contains
project-specific strings or embedded images.
"""
import argparse
import json
import os
import subprocess

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
    css = read(WEB, "styles.css") + '\n' + read(WEB, "project-workspace.css")
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
    <span class="wordmark"><!--CORNERPIN_WORDMARK--></span>
    <div class="acts">
      <a class="btn ghost only-live" href="#packet">Permit filing</a>
      <button class="btn ghost only-live" id="rv-workflow" type="button">Project overview</button>
      <button class="btn ghost only-live" id="rv-plan" type="button">Add building plans</button>
      <button class="btn ghost" id="rv-print" type="button" data-print>Print</button>
      <button class="btn ghost only-live" id="rv-save" type="button">Download site report</button>
      <button class="btn only-live" id="rv-new" type="button">Review another property</button>
    </div>
  </nav>
  <div id="rv-body"></div>
</div>
"""
    # Version the API calls by the server code, so a deploy never serves results cached by an older version.
    import hashlib
    h = hashlib.sha1()
    for d in ("api", "lib"):
        for f in sorted(os.listdir(os.path.join(ROOT, d))):
            with open(os.path.join(ROOT, d, f), "rb") as fh:
                h.update(fh.read())
    h.update(read(WEB, "plat-evidence.js").encode())
    with open(os.path.join(ROOT, "config", "records.json")) as fh:
        records = {k: v for k, v in json.load(fh).items() if not k.startswith("_")}
    data = {"costs": costs, "apiBase": api_base, "apiVersion": h.hexdigest()[:10], "records": records}
    sales = json.loads(read(ROOT, "docs", "research", "backtest", "weber", "sales.json"))
    results = json.loads(read(ROOT, "docs", "research", "backtest", "weber", "development-v2.json"))
    data["weberValue"] = {"records": sales["records"], "metrics": {k: results[k]["metrics"] for k in ("rollingDevelopment", "flaggedTransactionSensitivity")}}
    sdk = subprocess.check_output(["node", "scripts/bundle-auth.js"], cwd=ROOT, text=True)
    scripts = "\n".join([
        "<script>" + sdk.replace("</script", "<\\/script") + "</script>",
        '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>',
        "<script>window.LR_DATA = " + json.dumps(data).replace("</", "<\\/") + ";</script>",
        "<script>\n" + read(ROOT, "node_modules", "@turf", "turf", "turf.min.js") + "\n</script>",
        "<script>\n" + read(ROOT, "node_modules", "proj4", "dist", "proj4.js") + "\n</script>",
        "<script>\n" + read(WEB, "survey-registration.js") + "\n" + read(WEB, "survey-alignment.js") + "\n" + read(WEB, "mineral-chain.js") + "\n" + read(WEB, "placement-engine.js") + "\n</script>",
        "<script>\n" + read(WEB, "land-value.js") + "\n</script>",
        "<script>\n" + read(WEB, "weber-value.js") + "\n</script>",
        "<script>\n" + read(WEB, "plat-evidence.js") + "\n</script>",
        "<script>\n" + read(WEB, "pool-screen.js") + "\n</script>",
        "<script>\n" + read(WEB, "mineral-screen.js") + "\n</script>",
        "<script>\n" + read(WEB, "lotreport.js") + "\n</script>",
        "<script>\n" + read(WEB, "planreader.js") + "\n</script>",
        "<script>\n" + read(WEB, "app.js") + "\n</script>",
        "<script>\n" + read(WEB, "report-categories.js") + "\n</script>",
        "<script>\n" + read(WEB, "evidence-ledger.js") + "\n" + read(WEB, "permit-workflow.js") + "\n</script>",
        "<script>\n" + read(WEB, "project-backup.js") + "\n" + read(WEB, "project-store.js") + "\n</script>",
        "<script>\n" + read(WEB, "cloud-sync.js") + "\n" + read(WEB, "account.js") + "\n" + read(WEB, "research-workspace.js") + "\n" + read(WEB, "project-workspace.js") + "\n</script>",
    ])
    html = html.replace("</body>", report_view + read(WEB, "planform.html") + scripts + "\n</body>", 1)
    wordmark = read(ROOT, "public", "assets", "cornerpin-wordmark.svg")
    wordmark = wordmark.replace('<svg ', '<svg class="cornerpin-wordmark" role="img" aria-label="Cornerpin" ', 1).replace('fill="#f5f4ee"', 'fill="currentColor"').replace('stroke="#f5f4ee"', 'stroke="currentColor"')
    # Inline the generated outlines so emailed HTML and saved reports carry their own logo.
    html = html.replace("<!--CORNERPIN_WORDMARK-->", wordmark)
    import base64
    favicon = base64.b64encode(read(ROOT, "public", "assets", "cornerpin-favicon.svg").encode()).decode()
    html = html.replace('</head>', '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + favicon + '">\n</head>', 1)
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
        write(os.path.join(ROOT, "dist", "Cornerpin.html"), build(a.api.rstrip("/"), inline_assets=True))
