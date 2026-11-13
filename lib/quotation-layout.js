/* Restore PDF layout whitespace, never add/remove letters, numbers or punctuation.
   Return the source span so the published quotation remains original text. */
const canonical=s=>s.normalize('NFKC').replace(/[‐‑‒–—−]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').toLowerCase();
function restore(quote,text){
 if(typeof quote!=='string'||typeof text!=='string'||quote.trim().split(/\s+/).length<4)return null;
 const needle=canonical(quote).replace(/\s/g,'');if(needle.length<30)return null;
 let hay='',positions=[];for(let i=0;i<text.length;i++){const chars=canonical(text[i]);for(const char of chars)if(!/\s/.test(char)){hay+=char;positions.push(i);}}
 const at=hay.indexOf(needle);if(at<0)return null;
 const start=positions[at],end=positions[at+needle.length-1]+1;
 // Do not manufacture a quote by joining numeric tokens or cutting into words.
 if(/[\p{L}\p{N}]/u.test(needle[0])&&start>0&&/[\p{L}\p{N}]/u.test(text[start-1]))return null;
 if(/[\p{L}\p{N}]/u.test(needle.at(-1))&&/[\p{L}\p{N}]/u.test(text[end]||''))return null;
 const span=text.slice(start,end);if(/\d\s+\d/.test(span)||/\d\s+\d/.test(quote))return null;
 return span;
}
function repair(parsed,pages){
 const restored=[];
 for(const item of [...(parsed.requirements||[]),...(parsed.authorityChanges||[]),...(parsed.supportingEvidence||[]),...(parsed.missingDocuments||[])]){
  for(const [field,pageKey]of [['quote','page'],['authorityQuote','authorityPage'],['stageQuote','stagePage'],['applicabilityQuote','applicabilityPage'],['dateQuote','datePage']]){
   const q=item[field],text=pages.find(p=>p.page===item[pageKey])?.text;if(!q||!text)continue;
   if(canonical(text).replace(/\s+/g,' ').includes(canonical(q).replace(/\s+/g,' ')))continue;
   const original=restore(q,text);if(original){item[field]=original;restored.push({field,page:item[pageKey],modelQuote:q,sourceQuote:original,method:'layout_whitespace_restored_from_original'});}
  }
 }
 return restored;
}
function refresh(checkpoint){
 if(checkpoint.quotationLayoutVersion===1)return;
 const obsolete=(checkpoint.interpretations||[]).filter(x=>x.rejected?.length&&(x.validationFailures||[]).some(f=>f.requirementQuoteMatches===false&&restore(f.quote,checkpoint.pageTexts[x.sha256]?.pages.find(p=>p.page===f.page)?.text)));
 if(obsolete.length){(checkpoint.supersededInterpretations||=[]).push(...obsolete);checkpoint.interpretations=checkpoint.interpretations.filter(x=>!obsolete.includes(x));for(const x of obsolete)delete checkpoint.interpreted[x.sha256];}
 checkpoint.quotationLayoutVersion=1;
}
module.exports={restore,repair,refresh};
