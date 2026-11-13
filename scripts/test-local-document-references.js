const assert=require('node:assert/strict'),{resolve}=require('../lib/local-document-references');
const source='https://example.org/original.pdf',ref={identifier:'Article 6',source,page:11,quote:'under Article 6'},text='ARTICLE 6 – AESTHETICS AND ARCHITECTURAL STANDARDS\n'+ 'substantive clause '.repeat(60);
const run=pages=>resolve({sha256:'a'.repeat(64),missingDocuments:[{...ref},{...ref,identifier:'Article 6 of the Master Declaration'},{...ref,identifier:'Entry No. 2099635'}]},pages);
const found=run([{page:30,text}]);assert.equal(found.missingDocuments.length,2);assert.equal(found.resolvedReferences[0].resolvedPage,30);
for(const p of [{page:3,text:'Table of Contents\n'+text},{page:30,text,needsOCR:true},{page:30,text:text.replace('ARTICLE 6','ARTICLE 60')},{page:30,text:'The document refers to '+text}])assert.equal(run([p]).missingDocuments.length,3);
console.log('PASS: same-original substantive article headings resolve internal references; external instruments, TOCs, partial matches and unread text do not.');
