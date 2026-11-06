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
        if (!cell || cell.type === 'null') {
          obj[colName] = null;
        } else if (cell.type === 'integer' || cell.type === 'float') {
          obj[colName] = Number(cell.value);
        } else if (cell && typeof cell === 'object' && 'value' in cell) {
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

export const TURSO_TABLE_COLUMNS: Record<string, string[]> = {
  MD_Produk: ['ID_Produk', 'Nama_Produk', 'Kategori', 'Satuan', 'Harga_Distributor', 'Harga_Agen', 'Harga_Reseller', 'Harga_Konsumen', 'Status'],
  MD_Pelanggan: ['ID_Pelanggan', 'Nama_Pelanggan', 'No_Telp', 'Alamat', 'Level_Pelanggan', 'Status'],
  MD_Supplier: ['ID_Supplier', 'Nama_Supplier', 'PIC', 'No_Telp', 'Alamat', 'Status'],
  MD_BahanPenolong: ['ID_Bahan', 'Nama_Bahan', 'Kategori', 'Satuan', 'Harga_Satuan', 'Tgl_Update_Harga', 'Minimum_Stock'],
  MD_BOM: ['ID_BOM', 'ID_Produk', 'ID_Bahan', 'Jumlah_Dibutuhkan', 'Satuan', 'Keterangan'],
  MD_Karyawan: ['ID_Karyawan', 'Nama_Karyawan', 'Departemen', 'Jabatan', 'Tgl_Masuk', 'Status', 'Gaji_Pokok', 'Tunjangan'],
  MD_UserAkses: ['ID_User', 'Username', 'Nama', 'Password', 'Role', 'ID_Karyawan', 'Status_Akun'],
  MD_HargaKhusus: ['ID_Harga_Khusus', 'ID_Pelanggan', 'ID_Produk', 'Harga_Custom', 'Keterangan'],
  SPK: ['ID_SPK', 'Tanggal', 'Shift', 'ID_Produk', 'Target_Produksi', 'Keterangan', 'Status'],
  Produksi: ['ID_Produksi', 'Tanggal', 'Shift', 'ID_Produk', 'Jumlah', 'PIC_Produksi', 'Keterangan'],
  Rencana_Distribusi: ['ID_Rencana', 'Tanggal_Rencana', 'ID_Pelanggan', 'Nama_Pelanggan', 'Level_Pelanggan', 'Metode_Kirim', 'Alamat_Tujuan', 'Sopir', 'Status', 'Catatan'],
  Distribusi: ['ID_Distribusi', 'Tanggal', 'ID_Pelanggan', 'Nama_Pelanggan', 'Level_Pelanggan', 'Pengirim', 'Penerima', 'Tujuan', 'Metode_Kirim', 'No_Surat_Jalan', 'No_Invoice', 'Total_Tagihan', 'Keterangan', 'C120', 'C220', 'B330', 'B600', 'G19'],
  Distribusi_Item: ['ID_Detail', 'ID_Distribusi', 'Nama_Pelanggan', 'Tanggal', 'Level_Pelanggan', 'ID_Produk', 'Nama_Produk', 'Qty', 'Harga_Satuan', 'Subtotal'],
  Pembelian_Bahan: ['ID_Pembelian', 'Tanggal', 'ID_Bahan', 'Nama_Bahan', 'Supplier', 'Harga_Satuan', 'Qty', 'Keterangan'],
  Mutasi_Bahan: ['ID_Mutasi', 'Tanggal', 'ID_Bahan', 'Nama_Bahan', 'Tipe', 'Qty', 'Keterangan'],
  Data_QC: ['ID_QC', 'Tanggal', 'Bulan_Tahun', 'Produk', 'Petugas_QC', 'Kesimpulan', 'Status_Data', 'ID_Produksi'],
  Data_QC_Detail: ['ID_Detail', 'ID_QC', 'Siklus', 'Baku_pH', 'Baku_TDS', 'Baku_Kekeruhan', 'Baku_Bau', 'Baku_Coliform', 'Proses_pH', 'Proses_TDS', 'Proses_Kekeruhan', 'Proses_Bau', 'Proses_Rasa', 'Proses_Ozon', 'Jadi_pH', 'Jadi_TDS', 'Jadi_Kekeruhan', 'Jadi_Bau', 'Jadi_Rasa', 'Jadi_Ozon', 'Jadi_ALT_Awal', 'Jadi_ALT_Akhir', 'Jadi_Coliform'],
  Data_Presensi: ['ID_Presensi', 'Tanggal', 'ID_Karyawan', 'Nama_Karyawan', 'Status_Kehadiran', 'Jam_Masuk', 'Jam_Pulang', 'Keterangan'],
  Data_Lembur: ['ID_Lembur', 'Tanggal', 'ID_Karyawan', 'Nama_Karyawan', 'Durasi_Jam', 'Keterangan'],
  Data_Kasbon: ['ID_Kasbon', 'Tanggal', 'ID_Karyawan', 'Nama_Karyawan', 'Nominal', 'Status', 'Keterangan'],
  Histori_Penggajian: ['ID_Histori', 'Periode', 'Tanggal_Bayar', 'ID_Karyawan', 'Nama_Karyawan', 'Gaji_Pokok', 'Tunjangan', 'Lembur', 'Potongan_Kasbon', 'Total_Diterima', 'Status'],
  Master_COA: ['KODE_AKUN', 'NAMA_AKUN', 'KATEGORI', 'SUB_KATEGORI', 'SALDO_NORMAL', 'SALDO_AWAL'],
  Jurnal_Umum: ['ID_Entry', 'ID_Transaksi', 'Tanggal', 'Kode_Akun', 'Nama_Akun', 'Keterangan', 'Debit', 'Kredit'],
  Draf_Jurnal: ['ID_Draf', 'Tanggal', 'Kategori', 'Keterangan', 'Nominal', 'Akun_Debit', 'Akun_Kredit', 'Status'],
  Data_Piutang_Utang: ['ID_DOKUMEN', 'TIPE', 'TANGGAL', 'JATUH_TEMPO', 'ENTITAS', 'DESKRIPSI', 'TOTAL_TAGIHAN', 'SISA_TAGIHAN', 'STATUS', 'KETERANGAN'],
  Data_Aset_Tetap: ['ID_ASET', 'NAMA_ASET', 'KATEGORI', 'TGL_PEROLEHAN', 'HARGA_PEROLEHAN', 'NILAI_SISA', 'MASA_MANFAAT', 'METODE_PENYUSUTAN'],
  Data_Surat: ['ID_Surat', 'Nomor_Surat', 'Tipe_Surat', 'Tanggal', 'Perihal', 'Lampiran', 'Kepada', 'Alamat_Tujuan', 'Isi_Surat', 'Penandatangan_Nama'],
  Admin_PO: ['ID_PO', 'No_PO', 'Tanggal', 'ID_Supplier', 'Nama_Supplier', 'Perihal', 'Total_Nilai', 'Status'],
  Admin_PO_Detail: ['ID_Detail', 'ID_PO', 'Nama_Barang', 'Spesifikasi', 'Qty', 'Satuan', 'Harga_Satuan', 'Subtotal'],
  Data_Custom_Invoice: ['ID_Invoice', 'Nomor_Invoice', 'Tanggal', 'ID_Pelanggan', 'Nama_Pelanggan', 'Total_Tagihan', 'Status'],
  Data_Pembayaran_Pelanggan: ['ID_Pembayaran', 'Tanggal', 'ID_Pelanggan', 'Nama_Pelanggan', 'Nominal', 'Metode', 'Catatan']
};

/**
 * Filter kolom secara ketat sesuai skema resmi Turso SQLite
 * Mencegah SQLite error: "table ... has no column named ..." akibat properti runtime/UI
 */
export function getSanitizedColumns(tableName: string, rows: any[]): string[] {
  const allowed = TURSO_TABLE_COLUMNS[tableName];
  if (allowed && allowed.length > 0) {
    const allowedSet = new Set(allowed);
    const colSet = new Set<string>();
    rows.forEach(r => {
      if (!r || typeof r !== 'object') return;
      Object.keys(r).forEach(k => {
        if (allowedSet.has(k)) {
          colSet.add(k);
        }
      });
    });
    const pk = TABLE_PRIMARY_KEYS[tableName];
    if (pk && allowedSet.has(pk)) {
      colSet.add(pk);
    }
    return Array.from(colSet);
  }

  // Fallback umum jika nama tabel dinamis
  const colSet = new Set<string>();
  rows.forEach(r => {
    if (!r || typeof r !== 'object') return;
    Object.keys(r).forEach(k => {
      if (!k.startsWith('_') && k !== 'created_at' && k !== 'updated_at' && k !== 'Items' && k !== 'items') {
        colSet.add(k);
      }
    });
  });
  return Array.from(colSet);
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
        if (typeof arg === 'object') return { type: 'text', value: JSON.stringify(arg) };
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

      // Ambil kolom yang benar-benar ada di skema Turso
      const columns = getSanitizedColumns(table, rows);
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

        const bRes = await executeTursoBatch(stmts, cfg);
        if (!bRes.success) {
          console.warn(`[TursoPush] Batch error pada tabel ${table}:`, bRes.error);
        }
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
  silent?: boolean;
}): Promise<{ success: boolean; message: string; tablesCount: number }> {
  const cfg = options?.customConfig || getTursoConfig();
  if (!cfg.url || !cfg.authToken) {
    return { success: false, message: 'URL atau Token Turso belum dikonfigurasi.', tablesCount: 0 };
  }

  // Bersihkan tombstone usang agar data riil yang ada di Turso tidak terblokir di browser
  try {
    localStorage.removeItem('airis_deleted_distribution_ids');
  } catch (e) {}

  let pulledTables = 0;
  let totalRows = 0;

  for (const table of ALL_DATABASE_TABLES) {
    try {
      options?.onProgress?.(`Menarik tabel ${table}...`);
      const res = await executeTursoQuery(`SELECT * FROM "${table}"`, [], cfg);

      if (res.success && Array.isArray(res.rows)) {
        let cleanedRows = res.rows;
        if (table === 'Distribusi') {
          cleanedRows = res.rows.map((r: any) => ({
            ...r,
            C120: Number(r.C120) || 0,
            C220: Number(r.C220) || 0,
            B330: Number(r.B330) || 0,
            B600: Number(r.B600) || 0,
            G19: Number(r.G19) || 0,
            Galon: Number(r.G19) || 0,
            Total_Tagihan: Number(r.Total_Tagihan) || 0
          }));
        }

        memoryTableCache[table] = cleanedRows;
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(cleanedRows));
        } catch (e) {}

        pulledTables++;
        totalRows += cleanedRows.length;
      }
    } catch (err: any) {
      console.warn(`[TursoPull] Gagal pull tabel ${table}:`, err);
    }
  }

  notifyDbChange();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('airis_cloud_synced'));
  }

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
    const columns = getSanitizedColumns(tableName, data);
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

