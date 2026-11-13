/* "What are you planning?" — asked right after the address, with the projects that best fit this
   lot ranked first. Fit comes only from this lot's records (county parcel record, zoning setbacks,
   site findings), each reason with its source. It is not a prediction of what people file, and it
   never decides for the user. The choice maps to the city's real permit types and the existing
   rule scope so later pages can be specific. */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,text)=>/^https?:\/\//.test(url||'')?'<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(text)+'</a>':esc(text);
// Plans → City Inspect permit types and approval-rule scope. typeIds must exist in the city catalog.
const PLANS={
 'new-home':{label:'Build a new home',typeIds:['1'],scope:{work:'new-home'},exterior:true,footprint:true},
 'replace-home':{label:'Tear down and rebuild',typeIds:['104','1'],scope:{work:'new-home',demolition:'yes'},exterior:true,footprint:true},
 'addition':{label:'Add on to the house',typeIds:['3'],scope:{work:'addition'},exterior:true,footprint:true},
 'remodel':{label:'Remodel inside the house',typeIds:['4'],scope:{work:'other'}},
 'basement':{label:'Finish the basement',typeIds:['70'],scope:{work:'other'}},
 'adu':{label:'Add an apartment inside the house (internal ADU)',typeIds:['102'],scope:{work:'other',adu:'yes'}},
 'deck':{label:'Build a deck',typeIds:['74'],scope:{work:'other'},exterior:true},
 'garage':{label:'Build a detached garage or outbuilding',typeIds:['96'],scope:{work:'addition'},exterior:true,footprint:true},
 'pool':{label:'Add a pool',typeIds:['2'],scope:{work:'other'},pool:'included',exterior:true,footprint:true},
 'solar':{label:'Add solar panels',typeIds:['8'],scope:{work:'other'},exterior:true},
 'evaluate':{label:'Just evaluating the lot',typeIds:[],scope:{}}
};
const FIT={good:'Good fit',possible:'Possible',constrained:'Constrained'};
function facts(report){
 const a=report?.parcel?.attrs||{},f=report?.facts||{},findings=report?.findings||[],n=v=>Number.isFinite(Number(v))?Number(v):null;
 const houses=n(a.HOUSE_CNT),total=n(a.TOTAL_MKT_VALUE),land=n(a.LAND_MKT_VALUE),improvement=total!=null&&land!=null?total-land:null;
 const built=n(a.BUILT_YR)||n(a.EFFBUILT_YR),acres=n(a.PARCEL_ACRES),sqft=Number(f.lot_sf)||(acres?acres*43560:null);
 const state=houses>0||(improvement!=null&&total>0&&improvement>Math.max(25000,0.15*total))?'improved':houses===0&&improvement!=null&&improvement<=Math.max(25000,0.15*(total||0))?'vacant':'unknown';
 const find=(re,section)=>findings.find(x=>(!section||x.section===section)&&re.test(x.item||''));
 const parcelSrc={label:'County parcel record',url:findings.find(x=>x.item==='Assessor')?.url||findings.find(x=>x.item==='Parcel')?.url||null};
 return {state,houses,built,acres,sqft,improvement,total,land,parcelSrc,zone:f.zone_std||null,landslide:find(/landslide/i,'geo'),slope:findings.find(x=>x.section==='survey'&&x.status==='flag'&&/slope/i.test(x.headline||'')),
  hoa:find(/HOA registration|CC&Rs/i,'ccr'),platSetbacks:find(/plat setbacks/i,'land'),basements:findings.find(x=>/basement/i.test(x.headline||'')&&x.section==='geo'),poolFlags:findings.filter(x=>x.section==='pool'&&['flag','watch'].includes(x.status))};
}
const r=(text,src)=>({text,source:src||null});
// Fit and reasons for one plan on this lot.
function assess(plan,F){
 const reasons=[],small=F.sqft&&F.sqft<6000,setbacks=F.zone&&(F.zone.front||F.zone.rear)?F.zone:null;
 const lotLine=F.sqft?'Lot is about '+Math.round(F.sqft).toLocaleString('en-US')+' sq ft'+(F.acres?' ('+F.acres+' acre)':''):'';
 const houseLine=F.state==='improved'?'County record shows '+(F.houses>1?F.houses+' houses':'a house')+(F.built?' (built or updated '+F.built+')':'')+(F.improvement!=null?' worth about $'+Math.round(F.improvement/1000).toLocaleString('en-US')+'k':''):F.state==='vacant'?'County record shows no house on the lot':'';
 let fit='possible';
 if(plan==='evaluate')return {fit:null,reasons:[r('See the site findings and approvals without choosing a project yet.')]};
 if(plan==='new-home'){if(F.state==='vacant'){fit='good';reasons.push(r(houseLine,F.parcelSrc));}else if(F.state==='improved'){fit='constrained';reasons.push(r(houseLine+'; a new home would mean replacing it.',F.parcelSrc));}}
 if(plan==='replace-home'){if(F.state!=='improved')return null;fit='constrained';reasons.push(r(houseLine+(F.built&&F.built>=new Date().getFullYear()-5?'; recently built':''),F.parcelSrc));}
 if(['addition','remodel','basement','adu','deck','garage','pool','solar'].includes(plan)&&F.state==='vacant')return null;
 if(['remodel','basement','adu'].includes(plan)){fit='good';reasons.push(r('Work stays inside the existing house, so setbacks and most site hazards don\'t change.',F.parcelSrc));
  if(plan==='basement')fit='possible',reasons.push(r('Only if the house has an unfinished basement; the county record does not say.',F.parcelSrc));
  if(plan==='adu')fit='possible',reasons.push(r('Check that zoning and the HOA covenants allow a second unit inside the house.',F.hoa?{label:F.hoa.source,url:F.hoa.url}:null));}
 if(PLANS[plan].footprint&&plan!=='new-home'&&plan!=='replace-home'){
  if(small&&setbacks){fit='constrained';reasons.push(r(lotLine+'; '+setbacks.zone+' zoning sets '+setbacks.front+' ft front and '+setbacks.rear+' ft rear setbacks'+(F.platSetbacks?' (the subdivision plat may set different ones)':'')+', which leaves little room outside the house.',{label:'Zoning setbacks',url:setbacks.source}));}
  else if(lotLine)reasons.push(r(lotLine+'.',F.parcelSrc));
  if(F.landslide&&F.landslide.status==='flag')reasons.push(r('New footprint on mapped landslide ground likely needs geotechnical review.',{label:F.landslide.source,url:F.landslide.url}));
 }
 if(plan==='pool'){for(const x of F.poolFlags.slice(0,2))reasons.push(r(x.headline,{label:x.source,url:x.url}));if(F.poolFlags.length)fit='constrained';}
 if(['deck','solar'].includes(plan)){fit='possible';if(F.slope&&plan==='deck')reasons.push(r('Sloped lot ('+F.slope.headline.split('·')[0].trim()+'): a deck may need engineered footings.',{label:F.slope.source,url:F.slope.url}));}
 if(PLANS[plan].exterior&&F.hoa&&plan!=='new-home'&&plan!=='replace-home')reasons.push(r('The lot is in an HOA; see Approvals for its rules on exterior changes.',{label:F.hoa.source,url:F.hoa.url}));
 if(plan==='new-home'&&F.state==='vacant'&&F.landslide?.status==='flag')reasons.push(r('Mapped landslide on the lot: plan for a geologic hazards study.',{label:F.landslide.source,url:F.landslide.url}));
 return {fit,reasons:reasons.filter(x=>x.text)};
}
const ORDER={good:0,possible:1,constrained:2};
function suggest(report){
 const F=facts(report),out=[];
 for(const id of Object.keys(PLANS)){if(id==='evaluate')continue;const a=assess(id,F);if(a)out.push({id,...PLANS[id],...a});}
 out.sort((x,y)=>ORDER[x.fit]-ORDER[y.fit]);
 return {lot:F,plans:out,evaluate:{id:'evaluate',...PLANS.evaluate,...assess('evaluate',F)}};
}
function command(id){const p=PLANS[id];if(!p)throw Error('Unknown plan');return {type:'project_intent',plan:id,label:p.label,typeIds:p.typeIds,scope:p.scope,pool:p.pool||null};}
function basis(F){return F.state==='improved'?'This lot already has a house, so projects that change it are listed first.':F.state==='vacant'?'This lot has no house on record, so building one is listed first.':'The county record does not say whether there is a house, so all options are shown.';}
function card(report,{project=null,limit=4}={}){
 const intent=project?.application?.intent,s=suggest(report);
 if(intent)return '<section class="cp-intent cp-intent-set" aria-label="Your project"><p><strong>Planning:</strong> '+esc(intent.label)+' <button type="button" data-intent-change>Change</button></p></section>';
 const row=x=>'<li><button type="button" class="cp-intent-option" data-intent="'+esc(x.id)+'"><span class="cp-intent-label">'+esc(x.label)+'</span>'+(x.fit?' <span class="cp-status cp-'+(x.fit==='good'?'ok':x.fit==='constrained'?'review':'neutral')+'">'+FIT[x.fit]+'</span>':'')+'</button>'+(x.reasons.length?'<ul class="cp-intent-reasons">'+x.reasons.slice(0,3).map(z=>'<li>'+esc(z.text)+(z.source?.label?' <small>('+link(z.source.url,z.source.label)+')</small>':'')+'</li>').join('')+'</ul>':'')+'</li>';
 const top=s.plans.slice(0,limit),rest=s.plans.slice(limit);
 return '<section class="cp-answer cp-intent" aria-label="What are you planning for this lot?"><p class="cp-eyebrow">What are you planning?</p><p>'+esc(basis(s.lot))+' Ranked by fit with this lot\'s records — not a prediction, and you can change it later.</p><ol class="cp-intent-list">'+top.map(row).join('')+'</ol>'+(rest.length?'<details><summary>More options</summary><ol class="cp-intent-list">'+rest.map(row).join('')+'</ol></details>':'')+'<p>'+'<button type="button" class="cp-intent-option" data-intent="evaluate">'+esc(s.evaluate.label)+'</button></p></section>';
}
// Choosing a plan saves it through the workspace and refreshes the cards that depend on it.
if(typeof document!=='undefined')document.addEventListener('click',async e=>{
 const W=root.ProjectWorkspace,change=e.target.closest?.('[data-intent-change]'),pick=e.target.closest?.('[data-intent]');
 if(!change&&!pick)return;const p=W?.project?.();if(!p)return;
 if(change){const box=change.closest('section');box.outerHTML=card(p.report,{project:{application:{}}});return;}
 const box=pick.closest('section');pick.disabled=true;
 try{await W.commit(command(pick.dataset.intent));const next=W.project();
  for(const id of ['site-intent','overview-intent'])document.getElementById(id)?.replaceChildren(document.createRange().createContextualFragment(card(next.report,{project:next})));
  const site=document.getElementById('site-answer');if(site&&root.SiteAnswer)site.innerHTML=root.SiteAnswer.card(next.report,{project:next,where:'site'});
 }catch(err){pick.disabled=false;box?.insertAdjacentHTML('beforeend','<p role="status">'+esc(err.message)+'</p>');}
});
const api={PLANS,facts,assess,suggest,command,card};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ProjectIntent=api;
})(typeof window!=='undefined'?window:globalThis);
