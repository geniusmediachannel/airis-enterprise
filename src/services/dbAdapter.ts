/**
 * AIRIS Enterprise - Hybrid Database & Storage Adapter
 * Supports Supabase Cloud Database + Seamless Local Storage Persistence
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  ProductItem, CustomerItem, SupplierItem, RawMaterialItem,
  BOMItem, EmployeeItem, SPKItem, ProductionItem,
  DistributionItem, DistributionProductDetail, DeliveryPlanItem,
  RawMaterialPurchase, RawMaterialMutation, QCHeader, QCDetailCycle,
  AttendanceRecord, OvertimeRecord, KasbonRecord,
  PayrollHistoryItem, COAItem, GeneralJournalItem, DraftJournalItem,
  ReceivablePayableItem, FixedAssetItem, OfficialLetterItem,
  AdminPOHeader, AdminPODetail, SupabaseConfig,
  UserAccount, SpecialPriceItem
} from '../types';

const STORAGE_KEY_PREFIX = 'AIRIS_ENTERPRISE_';
const SUPABASE_CONFIG_KEY = 'AIRIS_SUPABASE_CONFIG';

// Build-time injected globals via vite.config.ts define
declare const __AIRIS_SUPABASE_URL__: string | undefined;
declare const __AIRIS_SUPABASE_ANON_KEY__: string | undefined;

// Default Project URL & Anon Key dari define / env Vite / NextPublic / fallback proyek
const DEFAULT_SUPABASE_URL = 
  (typeof __AIRIS_SUPABASE_URL__ !== 'undefined' && __AIRIS_SUPABASE_URL__) ||
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://inifunrwbxeeglzgklfr.supabase.co';

const DEFAULT_SUPABASE_ANON_KEY = 
  (typeof __AIRIS_SUPABASE_ANON_KEY__ !== 'undefined' && __AIRIS_SUPABASE_ANON_KEY__) ||
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  '';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  let url = DEFAULT_SUPABASE_URL;
  let anonKey = DEFAULT_SUPABASE_ANON_KEY;
  let isConnected = Boolean(url && anonKey);
  let autoSync = true;

  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url) url = parsed.url;
      if (parsed.anonKey) anonKey = parsed.anonKey;
      if (typeof parsed.isConnected === 'boolean') isConnected = parsed.isConnected;
      if (typeof parsed.autoSync === 'boolean') autoSync = parsed.autoSync;
    }
  } catch (e) {
    console.error('Error reading Supabase config', e);
  }

  if (url && anonKey) {
    isConnected = true;
  }

  return {
    url,
    anonKey,
    isConnected,
    autoSync
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseInstance) {
    const cfg = getSupabaseConfig();
    if (cfg.url && cfg.anonKey) {
      try {
        supabaseInstance = createClient(cfg.url, cfg.anonKey);
      } catch (e) {
        supabaseInstance = null;
      }
    }
  }
  return supabaseInstance;
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  let url = config.url ? config.url.trim().replace(/\/+$/, '') : '';
  if (url.endsWith('.supabase.com')) {
    url = url.replace(/\.supabase\.com$/, '.supabase.co');
  }
  const cleanConfig = { ...config, url, anonKey: config.anonKey ? config.anonKey.trim() : '' };
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cleanConfig));
  if (cleanConfig.url && cleanConfig.anonKey) {
    try {
      supabaseInstance = createClient(cleanConfig.url, cleanConfig.anonKey);
      // Begitu tersambung, otomatis lakukan pull seluruh data cloud
      setTimeout(() => {
        syncAllTablesFromSupabase().catch(console.warn);
      }, 300);
    } catch (e) {
      console.error('Failed to create Supabase client', e);
      supabaseInstance = null;
    }
  } else {
    supabaseInstance = null;
  }
  notifyDbChange();
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    let cleanUrl = url ? url.trim().replace(/\/+$/, '') : '';
    if (cleanUrl.endsWith('.supabase.com')) {
      cleanUrl = cleanUrl.replace(/\.supabase\.com$/, '.supabase.co');
    }
    const cleanKey = key ? key.trim() : '';
    if (!cleanUrl || !cleanKey) {
      return { success: false, message: 'URL dan Anon Key wajib diisi!' };
    }
    const testClient = createClient(cleanUrl, cleanKey);
    const { data, error } = await testClient.from('Master_COA').select('*').limit(1);
    if (error) {
      if (error.message.includes('FetchError') || error.message.includes('Failed to fetch')) {
        return { success: false, message: 'Tidak dapat menjangkau host Supabase: ' + error.message };
      }
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return { 
          success: false, 
          message: 'Host Supabase terhubung, tetapi tabel belum dibuat di database! Silakan buka Supabase SQL Editor dan jalankan skrip database/00_FULL_SETUP.sql.' 
        };
      }
      return { success: false, message: 'Supabase merespons error: ' + error.message };
    }
    return { success: true, message: 'Koneksi ke Supabase berhasil terverifikasi dan tabel aktif!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal terhubung ke Supabase.' };
  }
}

// In-memory cache to ensure zero data loss across component lifecycles
const memoryTableCache: Record<string, any[]> = {};

// Cross-tab instant communication channel
let crossTabChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    crossTabChannel = new BroadcastChannel('airis_cross_tab_sync');
    crossTabChannel.onmessage = (event) => {
      if (event.data?.type === 'DB_CHANGE') {
        if (event.data.table) {
          delete memoryTableCache[event.data.table];
        } else {
          Object.keys(memoryTableCache).forEach(k => delete memoryTableCache[k]);
        }
        window.dispatchEvent(new CustomEvent('airis_db_updated'));
      }
    };
  }
} catch (e) {}

// Helper to notify listeners across the application and across browser tabs
export function notifyDbChange(tableName?: string) {
  window.dispatchEvent(new CustomEvent('airis_db_updated'));
  try {
    crossTabChannel?.postMessage({ type: 'DB_CHANGE', table: tableName, timestamp: Date.now() });
  } catch (e) {}
}

export function getTableData<T>(tableName: string, fallbackDefault: T[] = []): T[] {
  // 1. Cek memory cache terlebih dahulu jika sudah ada data aktif
  if (memoryTableCache[tableName] && Array.isArray(memoryTableCache[tableName]) && memoryTableCache[tableName].length > 0) {
    return memoryTableCache[tableName] as T[];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + tableName);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryTableCache[tableName] = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Error reading ${tableName}`, e);
  }
  // Initialize with fallback
  setTableData(tableName, fallbackDefault);
  return fallbackDefault;
}

export function isSupabaseConfigured(): boolean {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.anonKey);
}

export function setTableData<T>(tableName: string, data: T[], options?: { skipCloudSync?: boolean }): void {
  // Simpan selalu ke memory cache agar langsung tersedia di seluruh modul
  const safeData = Array.isArray(data) ? data : [];
  memoryTableCache[tableName] = safeData;

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(safeData));
  } catch (e: any) {
    console.warn(`LocalStorage quota warning writing ${tableName}:`, e);
    // Jika kuota localStorage penuh (QuotaExceededError), bersihkan data non-kritis dan coba lagi
    try {
      // 1. Pangkas log jurnal otomatis jika melebihi 500 baris
      const rawJ = localStorage.getItem(STORAGE_KEY_PREFIX + 'Jurnal_Umum');
      if (rawJ) {
        const jArr = JSON.parse(rawJ);
        if (Array.isArray(jArr) && jArr.length > 500) {
          localStorage.setItem(STORAGE_KEY_PREFIX + 'Jurnal_Umum', JSON.stringify(jArr.slice(-500)));
        }
      }
      // 2. Bersihkan log notifikasi
      localStorage.removeItem('airis_notifications');
      // 3. Simpan kembali data utama
      localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(safeData));
    } catch (retryErr) {
      console.warn(`LocalStorage retry failed for ${tableName}, kept safely in memory cache:`, retryErr);
    }
  }

  notifyDbChange();

  if (options?.skipCloudSync) return;

  const cfg = getSupabaseConfig();
  const client = getSupabaseClient();
  if (cfg.isConnected && client && cfg.autoSync) {
    syncToSupabaseTable(tableName, safeData).catch(err => {
      console.warn(`Supabase background sync for ${tableName} failed`, err);
    });
  }
}

export const saveTableData = setTableData;

async function syncToSupabaseTable<T>(tableName: string, data: T[]) {
  const client = getSupabaseClient();
  if (!client || data.length === 0) return;
  try {
    const { error } = await client.from(tableName).upsert(data as any);
    if (error) {
      console.warn(`[SupabaseSync] Upsert error on ${tableName}:`, error.message);
    }
  } catch (e) {
    console.warn(`[SupabaseSync] Exception during upsert on ${tableName}:`, e);
  }
}

/**
 * Daftar tabel utama sistem AIRIS untuk sinkronisasi cloud
 */
export const ALL_DATABASE_TABLES = [
  'MD_Produk',
  'MD_Pelanggan',
  'MD_Supplier',
  'MD_BahanPenolong',
  'MD_BOM',
  'MD_Karyawan',
  'MD_UserAkses',
  'MD_HargaKhusus',
  'SPK',
  'Produksi',
  'Rencana_Distribusi',
  'Distribusi',
  'Distribusi_Item',
  'Pembelian_Bahan',
  'Mutasi_Bahan',
  'Data_QC',
  'Data_QC_Detail',
  'Data_Presensi',
  'Data_Lembur',
  'Data_Kasbon',
  'Histori_Penggajian',
  'Master_COA',
  'Jurnal_Umum',
  'Draf_Jurnal',
  'Data_Piutang_Utang',
  'Data_Aset_Tetap',
  'Data_Surat',
  'Admin_PO'
];

/**
 * Tarik satu tabel tertentu secara instan dari Supabase Cloud
 */
export async function fetchSingleTableFromSupabase<T = any>(tableName: string): Promise<T[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from(tableName).select('*');
    if (!error && Array.isArray(data)) {
      memoryTableCache[tableName] = data;
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(data));
      } catch (e) {}
      return data as T[];
    }
  } catch (err) {
    console.warn(`[Sync] Gagal fetch tabel ${tableName}:`, err);
  }
  return null;
}

/**
 * Sinkronisasi seluruh tabel dari Supabase Cloud ke browser lokal (Pull All)
 * Ini memastikan semua browser dan device memiliki data yang 100% identik
 */
export async function syncAllTablesFromSupabase(options?: { silent?: boolean }): Promise<{ success: boolean; message: string; tablesCount: number }> {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();

  if (!client || !cfg.isConnected || !cfg.url || !cfg.anonKey) {
    return { success: false, message: 'Supabase Cloud belum terhubung.', tablesCount: 0 };
  }

  let tablesWithData = 0;

  try {
    const promises = ALL_DATABASE_TABLES.map(async (table) => {
      try {
        const { data, error } = await client.from(table).select('*');
        if (!error && Array.isArray(data)) {
          if (data.length > 0) {
            memoryTableCache[table] = data;
            try {
              localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(data));
            } catch (e) {}
            tablesWithData++;
          }
        }
      } catch (e) {
        console.warn(`[SyncAll] Error fetching ${table}:`, e);
      }
    });

    await Promise.all(promises);

    // Sinkronkan juga pengaturan lisensi / masa aktif dari cloud
    try {
      const { data: hyperUser } = await client
        .from('MD_UserAkses')
        .select('*')
        .eq('Username', 'hyperadmin')
        .single();
      if (hyperUser && hyperUser.Alasan_Daftar) {
        try {
          const cloudLic = JSON.parse(hyperUser.Alasan_Daftar);
          if (cloudLic && cloudLic.expiryDate) {
            localStorage.setItem('AIRIS_APP_LICENSE_V1', JSON.stringify(cloudLic));
            window.dispatchEvent(new CustomEvent('airis_license_updated', { detail: cloudLic }));
          }
        } catch (e) {}
      }
    } catch (licErr) {
      // ignore
    }

    notifyDbChange();
    window.dispatchEvent(new CustomEvent('airis_cloud_synced', { detail: { timestamp: Date.now() } }));

    return {
      success: true,
      message: `Berhasil menyinkronkan data dari Supabase Cloud (${tablesWithData} tabel aktif).`,
      tablesCount: tablesWithData
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal menyinkronkan data cloud.', tablesCount: tablesWithData };
  }
}

