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
 const houses=n(a.HOUSE_CNT),total=n(a.TOTAL_MKT_VALUE),land=n(a.LAND_MKT_VALUE),improvement=total!=null&&land!=null?total-land:null;
 const built=n(a.BUILT_YR)||n(a.EFFBUILT_YR),acres=n(a.PARCEL_ACRES),sqft=Number(f.lot_sf)||(acres?acres*43560:null);
 const yearBuilt=n(a.BUILT_YR),bldgSf=n(a.BLDG_SQFT),propClass=String(a.PROP_CLASS||''),vacantClass=/^vacant/i.test(propClass);
 // A house count with a vacant land class and no building size or year built is a record in transition
 // (typically a house being built and not yet assessed) — not an existing house to remodel or add to.
 const inTransition=houses>0&&!yearBuilt&&!bldgSf&&(vacantClass||improvement==null);
 const state=inTransition?'building':houses>0||(improvement!=null&&total>0&&improvement>Math.max(25000,0.15*total))?'improved':houses===0&&improvement!=null&&improvement<=Math.max(25000,0.15*(total||0))||(vacantClass&&!houses&&!bldgSf)?'vacant':'unknown';
 const find=(re,section)=>findings.find(x=>(!section||x.section===section)&&re.test(x.item||''));
 const parcelSrc={label:'County parcel record',url:findings.find(x=>x.item==='Assessor')?.url||findings.find(x=>x.item==='Parcel')?.url||null};
 return {state,houses,built,propClass,acres,sqft,improvement,total,land,parcelSrc,zone:f.zone_std||null,landslide:find(/landslide/i,'geo'),slope:findings.find(x=>x.section==='survey'&&x.status==='flag'&&/slope/i.test(x.headline||'')),
  hoa:find(/HOA registration|CC&Rs/i,'ccr'),platSetbacks:find(/plat setbacks/i,'land'),basements:findings.find(x=>/basement/i.test(x.headline||'')&&x.section==='geo'),poolFlags:findings.filter(x=>x.section==='pool'&&['flag','watch'].includes(x.status))};
}
const r=(text,src)=>({text,source:src||null});
// Fit and reasons for one plan on this lot.
function assess(plan,F,{asAddOn=false}={}){
 const reasons=[],small=F.sqft&&F.sqft<6000,setbacks=F.zone&&(F.zone.front||F.zone.rear)?F.zone:null;
 const lotLine=F.sqft?'Lot is about '+Math.round(F.sqft).toLocaleString('en-US')+' sq ft'+(F.acres?' ('+F.acres+' acre)':''):'';
 const houseLine=F.state==='building'?'County record counts '+(F.houses>1?F.houses+' houses':'a house')+' but classifies the land as '+(F.propClass||'vacant')+', with no building size or year built'+(F.built?' (effective year '+F.built+')':'')+'. The house is most likely not built yet':F.state==='improved'?'County record shows '+(F.houses>1?F.houses+' houses':'a house')+(F.built?' (built or updated '+F.built+')':'')+(F.improvement!=null?' worth about $'+Math.round(F.improvement/1000).toLocaleString('en-US')+'k':''):F.state==='vacant'?'County record shows no house on the lot':'';
 let fit='possible';
 if(plan==='evaluate')return {fit:null,reasons:[r('See the site findings and approvals without choosing a project yet.')]};
 if(plan==='new-home'){if(F.state==='building'){fit='good';reasons.push(r(houseLine+'.',F.parcelSrc));}else if(F.state==='vacant'){fit='good';reasons.push(r(houseLine,F.parcelSrc));}else if(F.state==='improved'){fit='constrained';reasons.push(r(houseLine+'; a new home would mean replacing it.',F.parcelSrc));}}
 if(plan==='replace-home'){if(F.state!=='improved')return null;fit='constrained';reasons.push(r(houseLine+(F.built&&F.built>=new Date().getFullYear()-5?'; recently built':''),F.parcelSrc));}
 if(!asAddOn&&['addition','remodel','basement','adu','deck','garage','pool','solar','retaining-wall'].includes(plan)&&(F.state==='vacant'||F.state==='building'))return null;
 if(['remodel','basement','adu'].includes(plan)){if(F.state==='improved'){fit='good';reasons.push(r('Work stays inside the existing house, so setbacks and most site hazards don\'t change.'));}else reasons.push(r('Only if there is a finished house on the lot; the county parcel record does not say.',F.parcelSrc));
  if(plan==='basement')fit='possible',reasons.push(r('Only if the house has an unfinished basement; the county parcel record does not say.'));
  if(plan==='adu')fit='possible',reasons.push(r('Check that zoning and the HOA covenants allow a second unit inside the house.',F.hoa?{label:F.hoa.source,url:F.hoa.url}:null));}
 if(PLANS[plan].footprint&&plan!=='new-home'&&plan!=='replace-home'){
  if(small&&setbacks){fit='constrained';reasons.push(r(lotLine+'; '+setbacks.zone+' zoning sets '+setbacks.front+' ft front and '+setbacks.rear+' ft rear setbacks'+(F.platSetbacks?' (the subdivision plat may set different ones)':'')+', which leaves little room outside the house.',{label:'Zoning setbacks',url:setbacks.source}));}
  else if(lotLine)reasons.push(r(lotLine+'.',F.parcelSrc));
  if(F.landslide&&F.landslide.status==='flag')reasons.push(r('New footprint on mapped landslide ground likely needs geotechnical review.',{label:F.landslide.source,url:F.landslide.url}));
 }
 if(plan==='pool'){for(const x of F.poolFlags.slice(0,2))reasons.push(r(x.headline,{label:x.source,url:x.url}));if(F.poolFlags.length)fit='constrained';}
 if(['deck','solar','retaining-wall'].includes(plan)){fit='possible';if(F.slope&&plan==='retaining-wall')reasons.push(r('Sloped lot ('+F.slope.headline.split('·')[0].trim()+'): the city\'s retaining-wall permit asks for engineering and stamped calculations.',{label:'Ogden Valley City permit form',url:null}));if(F.slope&&plan==='deck')reasons.push(r('Sloped lot ('+F.slope.headline.split('·')[0].trim()+'): a deck may need engineered footings.',{label:F.slope.source,url:F.slope.url}));}
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
function command(id,addOns=[]){const p=PLANS[id];if(!p)throw Error('Unknown plan');const extra=addOns.filter(a=>p.addOns.includes(a)&&PLANS[a]);
 const all=[p,...extra.map(a=>PLANS[a])],typeIds=[...new Set(all.flatMap(x=>x.typeIds))],scope={...p.scope};if(extra.some(a=>PLANS[a].scope.adu))scope.adu='yes';
 return {type:'project_intent',plan:id,addOns:extra,label:[p.short||p.label,...extra.map(a=>PLANS[a].short.toLowerCase())].join(' + '),typeIds,scope,pool:all.some(x=>x.pool)?'included':null};}
function basis(F){return F.state==='building'?'The county record suggests a house is being built here, so building it is listed first.':F.state==='improved'?'This lot already has a house, so projects that change it are listed first.':F.state==='vacant'?'This lot has no house on record, so building one is listed first.':'The county record does not say whether there is a house, so all options are shown.';}
const tag=fit=>fit?' <span class="cp-status cp-'+(fit==='good'?'ok':fit==='constrained'?'review':'neutral')+'">'+FIT[fit]+'</span>':'';
const reasonList=(x,n=3)=>x.reasons.length?'<ul class="cp-intent-reasons">'+x.reasons.slice(0,n).map(z=>'<li>'+esc(z.text)+(z.source?.label?' <small>('+link(z.source.url,z.source.label)+')</small>':'')+'</li>').join('')+'</ul>':'';
function card(report,{project=null,limit=4,selected=null}={}){
 const intent=project?.application?.intent,s=suggest(report);
 if(intent&&!selected)return '<section class="cp-intent cp-intent-set" aria-label="Your project"><p><strong>Planning:</strong> '+esc(intent.label)+' <button type="button" data-intent-change>Change</button></p></section>';
 if(selected&&PLANS[selected]){const p=PLANS[selected],F=s.lot,main=s.plans.find(x=>x.id===selected)||{reasons:[],fit:null};
  const addOns=p.addOns.map(id=>({id,...PLANS[id],...(assess(id,F,{asAddOn:true})||{fit:null,reasons:[]})}));
  return '<section class="cp-answer cp-intent" aria-label="Choose permits"><p class="cp-eyebrow">Your permits</p><p><strong>'+esc(p.label)+'</strong> <small>(permit: '+esc(p.permit)+')</small>'+tag(main.fit)+'</p>'+reasonList(main,2)+
   (addOns.length?'<fieldset class="cp-intent-addons"><legend>Also planning any of these? Each is its own permit.</legend>'+addOns.map(x=>'<label><input type="checkbox" data-addon="'+esc(x.id)+'"> '+esc(x.label)+tag(x.fit)+(x.reasons[0]?'<br><small>'+esc(x.reasons[0].text)+'</small>':'')+'</label>').join('')+'</fieldset>':'')+
   '<p><button type="button" class="primary" data-intent-confirm="'+esc(selected)+'">Research these permits</button> <button type="button" data-intent-back>Back</button></p><p><small>Cornerpin then researches only what these permits need. You can change this later; only the extra research runs.</small></p></section>';}
 const row=x=>'<li><button type="button" class="cp-intent-option" data-intent="'+esc(x.id)+'"><span class="cp-intent-label">'+esc(x.label)+'</span>'+tag(x.fit)+'</button>'+reasonList(x)+'</li>';
 const top=s.plans.slice(0,limit),rest=s.plans.slice(limit);
 return '<section class="cp-answer cp-intent" aria-label="What are you planning for this lot?"><p class="cp-eyebrow">What are you planning?</p><p>'+esc(basis(s.lot))+(s.lot.state!=='unknown'&&s.lot.parcelSrc.url?' <small>('+link(s.lot.parcelSrc.url,'County parcel record')+')</small>':'')+' Ranked by fit with this lot\'s records — not a prediction. Pick the main permit; you can add related permits next.</p><ol class="cp-intent-list">'+top.map(row).join('')+'</ol>'+(rest.length?'<details><summary>More options</summary><ol class="cp-intent-list">'+rest.map(row).join('')+'</ol></details>':'')+'<p>'+'<button type="button" class="cp-intent-option" data-intent-confirm="evaluate">'+esc(s.evaluate.label)+'</button> <small>Researches everything; slower.</small></p></section>';
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
