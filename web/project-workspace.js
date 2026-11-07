(function () {
  'use strict';
  const W = window.PermitWorkflow, S = window.ProjectStore;
  let project = null, tab = 'overview', busy = false, capture = Promise.resolve();
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
  function message(s) { const e = document.getElementById('pw-message'); if (e) e.textContent = s; }
  async function commit(command, file) { const next = W.apply(project, command); await S.save(next, project.revision, file); project = next; render(); }
  function overview() {
    const p = project, blocked = W.blockers(p, p.application.reference ? 'resubmission' : 'initial');
    return '<div class="pw-grid"><section class="pw-card"><h2>1. Site review</h2><p>Property evidence, plan checks and preliminary permit requirements.</p><p>Snapshot ' + p.siteVersion + ' · ' + esc(new Date(p.report.date).toLocaleDateString()) + '</p>' + button('site', 'Open site report') + '</section><section class="pw-card"><h2>2. Permit filing</h2><p>Review requirements, attach final documents, prepare the handoff and record the filing receipt.</p><p>' + (p.application.reference ? 'Application ' + esc(p.application.reference) : blocked.length + ' readiness items remain') + '</p>' + button('filing', 'Open permit filing') + '</section><section class="pw-card"><h2>3. Permit management</h2><p>Import reviewer comments, assign corrections, prepare responses and retain acceptance evidence.</p><p>' + W.openCorrections(p).length + ' open corrections · ' + p.rounds.length + ' review rounds</p>' + button('management', 'Open permit management') + '</section></div><section class="pw-card"><h2>What needs attention</h2>' + (p.corrections.filter(c => c.state !== 'accepted' && c.dueDate).map(c => '<p><strong>' + esc(c.dueDate < new Date().toISOString().slice(0,10) ? 'Overdue: ' : 'Due: ') + esc(c.dueDate) + '</strong> · ' + esc(c.owner || 'Unassigned') + ' · ' + esc(c.text) + '</p>').join('') || '<p>No correction due dates recorded.</p>') + '<p class="pw-muted">Dates appear here when you open the project. Background reminders and city monitoring are not running.</p></section>';
  }
  function filing() {
    const p = project;
    return '<section class="pw-card"><h2>Application details</h2><p>' + esc(p.application.jurisdiction || 'Permitting authority unresolved in site review') + '</p>' + form('application', '<div class="pw-grid">' + field('applicant','Applicant',p.application.applicant) + field('owner','Property owner',p.application.owner) + field('contractor','Contractor',p.application.contractor) + '</div>' + area('description','Project description',p.application.description), 'Save application details') + '<details><summary>Fields carried forward from site review</summary>' + ((((p.report.facts || {}).packet || {}).rows || []).map(r => '<p><strong>' + esc(r[0]) + ':</strong> ' + esc(r[1]) + '<br><span class="pw-muted">' + esc(r[2]) + '</span></p>').join('')) + '</details></section><section class="pw-card"><h2>Filing requirements</h2><p>Site-review suggestions are not filing approvals. Record the current evidence and who reviewed each requirement. A waiver needs a documented basis.</p>' + p.requirements.map(r => '<details><summary>' + esc(r.title) + ' <span class="pw-status">— ' + esc(human(r.state)) + (r.required ? '' : ' · optional') + '</span></summary><p>' + esc(r.detail || r.source || '') + '</p>' + form('requirement', select('state','Review status',[['reviewed','Reviewed against evidence'],['waived','Not applicable / waived with reason'],['needs_review','Needs review']],r.state) + field('reviewer','Reviewed by',r.reviewer) + area('note','Review basis / waiver reason',r.note) + docs(r.documentIds) + field('url','Source HTTPS link',r.evidenceUrl || r.sourceUrl,'url'), 'Save requirement review',r.id) + '</details>').join('') + '</section>' + '<section class="pw-card"><details><summary>Source packet: application data, drafted requests and preliminary site plan</summary><div class="pw-source-packet">' + window.CornerpinReportViews.packet((p.report.facts || {}).packet) + '</div></details></section>' + packagePanel('initial') + receiptForm();
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
    return '<section class="pw-card"><h2>Project documents</h2><p>Files are stored in this browser, separately from site-report checklist attachments. Add those files here when using them in a filing. Uploading a file does not approve a requirement.</p>' + form('upload', '<label>File (maximum 25 MB)<input type="file" name="file" required></label>' + select('role','Document role',[['plan','Building plans'],['supporting','Supporting report / approval'],['review_letter','Reviewer letter'],['receipt','Filing receipt'],['permit','Issued permit']], 'supporting') + select('family','Version of',[['','New document']].concat(project.documents.filter(d => W.latest(project,d)).map(d => [d.family,d.name + ' · next version'])),''), 'Save document') + project.documents.map(d => '<p><strong>' + esc(d.name) + '</strong> · v' + d.version + ' · ' + (W.latest(project,d) ? 'Current' : 'Superseded, retained in history') + ' · ' + esc(d.role) + ' ' + button('download-file','Download',d.id) + '</p>').join('') + '</section>';
  }
  function render() {
    document.body.classList.add('show-project');
    document.title = project ? 'Cornerpin · ' + project.property.address : 'Cornerpin · Projects';
    host.innerHTML = '<header><span class="wordmark">' + document.querySelector('#home .wordmark').innerHTML + '</span><div class="pw-actions">' + button('projects','Projects') + button('home','Review another property') + '</div></header><div id="pw-message" role="status" aria-live="polite"></div>' + (project ? '<h1>' + esc(project.property.address) + '</h1><p>' + esc(project.property.county + ' County · Parcel ' + project.property.parcelId) + ' · <strong>' + esc(human(project.stage)) + '</strong></p>' : '<h1>Projects</h1>') + '<p class="pw-warning">Saved in this browser only. Clearing browser data removes projects and files. This is not shared team storage.<br><strong>City connection not configured.</strong> No automatic filing, city updates or messages are running.</p>' + (project ? '<nav aria-label="Project sections">' + ['overview','filing','management','documents','activity'].map(t => '<button data-action="tab" data-id="' + t + '" aria-selected="' + (tab===t) + '">' + ({overview:'Overview',filing:'Permit filing',management:'Permit management',documents:'Documents',activity:'Activity'})[t] + '</button>').join('') + '</nav><div id="pw-content">' + ({overview,filing,management,documents,activity: () => '<section class="pw-card"><h2>Project history</h2><p class="pw-muted">Local working history; not a tamper-proof regulatory audit log.</p>' + button('export-record','Download project record') + '<p class="pw-muted">The JSON record contains metadata and history, not file contents. Download files under Documents; frozen package downloads include their attached files.</p>' + project.packages.map(p => '<p>' + esc(p.kind + ' · ' + p.preparedAt + (p.stale ? ' · superseded' : '') + (p.receiptId ? ' · receipt recorded' : ' · not filed')) + ' ' + button('export-package','Download this package',p.id) + '</p>').join('') + project.events.slice().reverse().map(e => '<p><strong>' + esc(e.at) + '</strong><br>' + esc(e.text) + '</p>').join('') + '</section>'})[tab]() + '</div>' : '<div id="pw-content"></div>');
  }
  async function list() { project = null; render(); const rows = await S.list(); document.getElementById('pw-content').innerHTML = rows.length ? rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>'<section class="pw-card"><h2>' + esc(p.property.address) + '</h2><p>' + esc(human(p.stage)) + ' · Updated ' + esc(new Date(p.updatedAt).toLocaleString()) + '</p>' + button('open','Open project',p.id) + '</section>').join('') : '<section class="pw-card"><h2>No saved projects yet</h2><p>Generate a site report, then select Permit workflow to start.</p></section>'; }
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
      if(a==='projects') await list();
      else if(a==='open') { project=await S.get(id);capture=Promise.resolve(project);tab='overview';render(); }
      else if(a==='tab'||a==='filing'||a==='management') {tab=a==='tab'?id:a;render();}
      else if(a==='home') {document.body.classList.remove('show-project');window.dispatchEvent(new CustomEvent('cornerpin:home'));}
      else if(a==='close') {document.body.classList.remove('show-project');if(project)window.dispatchEvent(new CustomEvent('cornerpin:restore-report',{detail:project.report}));}
      else if(a==='site') {document.body.classList.remove('show-project');window.dispatchEvent(new CustomEvent('cornerpin:restore-report',{detail:project.report}));}
      else if(a==='download-file') {const d=project.documents.find(x=>x.id===id), blob=await S.file(id);if(!blob)throw new Error('File not available in this browser.');download(d.name,blob);}
      else if(a==='export-package') await exportPackage(id);
      else if(a==='export-record') download('cornerpin-project-record.json',JSON.stringify(project,null,2),'application/json');
      else if(a==='draft-assignment') {const c=project.corrections.find(x=>x.id===id); download('correction-assignment.txt','DRAFT — NOT SENT\nTo: '+c.email+'\nSubject: Permit correction — '+project.application.reference+'\n\n'+c.owner+',\n\n'+c.text+'\n\nDue: '+(c.dueDate||'Not set')+'\nPlease provide the revised sheet or report and a response addressing this comment.\n');}
    } catch(err) {message(err.message);} finally {busy=false;}
  });
  host.addEventListener('submit', async e => {
    const f=e.target.closest('form[data-command]'); if(!f)return;e.preventDefault();if(busy)return;busy=true;
    const submit=f.querySelector('[type=submit]');submit.disabled=true;
    try {
      const data=new FormData(f), command=Object.fromEntries(data);command.type=f.dataset.command;command.id=f.dataset.id;
      command.documentIds=data.getAll('documentIds').filter(Boolean);command.reviewed=data.has('reviewed');command.confirmed=data.has('confirmed');
      if(command.type==='review_round') command.items=W.splitComments(command.originalText);
      if(command.type==='upload') {
        const file=data.get('file');if(!file || !file.size)throw new Error('Choose a nonempty file.');
        if(file.size>25*1024*1024 || project.documents.reduce((n,d)=>n+(d.size||0),0)+file.size>100*1024*1024)throw new Error('Local limits: 25 MB per file and 100 MB per project.');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join(''), id=W.id();
        await commit({type:'document',document:{id,name:file.name,size:file.size,hash,role:command.role,family:command.family||id}},{id,blob:file});
      } else await commit(command);
      message('Saved in this browser. No information was sent to the city or a project contact.');
    } catch(err) {message(err.message);submit.disabled=false;} finally {busy=false;}
  });
  window.addEventListener('cornerpin:report', e => {
    const report=JSON.parse(JSON.stringify(e.detail));
    capture=capture.catch(()=>{}).then(async()=>{
      const rows=await S.list(), key=report.parcel.county+'|'+report.parcel.id, old=rows.find(p=>p.propertyKey===key);
      const next=old?W.apply(old,{type:'sync_report',report}):W.create(report);
      await S.save(next,old?old.revision:null);return next;
    });
    capture.catch(err=>{const b=document.getElementById('rv-workflow');b.textContent='Permit workflow · save failed';b.title=err.message;});
  });
  document.getElementById('rv-workflow').addEventListener('click',async()=>{
    try {project=await capture;if(!project)throw new Error('Generate a site report first.');project=await S.get(project.id);tab='overview';render();window.scrollTo(0,0);}catch(err){render();message(err.message);}
  });
  window.addEventListener('cornerpin:open-workflow',async e=>{
    try {project=await capture;if(!project)throw new Error('The project is not available yet.');project=await S.get(project.id);tab=(e.detail||{}).tab==='filing'?'filing':'overview';render();window.scrollTo(0,0);}catch(err){document.getElementById('rv-workflow').textContent='Project could not be saved — retry from Projects';}
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
