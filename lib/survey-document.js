const {inventory}=require('./surveys');
const {pdfPages}=require('./extract');
const crypto=require('node:crypto');
function extract(pages){
  const references=[],lots=[],basis=[];
  pages.forEach((text,i)=>{
    // Limit entry parsing to the numeric list after the explicit recording label.
    for(const m of text.matchAll(/\bENTRY\s*(?:NO\.?|NUMBER|#)?\s*((?:\d{5,9})(?:\s*[,;&]\s*\d{5,9})*)/gi)){
      for(const number of m[1].match(/\d{5,9}/g)||[])if(!references.some(r=>r.entry===number&&r.page===i+1))references.push({entry:number,page:i+1,excerpt:text.slice(Math.max(0,m.index-65),Math.min(text.length,m.index+m[0].length+65)).replace(/\s+/g,' '),applicability:'unverified'});
    }
    for(const m of text.matchAll(/\bLOT\s+(\d{1,4})\b/gi))if(!lots.some(l=>l.lot===m[1]&&l.page===i+1))lots.push({lot:m[1],page:i+1});
    const at=text.search(/THE BASIS OF BEARING/i);if(at>=0)basis.push({page:i+1,excerpt:text.slice(at,at+700).replace(/\s+/g,' '),geometryRegistered:false});
  });
  return {references,lots,basis};
}
async function read(record){
  const data=await inventory(),entry=data.records.find(r=>r.recordNumber===record);
  if(!entry||!entry.url)throw Error('No public PDF for this survey-index record.');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);let buf;
  try{
    const r=await fetch(entry.url,{signal:ctl.signal});if(!r.ok)throw Error('Survey PDF HTTP '+r.status);
    let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>15e6){ctl.abort();throw Error('Survey PDF exceeds reading limit.');}chunks.push(Buffer.from(chunk));}
    buf=Buffer.concat(chunks);if(!buf.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('The survey source is not a PDF.');
  }finally{clearTimeout(timer);}
  const result=await pdfPages(buf,{maxPages:25,deadline:Date.now()+20000}),chars=result.pages.reduce((n,t)=>n+t.length,0);
  return {recordNumber:record,url:entry.url,retrievedAt:new Date().toISOString(),sha256:crypto.createHash('sha256').update(buf).digest('hex'),
    pagesRead:result.pages.length,totalPages:result.numPages,partial:result.truncated||result.pages.length<result.numPages,
    textStatus:chars<200?'unreadable_text':'text_extracted',...extract(result.pages),geometryRegistered:false,applicability:'unverified',
    limitation:'File reading and lot labels do not establish surveyed boundary alignment, current legal effect, lot applicability or approval. Blank recording/signature fields require reconciliation with the recorded instrument.'};
}
module.exports={extract,read};
