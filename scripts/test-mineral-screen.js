'use strict';
const assert=require('node:assert/strict'), M=require('../web/mineral-screen');
const rings=[[[-112,40],[-111.999,40],[-111.999,40.001],[-112,40.001],[-112,40]]];
async function main(){
  let requests=[];
  const positive=await M.screen(rings,async p=>{requests.push(p);return p.returnIdsOnly?{objectIds:[1,2]}:{features:[{attributes:{objectid:1,oilgasown:1,coalown:0,otherown:0}},{attributes:{objectid:2,oilgasown:0,coalown:1,otherown:1}}]};});
  assert.equal(JSON.parse(requests[0].geometry).rings[0].length,5);assert.equal(requests[0].geometryType,'esriGeometryPolygon');
  assert.equal(positive.result.records.length,2);assert.equal(positive.result.records[0].coal,'not indicated by this record');
  assert.equal(positive.result.ownershipDetermined,false);assert.equal(positive.findings[0].status,'watch');assert.equal(positive.result.sourceEffectiveDate,null);
  const empty=await M.screen(rings,async()=>({objectIds:[]}));assert.equal(empty.result.status,'retrieved');assert.equal(empty.findings[0].status,'verify');assert.match(empty.findings[0].detail,/does not establish mineral ownership/);
  const confirmedEmpty=await M.screen(rings,async p=>p.returnCountOnly?{count:0}:{objectIds:null});assert.equal(confirmedEmpty.result.status,'retrieved');assert.equal(confirmedEmpty.result.records.length,0);
  const inconsistent=await M.screen(rings,async p=>p.returnCountOnly?{count:1}:{objectIds:null});assert.equal(inconsistent.result.status,'unavailable');
  for(const invalid of [{error:{message:'Unavailable'}},{exceededTransferLimit:true,objectIds:[1]},{objectIds:null},{objectIds:['1']}]){
    const result=await M.screen(rings,async()=>invalid);assert.equal(result.result.status,'unavailable');assert.doesNotMatch(result.findings[0].headline,/No intersecting/);
  }
  const missing=await M.screen(rings,async p=>p.returnIdsOnly?{objectIds:[1,2]}:{features:[{attributes:{objectid:1}}]});assert.equal(missing.result.status,'unavailable');
  const unknown=await M.screen(rings,async p=>p.returnIdsOnly?{objectIds:[1]}:{features:[{attributes:{objectid:1}}]});assert.equal(unknown.result.records[0].oilGas,'unknown');
  const duplicate=await M.screen(rings,async p=>p.returnIdsOnly?{objectIds:[1,2]}:{features:[{attributes:{objectid:1}},{attributes:{objectid:1}}]});assert.equal(duplicate.result.status,'unavailable');
  const pageIds=Array.from({length:201},(_,i)=>i+1);let batches=0;
  const paged=await M.screen(rings,async p=>p.returnIdsOnly?{objectIds:pageIds}:(batches++,{features:p.objectIds.split(',').map(id=>({attributes:{objectid:+id,oilgasown:1,coalown:0,otherown:0}}))}));
  assert.equal(batches,3);assert.equal(paged.result.records.length,201);
  assert.equal((await M.screen([],async()=>{throw Error('should not query');})).result.status,'unavailable');
  assert.throws(()=>M.polygon([[[0,0],[1,0],[1,1],[0,0]]]),/Utah/);
  assert.throws(()=>M.polygon([[[-112,40],[-111,40],[-111,41],[-112,41]]]),/closed/);
  console.log('Mineral screen passed: full polygon, commodity distinctions, empty vs failed source, missing/duplicate/truncated records, pagination, unknown attributes, invalid geometry, no ownership all-clear.');
  if(process.argv.includes('--live')){
    const q=new URLSearchParams({f:'json',where:'1=1',outFields:'objectid',returnGeometry:'true',outSR:'4326',resultRecordCount:'1'});
    const response=await fetch(M.SOURCE+'/query?'+q,{signal:AbortSignal.timeout(20000)});const d=await response.json();assert(d.features&&d.features.length);
    const sample=d.features[0], live=await M.lookup(sample.geometry.rings);assert(live.records.some(r=>r.sourceId===sample.attributes.objectid));
    console.log(JSON.stringify({live:'verified against public source polygon',matchedRecords:live.records.length,includesKnownSourceRecord:true,retrievedAt:live.retrievedAt}));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
