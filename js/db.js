// db.js — Camada de persistência (IndexedDB)
// Entidades: categories, people, cards, transactions, purchases, installments, reimbursements, meta

const DB_NAME = 'planejador_financeiro_db';
const DB_VERSION = 1;

const STORES = {
  categories: 'id',
  people: 'id',
  cards: 'id',
  transactions: 'id',
  purchases: 'id',
  installments: 'id',
  reimbursements: 'id',
  meta: 'key',
};

let _dbPromise = null;

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (evt) => {
      const db = evt.target.result;

      if (!db.objectStoreNames.contains('categories')) {
        const s = db.createObjectStore('categories', { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('people')) {
        const s = db.createObjectStore('people', { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const s = db.createObjectStore('transactions', { keyPath: 'id' });
        s.createIndex('monthRef', 'monthRef', { unique: false });
        s.createIndex('type', 'type', { unique: false });
        s.createIndex('category', 'category', { unique: false });
        s.createIndex('seriesId', 'seriesId', { unique: false });
      }
      if (!db.objectStoreNames.contains('purchases')) {
        const s = db.createObjectStore('purchases', { keyPath: 'id' });
        s.createIndex('cardId', 'cardId', { unique: false });
        s.createIndex('paymentType', 'paymentType', { unique: false });
      }
      if (!db.objectStoreNames.contains('installments')) {
        const s = db.createObjectStore('installments', { keyPath: 'id' });
        s.createIndex('purchaseId', 'purchaseId', { unique: false });
        s.createIndex('cardId', 'cardId', { unique: false });
        s.createIndex('invoiceMonth', 'invoiceMonth', { unique: false });
      }
      if (!db.objectStoreNames.contains('reimbursements')) {
        const s = db.createObjectStore('reimbursements', { keyPath: 'id' });
        s.createIndex('personId', 'personId', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    Promise.resolve(fn(store))
      .then((r) => { result = r; })
      .catch(reject);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  uid,

  async add(storeName, obj) {
    const now = new Date().toISOString();
    if (!obj.id) obj.id = uid();
    if (!obj.createdAt) obj.createdAt = now;
    obj.updatedAt = now;
    await tx(storeName, 'readwrite', (store) => reqToPromise(store.put(obj)));
    return obj;
  },

  async put(storeName, obj) {
    obj.updatedAt = new Date().toISOString();
    await tx(storeName, 'readwrite', (store) => reqToPromise(store.put(obj)));
    return obj;
  },

  async putMany(storeName, arr) {
    await tx(storeName, 'readwrite', async (store) => {
      for (const obj of arr) {
        if (!obj.id) obj.id = uid();
        await reqToPromise(store.put(obj));
      }
    });
    return arr;
  },

  async get(storeName, id) {
    return tx(storeName, 'readonly', (store) => reqToPromise(store.get(id)));
  },

  async getAll(storeName) {
    return tx(storeName, 'readonly', (store) => reqToPromise(store.getAll()));
  },

  async getByIndex(storeName, indexName, value) {
    return tx(storeName, 'readonly', (store) =>
      reqToPromise(store.index(indexName).getAll(value))
    );
  },

  async delete(storeName, id) {
    return tx(storeName, 'readwrite', (store) => reqToPromise(store.delete(id)));
  },

  async deleteMany(storeName, ids) {
    await tx(storeName, 'readwrite', async (store) => {
      for (const id of ids) await reqToPromise(store.delete(id));
    });
  },

  async clear(storeName) {
    return tx(storeName, 'readwrite', (store) => reqToPromise(store.clear()));
  },

  async clearAll() {
    for (const s of Object.keys(STORES)) await this.clear(s);
  },

  async getMeta(key, defaultValue = null) {
    const row = await this.get('meta', key);
    return row ? row.value : defaultValue;
  },

  async setMeta(key, value) {
    return this.put('meta', { key, value });
  },

  STORES,
};

window.DB = DB;
