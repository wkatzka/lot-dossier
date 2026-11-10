const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/lotreport.js'),'utf8');
function setup({county='29',street='11626 E SUNRIDGE CIR # 15',duplicates=false}={}){
 const calls=[],feature={attributes:{PARCEL_ID:'230480008',PARCEL_ADD:street,PARCEL_ACRES:1.19,SUBDIV_NAME:'Sunridge'},geometry:{rings:[[[-111.67,41.36],[-111.66,41.36],[-111.66,41.37],[-111.67,41.36]]]}};
 const c={console,AbortController,setTimeout,clearTimeout,fetch:async(url,o)=>{
  const q=new URLSearchParams(o.body||'');calls.push({url,q});let features=[];
  if(url.includes('UtahAddressPoints'))features=[{attributes:{FullAdd:'11626 E SUNRIDGE CIR # 15',StreetName:'SUNRIDGE',City:'',ZipCode:'84310',CountyID:'49057'},geometry:{x:-111.669,y:41.361}}];
  if(url.includes('UtahZipCodeAreas'))features=[{attributes:{COUNTYNBR:county}}];
  if(url.includes('Parcels_Weber')&&q.get('where'))features=duplicates&&q.get('where').includes('LIKE')?[feature,{...feature,attributes:{...feature.attributes,PARCEL_ID:'230480009'}}]:[feature];
  return {ok:true,json:async()=>({features,candidates:[]})};
 }};vm.createContext(c);vm.runInContext(source,c);return {lr:c.LotReport,calls};
}
(async()=>{
 let {lr,calls}=setup();const p=await lr.locate('11626 Sunridge Cir, Huntsville, UT 84317');assert.equal(p.id,'230480008');assert.equal(p.attrs.PARCEL_ACRES,1.19);assert.match(p.addressMatchNote,/county parcel situs/);assert(!calls.some(c=>c.url.includes('Parcels_Cache')));
 for(const street of ['11626 E SUNRIDGE DR','11626 E SUNRIDGEVIEW CIR','11626 W SUNRIDGE CIR']){({lr}=setup({street}));await assert.rejects(lr.locate('11626 E Sunridge Cir, Huntsville, UT 84317'),e=>e.notFound&&!e.ambiguous);}
 ({lr,calls}=setup({county:'3'}));await assert.rejects(lr.locate('11626 Sunridge Cir, Logan, UT 84321'),e=>e.notFound&&!e.ambiguous);assert(!calls.some(c=>c.url.includes('Parcels_Weber')));
 ({lr}=setup({duplicates:true}));await assert.rejects(lr.locate('11626 Sunridge Cir, Huntsville, UT 84317'),e=>e.ambiguous&&e.options.length===2&&e.options[0].query==='230480008 Weber County');
 console.log('PASS: ZIP mismatch corroborated by county situs; omitted direction/unit; reject wrong county, street name, suffix and explicit direction; ambiguous parcel choices');
})().catch(e=>{console.error(e);process.exitCode=1});
