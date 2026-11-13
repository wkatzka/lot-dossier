/* One packet per planned permit (other than a new single-family home, which keeps the detailed
   packet in web/lotreport.js). Three parts: what the city's application form asks for (City Inspect
   catalog), the city's rules for this kind of work (web/accessory-rules.js), and what this lot adds
   (only from research that has run; otherwise it says so). Items carry stable ids so reviews survive
   re-research. Statuses match the existing packet: ready, drafted, partial, pro, you, optional, na. */
(function(root){'use strict';
const node=typeof module!=='undefined'&&module.exports;
const A=node?require('./accessory-rules'):root.AccessoryRules;
const catalog=()=>node?require('../data/permits/ogden-valley-cityinspect.json'):root.LR_DATA?.cityInspect;
const slug=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
// Plain guidance for each kind of upload the city's form asks for.
const GUIDE=[
 [/site plan/i,{who:'Designer or surveyor',status:'pro',detail:'A scaled drawing of the lot showing the work, distances to every property line, and existing and proposed grades.'}],
 [/floor plan/i,{who:'Designer',status:'pro',detail:'Plan of the finished space with room uses, egress windows and dimensions.'}],
 [/mechanical and plumbing/i,{who:'Designer or contractor',status:'pro',detail:'Layout of heating, ventilation and plumbing changes.'}],
 [/permit plans/i,{who:'Designer',status:'pro',detail:'Construction drawings for the work.'}],
 [/structural calc|engineered structural/i,{who:'Structural engineer',status:'pro',detail:'Stamped structural calculations.'}],
 [/permit engineering|engineer letter/i,{who:'Engineer',status:'pro',detail:'Engineering for the structure, signed by a Utah-licensed engineer.'}],
 [/truss/i,{who:'Truss supplier',status:'pro',detail:'Truss layout and design sheets from the supplier.'}],
 [/footing|foundation plan/i,{who:'Engineer or designer',status:'pro',detail:'Footing and foundation plan.'}],
 [/soils report/i,{who:'Geotechnical engineer',status:'pro',detail:'Soils report for the foundation.'}],
 [/res ?check/i,{who:'Designer',status:'pro',detail:'Signed energy-code compliance report.'}],
 [/solar spec/i,{who:'Solar installer',status:'pro',detail:'Panel, racking and inverter specifications.'}],
 [/fence/i,{who:'You',status:'you',detail:'Acknowledge the city\'s pool fence requirements on the form.'}],
 [/fee|initial/i,{who:'You',status:'you',detail:'Initial the fee acknowledgment on the form.'}],
 [/owner.?builder/i,{who:'You',status:'optional',detail:'Only if you are building it yourself as owner-builder.'}],
 [/additional/i,{who:'You',status:'optional',detail:'Anything else that supports the application.'}]];
// Form labels end with a colon and sometimes paste a whole code section; keep the heading.
function cleanLabel(l){let s=String(l||'').replace(/\s+/g,' ').trim().replace(/:\s*$/,'');if(s.length>70)s=s.split(/\.\s/)[0];return s;}
function guide(label){return (GUIDE.find(([re])=>re.test(label))||[null,{who:'Designer',status:'pro',detail:''}])[1];}
const FOOTPRINT=new Set(['2','96','6','3','102']),EXTERIOR=new Set(['2','96','74','6','8','3','104','102']),DISTURB=new Set(['2','96','6','3','104']);
function build(typeId,{facts={},findings=[],kb=null}={}){
 const t=String(typeId),cat=catalog(),type=cat?.types?.find(x=>x.value===t);if(!type)return null;
 const ran=facts.stepsRun?new Set(Object.keys(facts.stepsRun)):null,has=step=>!ran||ran.has(step),items=[],I=o=>items.push({permitType:t,...o,id:t+':'+o.key});
 const link=(o)=>o?.url||'';
 // 1. What the city's application form asks for.
 const atts=(type.sections?.attachments||[]).map(k=>cat.fields[k]).filter(f=>f&&f.type==='file');
 for(const f of atts){const g=guide(f.label),label=cleanLabel(f.label);
  I({key:'doc-'+slug(label),group:'What the city asks for',title:label,status:f.markedRequired?g.status:'optional',who:g.who,why:'Ogden Valley City permit form · '+type.label+' (observed '+(cat.observedAt||'')+')',link:cat.source||'',detail:g.detail+(f.markedRequired?'':' Optional on the form.')});}
 if(!atts.length)I({key:'doc-unconfirmed',group:'What the city asks for',title:'Application documents',status:'you',who:'You',why:'Ogden Valley City permit form · '+type.label,detail:'The city\'s online form shows no document list for this permit type. Ask the building department what to submit.'});
 // 2. The city's rules for this kind of work.
 for(const r of (A?A.forPermit(t,facts):[]))I({key:'rule-'+r.id,group:'City rules for this work',title:r.title,status:r.kind==='check'?'you':'rule',who:r.kind==='check'?'You':'Cornerpin',why:r.source?.label||'',link:r.source?.url||'',detail:r.text});
 // 3. What this lot adds — only from research that ran.
 const find=(re,section)=>findings.find(x=>(!section||x.section===section)&&re.test(x.item||''));
 if(EXTERIOR.has(t)){const hoa=facts.hoaReg||find(/HOA registration|CC&Rs/i,'ccr');
  if(hoa)I({key:'lot-hoa',group:'What this lot adds',title:'HOA approval before work starts',status:'you',who:'HOA',why:hoa.source||'HOA record',link:link(hoa),detail:'This lot is in a homeowners association. See Approvals for who approves exterior work and when.'});}
 if(FOOTPRINT.has(t)){const ls=find(/landslide/i,'geo'),steep=facts.slope!=null&&facts.slope>15;
  if(ls&&ls.status==='flag'||steep)I({key:'lot-geotech',group:'What this lot adds',title:'Geologic hazards or geotechnical review',status:'pro',who:'Geotechnical engineer',why:ls?.source||'Slope from elevation data',link:link(ls),detail:(ls&&ls.status==='flag'?ls.headline+'. ':'')+(steep?'Lot slope about '+facts.slope.toFixed(1)+'%. ':'')+'New footprint on this ground likely needs a hazards study or geotechnical report; confirm with the city.'});
  if(has('check_documents')){const pd=facts.parcelDoc;I({key:'lot-easements',group:'What this lot adds',title:'Check recorded easements before placing the work',status:'you',who:'You or surveyor',why:'Recorded plat',link:facts.platEvidence?.recordSource?.url||'',detail:pd&&pd.easements&&pd.easements.length?'The recorded plat shows easements ('+pd.easements.slice(0,3).map(e=>e.type||e.label||'easement').join(', ')+'). Keep the work out of them.':'Confirm on the recorded plat that the work stays out of any easement.'});}
  else I({key:'lot-easements',group:'What this lot adds',title:'Recorded easements',status:'you',who:'You',why:'Not researched yet',detail:'Cornerpin has not read the recorded plat for this plan yet. Research everything, or check the plat for easements.'});}
 if(DISTURB.has(t)&&kb?.stormwater)I({key:'lot-stormwater',group:'What this lot adds',title:'City stormwater permit if you disturb enough ground',status:'you',who:'You or builder',why:'Ogden Valley City stormwater rules',link:kb.swpppTemplate||'',detail:'A stormwater permit is needed when grading disturbs more than 500 sq ft or 20 cubic yards.'});
 if(t==='2'){const pool=findings.filter(x=>x.section==='pool'&&['flag','watch'].includes(x.status));for(const x of pool.slice(0,3))I({key:'lot-pool-'+slug(x.item),group:'What this lot adds',title:x.item,status:'you',who:'You or designer',why:x.source||'',link:link(x),detail:x.headline});}
 if(t==='102'&&kb?.impact)I({key:'lot-impact',group:'What this lot adds',title:'Impact fees for a new unit',status:'you',who:'You',why:'City impact fee ordinance',detail:'A new dwelling unit may carry impact fees; ask the building department.'});
 // Application data the form needs, from the research.
 const rows=[['Parcel',facts.parcelId||'',null],['Zone',facts.zone_std?.zone||facts.zone||'','Zoning'],['Legal description',facts.parcelDoc?.legal||facts.platEvidence?.recordSource?.legal||'','Recorded plat'],['Valuation','Enter the cost of the work','Required on the form']];
 if(['96','74','8','3','102'].includes(t)&&facts.snow?.pg)rows.push(['Ground snow load',facts.snow.pg+' psf',facts.snow.basis||'Utah Snow Load Study']);
 if(['96','3','102'].includes(t)&&facts.irc_sdc)rows.push(['Seismic design category',facts.irc_sdc,'USGS']);
 const ready=items.filter(x=>['ready','drafted'].includes(x.status)).length,needed=items.filter(x=>!['na','optional','rule'].includes(x.status)).length;
 return {permitType:t,label:type.label,jurisdiction:facts.jurisdiction||cat.jurisdiction||'',letters:[],items,rows:rows.filter(r=>r[1]),ready,needed,portal:kb?.portal||null,source:{label:'Ogden Valley City permit form',url:cat.source||null,observedAt:cat.observedAt||null}};
}
const api={build,slug};if(node)module.exports=api;else root.PermitPacket=api;
})(typeof window!=='undefined'?window:globalThis);
