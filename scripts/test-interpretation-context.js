const assert=require('node:assert/strict'),C=require('../lib/interpretation-context');
const pages=Array.from({length:110},(_,i)=>({page:i+1,text:'Ordinary document content '+(i+1)}));
for(let i=20;i<45;i++)pages[i].text='Exhibit B\nAssessment table';
pages[4].text='Association means and refers to Example Ridge Association.';
pages[86].text='IN WITNESS WHEREOF, executed on the ____ day of _____, 2018. By: ____';
pages[87].text='Exhibit A\nLegal Description\nThe real property subject to this declaration includes Example Ridge Phase 4.';
const context=C.select(pages);assert(context.some(p=>p.page===87));assert(context.some(p=>p.page===88));assert(context.some(p=>p.page===5));assert(context.some(p=>p.page===1));assert(context.length<=12);assert.deepEqual(context.map(p=>p.page),[1,2,5,87,88]);assert(context.every(p=>p.text===pages[p.page-1].text));assert(C.select(pages,{maxChars:60}).reduce((n,p)=>n+p.text.length,0)<=60);
console.log('PASS: long-document chunks retain verbatim late execution and scope exhibits plus definitions, within bounded context.');
