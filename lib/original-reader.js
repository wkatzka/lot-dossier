const {Worker}=require('node:worker_threads');
const {createHash}=require('node:crypto');
const {allowed}=require('./original-discovery');
const VERSION=3, MAX_BYTES=30*1024*1024, blobs=new Map(),readings=new Map();let busy=false;
const hash=b=>createHash('sha256').update(b).digest('hex');
async function download(url,request=fetch){
 if(!allowed(url))throw Error('Only approved public survey, plat and catalogued recorded-document sources are supported');
 let current=url;const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),30000);
 try{for(let redirects=0;redirects<4;redirects++){
  const r=await request(current,{redirect:'manual',signal:ctl.signal,headers:{'User-Agent':'Cornerpin public-record reader','Referer':new URL(current).origin+'/'} });
  if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location'),current).href;await r.body?.cancel();if(!allowed(next))throw Error('Source redirect leaves approved document paths');current=next;continue;}
  if(!r.ok)throw Error('Original source HTTP '+r.status);
  if(Number(r.headers.get('content-length'))>MAX_BYTES)throw Error('Original exceeds 30 MB limit');
  let size=0;const chunks=[];for await(const c of r.body){size+=c.length;if(size>MAX_BYTES){ctl.abort();throw Error('Original exceeds 30 MB limit');}chunks.push(Buffer.from(c));}
  const bytes=Buffer.concat(chunks),magic=bytes.subarray(0,4).toString('hex');
  if(!bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))&&!['49492a00','4d4d002a','49492b00','4d4d002b'].includes(magic))throw Error('Source is a login/error page or unsupported format');
  return {bytes,url:current,sha256:hash(bytes),retrievedAt:new Date().toISOString(),time:Date.now()};
 }throw Error('Too many source redirects');}finally{clearTimeout(timer);}
}
function execute(bytes,start,limit){return new Promise((resolve,reject)=>{
 const w=new Worker(require.resolve('./original-reader-worker'),{workerData:{bytes,start,limit},resourceLimits:{maxOldGenerationSizeMb:256}});let settled=false;
 const finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);w.terminate().finally(()=>error?reject(error):resolve(data));};
 const timer=setTimeout(()=>finish(Error('Page reading exceeded 75 seconds; cursor retained for retry')),75000);
 w.once('message',d=>finish(d.error?Error(d.error):null,d));w.once('error',e=>finish(e));w.once('exit',code=>{if(!settled)finish(Error('Reader exited before returning pages ('+code+')'));});
});}
async function read(url,start=1,{load=download,process=execute}={}){
 if(!allowed(url)||!Number.isInteger(start)||start<1||start>10000)throw Error('Invalid original source or page cursor');
 if(busy){const e=Error('Another document is being read; retry shortly');e.status=429;throw e;}busy=true;
 try{
  let source=blobs.get(url);if(!source||Date.now()-source.time>3600000){source=await load(url);blobs.set(url,source);while([...blobs.values()].reduce((n,b)=>n+b.bytes.length,0)>64*1024*1024)blobs.delete(blobs.keys().next().value);}
  const key=[VERSION,source.sha256,start].join(':');let result=readings.get(key),cacheHit=!!result;
  if(!result){result=await process(source.bytes,start,1);result.readAt=new Date().toISOString();
   for(const ref of result.pages.flatMap(p=>p.references||[])){
    const known=require('./public-record-access').find('Weber',ref.entry);
    if(known)ref.publicOriginal={url:known.url,label:known.label,sourceCoverage:{availablePages:known.availablePages,recordedPages:known.recordedPages,completeCopy:known.completeCopy,checkedAt:known.checkedAt},catalogueSha256:known.sha256};
   }
   const refs=result.pages.flatMap(p=>p.references||[]).filter(r=>r.surveyNumber);
   if(refs.length)try{const index=await require('./surveys').inventory();for(const ref of refs){const found=index.records.find(s=>s.recordNumber===ref.surveyNumber);if(found?.url&&allowed(found.url)){const u=new URL(found.url);u.hostname='www.webercountyutah.gov';ref.url=u.href;ref.label='Filed survey '+found.recordNumber+' · '+found.name;}}}catch(e){result.referenceResolutionError=e.message;}
   readings.set(key,result);if(readings.size>128)readings.delete(readings.keys().next().value);}
  return {...result,url:source.url,sha256:source.sha256,retrievedAt:source.retrievedAt,readAt:result.readAt,cacheHit,cacheScope:'Bounded server-instance cache; saved dossiers retain results',readerVersion:VERSION};
 }finally{busy=false;}
}
module.exports={download,read,execute};
