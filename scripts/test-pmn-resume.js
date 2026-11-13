const assert=require('node:assert/strict'),P=require('../lib/pmn'),A=require('../lib/automatic-investigation');
(async()=>{
 let calls=0;const load=async(term,range)=>{calls++;return range.startDate==='2020-01-01'&&range.endDate==='2020-01-04'?Array.from({length:25},(_,i)=>({id:String(i)})):[{id:range.startDate}];};
 const first=await P.searchAll('Example',{startDate:'2020-01-01',endDate:'2020-01-04',maxChecks:1},load);assert.equal(calls,1);assert.equal(first.complete,false);assert.equal(first.pendingRanges.length,2);
 const second=await P.searchAll('Example',{startDate:'2020-01-01',endDate:'2020-01-04',maxChecks:1,checkpoint:first},load);assert.equal(calls,2);assert.equal(second.pendingRanges.length,1);assert.equal(second.checks.length,2);
 const final=await P.searchAll('Example',{startDate:'2020-01-01',endDate:'2020-01-04',maxChecks:1,checkpoint:second},load);assert.equal(calls,3);assert.equal(final.complete,true);assert.equal(final.results.length,27);assert.equal(final.checks.length,3);
 const target={subdivision:'Example Ridge Phase 1',municipality:'Ogden Valley City'};
 assert.equal(A.scopedReference('Development Agreement',target),'Example Ridge Development Agreement');assert.equal(A.scopedReference('Geologic Hazard Map',target,'https://ogdenvalley.gov/planning'),'Ogden Valley City Geologic Hazard Map');assert.equal(A.scopedReference('2628422',target),'2628422');
 console.log('PASS: large notice searches checkpoint their date windows and preserve receipts across requests; generic references are property-qualified.');
})().catch(e=>{console.error(e);process.exitCode=1});
