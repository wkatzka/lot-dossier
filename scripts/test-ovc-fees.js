/* Ogden Valley City fees from the records obtained Nov 17, 2026:
   - Resolution 2026-28 (fee schedule): same valuation table as Weber County, plan review 50%, trades $125 x 3, 1% surcharge.
   - Resolution 2026-25 (EVO agreement): impact fees locked at roads $1,200 + storm $1,234.71 + trails $2,886.21
     for permits under EVO's MDAs, until June 2, 2029 or 75 more permits; fire fee not covered.
   Figures checked against a hand calculation. No network. */
const assert=require('node:assert/strict');require('../web/lotreport.js');const L=globalThis.LotReport;
const kb=L.JURIS['Ogden Valley City'],near=(a,b,msg)=>assert(Math.abs(a-b)<0.01,msg+': '+a+' vs '+b);

// 1. Typical 3,500 sq ft house + 800 sq ft garage: valuation $679,137, permit fee $4,088.75.
const city=L.buildingFees(3500,800,kb.permitFees.schedule),county=L.buildingFees(3500,800);
near(city.valuation,679137,'valuation');near(city.permit,4088.75,'permit fee (same table as Weber County)');
near(city.planReview,2044.375,'plan review is 50% of the permit fee');assert.equal(city.trades,375,'electrical, plumbing, mechanical $125 each');
near(city.surcharge,40.8875,'1% state surcharge on the permit fee only');near(city.total,6549.0125,'city total');assert.equal(city.local,true);
near(county.total,5910.7,'Weber County floor unchanged');assert.equal(county.local,false);
console.log('PASS: Ogden Valley building fees follow Resolution 2026-28: $6,549 on a typical house (Weber County floor was $5,911).');

// 2. The EVO agreement on a matching lot: impact fees shown as a range with the locked rate, and what to confirm.
const ag=kb.feeAgreements[0],cityImpact=kb.impact.reduce((t,x)=>t+x[1],0),locked=ag.locked.reduce((t,x)=>t+x[1],0),fire=kb.fireImpact[0];
near(locked,5320.92,'locked single-family rate');near(cityImpact,9189.89,'city impact fees');
const row=()=>({item:'Permit & impact fees',status:'watch',headline:'Impact fees about $'+Math.round(cityImpact+fire).toLocaleString('en-US')+' + building permit and plan review from about $6,549',detail:'City rates.',next_step:'Submit.',cost:{key:'permit_impact_fees',low:Math.round(cityImpact+fire+city.total),high:Math.round(cityImpact+fire+city.total*1.2),label:'Impact fees'}});
let f=[row()];L.applyFeeAgreements(f,kb,'EDEN VALLEY OPPORTUNITY LLC',null);
assert.equal(f[0].headline,'Impact fees about $6,025 to $9,894 + building permit and plan review from about $6,549');
assert.match(f[0].detail,/applies to all permits issued under each MDA, not only permits EVO pulls itself/);
assert.match(f[0].detail,/about \$5,321 instead of \$9,190, plus the \$704 fire fee either way/);
assert.match(f[0].detail,/no third-party beneficiaries/);
assert.match(f[0].next_step,/confirm this lot is under an Eden Valley Opportunity \(EVO\) MDA.*ends after 75 more permits or on June 2, 2029/);
assert.equal(f[0].cost.low,Math.round(locked+fire+city.total));assert.match(f[0].cost.label,/low end assumes the Resolution 2026-25 fee lock/);
// Not EVO: nothing changes.
f=[row()];L.applyFeeAgreements(f,kb,'SOME OTHER DEVELOPER',null);assert.equal(f[0].detail,'City rates.');
console.log('PASS: on an EVO lot the fee row shows $6,025 to $9,894 in impact fees, says who the lock covers and until when, and what to confirm in writing.');
