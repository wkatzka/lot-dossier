const assert=require('node:assert/strict'),R=require('../lib/public-research');
const rings=[[[-112,41],[-111.99,41],[-111.99,41.01],[-112,41.01],[-112,41]]];
(async()=>{
 const empty=await R.spatial('https://example.org',rings,{},async(u,p)=>p.returnIdsOnly?{objectIds:null}:{count:0});assert.equal(empty.features.length,0);
 await assert.rejects(()=>R.spatial('https://example.org',rings,{},async()=>({objectIds:null})),/Incomplete/);
 await assert.rejects(()=>R.spatial('https://example.org',rings,{},async(u,p)=>p.returnIdsOnly?{objectIds:[1],objectIdFieldName:'OBJECTID'}:{features:[]}),/missing/);
 const cycle=await R.history('111111111',async id=>({url:'https://example.org/'+id,references:[],priorParcels:[id==='111111111'?'222222222':'111111111']}));assert.equal(cycle.records.length,2);assert.equal(cycle.chainComplete,false);
 const fail=await R.history('111111111',async()=>{throw Error('Source down');});assert.equal(fail.status,'partial');assert.equal(fail.gaps.length,1);
 console.log('Public research tests passed: confirmed empty vs failed service, missing record, parent cycle, source failure and incomplete chain status.');
})();
