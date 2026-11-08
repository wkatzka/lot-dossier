"""Evidence-gated residential-land research model; no fabricated coefficients.

Regularized robust log-price hedonic adjustments + locally weighted comparables.
All transforms and coefficients are fitted on training observations only.
"""
import hashlib
import json
import math
from datetime import date
import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import HuberRegressor
from sklearn.preprocessing import StandardScaler

VERSION = 'land-hedonic-comparables-v1'
NUMERIC = ('grossAcres', 'permittedUnits', 'buildableFraction', 'slopePercent', 'latitude', 'longitude')
CATEGORICAL = ('water', 'sewer', 'access', 'entitlement', 'zoningClass', 'viewClass', 'hazardClass')
FEATURES = NUMERIC + CATEGORICAL
MIN_TRAIN = 60  # Engineering floor, not a claim that 60 observations establishes accuracy.
MIN_CALIBRATION = 20

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()

def day(value):
    return date.fromisoformat(value)

def evidence_issues(r, as_of, mode='public_replay', sale=True):
    issues = []
    try:
        valuation = day(r['valuationDate'])
        if valuation > day(as_of): issues.append('valuation_after_run_date')
    except (ValueError, TypeError, KeyError):
        return ['missing_or_invalid_valuation_date']
    if not r.get('propertyKey'): issues.append('missing_property_identity')
    if r.get('propertyType') != 'vacant_residential_land': issues.append('not_verified_residential_land')
    if sale:
        if not isinstance(r.get('price'), (float, int)) or not math.isfinite(r['price']) or r['price'] <= 0:
            issues.append('missing_closing_price')
        if r.get('priceType') != 'closed_price' or not r.get('priceVerified'):
            issues.append('closing_price_not_verified')
        if not str(r.get('source', '')).startswith('https://'): issues.append('missing_price_source')
        if r.get('transactionConditions') != 'ordinary_market': issues.append('transaction_conditions_unresolved')
        try:
            if day(r['saleDate']) < valuation or day(r['saleDate']) > day(as_of): issues.append('invalid_sale_chronology')
            if (day(r['saleDate'])-valuation).days > 30: issues.append('sale_too_far_from_valuation_date')
            if mode == 'public_replay' or r.get('availableAt'):
                if day(r['availableAt']) < day(r['saleDate']): issues.append('price_available_before_closing')
                if day(r['availableAt']) > day(as_of): issues.append('price_source_after_run_date')
        except (ValueError, TypeError, KeyError): issues.append('sale_or_publication_date_missing')
    for key in FEATURES:
        f = r.get('features', {}).get(key, {})
        v = f.get('value')
        if v is None or v == '' or v == 'unknown': issues.append('missing_feature:' + key); continue
        if key in NUMERIC and (not isinstance(v, (int, float)) or isinstance(v, bool) or not math.isfinite(v)):
            issues.append('invalid_feature:' + key); continue
        if key in CATEGORICAL and not isinstance(v, str): issues.append('invalid_feature:' + key)
        if not str(f.get('source', '')).startswith('https://'): issues.append('missing_feature_source:' + key)
        try:
            # Effective date may establish a reconstructed historical characteristic.
            if day(f['effectiveAt']) > valuation: issues.append('future_feature:' + key)
            if mode == 'public_replay' and day(f['availableAt']) > valuation:
                issues.append('feature_not_public_at_valuation:' + key)
            if f.get('availableAt') and day(f['availableAt']) > day(as_of):
                issues.append('feature_source_after_run_date:' + key)
        except (ValueError, TypeError, KeyError): issues.append('feature_dates_missing:' + key)
    f = {k: v.get('value') for k, v in r.get('features', {}).items()}
    bounds = {'grossAcres':(0,100000), 'permittedUnits':(0,10000), 'buildableFraction':(0,1),
              'slopePercent':(0,1000), 'latitude':(-90,90), 'longitude':(-180,180)}
    for k,(lo,hi) in bounds.items():
        v=f.get(k)
        if isinstance(v,(int,float)) and (not lo <= v <= hi or k in ('grossAcres','permittedUnits','buildableFraction') and v <= 0):
            issues.append('feature_out_of_bounds:'+k)
    return sorted(set(issues))

