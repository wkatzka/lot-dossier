/* Isolated full-page reading; parent can terminate expensive rendering. One OCR worker only. */
const {parentPort,workerData}=require('node:worker_threads');
const sharp=require('sharp');sharp.concurrency(1);
const {candidates}=require('./instrument-claims');
function references(text,page){const out=[];for(const m of text.matchAll(/\bENTRY\s*(?:NO\.?|NUMBER|#)?\s*((?:\d{5,9})(?:\s*[,;&]\s*\d{5,9})*)/gi))for(const entry of m[1].match(/\d{5,9}/g)||[])out.push({entry,page,excerpt:text.slice(Math.max(0,m.index-65),m.index+m[0].length+65),state:'original_access_unresolved'});return out;}
(async()=>{
 const buf=Buffer.from(workerData.bytes),start=workerData.start,limit=workerData.limit;
 let doc,ocr,total,kind,result,pages=[];
 try{
  if(buf.subarray(0,1024).includes(Buffer.from('%PDF-'))){
   kind='pdf';const canvas=require('@napi-rs/canvas');global.DOMMatrix=canvas.DOMMatrix;global.Path2D=canvas.Path2D;global.ImageData=canvas.ImageData;
   const pdf=require('pdfjs-dist/legacy/build/pdf.js');pdf.GlobalWorkerOptions.workerSrc=require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
   const canvasFactory={create(w,h){const c=canvas.createCanvas(Math.ceil(w),Math.ceil(h));return {canvas:c,context:c.getContext('2d')};},reset(o,w,h){o.canvas.width=Math.ceil(w);o.canvas.height=Math.ceil(h);},destroy(o){o.canvas.width=0;o.canvas.height=0;o.canvas=null;o.context=null;}};
   doc=await pdf.getDocument({canvasFactory,data:new Uint8Array(buf),isEvalSupported:false,disableFontFace:true,verbosity:0}).promise;total=doc.numPages;
  }else if(['49492a00','4d4d002a','49492b00','4d4d002b'].includes(buf.subarray(0,4).toString('hex'))){kind='tiff';total=(await sharp(buf,{limitInputPixels:180e6}).metadata()).pages||1;}
  else throw Error('Source returned neither a PDF nor a TIFF; login/error pages are not documents');
  if(start<1||start>total)throw Error('Page cursor outside source document');
  for(let n=start;n<=Math.min(total,start+limit-1);n++){
   let text='',method='native_text',confidence=null,page,scan=false;
   if(doc){page=await doc.getPage(n);const tc=await page.getTextContent();text=tc.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
    const ops=await page.getOperatorList(),lib=require('pdfjs-dist/legacy/build/pdf.js');
    for(let j=0;j<ops.fnArray.length;j++){
     if(ops.fnArray[j]===lib.OPS.paintImageXObject){const img=await new Promise(resolve=>page.objs.get(ops.argsArray[j][0],resolve));if(img&&img.width*img.height>200000)scan=true;}
     if(ops.fnArray[j]===lib.OPS.paintInlineImageXObject){const img=ops.argsArray[j][0];if(img?.width*img.height>200000)scan=true;}
    }
   }
   // A short header is not sufficient evidence that the scanned body has been read.
   if(scan||text.replace(/\s/g,'').length<1000){
    let png;
    if(doc){const {createCanvas}=require('@napi-rs/canvas'),base=page.getViewport({scale:1}),scale=Math.min(3,3600/Math.max(base.width,base.height)),vp=page.getViewport({scale});
     const canvas=createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;png=canvas.toBuffer('image/png');
    }else png=await sharp(buf,{page:n-1,pages:1,limitInputPixels:180e6}).resize({width:3600,height:3600,fit:'inside',withoutEnlargement:true}).greyscale().png().toBuffer();
    if(!ocr){require('node:fs').mkdirSync('/tmp/tessdata',{recursive:true});ocr=await require('tesseract.js').createWorker('eng',1,{cachePath:'/tmp/tessdata',logger:()=>{}});}
    const r=await ocr.recognize(png);text=r.data.text;confidence=r.data.confidence;method='full_page_ocr';
   }
   const truncated=text.length>60000;text=text.slice(0,60000);
   const refs=references(text,n);
   for(const m of text.matchAll(/\b(?:BOOK|BK\.?)\s+([A-Z]|\d{1,5})\s*[,;:]?\s*(?:AT\s+)?(?:PAGE|PG\.?)\s+(\d{1,5})\b/gi))refs.push({book:m[1].toUpperCase(),recordedPage:m[2],page:n,state:'original_access_unresolved',excerpt:m[0]});
   for(const m of text.matchAll(/\((\d{1,8})\s+WCS\)/gi))refs.push({surveyNumber:m[1],page:n,state:'public_survey_reference',excerpt:m[0]});
   const facts=candidates([text]);pages.push({page:n,text,method,confidence,needsReview:method!=='native_text'||truncated||!text.trim(),truncated,references:refs,claims:facts.claims.map(c=>({...c,page:n})),claimsTruncated:facts.truncated});
   if(page)page.cleanup();
  }
  result={totalPages:total,format:kind,pages,nextPage:start+pages.length<=total?start+pages.length:null,legalApplicability:'unverified',ownershipDetermined:false};
 }finally{if(ocr)await ocr.terminate();if(doc)await doc.destroy();}
 parentPort.postMessage(result);
})().catch(e=>parentPort.postMessage({error:e.message}));
