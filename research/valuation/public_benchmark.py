"""Real-sale, retrospective external benchmark. Never a Utah accuracy claim.

Fixed chronological partitions, no label-based test exclusions, train-only tuning.
Missing optional features remain NaN; no estimated rights/utility facts inserted.
"""
import argparse,json,math,hashlib
from pathlib import Path
from collections import Counter
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from backtest import metrics

VERSION='partial-information-land-v2'
SOURCES={
 'sales':'https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json',
 'universe':'https://datacatalog.cookcountyil.gov/resource/nj4t-kc8j.json',
 'assessment':'https://datacatalog.cookcountyil.gov/resource/uzyt-m557.json',
 'area':'https://datacatalog.cookcountyil.gov/resource/x54s-btds.json',
 'geometry2020':'https://datacatalog.cookcountyil.gov/resource/2yvh-uwrw.json'}
FEATURES=['latitude','longitude','marketYear','priorAssessedLandLog','grossAreaLog','floodZone','walkScore','township']

def number(v):
    try:
        n=float(v);return n if math.isfinite(n) else None
    except (TypeError,ValueError):return None

def index(cache, prefix):
    result={}
    for p in sorted(cache.glob(prefix+'-*.json')):
        if p.name.endswith('.request.json'):continue
        for r in json.loads(p.read_text()):
            k=(r['pin'],int(float(r['year'])))
            if k in result and result[k]!=r:
                if prefix!='x54s-btds':raise ValueError('Ambiguous historical join '+str(k))
                # Residential table has one row per building card. Never duplicate
                # land area by summing cards; retain only unanimous land area.
                old=result[k]
                r={**r,'char_land_sf':r.get('char_land_sf') if r.get('char_land_sf')==old.get('char_land_sf') else None,
                   'char_bldg_sf':max(number(r.get('char_bldg_sf')) or 0,number(old.get('char_bldg_sf')) or 0)}
            result[k]=r
    return result

def polygon_areas(cache):
    from geographiclib.geodesic import Geodesic
    result={}
    for p in sorted(cache.glob('2yvh-uwrw-*.json')):
        if p.name.endswith('.request.json'):continue
        for r in json.loads(p.read_text()):
            if r.get('parceltype')!='1':continue
            geometry=r.get('the_geom',{});polygons=geometry.get('coordinates',[])
            if geometry.get('type')=='Polygon':polygons=[polygons]
            elif geometry.get('type')!='MultiPolygon':continue
            area=0
            for poly in polygons:
                for i,ring in enumerate(poly):
                    accumulator=Geodesic.WGS84.Polygon()
                    for lon,lat in ring:accumulator.AddPoint(lat,lon)
                    square_meters=abs(accumulator.Compute()[2]);area+=square_meters if i==0 else -square_meters
            key=r['pin10']
            if key in result and (result[key] is None or abs(result[key]-area)>.01):
                result[key]=None  # Conflicting base polygons: omit area, retain transaction.
            else:result[key]=area
    return result