def values(r):
    f = {k:r['features'][k]['value'] for k in FEATURES}
    area = math.log(f['grossAcres'])
    # Nonlinear size response and interactions; coefficients are learned, not fixed premiums.
    return dict(logAcres=area, logAcresSquared=area*area,
                logPermittedUnits=math.log(f['permittedUnits']),
                buildableFraction=f['buildableFraction'], slopePercent=f['slopePercent'],
                slopeBuildable=f['slopePercent']*f['buildableFraction'],
                latitude=f['latitude'], longitude=f['longitude'],
                marketYears=(day(r['valuationDate'])-date(2000,1,1)).days/365.25,
                **{k:f[k] for k in CATEGORICAL})

def haversine(a,b):
    lat1,lon1,lat2,lon2=map(math.radians,[a['latitude'],a['longitude'],b['latitude'],b['longitude']])
    return 6371*2*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))

class LandModel:
    def __init__(self, alpha=1.0, neighbors=7, max_distance_km=25, max_age_days=1095):
        self.alpha, self.neighbors = alpha, neighbors
        self.max_distance_km, self.max_age_days = max_distance_km, max_age_days

    def fit(self, rows):
        if len(rows)<MIN_TRAIN: raise ValueError('insufficient_training_sales')
        self.rows=rows
        self.vectorizer=DictVectorizer(sparse=False)
        raw=self.vectorizer.fit_transform([values(r) for r in rows])
        self.scaler=StandardScaler().fit(raw)
        self.X=self.scaler.transform(raw)
        if len(rows)<2*self.X.shape[1]: raise ValueError('too_many_parameters_for_training_sample')
        self.regressor=HuberRegressor(alpha=self.alpha,epsilon=1.35,max_iter=3000,tol=1e-7)
        self.regressor.fit(self.X,np.log([r['price'] for r in rows]))
        if self.regressor.n_iter_>=3000: raise ValueError('fit_did_not_converge')
        self.names=self.vectorizer.get_feature_names_out().tolist()
        self.categories={k:{r['features'][k]['value'] for r in rows} for k in CATEGORICAL}
        self.numeric_bounds={k:(min(r['features'][k]['value'] for r in rows),max(r['features'][k]['value'] for r in rows)) for k in ('grossAcres','permittedUnits','buildableFraction','slopePercent')}
        self.signature=digest({'version':VERSION,'alpha':self.alpha,'training':rows,'coefficients':self.regressor.coef_.tolist()})
        return self

    def predict(self, target, mode='public_replay'):
        f={k:target['features'][k]['value'] for k in FEATURES}
        unknown=[k for k in CATEGORICAL if f[k] not in self.categories[k]]
        extrapolated=[k for k,(lo,hi) in self.numeric_bounds.items() if not lo<=f[k]<=hi]
        if unknown or extrapolated:
            return {'status':'abstain','reason':'outside_training_support','unknownCategories':unknown,'outOfRange':extrapolated}
        x=self.scaler.transform(self.vectorizer.transform([values(target)]))[0]
        candidates=[]
        for i,c in enumerate(self.rows):
            if c['propertyKey']==target['propertyKey'] or set(c.get('parcelIds') or [c['propertyKey']]) & set(target.get('parcelIds') or [target['propertyKey']]): continue
            age=(day(target['valuationDate'])-day(c['saleDate'])).days
            if not 0<age<=self.max_age_days: continue
            if mode=='public_replay' and day(c['availableAt'])>=day(target['valuationDate']): continue
            cf={k:c['features'][k]['value'] for k in FEATURES}
            if cf['entitlement']!=f['entitlement'] or cf['zoningClass']!=f['zoningClass']: continue
            km=haversine(f,cf)
            if km>self.max_distance_km: continue
            distance=float(np.sqrt(np.mean((x-self.X[i])**2)))
            contributions=(x-self.X[i])*self.regressor.coef_
            log_adjustment=float(contributions.sum())
            if abs(log_adjustment)>math.log(2): continue  # Unsupported >100% / <-50% corrections abstain.
            groups={}
            for name,contribution in zip(self.names,contributions):
                key='size' if name in ('logAcres','logAcresSquared') else name.split('=')[0]
                groups[key]=groups.get(key,0)+float(contribution)
            waterfall=[];running=c['price']
            for name,contribution in groups.items():
                following=running*math.exp(contribution)
                waterfall.append({'factor':name,'logContribution':contribution,
                    'percentage':100*math.expm1(contribution),'sequentialDollarEffect':following-running})
                running=following
            candidates.append({'id':c['id'],'source':c['source'],'salePrice':c['price'],
                'saleDate':c['saleDate'],'distanceKm':km,'similarityDistance':distance,
                'weightRaw':1/(1+distance)**2,'logAdjustments':dict(zip(self.names,contributions.tolist())),
                'adjustmentWaterfall':waterfall,
                'adjustedIndication':float(c['price']*math.exp(log_adjustment))})
        candidates=sorted(candidates,key=lambda c:(c['similarityDistance'],c['id']))[:self.neighbors]
        if len(candidates)<3:return {'status':'abstain','reason':'fewer_than_three_supported_comparables','comparableCount':len(candidates)}
        total=sum(c['weightRaw'] for c in candidates)
        for c in candidates:c['weight']=c.pop('weightRaw')/total
        estimate=math.exp(sum(c['weight']*math.log(c['adjustedIndication']) for c in candidates))
        return {'status':'research_estimate','estimate':estimate,'directHedonicEstimate':float(math.exp(self.regressor.predict([x])[0])),
                'comparables':candidates,'modelSignature':self.signature,'marketAccuracyEstablished':False}

    def manifest(self):
        return {'version':VERSION,'signature':self.signature,'alpha':self.alpha,'trainingIds':[r['id'] for r in self.rows],
                'featureNames':self.names,'mean':self.scaler.mean_.tolist(),'scale':self.scaler.scale_.tolist(),
                'coefficients':self.regressor.coef_.tolist(),'intercept':float(self.regressor.intercept_),
                'numericSupport':self.numeric_bounds,'categories':{k:sorted(v) for k,v in self.categories.items()},
                'comparisonPolicy':{'neighbors':self.neighbors,'maxDistanceKm':self.max_distance_km,'maxAgeDays':self.max_age_days}}

