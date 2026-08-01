// ── Offline store: IndexedDB cache + pending write queue ──────
// Keeps the shop billing when the internet drops.

const DB_NAME    = '7sq_offline';
const DB_VERSION = 1;
const STORES = { cache:'cache', queue:'queue' };

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.cache)) {
        db.createObjectStore(STORES.cache, { keyPath:'key' });
      }
      if (!db.objectStoreNames.contains(STORES.queue)) {
        const q = db.createObjectStore(STORES.queue, { keyPath:'id', autoIncrement:true });
        q.createIndex('status', 'status');
        q.createIndex('created', 'created');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode='readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

// ── Cache: products, customers etc. for offline billing ───────
export async function cacheSet(key, value) {
  try {
    const s = await tx(STORES.cache, 'readwrite');
    return new Promise((res, rej) => {
      const r = s.put({ key, value, at: Date.now() });
      r.onsuccess = () => res(true); r.onerror = () => rej(r.error);
    });
  } catch { return false; }
}

export async function cacheGet(key, maxAgeMs = 7*24*3600*1000) {
  try {
    const s = await tx(STORES.cache);
    return new Promise(res => {
      const r = s.get(key);
      r.onsuccess = () => {
        const row = r.result;
        if (!row) return res(null);
        if (maxAgeMs && Date.now() - row.at > maxAgeMs) return res(null);
        res(row.value);
      };
      r.onerror = () => res(null);
    });
  } catch { return null; }
}

export async function cacheAge(key) {
  try {
    const s = await tx(STORES.cache);
    return new Promise(res => {
      const r = s.get(key);
      r.onsuccess = () => res(r.result?.at || null);
      r.onerror   = () => res(null);
    });
  } catch { return null; }
}

// ── Queue: writes made while offline ─────────────────────────
export async function queueAdd(table, payload, meta = {}) {
  const s = await tx(STORES.queue, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.add({
      table, payload, meta,
      status: 'pending',
      created: Date.now(),
      attempts: 0,
      localRef: meta.localRef || `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}

export async function queueAll(status = null) {
  try {
    const s = await tx(STORES.queue);
    return new Promise(res => {
      const r = s.getAll();
      r.onsuccess = () => res(status ? (r.result||[]).filter(x=>x.status===status) : (r.result||[]));
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

export async function queueCount(status = 'pending') {
  const all = await queueAll(status);
  return all.length;
}

export async function queueUpdate(id, patch) {
  const s = await tx(STORES.queue, 'readwrite');
  return new Promise((res, rej) => {
    const g = s.get(id);
    g.onsuccess = () => {
      const row = g.result; if (!row) return res(false);
      const p = s.put({ ...row, ...patch });
      p.onsuccess = () => res(true); p.onerror = () => rej(p.error);
    };
    g.onerror = () => rej(g.error);
  });
}

export async function queueRemove(id) {
  const s = await tx(STORES.queue, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.delete(id);
    r.onsuccess = () => res(true); r.onerror = () => rej(r.error);
  });
}

export async function queueClearSynced() {
  const rows = await queueAll('synced');
  for (const r of rows) await queueRemove(r.id);
  return rows.length;
}

/**
 * Flush pending writes to Supabase.
 * Returns { synced, failed, errors }
 */
export async function flushQueue(supabase) {
  const pending = await queueAll('pending');
  let synced = 0, failed = 0;
  const errors = [];

  for (const row of pending) {
    try {
      const { error } = await supabase.from(row.table).insert(row.payload);
      if (error) throw error;
      await queueUpdate(row.id, { status:'synced', syncedAt: Date.now() });
      synced++;
    } catch (e) {
      const attempts = (row.attempts||0) + 1;
      await queueUpdate(row.id, {
        status: attempts >= 5 ? 'failed' : 'pending',
        attempts,
        lastError: e.message || String(e),
      });
      if (attempts >= 5) { failed++; errors.push(`${row.table}: ${e.message}`); }
    }
  }
  await queueClearSynced();
  return { synced, failed, errors };
}

export async function clearAll() {
  const db = await openDB();
  return new Promise(res => {
    const t = db.transaction([STORES.cache, STORES.queue], 'readwrite');
    t.objectStore(STORES.cache).clear();
    t.objectStore(STORES.queue).clear();
    t.oncomplete = () => res(true);
    t.onerror    = () => res(false);
  });
}

export const OFFLINE_KEYS = {
  inventory: 'inventory',
  customers: 'customers',
  tenant:    'tenant',
};
