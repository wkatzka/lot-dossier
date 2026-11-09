/* Shared evidence-backed extraction. No model is needed for explicit schedules. */
(function(root){
'use strict';
const version='permit-facts-1';
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
 return Object.values(groups).flatMap(g=>{const conflict=new Set(g.map(f=>norm(f.value))).size>1;return g.map(f=>({...f,conflict,review:'needs_review'}));});
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
function validateModel(items,pages,document,requested){
 const accepted=[],rejected=[];
 for(const item of Array.isArray(items)?items:[]){
  const p=pages.find(p=>(p.n||p.page)===item.page),f=fields[item.field];
  let reason='';
  if(!requested.includes(item.field)||!f)reason='Field was not requested';
  else if(!valid(item.field,item.value,item.unit))reason='Invalid value or unit';
  else if(!p||!item.quote||norm(item.quote).length<8||!norm(p.text).includes(norm(item.quote)))reason='Quotation does not occur on the cited page';
  else if(/_set_back_default$/.test(item.field)&&(!/\b(actual|proposed)\b/i.test(item.quote)||/\b(minimum|required)\b/i.test(item.quote)))reason='Setback quotation does not establish an actual proposed distance';
  else if(f.unit!=='text'&&!norm(item.quote).replace(/,/g,'').match(new RegExp('(^|[^0-9.])'+String(Number(item.value)).replace('.','\\.')+'([^0-9.]|$)')))reason='Value is not supported by the quoted text';
  else if(f.unit==='text'&&!norm(item.quote).includes(norm(item.value)))reason='Text value is absent from the quoted text';
  if(reason){rejected.push({field:item.field,reason});continue;}
  accepted.push({field:item.field,value:f.unit==='text'?item.value:Number(item.value),unit:item.unit,page:item.page,quote:item.quote,method:'claude_extraction',documentId:document.id,documentHash:document.hash,filename:document.name,review:'needs_review'});
 }
 return {facts:reconcile(accepted),rejected};
}
function available(p,typeId='1'){
 const plan=p.report?.plan||{},results=(p.application?.documentExtractions||[]).filter(r=>(r.permitType||'1')===typeId),hasReadPlan=results.some(r=>r.filename===plan.filename),all=typeId==='1'&&!hasReadPlan?[...(plan.permitFacts||[])]:[];
 for(const result of results){const d=p.documents?.find(d=>d.id===result.documentId&&d.hash===result.documentHash);if(d&&!p.documents.some(x=>x.family===d.family&&x.version>d.version))all.push(...result.facts);}
 return reconcile(all);
}
function selected(p,name,typeId='1'){const list=available(p,typeId).filter(x=>x.field===name);return list.length&&!list.some(x=>x.conflict)?list[0]:null;}
const api={version,fields,extract,validateModel,reconcile,available,selected};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PermitFacts=api;
})(typeof window!=='undefined'?window:globalThis);
