const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PDFDocument,PDFName,PDFString}=require('pdf-lib'),D=require('../lib/record-discovery-engine');
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-link-test-'));
try {const pdf=await PDFDocument.create(),page=pdf.addPage();page.drawText('Public meeting packet: open attached original');
page.node.set(PDFName.of('Annots'),pdf.context.obj(['https://example.org/1357583.pdf','https://unreviewed.example/record.pdf','javascript:alert(1)'].map(url=>pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[0,0,100,50],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}})))));
const bytes=Buffer.from(await pdf.save()),file=path.join(root,'wrapper.pdf');fs.writeFileSync(file,bytes);const pages=await D.readPdf(file);assert(pages[0].documentLinks.includes('https://example.org/1357583.pdf'));assert(!pages[0].documentLinks.some(u=>u.startsWith('javascript:')));
const profile={id:'pdf-links',scope:'test',hosts:['example.org'],routes:['planning'],terms:['Cobabe'],seeds:[]},s=D.create(profile),j=D.add(s,{kind:'page',route:'planning',url:'https://example.org/wrapper.pdf'});
await D.processJob(s,profile,j,root,{fetch:async url=>({url,status:200,type:'application/pdf',bytes})});assert(s.jobs.some(j=>j.url==='https://example.org/1357583.pdf'));assert(!s.jobs.some(j=>j.url.includes('unreviewed.example')));assert(!D.summarize(s,profile).publicRouteChecksComplete);console.log('PASS: real PDF annotations discover numeric attachment URLs; reviewed-host boundaries remain enforced; linked work prevents false route completion.');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
