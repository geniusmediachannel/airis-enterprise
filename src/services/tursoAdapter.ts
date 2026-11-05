/**
 * AIRIS Enterprise - Turso Database Adapter (Zero-Dependency HTTP Pipeline)
 * PT. Anugerah Illahi Rabbi
 * 
 * Menggunakan protokol Turso libSQL v2 pipeline native berbasis fetch() browser.
 * Tanpa library eksternal, sangat ringan, kencang, dan bebas limit Egress 5 GB!
 */

import { getTableData, ALL_DATABASE_TABLES, TABLE_PRIMARY_KEYS, notifyDbChange, STORAGE_KEY_PREFIX, memoryTableCache } from './dbAdapter';

export interface TursoConfig {
  url: string;
  authToken: string;
  isConnected: boolean;
  autoSync: boolean;
}

// Konfigurasi Turso Default bawaan
export const DEFAULT_TURSO_URL = 'https://airis-db-geniusmedia.aws-ap-southeast-1.turso.io';
export const DEFAULT_TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTM4Nzg0NzgsImlkIjoiMDFhMWFiN2MtNTEwMS03YTBiLWEzYTktZjA1MGFjOTQzYzI0Iiwia2lkIjoiR2trQVpLR1NWdFlKdE9USmE5bzEzWmJJQjFDM3J3dEpubmpseUNVb01ZayIsInJpZCI6IjBkMGI2MjMwLWUzMDYtNGZkMy1iNjIxLTBkNWQ3MTM2ZDYyOSJ9.I7RV4Y4Wer63QhpuY-DwAU92TqmLAMX01wRZXSruSmDsFKXp4WJp2FplpW8hwo9lUuz65PDmz7AYdDqP0G80CA';

const TURSO_STORAGE_KEY = 'airis_turso_config';

/**
 * Normalisasi URL Turso:
 * Jika user memasukkan format 'libsql://...', ubah otomatis ke 'https://...'
 */
export function normalizeTursoUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim();
  if (cleaned.startsWith('libsql://')) {
    cleaned = 'https://' + cleaned.slice(9);
  }
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Ambil konfigurasi Turso yang tersimpan di browser (fallback ke default resmi)
 */
export function getTursoConfig(): TursoConfig {
  try {
    const raw = localStorage.getItem(TURSO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: normalizeTursoUrl(parsed.url || DEFAULT_TURSO_URL),
        authToken: (parsed.authToken || DEFAULT_TURSO_TOKEN).trim(),
        isConnected: parsed.isConnected !== false,
        autoSync: parsed.autoSync !== false
      };
    }
  } catch (e) {}

  return {
    url: DEFAULT_TURSO_URL,
    authToken: DEFAULT_TURSO_TOKEN,
    isConnected: true,
    autoSync: true
  };
}

/**
 * Simpan konfigurasi Turso ke localStorage
 */
export function saveTursoConfig(cfg: Partial<TursoConfig>): TursoConfig {
  const current = getTursoConfig();
  const updated: TursoConfig = {
    url: normalizeTursoUrl(cfg.url ?? current.url),
    authToken: (cfg.authToken ?? current.authToken).trim(),
    isConnected: cfg.isConnected ?? current.isConnected,
    autoSync: cfg.autoSync ?? current.autoSync
  };

  try {
    localStorage.setItem(TURSO_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {}

  return updated;
}

/**
 * Eksekusi statement SQL mentah ke Turso HTTP Pipeline API
 */
export async function executeTursoQuery(
  sql: string, 
  args: any[] = [], 
  customConfig?: { url: string; authToken: string }
): Promise<{ success: boolean; rows: any[]; affectedRows?: number; error?: string }> {
  const cfg = customConfig || getTursoConfig();
  const url = normalizeTursoUrl(cfg.url);
  const token = cfg.authToken;

  if (!url || !token) {
    return { success: false, rows: [], error: 'URL atau Auth Token Turso belum diisi.' };
  }

  // Format argumen libSQL typed values
  const formattedArgs = args.map(arg => {
    if (arg === null || arg === undefined) return { type: 'null' };
    if (typeof arg === 'number') {
      return Number.isInteger(arg) ? { type: 'integer', value: String(arg) } : { type: 'float', value: arg };
    }
    if (typeof arg === 'boolean') {
      return { type: 'integer', value: arg ? '1' : '0' };
    }
    return { type: 'text', value: String(arg) };
  });

  try {
    const response = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            type: 'execute',
            stmt: {
              sql,
              args: formattedArgs
            }
          },
          { type: 'close' }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, rows: [], error: `HTTP ${response.status}: ${errText}` };
    }

    const json = await response.json();
    const resultObj = json.results?.[0];

    if (resultObj?.type === 'error') {
      return { success: false, rows: [], error: resultObj.error?.message || 'Error eksekusi SQL Turso' };
    }

    const execResult = resultObj?.response?.result;
    if (!execResult) {
      return { success: true, rows: [] };
    }

    const cols = (execResult.cols || []).map((c: any) => c.name);
    const rows = (execResult.rows || []).map((rowArr: any[]) => {
      const obj: Record<string, any> = {};
      rowArr.forEach((cell, idx) => {
        const colName = cols[idx];
        if (cell && typeof cell === 'object' && 'value' in cell) {
          obj[colName] = cell.value;
        } else {
          obj[colName] = cell;
        }
      });
      return obj;
    });

    return { 
      success: true, 
      rows, 
      affectedRows: execResult.affected_row_count 
    };
  } catch (err: any) {
    return { success: false, rows: [], error: err.message || 'Koneksi ke server Turso gagal.' };
  }
}

