"""Normalize factual audit records without inventing missing model features."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
D=ROOT/'docs/research/backtest'
seed=json.loads((D/'historical-sales-seed.json').read_text())
county={r['mls']:r for r in seed['records']}
audit=json.loads((D/'expanded-public-source-audit.json').read_text())
records=[]
for r in audit['records']:
    historical=county.get(r['id'].replace('county-mls-',''))
    features={}
    if r.get('grossAcres'):
        features['grossAcres']=dict(value=r['grossAcres'],source=r['source'],effectiveAt=None,availableAt=None,
                                    note='Reported gross area; historical validity date not independently established.')
    if historical:
        for key in ('water','sewer'):
            if historical['sourceFeatures'].get(key):
                features[key]=dict(value=historical['sourceFeatures'][key],source=r['source'],effectiveAt=None,availableAt=None,
                                   note='Preserved reported description; historical applicability requires reconciliation.')
    records.append(dict(id=r['id'],source=r['source'],propertyKey=r.get('propertyKey'),
        parcelIds=historical['parcelIds'] if historical else [],submarket=audit['submarket'],
        propertyType='improved' if r.get('propertyType')=='improved' else 'unverified_residential_land',
        valuationDate=r.get('saleDate'),saleDate=r.get('saleDate'),availableAt=r.get('availableAt'),
        price=r.get('price'),priceType=r.get('priceType'),priceVerified=r.get('verified',False),
        transactionConditions='unverified',features=features,
        historicalEvidence=historical or None,
        note='Unresolved feature evidence remains empty; gross acreage is not a buildable-area measurement.'))
data=dict(submarket=audit['submarket'],asOf='2026-11-07',trainEnd='2020-12-31',calibrationEnd='2023-12-31',records=records,
          purpose='Run the full hedonic-comparable evidence gate on public candidates; missing dates/features are not inferred.')
(D/'hedonic-public-input.json').write_text(json.dumps(data,indent=2)+'\n')
print('Normalized',len(records),'public candidates; no inferred feature values.')
