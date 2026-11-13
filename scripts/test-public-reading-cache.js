const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),C=require('../lib/public-reading-cache');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp-reading-test-')),file=path.join(dir,'public.pdf');fs.writeFileSync(file,'synthetic public source bytes');
 try{
 const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),pages=[{page:1,text:'Public original text retained across parcel investigations.',needsOCR:false,method:'full_page_ocr',confidence:93,documentLinks:['https://example.org/annex.pdf']}];
 const cached=await C.read(file,{rpc:async(action,payload)=>{assert.equal(action,'reading_get');assert.equal(payload.sha256,hash);return {sha256:hash,pages};},nativeRead:async()=>{throw Error('OCR must not repeat for matching source bytes');}});assert.equal(cached[0].method,'full_page_ocr');assert.equal(cached[0].documentLinks[0],'https://example.org/annex.pdf');
 for(const invalid of [{sha256:'wrong',pages},{sha256:hash,pages:[{...pages[0],needsOCR:true}]},{sha256:hash,pages:[{...pages[0],page:2}]}]){
 let native=false;await C.read(file,{rpc:async()=>invalid,nativeRead:async()=>{native=true;return pages;}});assert(native);
 }
 console.log('PASS: shared reading reuse is tied to independently fetched bytes; mismatched hashes, unread pages and incomplete page ranges cannot reuse OCR. Source links and OCR provenance survive.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
