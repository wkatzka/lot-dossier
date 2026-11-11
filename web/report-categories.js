/* Progressive disclosure for the interactive report; exported reports retain every section. */
(function () {
  'use strict';
  const labels = {land:'Land & zoning',minerals:'Mineral interests',water:'Water rights',geo:'Geologic hazards',septic:'Septic & sewer',utilities:'Utilities',access:'Access & fire',easements:'Easements',ccr:'CC&Rs & design review',survey:'Survey & terrain',permits:'Codes & loads',performance:'Home performance',pool:'Pool feasibility',plan:'Plan compatibility'};
  function mount(root) {
    const stage=document.createElement('nav');stage.className='report-chips report-section-nav';stage.setAttribute('aria-label','Site review sections');
    stage.innerHTML='<span class="report-chip" aria-current="page">Site report</span>'+[['evidence','Evidence & restrictions'],['valuation','Lot economics'],['placement','Pool layout'],['documents','Documents'],['activity','Activity']].map(([tab,label])=>'<button type="button" class="report-chip" data-workspace-tab="'+tab+'">'+label+'</button>').join('');
    stage.addEventListener('click',e=>{const b=e.target.closest('[data-workspace-tab]');if(b)window.dispatchEvent(new CustomEvent('cornerpin:open-workflow',{detail:{tab:b.dataset.workspaceTab,section:'site'}}));});
    (root.querySelector('.wrap')||root).prepend(stage);
    const groups = Array.from(root.querySelectorAll('.group[data-category]'));
    const categories = [];
    function add(key,label,nodes) { nodes=nodes.filter(Boolean); if(nodes.length)categories.push({key,label,nodes}); }
    Object.keys(labels).forEach(key=>add(key,labels[key],groups.filter(g=>g.dataset.category===key)));
    const easements=categories.find(c=>c.key==='easements'), evidence=root.querySelector('.plat-evidence');
    if(evidence) { if(easements)easements.nodes.unshift(evidence);else add('easements','Easements',[evidence]); }
    const plans=categories.find(c=>c.key==='plan'), planFacts=root.querySelector('.planfacts');
    if(planFacts) {if(plans)plans.nodes.unshift(planFacts);else add('plan','Plan compatibility',[planFacts]);}
    add('contacts','Contacts',[root.querySelector('.contacts')]);
    const next=root.querySelector('.two');
    if(next){Array.from(next.children).forEach((node,i)=>add(i?'costs':'actions',i?'Cost considerations':'Next steps',[node])); next.replaceWith(...Array.from(next.children));}
    const packet=root.querySelector('#packet');if(packet)packet.remove();
    const picker=document.createElement('section');picker.className='report-picker cp-panel';picker.innerHTML='<div class="cp-panel-head"><h2>Findings by topic</h2><p>Review open questions and compare their sources.</p></div><div class="topic-filters"><label>Search topics or evidence<input type="search" id="topic-search" placeholder="Search topics or evidence…"></label><label>Status<select id="topic-status"><option value="">All statuses</option><option value="flag">Concerns</option><option value="watch">Review</option><option value="verify">Verify</option><option value="ok">No issue identified</option></select></label><span role="status" id="topic-count"></span></div><div class="topic-table-scroll"><table class="topic-table"><thead><tr><th>Topic</th><th>Concerns</th><th>Review</th><th>Verify</th><th>No issue identified</th><th>Evidence</th><th></th></tr></thead><tbody></tbody></table></div>';
    const summary=root.querySelector('.hero2');if(!summary)return;const heading=document.createElement('div');heading.className='cp-page-heading';heading.innerHTML='<div><h2>Site review</h2><p>Public evidence, mapped conditions, and the questions still to resolve.</p></div>';summary.before(heading);summary.after(picker);
    const panel=document.createElement('div');panel.className='report-category-panel';panel.id='report-category-panel';panel.setAttribute('role','region');panel.tabIndex=-1;picker.after(panel);
    const chips=picker.querySelector('tbody');const resources=document.createElement('nav');resources.className='topic-resources';resources.setAttribute('aria-label','Related site information');picker.append(resources);
    categories.forEach(c=>{
      c.nodes.forEach(n=>panel.appendChild(n));
      const rows=c.nodes.flatMap(n=>Array.from(n.querySelectorAll('.frow'))).filter(r=>!r.closest('.source-leads'));
      c.counts=Object.fromEntries(['flag','watch','verify','ok'].map(s=>[s,rows.filter(r=>r.classList.contains('s-'+s)).length]));
      const tr=document.createElement('tr'),name=document.createElement('th');name.scope='row';name.textContent=c.label;tr.append(name);
      for(const status of ['flag','watch','verify','ok']){const td=document.createElement('td');td.className='topic-'+status;td.textContent=c.counts[status];if(!c.counts[status])td.classList.add('is-zero');tr.append(td);}
      const evidence=document.createElement('td');const leads=c.nodes.reduce((n,x)=>n+x.querySelectorAll('.source-leads .frow').length,0);evidence.textContent=rows.length+(rows.length===1?' finding':' findings')+(leads?' · '+leads+' record leads':'');tr.append(evidence);
      const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.className='topic-details';b.id='category-'+c.key;b.setAttribute('aria-controls',panel.id);b.dataset.category=c.key;b.textContent='View details';b.setAttribute('aria-label','View '+c.label+' details');td.append(b);tr.append(td);c.resource=['contacts','actions','costs'].includes(c.key);if(c.resource){b.textContent=c.label;resources.append(b);}else chips.append(tr);c.button=b;c.tableRow=tr;
      b.addEventListener('click',()=>{select(c);panel.focus({preventScroll:true});panel.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
    });
    function filter(){const term=picker.querySelector('input').value.toLowerCase(),status=picker.querySelector('select').value;let count=0;categories.forEach(c=>{const match=(!status||c.counts[status]>0)&&(c.label+' '+c.nodes.map(n=>n.textContent).join(' ')).toLowerCase().includes(term);c.tableRow.hidden=!match;if(match&&!c.resource)count++;});picker.querySelector('#topic-count').textContent=count+' topics';}
    picker.querySelector('input').addEventListener('input',filter);picker.querySelector('select').addEventListener('change',filter);filter();
    function select(current) {
      categories.forEach(c=>{const active=c===current;c.button.setAttribute('aria-selected',String(active));c.button.tabIndex=0;c.nodes.forEach(n=>n.hidden=!active);});
      panel.setAttribute('aria-labelledby',current.button.id);
    }
    chips.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const visible=categories.filter(c=>!c.resource&&!c.tableRow.hidden);if(!visible.length)return;const index=visible.findIndex(c=>c.button===document.activeElement);
      const next=e.key==='Home'?0:e.key==='End'?visible.length-1:(index+(e.key==='ArrowRight'?1:-1)+visible.length)%visible.length;
      select(visible[next]);visible[next].button.focus();
    });
    // Disclosure controls are mounted only in the interactive report.
    function disclosure(trigger, matches, after, status) {
      const drawer=document.createElement('div');drawer.className='concern-drawer';
      drawer.id='concern-drawer-'+root.querySelectorAll('.concern-drawer').length;
      const inner=document.createElement('div');drawer.append(inner);
      const scroll=document.createElement('div');scroll.className='status-findings-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Finding summaries');inner.append(scroll);
      const table=document.createElement('table');table.className='status-findings-table';table.innerHTML='<thead><tr><th scope="col">Topic / finding</th><th scope="col">Summary</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead><tbody></tbody>';scroll.append(table);
      const body=table.querySelector('tbody');let count=0;
      matches.forEach(c=>c.nodes.forEach(n=>Array.from(n.querySelectorAll('.frow')).filter(row=>!row.closest('.source-leads')&&(!status||row.classList.contains('s-'+status))).forEach(row=>{
        count++;const tr=document.createElement('tr'),name=document.createElement('th');name.scope='row';
        const topic=document.createElement('small');topic.textContent=c.label;name.append(topic);
        const title=document.createElement('span');title.textContent=row.querySelector('.item')?.textContent||c.label;name.append(title);tr.append(name);
        const summary=document.createElement('td');summary.textContent=row.querySelector('h4')?.textContent||row.querySelector('p')?.textContent||row.textContent||'Open the finding for available evidence.';tr.append(summary);
        const action=document.createElement('td'),link=document.createElement('button');link.type='button';link.textContent='View finding';link.setAttribute('aria-label','View '+title.textContent+' in '+c.label);link.dataset.findingTopic=c.key;
        link.addEventListener('click',()=>{select(c);row.tabIndex=-1;row.focus({preventScroll:true});row.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});action.append(link);tr.append(action);body.append(tr);
      })));
      if(!count){scroll.replaceChildren();const empty=document.createElement('p');empty.textContent='No findings in this status.';scroll.append(empty);}
      (after||trigger).after(drawer);drawer.inert=true;
      trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',drawer.id);
      trigger.addEventListener('click',()=>{const open=trigger.getAttribute('aria-expanded')!=='true';
        root.querySelectorAll('.concern-drawer.is-open').forEach(d=>{d.classList.remove('is-open');d.inert=true;const t=root.querySelector('[aria-controls="'+d.id+'"]');if(t)t.setAttribute('aria-expanded','false');});
        drawer.classList.toggle('is-open',open);drawer.inert=!open;trigger.setAttribute('aria-expanded',String(open));});
    }
    root.querySelectorAll('.tally > div').forEach(tile=>{
      const status=['flag','watch','verify','ok'].find(s=>tile.classList.contains('t-'+s));
      const button=document.createElement('button');button.type='button';button.className=tile.className+' tally-trigger';button.innerHTML=tile.innerHTML;tile.replaceWith(button);
      disclosure(button,categories.filter(c=>c.nodes.some(n=>Array.from(n.querySelectorAll('.frow.s-'+status)).some(row=>!row.closest('.source-leads')))),button.parentElement,status);
    });
    root.querySelectorAll('[data-concern-category]').forEach(item=>{
      const button=document.createElement('button');button.type='button';button.className='concern-trigger';
      while(item.firstChild)button.append(item.firstChild);item.append(button);
      disclosure(button,categories.filter(c=>c.key===item.dataset.concernCategory));
    });
    if(categories.length)select(categories[0]);
    root.querySelectorAll('a[href="#packet"]').forEach(a=>{a.textContent='Open permit preparation →';});
  }
  document.addEventListener('click',e=>{
    const a=e.target.closest('#rv a[href="#packet"]');if(!a)return;e.preventDefault();
    window.dispatchEvent(new CustomEvent('cornerpin:open-workflow',{detail:{tab:'filing'}}));
  });
  window.ReportCategories={mount};
})();
