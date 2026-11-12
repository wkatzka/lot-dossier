/* Local project persistence. Transactional revision checks prevent silent tab overwrites. */
(function (root) {
  'use strict';
  let opening, owner = null;
  function setOwner(id) { if(id===owner)return; if(opening)opening.then(d=>d.close()); opening=null; owner=id||null; }
  function db() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const r = indexedDB.open(owner ? 'cornerpin-projects-'+owner : 'cornerpin-projects', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('projects', { keyPath: 'id' }); r.result.createObjectStore('files'); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { opening = null; reject(r.error); };
      r.onblocked = () => reject(new Error('Close other Cornerpin tabs to open project storage.'));
    });
    return opening;
  }
  async function read(store, key) {
    const d = await db();
    return new Promise((resolve, reject) => { const r = d.transaction(store).objectStore(store)[key === undefined ? 'getAll' : 'get'](key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  }
  function notify(project,account){if(root.dispatchEvent)root.dispatchEvent(new CustomEvent('cornerpin:project-saved',{detail:{id:project.id,owner:account}}));}
  async function save(project, expectedRevision, file) {
    const account=owner,d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(['projects', 'files'], 'readwrite'), s = t.objectStore('projects'); let conflict;
      const r = s.get(project.id);
      r.onsuccess = () => {
        if ((r.result ? r.result.revision : null) !== expectedRevision) { conflict = new Error('This project changed in another tab. Reopen it before saving.'); t.abort(); return; }
        s.put(project); if (file) t.objectStore('files').put(file.blob, file.id);
      };
      t.oncomplete = () => {resolve(project);notify(project,account);};
      t.onabort = t.onerror = () => reject(conflict || t.error || new Error('Project could not be saved. Browser storage may be full.'));
    });
  }
  async function checklistRecords(county,parcelId) {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(owner?'lot-dossier-'+owner:'lot-dossier',1);
      request.onerror=()=>reject(request.error);request.onsuccess=()=>{const d=request.result;if(!d.objectStoreNames.contains('items')){d.close();resolve([]);return;}
        const rows=[],prefix=county+'|'+parcelId+'|',t=d.transaction('items'),r=t.objectStore('items').openCursor();
        r.onsuccess=()=>{const c=r.result;if(!c)return;if(String(c.key).startsWith(prefix))rows.push({key:String(c.key),status:c.value.status,files:c.value.files||[]});c.continue();};t.oncomplete=()=>{d.close();resolve(rows);};t.onerror=()=>reject(t.error);
      };
    });
  }
  async function checklistFiles(county,parcelId) {return (await checklistRecords(county,parcelId)).flatMap(r=>r.files.filter(f=>f.blob).map(f=>({...f,checklistKey:r.key})));}
  async function restore(project, files, options={}) {
    const account=owner,d=await db();return new Promise((resolve,reject)=>{
      const t=d.transaction(['projects','files'],'readwrite'),ps=t.objectStore('projects');let error;
      const r=ps.get(project.id);r.onsuccess=()=>{if(r.result && (options.expectedRevision===undefined||r.result.revision!==options.expectedRevision)){error=new Error('This project has local changes. Reopen it before restoring.');t.abort();return;}ps.put(project);for(const file of files)t.objectStore('files').put(file.blob,file.id);};
      t.oncomplete=()=>{resolve(project);if(!options.cloudRestore)notify(project,account);};t.onabort=t.onerror=()=>reject(error||t.error||Error('Restore failed'));
    });
  }
  root.ProjectStore = { setOwner, owner:()=>owner, list: () => read('projects'), get: id => read('projects', id), file: id => read('files', id), save, restore, checklistFiles, checklistRecords };
})(window);
