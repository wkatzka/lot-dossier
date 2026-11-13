/* Whole-document inventory of a read original: which articles, sections and exhibits are
   physically present, on which page, with verbatim heading lines. Used to reconcile
   chunk-level "not supplied" statements before final synthesis. Presence of a heading is
   retrieval evidence only; it never establishes that the provision applies to a parcel. */
const VERSION=1;
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
  if(m&&arabic(m[1])&&(/^ARTICLE\b/.test(line)||m[2])&&!/^(of|to|in|and|or|shall|is|are|above|below|hereof)\b/i.test(m[3])){
   let title=squash(m[3]);if(!title)title=norm(lines.slice(i+1).find(x=>x.trim())||'').slice(0,100);
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
 // Keep the first substantive occurrence of each article/exhibit/section.
 const seen=new Set(),entries=[];
 for(const h of items){const key=h.kind+':'+h.number;if(seen.has(key))continue;seen.add(key);entries.push(h);}
 const sorted=entries.slice().sort((a,b)=>a.page-b.page);
 const parcel=String(target.parcelId||'').replace(/\D/g,'');
 const parcelForms=parcel.length===9?[parcel,parcel.slice(0,2)+'-'+parcel.slice(2,5)+'-'+parcel.slice(5)]:parcel?[parcel]:[];
 const subdivision=String(target.subdivision||'').replace(/\b(at|prud|ph(ase)?|\d+|subdivision)\b.*$/i,'').trim();
 for(const h of entries){
  if(h.kind==='section')continue;
  const next=sorted.find(x=>x.page>h.page&&x.kind===h.kind);
  h.endPage=next?Math.max(h.page,next.page-1):pages.length?pages[pages.length-1].page:h.page;
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
 return {version:VERSION,sha256:reading?.sha256,pageCount:pages.length,entries};
}
function excerpt(reading,entry,limit=700){
 const page=reading?.pages?.find(p=>p.page===entry.page);if(!page)return '';
 const at=page.text.indexOf(entry.heading);return squash((at>=0?page.text.slice(at):page.text).replace(/\s*\n\s*/g,' ')).slice(0,limit);
}
// Map a chunk-level missing reference to an inventory entry in the same original.
function locate(identifier,inventory){
 if(!inventory)return null;const id=norm(identifier);
 let m=/^(?:the\s+)?(?:[\w’' ]+?['’]s\s+)?Exhibit\s+["“]?([A-Z]|\d{1,2})["”]?\b/i.exec(id);
 if(m)return inventory.entries.find(e=>e.kind==='exhibit'&&e.number===m[1].toUpperCase())||null;
 m=/^Article\s+([IVXLC]+|\d+)$/i.exec(id);
 if(m)return inventory.entries.find(e=>e.kind==='article'&&e.number===String(arabic(m[1])))||null;
 m=/^Section\s+(\d{1,2}\.\d{1,2})$/i.exec(id);
 if(m)return inventory.entries.find(e=>e.kind==='section'&&e.number===m[1])||null;
 return null;
}
function reconcile(interpretations,inventories){
 const recovered=[];
 for(const d of interpretations){
  const inventory=inventories[d.sha256];if(!inventory)continue;const remaining=[];
  for(const ref of d.missingDocuments||[]){
   const entry=locate(ref.identifier,inventory);
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
 const fields=[...(synthesis.findings||[]).flatMap((f,i)=>[['finding '+(i+1),f.text,f.text],['finding '+(i+1)+' limitations',f.limitations,f.text]]),...(synthesis.missingEvidence||[]).map((m,i)=>['direction '+(i+1)+' document',m.document,m.document])];
 for(const [where,text] of fields){
  for(const clause of String(text||'').split(/(?<=[.;:])\s+|,\s+(?:and|but|while|whereas)\s+|\s+but\s+|\s+while\s+|\s+whereas\s+/i)){
   const absenceField=/document$/.test(where);
   if(!absenceField&&!ABSENT.test(clause))continue;if(ACCEPTED.test(clause))continue;
   for(const a of list){
    if(!a.patterns.some(p=>p.test(clause)))continue;
    if(a.ambiguous&&!a.distinct.some(w=>clause.toLowerCase().includes(w)))continue;
    if(!claims.some(c=>c.where===where&&c.clause===clause.trim()&&c.sha256===a.sha256&&c.recovered===a.label))claims.push({where,clause:clause.trim(),recovered:a.label,page:a.page,sha256:a.sha256});
   }
  }
 }
 return claims;
}
module.exports={VERSION,APPROVAL,build,excerpt,reconcile,locate,staleClaims,headings,arabic};
