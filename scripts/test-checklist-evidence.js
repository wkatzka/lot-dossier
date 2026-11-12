'use strict';
// Exercise the real legacy checklist store, delegated handlers and summary against DOM events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const {indexedDB} = require('fake-indexeddb');
const source = fs.readFileSync('web/app.js', 'utf8');
const code = source.slice(source.indexOf('  /* ---------------- checklist store:'), source.indexOf('  function drawMap('));
const key = 'Example|test|water|Service commitment';
const dom = new JSDOM('<div id="rv"><div class="chk-sum"></div><article class="frow st-todo"><div class="chk" data-key="'+key+'"><div class="chk-seg"><button data-st="todo">To do</button><button data-st="done">Done</button><button data-st="na">N/A</button></div><input type="file" multiple><ul class="chk-list"></ul></div></article></div>');
const document = dom.window.document;
const context = {window:dom.window,document,indexedDB,console,Date,Promise,
  last:{parcel:{county:'Example',id:'test'},findings:[{section:'water',item:'Service commitment',status:'verify'}]},
  LR:{reviewFindings:f=>f}, $:id=>document.getElementById(id), esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
vm.createContext(context);vm.runInContext(code, context);
const read = () => context.Store.get(key);
const selected = () => document.querySelector('[aria-pressed="true"]').dataset.st;
const closed = () => document.querySelector('.chk-done').textContent;
const attach = async names => {
  const input=document.querySelector('input[type=file]');
  Object.defineProperty(input,'files',{configurable:true,value:names.map(name=>new File(['Synthetic evidence'],name,{type:'text/plain'}))});
  input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  return read();
};
(async()=>{
  await context.loadChecklist();
  assert.equal(selected(),'todo');assert.equal(closed(),'0');
  let saved=await attach(['unreviewed.txt','contradictory.txt']);
  assert.equal(saved.status,'todo','Receiving documents must not resolve the question');
  assert.equal(saved.files.length,2);assert.equal(selected(),'todo');assert.equal(closed(),'0');
  assert.equal(document.querySelector('.chk-nfiles').textContent,'2');
  context.checklist={};await context.loadChecklist();
  assert.equal(selected(),'todo','Reload must preserve the unresolved decision');assert.equal(closed(),'0');
  assert.equal(document.querySelectorAll('.chk-list li').length,2);
  document.querySelector('[data-st=done]').click();await read();
  assert.equal(selected(),'done');assert.equal(closed(),'1','Explicit user completion still works');
  saved=await attach(['additional.txt']);assert.equal(saved.status,'done');
  document.querySelector('[data-st=na]').click();await read();
  saved=await attach(['not-applicable.txt']);assert.equal(saved.status,'na');
  document.querySelector('.chk-rm').click();saved=await read();
  assert.equal(saved.status,'na');assert.equal(saved.files.length,3);
  document.querySelector('[data-st=todo]').click();await read();
  saved=await attach([]);assert.equal(saved.status,'todo');assert.equal(closed(),'0');
  context.Store.reset();context.checklist={};await context.loadChecklist();
  assert.equal(selected(),'todo');assert.equal(closed(),'0');
  assert.equal(document.querySelectorAll('.chk-list li').length,3,'Retained evidence survives reopening the store');
  context.Store.reset();dom.window.close();
  console.log('PASS: real checklist upload events preserve review status, explicit choices, summary counts, file removal and IndexedDB reload.');
})().catch(e=>{console.error(e);process.exitCode=1;});
