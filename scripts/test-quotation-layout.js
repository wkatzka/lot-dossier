const assert=require('node:assert/strict'),L=require('../lib/quotation-layout');
const source='construction of a ny new Dwelling may not be commenced unless the Board has approved the plans.';
const quote=source.replace('a ny','any');assert.equal(L.restore(quote,source),source);
assert.equal(L.restore(quote.replace('may not','may'),source),null);assert.equal(L.restore(quote.replace('Board','ACC'),source),null);
assert.equal(L.restore('The fee is 100 dollars and must be paid.','The fee is 1 00 dollars and must be paid.'),null);
const c={pageTexts:{hash:{pages:[{page:31,text:source}]}},interpreted:{hash:true},interpretations:[{sha256:'hash',pagesRead:[31],rejected:['quote'],validationFailures:[{page:31,quote}]},{sha256:'other',pagesRead:[1],rejected:[]}]};L.refresh(c);assert.equal(c.interpretations.length,1);assert.equal(c.interpreted.hash,undefined);assert.equal(c.supersededInterpretations.length,1);L.refresh(c);assert.equal(c.supersededInterpretations.length,1);
const parsed={requirements:[{quote,page:31}]};const receipts=L.repair(parsed,[{page:31,text:source}]);assert.equal(parsed.requirements[0].quote,source);assert.equal(receipts[0].modelQuote,quote);
console.log('PASS: PDF whitespace restoration preserves source text; omitted words, altered authorities and joined numbers fail; only repairable failed chunks are re-read once.');
