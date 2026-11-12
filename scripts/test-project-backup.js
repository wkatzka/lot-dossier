const assert=require('node:assert/strict'),B=require('../web/project-backup'),W=require('../web/permit-workflow');
(async()=>{
 const blob=new Blob(['sample original']),hash=await B.hash(await blob.arrayBuffer());let p=W.create({date:'2026-11-07',parcel:{county:'Example',id:'test',attrs:{PARCEL_ADD:'Synthetic backup test'}},facts:{},findings:[{section:'utilities',item:'Power',status:'verify'}]});p=W.apply(p,{type:'document',document:{id:'d',name:'Original',size:blob.size,hash}});
 p=W.apply(p,{type:'site_review',id:'utilities/Power',state:'resolved',reviewer:'Fixture',conclusion:'Service confirmed',scope:'Synthetic lot',basis:'Synthetic letter',documentId:'d',locator:'Page 1',confirmed:true});
 const b=await B.pack(p,async()=>blob),restored=await B.unpack(b);assert.equal(restored.files.length,1);assert.deepEqual(restored.project.siteReviews,p.siteReviews);assert.equal(require('../web/site-decisions').status(restored.project,restored.project.report.findings[0]).closed,true);assert.equal(await restored.files[0].blob.text(),'sample original');
 await assert.rejects(()=>B.pack(p,async()=>null),/Missing/);b.files[0].data=btoa('modified');await assert.rejects(()=>B.unpack(b),/checksum/);console.log('Complete backup roundtrip, missing-file detection and corruption detection passed.');
})();
