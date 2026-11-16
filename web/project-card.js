/* My projects: one compact card per saved project, saying what it is, where it stands and what's next.
   Everything is read from the saved project (site review answers, permit checklist, recorded receipts,
   corrections and issuance). Nothing is inferred: no percentages, no assumed permits, and a permit is only
   "Submitted" or "Issued" when the user recorded a receipt or an issued permit. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const dep=(file,name)=>{try{return node?require('./'+file):root[name]||null;}catch(e){return null;}};
const PO=()=>dep('project-overview','ProjectOverview'),NS=()=>dep('next-steps','NextSteps'),C=()=>dep('city-application','CityApplication');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,one,many)=>n+' '+(n===1?one:(many||one+'s'));
// Counties Cornerpin covers, so the card can say the state without guessing.
const STATE={Weber:'Utah'};
const KEEP=/^(N|S|E|W|NE|NW|SE|SW|PO|US|SR|UT|LLC)$/;
// County records are upper case; addresses read better in title case. Directions and unit letters stay capitals.
function titleCase(s){return String(s||'').split(/(\s+)/).map(w=>{if(/^\s+$/.test(w)||!/[A-Z]/i.test(w))return w;if(KEEP.test(w.toUpperCase())&&w===w.toUpperCase())return w.toUpperCase();
 if(/^\d+[A-Z]{1,2}$/i.test(w))return w.toLowerCase();return w.toLowerCase().replace(/(^|[-'/])([a-z])/g,(m,a,b)=>a+b.toUpperCase());}).join('');}
function place(p){const county=p.property?.county,juris=p.application?.jurisdiction||p.report?.facts?.jurisdiction||'';
 const c=county?county+' County'+(STATE[county]?', '+STATE[county]:''):'';return [juris&&!/county/i.test(juris)?juris:'',c].filter(Boolean).join(' · ');}
const date=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
const STATUS={issued:['Permit issued','ok'],corrections:['Corrections required','concern'],submitted:['Submitted','verify'],ready:['Ready to submit','ok'],preparing:['Permit preparation','neutral'],site:['Site review','neutral']};
const STAGES=[['site','Site review'],['prep','Permit preparation'],['submit','Submission']];

function summary(p){
 const po=PO(),ns=NS(),c=C(),W=dep('permit-workflow','PermitWorkflow');let s=null,check=null,planned=[];
 try{s=po?po.summary(p):null;}catch(e){s=null;}
 try{planned=ns?ns.planned(p):[];}catch(e){planned=[];}
 try{check=ns&&planned.length?ns.checklist(p):null;}catch(e){check=null;}
 const sums=planned.map(t=>{try{return ns.permitSummary(p,t);}catch(e){return null;}});
 const filed=(p.receipts||[]).length>0,open=W?W.openCorrections(p):(p.corrections||[]).filter(x=>x.state!=='accepted'),toAnswer=open.filter(x=>x.state!=='resubmitted');
 const stale=new Set((s?.drafts||[]).filter(d=>d.stale).map(d=>String(d.id)));
 // 1. Site review: open findings in the saved site report, after the user's own resolutions.
 const ran=(p.report?.findings||[]).length||Object.keys(p.report?.facts?.stepsRun||{}).length;
 const site=!ran?{state:'todo',text:'Not started'}:!s?{state:'unknown',text:'Saved'}:
  s.counts.flag?{state:'attention',text:plural(s.counts.flag,'concern')+' open'}:
  s.siteOpen?{state:'active',text:s.siteOpen+' to review'}:{state:'done',text:'Nothing open'};
 // 2. Permit preparation: the "Ready to file" checklist. Started only when something on it is done.
 const prep=!planned.length?{state:'todo',text:'No permits chosen'}:filed?{state:'done',text:'Done'}:
  stale.size?{state:'attention',text:'Answers to recheck'}:check?.ready?{state:'done',text:'Ready to submit'}:
  check&&(check.items.some(x=>x.done&&x.id!=='submit')||sums.some(x=>x&&x.ready>0))?{state:'active',text:'In progress'}:
  {state:'todo',text:'Not started'};
 // 3. Submission: only what the user recorded (receipt, review rounds, issued permit).
 const submit=p.issuance?{state:'done',text:'Permit issued'}:filed&&toAnswer.length?{state:'attention',text:plural(toAnswer.length,'correction')+' to answer'}:
  filed?{state:'active',text:'Submitted'}:{state:'todo',text:'Not submitted'};
 const key=p.issuance?'issued':filed&&toAnswer.length?'corrections':filed?'submitted':planned.length&&check?.ready&&!stale.size?'ready':planned.length?'preparing':'site';
 const permits=planned.map((t,i)=>{const sm=sums[i],label=sm?.label||c?.catalog?.types?.find(x=>x.value===String(t))?.label||'Permit';
  const st=p.issuance?['Issued','ok']:filed&&toAnswer.length?['Corrections','concern',1]:filed?['Submitted','verify']:
   stale.has(String(t))?['Recheck answers','review',1]:!sm||!sm.total?['Not started','neutral']:sm.complete?['Ready to file','ok']:
   sm.ready>0?['Preparing · '+sm.ready+' of '+sm.total,'neutral']:['Not started','neutral'];
  return {id:String(t),label,text:st[0],tone:st[1],attention:!!st[2],form:!!(sm&&sm.supported&&sm.form.total)};});
 // The overview's own next step, when it has one; never shown once a permit is issued.
 let next=null;const n=s?.next;
 if(n&&!p.issuance){const tab=n.action==='site'?'overview':n.action;next={label:n.action==='site'&&n.questionId?'Review “'+n.label+'”':n.label,tab:['overview','filing','management','rules'].includes(tab)?tab:'overview'};}
 return {id:p.id,address:titleCase(p.property?.address),rawAddress:p.property?.address||'',parcel:p.property?.parcelId||'',place:place(p),
  type:p.application?.intent?.label||'',status:{key,label:STATUS[key][0],tone:STATUS[key][1]},
  stages:STAGES.map(([k,label],i)=>({key:k,label,...[site,prep,submit][i]})),permits,next,updatedAt:p.updatedAt||p.report?.date||''};
}

const MARK={done:'✓',attention:'!',active:'',todo:'',unknown:''};
// opts.after: HTML placed after the footer (the delete confirmation).
function card(p,opts={}){const s=summary(p),id=esc(p.id),shown=s.permits.slice(0,3),more=s.permits.length-shown.length;
 const go=(tab,text,cls)=>'<button type="button" class="cp-link '+(cls||'')+'" data-action="open-at" data-id="'+id+'" data-tab="'+tab+'">'+text+'</button>';
 return '<article class="pw-card cp-proj" data-status="'+s.status.key+'" data-search="'+esc((s.address+' '+s.rawAddress+' '+s.parcel+' '+s.place+' '+s.type).toLowerCase())+'" data-updated="'+esc(s.updatedAt)+'" data-name="'+esc(s.address.toLowerCase())+'" aria-labelledby="proj-'+id+'">'+
  '<header class="cp-proj-head"><div class="cp-proj-id"><h2 id="proj-'+id+'">'+esc(s.address)+'</h2>'+
  '<span class="cp-proj-status cp-tone-'+s.status.tone+'"><span class="cp-proj-dot" aria-hidden="true"></span>'+esc(s.status.label)+'</span></div>'+
  (s.place?'<p class="cp-proj-place">'+esc(s.place)+'</p>':'')+(s.type?'<p class="cp-proj-kind">'+esc(s.type)+'</p>':'')+'</header>'+
  '<ol class="cp-proj-stages" aria-label="Progress">'+s.stages.map(x=>'<li class="is-'+x.state+'"><span class="cp-proj-seg" aria-hidden="true"></span><span class="cp-proj-stage">'+esc(x.label)+'</span><span class="cp-proj-stext">'+(MARK[x.state]?'<span aria-hidden="true">'+MARK[x.state]+' </span>':'')+esc(x.text)+'</span></li>').join('')+'</ol>'+
  '<div class="cp-proj-permits"><h3>Permits</h3>'+(shown.length?'<ul>'+shown.map(x=>'<li>'+go('filing',esc(x.label),'cp-proj-permit')+'<span class="cp-proj-pstate cp-tone-'+x.tone+'">'+(x.attention?'<span class="cp-proj-flag" aria-hidden="true">!</span>':'')+esc(x.text)+'</span></li>').join('')+'</ul>'+(more>0?go('filing','+'+more+' more','cp-proj-more'):''):'<p class="cp-proj-empty">No permits tracked yet.</p>')+'</div>'+
  // Every card has the same five parts in the same order, so cards in a row line up part by part.
  (s.next?'<p class="cp-proj-next"><span>Next</span>'+go(s.next.tab,esc(s.next.label),'cp-proj-nextlink')+'</p>':'<div class="cp-proj-next" aria-hidden="true"></div>')+
  '<div class="cp-proj-bottom"><footer class="cp-proj-foot"><span class="cp-proj-updated">'+(s.updatedAt?'Updated <time datetime="'+esc(s.updatedAt)+'">'+esc(date(s.updatedAt))+'</time>':'')+'</span>'+
  '<div class="cp-proj-actions"><button type="button" class="cp-link cp-proj-trash pw-delete-link" data-action="delete-project" data-id="'+id+'" aria-label="Delete '+esc(s.address)+'" title="Delete project"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h8a1.5 1.5 0 0 0 1.5-1.4l1-12M9 7V4.5A.5.5 0 0 1 9.5 4h5a.5.5 0 0 1 .5.5V7"/></svg></button>'+
  '<button type="button" class="primary" data-action="open" data-id="'+id+'">Open project</button></div></footer>'+(opts.after||'')+'</div></article>';}

// Search, status filter and sort only appear once there are enough projects to need them.
const TOOLS_FROM=4;
function toolbar(list){if(list.length<TOOLS_FROM)return '';const counts={};for(const s of list)counts[s.status.key]=(counts[s.status.key]||0)+1;
 return '<div class="cp-proj-tools" role="search"><label class="cp-proj-search"><span class="cp-sr">Search projects</span><input type="search" name="proj-q" placeholder="Search by address, parcel or city" autocomplete="off"></label>'+
  '<label><span class="cp-sr">Status</span><select name="proj-status"><option value="">All statuses</option>'+Object.keys(STATUS).filter(k=>counts[k]).map(k=>'<option value="'+k+'">'+STATUS[k][0]+' ('+counts[k]+')</option>').join('')+'</select></label>'+
  '<label><span class="cp-sr">Sort</span><select name="proj-sort"><option value="updated">Recently updated</option><option value="name">Address A–Z</option></select></label>'+
  '<p class="cp-proj-count" role="status" aria-live="polite"></p></div>';}
// Applies the toolbar to the rendered grid; returns how many cards are visible.
function filter(scope){const g=scope.querySelector('.pw-project-grid');if(!g)return 0;const q=(scope.querySelector('[name=proj-q]')?.value||'').trim().toLowerCase(),st=scope.querySelector('[name=proj-status]')?.value||'',sort=scope.querySelector('[name=proj-sort]')?.value||'updated';
 const cards=[...g.querySelectorAll(':scope>.cp-proj')];cards.sort((a,b)=>sort==='name'?a.dataset.name.localeCompare(b.dataset.name,undefined,{numeric:true}):(b.dataset.updated||'').localeCompare(a.dataset.updated||''));
 let n=0;for(const c of cards){const show=(!q||q.split(/\s+/).every(w=>c.dataset.search.includes(w)))&&(!st||c.dataset.status===st);c.hidden=!show;if(show)n++;g.appendChild(c);}
 const count=scope.querySelector('.cp-proj-count');if(count)count.textContent=n===cards.length?plural(n,'project'):n+' of '+cards.length+' projects';
 const none=scope.querySelector('.cp-proj-none');if(none)none.hidden=n>0;return n;}

const api={summary,card,toolbar,filter,titleCase,TOOLS_FROM};if(node)module.exports=api;else root.ProjectCard=api;
})(typeof window!=='undefined'?window:globalThis);
