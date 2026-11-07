/* Dated evidence inventory. Extraction, applicability and legal completeness are separate states. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)), required=(v,m)=>{if(!v)throw Error(m);};
const safeUrl=u=>/^https:\/\//i.test(u||'');
function discover(report){
 const facts=report.facts||{}, records=[],sources=[],gaps=[];
 function add(entry,citation,kind){
  if(!/^\d{5,9}$/.test(String(entry)))return;
  let r=records.find(r=>r.entry===String(entry));if(!r){r={id:'entry-'+entry,entry:String(entry),kind:kind||'unclassified',citations:[],state:'missing_instrument',instrument:null,review:null,relationships:[],geometry:null};records.push(r);}
  if(!r.citations.some(c=>JSON.stringify(c)===JSON.stringify(citation)))r.citations.push(citation);
 }
 const research=facts.publicResearch||{};
 const discovery=facts.documentDiscovery||{};
 for(const ref of (discovery.record||{}).references||[])add(ref.entry,{url:discovery.record.parcelPage,scope:'subject parcel reference'},ref.label||ref.kind);
 for(const ref of ((discovery.record||{}).plat||{}).entries||[])add(ref.entry,{url:ref.url||discovery.record.parcelPage,scope:'recorded plat reference'},ref.label);
 for(const doc of discovery.documents||[])for(const covenant of doc.ccrs||[])for(const entry of covenant.entries||[])add(entry,{url:doc.url,excerpt:covenant.text,scope:'public meeting document; current lot applicability unverified'},covenant.title);

 for(const doc of discovery.documents||[])for(const covenant of doc.ccrs||[]){const ids=(covenant.entries||[]).map(String);for(const entry of ids){const record=records.find(r=>r.entry===entry);if(record)record.relatedReferenceCandidates=ids.filter(x=>x!==entry).map(x=>({entry:x,state:'relationship_unverified',url:doc.url}));}}
 for(const row of (research.history||{}).records||[])for(const ref of row.references||[])add(ref.entry,{url:row.url,parcelId:row.parcelId,date:ref.date||null,scope:row.depth?'parent parcel':'subject parcel'},ref.label||ref.kind);
 for(const d of (facts.publicSurveys||{}).documents||[]){
  if(d.error){gaps.push('Survey '+d.recordNumber+': '+d.error);continue;}
  sources.push({id:'survey-'+d.recordNumber,url:d.url,hash:d.sha256,retrievedAt:d.retrievedAt,pagesRead:d.pagesRead,totalPages:d.totalPages,partial:!!d.partial,claims:d.claims||[]});
  for(const r of d.references||[])add(r.entry,{url:d.url,page:r.page,excerpt:r.excerpt,hash:d.sha256,scope:'subdivision survey; lot applicability unverified'});
  if(d.partial||d.textStatus!=='text_extracted')gaps.push('Survey '+d.recordNumber+' text coverage incomplete');
 }
 gaps.push(...((research.history||{}).gaps||[]).map(g=>'Parcel '+g.parcelId+': '+g.reason));
 if(!research.history||research.history.status!=='retrieved')gaps.push('Public parent-parcel history not fully retrieved');
 gaps.push('Complete recorded-instrument and amendment/release search is not established');
 return {schemaVersion:1,propertyKey:report.parcel.county+'|'+report.parcel.id,asOf:report.date,sources,records,gaps,scope:'Public references discovered for this report; not a title commitment or complete abstract',inventoryComplete:false,history:[],runs:[]};
}
function sync(previous,report){
 const next=discover(report);if(!previous)return next;
 required(previous.propertyKey===next.propertyKey,'Evidence belongs to another parcel');
 next.history=clone(previous.history||[]);next.runs=clone(previous.runs||[]).map(r=>({...r,stale:true,staleReason:'Site evidence refreshed'}));
 for(const r of next.records){const old=previous.records.find(o=>o.id===r.id);if(old){Object.assign(r,{instrument:old.instrument,relationships:old.relationships||[],geometry:old.geometry,review:old.review,state:old.review?'needs_review':old.state});}}
 for(const old of previous.records)if(!next.records.some(r=>r.id===old.id))next.records.push({...clone(old),state:'needs_review',missingFromLatestDiscovery:true});
 next.history.push({at:new Date().toISOString(),type:'refresh',note:'Prior evidence retained; applicability reviews require renewal.'});return next;
}
function apply(ledger,a,now=new Date().toISOString()){
 const l=clone(ledger),r=l.records.find(r=>r.id===a.id);
 if(a.type==='instrument'){
  required(r,'Unknown record');required(safeUrl(a.url)&&/^[a-f0-9]{64}$/i.test(a.hash),'Original instrument URL and SHA-256 required');
  required(Number.isInteger(a.pages)&&a.pages>0&&a.entry===r.entry,'Instrument identity and page count required');
  if(r.instrument)l.history.push({at:now,type:'superseded_instrument',record:r.id,instrument:r.instrument});
  r.instrument={url:a.url,hash:a.hash,pages:a.pages,entry:a.entry,retrievedAt:now,documentId:a.documentId||null};r.state='applicability_unresolved';r.review=null;
 }else if(a.type==='review'){
  required(r&&r.instrument,'Retrieve the original instrument before reviewing applicability');
  required(['applicable','not_applicable','blanket_unplottable','mapped','released','amended','applicability_unresolved'].includes(a.state),'Invalid review state');
  required(String(a.reviewer||'').trim()&&String(a.basis||'').trim()&&a.effectiveDate,'Reviewer, effective date and evidence basis required');
  required(Array.isArray(a.pages)&&a.pages.length&&a.pages.every(p=>Number.isInteger(p)&&p>0&&p<=r.instrument.pages),'Valid original page citations required');
  if(['released','amended'].includes(a.state))required((a.relatedIds||[]).length&&(a.relatedIds||[]).every(id=>id!==r.id&&l.records.some(x=>x.id===id&&x.instrument)),'Retrieve the release/amending instrument first');
  if(a.state==='mapped')required(r.geometry&&r.geometry.reviewed===true,'Reviewed restriction geometry required');
  r.state=a.state;r.relationships=a.relatedIds||[];r.review={reviewer:a.reviewer,basis:a.basis,effectiveDate:a.effectiveDate,pages:a.pages,at:now,instrumentHash:r.instrument.hash};
 }else if(a.type==='run'){
  required(['valuation','placement'].includes(a.kind),'Invalid calculation type');
  l.runs.push({id:a.runId,kind:a.kind,result:clone(a.result),inputs:clone(a.inputs),sourceVersion:l.asOf,createdAt:now,stale:false});
 }else throw Error('Unknown evidence action');
 if(a.type!=='run')l.runs.forEach(run=>{run.stale=true;run.staleReason='Evidence changed';});
 l.history.push({at:now,type:a.type,record:a.id||null,reviewer:a.reviewer||null});return l;
}
function status(l,now=new Date()){
 const open=l.records.filter(r=>!['applicable','not_applicable','blanket_unplottable','mapped','released','amended'].includes(r.state)),unmapped=l.records.filter(r=>['applicable','blanket_unplottable'].includes(r.state));
 const age=(+now-Date.parse(l.asOf))/86400000;
 return {discovered:l.records.length,originals:l.records.filter(r=>r.instrument).length,open:open.length,unmapped:unmapped.length,complete:false,inventoryComplete:l.inventoryComplete,refreshDue:!Number.isFinite(age)||age>30,reason:'Completeness is limited to the identified inventory; a complete public title search has not been established.'};
}
const api={discover,sync,apply,status};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EvidenceLedger=api;
})(typeof window!=='undefined'?window:globalThis);
