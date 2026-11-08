"""Weber-only retrospective land experiment, not a production valuation service.

Fixed specification before evaluation; price and transaction remarks are never features.
Small-sample shrinkage limits fit complexity, but cannot establish reliable adjustments.
"""
import json, math, hashlib, html
from pathlib import Path
from datetime import date
import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import Ridge

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/research/backtest/weber'
ALPHA = 10.0
CATEGORIES = ('region', 'water', 'sewer', 'power')

def features(r):
    a=math.log(r['grossAcres'])
    return dict(logAcres=a, largeTractHinge=max(0,a-math.log(5)),
                marketYears=(date.fromisoformat(r['saleDate'])-date(2020,1,1)).days/365.25,
                **{k:r.get(k) or 'unknown' for k in CATEGORIES})

def validate(rows):
    ids=set(); parcels=set()
    for r in rows:
        if r['county']!='Weber': raise ValueError('outside Weber')
        if r['id'] in ids or set(r['parcelIds']) & parcels: raise ValueError('duplicate sale/parcel')
        if r['price']<=0 or r['grossAcres']<=0: raise ValueError('invalid amount/area')
        ids.add(r['id']); parcels.update(r['parcelIds'])

def predict(train, target):
    if len(train)<3: raise ValueError('fewer than three training sales')
    validate(train)
    if target['county']!='Weber': raise ValueError('outside Weber target')
    if any(r['saleDate']>=target['saleDate'] for r in train): raise ValueError('future/same-day training sale')
    if set(target['parcelIds']) & {p for r in train for p in r['parcelIds']}: raise ValueError('parcel leakage')
    vec=DictVectorizer(sparse=False)
    x=vec.fit_transform([features(r) for r in train]); q=vec.transform([features(target)])
    # Natural units and fixed penalty; no whole-dataset preprocessing or target-price access.
    model=Ridge(alpha=ALPHA).fit(x,np.log([r['price'] for r in train]))
    estimate=float(np.exp(model.predict(q)[0]))
    notes=[]
    for k in CATEGORIES:
        if target.get(k,'unknown') not in {r.get(k,'unknown') for r in train}:notes.append('unseen_'+k)
    if not min(r['grossAcres'] for r in train)<=target['grossAcres']<=max(r['grossAcres'] for r in train):notes.append('acreage_extrapolation')
    names=vec.get_feature_names_out()
    contributions={str(k):float(v) for k,v in zip(names,(q[0]-x.mean(axis=0))*model.coef_)}
    return dict(estimate=estimate,trainingIds=[r['id'] for r in train],supportWarnings=notes,
                coefficientByFeature=dict(zip(map(str,names),map(float,model.coef_))),
                logContributionsRelativeToTrainingMean=contributions,
                medianBaseline=float(np.median([r['price'] for r in train])),
                acreageBaseline=float(np.median([r['price']/r['grossAcres'] for r in train])*target['grossAcres']))

def score(train,target):
    result=predict(train,target)
    result.update(id=target['id'],address=target['address'],date=target['saleDate'],actual=target['price'],segment=target['segment'],source=target['source'],page=target['page'])
    result['error']=result['estimate']-result['actual'];result['absoluteError']=abs(result['error'])
    result['within50k']=result['absoluteError']<=50000
    return result

def metrics(rows,field='estimate'):
    if not rows:return dict(n=0,within50k=None,mae=None)
    e=np.array([r[field]-r['actual'] for r in rows]); n=len(e); k=int(sum(abs(e)<=50000)); p=k/n
    # Wilson descriptive interval assumes independent representative observations; not a market guarantee.
    z=1.96; center=(p+z*z/(2*n))/(1+z*z/n); half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
    return dict(n=n,within50k=k,hitRate=p,mae=float(np.mean(abs(e))),medianAbsoluteError=float(np.median(abs(e))),rmse=float(np.sqrt(np.mean(e*e))),bias=float(np.mean(e)),hitRateWilson95=[center-half,center+half])