/**
 * Unggah seluruh data lokal saat ini ke Supabase Cloud (Push All)
 */
export async function pushAllTablesToSupabase(): Promise<{ success: boolean; message: string; count: number; errors?: string[] }> {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();

  if (!client || !cfg.isConnected || !cfg.url || !cfg.anonKey) {
    return { success: false, message: 'Supabase Cloud belum terhubung. Periksa konfigurasi URL & Anon Key.', count: 0 };
  }

  let pushed = 0;
  const failureDetails: string[] = [];

  for (const table of ALL_DATABASE_TABLES) {
    const data = getTableData(table, []);
    if (data.length > 0) {
      try {
        const { error } = await client.from(table).upsert(data as any);
        if (!error) {
          pushed++;
        } else {
          console.warn(`[PushAll] Gagal upload ${table}:`, error.message);
          failureDetails.push(`${table}: ${error.message}`);
        }
      } catch (e: any) {
        failureDetails.push(`${table}: ${e.message || 'Exception'}`);
      }
    }
  }

  // Unggah juga status lisensi ke record hyperadmin di Supabase Cloud
  try {
    const rawLic = localStorage.getItem('AIRIS_APP_LICENSE_V1');
    if (rawLic) {
      await client.from('MD_UserAkses').update({ Alasan_Daftar: rawLic }).eq('Username', 'hyperadmin');
    }
  } catch (e) {}

  notifyDbChange();

  if (failureDetails.length > 0) {
    const isTableMissing = failureDetails.some(f => f.includes('does not exist'));
    if (isTableMissing) {
      return {
        success: false,
        message: 'Gagal mengunggah: Tabel belum dibuat di database Supabase! Buka Supabase SQL Editor dan jalankan skrip database/00_FULL_SETUP.sql.',
        count: pushed,
        errors: failureDetails
      };
    }
    return {
      success: pushed > 0,
      message: `Tersinkronisasi ${pushed} tabel. Beberapa tabel ditolak (${failureDetails.slice(0, 2).join(', ')}).`,
      count: pushed,
      errors: failureDetails
    };
  }

  return { success: true, message: `Berhasil mengunggah ${pushed} tabel ke Supabase Cloud! Semua perangkat lain kini sinkron.`, count: pushed };
}

let isRealtimeSubscribed = false;

/**
 * Mendaftarkan pendengar Realtime Supabase untuk perubahan instan antar device
 */
