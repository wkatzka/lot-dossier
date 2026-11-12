/* Countywide source inventory. Geographic overlap discovers candidates, not legal applicability. */
const surveys=require('./surveys');
const {createHash}=require('node:crypto');
const publicRecords=require('./public-record-access');
function allowed(url){
 if(publicRecords.allowed(url))return true;
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
 function add(url,label,kind,basis,source){if(!allowed(url))return;const canonical=new URL(url);if(/^(www\.)?webercountyutah\.gov$/.test(canonical.hostname))canonical.hostname='www.webercountyutah.gov';
 const key=canonical.href;let d=documents.get(key);if(!d){d={id:createHash('sha256').update(key).digest('hex').slice(0,24),url:key,label,kind,matchBasis:[],discoverySources:[],state:'queued',applicability:'unverified'};documents.set(key,d);}if(!d.matchBasis.includes(basis))d.matchBasis.push(basis);if(source&&!d.discoverySources.includes(source))d.discoverySources.push(source);return d;}
 for(const p of history?.records||[])for(const d of p.plats||[])add(d.url,'Recorded plat '+d.sheet,'recorded_plat','Linked from parcel '+p.parcelId,p.url);
 for(const s of records)if(locations.some(l=>sectionMatch(s,l))){if(s.url)add(s.url,'Filed survey '+s.recordNumber+' · '+s.name,'filed_survey','Same mapped PLSS section; may describe neighboring land',surveys.SOURCE);}
 // Reviewed originals are source-discovered acquisitions, not a substitute for countywide indexes.
 for(const d of title?.originalEvidence||[])for(const s of d.sources||[])add(s.url,d.reference,d.kind,'Previously reviewed original in matching PLSS aliquot',s.url);
 for(const r of title?.originalRequests||[]){const entry=/^\d{5,9}$/.test(String(r.entry))?String(r.entry):null;
 if(!entry&&!(r.book&&r.page))continue;const key=entry?'entry:'+entry:'book:'+r.book+':'+r.page;
 if(!missing.has(key))missing.set(key,{key,entry,book:r.book||null,page:r.page||null,source:r.source,purpose:r.purpose,state:'original_access_unresolved',discovery:publicRecords.assessment(r.accessAttempts),reason:'Public discovery is incomplete. A missing source URL does not establish that the record is restricted.'});}
 for(const r of missing.values()){
  const found=publicRecords.find('Weber',r.entry);if(!found)continue;
  // Association-hosted originals retain their own host and known page-coverage caveats.
  const doc={id:createHash('sha256').update(found.url).digest('hex').slice(0,24),url:found.url,label:found.label,kind:'recorded_instrument',matchBasis:['Exact county and recording entry reference; parcel applicability unverified'],discoverySources:[r.source].filter(Boolean),state:'queued',applicability:'unverified',sourceCoverage:{availablePages:found.availablePages,recordedPages:found.recordedPages,completeCopy:found.completeCopy,checkedAt:found.checkedAt},catalogueSha256:found.sha256};
  documents.set(found.url,doc);r.publicUrl=found.url;r.state=found.completeCopy?'public_copy_located':'incomplete_public_copy';
  r.reason=found.completeCopy?'Public recorded copy located; reading and lot applicability still require verification.':'Public copy has '+found.availablePages+' of '+found.recordedPages+' recorded pages. Continue searching for the missing exhibit.';
 }
 return {schemaVersion:1,county:'Weber',documents:[...documents.values()],requests:[...missing.values()],inventoryComplete:false,
  scope:'Public parcel-linked plats, geographically matched surveys, retained originals and catalogued exact-entry covenant copies; record discovery and legal coverage remain incomplete.',
  cost:{paidRequestsSent:0,ocr:'Local OCR; hosting compute and storage may consume plan allowances. No paid AI calls.'},
  sourceCoverage:{surveyRecords:records.length,unusableSurveyLocations:records.filter(s=>!geographicTokens(s.township).some(v=>/^\d+[NS]$/.test(v))||!geographicTokens(s.range).some(v=>/^\d+[EW]$/.test(v))||!geographicTokens(s.section).some(v=>/^\d+$/.test(v)&&Number(v)>=1&&Number(v)<=36)).length,plssLocations:locations.length,historyStatus:history?.status||'unavailable'}};
}
async function discover(input){let rows=[],error;try{rows=(await surveys.inventory()).records;}catch(e){error=e.message;}const out=inventory(input,rows);if(error)out.sourceCoverage.surveyError=error;return out;}
module.exports={allowed,sectionMatch,inventory,discover};
