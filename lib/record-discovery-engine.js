/* Resumable public-source ingestion. No outreach, purchases, credentials or private records. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const zlib=require('node:zlib');
const {parse}=require('parse5');
const PMN=require('./pmn');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const now=()=>new Date().toISOString();
function stable(value){return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;}
const profileHash=profile=>hash(JSON.stringify(stable(profile)));
const hostRequestTimes=new Map();
function retryUntil(restriction){
 if(!restriction)return 0;const seconds=Number(restriction.retryAfter);
 return Number.isFinite(seconds)&&seconds>0?Date.parse(restriction.checkedAt)+seconds*1000:Date.parse(restriction.retryAfter)||Date.parse(restriction.checkedAt)+15*60*1000;
}
function canonical(value,base){const u=new URL(value,base);u.hash='';if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)throw Error('Unsupported source URL');return u.href;}
function permitted(url,profile){try{const u=new URL(url);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&profile.hosts.includes(u.hostname);}catch{return false;}}
function exactIdentifierMatch(text,term){
 if(/^\d{4}-\d+$/.test(term))return String(text).includes(term)&&/ordinance/i.test(text);
 return !/^\d{7,9}$/.test(term)||new RegExp('(^|[^0-9])'+term+'([^0-9]|$)').test(String(text).replace(/(?<=\d)[ -](?=\d)/g,''));
}
function terms(text,profile){const s=String(text).toLowerCase();return profile.terms.filter(t=>s.includes(t.toLowerCase())&&(!/^\d{4}-\d+$/.test(t)||/ordinance|\bord\b/.test(s)));}
function links(html,base){
 const d=parse(html),out=[],texts=[];
 const content=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(content).join(' ');
 function walk(n){
  const attrs=Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
  const target=n.tagName==='a'?attrs.href:['iframe','embed'].includes(n.tagName)?attrs.src:n.tagName==='object'?attrs.data:null;
  if(target){try{out.push({url:canonical(target,base),label:content(n).trim()||attrs.title||'',context:content(n.parentNode||n).slice(0,1500)});}catch{}}
  if(['script','style','noscript'].includes(n.tagName))return;
  if(n.nodeName==='#text')texts.push(n.value);for(const child of n.childNodes||[])walk(child);
 }walk(d);
 // Document embeds and public CMS JSON often expose files without an anchor.
 for(const m of html.replace(/\\\//g,'/').matchAll(/https:\/\/[^\s"<>\\]+\.(?:pdf|docx?|tiff?)(?:\?[^\s"<>\\]*)?/gi)){
  try{const url=canonical(m[0].replace(/&amp;/g,'&'),base);if(!out.some(l=>l.url===url))out.push({url,label:'Embedded document URL'});}catch{}
 }
 return {links:out,text:texts.join(' ')};
}
function classify(status,text){
 if(status===429)return 'rate_limited';
 if(/verify you are human|cf-chl-|checking your browser/i.test(text))return 'access_restricted';
 if([401,403].includes(status)||/Login Required|You need a Frontier account|sign in to access this (?:document|resource)/i.test(text))return 'access_restricted';
 if(status===404)return 'not_found';
 if(status<200||status>=300)return 'source_error';return 'retrieved';
}
async function request(url,profile,{maxBytes=80e6,request:fetcher=require('./public-source-transport').fetch}={}){
 let current=canonical(url);const redirects=[];
 for(let i=0;i<5;i++){
  if(!permitted(current,profile))throw Object.assign(Error('Source host is outside reviewed public-source profile: '+new URL(current).hostname),i?{sourceRedirect:current}:{});
  const host=new URL(current).hostname,delay=500-(Date.now()-(hostRequestTimes.get(host)||0));
  if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));hostRequestTimes.set(host,Date.now());
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);
  try{
   const r=await fetcher(current,{redirect:'manual',dispatcher:require('./public-source-transport').dispatcher,signal:ctl.signal,headers:{'User-Agent':'Cornerpin/0.4 public-record discovery','Accept':'*/*','Accept-Encoding':'identity'}});
   if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');if(!location){await r.body?.cancel();throw Error('Redirect response omitted Location; source access remains unresolved');}const next=canonical(location,current);redirects.push({from:current,to:next,status:r.status});await r.body?.cancel();current=next;continue;}
   if(Number(r.headers.get('content-length'))>maxBytes)throw Error('Source exceeds acquisition size limit');
   let size=0;const chunks=[];for await(const b of r.body){size+=b.length;if(size>maxBytes){ctl.abort();throw Error('Source exceeds acquisition size limit');}chunks.push(Buffer.from(b));}
   return {url:current,requestedUrl:url,redirects,status:r.status,type:r.headers.get('content-type')||'',retryAfter:r.headers.get('retry-after'),bytes:Buffer.concat(chunks),retrievedAt:now()};
  }finally{clearTimeout(timer);}
 }throw Error('Redirect limit reached');
}
function create(profile){return {version:1,profileId:profile.id,profileHash:profileHash(profile),startedAt:now(),updatedAt:now(),jobs:[],documents:[],queries:[],externalLeads:[],discarded:[],sourceRestrictions:[],scope:profile.scope,contactFallbackEligible:false};}
function add(state,job){
 const rawKey=job.key||[job.kind,job.url||'',job.term||'',job.resource||'',job.requestId||'',job.route,job.page||'',job.startDate||'',job.endDate||''].join('|');
 const key=rawKey.split('|').map(part=>/^https?:\/\//.test(part)?canonical(part):part).join('|');
 const existing=state.jobs.find(j=>j.key===key);if(existing){existing.discoveredFrom||=[];if(job.from&&!existing.discoveredFrom.includes(job.from))existing.discoveredFrom.push(job.from);return existing;}
 const j={...job,key,id:hash(key).slice(0,20),status:'queued',discoveredFrom:job.from?[job.from]:[]};state.jobs.push(j);return j;
}
function seed(state,profile){
 for(const s of profile.seeds)add(state,{kind:'page',depth:0,...s});
 for(const term of profile.noticeTerms||[])add(state,{kind:'pmn',route:'public_notice_attachments',term,startDate:profile.startDate,endDate:profile.endDate});
 for(const site of profile.wordpress||[])for(const term of site.terms||profile.terms)for(const resource of ['search','media'])add(state,{kind:'wordpress',route:site.route,url:site.url,term,resource,page:1});
 for(const site of profile.releasedArchives||[])for(const term of profile.archiveTerms||profile.terms)for(const resource of ['requests','documents'])add(state,{kind:'nextrequest',route:'released_records_archive',url:site,term,resource,page:1});
 for(const s of profile.archiveIndexes||[])add(state,{kind:'archive',route:'public_mirrors_and_archives',url:s});
}
function enqueueLink(state,profile,job,l,{allDocuments=false}={}){
 const scope=require('./discovery-link-scope');
 if(scope.nonDocumentMedia(l.url,l.label)){state.discarded.push({url:l.url,from:job.url,reason:'Non-document media link without a governing-record identifier in its path or label; not an empty record search'});return;}
 const linkText=l.label+' '+scope.pathText(l.url);
 if(/\/(?:payments|Treasurer\/tax_note|Clerk_Auditor\/val_notice)\/|\/(?:current-taxes|tax-history|delinquent|property-characteristics)\.php/i.test(l.url)){
  state.discarded.push({url:l.url,from:job.url,reason:'Tax/payment/valuation route does not contain the governing agreement or architectural-review rules'});return;
 }
 if(!permitted(l.url,profile)){
  if((terms(linkText,profile).length||/\.(?:pdf|docx?|tiff?)(?:\?|$)/i.test(l.url))&&!state.externalLeads.some(x=>x.url===l.url))state.externalLeads.push({...l,route:job.route,from:job.url,status:'requires_source_review'});
  return;
 }
 const doc=/\.(?:pdf|docx?|tiff?)(?:\?|$)|\/documents\/\d+\/download(?:\?|$)/i.test(l.url),hits=terms(linkText,profile);
 const authorityNavigation=job.route==='association_libraries'&&/association|\bhoa\b|bylaws|covenants|committee|governing|documents|building|contact/i.test(linkText);
 const navigation=/next|older|previous|pagination/i.test(l.label)||/[?&](?:page|paged)=\d+/.test(l.url);
 const samePath=job.libraryPrefix&&l.url.startsWith(job.libraryPrefix);
 if((doc&&(allDocuments||hits.length))||(!doc&&(hits.length||authorityNavigation||navigation||samePath)&&job.depth<(job.maxDepth??3))){
  add(state,{kind:'page',route:job.route,url:l.url,label:l.label,from:job.url,depth:(job.depth||0)+1,mode:job.mode,libraryPrefix:job.libraryPrefix,maxDepth:job.maxDepth});
 }else if(hits.length&&!doc&&!state.jobs.some(j=>j.url===l.url)&&!state.externalLeads.some(x=>x.url===l.url))state.externalLeads.push({...l,route:job.route,from:job.url,status:'depth_limit'});
}
async function readPdf(file){
 // Native text first; scanned pages remain explicit OCR work, never interpreted as no matches.
 const pdfjs=require('pdfjs-dist/legacy/build/pdf.js');
 const task=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(file)),disableFontFace:true,isEvalSupported:false});
 const pdf=await task.promise,pages=[];
 try{for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),t=await p.getTextContent(),text=t.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');
  const ops=await p.getOperatorList(),hasImage=ops.fnArray.some(x=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageMaskXObject].includes(x));
  const annotations=await p.getAnnotations({intent:'display'}),documentLinks=annotations.filter(a=>a.subtype==='Link'&&/^https:\/\//i.test(a.url||'')).map(a=>a.url);
  pages.push({page:n,text,documentLinks,needsOCR:hasImage&&text.replace(/\s/g,'').length<1000});p.cleanup();}}
 finally{await pdf.destroy();}return pages;
}
function wordText(file){
 if(/\.docx$/i.test(file))return execFileSync('python3',['-c',"import zipfile,sys,xml.etree.ElementTree as E\nz=zipfile.ZipFile(sys.argv[1]); n='word/document.xml'\nassert z.getinfo(n).file_size < 30000000\nr=E.fromstring(z.read(n))\nprint('\\n'.join(''.join(p.itertext()) for p in r.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')))",file],{encoding:'utf8',timeout:30000,maxBuffer:30e6});
 if(process.platform==='darwin')return execFileSync('textutil',['-convert','txt','-stdout',file],{encoding:'utf8',timeout:30000,maxBuffer:30e6});
 return execFileSync('antiword',[file],{encoding:'utf8',timeout:30000,maxBuffer:30e6});
}
function summarize(state,profile){
 const routes=profile.routes.map(route=>{
  const jobs=state.jobs.filter(j=>j.route===route),unresolved=jobs.filter(j=>!['complete','reviewed_not_relevant'].includes(j.status));
  const leads=state.externalLeads.filter(j=>j.route===route&&!['reviewed_not_relevant','followed'].includes(j.status));
  return {route,jobs:jobs.length,completed:jobs.filter(j=>j.status==='complete').length,restricted:jobs.filter(j=>j.status==='access_restricted').length,unresolved:unresolved.map(j=>({id:j.id,url:j.url,status:j.status,error:j.error})),unreviewedLeads:leads.length,complete:jobs.length>0&&!unresolved.length&&!leads.length};
 });
 const unread=state.documents.filter(d=>d.disposition!=='reviewed_not_relevant'&&(d.unreadPages?.length||d.readError));
 state.coverage={scope:profile.scope,routes,pending:state.jobs.filter(j=>j.status==='queued').length,unreadDocuments:unread.length,documents:state.documents.length,publicRouteChecksComplete:routes.every(r=>r.complete)&&!unread.length};
 // Processing and a restricted service do not prove custody of a specific missing instrument.
 state.investigation=require('./research-outcomes').evaluate(require('./research-plans').forProfile(profile,state),state);
 state.contactFallbackEligible=state.investigation.contactFallbackEligible;
 state.updatedAt=now();return state.coverage;
}
async function processJob(state,profile,job,store,options={}){
 const fetcher=options.fetch||((u)=>request(u,profile));
 async function load(url){
  const response=await fetcher(url);let b=response.bytes;
  if(b[0]===31&&b[1]===139)b=zlib.gunzipSync(b,{maxOutputLength:80e6});
  // Some proxies strip Content-Encoding while forwarding compressed bodies.
  if(/json|html|xml|text\//i.test(response.type)&&!/^\s*[<{[\w]/.test(b.toString('utf8').slice(0,100))){
   try{b=zlib.brotliDecompressSync(b,{maxOutputLength:80e6});}catch{throw Error('Text source returned undecodable binary content');}
  }
  const text=b.toString('utf8');
  const outcome=classify(response.status,text.slice(0,15000));
  const sha256=hash(b),file=path.join(store,'blobs',sha256);
  fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,b);
  Object.assign(job,{fetchedUrl:response.url,httpStatus:response.status,redirects:response.redirects,sha256,retrievedAt:response.retrievedAt,bytes:b.length});
  if(outcome!=='retrieved'){job.status=outcome==='not_found'&&/\/documents\/\d+\/download/.test(url)?'source_error':outcome;job.error=job.status==='source_error'&&outcome==='not_found'?'Listed public attachment download returned 404; document access is unresolved':text.replace(/<[^>]+>/g,' ').slice(0,800);if(outcome==='access_restricted'||outcome==='rate_limited')state.sourceRestrictions.push({url,route:job.route,status:outcome,httpStatus:response.status,retryAfter:response.retryAfter,checkedAt:now()});return null;}
  return {response,b,text,file,sha256};
 }
 if(job.kind==='ocr'){
  const doc=state.documents.find(d=>d.sha256===job.documentHash);if(!doc)throw Error('OCR source missing from manifest');
  const cache=path.join(store,'readings',doc.sha256+'.json');
  const sourceFile=path.join(store,doc.file);
  if(!fs.existsSync(sourceFile)){
   // Hosted checkpoints retain metadata and hashes, not source bytes or extracted text.
   let recovered=false;
   for(const url of doc.urls){try{const response=await fetcher(url);if(response.status===200&&hash(response.bytes)===doc.sha256){fs.mkdirSync(path.dirname(sourceFile),{recursive:true});fs.writeFileSync(sourceFile,response.bytes);recovered=true;break;}}catch{}}
   if(!recovered)throw Error('Original source bytes unavailable or changed; cannot resume OCR against this recorded hash');
  }
  let saved;if(fs.existsSync(cache))saved=JSON.parse(fs.readFileSync(cache));else{saved={sha256:doc.sha256,pages:doc.kind==='pdf'?await (options.readPdf||readPdf)(sourceFile):[{page:1,text:'',needsOCR:true}]};fs.mkdirSync(path.dirname(cache),{recursive:true});}
  const prior=saved.sha256===doc.sha256&&saved.pages.find(p=>p.page===job.page);
  const reusable=prior&&prior.needsOCR===false&&(prior.text?.trim()||prior.blank===true);
  let count=1;
  while(count<Math.min(3,options.ocrBatchSize||1)&&doc.unreadPages.includes(job.page+count))count++;
  const reader=options.ocr||require('./original-reader').execute;
  let result;
  if(reusable){result={pages:[prior]};count=1;}
  else {try{result=await reader(fs.readFileSync(sourceFile),job.page,count);}catch(e){if(count===1)throw e;count=1;result=await reader(fs.readFileSync(sourceFile),job.page,1);}}
  if(result.pages?.length!==count||result.pages.some((p,i)=>p.page!==job.page+i||(!p.text?.trim()&&!p.blank)))throw Error('OCR returned no readable page text or an incomplete page range');
  for(const page of result.pages){
   if(page.blank){doc.blankPages||=[];if(!doc.blankPages.includes(page.page))doc.blankPages.push(page.page);}
   saved.pages[page.page-1]={...saved.pages[page.page-1],...page,needsOCR:false};
   doc.unreadPages=doc.unreadPages.filter(n=>n!==page.page);
   const found=terms(page.text,profile);if(found.length)doc.matches.push({page:page.page,terms:found,snippets:found.map(t=>{const i=page.text.toLowerCase().indexOf(t.toLowerCase());return page.text.slice(Math.max(0,i-250),i+700);})});
   for(const pending of state.jobs.filter(j=>j.kind==='ocr'&&j.documentHash===doc.sha256&&j.page===page.page)){pending.status='complete';pending.checkedAt=now();}
  }
  fs.writeFileSync(cache,JSON.stringify(saved));
  doc.ocrReviewRequired=true;job.status='complete';return;
 }
 if(job.kind==='municipal-index'){
  const u=new URL(job.url);u.searchParams.set('page',String(job.page||1));u.searchParams.set('pageSize','20');u.searchParams.set('sort','Date-desc~Number-desc');
  const r=await load(u.href);if(!r)return;const result=JSON.parse(r.text);
  if(!Array.isArray(result.Data)||!Number.isInteger(result.Total)||result.Total<0)throw Error('Invalid public ordinance index response');
  if(!result.Data.length&&((job.page||1)-1)*20<result.Total)throw Error('Public ordinance index pagination is incomplete');
  state.queries.push({route:job.route,url:u.href,page:job.page||1,total:result.Total,records:result.Data.map(x=>({number:x.Number,date:x.Date,url:x.URLEscaped||x.URL}))});
  for(const x of result.Data){const label=[x.Number,x.URL,JSON.stringify(x.References||[])].join(' ');if(terms(label,profile).length)enqueueLink(state,profile,job,{url:x.URLEscaped||x.URL,label},{allDocuments:true});}
  if((job.page||1)*20<result.Total)add(state,{kind:job.kind,url:job.url,route:job.route,page:(job.page||1)+1});
  job.status='complete';return;
 }
 if(job.kind==='pmn'){
  const result=await (options.pmn||PMN.searchAll)(job.term,{startDate:job.startDate,endDate:job.endDate,maxChecks:1,checkpoint:job.pmnCheckpoint});
  job.searchReceipt={url:'https://www.utah.gov/pmn/search.html',scope:'notice_agenda',term:job.term,identifiers:[job.term],count:result.results.length,paginationComplete:result.complete,startDate:job.startDate,endDate:job.endDate};
  state.queries.push({route:job.route,term:job.term,...result,results:result.results.map(n=>({url:n.url,id:n.id,title:n.title,entity:n.entity}))});
  for(const n of result.results)if(/Weber|Ogden Valley|Wolf Creek/i.test(n.entity+' '+n.body))add(state,{kind:'page',route:job.route,url:n.url,depth:0,mode:'attachments',label:n.title,from:'https://www.utah.gov/pmn/search.html'});
  if(result.pendingRanges?.length){job.pmnCheckpoint=result;job.status='queued';}else{delete job.pmnCheckpoint;job.status=result.complete?'complete':'search_incomplete';}job.error=result.gaps.map(x=>x.reason).join('; ');return;
 }
 if(job.kind==='wordpress'){
  const u=new URL('/wp-json/wp/v2/'+job.resource,job.url);u.search=new URLSearchParams({search:job.term,per_page:'100',page:String(job.page)});
  const r=await load(u.href);if(!r)return;const rows=JSON.parse(r.text);if(!Array.isArray(rows))throw Error('Invalid WordPress search response');
  for(const x of rows){const url=x.source_url||x.url||x.link;if(url)enqueueLink(state,profile,{...job,depth:0},{url,label:x.title?.rendered||x.title||''},{allDocuments:true});}
  if(rows.length===100)add(state,{...job,key:undefined,id:undefined,status:undefined,page:job.page+1});
  job.searchReceipt={url:u.href,scope:'wordpress_'+job.resource,term:job.term,identifiers:[job.term],count:rows.length+state.queries.filter(q=>q.term===job.term&&q.url?.startsWith(new URL('/wp-json/wp/v2/'+job.resource,job.url).href)&&q.page<job.page).reduce((n,q)=>n+(q.count||0),0),paginationComplete:rows.length<100&&state.queries.filter(q=>q.term===job.term&&q.url?.startsWith(new URL('/wp-json/wp/v2/'+job.resource,job.url).href)&&q.page<job.page).length===job.page-1};
  state.queries.push({route:job.route,url:u.href,term:job.term,count:rows.length,page:job.page});job.status='complete';return;
 }
 if(job.kind==='nextrequest'){
  const u=new URL('/client/'+job.resource,job.url);u.search=new URLSearchParams({search_term:job.term,page_size:'50',page_number:String(job.page),sort_field:job.resource==='documents'?'count':'request_date',sort_order:'desc'});
  const r=await load(u.href);if(!r)return;const result=JSON.parse(r.text),rows=result[job.resource];if(!Array.isArray(rows)||!Number.isFinite(result.total_count))throw Error('Public archive response lacks rows or total');
  const prior=state.queries.filter(q=>q.term===job.term&&q.url?.startsWith(new URL('/client/'+job.resource,job.url).href)&&q.page<job.page);
  const priorIds=new Set(prior.flatMap(q=>(q.rows||[]).map(r=>r.id)));
  if(rows.some(r=>priorIds.has(r.id)))throw Error('Archive pagination repeated records; coverage cannot be reconciled');
  state.queries.push({route:job.route,url:u.href,term:job.term,page:job.page,total:result.total_count,rows});
  for(const row of rows){if(!exactIdentifierMatch(row.request_text||row.title||'',job.term)){state.discarded.push({url:u.href,resultId:row.id,reason:'Fuzzy numeric search result does not contain the exact recording/parcel identifier'});continue;}
   if(job.resource==='requests')add(state,{kind:'release',route:job.route,url:job.url,requestId:row.id,key:'release|'+job.url+'|'+row.id,from:u.href});
   else if(row.document_url||row.download_url)enqueueLink(state,profile,{...job,depth:0},{url:row.download_url||row.document_url,label:row.name||row.file_name||''},{allDocuments:true});
   else add(state,{kind:'page',route:job.route,url:new URL('/documents/'+row.id,job.url).href,mode:'attachments',depth:0,from:u.href});}
  if(job.page*50<result.total_count){if(!rows.length)throw Error('Archive pagination returned no rows before total');add(state,{...job,key:undefined,id:undefined,status:undefined,page:job.page+1});}
  job.searchReceipt={url:u.href,scope:'released_'+job.resource,term:job.term,identifiers:[job.term],count:result.total_count,paginationComplete:job.page*50>=result.total_count&&prior.length===job.page-1};
  job.status='complete';return;
 }
 if(job.kind==='release'){
  const u=new URL('/client/requests/'+encodeURIComponent(job.requestId),job.url);const r=await load(u.href);if(!r)return;
  const result=JSON.parse(r.text);state.queries.push({route:job.route,url:u.href,response:result});
  // Public response text and any directly exposed document links remain discoverable without an account.
  for(const value of JSON.stringify(result).match(/https:\/\/[^\s"<>]+/g)||[])enqueueLink(state,profile,{...job,depth:0},{url:value,label:value},{allDocuments:true});
  add(state,{kind:'releaseDocuments',route:job.route,url:job.url,requestId:job.requestId,page:1,key:'releaseDocs|'+job.url+'|'+job.requestId+'|1',from:u.href});
  add(state,{kind:'releaseTimeline',route:job.route,url:job.url,requestId:job.requestId,page:1,from:u.href});
  job.status='complete';return;
 }
 if(job.kind==='releaseTimeline'){
  const u=new URL('/client/requests/'+encodeURIComponent(job.requestId)+'/timeline',job.url);u.search=new URLSearchParams({page_number:String(job.page)});
  const r=await load(u.href);if(!r)return;const result=JSON.parse(r.text),rows=result.timeline,total=result.total_count;
  if(!Array.isArray(rows)||!Number.isFinite(total))throw Error('Public timeline lacks rows or total');
  const previous=state.queries.filter(q=>q.kind==='releaseTimeline'&&q.requestId===job.requestId&&q.page<job.page);
  const seen=new Set(previous.flatMap(q=>q.rows.map(x=>x.timeline_id)));
  if(rows.some(x=>seen.has(x.timeline_id)))throw Error('Public timeline pagination repeated events');
  state.queries.push({kind:'releaseTimeline',route:job.route,url:u.href,requestId:job.requestId,page:job.page,total,rows});
  for(const row of rows)for(const l of links(row.timeline_display_text||'',job.url).links)enqueueLink(state,profile,{...job,depth:0},l,{allDocuments:true});
  if(seen.size+rows.length<total){if(!rows.length)throw Error('Public timeline stopped before total');add(state,{...job,key:undefined,id:undefined,page:job.page+1});}
  job.status='complete';return;
 }
 if(job.kind==='releaseDocuments'){
  const u=new URL('/client/request_documents',job.url);u.search=new URLSearchParams({request_id:job.requestId,page_number:String(job.page),sort_field:'title',sort_order:'asc'});
  const r=await load(u.href);if(!r)return;const result=JSON.parse(r.text),rows=result.documents,total=result.total_documents_count;
  if(!Array.isArray(rows)||!Number.isFinite(total))throw Error('Public attachment response lacks rows or total');
  const earlier=new Set(state.queries.filter(q=>q.requestId===job.requestId&&q.page<job.page).flatMap(q=>(q.rows||[]).map(r=>r.id)));
  if(rows.some(r=>earlier.has(r.id)))throw Error('Public attachment pagination repeated records');
  state.queries.push({route:job.route,url:u.href,requestId:job.requestId,page:job.page,total,rows});
  for(const row of rows){const url=row.download_url||row.document_url||row.url||row.document_path;
   if(url)enqueueLink(state,profile,{...job,depth:0},{url:canonical(url,job.url),label:row.title||row.name||''},{allDocuments:true});
   else add(state,{kind:'page',route:job.route,url:new URL('/documents/'+row.id,job.url).href,mode:'attachments',depth:0,label:row.title||'Released document',from:u.href});}
  const previous=new Set(state.queries.filter(q=>q.requestId===job.requestId&&q.page&&q.page<=job.page).flatMap(q=>(q.rows||[]).map(r=>r.id))).size;
  if(previous<total){if(!rows.length)throw Error('Attachment pagination stopped before total');add(state,{...job,page:job.page+1,key:'releaseDocs|'+job.url+'|'+job.requestId+'|'+(job.page+1)});}
  job.status='complete';return;
 }
 const r=await load(job.url);if(!r)return;
 if(job.kind==='archive'){
  const rows=JSON.parse(r.text);if(!Array.isArray(rows))throw Error('Archive index did not return rows');
  state.queries.push({route:job.route,url:job.url,rows});
  // Archive URLs require individual original-host and relevance review; do not silently certify them.
  const header=rows[0]||[],ui=header.indexOf('original'),ti=header.indexOf('timestamp');
  if(rows.length&& (ui<0||ti<0))throw Error('Archive index lacks original URL and timestamp columns');
  for(const row of rows.slice(1)){
   const url=row[ui],timestamp=row[ti],requested=new URL(job.url).searchParams.get('url');if(!url||(!terms(url,profile).length&&url!==requested&&url.replace(/^http:/,'https:')!==requested))continue;
   const original=canonical(url).replace(/^http:/,'https:');
   if(permitted(original,profile)&&/^\d{14}$/.test(timestamp))add(state,{kind:'page',route:job.route,url:'https://web.archive.org/web/'+timestamp+'id_/'+url,originalUrl:url,archiveTimestamp:timestamp,mode:'attachments',depth:0,maxDepth:1,from:job.url});
   else state.externalLeads.push({route:job.route,url,archiveTimestamp:timestamp,status:'archive_capture_required',from:job.url});
  }
  job.searchReceipt={url:job.url,scope:'archived_url',identifiers:[new URL(job.url).searchParams.get('url')||job.url],count:Math.max(0,rows.length-1),paginationComplete:rows.length<101};
  job.status=rows.length<101?'complete':'search_incomplete';if(rows.length>=101)job.error='Archive result limit reached; capture history is incomplete';return;
 }
 const isPdf=r.b.subarray(0,1024).includes(Buffer.from('%PDF-'));
 const isDocx=/wordprocessingml/i.test(r.response.type)||r.b.subarray(0,2).toString()==='PK'&&r.b.includes(Buffer.from('word/document.xml'));
 const isDoc=/msword/i.test(r.response.type);
 if(isPdf||isDocx||isDoc||/\.(?:docx?|tiff?)(?:\?|$)/i.test(job.url)){
  let doc=state.documents.find(d=>d.sha256===r.sha256);
  if(doc&&!doc.readError&&(!isPdf||doc.pdfLinkScanVersion===1)){if(!doc.urls.includes(job.url))doc.urls.push(job.url);job.documentHash=doc.sha256;job.status='complete';return;}
  const ext=isPdf?'.pdf':isDocx?'.docx':isDoc?'.doc':new URL(job.url).pathname.match(/\.[^.]+$/)[0];
  const file=r.file+ext;if(!fs.existsSync(file))fs.copyFileSync(r.file,file);
  if(!doc){doc={sha256:r.sha256,urls:[job.url],sourcePages:job.discoveredFrom||[],route:job.route,kind:ext.slice(1),retrievedAt:now(),applicability:'unverified',file:path.relative(store,file)};state.documents.push(doc);}else if(!doc.urls.includes(job.url))doc.urls.push(job.url);job.documentHash=r.sha256;
  try{
   const cache=path.join(store,'readings',r.sha256+'.json');
   let pages;if(fs.existsSync(cache)){pages=JSON.parse(fs.readFileSync(cache)).pages;if(ext==='.pdf'&&doc.pdfLinkScanVersion!==1){const fresh=await (options.readPdf||readPdf)(file);pages=fresh.map(page=>({...page,...pages.find(old=>old.page===page.page),documentLinks:page.documentLinks||[]}));}}
   else if(ext==='.pdf')pages=await (options.readPdf||readPdf)(file);
   else if(/\.docx?/.test(ext))pages=[{page:1,text:wordText(file)}];
   else pages=[{page:1,text:'',needsOCR:true}];
   delete doc.readError;if(ext==='.pdf')doc.pdfLinkScanVersion=1;doc.pages=pages.length;doc.unreadPages=pages.filter(p=>p.needsOCR||(!p.blank&&p.text.trim().length<20)).map(p=>p.page);if(pages.some(p=>p.method==='full_page_ocr'))doc.ocrReviewRequired=true;
   doc.matches=pages.flatMap(p=>{const found=terms(p.text,profile);return found.length?[{page:p.page,terms:found,snippets:found.map(t=>{const i=p.text.toLowerCase().indexOf(t.toLowerCase());return p.text.slice(Math.max(0,i-250),i+700);})}]:[];});
   fs.mkdirSync(path.dirname(cache),{recursive:true});fs.writeFileSync(cache,JSON.stringify({sha256:r.sha256,pages}));
   for(const page of doc.unreadPages){const pending=add(state,{kind:'ocr',route:job.route,documentHash:doc.sha256,page,key:'ocr|'+doc.sha256+'|'+page,from:job.url});if(pending.status==='complete')pending.status='queued';}
   for(const p of pages)for(const url of p.documentLinks||[])enqueueLink(state,profile,{...job,depth:job.depth||0},{url,label:'PDF linked attachment, page '+p.page},{allDocuments:true});
   for(const p of pages)for(const url of p.text.match(/https:\/\/[^\s<>"\])]+/g)||[])enqueueLink(state,profile,{...job,depth:job.depth||0},{url:url.replace(/[.,;]+$/,''),label:url},{allDocuments:false});
  }catch(e){doc.readError=e.message;job.status='source_error';job.error='Document reading failed: '+e.message;return;}
  job.status='complete';return;
 }
 if(/<sitemapindex|<urlset/.test(r.text)){
  for(const m of r.text.matchAll(/<loc>(.*?)<\/loc>/gs)){
   const url=m[1].replace(/&amp;/g,'&');if(permitted(url,profile))add(state,{kind:'page',route:job.route,url,mode:job.mode,depth:(job.depth||0)+1,from:job.url,maxDepth:job.maxDepth,libraryPrefix:job.libraryPrefix});
  }job.status='complete';return;
 }
 if(/\.pdf(?:\?|$)/i.test(job.url))throw Error('Expected original PDF returned a non-PDF response; follow the current public library instead');
 const parsed=links(r.text,job.originalUrl||r.response.url);job.matches=terms(parsed.text,profile);job.textExcerpt=job.matches.length?parsed.text.slice(0,3000):undefined;
 if(!/<(?:html|!doctype|body)\b/i.test(r.text))throw Error('Source did not return a recognizable HTML document');
 if(/\/documents\/\d+/.test(job.url)&&!parsed.links.some(l=>/download|\.pdf/i.test(l.url+' '+l.label)))throw Error('Public document viewer requires rendered download-link discovery');
 for(const l of parsed.links)enqueueLink(state,profile,job,l,{allDocuments:['library','attachments'].includes(job.mode)});
 job.status='complete';
}
async function run(profile,store,{maxJobs=Infinity,onProgress=()=>{},retry=false,ocrConcurrency=1,...options}={}){
 fs.mkdirSync(store,{recursive:true});const manifest=path.join(store,'manifest.json');
 const state=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest)):create(profile);
 if(state.profileHash===hash(JSON.stringify(profile)))state.profileHash=profileHash(profile);
 if(state.profileHash!==profileHash(profile))throw Error('Profile changed; start a new run directory to retain the old search record');
 if(retry){
  for(const j of state.jobs)if(['rate_limited','deferred_rate_limit','source_error','search_incomplete'].includes(j.status)){
   const host=j.url&&new URL(j.url).hostname;
   const recent=state.sourceRestrictions.filter(r=>r.status==='rate_limited'&&new URL(r.url).hostname===host).at(-1);
   const until=retryUntil(recent);
   if(until>Date.now())continue;
   (j.attempts||=[]).push({status:j.status,error:j.error,checkedAt:j.checkedAt});j.status='queued';delete j.error;
  }
 }
 for(const doc of state.documents.filter(d=>d.readError))for(const job of state.jobs.filter(j=>j.documentHash===doc.sha256&&j.status==='complete'))job.status='queued';
 state.runStartedAt=now();seed(state,profile);let count=0;
 for(const doc of state.documents.filter(d=>d.disposition!=='reviewed_not_relevant'))for(const page of doc.unreadPages||[]){const pending=add(state,{kind:'ocr',route:doc.route,documentHash:doc.sha256,page,key:'ocr|'+doc.sha256+'|'+page,from:doc.urls[0]});if(pending.status==='complete')pending.status='queued';}
 const save=()=>{summarize(state,profile);fs.writeFileSync(manifest+'.tmp',JSON.stringify(state,null,2));fs.renameSync(manifest+'.tmp',manifest);};
 for(const j of state.jobs){if(j.status!=='queued'||(j.kind==='ocr'&&Date.parse(options.deferOCRUntil||j.budgetPauseUntil)>Date.now()))continue;if(count++>=maxJobs)break;
  const restriction=j.url&&state.sourceRestrictions.find(r=>new URL(r.url).hostname===new URL(j.url).hostname&&r.status==='rate_limited'&&retryUntil(r)>Date.now());
  if(restriction){j.status='deferred_rate_limit';j.error='Source requested rate limiting; remaining jobs retained for a later retry';save();continue;}
  // Parallel OCR only across distinct documents: page-cache writes for one document remain ordered.
  const batch=[j],hashes=new Set([j.documentHash]);
  if(j.kind==='ocr')for(const next of state.jobs){if(batch.length>=Math.min(4,ocrConcurrency)||count>=maxJobs)break;if(next!==j&&next.status==='queued'&&next.kind==='ocr'&&!hashes.has(next.documentHash)){batch.push(next);hashes.add(next.documentHash);count++;}}
  await Promise.all(batch.map(async job=>{try{await processJob(state,profile,job,store,options);}catch(e){job.status=e.code==='AI_BUDGET_PAUSED'?'queued':'source_error';job.error=e.message;if(e.code==='AI_BUDGET_PAUSED')job.budgetPauseUntil=e.retryAt;if(e.sourceRedirect&&!state.externalLeads.some(l=>l.url===e.sourceRedirect))state.externalLeads.push({url:e.sourceRedirect,from:job.url,route:job.route,documentRedirect:true,status:'requires_source_review'});}job.checkedAt=now();save();await onProgress(job,state);}));
 }save();return state;
}
module.exports={retryUntil,canonical,permitted,terms,links,classify,request,create,add,seed,processJob,summarize,run,readPdf,exactIdentifierMatch};
