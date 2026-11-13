/* Evidence-backed permit workflow. Pure state transitions; no network or external side effects. */
(function (root) {
  'use strict';
  const E = typeof module !== 'undefined' && module.exports ? require('./evidence-ledger') : root.EvidenceLedger;
  const A = typeof module !== 'undefined' && module.exports ? require('./area-rules') : root.AreaRules;
  const D = typeof module !== 'undefined' && module.exports ? require('./site-decisions') : root.SiteDecisions;
  const clone = x => JSON.parse(JSON.stringify(x));
  const required = (x, message) => { if (!x) throw new Error(message); };
  const clean = x => String(x || '').trim();
  const id = () => 'cp-' + (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const connection = Object.freeze({ provider: 'City Inspect', connected: false, submit: false, monitor: false, sendMessages: false,
    lastSuccessfulSync: null, reason: 'Authorized portal/API access has not been configured. No automatic filing, monitoring or messages are running.' });
  const doc = (p, key) => p.documents.find(d => d.id === key);
  const latest = (p, d) => !p.documents.some(x => x.family === d.family && x.version > d.version);
  function evidence(p, ref) {
    return !!(ref && (doc(p, ref.documentId) || /^https:\/\//i.test(ref.url || '')));
  }
  function event(p, type, text, now, explicitActor) { const actor=explicitActor||(['migrate_site_reviews','public_owner','area_map','sync_report'].includes(type)?'system':type==='document_extraction'?'extraction':type==='review_round'?'import':'user');p.events.push({ id: id(), at: now, type, text, actor, provenance:({system:'System update',extraction:'Document extraction · not reviewer confirmation',ai:'AI extraction · not reviewer confirmation',import:'Imported correspondence · user checked',user:'User action'})[actor] }); }
  // One checklist across every planned permit's packet. Packet items carry stable ids
  // ("2:doc-site-plan"); older single-packet reports keep positional ids.
  function requirements(report) {
    const facts = (report || {}).facts || {}, packets = facts.packets && Object.keys(facts.packets).length ? Object.values(facts.packets) : facts.packet ? [facts.packet] : [];
    const items = packets.flatMap(pk => (pk.items || []).map(x => ({ ...x, permitLabel: pk.label || '' })));
    return [{ id: 'scope', title: 'Confirm current jurisdiction requirements and permit scope', required: true, state: 'missing', note: '', documentIds: [] }]
      .concat(items.map((x, i) => ({ id: x.id ? 'req:' + x.id : 'requirement-' + i, title: x.title, permitType: x.permitType || '', permitLabel: x.permitLabel,
        required: !['na', 'optional', 'rule'].includes(x.status),
        state: 'missing', suggestedStatus: x.status, owner: x.who || '', source: x.why || '', sourceUrl: x.link || '',
        detail: x.detail || '', note: '', documentIds: [] })));
  }
  function create(report, now) {
    now = now || new Date().toISOString();
    const parcel = report.parcel, packet = (report.facts || {}).packet || {};
    return { schemaVersion: 1, id: id(), revision: 0, createdAt: now, updatedAt: now,
      propertyKey: parcel.county + '|' + parcel.id, property: { county: parcel.county, parcelId: parcel.id, address: parcel.attrs.PARCEL_ADD || 'Parcel ' + parcel.id },
      siteVersion: 1, report: clone(report), evidence: E.discover(report), application: { applicant: '', owner: (report.facts || {}).owner || '', contractor: '', description: '',
        jurisdiction: (report.facts || {}).jurisdiction || '', portal: packet.portal || '', reference: '' },
      stage: 'preparing', requirements: requirements(report), documents: [], packages: [], receipts: [], rounds: [], corrections: [], events: [] };
  }
  function openCorrections(p) { return p.corrections.filter(c => c.state !== 'accepted'); }
  function blockers(p, kind) {
    const out = [];
    const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication;
    if(C.supported(p)){const type=p.application.filingPermitType;if(!type)out.push('Designate the permit worksheet for this filing.');else out.push(...C.readiness(p,type).issues);}
    if (kind !== 'resubmission' && A) out.push(...A.blockers(p));
    if (kind === 'resubmission') {
      if(A)for(const rule of A.rules(p)){const prior=p.application.ruleReviews?.[rule.id];if(prior&&['approved','not-applicable'].includes(prior.state)&&!A.reviewCurrent(p,rule))out.push(rule.title+' — prior approval/applicability review is stale; recheck changed evidence before preparing the resubmission.');}
      if (!p.application.reference) out.push('Application reference is missing.');
      const open = openCorrections(p).filter(c => c.state !== 'resubmitted');
      if (!open.length) out.push('No open corrections to resubmit.');
      open.forEach(c => {
        if (c.state !== 'response_prepared') out.push(c.department + ': response not prepared for “' + c.text.slice(0, 85) + '”.');
        (c.documentIds || []).forEach(key => { const d = doc(p, key); if (!d || !latest(p, d)) out.push('A correction response references a missing or superseded document.'); });
      });
    } else {
      if (!clean(p.application.applicant)) out.push('Applicant name is missing.');
      if (!clean(p.application.owner)) out.push('Owner name is missing.');
      if (!clean(p.application.description)) out.push('Project description is missing.');
      if (!clean(p.application.jurisdiction)) out.push('Permitting authority is missing.');
      p.requirements.filter(r => r.required).forEach(r => {
        if (!['reviewed', 'waived'].includes(r.state)) out.push(r.title);
        (r.documentIds || []).forEach(key => { const d = doc(p, key); if (!d || !latest(p, d)) out.push(r.title + ': open Documents, select the current version, then update this requirement’s evidence in Permit Preparation.'); });
      });
    }
    return Array.from(new Set(out));
  }
  function currentPackage(p, kind) { return p.packages.slice().reverse().find(x => x.kind === kind && !x.stale); }
  function invalidate(p) { p.packages.forEach(x => { if (!x.receiptId) x.stale = true; }); if (p.stage === 'ready_for_handoff') p.stage = 'preparing'; }
  function apply(project, command, now) {
    const p = clone(project), a = command; now = now || new Date().toISOString();
    required(p.schemaVersion === 1, 'Unsupported project version.');
    switch (a.type) {
      case 'site_review':
        p.siteReviews=D.apply(p,a,now);invalidate(p);event(p,a.type,'Site decision recorded: '+D.finding(p,a.id).item,now);break;
      case 'migrate_site_reviews': {
        const reviews=D.migrate(p,a.records,now),upgrade=p.correctnessVersion!==1;if(!upgrade&&JSON.stringify(reviews)===JSON.stringify(p.siteReviews))return project;
        p.siteReviews=reviews;
        if(upgrade){p.correctnessVersion=1;for(const r of p.requirements){if(/geotechnical/i.test(r.title)&&!r.required){r.previousInterpretation=clone(r);r.required=true;r.title='Determine geotechnical report applicability';r.state='needs_review';r.detail='Determine applicability from current authority requirements, hazards and controlling instruments; slope alone does not establish an exemption.';}}invalidate(p);}
        event(p,a.type,'Review model upgraded; legacy marks retained as unverified history. Unsubmitted package reviews require renewal.',now);break;
      }
      case 'area_map': {
        required(a.snapshot?.parcelKey===p.propertyKey && Array.isArray(a.snapshot.layers),'Area matches must belong to this parcel.');
        p.application.areaMap=clone(a.snapshot);invalidate(p);event(p,a.type,'Refreshed parcel boundary matches; approval decisions require renewed review.',now);break;
      }
      case 'rule_scope': {
        required(['','new-home','addition','accessory','commercial','other'].includes(a.work)&&['','under-acre','one-acre'].includes(a.disturbance)&&['','yes','no'].includes(a.commonPlan),'Choose a valid project scope.');
        const scope={work:a.work,disturbance:a.disturbance,commonPlan:a.commonPlan};
        for(const k of ['arterialCollector','sideAbutment','rearAbutment','sideMaintenanceContract','rearMaintenanceContract','cornerLot','residentialAdjacency','federalShorelineAdjacency','highwayChange','streamWork','wetlandFill','grading','rowWork','slope25','subdivision','adu','demolition','specialUse']){required(['','yes','no',undefined].includes(a[k]),'Choose a valid '+k+' answer.');if(a[k]!==undefined)scope[k]=a[k];}
        for(const [k,opts] of Object.entries({water:['provider','well'],wastewater:['sewer','septic']})){required(a[k]===undefined||a[k]===''||opts.includes(a[k]),'Choose a valid '+k+' system.');if(a[k]!==undefined)scope[k]=a[k];}
        for(const k of ['lotArea','lotWidth','frontSetback','sideSetback','rearSetback','buildingHeight','combinedSideSetbacks','streetSideSetback','buildingCoverage','imperviousCover','greenSpace','floorAreaRatio','roadWidth','rentalRooms','netDevelopableArea','federalShorelineSetback','stories','streetCenterlineSetback','commercialFloorShare','commercialGroundShare']){if(a[k]!==undefined){required(a[k]===''||(Number.isFinite(Number(a[k]))&&Number(a[k])>=0),'Enter a nonnegative measurement.');scope[k]=a[k];}}
        for(const k of ['workGeometry','accessGeometry']){if(a[k]){let g;try{g=JSON.parse(a[k]);}catch{throw Error('Invalid drawn geometry.');}const lines=k==='workGeometry'?g.rings:g.paths;required(Array.isArray(lines)&&lines.length>0&&lines.length<=10&&lines.every(l=>Array.isArray(l)&&l.length>=(k==='workGeometry'?4:2)&&l.length<=500&&l.every(c=>Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)),'Draw a valid work area or access route.');if(k==='workGeometry')required(lines.every(l=>l[0][0]===l[l.length-1][0]&&l[0][1]===l[l.length-1][1]),'Close the work-area boundary.');scope[k]=JSON.stringify(g);}}
        p.application.ruleScope=scope;invalidate(p);event(p,a.type,'Updated approval-rule project triggers.',now);break;
      }
      case 'rule_review': {
        required(p.application.areaMap,'Match the parcel before recording an approval decision.');
        const rule=A.rules(p).find(r=>r.id===a.id);required(rule,'Unknown approval requirement.');
        required(['approved','not-applicable','needs-review'].includes(a.state),'Choose a decision.');
        required(clean(a.reviewer)&&clean(a.note),'Record reviewer and approval conditions or applicability basis.');
        const d=doc(p,a.documentId);required(a.state==='needs-review'||(/^https:\/\//i.test(a.url||'')||(d&&latest(p,d))),'Attach a current approval/applicability document or HTTPS evidence link.');
        p.application.ruleReviews=p.application.ruleReviews||{};
        if(p.application.ruleReviews[a.id]){p.application.ruleReviewHistory=p.application.ruleReviewHistory||[];p.application.ruleReviewHistory.push({id:a.id,...clone(p.application.ruleReviews[a.id])});}
        p.application.ruleReviews[a.id]={state:a.state,reviewer:clean(a.reviewer),note:clean(a.note),url:clean(a.url),documentId:d?.id||'',documentHash:d?.hash||'',ruleFingerprint:A.reviewFingerprint(p,rule),at:now,version:A.version,mapAt:p.application.areaMap.at,siteVersion:p.siteVersion,planVersion:p.planVersion,scope:JSON.stringify(p.application.ruleScope||{})};
        invalidate(p);event(p,a.type,'Recorded '+a.state+' for '+rule.title+'; user-reviewed evidence.',now);break;
      }
      case 'sync_report': {
        required(a.report.parcel.county + '|' + a.report.parcel.id === p.propertyKey, 'The report belongs to a different property.');
        p.evidence = E.sync(p.evidence, a.report); p.report = clone(a.report); p.siteVersion++;
        const fresh = requirements(a.report);
        p.requirements = fresh.map(r => {
          const prior = p.requirements.find(x => x.id === r.id) || p.requirements.find(x => x.title === r.title && (x.permitType || '') === (r.permitType || ''));
          return prior ? Object.assign({}, prior, { state: 'needs_review', required: r.required, detail: r.detail, source: r.source, sourceUrl: r.sourceUrl }) : r;
        });
        invalidate(p); event(p, a.type, 'Site/plan snapshot updated. Requirement reviews and unsubmitted package approvals need renewal.', now); break;
      }
      case 'evidence':
        p.evidence=E.apply(p.evidence||E.discover(p.report),a.action,now); invalidate(p); event(p,a.type,'Research evidence or calculation updated.',now); break;
      case 'public_owner': {
        const x=a.record;
        required(x&&String(x.parcel)===String(p.report.parcel.id)&&x.name&&/^https:\/\/(?:www\.)?webercountyutah\.gov\/parcelsearch\/ownership-info\.php\?id=\d+$/.test(x.source),'Owner record must match this parcel and the county source.');
        p.report.facts.ownerRecord=clone(x);event(p,a.type,'Retrieved county owner mailing record for permit suggestions.',now);break;
      }
      case 'document_extraction': {
        const x=a.result,d=p.documents.find(d=>d.id===x?.documentId&&d.hash===x?.documentHash);
        required(d&&latest(p,d),'The source document changed; extract the current version.');
        required(Array.isArray(x.facts)&&x.facts.length<=200,'Invalid extraction result');
        const PF=typeof module!=='undefined'&&module.exports?require('./permit-facts'):window.PermitFacts;
        x.facts=PF.retainConflicts(x.facts,(p.application.documentExtractions||[]).filter(y=>y.documentId===d.id&&y.documentHash===d.hash&&(y.permitType||'1')===(x.permitType||'1')).flatMap(y=>y.facts||[]));
        p.application.documentExtractions=(p.application.documentExtractions||[]).filter(y=>y.documentId!==d.id||(y.permitType||'1')!==(x.permitType||'1')).concat([clone(x)]);
        invalidate(p);event(p,a.type,'Read '+d.name+': '+x.facts.length+' source-linked candidates; review required.',now,/claude|ai/i.test(x.method||'')?'ai':'system');break;
      }
      case 'measurement_candidates': {
        const x=a.result,d=p.documents.find(d=>d.id===x?.documentId&&d.hash===x?.documentHash);required(d&&latest(p,d),'Choose the current document version.');required(Array.isArray(x.measurements)&&x.measurements.length<=40,'Invalid geometry response.');p.application.measurementReads=(p.application.measurementReads||[]).filter(r=>r.documentId!==d.id).concat([clone(x)]);event(p,a.type,'Drawing geometry candidates saved; not accepted as application answers.',now);break;
      }
      case 'plan_measurement': {
        const M=typeof module!=='undefined'&&module.exports?require('./plan-measurements'):root.PlanMeasurements,m=clone(a.measurement);required(M.current(p,m),'Measurement source is superseded or missing.');required(clean(a.reviewer)&&clean(m.basis),'Record reviewer and measurement basis.');const calculation=M.calculate(m);required(a.confirmed,'Confirm the complete field boundary, calibration and exclusions.');
        const saved={...m,id:m.id||id(),calculation,reviewer:clean(a.reviewer),reviewedAt:now,reviewed:true};p.application.measurements=(p.application.measurements||[]).filter(x=>x.id!==saved.id).concat([saved]);
        const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication,type=a.permitType||'1',row=C.rows(p,type).find(r=>r.name===m.field&&r.section==='building');required(row,'This field is absent from the selected permit.');
        const basis='Reviewed drawing measurement: '+m.filename+', page '+m.page+'; '+m.basis+'. '+calculation.method+'; '+calculation.scale.checks+' independent dimension checks. Coordinate/scale sensitivity ±'+calculation.sensitivity+' '+calculation.unit+' (not a confidence interval). Reviewer: '+saved.reviewer+'. '+calculation.limitation;
        p.application.cityInspect=C.update(p,{permitType:type,fieldKey:row.key,value:String(calculation.value),basis});p.application.cityInspect.answers[type][row.key].measurementId=saved.id;
        for(const v of Object.values(p.application.valuations||{}))v.stale=true;invalidate(p);event(p,a.type,'Reviewed '+m.field+' measurement used in permit '+type+'. Printed conflicts remain in source history.',now);break;
      }
      case 'setback_rule': {
        required(['left','right'].includes(a.side)&&['interior-side','street-side'].includes(a.classification),'Identify the side and boundary classification.');required(a.confirmed&&clean(a.orientation)&&clean(a.source)&&clean(a.reviewer),'Confirm frontage, controlling source and reviewer.');required(String(a.feet??'').trim()!==''&&Number.isFinite(Number(a.feet))&&Number(a.feet)>=0&&Number(a.feet)<=1000,'Enter the sourced minimum in feet.');const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication,type=a.permitType||'1',row=C.rows(p,type).find(r=>r.name===a.side+'_set_back');required(row,'Setback field absent.');p.application.cityInspect=C.update(p,{permitType:type,fieldKey:row.key,value:String(Number(a.feet)),basis:'Reviewed '+a.classification+' minimum; '+a.orientation+'. Controlling source: '+a.source+'. Reviewer: '+a.reviewer+'. This is not an actual proposed distance.'});invalidate(p);event(p,a.type,'Side setback rule classified and reviewed.',now);break;
      }
      case 'team_profile': {
        const A=typeof module!=='undefined'&&module.exports?require('./permit-assistant'):root.PermitAssistant;
        required(A.roles[a.role]&&a.confirmed,'Confirm the team member and project role.');
        const profile={};for(const k of A.profileKeys)profile[k]=clean(a[k]).slice(0,500);
        required(profile.name,'Enter the person or company name.');required(!profile.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email),'Enter a valid email.');
        p.application.team=p.application.team||{};p.application.team[a.role]={...profile,confirmedAt:now};
        if(a.role==='owner')p.application.owner=profile.name;if(a.role==='contact')p.application.applicant=profile.name;if(a.role==='builder')p.application.contractor=profile.name;
        invalidate(p);event(p,a.type,'Project role confirmed: '+A.roles[a.role]+'. Matching fields now reuse this profile.',now);break;
      }
      case 'construction_valuation': {
        const A=typeof module!=='undefined'&&module.exports?require('./permit-assistant'):root.PermitAssistant;
        required(a.confirmed,'Confirm valuation scope and rate sources.');const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication;required(C.catalog.types.some(t=>t.value===a.permitType),'Choose a permit type.');
        const items=A.valuation(a.items);p.application.valuations=p.application.valuations||{};p.application.valuations[a.permitType]={items,total:Math.round(items.reduce((n,x)=>n+x.amount,0)),at:now};invalidate(p);event(p,a.type,'Reviewed construction valuation calculated for selected permit.',now);break;
      }
      case 'license_check': {
        required(p.application.team?.[a.role]&&a.license===p.application.team[a.role].license,'Team license changed; repeat lookup.');p.application.team[a.role].licenseCheck={at:now,summary:clean(a.summary),source:'https://services.commerce.utah.gov/cbr/'};event(p,a.type,'Public registry response retained; not a full license verification.',now);break;
      }
      case 'research_scope': {
        required(['included','excluded','unknown'].includes(a.pool),'Choose the pool scope.');if(a.fireplace!==undefined)required(['included','excluded','unknown'].includes(a.fireplace),'Choose the fireplace scope.');p.application.researchScope={...p.application.researchScope,pool:a.pool,...(a.fireplace!==undefined?{fireplace:a.fireplace}:{})};invalidate(p);event(p,a.type,'Optional research scope updated.',now);break;
      }
      case 'filing_scope': {
        const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication;
        required(!p.receipts.length&&!p.application.reference,'An existing filing keeps its permit scope. Create a separate project for another independent filing.');
        required((p.application.permitSelections||[]).includes(String(a.permitType))&&C.catalog.types.some(t=>t.value===String(a.permitType)),'Choose a saved permit worksheet.');
        p.application.filingPermitType=String(a.permitType);invalidate(p);event(p,a.type,'Designated worksheet for this filing; other worksheets are not independent filings.',now);break;
      }
      case 'answer_review': {
        const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication;
        const row=C.rows(p,a.permitType).find(r=>r.key===a.fieldKey);p.application.answerReviews=C.Reviews.apply(p,row,a,now);invalidate(p);event(p,a.type,'Answer '+a.state+': '+row.label+' · '+a.reviewer,now);break;
      }
      case 'city_application': {
        const C = typeof module !== 'undefined' && module.exports ? require('./city-application') : root.CityApplication;
        const selected=(p.application.permitSelections||[]).includes(String(a.permitType)) || p.application.cityInspect?.typeId===String(a.permitType);
        // Repeating the current selection is a no-op; workspace view state handles opening other existing drafts.
        if(selected&&p.application.cityInspect?.typeId===String(a.permitType)&&!a.fieldKey&&(a.entries===undefined||(Array.isArray(a.entries)&&a.entries.length===0))) return project;
        const city=C.update(p,a), selections=Array.from(new Set([...(p.application.permitSelections||[]),String(a.permitType)]));
        if(JSON.stringify(city)===JSON.stringify(p.application.cityInspect)&&JSON.stringify(selections)===JSON.stringify(p.application.permitSelections)) return project;
        p.application.cityInspect=city;p.application.permitSelections=selections;
        invalidate(p); event(p,a.type,'City application answers updated; not submitted.',now); break;
      }
      case 'application':
        ['applicant', 'owner', 'contractor', 'description'].forEach(k => { if (k in a) p.application[k] = clean(a[k]); });
        invalidate(p); event(p, a.type, 'Application details updated.', now); break;
      case 'project_intent': {
        // The user's stated plan. Fills the matching rule scope and permit worksheet; removes nothing.
        const C=typeof module!=='undefined'&&module.exports?require('./city-application'):root.CityApplication;
        required(/^[a-z-]{3,20}$/.test(a.plan||'')&&clean(a.label)&&Array.isArray(a.typeIds)&&a.typeIds.length<=6&&a.typeIds.every(id=>C.catalog.types.some(t=>t.value===String(id))),'Choose a valid project.');
        const sc=a.scope||{};required(sc.work===undefined||['','new-home','addition','accessory','commercial','other'].includes(sc.work),'Choose a valid project scope.');for(const k of ['adu','demolition'])required(sc[k]===undefined||['','yes','no'].includes(sc[k]),'Choose a valid '+k+' answer.');
        p.application.intent={plan:a.plan,addOns:Array.isArray(a.addOns)?a.addOns.filter(x=>/^[a-z-]{3,20}$/.test(x)).slice(0,5):[],label:clean(a.label),typeIds:a.typeIds.map(String),chosenAt:now};
        if(Object.keys(sc).length)p.application.ruleScope={...(p.application.ruleScope||{}),...sc};
        if(a.pool)p.application.researchScope={...(p.application.researchScope||{}),pool:a.pool};
        if(a.typeIds.length)p.application.permitSelections=Array.from(new Set([...(p.application.permitSelections||[]),...a.typeIds.map(String)]));
        invalidate(p);event(p,a.type,'Project plan: '+clean(a.label)+'.',now);break;
      }
      case 'recorded_comparison': {
        // Evidence only: compares a supplied recorded copy with a retrieved copy. No approval or decision.
        const x=a.result,d=p.documents.find(d=>d.id===x?.documentId&&d.hash===x?.documentHash);
        required(d&&latest(p,d),'The compared document changed; compare the current version.');
        required(/^recorded-comparison-\d+$/.test(x.version||'')&&Array.isArray(x.sections)&&x.sections.length<=8,'Invalid comparison result');
        p.application.recordedComparisons=(p.application.recordedComparisons||[]).filter(y=>!(y.entry===x.entry&&y.referenceSha===x.referenceSha)).concat([clone(x)]);
        event(p,a.type,'Compared '+d.name+' with the retrieved copy for Entry '+x.entry+': '+String(x.overall).replace(/_/g,' ')+'.',now,'system');break;
      }
      case 'document': {
        required(a.document && clean(a.document.id) && clean(a.document.name) && clean(a.document.hash), 'Document metadata and checksum are required.');
        required(!doc(p, a.document.id), 'Document already exists.');
        const d = clone(a.document), family = d.family || d.id;
        d.family = family; d.version = 1 + Math.max(0, ...p.documents.filter(x => x.family === family).map(x => x.version)); d.addedAt = now;
        p.documents.push(d);if(d.role==='plan'){p.planVersion=(p.planVersion||0)+1;for(const v of Object.values(p.application.valuations||{}))v.stale=true;}
        p.requirements.forEach(r => { if ((r.documentIds || []).some(key => doc(p, key).family === family)) r.state = 'needs_review'; });
        p.corrections.forEach(c => {
          if (c.state !== 'accepted' && (c.documentIds || []).some(key => doc(p, key).family === family)) { c.state = 'revision_received'; c.versionWarning = 'A newer document version exists; prepare the response again.'; }
        });
        invalidate(p); event(p, a.type, 'Added ' + d.name + ' · version ' + d.version + '.', now); break;
      }
      case 'requirement': {
        const r = p.requirements.find(x => x.id === a.id); required(r, 'Requirement not found.');
        required(['reviewed', 'waived', 'needs_review'].includes(a.state), 'Invalid requirement status.');
        required(clean(a.reviewer) && clean(a.note), 'Record who reviewed this item and the review basis or waiver reason.');
        const ids = (a.documentIds || []).filter(Boolean);
        required(ids.every(key => doc(p, key) && latest(p, doc(p, key))), 'Choose current document versions.');
        if (a.state === 'reviewed') required(ids.length || /^https:\/\//i.test(a.url || ''), 'A reviewed item needs a document or HTTPS source reference.');
        Object.assign(r, { state: a.state, note: clean(a.note), reviewer: clean(a.reviewer), reviewedAt: now, siteVersion: p.siteVersion, documentIds: ids, evidenceUrl: clean(a.url) });
        invalidate(p); event(p, a.type, r.title + ' · ' + a.state + ' by ' + r.reviewer + '.', now); break;
      }
      case 'prepare': {
        const kind = a.kind === 'resubmission' ? 'resubmission' : 'initial';
        required(kind !== 'initial' || !p.application.reference, 'This application is already filed. Use the correction/resubmission workflow.');
        required(!blockers(p, kind).length, 'Resolve package blockers before marking it reviewed.');
        required(clean(a.reviewer), 'Identify the person reviewing this package.');
        required(a.reviewed === true, 'Review the exact package before preparing the handoff.');
        const existing = currentPackage(p, kind);
        if (existing && !existing.receiptId) return p; // Repeated clicks do not create duplicate handoffs.
        const snapshot = { id: id(), kind, permitType:p.application.filingPermitType||null, preparedAt: now, reviewedBy: clean(a.reviewer), siteVersion: p.siteVersion,
          application: clone(p.application), fields: clone(((p.report.facts || {}).packet || {}).rows || []),
          requirements: clone(p.requirements), documentIds: p.documents.filter(d => latest(p, d) && !['receipt', 'permit', 'review_letter'].includes(d.role)).map(d => d.id),
          responses: kind === 'resubmission' ? clone(openCorrections(p).filter(c => c.state === 'response_prepared')) : [], stale: false, receiptId: null };
        p.packages.push(snapshot); p.stage = 'ready_for_handoff';
        event(p, a.type, 'Prepared ' + kind + ' package ' + snapshot.id + '. This is not a filing receipt.', now); break;
      }
      case 'receipt': {
        required(clean(a.reference), 'Application/permit reference is required.');
        required(evidence(p, a), 'Attach a filing receipt or provide its HTTPS source link.');
        required(clean(a.receivedAt) && !isNaN(Date.parse(a.receivedAt)), 'Receipt date is required.');
        if (p.application.reference) required(p.application.reference === clean(a.reference), 'The application reference does not match this project.');
        const pkg = a.packageId ? p.packages.find(x => x.id === a.packageId) : null;
        if (a.packageId) required(pkg && !pkg.stale, 'Choose a current package.');
        if (pkg && pkg.receiptId) return p;
        if (p.receipts.some(r => r.reference === clean(a.reference) && r.receivedAt === a.receivedAt && r.documentId === (a.documentId || '') && r.url === (a.url || ''))) return p;
        const receipt = { id: id(), reference: clean(a.reference), receivedAt: a.receivedAt, documentId: a.documentId || '', url: a.url || '',
          packageId: pkg ? pkg.id : null, provenance: 'User-recorded external receipt; not independently verified by Cornerpin' };
        p.receipts.push(receipt); p.application.reference = receipt.reference;
        if (pkg) { pkg.receiptId = receipt.id; if (pkg.kind === 'resubmission') pkg.responses.forEach(r => { const c = p.corrections.find(x => x.id === r.id); if (c && c.state === 'response_prepared') c.state = 'resubmitted'; }); }
        p.stage = pkg && pkg.kind === 'resubmission' ? 'resubmitted' : 'submitted';
        event(p, a.type, 'External filing receipt recorded for ' + receipt.reference + (pkg ? '.' : '; submitted package was not captured in Cornerpin.'), now); break;
      }
      case 'review_round': {
        required(p.application.reference, 'Record the application reference and filing receipt first.');
        required(evidence(p, a), 'Retain the original correction letter or an HTTPS source reference.');
        required(clean(a.sourceDate) && !isNaN(Date.parse(a.sourceDate)), 'Reviewer correspondence date is required.');
        required(a.confirmed === true, 'Confirm the extracted reviewer items before adding them.');
        const texts = (a.items || []).map(clean).filter(Boolean); required(texts.length, 'Add at least one reviewer comment.');
        required(clean(a.originalText), 'Retain the original reviewer text.');
        const duplicate = p.rounds.find(r => r.sourceDate === a.sourceDate && r.department === (clean(a.department) || 'Building') && r.originalText === clean(a.originalText));
        if (duplicate) return p;
        const round = { id: id(), number: p.rounds.length + 1, sourceDate: a.sourceDate, department: clean(a.department) || 'Building',
          documentId: a.documentId || '', url: a.url || '', originalText: clean(a.originalText), importedAt: now, provenance: 'User-confirmed import' };
        p.rounds.push(round);
        texts.forEach(text => p.corrections.push({ id: id(), roundId: round.id, department: round.department, text, sourceLocator: clean(a.sourceLocator) || 'See original correspondence',
          state: 'received', owner: '', email: '', dueDate: '', response: '', documentIds: [], noRevisionReason: '', acceptance: null }));
        invalidate(p); p.stage = 'corrections_requested'; event(p, a.type, 'Imported ' + texts.length + ' confirmed comments in review round ' + round.number + '.', now); break;
      }
      case 'correction': {
        const c = p.corrections.find(x => x.id === a.id); required(c, 'Correction not found.');
        required(c.state !== 'accepted', 'Accepted corrections are retained as history; import a new round if reopened by the city.');
        required(['received', 'assigned', 'revision_received', 'response_prepared'].includes(a.state), 'Use a receipt or reviewer evidence for later states.');
        const ids = (a.documentIds || []).filter(Boolean);
        required(ids.every(key => doc(p, key) && latest(p, doc(p, key))), 'Select current document versions.');
        if (a.state !== 'received') required(clean(a.owner), 'Assign the responsible person.');
        if (a.state === 'revision_received') required(ids.length, 'Attach the revised document.');
        if (a.state === 'response_prepared') {
          required(clean(a.response), 'Write a response to the reviewer comment.');
          required(ids.length || clean(a.noRevisionReason), 'Attach a revision or explain why no document change is needed.');
        }
        Object.assign(c, { owner: clean(a.owner), email: clean(a.email), dueDate: clean(a.dueDate), response: clean(a.response),
          documentIds: ids, noRevisionReason: clean(a.noRevisionReason), state: a.state, versionWarning: '', updatedAt: now });
        invalidate(p); event(p, a.type, 'Updated correction: ' + c.text.slice(0, 90) + ' · ' + c.state + '.', now); break;
      }
      case 'accept_correction': {
        const c = p.corrections.find(x => x.id === a.id); required(c, 'Correction not found.');
        required(c.state === 'resubmitted', 'Record the resubmission receipt before reviewer acceptance.');
        required(evidence(p, a) && clean(a.note), 'Retain reviewer acceptance evidence and a reference to the applicable comment.');
        c.state = 'accepted'; c.acceptance = { at: now, url: a.url || '', documentId: a.documentId || '', note: clean(a.note), provenance: 'User-recorded reviewer acceptance' };
        event(p, a.type, 'Reviewer acceptance recorded for: ' + c.text.slice(0, 90), now); break;
      }
      case 'issuance':
        required(p.application.reference, 'Application reference is missing.');
        required(!openCorrections(p).length, 'Reconcile open correction records before marking issuance.');
        required(evidence(p, a) && clean(a.permitNumber) && clean(a.issuedAt) && !isNaN(Date.parse(a.issuedAt)), 'Issued permit evidence, number and date are required.');
        p.issuance = { permitNumber: clean(a.permitNumber), issuedAt: a.issuedAt, documentId: a.documentId || '', url: a.url || '', provenance: 'User-recorded issuance; not independently verified' };
        p.stage = 'issued'; event(p, a.type, 'Issued permit recorded: ' + p.issuance.permitNumber + '.', now); break;
      default: throw new Error('Unsupported workflow action.');
    }
    p.revision++; p.updatedAt = now; return p;
  }
  function splitComments(text) { return clean(text).split(/\n\s*\n/).map(clean).filter(Boolean); }
  function responseLetter(p, responses) {
    const rows = responses || p.corrections;
    return ['CORNERPIN — DRAFT RESPONSE LETTER', p.property.address, 'Application: ' + (p.application.reference || 'Not recorded'),
      'Review and sign as appropriate before submission. This document has not been sent.', '', ...rows.flatMap((c, i) => [
        (i + 1) + '. ' + c.department + ' — ' + c.text, 'Source: ' + c.sourceLocator, 'Responsible: ' + (c.owner || 'Unassigned'),
        'Response: ' + (c.response || '[Response missing]'), 'Revisions: ' + ((c.documentIds || []).map(key => { const d = doc(p, key); return d ? d.name + ' v' + d.version : '[Missing document]'; }).join('; ') || c.noRevisionReason || '[Revision missing]'), ''
      ])].join('\n');
  }
  const api = { create, apply, blockers, currentPackage, openCorrections, latest, splitComments, responseLetter, connection, id };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PermitWorkflow = api;
})(typeof window !== 'undefined' ? window : globalThis);