/**
 * Uji koneksi ke Turso
 */
export async function testTursoConnection(
  rawUrl: string, 
  rawToken: string
): Promise<{ success: boolean; message: string; tablesCount?: number }> {
  const url = normalizeTursoUrl(rawUrl);
  const token = rawToken.trim();

  if (!url) return { success: false, message: 'Silakan masukkan Database URL Turso.' };
  if (!token) return { success: false, message: 'Silakan masukkan Auth Token Turso.' };

  const res = await executeTursoQuery(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%'",
    [],
    { url, authToken: token }
  );

  if (!res.success) {
    return { success: false, message: res.error || 'Gagal terhubung ke Turso. Periksa kembali URL dan Token.' };
  }

  const tables = res.rows.map(r => r.name);
  return {
    success: true,
    message: `Koneksi ke Turso berhasil! Terdeteksi ${tables.length} tabel di database cloud.`,
    tablesCount: tables.length
  };
}

/**
 * Eksekusi Batch Query untuk insert banyak data sekaligus secara cepat
 */
export async function executeTursoBatch(
  statements: { sql: string; args?: any[] }[],
  customConfig?: { url: string; authToken: string }
): Promise<{ success: boolean; error?: string }> {
  const cfg = customConfig || getTursoConfig();
  const url = normalizeTursoUrl(cfg.url);
  const token = cfg.authToken;

  if (!url || !token || statements.length === 0) return { success: true };

  const requests = statements.map(st => ({
    type: 'execute',
    stmt: {
      sql: st.sql,
      args: (st.args || []).map(arg => {
        if (arg === null || arg === undefined) return { type: 'null' };
        if (typeof arg === 'number') {
          return Number.isInteger(arg) ? { type: 'integer', value: String(arg) } : { type: 'float', value: arg };
        }
        if (typeof arg === 'boolean') return { type: 'integer', value: arg ? '1' : '0' };
        return { type: 'text', value: String(arg) };
      })
    }
  }));

  requests.push({ type: 'close' } as any);

  try {
    const response = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });

    if (!response.ok) {
      return { success: false, error: await response.text() };
    }

    const json = await response.json();
    const hasErr = json.results?.find((r: any) => r.type === 'error');
    if (hasErr) {
      return { success: false, error: hasErr.error?.message || 'Error pada salah satu query batch Turso.' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unggah Seluruh Tabel & Data Lokal ke Turso Cloud (Push to Turso)
 */
export async function pushAllTablesToTurso(options?: {
  onProgress?: (msg: string) => void;
  customConfig?: TursoConfig;
}): Promise<{ success: boolean; message: string; tablesCount: number }> {
  const cfg = options?.customConfig || getTursoConfig();
  if (!cfg.url || !cfg.authToken) {
    return { success: false, message: 'URL atau Token Turso belum dikonfigurasi.', tablesCount: 0 };
  }

  let pushedTables = 0;
  let totalRows = 0;

  for (const table of ALL_DATABASE_TABLES) {
    try {
      options?.onProgress?.(`Mengunggah tabel ${table}...`);
      const rows = getTableData<any>(table, []);

      if (rows.length === 0) {
        // Hapus seluruh baris jika tabel lokal kosong
        await executeTursoQuery(`DELETE FROM "${table}"`, [], cfg).catch(() => {});
        continue;
      }

      // Ambil seluruh nama kolom unik dari baris data
      const colSet = new Set<string>();
      rows.forEach(r => {
        Object.keys(r || {}).forEach(k => {
          if (!k.startsWith('_') && k !== 'created_at' && k !== 'updated_at') {
            colSet.add(k);
          }
        });
      });
      const columns = Array.from(colSet);
      if (columns.length === 0) continue;

      const quotedCols = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO "${table}" (${quotedCols}) VALUES (${placeholders})`;

      // Kirim dalam potongan batch 100 baris agar ringan dan cepat
      const BATCH_SIZE = 100;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const stmts = chunk.map(row => ({
          sql,
          args: columns.map(col => {
            const v = row[col];
            return v !== undefined ? v : null;
          })
        }));

        await executeTursoBatch(stmts, cfg);
      }

      pushedTables++;
      totalRows += rows.length;
    } catch (err: any) {
      console.warn(`[TursoPush] Gagal push tabel ${table}:`, err);
    }
  }

  return {
    success: true,
    message: `Berhasil mengunggah ${totalRows.toLocaleString('id-ID')} data (${pushedTables} tabel) ke Turso Cloud!`,
    tablesCount: pushedTables
  };
}

/**
 * Tarik Seluruh Tabel & Data dari Turso Cloud ke Perangkat (Pull from Turso)
 */
export async function pullAllTablesFromTurso(options?: {
  onProgress?: (msg: string) => void;
  customConfig?: TursoConfig;
}): Promise<{ success: boolean; message: string; tablesCount: number }> {
  const cfg = options?.customConfig || getTursoConfig();
  if (!cfg.url || !cfg.authToken) {
    return { success: false, message: 'URL atau Token Turso belum dikonfigurasi.', tablesCount: 0 };
  }

  let pulledTables = 0;
  let totalRows = 0;

  for (const table of ALL_DATABASE_TABLES) {
    try {
      options?.onProgress?.(`Menarik tabel ${table}...`);
      const res = await executeTursoQuery(`SELECT * FROM "${table}"`, [], cfg);

      if (res.success && Array.isArray(res.rows)) {
        memoryTableCache[table] = res.rows;
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(res.rows));
        } catch (e) {}

        pulledTables++;
        totalRows += res.rows.length;
      }
    } catch (err: any) {
      console.warn(`[TursoPull] Gagal pull tabel ${table}:`, err);
    }
  }

  notifyDbChange();

  return {
    success: true,
    message: `Berhasil menarik ${totalRows.toLocaleString('id-ID')} data (${pulledTables} tabel) dari Turso Cloud!`,
    tablesCount: pulledTables
  };
}

/**
 * Sinkronisasi satu tabel ke Turso saat ada perubahan data di aplikasi
 */
export async function syncTableToTurso(tableName: string, data: any[], previousData?: any[]) {
  const cfg = getTursoConfig();
  if (!cfg.isConnected || !cfg.autoSync) return;

  const pk = TABLE_PRIMARY_KEYS[tableName] || 'id';

  try {
    // 1. Kasus A: Tabel dikosongkan
    if (data.length === 0) {
      await executeTursoQuery(`DELETE FROM "${tableName}"`, [], cfg).catch(() => {});
      return;
    }

    // 2. Kasus B: Baris tertentu dihapus
    if (pk && previousData && Array.isArray(previousData) && previousData.length > data.length) {
      const currentKeySet = new Set(data.map(r => String(r[pk] ?? '').trim().toLowerCase()));
      const deletedKeys = previousData
        .map(r => r[pk])
        .filter(k => k !== undefined && k !== null && !currentKeySet.has(String(k).trim().toLowerCase()));

      if (deletedKeys.length > 0) {
        const placeholders = deletedKeys.map(() => '?').join(', ');
        await executeTursoQuery(`DELETE FROM "${tableName}" WHERE "${pk}" IN (${placeholders})`, deletedKeys, cfg).catch(() => {});
      }
    }

    // 3. Kasus C: Upsert baris aktif
    const colSet = new Set<string>();
    data.forEach(r => {
      Object.keys(r || {}).forEach(k => {
        if (!k.startsWith('_') && k !== 'created_at' && k !== 'updated_at') {
          colSet.add(k);
        }
      });
    });
    const columns = Array.from(colSet);
    if (columns.length === 0) return;

    const quotedCols = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`;

    const BATCH_SIZE = 100;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const chunk = data.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map(row => ({
        sql,
        args: columns.map(col => (row[col] !== undefined ? row[col] : null))
      }));
      await executeTursoBatch(stmts, cfg).catch(() => {});
    }
  } catch (err: any) {
    console.warn(`[TursoSync] Sinkronisasi ${tableName} gagal:`, err);
  }
}

/**
 * Hapus satu baris eksplisit dari Turso Cloud
 */
export async function deleteRowFromTurso(tableName: string, id: string | number, pkField?: string) {
  const cfg = getTursoConfig();
  if (!cfg.isConnected) return;
  const pk = pkField || TABLE_PRIMARY_KEYS[tableName] || 'id';
  await executeTursoQuery(`DELETE FROM "${tableName}" WHERE "${pk}" = ?`, [id], cfg).catch(() => {});
}

/**
 * Menghasilkan link tautan transfer instan untuk menghubungkan HP atau perangkat lain ke Turso
 */
export function generateTursoDeviceConnectUrl(cfg?: TursoConfig): string {
  const active = cfg || getTursoConfig();
  if (!active.url || !active.authToken) return '';
  try {
    const payload = JSON.stringify({ url: active.url, authToken: active.authToken });
    const encoded = encodeURIComponent(btoa(payload));
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://airis-enterprise1926.vercel.app/';
    return `${base}#turso_connect=${encoded}`;
  } catch (e) {
    return '';
  }
}
