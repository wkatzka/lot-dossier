/* Permit walkthrough: entered by clicking the permit type on File a permit; one screen at a time with steps on the
   left and the source of every answer on the right; answers, yes/no skips and "Looks right" reviews are saved to
   the same project data as the full form. Real modules, isolated storage, no network. */
const assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const W=require('../web/permit-workflow'),C=require('../web/city-application'),P=require('../web/permit-packet');
const MODULES=['icons','input-rules','evidence-ledger','permit-facts','permit-assistant','site-decisions','answer-reviews','city-application','ovc-code-sources','accessory-rules','permit-packet','approval-evidence','ovc-rules','area-rules','permit-workflow','project-store','site-answer','project-intent','my-company','next-steps','title-research-view','placement-engine','land-value','weber-value','pool-screen','original-documents','site-document-ui','research-workspace','permit-prep-ui','permit-walkthrough','measurement-workbench','analysis-progress','project-overview','area-rules-ui','project-workspace'];
async function until(f,label){for(let i=0;i<400;i++){if(await f())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI did not reach expected state: '+label);}
(async()=>{
 const facts={jurisdiction:'Ogden Valley City',zone:'AV-3',zone_std:{zone:'AV-3',front:30,side:20,rear:30},lot_sf:135036,stepsRun:{check_parcel:'x'}};
 const report={parcel:{county:'Weber',id:'224410004',attrs:{PARCEL_ADD:'5241 E COBABE RANCH RD',PARCEL_ACRES:3.1,SUBDIV_NAME:'COBABE RANCH'},rings:[]},date:'2026-11-13',findings:[],facts:{...facts,owner:'Jane Owner',packets:{1:P.build('1',{facts,findings:[]})}}};
 let p=W.create(report,'2026-11-13T00:00:00Z');p.application.jurisdiction='Ogden Valley City';p.application.intent={plan:'new-home',label:'New single-family home',typeIds:['1']};p.propertyKey='Weber|224410004';
 p=W.apply(p,{type:'team_profile',role:'builder',name:'Ridge Line Builders',phone:'801-555-0142',email:'office@ridgeline.example',confirmed:true});
 p=W.apply(p,{type:'city_application',permitType:'1'});

 const dom=new JSDOM('<div id="home"><span class="wordmark">Cornerpin</span><button id="go">Check this lot</button></div><button id="home-projects">My projects</button><button id="rv-workflow">Workflow</button><div id="rv"><div id="rv-body"></div></div>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.LR_DATA={cityInspect:C.catalog};w.matchMedia=()=>({matches:false,addEventListener(){}});
 w.fetch=()=>Promise.reject(Error('offline test'));w.CloudSync={signedIn:()=>false};w.CornerpinAccount={ready:Promise.resolve()};w.ProjectSync={status:()=>({state:'guest'})};w.CornerpinReportViews={packet:()=>''};
 for(const m of MODULES)w.eval(fs.readFileSync('web/'+m+'.js','utf8'));
 await w.ProjectStore.save(p,null);
 const idle=()=>until(()=>!w.CornerpinWorkspaceBusy(),'idle'),saved=()=>w.ProjectStore.get(p.id);
 const go=async st=>{await idle();d.querySelector('.cp-wt-nav button[data-id="'+st+'"]').click();await until(()=>d.querySelector('.cp-wt-nav [aria-current=step]')?.dataset.id===st,'step '+st);await idle();};
 const next=async()=>{await idle();const b=d.querySelector('button[data-wt-next]'),to=b.dataset.wtNext;b.click();await until(()=>d.querySelector('.cp-wt-nav [aria-current=step]')?.dataset.id===to,'continue to '+to);await idle();return to;};

 d.getElementById('home-projects').click();await until(()=>d.querySelector('[data-action=open]'),'list');d.querySelector('[data-action=open]').click();await until(()=>d.querySelector('[data-frame=filing]'),'project');
 d.querySelector('[data-frame=filing]').click();await until(()=>d.querySelector('.cp-permit-walk'),'File a permit');
 // 1. The way in is the permit type itself.
 assert.match(d.querySelector('.cp-permit-walk').textContent,/Single Family Dwelling walkthrough/);
 assert(d.querySelector('.cp-permit-name[data-action=prepare-permit][data-id="1"]'),'permit name opens the walkthrough');
 await idle();d.querySelector('.cp-permit-walk').click();await until(()=>d.querySelector('.cp-wt'),'walkthrough');await idle();
 // 2. One screen at a time: a question, steps on the left, sources on the right.
 assert.equal(d.querySelector('.cp-wt-nav [aria-current=step]').dataset.id,'property');
 assert.equal(d.querySelector('.cp-wt-q').textContent,'Is this the right lot?');
 assert.deepEqual([...d.querySelectorAll('.cp-wt-part-h')].map(x=>x.textContent),['The property','The project','Your team','The building','Documents','Finish']);
 const addr=C.rows(await saved(),'1').find(r=>r.name==='property_address');
 const card=[...d.querySelectorAll('.cp-wt-src[data-keys]')].find(c=>c.dataset.keys.split(' ').includes(addr.key));assert(card,'source card for the address');
 // One card per source: the parcel excerpt appears once, with every answer it supplied listed under it.
 assert.equal([...d.querySelectorAll('.cp-wt-side blockquote')].filter(b=>/Parcel 224410004/.test(b.textContent)).length,1);assert(card.querySelectorAll('.cp-wt-vals dt').length>1);
 assert.match(card.textContent,/From the county parcel record/);assert.match(card.querySelector('blockquote').textContent,/Parcel 224410004 · 5241 E COBABE RANCH RD/);
 assert.match(d.querySelector('.cp-wt-intro').textContent,/Cornerpin filled in \d+ of \d+ from the county parcel record/);
 assert(d.querySelector('.cp-wt-find'),'blank answers say where to find them');
 assert(d.querySelector('.cp-wt-row [data-wt-src="'+addr.key+'"]'),'every question has a ? that points at its source');
 // 3. "Looks right" records the user's own review; Save & continue moves on and marks the screen done.
 d.querySelector('input[name=wt-ok][value="'+addr.key+'"]').checked=true;
 assert.equal(await next(),'owner');
 let s=await saved();assert.equal(s.application.answerReviews['1'][addr.key].state,'confirmed');assert.equal(s.application.answerReviews['1'][addr.key].reviewer,'You');
 assert.match(s.application.answerReviews['1'][addr.key].reason,/county parcel record/);
 assert(s.application.walkthrough['1'].seen.includes('property'));
 // Answers still awaiting review keep a count on the step; ✓ only once nothing is left there.
 assert(+d.querySelector('.cp-wt-nav button[data-id=property] .cp-page-count').textContent>0);
 // 4. Typed answers save to the same answers as the full form.
 const phone=C.rows(s,'1').find(r=>r.name==='owner_phone');d.getElementById('city-'+phone.key).value='801-555-0199';await next();
 s=await saved();assert.equal(s.application.cityInspect.answers['1'][phone.key].value,'801-555-0199');
 // 5. The city asks for the builder twice; the walkthrough asks once and saves both.
 await go('builder');
 const page1=C.rows(s,'1').find(r=>r.section==='primary'&&r.name==='builder_phone'),page2=C.rows(s,'1').find(r=>r.section==='professionals'&&r.name==='builder_phone');
 assert(!d.getElementById('city-'+page1.key),'duplicate question hidden');assert.equal(d.getElementById('city-'+page2.key).value,'801-555-0142');
 const box=d.getElementById('city-'+page2.key);box.value='801-555-0100';box.dispatchEvent(new w.Event('input',{bubbles:true}));await next();
 s=await saved();assert.equal(s.application.cityInspect.answers['1'][page1.key].value,'801-555-0100');assert.equal(s.application.cityInspect.answers['1'][page2.key].value,'801-555-0100');
 // 6. Yes/no first: "Not yet" skips the electrician's nine questions and the step shows as skipped.
 await go('electrical');
 assert(d.querySelector('[data-wt-fields]').hidden,'questions hidden until Yes');
 const no=d.querySelector('input[name=wt-gate][value=no]');no.checked=true;no.dispatchEvent(new w.Event('change',{bubbles:true}));await next();
 s=await saved();assert.equal(s.application.walkthrough['1'].gates.electrical,'no');
 assert(d.querySelector('.cp-wt-nav button[data-id=electrical] .cp-wt-mark.is-skip'));
 await go('plumbing');const yes=d.querySelector('input[name=wt-gate][value=yes]');yes.checked=true;yes.dispatchEvent(new w.Event('change',{bubbles:true}));assert(!d.querySelector('[data-wt-fields]').hidden,'Yes shows the questions');
 // 7. Cost: dollars, never negative, with the estimator alongside.
 await go('cost');const val=d.querySelector('.cp-num-money input');assert.equal(val.min,'0');assert(d.querySelector('.cp-wt-extra input[name=rate_0]'),'cost estimator on the cost screen');
 // 8. Documents say who provides each one; the portal step never signs for the user.
 await go('documents');assert.match(d.querySelector('.cp-wt-doclist').textContent,/Get it from a geotechnical engineer/);
 await go('portal');assert.match(d.querySelector('.cp-wt-doclist').textContent,/sign this yourself/);
 // 9. The last step checks everything before filing.
 await go('review');assert.match(d.querySelector('.cp-wt-verdict').textContent,/Before you file:.*required answer/);assert(d.querySelector('.cp-wt-main [data-action=city-download]'));
 // 10. The whole form is one click away and shows the same answers.
 await idle();d.querySelector('[data-action=wt-full]').click();await until(()=>d.querySelector('.city-application [data-action=city-page]'),'full form');
 assert.equal(d.getElementById('city-'+phone.key).value,'801-555-0199');
 await idle();d.querySelector('[data-action=wt-walk]').click();await until(()=>d.querySelector('.cp-wt'),'back to walkthrough');
 w.close();
 console.log('PASS: the permit type on File a permit opens a step-by-step walkthrough: one question per screen, steps with ✓ / skipped marks on the left, the source and excerpt for each answer on the right.');
 console.log('PASS: answers, "Looks right" reviews, yes/no skips and the duplicate builder question save to the same project data as the full form.');
})().catch(e=>{console.error(e);process.exit(1);});
