/* UI text audit regressions: no repeated mapped-area lines, no empty "candidates: ." lists. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
const rule={id:'arch',title:'Resolve architectural reviewer',authority:'Association',stage:'verify',trigger:'Timing unresolved.',url:'https://example.org/r',applicability:'verify',layer:'subdivision'};
w.AreaRules={rules:()=>[rule],reviewCurrent:()=>null,evidence:{forProject:()=>null,sources:{}}};w.OVCRules={};
w.eval(fs.readFileSync('web/area-rules-ui.js','utf8'));
const feats=Array.from({length:15},(_,i)=>({name:'Cobabe Ranch Phase 1',attributes:i<2?{link:'https://gis.example/'+i}:{}}));
const p={application:{areaMap:{layers:[{id:'subdivision',state:'checked',features:feats}]},ruleReviews:{}},documents:[],report:{findings:[]}};
let html='';try{html=w.AreaRulesUI.detail(p,'arch');}catch(e){html=String(e);}
assert.equal((html.match(/Cobabe Ranch Phase 1/g)||[]).length,1,'A mapped area name appears once');assert(/15 mapped pieces/.test(html));
console.log('PASS: mapped areas with the same name are listed once with a count.');
const ovc=fs.readFileSync('web/ovc-rules.js','utf8');assert(!/candidate\(s\) within the 60 m parcel search envelope: '/.test(ovc)&&/No state highway mapped within about 200 ft/.test(ovc));
console.log('PASS: an empty highway search says so instead of printing an empty list.');
assert(!/Reservoir\/lake candidates: '\+hits/.test(ovc)&&/No mapped stream within about 200 ft/.test(ovc),'Empty stream/lake searches say so');
const lr=fs.readFileSync('web/lotreport.js','utf8');assert(/\(a\.SUB_PHASE \? '\. Subdivision: ' \+ a\.SUB_PHASE : ''\)/.test(lr),'No empty "Plat: ." in the assessor finding');
console.log('PASS: empty stream, lake and plat values are omitted rather than printed blank.');
