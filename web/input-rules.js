/* One place for what a sensible answer looks like, inferred from the field's label.
   Used three ways: city-form saves are rejected when an answer breaks its rule; every form in the
   workspace is checked before it submits; and fields show a plain message as soon as they're wrong. */
(function(root){'use strict';
const NUM=/^\s*(-?\d[\d,]*(?:\.\d+)?|-?\.\d+)\s*(ft|feet|'|sq\.? ?ft|sf|%|kw|kwh|a|amps?|v|volts?|w|watts?|\$)?\s*$/i;
const MONEY=/^\s*\$?\s*(-?\d[\d,]*(?:\.\d{1,2})?)\s*$/;
// Order matters: the first matching rule wins.
const RULES=[
 [/e-?mail/i,{kind:'email',inputType:'email',inputmode:'email',msg:'Enter an email like name@company.com.'}],
 [/phone|\bfax\b/i,{kind:'phone',inputType:'tel',inputmode:'tel',msg:'Enter a 10-digit phone number.'}],
 [/\bzip\b|postal/i,{kind:'zip',inputmode:'numeric',msg:'Enter a 5-digit ZIP code.'}],
 [/\bstate\b/i,{kind:'state',msg:'Enter the state, e.g. UT.'}],
 [/\bdate\b/i,{kind:'date',msg:'Enter a real date, e.g. 2026-11-13.'}],
 [/latitude/i,{kind:'num',min:-90,max:90,msg:'Latitude is between -90 and 90.'}],
 [/longitude/i,{kind:'num',min:-180,max:180,msg:'Longitude is between -180 and 180.'}],
 [/valuation|cost|price|\bfee\b|amount|\(\$\)|budget|proceeds/i,{kind:'num',min:0,max:1e9,unit:'$',msg:'Enter a dollar amount of 0 or more.'}],
 [/%|percent|share/i,{kind:'num',min:0,max:100,msg:'Enter a percentage from 0 to 100.'}],
 [/rotation|degrees/i,{kind:'num',min:-360,max:360,msg:'Enter an angle from -360 to 360.'}],
 [/east of|north of|offset/i,{kind:'num',min:-5000,max:5000,msg:'Enter a distance in feet (negative means west/south).'}],
 [/\byear\b/i,{kind:'num',min:1800,max:2100,integer:true,msg:'Enter a 4-digit year.'}],
 [/stories/i,{kind:'num',min:0,max:10,integer:true,msg:'Enter a whole number of stories (0–10).'}],
 [/bathrooms/i,{kind:'num',min:0,max:50,step:0.5,msg:'Enter the number of bathrooms (halves allowed).'}],
 [/# of units|number of buildings|bedrooms|garages$|garages:|number of modules|max occupancy|page count|pages\b/i,{kind:'num',min:0,max:1000,integer:true,msg:'Enter a whole number of 0 or more.'}],
 [/lot footage|lot area|lot size/i,{kind:'num',min:0,max:5e7,unit:'sq ft',msg:'Enter the lot size in square feet (0 or more).'}],
 [/floor|basement|garage|deck\/patio|^other:?\s*$|footage|sq ?ft|square feet|floor area|building area/i,{kind:'num',min:0,max:1e6,unit:'sq ft',msg:'Enter square feet (0 or more).'}],
 [/set ?back|\(ft\)|feet|width|length|clearance|height|distance/i,{kind:'num',min:0,max:5000,unit:'ft',msg:'Enter feet (0 or more).'}],
 [/tolerance/i,{kind:'num',min:0,max:1000,msg:'Enter a tolerance of 0 or more.'}],
 [/amps/i,{kind:'num',min:0,max:10000,unit:'A',msg:'Enter amps (0 or more).'}],
 [/volts/i,{kind:'num',min:0,max:1000,unit:'V',msg:'Enter volts (0–1000).'}],
 [/kw|output|capacity/i,{kind:'num',min:0,max:100000,msg:'Enter a capacity of 0 or more.'}],
 [/power rating/i,{kind:'num',min:0,max:5000,unit:'W',msg:'Enter watts (0 or more).'}],
 [/quantity|rate\b/i,{kind:'num',min:0,max:1e9,msg:'Enter a number of 0 or more.'}]
];
const DEFAULT_NUM={kind:'num',min:0,max:1e9,msg:'Enter a number of 0 or more.'};
function rule(label,name,type){const t=String(label||'')+' '+String(name||'');for(const [re,r] of RULES)if(re.test(t))return {...r};return type==='number'?{...DEFAULT_NUM}:null;}
function toNumber(v,r){const s=String(v??'').trim();const m=(r&&r.unit==='$'?MONEY.exec(s):null)||NUM.exec(s);return m?Number(m[1].replace(/,/g,'')):NaN;}
/* '' when the value is fine (blank is the caller's business: required-ness is checked elsewhere). */
function check(value,r){
 const s=String(value??'').trim();if(!s||!r)return '';
 switch(r.kind){
  case 'email':return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)?'':r.msg;
  case 'phone':{const d=s.replace(/[^\d]/g,'').replace(/^1(?=\d{10}$)/,'');return d.length===10&&/^[\d\s().+\-x]+$/i.test(s.replace(/ext\.?\s*\d+$/i,''))?'':r.msg;}
  case 'zip':return /^\d{5}(-\d{4})?$/.test(s)?'':r.msg;
  case 'state':return /^[A-Za-z][A-Za-z .]{1,19}$/.test(s)?'':r.msg;
  case 'date':{let y,m,d,x;if((x=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)))[y,m,d]=[+x[1],+x[2],+x[3]];else if((x=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)))[m,d,y]=[+x[1],+x[2],+x[3]];else return r.msg;
   const dt=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=2100&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?'':r.msg;}
  case 'num':{const n=toNumber(s,r);if(!Number.isFinite(n))return 'Enter a number.';
   if(r.min!=null&&n<r.min)return r.min===0?'Can’t be negative.':r.msg;if(r.max!=null&&n>r.max)return 'That’s too large. '+r.msg;
   if(r.integer&&!Number.isInteger(n))return 'Enter a whole number.';if(r.step===0.5&&!Number.isInteger(n*2))return r.msg;return '';}
 }
 return '';
}
/* Extra HTML attributes for an <input> so browsers and phones help (keyboard type, min/max). */
function attrs(r){if(!r)return '';let a='';if(r.inputmode)a+=' inputmode="'+r.inputmode+'"';else if(r.kind==='num')a+=' inputmode="decimal"';if(r.kind==='num'){if(r.min!=null)a+=' data-min="'+r.min+'"';if(r.max!=null)a+=' data-max="'+r.max+'"';}if(r.kind==='phone')a+=' autocomplete="tel"';if(r.kind==='email')a+=' autocomplete="email"';return a;}

/* Browser: check every workspace input as people type and before any form submits. */
function labelFor(el){if(el.labels&&el.labels[0])return el.labels[0].textContent;const l=el.closest('label');if(l)return l.textContent;return el.getAttribute('aria-label')||el.placeholder||'';}
function ruleFor(el){if(el.type==='hidden'||el.type==='checkbox'||el.type==='radio'||el.type==='file'||el.readOnly||el.disabled)return null;if(el.tagName!=='INPUT')return null;return rule(labelFor(el),el.name,el.type);}
function show(el,msg){const host=el.closest('.cp-num')||el;let p=host.nextElementSibling;if(!(p&&p.classList.contains('cp-field-err'))){if(!msg)return;p=root.document.createElement('p');p.className='cp-field-err';p.setAttribute('role','alert');host.after(p);}
 p.textContent=msg;p.hidden=!msg;if(msg)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');try{el.setCustomValidity(msg);}catch(_){} }
function validate(el){const r=ruleFor(el);if(!r)return '';const m=check(el.value,r);show(el,m);return m;}
if(root.document&&root.addEventListener){
 const inScope=el=>el&&el.closest&&el.closest('#project-workspace,#rv,#home,main');
 root.document.addEventListener('input',e=>{const el=e.target;if(el.tagName==='INPUT'&&inScope(el)&&(el.getAttribute('aria-invalid')==='true'||el.type==='number'))validate(el);},true);
 root.document.addEventListener('change',e=>{const el=e.target;if(el.tagName==='INPUT'&&inScope(el))validate(el);},true);
 root.document.addEventListener('focusout',e=>{const el=e.target;if(el.tagName==='INPUT'&&inScope(el))validate(el);},true);
 // Capture phase on window runs before the workspace's own submit handlers, so a bad answer never saves.
 root.addEventListener('submit',e=>{const f=e.target;if(!f||!inScope(f))return;let first=null;for(const el of f.querySelectorAll('input'))if(validate(el)&&!first)first=el;
  if(first){e.preventDefault();e.stopImmediatePropagation();first.focus();first.scrollIntoView({block:'center',behavior:'smooth'});}},true);
}
const api={rule,check,attrs,toNumber};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.InputRules=api;
})(typeof window!=='undefined'?window:globalThis);
