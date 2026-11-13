/* Site findings answer first: the few findings that matter, each with what to do and its source;
   duplicates from several sources merged; routine verification folded; fallbacks to sources and
   then to contacts actually on file. No invented findings, advice or contact details. */
const assert=require('node:assert/strict');
const A=require('../web/site-answer');
const strip=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const f=(item,status,section,headline,next_step,source,url)=>({item,status,section,headline,next_step,source,url});
const findings=[
 f('Parcel','ok','land','Parcel 222320023',null,'UGRC parcels','https://example.org/p'),
 f('Zoning','verify','land','RE-15 Residential Estates','Reconcile the base zone with overlays.','City code','https://example.org/z'),
 f('Culinary water','watch','water','Inside Wolf Creek Country Club service area','Request a will-serve letter and fee/share cost.','Water Rights','https://example.org/w'),
 f('Landslides','flag','geo','Mapped landslide covers about 100% of the lot','Order a geologic hazards study and geotech report before closing.','UGS landslide compilation','https://example.org/l'),
 f('Flood zone','watch','geo','FEMA Zone X',null,'FEMA','https://example.org/f'),
 f('Seismic design','watch','geo','IRC seismic design category D1',null,'USGS','https://example.org/s'),
 f('Sewer vs. septic','watch','septic','Lot connection unverified','Confirm the applicable wastewater system.','County packet','https://example.org/sep'),
 f('GIS terrain · USGS 3DEP GIS DEM mosaic','flag','survey','20.0% fitted slope · 10.6 ft relief',null,'USGS 3DEP','https://example.org/3dep'),
 f('GIS terrain · USGS Elevation Point Query Service','flag','survey','20.0% fitted slope · 10.3 ft relief',null,'USGS EPQS','https://example.org/epqs'),
 f('Pool grading and ground conditions','watch','pool','Lot-average slope 20.0%',null,'Pool screening',null),
 f('Power','verify','utilities','Rocky Mountain Power territory; lot service unverified','Obtain lot-specific service confirmation.','UGRC','https://example.org/pw'),
 f('Public original 8b4d','verify','easements','Recorded plat 61-060',null,'Original document','https://example.org/o')];
const report={findings,facts:{contacts:[{name:'Building department',portal:'https://portal.example/',people:[{role:'Building official',email:'official@example.org'},{role:'Permit technician',email:'tech@example.org',phone:'801-555-0101'}]}]}};
const s=A.summary(report,null);
assert.deepEqual(s.top.map(x=>x.item),['Landslides','GIS terrain','Sewer vs. septic','Culinary water'],'Concerns first, then actionable watch items by building impact');
const slope=s.top[1];assert.equal(slope.sources.length,2,'The same slope from two elevation services is one finding with both sources');
assert.deepEqual(s.counts,{flag:2,watch:5,verify:2},'Counts use merged findings; OK and index rows are not counted');
assert(!s.top.some(x=>x.section==='pool'),'Derived pool screening items do not displace building findings');
const c1=strip(A.card(report,{where:'site'}));
assert(/^Site findings that matter/.test(c1)&&/Landslides Concern Mapped landslide covers about 100% of the lot What to do: Order a geologic hazards study/.test(c1));
assert(/Source: USGS 3DEP · USGS EPQS \(agree\)/.test(c1),'Agreeing sources are cited together');
assert(/3 more to watch · 2 routine items to verify — listed in the sections below/.test(c1),'The rest is pointed to, not shown');
assert(/What to do: Have a surveyor confirm the grades with a topo survey/.test(c1)&&!/Read the cited source/.test(c1),'Without a report next step, the card names who can settle it (no invented facts)');
assert(/Open Site Review/.test(strip(A.card(report,{where:'overview'}))),'Overview card links to Site Review');
// Tier 2: nothing flagged → the sources to verify are the finding.
const c2=strip(A.card({findings:findings.filter(x=>x.status==='verify'||x.status==='ok'),facts:report.facts}));
assert(/^Nothing flagged — sources to verify/.test(c2)&&/Zoning — City code/.test(c2)&&!/What to do/.test(c2));
// Tier 3: no findings → contacts exactly as recorded in the report; nothing invented.
const c3=strip(A.card({findings:[],facts:report.facts}));
assert(/^Who to ask about this site/.test(c3)&&/official@example\.org/.test(c3)&&/801-555-0101/.test(c3));
assert.deepEqual(c3.match(/\d{3}-\d{3}-\d{4}/g),['801-555-0101'],'Only phone numbers on file are shown');
assert(/No site findings were produced and no contacts are on file/.test(strip(A.card({findings:[],facts:{}}))));
console.log('PASS: site findings answer first — concerns and actionable items ranked by building impact, duplicate sources merged, routine checks folded, then sources, then recorded contacts; nothing invented.');
