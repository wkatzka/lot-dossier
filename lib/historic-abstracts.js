/* Public pre-1980 section abstract discovery from explicit survey location headings. */
const {decode,pool}=require('./http');
const BASE='https://webercountyutah.gov/Recorder_Surveyor/old-abstracts.php';
function locations(pages){
 const found=new Map();
 pages.forEach((page,i)=>{const text=page.replace(/\s+/g,' ');
  for(const m of text.matchAll(/LOCATED IN\b(.{0,350}?)TOWNSHIP\s+(\d{1,2})\s+(NORTH|SOUTH)\s*,?\s*RANGE\s+(\d{1,2})\s+(EAST|WEST)\b/gi)){
   const sections=[...m[1].matchAll(/SECTION\s+(\d{1,2})\b(?!\s*[-–]\s*\d)/gi)].map(x=>Number(x[1]));
   for(const section of sections){if(section<1||section>36)continue;const v={township:Number(m[2]),northSouth:m[3][0].toLowerCase(),range:Number(m[4]),eastWest:m[5][0].toLowerCase(),section,sourcePage:i+1,excerpt:m[0]};const key=[v.township,v.northSouth,v.range,v.eastWest,section].join(':');if(!found.has(key))found.set(key,v);}
  }
 });return [...found.values()];
}
function indexUrl(loc){return BASE+'?'+new URLSearchParams({path:`Sec land/t${loc.township}${loc.northSouth} r${loc.range}${loc.eastWest}/Sec ${loc.section}`});}
function parse(html,loc){
 const documents=[],seen=new Set(),prefix=`/mounts/recorder/Published Data/Abstract/Sec land/t${loc.township}${loc.northSouth} r${loc.range}${loc.eastWest}/Sec ${loc.section}/`;
 for(const m of html.matchAll(/href="([^"]+)"[^>]*>([^<]+)<\/a>/gi)){
  let u;try{u=new URL(decode(m[1]),BASE);}catch{continue;}
  if(u.protocol!=='https:'||u.hostname!=='webercountyutah.gov'||!decodeURIComponent(u.pathname).startsWith(prefix)||!/[.]tif$/i.test(u.pathname)||seen.has(u.href))continue;
  seen.add(u.href);documents.push({name:decode(m[2]),url:u.href,kind:'historical_abstract_index',originalInstrument:false,lotApplicability:'unverified'});
 }
 return documents;
}
async function load(url){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch(url,{signal:ctl.signal});if(!r.ok)throw Error('Historical index HTTP '+r.status);const text=await r.text();if(text.length>2e6)throw Error('Historical index exceeds size limit');return text;}finally{clearTimeout(timer);}}
async function discoverLocations(all,request=load){
 const selected=all.slice(0,4),sections=await pool(selected,2,async location=>{const source=indexUrl(location),documents=parse(await request(source),location);return {location,source,retrievedAt:new Date().toISOString(),status:documents.length?'retrieved':'unresolved',documents};});
 return {source:BASE,status:sections.length?'discovered':'unavailable',sections,truncated:all.length>selected.length,chainComplete:false,limitation:'Pre-1980 section-wide abstract index images, not original deeds or a complete present-day title search. A survey location heading can include neighboring land; each entry requires legal-description matching and the underlying instrument.'};
}
async function discover(pages,request=load){return discoverLocations(locations(pages),request);}
module.exports={locations,indexUrl,parse,discover,discoverLocations};
