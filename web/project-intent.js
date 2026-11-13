/* "What are you planning?" — asked right after the address, with the projects that best fit this
   lot ranked first. Fit comes only from this lot's records (county parcel record, zoning setbacks,
   site findings), each reason with its source. It is not a prediction of what people file, and it
   never decides for the user. The choice maps to the city's real permit types and the existing
   rule scope so later pages can be specific. */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,text)=>/^https?:\/\//.test(url||'')?'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(text)+'</a>':esc(text);
// Plans → City Inspect permit types and approval-rule scope. typeIds must exist in the city catalog.
// Each option is centred on a permit; add-ons are the permits commonly filed alongside it.
const ACCESSORY=['pool','garage','deck','retaining-wall','solar'],INTERIOR=['remodel','basement','adu'];
const PLANS={
 'new-home':{label:'New single-family home',short:'New home',permit:'Single Family Dwelling',typeIds:['1'],scope:{work:'new-home'},exterior:true,footprint:true,addOns:ACCESSORY},
 'replace-home':{label:'Tear down and build a new home',short:'Rebuild',permit:'Demolition + Single Family Dwelling',typeIds:['104','1'],scope:{work:'new-home',demolition:'yes'},exterior:true,footprint:true,addOns:ACCESSORY},
 'addition':{label:'Addition to the house',short:'Addition',permit:'Addition',typeIds:['3'],scope:{work:'addition'},exterior:true,footprint:true,addOns:['deck','remodel']},
 'remodel':{label:'Remodel inside the house',short:'Remodel',permit:'Remodel',typeIds:['4'],scope:{work:'other'},addOns:['basement','adu']},
 'basement':{label:'Basement finish',short:'Basement finish',permit:'Basement Finish',typeIds:['70'],scope:{work:'other'},addOns:['remodel','adu']},
 'adu':{label:'Apartment inside the house (internal ADU)',short:'Internal ADU',permit:'Internal ADU',typeIds:['102'],scope:{work:'other',adu:'yes'},addOns:['remodel','basement']},
 'deck':{label:'Deck',short:'Deck',permit:'Deck',typeIds:['74'],scope:{work:'accessory'},exterior:true,addOns:['pool','garage','retaining-wall','solar']},
 'garage':{label:'Detached garage',short:'Garage',permit:'Garage (Detached)',typeIds:['96'],scope:{work:'accessory'},exterior:true,footprint:true,addOns:['pool','deck','retaining-wall','solar']},
 'pool':{label:'Pool',short:'Pool',permit:'Pool',typeIds:['2'],scope:{work:'accessory'},pool:'included',exterior:true,footprint:true,addOns:['deck','garage','retaining-wall','solar']},
 'retaining-wall':{label:'Retaining wall',short:'Retaining wall',permit:'Retaining Wall',typeIds:['6'],scope:{work:'accessory'},exterior:true,footprint:true,addOns:['deck','pool','garage']},
 'solar':{label:'Solar panels',short:'Solar',permit:'Solar',typeIds:['8'],scope:{work:'accessory'},exterior:true,addOns:['deck','pool','garage']},
 'evaluate':{label:'Just evaluating the lot',short:'Evaluating',permit:'',typeIds:[],scope:{},addOns:[]}
};
const FIT={good:'Good fit',possible:'Possible',constrained:'Constrained'};
function facts(report){
 const a=report?.parcel?.attrs||{},f=report?.facts||{},findings=report?.findings||[],n=v=>Number.isFinite(Number(v))?Number(v):null;
 // Weber's HOUSE_CNT is 1 on almost every parcel, vacant ones included, so it is not evidence of a house.
 // Decide from the land class, year built and how much of the market value is in buildings.
 const total=n(a.TOTAL_MKT_VALUE),land=n(a.LAND_MKT_VALUE),improvement=total!=null&&land!=null?total-land:null;
 const yearBuilt=n(a.BUILT_YR),eff=n(a.EFFBUILT_YR),built=yearBuilt||eff,acres=n(a.PARCEL_ACRES),sqft=Number(f.lot_sf)||(acres?acres*43560:null);
 const propClass=String(a.PROP_CLASS||''),vacantClass=/^vacant/i.test(propClass),homeClass=/^(residential|mixed)/i.test(propClass);
 const bigImp=improvement!=null&&total>0&&improvement>Math.max(25000,0.15*total);
 const state=(vacantClass||(!propClass&&improvement!=null&&!yearBuilt))&&!bigImp?'vacant':bigImp||(homeClass&&yearBuilt)?'improved':'unknown';
 const year=new Date().getFullYear();
 // New construction: built in the last two years, or a large building value with no year built yet.
 const recent=state==='improved'&&((yearBuilt&&yearBuilt>=year-2)||(!yearBuilt&&eff&&eff>=year-1&&bigImp));
 // Teardown candidate: an old house carrying little of the value next to its land.
 const teardown=state==='improved'&&!recent&&yearBuilt&&yearBuilt<year-50&&improvement!=null&&total>0&&improvement<0.2*total;
 const outbuildings=state==='vacant'&&!!(yearBuilt||n(a.BLDG_SQFT));
 const find=(re,section)=>findings.find(x=>(!section||x.section===section)&&re.test(x.item||''));
 const parcelSrc={label:'County parcel record',url:findings.find(x=>x.item==='Assessor')?.url||findings.find(x=>x.item==='Parcel')?.url||null};
 return {state,yearBuilt,recent,teardown,outbuildings,built,propClass,acres,sqft,improvement,total,land,parcelSrc,zone:f.zone_std||null,landslide:find(/landslide/i,'geo'),slope:findings.find(x=>x.section==='survey'&&x.status==='flag'&&/slope/i.test(x.headline||'')),
  // HOA: confirmed by the state registry match, or only likely (platted subdivision with CC&Rs referenced).
  hoa:find(/HOA registration/i,'ccr')||(f.hoaReg?{source:'Utah HOA registry',url:f.hoaReg.source||null}:null)||findings.find(x=>x.section==='ccr'&&/CC&Rs/i.test(x.item||'')&&!/not in a platted subdivision/i.test(x.headline||''))||null,
  hoaConfirmed:!!(find(/HOA registration/i,'ccr')||f.hoaReg),platSetbacks:find(/plat setbacks/i,'land'),basements:findings.find(x=>/basement/i.test(x.headline||'')&&x.section==='geo'),poolFlags:findings.filter(x=>x.section==='pool'&&['flag','watch'].includes(x.status))};
}
const r=(text,src)=>({text,source:src||null});
// Fit and reasons for one plan on this lot.
function assess(plan,F,{asAddOn=false}={}){
 const reasons=[],small=F.sqft&&F.sqft<6000,setbacks=F.zone&&(F.zone.front||F.zone.rear)?F.zone:null;
 const lotLine=F.sqft?'Lot is about '+Math.round(F.sqft).toLocaleString('en-US')+' sq ft'+(F.acres?' ('+F.acres+' acre)':''):'';
 const money=v=>'$'+(v>=1e6?(v/1e6).toFixed(1)+'M':Math.round(v/1000).toLocaleString('en-US')+'k');
 const houseLine=F.state==='vacant'?'County record classifies the land as '+(F.propClass||'vacant')+(F.outbuildings?', with outbuildings'+(F.yearBuilt?' from '+F.yearBuilt:'')+' but no house value':' with no building on record'):
  F.state==='improved'?'County record shows a house'+(F.yearBuilt?' built in '+F.yearBuilt:F.recent?', newly assessed ('+F.built+')':'')+(F.improvement!=null&&F.improvement>0?', buildings valued at about '+money(F.improvement)+(F.land?' on '+money(F.land)+' of land':''):''):'';
 let fit='possible';
 if(plan==='evaluate')return {fit:null,reasons:[r('See the site findings and approvals without choosing a project yet.')]};
 if(plan==='new-home'){if(F.state==='vacant'){fit='good';reasons.push(r(houseLine+'.',F.parcelSrc));}else if(F.state==='improved'){if(!F.recent)return null;fit='constrained';reasons.push(r(houseLine+'; a new home would mean replacing a house that was just built.',F.parcelSrc));}}
 if(plan==='replace-home'){if(F.state!=='improved'||F.recent)return null;if(F.teardown){fit='good';reasons.push(r(houseLine+': most of the value is in the land, which is typical of a teardown.',F.parcelSrc));}else{fit='constrained';reasons.push(r(houseLine+'.',F.parcelSrc));}}
 if(!asAddOn&&['addition','remodel','basement','adu','deck','garage','pool','solar','retaining-wall'].includes(plan)&&F.state==='vacant')return null;
 if(['remodel','basement','adu'].includes(plan)){if(F.state==='improved'&&F.teardown){reasons.push(r(houseLine+'; check the house is worth keeping before remodeling.',F.parcelSrc));}else if(F.state==='improved'){fit=F.recent&&plan==='remodel'?'possible':'good';if(F.recent&&plan==='remodel')reasons.push(r(houseLine+'; a new house rarely needs remodeling yet.',F.parcelSrc));reasons.push(r('Work stays inside the existing house, so setbacks and most site hazards don\'t change.'));}else reasons.push(r('Only if there is a finished house on the lot; the county parcel record does not say.',F.parcelSrc));
  if(plan==='basement')fit='possible',reasons.push(r('Only if the house has an unfinished basement; the county parcel record does not say.'));
  if(plan==='adu')fit='possible',reasons.push(r('Check that zoning'+(F.hoa?' and the '+(F.hoaConfirmed?'HOA':'recorded')+' covenants':'')+' allow a second unit inside the house.',F.hoa?{label:F.hoa.source,url:F.hoa.url}:null));}
 if(PLANS[plan].footprint&&plan!=='new-home'&&plan!=='replace-home'){
  if(small&&setbacks){fit='constrained';reasons.push(r(lotLine+'; '+setbacks.zone+' zoning sets '+setbacks.front+' ft front and '+setbacks.rear+' ft rear setbacks'+(F.platSetbacks?' (the subdivision plat may set different ones)':'')+', which leaves little room outside the house.',{label:'Zoning setbacks',url:setbacks.source}));}
  else if(lotLine)reasons.push(r(lotLine+'.',F.parcelSrc));
  if(F.landslide&&F.landslide.status==='flag')reasons.push(r('New footprint on mapped landslide ground likely needs geotechnical review.',{label:F.landslide.source,url:F.landslide.url}));
 }
 if(plan==='pool'){for(const x of F.poolFlags.slice(0,2))reasons.push(r(x.headline,{label:x.source,url:x.url}));if(F.poolFlags.length)fit='constrained';}
 if(['deck','solar','retaining-wall'].includes(plan)){fit='possible';if(F.slope&&plan==='retaining-wall')reasons.push(r('Sloped lot ('+F.slope.headline.split('·')[0].trim()+'): the city\'s retaining-wall permit asks for engineering and stamped calculations.',{label:'Ogden Valley City permit form',url:null}));if(F.slope&&plan==='deck')reasons.push(r('Sloped lot ('+F.slope.headline.split('·')[0].trim()+'): a deck may need engineered footings.',{label:F.slope.source,url:F.slope.url}));}
 if(PLANS[plan].exterior&&F.hoa&&plan!=='new-home'&&plan!=='replace-home')reasons.push(r(F.hoaConfirmed?'The lot is in an HOA; see Approvals for its rules on exterior changes.':'Recorded CC&Rs are likely for this subdivision; see Approvals for any rules on exterior changes.',{label:F.hoa.source,url:F.hoa.url}));
 if(plan==='new-home'&&F.state==='vacant'&&F.landslide?.status==='flag')reasons.push(r('Mapped landslide on the lot: plan for a geologic hazards study.',{label:F.landslide.source,url:F.landslide.url}));
 return {fit,reasons:reasons.filter(x=>x.text)};
}
const ORDER={good:0,possible:1,constrained:2};
function suggest(report){
 const F=facts(report),out=[];
 for(const id of Object.keys(PLANS)){if(id==='evaluate')continue;const a=assess(id,F);if(a)out.push({id,...PLANS[id],...a});}
 // Among equal fits, a just-built house leads with finishing and outdoor work before changing the house.
 const first=F.recent?['basement','garage','pool','deck','solar','retaining-wall']:[],rank=id=>{const i=first.indexOf(id);return i<0?first.length:i;};
 out.sort((x,y)=>ORDER[x.fit]-ORDER[y.fit]||rank(x.id)-rank(y.id));
 return {lot:F,plans:out,evaluate:{id:'evaluate',...PLANS.evaluate,...assess('evaluate',F)}};
}
function command(id,addOns=[]){const p=PLANS[id];if(!p)throw Error('Unknown plan');const extra=addOns.filter(a=>p.addOns.includes(a)&&PLANS[a]);
 const all=[p,...extra.map(a=>PLANS[a])],typeIds=[...new Set(all.flatMap(x=>x.typeIds))],scope={...p.scope};if(extra.some(a=>PLANS[a].scope.adu))scope.adu='yes';
 return {type:'project_intent',plan:id,addOns:extra,label:[p.short||p.label,...extra.map(a=>PLANS[a].short.toLowerCase())].join(' + '),typeIds,scope,pool:all.some(x=>x.pool)?'included':null};}
