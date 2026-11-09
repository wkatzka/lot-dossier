/* Shared evidence-backed extraction. No model is needed for explicit schedules. */
(function(root){
'use strict';
const version='permit-facts-2';
const fields={
 engineer_record:{label:'Engineer of record name',unit:'text',re:'(?:ENGINEER OF RECORD|STRUCTURAL ENGINEER)'},
 engineer_record_email:{label:'Engineer of record email',unit:'text',re:'(?:ENGINEER OF RECORD|STRUCTURAL ENGINEER) EMAIL'},
 engineer_record_phone:{label:'Engineer of record phone',unit:'text',re:'(?:ENGINEER OF RECORD|STRUCTURAL ENGINEER) PHONE'},
 design_professional:{label:'Design professional name',unit:'text',re:'(?:PROJECT ARCHITECT|DESIGN PROFESSIONAL)'},
 design_professional_email:{label:'Design professional email',unit:'text',re:'(?:PROJECT ARCHITECT|DESIGN PROFESSIONAL) EMAIL'},
 design_professional_phone:{label:'Design professional phone',unit:'text',re:'(?:PROJECT ARCHITECT|DESIGN PROFESSIONAL) PHONE'},
 main_floor:{label:'Main / first floor area',unit:'sq_ft',re:'(?:MAIN|FIRST|1ST) FLOOR(?: AREA)?'},
 second_floor:{label:'Second floor area',unit:'sq_ft',re:'(?:SECOND|2ND) FLOOR(?: AREA)?'},
 third_floor:{label:'Third floor area',unit:'sq_ft',re:'(?:THIRD|3RD) FLOOR(?: AREA)?'},
 fourth_floor:{label:'Fourth floor area',unit:'sq_ft',re:'(?:FOURTH|4TH) FLOOR(?: AREA)?'},
 basement:{label:'Finished basement area',unit:'sq_ft',re:'FINISHED BASEMENT(?: AREA)?'},
 unfin_basement:{label:'Unfinished basement area',unit:'sq_ft',re:'UNFINISHED BASEMENT(?: AREA)?'},
 garage_footage:{label:'Garage area',unit:'sq_ft',re:'GARAGE(?: AREA)?'},
 bedrooms:{label:'Bedroom count',unit:'count',re:'(?:NUMBER OF )?BEDROOMS'},
 bathrooms:{label:'Bathroom count',unit:'count',re:'(?:NUMBER OF )?BATHROOMS'},
 stories:{label:'Story count',unit:'count',re:'(?:NUMBER OF )?STOR(?:IES|EYS)'},
 construction_material:{label:'Construction material / structural system',unit:'text'},
 front_set_back_default:{label:'Actual proposed front setback (not minimum required)',unit:'ft'},
 rear_set_back_default:{label:'Actual proposed rear setback (not minimum required)',unit:'ft'},
 left_set_back_default:{label:'Actual proposed left setback (not minimum required)',unit:'ft'},
 right_set_back_default:{label:'Actual proposed right setback (not minimum required)',unit:'ft'}
};
// Additional printed project facts; professional appointments still need user confirmation.
Object.assign(fields,{
 document_stage:{label:'Explicit document stage such as CONCEPT DRAWINGS NOT FOR CONSTRUCTION, PRELIMINARY, ISSUED FOR PERMIT; do not infer final approval from a stamp',unit:'text'},
 document_date:{label:'Explicit drawing issue date from title block, not print/export date; preserve printed date',unit:'text'},
 patio:{label:'Combined deck/patio area explicitly scheduled for proposed work',unit:'sq_ft',re:'(?:DECK/PATIO|PATIO|DECK)(?: AREA)?'},
 other_footage:{label:'Other area explicitly scheduled separately (not total residence)',unit:'sq_ft'},
 num_units:{label:'Explicit proposed dwelling unit count',unit:'count',re:'(?:DWELLING )?UNITS'},
 num_buildings:{label:'Explicit proposed building count',unit:'count',re:'(?:NUMBER OF )?BUILDINGS'},
 garages:{label:'Number of garages, NOT parking spaces',unit:'count'},
 max_occupancy:{label:'Explicit design occupant load, not bedroom count',unit:'count'}
});
for(const [prefix,title]of [['design_professional','Design professional'],['builder','Appointed builder'],['electrical','Appointed electrical contractor'],['mechanical','Appointed mechanical contractor'],['plumbing','Appointed plumbing contractor']])for(const key of ['name','contact','phone','email','address','city','state','zip','license']){
 const field=prefix==='design_professional'&&key==='name'?prefix:prefix+'_'+key;
 if(!fields[field])fields[field]={label:title+' '+key+' explicitly printed in project title block or team schedule; do not infer appointment from a product manufacturer',unit:'text'};
}
const catalog=typeof module!=='undefined'&&module.exports?require('../data/permits/ogden-valley-cityinspect.json'):root.LR_DATA?.cityInspect;
for(const t of catalog?.types||[])fields['scope_'+t.value]={label:'Proposed project scope: '+t.label+'. Return the exact short supporting phrase ONLY if this work is actually proposed in a drawing/title/scope, not generic code notes, an existing feature, room name, or a catalog option. Never infer detached garage from an attached garage, or separate trade permits merely from house systems.',unit:'text'};
const norm=x=>String(x??'').replace(/\s+/g,' ').trim().toLowerCase();
function valid(f,value,unit){
 const rule=fields[f];if(!rule||unit!==rule.unit)return false;
 if(unit==='text')return typeof value==='string'&&value.length>0&&value.length<=160&&(!/email$/.test(f)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
 if(!Number.isFinite(Number(value))||Number(value)<0||String(value).trim()==='')return false;
 if(unit==='sq_ft')return Number(value)<=1000000;
 if(unit==='ft')return Number(value)<=10000;
 return Number(value)<=1000&&(f==='bathrooms'||Number.isInteger(Number(value)));
}
function reconcile(facts){
 const groups={};for(const f of facts){if(!fields[f.field]||!valid(f.field,f.value,f.unit))continue;(groups[f.field]??=[]).push(f);}
 return Object.values(groups).flatMap(g=>{const conflict=new Set(g.map(f=>norm(f.value))).size>1||g.some(f=>f.sourceConflict);return g.map(f=>({...f,conflict,review:'needs_review'}));});
}
function extract(pages,document={}){
 const found=[];
 for(const p of pages){for(const line of String(p.text||'').split('\n')){
  if(/\b(EXISTING|DEMOLISH|REMOVE)\b/i.test(line))continue;
  for(const [field,rule] of Object.entries(fields)){
   if(!rule.re)continue;
   if(rule.unit==='text'){const m=line.match(new RegExp('^\\s*'+rule.re+'\\s*[:=]\\s*(.+)$','i'));if(m&&valid(field,m[1].trim(),rule.unit))found.push({field,value:m[1].trim(),unit:rule.unit,method:'explicit_plan_text',page:p.n||p.page,sheet:p.sheet||null,quote:line.trim(),documentId:document.id||null,documentHash:document.hash||null,filename:document.name||null});continue;}
   const suffix=rule.unit==='sq_ft'?'\\s*(?:SF|S\\.?F\\.?|SQ\\.?\\s*FT\\.?)\\b':'\\b';
   const re=new RegExp('(?:^|[^A-Z])'+rule.re+'\\s*[:=]\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)'+suffix,'i'),m=line.match(re);
   if(m){const value=Number(m[1].replace(/,/g,''));if(valid(field,value,rule.unit))found.push({field,value,unit:rule.unit,method:'explicit_plan_text',page:p.n||p.page,sheet:p.sheet||null,quote:line.trim(),documentId:document.id||null,documentHash:document.hash||null,filename:document.name||null});}
  }
 }}return reconcile(found);
}
function validateModel(items,pages,document,requested,{visual=false}={}){
 const accepted=[],rejected=[];
 for(const raw of Array.isArray(items)?items:[]){
  const item={...raw};if(typeof item.value==='string'&&/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(item.value.trim()))item.value=item.value.replace(/,/g,'');
  const p=pages.find(p=>(p.n||p.page)===item.page),f=fields[item.field];
  const counted=visual&&item.derivation==='counted',parts=Array.isArray(item.components)?item.components:[];
  const countOK=counted&&['bedrooms','bathrooms','stories'].includes(item.field)&&parts.length>0&&parts.length<=100&&parts.every(c=>pages.some(p=>(p.n||p.page)===c.page)&&typeof c.label==='string'&&c.label.length>=3&&typeof c.region==='string'&&c.region.length>=5&&typeof c.identity==='string'&&c.identity.trim()&&[1,...(item.field==='bathrooms'?[0.5]:[])].includes(c.weight))&&new Set(parts.map(c=>norm(c.identity))).size===parts.length&&Math.abs(parts.reduce((n,c)=>n+c.weight,0)-Number(item.value))<0.001;
  let reason='';
  if(!requested.includes(item.field)||!f)reason='Field was not requested';
  else if(!valid(item.field,item.value,item.unit))reason='Invalid value or unit';
  else if(counted&&!countOK)reason='Drawing count lacks unique located components or correct arithmetic';
  else if(!p||!item.quote||norm(item.quote).length<8||(!norm(p.text).includes(norm(item.quote))&&(!visual||typeof item.region!=='string'||item.region.trim().length<5)))reason='Quotation does not occur on the cited page';
  else if(/_set_back_default$/.test(item.field)&&(!/\b(actual|proposed)\b/i.test(item.quote)||/\b(minimum|required)\b/i.test(item.quote)))reason='Setback quotation does not establish an actual proposed distance';
  else if(!counted&&f.unit!=='text'&&!norm(item.quote).replace(/,/g,'').match(new RegExp('(^|[^0-9.])'+String(Number(item.value)).replace('.','\\.')+'([^0-9.]|$)')))reason='Value is not supported by the quoted text';
  else if(f.unit==='text'&&!norm(item.quote).includes(norm(item.value)))reason='Text value is absent from the quoted text';
  if(reason){rejected.push({field:item.field,reason});continue;}
  accepted.push({field:item.field,value:f.unit==='text'?item.value:Number(item.value),unit:item.unit,page:item.page,quote:item.quote,derivation:counted?'counted':'printed',components:counted?parts:[],method:visual?'claude_visual_extraction':'claude_extraction',region:item.region||null,evidenceCheck:!counted&&norm(p.text).includes(norm(item.quote))?'text_matched':'visual_review_required',documentId:document.id,documentHash:document.hash,filename:document.name,review:'needs_review'});
 }
 return {facts:reconcile(accepted),rejected};
}
function available(p,typeId='1'){
 const plan=p.report?.plan||{},results=(p.application?.documentExtractions||[]).filter(r=>((r.permitType||'1')===typeId||(r.permitType==='project'&&typeId==='1'))),hasReadPlan=results.some(r=>r.filename===plan.filename),all=typeId==='1'&&!hasReadPlan&&(!plan.filename||!p.documents?.some(d=>d.role==='plan')||p.documents.some(d=>d.role==='plan'&&d.name===plan.filename&&!p.documents.some(x=>x.family===d.family&&x.version>d.version)))?[...(plan.permitFacts||[])]:[];
 for(const result of results){const d=p.documents?.find(d=>d.id===result.documentId&&d.hash===result.documentHash);if(d&&!p.documents.some(x=>x.family===d.family&&x.version>d.version))all.push(...result.facts);}
 return reconcile(all);
}
function selected(p,name,typeId='1'){const list=available(p,typeId).filter(x=>x.field===name);return list.length&&!list.some(x=>x.conflict)?list[0]:null;}
const api={version,fields,extract,validateModel,reconcile,available,selected};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PermitFacts=api;
})(typeof window!=='undefined'?window:globalThis);
