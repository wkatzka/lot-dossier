const assert=require('node:assert/strict'),P=require('pdf-lib');
const {prepare}=require('../lib/reading-copy');
async function fixture(width,height,filter='CCITTFaxDecode',bits=1){
 const doc=await P.PDFDocument.create(),page=doc.addPage();
 const stream=doc.context.stream(new Uint8Array([0]),{Type:'XObject',Subtype:'Image',Width:width,Height:height,BitsPerComponent:bits,ColorSpace:'DeviceGray',Filter:filter});
 page.node.set(P.PDFName.of('Resources'),doc.context.obj({XObject:{Scan:doc.context.register(stream)}}));
 return doc.save();
}
(async()=>{
 const a=await prepare(await fixture(5104,6600),1,1);assert.equal(a.notes.length,1);assert.match(a.notes[0].method,/CCITT/);
 for(const args of [[7000,7000],[26000,1000],[5104,6600,'DCTDecode'],[5104,6600,'CCITTFaxDecode',8]])await assert.rejects(()=>fixture(...args).then(b=>prepare(b,1,1)),/bounded decoder/);
 console.log('Reading-copy bounds passed: one-bit fax scans admitted, oversized/other encodings rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});
