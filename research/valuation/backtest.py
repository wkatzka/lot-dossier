"""Chronological train/tune/calibration/test evaluation of the actual v1 model."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import numpy as np
from model import LandModel, MIN_TRAIN, MIN_CALIBRATION, VERSION, day, digest, evidence_issues

def metrics(rows):
    if not rows:return None
    actual=np.array([r['actual'] for r in rows]);pred=np.array([r['predicted'] for r in rows])
    ape=np.abs(pred-actual)/actual
    return dict(n=len(rows),meanAbsoluteError=float(np.mean(np.abs(pred-actual))),
        medianAbsolutePercentageError=float(np.median(ape)*100),
        meanAbsolutePercentageError=float(np.mean(ape)*100),meanPercentageBias=float(np.mean((pred-actual)/actual)*100),
        within10Percent=float(np.mean(ape<=.1)),within20Percent=float(np.mean(ape<=.2)))

def evaluate(data, mode='public_replay', holdout_groups=False):
    if mode not in ('public_replay','retrospective'):raise ValueError('unknown_evidence_mode')
    train_end,cal_end,as_of=map(day,[data['trainEnd'],data['calibrationEnd'],data['asOf']])
    if not train_end<cal_end<as_of:raise ValueError('invalid_partition_dates')
    excluded=[];eligible=[];seen=set()
    for r in data['records']:
        reasons=evidence_issues(r,data['asOf'],mode)
        if not r.get('id') or r.get('id') in seen:reasons.append('missing_or_duplicate_id')
        seen.add(r.get('id'))
        if r.get('submarket')!=data['submarket']:reasons.append('outside_pilot_submarket')
        if reasons:excluded.append({'id':r.get('id'),'source':r.get('source'),'reasons':sorted(set(reasons))})
        else:eligible.append(r)
    # Training outcomes must already be observable when training occurs.
    train=[r for r in eligible if day(r['saleDate'])<=train_end and (mode=='retrospective' or day(r['availableAt'])<=train_end)]
    cal=[r for r in eligible if train_end<day(r['valuationDate']) and day(r['saleDate'])<=cal_end and (mode=='retrospective' or day(r['availableAt'])<=cal_end)]
    test=[r for r in eligible if cal_end<day(r['valuationDate']) and day(r['saleDate'])<=as_of and (mode=='retrospective' or day(r['availableAt'])<=as_of)]
    # Embargo repeated parcel identities across partitions, including multi-parcel transactions.
    def keys(rows):return {p for r in rows for p in (r.get('parcelIds') or [r['propertyKey']])}
    test_keys=keys(test);cal=[r for r in cal if not set(r.get('parcelIds') or [r['propertyKey']])&test_keys]
    later_keys=keys(cal+test);train=[r for r in train if not set(r.get('parcelIds') or [r['propertyKey']])&later_keys]
    embargo=[]
    if holdout_groups:
        groups={r.get('subdivision') for r in test if r.get('subdivision')}
        if not groups or any(not r.get('subdivision') for r in test):
            return {'status':'blocked_missing_subdivision_identity','marketAccuracyEstablished':False}
        embargo=[r['id'] for r in train+cal if r.get('subdivision') in groups]
        train=[r for r in train if r.get('subdivision') not in groups]
        cal=[r for r in cal if r.get('subdivision') not in groups]
    included_ids={r['id'] for r in train+cal+test}
    unassigned=[r['id'] for r in eligible if r['id'] not in included_ids]
    report=dict(modelVersion=VERSION,mode=mode,holdoutGroups=holdout_groups,datasetSha256=digest(data),
        status='blocked_insufficient_qualified_data',marketAccuracyEstablished=False,
        screenedRecords=len(data['records']),eligibleRecords=len(eligible),
        partitions={'train':len(train),'calibration':len(cal),'test':len(test)},
        excluded=excluded,groupEmbargoIds=embargo,unassignedOrEmbargoedIds=unassigned,
        exclusionCounts=dict(Counter(x for r in excluded for x in r['reasons'])),
        predictions=[],abstentions=[],metrics=None,intervalCoverage=None,
        limitations=['Publicly recovered samples may be selected and unrepresentative.',
          'Engineering sample floors are not evidence of market accuracy.',
          'Temporal calibration intervals have no guaranteed coverage under market drift.',
          'No production promotion or independent appraisal review is implied.'])
    if len(train)<MIN_TRAIN+20 or len(cal)<MIN_CALIBRATION or not test:return report
    # Nested chronological tuning: no calibration/test outcomes influence coefficients or alpha.
    train.sort(key=lambda r:(r['saleDate'],r['id']))
    split=max(MIN_TRAIN,int(len(train)*.75));tune_start=train[split]['valuationDate']
    inner=[r for r in train if r['saleDate']<tune_start and (mode=='retrospective' or r['availableAt']<tune_start)]
    tune=[r for r in train if r['valuationDate']>=tune_start]
    tune_keys=keys(tune);inner=[r for r in inner if not set(r.get('parcelIds') or [r['propertyKey']])&tune_keys]
    tuning=[]
    for alpha in (.1,1.,10.,100.):
        try:model=LandModel(alpha).fit(inner)
        except ValueError as e:
            tuning.append({'alpha':alpha,'error':str(e)});continue
        scored=[]
        for r in tune:
            p=model.predict(r,mode)
            if p['status']=='research_estimate':scored.append({'actual':r['price'],'predicted':p['estimate']})
        m=metrics(scored)
        tuning.append({'alpha':alpha,'scored':len(scored),'targetCount':len(tune),'metrics':m})
    choices=[t for t in tuning if t.get('scored',0)>=10 and t['scored']>=.8*t['targetCount']]
    report['tuning']=tuning
    if not choices:report['status']='blocked_insufficient_tuning_coverage';return report
    chosen=min(choices,key=lambda t:t['metrics']['meanAbsolutePercentageError'])
    try:model=LandModel(chosen['alpha']).fit(train)
    except ValueError as e:report['status']='blocked_model_fit';report['reason']=str(e);return report
    report['model']=model.manifest()
    scores=[];cal_abstentions=[]
    for r in cal:
        p=model.predict(r,mode)
        if p['status']=='research_estimate':scores.append(abs(math.log(r['price']/p['estimate'])))
        else:cal_abstentions.append({'id':r['id'],**p})
    report['calibration']={'scored':len(scores),'abstentions':cal_abstentions,'nominalCoverage':.9}
    if len(scores)<MIN_CALIBRATION:report['status']='blocked_insufficient_interval_calibration';return report
    rank=math.ceil((len(scores)+1)*.9)
    q=sorted(scores)[rank-1]  # finite-sample order statistic; frozen before test evaluation
    report['calibration']['absoluteLogErrorQuantile']=q
    price_baseline=float(np.median([r['price'] for r in train]))
    unit_baseline=float(np.median([r['price']/r['features']['grossAcres']['value'] for r in train]))
    for r in test:
        p=model.predict(r,mode)
        if p['status']!='research_estimate':report['abstentions'].append({'id':r['id'],**p});continue
        estimate=p['estimate'];interval=[estimate*math.exp(-q),estimate*math.exp(q)]
        report['predictions'].append({'id':r['id'],'valuationDate':r['valuationDate'],'saleDate':r['saleDate'],
            'actual':r['price'],'predicted':estimate,'interval90':interval,'intervalCovered':interval[0]<=r['price']<=interval[1],
            'comparables':p['comparables'],'medianPriceBaseline':price_baseline,
            'grossAcreBaseline':unit_baseline*r['features']['grossAcres']['value']})
    report['status']='research_evaluated' if report['predictions'] else 'abstained_all_test_targets'
    report['metrics']=metrics(report['predictions'])
    report['predictionCoverage']=len(report['predictions'])/len(test)
    report['intervalCoverage']=float(np.mean([r['intervalCovered'] for r in report['predictions']])) if report['predictions'] else None
    report['baselines']={k:metrics([{**r,'predicted':r[k]} for r in report['predictions']]) for k in ('medianPriceBaseline','grossAcreBaseline')}
    report['byAcreage']={}
    target_map={r['id']:r for r in test}
    for label,lo,hi in [('under_1_acre',0,1),('1_to_5_acres',1,5),('5_plus_acres',5,math.inf)]:
        rows=[r for r in report['predictions'] if lo<=target_map[r['id']]['features']['grossAcres']['value']<hi]
        report['byAcreage'][label]=metrics(rows)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('output');p.add_argument('--mode',choices=['public_replay','retrospective'],default='public_replay');p.add_argument('--holdout-subdivisions',action='store_true');args=p.parse_args()
    data=json.loads(Path(args.input).read_text());result=evaluate(data,args.mode,args.holdout_subdivisions)
    Path(args.output).write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:result.get(k) for k in ['status','modelVersion','screenedRecords','eligibleRecords','partitions','metrics','intervalCoverage']}))
