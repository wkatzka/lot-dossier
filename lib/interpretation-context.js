/* Keep original scope and execution pages visible when a long instrument is chunked.
 * This selects evidence for the reader; it does not decide adoption or applicability. */
function select(pages,{maxPages=12,maxChars=60000}={}){
 const ranked=pages.map((p,i)=>{const t=(p.text||'').replace(/\s+/g,' ');let score=i<2?1000:0;
  if(/in witness whereof|executed.{0,100}_{2,}|signed.{0,80}_{2,}|notary public|certificate of (?:adoption|amendment|recording)/i.test(t))score+=100;
  if(/legal description|property (?:that is )?subject to|real property.{0,80}burdened by/i.test(t))score+=70;
  if(/means and refers to|shall mean and refer to/i.test(t))score+=40;
  if(/recorded.{0,80}(?:entry|instrument)\s*(?:no\.?|number)|entry\s*#\s*\d+/i.test(t))score+=20;
  return {p,score};}).filter(x=>x.score).sort((a,b)=>b.score-a.score||a.p.page-b.p.page);
 const selected=[];let chars=0;for(const {p} of ranked){if(selected.length>=maxPages)break;if(chars+(p.text||'').length>maxChars)continue;selected.push({page:p.page,text:p.text});chars+=(p.text||'').length;}
 return selected.sort((a,b)=>a.page-b.page);
}
module.exports={select};
