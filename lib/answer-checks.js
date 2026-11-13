/* Deterministic rejection of explanation drafts that contradict recovered evidence. These are
   claim-shape checks over the model's draft (with evidence IDs), not keyword requirements:
   each rule fires only when a statement conflicts with a recovered fact or a cited requirement. */
const DEPENDENCIES=['not_retrieved','retrieved_unread','read_applicability_unresolved','copy_recovered_equivalence_unverified','current_appointment_or_amendment_unverified'];
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const STOP=new Set('the of and for to a an in on at by with under amended restated declaration covenants conditions restrictions homeowners association inc llc lc utah weber county recorder entry no page pages pdf original copy public supplied context reviewed excerpt bylaws exhibits with'.split(' '));
const clean=t=>String(t||'').replace(/\s*\([^()]*\)\s*/g,' ');
const words=t=>clean(t).toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!STOP.has(w))||[];
function distinct(titles){
 const own=Object.fromEntries(Object.entries(titles).map(([h,t])=>[h,new Set(words(t.join(' ')))]));
 return Object.fromEntries(Object.keys(own).map(h=>[h,[...own[h]].filter(w=>Object.keys(own).every(o=>o===h||!own[o].has(w)))]));
}
const clauses=t=>String(t||'').split(/(?<=[.;:])\s+|,\s+(?:and|but|while|whereas)\s+|\s+but\s+|\s+whereas\s+/i).filter(Boolean);
const sentences=t=>String(t||'').split(/(?<=[.;])\s+/).filter(Boolean);
const UNKNOWN=/\b(not (?:shown|established|visible|stated|legible|clear|confirmed|identified|given|provided|supplied|recovered|available)|unknown|missing|garbled|unclear|absent|unconfirmed|unverified|illegible|partly (?:OCR-)?garbled)\b/i;
const REC=/\b(record(?:ed|ing)|entry|stamp)\b/i;
const ASK=/\b(obtain|retrieve|pull|get|locate|find|confirm|request|search|order)\b/i;
const ASK_REC=/\b(recorded (?:copy|version|instrument|original)|recording (?:stamp|entry|date|information|data|details|status)|entry (?:no\.?|number)|recorder(?:'s)? stamp|with its (?:recording )?stamp)\b/i;
function dates(text){
 const out=[];
 for(const m of text.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{1,2}))?,?\s+(\d{4})\b/gi))out.push({year:+m[3],month:MONTHS.indexOf(m[1].toLowerCase())+1,day:m[2]?+m[2]:null,text:m[0]});
 for(const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))out.push({year:+m[1],month:+m[2],day:+m[3],text:m[0]});
 if(!out.length)for(const m of text.matchAll(/\b(19|20)(\d{2})\b/g))out.push({year:+(m[1]+m[2]),month:null,day:null,text:m[0]});
 return out;
}
function context(items,interpretations,inventories,unread=[]){
 const titles={},status={};for(const d of interpretations){(titles[d.sha256]||=[]).push(d.documentTitle);if(d.documentStatus&&status[d.sha256]!=='recording_or_adoption_identified')status[d.sha256]=d.documentStatus;}
 // Instruments whose execution is open: an execution clause was read but neither execution nor recording
 // is identified. Published guidelines and checklists are not instruments that need signatures.
 const unexecuted=new Set(interpretations.filter(d=>(d.supportingEvidence||[]).some(e=>e.kind==='execution_status')).map(d=>d.sha256).filter(h=>['not_established','proposal_or_draft'].includes(status[h])));
 return {map:new Map(items.map(x=>[x.id,x])),titles,status,unexecuted,inventories,unread,distinct:distinct(titles)};
}
function tokensFor(ctx,sha){const r=ctx.inventories[sha]?.recording;const order=words((ctx.titles[sha]||[])[0]||'').filter(w=>(ctx.distinct[sha]||[]).includes(w));return {words:ctx.distinct[sha]||[],lead:order[0],entry:r?.entry};}
// A clause refers to an original by its entry number, its leading distinctive title word, or two
// distinctive title words; a clause about a different entry number is about another instrument.
function hits(clause,t){const c=clause.toLowerCase();if(Array.isArray(t))return t.some(x=>c.includes(String(x).toLowerCase()));
 if(t.entry&&c.includes(t.entry))return true;const others=(clause.match(/\b\d{6,8}\b/g)||[]).filter(n=>n!==t.entry);
 const named=(t.lead&&new RegExp('\\b'+t.lead+'\\b').test(c))||t.words.filter(w=>new RegExp('\\b'+w+'\\b').test(c)).length>=2;
 return named&&!(others.length&&/\b(not|no|missing|unknown|unverified|absent)\b/i.test(clause.slice(clause.search(new RegExp('\\b'+others[0]+'\\b')))));}
