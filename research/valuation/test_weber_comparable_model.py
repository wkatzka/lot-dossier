import copy
import json
import unittest
from weber_backtest import OUT
from weber_comparable_model import fit_predict, evaluate


class ComparableTests(unittest.TestCase):
    def test_barn_scenarios_do_not_inflate_primary_count(self):
        data=json.loads((OUT/'sales.json').read_text())
        r=evaluate(data)
        self.assertEqual(r['records'],7)
        self.assertEqual(r['rollingDevelopment']['metrics']['n'],4)
        b=r['conditionalBarnDiagnostic']
        self.assertFalse(b['includedInPrimaryMetrics'])
        self.assertTrue(b['allocationScenarios'][0]['within50k'])
        self.assertFalse(b['allocationScenarios'][1]['within50k'])

    def setUp(self):
        self.data=json.loads((OUT/'sales.json').read_text())
        self.rows=sorted(self.data['records'],key=lambda r:r['saleDate'])

    def test_target_price_and_transaction_remarks_never_used(self):
        a=fit_predict(self.rows[:5],self.rows[5])
        target=copy.deepcopy(self.rows[5]);target.update(price=1,flags=['sold cheaply'],source='unrelated')
        self.assertEqual(a,fit_predict(self.rows[:5],target))

    def test_date_and_parcel_embargo(self):
        for target in (self.rows[3],dict(self.rows[5],parcelIds=self.rows[0]['parcelIds'])):
            with self.assertRaises(ValueError):fit_predict(self.rows[:5],target)

    def test_only_within_market_and_segment_pairs(self):
        result=fit_predict(self.rows[:5],self.rows[5]);byid={r['id']:r for r in self.rows}
        for pair in result['sizePairs']:
            a,b=[byid[i] for i in pair['ids']]
            self.assertEqual(a['region'],b['region']);self.assertEqual(a['segment'],b['segment'])

    def test_monotone_diminishing_size_effect(self):
        train=self.rows[:5];target=self.rows[5]
        a=fit_predict(train,target)['estimate']
        b=fit_predict(train,dict(target,grossAcres=target['grossAcres']*2))['estimate']
        self.assertGreaterEqual(b,a);self.assertLessEqual(b,2*a+1e-7)

    def test_local_anchor_and_joint_support_warning(self):
        r=fit_predict(self.rows[:5],self.rows[5])
        self.assertEqual({c['id'] for c in r['comparableAdjustments']},{'1697726','1735330'})
        self.assertIn('same_submarket_acreage_extrapolation',r['supportWarnings'])
        self.assertIn('no_same_submarket_and_segment_sales',r['supportWarnings'])

    def test_no_fabricated_adjustments_when_pairs_absent(self):
        train=copy.deepcopy(self.rows[:3])
        for i,r in enumerate(train):r['segment']=str(i)
        r=fit_predict(train,self.rows[3])
        self.assertEqual(r['acreageElasticity'],0)
        self.assertIn('acreage_effect_not_identified',r['supportWarnings'])

    def test_nonfinite_values_rejected(self):
        for value in (float('nan'),float('inf'),-1,0):
            train=copy.deepcopy(self.rows[:5]);train[0]['price']=value
            with self.assertRaises(ValueError):fit_predict(train,self.rows[5])

    def test_outside_county_rejected(self):
        with self.assertRaises(ValueError):fit_predict(self.rows[:5],dict(self.rows[5],county='Cook'))

    def test_price_scaling_and_training_order_invariance(self):
        train=self.rows[:5]; target=self.rows[5]
        original=fit_predict(train,target)['estimate']
        self.assertAlmostEqual(original,fit_predict(train[::-1],target)['estimate'])
        scaled=[dict(r,price=r['price']*2) for r in train]
        self.assertAlmostEqual(original*2,fit_predict(scaled,target)['estimate'])

    def test_reused_outcomes_not_called_fresh_validation(self):
        r=evaluate(self.data)
        self.assertEqual(r['newIndependentEvaluationRecords'],0)
        self.assertFalse(r['productionApproved'])
        self.assertEqual(r['rollingDevelopment']['metrics']['n'],4)
        self.assertEqual(r['flaggedTransactionSensitivity']['metrics']['n'],2)
        for p in r['rollingDevelopment']['predictions']:
            self.assertIsNone(p['predictionInterval'])


if __name__=='__main__':unittest.main()
