"""Synthetic engineering tests only; never market accuracy evidence."""
import copy
from datetime import date,timedelta
import math
import unittest
import numpy as np
from model import LandModel, evidence_issues, residual_dcf
from backtest import evaluate

def fixture():
    rng=np.random.default_rng(442);rows=[]
    start=date(2020,1,1)
    for i in range(240):
        d=start+timedelta(days=i*5)
        area=float(rng.uniform(.4,5));slope=float(rng.uniform(0,25));bf=float(rng.uniform(.3,.95))
        f=dict(grossAcres=area,permittedUnits=1,buildableFraction=bf,slopePercent=slope,
               latitude=float(rng.uniform(41.25,41.3)),longitude=float(rng.uniform(-111.85,-111.8)),
               water='connected' if i%2 else 'available',sewer='public' if i%3 else 'septic',
               access='public_road',entitlement='platted',zoningClass='residential',viewClass='lake' if i%4 else 'mountain',hazardClass='none_mapped')
        price=math.exp(12+.43*math.log(area)+.35*bf-.012*slope+.18*(f['water']=='connected')+.09*(f['viewClass']=='lake')+.00007*i*5+float(rng.normal(0,.04)))
        evidence={k:dict(value=v,source='https://example.org/synthetic',effectiveAt='2019-01-01',availableAt='2019-01-01') for k,v in f.items()}
        rows.append(dict(id=str(i),propertyKey=str(i),subdivision='block'+str(i%8),submarket='synthetic',propertyType='vacant_residential_land',
            valuationDate=d.isoformat(),saleDate=(d+timedelta(days=1)).isoformat(),availableAt=(d+timedelta(days=2)).isoformat(),
            price=price,priceType='closed_price',priceVerified=True,transactionConditions='ordinary_market',source='https://example.org/synthetic',features=evidence))
    return dict(submarket='synthetic',records=rows,trainEnd=rows[159]['availableAt'],calibrationEnd=rows[199]['availableAt'],asOf='2024-01-01')

class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=fixture();cls.result=evaluate(cls.data)
    def test_end_to_end(self):
        r=self.result
        self.assertEqual(r['status'],'research_evaluated')
        self.assertGreater(len(r['predictions']),20)
        self.assertLess(r['metrics']['meanAbsolutePercentageError'],15)
        self.assertFalse(r['marketAccuracyEstablished'])
        self.assertTrue(0<=r['intervalCoverage']<=1)
        self.assertEqual(r['modelVersion'],'land-hedonic-comparables-v1')
    def test_holdout_prices_do_not_change_model_or_intervals(self):
        d=copy.deepcopy(self.data)
        for r in d['records'][200:]:r['price']*=2
        changed=evaluate(d)
        self.assertEqual(changed['model']['signature'],self.result['model']['signature'])
        self.assertEqual(changed['calibration'],self.result['calibration'])
        self.assertEqual([r['predicted'] for r in changed['predictions']],[r['predicted'] for r in self.result['predictions']])
    def test_explanation_and_nonlinear_area(self):
        p=self.result['predictions'][0]
        for c in p['comparables']:
            self.assertAlmostEqual(c['adjustedIndication'],c['salePrice']*math.exp(sum(c['logAdjustments'].values())),places=5)
            self.assertAlmostEqual(c['adjustedIndication']-c['salePrice'],sum(a['sequentialDollarEffect'] for a in c['adjustmentWaterfall']),places=5)
        self.assertAlmostEqual(sum(c['weight'] for c in p['comparables']),1)
        self.assertNotAlmostEqual(p['predicted'],p['grossAcreBaseline'])
    def test_evidence_and_price_types(self):
        r=copy.deepcopy(self.data['records'][0]);r['priceType']='asking_price'
        self.assertIn('closing_price_not_verified',evidence_issues(r,self.data['asOf']))
        r['features']['water']['availableAt']='2025-01-01'
        self.assertIn('feature_not_public_at_valuation:water',evidence_issues(r,self.data['asOf']))
        self.assertNotIn('feature_not_public_at_valuation:water',evidence_issues(r,self.data['asOf'],'retrospective'))
        r['features']['water']['effectiveAt']='2025-01-01'
        self.assertIn('future_feature:water',evidence_issues(r,self.data['asOf'],'retrospective'))
    def test_unsupported_target(self):
        m=LandModel(1).fit(self.data['records'][:160]);r=copy.deepcopy(self.data['records'][200]);r['features']['grossAcres']['value']=500
        self.assertEqual(m.predict(r)['status'],'abstain')
        r=copy.deepcopy(self.data['records'][200]);r['features']['entitlement']['value']='unapproved'
        self.assertEqual(m.predict(r)['status'],'abstain')
    def test_no_data_is_not_zero_error(self):
        d=copy.deepcopy(self.data);d['records']=[]
        r=evaluate(d);self.assertEqual(r['status'],'blocked_insufficient_qualified_data');self.assertIsNone(r['metrics'])
    def test_repeat_parcels_embargoed(self):
        d=copy.deepcopy(self.data)
        d['records'][0]['parcelIds']=['shared-parcel']
        d['records'][200]['parcelIds']=['shared-parcel']
        r=evaluate(d)
        self.assertNotIn('0',r['model']['trainingIds'])
    def test_publication_delay(self):
        d=copy.deepcopy(self.data)
        for r in d['records'][:160]:r['availableAt']='2024-01-01'
        r=evaluate(d)
        self.assertEqual(r['partitions']['train'],0)
        self.assertIsNone(r['metrics'])
    def test_group_embargo(self):
        r=evaluate(self.data,holdout_groups=True)
        self.assertEqual(r['partitions']['train'],0)
        self.assertIsNone(r['metrics'])
    def test_dcf_timing_and_double_count(self):
        s=dict(annualRequiredReturn=.1,rateBasis='synthetic hurdle',acquisitionRate=.02,acquisitionBasis='synthetic fees',cashflows=[
            dict(id='sale',kind='sale_proceeds',amount=1000000,month=12,basis='synthetic proceeds'),
            dict(id='build',kind='construction',amount=-500000,month=0,basis='synthetic costs')])
        r=residual_dcf(s);self.assertAlmostEqual(r['landBudget'],(1000000/1.1-500000)/1.02)
        s['cashflows'][1]['kind']='profit'
        with self.assertRaises(ValueError):residual_dcf(s)

if __name__=='__main__':unittest.main()