def evaluate(data):
    rows=sorted(data['records'],key=lambda r:(r['saleDate'],r['id'])); validate(rows)
    primary=[score(rows[:5],r) for r in rows[5:]]
    rolling=[score(rows[:i],rows[i]) for i in range(3,len(rows))]
    clean=[r for r in rows if r['id'] not in ('1735330','1779537')]
    strict=[score(clean[:i],clean[i]) for i in range(3,len(clean))]
    return dict(model='weber-partial-information-ridge-v1',alpha=ALPHA,inputSha256=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest(),mode='retrospective_reconstructed_attributes',marketAccuracyEstablished=False,county='Weber',records=len(rows),primary=dict(protocol='Frozen first five sales; final two held out; no test tuning',metrics=metrics(primary),medianBaseline=metrics(primary,'medianBaseline'),acreageBaseline=metrics(primary,'acreageBaseline'),predictions=primary),rolling=dict(protocol='Expanding window; minimum three preceding sales; overlaps primary and is not independent replication',metrics=metrics(rolling),predictions=rolling),sensitivity=dict(protocol='Exclude off-market MLS1735330 and below-market remark MLS1779537; rolling min three; not selected for better scores',metrics=metrics(strict),predictions=strict),limitations=['Only seven research transactions; this is a feasibility experiment, not validated market accuracy.','Training prices are from earlier sales, but source packets were published later. No historical publicly-available-as-of replay established.','County-hosted MLS sold reports support recorded amounts; closing statements and arm-length status not independently verified.','Valley tracts and western county lots differ; size, geography and date are confounded in this sample.','No interval calibration set; no calibrated prediction interval provided.','No current 2026 accuracy or ±$50k guarantee can be inferred.','Hyperparameter is a fixed engineering choice, not empirically validated on independent Weber data.'])

def render(data,result):
    esc=html.escape
    def money(v):return '${:,.0f}'.format(v)
    body=''
    for r in result['primary']['predictions']:
        body+=f"<tr><td>{esc(r['address'])}<br><small>{r['date']} · <a href='{esc(r['source'],quote=True)}#page={r['page']}'>source p{r['page']}</a></small></td><td>{money(r['actual'])}</td><td>{money(r['estimate'])}</td><td>{money(r['absoluteError'])}</td><td>{'Yes' if r['within50k'] else 'No'}</td></tr>"
    m=result['primary']['metrics']; roll=result['rolling']['metrics']
    sources=''.join(f"<tr><td>{r['id']}</td><td>{esc(r['address'])}</td><td>{r['saleDate']}</td><td>{r['grossAcres']}</td><td>{money(r['price'])}</td><td><a href='{esc(r['source'],quote=True)}#page={r['page']}'>p{r['page']}</a></td></tr>" for r in data['records'])
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cornerpin — Weber valuation backtest</title><style>body{{font:17px/1.6 system-ui;margin:40px auto;padding:0 24px;max-width:1150px;background:#101713;color:#f5f3ed}}h1,h2{{line-height:1.15}}a{{color:#e7cba4}}table{{border-collapse:collapse;width:100%;font-size:15px}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #48514a}}.note{{border-left:4px solid #ff7037;padding:15px;background:#253027}}small{{color:#c3c9c3}}</style><h1>Weber County land valuation backtest</h1><p>November 7, 2026 · Public-source research · No outside-county training data</p><p class="note"><b>{m['within50k']} of {m['n']} held-out sales within ±$50,000.</b> Mean absolute error: {money(m['mae'])}. This small retrospective sample does not establish production accuracy.</p><h2>Actual held-out predictions</h2><table><tr><th>Property</th><th>Closing price</th><th>Estimate</th><th>Absolute error</th><th>Within $50k?</th></tr>{body}</table><h2>Method</h2><p>Train on the first five chronological Weber sales and hold out the final two together. Fixed-penalty ridge regression learns log-price relationships using nonlinear acreage, submarket, utility categories and market date. Unknown attributes stay unknown. No target price, listing price, close remarks or later sale enters prediction features. No tuning on the held-out prices.</p><p>Median-price baseline MAE: {money(result['primary']['medianBaseline']['mae'])}; acreage-rate baseline MAE: {money(result['primary']['acreageBaseline']['mae'])}. The separate expanding-window diagnostic scores {roll['within50k']} of {roll['n']} within $50k, MAE {money(roll['mae'])}. It overlaps the primary test; it is not independent replication.</p><h2>Evidence and limitations</h2><ul>{''.join('<li>'+esc(x)+'</li>' for x in result['limitations'])}</ul><p>Off-market and reported below-market sales are retained with flags. An exclusion sensitivity, every training ID, support warning, coefficient, baseline and prediction are preserved in <a href="results.json">results.json</a>. Original inputs and exclusions are in <a href="sales.json">sales.json</a>.</p><h2>Seven distinct local transactions</h2><table><tr><th>MLS</th><th>Property</th><th>Sold</th><th>Acres</th><th>Price</th><th>Evidence</th></tr>{sources}</table><p>Sources are county-hosted MLS exhibits, not independently obtained settlement records. Historical attributes come from listing-era descriptions in later printed reports. This is retrospective reconstruction, not proof that the entire evidence set was publicly available before each sale.</p></html>'''

if __name__=='__main__':
    data=json.loads((OUT/'sales.json').read_text()); result=evaluate(data)
    (OUT/'results.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    (OUT/'report.html').write_text(render(data,result))
    print(json.dumps({k:result[k]['metrics'] for k in ('primary','rolling','sensitivity')},indent=2))
