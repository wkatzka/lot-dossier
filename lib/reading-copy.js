/* Temporary rendering copy only: preserve page composition while bounding huge 1-bit scan masks. */
const P=require('pdf-lib'),z=require('node:zlib');
function reduceMask(data,w,h,ink=0,max=9000){
 const scale=Math.min(1,max/Math.max(w,h)),nw=Math.ceil(w*scale),nh=Math.ceil(h*scale),stride=Math.ceil(w/8),ns=Math.ceil(nw/8),out=Buffer.alloc(ns*nh,ink===0?255:0);
 if(data.length<stride*h)throw Error('Scan mask bytes do not reconcile with image dimensions');
 for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){
  const x0=Math.floor(x*w/nw),x1=Math.floor((x+1)*w/nw),y0=Math.floor(y*h/nh),y1=Math.floor((y+1)*h/nh);let hit=false;
  for(let sy=y0;sy<y1&&!hit;sy++)for(let sx=x0;sx<x1;sx++)if(((data[sy*stride+(sx>>3)]>>(7-(sx&7)))&1)===ink){hit=true;break;}
  if(hit){const mask=1<<(7-(x&7)),i=y*ns+(x>>3);if(ink)out[i]|=mask;else out[i]&=255^mask;}
 }
 return {data:out,width:nw,height:nh};
}
async function prepare(bytes,start,limit){
 const source=await P.PDFDocument.load(bytes,{updateMetadata:false}),totalPages=source.getPageCount();
 if(start<1||start>totalPages)throw Error('Page cursor outside source document');
 const doc=await P.PDFDocument.create();for(const p of await doc.copyPages(source,Array.from({length:Math.min(limit,totalPages-start+1)},(_,i)=>start-1+i)))doc.addPage(p);
 const notes=[];
 for(const [ref,obj]of doc.context.enumerateIndirectObjects()){
  if(!(obj instanceof P.PDFRawStream)||obj.dict.get(P.PDFName.of('Subtype'))!==P.PDFName.of('Image'))continue;
  const value=k=>obj.dict.lookup(P.PDFName.of(k)),w=value('Width')?.asNumber(),h=value('Height')?.asNumber();
  if(!(w*h>25e6))continue;
  // Fax scans decode to one bit per pixel. Permit this bounded class through
  // pdf.js's CCITT decoder; keep the render canvas and worker limits unchanged.
  if(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w*h<=40e6&&w<=10000&&h<=10000&&value('BitsPerComponent')?.asNumber()===1&&value('Filter')===P.PDFName.of('CCITTFaxDecode')&&value('ColorSpace')===P.PDFName.of('DeviceGray')&&value('ImageMask')!==P.PDFBool.True){
   notes.push({originalPixels:[w,h],readingPixels:[w,h],method:'Bounded one-bit CCITT grayscale decoding; original retained unchanged at source'});
   continue;
  }
  if(w*h>400e6||value('ImageMask')!==P.PDFBool.True||value('BitsPerComponent')?.asNumber()!==1||value('Filter')!==P.PDFName.of('FlateDecode')||value('DecodeParms'))throw Error('Oversized scan encoding needs a bounded decoder; source has not been fully read');
  const decode=value('Decode'),ink=decode instanceof P.PDFArray&&decode.get(0)?.asNumber()===1?1:0;
  const unpacked=z.inflateSync(obj.contents,{maxOutputLength:64*1024*1024}),reduced=reduceMask(unpacked,w,h,ink);
  const dict=obj.dict.clone(doc.context);dict.set(P.PDFName.of('Width'),P.PDFNumber.of(reduced.width));dict.set(P.PDFName.of('Height'),P.PDFNumber.of(reduced.height));dict.delete(P.PDFName.of('Length'));
  doc.context.assign(ref,P.PDFRawStream.of(dict,z.deflateSync(reduced.data)));
  notes.push({trailingDecodedBytes:unpacked.length-Math.ceil(w/8)*h,originalPixels:[w,h],readingPixels:[reduced.width,reduced.height],method:'Ink-preserving mask reduction in temporary copy; original retained unchanged at source'});
 }
 return {bytes:await doc.save({useObjectStreams:false}),totalPages,notes};
}
module.exports={reduceMask,prepare};
