const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile);let compilation;
async function read(bytes,page){
 if(process.platform!=='darwin')return require('./original-reader').execute(bytes,page,1);
 const root=path.join(os.tmpdir(),'cornerpin-discovery-ocr'),binary=path.join(root,'vision');fs.mkdirSync(root,{recursive:true});
 if(!compilation)compilation=execute('swiftc',[path.join(__dirname,'../scripts/discovery-vision.swift'),'-o',binary],{timeout:60000});
 await compilation;const dir=fs.mkdtempSync(path.join(root,'page-'));
 try{
  let png;
  if(bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))){
   const source=path.join(dir,'source.pdf'),prefix=path.join(dir,'render');fs.writeFileSync(source,bytes);
   await execute('pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-scale-to','3000','-png',source,prefix],{timeout:60000,maxBuffer:1e6});png=prefix+'.png';
  }else{png=path.join(dir,'image.png');await require('sharp')(bytes,{page:page-1,pages:1,limitInputPixels:180e6}).resize({width:7000,height:7000,fit:'inside',withoutEnlargement:true}).png().toFile(png);}
  const {stdout}=await execute(binary,[png],{timeout:60000,maxBuffer:4e6});const rows=JSON.parse(stdout);
  return {pages:[{page,text:rows.map(r=>r.text).join('\n'),method:'apple_vision_ocr',confidence:rows.length?100*rows.reduce((n,r)=>n+r.confidence,0)/rows.length:0,needsReview:true}]};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={read};
