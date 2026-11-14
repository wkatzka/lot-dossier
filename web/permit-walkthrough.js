/* Guided permit walkthrough: the city's form one short screen at a time, in plain questions, with the
   source of every answer beside it (interview flow modelled on consumer tax software). It reads and writes
   the same saved answers as the full form (CityApplication), so the two views never disagree.
   Nothing here submits anything to the city. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const C=node?require('./city-application'):root.CityApplication;
const F=node?require('./permit-facts'):root.PermitFacts;
const IR=node?require('./input-rules'):root.InputRules;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=r=>String(r.name==='identical_plan'?'Is this the same plan as one the city already approved?':r.label||r.name).replace(/:\s*$/,'').trim();
const blank=r=>String(r.value??'').trim()==='';
const req=r=>!!(r.required||r.markedRequired);
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const list=a=>a.length>1?a.slice(0,-1).join(', ')+' and '+a.at(-1):a[0]||'';

const PARTS={property:'The property',project:'The project',team:'Your team',building:'The building',docs:'Documents',finish:'Finish'};
const re=x=>n=>x.test(n);
// Screens in interview order. `gate` asks a yes/no first and only shows the questions on "Yes".
const SCREENS=[
 {id:'property',part:'property',nav:'Your lot',q:'Is this the right lot?',why:'The city finds your project by its address and parcel number.',m:re(/^(property_address|tax_id|subdivision|phase|lot_no|area|zone|latitude|longitude|is_corner|lot_footage)$/)},
 {id:'owner',part:'property',nav:'Owner',q:'Who owns the property?',why:'The city sends ownership notices to the owner of record.',m:re(/^owner(name|_address|_city|_state|_zip|_phone|email)$/)},
 {id:'project',part:'project',nav:'This application',q:'What are you applying for?',why:'This names the project on the city’s permit.',m:re(/^(application_date|permit_type|nickname|description)$/)},
 {id:'contact',part:'project',nav:'City contact',q:'Who should the city contact?',why:'This person gets the city’s questions and inspection emails.',m:re(/^(contact_name|contact_phone|contact_email|notify_contact|owner_builder)$/)},
 {id:'builder',part:'team',nav:'Builder',q:'Who is building it?',why:'The general contractor on the permit. If you’re building it yourself, enter your own details.',m:re(/^(buildername|builder_(name|contact|license|phone|email|address|city|state|zip))$/)},
 {id:'designer',part:'team',nav:'Designer',q:'Who designed it?',gate:'Did an architect or designer draw your plans?',why:'Their name is in the title block of your plans.',m:re(/^design_professional/)},
 {id:'engineer',part:'team',nav:'Engineer',q:'Who is the engineer of record?',gate:'Is an engineer stamping your plans?',why:'Look for the engineer’s stamp on the structural sheets.',m:re(/^engineer_record/)},
 {id:'electrical',part:'team',nav:'Electrician',q:'Who is your electrical contractor?',gate:'Do you have an electrical contractor yet?',why:'You can leave this blank until you hire one; the city may ask before the electrical inspection.',m:re(/^electrical_/)},
 {id:'mechanical',part:'team',nav:'HVAC / mechanical',q:'Who is your mechanical contractor?',gate:'Do you have a heating and cooling (mechanical) contractor yet?',why:'You can leave this blank until you hire one.',m:re(/^mechanical_/)},
 {id:'plumbing',part:'team',nav:'Plumber',q:'Who is your plumbing contractor?',gate:'Do you have a plumbing contractor yet?',why:'You can leave this blank until you hire one.',m:re(/^plumbing_/)},
 {id:'cost',part:'building',nav:'Cost to build',q:'What will it cost to build?',why:'The city sets the permit fee from this number. Use the construction cost, not the land or assessed value.',m:re(/^builder_valuation$/)},
 {id:'size',part:'building',nav:'Size',q:'How big is it?',why:'Square feet for each part of the building, from your plans.',m:re(/^(main_floor|second_floor|third_floor|fourth_floor|basement|unfin_basement|patio|garage_footage|other_footage)$/)},
 {id:'rooms',part:'building',nav:'Rooms & build',q:'What’s in it?',why:'Counts and materials from your floor plans.',m:re(/^(num_units|num_buildings|bedrooms|bathrooms|garages|stories|construction_material|max_occupancy|use_classification|division)$/)},
 {id:'setbacks',part:'building',nav:'Setbacks',q:'How far is it from the property lines?',why:'The minimum is what the rules allow; the actual distance comes from your site plan.',m:re(/set_back/)},
 {id:'approvals',part:'building',nav:'Other approvals',q:'Which other departments have signed off?',why:'Some permits need fire, health, water or geotechnical sign-off first.',m:re(/^(fire|zoning|health|water|geotechnical)_(approved|date|info)$/)},
 {id:'other',part:'building',nav:'More questions',q:'A few more questions from the city',why:'The city’s form asks these for this permit type.',m:()=>true},
 {id:'documents',part:'docs',nav:'Documents',q:'Which documents does the city want?',why:'You upload these in the city’s portal when you file. Here is what each one is and who gives it to you.',m:()=>false},
 {id:'portal',part:'docs',nav:'Sign in the portal',q:'What you sign in the city’s portal',why:'Cornerpin never signs or initials for you. Read these in the portal and sign them yourself.',m:()=>false},
 {id:'review',part:'finish',nav:'Check & file',q:'Check everything before you file',why:'',m:()=>false}
];
function assign(r){
 if(r.type==='file'||r.name==='identical_plan')return 'documents';
 if(r.locked&&r.name!=='permit_type')return 'portal';
 return SCREENS.find(s=>s.id!=='documents'&&s.id!=='portal'&&s.id!=='review'&&s.m(r.name)).id;
}
// The same question asked twice by the city (page 1 and the builder page). Shown once when the answers match.
const TWIN={buildername:'builder_name',builder_phone:'builder_phone',builder_email:'builder_email'};
function screens(p,type){
 const rows=C.rows(p,type),by={};for(const r of rows)(by[assign(r)]=by[assign(r)]||[]).push(r);
 const out=SCREENS.filter(s=>s.id==='review'||(by[s.id]||[]).length).map(s=>({...s,rows:by[s.id]||[]}));
 for(const s of out){s.twins={};if(s.id!=='builder')continue;
  for(const r of s.rows)if(r.section==='primary'&&TWIN[r.name]){const t=s.rows.find(x=>x.section==='professionals'&&x.name===TWIN[r.name]);if(t&&String(t.value)===String(r.value))s.twins[t.key]=r;}}
 return out;
}
const state=(p,type)=>p.application.walkthrough?.[type]||{gates:{},seen:[]};
const editable=s=>s.rows.filter(r=>!r.locked&&r.type!=='file'&&!Object.values(s.twins||{}).includes(r));
function status(p,type,s){
 const st=state(p,type),e=editable(s),filled=e.filter(r=>!blank(r)),missing=e.filter(r=>blank(r)&&req(r)),review=filled.filter(r=>r.review.state!=='confirmed');
 const gate=s.gate?(filled.length?'yes':st.gates?.[s.id]||''):'';
 const seen=(st.seen||[]).includes(s.id);
 return {filled,missing,review,total:e.length,gate,seen,skipped:gate==='no',todo:missing.length+review.length+(s.gate&&!gate?1:0)};
}
// ---------- where an answer comes from ----------
const factName=n=>({buildername:'builder_name',ownername:'owner_name',owneremail:'owner_email'})[n]||n;
const FROM=[[/^Saved site report/,'the county parcel record'],[/^County owner mailing record/,'the county owner mailing record'],[/^Recorded plat setback note/,'the recorded subdivision plat'],[/^Zoning standards/,'the zoning code'],
 [/^Confirmed project team/,'your company and team details'],[/^Public company contact/,'a public business listing'],[/^Calculated lot area/,'the county parcel map'],[/^User-reviewed construction estimate/,'your cost estimate'],
 [/^User-entered|^User supplied/,'your own answer'],[/^Draft project name/,'your permit type and address'],[/^Project preparation date/,'the day you started this project'],[/^Selected application type/,'the permit you chose'],
 [/^Saved application details/,'your project details'],[/^Phase explicitly named/,'the recorded legal description'],[/^Uploaded\/entered plan/,'your plans'],[/CornerpinAI|Explicit plan text/,'your plans']];
function sourceFor(p,r,type){
 const fact=F&&F.selected(p,factName(r.name),type);
 const doc=fact&&((p.documents||[]).find(d=>d.id===fact.documentId)||(p.documents||[]).find(d=>d.name===fact.filename));
 if(fact&&!blank(r)&&String(fact.value)===String(r.value)&&fact.quote)
  return {from:fact.filename||'your plans',quote:fact.quote,where:'Page '+fact.page+(fact.sheet?' · sheet '+fact.sheet:''),documentId:doc&&!p.documents.some(x=>x.family===doc.family&&x.version>doc.version)?doc.id:'',ai:/claude/.test(fact.method||'')};
 const b=String(r.basis||''),hit=FROM.find(([x])=>x.test(b));let out={from:hit?hit[1]:'Cornerpin’s research',note:b};
 if(/^Calculated lot area/.test(b))out.where='Calculated from the parcel boundary on the county map. Approximate: a survey is exact.';
 if(/^Saved site report/.test(b)){const a=p.report?.parcel?.attrs||{};out.quote=['Parcel '+(p.report?.parcel?.id||''),a.PARCEL_ADD,a.SUBDIV_NAME,(p.report?.parcel?.county||p.property?.county)?(p.report?.parcel?.county||p.property?.county)+' County':''].filter(Boolean).join(' · ');}
 const m=/^County owner mailing record for (.+?) · (.+?) · retrieved ([^.]+)/.exec(b);if(m)out={from:'the county owner mailing record',quote:m[1],where:m[2]+' · retrieved '+m[3],note:b};
 const link=/^Public company contact: (\S+)/.exec(b);if(link)out.url=link[1];
 return out;
}
const FIND=[
 [/valuation/,'Your contract price or construction estimate. The cost estimator below builds one from your square footage.'],
 [/^(main_floor|second_floor|third_floor|fourth_floor|basement|unfin_basement|patio|garage_footage|other_footage)$/,'The area table on your plans, usually on the cover sheet or the first floor plan. Your designer can send it.'],
 [/_set_back_default$/,'Your dimensioned site plan, from your designer or surveyor.'],
 [/_set_back$/,'The zoning code and recorded plat for this lot. The city planner can confirm which one applies.'],
 [/license/,'The contractor’s Utah license number. Check it on the state license lookup.','https://secure.utah.gov/llv/search/index.html','Utah license lookup'],
 [/^(electrical|mechanical|plumbing)_/,'The subcontractor’s bid or business card.'],
 [/^engineer_record/,'The engineer’s stamp on the structural sheets of your plans.'],
 [/^design_professional/,'The title block on your plans.'],
 [/^owner/,'Ask the property owner. County records only list a mailing address.'],
 [/^(contact_|notify_contact|owner_builder)/,'Your call: whoever the city should reach about this permit.'],
 [/^(builder|buildername)/,'Your company details. Add them once under My company and Cornerpin fills them in on every permit.'],
 [/^(bedrooms|bathrooms|stories|garages|construction_material|num_units|num_buildings)$/,'Your floor plans and elevations.'],
 [/^(max_occupancy|use_classification|division)$/,'The code analysis on your architect’s plans.'],
 [/_(approved|date|info)$/,'The approval letter from that department or consultant.'],
 [/^application_date$/,'The day you submit it in the city’s portal.'],
 [/./,'The city’s form asks this. If it’s unclear, ask the city’s building department.']
];
const findFor=r=>FIND.find(([x])=>x.test(r.name));
const WHO=[[/geotech|soils/i,'a geotechnical engineer'],[/hazard/i,'a geologist (geologic hazards study)'],[/fire/i,'the fire district'],[/stormwater|swppp|noi/i,'your civil engineer or erosion-control contractor'],[/res ?check|energy/i,'your designer (energy-code report)'],[/truss/i,'your truss supplier'],[/structural|engineering/i,'your structural engineer'],[/site plan/i,'your designer or surveyor'],[/will serve|culinary/i,'your culinary and secondary water providers'],[/owner\/builder/i,'the property owner (signed certificate)'],[/plan/i,'your designer or architect'],[/./,'whoever prepared it for this project']];
const docLabel=r=>label(r).replace(/\s*\(.*$/,'').replace(/:$/,'');

// ---------- rendering ----------
function input(r,t){
 const id='city-'+r.key,name='answer:'+r.key,v=esc(r.value),a=' id="'+id+'" name="'+name+'" aria-describedby="'+id+'-st"';
 if(r.name==='permit_type')return '<input'+a+' value="'+esc(t.label)+'" readonly>';
 if(r.options)return '<select'+a+'><option value="">Not answered</option>'+r.options.filter(o=>o.value!=='').map(o=>'<option value="'+esc(o.value)+'"'+(o.value===r.value?' selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>';
 if(r.type==='textarea')return '<textarea'+a+' rows="3" maxlength="'+Math.min(r.maxLength||10000,10000)+'">'+v+'</textarea>';
 const rule=IR?IR.rule(r.label,r.name,r.type):null;
 if(r.type==='number'){const money=rule?.unit==='$',unit=money?'':(rule?.unit||'');return '<div class="cp-num'+(money?' cp-num-money':'')+'">'+(money?'<span class="cp-num-pre">$</span>':'')+'<input'+a+' type="number" inputmode="decimal" step="any" min="'+esc(r.min??0)+'"'+(r.max!=null?' max="'+esc(r.max)+'"':'')+' value="'+v+'">'+(unit?'<span class="cp-num-unit">'+unit+'</span>':'')+'</div>';}
 return '<input'+a+(IR?IR.attrs(rule):'')+' type="'+((rule||{}).inputType||'text')+'" maxlength="'+Math.min(r.maxLength||10000,10000)+'" value="'+v+'">';
}
function row(p,t,r,twin){
 const src=!blank(r)?sourceFor(p,r,t.value):null,conf=r.review.state==='confirmed',stale=r.review.state==='stale'||/^Site or plans changed/.test(r.status);
 const chip=blank(r)?(req(r)?'<span class="cp-wt-chip is-req">Required</span>':'<span class="cp-wt-chip">Optional</span>')
  :conf?'<span class="cp-wt-chip is-ok">✓ Reviewed</span>':stale?'<span class="cp-wt-chip is-req">Changed · review again</span>':/^User supplied/.test(r.status)?'<span class="cp-wt-chip is-you">Your answer</span>':'<span class="cp-wt-chip is-sug">Filled in for your review</span>';
 const from=src?'<span class="cp-wt-from">from '+esc(src.from)+'</span>':'';
 const ok=!blank(r)&&!conf&&r.name!=='permit_type'?'<label class="cp-wt-ok"><input type="checkbox" name="wt-ok" value="'+esc(r.key)+'"> Looks right</label>':'';
 return '<div class="cp-wt-row'+(r.type==='textarea'?' is-wide':'')+'" data-evidence-key="'+esc(r.key)+'"><div class="cp-wt-label"><label for="city-'+esc(r.key)+'">'+esc(label(r))+'</label><button type="button" class="cp-wt-help" data-wt-src="'+esc(r.key)+'" aria-label="Where this comes from: '+esc(label(r))+'">?</button></div><div class="cp-wt-input">'+input(r,t)+(twin?'<input type="hidden" name="answer:'+esc(twin.key)+'" value="'+esc(twin.value)+'" data-wt-twin="city-'+esc(r.key)+'">':'')+'<p class="cp-wt-state" id="city-'+esc(r.key)+'-st">'+chip+from+'</p>'+ok+'</div></div>';
}
function intro(s,st,p,t){
 if(!st.total)return '';const srcs=[...new Set(st.filled.map(r=>sourceFor(p,r,t.value).from).filter(f=>f!=='your own answer'))];
 const reqN=editable(s).filter(req).length;
 let txt=st.filled.length===st.total?'Cornerpin filled in '+(st.total===1?'this':'all '+st.total)+(srcs.length?' from '+list(srcs):'')+'. Check '+(st.total===1?'it':'each one')+' against the source on the right, then tick Looks right.'
  :st.filled.length?'Cornerpin filled in '+st.filled.length+' of '+st.total+(srcs.length?' from '+list(srcs):'')+'. The right side shows where each answer came from and where to find the rest.'
  :'Cornerpin didn’t find these in public records or your plans. The right side says where to find each one.';
 if(reqN)txt+=' The city requires '+(reqN===st.total?(reqN===1?'it':'all of them'):reqN+' of them')+'.';else if(st.total>1)txt+=' None are required: fill in what applies.';
 return '<p class="cp-wt-intro">'+esc(txt)+'</p>';
}
function side(p,t,s){
 const e=editable(s),filled=e.filter(r=>!blank(r)),empty=e.filter(blank);let h='<p class="cp-eyebrow">Where these answers come from</p>';
 if(s.id==='documents'||s.id==='portal'||s.id==='review'){
  const docs=(p.documents||[]).filter(d=>!p.documents.some(x=>x.family===d.family&&x.version>d.version));
  h+=s.id==='review'?'<p>Every answer on the form, where it came from, and its review are in your downloaded answer sheet.</p>':'';
  h+='<h4>Your project documents</h4>'+(docs.length?'<ul class="cp-wt-docs">'+docs.slice(0,12).map(d=>'<li><span>'+esc(d.name)+'</span><button type="button" class="cp-link" data-action="view-file" data-id="'+esc(d.id)+'">Open</button></li>').join('')+'</ul>':'<p class="pw-muted">None yet. Add plans and reports under Documents.</p>')+'<button type="button" data-action="tab" data-id="documents">Manage documents</button>';
  return h+'<h4>The city’s portal</h4><p>You file, upload and sign in CityInspect. <a href="'+esc(C.catalog.source)+'" target="_blank" rel="noopener noreferrer">Open CityInspect</a></p>';
 }
 if(!e.length)return h+'<p>Nothing to fill in on this screen.</p>';
 // One card per source: the excerpt once, then every answer it supplied.
 const groups=new Map();for(const r of filled){const src=sourceFor(p,r,t.value),k=src.from+'|'+(src.quote||'')+'|'+(src.documentId||'');if(!groups.has(k))groups.set(k,{src,rows:[]});groups.get(k).rows.push(r);}
 h+=[...groups.values()].map(({src,rows})=>'<article class="cp-wt-src" data-keys="'+esc(rows.map(r=>r.key).join(' '))+'" tabindex="-1"><p class="cp-wt-srcfrom">From <b>'+esc(src.from)+'</b>'+(src.ai?' · read by CornerpinAI':'')+'</p>'+(src.quote?'<blockquote>“'+esc(src.quote)+'”</blockquote>':'')+(src.where?'<p class="pw-muted">'+esc(src.where)+'</p>':'')+'<dl class="cp-wt-vals">'+rows.map(r=>'<div><dt>'+esc(label(r))+'</dt><dd>'+esc(r.options?.find(o=>o.value===r.value)?.label||r.value)+'</dd></div>').join('')+'</dl>'+(src.documentId?'<button type="button" class="cp-link" data-action="view-file" data-id="'+esc(src.documentId)+'">Open the document</button>':'')+(src.url?'<a href="'+esc(src.url)+'" target="_blank" rel="noopener noreferrer">Open the listing</a>':'')+([...new Set(rows.map(r=>r.basis))].filter(b=>b&&b!==src.quote).length?'<details class="cp-wt-more"><summary>What to check</summary>'+[...new Set(rows.map(r=>r.basis))].map(b=>'<p>'+esc(b)+'</p>').join('')+'</details>':'')+'</article>').join('');
 if(empty.length){const groups=new Map();for(const r of empty){const f=findFor(r);if(!groups.has(f))groups.set(f,[]);groups.get(f).push(r);}
  h+='<div class="cp-wt-find"><h4>Where to find '+(filled.length?'the rest':'these')+'</h4>'+[...groups].map(([f,rs])=>'<div class="cp-wt-src" data-keys="'+esc(rs.map(r=>r.key).join(' '))+'" tabindex="-1"><p><b>'+esc(list(rs.map(label).slice(0,4))+(rs.length>4?' and '+(rs.length-4)+' more':''))+'</b></p><p>'+esc(f[1])+'</p>'+(f[2]?'<a href="'+esc(f[2])+'" target="_blank" rel="noopener noreferrer">'+esc(f[3])+'</a>':'')+'</div>').join('')+'</div>';}
 return h;
}
function documentsScreen(p,t,s){
 const files=s.rows.filter(r=>r.type==='file'),other=s.rows.filter(r=>r.type!=='file');
 return '<ul class="cp-wt-doclist">'+files.map(r=>{const has=/^Potential supporting files: (.+?)\. Match/.exec(r.basis||'');return '<li><div><b>'+esc(docLabel(r))+'</b>'+(req(r)?' <span class="cp-wt-chip is-req">Required</span>':' <span class="cp-wt-chip">If it applies</span>')+'<p>'+(has?'You may already have it: '+esc(has[1])+'. Check it’s the final, signed version.':'Get it from '+esc(WHO.find(([x])=>x.test(label(r)))[1])+'.')+'</p></div></li>';}).join('')+'</ul>'+(other.length?'<div class="cp-wt-fields">'+other.map(r=>row(p,t,r)).join('')+'</div>':'');
}
function portalScreen(s){
 return '<ul class="cp-wt-doclist">'+s.rows.map(r=>{const l=label(r);return '<li><div>'+(l.length>120?'<details><summary><b>'+esc(l.slice(0,110).replace(/\s+\S*$/,''))+'…</b></summary><p>'+esc(l)+'</p></details>':'<b>'+esc(l)+'</b>')+'<p>Read and sign this yourself in the city’s portal.</p></div></li>';}).join('')+'</ul>';
}
function reviewScreen(p,t,all){
 const work=all.filter(s=>s.id!=='review').map(s=>({s,st:status(p,t.value,s)}));
 const missing=work.flatMap(w=>w.st.missing.map(r=>({s:w.s,r}))),review=work.reduce((n,w)=>n+w.st.review.length,0),open=work.filter(w=>w.s.gate&&!w.st.gate);
 let h='<ul class="cp-wt-summary">'+work.map(({s,st})=>'<li><span class="cp-wt-mark'+(st.todo?'':st.skipped?' is-skip':' is-done')+'" aria-hidden="true">'+(st.todo?'':'✓')+'</span><button type="button" class="cp-link" data-action="wt-go" data-id="'+s.id+'">'+esc(s.nav)+'</button><span>'+(st.skipped?'Not on this project':s.id==='documents'?plural(s.rows.filter(r=>r.type==='file').length,'document')+' to upload':s.id==='portal'?plural(s.rows.length,'item')+' to sign':[st.missing.length?st.missing.length+' required blank':'',st.review.length?st.review.length+' for your review':'',!st.missing.length&&!st.review.length?(st.total?st.filled.length+' of '+st.total+' answered':'Nothing to answer'):''].filter(Boolean).join(' · '))+'</span></li>').join('')+'</ul>';
 const verdict=!missing.length&&!review&&!open.length?'<p class="cp-wt-verdict is-ok">Every answer is filled in and reviewed. Download your answers and copy them into the city’s portal.</p>'
  :'<p class="cp-wt-verdict">Before you file: '+list([missing.length?plural(missing.length,'required answer')+' to fill in':'',review?plural(review,'answer')+' Cornerpin filled in for your review':'',open.length?plural(open.length,'question')+' about your team':''].filter(Boolean))+'.</p>'+(missing.length?'<p>'+missing.slice(0,6).map(x=>'<button type="button" class="cp-link" data-action="wt-go" data-id="'+x.s.id+'">'+esc(label(x.r))+'</button>').join(' · ')+'</p>':'');
 return verdict+h+'<div class="pw-actions"><button type="button" class="cp-primary" data-action="city-download">Download my answers</button><button type="button" data-action="permit-hub">Back to File a permit</button><a href="'+esc(C.catalog.source)+'" target="_blank" rel="noopener noreferrer">Open CityInspect</a></div>';
}
function firstScreen(p,type,all){const w=all.filter(s=>s.id!=='review');return (w.find(s=>!status(p,type,s).seen)||w.find(s=>status(p,type,s).todo)||all[all.length-1]).id;}
function meter(p,type,all){
 const st=all.filter(s=>s.id!=='review').map(s=>status(p,type,s)),total=st.reduce((n,x)=>n+x.total,0),filled=st.reduce((n,x)=>n+x.filled.length,0),ok=st.reduce((n,x)=>n+x.filled.length-x.review.length,0);
 const pct=v=>total?Math.round(100*v/total):0;
 return '<div class="cp-wt-meter"><p><b>'+filled+' of '+total+'</b> answers filled in · <b>'+ok+'</b> reviewed</p><div class="cp-bar cp-bar-split" role="img" aria-label="'+ok+' reviewed, '+(filled-ok)+' filled in for your review, '+(total-filled)+' blank"><span class="cp-seg-ok" style="width:'+pct(ok)+'%"></span><span class="cp-seg-found" style="width:'+pct(filled-ok)+'%"></span></div></div>';
}
function render(p,screenId){
 const type=p.application.cityInspect?.typeId,t=C.catalog.types.find(x=>x.value===String(type));
 if(!C.supported(p)||!t)return '';
 const all=screens(p,type);if(!all.some(s=>s.id===screenId))screenId=firstScreen(p,type,all);
 const i=all.findIndex(s=>s.id===screenId),s=all[i],prev=all[i-1],next=all[i+1],st=status(p,type,s);
 const parts=[...new Set(all.map(x=>x.part))];
 let nav='<nav class="cp-wt-nav" aria-label="Walkthrough steps">'+meter(p,type,all)+parts.map(part=>{const ss=all.filter(x=>x.part===part),sts=ss.map(x=>status(p,type,x)),done=part!=='finish'&&sts.every(x=>x.seen&&!x.todo);
  return '<div class="cp-wt-part"><p class="cp-wt-part-h">'+(done?'<span class="cp-wt-mark is-done" aria-hidden="true">✓</span>':'')+esc(PARTS[part])+'</p><ol>'+ss.map((x,j)=>{const y=sts[j],here=x.id===s.id;
   const mark=here?'→':y.seen&&!y.todo?'✓':'';const cls=here?' is-here':y.seen&&!y.todo?(y.skipped?' is-skip':' is-done'):'';
   return '<li><button type="button" data-action="wt-go" data-id="'+x.id+'"'+(here?' aria-current="step"':'')+'><span class="cp-wt-mark'+cls+'" aria-hidden="true">'+mark+'</span><span>'+esc(x.nav)+'</span>'+(y.todo&&x.id!=='review'?'<em class="cp-page-count" aria-label="'+y.todo+' to do">'+y.todo+'</em>':'')+'</button></li>';}).join('')+'</ol></div>';}).join('')+'<button type="button" class="cp-link cp-wt-full" data-action="wt-full">See the whole form at once</button></nav>';
 const head='<div class="cp-wt-top"><button type="button" class="cp-wt-back" data-action="wt-go" data-id="'+(prev?prev.id:'')+'"'+(prev?'':' disabled')+' aria-label="Previous screen">←</button><p class="cp-eyebrow">'+esc(PARTS[s.part])+' · Step '+(i+1)+' of '+all.length+'</p></div><h2 class="cp-wt-q" tabindex="-1">'+esc(s.q)+'</h2>'+(s.why?'<p class="cp-wt-why">'+esc(s.why)+'</p>':'');
 let body='';
 if(s.id==='documents')body=documentsScreen(p,t,s);
 else if(s.id==='portal')body=portalScreen(s);
 else if(s.id==='review')body=reviewScreen(p,t,all);
 else{
  if(s.gate&&!st.filled.length){const g=st.gate;body+='<fieldset class="cp-wt-gate"><legend>'+esc(s.gate)+'</legend><div class="cp-wt-tiles">'+[['yes','Yes'],['no','Not yet / not needed']].map(([v,l])=>'<label class="cp-wt-tile"><input type="radio" name="wt-gate" value="'+v+'"'+(g===v?' checked':'')+'><span>'+(g===v?'✓ ':'')+esc(l)+'</span></label>').join('')+'</div></fieldset>';}
  const hide=s.gate&&!st.filled.length&&st.gate!=='yes';
  body+='<div class="cp-wt-fields" data-wt-fields'+(hide?' hidden':'')+'>'+intro(s,st,p,t)+s.rows.filter(r=>!Object.values(s.twins).includes(r)&&!(r.locked&&r.name!=='permit_type')).map(r=>row(p,t,r,Object.entries(s.twins).find(([k])=>k===r.key)?.[1])).join('')+'</div>';
 }
 const extra=s.id==='cost'&&root.PermitPrepUI?root.PermitPrepUI.valuation(p):s.id==='setbacks'&&root.MeasurementWorkbench?root.MeasurementWorkbench.panel(p):'';
 const actions='<div class="cp-wt-actions">'+(prev?'<button type="button" data-action="wt-go" data-id="'+prev.id+'">← Previous</button>':'<span></span>')+(next?'<button type="submit" class="cp-primary" data-wt-next="'+next.id+'">Save &amp; continue →</button>':'<button type="submit">Save</button>')+'</div><p class="city-save-state" role="status">Saved to this project as you go. Nothing is sent to the city.</p>';
 return '<div class="cp-wt" data-wt-type="'+esc(type)+'">'+nav+'<div class="cp-wt-main"><form data-command="city_application_page" data-wt-screen="'+s.id+'"'+(s.gate?' data-wt-gate="'+s.id+'"':'')+'><input type="hidden" name="permitType" value="'+esc(type)+'"><input type="hidden" name="wt-screen" value="'+s.id+'">'+head+body+actions+'</form>'+(extra?'<div class="cp-wt-extra">'+extra+'</div>':'')+'</div><aside class="cp-wt-side cp-panel" aria-label="Where these answers come from">'+side(p,t,s)+'</aside></div>';
}
// What to save when the user leaves a screen: their yes/no, that they've seen it, and answers they ticked as right.
function commands(p,form){
 const data=new FormData(form),type=data.get('permitType'),id=data.get('wt-screen');if(!id)return [];
 const st=state(p,type),out=[],g=form.querySelector('[name=wt-gate]:checked');
 if(form.dataset.wtGate&&g&&(st.gates||{})[form.dataset.wtGate]!==g.value)out.push({type:'walkthrough',permitType:type,gate:form.dataset.wtGate,value:g.value});
 if(!(st.seen||[]).includes(id))out.push({type:'walkthrough',permitType:type,seen:id});
 return out;
}
function reviews(p,form){
 const data=new FormData(form),type=data.get('permitType'),rows=C.rows(p,type),out=[];
 for(const k of data.getAll('wt-ok')){const r=rows.find(x=>x.key===k);if(!r||blank(r)||r.review.state==='confirmed')continue;const s=sourceFor(p,r,type);
  out.push({type:'answer_review',permitType:type,fieldKey:k,state:'confirmed',reviewer:'You',reason:'Checked in the permit walkthrough against '+s.from+'.',locator:[s.from,s.where].filter(Boolean).join(' · '),documentId:s.documentId||'',confirmed:true,expected:C.Reviews.fingerprint(p,r)});}
 return out;
}
if(root.document){
 root.document.addEventListener('change',e=>{const g=e.target.closest?.('.cp-wt-gate input[name=wt-gate]');if(g){const f=g.closest('form');f.querySelectorAll('.cp-wt-tile span').forEach(s=>s.textContent=s.textContent.replace(/^✓ /,''));const sp=g.parentElement.querySelector('span');sp.textContent='✓ '+sp.textContent;const box=f.querySelector('[data-wt-fields]');if(box)box.hidden=g.value!=='yes';}});
 root.document.addEventListener('input',e=>{const id=e.target.id;if(!id)return;root.document.querySelectorAll('[data-wt-twin="'+id+'"]').forEach(h=>h.value=e.target.value);});
 root.document.addEventListener('click',e=>{const b=e.target.closest?.('[data-wt-src]');if(!b)return;const k=b.dataset.wtSrc,card=root.document.getElementById('wt-src-'+k)||[...root.document.querySelectorAll('.cp-wt-src[data-keys]')].find(c=>c.dataset.keys.split(' ').includes(k));
  root.document.querySelectorAll('.cp-wt-src.is-on').forEach(c=>c.classList.remove('is-on'));if(card){card.classList.add('is-on');card.scrollIntoView?.({block:'nearest'});card.focus?.({preventScroll:true});}});
}
const api={SCREENS,screens,status,render,sourceFor,commands,reviews,firstScreen};if(node)module.exports=api;else root.PermitWalkthrough=api;
})(typeof window!=='undefined'?window:globalThis);
