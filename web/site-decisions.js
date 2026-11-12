/* Shared, version-bound site review decisions. Observations and legal approvals remain separate. */
(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),clean=x=>String(x||'').trim(),required=(x,m)=>{if(!x)throw Error(m);};
const id=f=>encodeURIComponent(f.section||'')+'/'+encodeURIComponent(f.item||'');
const finding=(p,key)=>(p.report.findings||[]).find(f=>id(f)===key);
const fingerprint=(p,f)=>JSON.stringify({finding:f,scope:p.application.ruleScope||{},plan:f.section==='plan'?(p.planVersion||0):null});
const latest=(p,d)=>!(p.documents||[]).some(x=>x.family===d.family&&x.version>d.version);
function status(p,f){
 const r=p.siteReviews?.items?.[id(f)];if(!r)return {state:'unreviewed',closed:false};
 const stale=r.fingerprint!==fingerprint(p,finding(p,id(f))||f)||(r.references||[]).some(ref=>ref.documentId&&!(p.documents||[]).some(d=>d.id===ref.documentId&&d.hash===ref.hash&&latest(p,d)));
 return {...r,state:stale?'stale':r.state,closed:!stale&&['resolved','not-applicable'].includes(r.state)};
}
function migrate(p,records,now){
 const ledger=clone(p.siteReviews||{version:1,items:{},history:[],legacy:{}});
 for(const row of records||[]){required(row.key.startsWith(p.propertyKey+'|'),'Legacy checklist belongs to another property.');
  const record={status:row.status,files:(row.files||[]).map(f=>({name:f.name,id:f.id})),provenance:'legacy-unverified'};
  if(JSON.stringify(ledger.legacy[row.key]?.record)!==JSON.stringify(record)){
   if(ledger.legacy[row.key])ledger.history.push({at:now,type:'legacy-superseded',key:row.key,...ledger.legacy[row.key]});
   ledger.legacy[row.key]={record,importedAt:now};
  }
 }
 return ledger;
}
function apply(p,a,now){
 const f=finding(p,a.id);required(f,'The finding is no longer present. Refresh before reviewing.');
 required(['resolved','not-applicable','needs-evidence'].includes(a.state),'Choose a review disposition.');
 required(clean(a.reviewer)&&clean(a.basis)&&clean(a.conclusion),'Record reviewer, conclusion and evidence reasoning.');
 required(clean(a.scope),'Explain why the evidence applies to this parcel and proposed work.');
 const refs=a.references||[{documentId:a.documentId,url:a.url,locator:a.locator}];
 required(Array.isArray(refs)&&refs.length<=20,'Choose up to 20 evidence references.');
 const references=refs.filter(r=>r.documentId||r.url).map(r=>{
  required(clean(r.locator),'Cite a page, section or specific source location.');
  const role=r.role||'supports';required(['supports','contradicts','excluded'].includes(role),'Choose the evidence relationship.');
  if(r.documentId){const d=p.documents.find(d=>d.id===r.documentId);required(d&&latest(p,d),'Choose a current document version.');return {documentId:d.id,hash:d.hash,locator:clean(r.locator),name:d.name,role};}
  let url;try{url=new URL(r.url);}catch{}required(url&&url.protocol==='https:'&&!url.username&&!url.password,'Use an HTTPS original-source URL.');
  return {url:url.href,locator:clean(r.locator),role};
 });
 required(a.state==='needs-evidence'||references.some(r=>r.role==='supports'),'A resolved or not-applicable decision needs cited evidence.');
 required(a.state!=='needs-evidence'||clean(a.missing),'Name the specific missing evidence or unresolved question.');
 required(!references.some(r=>r.role==='contradicts')||clean(a.conflicts),'Explain how conflicting evidence was reconciled or what remains open.');
 required(a.confirmed===true,'Confirm you reviewed applicability and conflicting sources.');
 const ledger=migrate(p,[],now),previous=ledger.items[a.id];
 if(previous)ledger.history.push({at:now,type:'decision-superseded',id:a.id,decision:previous});
 ledger.items[a.id]={state:a.state,reviewer:clean(a.reviewer),basis:clean(a.basis),conclusion:clean(a.conclusion),scope:clean(a.scope),conflicts:clean(a.conflicts),missing:clean(a.missing),references,fingerprint:fingerprint(p,f),at:now};return ledger;
}
function inScope(p,f){return f.section!=='pool'||p.application.researchScope?.pool==='included';}
function openFindings(p,findings){return (findings||p.report.findings||[]).filter(f=>inScope(p,f)&&!status(p,finding(p,id(f))||f).closed);}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function panel(p,key){
 const f=finding(p,key);if(!f)return '';
 const r=status(p,f),input=(name,label,value='')=>'<label>'+label+'<input name="'+name+'" value="'+esc(value)+'"></label>',area=(name,label,value='')=>'<label>'+label+'<textarea name="'+name+'">'+esc(value)+'</textarea></label>';
 return '<section class="pw-card" id="site-decision"><h2>Review: '+esc(f.item)+'</h2><p>'+esc(f.headline)+'</p><p>Review status: <strong>'+esc(r.state)+'</strong>. A recorded conclusion does not itself grant an authority approval.</p>'+(r.conclusion?'<p>'+esc(r.conclusion)+'</p><p>Reviewed by '+esc(r.reviewer)+' · '+esc(r.at)+'</p>':'')+
 '<form data-command="site_review" data-id="'+esc(key)+'"><label>Disposition<select name="state"><option value="needs-evidence">Needs specific evidence</option><option value="resolved">Question resolved with evidence</option><option value="not-applicable">Not applicable to this work</option></select></label>'+input('reviewer','Reviewer',r.reviewer)+area('conclusion','Conclusion',r.conclusion)+area('scope','Parcel and work applicability',r.scope)+area('basis','Evidence reasoning',r.basis)+area('conflicts','Competing sources and why one controls (or remains unresolved)',r.conflicts)+area('missing','Specific missing evidence / next question',r.missing)+
 '<label>Current evidence document<select name="documentId"><option value="">Use source URL below</option>'+(p.documents||[]).filter(d=>latest(p,d)).map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+' · v'+d.version+'</option>').join('')+'</select></label>'+input('url','Original-source HTTPS URL')+input('locator','Page / section / source location')+input('comparisonUrl','Additional original-source HTTPS URL (optional)')+input('comparisonLocator','Additional page / section')+'<label>Additional source relationship<select name="comparisonRole"><option value="contradicts">Conflicts with the conclusion</option><option value="supports">Supports the conclusion</option><option value="excluded">Excluded: wrong property or scope</option></select></label><label><input type="checkbox" name="confirmed"> I reviewed parcel applicability and conflicting sources.</label><button type="submit">Save review decision</button></form>'+
 '<h3>Reviewed sources</h3>'+((r.references||[]).map(ref=>'<p>'+esc(ref.role||'supports')+' · '+esc(ref.locator)+' · '+(ref.url?'<a href="'+esc(ref.url)+'" target="_blank" rel="noopener">Original source</a>':esc(ref.name)+' <button type="button" data-action="download-file" data-id="'+esc(ref.documentId)+'">View original</button>')+'</p>').join('')||'<p>No cited review yet.</p>')+'<h3>Prior decisions</h3>'+((p.siteReviews?.history||[]).filter(h=>h.id===key&&h.decision).map(h=>'<p>'+esc(h.decision.at)+' · '+esc(h.decision.reviewer)+' · '+esc(h.decision.state)+': '+esc(h.decision.conclusion)+'</p>').join('')||'<p>No earlier decision.</p>')+'</section>';
}
function workspace(p,key){return '<section class="pw-card"><h2>Site review decisions</h2><label>Question<select data-site-question><option value="">Choose a finding</option>'+(p.report.findings||[]).map(f=>'<option value="'+esc(id(f))+'"'+(id(f)===key?' selected':'')+'>'+esc(f.item)+' · '+esc(status(p,f).state)+'</option>').join('')+'</select></label><p>Record the conclusion and its evidence here. Earlier checklist marks are unverified history.</p></section>'+panel(p,key);}
let active=null;
function setActive(p){active=p;}
function forReport(r){return active&&active.propertyKey===r.parcel.county+'|'+r.parcel.id?active:null;}
const api={id,finding,fingerprint,status,migrate,apply,openFindings,panel,workspace,setActive,forReport,inScope};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SiteDecisions=api;
})(typeof window!=='undefined'?window:globalThis);
