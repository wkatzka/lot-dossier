/* One visual system: components.css is the single source for cards, buttons, chips and text sizes.
   Older stylesheets live in @layer legacy so components win without specificity fights; this test keeps it that way. */
const assert=require('node:assert/strict'),fs=require('fs');
const html=fs.readFileSync('public/platform.html','utf8'),comp=fs.readFileSync('web/components.css','utf8');
assert(/@layer legacy\{/.test(html),'Built page wraps the older CSS in @layer legacy');
assert(html.indexOf('@layer legacy{')<html.indexOf('Cornerpin components'),'components.css comes after (and outside) the legacy layer');
assert(!/!important/.test(comp.replace(/\/\*[\s\S]*?\*\//g,'')),'components.css needs no !important: it already wins over the legacy layer');
const legacy=['styles.css','project-workspace.css','design-system.css'].map(f=>fs.readFileSync('web/'+f,'utf8')).join('');
const n=(legacy.match(/!important/g)||[]).length;
assert(n<=49,'Legacy CSS gained !important rules ('+n+' > 49). Style components in web/components.css instead.');
for(const v of ['--cp-r:','--cp-t-concern-bg','--cp-t-review-bg','--cp-t-verify-bg','--cp-t-ok-bg','--cp-t-neutral-bg','--cp-text:'])assert(comp.includes(v),'token '+v);
console.log('PASS: one visual system — components.css (no !important) over @layer legacy; legacy !important count capped at 49.');
