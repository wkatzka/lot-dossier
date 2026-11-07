/* Retain CAD-layer paths in PDF page coordinates; never infer survey registration. */
const pdf=require('pdfjs-dist/legacy/build/pdf');
pdf.GlobalWorkerOptions.workerSrc=require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
const LAYERS=/^(?:S-(?:LOT|BOUNDARY|EASEMENT|MONUMENT|SECTION|TIE)|H-EASEMENT)$/i;
async function extract(buf,{maxPages=8,maxPaths=4000,deadline=Date.now()+20000}={}){
 const doc=await pdf.getDocument({data:new Uint8Array(buf),isEvalSupported:false,disableFontFace:true,verbosity:0}).promise,config=await doc.getOptionalContentConfig(),groups=config.getGroups()||{},pages=[];let count=0,commandCount=0,truncated=false;
 try{for(let number=1;number<=Math.min(doc.numPages,maxPages);number++){
  if(Date.now()>deadline){truncated=true;break;}
  const page=await doc.getPage(number),ops=await page.getOperatorList(),text=await page.getTextContent(),paths=[],stack=[],layers=[];let matrix=[1,0,0,1,0,0],pending=[];
  const point=(x,y)=>pdf.Util.applyTransform([x,y],matrix).map(v=>Math.round(v*10000)/10000);
  for(let i=0;i<ops.fnArray.length;i++){
   const op=ops.fnArray[i],a=ops.argsArray[i];
   if(op===pdf.OPS.save)stack.push(matrix.slice());else if(op===pdf.OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
   else if(op===pdf.OPS.transform)matrix=pdf.Util.transform(matrix,a);
   else if(op===pdf.OPS.beginMarkedContentProps)layers.push(a[1]?.id?groups[a[1].id]?.name:null);
   else if(op===pdf.OPS.beginMarkedContent)layers.push(null);
   else if(op===pdf.OPS.endMarkedContent)layers.pop();
   else if(op===pdf.OPS.constructPath){
    const layer=layers.slice().reverse().find(Boolean);if(!LAYERS.test(layer||'')){pending=[];continue;}
    let j=0;const commands=[];
    for(const code of a[0]){
     if(++commandCount>150000){truncated=true;break;}
     const xy=()=>point(a[1][j++],a[1][j++]);
     if(code===pdf.OPS.moveTo)commands.push(['M',...xy()]);
     else if(code===pdf.OPS.lineTo)commands.push(['L',...xy()]);
     else if(code===pdf.OPS.curveTo)commands.push(['C',...xy(),...xy(),...xy()]);
     else if(code===pdf.OPS.curveTo2)commands.push(['V',...xy(),...xy()]);
     else if(code===pdf.OPS.curveTo3)commands.push(['Y',...xy(),...xy()]);
     else if(code===pdf.OPS.closePath)commands.push(['Z']);
     else if(code===pdf.OPS.rectangle){const x=a[1][j++],y=a[1][j++],w=a[1][j++],h=a[1][j++];commands.push(['M',...point(x,y)],['L',...point(x+w,y)],['L',...point(x+w,y+h)],['L',...point(x,y+h)],['Z']);}
     else{truncated=true;break;}
    }
    pending.push({layer,commands});
   }else if([pdf.OPS.stroke,pdf.OPS.closeStroke,pdf.OPS.fillStroke,pdf.OPS.eoFillStroke,pdf.OPS.closeFillStroke,pdf.OPS.closeEOFillStroke,pdf.OPS.fill,pdf.OPS.eoFill].includes(op)){
    for(const path of pending){if(count>=maxPaths){truncated=true;break;}paths.push({...path,paint:op,fill:[pdf.OPS.fill,pdf.OPS.eoFill,pdf.OPS.fillStroke,pdf.OPS.eoFillStroke,pdf.OPS.closeFillStroke,pdf.OPS.closeEOFillStroke].includes(op),stroke:[pdf.OPS.stroke,pdf.OPS.closeStroke,pdf.OPS.fillStroke,pdf.OPS.eoFillStroke,pdf.OPS.closeFillStroke,pdf.OPS.closeEOFillStroke].includes(op),sourcePage:number});count++;}pending=[];
   }else if(op===pdf.OPS.endPath)pending=[];
  }
  pages.push({page:number,view:page.view,paths,labels:text.items.slice(0,20000).filter(t=>/\b(?:LOT\s*\d+|CORNER|MONUMENT|BASIS|NAD|EASEMENT)\b/i.test(t.str)).map(t=>({text:t.str,position:[t.transform[4],t.transform[5]]}))});
  if(count>=maxPaths||commandCount>150000){truncated=true;break;}
 }
 return {schemaVersion:1,coordinateSystem:'PDF page coordinates in points; not ground coordinates',registered:false,sourceLayerNames:[...new Set(Object.values(groups).map(g=>g.name).filter(n=>LAYERS.test(n)))],pages,pathsRead:count,truncated:truncated||pages.length<doc.numPages,limitation:'Original CAD layer labels preserved. Page clipping, linework topology, curve interpretation, ground control and current legal applicability require reconciliation before siting.'};
 }finally{await doc.destroy();}
}
module.exports={extract};
