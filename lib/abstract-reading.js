/* Spatial OCR indexing. Every result remains a candidate until checked against its image. */
const crypto=require('crypto');
function rows(observations){
 const header=observations.find(o=>/^DESCRIPTION(?: AND REMARKS)?$/i.test(o.text.trim()));
 const descriptionX=header?Math.max(.45,header.bbox[0]-.08):.65;
 const anchors=observations.flatMap(o=>{const m=/^(?:\d{1,2}[.,]?\s+)?(\d{5,8})\s*$/.exec(o.text.trim());return m&&o.bbox[0]<.2&&o.bbox[1]<.9?[{entry:m[1],y:o.bbox[1],height:o.bbox[3],x:o.bbox[0]}]:[];}).sort((a,b)=>b.y-a.y);
 const unique=anchors.filter((a,i)=>!anchors.slice(0,i).some(b=>a.entry===b.entry&&Math.abs(a.y-b.y)<.01));
 return unique.map((anchor,i)=>{
  const top=Math.min(1,anchor.y+Math.max(.012,anchor.height*1.8)),bottom=i+1<unique.length?unique[i+1].y+unique[i+1].height*1.8:0;
  const pieces=observations.filter(o=>o.bbox[1]+o.bbox[3]/2<=top&&o.bbox[1]+o.bbox[3]/2>bottom).sort((a,b)=>b.bbox[1]-a.bbox[1]||a.bbox[0]-b.bbox[0]);
  const text=pieces.map(o=>o.text).join(' '),description=pieces.filter(o=>o.bbox[0]>=descriptionX).map(o=>o.text).join(' ');
  return {entry:anchor.entry,bbox:[0,bottom,1,top-bottom],text,description,ocrVerified:false,originalInstrument:false,
   flags:[/easement|r\/w|right.{0,4}way/i.test(text)?'easement_reference':null,/mineral|royalt|oil\s*(?:and|&)\s*gas|coal/i.test(text)?'mineral_reference':null,/release|reconvey/i.test(text)?'release_reference':null,/patent/i.test(text)?'patent_reference':null].filter(Boolean)};
 });
}
function index({url,sha256,location,observations,engine}){
 if(!/^https:\/\/webercountyutah\.gov\/mounts\/recorder\//.test(url)||!/^[a-f0-9]{64}$/i.test(sha256))throw Error('Original source and content hash required');
 const candidates=rows(observations).map(r=>({...r,id:crypto.createHash('sha256').update(sha256+'|'+r.entry+'|'+r.bbox.join(',')).digest('hex').slice(0,24)}));
 return {schemaVersion:1,url,sha256,location,engine,readAt:new Date().toISOString(),observationCount:observations.length,rows:candidates,status:'machine_read_unverified',complete:false,limitation:'OCR and row assignment can miss handwriting, continuation pages and cross-references. No match never means no encumbrance. An abstract entry is not its underlying instrument.'};
}
function matchSection(reading,locations){
 const hit=locations.some(l=>['township','northSouth','range','eastWest','section'].every(k=>String(l[k]).toLowerCase()===String(reading.location[k]).toLowerCase()));
 return {...reading,sectionMatch:hit,matchStatus:hit?'same_section_requires_tract_matching':'outside_mapped_section_cross_references_unresolved',lotApplicability:'unresolved'};
}
module.exports={rows,index,matchSection};
