"""Evidence-limited Weber land model v2. Research only; no production approval.

Reuses the seven v1 outcomes for development diagnostics, NOT a new holdout.
Within-region/segment paired log slopes avoid learning size from between-market
price differences. Median adjusted comparables resist individual outliers.
The [0,1] elasticity bound is an explicit monotone/diminishing-return modeling
assumption, not an asserted appraisal standard or a measured local law.
"""
import itertools
import json
import math
import hashlib
from datetime import date
import numpy as np
from weber_backtest import OUT, validate, predict as predict_v1, metrics


def fit_predict(train, target):
    validate(train)
    if any(not math.isfinite(r[k]) or r[k] <= 0 for r in train for k in ('price','grossAcres')):
        raise ValueError('non-finite or nonpositive training value')
    if len(train) < 3:
        raise ValueError('fewer than three training sales')
    if target['county'] != 'Weber' or not math.isfinite(target['grossAcres']) or target['grossAcres'] <= 0:
        raise ValueError('invalid Weber target')
    if any(r['saleDate'] >= target['saleDate'] for r in train):
        raise ValueError('future/same-day training sale')
    if set(target['parcelIds']) & {p for r in train for p in r['parcelIds']}:
        raise ValueError('parcel leakage')
    pairs = []
    for a, b in itertools.combinations(train, 2):
        if a['region'] != b['region'] or a['segment'] != b['segment']:
            continue
        dx = math.log(a['grossAcres']/b['grossAcres'])
        if abs(dx) <= .1:
            continue  # near-equal areas cannot identify a stable size slope
        pairs.append(dict(ids=[a['id'], b['id']], elasticity=math.log(a['price']/b['price'])/dx))
    raw = float(np.median([p['elasticity'] for p in pairs])) if pairs else None
    # An unidentified size adjustment is left at zero and clearly flagged.
    beta = float(np.clip(raw, 0, 1)) if raw is not None else 0.0
    local = [r for r in train if r['region'] == target['region']]
    comps = local or train
    adjusted = [dict(id=r['id'], source=r['source'], page=r['page'],
                     acres=r['grossAcres'], saleDate=r['saleDate'], price=r['price'],
                     sizeFactor=(target['grossAcres']/r['grossAcres'])**beta,
                     adjustedPrice=r['price']*(target['grossAcres']/r['grossAcres'])**beta)
                for r in comps]
    estimate = float(np.exp(np.median(np.log([r['adjustedPrice'] for r in adjusted]))))
    warnings = ['uncalibrated_research_estimate', 'time_and_utility_adjustments_not_identified']
    if raw is None: warnings.append('acreage_effect_not_identified')
    if not local: warnings.append('no_same_submarket_comparables')
    if len(local) < 3: warnings.append('fewer_than_three_same_submarket_sales')
    same = [r for r in local if r['segment'] == target['segment']]
    if not same: warnings.append('no_same_submarket_and_segment_sales')
    if local and not min(r['grossAcres'] for r in local) <= target['grossAcres'] <= max(r['grossAcres'] for r in local):
        warnings.append('same_submarket_acreage_extrapolation')
    if any((date.fromisoformat(target['saleDate'])-date.fromisoformat(r['saleDate'])).days > 365 for r in comps):
        warnings.append('comparables_over_one_year_old_without_time_adjustment')
    return dict(estimate=estimate, trainingIds=[r['id'] for r in train],
                comparableAdjustments=adjusted, sizePairs=pairs, rawElasticity=raw,
                acreageElasticity=beta, supportWarnings=warnings,
                predictionInterval=None, productionApproved=False)


def scored(train, target):
    r = fit_predict(train, target)
    v1 = predict_v1(train, target)
    r.update(id=target['id'], address=target['address'], actual=target['price'],
             saleDate=target['saleDate'], region=target['region'], segment=target['segment'],
             previousEstimate=v1['estimate'], medianBaseline=v1['medianBaseline'],
             acreageBaseline=v1['acreageBaseline'])
    r['error'] = r['estimate']-r['actual']
    r['within50k'] = abs(r['error']) <= 50000
    # Stability diagnostic, NOT a confidence/prediction interval. Target price never enters.
    loo = [fit_predict(train[:i]+train[i+1:], target)['estimate'] for i in range(len(train))] if len(train) > 3 else []
    r['deleteOneTrainingSensitivity'] = dict(estimates=loo, range=[min(loo),max(loo)] if loo else None,
                                           interpretation='Fit instability only; not calibrated coverage')
    return r


def evaluate(data):
    rows = sorted(data['records'], key=lambda r:(r['saleDate'],r['id']))
    validate(rows)
    frozen = [scored(rows[:5], r) for r in rows[5:]]
    rolling = [scored(rows[:i], rows[i]) for i in range(3,len(rows))]
    clean = [r for r in rows if r['id'] not in ('1735330','1779537')]
    sensitivity = [scored(clean[:i],clean[i]) for i in range(3,len(clean))]
    # Audit one previously rejected record without relabeling its total as land value.
    barn_target = dict(id='1766052', county='Weber', parcelIds=['15-757-0008'],
                       saleDate='2021-09-28', grossAcres=5.69, region='Western Weber', segment='rural_tract')
    barn = fit_predict([r for r in rows if r['saleDate'] < barn_target['saleDate']], barn_target)
    barn.update(source='https://www.webercountyutah.gov/commission/documents/uploads/F11%20%20Norman%20Hammer%20ROW.pdf',
                page=27, id='1766052', reportedCombinedPrice=505000,
                includedInPrimaryMetrics=False, independentTest=False,
                interpretation='Land plus historic barn. Contribution unknown; these are hypothetical allocations, not measured land prices.',
                allocationScenarios=[dict(assumedBarnContribution=v, hypotheticalLandPrice=505000-v,
                                          error=barn['estimate']-(505000-v),
                                          within50k=abs(barn['estimate']-(505000-v))<=50000)
                                     for v in (0,10000,25000,50000,100000)])
    def block(predictions):
        return dict(metrics=metrics(predictions), previousModel=metrics(predictions,'previousEstimate'),
                    acreageBaseline=metrics(predictions,'acreageBaseline'),
                    medianBaseline=metrics(predictions,'medianBaseline'), predictions=predictions)
    return dict(model='weber-within-market-adjusted-comparables-v2',
                protocol='Development re-evaluation of previously inspected outcomes; NOT independent validation',
                county='Weber', records=len(rows), newIndependentEvaluationRecords=0,
                inputSha256=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest(),
                productionApproved=False, frozenDevelopment=block(frozen), rollingDevelopment=block(rolling),
                flaggedTransactionSensitivity=block(sensitivity), conditionalBarnDiagnostic=barn,
                limitations=['Historical listing descriptions reconstructed from later reports; no public-as-of replay.',
                             'Public MLS exhibit prices, not independently verified settlement amounts.',
                             'Size effects remain confounded with unmeasured property attributes within groups.',
                             'Paired slopes share sales; pair count is not independent sample size.',
                             'No supported dollar adjustments for utility availability, water shares, usable area, entitlements or access.',
                             'No current-market validation, calibrated prediction interval or ±$50k guarantee.'])


if __name__ == '__main__':
    result=evaluate(json.loads((OUT/'sales.json').read_text()))
    (OUT/'development-v2.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:result[k]['metrics'] for k in ('frozenDevelopment','rollingDevelopment','flaggedTransactionSensitivity')},indent=2))
