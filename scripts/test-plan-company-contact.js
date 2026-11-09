const assert=require('node:assert/strict'),P=require('../lib/plan-company-contact');
(async()=>{
for(const ip of ['127.0.0.1','10.1.1.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','224.0.0.1','::1'])assert(!P.publicIPv4(ip));assert(P.publicIPv4('8.8.8.8'));
const facts=[{field:'design_professional',value:'Example Designs',page:1},{field:'design_professional_phone',value:'555-123-4567',page:1}],pages=[{n:1,text:'Example Designs www.example.com 555-123-4567'}];let calls=0;
const read=async url=>{calls++;return{url,html:url.includes('/contact')?'Example Designs 555-123-4567 <a href="mailto:office@example.com">office@example.com</a>':'Example Designs <a href="/contact">Contact</a>'};};
const r=await P.enrich(pages,facts,{id:'doc',hash:'hash',name:'Plans.pdf'},{read});assert.equal(r[0].value,'office@example.com');assert.equal(r[0].sourceURL,'https://example.com/contact');assert.equal(calls,2);
assert.equal((await P.enrich(pages,facts,{}, {read:async url=>({url,html:'Other Company 555-123-4567 office@example.com'})})).length,0);
assert.equal((await P.enrich(pages,facts,{}, {read:async url=>({url,html:'Example Designs 999-111-2222 office@example.com'})})).length,0);
assert.equal((await P.enrich([{n:1,text:'www.example.com www.other.com'}],facts,{}, {read})).length,0);
const mail='info@example.com',key=42,hex=Buffer.from([key,...Buffer.from(mail)].map((v,i)=>i?v^key:v)).toString('hex');assert.deepEqual(P.emails('<span data-cfemail="'+hex+'"></span>','example.com'),[mail]);
console.log('PASS: plan-listed domain only, firm/phone match, bounded contact discovery, email decoding, ambiguous domains and nonpublic address rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
