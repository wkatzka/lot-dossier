const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/lotreport.js'),'utf8');
function setup({score=98,wrongDirection=false,zipCode='29'}={}){
 const calls=[];const ctx={console,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{
  const q=new URLSearchParams(options.body||'');calls.push({url,q});let features=[];
  if(url.includes('UtahZipCodeAreas'))features=[{attributes:{COUNTYNBR:zipCode}}];
  if(url.includes('Parcels_Weber')&&q.get('where').includes('IN'))features=[{attributes:{PARCEL_ID:'201230001',PARCEL_ACRES:5},geometry:{rings:[[[-111.79,41.28],[-111.78,41.28],[-111.79,41.29],[-111.79,41.28]]]}}];
  if(url.includes('Parcels_Weber')&&q.get('geometry'))features=[{attributes:{PARCEL_ID:'201230001',PARCEL_ACRES:5,SUBDIV_NAME:'Eden Lake Meadows'}},{attributes:{PARCEL_ID:'201220002',PARCEL_ACRES:5}}];
  if(url.includes('findAddressCandidates'))return {ok:true,json:async()=>({candidates:[{score,location:{x:-111.794,y:41.282},attributes:{AddNum:'1248',StName:'6300',StPreDir:'N',StDir:wrongDirection?'W':'E',Addr_type:'StreetAddress'}}]})};
  return {ok:true,json:async()=>({features})};
 }};vm.createContext(ctx);vm.runInContext(source,ctx);return {lr:ctx.LotReport,calls};
}
(async()=>{
 let {lr,calls}=setup();await assert.rejects(lr.locate('1248 N 6300 E, Eden, UT 84310'),e=>e.ambiguous&&e.options.some(o=>o.query==='201230001 Weber County'));
 assert(!calls.some(c=>c.url.includes('Parcels_Cache')||c.url.includes('UtahCountyBoundaries')));
 assert(lr.looksLikeParcel('20-123-0001 Weber County'));
 assert.equal((await lr.locate('20-123-0001 Weber County')).id,'201230001');
 for(const settings of [{score:60},{wrongDirection:true}]){const {lr}=setup(settings);await assert.rejects(lr.locate('1248 N 6300 E, Eden, UT 84310'),e=>e.notFound&&!e.ambiguous);}
 ({lr,calls}=setup({zipCode:'3'}));await assert.rejects(lr.locate('1248 N 6300 E, Eden, UT 84310, Weber County'),e=>e.ambiguous);assert(!calls.some(c=>c.url.includes('Parcels_Cache')));
 console.log('PASS: correct ZIP county, explicit county precedence, qualified parcel IDs, candidate confirmation, low-score and direction mismatch rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