const WORK_TERMS={'2':/pool|swim|amenit|improvement|structure|exterior|landscap/i,'74':/deck|patio|terrace|improvement|amenit|structure|exterior/i,'96':/garage|outbuilding|accessory|structure|improvement|building/i,'6':/wall|grading|landscap|improvement|structure/i,'8':/solar|panel|roof|exterior|device|equipment/i,'3':/addition|exterior|dwelling|structure|improvement/i,'102':/dwelling|unit|rental|occupan|exterior/i,'1':/dwelling|construction|structure|building/i,'104':/dwelling|construction|structure|building|demoli/i};
function check(draft,ctx){
 const problems=[];const recorded=Object.entries(ctx.inventories).filter(([h,i])=>i.recording&&ctx.titles[h]);
 const findingFields=[...(draft.findings||[]).flatMap((f,i)=>[['finding '+(i+1),f.text,f],['finding '+(i+1)+' limitations',f.limitations,f]]),...(draft.answer?[['short answer',[draft.answer.approver,draft.answer.when,draft.answer.uncertainty].join(' '),draft.answer]]:[])];
 // 1. Recovered recording identifiers/dates described as missing, or requested again.
 for(const [sha,inv] of recorded){
  const tokens=tokensFor(ctx,sha),r=inv.recording,label=`${ctx.titles[sha][0].replace(/\s*\(.*$/,'')} (recorder stamp Entry ${r.entry}${r.recordedOn?', recorded '+r.recordedOn:''}, PDF page ${r.page})`;
  for(const [where,text] of findingFields)for(const c of clauses(text))if(hits(c,tokens)&&REC.test(c)&&UNKNOWN.test(c)&&!/\b(unsigned|online|draft) copy\b/i.test(c))problems.push(`${where} says "${c.trim()}", but ${label} is on the retrieved original. State the recovered identifier${r.recordedOn?' and date':''}; do not call it missing.`);
  (draft.missingEvidence||[]).forEach((m,i)=>{for(const c of clauses(m.document+'. '+m.action))if(hits(c,tokens)&&ASK.test(c+' '+m.action)&&ASK_REC.test(c)&&!/\b(already|recovered|retrieved copy)\b/i.test(c))problems.push(`direction ${i+1} asks for "${c.trim()}", but ${label} was already recovered. Remove that request or ask only for what remains open.`);});
  // 2. Execution, notary or filename dates presented as the recording date.
  if(r.recordedOn){const [y,mo,d]=r.recordedOn.split('-').map(Number);
   for(const [where,text] of findingFields)for(const c of clauses(text)){
    const m=new RegExp('('+[tokens.entry,tokens.lead,...tokens.words].filter(Boolean).map(t=>String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')([^.;]{0,70}?)\\brecorded\\b(?:\\s+(?:on|in|as of))?\\s+([^.;]{0,40})','i').exec(c);
    if(!m||/\b(refers?|cites?|identif\w*|amends?|of the|to the|underlying)\b/i.test(m[2]))continue;
    for(const dt of dates(m[3]).slice(0,1))if(dt.year!==y||(dt.month&&dt.month!==mo)||(dt.day&&dt.day!==d))problems.push(`${where} gives "${dt.text}" as the recording date of ${label}; the recorder stamp reads ${r.dateQuote} (${r.recordedOn}). Do not use execution, acknowledgment or filename dates as recording dates.`);
   }}
 }
 // 3. Next-action dependency must match the recovered evidence.
 (draft.missingEvidence||[]).forEach((m,i)=>{
  if(!DEPENDENCIES.includes(m.dependency))problems.push(`direction ${i+1} has no valid dependency classification.`);
  if(m.dependency==='retrieved_unread'&&!ctx.unread.length)problems.push(`direction ${i+1} is classified as retrieved but unread, yet every retrieved original was read.`);
  const cited=[...new Set((m.evidenceIds||[]).map(id=>ctx.map.get(id)?.sha256).filter(Boolean))];
  if(m.dependency==='copy_recovered_equivalence_unverified'&&!cited.some(h=>!ctx.inventories[h]?.recording&&ctx.unexecuted.has(h)))problems.push(`direction ${i+1} says a recovered copy's execution/recording equivalence is unverified, but every cited original bears a recorder stamp or identified recording.`);
  if(m.dependency==='not_retrieved')for(const [sha,inv] of recorded)if(new RegExp('\\b'+inv.recording.entry+'\\b').test(m.document+' '+m.action))problems.push(`direction ${i+1} classifies Entry ${inv.recording.entry} as not retrieved, but that recorded original was retrieved and read.`);
  if(!String(m.question||'').trim())problems.push(`direction ${i+1} does not state the specific question it would answer.`);
 });
 // 4. Unsigned/unrecorded copies: the limitation must be stated, and enforceability not asserted.
 (draft.findings||[]).forEach((f,i)=>{
  const shas=[...new Set((f.evidenceIds||[]).map(id=>ctx.map.get(id)).filter(e=>e?.type==='requirement').map(e=>e.sha256))].filter(h=>!ctx.inventories[h]?.recording&&ctx.unexecuted.has(h));
  if(!shas.length)return;const all=f.text+' '+f.limitations;
  if(!/\b(unsigned|unexecuted|unrecorded|not (?:shown|established|proven|verified) (?:to be |as )?(?:executed|signed|recorded)|no recording stamp|online copy|draft|blank (?:execution|signature))/i.test(all))problems.push(`finding ${i+1} relies on a requirement from an original with no recording stamp or identified execution, but does not say so.`);
  for(const s of sentences(all))if(/\b(?:is|are|remains?)\s+(?:legally\s+)?(?:enforceable|binding|in (?:full )?(?:force|effect)|currently (?:effective|in effect|operative))\b/i.test(s)&&!/\b(not|whether|if|unless|cannot|unverified|unestablished)\b/i.test(s))problems.push(`finding ${i+1} states "${s.trim()}" although the supporting copy is not shown to be executed or recorded.`);
 });
 // 5. Construction gates must not be restated as submission/issuance gates.
 const stageText=[...(draft.findings||[]).map((f,i)=>['finding '+(i+1),f.text,f.evidenceIds]),...(draft.answer?[['short answer',draft.answer.when,draft.answer.evidenceIds]]:[])];
 for(const [where,text,ids] of stageText){
  const reqs=(ids||[]).map(id=>ctx.map.get(id)).filter(e=>e?.type==='requirement'&&e.authority);
  for(const s of sentences(text)){
   if(!/\bbefore\s+(?:the\s+)?(?:a\s+)?(?:building\s+|city\s+|municipal\s+)?(?:permit\s+)?(?:submission|submitting|application|applying|issuance|(?:the\s+)?permit (?:is )?issued)\b/i.test(s)||/\b(not|no|does not|do not|separate)\b[^.]{0,40}\b(tie|link|require|state|say|mention)/i.test(s))continue;
   for(const r of reqs){const name=String(r.authority).replace(/^the\s+/i,'').split(/[’']s\b/)[0].trim();if(!name||!s.toLowerCase().includes(name.toLowerCase().split(' ').slice(-1)[0]))continue;
    if(r.stage==='construction'&&!reqs.some(x=>x.authority===r.authority&&['submission','other_submission','issuance'].includes(x.stage)))problems.push(`${where} says "${s.trim()}", but the cited ${r.authority} requirement (PDF page ${r.page}) is a construction-commencement gate; the source does not tie it to submission or issuance.`);}
  }
 }
 // 6. Missing individual names must not erase a supported institutional role.
 const hasRole=[...ctx.map.values()].some(e=>e.type==='requirement'&&e.authority);
 // The exemption covers statements whose subject is the individuals ("current reviewer names are
 // unknown"), not statements that the role itself is unknown because individuals are unnamed.
 const ERASE=[/\b(?:no|unknown|unidentified|unclear)\s+(?:approv(?:er|ing (?:body|authority))|review(?:er|ing (?:body|authority)))\b/i,/\b(?:approv(?:er|ing (?:body|authority))|review(?:er|ing (?:body|authority)))\s+(?:identity\s+)?(?:is|are|remains?)\s+(?:unknown|not (?:identified|established|known|shown))\b/i];
 if(hasRole)for(const [where,text] of findingFields)for(const c of clauses(text))for(const re of ERASE){const m=re.exec(c);if(!m)continue;
  const before=c.slice(Math.max(0,m.index-25),m.index),inside=m[0];
  if(/\b(current|individual|named|specific|appointed)\s*$/i.test(before)||/\b(names?|members?|appointees?)\b/i.test(inside)||/\bfor (?:owner improvements|[a-z ]{0,30}only)\b|\bonly for\b/i.test(c))continue;
  problems.push(`${where} says "${c.trim()}", but the sources identify an approving body by role; missing individual appointments do not erase that role.`);break;}
 // 8. A permit-specific answer must rest on an excerpt that covers that kind of work.
 const fw=String(draft.answer?.forWork||'').trim();
 if(fw&&(ctx.plannedWork||[]).length&&/\b(approv|consent|permission|required|must|need)/i.test(fw)&&!/\bno (?:retrieved )?(?:excerpt|clause|document|provision)s?\b|\bnot address|\bdoes not (?:mention|cover)/i.test(fw)){
  const cited=(draft.answer.evidenceIds||[]).map(id=>ctx.map.get(id)).filter(Boolean),text=cited.map(e=>[e.quote,e.requirement,e.appliesWhen].join(' ')).join(' ');
  const covers=ctx.plannedWork.some(w=>(WORK_TERMS[w.typeId]||/exterior|improvement|structure/i).test(text));
  if(!covers)problems.push('short answer says approval is needed for '+ctx.plannedWork.map(w=>w.label).join(', ')+', but none of its cited excerpts addresses that kind of work. Cite the covering clause or say no excerpt addresses it.');
 }
 // 7. The short answer must point to a real next action.
 if(draft.answer){if(!String(draft.answer.approver||'').trim())problems.push('short answer does not name the approving body the sources identify.');
  if(!Number.isInteger(draft.answer.nextActionIndex)||!draft.missingEvidence?.[draft.answer.nextActionIndex])problems.push('short answer does not select one of the listed next actions.');}
 return problems;
}
module.exports={DEPENDENCIES,check,context,distinct,dates};
