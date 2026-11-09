const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const V=require('../web/weber-value');
const rows=require('../docs/research/backtest/weber/sales.json').records;
const results=require('../docs/research/backtest/weber/development-v2.json');
for(const p of results.frozenDevelopment.predictions){
 const target=rows.find(r=>r.id===p.id),actual=V.predict(rows.slice(0,5),target);
 assert.ok(Math.abs(actual.estimate-p.estimate)<.00001,'Python / browser model parity');
 assert.equal(actual.estimate,V.predict(rows.slice(0,5),{...target,price:1}).estimate);
}
assert.throws(()=>V.predict(rows,{county:'Davis',grossAcres:1}));
assert.throws(()=>V.predict(rows,{county:'Weber',grossAcres:NaN}));
assert.throws(()=>V.predict(rows,{county:'Weber',grossAcres:1,region:null,saleDate:'2026-11-07'}));
const own=V.predict(rows,{...rows[0],parcelIds:['220100021'],saleDate:'2026-11-07'});
assert.ok(!own.comps.some(c=>c.id===rows[0].id),'Exclude subject own sale despite parcel formatting');
const report={parcel:{county:'Weber',id:'test',attrs:{PARCEL_CITY:'Liberty',PARCEL_ACRES:3}},facts:{}};
assert.equal(V.subject(report).region,'Ogden Valley');
const root={WeberValue:V,LandValue:require('../web/land-value'),LR_DATA:{weberValue:{records:rows,metrics:{rollingDevelopment:results.rollingDevelopment.metrics,flaggedTransactionSensitivity:results.flaggedTransactionSensitivity.metrics}}}};
vm.runInNewContext(fs.readFileSync('web/research-workspace.js','utf8'),{window:root,document:{addEventListener(){}}});
const output=root.ResearchWorkspace.render('valuation',{report,evidence:{runs:[]}});
assert.match(output,/historical-price reference/);assert.match(output,/3 of 4/);assert.match(output,/0 of 2/);
assert.match(output,/not independent validation/);assert.match(output,/Residual development scenario/);
console.log('Weber browser parity, scope, self-sale exclusion and economics rendering passed');
const diagnostic=V.diagnostics(rows,{...rows[0],parcelIds:['different'],saleDate:'2026-11-09'});
assert(diagnostic.range&&diagnostic.maxChange>=0);
assert.equal(diagnostic.confidenceInterval,false);
assert.equal(diagnostic.independentValidation,false);
assert.equal(diagnostic.leaveOneOut.length,rows.length);
assert.match(output,/How sensitive is this property/);
console.log('Property-specific delete-one sensitivity and honest interval labeling passed');
