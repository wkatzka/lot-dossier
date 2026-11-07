const assert=require('node:assert/strict'),S=require('../lib/surveys');
const row=(n,title,url)=>'<tr>'+[url?`<a href="${url}">${n}</a>`:n,2,'11/1/2026',title,'Client','7N','1E',26,'W','Survey company','Surveyor','X'].map(v=>'<td>'+v+'</td>').join('')+'</tr>';
const html='<th>Record Number</th><th>Date Placed on File</th>'+row(1,'Example Ranch Phase 1','https://webercountyutah.gov/mounts/surveyorimages/example.pdf')+row(2,'Example Ranch Townhomes',null)+row(3,'Example Person','https://evil.example/file.pdf');
const parsed=S.parse(html);assert.equal(parsed.length,3);assert.equal(parsed[2].url,null);
const matched=S.search(parsed,'Example Ranch Phase 1');assert.equal(matched.totalMatches,2);assert.equal(matched.candidates[1].url,null);assert.match(matched.matchBasis,/not been verified/);
assert.equal(S.search(parsed,'Unrelated Place').totalMatches,0);assert.throws(()=>S.parse('Access denied'),/schema/);
assert.equal(S.search(Array.from({length:25},(_,i)=>({name:'Example Ranch',recordNumber:i})),'Example Ranch').truncated,true);
console.log('Survey discovery passed: whole-name matching, wrong-property exclusion, absent PDFs, host allowlist, schema failure and truncation.');
if(process.argv.includes('--live'))S.find(process.argv[3]||'Example Ranch').then(r=>console.log(JSON.stringify({retrievedAt:r.retrievedAt,indexRecords:r.indexRecordCount,matches:r.totalMatches,candidates:r.candidates.map(x=>({record:x.recordNumber,url:x.url}))}))).catch(e=>{console.error(e);process.exitCode=1;});