def prepare(cache, modern=False):
    sales=json.loads((cache/'sales.json').read_text())
    polygon=polygon_areas(cache) if modern else {}
    if modern:sales=[r for r in sales if '2021'<=r['sale_date'][:4]<='2024']
    geo=index(cache,'nj4t-kc8j');assess=index(cache,'uzyt-m557');areas=index(cache,'x54s-btds')
    rows=[];excluded=[];seen=set()
    for s in sales:
        errors=[]
        for k in ('is_multisale','sale_filter_same_sale_within_365','sale_filter_less_than_10k','sale_filter_deed_type'):
            if s.get(k) is not False:errors.append(k)
        if s.get('sale_type')!='LAND' and not (modern and s.get('sale_type') is None):errors.append('not_land_sale')
        price=number(s.get('sale_price'))
        if price is None or price<=0:errors.append('missing_positive_closing_price')
        year=int(s['sale_date'][:4]);key=(s['pin'],year-1)
        g=geo.get(key);a=assess.get(key);z=areas.get(key)
        if not errors:
            if not g:errors.append('no_prior_year_geography')
            elif g.get('class')!='100':errors.append('prior_year_not_vacant')
            elif number(g.get('lat')) is None or number(g.get('lon')) is None:errors.append('missing_coordinates')
            if a and number(a.get('certified_bldg')) not in (0,None):errors.append('prior_year_improvement_value')
            if modern and (not a or a.get('class')!='100' or number(a.get('certified_bldg'))!=0):
                errors.append('missing_corroborating_vacant_assessment')
            if z and (number(z.get('char_bldg_sf')) or 0)>0:errors.append('prior_year_building_area_conflict')
            if s['doc_no'] in seen:errors.append('duplicate_document')
        if errors:
            excluded.append({'id':s.get('doc_no'),'pin':s['pin'],'reasons':sorted(set(errors))});continue
        seen.add(s['doc_no'])
        area=number(z.get('char_land_sf')) if z else None
        if modern:
            area=polygon.get(s['pin'][:10])
            area=area*10.76391041671 if area and s['pin'].endswith('0000') else None
        land=number(a.get('certified_land')) if a else None
        flood=None;walk=None
        if (number(g.get('env_flood_fema_data_year')) or 9999)<=year-1:
            flood=1 if g.get('env_flood_fema_sfha') is True else 0 if g.get('env_flood_fema_sfha') is False else None
        if (number(g.get('access_cmap_walk_data_year')) or 9999)<=year-1:walk=number(g.get('access_cmap_walk_total_score'))
        rows.append({'id':s['doc_no'],'propertyKey':s['pin'],'saleDate':s['sale_date'][:10],
            'actual':price,'featureYear':year-1,'source':SOURCES['sales']+'?doc_no='+s['doc_no'],
            'features':{'latitude':float(g['lat']),'longitude':float(g['lon']),
                'marketYear':year+int(s['sale_date'][5:7])/12,
                'priorAssessedLandLog':math.log(land) if land and land>0 else None,
                'grossAreaLog':math.log(area) if area and area>0 else None,
                'floodZone':flood,'walkScore':walk,'township':g.get('township_code')},
            'priorAssessedLand':land,'grossAreaSquareFeet':area,'areaVintage':2020 if modern and area else None,
            'landEvidence':'sale-year class 100 + prior-year class 100 and zero building assessment' if modern else 'explicit LAND transaction and prior-year class 100'})
    return rows,{'screenedRecords':len(sales),'eligibleRecords':len(rows),'excluded':excluded,
        'exclusionCounts':dict(Counter(k for r in excluded for k in r['reasons'])),
        'featurePresentCounts':{k:sum(r['features'][k] is not None for r in rows) for k in FEATURES}}

class PartialLandModel:
    """Nonlinear hedonic candidate; assessed value is a predictor, never ground truth."""
    def __init__(self,leaves=15,target='log'):
        self.leaves=leaves;self.target=target
    def matrix(self,rows):
        a=[]
        for r in rows:
            f=r['features'];v=[]
            for k in self.columns:
                x=f.get(k)
                if k=='township':x=self.towns.get(x)
                v.append(np.nan if x is None else x)
            a.append(v)
        return np.asarray(a,dtype=float)
    def fit(self,rows):
        self.towns={v:i for i,v in enumerate(sorted({r['features']['township'] for r in rows if r['features'].get('township')}))}
        # Feature inclusion uses training covariates only. Entirely missing fields cannot be learned.
        self.columns=[k for k in FEATURES if sum(r['features'].get(k) is not None for r in rows)>=20]
        y=np.array([r['actual'] for r in rows]);y=np.log(y) if self.target=='log' else y
        self.model=HistGradientBoostingRegressor(loss='absolute_error',max_leaf_nodes=self.leaves,
            learning_rate=.06,max_iter=250,min_samples_leaf=20,l2_regularization=10,
            categorical_features=[k=='township' for k in self.columns],early_stopping=False,random_state=42)
        self.model.fit(self.matrix(rows),y);return self
    def predict(self,rows):
        p=self.model.predict(self.matrix(rows));return np.exp(p) if self.target=='log' else np.maximum(p,1)

def score(rows,pred):return metrics([{'actual':r['actual'],'predicted':float(p)} for r,p in zip(rows,pred)])

