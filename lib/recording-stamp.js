/* Recorder-stamp receipts. A recording identifier is retained only from the original's own
   stamp text; a recording date only from a strict DD-MMM-YY stamp date that a targeted
   re-read places on the same stamp as that identifier. Execution dates, notary dates and
   filename years are never treated as recording dates. Nothing is inferred when unreadable. */
const MONTHS={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
const STAMP=/\bE\s*[#f]\s*(\d{6,8})\s+PG\s*(\d{1,3})\s*(?:OF|0F)\s*(\d{1,3})\b/i;
function strictDate(text){
 const m=/\b(\d{2})-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-(\d{2})\b/i.exec(text||'');if(!m)return null;
 const day=Number(m[1]),month=MONTHS[m[2].toUpperCase()],yy=Number(m[3]),year=yy+(yy>=70?1900:2000);
 const d=new Date(Date.UTC(year,month-1,day));if(d.getUTCDate()!==day||d.getUTCMonth()!==month-1)return null;
 return {iso:d.toISOString().slice(0,10),quote:m[0]};
}
// Stamp evidence already present in the stored reading (exact stored text).
function detect(pages){
 for(const p of (pages||[]).slice(0,3)){
  const text=String(p.text||''),m=STAMP.exec(text);if(!m)continue;
  const near=text.slice(Math.max(0,m.index-40),m.index+m[0].length+260);
  if(!/RECORDER|ELECTRONICALLY\s+RECORDED|\bREC\s+FOR\b/i.test(near))continue;
  const date=strictDate(near);
  return {entry:m[1],page:p.page,quote:m[0],recorderQuote:(near.match(/[A-Z .]{3,40}(?:WEBER\s+(?:CTY\.?|COUNTY)\s+RECORDER)/i)||[])[0]?.trim()||null,electronicallyRecorded:/ELECTRONICALLY\s+RECORDED/i.test(near),
   recordedOn:date?.iso||null,dateQuote:date?.quote||null,dateMethod:date?'stored_reading':null};
 }
 return null;
}
// Accept a re-read date only if the same re-read stamp carries the stored entry number.
function confirm(stamp,rereadText,confidence){
 if(!stamp||stamp.recordedOn)return stamp;
 const text=String(rereadText||''),m=STAMP.exec(text);
 if(!m||m[1]!==stamp.entry)return {...stamp,dateStatus:'stamp_date_unreadable'};
 const date=strictDate(text.slice(m.index,m.index+m[0].length+220));
 if(!date)return {...stamp,dateStatus:'stamp_date_unreadable'};
 return {...stamp,recordedOn:date.iso,dateQuote:date.quote,dateMethod:'stamp_region_ocr',dateConfidence:confidence??null,dateStatus:'read_from_stamp'};
}
function reread(bytes,page){return new Promise((resolve,reject)=>{
 const {Worker}=require('node:worker_threads');
 const w=new Worker(require.resolve('./recording-stamp-worker'),{workerData:{bytes,page},resourceLimits:{maxOldGenerationSizeMb:256}});let done=false;
 const finish=(e,d)=>{if(done)return;done=true;clearTimeout(t);w.terminate().finally(()=>e?reject(e):resolve(d));};
 const t=setTimeout(()=>finish(Error('Stamp re-read exceeded 60 seconds')),60000);
 w.once('message',d=>finish(d.error?Error(d.error):null,d));w.once('error',finish);
});}
// Fetch the same original by its retrieved URL; bytes must hash to the interpreted original.
async function resolveDate(stamp,{sha256,urls},{fetchBytes,read=reread}={}){
 if(!stamp||stamp.recordedOn||!urls?.length||!fetchBytes)return stamp;
 for(const url of urls){
  try{const bytes=await fetchBytes(url);if(require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==sha256)continue;
   const r=await read(bytes,stamp.page);return confirm(stamp,r.text,r.confidence);}catch{}
 }
 return {...stamp,dateStatus:'stamp_date_unreadable'};
}
module.exports={detect,confirm,strictDate,resolveDate,reread,STAMP};
