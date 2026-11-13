/* Plans identify what must be searched; these are not legal determinations. */
const {ROUTES}=require('./public-record-access');
function forProfile(profile,state={}){
 if(profile.researchPlan)return {...profile.researchPlan,county:profile.county,parcelId:profile.parcelId};
 const identifiers=profile.identityTerms||profile.noticeTerms||[];
 const routes=(profile.routes||[]).flatMap(route=>{
  if(route==='public_notice_attachments')return [{route,custodian:'Utah Public Notice Website',source:'https://www.utah.gov/pmn/search.html',scope:'notice_agenda',identifiers:profile.noticeTerms||[],basis:'County-derived subdivision phrase searched across the stated notice date range; notice coverage is not recorder-index coverage.',startDate:profile.startDate,endDate:profile.endDate}];
  if(route==='released_records_archive')return (profile.releasedArchives||[]).flatMap(site=>['requests','documents'].map(resource=>({route,custodian:new URL(site).hostname,source:new URL('/client/'+resource,site).href,scope:'released_'+resource,identifiers:profile.archiveTerms||profile.terms||[],basis:'County parcel and subdivision identifiers searched in the custodian’s released '+resource+' index; unreleased records are outside this scope.'})));
  if(route==='public_mirrors_and_archives'){
   const targets=[...new Set((state.jobs||[]).filter(j=>j.kind==='archive'&&j.status!=='reviewed_not_relevant').map(j=>{try{return new URL(j.url).searchParams.get('url');}catch{return null;}}).filter(Boolean))];
   return [{route,custodian:'Internet Archive',source:'https://web.archive.org/cdx/search/cdx',scope:'archived_url',identifiers:targets,basis:'Exact public URL capture lookups for the planned archive alternatives. A zero result covers only that URL and archive index, not other mirrors or recorder custody.'}];
  }
  const seed=(profile.seeds||[]).find(s=>s.route===route);
  return [{route,custodian:seed?new URL(seed.url).hostname:route,source:seed?.url,scope:'instrument_inventory',identifiers,basis:'Configured source route; instrument-level coverage must be established separately. Visiting this page alone does not establish a searched inventory.'}];
 });
 const q={id:'architectural-authority',question:'Who must approve the plans, and before which permit stage?',
  instrument:'the declaration covering this parcel, its amendments and current architectural-review delegation',
  instrumentId:'architectural-authority-chain',scopeBasis:profile.scope,routes,references:[]};
 // Existing reviewed identity is the only source for this parcel-specific contact. Never infer HOA membership from proximity.
 if(profile.county==='Weber'&&profile.parcelId==='224410004'){
  q.references=[{label:'Cobabe Ranch Owners Association · registered contact',url:'https://services.commerce.utah.gov/hoa/',
   purpose:'Find registration 14305604-HOA1. Ask for the declaration covering Phase 1 Lot 4 and the current architectural committee appointment. John Lewis is the registered president, not a confirmed plan reviewer. Phone: 801-745-3737; email: accounting@wolfcreekresort.com.',
   verification:{url:'https://services.commerce.utah.gov/hoa/',checkedAt:'2026-11-12'}}];
 }
 return {county:profile.county,parcelId:profile.parcelId,questions:[q]};
}
function unconfigured(county,parcelId){
 return {county,parcelId,questions:[{id:'architectural-authority',question:'Who must approve the plans, and before which permit stage?',
  instrument:'the applicable declaration, architectural-review delegation and municipal intake requirements',instrumentId:'architectural-authority-chain',
  routes:ROUTES.map(route=>({route,identifiers:[String(parcelId)]})),references:county==='Weber'?[{label:'Weber County Recorder',url:'https://www.webercountyutah.gov/Recorder_Surveyor/',purpose:'Locate recording references for the parcel and subdivision. This is a source direction, not proof that the recorder holds a particular missing document.',verification:{url:'https://www.webercountyutah.gov/Recorder_Surveyor/',checkedAt:'2026-11-12'}}]:[]}]};
}
module.exports={forProfile,unconfigured};
