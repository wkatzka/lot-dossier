/* Signed-in comparison of a user-supplied recorded instrument with the copy Cornerpin retrieved.
   No AI call and no budget use: recorder-stamp check plus deterministic section comparison.
   Reads only the stamp page and a bounded window around the sections; results are cached per
   document/reference/sections in the user's private storage. Never records an approval. */
const C=require('./cloud-projects'),R=require('./recording-stamp'),K=require('./recorded-comparison'),{send}=require('./respond'),crypto=require('node:crypto');
async function readPages(bytes,pages,{execute=require('./original-reader').execute,deadline}={}){
 const out=[];let total=null;
 for(let i=0;i<pages.length&&Date.now()<deadline;){const start=pages[i];let n=1;while(i+n<pages.length&&pages[i+n]===start+n&&n<4)n++;
  const r=await execute(bytes,start,n);total=r.totalPages;out.push(...r.pages.map(p=>({page:p.page,text:p.text,method:p.method,confidence:p.confidence})));i+=n;}
 return {pages:out,total};
}
module.exports=async(req,res,{rpc=require('./investigation-store').rpc,execute,reread=R.reread,now=Date.now}={})=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return send(res,405,{error:'POST required'});
 const c=C.config(),token=String(req.headers.authorization||'').replace(/^Bearer /,''),started=now();
 try{
  const owner=await C.user(token,c);let body=req.body;
  if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(res,413,{error:'Request too large'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);
  const sections=[...new Set((body.sections||[]).map(String))].slice(0,8);
  if(!/^cp-[a-z0-9-]+$/i.test(body.projectId||'')||!/^cp-[a-z0-9-]+$/i.test(body.documentId||'')||!/^[a-f0-9]{64}$/.test(body.referenceSha||'')||!/^\d{6,8}$/.test(String(body.entry||''))||!sections.length||!sections.every(s=>/^\d{1,2}(?:\.\d{1,2}){1,2}$/.test(s)))return send(res,400,{error:'Choose a saved PDF and a comparison target'});
  const headers={apikey:c.key,Authorization:'Bearer '+token};
  const r=await fetch(c.url+'/rest/v1/cornerpin_projects?id=eq.'+body.projectId+'&owner_id=eq.'+owner.id+'&select=record',{headers,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Could not load your saved project');const record=(await r.json())[0]?.record;
  const document=record?.documents?.find(x=>x.id===body.documentId);
  if(!document||!/^\w{64}$/.test(document.hash)||!/\.pdf$/i.test(document.name))return send(res,404,{error:'Saved PDF not found in your account'});
  if(record.documents.some(d=>d.family===document.family&&d.version>document.version))return send(res,409,{error:'Choose the current document version'});
  const storage=c.url+'/storage/v1/object/cornerpin-private/'+owner.id+'/';
  const key=crypto.createHash('sha256').update([K.VERSION,document.hash,body.referenceSha,body.entry,sections.join(',')].join('|')).digest('hex'),cacheURL=storage+'_comparisons/'+key+'.json';
  const cached=await fetch(cacheURL,{headers,signal:AbortSignal.timeout(15000)});
  if(cached.ok){const result=await cached.json();if(result.version===K.VERSION&&result.documentHash===document.hash)return send(res,200,{...result,cacheHit:true});}
  const source=await fetch(storage+document.id+'/'+document.hash,{headers,signal:AbortSignal.timeout(30000)});if(!source.ok)throw Error('Sync the document to your account first');
  const bytes=Buffer.from(await source.arrayBuffer());if(bytes.length>25*1024*1024||crypto.createHash('sha256').update(bytes).digest('hex')!==document.hash)throw Error('Document checksum or size is invalid');
  const reading=await rpc('reading_get',{sha256:body.referenceSha,version:1});if(!reading?.pages?.length)return send(res,409,{error:'The retrieved copy is not available for comparison'});
  const refs=sections.map(n=>K.sectionText(reading.pages,n)).filter(Boolean);
  const deadline=started+240000;
  // Page 1 for the recorder stamp; a stamp date the OCR misses is re-read from the stamp band.
  const first=await readPages(bytes,[1],{execute,deadline});let stamp=R.detect(first.pages);
  if(!stamp||!stamp.recordedOn){try{const rr=await reread(bytes,1);stamp=stamp?R.confirm(stamp,rr.text,rr.confidence):R.detect([{page:1,text:rr.text}]);}catch{}}
  // A recorded copy usually adds a few pages; search outward from the retrieved pages.
  const total=first.total||1,wanted=new Set();const lo=Math.max(1,Math.min(...refs.map(r=>r.page))-6),hi=Math.min(total,Math.max(...refs.map(r=>r.page),1)+8);
  for(let p=lo;p<=hi;p++)if(p!==1)wanted.add(p);
  let pages=[...first.pages,...(await readPages(bytes,[...wanted].sort((a,b)=>a-b),{execute,deadline})).pages];
  let result=K.result({reference:reading.pages,uploadPages:pages,sections,entry:body.entry,stamp});
  for(let w=8;result.sections.some(s=>s.status==='not_found_in_supplied_copy')&&now()<deadline-60000&&w<=40;w+=8){
   const more=[];for(let p=lo-w;p<lo-w+8;p++)if(p>1&&!pages.some(x=>x.page===p))more.push(p);for(let p=hi+w-7;p<=hi+w;p++)if(p<=total&&!pages.some(x=>x.page===p))more.push(p);
   if(!more.length)break;pages=[...pages,...(await readPages(bytes,more,{execute,deadline})).pages].sort((a,b)=>a.page-b.page);result=K.result({reference:reading.pages,uploadPages:pages,sections,entry:body.entry,stamp});
  }
  const out={...result,documentId:document.id,documentHash:document.hash,filename:document.name,referenceSha:body.referenceSha,pagesRead:pages.map(p=>p.page),totalPages:total,checkedAt:new Date().toISOString()};
  await fetch(cacheURL,{method:'POST',headers:{...headers,'Content-Type':'application/json','x-upsert':'true'},body:JSON.stringify(out),signal:AbortSignal.timeout(15000)}).catch(()=>{});
  return send(res,200,out);
 }catch(e){return send(res,/sign in|session|token|auth/i.test(e.message)?401:500,{error:e.message});}
};
