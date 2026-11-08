"""Evidence gates, missing-data behavior and the user's dollar tolerance."""
import copy,json,unittest
from pathlib import Path
from qualification import qualify
from backtest import metrics,evaluate
from test_model import fixture
from public_benchmark import PartialLandModel,evaluate as evaluate_public

class QualificationTests(unittest.TestCase):
    def test_retrospective_does_not_require_optional_features(self):
        r=fixture()['records'][0];r['features']={};r['availableAt']=None;r['transactionConditions']='reported_market'
        self.assertTrue(qualify(r,'2026-11-07')['eligible'])
        self.assertFalse(qualify(r,'2026-11-07','public_replay')['eligible'])
    def test_missing_date_does_not_hide_missing_price(self):
        r=fixture()['records'][0];r['saleDate']=None;r['price']=None
        reasons=qualify(r,'2026-11-07')['reasons']
        self.assertIn('missing_closing_price',reasons);self.assertIn('missing_or_invalid_sale_dates',reasons)
    def test_asking_price_and_buildings_stay_excluded(self):
        r=fixture()['records'][0];r['priceType']='asking_price';r['propertyType']='improved'
        reasons=qualify(r,'2026-11-07')['reasons']
        self.assertIn('closing_price_not_verified',reasons);self.assertIn('not_documented_land_only',reasons)
    def test_future_features_omitted_not_imputed(self):
        r=fixture()['records'][0];r['features']['water']['effectiveAt']='2030-01-01'
        q=qualify(r,'2026-11-07');self.assertTrue(q['eligible']);self.assertNotIn('water',q['usableFeatures'])
    def test_tolerance_is_inclusive_absolute_dollars(self):
        m=metrics([{'actual':100000,'predicted':150000},{'actual':100000,'predicted':49999}])
        self.assertEqual(m['within50000'],.5)
    def test_point_error_without_interval_calibration(self):
        d=fixture();d['records']=d['records'][:160]+d['records'][195:]
        r=evaluate(d)
        self.assertEqual(r['status'],'research_evaluated');self.assertIsNotNone(r['metrics'])
        self.assertIsNone(r['intervalCoverage']);self.assertTrue(all(p['interval90'] is None for p in r['predictions']))
    def test_actual_pilot_audit_not_zero(self):
        p=Path(__file__).resolve().parents[2]/'docs/research/backtest/qualification-audit.json'
        d=json.loads(p.read_text())['modes']['retrospective']
        self.assertEqual(d['eligibleRecords'],3);self.assertEqual(d['exclusionCounts']['missing_closing_price'],13)
    def test_partial_model_does_not_need_all_attributes(self):
        rows=[{'actual':100000+i*1000,'features':{'latitude':41+i*.001,'longitude':-87.,'marketYear':2021.,'township':'1','grossAreaLog':None}} for i in range(80)]
        m=PartialLandModel().fit(rows);self.assertNotIn('grossAreaLog',m.columns)
        self.assertTrue(all(x>0 for x in m.predict(rows[:2])))

    def test_real_public_holdout_prices_do_not_change_predictions(self):
        folder=Path(__file__).resolve().parents[2]/'docs/research/backtest'
        rows=json.loads((folder/'public-benchmark-modern-input.json').read_text())
        stored=json.loads((folder/'public-benchmark-modern-result.json').read_text())
        changed=copy.deepcopy(rows)
        for r in changed:
            if r['saleDate'].startswith('2024'):r['actual']*=3
        result=evaluate_public(changed,{},True)
        self.assertEqual(result['model'],stored['model'])
        self.assertEqual(result['calibration'],stored['calibration'])
        self.assertEqual([p['predicted'] for p in result['predictions']], [p['predicted'] for p in stored['predictions']])
        train_ids=set(result['model']['trainingIds'])
        self.assertFalse(train_ids & {r['id'] for r in result['predictions']})
        test_parcels={r['propertyKey'] for r in result['predictions']}
        self.assertFalse(test_parcels & {r['propertyKey'] for r in rows if r['id'] in train_ids})
        self.assertTrue(all(r['featureYear']<int(r['saleDate'][:4]) for r in rows))

if __name__=='__main__':unittest.main()
