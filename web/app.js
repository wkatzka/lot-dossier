/* Standalone app: home form -> live progress -> report, all in the browser. Needs window.LotReport and window.LR_DATA. */
(function () {
  'use strict';
  var LR = window.LotReport, DATA = window.LR_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), prog = $('progress'), err = $('err'), go = $('go');
  var mode = 'none', last = null, map = null;

  var STATUS = { flag: 'Potential concern', watch: 'Review condition', verify: 'Needs verification', ok: 'No issue identified' };
  var ORDER = { flag: 0, watch: 1, verify: 2, ok: 3 };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }

  /* ---------------- form */
  var FIELDS = ['residence_sf', 'garage_sf', 'width_ft', 'depth_ft', 'bedrooms', 'stories', 'foundation', 'height_ft', 'ground_snow_load_psf', 'bearing_psf', 'fuel', 'fireplace', 'cladding'];
  var extracted = null, readingPlan = false, updatingPlan = false, readVersion = 0, selectedPlanFile = null;
  function setMode(m) {
    mode = m;
    document.querySelectorAll('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
    $('mode-none').hidden = m !== 'none';
    $('mode-upload').hidden = m !== 'upload';
    $('plan-fields').hidden = !(m === 'custom' || (m === 'upload' && extracted));
    $('fields-title').textContent = m === 'upload' ? 'Read from your plan' : 'Plan details';
    $('fields-note').textContent = m === 'upload' ? 'Check and correct anything we misread.' : 'Fill in what you know; leave the rest blank.';
  }
  document.querySelectorAll('.seg button').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });

  function fillFields(x) {
    FIELDS.forEach(function (k) {
      var el = $(k), v = x ? x.fields[k] : null;
      el.value = v == null ? '' : v;
      var note = document.querySelector('.src[data-for="' + k + '"]');
      note.textContent = x && x.src[k] ? 'Found: ' + x.src[k] : (x ? 'Not found in plan' : '');
    });
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { $('plan-error').textContent = 'Choose a PDF plan set.'; return; }
    selectedPlanFile = file;
    var version = ++readVersion;
    readingPlan = true; $('plan-apply').disabled = true;
    $('plan-error').textContent = '';
    extracted = null; setMode('upload');
    $('parse').hidden = false;
    var st = $('parse-status'); st.className = 'status';
    $('parse-msg').textContent = 'Reading ' + file.name + '…';
    $('parse-chips').innerHTML = '';
    try {
      var x = await window.PlanReader.read(file, function (i, n) { $('parse-msg').textContent = 'Reading ' + file.name + ': page ' + i + ' of ' + n; });
      if (version !== readVersion) return;
      extracted = x;
      if (x.textChars < 200) {
        st.className = 'status warn';
        $('parse-msg').textContent = 'This PDF has no readable text (it may be scanned). Enter the plan details by hand below.';
      } else {
        st.className = 'status done';
        $('parse-msg').textContent = 'Read ' + x.pages + ' pages of ' + file.name + ': found ' + x.found + ' of ' + FIELDS.length + ' details.';
      }
      var chips = (x.codes || []).slice(0, 4).map(function (c) { return c; })
        .concat(x.features.map(function (f) { return f.label; }))
        .concat(x.plan_sds ? ['SDS ' + x.plan_sds + 'g in structural notes'] : [])
        .concat(x.climate_zone ? ['Climate zone ' + x.climate_zone] : [])
        .concat(x.energy ? [x.energy.wallR ? 'Walls R-' + x.energy.wallR.cavity + (x.energy.wallR.ci ? ' + R-' + x.energy.wallR.ci + ' ci' : ' (no continuous)') : null,
          x.energy.ceilingR ? 'Ceiling R-' + x.energy.ceilingR : null, x.energy.slabR ? 'Slab R-' + x.energy.slabR : null,
          x.energy.windowU ? 'Windows U-' + x.energy.windowU : null, x.energy.ach50 ? x.energy.ach50 + ' ACH50' : null].filter(Boolean) : []);
      $('parse-chips').innerHTML = chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('');
      fillFields(x);
      setMode('upload');
    } catch (ex) {
      if (version !== readVersion) return;
      st.className = 'status warn';
      $('parse-msg').textContent = 'Could not read that PDF (' + ex.message + '). Enter the plan details by hand below.';
      extracted = { fields: {}, src: {}, features: [], codes: [], filename: file.name };
      fillFields(extracted); setMode('upload');
    } finally {
      if (version === readVersion) { readingPlan = false; $('plan-apply').disabled = false; }
    }
  }
  $('planfile').addEventListener('change', function () { handleFile(this.files[0]); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer.files[0]); });

  function planFromForm() {
    if (mode === 'none' || (mode === 'upload' && !extracted)) return null;
    var n = function (k) { var v = parseFloat($(k).value); return isNaN(v) ? null : v; };
    var v = function (k) { return $(k).value || null; };
    var x = mode === 'upload' ? extracted : null;
    var plan = { permitFacts: x ? x.permitFacts || [] : [], name: x ? x.filename : 'Plan details', filename: x ? x.filename : null,
      footprint: { residence_sf: n('residence_sf'), garage_sf: n('garage_sf'), width_ft: n('width_ft'), depth_ft: n('depth_ft') },
      bedrooms: n('bedrooms'), stories: n('stories'), foundation: v('foundation'), height_ft: n('height_ft'), fuel: v('fuel'), fireplace: v('fireplace'), cladding: v('cladding'),
      energy: x ? x.energy || null : null, energySrc: x && x.src ? x.src.energy || null : null,
      structural: { ground_snow_load_psf: n('ground_snow_load_psf'), bearing_psf: n('bearing_psf') },
      codes: x ? x.codes : [], features: x ? x.features : [], sheets: x ? x.sheets || null : null, pages: x ? x.pages : null, plan_sds: x ? x.plan_sds : null, plan_sdc: x ? x.plan_sdc : null, src: {} };
    // Keep provenance only for values the user left as read.
    if (x) FIELDS.forEach(function (k) { if (x.src[k] && String(x.fields[k]) === String($(k).value)) plan.src[k] = x.src[k]; });
    if (x && x.src.plan_sds) plan.src.plan_sds = x.src.plan_sds;
    var any = FIELDS.some(function (k) { return $(k).value; });
    if (!any && !x) return null;
    if (!plan.footprint.residence_sf && !plan.footprint.width_ft) delete plan.footprint.residence_sf;
    return plan;
  }

  /* ---------------- progress */
  var steps = LR.STEPS.map(function (s) { return { id: s[0], label: s[1], state: 'pending' }; });
  function renderSteps() {
    $('steps').innerHTML = steps.map(function (s) { return '<li class="' + s.state + '"><span class="ic" aria-hidden="true"></span>' + esc(s.label) + '</li>'; }).join('');
    var done = steps.filter(function (s) { return s.state === 'done' || s.state === 'failed'; }).length;
    $('bar').style.width = Math.max(4, Math.round(done / steps.length * 100)) + '%';
  }
  function fail(msg, options) {
    prog.classList.remove('on'); form.classList.remove('off');
    go.disabled = false; go.textContent = 'Generate dossier';
    err.textContent = msg;
    if (options && options.length) {
      // Offer the matches as one-click choices that fill the address field.
      var list = document.createElement('div'); list.className = 'matches';
      options.forEach(function (o) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'match'; b.textContent = typeof o === 'string' ? o : o.label;
        b.addEventListener('click', function () { $('address').value = typeof o === 'object' ? o.query : o.replace(/ \((.*?) County.*$/, ', $1 County').replace(/, parcel .*$/, ''); err.textContent = ''; $('address').focus(); });
        list.appendChild(b);
      });
      err.appendChild(list);
    }
    $('address').focus();
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.textContent = '';
    var q = $('address').value.trim();
    if (!/^\d+\s+\S+/.test(q) && !LR.looksLikeParcel(q)) { err.textContent = 'Enter a street address starting with the house number, or a county parcel ID.'; $('address').focus(); return; }
    // Every property starts with a site review; never carry another property's plan into it.
    var plan = null;
    readVersion++; readingPlan = false; extracted = null; selectedPlanFile = null; fillFields(null); setMode('none'); $('planfile').value = ''; $('parse').hidden = true;
    go.disabled = true;
    steps.forEach(function (s) { s.state = 'pending'; });
    form.classList.add('off'); prog.classList.add('on');
    $('phase').textContent = 'Finding the parcel';
    $('found-title').textContent = 'Looking up ' + q + '…';
    $('found-sub').textContent = 'Searching Utah county parcel records';
    renderSteps();
    var parcel;
    try { parcel = await LR.locate(q); }
    catch (ex) {
      if (ex.ambiguous) return fail(ex.message, ex.options);
      return fail(ex.notFound ? ex.message + '. Check the house number and street, or enter the county parcel ID instead.'
        : 'Could not reach the county parcel service (' + ex.message + '). Check your internet connection and try again.');
    }
    var a = parcel.attrs;
    $('found-title').textContent = a.PARCEL_ADD || 'Parcel ' + parcel.id;
    $('found-sub').textContent = 'Parcel ' + parcel.id + ' · ' + parcel.county + ' County · ' + a.PARCEL_ACRES + ' acres' + (a.SUBDIV_NAME ? ' · ' + a.SUBDIV_NAME : '');
    $('phase').textContent = 'Checking public records';
    var res = await LR.run(parcel, plan, DATA.costs, function (id, state) {
      steps.forEach(function (s) { if (s.id === id) s.state = state; }); renderSteps();
    });
    $('phase').textContent = 'Report ready';
    last = { parcel: parcel, plan: plan, findings: res.findings, facts: res.facts || {}, documents: res.documents, date: new Date() };
    window.dispatchEvent(new CustomEvent('cornerpin:report', { detail: last }));
    showReport();
    window.dispatchEvent(new CustomEvent('cornerpin:open-workflow', { detail: { tab: 'overview' } }));
    prog.classList.remove('on'); form.classList.remove('off'); go.disabled = false;
  });

  $('rv-plan').addEventListener('click', function () {
    if (!last) return;
    $('plan-property').textContent = last.parcel.attrs.PARCEL_ADD || 'Parcel ' + last.parcel.id;
    $('plan-error').textContent = ''; $('plan-update-status').textContent = '';
    $('plan-dialog-title').textContent = last.plan ? 'Update building plans' : 'Add building plans';
    $('plan-apply').disabled = readingPlan;
    $('plan-dialog').showModal();
  });
  $('plan-close').addEventListener('click', function () { if (!updatingPlan) $('plan-dialog').close(); });
  $('plan-dialog').addEventListener('cancel', function (e) { if (updatingPlan) e.preventDefault(); });
  $('plan-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!last || readingPlan || updatingPlan) return;
    var plan = planFromForm();
    if (mode !== 'none' && !plan) { $('plan-error').textContent = 'Upload a readable plan or enter at least one plan detail.'; return; }
    if (!$('plan-form').reportValidity()) return;
    updatingPlan = true;
    Array.from($('plan-form').elements).forEach(function (el) { el.disabled = true; });
    $('plan-error').textContent = '';
    try {
      var prior = last;
      var res = await LR.run(prior.parcel, plan, DATA.costs, function (id, state) {
        if (state === 'running') $('plan-update-status').textContent = 'Updating: ' + (LR.STEPS.find(function (s) { return s[0] === id; }) || [id, id])[1];
      }, prior.documents);
      last = { parcel: prior.parcel, plan: plan, findings: res.findings, facts: res.facts, documents: res.documents, date: prior.date, planUpdatedAt: new Date() };
      window.dispatchEvent(new CustomEvent('cornerpin:report', { detail: last }));
      if (mode === 'upload' && selectedPlanFile) window.dispatchEvent(new CustomEvent('cornerpin:planfile', { detail: selectedPlanFile }));
      $('plan-dialog').close(); showReport(true);
    } catch (ex) {
      $('plan-error').textContent = 'The plan check could not finish. Your previous report is unchanged. ' + (ex.message || ex);
    } finally {
      updatingPlan = false;
      Array.from($('plan-form').elements).forEach(function (el) { el.disabled = false; });
    }
  });

  /* ---------------- checklist store: statuses and attached files, kept in this browser per parcel */
  var Store = (function () {
    var mem = {}, dbp = null;
    function db() {
      if (dbp) return dbp;
      dbp = new Promise(function (res) {
        try {
          var rq = indexedDB.open(window.ProjectStore && window.ProjectStore.owner() ? 'lot-dossier-'+window.ProjectStore.owner() : 'lot-dossier', 1);
          rq.onupgradeneeded = function () { rq.result.createObjectStore('items'); };
          rq.onsuccess = function () { res(rq.result); };
          rq.onerror = function () { res(null); };
        } catch (e) { res(null); }
      });
      return dbp;
    }
    function fresh() { return { status: 'todo', files: [] }; }
    function valid(v) { return v && typeof v === 'object' && typeof v.status === 'string' && Array.isArray(v.files) ? v : null; }
    return {
      reset: function () { if(dbp)dbp.then(function(d){if(d)d.close();});dbp=null;mem={}; },
      get: function (k) {
        return db().then(function (d) {
          if (!d) return valid(mem[k]) || fresh();
          return new Promise(function (res) {
            try { var rq = d.transaction('items', 'readonly').objectStore('items').get(k); rq.onsuccess = function () { res(valid(rq.result) || valid(mem[k]) || fresh()); }; rq.onerror = function () { res(valid(mem[k]) || fresh()); }; }
            catch (e) { res(valid(mem[k]) || fresh()); }
          });
        });
      },
      put: function (k, v) {
        mem[k] = v;
        return db().then(function (d) {
          if (!d) return;
          try { d.transaction('items', 'readwrite').objectStore('items').put(v, k); } catch (e) { /* storage blocked: keep in memory */ }
        });
      }
    };
  })();
  var checklist = {}; // key -> {status, files:[{id,name,size,type,added,blob}]}
  function itemKey(x) { return last.parcel.county + '|' + last.parcel.id + '|' + x.section + '|' + x.item; }
  function sourceLead(x) { return /^(Historical entry |Later indexed record |Public original |Original .* page .* candidate )/.test(x.item||''); }
  function actionable(x) { return x.status !== 'ok' && !sourceLead(x); }

  /* ---------------- report */
  function rollup(findings) {
    var seen = {}, rows = [];
    findings.slice().sort(function (a, b) { return ORDER[a.status] - ORDER[b.status]; }).forEach(function (f) {
      if (f.cost && f.status !== 'ok' && !seen[f.cost.key]) { seen[f.cost.key] = 1; rows.push(f); }
    });
    return rows;
  }

  function platEvidenceSection(r) {
    var p = (r.facts || {}).platEvidence;
    if (!p) p = { sheets: [], evidence: [] };
    var readings = p.readings || [], preferred = readings[0];
    var review = window.PlatEvidence.assess(p);
    var gates = '<div class="easement-review"><h3>Evidence checklist · ' + esc(review.stage) + '</h3>' +
      '<p>' + (review.assessedAt ? 'Evidence evaluated ' + esc(review.assessedAt) + '. This is the dossier evaluation time, not the recording date, a fresh source check or a title effective date.' : 'No dated evidence evaluation is available.') + '</p>' +
      (p.recordSource && p.recordSource.url ? '<p><a href="' + esc(p.recordSource.url) + '" target="_blank" rel="noopener">County parcel record used</a></p>' : '') +
      '<p><b>Linked-sheet processing:</b> ' + (review.linkedSheets.complete ? 'Complete for the retrieved inventory' : 'Incomplete') + ' (' + review.linkedSheets.processed + '/' + review.linkedSheets.total + '). This does not complete the plat-scope or title review.</p>' +
      '<ol class="easement-gates">' + review.rows.map(function (g) {
        return '<li><h4>' + esc(g.label) + '</h4><p><b>' + esc(g.status) + '</b></p><p>' + esc(g.evidence) + '</p><p><b>Open gap:</b> ' + esc(g.gap) +
          '</p><p><b>Completion criterion:</b> ' + esc(g.criterion) + '</p></li>';
      }).join('') + '</ol><details><summary>How review status advances and when to refresh</summary><p>' + esc(review.stages.join(' → ')) +
      '. These are evidence milestones, not building approvals. Only the first stage is supported by the current public-record pipeline; title/survey/design reconciliation is not yet implemented.</p><p>' + esc(review.refresh) + '</p><p>' + esc(review.limit) + '</p></details></div>';
    var sources = (p.sheets || []).map(function (sh) {
      var read = readings.find(function (x) { return x.url === sh.url; });
      return '<li><a href="' + esc(sh.url) + '" target="_blank" rel="noopener">Original sheet ' + esc(sh.sheet) + '</a> — ' +
        (sh.processed ? 'OCR processed' : 'OCR incomplete') + (read ? '; lot label detected' + (read.nearSheetEdge ? ' near the sheet edge: check adjoining sheets' : '; label away from sheet edge (full boundary not verified)') : '') + '</li>';
    }).join('');
    var evidence = (p.evidence || []).map(function (x) {
      return '<li><b>' + esc((x.categories || []).join(' / ')) + '</b><p>' + esc(x.scope) + '.</p><blockquote>' + esc(x.text) + '</blockquote>' +
        '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">Sheet ' + esc(x.sheet) + '</a>' +
        ((x.entries || []).length ? '<p>Recorded entry references: ' + esc(x.entries.join(', ')) + ' (instrument text not retrieved).</p>' : '') + '</li>';
    }).join('');
    var historical = p.history ? '<details><summary>Prior-parcel records (' + p.history.processed + ' of ' + p.history.total + ' checked; one generation)</summary><p>These records can reveal older restrictions. Historical plat lot numbers are not automatically matched to this lot, and instrument images have not been read.</p>' +
      (p.history.records || []).map(function (h) {
        return '<div><h3>' + (h.url ? '<a href="' + esc(h.url) + '" target="_blank" rel="noopener">Prior parcel ' + esc(h.parcel) + '</a>' : esc(h.parcel)) + '</h3>' +
          (h.error ? '<p>Record lookup failed; history is incomplete.</p>' : '<p>' + esc((h.references || []).map(function (x) { return 'Entry ' + x.entry + ' (' + (x.label || x.kind || 'instrument') + ')'; }).join('; ') || 'No references extracted.') + '</p><ul>' +
          (h.plats || []).map(function (sh) { return '<li><a href="' + esc(sh.url) + '" target="_blank" rel="noopener">Historical parcel plat ' + esc(sh.sheet) + '</a> — not reconciled to the current lot</li>'; }).join('') + '</ul>' +
          ((h.priorParcels || []).length ? '<p>Further ancestry not checked: ' + esc(h.priorParcels.join(', ')) + '.</p>' : '')) + '</div>';
      }).join('') + '</details>' : '';
    var conflicts = (p.conflicts || []).map(function (c) { return esc(c.field) + ': ' + esc(c.values.join(' / ')); }).join('; ');
    return '<section class="card plat-evidence" id="plat-evidence"><div class="eyebrow">Recorded evidence · ' + esc(review.stage) + '</div><h2>Easements &amp; evidence coverage</h2>' + gates +
      '<p>' + review.linkedSheets.processed + ' of ' + review.linkedSheets.total + ' linked sheets processed by OCR. This counts text processing, not verification of every easement or the whole lot boundary.</p>' +
      '<p>A single sheet may cut through a lot. Read the adjoining drawings and the notes, dedication and legend sheets together. Original scans are preserved; we do not invent or stitch easement geometry.</p>' +
      (p.bundleUrl ? '<p><a class="pk-btn" href="' + esc(p.bundleUrl) + '" download="recorded-plat.pdf">Download all linked plat sheets (PDF)</a></p>' : '') +
      (preferred ? '<p>Suggested starting sheet: <a href="' + esc(preferred.url) + '" target="_blank" rel="noopener">' + esc(preferred.sheet) + '</a>. Selected by lot-label position; confirm the entire boundary visually.</p>' : '') +
      '<ul class="plat-sheets">' + sources + '</ul>' +
      (readings.length ? '<p>Lot facts are combined across these sheets; a preferred sheet is a navigation aid, not the sole source.</p>' : '') +
      (conflicts ? '<p><b>Conflicting OCR readings need review:</b> ' + conflicts + '</p>' : '') +
      '<details><summary>Potential easement evidence (' + (p.evidence || []).length + ' text excerpts)</summary><p>These are discovery leads. Nearby labels, general notes and legends can concern other parcels. Widths, beneficiaries, permitted uses, duration and release status require the recorded instrument and mapped boundaries.</p>' +
      (evidence ? '<ul class="easement-excerpts">' + evidence + '</ul>' : '<p>No reliable easement excerpts were extracted. That does not mean the lot is free of easements.</p>') + '</details>' +
      historical + '<p><b>Not yet resolved:</b> separately recorded easements, prior-parcel history, amendments/releases, current title exceptions and survey-confirmed geometry. The draft site plan checks setbacks only; it does not clear the house or driveway against easements.</p></section>';
  }

  function reportHTML(r, state, saved) {
    var a = r.parcel.attrs, f = LR.reviewFindings(r.findings), plan = r.plan;
    var count = function (s) { return f.filter(function (x) { return x.status === s && !sourceLead(x); }).length; };
    var costs = rollup(f);
    var row = function (x) {
      var src = x.source ? (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.source) + '</a>' : esc(x.source)) : '';
      var k = itemKey(x), st = (state && state[k]) || { status: 'todo', files: [] }, chk = '';
      if (actionable(x)) {
        chk = saved
          ? '<div class="chk saved-chk"><span class="chk-state st-' + st.status + '">' + { todo: 'To do', done: 'Done', na: 'N/A' }[st.status] + '</span>' +
            (st.files.length ? '<span class="chk-files">Attached: ' + st.files.map(function (f) { return esc(f.name); }).join(', ') + '</span>' : '') + '</div>'
          : '<div class="chk" data-key="' + esc(k) + '"><div class="chk-seg" role="group" aria-label="Checklist status">' +
            ['todo', 'done', 'na'].map(function (v) { return '<button type="button" data-st="' + v + '" aria-pressed="' + (st.status === v) + '">' + { todo: 'To do', done: 'Done', na: 'N/A' }[v] + '</button>'; }).join('') +
            '</div><label class="chk-attach">Attach file<input type="file" multiple></label><ul class="chk-list"></ul></div>';
      }
      return '<article class="frow s-' + x.status + (actionable(x) ? ' act st-' + st.status : '') + '"><div class="badge">' + STATUS[x.status] + '</div><div><div class="item">' + esc(x.item) + '</div><h4>' + esc(x.headline) + '</h4>' +
        (x.detail ? '<p>' + esc(x.detail) + '</p>' : '') + (x.next_step ? '<div class="next"><b>Next step</b> ' + esc(x.next_step) + '</div>' : '') +
        (x.cost && x.status !== 'ok' ? '<div class="cost"><span>Unvalidated planning range · </span>' + money(x.cost.low) + '&ndash;' + money(x.cost.high) + ' <span>' + esc(x.cost.label) + '</span></div>' : '') +
        '<div class="src">' + src + '</div>' + chk + '</div></article>';
    };
    var order = LR.CHECKLIST.filter(function (c) { return c[0] === 'plan'; }).concat(LR.CHECKLIST.filter(function (c) { return c[0] !== 'plan'; }));
    var groups = order.map(function (c) {
      var fs = f.filter(function (x) { return x.section === c[0]; }).sort(function (p, q) { return ORDER[p.status] - ORDER[q.status]; });
      if (!fs.length) return '';
      return '<section class="group" data-category="' + esc(c[0]) + '"><header><span class="dot s-' + fs[0].status + '"></span><h3>' + esc(c[1]) + '</h3><span class="n">' + fs.length + '</span></header>' + fs.filter(function(x){return !sourceLead(x);}).map(row).join('') + (fs.some(sourceLead)?'<details class="source-leads"><summary>'+fs.filter(sourceLead).length+' unverified record leads — not confirmed restrictions</summary><p>These references may concern earlier or neighboring land. They are excluded from the concern totals and action checklist until their applicability is established.</p>'+fs.filter(sourceLead).map(row).join('')+'</details>':'') + '</section>';
    }).join('');
    var flags = f.filter(function (x) { return x.status === 'flag'; });
    var top = flags.length ? flags.map(function (x) { return '<li><b>' + esc(x.item) + '.</b> ' + esc(x.headline) + '</li>'; }).join('') : '<li>No high-priority concerns identified in the checks completed. Missing records and verification items remain open.</li>';
    var next = f.slice().sort(function (p, q) { return ORDER[p.status] - ORDER[q.status]; }).filter(function (x) { return x.next_step; })
      .map(function (x) { return '<li><span class="dot s-' + x.status + '"></span>' + esc(x.next_step) + '</li>'; }).join('');
    var KIND = { building: 'Plan approval & permits', planning: 'Planning & zoning', office: 'City / county office', records: 'Records not posted online', hoa: 'HOA (state registry)' };
    var contacts = ((r.facts || {}).contacts || []).slice().sort(function (p, q) { return Object.keys(KIND).indexOf(p.kind) - Object.keys(KIND).indexOf(q.kind); });
    var link = function (u, t) { return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + '</a>' : ''; };
    var contactsHtml = contacts.length ? '<div class="card contacts"><h2>Contacts</h2><div class="ct-grid">' + contacts.map(function (c) {
      return '<div class="ct"><div class="ct-k">' + esc(KIND[c.kind] || 'Jurisdiction') + '</div><b>' + esc(c.name) + '</b>' +
        (c.people || []).map(function (p) { return '<div class="ct-p"><span>' + esc(p.role) + '</span>' + (p.phone ? '<a href="tel:' + esc(p.phone.replace(/[^\d]/g, '')) + '">' + esc(p.phone) + '</a>' : '') +
          (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '') + '</div>'; }).join('') +
        (c.lines || []).map(function (l) { return '<div class="ct-l">' + esc(l) + '</div>'; }).join('') +
        '<div class="ct-links">' + [link(c.portal, 'Permit portal'), link(c.url, 'Website'), c.mailto ? '<a href="' + esc(c.mailto) + '">Draft a records request</a>' : ''].filter(Boolean).join(' · ') + '</div></div>';
    }).join('') + '</div>' + (contacts[0] && contacts[0].asOf ? '<p class="ct-src">From the jurisdiction\'s published pages, ' + esc(contacts[0].asOf) + '.</p>' : '') + '</div>' : '';
    var packetHtml = packetSection((r.facts || {}).packet);
    var costRows = costs.map(function (x) { return '<tr><td><span class="dot s-' + x.status + '"></span>' + esc(x.cost.label) + '</td><td>' + money(x.cost.low) + '</td><td>' + money(x.cost.high) + '</td></tr>'; }).join('');
    var planHtml = '';
    if (plan) {
      var fp = plan.footprint || {}, cells = [['Plan', plan.name]];
      if (fp.residence_sf) cells.push(['Footprint', fmt(fp.residence_sf) + (fp.garage_sf ? ' + ' + fmt(fp.garage_sf) : '') + ' sq ft']);
      if (fp.width_ft && fp.depth_ft) cells.push(['Envelope', Math.round(fp.width_ft) + '′ × ' + Math.round(fp.depth_ft) + '′']);
      if (plan.bedrooms) cells.push(['Bedrooms', plan.bedrooms]);
      if (plan.foundation) cells.push(['Foundation', { basement: 'Basement', crawlspace: 'Crawlspace', slab: 'Slab on grade' }[plan.foundation]]);
      if ((plan.structural || {}).ground_snow_load_psf) cells.push(['Snow load', plan.structural.ground_snow_load_psf + ' psf']);
      planHtml = '<div class="planfacts">' + cells.slice(0, 4).map(function (c) { return '<div><span>' + esc(c[0]) + '</span><b>' + esc(c[1]) + '</b></div>'; }).join('') + '</div>';
    }
    var legal = a.SUBDIV_NAME || '';
    var pc = f.filter(function (x) { return x.section === 'plan' && (x.status === 'flag' || x.status === 'watch'); });
    var planSum = plan ? '<h2 style="margin-top:18px">Plan conflicts</h2><ul class="top">' + (pc.length ? pc.map(function (x) { return '<li><b>' + esc(x.item) + '.</b> ' + esc(x.headline) + '</li>'; }).join('') : '<li>No confirmed conflicts in the checks completed. ' + f.filter(function (x) { return x.section === 'plan' && x.status === 'verify'; }).length + ' plan checks still need verification, including easement clearance.</li>') + '</ul>' : '';
    var date = r.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return '<div class="wrap"><div class="eyebrow">Site report · ' + esc(date) + '</div><h1>' + esc(a.PARCEL_ADD || 'Parcel ' + r.parcel.id) + '</h1>' +
      '<div class="meta"><span>' + esc((a.PARCEL_CITY || '') + ', UT') + '</span><span>' + esc(legal) + '</span><span>Parcel ' + esc(r.parcel.id) + ' · ' + esc(r.parcel.county) +
      ' County</span><span>' + esc(a.PARCEL_ACRES) + ' acres</span></div>' +
      '<div class="hero2"><div id="map" role="img" aria-label="Aerial map of the parcel boundary"></div><div class="card">' +
      '<div class="tally"><div class="t-flag"><b>' + count('flag') + '</b><span>Concerns</span></div><div class="t-watch"><b>' + count('watch') + '</b><span>Review</span></div>' +
      '<div class="t-verify"><b>' + count('verify') + '</b><span>Verify</span></div><div class="t-ok"><b>' + count('ok') + '</b><span>No issue identified</span></div></div>' +
      (f.some(sourceLead)?'<p class="source-lead-note">'+f.filter(sourceLead).length+' historical/source leads are grouped under their topics, separate from these finding totals.</p>':'')+checklistSummary(f, state, saved) +
      '<h2>Cost considerations</h2><p>' + costs.length + ' items to price. The report identifies potential work; it does not establish a lot-specific construction budget.</p>' +
      '<h2 style="margin-top:18px">Priority findings</h2><ul class="top">' + top + '</ul>' + planSum + ((r.facts || {}).packet ? '<p class="pk-jump"><a href="#packet">Permit packet: ' + r.facts.packet.ready + ' of ' + r.facts.packet.needed + ' application items ready or drafted &darr;</a></p>' : '') + '</div></div>' + planHtml + contactsHtml + platEvidenceSection(r) + groups +
      packetHtml + '<div class="two"><div class="card"><h2>Next steps</h2><ol class="nextsteps">' + next + '</ol></div>' +
      '<div class="card"><h2>Items to price</h2><details><summary>Unvalidated planning ranges (' + costs.length + ' items)</summary><p>These generic placeholders are not bids or site-specific estimates. They may overlap or represent alternatives; do not add them into a project budget.</p><table><thead><tr><th>Item</th><th>Low</th><th>High</th></tr></thead><tbody>' + costRows + '</tbody></table></details></div></div>' +
      '<p class="disclaimer">Screening report built from public data (UGRC, Utah Geological Survey, Utah Division of Water Rights, Weber County GIS, USDA NRCS, USGS, FEMA). ' +
      'Regional maps miss site-specific conditions. This is not a survey, geotechnical report, title report or appraisal. Cost ranges are placeholders until calibrated with local bids.</p></div>';
  }

  // Permit packet: what we gathered, estimated or drafted for the building permit application.
  var PK_STATUS = { ready: ['Ready', 'ok'], drafted: ['Drafted for you', 'ok'], partial: ['Partly there', 'watch'], pro: ['Needs a professional', 'verify'], you: ['Needs you', 'verify'], optional: ['Optional', 'muted'], na: ['Not needed', 'muted'] };
  function dataUri(type, text) { return 'data:' + type + ';charset=utf-8,' + encodeURIComponent(text); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50); }
  function packetSection(pk) {
    if (!pk) return '<section class="card packet" id="packet"><div class="eyebrow">Next: the building permit</div><h2>Permit packet unavailable</h2><p>The permit preparation check did not finish. Your site findings are still available above. Generate the site report again to retry.</p></section>';
    var tl = pk.timeline, pct = Math.round(pk.ready / pk.needed * 100);
    var letterById = {}; pk.letters.forEach(function (l) { letterById[l.id] = l; });
    var appText = pk.rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
    var items = pk.items.map(function (it) {
      var st = PK_STATUS[it.status] || [it.status, 'muted'], acts = [];
      var l = it.letter && letterById[it.letter];
      if (l) {
        if (l.email) acts.push('<a class="pk-btn" href="mailto:' + esc(l.email) + '?subject=' + encodeURIComponent(l.subject) + '&body=' + encodeURIComponent(l.body) + '">Email draft</a>');
        acts.push('<a class="pk-btn" href="' + esc(dataUri('text/plain', (l.mail ? l.to + '\n' + l.mail + '\n\n' : '') + 'Subject: ' + l.subject + '\n\n' + l.body)) + '" download="' + slug(l.title) + '.txt">Download letter</a>');
        acts.push('<a class="pk-btn ghost" href="#pk-letter-' + esc(l.id) + '">Read it</a>');
      }
      if (/site plan/i.test(it.title) && pk.sitePlan) acts.push('<a class="pk-btn" href="' + esc(dataUri('image/svg+xml', pk.sitePlan.svg)) + '" download="draft-site-plan.svg">Download site plan</a>', '<a class="pk-btn ghost" href="#pk-siteplan">View</a>');
      if (/^Application data/.test(it.title)) acts.push('<button type="button" class="pk-btn" data-copy="pk-app">Copy all</button>', '<a class="pk-btn ghost" href="#pk-app-table">View</a>');
      if (it.link) acts.push('<a class="pk-btn ghost" href="' + esc(it.link) + '" target="_blank" rel="noopener">Template</a>');
      return '<li class="pk-item"><span class="pk-badge s-' + st[1] + '">' + esc(st[0]) + '</span><div><b>' + esc(it.title) + '</b>' +
        '<span class="pk-who">' + esc(it.who || '') + (it.why ? ' · ' + esc(it.why) : '') + (it.lead && it.lead[1] ? ' · typically ' + (it.lead[0] === it.lead[1] ? it.lead[1] : it.lead[0] + '-' + it.lead[1]) + ' business days' : '') + '</span>' +
        '<p>' + esc(it.detail) + '</p>' + (acts.length ? '<div class="pk-acts">' + acts.join('') + '</div>' : '') + '</div></li>';
    }).join('');
    var letters = pk.letters.map(function (l) {
      return '<details class="pk-letter" id="pk-letter-' + esc(l.id) + '"><summary>' + esc(l.title) + ' <span>to ' + esc(l.to) + (l.email ? ' (' + esc(l.email) + ')' : l.mail ? ' (' + esc(l.mail) + ')' : '') + '</span></summary>' +
        '<p class="pk-subj"><b>Subject:</b> ' + esc(l.subject) + '</p><pre>' + esc(l.body) + '</pre></details>';
    }).join('');
    var rows = pk.rows.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td class="pk-src">' + esc(r[2]) + '</td></tr>'; }).join('');
    return '<section class="card packet" id="packet"><div class="eyebrow">Next: the building permit</div><h2>Permit packet · ' + esc(pk.jurisdiction) + '</h2>' +
      '<p class="pk-sub">Everything public records and your plan let us fill in, estimate or draft. Utah law gives the city 3 business days to screen a complete application and 14 more to finish plan review for a house (Utah Code 10-20-909), so a complete packet on day one is the fastest path.</p>' +
      '<div class="pk-meter"><div class="chk-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div><span><b>' + pk.ready + ' of ' + pk.needed + '</b> items ready or drafted</span></div>' +
      '<ol class="pk-timeline"><li><b>Today</b> Send the drafted requests; order the survey' + (pk.items.some(function (i) { return /Structural calculations/.test(i.title) && i.status !== 'ready'; }) ? ' and structural engineering' : '') + '.</li>' +
      '<li><b>' + esc(tl.submitLo) + ' to ' + esc(tl.submitHi) + '</b> Earliest realistic submittal. Longest lead: ' + esc(tl.critical.join('; ')) + '.</li>' +
      '<li><b>+3 business days</b> City must accept or reject the application as incomplete.</li>' +
      '<li><b>' + esc(tl.issueLo) + ' to ' + esc(tl.issueHi) + '</b> Plan review due (14 business days after screening). Holidays and correction rounds can add time.</li></ol>' +
      (pk.portal ? '<p class="pk-portal">Submit through the <a href="' + esc(pk.portal) + '" target="_blank" rel="noopener">city permit portal</a>' + (pk.checklist ? ' · <a href="' + esc(pk.checklist) + '" target="_blank" rel="noopener">city submission checklist</a>' : '') + '.</p>' : '') +
      '<ol class="pk-items">' + items + '</ol>' +
      '<h3 id="pk-app-table">Application data</h3><p class="pk-note">Prefilled from the county record, the recorded plat, zoning, the hazard maps and your plan. Values marked as estimates are ours; check them before you sign.</p>' +
      '<div class="pk-acts"><button type="button" class="pk-btn" data-copy="pk-app">Copy all</button><a class="pk-btn ghost" href="' + esc(dataUri('text/plain', appText)) + '" download="permit-application-data.txt">Download</a></div>' +
      '<textarea id="pk-app" hidden>' + esc(appText) + '</textarea><div class="pk-table"><table>' + rows + '</table></div>' +
      (pk.sitePlan ? '<h3 id="pk-siteplan">Draft site plan</h3><p class="pk-note">Lot lines, setback limits, ' + (pk.sitePlan.fits === false ? 'the house envelope (it does not fit inside the setbacks as placed), ' : 'the house envelope placed closest to the street, ') + 'driveway and LiDAR contours. Easements are not mapped or checked against the house or driveway; setback fit is not a buildability determination.</p>' +
        '<img class="pk-plan" alt="Draft site plan of the lot" src="' + esc(dataUri('image/svg+xml', pk.sitePlan.svg)) + '">' : '') +
      (letters ? '<h3>Drafted requests</h3><p class="pk-note">Written with this lot\'s details. Add your name and contact information, then send.</p>' + letters : '') +
      '</section>';
  }

  function checklistSummary(f, state, saved) {
    var items = f.filter(actionable), done = 0, files = 0;
    items.forEach(function (x) { var st = (state && state[itemKey(x)]) || { status: 'todo', files: [] }; if (st.status !== 'todo') done++; files += st.files.length; });
    var pct = items.length ? Math.round(done / items.length * 100) : 100;
    return '<div class="chk-sum"><h2>Checklist</h2><div class="chk-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<div class="chk-sum-row"><span><b class="chk-done">' + done + '</b> of ' + items.length + ' items closed · <b class="chk-nfiles">' + files + '</b> file' + (files === 1 ? '' : 's') + ' attached</span>' +
      (saved ? '' : '<label class="chk-only-toggle"><input type="checkbox" id="chk-only"> Show checklist only</label>') + '</div></div>';
  }

  function refreshSummary() {
    var box = document.querySelector('#rv .chk-sum'); if (!box || !last) return;
    var tmp = document.createElement('div'); tmp.innerHTML = checklistSummary(LR.reviewFindings(last.findings), checklist, false);
    var only = $('chk-only') && $('chk-only').checked;
    box.replaceWith(tmp.firstChild); if ($('chk-only')) $('chk-only').checked = !!only;
  }
  function renderFiles(el, st) {
    var ul = el.querySelector('.chk-list');
    ul.innerHTML = st.files.map(function (f, i) {
      return '<li><button type="button" class="chk-open" data-i="' + i + '">' + esc(f.name) + '</button><span>' + Math.max(1, Math.round(f.size / 1024)) + ' KB · ' +
        new Date(f.added).toLocaleDateString('en-US') + '</span><button type="button" class="chk-rm" data-i="' + i + '" aria-label="Remove ' + esc(f.name) + '">Remove</button></li>';
    }).join('');
  }
  function applyState(el, st) {
    el.querySelectorAll('.chk-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.st === st.status)); });
    var art = el.closest('.frow'); art.classList.remove('st-todo', 'st-done', 'st-na'); art.classList.add('st-' + st.status);
    renderFiles(el, st);
  }
  function loadChecklist() {
    checklist = {};
    var els = Array.prototype.slice.call(document.querySelectorAll('#rv .chk[data-key]'));
    return Promise.all(els.map(function (el) {
      var k = el.getAttribute('data-key');
      return Store.get(k).then(function (st) { checklist[k] = st; applyState(el, st); });
    })).then(refreshSummary);
  }
  // One delegated handler for every checklist control in the report.
  document.addEventListener('click', function (e) {
    var cp = e.target.closest && e.target.closest('#rv [data-copy], #project-workspace [data-copy]');
    if (cp) {
      var src = document.getElementById(cp.getAttribute('data-copy')), txt = src ? src.value || src.textContent : '';
      var done = function () { var t = cp.textContent; cp.textContent = 'Copied'; setTimeout(function () { cp.textContent = t; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () {});
      else { src.hidden = false; src.select(); try { document.execCommand('copy'); done(); } catch (x) {} src.hidden = true; }
      return;
    }
    var el = e.target.closest && e.target.closest('#rv .chk[data-key]'); if (!el) return;
    var k = el.getAttribute('data-key'), st = checklist[k] || { status: 'todo', files: [] };
    if (e.target.matches('.chk-seg button')) { st.status = e.target.dataset.st; }
    else if (e.target.matches('.chk-open')) { var f = st.files[+e.target.dataset.i]; if (f && f.blob) window.open(URL.createObjectURL(f.blob), '_blank'); return; }
    else if (e.target.matches('.chk-rm')) { st.files.splice(+e.target.dataset.i, 1); }
    else return;
    checklist[k] = st; Store.put(k, st); applyState(el, st); refreshSummary();
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'chk-only') { document.body.classList.toggle('chk-only', e.target.checked); return; }
    var el = e.target.closest && e.target.closest('#rv .chk[data-key]'); if (!el || e.target.type !== 'file') return;
    var k = el.getAttribute('data-key'), st = checklist[k] || { status: 'todo', files: [] };
    Array.prototype.forEach.call(e.target.files, function (f) {
      st.files.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), name: f.name, size: f.size, type: f.type, added: Date.now(), blob: f });
    });
    // Attaching the document usually means the item is handled; mark it done unless the user chose N/A.
    if (st.status === 'todo' && e.target.files.length) st.status = 'done';
    e.target.value = '';
    checklist[k] = st; Store.put(k, st); applyState(el, st); refreshSummary();
  });

  function drawMap(rings) {
    var el = document.getElementById('map');
    if (!window.L) { el.textContent = 'Map needs an internet connection.'; return; }
    try {
      if (map) { map.remove(); map = null; }
      map = L.map(el, { scrollWheelZoom: false });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }).addTo(map);
      var poly = L.polygon(rings.map(function (r) { return r.map(function (p) { return [p[1], p[0]]; }); }), { color: '#ffd54a', weight: 3, fillOpacity: 0.08 }).addTo(map);
      map.fitBounds(poly.getBounds(), { padding: [30, 30] });
    } catch (e) { el.textContent = 'Map unavailable.'; }
  }

  window.addEventListener('cornerpin:restore-report', function (e) {
    last = JSON.parse(JSON.stringify(e.detail));
    last.date = new Date(last.date);
    if (last.planUpdatedAt) last.planUpdatedAt = new Date(last.planUpdatedAt);
    readVersion++; readingPlan = false; selectedPlanFile = null; $('planfile').value = ''; $('parse').hidden = true;
    extracted = last.plan ? Object.assign({}, last.plan, {
      filename: last.plan.filename || last.plan.name,
      fields: Object.assign({}, last.plan, last.plan.footprint || {}, last.plan.structural || {}),
      permitFacts: last.plan.permitFacts || [], src: Object.assign({}, last.plan.src || {}, { energy: last.plan.energySrc })
    }) : null;
    fillFields(extracted); setMode(extracted ? 'upload' : 'none');
    showReport();
  });
  var renderedReportKey = '';
  function showReport(fromHistory) {
    var nextReportKey=JSON.stringify(last), reuse=renderedReportKey===nextReportKey && $('rv-body').children.length;
    if(!reuse){
    renderedReportKey=nextReportKey;
    $('rv-body').innerHTML = reportHTML(last, null, false);
    if (window.ReportCategories) window.ReportCategories.mount($('rv-body'));
    }
    document.body.classList.add('show-report');
    $('rv-plan').textContent = last.plan ? 'Update building plans' : 'Add building plans';
    document.body.classList.remove('chk-only');
    loadChecklist();
    document.title = 'Cornerpin · ' + (last.parcel.attrs.PARCEL_ADD || last.parcel.id);
    if(!reuse){window.scrollTo(0, 0);drawMap(last.parcel.rings);}
    if (!fromHistory) try { history.pushState({ report: true }, '', '#report'); } catch (e) {}
    window.dispatchEvent(new CustomEvent('cornerpin:report-visible'));
  }
  function showHome(fromHistory) {
    document.body.classList.remove('show-project','project-frame-active');
    document.body.classList.remove('show-report');
    document.title = 'Cornerpin';
    if (!fromHistory) try { history.pushState({}, '', location.pathname); } catch (e) {}
    $('address').focus();
  }
  $('rv-new').addEventListener('click', function () { showHome(); });
  window.CornerpinReportViews = { packet: packetSection };
  window.addEventListener('cornerpin:account-changed', function () { last=null;checklist={};Store.reset();readVersion++;extracted=null;selectedPlanFile=null;readingPlan=false;fillFields(null);setMode('none');$('planfile').value='';$('address').value='';if(map){map.remove();map=null;} });
  window.addEventListener('cornerpin:home', function () { showHome(); });
  window.addEventListener('cornerpin:refresh', async function(e){
    if(go.disabled)return;go.disabled=true;showHome();form.classList.add('off');prog.classList.add('on');
    steps.forEach(function(s){s.state='pending';});renderSteps();$('phase').textContent='Refreshing public evidence';
    var prior=e.detail;DATA.refreshNonce=Date.now();
    try{var res=await LR.run(prior.parcel,prior.plan,DATA.costs,function(id,state){steps.forEach(function(s){if(s.id===id)s.state=state;});renderSteps();});
      last={parcel:prior.parcel,plan:prior.plan,findings:res.findings,facts:res.facts||{},documents:res.documents,date:new Date()};window.dispatchEvent(new CustomEvent('cornerpin:report',{detail:last}));showReport();window.dispatchEvent(new CustomEvent('cornerpin:open-workflow',{detail:{tab:'overview'}}));
    }catch(err){fail('Refresh failed: '+err.message);}finally{delete DATA.refreshNonce;go.disabled=false;form.classList.remove('off');prog.classList.remove('on');}
  });

  $('rv-print').addEventListener('click', function () { window.print(); });
  window.addEventListener('popstate', function (e) {
    var target = document.getElementById(location.hash.slice(1));
    if (document.body.classList.contains('show-project') && target && target.closest('#project-workspace')) return;
    var reportTarget = location.hash === '#report' || (target && $('rv').contains(target));
    var showingReport = document.body.classList.contains('show-report');
    if (last && ((e.state && e.state.report) || reportTarget)) {
      if (!showingReport) showReport(true);
    } else if (showingReport) showHome(true);
  });

  /* Save the current report as its own small HTML file (to email or archive). */
  $('rv-save').addEventListener('click', function () {
    if (!last) return;
    var css = Array.prototype.map.call(document.querySelectorAll('style'), function (s) { return s.textContent; }).join('\n');
    var rings = JSON.stringify(last.parcel.rings.map(function (r) { return r.map(function (p) { return [p[1], p[0]]; }); }));
    var nav = document.querySelector('#rv .topnav').outerHTML;
    var doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(document.title) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">' +
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"><style>' + css + '</style></head>' +
      '<body class="show-report saved"><div id="rv">' + nav + '<div id="rv-body">' + reportHTML(last, checklist, true) + '</div></div>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script><script>try{var m=L.map("map",{scrollWheelZoom:false});' +
      'L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:20,attribution:"Imagery &copy; Esri, Maxar, Earthstar Geographics"}).addTo(m);' +
      'var p=L.polygon(' + rings + ',{color:"#ffd54a",weight:3,fillOpacity:.08}).addTo(m);m.fitBounds(p.getBounds(),{padding:[30,30]});}catch(e){document.getElementById("map").textContent="Map needs an internet connection."}' +
      'document.querySelectorAll("[data-print]").forEach(function(b){b.onclick=function(){print()}});<\/script></body></html>';
    var slug = (last.parcel.attrs.PARCEL_ADD || last.parcel.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    var link = document.createElement('a'); link.href = url; link.download = 'cornerpin-' + slug + '.html';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });
})();
