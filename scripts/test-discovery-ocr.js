const assert=require('node:assert/strict'),{PDFDocument,rgb}=require('pdf-lib'),{read}=require('../lib/discovery-ocr');
(async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([612,792]);const text=pdf.addPage([612,792]);text.drawText('PERMIT REVIEW',{x:40,y:500,size:40});const faint=pdf.addPage([612,792]);faint.drawRectangle({x:40,y:40,width:100,height:100,color:rgb(254/255,254/255,254/255)});const bytes=Buffer.from(await pdf.save());
 const empty=(await read(bytes,1,{platform:'linux'})).pages[0];assert.equal(empty.blank,true);assert.equal(empty.page,1);
 const content=(await read(bytes,2,{platform:'linux'})).pages[0];// Missing substitute fonts must never turn a text page into a certified blank.
 assert.equal(content.page,2);assert.notEqual(content.blank,true);
 const graphic=(await read(bytes,3,{platform:'linux'})).pages[0];assert.notEqual(graphic.blank,true);
 console.log('PASS: hosted Poppler/OCR path preserves source page numbers, does not misclassify missing-font text, closes only empty exact-white pages and retains faint graphics.');
})().catch(e=>{console.error(e);process.exitCode=1;});
