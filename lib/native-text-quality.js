/* Flag a corrupt existing OCR layer for image reading, never infer missing text. */
function suspect(text){
 const s=String(text||''),letters=(s.match(/[A-Za-z]/g)||[]).length;
 const corrupt=(s.replace(/\$\s*\d[\d,.]*/g,'').match(/[*{}$@^~|\\]/g)||[]).length;
 return s.includes('\ufffd')||(letters>=150&&corrupt>=8&&corrupt/letters>0.015);
}
function refresh(checkpoint){
 let flagged=0;
 for(const doc of checkpoint.state.documents){const reading=checkpoint.pageTexts?.[doc.sha256];if(!reading||checkpoint.interpreted?.[doc.sha256])continue;
  for(const page of reading.pages){if(page.method==='full_page_ocr'||!suspect(page.text))continue;
   page.needsOCR=true;page.qualityReason='Existing text layer contains excessive corrupt symbols; read the page image before interpreting it.';doc.unreadPages||=[];if(!doc.unreadPages.includes(page.page)){doc.unreadPages.push(page.page);flagged++;}
  }
 }
 return flagged;
}
module.exports={suspect,refresh};
