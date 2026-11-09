/* Observed city forms, with explicit provenance. No portal writes or submissions. */
(function(root){
  'use strict';
  const catalog=typeof module!=='undefined'&&module.exports?require('../data/permits/ogden-valley-cityinspect.json'):(root.LR_DATA||{}).cityInspect;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titles={primary:'Property & application',professionals:'Designers & contractors',building:'Building details',attachments:'Documents & acknowledgments'};
  const supported=p=>p.report?.facts?.jurisdiction===catalog.jurisdiction;
  const getType=id=>catalog.types.find(t=>t.value===String(id));
  const locked=f=>f.type==='file'||f.type==='checkbox'||f.name==='permit_type'||/^other\d+$/.test(f.name);
  function candidate(p,t,section,f){
    const r=p.report||{},a=r.parcel?.attrs||{},fx=r.facts||{},pl=r.plan||{},app=p.application||{};
    let value='',basis='Enter information for this application scope.';
    const sourced={property_address:a.PARCEL_ADD,tax_id:r.parcel?.id,subdivision:a.SUBDIV_NAME,lot_no:fx.parcelDoc?.lot,zone:fx.zone,latitude:r.parcel?.cx,longitude:r.parcel?.cy};
    if(section==='primary'&&Object.hasOwn(sourced,f.name)){value=sourced[f.name]??'';basis='Saved site report: parcel / jurisdiction records. Confirm against the city form.';}
    const manual={ownername:app.owner,buildername:app.contractor,builder_name:app.contractor,description:app.description};
    if(Object.hasOwn(manual,f.name)){value=manual[f.name]??'';basis='Saved application details; confirm identity and scope.';}
    if(f.name==='permit_type'){value=t.value;basis='Selected application type: '+t.label;}
    if(section==='building'&&f.name==='lot_footage'&&Number(fx.lot_sf)>0){value=Math.round(fx.lot_sf);basis='Calculated lot area from saved site report (square feet); approximate, verify against survey.';}
    if(section==='building'&&t.value==='1'){
      const key={garage_footage:'garage_sf',bedrooms:'bedrooms',stories:'stories'}[f.name];
      if(key&&pl[key]!=null){value=pl[key];basis='Uploaded/entered plan: '+key+'. Confirm this is the proposed dwelling. '+(typeof pl.src?.[key]==='string'?pl.src[key]:'');}
    }
    if(f.name==='builder_valuation')basis='Construction valuation for this permit scope is required. Land market value and assessed value are not construction valuation.';
    if(/_set_back_default$/.test(f.name))basis='Actual proposed distance from the applicable property boundary, from a dimensioned site plan. Zoning minima are not actual setbacks.';
    if(/_set_back$/.test(f.name))basis='Confirm the minimum applicable to this structure and boundary. House rules may not apply to pools, fences or accessory structures.';
    if(/_(approved|date|info)$/.test(f.name)&&/^(fire|zoning|health|water|geotechnical)_/.test(f.name))basis='Use the actual department approval and date; a site screening result is not an approval.';
    if(f.name==='area')basis='The portal does not state units here. Confirm units before entering a value.';
    if(f.type==='file')basis='Provide the applicable document through the city portal. Existing project files are not automatically certified as satisfying this requirement.';
    if(/^other\d+$/.test(f.name)||f.type==='checkbox')basis='Complete personally in the city portal after reading the full statement. Cornerpin does not provide initials or acknowledgments.';
    return {value:String(value??''),basis};
  }
  function rows(p,id){
    if(!supported(p))return [];
    const t=getType(id);if(!t)return [];
    return Object.entries(t.sections).flatMap(([section,keys])=>keys.map(key=>{
      const f=catalog.fields[key],rowId=section+'.'+key,c=candidate(p,t,section,f),saved=p.application.cityInspect?.answers?.[t.value]?.[rowId];
      return {...f,section,key:rowId,locked:locked(f),value:saved?saved.value:c.value,basis:saved?saved.basis:c.basis,
        status:saved?(saved.siteVersion===p.siteVersion?'User supplied · review before filing':'Site refreshed · review saved answer'):(c.value!==''?'Suggested · review before filing':(f.type==='file'?'Document needed':locked(f)&&f.name!=='permit_type'?'Complete in city portal':'Answer needed'))};
    }));
  }
  function update(p,a){
    if(!supported(p))throw Error('Exact form mapping is currently available for Ogden Valley City Building Permits only.');
    const t=getType(a.permitType);if(!t)throw Error('Choose a mapped permit type.');
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
      else state.answers[t.value][row.key]={value,basis,siteVersion:p.siteVersion};
    }
    return state;
  }
  function sheet(p){
    const id=p.application.cityInspect?.typeId,t=getType(id);if(!supported(p)||!t)throw Error('Choose and save an application type first.');
    return ['CORNERPIN — APPLICATION ANSWER SHEET — NOT SUBMITTED',t.label+' · '+catalog.jurisdiction,p.property.address,'Form observed '+catalog.observedAt+' · '+catalog.source,'Review all answers in the current portal. Conditional rules and final submission validation may differ.',''].concat(rows(p,id).map(r=>titles[r.section]+' / '+r.label+' ['+r.name+']\n'+(r.value===''?'[UNANSWERED]':r.options?.find(o=>o.value===r.value)?.label||r.value)+'\n'+r.status+'\nBasis: '+r.basis+'\n')).join('\n');
  }
  function render(p){
    if(!supported(p))return '<section class="pw-card"><h2>City application answers</h2><p>Exact field mapping is currently available for Ogden Valley City Building Permits. Other jurisdictions need their own form mapping.</p></section>';
    const id=p.application.cityInspect?.typeId||'',t=getType(id),rs=rows(p,id);
    const groups=[...new Set(catalog.types.map(x=>x.group))];
    let html='<section class="pw-card"><h2>City application answers</h2><p>Choose from all 38 application types in the city’s Building Permits module. Answers save with this project; nothing is sent to the city.</p><form data-command="city_application"><label>Application type<select name="permitType" required><option value="">Choose application type</option>'+groups.map(g=>'<optgroup label="'+esc(g)+'">'+catalog.types.filter(x=>x.group===g).map(x=>'<option value="'+x.value+'"'+(x.value===id?' selected':'')+'>'+esc(x.label)+'</option>').join('')+'</optgroup>').join('')+'</select></label><button type="submit">Open application fields</button></form>';
    if(t){
      html+='<p>Form checked '+catalog.observedAt+'. Suggestions need review. Blank fields are not claims of exemption. Final city validation and conditional requirements have not been fully tested.</p><button type="button" data-action="city-download">Download saved answer sheet</button>';
      for(const [section,title] of Object.entries(titles)){
        const list=rs.filter(r=>r.section===section);
        html+='<details><summary>'+title+' · '+list.length+' fields</summary>';
        if(section==='attachments')html+='<p>Check applicability in the portal. Asterisks below reproduce visible required markers, not a complete determination of what your project requires. Keep supporting files under Documents.</p>';
        if(!list.length)html+='<p>No fields were displayed during inspection. Requirements remain unconfirmed.</p>';
        html+=list.map(r=>{
          const current=esc(r.value),required=r.required||r.markedRequired;
          let out='<div class="city-field"><h3>'+esc(r.label)+(required?' *':'')+'</h3><p class="pw-muted">'+esc(r.status)+'</p>';
          if(r.locked)return out+'<p>'+esc(r.name==='permit_type'?t.label:r.basis)+'</p></div>';
          out+='<form data-command="city_application"><input type="hidden" name="permitType" value="'+id+'"><input type="hidden" name="fieldKey" value="'+r.key+'"><label>Answer';
          out+=r.options?'<select name="value"><option value="">Not answered</option>'+r.options.filter(o=>o.value!=='').map(o=>'<option value="'+esc(o.value)+'"'+(o.value===r.value?' selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>':'<textarea name="value" maxlength="'+Math.min(r.maxLength||10000,10000)+'">'+current+'</textarea>';
          return out+'</label><label>Source / basis<textarea name="basis">'+esc(r.basis)+'</textarea></label><div class="pw-actions"><button type="submit">Save answer</button><button type="submit" name="reset" value="yes">Use suggestion</button><button type="button" data-action="city-copy" data-id="'+r.key+'">Copy saved answer</button></div></form></div>';
        }).join('');html+='</details>';
      }
    }
    return html+'<p><a href="'+catalog.source+'" target="_blank" rel="noopener noreferrer">Open CityInspect</a></p></section>';
  }
  const api={catalog,supported,rows,update,sheet,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CityApplication=api;
})(typeof window!=='undefined'?window:globalThis);
