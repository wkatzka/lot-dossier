// Bounded, sequential title-block zooms: small sheet lettering otherwise gets lost in whole-PDF vision.
async function titleBlockDetails(bytes){
 const canvas=require('@napi-rs/canvas');global.DOMMatrix=global.DOMMatrix||canvas.DOMMatrix;global.Path2D=global.Path2D||canvas.Path2D;
 const pdf=require('pdfjs-dist/legacy/build/pdf');pdf.GlobalWorkerOptions.workerSrc=require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
 const factory={create:(w,h)=>{const c=canvas.createCanvas(w,h);return{canvas:c,context:c.getContext('2d')};},reset:(x,w,h)=>{x.canvas.width=w;x.canvas.height=h;},destroy:x=>{x.canvas.width=0;x.canvas.height=0;}};
 const doc=await pdf.getDocument({data:new Uint8Array(bytes),canvasFactory:factory,isEvalSupported:false,verbosity:0}).promise;
 try{
  const page=await doc.getPage(1),base=page.getViewport({scale:1}),v=page.getViewport({scale:2400/Math.max(base.width,base.height)}),sheet=canvas.createCanvas(Math.ceil(v.width),Math.ceil(v.height));
  await page.render({canvasContext:sheet.getContext('2d'),viewport:v,canvasFactory:factory}).promise;
  const result=[];
  for(const region of [{name:'right edge (rotated clockwise for vertical title lettering)',x:.8,y:0,w:.2,h:1,rotate:true},{name:'bottom edge',x:0,y:.8,w:1,h:.2}]){
   const w=Math.round(sheet.width*region.w),h=Math.round(sheet.height*region.h),out=canvas.createCanvas(region.rotate?h:w,region.rotate?w:h),ctx=out.getContext('2d');
   if(region.rotate){ctx.translate(h,0);ctx.rotate(Math.PI/2);}
   ctx.drawImage(sheet,Math.round(sheet.width*region.x),Math.round(sheet.height*region.y),w,h,0,0,w,h);
   result.push({page:1,region:region.name,image:out.toBuffer('image/png').toString('base64')});
  }
  page.cleanup();return result;
 }finally{await doc.destroy();}
}
module.exports={titleBlockDetails};
