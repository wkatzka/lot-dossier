/* Ogden Valley's adopted-code screening. A result is evidence, never an approval. */
(function(root){'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./ovc-code-sources'):root.OVCCodeSources;
const T=typeof module!=='undefined'&&module.exports?require('@turf/turf'):root.turf;
const city='https://services7.arcgis.com/IkSdxg7Lmanz55Gq/arcgis/rest/services/',county='https://maps.webercountyutah.gov/arcgis/rest/services/',utah='https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/';
const ddw='https://services2.arcgis.com/NnxP4LZ3zX8wWmP9/arcgis/rest/services/';
const definitions=[
 ['ov-groundwater-protection','DDW groundwater protection zones',ddw+'Utah_DDW_Groundwater_Source_Protection_Zones/FeatureServer/4',['SYSNAME','ProtZone']],
 ['ov-surface-protection','DDW surface-water protection zones',ddw+'Utah_DDW_Surface_Water_Source_Protection_Zones/FeatureServer/3',['SYSNAME','SystemName']],
 ['ov-tnc-assessment','DDW transient-system assessment zones',ddw+'Utah_DDW_Source_Water_Assessment_Zones_for_TNC_Systems/FeatureServer/2',['SYSNAME','ProtZone']],
 ['ov-zoning','City current zoning',city+'Zoning_Area_VIEW/FeatureServer/0',['ZONE_NAME']],
 ['ov-streams','Watercourses in city GIS',county+'planning_layers/MapServer/25',['FENAME','Status'],60],
 ['ov-roads','City / private roads',city+'Roads_VIEW/FeatureServer/14',['FULLNAME','FinalOwnership'],60],
 ['ov-highways','State highway and road ownership',utah+'UtahRoads/FeatureServer/0',['FULLNAME','DOT_HWYNAM'],60],
 ['ov-lakes','Lakes and reservoir shoreline',utah+'UtahLakesNHD/FeatureServer/0',['GNIS_Name','GNIS_NAME'],60],
 ['ov-slope','City slope classes',city+'PercentRise_Slope_Poly/FeatureServer/0',['gridcode']],
 ['ov-agreements','Recorded development agreements',county+'planning_layers/MapServer/20',['name','number']],
 ['ov-wildlife','Important wildlife habitat',county+'planning_layers/MapServer/12',['OBHABITAT']],
 ['ov-scenic','Scenic roads',county+'planning_layers/MapServer/2',['STREET'],60],
 ['ov-skyline','Protected skylines',county+'planning_layers/MapServer/1',[],60],
 ['ov-sewer','City sewer service areas',city+'Sewer_ServiceArea/FeatureServer/7',['DISTRICT','Label']],
 ['ov-water','City culinary water areas',city+'CulinaryWater_ServiceAreas/FeatureServer/2',['WRNAME','DWNAME','LABEL']],
 ['ov-landslide','Mapped landslides',county+'engineering/engineering_layers/MapServer/13',[]],
 ['ov-liquefaction','Liquefaction potential',county+'engineering/engineering_layers/MapServer/12',[]],
 ['ov-faults','Quaternary faults',county+'engineering/engineering_layers/MapServer/8',[],30],
 ['ov-wetlands','Utah wetland inventory', 'https://webmaps.geology.utah.gov/arcgis/rest/services/Groundwater/Wetlands/MapServer/4',[],30]
].map(([id,name,url,fields,buffer])=>({id,name,url,fields,buffer,weber:true,...(id.includes('protection')||id==='ov-tnc-assessment'?{outFields:'OBJECTID,SourceID,ProtZone,SYSNAME,SYSNUMBER,FACNAME,FACACTIVITY'}:{})}));
// Main single-family building baselines. Recorded lots, road widening, overlays and exceptions remain separate checks.
const zones={
 'AV-3':{code:'104-2',section:'§104-2-3(f), §104-2-5',use:'P',area:130680,width:150,front:30,side:10,sideSum:24,rear:30,height:35,corner:20},
 'RE-15':{code:'104-3',section:'Permitted uses and site-development table (published section numbering is inconsistent)',use:'P',area:15000,width:100,front:30,side:10,sideSum:24,rear:30,height:35,corner:20},
 'RE-20':{code:'104-3',section:'Permitted uses and site-development table (published section numbering is inconsistent)',use:'P',area:20000,width:100,front:30,side:10,sideSum:24,rear:30,height:35,corner:20},
 'FV-3':{code:'104-14',section:'§104-14-2, §104-14-5',use:'P',area:130680,width:150,front:30,side:20,rear:30,height:35,corner:30,note:'Front setback is 50 ft on streets/highways at least 80 ft wide. Curved-street/cul-de-sac width exception requires measurement 70 ft behind the front line.'},
 'F-5':{code:'104-9',section:'§104-9-3(f), §104-9-5',use:'P',area:217800,width:300,front:30,side:20,rear:30,note:'Height is unresolved: published PDF p. 13 displays “3525 feet.” Obtain city clarification. Curved-street lot-width exceptions and wildfire requirements also apply.'},
 'F-40':{code:'104-9',section:'§104-9-3(f), §104-9-5',use:'P',area:1742400,width:660,front:75,side:40,rear:30,note:'Height is unresolved: published PDF p. 13 displays “3525 feet.” Obtain city clarification; the width footnote also references F-10. Wildfire requirements apply.'},
 'S-1':{code:'104-10',section:'§104-10-3(f), §104-10-5; later Ordinance 2026-53',use:'P',area:217800,width:300,front:30,side:20,rear:30,impervious:25,note:'Source conflict: this chapter PDF states height 25 ft, but approved September 1 council minutes record adoption of Ordinance 2026-53 increasing height to 35 ft. The older 25-ft value is not used for automatic checks; obtain the complete amendment for current conditions.'},
 'HR':{code:'104-8',section:'§104-8-3.060 and site-development table pp. 9–11',use:'P',width:60,front:25,side:8,sideSum:18,rear:30,height:35,corner:20,coverage:40,note:'Single-family minimum: 6,000 sq ft on community sewer; 20,000 sq ft on septic. Side setback 20 ft next to medium/low-density residential; green space at least 40%; floor/area ratio 1:1. Additional rental-room area applies.'},
 'CVR-1':{code:'104-11',summary:'§104-11-6: overall project at least 2.5 acres, width 150 ft; front 30 ft, side/rear 20 ft or 30 ft adjoining residential; height 35 ft. Lodging/unit density adds net-developable-area requirements. §104-11-5 requires at least 20% total building floor area and 50% ground-floor area commercial/service. Standalone dwelling is not the listed resort/commercial dwelling use.'},
 'CV-2':{code:'104-20',summary:'§104-20-5: no base lot-area/width minimum; front setback one story none, two stories 20 ft, three stories 30 ft; arterial/collector baseline 50 ft from street centerline. Side/rear 10 ft with specified abutment/maintenance-contract exceptions. Height 35 ft; building coverage 60%. Exact use, cross-access easement and street-facing design must be reviewed.'},
 'MV-1':{code:'104-21',summary:'§104-21-5: no base lot-area/width minimum, but health minimum applies without sewer. Front 30 ft, or 50 ft on existing/planned 80-ft right-of-way with additional height-related setback; side 20 ft adjoining residential or on corner lot; rear 30 ft adjoining residential, otherwise no base side/rear setback. Height 40 ft, reduced to 35 ft on 80-ft right-of-way; coverage 60%. Exact industrial use must be checked in §104-21-3.'},
 'O-1':{code:'104-26',summary:'§104-26-2–4: open-space/agricultural/recreational uses; no standalone dwelling listed. Utility substations and golf driving range require conditional use. Minimum 5 acres, width 300 ft; front/rear 30 ft, side 20 ft; height 35 ft. Conservation-easement terms also govern.'},
 'G':{code:'104-4',summary:'§104-4-1–5: gravel excavation/storage uses; no standalone dwelling listed. Base lot 40,000 sq ft, width 150 ft; front/rear 30 ft, side 20 ft; height 35 ft. Gravel operation setback 100 ft from public street and 50 ft from boundaries. Excavation authorization, approved reclamation plan, financial assurance and environmental controls apply; on-site crushing is not permitted.'},
 'RMH-1-6':{code:'104-19',summary:'§104-19-2–5: double-wide or wider home in an approved manufactured-home subdivision. Subdivision conditional-use approval; land-use and building permits before placement. Subdivision minimum 4 acres; lot 6,000 sq ft/60 ft wide, corner 7,000/70 ft; front/rear 15 ft, street side 15 ft; home side 10 ft, awning post 5 ft; height one story or 14 ft; coverage 60%. Perimeter CUP conditions may require larger setbacks.'}
};
const fields={arterialCollector:'Abuts an arterial / collector street?',sideAbutment:'Side building wall abuts the adjoining building?',rearAbutment:'Rear building wall abuts the adjoining building?',sideMaintenanceContract:'Recorded perpetual side maintenance contract?',rearMaintenanceContract:'Recorded perpetual rear maintenance contract?',cornerLot:'Corner lot?',residentialAdjacency:'Adjacent to medium / low-density residential?',federalShorelineAdjacency:'Adjoins US Forest Service shoreline land?',water:'Water supply',wastewater:'Wastewater system',highwayChange:'New / changed state-highway access or land use along a highway?',streamWork:'Alter natural stream bed / banks?',wetlandFill:'Fill or dredge in wetlands / waters?',grading:'Grading or excavation?',rowWork:'Work in public right-of-way?',slope25:'Surveyed average natural slope at least 25%?',subdivision:'Create lots or amend a plat?',adu:'Accessory dwelling unit?',demolition:'Demolition?',specialUse:'Other use-specific permits (rental, business, signs, agriculture, resort)?'};
// Explicit inputs are required; an omitted measurement is never treated as zero.
function dimensionChecks(name,s){
 const x=zones[name];if(!x||!['new-home','commercial','other'].includes(s.work))return [];
 const has=k=>s[k]!==''&&s[k]!=null&&Number.isFinite(Number(s[k]));
 const failures=[],min=(k,n)=>{if(n!=null&&has(k)&&Number(s[k])<n)failures.push(k+' '+s[k]+' is below '+n);},max=(k,n)=>{if(n!=null&&has(k)&&Number(s[k])>n)failures.push(k+' exceeds '+n);};
 if(!x.use){
  if(name==='MV-1'){
   const wide=has('roadWidth')&&Number(s.roadWidth)>=80;
   min('frontSetback',wide?50+Math.max(0,Number(s.buildingHeight||0)-30):30);
   if(s.residentialAdjacency==='yes'||s.cornerLot==='yes')min('sideSetback',20);
   if(s.residentialAdjacency==='yes')min('rearSetback',30);
   max('buildingHeight',wide?35:40);max('buildingCoverage',60);
  }else if(name==='CV-2'){
   if(has('stories'))min('frontSetback',Number(s.stories)===2?20:Number(s.stories)>=3?30:0);
   if(s.arterialCollector==='yes')min('streetCenterlineSetback',50);
   if(s.sideAbutment!=='yes'&&s.sideMaintenanceContract!=='yes')min('sideSetback',10);
   if(s.rearAbutment!=='yes'&&s.rearMaintenanceContract!=='yes')min('rearSetback',10);
   max('buildingHeight',35);max('buildingCoverage',60);
  }else if(name==='CVR-1'){
   min('lotArea',108900);min('lotWidth',150);min('frontSetback',30);
   min('sideSetback',s.residentialAdjacency==='yes'?30:20);min('rearSetback',s.residentialAdjacency==='yes'?30:20);max('buildingHeight',35);
   min('commercialFloorShare',20);min('commercialGroundShare',50);
  }else if(name==='O-1'||name==='G'){
   min('lotArea',name==='O-1'?217800:40000);min('lotWidth',name==='O-1'?300:150);
   min('frontSetback',30);min('sideSetback',20);min('rearSetback',30);max('buildingHeight',35);
  }else if(name==='RMH-1-6'){
   min('lotArea',s.cornerLot==='yes'?7000:6000);min('lotWidth',s.cornerLot==='yes'?70:60);
   min('frontSetback',15);min('rearSetback',15);min('sideSetback',10);
   if(s.cornerLot==='yes')min('streetSideSetback',15);max('buildingHeight',14);max('stories',1);max('buildingCoverage',60);
  }
  return failures;
 }
 if(s.work!=='new-home')return failures;
 let area=x.area,side=x.side,front=x.front;
 if(name==='HR'){
  area=s.wastewater==='sewer'?6000:s.wastewater==='septic'?20000:null;
  if(area!=null&&has('rentalRooms'))area+=Number(s.rentalRooms)*500;
  if(s.residentialAdjacency==='yes')side=20;
  min('greenSpace',40);max('floorAreaRatio',1);
  if(has('netDevelopableArea')&&has('rentalRooms')&&s.wastewater)max('rentalRooms',Number(s.netDevelopableArea)/43560*(s.wastewater==='sewer'?40:8));
 }
 if(name==='FV-3'&&has('roadWidth')&&Number(s.roadWidth)>=80)front=50;
 for(const [k,n] of [['lotArea',area],['lotWidth',x.width],['frontSetback',front],['sideSetback',side],['combinedSideSetbacks',x.sideSum],['rearSetback',x.rear]])min(k,n);
 if(s.cornerLot==='yes')min('streetSideSetback',x.corner);
 max('buildingHeight',x.height);max('buildingCoverage',x.coverage);max('imperviousCover',x.impervious);
 if(name==='S-1'&&s.federalShorelineAdjacency==='yes')min('federalShorelineSetback',50);
 return failures;
}
function parseGeometry(raw){try{return JSON.parse(raw);}catch{return null;}}
function feature(g){if(!g)return null;try{if(g.rings){
 if(!g.rings.length)return null;
 const rings=g.rings.map(r=>({ring:r,shape:T.polygon([r])}));for(const r of rings){r.area=T.area(r.shape);r.bounds=T.bbox(r.shape);}
 for(const r of rings)r.parent=rings.filter(p=>p!==r&&p.area>r.area&&r.bounds[0]>=p.bounds[0]&&r.bounds[1]>=p.bounds[1]&&r.bounds[2]<=p.bounds[2]&&r.bounds[3]<=p.bounds[3]&&T.booleanPointInPolygon(r.ring[0],p.shape,{ignoreBoundary:true})).sort((a,b)=>a.area-b.area)[0];
 const depth=r=>r.parent?1+depth(r.parent):0,polygons=rings.filter(r=>depth(r)%2===0).map(r=>[r.ring,...rings.filter(h=>h.parent===r&&depth(h)%2===1).map(h=>h.ring)]);
 return polygons.length===1?T.polygon(polygons[0]):T.multiPolygon(polygons);
 }if(g.paths)return T.multiLineString(g.paths);if(Number.isFinite(g.x)&&Number.isFinite(g.y))return T.point([g.x,g.y]);return g.type==='Feature'?g:null;}catch{return null;}}
function near(g,h){const a=feature(g),b=feature(h);if(!a||!b)return null;try{if(T.booleanIntersects(a,b))return 0;let d=Infinity;
 const lines=x=>{const out=[];T.flattenEach(x,f=>{if(f.geometry.type==='Polygon')T.flattenEach(T.polygonToLine(f),l=>out.push(l));else if(f.geometry.type==='LineString')out.push(f);});return out;};
 const la=lines(a),lb=lines(b);T.coordEach(a,c=>lb.forEach(l=>{d=Math.min(d,T.pointToLineDistance(c,l,{units:'feet'}));}));T.coordEach(b,c=>la.forEach(l=>{d=Math.min(d,T.pointToLineDistance(c,l,{units:'feet'}));}));return Number.isFinite(d)?d:null;}catch{return null;}}

function localizeSnapshot(snapshot,parcelGeometry){
 if(!snapshot?.layers||!feature(parcelGeometry))return snapshot;
 let bounds=T.bbox(feature(parcelGeometry));
 for(const raw of String(snapshot.geometryScope||'').split('|').filter(Boolean)){const f=feature(parseGeometry(raw));if(f){const b=T.bbox(f);bounds=[Math.min(bounds[0],b[0]),Math.min(bounds[1],b[1]),Math.max(bounds[2],b[2]),Math.max(bounds[3],b[3])];}}
 const margin=.003,bbox=[bounds[0]-margin,bounds[1]-margin,bounds[2]+margin,bounds[3]+margin];
 return {...snapshot,displayExtent:bbox,geometryNote:'Regional geometry is clipped to the parcel/work vicinity for display; source intersection results, identifiers and attributes are retained. Open GIS source for the full regional boundary.',layers:snapshot.layers.map(l=>({...l,features:l.features.map(f=>{
  const shape=feature(f.geometry);if(!shape||shape.geometry.type==='Point')return f;
  try{const clipped=T.bboxClip(shape,bbox).geometry;let geometry;
   if(clipped.type==='Polygon')geometry={rings:clipped.coordinates};else if(clipped.type==='MultiPolygon')geometry={rings:clipped.coordinates.flat()};else if(clipped.type==='LineString')geometry={paths:[clipped.coordinates]};else if(clipped.type==='MultiLineString')geometry={paths:clipped.coordinates};else return f;
   return {...f,geometry,displayClipped:true};
  }catch{return f;}
 })}))};
}
function rows(p,add){const layers=p.application.areaMap?.layers||[],s=p.application.ruleScope||{},get=id=>layers.find(l=>l.id===id),hits=id=>get(id)?.features||[],status=id=>get(id)?.state==='checked',url=k=>S[k]?.url||'https://ogdenvalley.gov/land-use/';
 const rule=(id,title,code,stage,text,app='verify',layer='ov-zoning',authority='Ogden Valley planning / engineering')=>add('ov-'+id,title,authority,stage,text,url(code),app,layer);
 const z=[...new Set(hits('ov-zoning').map(f=>String(f.attributes?.ZONE_NAME||f.name).trim().toUpperCase()))];
 rule('zone-match','Resolve current zoning','104-1','submission',z.length?'City GIS: '+z.join(', ')+'. Compare the adopted map and any parcel-specific rezoning/recorded conditions. Multiple zones require locating the proposed work within the correct zone.':'City zoning was unavailable or returned no zone. Do not substitute a mailing address or older county zone.');
 for(const name of z){
  if(['MPD','MPDOZ'].includes(name)){rule('zone-'+name,'Master-planned development conditions · '+name,'104-1','submission','City GIS identifies a master-planned-development overlay. Chapter 104-1 lists MPDOZ separately from base zones. Resolve the approved development plan, recorded agreement, amendments, plat/envelope and any delegated architectural-review conditions before relying on base-zone dimensions. A mapped overlay does not identify the private reviewer or prove approval is required before permit submission. The city code library currently does not supply a controlling Chapter 104-27 original; preserve that source gap.','required');continue;}
  const x=zones[name];rule('zone-'+name,'Zoning standards · '+name,x?.code||'104-1','submission',x?.use?'Single-family dwelling is a permitted use in the base-zone table ('+x.section+'); this does not approve the lot or project. '+[['area','Minimum lot area','sq ft'],['width','Minimum width','ft'],['front','Front setback','ft'],['side','Side setback','ft'],['sideSum','Combined side yards','ft'],['rear','Rear setback','ft'],['height','Maximum main-building height','ft'],['corner','Street-facing side','ft'],['coverage','Maximum building coverage','%'],['impervious','Maximum impervious cover','%']].filter(([k])=>x[k]!=null).map(([k,t,u])=>t+': '+x[k]+' '+u).join('; ')+'. '+(x.note||'')+' Standards are for a main single-family building; other uses and accessory structures need their own table review.':(x?.summary||'No encoded standard for this mapped zone. Obtain the controlling adopted ordinance.')+' Compare the exact proposed use and plan against the original source; a documented planning review is required.');
  const failures=dimensionChecks(name,s);if(failures.length)rule('dimensions-'+name,'Plan dimensions need resolution · '+name,x.code,'submission',failures.join('; ')+'. A variance, recorded-lot exception or revised design must be documented; the baseline comparison is not an automatic prohibition.','required');
 }
 rule('agreement','Development agreement and recorded plat conditions','102','submission',hits('ov-agreements').length?'Mapped agreement: '+hits('ov-agreements').map(f=>f.name).join(', ')+'. Review the original instrument, amendments, phasing and delegated architectural approval.':'No mapped agreement returned. Confirm the recorded plat, building envelope, development agreement and amendments through title/recorder evidence.','verify','ov-agreements');
 const protectionIds=['ov-groundwater-protection','ov-surface-protection','ov-tnc-assessment'],protection=protectionIds.flatMap(id=>hits(id).map(f=>({id,...f}))),protectionComplete=protectionIds.every(status);
 rule('source-protection','Drinking-water source protection','108-18','issuance','§108-18-8 requires compliance before issuance. '+(protectionComplete?'All three DDW protection/assessment layers checked. ':'One or more DDW protection/assessment layers remain unavailable. ')+(protection.length?'Mapped matches: '+protection.map(f=>String(f.name)+' · '+(f.id==='ov-tnc-assessment'?'assessment area':f.id==='ov-surface-protection'?'surface-water area':'groundwater')+' · zone '+(f.attributes?.ProtZone??'unspecified')).join('; ')+'. ':'No mapped match returned; verify plan currency and unmapped/transition areas. ')+'Groundwater, surface-water and transient-system assessment areas are distinct; none is a service-entitlement map.','verify',protection[0]?.id||'ov-groundwater-protection','Water provider / city / Weber-Morgan Health');
 const innerZones=hits('ov-groundwater-protection').filter(f=>/^(?:zone\s*)?[12]$/i.test(String(f.attributes?.ProtZone||'').trim()));
 if(innerZones.length)rule('source-protection-use','Inner protection-zone use restrictions','108-18','issuance','§§108-18-5–7: zone 1 restricts new uses; zone 2 requires new residential/commercial/institutional uses to connect to sanitary sewer. Septic and other potential contamination sources are restricted in both, subject to the stated existing-use/design-standard provisions. Resolve the mapped zone and exact proposal before approval.','required','ov-groundwater-protection','City / water provider / Weber-Morgan Health');
 if(z.includes('S-1'))add('ov-shoreline-amendment','Reconcile the later shoreline amendment','Ogden Valley planning','submission','Approved September 1, 2026 council minutes, pp. 3–4, record Ordinance 2026-53 increasing S-1 height from 25 to 35 ft. The linked chapter PDF is older. Obtain the full adopted amendment and effective date; do not rely on its superseded height.','https://www.utah.gov/pmn/files/1489525.pdf','required','ov-zoning');
 add('ov-sensitive-adoption','Reconcile sensitive-lands adopted text','Ogden Valley planning','submission','The May 19, 2026 council minutes, p. 12, adopt the original Weber County hillside language and remove proposed water changes and ridgeline provisions. The currently published Chapter 104-28 PDF still contains water setbacks and ridgeline language. The available records do not establish whether a later enacted amendment reconciles them. Treat related screening below as source candidates until the executed adopted text and later amendments are reconciled.','https://www.utah.gov/pmn/files/1452527.pdf#page=12','verify','ov-zoning');
 const streams=hits('ov-streams');rule('water-setbacks','Stream and reservoir setbacks','104-28','submission','Published PDF §104-28-2 (adoption reconciliation open): North, Middle and South Fork Ogden River 100 ft; year-round streams 75 ft; natural ephemeral streams 50 ft; Pineview Reservoir 100 ft. Measure from city-engineer-determined high-water mark, not a GIS centerline. Review recorded pre-2006 envelopes and listed exceptions. '+(status('ov-streams')?streams.length+' mapped watercourse candidate(s) within the 60 m search envelope.':'Watercourse service unavailable.')+' Reservoir/lake candidates: '+hits('ov-lakes').map(f=>f.name).join(', ')+'. '+streams.map(f=>{const a=f.attributes||{},d=near(p.report.parcel.geometry||{rings:p.report.parcel.rings},f.geometry),w=s.workGeometry?near(parseGeometry(s.workGeometry),f.geometry):null;return f.name+' ('+(a.Status||'classification unknown')+'), parcel distance '+(d==null?'unknown':Math.round(d)+' ft')+(w==null?'':', proposed-work distance '+Math.round(w)+' ft');}).join('; '),'verify','ov-streams');
 const steep=hits('ov-slope').some(f=>Number(f.attributes?.gridcode)>=2);
 rule('hillside','Hillside engineering and stormwater package','104-28','submission','Published PDF (adoption reconciliation open): average natural slope ≥25% triggers hillside review, engineered cuts/fills, 2-ft contours, geotechnical work, landscape plans and UPDES/SWPPP with application. '+(steep?'City slope classes intersect the parcel at 16–25% or above; a class intersection is not a parcel-average slope.':'Confirm average slope across the parcel, roads and accesses; GIS classes alone do not establish the surveyed average.'),s.slope25==='yes'?'required':s.slope25==='no'?'not-triggered':'verify','ov-slope');
 rule('habitat','Wildlife habitat mitigation','104-28','review','Important habitat intersections: '+hits('ov-wildlife').length+'. §104-28-3 requires applicable mitigation and written DWR recommendations for development in important habitat. An empty inventory cannot rule out unmapped habitat.','verify','ov-wildlife','City planning / Utah Division of Wildlife Resources');
 rule('hazards','Natural-hazard report and mitigation','108-22','submission','§108-22-2–5: site-specific studies for development in or adjacent to identified hazards; city-engineer review before affected earthwork. Active-fault baseline setback is 50 ft. Mapped landslide, liquefaction and fault evidence must be interpreted by a qualified professional. Exemptions require a documented basis.','verify','ov-landslide');
 rule('scenic','Scenic corridor / skyline review','104-28','review','Adoption reconciliation is open: May 19 minutes remove ridgeline provisions. Do not assert skyline restrictions from the published PDF alone. Check the executed scenic-road provisions, together with the city’s mapped scenic roads and skylines. Mapped proximity is a screening trigger; viewshed and proposed building design require review.','verify','ov-scenic');
 rule('wetlands','Wetland delineation and federal water review','104-28','construction','City may require delineation and Corps concurrence. Inventory intersections: '+hits('ov-wetlands').length+'. Inventory is not a jurisdictional determination. Resolve fill/dredge authorization and state water-quality conditions before affected work.',s.wetlandFill==='yes'?'required':'verify','ov-wetlands','City engineer / US Army Corps / Utah DEQ');
 rule('access','Legal access, road standards and future right-of-way','108-7','submission','§108-7-10 uses future collector/arterial right-of-way for setbacks where widening is designated. §§108-7-19, 29, 32 address substandard roads, landlocked lots and alternate access. Mapped nearby roads do not establish recorded access rights.','verify','ov-roads');
 rule('wildfire','Wildfire access and construction conditions','104-9','review','Check mapped wildland–urban interface, fire access, water supply and vegetation requirements with the fire authority. Forest-zone development also has emergency-access and fire-suppression provisions in §104-9-5.','verify','wui','Weber Fire District / city building official');
 if(s.water==='well')add('ov-well','Private well and drinking-water approval','Utah Water Rights / Weber-Morgan Health','submission','A well location alone is not a water right or approved supply. Obtain the applicable drilling/water-right authorization and health approval required by the permit checklist.','https://webermorganhealth.gov/services/environmental-health/water-quality/','required','ov-water');
 if(s.wastewater==='septic')add('ov-septic','Onsite wastewater permit','Weber-Morgan Health','submission','Obtain the lot-specific onsite wastewater approval, including site/soil evaluation and approved system design; a lack of mapped sewer service is not septic approval.','https://webermorganhealth.gov/services/environmental-health/water-quality/','required','ov-sewer');
 rule('subdivision','Subdivision / plat approval','106','issuance','Resolve subdivision, plat amendment, required improvements, agency approvals and recorded building-parcel status before relying on the proposed lot.',s.subdivision==='yes'?'required':s.subdivision==='no'?'not-triggered':'verify','neighborhood');
 rule('conditional','Conditional use and site-plan authorization','108-4','issuance','Compare the exact proposed use with its zone table. A C use needs conditional-use authorization and conditions; an unlisted or prohibited use needs planning resolution. Mixed uses cannot be cleared by selecting a general commercial category.');
 rule('lighting','Outdoor lighting plan','108-16','submission','Include the required outdoor-lighting plan and fixture information with applicable building plans; verify shielding, illumination and zone-specific provisions.',s.work==='new-home'||s.work==='commercial'?'required':'verify');
 rule('landscape','Architecture, landscaping and parking','108-2','review','Coordinate applicable architectural/landscape design, parking/access under Chapter 108-8 and water-wise landscaping under §108-7-12. Review project-specific exceptions and design-review conditions.');
 rule('adu','Accessory dwelling unit approval','108-19','issuance','Apply the internal/accessory dwelling standards, owner/use conditions, site capacity and applicable approvals.',s.adu==='yes'?'required':s.adu==='no'?'not-triggered':'verify');
 if(s.adu==='yes'){
  rule('adu-submission','ADU application and service feasibility','108-19','submission','§108-19-6(B): signed application, fee, scaled site/floor/elevation plans, owner-residency verification and water/sewer will-serve statements; well or septic proposals require local health feasibility evidence. Detached units also need state-law eligibility evidence.','required');
  rule('adu-landuse-sequence','ADU land-use approval before building application','108-19','submission','§108-19-6(D)(5): obtain the approved land-use permit before applying for a building permit unless the city combines the applications. Document the combined process or approved permit; approval timing is not inferred from a parcel map.','required');
  rule('adu-recorded-notice','Record the ADU notice','108-19','issuance','§108-19-6(C): execute and record the city-approved notice before issuance of an ADU land-use permit, building permit or business license. The notice includes occupancy, use and separate-conveyance restrictions.','required','neighborhood','City planning / Weber County Recorder');
  for(const [id,authority] of [['fire','Fire authority'],['address','Addressing official'],['water','Culinary water authority'],['wastewater','Sanitary sewer / local health authority'],['building','Building official']])rule('adu-'+id,'ADU approval · '+authority,'108-19','review','§108-19-4(13), §108-19-6(D): the city routes the application for relevant department and agency approval. Retain the approval and any conditions for this ADU; a service-area map does not establish approval.','required','municipal',authority);
 }
 rule('special','Use-specific and existing-building conditions','108-7','issuance','Resolve applicable short-term rental (108-11), home occupation (108-13), public building (108-10), campground (108-20), agritourism (108-21), sign (110), noncomplying building/lot (108-12), accessory-building, pool and agricultural-exemption provisions. These are not all determined by an address.',s.specialUse==='no'?'not-triggered':'verify');
 const h=hits('ov-highways').filter(f=>f.attributes?.DOT_OWN_L==='UDOT'||f.attributes?.DOT_OWN_R==='UDOT'||['1','2','3','4','5','6'].includes(String(f.attributes?.CARTOCODE)));
 add('highway','State-highway access and encroachment','UDOT','construction',(status('ov-highways')?h.length+' state-highway candidate(s) within the 60 m parcel search envelope: '+h.map(f=>{const d=s.accessGeometry?near(parseGeometry(s.accessGeometry),f.geometry):null;return f.name+(d==null?'':' · access sketch '+Math.round(d)+' ft from mapped road');}).join(', '):'Road ownership service unavailable.')+'. New/changed access or land use along a highway requires CAP review; encroachment approval is separate before work in the right-of-way. Off-parcel access can matter even without a nearby match.','https://connect.udot.utah.gov/business/permits/access-management/',s.highwayChange==='yes'?'required':s.highwayChange==='no'?'not-triggered':'verify','ov-highways');
 add('stream','Stream alteration authorization','Utah Water Rights / US Army Corps','construction','Written authorization is required before altering natural stream bed/banks. Proposed work is screened against mapped watercourses; field high-water marks, drainage paths and federal jurisdiction need evidence.','https://www.waterrights.utah.gov/strmalt/',s.streamWork==='yes'?'required':s.streamWork==='no'?'not-triggered':'verify','ov-streams');
 add('ov-excavation','City excavation / right-of-way permit','Ogden Valley engineering','construction','City planning provides a separate excavation application. Resolve right-of-way work, utility crossings, road restoration and drainage conditions before excavation.','https://ogdenvalley.gov/planning/',s.rowWork==='yes'?'required':s.rowWork==='no'?'not-triggered':'verify','ov-roads');
}
const api={localizeSnapshot,definitions,zones,fields,rows,dimensionChecks,sources:S,near,feature};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OVCRules=api;
})(globalThis);
