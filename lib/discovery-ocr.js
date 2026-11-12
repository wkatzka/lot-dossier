const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile);let compilation;
async function read(bytes,page,{platform=process.platform}={}){
 const root=path.join(os.tmpdir(),'cornerpin-discovery-ocr'),binary=path.join(root,'vision');fs.mkdirSync(root,{recursive:true});
 if(platform==='darwin'){
  if(!compilation)compilation=execute('swiftc',[path.join(__dirname,'../scripts/discovery-vision.swift'),'-o',binary],{timeout:60000});
  await compilation;
 }
 const dir=fs.mkdtempSync(path.join(root,'page-'));
 try{
  let png;
  if(bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))){
   const source=path.join(dir,'source.pdf'),prefix=path.join(dir,'render');fs.writeFileSync(source,bytes);
   await execute('pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-scale-to','3000','-png',source,prefix],{timeout:60000,maxBuffer:1e6});png=prefix+'.png';
  }else{png=path.join(dir,'image.png');await require('sharp')(bytes,{page:page-1,pages:1,limitInputPixels:180e6}).resize({width:7000,height:7000,fit:'inside',withoutEnlargement:true}).png().toFile(png);}
  // Only a completely white rendered page is closed as blank. Faint text or diagrams remain reviewable.
  const stats=await require('sharp')(png).removeAlpha().stats();
  if(stats.channels.every(c=>c.min===255&&c.max===255)){
   let safeBlank=true;
   if(bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))){
    const pdfjs=require('pdfjs-dist/legacy/build/pdf.js'),pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true}).promise;
    try{const p=await pdf.getPage(page),text=await p.getTextContent(),ops=await p.getOperatorList();const painting=new Set(Object.entries(pdfjs.OPS).filter(([name])=>/^(paint|fill$|eoFill$|fillStroke$|eoFillStroke$|stroke$|closeStroke$|closeFillStroke$|closeEOFillStroke$|shadingFill$)/i.test(name)).map(([,value])=>value));const textOps=new Set([pdfjs.OPS.showText,pdfjs.OPS.showSpacedText,pdfjs.OPS.nextLineShowText,pdfjs.OPS.nextLineSetSpacingShowText]);const visibleGlyphs=ops.fnArray.some((op,i)=>textOps.has(op)&&(ops.argsArray[i]||[]).flat(Infinity).some(g=>typeof g==='string'?!!g.trim():g&&typeof g==='object'&&g.isSpace!==true));safeBlank=!text.items.some(x=>x.str?.trim())&&!visibleGlyphs&&!ops.fnArray.some(x=>painting.has(x));}finally{await pdf.destroy();}
   }
   if(safeBlank)return {pages:[{page,text:'',method:'rendered_blank_page',blank:true,confidence:100,needsReview:false}]};
  }
  if(platform!=='darwin'){
   // Poppler handles large GIS/vector PDFs outside the serverless reader's constrained PDF renderer.
   const raster=await require('sharp')(png).tiff().toBuffer(),result=await require('./original-reader').execute(raster,1,1);
   return {...result,pages:result.pages.map(p=>({...p,page,method:'poppler_full_page_ocr'}))};
  }
  const {stdout}=await execute(binary,[png],{timeout:60000,maxBuffer:4e6});const rows=JSON.parse(stdout);
  return {pages:[{page,text:rows.map(r=>r.text).join('\n'),method:'apple_vision_ocr',confidence:rows.length?100*rows.reduce((n,r)=>n+r.confidence,0)/rows.length:0,needsReview:true}]};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={read};
