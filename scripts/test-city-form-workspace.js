const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const pause=()=>new Promise(r=>setTimeout(r,5));async function until(f){for(let i=0;i<300;i++){if(await f())return;await pause();}throw Error('UI did not reach expected state');}
(async()=>{
 const dom=new JSDOM('<div id="home"><span class="wordmark">Cornerpin</span></div><button id="home-projects">My projects</button><button id="rv-workflow"></button><div id="rv-body"></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.scrollTo=()=>{};w.LR_DATA={cityInspect:require('../data/permits/ogden-valley-cityinspect.json')};
 w.CloudSync={signedIn:()=>false};w.CornerpinAccount={ready:Promise.resolve()};w.ProjectSync={status:()=>({state:'guest'})};w.CornerpinReportViews={packet:()=>''};w.ResearchWorkspace={render:()=>''};
 for(const name of ['evidence-ledger','permit-facts','permit-assistant','city-application','permit-workflow','project-store','permit-prep-ui','analysis-progress','project-workspace'])w.eval(fs.readFileSync('web/'+name+'.js','utf8'));
 const r={date:'2026-11-09',parcel:{id:'synthetic',county:'Weber',attrs:{PARCEL_ADD:'Synthetic test'}},facts:{jurisdiction:'Ogden Valley City'},findings:[]},p=w.PermitWorkflow.create(r);await w.ProjectStore.save(p,null);
 d.getElementById('home-projects').click();await until(()=>d.querySelector('[data-action=open]'));d.querySelector('[data-action=open]').click();await until(()=>d.querySelector('[data-action=filing]'));d.querySelector('[data-action=filing]').click();await until(()=>d.querySelector('[data-city-type]'));
 function selectType(id){const el=d.querySelector('[data-city-type]');el.value=id;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
 selectType('1');await until(()=>d.querySelector('.city-field'));
 const key=w.CityApplication.rows(p,'1').find(r=>r.name==='nickname').key;
 d.getElementById('city-'+key).value='Proposed house';d.querySelector('[data-action=city-page][data-id=building]').click();await until(()=>d.querySelector('[aria-current=step]')?.dataset.id==='building');
 assert.equal((await w.ProjectStore.get(p.id)).application.cityInspect.answers['1'][key].value,'Proposed house');
 selectType('2');await until(()=>d.querySelector('input[name=permitType]')?.value==='2');assert.match(d.getElementById('city-'+key).value,/Pool/);
 d.getElementById('city-'+key).value='Proposed pool';selectType('1');await until(()=>d.querySelector('input[name=permitType]')?.value==='1');assert.equal(d.getElementById('city-'+key).value,'Proposed house');
 const saved=await w.ProjectStore.get(p.id);assert.equal(saved.application.cityInspect.answers['2'][key].value,'Proposed pool');
 d.getElementById('city-'+key).value='House revised';d.querySelector('button[data-city-next]').click();await until(()=>d.querySelector('[aria-current=step]')?.dataset.id==='professionals');assert.equal((await w.ProjectStore.get(p.id)).application.cityInspect.answers['1'][key].value,'House revised');
 assert.match(w.CityApplication.sheet(await w.ProjectStore.get(p.id)),/House revised/);
 assert(d.querySelector('form[data-command=upload-plans]'));
 const team=d.querySelector('form[data-command=team_profile][data-unused]')||Array.from(d.querySelectorAll('form[data-command=team_profile]')).find(f=>f.elements.role.value==='builder');
 team.elements.name.value='Example Builder';team.elements.phone.value='555-0100';team.elements.confirmed.checked=true;team.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await until(async()=>!!(await w.ProjectStore.get(p.id)).application.team?.builder);
 assert.equal(w.CityApplication.rows(await w.ProjectStore.get(p.id),'1').find(r=>r.name==='buildername').value,'Example Builder');
 assert.equal(d.querySelector('input[name=rate_0]').step,'any');
 console.log('PASS: selecting a type loads its form; edits persist across page/type changes; save-and-continue and export include the latest answers.');dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
