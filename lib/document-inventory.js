/* Whole-document inventory of a read original: which articles, sections and exhibits are
   physically present, on which page, with verbatim heading lines. Used to reconcile
   chunk-level "not supplied" statements before final synthesis. Presence of a heading is
   retrieval evidence only; it never establishes that the provision applies to a parcel. */
const VERSION=3;
const APPROVAL=/(approv|architect|review|committee|design|construct|plan|enforce|exhibit|annex|propert|land|lot|phase|declarant|succe|terminat)/i;
const ROMAN={i:1,v:5,x:10,l:50,c:100};
function arabic(value){
 const v=String(value).trim().toLowerCase();if(/^\d+$/.test(v))return Number(v);if(!/^[ivxlc]+$/.test(v))return null;
 let n=0;for(let i=0;i<v.length;i++){const a=ROMAN[v[i]],b=ROMAN[v[i+1]]||0;n+=a<b?-a:a;}return n;
}
const squash=s=>String(s||'').replace(/[ \t]+/g,' ').trim();
const norm=s=>squash(s).replace(/(\d)\s+\.\s*(\d)/g,'$1.$2').replace(/[“”]/g,'"').replace(/\s*"\s*([A-Z]{2,8})\s*"\s*/g,' "$1" ');
const tocPage=p=>/table\s+of\s+contents/i.test(p.text)||(p.text.match(/(?:\.{5,}|(?:\.\s+){5,})\s*\d+/g)||[]).length>=4;
function headings(page){
 const out=[],lines=String(page.text||'').split(/\n/);
 lines.forEach((raw,i)=>{
  const line=norm(raw);if(!line||line.length>140)return;
  // A heading is either upper-case ARTICLE or uses a dash/colon separator; prose such as
  // "Article 8 of this Declaration." is a cross-reference, not a heading.
  let m=/^ARTICLE\s+([IVXLC]+|\d+)\b\s*([-–—:])?\s*(.*)$/i.exec(line);
  const nextLine=norm(lines.slice(i+1).find(x=>x.trim())||'');
  // A bare "Article IV" line counts only when a title-like line follows it.
  const bare=m&&!m[3]&&/^[A-Z][^.]{2,80}$/.test(nextLine);
  if(m&&arabic(m[1])&&(/^ARTICLE\b/.test(line)||m[2]||bare)&&!/^(of|to|in|and|or|shall|is|are|above|below|hereof)\b/i.test(m[3])){
   let title=squash(m[3]);if(!title)title=nextLine.slice(0,100);
   out.push({kind:'article',number:String(arabic(m[1])),title,heading:raw.trim(),page:page.page});return;
  }
  m=/^EXHIBIT\s+"?\s*([A-Z]|\d{1,2})\s*"?\s*([-–—:])?\s*(.*)$/i.exec(line);
  if(m&&(!m[3]||/^[A-Z0-9 ,&'()/-]{3,100}$/.test(m[3]))){
   const title=squash(m[3])||norm(lines.slice(i+1).find(x=>x.trim())||'').slice(0,100);
   out.push({kind:'exhibit',number:m[1].toUpperCase(),title,heading:raw.trim(),page:page.page});return;
  }
  m=/^(?:Section\s+)?(\d{1,2})\.(\d{1,2})\s+([A-Z][A-Za-z/&,'’ -]{2,80})$/.exec(line);
  if(m)out.push({kind:'section',number:m[1]+'.'+m[2],article:m[1],title:squash(m[3]).replace(/\s+\/\s*/g,'/'),heading:raw.trim(),page:page.page});
 });
 return out;
}
// Defined acronyms such as Architectural Control Committee ("ACC") are aliases of their section.
function acronyms(text){const out={};for(const m of norm(text).matchAll(/([A-Z][A-Za-z’']+(?:\s+[A-Z][A-Za-z’']+){1,5})\s*\(\s*"([A-Z]{2,8})"\s*\)/g))out[m[2]]=m[1];return out;}
function build(reading,{target={}}={}){
 const pages=(reading?.pages||[]).filter(p=>typeof p.text==='string');
 const usable=pages.filter(p=>!tocPage(p));
 const items=usable.flatMap(headings);
 // One PDF can bundle several instruments (a declaration, then its bylaws). Article numbering
 // restarting marks a new part; references resolve only within their own part.
 // A restart is confirmed only when the next article heading continues the new sequence;
 // an isolated out-of-order heading (often an OCR split such as "1 4") is dropped as noise.
 const parts=[{part:0,start:pages[0]?.page||1}],noise=new Set();let max=0;
 const arts=items.filter(h=>h.kind==='article');
 arts.forEach((h,i)=>{
  const n=Number(h.number);if(n>max){max=n;return;}
  const next=arts[i+1],step=next?Number(next.number)-n:0;
  if(next&&step>=1&&step<=2){parts.push({part:parts.length,start:h.page});max=n;}else noise.add(h);
 });
 for(const h of items)h.part=parts.filter(p=>p.start<=h.page).length-1;
 for(let i=items.length-1;i>=0;i--)if(noise.has(items[i]))items.splice(i,1);
 parts.forEach((p,i)=>p.end=parts[i+1]?parts[i+1].start-1:(pages.at(-1)?.page||p.start));
 const seen=new Set(),entries=[];
 for(const h of items){const key=h.part+':'+h.kind+':'+h.number;if(seen.has(key))continue;seen.add(key);entries.push(h);}
 const sorted=entries.slice().sort((a,b)=>a.page-b.page);
 const parcel=String(target.parcelId||'').replace(/\D/g,'');
 const parcelForms=parcel.length===9?[parcel,parcel.slice(0,2)+'-'+parcel.slice(2,5)+'-'+parcel.slice(5)]:parcel?[parcel]:[];
 const subdivision=String(target.subdivision||'').replace(/\b(at|prud|ph(ase)?|\d+|subdivision)\b.*$/i,'').trim();
 for(const h of entries){
  if(h.kind==='section')continue;
  const next=sorted.find(x=>x.page>h.page&&x.kind===h.kind&&(h.kind==='exhibit'||x.part===h.part)),partEnd=parts[h.part].end;
  h.endPage=next?Math.max(h.page,next.page-1):h.kind==='exhibit'?(pages.at(-1)?.page||h.page):partEnd;
  if(h.kind==='exhibit'){
   const span=pages.filter(p=>p.page>=h.page&&p.page<=h.endPage).map(p=>p.text).join('\n');
   h.namesTargetParcel=parcelForms.some(f=>span.includes(f));
   h.namesTargetSubdivision=!!subdivision&&new RegExp(subdivision.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'),'i').test(span);
   h.namesTargetLot=!!target.lot&&h.namesTargetSubdivision&&new RegExp('\\bLots?\\b[^.]{0,40}\\b'+String(target.lot)+'\\b','i').test(span);
   h.metesAndBounds=/\bBEGINNING\b[\s\S]{0,400}\bTHENCE\b/i.test(span);
   h.parcelNumbers=[...new Set((span.match(/\b\d{2}-\d{3}-\d{4}\b/g)||[]))].length;
  }
 }
 const aliases={};for(const p of usable)Object.assign(aliases,acronyms(p.text));
 for(const s of entries.filter(e=>e.kind==='section')){const acronym=Object.keys(aliases).find(a=>norm(aliases[a]).toLowerCase().endsWith(s.title.toLowerCase()));if(acronym)s.acronym=acronym;}
 // Verbatim opening text of exhibits and approval-related sections, kept because page texts
 // are released after interpretation. Context for role reconciliation, not a validated quotation.
 for(const e of entries){
  if(e.kind==='article')continue;const text=excerpt({pages},e,e.kind==='exhibit'?500:650);
  // Only sections that define a reviewing body or tie approval to plans/construction.
  if(e.kind==='exhibit'||/(architect|committee|design review|enforce)/i.test(e.title)||e.acronym||(/approv/i.test(text)&&/\b(plans?|specifications|commence|construct)/i.test(text)))e.excerpt=text;
 }
 // Recorder-stamp receipt from the original's own stamp text; absent for unrecorded copies.
 return {version:VERSION,sha256:reading?.sha256,pageCount:pages.length,parts,entries,recording:require('./recording-stamp').detect(pages)};
}
function excerpt(reading,entry,limit=700){
 const page=reading?.pages?.find(p=>p.page===entry.page);if(!page)return '';
 const at=page.text.indexOf(entry.heading);return squash((at>=0?page.text.slice(at):page.text).replace(/\s*\n\s*/g,' ')).slice(0,limit);
}
// Map a chunk-level missing reference to an inventory entry in the same original.
// An ambiguous match (the same label in two bundled instruments) resolves only to the part
// containing the referring page; otherwise it stays unresolved rather than guessed.
function locate(identifier,inventory,refPage){
 if(!inventory)return null;const id=norm(identifier);let kind,number;
 let m=/^(?:the\s+)?(?:[\w’' ]+?['’]s\s+)?Exhibit\s+["“]?([A-Z]|\d{1,2})["”]?(?:\s+to\s+the\s+\w+)?$/i.exec(id);
 if(m){kind='exhibit';number=m[1].toUpperCase();}
 else if((m=/^Article\s+([IVXLC]+|\d+)$/i.exec(id))){kind='article';number=String(arabic(m[1]));}
 else if((m=/^Section\s+(\d{1,2}\.\d{1,2})$/i.exec(id))){kind='section';number=m[1];}
 else return null;
 const found=inventory.entries.filter(e=>e.kind===kind&&e.number===number);
 if(found.length<=1)return found[0]||null;
 const part=(inventory.parts||[]).find(p=>refPage>=p.start&&refPage<=p.end);
 const scoped=part?found.filter(e=>e.part===part.part):[];
 return scoped.length===1?scoped[0]:null;
}
function reconcile(interpretations,inventories){
 const recovered=[];
 for(const d of interpretations){
  const inventory=inventories[d.sha256];if(!inventory)continue;const remaining=[];
  // Re-runnable: undo earlier inventory resolutions so a corrected inventory can re-decide them.
  const prior=(d.resolvedReferences||[]).filter(r=>r.resolution==='recovered_in_same_original');
  if(prior.length){d.resolvedReferences=d.resolvedReferences.filter(r=>!prior.includes(r));d.missingDocuments=[...(d.missingDocuments||[]),...prior.map(({resolution,resolvedPage,resolvedEndPage,resolutionQuote,staleStatement,...ref})=>({...ref,description:staleStatement??ref.description}))];}
  for(const ref of d.missingDocuments||[]){
   const entry=locate(ref.identifier,inventory,ref.page);
   if(!entry){remaining.push(ref);continue;}
   const record={...ref,resolution:'recovered_in_same_original',resolvedPage:entry.page,resolvedEndPage:entry.endPage,resolutionQuote:entry.heading,sha256:d.sha256,staleStatement:ref.description};
   (d.resolvedReferences||=[]).push(record);recovered.push(record);
  }
  d.missingDocuments=remaining;
 }
 return recovered;
}
// Statements that a recovered heading is absent. Clause-level so "Exhibit A was recovered, and
// Supplemental Declarations are not supplied" is not treated as a stale claim.
const ABSENT=/\b(not\s+(?:been\s+)?(?:supplied|recovered|retrieved|provided|included|located|found|available|present|shown|in the (?:record|evidence|supplied pages))|missing|absent|unavailable|lacking)\b/i;
const ACCEPTED=/\b(recovered|retrieved|already read|is present|are present|was read|were read)\b/i;
const STOP=new Set('the of and for to a an in on at by with under amended restated declaration covenants conditions restrictions homeowners association inc llc lc utah weber county recorder entry no page pages pdf original copy public supplied context reviewed excerpt'.split(' '));
const words=t=>String(t||'').toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!STOP.has(w))||[];
// Labels such as "Exhibit A" recur across instruments; an ambiguous label only matches a clause
// that also names something distinctive about that original (for example "master" or "Trappers").
function aliases(inventories,titles={}){
 const out=[],shas=Object.keys(inventories||{});
 const own=Object.fromEntries(shas.map(h=>[h,new Set(words((titles[h]||[]).join(' ')))]));
 const distinct=Object.fromEntries(shas.map(h=>[h,[...own[h]].filter(w=>shas.every(o=>o===h||!own[o].has(w)))]));
 for(const [sha256,inv] of Object.entries(inventories||{}))for(const e of inv.entries){
  const label=e.kind==='exhibit'?'Exhibit '+e.number:e.kind==='article'?'Article '+e.number:'Section '+e.number;
  const patterns=[];
  if(e.kind==='exhibit')patterns.push(new RegExp('\\bExhibit\\s+["“]?'+e.number+'["”]?(?![A-Za-z0-9])','i'));
  if(e.kind==='article'){const roman=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'][Number(e.number)];patterns.push(new RegExp('\\bArticle\\s+(?:'+e.number+(roman?'|'+roman:'')+')\\b','i'));}
  if(e.kind==='section'){patterns.push(new RegExp('\\b(?:Section|§)\\s*'+e.number.replace('.','\\.')+'\\b','i'));
   for(const name of [e.acronym,e.title].filter(Boolean))patterns.push(new RegExp('\\b'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+(?:provisions?|clauses?|sections?|terms|article)\\b','i'));}
  out.push({sha256,label,page:e.page,patterns,distinct:distinct[sha256]});
 }
 for(const a of out)a.ambiguous=out.some(b=>b!==a&&b.sha256!==a.sha256&&b.label===a.label);
 return out;
}
function staleClaims(synthesis,inventories,titles={}){
 const list=aliases(inventories,titles),claims=[];
 const fields=[...(synthesis.findings||[]).flatMap((f,i)=>[['finding '+(i+1),f.text,f.text],['finding '+(i+1)+' limitations',f.limitations,f.text]]),// A direction classified as working with a read original (applicability or copy equivalence)
 // may name recovered material; only "not retrieved"/"retrieved but unread" directions claim absence.
 ...(synthesis.missingEvidence||[]).filter(m=>!['read_applicability_unresolved','copy_recovered_equivalence_unverified','current_appointment_or_amendment_unverified'].includes(m.dependency)).map((m,i)=>['direction '+(synthesis.missingEvidence.indexOf(m)+1)+' document',m.document,m.document])];
 for(const [where,text] of fields){
  for(const clause of String(text||'').split(/(?<=[.;:])\s+|,\s+(?:and|but|while|whereas)\s+|\s+but\s+|\s+while\s+|\s+whereas\s+/i)){
   const absenceField=/document$/.test(where);
   if(!absenceField&&!ABSENT.test(clause))continue;if(ACCEPTED.test(clause))continue;
   for(const a of list){
    // "Guidelines described in Section 6.2" points at where an item is mentioned; it does
    // not claim the section itself is missing.
    const hit=a.patterns.map(p=>p.exec(clause)).find(Boolean);if(!hit)continue;
    if(/\b(in|under|by|per|from|described|referenced|cited|see|pursuant to|required by|defined in|contemplated by)\s*$/i.test(clause.slice(0,hit.index)))continue;
    if(a.ambiguous&&!a.distinct.some(w=>clause.toLowerCase().includes(w)))continue;
    if(!claims.some(c=>c.where===where&&c.clause===clause.trim()&&c.sha256===a.sha256&&c.recovered===a.label))claims.push({where,clause:clause.trim(),recovered:a.label,page:a.page,sha256:a.sha256});
   }
  }
 }
 return claims;
}
module.exports={VERSION,APPROVAL,build,excerpt,reconcile,locate,staleClaims,headings,arabic};
