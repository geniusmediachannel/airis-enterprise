import { UserRole } from '../types';

export type AppMenuId = 
  | 'dashboard' 
  | 'master_data' 
  | 'produksi' 
  | 'distribusi' 
  | 'stock' 
  | 'qc' 
  | 'keuangan' 
  | 'hrd' 
  | 'administrasi' 
  | 'log_akses';

/**
 * Normalisasi ID menu dari berbagai alias (misal 'master' -> 'master_data')
 */
export function normalizeMenuId(menuId: string): AppMenuId {
  const target = menuId.toLowerCase().trim();
  if (target === 'master' || target === 'masterdata' || target === 'master_data') return 'master_data';
  if (target === 'production' || target === 'produksi') return 'produksi';
  if (target === 'distribution' || target === 'distribusi') return 'distribusi';
  if (target === 'stok' || target === 'stock') return 'stock';
  if (target === 'finance' || target === 'keuangan') return 'keuangan';
  if (target === 'admin' || target === 'administrasi') return 'administrasi';
  if (target === 'log' || target === 'log_akses' || target === 'access_log') return 'log_akses';
  if (target === 'qc') return 'qc';
  if (target === 'hrd') return 'hrd';
  return 'dashboard';
}

/**
 * Matriks Hak Pengerjaan / Input & Edit Berdasarkan Role
 * Seluruh user dapat MELIHAT seluruh menu, namun HANYA dapat MENGERJAKAN (input, edit, hapus, kelola)
 * pada bagian / modul wewenang masing-masing.
 */
export const ROLE_WRITE_PERMISSIONS: Record<UserRole, AppMenuId[]> = {
  'SuperAdmin': [
    'dashboard', 'master_data', 'produksi', 'distribusi', 
    'stock', 'qc', 'keuangan', 'hrd', 'administrasi', 'log_akses'
  ],
  'Admin Master': [
    'dashboard', 'master_data', 'stock'
  ],
  'Admin Produksi': [
    'dashboard', 'produksi', 'qc', 'stock'
  ],
  'Admin Gudang': [
    'dashboard', 'stock', 'distribusi'
  ],
  'Kasir/Finance': [
    'dashboard', 'keuangan', 'distribusi'
  ],
  'HRD': [
    'dashboard', 'hrd'
  ],
  'Admin Dokumen': [
    'dashboard', 'administrasi'
  ]
};

/**
 * Seluruh menu yang dapat DILIHAT oleh pengguna.
 * Sesuai permintaan: seluruh user dapat MELIHAT seluruh menu.
 */
export function canAccessMenu(role: UserRole | undefined, menuId: string): boolean {
  // Semua user dapat melihat semua menu
  return true;
}

/**
 * Cek apakah role tertentu memiliki wewenang untuk MENGERJAKAN (input, edit, hapus) pada modul target
 */
export function canEditModule(role: UserRole | undefined, menuId: string): boolean {
  if (!role) return false;
  if (role === 'SuperAdmin') return true;

  const normalized = normalizeMenuId(menuId);
  if (normalized === 'dashboard') return true; // Dashboard hanya berupa monitoring interaktif
  if (normalized === 'log_akses') return role === 'SuperAdmin'; // Reset log hanya SuperAdmin

  const allowedModules = ROLE_WRITE_PERMISSIONS[role] || [];
  return allowedModules.includes(normalized);
}

/**
 * Alias untuk canEditModule
 */
export const canEditMenu = canEditModule;

/**
 * Mengembalikan teks nama-nama role yang memiliki wewenang pengerjaan pada modul tertentu
 */
export function getAuthorizedRolesForModule(menuId: string): string {
  const normalized = normalizeMenuId(menuId);
  switch (normalized) {
    case 'master_data':
      return 'Admin Master & SuperAdmin';
    case 'produksi':
      return 'Admin Produksi & SuperAdmin';
    case 'distribusi':
      return 'Admin Gudang, Kasir/Finance & SuperAdmin';
    case 'stock':
      return 'Admin Gudang, Admin Produksi, Admin Master & SuperAdmin';
    case 'qc':
      return 'Admin Produksi & SuperAdmin';
    case 'keuangan':
      return 'Kasir/Finance & SuperAdmin';
    case 'hrd':
      return 'HRD & SuperAdmin';
    case 'administrasi':
      return 'Admin Dokumen & SuperAdmin';
    case 'log_akses':
      return 'SuperAdmin';
    default:
      return 'Semua Bagian (Monitoring)';
  }
}

/**
 * Deskripsi dan info badge setiap Role
 */
export const ROLE_INFO: Record<UserRole, { label: string; badgeColor: string; description: string; mainDuty: string }> = {
  'SuperAdmin': {
    label: 'Super Administrator',
    badgeColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    description: 'Akses penuh ke seluruh menu, konfigurasi database, audit log, & master data',
    mainDuty: 'Seluruh Modul & Konfigurasi Sistem'
  },
  'Admin Master': {
    label: 'Admin Master Data',
    badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    description: 'Kelola data master produk, harga, formula BOM, pelanggan, supplier & karyawan',
    mainDuty: 'Master Data & Katalog Stok'
  },
  'Admin Produksi': {
    label: 'Admin Produksi',
    badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    description: 'Penerbitan SPK, input output mesin AMDK, mutasi bahan, dan Quality Control',
    mainDuty: 'Produksi SPK, QC Mutu, & Stok Bahan'
  },
  'Admin Gudang': {
    label: 'Admin Gudang & Logistik',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    description: 'Kelola stok fisik gudang, mutasi bahan baku, penerimaan DO, & barang jadi',
    mainDuty: 'Stok Fisik Gudang & Distribusi Logistik'
  },
  'Kasir/Finance': {
    label: 'Kasir & Keuangan',
    badgeColor: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    description: 'Verifikasi jurnal, kas/bank, piutang pelanggan, utang supplier, & laporan laba rugi',
    mainDuty: 'Keuangan, Jurnal, Kasir & Faktur Distribusi'
  },
  'HRD': {
    label: 'HRD & Personalia',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    description: 'Presensi karyawan, pengajuan lembur, kasbon, & penggajian payroll bulanan',
    mainDuty: 'HRD, Presensi, Lembur & Penggajian'
  },
  'Admin Dokumen': {
    label: 'Administrasi & Persuratan',
    badgeColor: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
    description: 'Pembuatan surat resmi, PO pembelian, tanda terima, & pengarsipan dokumen',
    mainDuty: 'Administrasi, Persuratan & Purchase Order'
  }
};

/**
 * Menentukan menu default / landing page untuk suatu role saat login
 */
export function getDefaultViewForRole(role: UserRole | undefined): string {
  if (!role) return 'dashboard';
  switch (role) {
    case 'Admin Produksi':
      return 'produksi';
    case 'Admin Gudang':
      return 'stock';
    case 'Kasir/Finance':
      return 'keuangan';
    case 'HRD':
      return 'hrd';
    case 'Admin Dokumen':
      return 'administrasi';
    case 'Admin Master':
      return 'master_data';
    default:
      return 'dashboard';
  }
}

/**
 * Cek apakah role boleh melakukan aksi administratif kritis (SuperAdmin only)
 */
export function isSuperAdmin(role: UserRole | undefined): boolean {
  return role === 'SuperAdmin';
}
