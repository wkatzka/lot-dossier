/* What to do next, in plain words, and the one "Ready to file" checklist.
   Both read the saved project only (no AI, no new conclusions). Every step names who does it:
   You, Cornerpin, the HOA, the city, or a professional. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const C=()=>node?require('./city-application'):root.CityApplication;
const SA=()=>node?require('./site-answer'):root.SiteAnswer;
const MC=()=>node?require('./my-company'):root.MyCompany;
const PO=()=>node?require('./project-overview'):root.ProjectOverview;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(id)=>C()?.catalog?.types?.find(t=>t.value===String(id))?.label||'Permit';
const plural=(n,one,many)=>n+' '+(n===1?one:(many||one+'s'));
const done=r=>['reviewed','waived'].includes(r.state);
function planned(p){const t=(p.application?.intent?.typeIds||[]).filter(x=>x!=='*');return t.length?t.map(String):(p.application?.permitSelections||[]).map(String);}
function jurisdiction(p){return p.application?.jurisdiction||p.report?.facts?.jurisdiction||'the city';}
function portal(p){const c=C();if(c&&c.supported&&c.supported(p))return c.catalog.source||null;return p.report?.facts?.kb?.portal||null;}
// Who usually settles a site concern, from its own next step.
function whoFor(text){return /geotech|geologic|engineer/i.test(text)?'Geotech engineer':/survey/i.test(text)?'Surveyor':/water rights|consultant/i.test(text)?'Consultant':'You';}

// The one checklist from "nothing done" to "submitted".
function checklist(p){
 const items=[],c=C(),types=planned(p),company=p.application?.team?.builder;
 items.push({id:'company',who:'You',title:'Add your company details',detail:company?.name?company.name:'Saved once and reused on every permit form.',done:!!company?.name,action:{type:'my-company',label:company?.name?'Edit':'Add details'}});
 const owner=p.application?.team?.owner?.name||p.application?.owner;
 items.push({id:'owner',who:'You',title:'Confirm the property owner',detail:owner?owner+' (from the county record)':'The form asks for the owner\'s name.',done:!!owner,action:{type:'tab',id:'filing',label:'Open'}});
 for(const t of types){
  const supported=c&&c.supported&&c.supported(p);
  if(supported){const r=c.readiness(p,t),n=r.missing.length,m=r.unreviewed.length;
   items.push({id:'form-'+t,who:'You',title:label(t)+' permit form',detail:n||m?[n?plural(n,'question')+' to answer':'',m?plural(m,'answer')+' Cornerpin filled in to check':''].filter(Boolean).join(' · '):'All required answers done',done:!n&&!m,action:{type:'prepare-permit',id:t,label:n||m?'Fill in':'Review'}});}
  else items.push({id:'form-'+t,who:'You',title:label(t)+' application',detail:'Fill in '+jurisdiction(p)+'\'s own form; Cornerpin has not mapped it yet.',done:false,action:{type:'tab',id:'filing',label:'Open'}});
  const reqs=(p.requirements||[]).filter(r=>r.permitType===t&&r.required);
  // Projects saved before requirements carried their packet group: infer it from the stable id.
  const grp=r=>r.group||(/:doc-/.test(r.id||'')?'What the city asks for':/:(lot|rule)-/.test(r.id||'')?'What this lot adds':'');
  const docs=reqs.filter(r=>grp(r)==='What the city asks for'),site=reqs.filter(r=>grp(r)==='What this lot adds'||grp(r)==='City rules for this work');
  if(docs.length){const left=docs.filter(r=>!done(r));items.push({id:'docs-'+t,who:'You',title:'Documents for the '+label(t)+' permit',detail:left.length?left.slice(0,3).map(r=>r.title).join(' · ')+(left.length>3?' · and '+(left.length-3)+' more':''):'All marked ready',done:!left.length,action:{type:'requirements',label:left.length?'Get ready':'Review'}});}
  if(site.length){const left=site.filter(r=>!done(r));items.push({id:'site-'+t,who:'You',title:'Lot checks for the '+label(t)+' permit',detail:left.length?left.slice(0,3).map(r=>r.title).join(' · ')+(left.length>3?' · and '+(left.length-3)+' more':''):'All checked',done:!left.length,action:{type:'requirements',label:left.length?'Check':'Review'}});}
 }
 if(!types.length)items.push({id:'plan',who:'You',title:'Choose what you\'re building',detail:'The checklist is built from the permits you choose.',done:false,action:{type:'tab',id:'overview',label:'Choose'}});
 const ready=items.every(x=>x.done);
 const filed=(p.receipts||[]).length>0;
 items.push({id:'submit',who:'You',title:'Submit to '+jurisdiction(p),detail:filed?'Recorded as submitted (reference '+(p.application?.reference||'saved')+').':ready?'Everything above is done. Enter your answers in the city\'s portal and attach the documents.':'Finish the items above first.',done:filed,ready,action:filed?{type:'tab',id:'management',label:'View'}:{type:'submit-city',label:'Submit',url:portal(p)}});
 return {items,ready,filed,remaining:items.filter(x=>!x.done&&x.id!=='submit').length,portal:portal(p),jurisdiction:jurisdiction(p)};
}

// The next three things to do on this project, most urgent first.
function steps(p,{limit=3}={}){
 const out=[],add=s=>{if(!out.some(x=>x.id===s.id))out.push(s);};
 const open=(p.corrections||[]).filter(c=>c.state!=='resubmitted');
 if(p.issuance)add({id:'issued',who:'You',title:'Your permit is issued',detail:'Check the permit and its conditions before work starts.',action:{type:'tab',id:'management',label:'View permit'}});
 else if((p.receipts||[]).length){
  if(open.length)add({id:'corrections',who:'You',title:'Answer the city\'s '+plural(open.length,'correction'),detail:'The reviewer asked for changes. Respond, then resubmit.',action:{type:'tab',id:'management',label:'Respond'}});
  else add({id:'waiting',who:'City',title:'The city is reviewing your application',detail:'When they reply, paste their comments in Submissions & Review.',action:{type:'tab',id:'management',label:'Open'}});
 }
 if(!p.application?.intent)add({id:'intent',who:'You',title:'Tell Cornerpin what you\'re building',detail:'It researches only what your project needs.',action:{type:'scroll',id:'overview-intent',label:'Choose'}});
 // Site concerns that change the design come before paperwork.
 const s=SA()?SA().summary(p.report,p,{limit:4}):{top:[]};
 for(const f of s.top.filter(f=>f.status==='flag').slice(0,1)){const t=SA().todo(f,p);add({id:'concern',who:whoFor(t),title:f.item,detail:t,action:{type:'site',label:'See why'}});}
 // A specific approval task this lot needs (e.g. find who reviews plans) beats the generic HOA line.
 const rule=(()=>{try{return (PO()?.summary(p)?.approvalPriorities||[]).find(r=>r.overviewTitle)||null;}catch{return null;}})();
 if(rule&&!(p.receipts||[]).length)add({id:'hoa',who:'You',title:rule.overviewTitle||rule.title,detail:rule.overviewSummary||'Find out who approves this and when, before you build.',action:{type:'rule',id:rule.id,label:rule.overviewAction||'Open'}});
 // HOA approval: needed before building, not before filing.
 const exterior=(p.application?.intent?.typeIds||[]).some(t=>t!=='4'&&t!=='70');
 const hoa=(p.report?.findings||[]).some(f=>f.section==='ccr'&&/HOA|CC&R/i.test(f.item||'')&&!/not in a platted subdivision/i.test(f.headline||''));
 if(exterior&&hoa&&!(p.receipts||[]).length)add({id:'hoa',who:'HOA',title:'Get the HOA\'s written approval of your plans',detail:'Needed before construction starts. See who approves and what they need under Approvals.',action:{type:'scroll',id:'overview-answer',label:'See approvals'}});
 if(!p.receipts?.length&&p.application?.intent){const c=checklist(p),next=c.items.find(x=>!x.done&&x.id!=='submit');
  if(next)add({id:'file-'+next.id,who:next.who,title:next.title,detail:next.detail,action:next.action});
  else if(c.ready)add({id:'submit',who:'You',title:'Submit to '+c.jurisdiction,detail:'Your checklist is complete.',action:{type:'tab',id:'filing',label:'Ready to file'}});}
 return out.slice(0,limit);
}

const WHO_TONE={You:'you',HOA:'other',City:'other',Cornerpin:'cornerpin'};
function button(a){if(!a)return '';if(a.type==='scroll')return '<button type="button" data-scroll-to="'+esc(a.id)+'">'+esc(a.label)+'</button>';
 if(a.type==='rule')return '<button type="button" data-action="open-rule-task" data-id="'+esc(a.id)+'">'+esc(a.label)+'</button>';
 if(a.type==='site')return '<button type="button" data-action="site">'+esc(a.label)+'</button>';
 if(a.type==='prepare-permit')return '<button type="button" data-action="prepare-permit" data-id="'+esc(a.id)+'">'+esc(a.label)+'</button>';
 if(a.type==='my-company')return '<button type="button" data-action="my-company">'+esc(a.label)+'</button>';
 if(a.type==='requirements')return '<button type="button" data-action="requirements">'+esc(a.label)+'</button>';
 if(a.type==='submit-city')return '<button type="button" class="primary" data-action="submit-city"'+(a.disabled?' disabled':'')+'>'+esc(a.label)+'</button>';
 return '<button type="button" data-action="tab" data-id="'+esc(a.id||'')+'">'+esc(a.label)+'</button>';}
const I=n=>(node?require('./icons'):root.CpIcons)?.icon(n)||'';
const WHO_ART={You:'builder',HOA:'hoa-board',City:'city','Geotech engineer':'geotech',Surveyor:'surveyor',Consultant:'designer',Cornerpin:'search'};
const ITEM_ART=id=>id==='company'?'builder':id==='owner'?'new-home':/^form-/.test(id)?'permit':/^docs-/.test(id)?'document':/^site-/.test(id)?'setbacks':id==='submit'?'submit':'concern';
const AR=(n,fb)=>(node?require('./icons'):root.CpIcons)?.art(n,fb)||I(fb);
const WHO_ICON={You:'user',HOA:'home',City:'building','Geotech engineer':'hardhat',Surveyor:'pin',Consultant:'hardhat',Cornerpin:'search'};
const ITEM_ICON=id=>id==='company'?'briefcase':id==='owner'?'user':/^form-/.test(id)?'clipboard':/^docs-/.test(id)?'doc':/^site-/.test(id)?'pin':id==='submit'?'send':'flag';
function whoTag(w){return '<span class="cp-who cp-who-'+(WHO_TONE[w]||'pro')+'">'+esc(w)+'</span>';}
function stepsCard(p){const list=steps(p);if(!list.length)return '';
 return '<section class="cp-answer cp-next-steps" aria-labelledby="next-steps-heading"><p class="cp-eyebrow" id="next-steps-heading">Your next steps</p><ol>'+list.map(s=>'<li><span class="cp-step-icon">'+AR(WHO_ART[s.who]||'builder',WHO_ICON[s.who]||'hardhat')+'</span><div>'+whoTag(s.who)+'<br><strong>'+esc(s.title)+'</strong><p>'+esc(s.detail)+'</p></div>'+button(s.action)+'</li>').join('')+'</ol></section>';}
function checklistCard(p){const c=checklist(p);
 return '<section class="pw-card cp-ready" id="ready-to-file" aria-labelledby="ready-heading"><h2 id="ready-heading">Ready to file</h2><p>'+(c.filed?'Submitted. Track the city\'s review under Submissions & Review.':c.ready?'Everything is ready. Submit to '+esc(c.jurisdiction)+'.':plural(c.remaining,'thing')+' left before you can submit to '+esc(c.jurisdiction)+'.')+'</p><ol class="cp-checklist">'+c.items.map(x=>'<li class="'+(x.done?'is-done':'')+'"><span class="cp-check" aria-hidden="true">'+(x.done?'✓':'')+'</span><span class="cp-step-icon">'+AR(ITEM_ART(x.id),ITEM_ICON(x.id))+'</span><div><strong>'+esc(x.title)+'</strong><p>'+esc(x.detail)+'</p></div>'+(x.id==='submit'?button({...x.action,disabled:!c.ready&&!c.filed}):button(x.action))+'<span class="pw-visually-hidden">'+(x.done?'Done':'To do')+'</span></li>').join('')+'</ol><p class="cp-trust">Cornerpin reads public records and the city’s published rules. The city, your HOA and your professionals make the final calls.</p>'+
  (c.ready&&!c.filed?'<div id="submit-help" hidden><p><strong>How to submit:</strong> 1. Download your answers. 2. Open '+(c.portal?'<a href="'+esc(c.portal)+'" target="_blank" rel="noopener">the city\'s permit portal</a>':'the city\'s permit portal')+' and copy them in, attaching your documents. 3. Come back and record the application number.</p><div class="pw-actions"><button type="button" data-action="city-download-all">Download my answers</button><button type="button" data-action="record-receipt">I\'ve submitted it</button></div></div>':'')+'</section>';}
const api={checklist,steps,stepsCard,checklistCard,planned};if(node)module.exports=api;else root.NextSteps=api;
})(typeof window!=='undefined'?window:globalThis);
