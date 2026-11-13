/* In-browser UI text audit. Paste into the page (or load) and call CornerpinUIAudit.run().
   Expands every <details>, then reports visible text problems a user would notice:
   repeated lines, leaked null/undefined/NaN, raw machine codes, empty controls, broken punctuation,
   giant paragraphs, raw URLs shown as text, and duplicate adjacent sentences. Read-only. */
(function(root){'use strict';
const visible=el=>{if(!el||!el.getClientRects().length)return false;const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none';};
const norm=t=>String(t||'').replace(/\s+/g,' ').trim();
// Machine-code words that should never reach a user (snake_case with 2+ underscores, or known internal states).
const CODE=/\b[a-z]+(?:_[a-z0-9]+){2,}\b/;
const BAD=/(^|[^\w])(undefined|null|NaN|\[object Object\]|Invalid Date|Infinity)([^\w]|$)/;
const PUNCT=/(·\s*·|\s\.\s|\.\.(?!\.)|,\s*,|:\s*\.|\(\s*\)|—\s*—|\s{2,}[.,])/;
function run(scope=document.body,{expand=true}={}){
 if(expand)scope.querySelectorAll('details').forEach(d=>d.open=true);
 const issues=[],add=(kind,el,text)=>issues.push({kind,text:norm(text).slice(0,160),where:(el.closest('section,article,li,form')?.querySelector('h1,h2,h3,h4')?.innerText||'').slice(0,60)});
 const blocks=[...scope.querySelectorAll('p,li,h1,h2,h3,h4,h5,dt,dd,td,th,label,summary,button,a,small,strong')].filter(visible);
 // 1. The same line repeated 3+ times under one container.
 const byParent=new Map();for(const el of blocks){if(!['P','LI','DD','TD'].includes(el.tagName))continue;const t=norm(el.innerText);if(t.length<4)continue;const k=el.parentElement;if(!byParent.has(k))byParent.set(k,new Map());const m=byParent.get(k);m.set(t,(m.get(t)||0)+1);}
 for(const [el,m] of byParent)for(const [t,n] of m)if(n>=3)add('repeated-line ×'+n,el,t);
 // 2-5. Text leaks, machine codes, broken punctuation, giant paragraphs.
 for(const el of blocks){const own=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ');const t=norm(el.innerText);
  if(BAD.test(own))add('leaked-value',el,t);
  if(CODE.test(own)&&!/@|https?:|\.pdf|\.tif/.test(own))add('machine-code',el,t);
  if(PUNCT.test(own))add('punctuation',el,t);
  if(el.tagName==='P'&&t.length>600)add('giant-paragraph '+t.length+' chars',el,t);
  if(/^https?:\/\/\S{30,}$/.test(t)&&el.tagName!=='A')add('raw-url',el,t);
  // duplicate adjacent sentence
  const sents=t.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>25);for(let i=1;i<sents.length;i++)if(sents[i]===sents[i-1]){add('duplicate-sentence',el,sents[i]);break;}
 }
 // 6. Empty headings, buttons and links.
 for(const el of scope.querySelectorAll('h1,h2,h3,h4,button,a'))if(visible(el)&&!norm(el.innerText)&&!el.querySelector('svg,img')&&!el.getAttribute('aria-label'))add('empty-'+el.tagName.toLowerCase(),el,el.outerHTML.slice(0,120));
 // 7. A link whose text is a bare URL.
 for(const a of scope.querySelectorAll('a'))if(visible(a)&&/^https?:\/\/\S{40,}$/.test(norm(a.innerText)))add('url-as-link-text',a,a.innerText);
 // Collapse identical findings.
 const seen=new Map();for(const x of issues){const k=x.kind+'|'+x.text;seen.set(k,{...x,count:(seen.get(k)?.count||0)+1});}
 return [...seen.values()];
}
const api={run};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CornerpinUIAudit=api;
})(typeof window!=='undefined'?window:globalThis);
