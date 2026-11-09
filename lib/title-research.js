/* Reuse source-indexed public archive readings across parcels. Never infer title from OCR silence. */
const cache=require('../data/title/weber-abstract-readings.json');
const reviews=require('../data/title/weber-reviewed-abstracts.json');
const G=require('./historic-geometry');
const FT=require('./federal-title');
const reports=require('../data/title/blm-reviewed-reports.json');
const key=l=>[l.township,l.northSouth,l.range,l.eastWest,l.section].join(':').toLowerCase();
function assess({inventory,control,rings,history,grants},dataset=cache,reviewed=reviews){
 const sheetsByUrl=new Map(dataset.sheets.map(s=>[s.url,s])),hits=inventory?.plss?.locations||[];
 const federalRoot=FT.assess(grants,hits,reports);
 const requested=(inventory?.sections||[]).flatMap(s=>(s.documents||[]).map(d=>({...d,location:s.location})));
 const sheets=requested.map(d=>{
  const s=sheetsByUrl.get(d.url);
  if(!s||s.status==='not_read')return {url:d.url,name:d.name,location:d.location,status:'not_read',rows:[]};
  return {url:s.url,name:s.name,location:s.location,sha256:s.sha256,readAt:s.readAt,status:s.status,engine:s.engine,rowCount:s.rows.length,
   rows:s.rows.map(r=>({entry:r.entry,bbox:r.bbox,description:r.description,text:r.text,flags:r.flags,ocrVerified:false})),
   segmentation:s.rows.length?'partial_entry_candidates':'no_reliable_entry_segmentation'};
 });
 const applicableSections=new Set(hits.map(key)),sourceHashes=new Map(sheets.map(s=>[s.url,s.sha256]));
 const records=reviewed.entries.filter(r=>applicableSections.has(key(r.location))&&sourceHashes.get(r.source.url)===r.source.sha256).map(r=>{
  let spatial={status:'unresolved',reason:'No reviewed, plottable legal description',legalApplicability:'unresolved'};
  if(r.geometryDefinition)try{spatial=G.evaluate(r.geometryDefinition,control,rings);}catch(e){spatial={status:'unresolved',reason:e.message,legalApplicability:'unresolved'};}
  const aliquotMatch=!r.aliquots?null:hits.some(h=>key(h)===key(r.location)&&r.aliquots.includes(h.aliquot));
  if(aliquotMatch===false&&r.relativeLocation&&!r.geometryDefinition)spatial={status:'different_described_aliquot',reason:r.relativeLocation,legalApplicability:'unresolved'};
  return {...r,geometryDefinition:undefined,spatial,aliquotMatch,matchBasis:'Mapped section intersection plus cited abstract description; no surname-only match',state:'missing_original_instrument'};
 });
 const read=sheets.filter(s=>s.status==='machine_read_unverified').length;
 const unsegmented=sheets.filter(s=>s.status==='machine_read_unverified'&&!s.rows.length).length;
 const rowCount=sheets.reduce((n,s)=>n+s.rows.length,0);
 const gaps=[
  {id:'originals',status:'blocked',detail:'Original deeds, reservations, easements and releases are not reproduced by these abstract summaries. The county online abstract service requires access not configured in this product.',source:'https://www.webercountyutah.gov/Recorder_Surveyor/abstract_title_reg.php'},
  {id:'current-chain',status:'unresolved',detail:'This archive is pre-1980. Parent-parcel references do not establish the full intervening or current conveyance, amendment and release chain.'},
  {id:'patent-root',status:'unresolved',detail:federalRoot.cases.some(c=>c.match==='aliquot_description_overlap')?'A federal grant case has a matching aliquot description. Its original patent and reservation language, and subsequent private transfers, remain unverified.':'The original land grant/patent and its reservation language have not been matched to the parcel.',source:'https://glorecords.blm.gov/s/'},
  {id:'mineral-chain',status:'unresolved',detail:'Commodity, depth, fractional ownership and subsequent mineral transfers cannot be determined from surface ownership or absent GIS/OCR matches.'}
 ];
 if(!requested.length||inventory?.status==='unavailable'||inventory?.status==='unsupported')gaps.push({id:'archive-coverage',status:'unresolved',detail:inventory?.error||inventory?.reason||'No complete parcel-matched archive inventory available.'});
 if(read<requested.length)gaps.push({id:'unread-images',status:'unresolved',detail:(requested.length-read)+' discovered archive image(s) have no cached reading.'});
 if(unsegmented)gaps.push({id:'handwriting',status:'unresolved',detail:unsegmented+' machine-read sheet(s) have no reliable entry-row segmentation; handwriting and book/page references still require interpretation.'});
 if(inventory?.truncated||(inventory?.sections||[]).some(s=>s.error||s.status!=='retrieved')||inventory?.plss?.gaps?.length)gaps.push({id:'partial-inventory',status:'unresolved',detail:'At least one section query, geographic identifier or inventory limit is unresolved.'});
 const originalRequests=records.map(r=>({entry:r.entry,book:r.book,page:r.page,recorded:r.recorded,purpose:r.kind,source:r.source.url}));
 for(const p of history?.records||[])for(const ref of p.references||[])if(!originalRequests.some(r=>r.entry===String(ref.entry)))originalRequests.push({entry:String(ref.entry),purpose:'Public parcel-history reference; original and legal scope required',source:p.url});
 return {schemaVersion:1,status:read?'partial_reading':'inventory_only',asOf:new Date().toISOString(),scope:'Parcel-matched public historic archive research',
  coverage:{discoveredSheets:requested.length,machineReadSheets:read,unreadSheets:requested.length-read,entryCandidates:rowCount,unsegmentedSheets:unsegmented,visuallyCheckedEntries:records.length,fullyVerifiedSheets:0},
  cache:{generatedAt:dataset.generatedAt,reuse:'Readings reused by public source URL and content hash, independent of customer address',refresh:'Live section inventory is refreshed; cached image bytes are not revalidated on every dossier request. Source reading dates remain visible.'},
  sheets,records,gaps,originalRequests,federalRoot,inventoryComplete:false,ownershipDetermined:false,
  mineralStatus:'root_and_subsequent_chain_unresolved',limitation:'Machine reading, targeted transcription, geometric screening and legal applicability are separate. No matches does not mean no rights or restrictions. No original deed or current title completeness is claimed.'};
}
module.exports={assess,key};
