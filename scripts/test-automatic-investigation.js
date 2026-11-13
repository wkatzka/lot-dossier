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
const checklistPages=[{page:1,text:'Ogden Valley City Building Permit Submission Requirements'}, {page:2,text:'Water Company Will Serve Letter or Approved Well Permit - Will serves must be specific to the building lot.'}];
const checklistClause={...requirement,authority:'Water Company',authorityQuote:checklistPages[1].text,authorityPage:2,quote:checklistPages[1].text,page:2,stage:'submission',stageQuote:checklistPages[0].text,stagePage:1,applicabilityQuote:checklistPages[0].text,applicabilityPage:1,appliesWhen:'New dwelling with water service'};
assert.equal(I.validate({...parsed,requirements:[checklistClause]},checklistPages,target,{...doc,urls:['https://ogdenvalley.gov/checklist.pdf']}).requirements[0].stage,'submission');
assert.equal(I.validate({...parsed,requirements:[checklistClause]},checklistPages,target,doc).requirements[0].stage,'timing_unresolved','A private checklist heading does not establish municipal intake');
const inspectionText='Beacon Code Consultants: This inspection must be passed prior to installing insulation.';
const inspection=I.validate({...parsed,requirements:[{...requirement,authority:'Beacon Code Consultants',authorityQuote:inspectionText,quote:inspectionText}]},[{page:1,text:inspectionText}],target,doc);
assert.equal(inspection.requirements[0].stage,'construction_inspection','In-progress inspections do not become pre-permit approvals');
const priorInspection='The Architectural Committee requires site inspection approval before construction begins.';
assert.equal(I.validate({...parsed,requirements:[{...requirement,quote:priorInspection,authorityQuote:priorInspection}]},[{page:1,text:priorInspection}],target,doc).requirements[0].stage,'construction');
assert.equal(I.refineTiming({stage:'timing_unresolved',quote:'No activities shall commence on any portion of an Owner’s property until an application for approval has been submitted to and finally approved by the DRB'}).stage,'construction');
assert.equal(I.refineTiming({stage:'submission',quote:'Any requests for variances shall be submitted following review and approval by the Design Review Board.'}).stage,'other_submission');
const effectText='The Declarant hereby terminates the reserved appointment rights effective January 1, 2020.';
const effect=I.validate({...parsed,requirements:[],authorityChanges:[{kind:'termination',affectedAuthority:'Declarant',description:'Appointment rights terminate',quote:effectText,page:1,dateQuote:'effective January 1, 2020',datePage:1}]},[{page:1,text:effectText}],target,doc);assert.equal(effect.authorityChanges.length,1);assert.equal(effect.authorityChanges[0].dateQuote,'effective January 1, 2020');assert.equal(effect.effectExtractionVersion,1);
assert.equal(I.validate({...parsed,requirements:[],authorityChanges:[{...effect.authorityChanges[0],quote:'Unsupported termination clause'}]},[{page:1,text:effectText}],target,doc).authorityChanges.length,0);
assert.equal(P.significant('Trappers Ridge At Wolf Creek Prud Phase 4').join(' '),'trappers ridge');
(async()=>{
 const identity=await P.identity('Weber','000000002',{
  record:async()=>({subdivision:'Example Ridge',lot:'2'}),
  request:async url=>{
   const u=new URL(url);
   if(u.pathname.includes('Municipal')){
    assert.equal(u.searchParams.get('geometryType'),'esriGeometryPolygon');
    return {ok:true,json:async()=>({features:[{attributes:{NAME:'Ogden Valley City'}}]})};
   }
   return {ok:true,json:async()=>({features:[{attributes:{PARCEL_ADD:'Example',SUBDIV_NAME:'Example Ridge'},geometry:{rings:[[[0,0],[1,0],[1,1],[0,0]]]}}]})};
  }
 });
 assert.equal(identity.municipality,'Ogden Valley City');assert.equal(identity.municipalityAmbiguous,false);
 const dynamicProfile=await P.profile({...target,countyRecord:{url:'https://webercountyutah.gov/parcelsearch/ownership-info.php?id=000000002'}},{request:async()=>new Response('<html><body><a href="https://new-neighborhood.org/documents">Example Ridge HOA</a><a href="https://127.0.0.1/private">Example Ridge private</a></body></html>',{status:200,headers:{'content-type':'text/html'}})});
 assert(dynamicProfile.hosts.includes('new-neighborhood.org'));assert(!P.HOSTS.includes('new-neighborhood.org'));assert(dynamicProfile.seeds.some(s=>s.url==='https://new-neighborhood.org/documents'));assert(!dynamicProfile.hosts.includes('127.0.0.1'));assert(dynamicProfile.discoveredHosts[0].source.includes('neighborhood-hoas'));
 const leadProfile={id:'leads',hosts:['example.org']},leadState=D.create(leadProfile);leadState.externalLeads=[{url:'https://public-files.example.org/original.pdf',from:'https://example.org/library',route:'association_libraries',status:'requires_source_review'},{url:'https://127.0.0.1/private.pdf',from:'https://example.org/library',route:'association_libraries',status:'requires_source_review'}];A.admitDocumentLeads({profile:leadProfile,state:leadState});assert(leadProfile.hosts.includes('public-files.example.org'));assert(!leadProfile.hosts.includes('127.0.0.1'));assert.equal(leadState.jobs.length,1);assert.equal(leadState.profileHash,D.create(leadProfile).profileHash);
 const synthesis=require('../lib/investigation-synthesis'),oldSynthesize=synthesis.synthesize;synthesis.synthesize=async()=>({version:1,findings:[],missingEvidence:[]});
 const old={rpc:S.rpc,run:D.run,interpret:I.interpret,identity:P.identity,profile:P.profile};
 let saved,claimCount=0;
 try{
  const profile={id:'fixture',county:'Weber',parcelId:target.parcelId,scope:'Fixture',hosts:['example.org'],terms:['Example Ridge'],routes:['association_libraries'],seeds:[],references:[],initialLeads:[]};
  S.rpc=async(action,payload)=>{if(action==='claim'){claimCount++;return claimCount===1?{id:'fixture',lease:'lease',checkpoint:{target,profile,state:D.create(profile),pageTexts:{},interpretations:[],interpreted:{},errors:[]}}:null;}if(action==='save'){saved=structuredClone(payload);return {saved:true};}throw Error('Unexpected action');};
  D.run=async(profile,dir)=>{const state=D.create(profile);state.documents=[doc];state.jobs=[{id:'read',route:doc.route,status:'complete'}];D.summarize(state,profile);fs.writeFileSync(path.join(dir,'readings',doc.sha256+'.json'),JSON.stringify({sha256:doc.sha256,pages}));return state;};
  I.interpret=async()=>good;
  const result=await A.tick();assert.equal(result.status,'complete_with_gaps');assert.equal(saved.lease,'lease');assert.equal(saved.result.interpretations[0].requirements[0].stage,'construction');assert(!saved.checkpoint.pageTexts[doc.sha256],'Finished text is not retained indefinitely');assert.equal((await A.tick()).idle,true);
  const repairState=D.create(profile);repairState.documents=[structuredClone(doc)];
  S.rpc=async(action,payload)=>{if(action==='claim')return {id:'repair',lease:'repair-lease',checkpoint:{target,profile,state:repairState,pageTexts:{},interpretations:[{...good,requirements:[],rejected:['Quote mismatch']}],interpreted:{[doc.sha256]:true},errors:[]}};if(action==='save'){saved=structuredClone(payload);return {saved:true};}throw Error('Unexpected repair action');};
  I.interpret=async(p,t,d,options)=>{assert.deepEqual(options.feedback,['Quote mismatch']);return good;};
  await A.tick();assert.equal(saved.checkpoint.validationRetries[doc.sha256],1);assert.equal(saved.checkpoint.supersededInterpretations.length,1);assert.equal(saved.result.interpretations[0].requirements.length,1);
  S.rpc=async(action,payload)=>{if(action==='status')return {id:'existing'};throw Error('Duplicate enqueue');};P.identity=async()=>{throw Error('Existing job should be reused');};assert.equal((await A.enqueue('Weber',target.parcelId)).id,'existing');
  const rendered=require('../web/title-research-view').investigationPanel({...saved.result,automation:{status:'complete_with_gaps',updatedAt:new Date().toISOString()}});assert(rendered.includes('Before construction'));assert(!rendered.includes('Before permit submission'));assert(rendered.includes('declaration.pdf#page=1'));assert(rendered.includes('Confirm recorded parcel membership')===false);assert(rendered.includes('later amendments'));
  console.log('PASS: exact original quotations, authority and parcel checks, stage isolation, durable checkpoint publication, idle workers, deduplicated enqueue and live interpretation rendering.');
 }finally{synthesis.synthesize=oldSynthesize;S.rpc=old.rpc;D.run=old.run;I.interpret=old.interpret;P.identity=old.identity;P.profile=old.profile;}
})().catch(e=>{console.error(e);process.exitCode=1});

assert.equal(I.refineTiming({stage:'timing_unresolved',quote:'As a general rule, if work is covered or concealed, it must be inspected prior to covering.'}).stage,'construction_inspection');
