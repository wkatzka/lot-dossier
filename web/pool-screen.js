/* Private residential in-ground pool screening; no placement or permit clearance. */
(function (root) {
  'use strict';
  var code = 'https://ogdenvalley.gov/wp-content/uploads/2026/08/Chapter-108-7-Supplementary-And-Qualifying-Regulations.pdf#page=16';
  function screen(f, now) {
    var out = [], local = f.jurisdiction === 'Ogden Valley City';
    function add(item, status, headline, detail, source, url) {
      out.push({ section: 'pool', item: item, status: status, headline: headline, detail: detail,
        source: source || 'Existing dossier findings · pool screening inference', url: url || null, cost: null, next_step: null });
    }
    add('Pool feasibility', 'verify', 'Private in-ground pool: placement and engineering not yet cleared',
      'This screen reuses the lot evidence without requiring a pool plan. It does not calculate a buildable pool area or quote construction costs. A pool layout must include the shell, deck, equipment, safety barrier and construction access. Shared, rental, public, aboveground and natural pools need separate classification and rules.');
    if (local) {
      add('Pool location and setbacks', 'verify', 'Side or rear; 10 ft minimum for pool and machinery, with larger zone setbacks controlling',
        'City section 108-7-18 permits permanent in-ground pools as accessory uses subject to its conditions. Equipment enclosures follow accessory-building setbacks. The applicable zone and recorded restrictions must still be reconciled with a surveyed layout; house setbacks alone do not clear a pool.',
        'Ogden Valley City LUC 108-7-18 · checked 2026-11-07', code);
      add('Pool safety and lighting', 'verify', 'City publishes a 6 ft fence or qualifying power safety cover requirement',
        'The city text specifies a substantial enclosure with a locked gate, or a code-compliant power safety cover, and lighting directed away from adjoining properties. Use the linked city provision and the state pool-code source below to check the selected barrier/cover design with Ogden Valley City building review.',
        'Ogden Valley City LUC 108-7-18 · checked 2026-11-07', code);
      add('Pool permit preparation', 'verify', 'City building review route identified; pool-specific fee and submission checklist not verified',
        'Carry this parcel and its dossier evidence into the city application. Prepare a dimensioned pool/deck/equipment layout, structural design, grading/drainage, electrical bonding and safety details. These are preparation items, not a verified city pool checklist. The existing house permit packet does not include a completed pool application.',
        'Ogden Valley City permit submission requirements', 'https://ogdenvalley.gov/wp-content/uploads/2026/09/OgdenValley_PermitSubmissionRequirements.pdf');
    } else add('Local pool rules', 'verify', 'Pool rules have not been researched for this jurisdiction',
      'The pilot rules apply only within Ogden Valley City. No setback, barrier or permit assumption is transferred to this lot.');
    var date = (now || new Date()).toISOString().slice(0, 10);
    add('State pool code', 'verify', date >= '2026-07-01' && date < '2027-01-01' ? 'Utah adopts the residential provisions of the 2024 ISPSC' : 'State pool code edition needs a new verification',
      'The verified version of Utah Code 15A-2-103 applies July 1–December 31, 2026. It identifies the residential pool code; it does not establish this design’s compliance. Later applications require checking the successor statute. Public-pool health fees have not been applied to this private residential screen.',
      'Utah Code 15A-2-103(1)(n)', 'https://le.utah.gov/xcode/Title15A/Chapter2/C15A-2-S103_2026050620260701.html');
    var observations = [], shallow = false;
    if (Number.isFinite(f.water_table_in)) {
      observations.push('Soil-survey seasonal water table: about ' + f.water_table_in + ' in below ground (mapped estimate, not a site measurement).');
      shallow = f.water_table_in < 72;
    }
    if (f.boreholes && Number.isFinite(f.boreholes.gwMin) && f.boreholes.nearestKm < 0.5) {
      observations.push('Nearby boring archive reports groundwater as shallow as ' + f.boreholes.gwMin + ' ft; measurements may concern different locations and dates.');
      shallow = shallow || f.boreholes.gwMin < 6;
    }
    add('Pool excavation and groundwater', shallow ? 'watch' : 'verify', shallow ? 'Shallow groundwater is a pool engineering concern' : 'Groundwater at the proposed excavation remains unverified',
      (observations.join(' ') || 'No usable groundwater depth is available in this dossier.') + ' The 6 ft screening threshold is a planning flag, not a code limit or assumed pool depth. Compare seasonal groundwater with the actual excavation and assess dewatering, drainage and empty-shell uplift. This is not evidence that a pool is impossible.',
      'USDA soil survey / UGS boring findings; engineering context: PEGroup', 'https://pegroup.com/2021/05/tech-bulletin-swimming-pool-failure-june-2013/');
    add('Pool grading and ground conditions', Number.isFinite(f.slope) && f.slope >= 8 ? 'watch' : 'verify',
      Number.isFinite(f.slope) ? 'Lot-average slope ' + f.slope.toFixed(1) + '%' + (Number.isFinite(f.relief) ? '; ' + Math.round(f.relief) + ' ft total relief' : '') : 'Pool-pad topography not established',
      'Lot-wide terrain cannot establish the slope at a proposed pool pad. Check cut/fill, retaining walls, soil bearing and excavation access at that location. The 8% flag is a screening heuristic, not a pool code limit.' +
      (f.soils && f.soils.length ? ' Mapped soils: ' + f.soils.join('; ') + '.' : ' Soil bearing and rock excavation are not established.'));
    add('Pool flood and geologic constraints', f.sfha || f.landslide_cov ? 'watch' : 'verify',
      f.sfha ? 'Mapped flood hazard intersects the parcel' : f.landslide_cov ? 'Mapped landslide terrain intersects the parcel' : 'Pool-pad hazard clearance has not been established',
      (f.sfha === false ? 'The mapped flood check found no Special Flood Hazard Area intersection. ' : f.sfha == null ? 'Flood coverage was unavailable or incomplete. ' : 'A pool layout requires floodplain and drainage review. ') +
      (f.landslide_cov ? Math.round(f.landslide_cov * 100) + '% of the parcel intersects mapped landslide terrain. ' : '') +
      (f.fault && Number.isFinite(f.fault.ft) ? 'Mapped fault distance: about ' + Math.round(f.fault.ft) + ' ft. ' : '') +
      'Use the geologic findings for siting and engineering; map results alone do not clear a pool pad.');
    add('Pool easements and private restrictions', 'verify', 'Pool, deck and equipment have not been cleared against easements or CC&Rs',
      'Plat labels are discovery evidence, not mapped exclusion areas. Recorded terms, amendments and releases may change what is allowed. Reconcile them with the survey and HOA design rules before assigning a pool location; a large lot is not proof of usable pool space.');
    add('Pool utilities, drainage and access', 'verify', 'Fill supply, discharge route and construction access remain unverified',
      (f.culinary ? 'Identified culinary supplier: ' + f.culinary + '. ' : 'No culinary supplier has been established. ') +
      (f.sewer ? 'Identified sewer provider: ' + f.sewer + '. ' : f.septic && f.septic.required === false ? 'Existing dossier evidence indicates sewer service. ' : 'Sewer service is not established; if septic is used, locate both the drainfield and reserve area. ') +
      'A service-area or will-serve record does not authorize pool filling or draining. Fill restrictions, backwash/discharge approval, buried and overhead utility clearances, equipment power, and excavation access still need evidence. Include decking and disturbed area in the existing stormwater review.');
    return out;
  }
  root.PoolScreen = { screen: screen };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PoolScreen;
})(typeof window !== 'undefined' ? window : globalThis);