/**
 * Kosongkan seluruh tabel di Turso Cloud Database secara permanen (Reset Database Turso)
 */
export async function clearAllTursoDatabase(keepUserAccounts: boolean = true): Promise<{ success: boolean; clearedCount: number; error?: string }> {
  const cfg = getTursoConfig();
  if (!cfg.url || !cfg.authToken) {
    return { success: false, clearedCount: 0, error: 'Turso belum dikonfigurasi.' };
  }

  // Susun urutan tabel: Child/Detail -> Transaksi -> Master -> Akun
  const tablesToClear = [
    // 1. Child tables
    'Distribusi_Item', 'Data_QC_Detail', 'Admin_PO_Detail', 'Mutasi_Bahan',
    'Data_Presensi', 'Data_Lembur', 'Data_Kasbon', 'Histori_Penggajian',
    'MD_BOM', 'MD_HargaKhusus', 'Data_Pembayaran_Pelanggan',
    'Draf_Jurnal', 'Jurnal_Umum', 'Data_Piutang_Utang',
    // 2. Transaksi & Dokumen
    'Rencana_Distribusi', 'Distribusi', 'Produksi', 'SPK', 'Pembelian_Bahan',
    'Data_QC', 'Admin_PO', 'Data_Surat', 'Data_Custom_Invoice', 'Data_Aset_Tetap',
    // 3. Master Data
    'MD_Produk', 'MD_Pelanggan', 'MD_Supplier', 'MD_BahanPenolong',
    'MD_Karyawan', 'Master_COA'
  ];

  if (!keepUserAccounts) {
    tablesToClear.push('MD_UserAkses');
  }

  // Buat batch SQL DELETE untuk seluruh tabel
  const stmts = tablesToClear.map(table => ({
    sql: `DELETE FROM "${table}"`,
    args: []
  }));

  const res = await executeTursoBatch(stmts, cfg);
  if (!res.success) {
    console.warn('[TursoReset] Batch DELETE gagal, mencoba eksekusi satu per satu:', res.error);
    // Fallback: Eksekusi satu per satu
    let count = 0;
    for (const table of tablesToClear) {
      const qRes = await executeTursoQuery(`DELETE FROM "${table}"`, [], cfg).catch(() => ({ success: false }));
      if (qRes.success) count++;
    }
    return { success: count > 0, clearedCount: count };
  }

  return { success: true, clearedCount: tablesToClear.length };
}
