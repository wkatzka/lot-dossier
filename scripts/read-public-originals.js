/* Low-CPU batch runner for any saved public-research response/manifest. No paid providers. */
const fs=require('node:fs'),{read}=require('../lib/original-reader'),{drain}=require('../web/original-documents');
(async()=>{
 const path=process.argv[2];if(!path)throw Error('Usage: node scripts/read-public-originals.js <research-json> [page-budget]');
 const data=JSON.parse(fs.readFileSync(path)),manifest=data.titleResearch?.acquisition||data.acquisition||data;
 if(!Array.isArray(manifest.documents)||!Array.isArray(manifest.requests))throw Error('A discovered acquisition manifest is required');
 const maxPages=Number(process.argv[3]||100);if(!Number.isInteger(maxPages)||maxPages<1||maxPages>1000)throw Error('Page budget must be 1–1000');
 const save=()=>{fs.writeFileSync(path+'.tmp',JSON.stringify(data,null,2));fs.renameSync(path+'.tmp',path);};
 await drain(manifest,(url,page)=>read(url,page),{maxPages,onProgress:doc=>{save();console.log(doc.label+': '+doc.state+'; next page '+(doc.nextPage||'none'));}});save();
 console.log(JSON.stringify(manifest.processing));if(manifest.processing.pendingDocuments)process.exitCode=2;
})().catch(e=>{console.error(e.message);process.exitCode=1});