def residual_dcf(scenario):
    """Unlevered residual with explicit cash-flow timing; hurdle embeds return.
    Reject finance/profit lines to avoid counting capital return twice.
    """
    rate=scenario['annualRequiredReturn']; acquisition=scenario['acquisitionRate']
    if not 0<=rate<1 or not 0<=acquisition<1:raise ValueError('invalid_rates')
    if not scenario.get('rateBasis') or not scenario.get('acquisitionBasis'):raise ValueError('missing_rate_basis')
    cashflows=scenario.get('cashflows',[])
    if not cashflows or not any(c['kind']=='sale_proceeds' for c in cashflows):raise ValueError('missing_sale_proceeds')
    seen=set(); npv=0; breakdown=[]
    for c in cashflows:
        if c['id'] in seen:raise ValueError('duplicate_cost_or_proceeds')
        seen.add(c['id'])
        if c['kind'] in ('financing','interest','profit','land_purchase'):raise ValueError('double_counted_capital_or_land')
        if not c.get('basis') or not math.isfinite(c['amount']) or not math.isfinite(c['month']) or c['month']<0:raise ValueError('invalid_cashflow')
        if c['kind']=='sale_proceeds' and c['amount']<=0 or c['kind']!='sale_proceeds' and c['amount']>0:raise ValueError('cashflow_sign')
        pv=c['amount']/(1+rate)**(c['month']/12);npv+=pv
        breakdown.append({**c,'presentValue':pv})
    return {'status':'investment_scenario','marketValue':False,'landBudget':npv/(1+acquisition),'feasible':npv>=0,
            'discountedCashflows':breakdown,'annualRequiredReturn':rate,
            'basis':'Unlevered project cash flows; required return includes capital return. No finance/profit lines added again.'}

def cross_check(market, scenarios):
    """Keep market evidence and investor economics distinct; never average them."""
    results=[]
    for name,scenario in scenarios.items():
        result=residual_dcf(scenario)
        if market.get('status')=='research_estimate':
            result['budgetLessMarketEstimate']=result['landBudget']-market['estimate']
            result['meetsScenarioHurdleAtMarketEstimate']=result['budgetLessMarketEstimate']>=0
        results.append({'scenario':name,**result})
    return {'market':market,'investmentScenarios':results,'blendedMarketValue':None,
            'interpretation':'Builder budgets are conditional investment limits, not additional comparable-sale evidence.'}