def evaluate(rows,audit,modern=False,objective='dollar_mae'):
    # Chosen before inspecting holdout outcomes: land-type labels stop after 2020.
    groups={name:[r for r in rows if lo<=r['saleDate'][:4]<=hi] for name,lo,hi in
            ([('train','2021','2021'),('tune','2022','2022'),('calibration','2023','2023'),('test','2024','2024')] if modern else [('train','2015','2017'),('tune','2018','2018'),('calibration','2019','2019'),('test','2020','2020')])}
    later=set();embargo=[]
    for name in ('test','calibration','tune','train'):
        original=groups[name];groups[name]=[r for r in original if r['propertyKey'] not in later]
        embargo.extend(r['id'] for r in original if r['propertyKey'] in later)
        later.update(r['propertyKey'] for r in original)
    train,tune,cal,test=[groups[k] for k in ('train','tune','calibration','test')]
    if min(map(len,(train,tune,test)))<20:raise ValueError('Insufficient actual observations')
    tuning=[]
    for leaves in (7,15,31):
        for target in ('log','dollars'):
            m=PartialLandModel(leaves,target).fit(train)
            tuning.append({'leaves':leaves,'target':target,'metrics':score(tune,m.predict(tune))})
    if objective not in ('dollar_mae','within50000'):raise ValueError('Unknown tuning objective')
    chosen=min(tuning,key=lambda x:(-x['metrics']['within50000'],x['metrics']['meanAbsoluteError'])) if objective=='within50000' else min(tuning,key=lambda x:x['metrics']['meanAbsoluteError'])
    m=PartialLandModel(chosen['leaves'],chosen['target']).fit(train+tune)
    cp=m.predict(cal) if cal else [];err=sorted(abs(math.log(r['actual']/p)) for r,p in zip(cal,cp))
    q=err[math.ceil((len(err)+1)*.9)-1] if len(err)>=20 else None
    pred=m.predict(test)
    fitting=train+tune;median=float(np.median([r['actual'] for r in fitting]))
    ratios=[r['actual']/r['priorAssessedLand'] for r in fitting if r['priorAssessedLand'] and r['priorAssessedLand']>0]
    multiplier=float(np.median(ratios))
    predictions=[]
    for r,p in zip(test,pred):
        p=float(p);lo=p*math.exp(-q) if q is not None else None;hi=p*math.exp(q) if q is not None else None
        baseline=r['priorAssessedLand']*multiplier if r['priorAssessedLand'] and r['priorAssessedLand']>0 else median
        predictions.append({**r,'predicted':p,'signedError':p-r['actual'],'absoluteError':abs(p-r['actual']),
            'within50000':abs(p-r['actual'])<=50000,'interval90':[lo,hi] if q is not None else None,
            'medianPriceBaseline':median,'assessmentBaseline':baseline})
    result={'modelVersion':VERSION,'tuningObjective':objective,'scope':'Cook County class-100 land transactions; external benchmark, NOT Utah pilot validation',
        'holdoutYear':2024 if modern else 2020,
        'mode':'retrospective; source tables retrieved today may include later corrections; not public-as-of replay',
        'sources':SOURCES,'datasetSha256':hashlib.sha256(json.dumps(rows,sort_keys=True).encode()).hexdigest(),
        'qualification':audit,'partitions':{k:len(v) for k,v in groups.items()},'embargoedIds':embargo,
        'model':{'selected':chosen,'tuning':tuning,'features':m.columns,'trainingIds':[r['id'] for r in fitting]},
        'toleranceDollars':50000,'metrics':score(test,pred),'predictions':predictions,'predictionCoverage':1.,
        'calibration':{'n':len(err),'logErrorQuantile':q,'nominalCoverage':.9},
        'intervalCoverage':float(np.mean([r['interval90'][0]<=r['actual']<=r['interval90'][1] for r in predictions])) if q is not None else None,
        'medianIntervalWidth':float(np.median([r['interval90'][1]-r['interval90'][0] for r in predictions])) if q is not None else None,
        'baselines':{k:metrics([{'actual':r['actual'],'predicted':r[k]} for r in predictions]) for k in ('medianPriceBaseline','assessmentBaseline')},
        'byClosingPrice':{},'utahAccuracyEstablished':False,'productionReady':False,
        'limitations':['Vacant land class does not establish residential entitlement or buildability.',
            'Selected transactions exclude adverse deed flags, multi-parcel and under-$10k sales. Modern blank transaction-type records require matching vacant assessments.',
            'Historical county data is a reconstructed snapshot, not independently audited settlement evidence.',
            'Prior assessments are predictors, not closing prices; all targets are recorded sale prices.',
            'Missing size, utilities, rights, slope and buildable-area evidence limit the partial model.',
            'Recorded dates are not necessarily execution dates; year-based splits avoid within-month ordering assumptions.',
            'Each holdout measures one market regime; it does not validate current Utah pricing.',
            '2020 GIS area is an historical estimate; matching parcel ID does not prove no boundary changes through sale.']}
    for label,lo,hi in [('under_100k',0,100000),('100k_to_250k',100000,250000),('250k_to_500k',250000,500000),('500k_plus',500000,math.inf)]:
        subset=[r for r in predictions if lo<=r['actual']<hi];result['byClosingPrice'][label]=metrics(subset)
    n=len(test);p=result['metrics']['within50000'];z=1.96
    center=(p+z*z/(2*n))/(1+z*z/n);half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
    result['within50000Wilson95']=[center-half,center+half]
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('cache',type=Path);p.add_argument('output',type=Path);p.add_argument('--modern',action='store_true');p.add_argument('--objective',choices=['dollar_mae','within50000'],default='dollar_mae');args=p.parse_args()
    rows,audit=prepare(args.cache,args.modern);result=evaluate(rows,audit,args.modern,args.objective)
    args.output.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    args.output.with_name('public-benchmark-modern-input.json' if args.modern else 'public-benchmark-input.json').write_text(json.dumps(rows,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:result[k] for k in ('scope','partitions','metrics','baselines','byClosingPrice','intervalCoverage')},indent=2))