function basis(F){return F.state==='improved'?(F.teardown?'This lot has an old house valued well below its land, so replacing it is listed first.':F.recent?'This lot has a newly built house, so finishing and outdoor projects are listed first.':'This lot already has a house, so projects that change it are listed first.'):F.state==='vacant'?'This lot has no house on record, so building one is listed first.':'The county record does not say whether there is a house, so all options are shown.';}
const tag=fit=>fit?' <span class="cp-status cp-'+(fit==='good'?'ok':fit==='constrained'?'review':'neutral')+'">'+FIT[fit]+'</span>':'';
const reasonList=(x,n=3)=>x.reasons.length?'<ul class="cp-intent-reasons">'+x.reasons.slice(0,n).map(z=>'<li>'+esc(z.text)+(z.source?.label?' <small>('+link(z.source.url,z.source.label)+')</small>':'')+'</li>').join('')+'</ul>':'';
const I=n=>(typeof module!=='undefined'&&module.exports?require('./icons'):root.CpIcons)?.icon(n)||'';
const PLAN_ICON={'new-home':'home','replace-home':'hardhat',addition:'building',remodel:'hardhat',basement:'home',adu:'users',deck:'ruler',garage:'building',pool:'droplet','retaining-wall':'mountain',solar:'zap',evaluate:'search'};
function card(report,{project=null,limit=4,selected=null}={}){
 const intent=project?.application?.intent,s=suggest(report);
 if(intent&&!selected)return '<section class="cp-intent cp-intent-set" aria-label="Your project"><p>'+I(PLAN_ICON[intent.plan]||'clipboard')+' <strong>Planning:</strong> '+esc(intent.label)+' <button type="button" data-intent-change>Change</button></p></section>';
 if(selected&&PLANS[selected]){const p=PLANS[selected],F=s.lot,main=s.plans.find(x=>x.id===selected)||{reasons:[],fit:null};
  const addOns=p.addOns.map(id=>({id,...PLANS[id],...(assess(id,F,{asAddOn:true})||{fit:null,reasons:[]})}));
  return '<section class="cp-answer cp-intent" aria-label="Choose permits"><p class="cp-eyebrow">Your permits</p><p class="cp-intent-chosen"><span class="cp-intent-ico">'+I(PLAN_ICON[selected]||'clipboard')+'</span><strong>'+esc(p.label)+'</strong> <small>(permit: '+esc(p.permit)+')</small>'+tag(main.fit)+'</p>'+reasonList(main,2)+
   (addOns.length?'<fieldset class="cp-intent-addons"><legend>Also planning any of these? Each is its own permit.</legend>'+addOns.map(x=>'<label class="cp-addon-tile"><input type="checkbox" data-addon="'+esc(x.id)+'"> <span class="cp-intent-ico">'+I(PLAN_ICON[x.id]||'clipboard')+'</span>'+esc(x.label)+tag(x.fit)+(x.reasons[0]?'<br><small>'+esc(x.reasons[0].text)+'</small>':'')+'</label>').join('')+'</fieldset>':'')+
   '<p><button type="button" class="primary" data-intent-confirm="'+esc(selected)+'">Research these permits</button> <button type="button" data-intent-back>Back</button></p><p><small>Cornerpin then researches only what these permits need. You can change this later; only the extra research runs.</small></p></section>';}
 const row=x=>'<li class="cp-intent-tile"><button type="button" class="cp-intent-option" data-intent="'+esc(x.id)+'"><span class="cp-intent-ico">'+I(PLAN_ICON[x.id]||'clipboard')+'</span><span class="cp-intent-label">'+esc(x.label)+'</span>'+tag(x.fit)+'</button>'+reasonList(x,2)+'</li>';
 const top=s.plans.slice(0,limit),rest=s.plans.slice(limit);
 return '<section class="cp-answer cp-intent" aria-label="What are you planning for this lot?"><div class="cp-ans-head"><span class="cp-ans-icon">'+I('clipboard')+'</span><p class="cp-eyebrow">What are you planning?</p></div><p class="cp-intent-basis">'+esc(basis(s.lot))+(s.lot.state!=='unknown'&&s.lot.parcelSrc.url?' <small>('+link(s.lot.parcelSrc.url,'County parcel record')+')</small>':'')+'</p><p class="cp-intent-hint"><small>Pick the main permit; you can add related permits next. Ranked by fit with this lot\'s records — not a prediction.</small></p><ol class="cp-intent-list">'+top.map(row).join('')+'</ol>'+(rest.length?'<details><summary>More options</summary><ol class="cp-intent-list">'+rest.map(row).join('')+'</ol></details>':'')+'<p class="cp-intent-evaluate">'+'<button type="button" class="cp-intent-option" data-intent-confirm="evaluate">'+I('search')+' '+esc(s.evaluate.label)+'</button> <small>Researches everything; slower.</small></p></section>';
}
// Picking a main permit shows its add-ons; confirming saves the bundle and asks the report to run
// the research those permits need (web/app.js listens for cornerpin:research-permits).
if(typeof document!=='undefined')document.addEventListener('click',async e=>{
 const W=root.ProjectWorkspace,t=e.target,change=t.closest?.('[data-intent-change]'),pick=t.closest?.('[data-intent]'),back=t.closest?.('[data-intent-back]'),confirm=t.closest?.('[data-intent-confirm]');
 if(!change&&!pick&&!back&&!confirm)return;const p=W?.project?.();const box=(change||pick||back||confirm).closest('section');
 if(!p){box?.insertAdjacentHTML('beforeend','<p role="status">Saving this lot to a project… try again in a moment.</p>');return;}
 if(change||back){box.outerHTML=card(p.report,{project:{application:{}}});return;}
 if(pick){box.outerHTML=card(p.report,{project:{application:{}},selected:pick.dataset.intent});return;}
 const id=confirm.dataset.intentConfirm,addOns=[...box.querySelectorAll('input[data-addon]:checked')].map(i=>i.dataset.addon);confirm.disabled=true;
 try{const cmd=command(id,addOns);await W.commit(cmd);const next=W.project();
  for(const el of ['site-intent','overview-intent'])document.getElementById(el)?.replaceChildren(document.createRange().createContextualFragment(card(next.report,{project:next})));
  const site=document.getElementById('site-answer');if(site&&root.SiteAnswer)site.innerHTML=root.SiteAnswer.card(next.report,{project:next,where:'site'});
  root.dispatchEvent(new CustomEvent('cornerpin:research-permits',{detail:{typeIds:id==='evaluate'?['*']:cmd.typeIds,label:cmd.label}}));
 }catch(err){confirm.disabled=false;box?.insertAdjacentHTML('beforeend','<p role="status">'+esc(err.message)+'</p>');}
});
const api={PLANS,facts,assess,suggest,command,card};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectIntent=api;
})(typeof window!=='undefined'?window:globalThis);
