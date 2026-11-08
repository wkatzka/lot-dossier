import copy,json,unittest
from weber_backtest import OUT,evaluate,predict,validate,metrics

class WeberTest(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((OUT/'sales.json').read_text())
        self.rows=self.data['records']
    def test_price_not_feature(self):
        q=copy.deepcopy(self.rows[-1]); a=predict(self.rows[:5],q)['estimate']
        q['price']=999999999; q['flags']=['cheap']; q['listPrice']=1
        self.assertEqual(a,predict(self.rows[:5],q)['estimate'])
    def test_future_sale_rejected(self):
        with self.assertRaisesRegex(ValueError,'future'):predict(self.rows[-3:],self.rows[0])
    def test_parcel_overlap_rejected(self):
        q=copy.deepcopy(self.rows[-1]);q['parcelIds']=self.rows[0]['parcelIds']
        with self.assertRaisesRegex(ValueError,'leakage'):predict(self.rows[:5],q)
    def test_outside_county_rejected(self):
        q=copy.deepcopy(self.rows[-1]);q['county']='Cook'
        with self.assertRaisesRegex(ValueError,'outside Weber'):predict(self.rows[:5],q)
    def test_duplicates_rejected(self):
        with self.assertRaisesRegex(ValueError,'duplicate'):validate(self.rows+[self.rows[0]])
    def test_frozen_test_outcomes_do_not_change_fit(self):
        r=evaluate(self.data); d=copy.deepcopy(self.data)
        for q in d['records'][5:]:q['price']*=10
        b=evaluate(d)
        self.assertEqual([x['estimate'] for x in r['primary']['predictions']],[x['estimate'] for x in b['primary']['predictions']])
    def test_tolerance_inclusive(self):
        m=metrics([dict(estimate=150000,actual=100000),dict(estimate=49999,actual=100000)])
        self.assertEqual(m['within50k'],1)
    def test_real_records_and_chronology(self):
        r=evaluate(self.data); self.assertEqual(len(self.rows),7)
        for group in ('primary','rolling','sensitivity'):
            for p in r[group]['predictions']:
                for id in p['trainingIds']:
                    train=next(x for x in self.rows if x['id']==id)
                    self.assertLess(train['saleDate'],p['date'])
        self.assertFalse(r['marketAccuracyEstablished'])

if __name__=='__main__':unittest.main()
