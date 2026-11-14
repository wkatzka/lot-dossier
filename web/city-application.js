/* Observed city forms, with explicit provenance. No portal writes or submissions. */
(function(root){
  'use strict';
  const catalog=typeof module!=='undefined'&&module.exports?require('../data/permits/ogden-valley-cityinspect.json'):(root.LR_DATA||{}).cityInspect;
  const Facts=typeof module!=='undefined'&&module.exports?require('./permit-facts'):root.PermitFacts;
  const Assistant=typeof module!=='undefined'&&module.exports?require('./permit-assistant'):root.PermitAssistant;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const IR=typeof module!=='undefined'&&module.exports?require('./input-rules'):root.InputRules;
  const Reviews=typeof module!=='undefined'&&module.exports?require('./answer-reviews'):root.AnswerReviews;
  let renderedProject=null;
  const titles={primary:'Property & application',professionals:'Designers & contractors',building:'Building details',attachments:'Documents & acknowledgments'};
  const supported=p=>p.report?.facts?.jurisdiction===catalog.jurisdiction;
  const getType=id=>catalog.types.find(t=>t.value===String(id));
  const locked=f=>f.type==='file'||f.type==='checkbox'||f.name==='permit_type'||/^other\d+$/.test(f.name);
  function candidate(p,t,section,f){
    const r=p.report||{},a=r.parcel?.attrs||{},fx=r.facts||{},pl=r.plan||{},app=p.application||{};
    const help={application_date:'Date of this application. Use the city’s required date format when filing.',nickname:'A short name that identifies this proposed project.',phase:'Recorded subdivision phase; use the plat or legal description, not the construction phase.',notify_contact:'Choose whether this contact should receive inspection emails.',owner_builder:'Choose the displayed name (Builder or Owner). This is not an owner-builder certification.',is_corner:'Whether the parcel is a corner lot. Confirm street frontage because street-side setbacks may apply.',num_units:'Number of dwelling or occupancy units included in this application.',num_buildings:'Number of buildings included in this application.',bedrooms:'Bedrooms in the proposed work; reconcile with the final plan and septic capacity if applicable.',stories:'Number of proposed stories; confirm against the submitted floor plans.',construction_material:'Construction material or system specified in the plans.',max_occupancy:'Design occupant load for the proposed use, established from the applicable code and plans.'};
    let value='',basis=help[f.name]||'Enter information for this application scope.';
    if(/license$/.test(f.name))basis='License number for the contractor doing this work. Verify the license is current and covers the trade.';
    if(/phone|email/.test(f.name)&&f.name!=='notify_contact')basis='Current contact information for the person or company named in this section. Confirm they are the intended contact.';
    if(/^(main_floor|second_floor|third_floor|fourth_floor|basement|unfin_basement|patio|garage_footage|other_footage)$/.test(f.name))basis='Area for this part of the proposed work, from the plans. Confirm the city’s units and separate finished, unfinished and garage areas; total house area cannot replace a floor area.';
    if(/^(engineer_record|design_professional|builder_name|electrical_name|mechanical_name|plumbing_name)$/.test(f.name))basis='Person or company responsible for this role on this project. Confirm the appointment and required credentials.';

    const sourced={property_address:a.PARCEL_ADD,tax_id:r.parcel?.id,subdivision:a.SUBDIV_NAME,lot_no:fx.parcelDoc?.lot,zone:fx.zone,latitude:r.parcel?.cy,longitude:r.parcel?.cx};
    if(section==='primary'&&Object.hasOwn(sourced,f.name)){value=sourced[f.name]??'';basis='Saved site report: parcel / jurisdiction records. Confirm against the city form.';}
    const manual={contact_name:app.applicant,ownername:app.owner,buildername:app.contractor,builder_name:app.contractor,description:app.description};
    if(Object.hasOwn(manual,f.name)){value=manual[f.name]??'';basis='Saved application details; confirm identity and scope.';}
    const ownerRecord=fx.ownerRecord,ownerTarget=app.team?.owner?.name||app.owner||fx.owner;
    const sameOwner=ownerRecord&&ownerTarget&&String(ownerTarget).replace(/[^a-z0-9]/gi,'').toLowerCase()===String(ownerRecord.name).replace(/[^a-z0-9]/gi,'').toLowerCase();
    const mailKey={owner_address:'address',owner_city:'city',owner_state:'state',owner_zip:'zip'}[f.name];
    if(section==='primary'&&mailKey&&sameOwner&&ownerRecord.mailing?.[mailKey]){value=ownerRecord.mailing[mailKey];basis='County owner mailing record for '+ownerRecord.name+' · '+ownerRecord.source+' · retrieved '+ownerRecord.retrievedAt+'. Mailing address, not project location; confirm current ownership before filing.';}
    if(f.name==='phase'){const phase=String(fx.parcelDoc?.legal||a.SUBDIV_NAME||'').match(/\bPHASE\s+([0-9]+|[IVX]+)\b/i);if(phase){value=phase[1];basis='Phase explicitly named in the recorded legal description / subdivision record. Confirm the current plat.';}}
    if(f.name==='permit_type'){value=t.value;basis='Selected application type: '+t.label;}
    if(section==='building'&&f.name==='lot_footage'&&Number(fx.lot_sf)>0){value=Math.round(fx.lot_sf);basis='Calculated lot area from saved site report (square feet); approximate, verify against survey.';}
    if(section==='building'&&t.value==='1'){
      const key={garage_footage:'garage_sf',bedrooms:'bedrooms',stories:'stories'}[f.name];
      if(key&&(!pl.filename||!p.documents.some(d=>d.role==='plan')||p.documents.some(d=>d.role==='plan'&&d.name===pl.filename&&!p.documents.some(x=>x.family===d.family&&x.version>d.version)))&&(pl[key]??pl.footprint?.[key])!=null){value=pl[key]??pl.footprint?.[key];basis='Uploaded/entered plan: '+key+'. Confirm this is the proposed dwelling. '+(typeof pl.src?.[key]==='string'?pl.src[key]:'');}
    }
    if(f.name==='builder_valuation')basis='Construction valuation for this permit scope is required. Land market value and assessed value are not construction valuation.';
    if(/_set_back_default$/.test(f.name))basis='Actual proposed distance from the applicable property boundary, from a dimensioned site plan. Zoning minima are not actual setbacks.';
    if(/_set_back$/.test(f.name))basis='Confirm the minimum applicable to this structure and boundary. House rules may not apply to pools, fences or accessory structures.';
    if(/_(approved|date|info)$/.test(f.name)&&/^(fire|zoning|health|water|geotechnical)_/.test(f.name))basis='Use the actual department approval and date; a site screening result is not an approval.';
    if(f.name==='area')basis='The portal does not state units here. Confirm units before entering a value.';
    if(f.type==='file')basis='Provide the applicable document through the city portal. Existing project files are not automatically certified as satisfying this requirement.';
    if(/^other\d+$/.test(f.name)||f.type==='checkbox')basis='Complete personally in the city portal after reading the full statement. Cornerpin does not provide initials or acknowledgments.';
    if(section==='building'&&t.value==='1'&&['front_set_back','rear_set_back'].includes(f.name)){
      const side=f.name==='front_set_back'?'front':'rear',minimum=fx.zone_std?.[side];
      if(minimum!=null&&Number.isFinite(Number(minimum))&&Number(minimum)>=0){value=minimum;basis='Saved zoning/development standards: minimum '+side+' setback in feet. Confirm the applicable frontage and controlling plat or amendments. This is not the actual proposed distance.';}
    }
    if(['primary','building','professionals'].includes(section)&&Facts){
      const factName=({buildername:'builder_name',ownername:'owner_name',owneremail:'owner_email'})[f.name]||f.name;
      const fact=Facts.selected(p,factName,t.value),all=Facts.available(p,t.value).filter(x=>x.field===factName);
      if(all.some(x=>x.conflict)){value='';basis='Conflicting or unvalidated document values: '+all.map(x=>x.value+' '+x.unit+' (page '+x.page+')').join('; ')+'. Reconcile the current plans before using this field.';}
      else if(fact){value=fact.value;basis=(fact.method==='claude_visual_extraction'?'CornerpinAI drawing suggestion — review visually':fact.method==='claude_extraction'?'CornerpinAI suggestion':'Explicit plan text')+' · '+(fact.filename||'Uploaded plan')+', page '+fact.page+(fact.sheet?' / '+fact.sheet:'')+(fact.region?' / '+fact.region:'')+': “'+fact.quote+'” · '+fact.unit+(fact.components?.length?' · Counted components: '+fact.components.map(c=>c.label+' ['+c.identity+'], page '+c.page+', '+c.region+' (weight '+c.weight+')').join('; '):'')+'. Confirm this document applies to the proposed permit work.';}
    }
    const contactFact=Facts?.selected(p,f.name,t.value);if(contactFact?.method==='public_company_contact'&&value!=='')basis='Public company contact: '+contactFact.sourceURL+' · retrieved '+contactFact.retrievedAt+'. Matched the design firm and phone printed in '+contactFact.filename+', page '+contactFact.page+'. General office email; confirm the intended application contact.';
    if(value===''&&Facts){const audit=Facts.auditFor(p,f.name,t.value);if(audit)basis+=' CornerpinAI document review: '+audit.reason+(audit.pages.length?' ('+audit.filename+', pages '+audit.pages.join(', ')+')':'');}
    const extra=Assistant?.candidate(p,t,section,f);if(extra&&(value===''||Assistant.profileForField(f.name))){value=extra.value;basis=extra.basis;}
    const valuation=p.application.valuations?.[t.value];if(f.name==='builder_valuation'&&valuation&&!valuation.stale){value=valuation.total;basis='User-reviewed construction estimate: '+valuation.items.map(x=>x.label+' '+x.quantity+' × $'+x.rate+' = $'+x.amount+' ('+x.source+')').join('; ')+'. Not land value or city-approved valuation.';}
    return {value:String(value??''),basis};
  }
  function rows(p,id){
    if(!supported(p))return [];
    const t=getType(id);if(!t)return [];
    return Object.entries(t.sections).flatMap(([section,keys])=>keys.map(key=>{
      const f=catalog.fields[key],rowId=section+'.'+key,c=candidate(p,t,section,f),saved=p.application.cityInspect?.answers?.[t.value]?.[rowId];
      const row={...f,section,key:rowId,locked:locked(f),value:saved?saved.value:c.value,basis:saved?saved.basis:c.basis,guidance:c.basis,
        status:saved?(saved.siteVersion===p.siteVersion&&(saved.planVersion||0)===(p.planVersion||0)?'User supplied · review before filing':'Site or plans changed · review saved answer'):(c.value!==''?'Suggested · review before filing':(f.type==='file'?'Document needed':locked(f)&&f.name!=='permit_type'?'Complete in city portal':'Answer needed'))};
      row.review=Reviews.status(p,row,t.value);
      // Answers taken unchanged from team details the user confirmed (e.g. their saved company) need no second check.
      if(!saved&&row.review.state==='unreviewed'&&/^Confirmed project team/.test(c.basis)&&row.value!==''){row.review={...row.review,state:'confirmed'};row.status='From your team details';return row;}
      if(row.review.state!=='unreviewed')row.status=({confirmed:'Confirmed',rejected:'Rejected · replace this answer','needs-evidence':'Needs evidence',stale:'Stale · review again'})[row.review.state];return row;
    }));
  }
  function readiness(p,id){
    const list=rows(p,id).filter(r=>!r.locked),missing=list.filter(r=>(r.required||r.markedRequired)&&!String(r.value).trim()),unreviewed=list.filter(r=>String(r.value).trim()&&r.review.state!=='confirmed');
    return {missing,unreviewed,issues:[...missing.map(r=>r.label+': required answer missing.'),...unreviewed.map(r=>r.label+': '+r.review.state+' answer: open this field in Permit Preparation, inspect its supporting evidence, then confirm or correct the answer.')]};
  }
  function update(p,a){
    if(!supported(p))throw Error('Exact form mapping is currently available for Ogden Valley City Building Permits only.');
    const t=getType(a.permitType);if(!t)throw Error('Choose a mapped permit type.');
    if(a.entries){
      if(!Array.isArray(a.entries)||a.entries.length>200)throw Error('Invalid application fields.');
      let next={...p,application:{...p.application,cityInspect:update(p,{permitType:a.permitType})}};
      for(const entry of a.entries) next.application.cityInspect=update(next,{...entry,permitType:a.permitType});
      return next.application.cityInspect;
    }
    const state=JSON.parse(JSON.stringify(p.application.cityInspect||{answers:{}}));state.typeId=t.value;state.schemaDate=catalog.observedAt;
    state.answers=state.answers||{};
    if(a.fieldKey){
      const row=rows(p,t.value).find(r=>r.key===a.fieldKey);if(!row||row.locked)throw Error('This field must be completed in the city portal.');
      const value=String(a.value??'').trim(),basis=String(a.basis??'').trim();
      if(value.length>Math.min(row.maxLength||10000,10000))throw Error('Answer exceeds the field length limit.');
      if(value&&row.options&&!row.options.some(o=>o.value===value))throw Error('Choose an option from the city form.');
      if(value&&!row.options&&IR){const rr=IR.rule(row.label,row.name,row.type);if(rr&&row.type==='number'&&row.min!=null)rr.min=Number(row.min);if(rr&&row.type==='number'&&row.max!=null)rr.max=Number(row.max);const err=IR.check(value,rr);if(err)throw Error((row.label||'This answer').replace(/:\s*$/,'')+': '+err);}
      if(value&&row.type==='number'&&!Number.isFinite(Number(value)))throw Error('Enter a number.');
      if(value&&!basis)throw Error('Record the source or basis for this answer.');
      state.answers[t.value]=state.answers[t.value]||{};
      if(a.reset==='yes')delete state.answers[t.value][row.key];
      else state.answers[t.value][row.key]={value,basis,siteVersion:p.siteVersion,planVersion:p.planVersion||0};
    }
    return state;
  }
  function sheet(p){
    const id=p.application.cityInspect?.typeId,t=getType(id);if(!supported(p)||!t)throw Error('Choose and save an application type first.');
    return ['CORNERPIN — APPLICATION ANSWER SHEET — NOT SUBMITTED',t.label+' · '+catalog.jurisdiction,p.property.address,'Form observed '+catalog.observedAt+' · '+catalog.source,'Review all answers in the current portal. Conditional rules and final submission validation may differ.',''].concat(rows(p,id).map(r=>titles[r.section]+' / '+r.label+' ['+r.name+']\n'+(r.value===''?'[UNANSWERED]':r.options?.find(o=>o.value===r.value)?.label||r.value)+'\n'+r.status+'\nBasis: '+r.basis+'\n')).join('\n');
  }
  function extractionPanel(p){
    const documents=(p.documents||[]).filter(d=>['plan','site_plan','structural','engineering','truss_layout','truss_specs','energy'].includes(d.role)&&/\.pdf$/i.test(d.name)&&!p.documents.some(x=>x.family===d.family&&x.version>d.version));
    return '<div class="city-extraction"><h3>Fill from proposed-work documents</h3><p>Cornerpin can read your plans to fill in answers. You check each one before it counts.</p>'+(documents.length?'<label for="city-source-doc">Source document</label><select id="city-source-doc">'+documents.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('')+'</select><button type="button" data-action="view-selected-document">View raw document</button><label><input type="checkbox" id="city-source-scope" aria-describedby="city-scope-error"> This document describes the proposed work for this permit type.</label><p id="city-scope-error" class="city-inline-error" role="alert" hidden></p><div class="pw-actions"><button type="button" data-action="extract-permit-local">Read without AI</button><button type="button" data-action="extract-permit-claude">Find remaining answers with CornerpinAI</button></div><div class="analysis-inline" id="permit-analysis-status" role="status" aria-live="polite"></div><p class="pw-muted">CornerpinAI sends the selected PDF, including drawings, to Anthropic. Cached results are reused; no city submission occurs. Extracted answers stay with the permit type you selected.</p>':'<p>No proposed building plans uploaded. Public surveys describe site evidence, not a proposed house. Upload proposed plans in Permit Preparation to extract building quantities.</p>')+'<p>Looking for existing surveys or plats? <button type="button" data-action="public-records">Open public records &amp; site evidence</button></p>'+((p.application.documentExtractions||[]).filter(x=>x.permitType!=='site_reference').map(x=>'<p class="pw-muted">'+esc(x.filename)+': '+x.facts.length+' candidates · '+esc(String(x.method||'').replace(/Claude/gi,'CornerpinAI'))+(x.cacheHit?' · cached':'')+(x.estimatedUSD!=null?' · '+(x.cacheHit?'$0 additional CornerpinAI cost (cached)':'CornerpinAI usage estimate $'+Number(x.estimatedUSD).toFixed(4)):'')+(x.notice?' · '+esc(String(x.notice||'').replace(/Claude/gi,'CornerpinAI')):'')+'</p>').join(''))+'</div>';
  }
  function formCommand(p,data){
    const permitType=data.get('permitType'),list=rows(p,permitType),entries=[];
    for(const r of list){
      if(r.locked||!data.has('answer:'+r.key))continue;
      const value=String(data.get('answer:'+r.key)??'').trim();
      if(value===r.value)continue;
      entries.push({fieldKey:r.key,value,basis:'User-entered application answer. Confirm against the supporting plans or records before filing.'});
    }
    return {type:'city_application',permitType,entries};
  }
  let showAll=false;
  function setShowAll(v){showAll=!!v;}
  function render(p,page='primary'){
    renderedProject=p;
    if(!supported(p))return '<section class="pw-card"><h2>City application</h2><p>Exact field mapping is currently available for Ogden Valley City Building Permits. Other jurisdictions need their own form mapping.</p></section>';
    const id=p.application.cityInspect?.typeId||'',t=getType(id),rs=rows(p,id);
    if(!titles[page])page='primary';
    const groups=[...new Set(catalog.types.map(x=>x.group))];
    let html='<section class="pw-card city-application"><label for="city-permit-type">Permit type</label><select id="city-permit-type" data-city-type><option value="">Choose application type</option>'+groups.map(g=>'<optgroup label="'+esc(g)+'">'+catalog.types.filter(x=>x.group===g).map(x=>'<option value="'+x.value+'"'+(x.value===id?' selected':'')+'>'+esc(x.label)+'</option>').join('')+'</optgroup>').join('')+'</select>';
    if(t){
      const editable=rs.filter(r=>!r.locked),filled=editable.filter(r=>r.value!==''),suggested=filled.filter(r=>r.status.startsWith('Suggested')),supplied=filled.filter(r=>r.review.state==='confirmed'),stale=filled.filter(r=>r.review.state==='stale'||r.status.startsWith('Site or plans changed'));
      const ready=readiness(p,id);
      const blank=r=>String(r.value??'').trim()==='',req=r=>r.required||r.markedRequired;
      // What needs the user: required blanks and filled answers not yet checked. Blank optional questions are shown separately — never hidden as "done".
      const needs=r=>!r.locked&&(blank(r)?req(r):r.review.state!=='confirmed');
      const optionalBlank=r=>!r.locked&&blank(r)&&!req(r)&&r.type!=='file'&&r.name!=='permit_type';
      const all=rs.filter(r=>r.section===page),list=showAll?all:all.filter(needs),opt=showAll?[]:all.filter(optionalBlank),hiddenCount=all.length-list.length-opt.length;
      const elsewhere=Object.keys(titles).filter(k=>k!==page&&rs.some(r=>r.section===k&&needs(r)));
      const stat=(n,label,hint)=>'<div><strong>'+n+'</strong><span>'+label+'</span>'+(hint?'<small>'+hint+'</small>':'')+'</div>';
      html+='<div class="application-stats cp-app-stats">'+stat(ready.missing.length,'Required questions to answer',ready.missing.length?'The city needs these before you can submit':'')+stat(ready.unreviewed.length,'Answers Cornerpin filled in for you to check',ready.unreviewed.length?'Open each and confirm or correct it':'')+stat(supplied.length,'Answers checked','')+'</div><div class="application-workspace"><aside class="application-sections"><p class="cp-eyebrow">Form pages</p>';
      const pageCount=k=>rs.filter(r=>r.section===k&&needs(r)).length;
      html+='<nav class="city-pages" aria-label="Application pages">'+Object.keys(titles).map((key,i)=>{const n=pageCount(key);return '<button type="button" data-action="city-page" data-id="'+key+'" aria-current="'+(key===page?'step':'false')+'"><span>'+(i+1)+'. '+titles[key]+'</span>'+(n?'<em class="cp-page-count">'+n+'</em>':'<em class="cp-page-done" aria-label="Nothing needs you">✓</em>')+'</button>';}).join('')+'</nav><p class="cp-app-key">* = required by the city</p><a href="#application-documents">Fill answers from a plan document +</a></aside>';
      const field=r=>{
        const inputId='city-'+r.key,name='answer:'+r.key,current=esc(r.value),required=req(r);
        const fact=Facts?.selected(p,r.name,id),doc=fact&&((p.documents||[]).find(d=>d.id===fact.documentId)||(p.documents||[]).find(d=>d.name===fact.filename&&!p.documents.some(x=>x.family===d.family&&x.version>d.version)));
        const source=doc?'<div class="field-source-document"><p>'+esc(doc.name)+' · version '+doc.version+(fact.page?' · page '+esc(fact.page):'')+'</p><button type="button" data-action="download-file" data-id="'+esc(doc.id)+'">Open source document</button></div>':'';
        let out='<div data-evidence-key="'+esc(r.key)+'" class="city-field'+(r.type==='textarea'||r.type==='file'?' city-wide':'')+'"><label for="'+inputId+'">'+esc(r.label)+(required?' *':'')+'</label>';
        const attrs=' id="'+inputId+'" name="'+name+'" aria-describedby="'+inputId+'-note"';
        if(r.name==='permit_type')out+='<input'+attrs+' value="'+esc(t.label)+'" readonly>';
        else if(r.type==='file')out+='<input'+attrs+' type="file" disabled><p><button type="button" data-action="tab" data-id="documents">Manage project documents</button></p>';
        else if(r.locked)out+='<input'+attrs+' value="" disabled placeholder="Complete in CityInspect">';
        else if(r.options)out+='<select'+attrs+'><option value="">Not answered</option>'+r.options.filter(o=>o.value!=='').map(o=>'<option value="'+esc(o.value)+'"'+(o.value===r.value?' selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>';
        else if(r.type==='textarea')out+='<textarea'+attrs+' maxlength="'+Math.min(r.maxLength||10000,10000)+'">'+current+'</textarea>';
        else if(r.type==='number'){const rr=IR?IR.rule(r.label,r.name,'number'):null,money=rr?.unit==='$',unit=money?'':(rr?.unit||'');out+='<div class="cp-num'+(money?' cp-num-money':'')+'">'+(money?'<span class="cp-num-pre">$</span>':'')+'<input'+attrs+' type="number" inputmode="decimal" step="any" min="'+esc(r.min??0)+'"'+(r.max!=null?' max="'+esc(r.max)+'"':'')+' value="'+current+'">'+(unit?'<span class="cp-num-unit">'+unit+'</span>':'')+'</div>';}
        else out+='<input'+attrs+(IR?IR.attrs(IR.rule(r.label,r.name,r.type)):'')+' type="'+(r.type==='number'?'number':((IR&&IR.rule(r.label,r.name,r.type)||{}).inputType||'text'))+'"'+(r.type==='number'?' step="any"':'')+(r.min!=null?' min="'+esc(r.min)+'"':'')+(r.max!=null?' max="'+esc(r.max)+'"':'')+' maxlength="'+Math.min(r.maxLength||10000,10000)+'" value="'+current+'">';
        const note=blank(r)&&!required?'':'<p>'+esc(r.basis)+(r.guidance!==r.basis?'<br>'+esc(r.guidance):'')+'</p>';
        return out+'<div id="'+inputId+'-note" class="city-note"><span class="city-answer-state cp-ans-'+(blank(r)?(required?'req':'opt'):r.review.state==='confirmed'?'ok':/^Suggested/.test(r.status)?'sug':'user')+'">'+esc(blank(r)?(required?'Required — not answered yet':'Optional — leave blank if it doesn’t apply'):/^Suggested/.test(r.status)?'Filled in by Cornerpin · not checked yet':/^User supplied/.test(r.status)?'Your answer':r.status)+'</span>'+note+source+'</div>'+(blank(r)?'':'<button type="button" class="field-evidence-button" data-field-evidence="'+esc(r.key)+'">'+(r.review.state==='confirmed'?'See source':'Check this answer →')+'</button>')+'</div>';
      };
      html+='<form data-command="city_application_page"><input type="hidden" name="permitType" value="'+id+'"><fieldset><legend>'+titles[page]+'</legend><div class="city-fields" tabindex="0" role="region" aria-label="Application fields">';
      let msg;
      if(showAll)msg='Showing all '+all.length+' fields on this page. <button type="button" data-action="city-show-all" data-id="0">Show only what needs me</button>';
      else{
        msg=list.length?'Showing '+list.length+' question'+(list.length===1?'':'s')+' that need you.':opt.length?'No required questions on this page. '+opt.length+' optional question'+(opt.length===1?' is':'s are')+' blank: fill in any that apply.':'Everything on this page is answered and checked.';
        if(!list.length&&elsewhere.length)msg+=' <button type="button" class="cp-go" data-action="city-page" data-id="'+elsewhere[0]+'">Next: '+titles[elsewhere[0]]+' ('+pageCount(elsewhere[0])+' to do) →</button>';
        if(hiddenCount)msg+=' <button type="button" data-action="city-show-all" data-id="1">Show all '+all.length+' fields</button>';
      }
      html+='<div class="city-filter">'+msg+'</div>';
      if(page==='professionals'&&!showAll&&root.MyCompany&&!root.MyCompany.get())html+='<div class="cp-app-company"><p><b>Building it yourself, or hiring a contractor?</b> Add your company once and Cornerpin fills in the contractor questions on every permit.</p><button type="button" data-action="my-company">Add my company details</button></div>';
      if(!all.length)html+='<p>No fields were displayed during inspection. Requirements remain unconfirmed.</p>';
      html+=list.map(field).join('');
      // Long runs of blank optional questions are grouped by who they're about (engineer, plumber…), each folded.
      const ROLE=/^(Engineer of Record|Design Professional|Builder|General Contractor|Electrical|Mechanical|Plumbing|Owner|Applicant|Architect)/i,NICE={electrical:'Electrical contractor',mechanical:'Mechanical contractor',plumbing:'Plumbing contractor','engineer of record':'Engineer of record','design professional':'Design professional (architect or designer)'};
      const groupsOf=rows=>{const out=[];let cur=null;for(const r of rows){const m=ROLE.exec(String(r.label||''));const k=m?m[1].toLowerCase():cur?cur.key:'other';if(!cur||cur.key!==k){cur={key:k,label:NICE[k]||(m?m[1]:'Other questions'),rows:[]};out.push(cur);}cur.rows.push(r);}return out;};
      const optHtml=rows=>{const gs=groupsOf(rows);if(rows.length<=6||gs.length<2)return rows.map(field).join('');return '<p class="city-optional-hint">Open only the people on your project. Leave the rest blank.</p>'+gs.map(g=>'<details class="city-optional-group"><summary><span>'+esc(g.label)+'</span><em>'+g.rows.length+' blank</em></summary>'+g.rows.map(field).join('')+'</details>').join('');};
      if(opt.length)html+=list.length?'<details class="city-optional"><summary>'+opt.length+' optional question'+(opt.length===1?'':'s')+' left blank</summary>'+optHtml(opt)+'</details>':'<div class="city-optional-open">'+optHtml(opt)+'</div>';
      const pages=Object.keys(titles),next=pages[pages.indexOf(page)+1];
      html+='</div></fieldset><div class="pw-actions cp-app-actions">'+(next?'<button type="submit" class="cp-primary" data-city-next="'+next+'">Save &amp; next page →</button>':'')+'<button type="submit">Save</button><button type="button" data-action="city-download">Download my answers</button></div><p class="city-save-state" role="status">Answers save when you click Save or switch pages.</p></form>';
      html+='<aside class="application-evidence cp-panel" aria-label="Supporting evidence"><div class="cp-panel-head"><p class="cp-eyebrow">Where answers come from</p><h3 id="field-evidence-heading">Pick an answer</h3></div><div id="field-evidence-content" class="cp-panel-body" aria-live="polite"><p>Click <b>Check this answer</b> on anything Cornerpin filled in to see where it came from, then confirm or fix it.</p></div></aside></div><section id="application-documents">'+extractionPanel(p)+'</section>';
    }
    return html+'<p class="pw-muted">Matches the city’s form as of '+catalog.observedAt+'. Signatures and uploads happen in CityInspect.</p><p><a href="'+catalog.source+'" target="_blank" rel="noopener noreferrer">Open CityInspect</a></p></section>';
  }
  if(root.document)root.document.addEventListener('change',e=>{if(e.target.id==='city-source-scope'&&e.target.checked){e.target.removeAttribute('aria-invalid');const error=root.document.getElementById('city-scope-error');if(error)error.hidden=true;}});
  if(root.document)root.document.addEventListener('click',e=>{
    const back=e.target.closest('[data-return-field]');if(back){const selected=back.closest('.application-workspace').querySelector('.city-field.is-selected');selected?.querySelector('input,select,textarea')?.focus();selected?.scrollIntoView({behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});return;}
    const button=e.target.closest('[data-field-evidence]');if(!button)return;
    const field=button.closest('.city-field'),workspace=button.closest('.application-workspace');
    workspace.querySelectorAll('.city-field').forEach(n=>n.classList.toggle('is-selected',n===field));
    workspace.querySelector('#field-evidence-heading').textContent=field.querySelector('label').textContent;
    const target=workspace.querySelector('#field-evidence-content');target.replaceChildren(field.querySelector('.city-note').cloneNode(true));target.firstChild.removeAttribute('id');
    const note=root.document.createElement('div'),type=renderedProject.application.cityInspect?.typeId,row=rows(renderedProject,type).find(r=>r.key===button.dataset.fieldEvidence);note.innerHTML=Reviews.panel(renderedProject,row,type);target.append(note);const backButton=root.document.createElement('button');backButton.type='button';backButton.dataset.returnField='';backButton.textContent='Return to answer';target.append(backButton);
    if(root.matchMedia('(max-width: 900px)').matches)target.scrollIntoView({behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  });
  const api={catalog,supported,rows,update,sheet,render,formCommand,Reviews,readiness,setShowAll};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CityApplication=api;
})(typeof window!=='undefined'?window:globalThis);
