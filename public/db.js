// Piccolo wrapper su IndexedDB: tutto viene salvato prima sul telefono.
const DB_NAME = 'tartufi';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('finds')) db.createObjectStore('finds', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(storeName, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const db = {
  all: () => run('finds', 'readonly', s => s.getAll()),
  get: id => run('finds', 'readonly', s => s.get(id)),
  put: rec => run('finds', 'readwrite', s => s.put(rec)),
  putMany: list => run('finds', 'readwrite', s => { list.forEach(r => s.put(r)); }),
  deleteMany: ids => run('finds', 'readwrite', s => { ids.forEach(id => s.delete(id)); }),
  getMeta: key => run('meta', 'readonly', s => s.get(key)),
  setMeta: (key, value) => run('meta', 'readwrite', s => s.put(value, key)),
};
