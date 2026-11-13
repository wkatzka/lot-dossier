/* Compare named sections of a user-supplied recorded instrument with the copy Cornerpin retrieved.
   Deterministic: character-level alignment of normalised text (OCR spacing and case ignored), with
   differing passages mapped back to original wording. A match is evidence that the copies agree
   on those sections only; it is never an approval or a legal opinion on the instrument. */
const VERSION='recorded-comparison-1';
const NUM=/^\d{1,2}(?:\.\d{1,2}){1,2}$/;
function headingPattern(number){return new RegExp('(^|\\n)[ \\t]*(?:Section[ \\t]+)?'+number.split('.').join('[ \\t]*\\.[ \\t]*')+'(?![ \\t]*\\.?[ \\t]*\\d)[ \\t.:)]*(?=[A-Z(“"\'\\n]|[ \\t]+[A-Z(“"])','');}
const NEXT=/\n[ \t]*(?:Section[ \t]+)?\d{1,2}[ \t]*\.[ \t]*\d{1,2}(?:[ \t]*\.[ \t]*\d{1,2})?(?![ \t]*\.?[ \t]*\d)[ \t.:)]*[ \t]*[A-Z(“"]|\n[ \t]*ARTICLE[ \t]+[IVXLC\d]+/;
// Page furniture differs between copies by nature: page headers and recorder footers are dropped.
const FURNITURE=/^[ \t]*(?:Page[ \t]+\d+[ \t]+of[ \t]+\d+|E[ \t]*[#f][ \t]*\d{6,8}[ \t]+(?:BK[ \t]*\d+[ \t]+)?PG[ \t]*\d+(?:[ \t]*(?:OF|0F)[ \t]*\d+)?|\d{6,8}[ \t]+PG[ \t]*\d+[ \t]*(?:OF|0F)[ \t]*\d+)[ \t]*$/gim;
// Section text from its heading to the next numbered heading, across page breaks; skips TOC pages.
function clean(pages){return (pages||[]).map(p=>({...p,text:String(p.text||'').replace(FURNITURE,'')})).filter(p=>!/table\s+of\s+contents/i.test(p.text)&&!(p.text.match(/(?:\.{5,}|(?:\.\s+){5,})\s*\d+/g)||[]).length);}
function joinFrom(usable,i,start,limit){let text=usable[i].text.slice(start);for(let j=i+1;j<usable.length&&text.length<limit*2&&usable[j].page===usable[j-1].page+1;j++)text+='\n'+usable[j].text;return text;}
const titleOf=line=>String(line||'').replace(/^[ \t]*(?:Section[ \t]+)?[\d \t.]+/,'').trim();
function sectionText(pages,number,{limit=3000}={}){
 if(!NUM.test(number))return null;const usable=clean(pages),re=headingPattern(number);
 for(let i=0;i<usable.length;i++){const m=re.exec(usable[i].text);if(!m)continue;
  const start=m.index+(m[1]?m[1].length:0),text=joinFrom(usable,i,start,limit);
  const next=NEXT.exec(text.slice(number.length+4)),end=next?number.length+4+next.index:text.length;
  const nextLine=next?text.slice(end).replace(/^\n/,'').split('\n')[0]:'';
  return {number,page:usable[i].page,title:titleOf(text.split('\n')[0]).slice(0,80),nextTitle:titleOf(nextLine).slice(0,80),text:text.slice(0,Math.min(end,limit)).trim()};}
 return null;
}
// In a scanned copy OCR often drops the dots in section numbers ("64 Dwellings"), so the supplied
// section is located by number digits (dots optional) plus the retrieved copy's heading title, and
// ends at the retrieved copy's next heading title.
function locateLike(pages,ref,{limit=3000}={}){
 if(!ref?.title)return null;const usable=clean(pages),digits=ref.number.replace(/\./g,''),key=normalise(ref.title).s.slice(0,18),nextKey=normalise(ref.nextTitle).s.slice(0,14);
 if(key.length<6)return null;
 for(let i=0;i<usable.length;i++){const lines=usable[i].text.split('\n');let offset=0;
  for(const line of lines){const n=normalise(line).s;
   if((n.startsWith(digits+key)||(n.startsWith(key)&&/^[ \t]*$/.test(line.slice(0,line.search(/[A-Za-z]/)).replace(/[\d.\s]/g,''))&&line.search(/\d/)!==-1&&line.search(/\d/)<line.search(/[A-Za-z]/)))){
    const text=joinFrom(usable,i,offset,limit);let end=text.length;
    if(nextKey.length>=6){let pos=text.indexOf('\n');while(pos!==-1&&pos<limit*2){const ln=text.slice(pos+1).split('\n')[0],nn=normalise(ln).s.replace(/^\d+/,'');if(nn.startsWith(nextKey)){end=pos;break;}pos=text.indexOf('\n',pos+1);}}
    return {number:ref.number,page:usable[i].page,title:titleOf(line).slice(0,80),text:text.slice(0,Math.min(end,Math.round(limit*1.3))).trim()};}
   offset+=line.length+1;}
 }
 return null;
}
function normalise(text){const chars=[],map=[];const s=String(text||'');for(let i=0;i<s.length;i++){const c=s[i].toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"');if(/[a-z0-9]/.test(c)){chars.push(c);map.push(i);}}return {s:chars.join(''),map};}
// LCS over normalised characters; differing runs reported in original wording.
function compare(a,b,{minRun=3,maxSnippets=5}={}){
 const A=normalise(a),B=normalise(b),n=A.s.length,m=B.s.length;if(!n||!m)return {ratio:0,differences:[]};
 const W=m+1,t=new Uint16Array((n+1)*W);
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)t[i*W+j]=A.s[i]===B.s[j]?t[(i+1)*W+j+1]+1:Math.max(t[(i+1)*W+j],t[i*W+j+1]);
 const lcs=t[0],runs=[];let i=0,j=0,ra=null,rb=null;
 const flush=()=>{if(ra!==null||rb!==null){runs.push({a:ra??[i,i],b:rb??[j,j]});ra=rb=null;}};
 while(i<n&&j<m){if(A.s[i]===B.s[j]){flush();i++;j++;}else if(t[(i+1)*W+j]>=t[i*W+j+1]){ra=ra?[ra[0],i+1]:[i,i+1];i++;}else{rb=rb?[rb[0],j+1]:[j,j+1];j++;}}
 if(i<n)ra=ra?[ra[0],n]:[i,n];if(j<m)rb=rb?[rb[0],m]:[j,m];flush();
 const words=(src,map,[s,e])=>{if(e<=s)return '';const from=map[Math.max(0,s-12)]??0,to=(map[Math.min(map.length-1,e+12)]??src.length-1)+1;return String(src).slice(from,to).replace(/\s+/g,' ').trim();};
 const differences=runs.filter(r=>(r.a[1]-r.a[0])+(r.b[1]-r.b[0])>=minRun).sort((x,y)=>((y.a[1]-y.a[0])+(y.b[1]-y.b[0]))-((x.a[1]-x.a[0])+(x.b[1]-x.b[0]))).slice(0,maxSnippets).map(r=>({retrieved:words(a,A.map,r.a),supplied:words(b,B.map,r.b)}));
 return {ratio:Math.round(2*lcs/(n+m)*1000)/1000,differences};
}
// Small but material edits (who approves, a number, a negation) barely move the similarity ratio,
// so counts of defined terms, numbers and modal words are compared separately.
const MODALS=['shall','may','must','not','without','unless','prior','written','approv','days','within'];
const STOP=new Set('the any all such this that and for with each its into upon from shall may must not which where when there their these those other than then such also only after before under over within without unless prior'.split(' '));
function count(hay,needle){if(!needle)return 0;let n=0,i=0;while((i=hay.indexOf(needle,i))!==-1){n++;i+=needle.length;}return n;}
function materialDiff(a,b){
 const A=normalise(a).s,B=normalise(b).s,terms=new Set(MODALS);
 for(const m of String(a).matchAll(/\b([A-Z]{2,6}|[A-Z][a-z]{3,})\b/g)){const w=m[1].toLowerCase();if(!STOP.has(w))terms.add(w);}
 for(const m of `${a} ${b}`.matchAll(/\b\d+\b/g))terms.add(m[0]);
 return [...terms].map(t=>({term:t,retrieved:count(A,t),supplied:count(B,t)})).filter(x=>x.retrieved!==x.supplied).slice(0,8);
}
function classify(ratio,material=[]){return ratio<0.9?'differs':material.length?'review_needed':ratio>=0.97?'matches':'minor_differences';}
function result({reference,uploadPages,sections,entry,stamp}){
 const rows=sections.map(number=>{const r=sectionText(reference,number),u=r?(locateLike(uploadPages,r)||sectionText(uploadPages,number)):null;
  if(!r)return {number,status:'not_in_retrieved_copy'};if(!u)return {number,status:'not_found_in_supplied_copy',retrievedPage:r.page};
  const c=compare(r.text,u.text),material=materialDiff(r.text,u.text);return {number,status:classify(c.ratio,material),ratio:c.ratio,material,retrievedPage:r.page,suppliedPage:u.page,differences:c.differences};});
 const recorded=!!stamp?.entry,matchesEntry=recorded&&(!entry||stamp.entry===String(entry));
 const compared=rows.filter(r=>['matches','minor_differences','review_needed','differs'].includes(r.status));
 const overall=!recorded?'no_recorder_stamp':!matchesEntry?'different_entry':!compared.length?'sections_not_found':compared.some(r=>r.status==='differs')?'recorded_copy_differs':compared.some(r=>r.status==='review_needed')?'recorded_copy_needs_review':compared.length<rows.filter(r=>r.status!=='not_in_retrieved_copy').length?'partially_compared':compared.every(r=>r.status==='matches')?'recorded_copy_matches':'recorded_copy_minor_differences';
 return {version:VERSION,overall,entry:entry?String(entry):null,stamp:stamp?{entry:stamp.entry,recordedOn:stamp.recordedOn||null,quote:stamp.quote,dateQuote:stamp.dateQuote||null,matchesEntry}:null,sections:rows,limitation:'Text comparison of the named sections only. It does not establish that the instrument applies to this lot, that it is current, or that any approval exists.'};
}
module.exports={VERSION,sectionText,locateLike,compare,classify,materialDiff,result,normalise};
