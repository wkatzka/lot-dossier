"""Preserve sourced retrospective facts; do not require every model attribute."""
import json
from collections import Counter
from pathlib import Path
from qualification import qualify
ROOT=Path(__file__).resolve().parents[2]
D=ROOT/'docs/research/backtest'
seed=json.loads((D/'historical-sales-seed.json').read_text())
county={r['mls']:r for r in seed['records']}
audit=json.loads((D/'expanded-public-source-audit.json').read_text())
records=[]
for r in audit['records']:
    h=county.get(r['id'].replace('county-mls-',''))
    features={}
    if h:
        # Report describes the sold listing; applicability is reconstructed at sale,
        # not an assertion the report existed before sale or a fabricated posting date.
        facts={'grossAcres':h['grossAcres'],**h['sourceFeatures']}
        for key,value in facts.items():
            features[key]=dict(value=value,source=h['source'],effectiveAt=h['soldDate'],availableAt=None,
                evidenceBasis='Listing-era characteristics in sold report printed '+h['reportPrintedAt'])
    records.append(dict(id=r['id'],source=r['source'],propertyKey=r.get('propertyKey') or ('|'.join(h['parcelIds']) if h else None),
        parcelIds=h['parcelIds'] if h else [],submarket=audit['submarket'],
        propertyType=('improved' if 'improvements' in h['sourceFeatures'] else 'agricultural_development_land') if h else 'unverified_land',
        valuationDate=h['soldDate'] if h else r.get('saleDate'),saleDate=h['soldDate'] if h else r.get('saleDate'),availableAt=None,
        price=h['soldPrice'] if h else r.get('price'),priceType='closed_price' if h else r.get('priceType'),priceVerified=bool(h),
        transactionConditions=('seller_financing' if h['terms']=='seller financing' else 'reported_market') if h else 'unverified',
        features=features,historicalEvidence=h,reviewFlags=h['reviewFlags'] if h else []))
data=dict(submarket=audit['submarket'],asOf='2026-11-07',trainEnd='2019-08-31',calibrationEnd='2019-09-30',records=records,
    purpose='Research admission and model support are separate; three observations cannot fit a multivariate estimator.')
(D/'hedonic-public-input.json').write_text(json.dumps(data,indent=2)+'\n')
report={'screenedRecords':len(records),'modes':{}}
for mode in ('retrospective','public_replay'):
    rows=[dict(id=r['id'],**qualify(r,data['asOf'],mode)) for r in records]
    report['modes'][mode]={'eligibleRecords':sum(r['eligible'] for r in rows),'records':rows,
        'exclusionCounts':dict(Counter(k for r in rows for k in r['reasons']))}
report['pilotModelStatus']='insufficient_training_sample; not zero eligible records'
report['productionReady']=False
(D/'qualification-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print({k:v['eligibleRecords'] for k,v in report['modes'].items()})
