/**
 * AIRIS Enterprise - Native IndexedDB Storage Engine
 * PT. Anugerah Illahi Rabbi
 * 
 * High-capacity, asynchronous persistent client storage.
 * Eliminates the browser 5MB localStorage quota bottleneck with 250MB+ structured storage.
 */

const DB_NAME = 'AIRIS_ENTERPRISE_IDB';
const DB_VERSION = 1;
const STORE_NAME = 'tables';

let idbInstancePromise: Promise<IDBDatabase> | null = null;

/**
 * Membuka koneksi singleton ke IndexedDB
 */
export function getIDBDatabase(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB tidak didukung pada browser ini'));
  }

  if (!idbInstancePromise) {
    idbInstancePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Gagal membuka database:', request.error);
        idbInstancePromise = null;
        reject(request.error);
      };
    });
  }

  return idbInstancePromise;
}

/**
 * Mengambil data tabel atau item dari IndexedDB
 */
export async function idbGet<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? (req.result as T) : null);
      };

      req.onerror = () => {
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error membaca key "${key}":`, err);
    return null;
  }
}

/**
 * Menyimpan data tabel atau item ke IndexedDB
 */
export async function idbSet<T = any>(key: string, value: T): Promise<void> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => {
        resolve();
      };

      req.onerror = () => {
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error menyimpan key "${key}":`, err);
  }
}

/**
 * Menghapus data spesifik dari IndexedDB
 */
export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Error menghapus key "${key}":`, err);
  }
}

/**
 * Mengambil seluruh data dari IndexedDB (untuk pemuatan awal kilat)
 */
export async function idbGetAll(): Promise<Record<string, any[]>> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const result: Record<string, any[]> = {};

      if ('getAllKeys' in store && 'getAll' in store) {
        const keysReq = store.getAllKeys();
        const valsReq = store.getAll();

        tx.oncomplete = () => {
          const keys = keysReq.result || [];
          const vals = valsReq.result || [];
          for (let i = 0; i < keys.length; i++) {
            result[String(keys[i])] = vals[i];
          }
          resolve(result);
        };
        tx.onerror = () => reject(tx.error);
      } else {
        const req = store.openCursor();
        req.onsuccess = (event: any) => {
          const cursor: IDBCursorWithValue = event.target.result;
          if (cursor) {
            result[String(cursor.key)] = cursor.value;
            cursor.continue();
          } else {
            resolve(result);
          }
        };
        req.onerror = () => reject(req.error);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] Error membaca seluruh database:', err);
    return {};
  }
}

/**
 * Mengosongkan seluruh isi tabel di IndexedDB
 */
export async function idbClear(): Promise<void> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Error membersihkan database:', err);
  }
}
