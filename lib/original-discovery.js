/* Countywide source inventory. Geographic overlap discovers candidates, not legal applicability. */
const surveys=require('./surveys');
const {createHash}=require('node:crypto');
function allowed(url){
 try{const u=new URL(url),p=decodeURIComponent(u.pathname);
 return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^(www\.)?webercountyutah\.gov$/.test(u.hostname)&&
 /^\/mounts\/(?:surveyorimages|ded_plats)\//i.test(p)&&!p.includes('..')&&/\.(pdf|tiff?)$/i.test(p);
 }catch{return false;}
}
function geographicTokens(value){return String(value).toUpperCase().split(/[/\\,;&\s]+/).filter(Boolean).map(v=>v.replace(/^0+(?=\d)/,''));}
function sectionMatch(s,l){
 return geographicTokens(s.township).includes(String(l.township)+l.northSouth.toUpperCase())&&
 geographicTokens(s.range).includes(String(l.range)+l.eastWest.toUpperCase())&&
 geographicTokens(s.section).some(n=>/^\d+$/.test(n)&&Number(n)===l.section);
}
function inventory({historical,history,title},records){
 const documents=new Map(),missing=new Map(),locations=historical?.plss?.locations||[];
 function add(url,label,kind,basis,source){if(!allowed(url))return;const canonical=new URL(url);canonical.hostname='www.webercountyutah.gov';
 const key=canonical.href;let d=documents.get(key);if(!d){d={id:createHash('sha256').update(key).digest('hex').slice(0,24),url:key,label,kind,matchBasis:[],discoverySources:[],state:'queued',applicability:'unverified'};documents.set(key,d);}if(!d.matchBasis.includes(basis))d.matchBasis.push(basis);if(source&&!d.discoverySources.includes(source))d.discoverySources.push(source);}
 for(const p of history?.records||[])for(const d of p.plats||[])add(d.url,'Recorded plat '+d.sheet,'recorded_plat','Linked from parcel '+p.parcelId,p.url);
 for(const s of records)if(locations.some(l=>sectionMatch(s,l))){if(s.url)add(s.url,'Filed survey '+s.recordNumber+' · '+s.name,'filed_survey','Same mapped PLSS section; may describe neighboring land',surveys.SOURCE);}
 // Reviewed originals are source-discovered acquisitions, not a substitute for countywide indexes.
 for(const d of title?.originalEvidence||[])for(const s of d.sources||[])add(s.url,d.reference,d.kind,'Previously reviewed original in matching PLSS aliquot',s.url);
 for(const r of title?.originalRequests||[]){const entry=/^\d{5,9}$/.test(String(r.entry))?String(r.entry):null;
 if(!entry&&!(r.book&&r.page))continue;const key=entry?'entry:'+entry:'book:'+r.book+':'+r.page;
 if(!missing.has(key))missing.set(key,{key,entry,book:r.book||null,page:r.page||null,source:r.source,purpose:r.purpose,state:'original_access_unresolved',orderUrl:'https://www.webercountyutah.gov/forms/document/',reason:'No verified public image URL for this exact instrument. Abstract/order access is not an original document.'});}
 return {schemaVersion:1,county:'Weber',documents:[...documents.values()],requests:[...missing.values()],inventoryComplete:false,
  scope:'Public parcel-linked plats, geographically matched filed surveys and retained source originals; original deed coverage is incomplete.',
  cost:{paidRequestsSent:0,ocr:'Local OCR; hosting compute and storage may consume plan allowances. No paid AI calls.'},
  sourceCoverage:{surveyRecords:records.length,unusableSurveyLocations:records.filter(s=>!geographicTokens(s.township).some(v=>/^\d+[NS]$/.test(v))||!geographicTokens(s.range).some(v=>/^\d+[EW]$/.test(v))||!geographicTokens(s.section).some(v=>/^\d+$/.test(v)&&Number(v)>=1&&Number(v)<=36)).length,plssLocations:locations.length,historyStatus:history?.status||'unavailable'}};
}
async function discover(input){let rows=[],error;try{rows=(await surveys.inventory()).records;}catch(e){error=e.message;}const out=inventory(input,rows);if(error)out.sourceCoverage.surveyError=error;return out;}
module.exports={allowed,sectionMatch,inventory,discover};
