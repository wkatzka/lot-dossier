"""Reproducible, explicitly post-selection Weber development report."""
import html
import json
from weber_backtest import OUT


def render(result):
    esc = html.escape
    money = lambda n: '${:,.0f}'.format(n)
    sections = []
    for key, label in [('frozenDevelopment', 'Same two final outcomes'),
                       ('rollingDevelopment', 'Expanding chronological window'),
                       ('flaggedTransactionSensitivity', 'Exclude atypical transaction remarks')]:
        b = result[key]
        rows = ''.join('<tr><td>{}</td><td>{}</td><td>{}</td></tr>'.format(
            name, f"{m['within50k']} / {m['n']}", money(m['mae'])) for name, m in
            [('Previous ridge', b['previousModel']), ('Adjusted comparables', b['metrics']),
             ('Acreage-rate baseline', b['acreageBaseline']), ('Median baseline', b['medianBaseline'])])
        predictions = ''.join('<tr><td>{}<br><small>{}</small></td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>'.format(
            esc(r['address']), r['saleDate'], money(r['actual']), money(r['estimate']), money(abs(r['error'])),
            'Yes' if r['within50k'] else 'No') for r in b['predictions'])
        sections.append(f'<h2>{label}</h2><table><tr><th>Method</th><th>Within ±$50k</th><th>Mean absolute error</th></tr>{rows}</table>'
                        f'<table><tr><th>Property</th><th>Reported sale</th><th>New estimate</th><th>Absolute error</th><th>Within target</th></tr>{predictions}</table>')
    r = result['frozenDevelopment']['predictions'][0]
    stability = r['deleteOneTrainingSensitivity']['range']
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cornerpin — Weber model development audit</title><style>
body{font:17px/1.6 system-ui;max-width:1150px;margin:40px auto;padding:0 24px;background:#101713;color:#f5f3ed}
h1,h2{line-height:1.2}a{color:#e7cba4}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:12px;text-align:left;border-bottom:1px solid #48514a}
.note{border-left:4px solid #ff7037;background:#253027;padding:20px}small{color:#c3c9c3}.scroll{overflow-x:auto}</style>
<h1>Weber land model: development audit</h1><p>Public-source research · November 7, 2026</p>
<p class="note"><b>Seven qualifying research transactions. Zero new independent test sales.</b>
The revised model was developed after examining these outcomes. Improved scores below are development diagnostics, not fresh validation or a demonstrated ±$50,000 accuracy claim.</p>
<h2>Why the original fit missed</h2><p>The five training sales mix 2019 Ogden Valley acreage with 2021 western-county lots.
The ridge model confounded time, geography and size, learned a negative time effect, and strongly compressed the acreage relationship.
It estimated the $475,000 tract at $292,733.</p>
<h2>What changed</h2><p>The new method estimates a log-area adjustment from pairs within the same submarket and property category,
then takes the median of size-adjusted local comparable prices. Its monotone, diminishing-return size constraint is an explicit modeling assumption.
It does not invent dollar adjustments for water, sewer, access or entitlements when these seven sales cannot identify them.
Every prediction retains its comparable sources, adjustment factors, training IDs and support warnings.</p>
<div class="scroll">''' + ''.join(sections) + f'''</div>
<h2>Stability matters more than a favorable score</h2><p>For the large tract, deleting one training sale at a time changes the estimate from
{money(stability[0])} to {money(stability[1])}. This is a fit-sensitivity range, not a prediction interval.
The main rolling result uses all seven records, including an off-market sale and a reported below-market sale.
Removing both produces <b>zero of two</b> estimates within $50,000. The model remains unsuitable for a validated production value.</p>
<h2>Additional public-source work</h2><p>The expanded county packet inventory, OCR coverage and candidate dispositions are in
<a href="expanded-source-audit.json">the source audit</a>. New apartment-development sales are recorded separately;
their development rights and transaction scope do not make them interchangeable with single-house lots.
Public portal prices without established provenance, completed homes labeled as land, asking prices and partial-strip acquisitions are not added as verified lot closings.</p>
<p>We also tested previously excluded MLS 1766052 conditionally: the model gives $553,160 against a $505,000 land-plus-barn sale.
That meets the tolerance only if the barn contributes almost nothing. Assuming a $10,000 barn contribution makes the land-only error $58,160.
These hypothetical allocations are preserved in the JSON; this record does not increase the primary test count.</p>
<h2>Reproduce and inspect</h2><p><a href="development-v2.json">Full predictions and diagnostics</a> ·
<a href="sales.json">Original seven sale records</a> · <a href="additional-cohorts.json">Separate development cohort</a> ·
<a href="report.html">Unmodified original experiment</a></p><ul>''' + ''.join('<li>'+esc(x)+'</li>' for x in result['limitations']) + '</ul></html>'


if __name__ == '__main__':
    result = json.loads((OUT/'development-v2.json').read_text())
    (OUT/'development-v2.html').write_text(render(result))
