/* Site findings, answer first: the few findings that matter for building on this lot, each with
   what to do and its source as a citation; the full report stays below. If nothing is flagged,
   the sources still to verify are the finding; if there are no findings, who to contact.
   Deterministic selection from the saved report; no AI call and no new conclusions. */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,text)=>/^https?:\/\//.test(url||'')?'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(text)+'</a>':esc(text);
// Building impact first: hazards and terrain, then services, then title-type constraints, then extras.
const WEIGHT={geo:0,survey:1,septic:2,water:3,utilities:3,access:4,easements:5,ccr:6,land:6,permits:7,minerals:8,performance:9,pool:10};
const RANK={flag:0,watch:1,verify:2};
const base=f=>String(f.item||'').split(' · ')[0].trim();
function open(report,project){
 const all=(root.LotReport?root.LotReport.reviewFindings(report?.findings||[]):report?.findings||[]).filter(f=>!/^(Historical entry |Later indexed record |Public original |Original .* page .* candidate )/.test(f.item||''));
 const D=root.SiteDecisions;return project&&D?D.openFindings(project,all):all.filter(f=>f.status!=='ok');
}
// The same finding from several sources (e.g. slope from two elevation services) is one finding.
function merge(findings){const groups=new Map();for(const f of findings){const k=f.status+'|'+f.section+'|'+base(f);if(!groups.has(k))groups.set(k,{...f,item:base(f)||f.item,sources:[]});const g=groups.get(k);if(f.source&&!g.sources.some(s=>s.label===f.source))g.sources.push({label:f.source,url:f.url});if(!g.next_step&&f.next_step)g.next_step=f.next_step;g.members=(g.members||[]).concat(f);}return [...groups.values()];}
// The stated plan changes what matters: interior work leaves ground hazards mostly unchanged; a pool
// or deck makes the pool screen and slope central. Without a plan, weights assume a new dwelling.
const PLAN_WEIGHT={remodel:{geo:6,survey:6,utilities:1,permits:0,performance:0},basement:{geo:2,survey:6,permits:0,performance:0},adu:{geo:6,survey:6,utilities:0,septic:0,permits:1,ccr:0},solar:{geo:7,survey:7,utilities:0,permits:1,ccr:0},deck:{survey:0,geo:1,ccr:2},pool:{pool:0,survey:1,geo:1}};
function summary(report,project,{limit=4}={}){
 const plan=project?.application?.intent?.plan,w=k=>(PLAN_WEIGHT[plan]||{})[k]??WEIGHT[k]??11,rank=f=>f.status==='flag'&&w(f.section)>=6?RANK.watch:RANK[f.status],central=f=>Number((PLAN_WEIGHT[plan]||{})[f.section]===0); // a concern in a section this plan barely touches still shows, but does not lead
 // Within a status, findings with a concrete next step come first: they tell the user what to do.
 const list=merge(open(report,project).filter(f=>f.status in RANK&&(f.section!=='pool'||plan==='pool'||!plan))).sort((a,b)=>rank(a)-rank(b)||central(b)-central(a)||(!a.next_step)-(!b.next_step)||w(a.section)-w(b.section));
 const counts={flag:0,watch:0,verify:0};for(const f of list)counts[f.status]++;
 const top=list.filter(f=>f.status!=='verify').slice(0,limit);
 return {top,counts,verify:list.filter(f=>f.status==='verify'),total:list.length};
}
// When the report has no next step, say who can settle it — not "read the source".
const WHO=[[/slope|terrain|grading|relief|topo/i,'Have a surveyor confirm the grades with a topo survey; your designer needs it for the site plan.'],[/landslide|fault|liquefaction|soil|geolog|boring|seismic/i,'Ask a geotechnical engineer whether this affects your foundation design.'],[/flood/i,'Ask the building department whether a floodplain review applies to your project.'],[/water|sewer|septic|utilit|power|gas/i,'Call the provider to confirm service and connection fees for this lot.'],[/easement|plat|setback|boundary/i,'Have a surveyor mark the lines and easements before you place the work.'],[/hoa|cc&r|covenant|design review/i,'Get the HOA\'s design rules and approval steps before you design.']];
function todo(f,project){const D=root.SiteDecisions;if(f.next_step)return f.next_step;const text=(f.item||'')+' '+(f.headline||'')+' '+(f.section||'');const m=WHO.find(([re])=>re.test(text));return m?m[1]:'Ask the building department whether this applies to your project.';}
// What has and hasn't been researched yet, with a way to research everything.
function coverage(report,project){const RP=root.ResearchPlan,LR=root.LotReport;if(!RP)return '';const missing=RP.notRun(report);if(!missing.length)return '';
 const names=missing.map(id=>(LR?.STEPS||[]).find(s=>s[0]===id)?.[1]||id),intent=project?.application?.intent;
 return '<p class="cp-coverage"><small>'+(intent?'Researched for: '+esc(intent.label)+'. ':'First read only. ')+'Not yet researched: '+esc(names.slice(0,3).join(', '))+(names.length>3?' and '+(names.length-3)+' more':'')+'.</small> <button type="button" data-research-all>Research everything</button></p>';}
