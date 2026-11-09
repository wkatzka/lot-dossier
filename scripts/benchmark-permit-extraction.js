// Explicit opt-in real-document benchmark. Outputs may contain private plan facts.
// ANTHROPIC_API_KEY=... node scripts/benchmark-permit-extraction.js input.pdf /private/path/result.json
const fs=require('node:fs'),crypto=require('node:crypto'),X=require('../lib/permit-extraction'),F=require('../web/permit-facts');
(async()=>{
 const [input,output]=process.argv.slice(2);if(!input||!output||!process.env.ANTHROPIC_API_KEY)throw Error('Supply input PDF, private output path, and ANTHROPIC_API_KEY environment variable.');
 const bytes=fs.readFileSync(input);if(bytes.length>25*1024*1024)throw Error('PDF exceeds production 25 MB limit');
 const document={id:'cp-benchmark',name:'Benchmark document',hash:crypto.createHash('sha256').update(bytes).digest('hex')},pages=await X.pagesFromPDF(bytes),direct=F.extract(pages,document);
 const ai=await X.runClaude(pages,document,Object.keys(F.fields),{pdfBuffer:bytes});
 const facts=F.reconcile([...direct,...ai.facts].map(f=>({...f,sourceConflict:ai.rejected.some(r=>r.field===f.field)})));
 const result={version:X.VERSION,pages:pages.length,direct,facts,rejected:ai.rejected,usage:ai.usage,estimatedUSD:ai.model==='claude-sonnet-5-5'?((ai.usage.input_tokens||0)*2+(ai.usage.output_tokens||0)*10)/1e6:null};
 fs.writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({pages:result.pages,fields:[...new Set(facts.map(f=>f.field))],conflicts:[...new Set(facts.filter(f=>f.conflict).map(f=>f.field))],rejected:ai.rejected,estimatedUSD:result.estimatedUSD}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
