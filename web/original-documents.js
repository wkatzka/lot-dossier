/* Sequential, resumable acquisition. Saved manifests retain exact page cursors and source hashes. */
(function(root){
'use strict';
async function drain(manifest,fetchPage,{maxPages=100,onProgress=()=>{}}={}){
 let processed=0;
 documents: for(const doc of manifest.documents||[]){
  if(doc.state==='pages_processed')continue;
  doc.pages=doc.pages||[];let cursor=doc.nextPage||1,changes=0;
  while(processed<maxPages){
   try{
    const r=await fetchPage(doc.url,cursor);
    if(r.error)throw Error(r.error);
    if(!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isInteger(r.totalPages)||r.totalPages<1||!Array.isArray(r.pages)||!r.pages.length)throw Error('Invalid source reading');
    if(doc.sha256&&doc.sha256!==r.sha256){if(++changes>2)throw Error('Source changed repeatedly during reading');manifest.requests=manifest.requests.filter(x=>!x.discoveredByDoc||x.discoveredByDoc!==doc.id);doc.pages=[];doc.nextPage=1;doc.sha256=r.sha256;cursor=1;doc.state='source_changed';continue;}
    if(r.pages.some((p,i)=>p.page!==cursor+i)||r.nextPage!==(cursor+r.pages.length<=r.totalPages?cursor+r.pages.length:null))throw Error('Page coverage does not reconcile');
    if(JSON.stringify(manifest).length+JSON.stringify(r.pages).length>1500000){doc.state='storage_limit';doc.error='Saved evidence budget reached; retain additional readings in a separate research export.';doc.nextPage=cursor;onProgress(doc);break documents;}
    doc.sha256=r.sha256;doc.totalPages=r.totalPages;doc.renderingNotes=(doc.renderingNotes||[]).concat(r.renderingNotes||[]);doc.retrievedAt=r.retrievedAt;
    doc.pages.push(...r.pages);processed+=r.pages.length;doc.nextPage=r.nextPage;delete doc.error;
    for(const page of r.pages)for(const ref of page.references||[]){
     if(ref.surveyNumber){
      if(ref.url&&!manifest.documents.some(d=>d.url===ref.url)&&manifest.documents.length<500)manifest.documents.push({id:'survey-'+ref.surveyNumber,url:ref.url,label:ref.label,kind:'filed_survey',state:'queued',matchBasis:['Explicit survey reference on '+doc.label+' page '+page.page+'; OCR identity and applicability unverified'],discoverySources:[doc.url+'#page='+page.page],applicability:'unverified'});
      continue;
     }
     const key=ref.entry?'entry:'+ref.entry:'book:'+ref.book+':'+ref.recordedPage;
     if(!(manifest.requests||[]).some(x=>x.key===key))manifest.requests.push({...ref,key,discoveredByDoc:doc.id,sourceSha256:r.sha256,extractionMethod:page.method,ocrConfidence:page.confidence,page:ref.recordedPage||null,sourcePage:page.page,source:doc.url+'#page='+page.page,purpose:'Reference extracted from public original; identity and applicability unverified',state:'original_access_unresolved',orderUrl:'https://www.webercountyutah.gov/forms/document/',reason:'Exact original image URL has not been resolved'});
    }
    doc.state=r.nextPage?'partially_read':'pages_processed';onProgress(doc);
    if(!r.nextPage)break;cursor=r.nextPage;
   }catch(e){doc.state='reading_failed';doc.error=e.message;doc.nextPage=cursor;onProgress(doc);break;}
  }
  if(processed>=maxPages)break;
 }
 manifest.processing={pagesThisRun:processed,processedDocuments:manifest.documents.filter(d=>d.state==='pages_processed').length,pendingDocuments:manifest.documents.filter(d=>d.state!=='pages_processed').length,limit:maxPages};
 manifest.inventoryComplete=false;return manifest;
}
const api={drain};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OriginalDocuments=api;
})(typeof window!=='undefined'?window:globalThis);
