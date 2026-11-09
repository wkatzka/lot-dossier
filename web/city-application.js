/* Observed city forms, with explicit provenance. No portal writes or submissions. */
(function(root){
  'use strict';
  const catalog=typeof module!=='undefined'&&module.exports?require('../data/permits/ogden-valley-cityinspect.json'):(root.LR_DATA||{}).cityInspect;
  const Facts=typeof module!=='undefined'&&module.exports?require('./permit-facts'):root.PermitFacts;
  const Assistant=typeof module!=='undefined'&&module.exports?require('./permit-assistant'):root.PermitAssistant;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
      return {...f,section,key:rowId,locked:locked(f),value:saved?saved.value:c.value,basis:saved?saved.basis:c.basis,guidance:c.basis,
        status:saved?(saved.siteVersion===p.siteVersion&&(saved.planVersion||0)===(p.planVersion||0)?'User supplied · review before filing':'Site or plans changed · review saved answer'):(c.value!==''?'Suggested · review before filing':(f.type==='file'?'Document needed':locked(f)&&f.name!=='permit_type'?'Complete in city portal':'Answer needed'))};
    }));
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
      if(value&&row.type==='number'&&(!Number.isFinite(Number(value))||(row.min!=null&&Number(value)<Number(row.min))||(row.max!=null&&Number(value)>Number(row.max))))throw Error('Enter a number within the city field limits.');
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
    const documents=(p.documents||[]).filter(d=>/\.pdf$/i.test(d.name)&&!p.documents.some(x=>x.family===d.family&&x.version>d.version));
    return '<div class="city-extraction"><h3>Fill from your documents</h3><p>Read explicit plan schedules first. CornerpinAI can read the drawings and schedules for missing answers. Suggestions need review and do not replace approvals or measurements.</p>'+(documents.length?'<label for="city-source-doc">Source document</label><select id="city-source-doc">'+documents.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('')+'</select><label><input type="checkbox" id="city-source-scope"> This document describes the proposed work for this permit type.</label><div class="pw-actions"><button type="button" data-action="extract-permit-local">Read without AI</button><button type="button" data-action="extract-permit-claude">Find remaining answers with CornerpinAI</button></div><div class="analysis-inline" id="permit-analysis-status" role="status" aria-live="polite"></div><p class="pw-muted">CornerpinAI sends the selected PDF, including drawings, to Anthropic. Cached results are reused; no city submission occurs. Extracted answers stay with the permit type you selected.</p>':'<p>Upload your building plans under Documents to extract more answers.</p>')+((p.application.documentExtractions||[]).map(x=>'<p class="pw-muted">'+esc(x.filename)+': '+x.facts.length+' candidates · '+esc(String(x.method||'').replace(/Claude/gi,'CornerpinAI'))+(x.cacheHit?' · cached':'')+(x.estimatedUSD!=null?' · '+(x.cacheHit?'$0 additional CornerpinAI cost (cached)':'CornerpinAI usage estimate $'+Number(x.estimatedUSD).toFixed(4)):'')+(x.notice?' · '+esc(String(x.notice||'').replace(/Claude/gi,'CornerpinAI')):'')+'</p>').join(''))+'</div>';
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
  function render(p,page='primary'){
    if(!supported(p))return '<section class="pw-card"><h2>City application</h2><p>Exact field mapping is currently available for Ogden Valley City Building Permits. Other jurisdictions need their own form mapping.</p></section>';
    const id=p.application.cityInspect?.typeId||'',t=getType(id),rs=rows(p,id);
    if(!titles[page])page='primary';
    const groups=[...new Set(catalog.types.map(x=>x.group))];
    let html='<section class="pw-card city-application"><h2>City application</h2><p>CityInspect’s field labels, choices and page order, with your site information filled in. This is your Cornerpin draft; nothing is sent to the city.</p><label for="city-permit-type">Permit type</label><select id="city-permit-type" data-city-type><option value="">Choose application type</option>'+groups.map(g=>'<optgroup label="'+esc(g)+'">'+catalog.types.filter(x=>x.group===g).map(x=>'<option value="'+x.value+'"'+(x.value===id?' selected':'')+'>'+esc(x.label)+'</option>').join('')+'</optgroup>').join('')+'</select>';
    if(t){
      html+=extractionPanel(p);
      html+='<nav class="city-pages" aria-label="Application pages">'+Object.keys(titles).map((key,i)=>'<button type="button" data-action="city-page" data-id="'+key+'" aria-current="'+(key===page?'step':'false')+'">'+(i+1)+'. '+titles[key]+'</button>').join('')+'</nav><p class="pw-muted">Autofilled answers include their basis below. Empty fields need information. * = required marker observed in the city form.</p>';
      const list=rs.filter(r=>r.section===page);
      html+='<form data-command="city_application_page"><input type="hidden" name="permitType" value="'+id+'"><fieldset><legend>'+titles[page]+'</legend><div class="city-fields">';
      if(!list.length)html+='<p>No fields were displayed during inspection. Requirements remain unconfirmed.</p>';
      html+=list.map(r=>{
        const inputId='city-'+r.key,name='answer:'+r.key,current=esc(r.value),required=r.required||r.markedRequired;
        let out='<div class="city-field'+(r.type==='textarea'||r.type==='file'?' city-wide':'')+'"><label for="'+inputId+'">'+esc(r.label)+(required?' *':'')+'</label>';
        const attrs=' id="'+inputId+'" name="'+name+'" aria-describedby="'+inputId+'-note"';
        if(r.name==='permit_type')out+='<input'+attrs+' value="'+esc(t.label)+'" readonly>';
        else if(r.type==='file')out+='<input'+attrs+' type="file" disabled><p><button type="button" data-action="tab" data-id="documents">Manage project documents</button></p>';
        else if(r.locked)out+='<input'+attrs+' value="" disabled placeholder="Complete in CityInspect">';
        else if(r.options)out+='<select'+attrs+'><option value="">Not answered</option>'+r.options.filter(o=>o.value!=='').map(o=>'<option value="'+esc(o.value)+'"'+(o.value===r.value?' selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>';
        else if(r.type==='textarea')out+='<textarea'+attrs+' maxlength="'+Math.min(r.maxLength||10000,10000)+'">'+current+'</textarea>';
        else out+='<input'+attrs+' type="'+(r.type==='number'?'number':'text')+'"'+(r.type==='number'?' step="any"':'')+(r.min!=null?' min="'+esc(r.min)+'"':'')+(r.max!=null?' max="'+esc(r.max)+'"':'')+' maxlength="'+Math.min(r.maxLength||10000,10000)+'" value="'+current+'">';
        return out+'<div id="'+inputId+'-note" class="city-note"><span class="city-answer-state">'+esc(r.status)+'</span><p>'+esc(r.basis)+(r.guidance!==r.basis?'<br>'+esc(r.guidance):'')+'</p></div></div>';
      }).join('');
      const pages=Object.keys(titles),next=pages[pages.indexOf(page)+1];
      html+='</div></fieldset><div class="pw-actions"><button type="submit">Save page</button>'+(next?'<button type="submit" data-city-next="'+next+'">Save & continue →</button>':'')+'<button type="button" data-action="city-download">Save & download answers</button></div><p class="city-save-state" role="status">Changes save when you save, change application pages or select another permit type.</p></form>';
    }
    return html+'<p class="pw-muted">Form inspected '+catalog.observedAt+'. Layout is adapted for Cornerpin; conditional requirements and final city validation may differ. Signatures, acknowledgments and uploads are completed in CityInspect.</p><p><a href="'+catalog.source+'" target="_blank" rel="noopener noreferrer">Open CityInspect</a></p></section>';
  }
  const api={catalog,supported,rows,update,sheet,render,formCommand};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CityApplication=api;
})(typeof window!=='undefined'?window:globalThis);
