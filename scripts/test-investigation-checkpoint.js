const assert=require('node:assert/strict'),C=require('../lib/investigation-checkpoint');
const a={route:'notices',keyword:'Example',startDate:'2000-01-01',endDate:'2026-01-01',checks:[{startDate:'2000-01-01',endDate:'2026-01-01',count:25}],results:[{id:'1',url:'https://example.org/1'}]};
const b={...a,checks:[...a.checks,{startDate:'2000-01-01',endDate:'2013-01-01',count:1}],results:[...a.results,{id:'2',url:'https://example.org/2'}]};
const retry={...a,checks:[{...a.checks[0],count:2}],results:[{id:'3'}]};const raw={url:'https://example.org/search',term:'Example',page:1,rows:[{id:3}]};
const state={queries:[a,raw,b,retry]};assert.equal(C.compact(state),1);assert.deepEqual(state.queries,[raw,b,retry]);assert.equal(C.compact(state),0);assert.equal(state.queries[1].checks.length,2);assert.equal(state.queries[1].results.length,2);
console.log('PASS: cumulative pagination snapshots compact without losing range counts or result IDs; independent query receipts and retries remain.');
