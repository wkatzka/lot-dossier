/* Public BLM grant discovery is a root lead, never a private mineral title opinion. */
const BASE='https://nlsdbpubgis.blm.gov/arcgis/rest/services/';
const SOURCES=[BASE+'Land_Tenure/Grants_Case_Disp/MapServer/0',BASE+'Land_Tenure/Grants_Case_Disp/MapServer/1',BASE+'Land_Tenure/Grants_Case_Disp/MapServer/2',BASE+'Land_Transfer/Conveyed_Private_Land_CL/MapServer/0'];
const cached=require('../data/title/blm-case-cache.json');
const REPORT='https://reports.blm.gov/report/mlrs/124/CR-Serial-Register-Page-All-Other-Products/';
function box(code){
 if(['ALL','ENTIRE SECTION'].includes(code))return [0,0,1,1];
 const parts=String(code).match(/NE|NW|SE|SW|N2|S2|E2|W2/g);if(!parts||parts.join('')!==code)return null;
 let [x,y,X,Y]=[0,0,1,1];for(const p of parts.reverse()){const mx=(x+X)/2,my=(y+Y)/2;if(p.includes('N'))y=my;if(p.includes('S'))Y=my;if(p.includes('E'))x=mx;if(p.includes('W'))X=mx;}return [x,y,X,Y];
}
function matches(meta,locations){
 return String(meta||'').split('|').flatMap(text=>{
  const m=text.trim().match(/^UT 26 (\d{3})0([NS]) (\d{3})0([EW]) (\d{3}) ([A-Z0-9]) (.+)$/);if(!m)return [];
  return locations.filter(l=>Number(m[1])===l.township&&m[2].toLowerCase()===l.northSouth.toLowerCase()&&Number(m[3])===l.range&&m[4].toLowerCase()===l.eastWest.toLowerCase()&&Number(m[5])===l.section).map(l=>{
   const a=['A','9'].includes(m[6])?box(m[7]):null,b=box(l.aliquot);
   const overlap=a&&b?Math.min(a[2],b[2])>Math.max(a[0],b[0])&&Math.min(a[3],b[3])>Math.max(a[1],b[1]):null;
   return {description:text,location:l,aliquotOverlap:overlap,match:overlap===true?'aliquot_description_overlap':overlap===false?'same_section_different_aliquot':'section_only_unresolved'};
  });
 });
}
async function discover(rings,spatial){
 const sources=[]; // Deliberately bounded and sequential; no image processing.
 for(const source of SOURCES)try{sources.push(await spatial(source,rings));}catch(e){sources.push({source,status:'unavailable',error:e.message});}
 return {sources,status:sources.every(s=>s.status==='retrieved')?'retrieved':'partial'};
}
function assess(discovery,locations,reports=[]){
 const cases=[],seen=new Set(),sources=(discovery?.sources||[]).map(s=>{
  if(s.status==='retrieved')return s;const retained=cached.sources.find(c=>c.source===s.source);
  if(!retained)return s;return {...s,retrievedAt:retained.retrievedAt,fromCache:true,features:retained.features.filter(f=>matches(f.attributes?.CSE_META,locations).some(m=>m.aliquotOverlap===true))};
 });
 for(const source of sources)for(const f of source.features||[]){const a=f.attributes||{},serial=a.CSE_NR||a.LEG_CSE_NR;
  if(!serial)continue;const id=a.SF_ID||serial;if(seen.has(id))continue;seen.add(id);
  const landMatches=matches(a.CSE_META,locations),r=reports.find(r=>r.serial===serial&&r.sfId===a.SF_ID);
  cases.push({serial,sfId:a.SF_ID,product:a.BLM_PROD,disposition:a.CSE_DISP,patentNumber:a.PAT_NR||null,source:source.source,retrievedAt:source.retrievedAt,fromCache:source.fromCache===true,refreshError:source.fromCache?source.error:null,sourceQuality:a.QLTY,landMatches,
   match:landMatches.some(m=>m.aliquotOverlap===true)?'aliquot_description_overlap':landMatches.length?'section_only_or_different_aliquot':'mapped_candidate_only',report:r||null,reportSource:REPORT,
   originalInstrument:false,ownershipDetermined:false,limitation:'BLM case geometry can be generalized to a section. Descriptive aliquot overlap is a search lead, not a legal boundary or proof of current mineral ownership.'});
 }
 return {status:discovery?.status||'not_searched',sources:(discovery?.sources||[]).map(s=>({source:s.source,status:s.status,error:s.error,count:s.features?.length})),cases,ownershipDetermined:false};
}
module.exports={SOURCES,REPORT,box,matches,discover,assess};
