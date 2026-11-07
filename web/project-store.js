/* Local project persistence. Transactional revision checks prevent silent tab overwrites. */
(function (root) {
  'use strict';
  let opening;
  function db() {
    if (!opening) opening = new Promise((resolve, reject) => {
      const r = indexedDB.open('cornerpin-projects', 1);
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
  async function save(project, expectedRevision, file) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(['projects', 'files'], 'readwrite'), s = t.objectStore('projects'); let conflict;
      const r = s.get(project.id);
      r.onsuccess = () => {
        if ((r.result ? r.result.revision : null) !== expectedRevision) { conflict = new Error('This project changed in another tab. Reopen it before saving.'); t.abort(); return; }
        s.put(project); if (file) t.objectStore('files').put(file.blob, file.id);
      };
      t.oncomplete = () => resolve(project);
      t.onabort = t.onerror = () => reject(conflict || t.error || new Error('Project could not be saved. Browser storage may be full.'));
    });
  }
  root.ProjectStore = { list: () => read('projects'), get: id => read('projects', id), file: id => read('files', id), save };
})(window);
