/* One resumable OCR worker by default. Existing native/Tesseract readings are reused. */
process.env.OMP_THREAD_LIMIT='1';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp'),{createWorker}=require('tesseract.js');
sharp.concurrency(1);
const [manifestPath,out]=process.argv.slice(2);
if(!manifestPath||!out)throw Error('Usage: node research/title/read-abstracts.cjs survey-response.json output-directory');
const manifest=JSON.parse(fs.readFileSync(manifestPath)),sections=manifest.historicAbstracts.sections;
const items=sections.flatMap(s=>s.documents.map(d=>({...d,location:s.location})));
fs.mkdirSync(out,{recursive:true});
const lock=path.join(out,'.ocr.lock');
try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}catch{throw Error('An OCR lock exists. Check the recorded process before removing a stale lock; do not start a duplicate batch.');}
const unlock=()=>{try{if(fs.readFileSync(lock,'utf8')===String(process.pid))fs.unlinkSync(lock);}catch{}};
process.on('exit',unlock);process.on('SIGTERM',()=>process.exit(143));process.on('SIGINT',()=>process.exit(130));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');let next=0,done=0;const results=[];
async function fetchOriginal(url){
 const u=new URL(url);
 if(u.protocol!=='https:'||u.hostname!=='webercountyutah.gov'||!decodeURIComponent(u.pathname).startsWith('/mounts/recorder/Published Data/Abstract/')||!/[.]tif$/i.test(u.pathname))throw Error('Not an allowed county abstract image');
 const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),60000);
 try{const r=await fetch(url,{signal:ctl.signal,redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);let size=0,chunks=[];for await(const c of r.body){size+=c.length;if(size>30e6)throw Error('Image exceeds 30MB');chunks.push(c);}return Buffer.concat(chunks);}finally{clearTimeout(t);}
}
async function work(){
 let worker;
 try{while(next<items.length){
  const item=items[next++],id=hash(item.url).slice(0,20),base=path.join(out,id);let result;
  try{
   if(fs.existsSync(base+'.json'))result=JSON.parse(fs.readFileSync(base+'.json'));
   else if(fs.existsSync(base+'.vision.json'))result={...item,id,readStatus:'existing_native_reading',reviewed:false};
   else{
    const bytes=fs.existsSync(base+'.tif')?fs.readFileSync(base+'.tif'):await fetchOriginal(item.url);fs.writeFileSync(base+'.tif',bytes);
    if(!worker){worker=await createWorker('eng',1,{logger:()=>{},cachePath:out});await worker.setParameters({tessedit_pageseg_mode:'11'});}
    const png=await sharp(bytes,{limitInputPixels:150e6}).resize({width:4400,withoutEnlargement:true}).greyscale().png().toBuffer(),meta=await sharp(png).metadata();
    const {data}=await worker.recognize(png,{}, {text:true,blocks:true});
    result={...item,id,sha256:hash(bytes),retrievedAt:new Date().toISOString(),originalBytes:bytes.length,width:meta.width,height:meta.height,text:data.text,confidence:data.confidence,words:(data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words.map(w=>({text:w.text,confidence:w.confidence,bbox:w.bbox}))))),readStatus:'ocr_unverified',reviewed:false};
    fs.writeFileSync(base+'.json',JSON.stringify(result));fs.writeFileSync(base+'.txt',data.text);
   }
  }catch(e){result={...item,id,error:e.message,readStatus:'failed'};}
  results.push(result);done++;fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({total:items.length,done,failed:results.filter(r=>r.error).length}));console.log(done+'/'+items.length,item.location.section,item.name,result.error||result.readStatus);
 }}finally{if(worker)await worker.terminate();}
}
(async()=>{try{await Promise.all(Array.from({length:Math.min(2,Math.max(1,Number(process.env.ABSTRACT_WORKERS)||1))},()=>work()));fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify({total:items.length,results},null,2));console.log('Finished',results.length,'sheets');}finally{unlock();}})();
