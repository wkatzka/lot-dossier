/* Candidate clauses only. Negation, scope and legal effect require source review. */
const categories={
 granting:/\b(?:grant(?:s|ed|ing)?|convey(?:s|ed|ance)?|hereby reserve[sd]?|except(?:ing|s)? and reserv(?:e|ing))\b/gi,
 property:/\b(?:burdened|benefit(?:ted|ed|ing)?|servient|dominant|legal description|described (?:land|property|premises))\b/gi,
 uses:/\b(?:ingress|egress|access|utility|utilities|drainage|maintenance|repair|construction|surface use|right.of.way)\b/gi,
 duration:/\b(?:perpetual|terminat(?:e|ion|ing)|expir(?:e|ation)|abandon(?:ment|ed)|release[sd]?|amend(?:ed|ment)|supersed(?:e|ed|ing))\b/gi,
 minerals:/\b(?:mineral[s]?|oil and gas|coal|subsurface|royalt(?:y|ies)|undivided|depth|sever(?:ed|ance))\b/gi,
 geometry:/\b(?:\d+(?:\.\d+)?\s*(?:foot|feet|ft)[ -]*(?:wide|width)|centerline|centreline|metes and bounds|blanket easement)\b/gi
};
function candidates(pages){const claims=[];for(let i=0;i<pages.length;i++){const text=String(pages[i]);for(const [category,re]of Object.entries(categories)){re.lastIndex=0;let m;while((m=re.exec(text))&&claims.length<200){const start=Math.max(0,m.index-150),end=Math.min(text.length,m.index+350);claims.push({category,page:i+1,excerpt:text.slice(start,end).replace(/\s+/g,' '),state:'extracted_candidate',legalEffect:'unverified'});}}}return {claims,truncated:claims.length>=200};}
module.exports={candidates};
