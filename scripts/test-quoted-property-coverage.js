const assert=require('node:assert/strict'),C=require('../lib/quoted-property-coverage');const target={parcelId:'000000068',lot:'68',subdivision:'Example Ridge PRUD Phase 4'};
assert.equal(C.match('All of Lots 46 through 68 and all Common Area as shown on Example Ridge, Phase 4.',target),'parcel_identified');
assert.equal(C.match('All of Lots 46 through 67 and all Common Area as shown on Example Ridge, Phase 4.',target),'subdivision_identified');
assert.equal(C.match('All of Lots 46 through 68 in Example Ridge, Phase 3. All of Lots 70 through 80 in Example Ridge, Phase 4.',target),'subdivision_identified');
assert.equal(C.match('Lot 68, Example Ridge, Phase 3.',target),'subdivision_identified');
assert.equal(C.match('All of Lots 46 through 68, Other Ridge, Phase 4.',target),'unresolved');
assert.equal(C.match('All of Lots 46 through 68 in Example Ridge.',target),'subdivision_identified');
assert.equal(C.match('Parcel 000000068 is subject to this agreement.',target),'parcel_identified');
assert.equal(C.match('Parcel 10000000680 is subject to this agreement.',target),'unresolved');
console.log('PASS: explicit lot ranges match only within the cited subdivision/phase clause; other phases, nearby parcels and excluded endpoints are not parcel proof.');

assert.equal(C.match('All of Lots 46 through 68 in Example Ridge, Phase 4.',{...target,subdivision:'Example Ridge'}),'subdivision_identified');
