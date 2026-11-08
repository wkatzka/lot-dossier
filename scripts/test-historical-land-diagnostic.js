const assert = require('node:assert/strict');
const {diagnose} = require('./diagnose-historical-land-sales');
const seed = require('../docs/research/backtest/historical-sales-seed.json');
const r = diagnose(seed);
assert.equal(r.predictions.length,1);
assert.equal(r.predictions[0].id,'1586757');
assert.deepEqual(r.predictions[0].comparableIds,['1519709','1603980']);
assert.equal(r.excluded[0].id,'1573992');
assert.equal(r.marketAccuracyEstablished,false);
assert.equal(r.productionModelTested,false);
assert.equal(r.publicInformationReplay,false);
assert.equal(r.predictions[0].actual,835000);
assert.ok(Math.abs(r.predictions[0].predicted-((330000/5.05+947500/10.8)/2*17.26))<.001);
// Target outcome cannot influence its own prediction.
const changed = structuredClone(seed);
changed.records[0].soldPrice=100000;
assert.equal(diagnose(changed).predictions[0].predicted,r.predictions[0].predicted);
// Repeated parcels cannot enter the prior-comparable group.
changed.records[1].parcelIds=changed.records[0].parcelIds;
assert.equal(diagnose(changed).predictions.length,0);
assert.equal(diagnose({records:[]}).descriptiveMetrics,null);
console.log('Historical diagnostic checks passed; not evidence of valuation accuracy.');
