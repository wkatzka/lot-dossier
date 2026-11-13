/* Isolated high-resolution OCR of a page's top band, where county recorder stamps sit. */
const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
 try{
  const buf=Buffer.from(workerData.bytes),n=workerData.page,sharp=require('sharp');sharp.concurrency(1);let png;
  if(buf.subarray(0,1024).includes(Buffer.from('%PDF-'))){
   const canvas=require('@napi-rs/canvas');global.DOMMatrix=canvas.DOMMatrix;global.Path2D=canvas.Path2D;global.ImageData=canvas.ImageData;
   const pdf=require('pdfjs-dist/legacy/build/pdf.js');pdf.GlobalWorkerOptions.workerSrc=require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
   const factory={create(w,h){const c=canvas.createCanvas(Math.ceil(w),Math.ceil(h));return {canvas:c,context:c.getContext('2d')};},reset(o,w,h){o.canvas.width=Math.ceil(w);o.canvas.height=Math.ceil(h);},destroy(o){o.canvas.width=0;o.canvas.height=0;}};
   const doc=await pdf.getDocument({canvasFactory:factory,data:new Uint8Array(buf),isEvalSupported:false,disableFontFace:true,verbosity:0}).promise;
   const page=await doc.getPage(n),base=page.getViewport({scale:1}),scale=Math.min(5,5000/Math.max(base.width,base.height)),vp=page.getViewport({scale});
   const c=canvas.createCanvas(Math.ceil(vp.width),Math.ceil(vp.height));await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;png=c.toBuffer('image/png');
  }else png=await sharp(buf,{page:n-1,pages:1,limitInputPixels:180e6}).png().toBuffer();
  // Stamps usually sit top-right; reading that quarter alone keeps return-address columns
  // from interleaving with stamp lines. The full band is read too for left-side stamps.
  const meta=await sharp(png).metadata(),h=Math.round(meta.height*0.22),x=Math.round(meta.width*0.45);
  const regions=[{left:x,top:0,width:meta.width-x,height:h},{left:0,top:0,width:meta.width,height:h}];
  require('node:fs').mkdirSync('/tmp/tessdata',{recursive:true});
  const ocr=await require('tesseract.js').createWorker('eng',1,{cachePath:'/tmp/tessdata',logger:()=>{}});
  const reads=[];for(const r of regions){const band=await sharp(png).extract(r).greyscale().normalise().png().toBuffer();const o=await ocr.recognize(band);reads.push({text:o.data.text,confidence:o.data.confidence});}
  await ocr.terminate();
  parentPort.postMessage({text:reads.map(r=>r.text).join('\n----\n'),confidence:Math.round(reads[0].confidence),regions:reads.length});
 }catch(e){parentPort.postMessage({error:e.message});}
})();
