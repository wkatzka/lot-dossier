// Public filed-survey discovery. Name matches are leads, never boundary/applicability determinations.
const {decode}=require('./http');
const SOURCE='https://www.webercountyutah.gov/forms/survey_index/';
let cached=null,pending=null;
function parse(html){
  if(!/Record Number/i.test(html)||!/Date Placed on File/i.test(html))throw Error('Survey index schema not recognized.');
  const records=[];
  for(const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[]){
    const raw=Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),m=>m[1]);
    if(raw.length!==12)continue;const c=raw.map(decode);if(!/^\d+$/.test(c[0]))continue;
    const href=(raw[0].match(/href=['"]([^'"]+)['"]/i)||[])[1];let url=null;
    if(href){const u=new URL(href,SOURCE);if(u.protocol==='https:'&&/^(www\.)?webercountyutah\.gov$/.test(u.hostname)&&/^\/mounts\/surveyorimages\//.test(u.pathname)&&/\.pdf$/i.test(u.pathname))url=u.href;}
    records.push({recordNumber:c[0],pages:c[1],filedDate:c[2],name:c[3],township:c[5],range:c[6],section:c[7],part:c[8],company:c[9],url});
  }
  if(!records.length)throw Error('No parseable survey inventory; source unavailable or changed.');return records;
}
function tokens(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);}
function search(records,name){
  const root=String(name).replace(/\b(?:phase|ph\.?|plat|unit|subdivision|subd\.?)\b.*$/i,'').trim();
  const words=tokens(root);if(root.length<4||!words.length)throw Error('A subdivision name of at least four characters is required.');
  const matches=records.filter(r=>{const found=new Set(tokens(r.name));return words.every(w=>found.has(w));});
  return {query:root,totalMatches:matches.length,truncated:matches.length>20,candidates:matches.slice(0,20),matchBasis:'All subdivision-name words in the survey title; boundary applicability has not been verified.'};
}
async function inventory(){
  if(cached&&Date.now()-cached.time<86400000)return cached;
  if(!pending)pending=(async()=>{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
    try{
      const r=await fetch(SOURCE,{signal:ctl.signal});if(!r.ok)throw Error('Survey index HTTP '+r.status);
      const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>12e6){ctl.abort();throw Error('Survey index exceeds retrieval limit.');}chunks.push(Buffer.from(chunk));}
      cached={records:parse(Buffer.concat(chunks).toString('utf8')),retrievedAt:new Date().toISOString(),time:Date.now()};return cached;
    }finally{clearTimeout(timer);}
  })().finally(()=>{pending=null;});
  return pending;
}
async function find(name){const data=await inventory();return {source:SOURCE,retrievedAt:data.retrievedAt,indexRecordCount:data.records.length,...search(data.records,name)};}
module.exports={SOURCE,parse,search,find,inventory};
