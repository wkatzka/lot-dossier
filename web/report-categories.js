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
    const picker=document.createElement('section');picker.className='report-picker';picker.innerHTML='<h2>Explore the site report</h2><p>Select a category to view its findings, sources and outstanding items.</p><div class="report-chips" role="tablist" aria-label="Site report categories"></div>';
    const summary=root.querySelector('.hero2');if(!summary)return;summary.after(picker);
    const panel=document.createElement('div');panel.className='report-category-panel';panel.id='report-category-panel';panel.setAttribute('role','tabpanel');panel.tabIndex=0;picker.after(panel);
    const chips=picker.querySelector('.report-chips');
    categories.forEach(c=>{
      c.nodes.forEach(n=>panel.appendChild(n));
      const b=document.createElement('button');b.type='button';b.className='report-chip';b.id='category-'+c.key;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.dataset.category=c.key;
      const count=c.nodes.reduce((n,x)=>n+x.querySelectorAll('.frow').length,0);
      b.textContent=c.label+(count?' · '+count:'');chips.appendChild(b);c.button=b;
      b.addEventListener('click',()=>select(c));
    });
    function select(current) {
      categories.forEach(c=>{const active=c===current;c.button.setAttribute('aria-selected',String(active));c.button.tabIndex=active?0:-1;c.nodes.forEach(n=>n.hidden=!active);});
      panel.setAttribute('aria-labelledby',current.button.id);
    }
    chips.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const index=categories.findIndex(c=>c.button===document.activeElement);
      const next=e.key==='Home'?0:e.key==='End'?categories.length-1:(index+(e.key==='ArrowRight'?1:-1)+categories.length)%categories.length;
      select(categories[next]);categories[next].button.focus();
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
