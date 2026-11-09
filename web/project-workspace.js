(function () {
  'use strict';
  const W = window.PermitWorkflow, S = window.ProjectStore;
  let cityPage='primary', reusableProjects=[];
  let project = null, tab = 'overview', section = 'site', busy = false, capture = Promise.resolve(), capturing=0;
  const host = document.createElement('main'); host.id = 'project-workspace'; document.body.appendChild(host);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const human = s => String(s || '').replace(/_/g, ' ');
  const button = (action, text, id) => '<button type="button" data-action="' + action + '" data-id="' + esc(id || '') + '">' + esc(text) + '</button>';
  const field = (name, label, value, type) => '<label>' + esc(label) + '<input name="' + name + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '"></label>';
  const area = (name, label, value) => '<label>' + esc(label) + '<textarea name="' + name + '">' + esc(value || '') + '</textarea></label>';
  const select = (name, label, options, selected) => '<label>' + esc(label) + '<select name="' + name + '">' + options.map(x => '<option value="' + esc(x[0]) + '"' + (x[0] === selected ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select></label>';
  const docs = (selected, single) => '<label>' + (single ? 'Evidence document (or source link below)' : 'Current supporting document versions (select all that apply)') + '<select name="' + (single ? 'documentId' : 'documentIds') + '"' + (single ? '' : ' multiple') + '><option value="">None</option>' + project.documents.filter(d => single || W.latest(project, d)).map(d => '<option value="' + esc(d.id) + '"' + ((selected || []).includes(d.id) ? ' selected' : '') + '>' + esc(d.name + ' · v' + d.version) + '</option>').join('') + '</select></label>';
  const source = () => docs([], true) + field('url', 'Evidence HTTPS link', '', 'url');
  const form = (type, content, title, id) => {
    const locked = type === 'correction' && project.corrections.some(c => c.id === id && c.state === 'resubmitted');
    return '<form data-command="' + type + '" data-id="' + esc(id || '') + '">' + (locked ? '<fieldset disabled style="border:0;padding:0">' : '') + content + (locked ? '</fieldset><p class="pw-muted">Submitted response retained. Record acceptance below, or import a new review round if the city requests more changes.</p>' : '<div class="pw-actions"><button class="primary" type="submit">' + esc(title) + '</button></div>') + '</form>';
  };
  const link = (url, title) => /^https?:\/\//i.test(url || '') ? '<a class="pw-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(title) + '</a>' : '';
  window.CornerpinWorkspaceBusy=()=>busy||capturing>0;
  function message(s) { window.AnalysisProgress.stop(); const e = document.getElementById('pw-message'); if (e) e.textContent = s; }
  function syncLabel(p) {
    const info=window.ProjectSync.status(p),labels={guest:'Saved on this device · sign in to save across devices',saving:'Saving to your account…',saved:'Saved to your account',pending:'Saved on this device · account sync pending'};
    return '<span>'+labels[info.state]+'</span>'+(info.error?'<span class="pw-muted"> · '+esc(info.error)+'</span>':'')+(info.state==='pending'?' '+button('cloud-save','Retry save',p.id):'');
  }
  function refreshSyncLabels(){host.querySelectorAll('[data-sync-project]').forEach(async el=>{const owner=S.owner(),p=await S.get(el.dataset.syncProject);if(p&&owner===S.owner()&&el.isConnected)el.innerHTML=syncLabel(p);});}
  window.addEventListener('cornerpin:sync-state',refreshSyncLabels);
  async function openSaved(id) {
    await window.CornerpinAccount.ready;const owner=S.owner();let p=await S.get(id),notice='';
    if(window.CloudSync.signedIn()){
      try{const remote=(await window.CloudSync.list()).find(x=>x.id===id);if(S.owner()!==owner)return;
        if(remote&&(!p||remote.revision>p.revision&&window.CloudSync.baseRevision(id)===p.revision))p=await window.CloudSync.pull(id,remote);
        else if(remote&&p&&remote.revision!==window.CloudSync.baseRevision(id)&&p.revision!==window.CloudSync.baseRevision(id))notice='This device and your account have different changes. Device work was kept; download a backup before reconciling.';
      }catch(e){if(!p)throw e;notice='Opened the saved device copy. '+e.message;}
    }
    if(S.owner()!==owner)return;if(!p)throw Error('Saved project not found.');project=p;capture=Promise.resolve(p);tab='overview';section='site';render();if(notice)message(notice);window.scrollTo(0,0);
  }
  async function commit(command, file) { const next = W.apply(project, command); await S.save(next, project.revision, file); project = next; render(); }
  async function saveCityPage() {
    if(!document.body.classList.contains('show-project'))return;
    const f=host.querySelector('form[data-command=city_application_page]');
    if(f){const command=window.CityApplication.formCommand(project,new FormData(f));if(command.entries.length)await commit(command);}
  }
  async function collectChecklist(p) {
    for(const file of await S.checklistFiles(p.property.county,p.property.parcelId)){
      const hash=await window.ProjectBackup.hash(await file.blob.arrayBuffer());if(p.documents.some(d=>d.hash===hash))continue;
      if(file.size>25*1024*1024||p.documents.reduce((n,d)=>n+(d.size||0),0)+file.size>100*1024*1024){const next=JSON.parse(JSON.stringify(p));next.revision++;next.events.push({id:W.id(),at:new Date().toISOString(),type:'attachment_copy_failed',text:'Checklist attachment '+file.name+' remains in the checklist: project file capacity exceeded.'});await S.save(next,p.revision);p=next;continue;}
      const id=W.id(),next=W.apply(p,{type:'document',document:{id,name:file.name,size:file.size,hash,role:'supporting',family:id,checklistKey:file.checklistKey}});
      await S.save(next,p.revision,{id,blob:file.blob});p=next;
    }return p;
  }
  async function retainPublicSources(p) {
    const sources=(p.report.facts.publicSurveys||{}).documents||[];
    for(const source of sources){
      if(source.error||!source.sha256||p.documents.some(d=>d.hash===source.sha256))continue;
      try{
        const base=location.protocol==='file:'?(window.LR_DATA.apiBase||''):location.origin,ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),45000);let blob;
        try{const response=await fetch(base+'/api/survey-document?record='+encodeURIComponent(source.recordNumber)+'&format=original',{signal:ctl.signal});if(!response.ok)throw Error('Original PDF HTTP '+response.status);blob=await response.blob();}finally{clearTimeout(timer);}
        const hash=await window.ProjectBackup.hash(await blob.arrayBuffer());if(hash!==source.sha256)throw Error('Source changed since extraction; refresh required');
        if(blob.size>25*1024*1024||p.documents.reduce((n,d)=>n+(d.size||0),0)+blob.size>100*1024*1024)throw Error('Local file capacity reached');
        const id=W.id(),next=W.apply(p,{type:'document',document:{id,name:'Public-survey-'+source.recordNumber+'.pdf',size:blob.size,hash,role:'public_source',family:'survey-'+source.recordNumber,sourceUrl:source.url,retrievedAt:source.retrievedAt}});
        await S.save(next,p.revision,{id,blob});p=next;
      }catch(e){const next=JSON.parse(JSON.stringify(p));next.revision++;next.events.push({id:W.id(),at:new Date().toISOString(),type:'source_retention_failed',text:'Survey '+source.recordNumber+': '+e.message});await S.save(next,p.revision);p=next;}
    }return p;
  }
  // One persistent project frame shared by the report and workflow views.
  const frame=document.createElement('section');frame.id='project-frame';document.body.insertBefore(frame,document.getElementById('rv'));
  function projectFrame(active) {
    document.body.classList.toggle('project-frame-active',!!project);
    if(!project)return;
    if(!frame.firstChild)frame.innerHTML='<header class="project-header"><button class="project-brand wordmark" data-frame="projects" aria-label="Cornerpin — My projects">'+document.querySelector('#home .wordmark').innerHTML+'</button><div class="project-toolbar"><button data-frame="filing">Permit filing</button><button data-frame="overview">Project overview</button><button data-frame="print">Print</button><button data-frame="download">Download site report</button><button class="project-new" data-frame="home">Review another property</button></div></header><nav aria-label="Project sections"></nav><div class="project-identity"><h1></h1><p></p></div>';
    frame.querySelector('h1').textContent=project.property.address;
    const attrs=project.report.parcel?.attrs||{};frame.querySelector('.project-identity p').textContent=[attrs.PARCEL_CITY,project.property.county+' County','Parcel '+project.property.parcelId,attrs.PARCEL_ACRES?attrs.PARCEL_ACRES+' acres':''].filter(Boolean).join(' · ');
    const items=active==='overview'?[]:section==='site'?[['site','Site report'],['evidence','Evidence & restrictions'],['valuation','Lot economics'],['placement','Pool layout'],['documents','Documents'],['activity','Activity']]:[[section,section==='filing'?'Permit filing':'Permit management'],['documents','Documents'],['activity','Activity']];
    const nav=frame.querySelector('nav'),key=items.map(i=>i[0]).join('|');
    if(nav.dataset.items!==key){nav.innerHTML=items.map(([id,label])=>'<button data-frame="'+id+'">'+label+'</button>').join('');nav.dataset.items=key;}
    nav.hidden=!items.length;
    nav.querySelectorAll('button').forEach(b=>{if(b.dataset.frame===(active==='draft'?'filing':active))b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    frame.querySelector('[data-frame="overview"]').setAttribute('aria-pressed',String(active==='overview'));
  }
  frame.addEventListener('click',async e=>{const b=e.target.closest('[data-frame]');if(!b)return;try{const action=b.dataset.frame;await saveCityPage();
    if(action==='projects'){await list();return;}
    if(action==='home'){window.dispatchEvent(new CustomEvent('cornerpin:home'));return;}
    if(action==='site'){section='site';tab='site';document.body.classList.remove('show-project');window.dispatchEvent(new CustomEvent('cornerpin:restore-report',{detail:project.report}));projectFrame('site');return;}
    if(action==='download'){const previousTab=tab,previousSection=section;window.dispatchEvent(new CustomEvent('cornerpin:restore-report',{detail:project.report}));document.getElementById('rv-save').click();tab=previousTab;section=previousSection;if(tab!=='site')render();return;}
    if(action==='print'){window.print();return;}
    tab=action;if(['filing','management'].includes(tab))section=tab;else if(['evidence','valuation','placement'].includes(tab))section='site';render();
  }catch(err){message(err.message);}});
  window.addEventListener('cornerpin:report-visible',()=>{if(project){section='site';tab='site';projectFrame('site');}});
  function stageNavigation() {
    if(tab==='overview')return '';
    const items=section==='site'?['site','evidence','valuation','placement','documents','activity']:[section,'documents','activity'];
    const names={site:'Site report',evidence:'Evidence & restrictions',valuation:'Lot economics',placement:'Pool layout',filing:'Permit filing',management:'Permit management',documents:'Documents',activity:'Activity'};
    return '<div class="pw-actions">'+button('tab','← Project overview','overview')+'</div><h2>'+({site:'Site review',filing:'Permit filing',management:'Permit management'})[section]+'</h2><nav aria-label="'+section+' sections">'+items.map(t=>'<button data-action="'+(t==='site'?'site':'tab')+'" data-id="'+t+'" aria-selected="'+(tab===t)+'">'+names[t]+'</button>').join('')+'</nav>';
  }
  function overview() {
    const p = project, blocked = W.blockers(p, p.application.reference ? 'resubmission' : 'initial');
    return '<div class="pw-grid pw-stages"><section class="pw-card"><h2>1. Site review</h2><p>Property evidence, plan checks and preliminary permit requirements.</p><p>Snapshot ' + p.siteVersion + ' · ' + esc(new Date(p.report.date).toLocaleDateString()) + '</p>' + button('site', 'Open site report') + '</section><section class="pw-card"><h2>2. Permit filing</h2><p>Review requirements, attach final documents, prepare the handoff and record the filing receipt.</p><p>' + (p.application.reference ? 'Application ' + esc(p.application.reference) : blocked.length + ' readiness items remain') + '</p>' + button('filing', 'Open permit filing') + '</section><section class="pw-card"><h2>3. Permit management</h2><p>Import reviewer comments, assign corrections, prepare responses and retain acceptance evidence.</p><p>' + W.openCorrections(p).length + ' open corrections · ' + p.rounds.length + ' review rounds</p>' + button('management', 'Open permit management') + '</section></div>'+ (window.PermitPrepUI?window.PermitPrepUI.plans(p)+window.PermitPrepUI.permits(p)+(window.MeasurementWorkbench?window.MeasurementWorkbench.panel(p):''):'')+'<div class="pw-actions">'+button('refresh-evidence','Refresh public evidence')+'</div><section class="pw-card"><h2>What needs attention</h2>' + (p.corrections.filter(c => c.state !== 'accepted' && c.dueDate).map(c => '<p><strong>' + esc(c.dueDate < new Date().toISOString().slice(0,10) ? 'Overdue: ' : 'Due: ') + esc(c.dueDate) + '</strong> · ' + esc(c.owner || 'Unassigned') + ' · ' + esc(c.text) + '</p>').join('') || '<p>No correction due dates recorded.</p>') + '<p class="pw-muted">Dates appear here when you open the project. Background reminders and city monitoring are not running.</p></section>';
  }
  function draft(){const p=project,type=p.application.cityInspect?.typeId,t=window.CityApplication.catalog.types.find(t=>t.value===type);return '<div class="permit-draft-page"><div class="pw-actions">'+button('permit-hub','← Back to permit filing')+'</div><section class="pw-card"><h2>'+esc(t?.label||'Permit')+' draft</h2>'+window.PermitPrepUI.progressReport(p,type)+'</section>'+window.CityApplication.render(p,cityPage)+window.PermitPrepUI.readiness(p)+(window.MeasurementWorkbench?window.MeasurementWorkbench.panel(p):'')+window.PermitPrepUI.valuation(p)+'</div>';}
  function filing() {
    const p = project;
    return (window.PermitPrepUI?window.PermitPrepUI.permits(p)+window.PermitPrepUI.plans(p)+(window.MeasurementWorkbench?window.MeasurementWorkbench.panel(p):'')+window.PermitPrepUI.team(p):'')+'<section class="pw-card"><h2>Application details</h2><p>' + esc(p.application.jurisdiction || 'Permitting authority unresolved in site review') + '</p>' + form('application', '<div class="pw-grid">' + field('applicant','Applicant',p.application.applicant) + field('owner','Property owner',p.application.owner) + field('contractor','Contractor',p.application.contractor) + '</div>' + area('description','Project description',p.application.description), 'Save application details') + '<details><summary>Fields carried forward from site review</summary>' + ((((p.report.facts || {}).packet || {}).rows || []).map(r => '<p><strong>' + esc(r[0]) + ':</strong> ' + esc(r[1]) + '<br><span class="pw-muted">' + esc(r[2]) + '</span></p>').join('')) + '</details></section><section class="pw-card"><h2>Filing requirements</h2><p>Site-review suggestions are not filing approvals. Record the current evidence and who reviewed each requirement. A waiver needs a documented basis.</p>' + p.requirements.map(r => '<details><summary>' + esc(r.title) + ' <span class="pw-status">— ' + esc(human(r.state)) + (r.required ? '' : ' · optional') + '</span></summary><p>' + esc(r.detail || r.source || '') + '</p>' + form('requirement', select('state','Review status',[['reviewed','Reviewed against evidence'],['waived','Not applicable / waived with reason'],['needs_review','Needs review']],r.state) + field('reviewer','Reviewed by',r.reviewer) + area('note','Review basis / waiver reason',r.note) + docs(r.documentIds) + field('url','Source HTTPS link',r.evidenceUrl || r.sourceUrl,'url'), 'Save requirement review',r.id) + '</details>').join('') + '</section>' + '<section class="pw-card"><details><summary>Source packet: application data, drafted requests and preliminary site plan</summary><div class="pw-source-packet">' + window.CornerpinReportViews.packet((p.report.facts || {}).packet) + '</div></details></section>' + packagePanel('initial') + receiptForm();
  }
  function packagePanel(kind) {
    const p = project, blockers = W.blockers(p,kind), pkg = W.currentPackage(p,kind);
    if (kind === 'resubmission' && W.openCorrections(p).length && W.openCorrections(p).every(c => c.state === 'resubmitted')) return '<section class="pw-card"><h2>Awaiting reviewer response</h2><p>Resubmission recorded. Retain the city’s acceptance or import its next correction round when received.</p>' + (pkg ? button('export-package','Download submitted package',pkg.id) : '') + '</section>';
    if (kind === 'initial' && p.application.reference) return '<section class="pw-card"><h2>Filing recorded</h2><p>Reference ' + esc(p.application.reference) + '. Manage subsequent corrections in Permit management.</p></section>';
    return '<section class="pw-card"><h2>' + (kind === 'initial' ? 'Prepare filing handoff' : 'Prepare resubmission') + '</h2>' + (blockers.length ? '<p>' + blockers.length + ' blockers:</p><ul>' + blockers.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '<p>Recorded requirements are ready for a person to review the package.</p>') + form('prepare', '<input type="hidden" name="kind" value="' + kind + '">' + field('reviewer','Package reviewer','') + '<label><input type="checkbox" name="reviewed"> I reviewed the application, supporting documents and responses listed in this workspace.</label>', 'Freeze reviewed package') + (pkg ? '<p>Package ' + esc(pkg.id) + ' · ' + esc(pkg.preparedAt) + '</p>' + button('export-package','Download frozen package',pkg.id) : '') + '<div class="pw-actions"><button disabled>Submit automatically — connection required</button>' + link(p.application.portal,'Open official filing portal') + '</div><p class="pw-muted">A prepared package has not been filed. Download includes the application snapshot and attached documents; it does not replace jurisdiction forms, required stamps, signatures or fees.</p></section>';
  }
  function receiptForm() {
    return '<section class="pw-card"><h2>Record an external filing receipt</h2><p>After filing through the official portal, retain the confirmation here. Cornerpin does not independently verify this receipt.</p>' + form('receipt', field('reference','Application reference',project.application.reference) + field('receivedAt','Receipt date','','date') + select('packageId','Submitted package',[['','Filed outside Cornerpin — package not captured']].concat(project.packages.filter(p => !p.stale && !p.receiptId).map(p => [p.id,p.kind + ' · ' + p.preparedAt])), '') + source(),'Record filing receipt') + project.receipts.map(r => '<p>' + esc(r.receivedAt + ' · ' + r.reference + ' · ' + (r.packageId || 'Package not captured')) + '</p>').join('') + '</section>';
  }
  function management() {
    const p = project;
    return '<section class="pw-card"><h2>Reviewer correspondence</h2><p>Import actual city feedback. Paste the reviewer text with a blank line between each actionable comment, check the items, then confirm. Attach the original letter under Documents or retain its source link.</p>' + form('review_round', field('department','Review department','Building') + field('sourceDate','Correspondence date','','date') + field('sourceLocator','Page / section reference','') + source() + area('originalText','Reviewer comments — one item per paragraph','') + '<label><input type="checkbox" name="confirmed"> I checked each paragraph against the original correspondence.</label>', 'Import confirmed comments') + p.rounds.map(r => '<details><summary>Review round ' + r.number + ' · ' + esc(r.department) + ' · ' + esc(r.sourceDate) + '</summary><pre>' + esc(r.originalText) + '</pre>' + link(r.url,'Original correspondence') + (r.documentId ? button('download-file','Download original letter',r.documentId) : '') + '</details>').join('') + '</section><section class="pw-card"><h2>Corrections</h2>' + (p.corrections.map(c => '<details><summary>' + esc(c.department + ' · ' + c.text) + ' <span class="pw-status">— ' + esc(human(c.state)) + '</span></summary><p class="pw-muted">' + esc(c.sourceLocator) + '</p>' + (c.state === 'accepted' ? '<p>Acceptance recorded: ' + esc(c.acceptance.note) + '</p>' : form('correction', '<div class="pw-grid">' + field('owner','Responsible person',c.owner) + field('email','Contact email (for draft only)',c.email,'email') + field('dueDate','Due date',c.dueDate,'date') + '</div>' + select('state','Work status',[['received','Received'],['assigned','Assigned'],['revision_received','Revision received'],['response_prepared','Response prepared']].concat(c.state === 'resubmitted' ? [['resubmitted','Resubmitted — awaiting reviewer']] : []),c.state) + area('response','Response to reviewer',c.response) + docs(c.documentIds) + area('noRevisionReason','If no revised document is needed, explain why',c.noRevisionReason), 'Save correction',c.id) + button('draft-assignment','Download assignment email draft',c.id) + (c.state === 'resubmitted' ? '<h3>Record reviewer acceptance</h3>' + form('accept_correction',source() + area('note','Acceptance text / applicable comment reference',''),'Record acceptance',c.id) : '')) + '</details>').join('') || '<p>No reviewer comments imported.</p>') + '</section>' + packagePanel('resubmission') + receiptForm() + '<section class="pw-card"><h2>Permit issuance</h2><p>Record issuance only when you have the actual permit and all tracked corrections have been reconciled.</p>' + form('issuance',field('permitNumber','Issued permit number','') + field('issuedAt','Issue date','','date') + source(),'Record issued permit') + (p.issuance ? '<p>Recorded permit: ' + esc(p.issuance.permitNumber) + ' · ' + esc(p.issuance.issuedAt) + '</p>' : '') + '</section>';
  }
  function documents() {
    return '<section class="pw-card"><h2>Project documents</h2><p>Files save with your project. Signed-in changes sync to your account automatically; their checklist status does not approve filing requirements. Uploading a file does not approve a requirement.</p>' + form('upload', '<label>File (maximum 25 MB)<input type="file" name="file" required></label>' + select('role','Document role',[['plan','Building plans'],['site_plan','Site plan'],['geotechnical','Geotechnical report'],['hazard','Hazard assessment'],['fire_receipt','Fire district receipt'],['stormwater','Stormwater permit'],['energy','REScheck / energy compliance'],['structural','Structural calculations'],['engineering','Permit engineering'],['truss_layout','Truss layout'],['truss_specs','Truss specifications'],['soils','Soils report'],['noi','State NOI'],['swppp','SWPPP'],['will_serve','Will-serve letters'],['owner_builder','Owner-builder certificate'],['supporting','Supporting report / approval'],['review_letter','Reviewer letter'],['receipt','Filing receipt'],['permit','Issued permit']], 'supporting') + select('family','Version of',[['','New document']].concat(project.documents.filter(d => W.latest(project,d)).map(d => [d.family,d.name + ' · next version'])),''), 'Save document') + project.documents.map(d => '<p><strong>' + esc(d.name) + '</strong> · v' + d.version + ' · ' + (W.latest(project,d) ? 'Current' : 'Superseded, retained in history') + ' · ' + esc(d.role) + ' ' + button('download-file','Download',d.id) + '</p>').join('') + '</section>';
  }
  function render() {
    document.body.classList.add('show-project');
    projectFrame(tab);
    document.title = project ? 'Cornerpin · ' + project.property.address : 'Cornerpin · My projects';
    host.innerHTML = '<header><span class="wordmark">' + document.querySelector('#home .wordmark').innerHTML + '</span><div class="pw-actions">' + '<button type="button" data-account>'+(window.CloudSync.signedIn()?'Account':'Sign in')+'</button>' + button('projects','My projects') + button('home',project?'Review another property':'New project') + '</div></header><div id="pw-message" role="status" aria-live="polite"></div>' + (project ? '<h1>' + esc(project.property.address) + '</h1><p>' + esc(project.property.county + ' County · Parcel ' + project.property.parcelId) + ' · <strong>' + esc(human(project.stage)) + '</strong></p>' : '<h1>My projects</h1>') + (project?'<p class="pw-sync" data-sync-project="'+esc(project.id)+'" role="status">'+syncLabel(project)+'</p>':'<p>Open a saved site to continue where you left off. Public research only reruns when you choose Refresh.</p>') + (project ? stageNavigation() + '<div id="pw-content">' + ({overview,evidence:()=>window.ResearchWorkspace.render('evidence',project),valuation:()=>window.ResearchWorkspace.render('valuation',project),placement:()=>window.ResearchWorkspace.render('placement',project),filing,draft,management,documents,activity: () => '<section class="pw-card"><h2>Project history</h2><p class="pw-muted">Local working history; not a tamper-proof regulatory audit log.</p>' + button('export-record','Download project record') + button('export-backup','Download complete backup') + '<p class="pw-muted">The JSON record contains metadata and history, not file contents. Download files under Documents; frozen package downloads include their attached files.</p>' + project.packages.map(p => '<p>' + esc(p.kind + ' · ' + p.preparedAt + (p.stale ? ' · superseded' : '') + (p.receiptId ? ' · receipt recorded' : ' · not filed')) + ' ' + button('export-package','Download this package',p.id) + '</p>').join('') + project.events.slice().reverse().map(e => '<p><strong>' + esc(e.at) + '</strong><br>' + esc(e.text) + '</p>').join('') + '</section>'})[tab]() + '</div>' : '<div id="pw-content"></div>');
  }
  async function list() {
    await window.CornerpinAccount.ready;const owner=S.owner();project=null;render();
    const rows=await S.list();if(S.owner()!==owner)return;
    const merged=new Map(rows.map(p=>[p.id,p]));let warning='';
    if(owner){try{const cloud=await window.CloudSync.list();if(S.owner()!==owner)return;for(const p of cloud)if(!merged.has(p.id))merged.set(p.id,p);}catch(e){warning='Account unavailable. Showing projects saved on this device. '+e.message;}}
    if(S.owner()!==owner||project)return;
    document.getElementById('pw-content').innerHTML='<div class="pw-project-grid">'+(Array.from(merged.values()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>'<section class="pw-card"><h2>'+esc(p.property.address)+'</h2><p>'+esc(p.property.county+' County · '+human(p.stage))+'</p><p class="pw-muted">Site report saved '+esc(new Date(p.report.date).toLocaleDateString())+'</p><p data-sync-project="'+esc(p.id)+'">'+(rows.some(x=>x.id===p.id)?syncLabel(p):'Saved to your account')+'</p>'+button('open','Open project',p.id)+'</section>').join('')||'<section class="pw-card"><h2>No saved projects yet</h2><p>Enter a property address to generate your first site report. It will appear here automatically.</p>'+button('home','Review a property')+'</section>')+'<section class="pw-card pw-import-card"><h2>Import a project</h2><p>Bring a saved Cornerpin project and its files into your workspace.</p><form data-command="restore-backup"><label>Project backup<input name="backup" type="file" accept=".json" required></label><button type="submit">Import project</button></form></section></div>'+(!owner?'<p>Guest projects are saved on this device only. <button type="button" data-account>Sign in</button> to keep new projects in your account.</p>':'');
    if(warning)message(warning);
  }
  function download(name, content, type) { const a = document.createElement('a'), url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content],{type:type || 'text/plain'})); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); }
  async function exportPackage(id) {
    const pkg = project.packages.find(p=>p.id===id); if(!pkg) throw new Error('Package not found.');
    let files = '';
    for (const key of pkg.documentIds) {
      const d = project.documents.find(x=>x.id===key), blob = await S.file(key); if(!blob) throw new Error('A package file is missing. Export stopped.');
      const data = await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(new Blob([blob],{type:'application/octet-stream'}));});
      files += '<p><a download="' + esc(d.name) + '" href="' + data + '">' + esc(d.name + ' · v' + d.version) + '</a><br>SHA-256: ' + esc(d.hash) + '</p>';
    }
    download('cornerpin-package-' + pkg.id + '.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Cornerpin filing handoff</title><body><h1>Cornerpin filing handoff</h1><p>Prepared package only. Not proof of filing or approval.</p><h2>Supporting documents</h2>' + files + '<h2>Application snapshot</h2><pre>' + esc(JSON.stringify(pkg,null,2)) + '</pre>' + (pkg.kind==='resubmission' ? '<h2>Draft response letter</h2><pre>' + esc(W.responseLetter(project,pkg.responses)) + '</pre>' : '') + '</body></html>','text/html');
  }
  host.addEventListener('click', async e => {
    const b=e.target.closest('[data-action]'); if(!b || busy) return;
    busy=true;
    try {
      const a=b.dataset.action, id=b.dataset.id;
      if(a==='measure-plan'){await saveCityPage();const d=project.documents.find(d=>d.id===id);await window.MeasurementWorkbench.open(project,d,{save:commit,file:S.file});} else if(a==='suggest-measurements'){await saveCityPage();if(!window.CloudSync.signedIn())throw Error('Sign in to suggest boundaries with Claude. Manual calibrated measurement works without AI.');await window.ProjectSync.enqueue(project.id);if(window.ProjectSync.status(project).state!=='saved')throw Error('Wait for the plans to sync, then retry.');window.AnalysisProgress.start('pw-message','geometry');const response=await fetch('/api/projects?action=plan-measurements',{method:'POST',headers:{...window.CloudSync.auth(),'Content-Type':'application/json'},body:JSON.stringify({projectId:project.id,documentId:id}),signal:AbortSignal.timeout(300000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Geometry analysis failed');await commit({type:'measurement_candidates',result});message(result.measurements.length ? result.measurements.length+' boundary candidates saved. Open Measure plans to review their calibration and geometry.' : 'No reliable boundary candidates found. Open Measure plans to trace the drawing with calibrated dimensions.');} else if(a==='prepare-permit') {await saveCityPage();tab='draft';section='filing';cityPage='primary';await commit({type:'city_application',permitType:id});const draft=host.querySelector('.permit-draft-page'),heading=draft?.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}draft?.scrollIntoView({block:'start',behavior:'instant'});}
      else if(a==='reuse-team') {
        const owner=S.owner();const local=await S.list();const remote=window.CloudSync.signedIn()?await window.CloudSync.list():[];if(owner!==S.owner())return;
        reusableProjects=[...new Map([...local,...remote].filter(x=>x.id!==project.id).map(x=>[x.id,x])).values()];
        host.querySelector('#team-library').innerHTML=reusableProjects.map(p=>Object.entries(p.application.team||{}).map(([role,t])=>'<p>'+esc(t.name)+' · '+esc(window.PermitAssistant.roles[role])+' · '+esc(p.property.address)+' '+button('reuse-role','Use for this project',p.id+'|'+role)+'</p>').join('')).join('')||'<p>No saved team profiles in your other projects yet.</p>';
      }
      else if(a==='reuse-role') {const [pid,role]=id.split('|'),source=reusableProjects.find(p=>p.id===pid);if(!source?.application.team?.[role])throw Error('Choose a saved team profile.');await commit({...source.application.team[role],type:'team_profile',role,confirmed:true});message('Team profile reused. Confirm the appointment and current credentials before filing.');}
      else if(a==='lookup-license') {
        const t=project.application.team?.[id];if(!t?.license)throw Error('Save a license number first.');if(!window.CloudSync.signedIn())throw Error('Sign in for the public-registry lookup, or use the official verification link.');
        const response=await fetch('/api/projects?action=license-lookup&license='+encodeURIComponent(t.license),{headers:window.CloudSync.auth()});const r=await response.json();if(!response.ok)throw Error(r.error||'Lookup unavailable');await commit({type:'license_check',role:id,license:t.license,summary:r.summary});
      }
      else if(a==='extract-permit-local'||a==='extract-permit-claude'||a==='analyze-project-plan') {
        const documentId=a==='analyze-project-plan'?id:host.querySelector('#city-source-doc')?.value;
        if(a!=='analyze-project-plan'&&!host.querySelector('#city-source-scope')?.checked)throw Error('Confirm that the document describes the proposed work for this permit type.');
        const permitType=a==='analyze-project-plan'?'project':project.application.cityInspect?.typeId;
        await saveCityPage();const d=project.documents.find(x=>x.id===documentId);if(!d)throw Error('Choose a PDF first.');
        window.AnalysisProgress.start('pw-message',a==='extract-permit-local'?'local':'plans');
        let result;
        if(a==='extract-permit-local'){
          const blob=await S.file(d.id);if(!blob)throw Error('Document is unavailable on this device.');
          const read=await window.PlanReader.read(new File([blob],d.name,{type:'application/pdf'}));
          result={documentId:d.id,documentHash:d.hash,filename:d.name,method:'Direct extraction',facts:(read.permitFacts||[]).map(f=>({...f,documentId:d.id,documentHash:d.hash})),at:new Date().toISOString(),notice:read.textChars<50?'No readable text; scanned pages need visual review.':''};
        }else{
          if(!window.CloudSync.signedIn())throw Error('Sign in to use Claude. Read without AI works on this device.');
          await window.ProjectSync.enqueue(project.id);
          if(window.ProjectSync.status(project).state!=='saved')throw Error('Wait for this project and its document to finish syncing, then retry.');
          const response=await fetch('/api/projects?action=permit-extraction',{method:'POST',headers:{...window.CloudSync.auth(),'Content-Type':'application/json'},body:JSON.stringify({projectId:project.id,documentId:d.id}),signal:AbortSignal.timeout(300000)});
          result=await response.json();if(!response.ok)throw Error(result.error||'Document extraction failed');
        }
        result.permitType=permitType;await commit({type:'document_extraction',result});let savedNote='Saved on this device.';if(window.CloudSync.signedIn()){await window.ProjectSync.enqueue(project.id);savedNote=window.ProjectSync.status(project).state==='saved'?'Saved to your account.':'Saved on this device; account sync is pending.';}message(result.facts.length+' candidate facts found. '+savedNote+' Review citations and scope before filing.');
      }
      else if(a==='read-originals') {
        const next=JSON.parse(JSON.stringify(project)),manifest=next.report.facts.publicResearch?.titleResearch?.acquisition;
        if(!manifest)throw Error('Refresh public research to discover document sources.');
        message('Reading public originals sequentially. This run saves up to 20 pages; remaining cursors are retained.');
        let revision=project.revision;
        await window.OriginalDocuments.drain(manifest,async(url,page)=>{
          const response=await fetch((window.LR_DATA.apiBase||'')+'/api/original-document?url='+encodeURIComponent(url)+'&page='+page+'&v='+encodeURIComponent(window.LR_DATA.apiVersion||''),{signal:AbortSignal.timeout(170000)});
          const data=await response.json();if(!response.ok)throw Error(data.error||'Document service unavailable');return data;
        },{maxPages:20,onProgress:async()=>{}});
        const finding=(next.report.findings||[]).find(f=>f.item==='Automatic original-document reading');if(finding)finding.headline=manifest.processing.processedDocuments+' of '+manifest.documents.length+' candidate documents processed';
        next.revision=revision+1;next.updatedAt=new Date().toISOString();
        await S.save(next,revision);project=next;render();
      }
      else if(a==='permit-hub'){await saveCityPage();tab='filing';section='filing';render();window.scrollTo(0,0);}
      else if(a==='projects') {await saveCityPage();await list();}
      else if(a==='open') {message('Opening saved project…');await openSaved(id);}
      else if(a==='tab'||a==='filing'||a==='management') {await saveCityPage();tab=a==='tab'?id:a;if(['filing','management'].includes(tab))section=tab;else if(['evidence','valuation','placement'].includes(tab))section='site';render();}
      else if(a==='refresh-evidence') {document.body.classList.remove('show-project');window.dispatchEvent(new CustomEvent('cornerpin:refresh',{detail:project.report}));}
      else if(a==='home') {document.body.classList.remove('show-project');window.dispatchEvent(new CustomEvent('cornerpin:home'));}
      else if(a==='close') {document.body.classList.remove('show-project');if(project)window.dispatchEvent(new CustomEvent('cornerpin:restore-report',{detail:project.report}));}
      else if(a==='site') {document.body.classList.remove('show-project');window.dispatchEvent(new CustomEvent('cornerpin:restore-report',{detail:project.report}));}
      else if(a==='download-file') {const d=project.documents.find(x=>x.id===id), blob=await S.file(id);if(!blob)throw new Error('File not available in this browser.');download(d.name,blob);}
      else if(a==='city-page') {await saveCityPage();tab='draft';section='filing';cityPage=id;render();}
      else if(a==='city-download') {await saveCityPage();download('cornerpin-city-answers.txt',window.CityApplication.sheet(project),'text/plain');}
      else if(a==='city-copy') {const row=window.CityApplication.rows(project,project.application.cityInspect?.typeId).find(r=>r.key===id);if(!row||!row.value)throw Error('No saved or suggested answer to copy.');await navigator.clipboard.writeText(row.value);message('Saved answer copied. Save any edits before copying.');}
      else if(a==='export-package') await exportPackage(id);
      else if(a==='cloud-save') {await window.ProjectSync.enqueue(id||project.id);refreshSyncLabels();}
      else if(a==='cloud-restore') {project=await window.CloudSync.pull(id);capture=Promise.resolve(project);tab='overview';render();}
      else if(a==='export-backup') download('cornerpin-full-backup.json',JSON.stringify(await window.ProjectBackup.pack(project,S.file)),'application/json');
      else if(a==='export-record') download('cornerpin-project-record.json',JSON.stringify(project,null,2),'application/json');
      else if(a==='draft-assignment') {const c=project.corrections.find(x=>x.id===id); download('correction-assignment.txt','DRAFT — NOT SENT\nTo: '+c.email+'\nSubject: Permit correction — '+project.application.reference+'\n\n'+c.owner+',\n\n'+c.text+'\n\nDue: '+(c.dueDate||'Not set')+'\nPlease provide the revised sheet or report and a response addressing this comment.\n');}
    } catch(err) {message(err.message);} finally {window.AnalysisProgress.stop();busy=false;}
  });
  host.addEventListener('change',async e=>{
    if(e.target.matches('form[data-command=setback_rule] select[name=classification]')){const form=e.target.closest('form'),s=project.report.facts.zone_std||{};form.elements.feet.value=(e.target.value==='street-side'?s.street:s.side)??'';form.elements.confirmed.checked=false;return;}
    if(!e.target.matches('[data-city-type]')||busy)return;
    const permitType=e.target.value;if(!permitType){render();return;}busy=true;
    try{await saveCityPage();cityPage='primary';tab='draft';section='filing';await commit({type:'city_application',permitType});host.querySelector('.permit-draft-page')?.scrollIntoView({block:'start',behavior:'instant'});}catch(err){render();message(err.message);}finally{busy=false;}
  });
  host.addEventListener('submit', async e => {
    const f=e.target.closest('form[data-command]'); if(!f)return;e.preventDefault();if(busy)return;busy=true;
    const submit=f.querySelector('[type=submit]');submit.disabled=true;
    try {
      const data=new FormData(f);if(e.submitter?.name==='reset')data.set('reset','yes');if(e.submitter?.dataset.poolSearch)data.set('mode','placement-search');const command=Object.fromEntries(data);command.type=f.dataset.command;command.id=f.dataset.id;
      command.documentIds=data.getAll('documentIds').filter(Boolean);command.reviewed=data.has('reviewed');command.confirmed=data.has('confirmed');
      if(command.type==='city_application_page'){
        await commit(window.CityApplication.formCommand(project,data));if(e.submitter?.dataset.cityNext){cityPage=e.submitter.dataset.cityNext;render();}
        message('Application page saved. Nothing sent to CityInspect.');return;
      }
      if(command.type==='construction_valuation'){command.items=[];for(let i=0;i<40;i++)if(data.has('include_'+i))command.items.push({label:data.get('label_'+i),quantity:data.get('quantity_'+i),rate:data.get('rate_'+i),source:data.get('source_'+i)});}
      if(command.type==='review_round') command.items=W.splitComments(command.originalText);
      if(command.type==='restore-backup') {
        const file=data.get('backup');if(!file||file.size>150*1024*1024)throw Error('Choose a backup below 150 MB');const backup=await window.ProjectBackup.unpack(JSON.parse(await file.text()));project=await S.restore(backup.project,backup.files);capture=Promise.resolve(project);tab='overview';render();
      } else if(command.type==='research') {
        await commit(window.ResearchWorkspace.command(project,data));
      } else if(command.type==='upload'||command.type==='upload-plans') {
        await saveCityPage();const file=data.get('file');if(command.type==='upload-plans'&&!/\.pdf$/i.test(file?.name||''))throw Error('Choose a PDF building plan.');if(!file || !file.size)throw new Error('Choose a nonempty file.');
        if(file.size>25*1024*1024 || project.documents.reduce((n,d)=>n+(d.size||0),0)+file.size>100*1024*1024)throw new Error('Local limits: 25 MB per file and 100 MB per project.');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join(''), id=W.id();
        await commit({type:'document',document:{id,name:file.name,size:file.size,hash,role:command.type==='upload-plans'?'plan':command.role,family:command.family||id}},{id,blob:file});
        if(command.type==='upload-plans'){try{message("Plans saved. Reading printed facts…");const parsed=await window.PlanReader.read(file,(page,total)=>message("Reading plan page "+page+" of "+total+"…"),{permitOnly:true});await commit({type:'document_extraction',result:{documentId:id,documentHash:hash,filename:file.name,permitType:'project',method:'Direct extraction',facts:(parsed.permitFacts||[]).map(f=>({...f,documentId:id,documentHash:hash})),at:new Date().toISOString()}});message('Plans saved. Explicit facts are available; Analyze plans with Claude reads drawings and recommends permit scopes.');}catch(err){message('Plans saved; direct reading failed: '+err.message+'. Try Analyze plans with Claude.');}return;}
      } else await commit(command);
      message('');
    } catch(err) {message(err.message);submit.disabled=false;} finally {window.AnalysisProgress.stop();busy=false;}
  });
  window.addEventListener('cornerpin:account-changed',()=>{project=null;reusableProjects=[];capture=Promise.resolve();tab='overview';document.body.classList.remove('show-project');document.getElementById('rv-body').innerHTML='';window.dispatchEvent(new CustomEvent('cornerpin:home'));});
  window.addEventListener('cornerpin:report', e => {
    const report=JSON.parse(JSON.stringify(e.detail));capturing++;
    capture=capture.catch(()=>{}).then(async()=>{
      await window.CornerpinAccount.ready;const rows=await S.list(), key=report.parcel.county+'|'+report.parcel.id, old=rows.find(p=>p.propertyKey===key);
      const next=old?W.apply(old,{type:'sync_report',report}):W.create(report);
      await S.save(next,old?old.revision:null);return retainPublicSources(await collectChecklist(next));
    });
    capture.finally(()=>{capturing--;}).catch(err=>{const b=document.getElementById('rv-workflow');b.textContent='Permit workflow · save failed';b.title=err.message;});
  });
  document.getElementById('rv-workflow').addEventListener('click',async()=>{
    try {project=await capture;if(!project)throw new Error('Generate a site report first.');project=await S.get(project.id);tab='overview';render();window.scrollTo(0,0);}catch(err){render();message(err.message);}
  });
  window.addEventListener('cornerpin:open-workflow',async e=>{
    try {project=await capture;if(!project)throw new Error('The project is not available yet.');project=await S.get(project.id);tab=['filing','management','evidence','valuation','placement','documents','activity'].includes(e.detail?.tab)?e.detail.tab:'overview';section=['filing','management'].includes(tab)?tab:(e.detail?.section||'site');render();window.scrollTo(0,0);}catch(err){document.getElementById('rv-workflow').textContent='Project could not be saved — retry from Projects';}
  });
  window.addEventListener('cornerpin:planfile', e => {
    const file=e.detail;
    capture=capture.then(async p=>{
      if(file.size>25*1024*1024 || p.documents.reduce((n,d)=>n+(d.size||0),0)+file.size>100*1024*1024)throw new Error('Report saved, but plan file exceeds local document storage limits.');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');
      if(p.documents.some(d=>d.hash===hash && d.role==='plan'))return p;
      const prior=p.documents.filter(d=>d.role==='plan' && W.latest(p,d)).slice(-1)[0], id=W.id();
      const next=W.apply(p,{type:'document',document:{id,name:file.name,size:file.size,hash,role:'plan',family:prior?prior.family:id}});
      await S.save(next,p.revision,{id,blob:file});return next;
    });
    capture.catch(err=>{const b=document.getElementById('rv-workflow');b.textContent='Permit workflow · file save failed';b.title=err.message;});
  });
  document.getElementById('home-projects').addEventListener('click',()=>list().catch(err=>message(err.message)));
})();
