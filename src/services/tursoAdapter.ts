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
    if (typeof arg === 'object') {
      return { type: 'text', value: JSON.stringify(arg) };
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
  MD_UserAkses: ['ID_User', 'Username', 'Nama', 'Password', 'Role', 'ID_Karyawan', 'Status_Akun', 'Email'],
  MD_HargaKhusus: ['ID_Harga_Khusus', 'ID_Pelanggan', 'ID_Produk', 'Harga_Custom', 'Tanggal_Mulai', 'Tanggal_Selesai', 'Keterangan'],
  Histori_Perubahan_Harga: ['ID_Histori', 'Tanggal_Berlaku', 'Tipe_Item', 'ID_Item', 'Nama_Item', 'Keterangan', 'Dibuat_Oleh', 'Waktu_Input', 'Detail_Harga'],
  SPK: ['ID_SPK', 'Tanggal', 'Shift', 'ID_Produk', 'Target_Produksi', 'Keterangan', 'Status'],
  Produksi: ['ID_Produksi', 'Tanggal', 'Shift', 'ID_Produk', 'Jumlah', 'PIC_Produksi', 'Keterangan'],
  Rencana_Distribusi: ['ID_Rencana', 'Tanggal_Rencana', 'ID_Pelanggan', 'Nama_Pelanggan', 'Level_Pelanggan', 'Metode_Kirim', 'Alamat_Tujuan', 'Sopir', 'Status', 'Catatan'],
  Distribusi: ['ID_Distribusi', 'Tanggal', 'ID_Pelanggan', 'Nama_Pelanggan', 'Level_Pelanggan', 'Pengirim', 'Penerima', 'Tujuan', 'Metode_Kirim', 'No_Surat_Jalan', 'No_Invoice', 'Total_Tagihan', 'Keterangan', 'C120', 'C220', 'B330', 'B600', 'G19'],
  Distribusi_Item: ['ID_Detail', 'ID_Distribusi', 'Nama_Pelanggan', 'Tanggal', 'Level_Pelanggan', 'ID_Produk', 'Nama_Produk', 'Qty', 'Harga_Satuan', 'Subtotal'],
  Pembelian_Bahan: ['ID_Pembelian', 'Tanggal', 'ID_Bahan', 'Nama_Bahan', 'Supplier', 'Harga_Satuan', 'Qty', 'Keterangan'],
  Mutasi_Bahan: ['ID_Mutasi', 'Tanggal', 'ID_Bahan', 'Nama_Bahan', 'Jenis_Mutasi', 'Kategori', 'Tipe', 'Qty', 'Keterangan'],
  Data_QC: ['ID_QC', 'Tanggal', 'Bulan_Tahun', 'Produk', 'Petugas_QC', 'Kesimpulan', 'Status_Data', 'ID_Produksi'],
  Data_QC_Detail: ['ID_Detail', 'ID_QC', 'Siklus', 'Baku_pH', 'Baku_TDS', 'Baku_Kekeruhan', 'Baku_Bau', 'Baku_Coliform', 'Proses_pH', 'Proses_TDS', 'Proses_Kekeruhan', 'Proses_Bau', 'Proses_Rasa', 'Proses_Ozon', 'Jadi_pH', 'Jadi_TDS', 'Jadi_Kekeruhan', 'Jadi_Bau', 'Jadi_Rasa', 'Jadi_Ozon', 'Jadi_ALT_Awal', 'Jadi_ALT_Akhir', 'Jadi_Coliform'],
  Data_Presensi: ['ID_Presensi', 'Bulan_Tahun', 'ID_Karyawan', 'Nama_Karyawan', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'Total_H', 'Total_T', 'Total_I', 'Total_S', 'Total_C', 'Total_A', 'Tanggal', 'Status_Kehadiran', 'Jam_Masuk', 'Jam_Pulang', 'Keterangan'],
  Data_Lembur: ['ID_Lembur', 'Bulan_Tahun', 'ID_Karyawan', 'Nama_Karyawan', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'Total_Jam_Lembur', 'Tanggal', 'Durasi_Jam', 'Keterangan'],
  Data_Kasbon: ['ID_Kasbon', 'Tanggal', 'ID_Karyawan', 'Nama_Karyawan', 'Nominal', 'Tenor', 'Cicilan_Per_Bulan', 'Status', 'Keterangan'],
  Histori_Penggajian: ['ID_Histori', 'ID_Gaji', 'Bulan_Tahun', 'Periode', 'Tanggal_Bayar', 'ID_Karyawan', 'Nama_Karyawan', 'Departemen', 'Jabatan', 'Gaji_Pokok', 'Tunjangan', 'Total_Lembur_Nominal', 'Potongan_Kasbon', 'Potongan_Alpha', 'Gaji_Bersih', 'Total_Diterima', 'Tanggal_Cetak', 'Status_Bayar', 'Status'],
  Master_COA: ['KODE_AKUN', 'NAMA_AKUN', 'KATEGORI', 'SUB_KATEGORI', 'SALDO_NORMAL', 'SALDO_AWAL', 'STATUS'],
  Jurnal_Umum: ['ID_Entry', 'ID_JURNAL', 'TANGGAL', 'PERIODE', 'REFERENSI', 'KETERANGAN', 'KODE_AKUN', 'DEBIT', 'KREDIT', 'PEMBUAT', 'ID_Transaksi', 'Tanggal', 'Kode_Akun', 'Nama_Akun', 'Keterangan', 'Debit', 'Kredit'],
  Draf_Jurnal: ['ID_Draf', 'Sumber', 'Tanggal', 'Referensi', 'Keterangan', 'Kode_Debit', 'Kode_Kredit', 'Nominal', 'Status', 'Waktu_Dibuat', 'Kategori', 'Akun_Debit', 'Akun_Kredit'],
  Data_Piutang_Utang: ['ID_DOKUMEN', 'ID_Transaksi', 'TIPE', 'Jenis', 'TANGGAL', 'Tanggal', 'JATUH_TEMPO', 'Tgl_Jatuh_Tempo', 'NAMA_ENTITAS', 'Entitas', 'TOTAL_TAGIHAN', 'Nominal', 'TOTAL_DIBAYAR', 'Terbayar', 'SISA_SALDO', 'Sisa', 'STATUS', 'Status', 'KETERANGAN', 'Keterangan'],
  Data_Aset_Tetap: ['ID_ASET', 'NAMA_ASET', 'TGL_BELI', 'NILAI_PEROLEHAN', 'NILAI_RESIDU', 'UMUR_EKONOMIS_BLN', 'BEBAN_PENYUSUTAN_BLN', 'AKUN_ASET', 'AKUN_AKUMULASI', 'AKUN_BEBAN', 'KATEGORI', 'TGL_PEROLEHAN', 'HARGA_PEROLEHAN', 'NILAI_SISA', 'MASA_MANFAAT', 'METODE_PENYUSUTAN'],
  Data_Surat: ['ID_Surat', 'Nomor_Surat', 'Tipe_Surat', 'Tanggal', 'Perihal', 'Lampiran', 'Kepada', 'Alamat_Tujuan', 'Isi_Surat', 'Penandatangan_Nama', 'Penandatangan_Jabatan', 'Tembusan', 'Dibuat_Oleh', 'Isi_Surat_HTML', 'LetterDocSettings', 'Penandatangan_List'],
  Admin_PO: ['ID_PO', 'No_PO', 'Tanggal_PO', 'Tanggal', 'ID_Supplier', 'Nama_Supplier', 'Order_Ke', 'Alamat_Supplier', 'Syarat_Ketentuan', 'Perihal', 'Grand_Total', 'Total_Nilai', 'Status'],
  Admin_PO_Detail: ['ID_Detail', 'ID_PO', 'Nama_Barang', 'Nama_Produk', 'Spesifikasi', 'Qty', 'Satuan', 'Harga_Satuan', 'Total_Harga', 'Subtotal'],
  Data_Custom_Invoice: ['ID_Invoice', 'No_Invoice', 'Nomor_Invoice', 'Tanggal', 'Jatuh_Tempo', 'Nama_Pelanggan', 'Level_Pelanggan', 'Alamat_Pelanggan', 'No_Kontak', 'No_PO_Pelanggan', 'No_Surat_Jalan_List', 'ID_Distribusi_List', 'Metode_Kirim', 'Penerima', 'Keterangan', 'Items', 'Subtotal', 'Potongan_Ekspedisi', 'Diskon', 'Pajak_PPN', 'Grand_Total', 'Total_Tagihan', 'Status', 'Dibuat_Oleh', 'Waktu_Input'],
  Data_Pembayaran_Pelanggan: ['ID_Pembayaran', 'Tanggal_Bayar', 'Tanggal', 'ID_Distribusi', 'ID_Pelanggan', 'Nama_Pelanggan', 'Jumlah_Bayar', 'Nominal', 'Metode_Bayar', 'Metode', 'No_Referensi', 'Catatan', 'Keterangan', 'Waktu_Input'],
  Pencairan_Biaya_Distribusi: ['ID_Pencairan', 'Tanggal', 'Nama_Driver', 'Tarif_Per_Dus', 'Total_Dus', 'Total_Biaya', 'Jumlah_Pengiriman', 'ID_Distribusi_List', 'No_Surat_Jalan_List', 'Akun_Kas', 'Nama_Akun_Kas', 'Keterangan', 'Dibuat_Oleh', 'Waktu_Input']
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
 * Normalisasi data baris tabel agar selaras dengan skema Turso SQLite
 * Mencegah ketidakcocokan nama kolom lama/baru (misal: Order_Ke vs Nama_Supplier, Grand_Total vs Total_Nilai)
 */
export function normalizeRowsForTurso(table: string, rows: any[]): any[] {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  if (table === 'Admin_PO') {
    return rows.map(r => ({
      ...r,
      No_PO: r.No_PO || '',
      Tanggal_PO: r.Tanggal_PO || r.Tanggal || '',
      Tanggal: r.Tanggal || r.Tanggal_PO || '',
      Order_Ke: r.Order_Ke || r.Nama_Supplier || '',
      Nama_Supplier: r.Nama_Supplier || r.Order_Ke || '',
      ID_Supplier: r.ID_Supplier || r.Order_Ke || '',
      Alamat_Supplier: r.Alamat_Supplier || '',
      Syarat_Ketentuan: r.Syarat_Ketentuan || '',
      Perihal: r.Perihal || '',
      Grand_Total: Number(r.Grand_Total ?? r.Total_Nilai ?? 0),
      Total_Nilai: Number(r.Total_Nilai ?? r.Grand_Total ?? 0),
      Status: r.Status || 'Draf'
    }));
  }
  if (table === 'Admin_PO_Detail') {
    return rows.map(r => ({
      ...r,
      Nama_Produk: r.Nama_Produk || r.Nama_Barang || '',
      Nama_Barang: r.Nama_Barang || r.Nama_Produk || '',
      Spesifikasi: r.Spesifikasi || '',
      Qty: Number(r.Qty || 0),
      Satuan: r.Satuan || 'Pcs',
      Harga_Satuan: Number(r.Harga_Satuan || 0),
      Total_Harga: Number(r.Total_Harga ?? r.Subtotal ?? 0),
      Subtotal: Number(r.Subtotal ?? r.Total_Harga ?? 0)
    }));
  }
  if (table === 'Data_Custom_Invoice') {
    return rows.map(r => ({
      ...r,
      No_Invoice: r.No_Invoice || r.Nomor_Invoice || '',
      Nomor_Invoice: r.Nomor_Invoice || r.No_Invoice || '',
      Tanggal: r.Tanggal || '',
      Nama_Pelanggan: r.Nama_Pelanggan || '',
      Total_Tagihan: Number(r.Total_Tagihan ?? r.Grand_Total ?? 0),
      Grand_Total: Number(r.Grand_Total ?? r.Total_Tagihan ?? 0),
      Items: typeof r.Items === 'string' ? r.Items : JSON.stringify(r.Items || []),
      Status: r.Status || 'Draf'
    }));
  }
  return rows;
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
      const rawRows = getTableData<any>(table, []);
      const rows = normalizeRowsForTurso(table, rawRows);

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

// Tracking tabel yang sedang aktif sinkronisasi / baru saja di-write untuk mencegah race condition
const activeTableSyncs = new Set<string>();
const lastTableWriteTimestamp: Record<string, number> = {};

export function markTableWritten(tableName: string) {
  lastTableWriteTimestamp[tableName] = Date.now();
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

  // 1. Ambil daftar Deleted_Records dari Turso Cloud untuk sinkronisasi penghapusan multi-device
  const deletedRecordsMap = new Map<string, Set<string>>();
  try {
    const delRes = await executeTursoQuery(`SELECT table_name, record_id FROM "Deleted_Records"`, [], cfg);
    if (delRes.success && Array.isArray(delRes.rows)) {
      delRes.rows.forEach((r: any) => {
        const tbl = String(r.table_name || '').trim();
        const rid = String(r.record_id || '').trim().toLowerCase();
        if (tbl && rid) {
          if (!deletedRecordsMap.has(tbl)) {
            deletedRecordsMap.set(tbl, new Set<string>());
          }
          deletedRecordsMap.get(tbl)!.add(rid);
        }
      });
    }
  } catch (e) {}

  let pulledTables = 0;
  let totalRows = 0;

  for (const table of ALL_DATABASE_TABLES) {
    try {
      // Proteksi Race Condition: Jika tabel sedang di-sync ke cloud atau baru saja diedit (< 6 detik lalu),
      // jangan ditimpa oleh pull background agar perubahan lokal pengguna tidak hilang/kembali ke semula
      if (activeTableSyncs.has(table)) {
        continue;
      }
      const lastWrite = lastTableWriteTimestamp[table] || 0;
      if (Date.now() - lastWrite < 6000) {
        continue;
      }

      options?.onProgress?.(`Menarik tabel ${table}...`);
      const res = await executeTursoQuery(`SELECT * FROM "${table}"`, [], cfg);

      if (res.success && Array.isArray(res.rows)) {
        let cleanedRows = res.rows;
        const pk = TABLE_PRIMARY_KEYS[table] || 'id';

        // Singkirkan baris yang sudah dihapus secara resmi
        const tableDeletedIds = deletedRecordsMap.get(table);
        if (tableDeletedIds && tableDeletedIds.size > 0 && pk) {
          cleanedRows = cleanedRows.filter((r: any) => !tableDeletedIds.has(String(r[pk] ?? '').trim().toLowerCase()));
        }

        if (table === 'Distribusi') {
          cleanedRows = cleanedRows.map((r: any) => ({
            ...r,
            C120: Number(r.C120) || 0,
            C220: Number(r.C220) || 0,
            B330: Number(r.B330) || 0,
            B600: Number(r.B600) || 0,
            G19: Number(r.G19) || 0,
            Galon: Number(r.G19) || 0,
            Total_Tagihan: Number(r.Total_Tagihan) || 0
          }));
        } else if (table === 'Jurnal_Umum') {
          cleanedRows = cleanedRows.map((r: any) => ({
            ID_JURNAL: r.ID_JURNAL || r.ID_Entry || r.ID_Transaksi || '',
            TANGGAL: r.TANGGAL || r.Tanggal || '',
            PERIODE: r.PERIODE || (r.TANGGAL || r.Tanggal || '').slice(0, 7),
            REFERENSI: r.REFERENSI || r.Referensi || '',
            KETERANGAN: r.KETERANGAN || r.Keterangan || '',
            KODE_AKUN: r.KODE_AKUN || r.Kode_Akun || '',
            DEBIT: Number(r.DEBIT ?? r.Debit ?? 0),
            KREDIT: Number(r.KREDIT ?? r.Kredit ?? 0),
            PEMBUAT: r.PEMBUAT || r.Pembuat || 'Admin Finance'
          }));
        } else if (table === 'Pencairan_Biaya_Distribusi') {
          cleanedRows = cleanedRows.map((r: any) => ({
            ...r,
            Tarif_Per_Dus: Number(r.Tarif_Per_Dus || 1000),
            Total_Dus: Number(r.Total_Dus || 0),
            Total_Biaya: Number(r.Total_Biaya || 0),
            Jumlah_Pengiriman: Number(r.Jumlah_Pengiriman || 0)
          }));
        } else if (table === 'Admin_PO') {
          cleanedRows = cleanedRows.map((r: any) => ({
            ...r,
            Tanggal_PO: r.Tanggal_PO || r.Tanggal || '',
            Tanggal: r.Tanggal || r.Tanggal_PO || '',
            Order_Ke: r.Order_Ke || r.Nama_Supplier || '',
            Nama_Supplier: r.Nama_Supplier || r.Order_Ke || '',
            ID_Supplier: r.ID_Supplier || r.Order_Ke || '',
            Grand_Total: Number(r.Grand_Total ?? r.Total_Nilai ?? 0),
            Total_Nilai: Number(r.Total_Nilai ?? r.Grand_Total ?? 0),
            Status: r.Status || 'Draf'
          }));
        } else if (table === 'Admin_PO_Detail') {
          cleanedRows = cleanedRows.map((r: any) => ({
            ...r,
            Nama_Produk: r.Nama_Produk || r.Nama_Barang || '',
            Nama_Barang: r.Nama_Barang || r.Nama_Produk || '',
            Total_Harga: Number(r.Total_Harga ?? r.Subtotal ?? 0),
            Subtotal: Number(r.Subtotal ?? r.Total_Harga ?? 0),
            Qty: Number(r.Qty || 0),
            Satuan: r.Satuan || 'Pcs',
            Harga_Satuan: Number(r.Harga_Satuan || 0)
          }));
        } else if (table === 'Data_Custom_Invoice') {
          cleanedRows = cleanedRows.map((r: any) => ({
            ...r,
            No_Invoice: r.No_Invoice || r.Nomor_Invoice || '',
            Nomor_Invoice: r.Nomor_Invoice || r.No_Invoice || '',
            Grand_Total: Number(r.Grand_Total ?? r.Total_Tagihan ?? 0),
            Total_Tagihan: Number(r.Total_Tagihan ?? r.Grand_Total ?? 0),
            Items: typeof r.Items === 'string' ? (() => { try { return JSON.parse(r.Items); } catch { return []; } })() : (r.Items || [])
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

  const normalizedData = normalizeRowsForTurso(tableName, data);
  const normalizedPrev = previousData ? normalizeRowsForTurso(tableName, previousData) : undefined;

  const pk = TABLE_PRIMARY_KEYS[tableName] || 'id';

  activeTableSyncs.add(tableName);
  lastTableWriteTimestamp[tableName] = Date.now();

  try {
    // 1. Kasus A: Tabel dikosongkan
    if (normalizedData.length === 0) {
      await executeTursoQuery(`DELETE FROM "${tableName}"`, [], cfg).catch(() => {});
      return;
    }

    // 2. Kasus B: Baris tertentu dihapus
    if (pk && normalizedPrev && Array.isArray(normalizedPrev) && normalizedPrev.length > normalizedData.length) {
      const currentKeySet = new Set(normalizedData.map(r => String(r[pk] ?? '').trim().toLowerCase()));
      const deletedKeys = normalizedPrev
        .map(r => r[pk])
        .filter(k => k !== undefined && k !== null && !currentKeySet.has(String(k).trim().toLowerCase()));

      if (deletedKeys.length > 0) {
        const placeholders = deletedKeys.map(() => '?').join(', ');
        await executeTursoQuery(`DELETE FROM "${tableName}" WHERE "${pk}" IN (${placeholders})`, deletedKeys, cfg).catch(() => {});
        for (const dk of deletedKeys) {
          await executeTursoQuery(
            `INSERT OR REPLACE INTO "Deleted_Records" ("table_name", "record_id", "deleted_at") VALUES (?, ?, datetime('now', 'localtime'))`,
            [tableName, String(dk).trim()],
            cfg
          ).catch(() => {});
        }
      }
    }

    // 3. Kasus C: Upsert baris aktif (Optimasi Diffing Cepat: prioritaskan baris yang baru atau berubah)
    const columns = getSanitizedColumns(tableName, normalizedData);
    if (columns.length === 0) return;

    let rowsToUpsert = normalizedData;
    if (pk && normalizedPrev && Array.isArray(normalizedPrev) && normalizedPrev.length > 0) {
      const prevMap = new Map<string, any>();
      normalizedPrev.forEach(r => {
        if (!r) return;
        const key = String(r[pk] ?? '').trim().toLowerCase();
        if (key) prevMap.set(key, r);
      });

      const changedOrNewRows = normalizedData.filter(r => {
        if (!r) return false;
        const key = String(r[pk] ?? '').trim().toLowerCase();
        const prev = prevMap.get(key);
        if (!prev) return true; // Baris baru
        return columns.some(col => String(r[col] ?? '') !== String(prev[col] ?? ''));
      });

      if (changedOrNewRows.length > 0) {
        rowsToUpsert = changedOrNewRows;
      } else if (normalizedPrev.length <= normalizedData.length) {
        // Tidak ada baris yang berubah maupun dihapus
        return;
      }
    }

    // Jika record disimpan/dibuat kembali, hapus dari Deleted_Records
    if (pk && rowsToUpsert.length > 0) {
      const activeIds = rowsToUpsert.map(r => String(r[pk] ?? '').trim()).filter(Boolean);
      if (activeIds.length > 0) {
        const placeholders = activeIds.map(() => '?').join(', ');
        await executeTursoQuery(`DELETE FROM "Deleted_Records" WHERE "table_name" = ? AND "record_id" IN (${placeholders})`, [tableName, ...activeIds], cfg).catch(() => {});
      }
    }

    const quotedCols = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`;

    // Pastikan tabel ada di Turso SQLite jika belum dibuat (terutama tabel baru seperti Pencairan_Biaya_Distribusi)
    const colDefs = columns.map(c => c === pk ? `"${c}" TEXT PRIMARY KEY` : `"${c}" TEXT`).join(', ');
    await executeTursoQuery(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs})`, [], cfg).catch(() => {});

    const BATCH_SIZE = 100;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
      const chunk = rowsToUpsert.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map(row => ({
        sql,
        args: columns.map(col => (row[col] !== undefined ? row[col] : null))
      }));
      await executeTursoBatch(stmts, cfg).catch(() => {});
    }
  } catch (err: any) {
    console.warn(`[TursoSync] Sinkronisasi ${tableName} gagal:`, err);
  } finally {
    activeTableSyncs.delete(tableName);
    lastTableWriteTimestamp[tableName] = Date.now();
  }
}

/**
 * Hapus satu baris eksplisit dari Turso Cloud dan catat ke Deleted_Records
 */
export async function deleteRowFromTurso(tableName: string, id: string | number, pkField?: string) {
  const cfg = getTursoConfig();
  if (!cfg.isConnected) return;
  const pk = pkField || TABLE_PRIMARY_KEYS[tableName] || 'id';
  const cleanId = String(id).trim();

  // 1. Eksekusi DELETE dari tabel utama di Turso SQLite
  await executeTursoQuery(`DELETE FROM "${tableName}" WHERE "${pk}" = ?`, [cleanId], cfg).catch(() => {});

  // 2. Pastikan tabel Deleted_Records ada di Turso
  await executeTursoQuery(
    `CREATE TABLE IF NOT EXISTS "Deleted_Records" ("table_name" TEXT, "record_id" TEXT, "deleted_at" TEXT, PRIMARY KEY("table_name", "record_id"))`,
    [],
    cfg
  ).catch(() => {});

  // 3. Catat tombstone permanen ke Deleted_Records agar HP & semua perangkat lain otomatis menghapusnya
  await executeTursoQuery(
    `INSERT OR REPLACE INTO "Deleted_Records" ("table_name", "record_id", "deleted_at") VALUES (?, ?, datetime('now', 'localtime'))`,
    [tableName, cleanId],
    cfg
  ).catch(() => {});
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
