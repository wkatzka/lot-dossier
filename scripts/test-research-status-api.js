const assert=require('node:assert/strict'),handler=require('../api/public-research');
async function get(query){let data,status;const headers={};await handler({method:'GET',query},{setHeader:(k,v)=>headers[k]=v,set statusCode(v){status=v;},end:s=>data=JSON.parse(s)});return {status,data,headers};}
(async()=>{
const known=await get({format:'investigation',county:'Weber',parcelId:'224410004'});assert.equal(known.status,200);assert.equal(known.headers['Cache-Control'],'no-store');assert.equal(known.data.investigation.questions[0].status,'investigation_incomplete');assert.equal(known.data.contactFallbackEligible,false);assert(known.data.investigation.questions[0].references.length);
const fresh=await get({format:'investigation',county:'Weber',parcelId:'000000001'});assert.equal(fresh.status,200);assert.equal(fresh.data.status,'investigation_not_started');assert(!JSON.stringify(fresh.data).includes('Cobabe'));
assert.equal((await get({format:'investigation',county:'../../x',parcelId:'1'})).status,400);
console.log('PASS: live status handler preserves parcel scope, explicit not-started state, verified references, validation and uncached responses.');
})().catch(e=>{console.error(e);process.exitCode=1;});