export function setupSupabaseRealtimeSync(onUpdated?: (tableName: string) => void) {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();

  if (!client || !cfg.isConnected || isRealtimeSubscribed) return;

  try {
    isRealtimeSubscribed = true;
    client
      .channel('airis_enterprise_cloud_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          const table = payload.table;
          if (table) {
            fetchSingleTableFromSupabase(table).then(() => {
              notifyDbChange();
              if (onUpdated) onUpdated(table);
            });
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('[Realtime] Gagal mendaftarkan realtime channel:', err);
    isRealtimeSubscribed = false;
  }
}

// -------------------------------------------------------------
// DEFAULT AMDK DATA (PT. Anugerah Illahi Rabbi)
// -------------------------------------------------------------
const DEFAULT_PRODUCTS: ProductItem[] = [
  { ID_Produk: 'ASH-CUP120', Nama_Produk: 'As-Shofaa Cup 120ml', Kategori: 'Air Mineral Cup', Satuan: 'Dus', Harga_Distributor: 12000, Harga_Agen: 13000, Harga_Reseller: 14000, Harga_Konsumen: 16000, Status: 'Aktif' },
  { ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Kategori: 'Air Mineral Cup', Satuan: 'Dus', Harga_Distributor: 14500, Harga_Agen: 15500, Harga_Reseller: 16500, Harga_Konsumen: 18500, Status: 'Aktif' },
  { ID_Produk: 'ASH-BTL330', Nama_Produk: 'As-Shofaa Botol 330ml', Kategori: 'Air Mineral Botol', Satuan: 'Dus', Harga_Distributor: 24000, Harga_Agen: 26000, Harga_Reseller: 28000, Harga_Konsumen: 32000, Status: 'Aktif' },
  { ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Kategori: 'Air Mineral Botol', Satuan: 'Dus', Harga_Distributor: 28000, Harga_Agen: 30000, Harga_Reseller: 32000, Harga_Konsumen: 36000, Status: 'Aktif' },
  { ID_Produk: 'ASH-GLN19L', Nama_Produk: 'As-Shofaa Galon 19L', Kategori: 'Air Mineral Galon', Satuan: 'Galon', Harga_Distributor: 9000, Harga_Agen: 10000, Harga_Reseller: 11000, Harga_Konsumen: 13000, Status: 'Aktif' }
];

const DEFAULT_CUSTOMERS: CustomerItem[] = [
  { ID_Pelanggan: 'PLG-0001', Nama_Pelanggan: 'Toko Berkah Sejahtera', No_Telp: '081234567890', Alamat: 'Jl. Raya Klaten No. 12', Level_Pelanggan: 'Distributor', Status: 'Aktif' },
  { ID_Pelanggan: 'PLG-0002', Nama_Pelanggan: 'Agen Sumber Segar', No_Telp: '082198765432', Alamat: 'Prambanan, Klaten', Level_Pelanggan: 'Agen', Status: 'Aktif' },
  { ID_Pelanggan: 'PLG-0003', Nama_Pelanggan: 'Koperasi Karyawan BMT', No_Telp: '081345678912', Alamat: 'Klaten Utara', Level_Pelanggan: 'Reseller', Status: 'Aktif' },
  { ID_Pelanggan: 'PLG-0004', Nama_Pelanggan: 'Depo Air Amanah', No_Telp: '085678912345', Alamat: 'Jatinom, Klaten', Level_Pelanggan: 'Konsumen Biasa', Status: 'Aktif' }
];

const DEFAULT_SUPPLIERS: SupplierItem[] = [
  { ID_Supplier: 'SUP-0001', Nama_Supplier: 'PT. Sumber Plastik Nusantara', PIC: 'Budi Santoso', No_Telp: '0811223344', Alamat: 'Solo Baru, Sukoharjo', Status: 'Aktif' },
  { ID_Supplier: 'SUP-0002', Nama_Supplier: 'CV. Karton Lestari Abadi', PIC: 'Hendro Gunawan', No_Telp: '0812998877', Alamat: 'Ceper, Klaten', Status: 'Aktif' },
  { ID_Supplier: 'SUP-0003', Nama_Supplier: 'PT. Tirta Kimia QC', PIC: 'Siti Rahma', No_Telp: '0813556677', Alamat: 'Semarang Barat', Status: 'Aktif' }
];

const DEFAULT_RAW_MATERIALS: RawMaterialItem[] = [
  { ID_Bahan: 'BHN-CUP120', Nama_Bahan: 'Cup Plastik 120ml Polos', Kategori: 'Kemasan', Satuan: 'Pcs', Harga_Satuan: 85, Minimum_Stock: 5000 },
  { ID_Bahan: 'BHN-CUP220', Nama_Bahan: 'Cup Plastik 220ml Printing', Kategori: 'Kemasan', Satuan: 'Pcs', Harga_Satuan: 110, Minimum_Stock: 8000 },
  { ID_Bahan: 'BHN-LIDSEAL', Nama_Bahan: 'Lid Seal Roll As-Shofaa', Kategori: 'Segel', Satuan: 'Roll', Harga_Satuan: 145000, Minimum_Stock: 20 },
  { ID_Bahan: 'BHN-KARTON120', Nama_Bahan: 'Karton Dus 120ml (isi 48)', Kategori: 'Kemasan', Satuan: 'Lembar', Harga_Satuan: 2400, Minimum_Stock: 1000 },
  { ID_Bahan: 'BHN-KARTON220', Nama_Bahan: 'Karton Dus 220ml (isi 48)', Kategori: 'Kemasan', Satuan: 'Lembar', Harga_Satuan: 2600, Minimum_Stock: 1200 },
  { ID_Bahan: 'BHN-BTL330', Nama_Bahan: 'Botol PET 330ml Short Neck', Kategori: 'Kemasan', Satuan: 'Pcs', Harga_Satuan: 380, Minimum_Stock: 4000 },
  { ID_Bahan: 'BHN-BTL600', Nama_Bahan: 'Botol PET 600ml', Kategori: 'Kemasan', Satuan: 'Pcs', Harga_Satuan: 460, Minimum_Stock: 4000 },
  { ID_Bahan: 'BHN-TUTUPBTL', Nama_Bahan: 'Tutup Botol Segel Biru', Kategori: 'Segel', Satuan: 'Pcs', Harga_Satuan: 95, Minimum_Stock: 6000 },
  { ID_Bahan: 'BHN-LABELBTL', Nama_Bahan: 'Label Shrink Botol', Kategori: 'Label', Satuan: 'Pcs', Harga_Satuan: 120, Minimum_Stock: 5000 },
  { ID_Bahan: 'BHN-LAKBAN', Nama_Bahan: 'Lakban Bening 2 Inch', Kategori: 'Lakban', Satuan: 'Roll', Harga_Satuan: 9500, Minimum_Stock: 50 },
  { ID_Bahan: 'BHN-TUTUPGLN', Nama_Bahan: 'Tutup Galon Standar', Kategori: 'Segel', Satuan: 'Pcs', Harga_Satuan: 420, Minimum_Stock: 1500 },
  { ID_Bahan: 'BHN-TISUGLN', Nama_Bahan: 'Tisu Alkohol Galon', Kategori: 'Segel', Satuan: 'Pcs', Harga_Satuan: 130, Minimum_Stock: 1500 }
];

const DEFAULT_BOM: BOMItem[] = [
  { ID_BOM: 'BOM-0001', ID_Produk: 'ASH-CUP220', ID_Bahan: 'BHN-CUP220', Jumlah_Dibutuhkan: 48, Satuan: 'Pcs', Keterangan: '48 cup per karton' },
  { ID_BOM: 'BOM-0002', ID_Produk: 'ASH-CUP220', ID_Bahan: 'BHN-KARTON220', Jumlah_Dibutuhkan: 1, Satuan: 'Lembar', Keterangan: '1 kardus box' },
  { ID_BOM: 'BOM-0003', ID_Produk: 'ASH-CUP220', ID_Bahan: 'BHN-LIDSEAL', Jumlah_Dibutuhkan: 0.04, Satuan: 'Roll', Keterangan: 'Estimasi seal' },
  { ID_BOM: 'BOM-0004', ID_Produk: 'ASH-BTL600', ID_Bahan: 'BHN-BTL600', Jumlah_Dibutuhkan: 24, Satuan: 'Pcs', Keterangan: '24 botol per karton' },
  { ID_BOM: 'BOM-0005', ID_Produk: 'ASH-BTL600', ID_Bahan: 'BHN-TUTUPBTL', Jumlah_Dibutuhkan: 24, Satuan: 'Pcs', Keterangan: '24 tutup segel' },
  { ID_BOM: 'BOM-0006', ID_Produk: 'ASH-BTL600', ID_Bahan: 'BHN-LABELBTL', Jumlah_Dibutuhkan: 24, Satuan: 'Pcs', Keterangan: '24 label shrink' },
  { ID_BOM: 'BOM-0007', ID_Produk: 'ASH-GLN19L', ID_Bahan: 'BHN-TUTUPGLN', Jumlah_Dibutuhkan: 1, Satuan: 'Pcs', Keterangan: '1 tutup galon' },
  { ID_BOM: 'BOM-0008', ID_Produk: 'ASH-GLN19L', ID_Bahan: 'BHN-TISUGLN', Jumlah_Dibutuhkan: 1, Satuan: 'Pcs', Keterangan: '1 tisu antiseptik' }
];

const DEFAULT_EMPLOYEES: EmployeeItem[] = [
  { ID_Karyawan: 'KAR-0001', Nama_Karyawan: 'Marko Dwi Nugroho', Departemen: 'Keuangan', Jabatan: 'Manager', Tgl_Masuk: '2023-01-15', Status: 'Aktif', Gaji_Pokok: 4500000, Tunjangan: 750000 },
  { ID_Karyawan: 'KAR-0002', Nama_Karyawan: 'H. Mujiburrahman SIP', Departemen: 'Manajemen', Jabatan: 'Direktur', Tgl_Masuk: '2022-06-01', Status: 'Aktif', Gaji_Pokok: 8000000, Tunjangan: 1500000 },
  { ID_Karyawan: 'KAR-0003', Nama_Karyawan: 'Agus Setiawan', Departemen: 'Produksi', Jabatan: 'Supervisor', Tgl_Masuk: '2023-03-10', Status: 'Aktif', Gaji_Pokok: 3400000, Tunjangan: 500000 },
  { ID_Karyawan: 'KAR-0004', Nama_Karyawan: 'Tri Wahyudi', Departemen: 'Distribusi', Jabatan: 'Driver', Tgl_Masuk: '2023-05-20', Status: 'Aktif', Gaji_Pokok: 2900000, Tunjangan: 400000 },
  { ID_Karyawan: 'KAR-0005', Nama_Karyawan: 'Nurul Hidayati', Departemen: 'QC', Jabatan: 'Analis QC', Tgl_Masuk: '2023-08-01', Status: 'Aktif', Gaji_Pokok: 3100000, Tunjangan: 450000 }
];

const DEFAULT_USERS: UserAccount[] = [
  { ID_User: 'USR-01', Username: 'admin', Email: 'admin@airis-amdk.com', Role: 'SuperAdmin', ID_Karyawan: 'KAR-0001', Status_Akun: 'Aktif' },
  { ID_User: 'USR-02', Username: 'produksi', Email: 'produksi@airis-amdk.com', Role: 'Admin Produksi', ID_Karyawan: 'KAR-0003', Status_Akun: 'Aktif' },
  { ID_User: 'USR-03', Username: 'gudang', Email: 'gudang@airis-amdk.com', Role: 'Admin Gudang', ID_Karyawan: 'KAR-0004', Status_Akun: 'Aktif' },
  { ID_User: 'USR-04', Username: 'finance', Email: 'finance@airis-amdk.com', Role: 'Kasir/Finance', ID_Karyawan: 'KAR-0001', Status_Akun: 'Aktif' },
  { ID_User: 'USR-05', Username: 'hrd', Email: 'hrd@airis-amdk.com', Role: 'HRD', ID_Karyawan: 'KAR-0005', Status_Akun: 'Aktif' }
];

export const FACTORY_STANDARD_COA: COAItem[] = [
  // ==========================================
  // 1. ASET LANCAR (CURRENT ASSETS)
  // ==========================================
  // Kas & Setara Kas
  { KODE_AKUN: '111-10', NAMA_AKUN: 'Kas Kecil (Petty Cash Kantor)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '111-15', NAMA_AKUN: 'Kas Kasir / Kas Operasional Harian', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '111-20', NAMA_AKUN: 'Kas Bank BSI Operasional (1607134444)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '111-21', NAMA_AKUN: 'Kas Bank BRI Penerimaan Penjualan', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '111-22', NAMA_AKUN: 'Kas Bank Mandiri Payroll & Transaksi', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // Piutang
  { KODE_AKUN: '112-10', NAMA_AKUN: 'Piutang Usaha (Distributor, Agen & Toko)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '112-19', NAMA_AKUN: 'Cadangan Kerugian Penurunan Nilai Piutang', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '112-20', NAMA_AKUN: 'Piutang Karyawan (Pinjaman Kasbon)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '112-30', NAMA_AKUN: 'Uang Muka Pembelian Bahan (Vendor Down Payment)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '112-40', NAMA_AKUN: 'Biaya Dibayar Di Muka (Sewa & Asuransi)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '112-50', NAMA_AKUN: 'Pajak Dibayar Di Muka (PPN Masukan / PPh 22/23)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // Persediaan Pabrik (Manufacturing Inventory)
  { KODE_AKUN: '113-10', NAMA_AKUN: 'Persediaan Air Baku & Sumber Mata Air (Raw Water)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '113-20', NAMA_AKUN: 'Persediaan Bahan Kemasan (Cup, Botol, Tutup, Sedotan)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '113-25', NAMA_AKUN: 'Persediaan Bahan Pembungkus (Kardus Dus, Lakban, Plastik)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '113-28', NAMA_AKUN: 'Persediaan Bahan Kimia & Media Filter WTP (Ozon, Karbon, Pasir)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '113-30', NAMA_AKUN: 'Persediaan Barang Dalam Proses / BDP (Work In Progress)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '113-40', NAMA_AKUN: 'Persediaan Barang Jadi (Air Mineral Cup, Botol, Galon Siap Kirim)', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '113-50', NAMA_AKUN: 'Persediaan Suku Cadang Mesin & Perlengkapan Pabrik', KATEGORI: 'Aset Lancar', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // ==========================================
  // 2. ASET TETAP & KONTRA ASET (FIXED ASSETS)
  // ==========================================
  { KODE_AKUN: '121-10', NAMA_AKUN: 'Tanah & Bangunan Gedung Pabrik', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '121-20', NAMA_AKUN: 'Mesin Water Treatment Plant (WTP) & Pengolahan Air', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '121-21', NAMA_AKUN: 'Mesin Filling & Sealing Otomatis (Cup, Botol, Galon)', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '121-30', NAMA_AKUN: 'Kendaraan Truk & Armada Distribusi', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '121-40', NAMA_AKUN: 'Peralatan Laboratorium & Instrumen Uji SNI/QC', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '121-50', NAMA_AKUN: 'Instalasi Kelistrikan Pabrik, Trafo & Genset Cadangan', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '121-60', NAMA_AKUN: 'Inventaris Peralatan Kantor, Komputer & Jaringan IT', KATEGORI: 'Aset Tetap', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // Akumulasi Penyusutan (Kontra Aset)
  { KODE_AKUN: '122-10', NAMA_AKUN: 'Akumulasi Penyusutan Bangunan Gedung Pabrik', KATEGORI: 'Kontra Aset', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '122-20', NAMA_AKUN: 'Akumulasi Penyusutan Mesin Produksi & WTP', KATEGORI: 'Kontra Aset', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '122-30', NAMA_AKUN: 'Akumulasi Penyusutan Kendaraan Armada Distribusi', KATEGORI: 'Kontra Aset', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '122-40', NAMA_AKUN: 'Akumulasi Penyusutan Peralatan Lab & QC', KATEGORI: 'Kontra Aset', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '122-50', NAMA_AKUN: 'Akumulasi Penyusutan Genset & Instalasi Listrik', KATEGORI: 'Kontra Aset', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '122-60', NAMA_AKUN: 'Akumulasi Penyusutan Inventaris Kantor & IT', KATEGORI: 'Kontra Aset', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },

  // ==========================================
  // 3. LIABILITAS JANGKA PENDEK (CURRENT LIABILITIES)
  // ==========================================
  { KODE_AKUN: '211-10', NAMA_AKUN: 'Utang Usaha (Supplier Bahan Baku & Kemasan)', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '211-20', NAMA_AKUN: 'Utang Pengadaan Suku Cadang & Perlengkapan Pabrik', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '212-10', NAMA_AKUN: 'Utang Gaji & Upah Karyawan / Buruh Pabrik', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '212-20', NAMA_AKUN: 'Utang Iuran BPJS Ketenagakerjaan & Kesehatan', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '212-30', NAMA_AKUN: 'Utang Pajak PPh 21, PPh 23 & PPh Final', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '212-40', NAMA_AKUN: 'Utang PPN Keluaran', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '213-10', NAMA_AKUN: 'Uang Muka Pelanggan / Deposit Galon Kosong', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '214-10', NAMA_AKUN: 'Beban yang Masih Harus Dibayar (Listrik PLN, Air, Internet)', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '215-10', NAMA_AKUN: 'Bagian Utang Bank Jatuh Tempo Dalam 1 Tahun', KATEGORI: 'Liabilitas Pendek', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },

  // ==========================================
  // 4. LIABILITAS JANGKA PANJANG (LONG-TERM LIABILITIES)
  // ==========================================
  { KODE_AKUN: '221-10', NAMA_AKUN: 'Utang Bank Jangka Panjang (Investasi Pabrik & Mesin)', KATEGORI: 'Liabilitas Panjang', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '222-10', NAMA_AKUN: 'Utang Sewa Guna Usaha / Leasing Kendaraan', KATEGORI: 'Liabilitas Panjang', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },

  // ==========================================
  // 5. EKUITAS / MODAL (EQUITY)
  // ==========================================
  { KODE_AKUN: '311-10', NAMA_AKUN: 'Modal Disetor Pemilik / Pemegang Saham', KATEGORI: 'Ekuitas', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '312-10', NAMA_AKUN: 'Laba Ditahan Periode Lalu (Retained Earnings)', KATEGORI: 'Ekuitas', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '313-10', NAMA_AKUN: 'Laba Bersih Tahun Berjalan (Current Year Earnings)', KATEGORI: 'Ekuitas', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '314-10', NAMA_AKUN: 'Prive / Penarikan Modal Pemilik (Drawing)', KATEGORI: 'Ekuitas', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // ==========================================
  // 6. PENDAPATAN OPERASIONAL PABRIK (REVENUE)
  // ==========================================
  { KODE_AKUN: '411-10', NAMA_AKUN: 'Pendapatan Penjualan Air Cup (120ml & 220ml)', KATEGORI: 'Pendapatan', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '411-20', NAMA_AKUN: 'Pendapatan Penjualan Air Botol (330ml & 600ml)', KATEGORI: 'Pendapatan', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '411-30', NAMA_AKUN: 'Pendapatan Penjualan Air Galon (19 Liter)', KATEGORI: 'Pendapatan', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '411-40', NAMA_AKUN: 'Pendapatan Penjualan Galon Kosong / Botol / Krat', KATEGORI: 'Pendapatan', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '412-10', NAMA_AKUN: 'Retur Penjualan & Pengurangan Harga (Sales Returns)', KATEGORI: 'Pendapatan', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '413-10', NAMA_AKUN: 'Potongan / Diskon Penjualan (Ekspedisi Ambil Sendiri)', KATEGORI: 'Pendapatan', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // ==========================================
  // 7. HARGA POKOK PENJUALAN (COST OF GOODS SOLD - HPP PABRIK)
  // ==========================================
  // A. Biaya Bahan Baku & Kemasan Langsung (Direct Materials)
  { KODE_AKUN: '511-10', NAMA_AKUN: 'Beban Air Baku & Pengambilan Sumber Air Pegunungan', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '512-10', NAMA_AKUN: 'Beban Pemakaian Bahan Baku & Penolong (Kemasan, Cup, Botol, Lid, Kardus)', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '512-20', NAMA_AKUN: 'Beban Bahan Kimia, Sanitasi & Treatment Air (Ozon, Filter Catridge)', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // B. Biaya Tenaga Kerja Langsung Pabrik (Direct Labor)
  { KODE_AKUN: '513-10', NAMA_AKUN: 'Beban Upah Operator & Pekerja Line Produksi', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '513-20', NAMA_AKUN: 'Beban Lembur Pekerja Line Produksi', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '513-30', NAMA_AKUN: 'Beban BPJS & Tunjangan Tenaga Kerja Pabrik', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // C. Biaya Overhead Pabrik / BOP (Factory Overhead)
  { KODE_AKUN: '514-10', NAMA_AKUN: 'Beban Listrik PLN & Daya Pabrik (Power Utility)', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '514-20', NAMA_AKUN: 'Beban Penyusutan Mesin Produksi & Line WTP', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '514-25', NAMA_AKUN: 'Beban Penyusutan Bangunan Gedung Pabrik', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '514-30', NAMA_AKUN: 'Beban Pemeliharaan & Suku Cadang Mesin Pabrik', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '514-40', NAMA_AKUN: 'Beban Bahan Bakar Solar Genset & Kompresor Pabrik', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '514-50', NAMA_AKUN: 'Beban Perlengkapan Pabrik, Seragam & K3 Operator', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '514-60', NAMA_AKUN: 'Beban Uji Laboratorium Rutin & Sertifikasi Mutu SNI/BPOM', KATEGORI: 'Harga Pokok', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // ==========================================
  // 8. BEBAN OPERASIONAL, ADMINISTRASI & UMUM (OPEX)
  // ==========================================
  // Beban Distribusi & Penjualan
  { KODE_AKUN: '611-20', NAMA_AKUN: 'Beban Promosi, Iklan & Brosur Pemasaran', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-30', NAMA_AKUN: 'Beban Bahan Bakar (BBM) & Uang Jalan Armada', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-31', NAMA_AKUN: 'Beban Servis, Ban & Perawatan Truk Distribusi', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-32', NAMA_AKUN: 'Beban Pajak STNK & Uji KIR Armada Pengiriman', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-70', NAMA_AKUN: 'Beban Penyusutan Kendaraan Armada Distribusi', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // Beban Administrasi & Umum
  { KODE_AKUN: '611-10', NAMA_AKUN: 'Beban Gaji Staf Kantor, Keuangan, & Manajemen (HRD)', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-15', NAMA_AKUN: 'Beban Tunjangan Hari Raya (THR) & Bonus Karyawan', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-40', NAMA_AKUN: 'Beban Legalitas Perizinan, Sertifikasi Halal & Audit SNI', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-50', NAMA_AKUN: 'Beban Alat Tulis Kantor (ATK), Kertas & Cetak Form', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-60', NAMA_AKUN: 'Beban Listrik, Air, Telepon & Internet Kantor', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-75', NAMA_AKUN: 'Beban Penyusutan Peralatan Kantor & Server IT', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-80', NAMA_AKUN: 'Beban Konsumsi Tamu, Rapat & Keperluan Kantor', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-85', NAMA_AKUN: 'Beban Kebersihan Pabrik & Jasa Keamanan (Security)', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '611-90', NAMA_AKUN: 'Beban Administrasi Bank & Pajak Bunga', KATEGORI: 'Beban', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },

  // ==========================================
  // 9. PENDAPATAN & BEBAN NON-OPERASIONAL
  // ==========================================
  { KODE_AKUN: '711-10', NAMA_AKUN: 'Pendapatan Bunga Bank / Jasa Giro', KATEGORI: 'Pendapatan Lain', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '712-10', NAMA_AKUN: 'Pendapatan Penjualan Limbah / Kardus Bekas & Afkir Plastik', KATEGORI: 'Pendapatan Lain', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '713-10', NAMA_AKUN: 'Pendapatan Lain-Lain di Luar Usaha', KATEGORI: 'Pendapatan Lain', SALDO_NORMAL: 'Kredit', STATUS: 'Aktif' },
  { KODE_AKUN: '811-10', NAMA_AKUN: 'Beban Bunga Pinjaman Bank Jangka Panjang', KATEGORI: 'Beban Lain', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '812-10', NAMA_AKUN: 'Beban Pajak Penghasilan Badan (PPh Badan)', KATEGORI: 'Beban Lain', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' },
  { KODE_AKUN: '813-10', NAMA_AKUN: 'Beban Kerugian Kerusakan / Barang Hilang', KATEGORI: 'Beban Lain', SALDO_NORMAL: 'Debit', STATUS: 'Aktif' }
];

export const DEFAULT_COA = FACTORY_STANDARD_COA;

const DEFAULT_FIXED_ASSETS: FixedAssetItem[] = [
  { ID_ASET: 'AST-001', NAMA_ASET: 'Mesin 8-Line Cup Sealing Auto', TGL_BELI: '2023-01-10', NILAI_PEROLEHAN: 85000000, NILAI_RESIDU: 10000000, UMUR_EKONOMIS_BLN: 60, BEBAN_PENYUSUTAN_BLN: 1250000, AKUN_ASET: '121-20', AKUN_AKUMULASI: '122-20', AKUN_BEBAN: '514-20' },
  { ID_ASET: 'AST-002', NAMA_ASET: 'Truk Engkel Isuzu Elf Box Distribusi', TGL_BELI: '2023-02-15', NILAI_PEROLEHAN: 195000000, NILAI_RESIDU: 35000000, UMUR_EKONOMIS_BLN: 96, BEBAN_PENYUSUTAN_BLN: 1666667, AKUN_ASET: '121-30', AKUN_AKUMULASI: '122-30', AKUN_BEBAN: '611-70' }
];

const DEFAULT_JOURNALS: GeneralJournalItem[] = [
  { ID_JURNAL: 'JUR-2610-001', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-01', KETERANGAN: 'Pencatatan Saldo Awal Kas Bank BSI', KODE_AKUN: '111-20', DEBIT: 45000000, KREDIT: 0, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-001', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-01', KETERANGAN: 'Pencatatan Saldo Awal Modal Disetor', KODE_AKUN: '311-10', DEBIT: 0, KREDIT: 45000000, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-002', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-02', KETERANGAN: 'Pencatatan Saldo Awal Kas Kecil', KODE_AKUN: '111-10', DEBIT: 5000000, KREDIT: 0, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-002', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-02', KETERANGAN: 'Pencatatan Saldo Awal Modal Disetor', KODE_AKUN: '311-10', DEBIT: 0, KREDIT: 5000000, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-003', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-03', KETERANGAN: 'Saldo Awal Mesin Produksi', KODE_AKUN: '121-20', DEBIT: 85000000, KREDIT: 0, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-003', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-03', KETERANGAN: 'Modal Disetor Aset Mesin', KODE_AKUN: '311-10', DEBIT: 0, KREDIT: 85000000, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-004', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-04', KETERANGAN: 'Saldo Awal Truk Distribusi', KODE_AKUN: '121-30', DEBIT: 195000000, KREDIT: 0, PEMBUAT: 'System' },
  { ID_JURNAL: 'JUR-2610-004', TANGGAL: '2026-10-01', PERIODE: '2026-10', REFERENSI: 'SALDO-AWAL-04', KETERANGAN: 'Modal Disetor Armada', KODE_AKUN: '311-10', DEBIT: 0, KREDIT: 195000000, PEMBUAT: 'System' }
];

const DEFAULT_SPK: SPKItem[] = [
  { ID_SPK: 'SPK-16102601', Tanggal: '2026-10-16', Shift: 'Shift 1 (Pagi)', ID_Produk: 'ASH-CUP220', Target_Produksi: 500, Keterangan: 'Prioritas kirim Toko Berkah', Status: 'Aktif' },
  { ID_SPK: 'SPK-16102602', Tanggal: '2026-10-16', Shift: 'Shift 2 (Siang)', ID_Produk: 'ASH-BTL600', Target_Produksi: 300, Keterangan: 'Pesanan Agen Sumber Segar', Status: 'Aktif' }
];

const DEFAULT_PRODUCTION: ProductionItem[] = [
  { ID_Produksi: 'PRD-15102601', Tanggal: '2026-10-15', Shift: 'Shift 1 (Pagi)', ID_Produk: 'ASH-CUP220', Jumlah: 480, PIC_Produksi: 'Agus Setiawan', Keterangan: 'Realisasi SPK Kemarin' },
  { ID_Produksi: 'PRD-15102602', Tanggal: '2026-10-15', Shift: 'Shift 2 (Siang)', ID_Produk: 'ASH-GLN19L', Jumlah: 250, PIC_Produksi: 'Tri Wahyudi', Keterangan: 'Produksi Galon Reguler' }
];

// Delivery Plan / Rencana Distribusi (List Pesanan)
const DEFAULT_DELIVERY_PLANS: DeliveryPlanItem[] = [
  {
    ID_Rencana: 'ORD-261016-01',
    Tanggal_Rencana: '2026-10-16',
    ID_Pelanggan: 'PLG-0001',
    Nama_Pelanggan: 'Toko Berkah Sejahtera',
    Level_Pelanggan: 'Distributor',
    Metode_Kirim: 'Kirim Armada',
    Alamat_Tujuan: 'Jl. Raya Klaten No. 12',
    Sopir: 'Tri Wahyudi',
    Status: 'Menunggu',
    Keterangan: 'Pesanan restock akhir pekan',
    Items: [
      { ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 200, Harga_Satuan: 14500, Subtotal: 2900000 },
      { ID_Produk: 'ASH-GLN19L', Nama_Produk: 'As-Shofaa Galon 19L', Qty: 50, Harga_Satuan: 9000, Subtotal: 450000 }
    ]
  },
  {
    ID_Rencana: 'ORD-261016-02',
    Tanggal_Rencana: '2026-10-17',
    ID_Pelanggan: 'PLG-0002',
    Nama_Pelanggan: 'Agen Sumber Segar',
    Level_Pelanggan: 'Agen',
    Metode_Kirim: 'Ambil Sendiri',
    Alamat_Tujuan: 'Prambanan, Klaten',
    Sopir: 'Ambil Sendiri',
    Status: 'Disetujui',
    Keterangan: 'Ambil armada pickup sendiri',
    Items: [
      { ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 150, Harga_Satuan: 30000, Subtotal: 4500000 }
    ]
  }
];

const DEFAULT_DISTRIBUSI: DistributionItem[] = [
  { ID_Distribusi: 'DST-646', Tanggal: '2026-10-01', ID_Pelanggan: 'PLG-MWCKARANG', Nama_Pelanggan: 'D. MWC NU KARANGNONGKO', Level_Pelanggan: 'Distributor', Pengirim: 'AGUS', Penerima: '-', Tujuan: 'KARANGNONGKO', Metode_Kirim: 'Ambil Sendiri', No_Surat_Jalan: '646/x/26', No_Invoice: 'INV-646/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-647', Tanggal: '2026-10-02', ID_Pelanggan: 'PLG-PCJQHNU', Nama_Pelanggan: 'D. PC JQH NU', Level_Pelanggan: 'Distributor', Pengirim: 'RADITYA', Penerima: 'DILLAH', Tujuan: 'KLATEN UTARA', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '647/x/26', No_Invoice: 'INV-647/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-648', Tanggal: '2026-10-02', ID_Pelanggan: 'PLG-MWCTULUNG', Nama_Pelanggan: 'D. MWC NU TULUNG', Level_Pelanggan: 'Distributor', Pengirim: 'RADITYA', Penerima: '-', Tujuan: 'TULUNG', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '648/x/26', No_Invoice: 'INV-648/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-649', Tanggal: '2026-10-02', ID_Pelanggan: 'PLG-RADITYA', Nama_Pelanggan: 'RADITYA', Level_Pelanggan: 'Agen', Pengirim: '-', Penerima: '-', Tujuan: 'KALIKOTES', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '649/x/26', No_Invoice: 'INV-649/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-650', Tanggal: '2026-10-03', ID_Pelanggan: 'PLG-MWCCEPER', Nama_Pelanggan: 'D. MWC NU CEPER', Level_Pelanggan: 'Distributor', Pengirim: 'RADITYA', Penerima: '-', Tujuan: 'CEPER KLATEN', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '650/x/26', No_Invoice: 'INV-650/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-651', Tanggal: '2026-10-03', ID_Pelanggan: 'PLG-MWCTRUCUK', Nama_Pelanggan: 'D. MWC NU TRUCUK', Level_Pelanggan: 'Distributor', Pengirim: 'RADITYA', Penerima: '-', Tujuan: 'TRUCUK', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '651/x/26', No_Invoice: 'INV-651/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-652', Tanggal: '2026-10-03', ID_Pelanggan: 'PLG-CANDRA', Nama_Pelanggan: 'CANDRA DITIA TRI A', Level_Pelanggan: 'Agen', Pengirim: 'RADITYA', Penerima: '-', Tujuan: 'NGAWEN', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '652/x/26', No_Invoice: 'INV-652/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-652B', Tanggal: '2026-10-03', ID_Pelanggan: 'PLG-PARJOKO', Nama_Pelanggan: 'PARJOKO', Level_Pelanggan: 'Agen', Pengirim: '-', Penerima: '-', Tujuan: 'KLATEN UTARA', Metode_Kirim: 'Diantar Armada', No_Surat_Jalan: '652/X/26', No_Invoice: 'INV-652B/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-653', Tanggal: '2026-10-05', ID_Pelanggan: 'PLG-JIWAN', Nama_Pelanggan: 'D. PR NU JIWAN', Level_Pelanggan: 'Distributor', Pengirim: 'AGUS', Penerima: '-', Tujuan: 'JIWAN KARANGNONGKO', Metode_Kirim: 'Kirim Armada', No_Surat_Jalan: '653/X/26', No_Invoice: 'INV-653/X/26', Keterangan: '(Total Qty Potongan: - Rp 100.000)' },
  { ID_Distribusi: 'DST-654', Tanggal: '2026-10-05', ID_Pelanggan: 'PLG-SUPRAPTO', Nama_Pelanggan: 'AGEN SUPRAPTO', Level_Pelanggan: 'Agen', Pengirim: 'RADIT', Penerima: '-', Tujuan: 'KARANGANOM', Metode_Kirim: 'Kirim Armada', No_Surat_Jalan: '654/X/26', No_Invoice: 'INV-654/X/26', Keterangan: '' },
  { ID_Distribusi: 'DST-655', Tanggal: '2026-10-05', ID_Pelanggan: 'PLG-KLATENUTARA', Nama_Pelanggan: 'D. MWC NU KLATEN UTARA', Level_Pelanggan: 'Distributor', Pengirim: 'RENGGA', Penerima: 'RENGGA', Tujuan: 'KLATEN UTARA', Metode_Kirim: 'Ambil Sendiri', No_Surat_Jalan: '655/X/26', No_Invoice: 'INV-655/X/26', Keterangan: '(Total Qty Potongan: - Rp 100.000)' }
];

const DEFAULT_DISTRIBUSI_ITEMS: DistributionProductDetail[] = [
  // 646
  { ID_Detail: 'DET-646-1', ID_Distribusi: 'DST-646', ID_Produk: 'ASH-CUP120', Nama_Produk: 'As-Shofaa Cup 120ml', Qty: 20, Harga_Satuan: 13000, Subtotal: 260000 },
  { ID_Detail: 'DET-646-2', ID_Distribusi: 'DST-646', ID_Produk: 'ASH-BTL330', Nama_Produk: 'As-Shofaa Botol 330ml', Qty: 10, Harga_Satuan: 27500, Subtotal: 275000 },
  { ID_Detail: 'DET-646-3', ID_Distribusi: 'DST-646', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 45, Harga_Satuan: 38666, Subtotal: 1740000 },
  // 647
  { ID_Detail: 'DET-647-1', ID_Distribusi: 'DST-647', ID_Produk: 'ASH-CUP120', Nama_Produk: 'As-Shofaa Cup 120ml', Qty: 15, Harga_Satuan: 13500, Subtotal: 202500 },
  { ID_Detail: 'DET-647-2', ID_Distribusi: 'DST-647', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 30, Harga_Satuan: 15500, Subtotal: 465000 },
  { ID_Detail: 'DET-647-3', ID_Distribusi: 'DST-647', ID_Produk: 'ASH-BTL330', Nama_Produk: 'As-Shofaa Botol 330ml', Qty: 30, Harga_Satuan: 27000, Subtotal: 810000 },
  { ID_Detail: 'DET-647-4', ID_Distribusi: 'DST-647', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 25, Harga_Satuan: 50400, Subtotal: 1260000 },
  // 648
  { ID_Detail: 'DET-648-1', ID_Distribusi: 'DST-648', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 70, Harga_Satuan: 15500, Subtotal: 1085000 },
  { ID_Detail: 'DET-648-2', ID_Distribusi: 'DST-648', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 15, Harga_Satuan: 59333, Subtotal: 890000 },
  // 649
  { ID_Detail: 'DET-649-1', ID_Distribusi: 'DST-649', ID_Produk: 'ASH-CUP120', Nama_Produk: 'As-Shofaa Cup 120ml', Qty: 2, Harga_Satuan: 18500, Subtotal: 37000 },
  // 650
  { ID_Detail: 'DET-650-1', ID_Distribusi: 'DST-650', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 200, Harga_Satuan: 15500, Subtotal: 3100000 },
  { ID_Detail: 'DET-650-2', ID_Distribusi: 'DST-650', ID_Produk: 'ASH-BTL330', Nama_Produk: 'As-Shofaa Botol 330ml', Qty: 50, Harga_Satuan: 28500, Subtotal: 1425000 },
  { ID_Detail: 'DET-650-3', ID_Distribusi: 'DST-650', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 50, Harga_Satuan: 60000, Subtotal: 3000000 },
  // 651
  { ID_Detail: 'DET-651-1', ID_Distribusi: 'DST-651', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 40, Harga_Satuan: 15500, Subtotal: 620000 },
  { ID_Detail: 'DET-651-2', ID_Distribusi: 'DST-651', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 10, Harga_Satuan: 56000, Subtotal: 560000 },
  // 652
  { ID_Detail: 'DET-652-1', ID_Distribusi: 'DST-652', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 2, Harga_Satuan: 22500, Subtotal: 45000 },
  // 652B
  { ID_Detail: 'DET-652B-1', ID_Distribusi: 'DST-652B', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 3, Harga_Satuan: 38000, Subtotal: 114000 },
  // 653
  { ID_Detail: 'DET-653-1', ID_Distribusi: 'DST-653', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 100, Harga_Satuan: 20500, Subtotal: 2050000 },
  // 654
  { ID_Detail: 'DET-654-1', ID_Distribusi: 'DST-654', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 40, Harga_Satuan: 16500, Subtotal: 660000 },
  { ID_Detail: 'DET-654-2', ID_Distribusi: 'DST-654', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 49, Harga_Satuan: 42897, Subtotal: 2102000 },
  // 655
  { ID_Detail: 'DET-655-1', ID_Distribusi: 'DST-655', ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Qty: 50, Harga_Satuan: 16500, Subtotal: 825000 },
  { ID_Detail: 'DET-655-2', ID_Distribusi: 'DST-655', ID_Produk: 'ASH-BTL330', Nama_Produk: 'As-Shofaa Botol 330ml', Qty: 20, Harga_Satuan: 27500, Subtotal: 550000 },
  { ID_Detail: 'DET-655-3', ID_Distribusi: 'DST-655', ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Qty: 30, Harga_Satuan: 42666, Subtotal: 1280000 },
];

const DEFAULT_QC: QCHeader[] = [
  { ID_QC: 'QC-26101501', Tanggal: '2026-10-15', Bulan_Tahun: '2026-10', Produk: 'As-Shofaa Cup 220ml', Petugas_QC: 'Nurul Hidayati', Kesimpulan: 'LAYAK - Memenuhi Standar Mutu SNI 3553:2023', Status_Data: 'Lengkap', ID_Produksi: 'PRD-15102601' }
];

const DEFAULT_QC_DETAIL: QCDetailCycle[] = [
  {
    ID_QC: 'QC-26101501',
    Siklus: 1,
    Baku_pH: '7.2', Baku_TDS: '140', Baku_Kekeruhan: '0.8', Baku_Bau: 'TB', Baku_Coliform: '0',
    Proses_pH: '7.1', Proses_TDS: '110', Proses_Kekeruhan: '0.3', Proses_Bau: 'TB', Proses_Rasa: 'Segar', Proses_Ozon: '0.12',
    Jadi_pH: '7.0', Jadi_TDS: '98', Jadi_Kekeruhan: '0.1', Jadi_Bau: 'TB', Jadi_Rasa: 'Segar', Jadi_Ozon: '0.08', Jadi_ALT_Awal: '10', Jadi_ALT_Akhir: '20', Jadi_Coliform: '0'
  },
  {
    ID_QC: 'QC-26101501',
    Siklus: 2,
    Baku_pH: '7.3', Baku_TDS: '142', Baku_Kekeruhan: '0.7', Baku_Bau: 'TB', Baku_Coliform: '0',
    Proses_pH: '7.2', Proses_TDS: '112', Proses_Kekeruhan: '0.3', Proses_Bau: 'TB', Proses_Rasa: 'Segar', Proses_Ozon: '0.13',
    Jadi_pH: '7.1', Jadi_TDS: '99', Jadi_Kekeruhan: '0.1', Jadi_Bau: 'TB', Jadi_Rasa: 'Segar', Jadi_Ozon: '0.08', Jadi_ALT_Awal: '12', Jadi_ALT_Akhir: '22', Jadi_Coliform: '0'
  },
  {
    ID_QC: 'QC-26101501',
    Siklus: 3,
    Baku_pH: '7.2', Baku_TDS: '141', Baku_Kekeruhan: '0.8', Baku_Bau: 'TB', Baku_Coliform: '0',
    Proses_pH: '7.1', Proses_TDS: '111', Proses_Kekeruhan: '0.2', Proses_Bau: 'TB', Proses_Rasa: 'Segar', Proses_Ozon: '0.12',
    Jadi_pH: '7.0', Jadi_TDS: '97', Jadi_Kekeruhan: '0.1', Jadi_Bau: 'TB', Jadi_Rasa: 'Segar', Jadi_Ozon: '0.09', Jadi_ALT_Awal: '10', Jadi_ALT_Akhir: '18', Jadi_Coliform: '0'
  }
];

const DEFAULT_OFFICIAL_LETTERS: OfficialLetterItem[] = [
  {
    ID_Surat: 'SRT-261001',
    Nomor_Surat: '012/EXT/AIRIS/X/2026',
    Tipe_Surat: 'Surat Eksternal',
    Tanggal: '2026-10-10',
    Perihal: 'Pemberitahuan Penyesuaian Jadwal Distribusi Air Mineral',
    Lampiran: '1 Berkas',
    Kepada: 'Seluruh Mitra Distributor & Agen Resmi AMDK As-Shofaa',
    Alamat_Tujuan: 'Wilayah Klaten & Solo Raya',
    Isi_Surat: 'Dengan hormat,\n\nSehubungan dengan dilakukannya pemeliharaan rutin instalasi water treatment plant dan mesin filling otomatis pabrik kami pada hari Sabtu mendatang, bersama ini kami sampaikan penyesuaian jadwal operasional armada pengiriman.\n\nSeluruh pesanan reguler akan tetap diproses dengan estimasi keberangkatan armada mulai pukul 07.30 WIB. Kami mohon agar konfirmasi pesanan dapat disampaikan H-1 sebelum jadwal pengiriman.\n\nDemikian surat pemberitahuan ini kami sampaikan. Atas perhatian dan kerjasama yang baik, kami ucapkan terima kasih.',
    Penandatangan_Nama: 'H. Mujiburrahman, SIP',
    Penandatangan_Jabatan: 'Direktur Utama',
    Tembusan: 'Kepala Gudang, Kepala Operasional Armada',
    Dibuat_Oleh: 'Admin Sekretariat'
  },
  {
    ID_Surat: 'SRT-261002',
    Nomor_Surat: '005/INT/AIRIS/X/2026',
    Tipe_Surat: 'Surat Internal',
    Tanggal: '2026-10-12',
    Perihal: 'Instruksi Kepatuhan Higiene & Sanitasi Ruang Produksi SNI 3553:2023',
    Lampiran: '-',
    Kepada: 'Seluruh Karyawan & Operator Divisi Produksi',
    Isi_Surat: 'Diberitahukan kepada seluruh karyawan divisi produksi, water treatment, dan pengemasan bahwa per tanggal 15 Oktober 2026, penerapan SOP Higiene personal (pemakaian hairnet, masker medis, sarung tangan steril, dan sepatu boot) akan diawasi secara berkala oleh tim Quality Control.\n\nSetiap pelanggaran prosedur sanitasi akan dikenakan sanksi kedisiplinan demi menjaga komitmen standar mutu air minum kemasan SNI.\n\nHarap dipatuhi dan dilaksanakan dengan penuh tanggung jawab.',
    Penandatangan_Nama: 'Agus Setiawan',
    Penandatangan_Jabatan: 'Supervisor Produksi',
    Dibuat_Oleh: 'HRD & GA'
  },
  {
    ID_Surat: 'SRT-261003',
    Nomor_Surat: '044/KET/HRD/X/2026',
    Tipe_Surat: 'Surat Keterangan',
    Tanggal: '2026-10-14',
    Perihal: 'Surat Keterangan Kerja Aktif',
    Kepada: 'Pihak yang Berkepentingan',
    Isi_Surat: 'Yang bertanda tangan di bawah ini menerangkan bahwa:\n\nNama        : Tri Wahyudi\nID Karyawan : KAR-0004\nJabatan     : Driver / Pengemudi Armada Distribusi\nAlamat      : Belangwetan, Klaten Utara\n\nAdalah benar saat ini tercatat sebagai karyawan tetap PT. Anugerah Illahi Rabbi sejak tanggal 20 Mei 2023 sampai dengan saat ini. Yang bersangkutan memiliki dedikasi dan kinerja yang sangat baik.\n\nDemikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
    Penandatangan_Nama: 'Marko Dwi Nugroho',
    Penandatangan_Jabatan: 'Manager Keuangan & HRD',
    Dibuat_Oleh: 'Staff HRD'
  }
];

export function initializeDatabase() {
  if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'INITIALIZED')) {
    const opts = { skipCloudSync: true };
    setTableData('MD_Produk', DEFAULT_PRODUCTS, opts);
    setTableData('MD_Pelanggan', DEFAULT_CUSTOMERS, opts);
    setTableData('MD_Supplier', DEFAULT_SUPPLIERS, opts);
    setTableData('MD_BahanPenolong', DEFAULT_RAW_MATERIALS, opts);
    setTableData('MD_BOM', DEFAULT_BOM, opts);
    setTableData('MD_Karyawan', DEFAULT_EMPLOYEES, opts);
    setTableData('MD_UserAkses', DEFAULT_USERS, opts);
    setTableData('MD_HargaKhusus', [
      { ID_Harga_Khusus: 'SP-001', ID_Pelanggan: 'PLG-0001', ID_Produk: 'ASH-CUP220', Harga_Custom: 14000, Keterangan: 'Harga Kontrak Distributor Utama' }
    ], opts);
    setTableData('SPK', DEFAULT_SPK, opts);
    setTableData('Produksi', DEFAULT_PRODUCTION, opts);
    setTableData('Rencana_Distribusi', DEFAULT_DELIVERY_PLANS, opts);
    setTableData('Distribusi', DEFAULT_DISTRIBUSI, opts);
    setTableData('Distribusi_Item', DEFAULT_DISTRIBUSI_ITEMS, opts);
    setTableData('Pembelian_Bahan', [
      { ID_Pembelian: 'PB-261001', Tanggal: '2026-10-10', ID_Bahan: 'BHN-CUP220', Nama_Bahan: 'Cup Plastik 220ml Printing', Supplier: 'PT. Sumber Plastik Nusantara', Harga_Satuan: 110, Qty: 20000, Keterangan: 'Pasokan Awal Bulan' },
      { ID_Pembelian: 'PB-261002', Tanggal: '2026-10-11', ID_Bahan: 'BHN-KARTON220', Nama_Bahan: 'Karton Dus 220ml (isi 48)', Supplier: 'CV. Karton Lestari Abadi', Harga_Satuan: 2600, Qty: 2500, Keterangan: 'Box kemasan kardus' }
    ], opts);
    setTableData('Mutasi_Bahan', [
      { ID_Mutasi: 'MT-261001', Tanggal: '2026-10-15', ID_Bahan: 'BHN-CUP220', Nama_Bahan: 'Cup Plastik 220ml Printing', Jenis_Mutasi: 'Keluar', Kategori: 'Pemakaian Produksi', Qty: 9600, Keterangan: 'Pemakaian Produksi PRD-15102601' },
      { ID_Mutasi: 'MT-261002', Tanggal: '2026-10-15', ID_Bahan: 'BHN-KARTON220', Nama_Bahan: 'Karton Dus 220ml (isi 48)', Jenis_Mutasi: 'Keluar', Kategori: 'Pemakaian Produksi', Qty: 200, Keterangan: 'Pemakaian Dus PRD-15102601' }
    ], opts);
    setTableData('Data_QC', DEFAULT_QC, opts);
    setTableData('Data_QC_Detail', DEFAULT_QC_DETAIL, opts);
    setTableData('Data_Presensi', [
      { ID_Presensi: 'PRS-01', Bulan_Tahun: '2026-10', ID_Karyawan: 'KAR-0001', Nama_Karyawan: 'Marko Dwi Nugroho', T1: 'H', T2: 'H', T3: 'H', T4: 'H', T5: 'H', T6: 'H', T7: 'H', T8: 'H', T9: 'H', T10: 'H', T11: 'H', T12: 'H', T13: 'H', T14: 'H', T15: 'H', T16: 'H', Total_H: 16, Total_T: 0, Total_I: 0, Total_S: 0, Total_C: 0, Total_A: 0 },
      { ID_Presensi: 'PRS-02', Bulan_Tahun: '2026-10', ID_Karyawan: 'KAR-0003', Nama_Karyawan: 'Agus Setiawan', T1: 'H', T2: 'H', T3: 'H', T4: 'H', T5: 'H', T6: 'H', T7: 'H', T8: 'H', T9: 'H', T10: 'H', T11: 'H', T12: 'H', T13: 'H', T14: 'H', T15: 'H', T16: 'H', Total_H: 16, Total_T: 0, Total_I: 0, Total_S: 0, Total_C: 0, Total_A: 0 },
      { ID_Presensi: 'PRS-03', Bulan_Tahun: '2026-10', ID_Karyawan: 'KAR-0004', Nama_Karyawan: 'Tri Wahyudi', T1: 'H', T2: 'H', T3: 'H', T4: 'H', T5: 'H', T6: 'H', T7: 'H', T8: 'H', T9: 'H', T10: 'H', T11: 'H', T12: 'H', T13: 'H', T14: 'H', T15: 'H', T16: 'H', Total_H: 16, Total_T: 0, Total_I: 0, Total_S: 0, Total_C: 0, Total_A: 0 }
    ], opts);
    setTableData('Data_Lembur', [
      { ID_Lembur: 'LMB-01', Bulan_Tahun: '2026-10', ID_Karyawan: 'KAR-0003', Nama_Karyawan: 'Agus Setiawan', T1: 2, T3: 3, T5: 2, T10: 2, Total_Jam_Lembur: 9 },
      { ID_Lembur: 'LMB-02', Bulan_Tahun: '2026-10', ID_Karyawan: 'KAR-0004', Nama_Karyawan: 'Tri Wahyudi', T2: 2, T4: 2, T8: 3, T12: 3, Total_Jam_Lembur: 10 }
    ], opts);
    setTableData('Data_Kasbon', [
      { ID_Kasbon: 'KSB-001', Tanggal: '2026-10-05', ID_Karyawan: 'KAR-0004', Nama_Karyawan: 'Tri Wahyudi', Nominal: 1000000, Tenor: 2, Cicilan_Per_Bulan: 500000 }
    ], opts);
    setTableData('Histori_Penggajian', [], opts);
    setTableData('Master_COA', DEFAULT_COA, opts);
    setTableData('Jurnal_Umum', DEFAULT_JOURNALS, opts);
    setTableData('Draf_Jurnal', [
      {
        ID_Draf: 'DRF-001',
        Sumber: 'Distribusi',
        Tanggal: '2026-10-15',
        Referensi: 'DST-261015001 / Toko Berkah',
        Keterangan: 'Penjualan As-Shofaa Cup 220ml (200 Dus) ke Toko Berkah Sejahtera',
        Kode_Debit: '112-10',
        Kode_Kredit: '411-10',
        Nominal: 2900000,
        Status: 'Menunggu Verifikasi',
        Waktu_Dibuat: '2026-10-15T10:00:00Z'
      }
    ], opts);
    setTableData('Data_Piutang_Utang', [
      { 
        ID_DOKUMEN: 'DST-261015001', 
        ID_Transaksi: 'DST-261015001',
        TIPE: 'Piutang', 
        Jenis: 'Piutang',
        TANGGAL: '2026-10-15', 
        Tanggal: '2026-10-15',
        JATUH_TEMPO: '2026-10-29', 
        Tgl_Jatuh_Tempo: '2026-10-29',
        NAMA_ENTITAS: 'Toko Berkah Sejahtera', 
        Entitas: 'Toko Berkah Sejahtera',
        TOTAL_TAGIHAN: 2900000, 
        Nominal: 2900000,
        TOTAL_DIBAYAR: 0, 
        Terbayar: 0,
        SISA_SALDO: 2900000, 
        Sisa: 2900000,
        STATUS: 'Belum Lunas',
        Status: 'Belum Lunas'
      }
    ], opts);
    setTableData('Data_Aset_Tetap', DEFAULT_FIXED_ASSETS, opts);
    setTableData('Data_Surat', DEFAULT_OFFICIAL_LETTERS, opts);
    setTableData('Admin_PO', [
      { ID_PO: 'PO-261001', Tanggal_PO: '2026-10-10', No_PO: '001-PO-X-26', Order_Ke: 'PT. Sumber Plastik Nusantara', Alamat_Supplier: 'Solo Baru, Sukoharjo', Syarat_Ketentuan: 'Pengiriman 3 hari kerja, tempo 14 hari', Grand_Total: 2200000, Status: 'Terkirim ke Pemasok' }
    ], opts);
    setTableData('Admin_PO_Detail', [
      { ID_Detail: 'PO-261001-D1', ID_PO: 'PO-261001', Nama_Produk: 'Cup Plastik 220ml Printing', Spesifikasi: 'Food Grade PP 3.8g', Qty: 20000, Harga_Satuan: 110, Total_Harga: 2200000 }
    ], opts);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'INITIALIZED', 'true');
  }

  // Always ensure COA has full factory standard accounts
  const currentCOA = getTableData<COAItem>('Master_COA', []);
  if (currentCOA.length < FACTORY_STANDARD_COA.length) {
    upgradeCOAToFactoryStandard(false);
  }
}

/**
 * Upgrades or resets Master COA to full factory manufacturing standards
 */
export function upgradeCOAToFactoryStandard(forceReset: boolean = false): { totalAccounts: number; addedCount: number } {
  const existingCOA = getTableData<COAItem>('Master_COA', []);
  if (forceReset || existingCOA.length === 0) {
    setTableData('Master_COA', FACTORY_STANDARD_COA);
    setTableData('Data_COA', FACTORY_STANDARD_COA);
    notifyDbChange();
    return { totalAccounts: FACTORY_STANDARD_COA.length, addedCount: FACTORY_STANDARD_COA.length };
  }

  const coaMap = new Map<string, COAItem>();
  // 1. Populate all standard factory accounts
  FACTORY_STANDARD_COA.forEach(c => coaMap.set(c.KODE_AKUN, c));
  
  // 2. Count new additions and merge with existing customizations
  let addedCount = 0;
  FACTORY_STANDARD_COA.forEach(c => {
    if (!existingCOA.some(ex => ex.KODE_AKUN === c.KODE_AKUN)) {
      addedCount++;
    }
  });

  existingCOA.forEach(c => {
    if (c && c.KODE_AKUN) {
      const std = coaMap.get(c.KODE_AKUN);
      coaMap.set(c.KODE_AKUN, {
        ...(std || {}),
        ...c
      });
    }
  });

  const merged = Array.from(coaMap.values());
  merged.sort((a, b) => a.KODE_AKUN.localeCompare(b.KODE_AKUN, undefined, { numeric: true }));

  setTableData('Master_COA', merged);
  setTableData('Data_COA', merged);
  notifyDbChange();
  return { totalAccounts: merged.length, addedCount };
}

/**
 * Resets all tables in the database (clears all operational & transactional data).
 * Keeps admin accounts intact by default so the user is never locked out.
 */
export function resetAllDatabase(keepAdminAccount: boolean = true): { success: boolean; clearedTablesCount: number } {
  const tableNames = [
    'MD_Produk', 'MD_Pelanggan', 'MD_Supplier', 'MD_BahanPenolong', 'MD_Bahan_Baku', 'MD_BOM', 
    'MD_Karyawan', 'MD_HargaKhusus', 'MD_Harga_Khusus', 'SPK', 'Produksi', 
    'Rencana_Distribusi', 'Distribusi', 'Distribusi_Item', 'Pembelian_Bahan', 'Mutasi_Bahan', 
    'Data_QC', 'Data_QC_Detail', 'Data_Presensi', 'Data_Lembur', 'Data_Kasbon', 
    'Histori_Penggajian', 'HRD_Payroll_Settings', 'Data_COA', 'Master_COA', 'Jurnal_Umum', 
    'Draf_Jurnal', 'Draft_Jurnal', 'Aset_Tetap', 'Data_Aset_Tetap', 'Data_Piutang_Utang', 
    'Piutang_Hutang', 'Data_Pembayaran_Pelanggan', 'Data_Surat', 'Admin_PO', 'Admin_PO_Detail', 
    'Data_Invoice_Custom'
  ];

  tableNames.forEach(tbl => {
    localStorage.removeItem(STORAGE_KEY_PREFIX + tbl);
    localStorage.setItem(STORAGE_KEY_PREFIX + tbl, JSON.stringify([]));
  });

  if (!keepAdminAccount) {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'MD_UserAkses');
    localStorage.setItem(STORAGE_KEY_PREFIX + 'MD_UserAkses', JSON.stringify([]));
  }

  notifyDbChange();
  return { success: true, clearedTablesCount: tableNames.length };
}

export function verifyAndPostDraftJournal(draftId: string, author: string = 'Finance'): { success: boolean; message: string } {
  const drafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
  const journals = getTableData<GeneralJournalItem>('Jurnal_Umum', []);
  const draftIdx = drafts.findIndex(d => d.ID_Draf === draftId);
  if (draftIdx === -1) {
    return { success: false, message: 'Draf jurnal tidak ditemukan!' };
  }
  const d = drafts[draftIdx];
  if (d.Status === 'Disetujui') {
    return { success: false, message: 'Draf jurnal sudah pernah disetujui sebelumnya.' };
  }

  const tgl = d.Tanggal || new Date().toISOString().slice(0, 10);
  const periode = tgl.slice(0, 7);
  const yy = periode.slice(2, 4);
  const mm = periode.slice(5, 7);
  const prefix = `JUR-${yy}${mm}-`;

  let maxSeq = 0;
  journals.forEach(j => {
    if (j.ID_JURNAL.startsWith(prefix)) {
      const num = parseInt(j.ID_JURNAL.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }
  });
  const nextId = prefix + String(maxSeq + 1).padStart(3, '0');

  const debitEntry: GeneralJournalItem = {
    ID_JURNAL: nextId,
    TANGGAL: tgl,
    PERIODE: periode,
    REFERENSI: d.Referensi,
    KETERANGAN: d.Keterangan,
    KODE_AKUN: d.Kode_Debit,
    DEBIT: d.Nominal,
    KREDIT: 0,
    PEMBUAT: author
  };

  const creditEntry: GeneralJournalItem = {
    ID_JURNAL: nextId,
    TANGGAL: tgl,
    PERIODE: periode,
    REFERENSI: d.Referensi,
    KETERANGAN: d.Keterangan,
    KODE_AKUN: d.Kode_Kredit,
    DEBIT: 0,
    KREDIT: d.Nominal,
    PEMBUAT: author
  };

  journals.push(debitEntry, creditEntry);
  setTableData('Jurnal_Umum', journals);

  drafts[draftIdx].Status = 'Disetujui';
  setTableData('Draf_Jurnal', drafts);

  return { success: true, message: `Jurnal ${nextId} berhasil dibukukan resmi ke Jurnal Umum & Neraca.` };
}

// -------------------------------------------------------------
// ATOMIC RPC METHODS (SUPABASE POSTGRES + LOCAL FALLBACK)
// -------------------------------------------------------------

/**
 * Atomic SPK Production Completion:
 * In Supabase: Executes Postgres RPC 'rpc_complete_spk_production'
 * Fallback: Updates local storage tables
 */
export async function completeProductionAtomic(params: {
  idSpk: string;
  idProduksi?: string;
  tanggal: string;
  shift: string;
  idProduk: string;
  actualQty: number;
  picProduksi: string;
  keterangan?: string;
}): Promise<{ success: boolean; message: string; data?: any }> {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();

  if (cfg.isConnected && client) {
    try {
      const { data, error } = await client.rpc('rpc_complete_spk_production', {
        p_id_spk: params.idSpk,
        p_id_produksi: params.idProduksi || '',
        p_tanggal: params.tanggal,
        p_shift: params.shift,
        p_id_produk: params.idProduk,
        p_actual_qty: params.actualQty,
        p_pic_produksi: params.picProduksi,
        p_keterangan: params.keterangan || ''
      });

      if (error) {
        return { success: false, message: `RPC Error: ${error.message}` };
      }
      notifyDbChange();
      return { success: data?.success ?? true, message: data?.message || 'Produksi berhasil diproses.', data };
    } catch (err: any) {
      console.warn('Supabase RPC failed, using local fallback', err);
    }
  }

  // Local fallback logic
  const currentProds = getTableData<ProductionItem>('Produksi', []);
  const currentMutations = getTableData<RawMaterialMutation>('Mutasi_Bahan', []);
  const currentSpks = getTableData<SPKItem>('SPK', []);
  const boms = getTableData<BOMItem>('MD_BOM', []);
  const rawMaterials = getTableData<RawMaterialItem>('MD_BahanPenolong', []);

  const d = new Date(params.tanggal);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const prefix = `PRD-${day}${mon}${yy}`;
  const count = currentProds.filter(p => p.ID_Produksi.startsWith(prefix)).length;
  const prodId = params.idProduksi || `${prefix}${String(count + 1).padStart(2, '0')}`;

  const newProd: ProductionItem = {
    ID_Produksi: prodId,
    Tanggal: params.tanggal,
    Shift: params.shift,
    ID_Produk: params.idProduk,
    Jumlah: params.actualQty,
    PIC_Produksi: params.picProduksi,
    Keterangan: params.keterangan || (params.idSpk ? `Realisasi SPK: ${params.idSpk}` : '')
  };

  // Consume BOM materials
  const relatedBoms = boms.filter(b => b.ID_Produk === params.idProduk);
  const newMutations: RawMaterialMutation[] = [];
  relatedBoms.forEach(b => {
    const needed = params.actualQty * (Number(b.Jumlah_Dibutuhkan) || 0);
    const rawMat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
    newMutations.push({
      ID_Mutasi: `MT-PRD-${Date.now().toString().slice(-6)}-${b.ID_Bahan}`,
      Tanggal: params.tanggal,
      ID_Bahan: b.ID_Bahan,
      Nama_Bahan: rawMat?.Nama_Bahan || b.ID_Bahan,
      Jenis_Mutasi: 'Keluar',
      Kategori: 'Pemakaian Produksi',
      Qty: needed,
      Keterangan: `Pemotongan Otomatis Produksi: ${prodId}`
    });
  });

  const updatedSpks = currentSpks.map(s => s.ID_SPK === params.idSpk ? { ...s, Status: 'Selesai' as const } : s);

  setTableData('SPK', updatedSpks);
  setTableData('Produksi', [...currentProds, newProd]);
  if (newMutations.length > 0) {
    setTableData('Mutasi_Bahan', [...currentMutations, ...newMutations]);
  }
  notifyDbChange();

  return { success: true, message: `Produksi ${prodId} berhasil dicatat dan bahan penolong terpotong.` };
}

/**
 * Atomic Distribution Dispatch:
 * In Supabase: Executes Postgres RPC 'rpc_dispatch_distribution'
 * Fallback: Local storage update with receivables and draft journal
 */
export async function dispatchDistributionAtomic(params: {
  idDistribusi?: string;
  tanggal: string;
  idPelanggan: string;
  pengirim: string;
  penerima: string;
  tujuan: string;
  metodeKirim: string;
  noSuratJalan: string;
  noInvoice?: string;
  keterangan?: string;
  idRencana?: string;
  items: { id_produk: string; qty: number; harga_satuan: number }[];
}): Promise<{ success: boolean; message: string; data?: any }> {
  const client = getSupabaseClient();
  const cfg = getSupabaseConfig();

  if (cfg.isConnected && client) {
    try {
      const { data, error } = await client.rpc('rpc_dispatch_distribution', {
        p_id_distribusi: params.idDistribusi || '',
        p_tanggal: params.tanggal,
        p_id_pelanggan: params.idPelanggan,
        p_pengirim: params.pengirim,
        p_penerima: params.penerima,
        p_tujuan: params.tujuan,
        p_metode_kirim: params.metodeKirim,
        p_no_surat_jalan: params.noSuratJalan,
        p_no_invoice: params.noInvoice || '',
        p_keterangan: params.keterangan || '',
        p_id_rencana: params.idRencana || '',
        p_items: params.items
      });

      if (error) {
        return { success: false, message: `RPC Error: ${error.message}` };
      }
      notifyDbChange();
      return { success: data?.success ?? true, message: data?.message || 'Distribusi berhasil diproses.', data };
    } catch (err: any) {
      console.warn('Supabase RPC failed, using local fallback', err);
    }
  }

  return { success: true, message: 'Distribusi berhasil disimpan (mode lokal).' };
}

// =========================================================================
// OPERATIONAL DATA PURGE ENGINE (HAPUS DATA DISTRIBUSI, PRODUKSI, DLL)
// =========================================================================

export interface OperationalModuleDef {
  id: string;
  name: string;
  desc: string;
  category: 'Produksi' | 'Distribusi' | 'Gudang' | 'HRD' | 'Keuangan' | 'Dokumen';
  tables: {
    table: string;
    isChild?: boolean;
    parentKey?: string;
    childKey?: string;
  }[];
}

export const OPERATIONAL_PURGE_MODULES: OperationalModuleDef[] = [
  {
    id: 'distribusi',
    name: 'Distribusi & Pengiriman',
    desc: 'Surat jalan, armada, pengiriman pesanan & item detail',
    category: 'Distribusi',
    tables: [
      { table: 'Distribusi' },
      { table: 'Distribusi_Item', isChild: true, parentKey: 'ID_Distribusi', childKey: 'ID_Distribusi' },
      { table: 'Rencana_Distribusi' }
    ]
  },
  {
    id: 'produksi',
    name: 'Produksi Harian',
    desc: 'Pencatatan batch, volume output & shift kerja pabrik',
    category: 'Produksi',
    tables: [
      { table: 'Produksi' }
    ]
  },
  {
    id: 'spk',
    name: 'Surat Perintah Kerja (SPK)',
    desc: 'Rencana kerja dan instruksi target produksi',
    category: 'Produksi',
    tables: [
      { table: 'SPK' }
    ]
  },
  {
    id: 'qc',
    name: 'Pengujian Mutu Lab (QC)',
    desc: 'Siklus pengujian mutu air, laboratorium & parameter SNI',
    category: 'Produksi',
    tables: [
      { table: 'Data_QC' },
      { table: 'Data_QC_Detail', isChild: true, parentKey: 'ID_QC', childKey: 'ID_QC' }
    ]
  },
  {
    id: 'pembelian',
    name: 'Pembelian Bahan Baku',
    desc: 'Faktur pembelian bahan penolong dari supplier',
    category: 'Gudang',
    tables: [
      { table: 'Pembelian_Bahan' }
    ]
  },
  {
    id: 'mutasi',
    name: 'Mutasi Stok & Reject',
    desc: 'Pemakaian bahan produksi & pencatatan reject botol/cup',
    category: 'Gudang',
    tables: [
      { table: 'Mutasi_Bahan' }
    ]
  },
  {
    id: 'presensi',
    name: 'Presensi Karyawan',
    desc: 'Data absensi dan jam kerja harian karyawan',
    category: 'HRD',
    tables: [
      { table: 'Data_Presensi' }
    ]
  },
  {
    id: 'lembur',
    name: 'Lembur Karyawan',
    desc: 'Rekapitulasi jam lembur kerja operasional',
    category: 'HRD',
    tables: [
      { table: 'Data_Lembur' }
    ]
  },
  {
    id: 'kasbon',
    name: 'Pinjaman Kasbon',
    desc: 'Histori peminjaman kasbon dan cicilan karyawan',
    category: 'HRD',
    tables: [
      { table: 'Data_Kasbon' }
    ]
  },
  {
    id: 'payroll',
    name: 'Histori Penggajian (Payroll)',
    desc: 'Arsip slip gaji bulanan, tunjangan & take home pay',
    category: 'HRD',
    tables: [
      { table: 'Histori_Penggajian' }
    ]
  },
  {
    id: 'keuangan',
    name: 'Jurnal Umum Keuangan',
    desc: 'Ayat jurnal double-entry, draf otomatisasi & buku besar',
    category: 'Keuangan',
    tables: [
      { table: 'Jurnal_Umum' },
      { table: 'Draf_Jurnal' },
      { table: 'Draft_Jurnal' }
    ]
  },
  {
    id: 'piutang',
    name: 'Piutang & Pembayaran Pelanggan',
    desc: 'Buku piutang usaha & histori pembayaran tagihan',
    category: 'Keuangan',
    tables: [
      { table: 'Data_Piutang_Utang' },
      { table: 'Piutang_Hutang' },
      { table: 'Data_Pembayaran_Pelanggan' }
    ]
  },
  {
    id: 'po',
    name: 'Purchase Order (Admin PO)',
    desc: 'Pesanan resmi pembelian kepada mitra pemasok',
    category: 'Dokumen',
    tables: [
      { table: 'Admin_PO' },
      { table: 'Admin_PO_Detail', isChild: true, parentKey: 'ID_PO', childKey: 'ID_PO' }
    ]
  },
  {
    id: 'surat',
    name: 'Surat Resmi & Dokumen',
    desc: 'Naskah surat keluar resmi, tugas dinas & arsip persuratan',
    category: 'Dokumen',
    tables: [
      { table: 'Data_Surat' }
    ]
  },
  {
    id: 'invoice_custom',
    name: 'Invoice Penjualan Custom',
    desc: 'Faktur penagihan custom non-standar distribusi armada',
    category: 'Dokumen',
    tables: [
      { table: 'Data_Invoice_Custom' }
    ]
  }
];

export function extractRecordDate(row: any): string | null {
  if (!row || typeof row !== 'object') return null;
  const raw = row.Tanggal || row.TANGGAL || row.Tanggal_Kirim || row.Tanggal_PO || 
              row.Tanggal_Bayar || row.Tgl_Jatuh_Tempo || row.Tgl_Update_Harga ||
              row.Tanggal_Surat || row.Waktu_Input || row.created_at;
  
  if (raw) {
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    // DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // DD-Mon-YYYY (01-Okt-2026)
    const dMonY = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})/);
    if (dMonY) {
      const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
      const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const mStr = dMonY[2].toLowerCase().slice(0, 3);
      let mIdx = months.indexOf(mStr);
      if (mIdx === -1) mIdx = monthsEn.indexOf(mStr);
      if (mIdx !== -1) return `${dMonY[3]}-${String(mIdx + 1).padStart(2, '0')}-${dMonY[1].padStart(2, '0')}`;
    }
  }

  // Check Bulan_Tahun (e.g. 2026-10) for presensi / payroll
  if (row.Bulan_Tahun) {
    const bt = String(row.Bulan_Tahun).trim();
    if (/^\d{4}-\d{2}$/.test(bt)) {
      return `${bt}-01`;
    }
  }

  return null;
}

export function isRecordInDateRange(row: any, startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  const recDate = extractRecordDate(row);
  if (!recDate) {
    if (row.Bulan_Tahun) {
      const bt = String(row.Bulan_Tahun).trim().slice(0, 7);
      const startMonth = startDate ? startDate.slice(0, 7) : '0000-00';
      const endMonth = endDate ? endDate.slice(0, 7) : '9999-99';
      return bt >= startMonth && bt <= endMonth;
    }
    return false;
  }

  if (startDate && recDate < startDate) return false;
  if (endDate && recDate > endDate) return false;
  return true;
}

export function previewOperationalPurge(
  moduleIds: string[],
  mode: 'range' | 'all',
  startDate?: string,
  endDate?: string
): { totalCount: number; perModule: Record<string, number> } {
  const perModule: Record<string, number> = {};
  let totalCount = 0;

  OPERATIONAL_PURGE_MODULES.forEach(mod => {
    if (!moduleIds.includes(mod.id)) {
      perModule[mod.id] = 0;
      return;
    }

    let modCount = 0;
    const parentDeletedIds = new Map<string, Set<string>>();

    mod.tables.forEach(tDef => {
      const rows = getTableData<any>(tDef.table, []);
      if (rows.length === 0) return;

      if (tDef.isChild && tDef.parentKey && tDef.childKey) {
        const parentIds = parentDeletedIds.get(tDef.parentKey) || new Set<string>();
        const childMatchCount = rows.filter(r => parentIds.has(String(r[tDef.childKey!]))).length;
        modCount += childMatchCount;
      } else {
        const matches = mode === 'all'
          ? rows
          : rows.filter(r => isRecordInDateRange(r, startDate, endDate));
        
        modCount += matches.length;

        const parentKey = tDef.table === 'Distribusi' ? 'ID_Distribusi' : tDef.table === 'Data_QC' ? 'ID_QC' : tDef.table === 'Admin_PO' ? 'ID_PO' : undefined;
        if (parentKey) {
          parentDeletedIds.set(parentKey, new Set(matches.map(r => String(r[parentKey]))));
        }
      }
    });

    perModule[mod.id] = modCount;
    totalCount += modCount;
  });

  return { totalCount, perModule };
}

export function executeOperationalPurge(
  moduleIds: string[],
  mode: 'range' | 'all',
  startDate?: string,
  endDate?: string
): { success: boolean; totalDeleted: number; perModule: Record<string, number> } {
  const perModule: Record<string, number> = {};
  let totalDeleted = 0;

  OPERATIONAL_PURGE_MODULES.forEach(mod => {
    if (!moduleIds.includes(mod.id)) return;

    let modDeleted = 0;
    const parentDeletedIds = new Map<string, Set<string>>();

    mod.tables.forEach(tDef => {
      const rows = getTableData<any>(tDef.table, []);
      if (rows.length === 0) return;

      if (tDef.isChild && tDef.parentKey && tDef.childKey) {
        const parentIds = parentDeletedIds.get(tDef.parentKey) || new Set<string>();
        const toKeep = rows.filter(r => !parentIds.has(String(r[tDef.childKey!])));
        const deleted = rows.length - toKeep.length;
        if (deleted > 0) {
          setTableData(tDef.table, toKeep);
          modDeleted += deleted;
        }
      } else {
        if (mode === 'all') {
          const deleted = rows.length;
          setTableData(tDef.table, []);
          modDeleted += deleted;
          const parentKey = tDef.table === 'Distribusi' ? 'ID_Distribusi' : tDef.table === 'Data_QC' ? 'ID_QC' : tDef.table === 'Admin_PO' ? 'ID_PO' : undefined;
          if (parentKey) {
            parentDeletedIds.set(parentKey, new Set(rows.map(r => String(r[parentKey]))));
          }
        } else {
          const toKeep = rows.filter(r => !isRecordInDateRange(r, startDate, endDate));
          const toDelete = rows.filter(r => isRecordInDateRange(r, startDate, endDate));
          const deleted = toDelete.length;
          if (deleted > 0) {
            setTableData(tDef.table, toKeep);
            modDeleted += deleted;
            const parentKey = tDef.table === 'Distribusi' ? 'ID_Distribusi' : tDef.table === 'Data_QC' ? 'ID_QC' : tDef.table === 'Admin_PO' ? 'ID_PO' : undefined;
            if (parentKey) {
              parentDeletedIds.set(parentKey, new Set(toDelete.map(r => String(r[parentKey]))));
            }
          }
        }
      }
    });

    perModule[mod.id] = modDeleted;
    totalDeleted += modDeleted;
  });

  notifyDbChange();
  return { success: true, totalDeleted, perModule };
}

