const A=require('../web/permit-assistant');
const C=require('../lib/cloud-projects'),X=require('../lib/permit-extraction'),F=require('../web/permit-facts');
const {send}=require('../lib/respond'),crypto=require('node:crypto');
const {budgetedRequest}=require('./ai-budget');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return send(res,405,{error:'POST required'});
 const c=C.config(),token=String(req.headers.authorization||'').replace(/^Bearer /,'');
 try{
  const owner=await C.user(token,c);let body=req.body;
  if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(res,413,{error:'Request too large'});}body=JSON.parse(raw);}else if(typeof body==='string')body=JSON.parse(body);
  if(!/^cp-[a-z0-9-]+$/i.test(body.projectId||'')||!/^cp-[a-z0-9-]+$/i.test(body.documentId||''))return send(res,400,{error:'Choose a saved project document'});
  const headers={apikey:c.key,Authorization:'Bearer '+token};
  const r=await fetch(c.url+'/rest/v1/cornerpin_projects?id=eq.'+body.projectId+'&owner_id=eq.'+owner.id+'&select=record',{headers,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Could not load your saved project');const record=(await r.json())[0]?.record;
  const document=record?.documents?.find(x=>x.id===body.documentId);
  if(!document||!/^\w{64}$/.test(document.hash)||!/^cp-[a-z0-9-]+$/i.test(document.id)||!/\.pdf$/i.test(document.name))return send(res,404,{error:'Saved PDF not found in your account'});
  if(record.documents.some(d=>d.family===document.family&&d.version>document.version))return send(res,409,{error:'Choose the current document version'});
  const geometry=require('../lib/respond').query(req).action==='plan-measurements',reader=geometry?require('./plan-measurement-reader'):X;
  const storage=c.url+'/storage/v1/object/cornerpin-private/'+owner.id+'/',model=X.MODEL(),key=reader.cacheKey(document,model),cacheURL=storage+'_claude-results/'+key+'.json';
  const cached=await fetch(cacheURL,{headers,signal:AbortSignal.timeout(15000)});
  if(cached.ok){const result=await cached.json();if(result.version===reader.VERSION&&result.documentHash===document.hash)return send(res,200,{...result,documentId:document.id,filename:document.name,cacheHit:true,...(geometry?{measurements:result.measurements.map(m=>({...m,documentId:document.id,filename:document.name}))}:{facts:result.facts.map(f=>({...f,documentId:document.id,filename:document.name}))})});}
  else if(![400,404].includes(cached.status))throw Error('Extraction cache unavailable; retry before incurring model cost');
  const source=await fetch(storage+document.id+'/'+document.hash,{headers,signal:AbortSignal.timeout(30000)});if(!source.ok)throw Error('Sync the source document to your account first');
  if(Number(source.headers.get('content-length'))>25*1024*1024)throw Error('Document exceeds 25 MB');
  const bytes=Buffer.from(await source.arrayBuffer());if(bytes.length>25*1024*1024||crypto.createHash('sha256').update(bytes).digest('hex')!==document.hash)throw Error('Source document checksum or size is invalid');
  const pages=geometry?[]:await X.pagesFromPDF(bytes),direct=[...F.extract(pages,document),...A.scopeFacts(pages,document)],selected=pages,requested=Object.keys(F.fields);
  let ai={facts:[],rejected:[],usage:{}},notice='';
  if(!selected.length&&!geometry)notice='No PDF pages found; no model call made.';
  else if(requested.length){
   if(!process.env.ANTHROPIC_API_KEY)return send(res,503,{error:'CornerpinAI extraction is not configured. Use Read without AI meanwhile.'});
   // Immutable storage slots enforce a distributed maximum of 20 paid attempts/account/UTC day.
   const day=new Date().toISOString().slice(0,10),dailyLimit=Math.max(1,Math.min(1000,Number(process.env.CORNERPIN_CLAUDE_DAILY_LIMIT)||20));let reserved=false;
   for(let n=0;n<dailyLimit;n++){
    const slot=await fetch(storage+'_claude-budget/'+day+'/'+n+'.json',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({key,at:new Date().toISOString()}),signal:AbortSignal.timeout(10000)});
    if(slot.ok){reserved=true;break;}const detail=await slot.json().catch(()=>({}));if(slot.status!==409&&String(detail.statusCode)!=='409'&&detail.error!=='Duplicate')throw Error('Could not reserve extraction budget');
   }
   if(!reserved)return send(res,429,{error:'Daily CornerpinAI limit reached ('+dailyLimit+' document reads per account). Cached results and non-AI reading remain available.'});
   if(geometry){const result=await reader.run(bytes,document,{model,request:budgetedRequest()});if(result.model==='claude-sonnet-5-5')result.estimatedUSD=((result.usage.input_tokens||0)*2+(result.usage.output_tokens||0)*10)/1e6;const stored=await fetch(cacheURL,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(result),signal:AbortSignal.timeout(15000)});if(!stored.ok)result.issues.push('Cache save failed; save these candidates before retrying.');return send(res,200,result);}
   ai=await X.runClaude(selected,document,requested,{model,pdfBuffer:bytes,request:budgetedRequest()});
   notice='CornerpinAI received all '+pages.length+' original PDF pages, including drawings. Visual readings need review against the cited page and location; they are not independently verified measurements.';
  }
  const publicContacts=await require('./plan-company-contact').enrich(pages,ai.facts,document);
  const result={version:X.VERSION,method:ai.model?'CornerpinAI drawings + direct extraction':'Direct extraction',model:ai.model||null,documentId:document.id,documentHash:document.hash,filename:document.name,facts:F.retainConflicts([...direct,...ai.facts,...publicContacts].map(f=>({...f,sourceConflict:ai.rejected.some(r=>r.field===f.field)})),(record.application?.documentExtractions||[]).filter(r=>r.documentId===document.id&&r.documentHash===document.hash).flatMap(r=>r.facts||[])),rejected:ai.rejected,audit:ai.audit||[],usage:ai.usage,notice,sourcePages:pages.length,reviewedPages:selected.map(p=>p.n),at:new Date().toISOString()};
  if(ai.model==='claude-sonnet-5-5')result.estimatedUSD=((ai.usage.input_tokens||0)*2+(ai.usage.output_tokens||0)*10)/1e6;
  const stored=await fetch(cacheURL,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(result),signal:AbortSignal.timeout(15000)});if(!stored.ok)result.notice+=' Result could not be cached; save it in your project before retrying.';
  return send(res,200,result);
 }catch(e){return send(res,e.status||(/Authentication|identity/.test(e.message)?401:422),{error:e.message});}
};
