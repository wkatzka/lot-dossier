/* Sequential, resumable acquisition. Saved manifests retain exact page cursors and source hashes. */
(function(root){
'use strict';
async function drain(manifest,fetchPage,{maxPages=100,onProgress=()=>{}}={}){
 let processed=0;
 documents: for(const doc of manifest.documents||[]){
  doc.pages=doc.pages||[];
  if(doc.pages.some((p,i)=>p.page!==i+1)||((doc.nextPage||doc.pages.length+1)!==doc.pages.length+1)){
   doc.state='reading_failed';doc.error='Saved page coverage has a gap; refresh this source before continuing';onProgress(doc);continue;
  }
  if(doc.state==='pages_processed'&&doc.pages.length===doc.totalPages&&doc.pages.length>0)continue;
  let cursor=doc.nextPage||doc.pages.length+1,changes=0;
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
     const known=ref.publicOriginal;
     if(known&&!manifest.documents.some(d=>d.url===known.url)&&manifest.documents.length<500)manifest.documents.push({id:'entry-'+ref.entry,url:known.url,label:known.label,kind:'recorded_instrument',state:'queued',matchBasis:['Recording reference on '+doc.label+' page '+page.page+'; identity and applicability unverified'],discoverySources:[doc.url+'#page='+page.page],applicability:'unverified',sourceCoverage:known.sourceCoverage,catalogueSha256:known.catalogueSha256});
     let request=(manifest.requests||[]).find(x=>x.key===key);
     if(!request){request={...ref,key,discoveredByDoc:doc.id,sourceSha256:r.sha256,extractionMethod:page.method,ocrConfidence:page.confidence,page:ref.recordedPage||null,sourcePage:page.page,source:doc.url+'#page='+page.page,purpose:'Reference extracted from public original; identity and applicability unverified',state:'original_access_unresolved',reason:'Public discovery is incomplete; absence of a resolved URL is not evidence of restricted access.'};manifest.requests.push(request);}
     if(known){request.publicUrl=known.url;request.state=known.sourceCoverage.completeCopy?'public_copy_located':'incomplete_public_copy';request.reason=known.sourceCoverage.completeCopy?'Public original located; reading and applicability remain unverified.':'Incomplete public copy; continue searching for missing recorded pages.';delete request.orderUrl;}
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
