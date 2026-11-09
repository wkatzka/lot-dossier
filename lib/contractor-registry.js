const {text,decode}=require('./http');
const source='https://services.commerce.utah.gov/cbr/';
function parse(html,license){
 const wanted=license.replace(/[^0-9]/g,'');
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].filter(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].some(c=>decode(c[1]).trim().replace(/[^0-9]/g,'')===wanted)).map(m=>decode(m[1].replace(/<\/(?:td|th)>/gi,' | ')));
 return {matches:rows.slice(0,5),source,at:new Date().toISOString(),summary:rows.length?'Public opt-in construction registry returned '+rows.length+' candidate record(s): '+rows.slice(0,5).join('; ')+'. Confirm the legal name, current license status and classification in DOPL; this is not proof of project appointment.':'No matching record in the public opt-in construction registry. Absence does not mean unlicensed. Use DOPL license verification for comprehensive status/classifications.'};
}
async function lookup(license){if(!/^\d{4,12}(?:-\d{4})?$/.test(license))throw Error('Enter a Utah license number (digits, optionally followed by a four-digit suffix).');const html=await text(source+'assets/js/cbr-ajax.php',{method:'POST',timeout:20000,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({f:'as',p:'ALL',q:'',co:'',ln:license,ct:'',st:'',zp:''}).toString()});if(/database error|captcha|access denied/i.test(html))throw Error('Public registry unavailable; use the official verification link.');return parse(html,license);}
module.exports={lookup,parse};
