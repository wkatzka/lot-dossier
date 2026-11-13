const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const I=require('../lib/approval-document-interpreter'),A=require('../lib/automatic-investigation'),S=require('../lib/investigation-store'),D=require('../lib/record-discovery-engine'),P=require('../lib/automatic-research-profile');
const target={county:'Weber',parcelId:'000000002',address:'Synthetic address',subdivision:'Example Ridge Phase 1',lot:'2',municipality:'Ogden Valley City',checkedAt:new Date().toISOString(),source:'https://example.org/parcel'};
const doc={route:'association_libraries',sha256:'a'.repeat(64),urls:['https://example.org/declaration.pdf'],pages:1,unreadPages:[]};
const pages=[{page:1,text:'Example Ridge Phase 1. The Architectural Committee must approve all plans before construction begins. This declaration applies to Lot 2 of Example Ridge Phase 1.'}];
const requirement={authority:'Architectural Committee',requirement:'Written plan approval',quote:'The Architectural Committee must approve all plans before construction begins.',page:1,authorityPage:1,authorityQuote:'The Architectural Committee must approve all plans',applicabilityPage:1,applicabilityQuote:'This declaration applies to Lot 2 of Example Ridge Phase 1.',stage:'construction',limits:[]};
const parsed={documentTitle:'Example declaration',documentStatus:'published_guidelines',summary:'Test source',requirements:[requirement],missingDocuments:[]};
const good=I.validate(parsed,pages,target,doc);assert.equal(good.requirements[0].stage,'construction');assert.equal(good.requirements[0].applicability,'parcel_identified');
assert.equal(I.validate({...parsed,requirements:[{...requirement,stage:'submission'}]},pages,target,doc).requirements[0].stage,'timing_unresolved','Construction wording cannot establish submission');
assert.equal(I.validate({...parsed,requirements:[{...requirement,quote:'A fabricated requirement'}]},pages,target,doc).requirements.length,0);
assert.equal(I.validate({...parsed,requirements:[{...requirement,authority:'The President'}]},pages,target,doc).requirements.length,0);
assert.equal(I.validate({...parsed,requirements:[{...requirement,applicabilityQuote:'An unrelated subdivision'}]},pages,target,doc).requirements[0].applicability,'unresolved');
assert.equal(I.validate({...parsed,requirements:[{...requirement,page:9}]},pages,target,doc).requirements.length,0);
assert.equal(P.significant('Trappers Ridge At Wolf Creek Prud Phase 4').join(' '),'trappers ridge');
(async()=>{
 const old={rpc:S.rpc,run:D.run,interpret:I.interpret,identity:P.identity,profile:P.profile};
 let saved,claimCount=0;
 try{
  const profile={id:'fixture',county:'Weber',parcelId:target.parcelId,scope:'Fixture',hosts:['example.org'],terms:['Example Ridge'],routes:['association_libraries'],seeds:[],references:[],initialLeads:[]};
  S.rpc=async(action,payload)=>{if(action==='claim'){claimCount++;return claimCount===1?{id:'fixture',lease:'lease',checkpoint:{target,profile,state:D.create(profile),pageTexts:{},interpretations:[],interpreted:{},errors:[]}}:null;}if(action==='save'){saved=structuredClone(payload);return {saved:true};}throw Error('Unexpected action');};
  D.run=async(profile,dir)=>{const state=D.create(profile);state.documents=[doc];state.jobs=[{id:'read',route:doc.route,status:'complete'}];D.summarize(state,profile);fs.writeFileSync(path.join(dir,'readings',doc.sha256+'.json'),JSON.stringify({sha256:doc.sha256,pages}));return state;};
  I.interpret=async()=>good;
  const result=await A.tick();assert.equal(result.status,'complete_with_gaps');assert.equal(saved.lease,'lease');assert.equal(saved.result.interpretations[0].requirements[0].stage,'construction');assert(!saved.checkpoint.pageTexts[doc.sha256],'Finished text is not retained indefinitely');assert.equal((await A.tick()).idle,true);
  S.rpc=async(action,payload)=>{if(action==='status')return {id:'existing'};throw Error('Duplicate enqueue');};P.identity=async()=>{throw Error('Existing job should be reused');};assert.equal((await A.enqueue('Weber',target.parcelId)).id,'existing');
  const rendered=require('../web/title-research-view').investigationPanel({...saved.result,automation:{status:'complete_with_gaps',updatedAt:new Date().toISOString()}});assert(rendered.includes('Before construction'));assert(!rendered.includes('Before permit submission'));assert(rendered.includes('declaration.pdf#page=1'));assert(rendered.includes('Confirm recorded parcel membership')===false);assert(rendered.includes('later amendments'));
  console.log('PASS: exact original quotations, authority and parcel checks, stage isolation, durable checkpoint publication, idle workers, deduplicated enqueue and live interpretation rendering.');
 }finally{S.rpc=old.rpc;D.run=old.run;I.interpret=old.interpret;P.identity=old.identity;P.profile=old.profile;}
})().catch(e=>{console.error(e);process.exitCode=1});