if(typeof document!=='undefined')document.addEventListener('click',e=>{const b=e.target.closest?.('[data-research-all]');if(!b)return;b.disabled=true;root.dispatchEvent(new CustomEvent('cornerpin:research-permits',{detail:{typeIds:['*'],label:'everything'}}));});
function card(report,{project=null,where='site'}={}){
 const s=summary(report,project),D=root.SiteDecisions,head=(t,tone)=>'<section class="cp-answer'+(tone?' cp-answer-tier-'+tone:'')+'" aria-label="Site findings for this lot"><p class="cp-eyebrow">'+esc(t)+'</p>';
 const review=f=>project&&D?'<button type="button" data-review-question="'+esc(D.id(f.members?.[0]||f))+'">Review</button>':'';
 const more=(s.counts.verify||s.counts.watch>s.top.filter(f=>f.status==='watch').length)?'<p><small>'+[s.counts.watch-s.top.filter(f=>f.status==='watch').length>0?(s.counts.watch-s.top.filter(f=>f.status==='watch').length)+' more to watch':'',s.counts.verify?s.counts.verify+' routine items to verify':''].filter(Boolean).join(' · ')+(where==='site'?' — listed in the sections below.':' — in Site Review.')+'</small></p>':'';
 const goSite=where==='overview'?'<button type="button" data-action="site">Open Site Review</button>':'';
 const intent=project?.application?.intent;
 if(s.top.length)return head('Site findings that matter'+(intent&&intent.plan!=='evaluate'?' for: '+intent.label.toLowerCase():''))+'<ol class="cp-site-list">'+s.top.map(f=>'<li><p><strong>'+esc(f.item)+'</strong>'+(f.status==='flag'?' <span class="cp-status cp-review">Concern</span>':' <span class="cp-status cp-neutral">Watch</span>')+'<br>'+esc(f.headline)+'</p><p><strong>What to do:</strong> '+esc(todo(f,project))+'</p><p><small>Source: '+(f.sources.length?f.sources.map(x=>link(x.url,x.label)).join(' · ')+(f.sources.length>1?' (agree)':''):'not recorded')+'</small> '+review(f)+'</p></li>').join('')+'</ol>'+more+coverage(report,project)+goSite+'</section>';
 if(s.verify.length){const srcs=[...new Map(s.verify.filter(f=>f.source).map(f=>[f.source,f])).values()].sort((a,b)=>(WEIGHT[a.section]??11)-(WEIGHT[b.section]??11)).slice(0,5);
  return head('Nothing flagged — sources to verify','sources')+'<p>No site concern was flagged. '+s.verify.length+' items still need confirming against their sources; start with these:</p><ul>'+srcs.map(f=>'<li>'+esc(base(f)||f.item)+' — '+link(f.url,f.source)+'</li>').join('')+'</ul>'+coverage(report,project)+goSite+'</section>';}
 const contacts=report?.facts?.contacts||[];
 return head('Who to ask about this site','contacts')+(contacts.length?'<ul>'+contacts.slice(0,3).map(c=>'<li><strong>'+esc(c.name)+'</strong>'+(c.portal?' — '+link(c.portal,'online portal'):'')+(c.people||[]).slice(0,2).map(p=>'<br>'+esc(p.role)+(p.email?': '+esc(p.email):'')+(p.phone?' · '+esc(p.phone):'')).join('')+'</li>').join('')+'</ul>':'<p>No site findings were produced and no contacts are on file. Open Contacts for the building department and county offices.</p>')+goSite+'</section>';
}
const api={summary,card,merge,todo};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SiteAnswer=api;
})(typeof window!=='undefined'?window:globalThis);
