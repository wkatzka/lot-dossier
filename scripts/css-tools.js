/* Browser-console tools for retiring legacy CSS safely. Paste into the production page (or load) and run.
   1) CornerpinCSS.coverage(): which selectors in @layer legacy match anything on the current screen.
      Call .collect() on every screen you visit; .unmatched() lists keys that never matched.
   2) CornerpinCSS.snapshot(): computed styles of every visible element in the app, for a before/after diff.
      Take one before a CSS change and one after; CornerpinCSS.diff(a,b) must report "identical" for a no-op change.
   Used for "Retire legacy CSS, pass 1" (all 19 screens across two projects identical after removing 11.5 KB). */
(function(root){'use strict';
const split=s=>{const out=[];let d=0,cur='';for(const ch of s){if(ch==='('||ch==='[')d++;else if(ch===')'||ch===']')d--;if(ch===','&&d===0){out.push(cur.trim());cur='';}else cur+=ch;}if(cur.trim())out.push(cur.trim());return out;};
const norm=s=>s.replace(/::/g,':').replace(/['"]/g,'').replace(/\s+/g,'');
// Drop state pseudo-classes / pseudo-elements so ".x:hover" counts as matching when ".x" exists.
const strip=s=>{let q=s.replace(/::?(hover|focus-visible|focus-within|focus|active|visited|before|after|placeholder|marker|selection|first-letter|first-line|backdrop|-webkit-[a-z-]+|-moz-[a-z-]+|checked|disabled|invalid|valid|placeholder-shown|target)(\([^)]*\))?/g,'').trim();
 q=q.replace(/([>+~])\s*(?=[>+~),]|$)/g,'$1 *').replace(/\(\s*\)/g,'(*)').replace(/^\s*([>+~])/,'* $1');return q||'*';};
function coverage(layer='legacy'){
 const sels=[];const walk=(rules,media,inL)=>{for(const r of rules){if(r instanceof CSSLayerBlockRule)walk(r.cssRules,media,inL||r.name===layer);else if(r instanceof CSSMediaRule)walk(r.cssRules,media+'@'+r.conditionText,inL);else if(r instanceof CSSSupportsRule)walk(r.cssRules,media+'@s'+r.conditionText,inL);else if(r instanceof CSSStyleRule&&inL)for(const s of split(r.selectorText))sels.push({key:norm(media)+'|'+norm(s),q:strip(s)});}};
 for(const sh of document.styleSheets){try{walk(sh.cssRules,'',false);}catch(e){}}
 const matched=new Set();
 const collect=()=>{let n=0;const ds=[...document.querySelectorAll('details')],was=ds.map(d=>d.open);for(const pass of [0,1]){if(pass)ds.forEach(d=>d.open=true);for(const x of sels){if(matched.has(x.key))continue;try{if(document.querySelector(x.q)){matched.add(x.key);n++;}}catch(e){matched.add(x.key);}}}ds.forEach((d,i)=>d.open=was[i]);return n;};
 return {total:new Set(sels.map(s=>s.key)).size,collect,matched,unmatched:()=>[...new Set(sels.filter(x=>!matched.has(x.key)).map(x=>x.key))]};
}
const PROPS=['display','position','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','border-top-width','border-top-color','border-left-width','border-left-color','border-top-left-radius','border-bottom-right-radius','background-color','background-image','color','font-size','font-weight','line-height','text-transform','letter-spacing','box-shadow','gap','grid-template-columns','width','height','opacity','text-decoration-line'];
function snapshot(scope='#project-frame *, #project-workspace *, #rv *, #cornerpin-global-nav *, #home *'){
 return [...document.querySelectorAll(scope)].filter(e=>e.getClientRects().length&&!e.closest('svg')&&!e.closest('.leaflet-container')).map(e=>{const s=getComputedStyle(e);return e.tagName+'.'+String(e.className).slice(0,30)+'|'+PROPS.map(p=>p==='width'||p==='height'?Math.round(parseFloat(s[p])||0):s.getPropertyValue(p)).join(';');});
}
function diff(a,b){if(a.length!==b.length)return 'element count '+a.length+' vs '+b.length;const out=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i]){const [t,va]=a[i].split('|'),vb=b[i].split('|')[1].split(';');out.push(t+' '+PROPS.filter((p,j)=>va.split(';')[j]!==vb[j]).map(p=>{const j=PROPS.indexOf(p);return p+':'+va.split(';')[j]+'→'+vb[j];}).join(', '));}return out.length?out:'identical ('+a.length+')';}
root.CornerpinCSS={coverage,snapshot,diff};
})(typeof window!=='undefined'?window:globalThis);
