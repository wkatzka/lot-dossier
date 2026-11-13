const assert=require('node:assert/strict'),Q=require('../lib/native-text-quality');
assert.equal(Q.suspect('The Board requires written approval of building plans. '.repeat(40)),false);
assert.equal(Q.suspect('The fee is $50.00 and the estimated contract is $300,000. '.repeat(20)),false);
assert.equal(Q.suspect('The De*l*rati*n a$d Assoc*ati*n shall appro*e the pl*n. '.repeat(40)),true);
const c={state:{documents:[{sha256:'native',unreadPages:[]},{sha256:'ocr',unreadPages:[]}]},pageTexts:{native:{pages:[{page:1,text:'The De*l*rati*n a$d Assoc*ati*n shall appro*e the pl*n. '.repeat(40),needsOCR:false}]},ocr:{pages:[{page:1,text:'The De*l*rati*n a$d Assoc*ati*n shall appro*e the pl*n. '.repeat(40),method:'full_page_ocr'}]}},interpreted:{}};
assert.equal(Q.refresh(c),1);assert.deepEqual(c.state.documents[0].unreadPages,[1]);assert.equal(c.pageTexts.native.pages[0].needsOCR,true);assert.equal(Q.refresh(c),0);assert.deepEqual(c.state.documents[1].unreadPages,[]);
console.log('PASS: corrupt existing text layers are re-read from page images; ordinary currency and completed image OCR do not loop.');
