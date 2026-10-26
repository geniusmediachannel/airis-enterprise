/**
 * AIRIS Enterprise - TypeScript Types & Data Models
 * PT. Anugerah Illahi Rabbi (Integrated AMDK Management System)
 */

export type UserRole = 
  | 'SuperAdmin' 
  | 'Admin Master' 
  | 'Admin Produksi' 
  | 'Admin Gudang' 
  | 'Kasir/Finance' 
  | 'HRD'
  | 'Admin Dokumen';

export interface UserAccount {
  ID_User: string;
  Username: string;
  Nama?: string;
  Password?: string;
  Role: UserRole;
  ID_Karyawan: string;
  Status_Akun: 'Aktif' | 'Terblokir';
  Email?: string;
}

export interface AuthSession {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isSupabaseAuth: boolean;
}

export interface AccessLogItem {
  ID_Log: string;
  Waktu: string; // ISO datetime YYYY-MM-DDTHH:mm:ss
  Tanggal: string; // YYYY-MM-DD
  Jam: string; // HH:mm:ss
  ID_User?: string;
  Username: string;
  Nama_Karyawan?: string;
  Role?: string;
  Aktivitas: 'Login Berhasil' | 'Login Gagal' | 'Logout' | 'Akses Ditolak';
  Status: 'Sukses' | 'Gagal' | 'Peringatan';
  IP_Address: string;
  Browser_Device: string;
  Keterangan: string;
}

export interface ProductItem {
  ID_Produk: string;
  Nama_Produk: string;
  Kategori: 'Air Mineral Cup' | 'Air Mineral Botol' | 'Air Mineral Galon';
  Satuan: 'Dus' | 'Galon';
  Harga_Distributor: number;
  Harga_Agen: number;
  Harga_Reseller: number;
  Harga_Konsumen: number;
  Status: 'Aktif' | 'Non-Aktif';
  Tgl_Update_Harga?: string;
}

export interface PriceHistoryItem {
  ID_Histori: string;
  Tipe_Item: 'Bahan Penolong' | 'Produk';
  ID_Item: string;
  Nama_Item: string;
  Kategori?: string;
  Satuan?: string;
  Tanggal_Berlaku: string; // YYYY-MM-DD
  Tanggal_Diubah: string; // ISO datetime
  Diubah_Oleh: string;
  Keterangan?: string;
  Status_Penerapan?: 'Aktif' | 'Terjadwal';

  // Untuk Bahan Penolong
  Harga_Lama?: number;
  Harga_Baru?: number;
  Selisih?: number;
  Persentase_Perubahan?: number;

  // Untuk Produk (Tier pricing)
  Harga_Lama_Distributor?: number;
  Harga_Baru_Distributor?: number;
  Harga_Lama_Agen?: number;
  Harga_Baru_Agen?: number;
  Harga_Lama_Reseller?: number;
  Harga_Baru_Reseller?: number;
  Harga_Lama_Konsumen?: number;
  Harga_Baru_Konsumen?: number;

  // Aliases for compatibility
  Harga_Distributor_Lama?: number;
  Harga_Distributor_Baru?: number;
  Harga_Agen_Lama?: number;
  Harga_Agen_Baru?: number;
  Harga_Reseller_Lama?: number;
  Harga_Reseller_Baru?: number;
  Harga_Konsumen_Lama?: number;
  Harga_Konsumen_Baru?: number;

  // Tanggal Acuan Sebelumnya (untuk melacak rantai acuan)
  Tanggal_Acuan_Sebelumnya?: string;
}

export interface CustomerItem {
  ID_Pelanggan: string;
  Nama_Pelanggan: string;
  No_Telp: string;
  Alamat: string;
  Level_Pelanggan: 'Distributor' | 'Agen' | 'Reseller' | 'Konsumen Biasa';
  Status: 'Aktif' | 'Non-Aktif';
}

export interface SpecialPriceItem {
  ID_Harga_Khusus: string;
  ID_Pelanggan: string;
  ID_Produk: string;
  Harga_Custom: number;
  Keterangan?: string;
}

export interface SupplierItem {
  ID_Supplier: string;
  Nama_Supplier: string;
  PIC: string;
  No_Telp: string;
  Alamat: string;
  Status: 'Aktif' | 'Non-Aktif';
}

export interface RawMaterialItem {
  ID_Bahan: string;
  Nama_Bahan: string;
  Kategori: 'Kemasan' | 'Segel' | 'Label' | 'Lakban' | 'Kimia/Laboratorium' | 'Bahan Tambahan' | 'Lainnya';
  Satuan: 'Pcs' | 'Roll' | 'Lembar' | 'Kg' | 'Liter' | 'Box' | 'Dus' | 'Batang';
  Harga_Satuan: number;
  Tgl_Update_Harga?: string;
  Minimum_Stock?: number;
}

export interface BOMItem {
  ID_BOM: string;
  ID_Produk: string;
  ID_Bahan: string;
  Jumlah_Dibutuhkan: number;
  Satuan: 'Pcs' | 'Roll' | 'Lembar' | 'Kg' | 'Liter' | 'Box' | 'Dus' | 'Batang';
  Keterangan?: string;
}

export interface EmployeeItem {
  ID_Karyawan: string;
  Nama_Karyawan: string;
  Departemen: 'Manajemen' | 'Produksi' | 'Distribusi' | 'QC' | 'Keuangan' | 'HRD' | 'Gudang';
  Jabatan: 'Direktur' | 'Manager' | 'Supervisor' | 'Staff' | 'Operator' | 'Driver' | 'Analis QC' | 'Kasir' | 'Kurir';
  Tgl_Masuk: string;
  Status: 'Aktif' | 'Resign' | 'Nonaktif';
  Gaji_Pokok?: number;
  Tunjangan?: number;
}

export interface SPKItem {
  ID_SPK: string;
  Tanggal: string;
  Shift: string;
  ID_Produk: string;
  Target_Produksi: number;
  Keterangan: string;
  Status: 'Aktif' | 'Diproses' | 'Selesai';
}

export interface ProductionItem {
  ID_Produksi: string;
  Tanggal: string;
  Shift: string;
  ID_Produk: string;
  Jumlah: number;
  PIC_Produksi: string;
  Keterangan: string;
}

export interface DeliveryPlanItem {
  ID_Rencana: string;
  Tanggal_Rencana: string;
  ID_Pelanggan: string;
  Nama_Pelanggan: string;
  Level_Pelanggan: string;
  Metode_Kirim: 'Kirim Armada' | 'Ambil Sendiri';
  Alamat_Tujuan: string;
  Sopir: string;
  Status: 'Menunggu' | 'Disetujui' | 'Realisasi' | 'Dibatalkan';
  Keterangan?: string;
  Items: {
    ID_Produk: string;
    Nama_Produk: string;
    Qty: number;
    Harga_Satuan: number;
    Subtotal: number;
  }[];
}

export interface DistributionItem {
  ID_Distribusi: string;
  Tanggal: string;
  ID_Pelanggan: string;
  Nama_Pelanggan: string;
  Level_Pelanggan: string;
  Pengirim: string;
  Penerima: string;
  Tujuan: string;
  Metode_Kirim: 'Diantar Armada' | 'Kirim Armada' | 'Ambil Sendiri' | string;
  No_Surat_Jalan: string;
  Keterangan: string;
  No_Invoice?: string;
  Total_Tagihan?: number;
}

export interface DistributionProductDetail {
  ID_Detail?: string;
  ID_Distribusi: string;
  Nama_Pelanggan?: string;
  Tanggal?: string;
  Level_Pelanggan?: string;
  ID_Produk: string;
  Nama_Produk: string;
  Qty: number;
  Harga_Satuan: number;
  Subtotal: number;
  Satuan?: string;
}

export interface RawMaterialPurchase {
  ID_Pembelian: string;
  Tanggal: string;
  ID_Bahan: string;
  Nama_Bahan: string;
  Supplier: string;
  Harga_Satuan: number;
  Qty: number;
  Keterangan: string;
}

export interface RawMaterialMutation {
  ID_Mutasi: string;
  Tanggal: string;
  ID_Bahan: string;
  Nama_Bahan: string;
  Jenis_Mutasi: 'Masuk' | 'Keluar';
  Kategori: string;
  Qty: number;
  Keterangan: string;
}

export interface QCHeader {
  ID_QC: string;
  Tanggal: string;
  Bulan_Tahun: string;
  Produk: string;
  Petugas_QC: string;
  Kesimpulan: string;
  Status_Data: 'Lengkap' | 'Belum Lengkap';
  Waktu_Input?: string;
  ID_Produksi?: string;
}

export interface QCDetailCycle {
  ID_QC: string;
  Siklus: number;
  // Air Baku: pH, TDS, Kekeruhan, Bau, Coliform
  Baku_pH?: string;
  Baku_TDS?: string;
  Baku_Kekeruhan?: string;
  Baku_Bau?: string;
  Baku_Coliform?: string;
  // Air Proses: pH, TDS, Kekeruhan, Bau, Rasa, Ozon
  Proses_pH?: string;
  Proses_TDS?: string;
  Proses_Kekeruhan?: string;
  Proses_Bau?: string;
  Proses_Rasa?: string;
  Proses_Ozon?: string;
  // Air Jadi: pH, TDS, Kekeruhan, Bau, Rasa, Ozon, ALT Awal, ALT Akhir, Coliform
  Jadi_pH?: string;
  Jadi_TDS?: string;
  Jadi_Kekeruhan?: string;
  Jadi_Bau?: string;
  Jadi_Rasa?: string;
  Jadi_Ozon?: string;
  Jadi_ALT_Awal?: string;
  Jadi_ALT_Akhir?: string;
  Jadi_Coliform?: string;
}

export interface AttendanceNoteItem {
  status: 'H' | 'T' | 'I' | 'S' | 'C' | 'A' | 'PA' | 'L' | string;
  keterangan: string;
  menitTelat?: number;
}

export interface AttendanceRecord {
  ID_Presensi: string;
  Bulan_Tahun: string;
  ID_Karyawan: string;
  Nama_Karyawan: string;
  [key: `T${number}`]: string | undefined;
  Catatan_Presensi?: Record<number, AttendanceNoteItem>;
  Total_H?: number; // Hadir
  Total_T?: number; // Telat
  Total_Menit_Telat?: number; // Akumulasi total menit telat
  Total_I?: number; // Izin
  Total_S?: number; // Sakit
  Total_C?: number; // Cuti
  Total_A?: number; // Alpa
  Total_PA?: number; // Pulang Awal
  Total_L?: number; // Libur
}

export interface OvertimeRecord {
  ID_Lembur: string;
  Bulan_Tahun: string;
  ID_Karyawan: string;
  Nama_Karyawan: string;
  [key: `T${number}`]: number | string | undefined;
  Total_Jam_Lembur?: number;
}

export interface KasbonRecord {
  ID_Kasbon: string;
  Tanggal: string;
  ID_Karyawan: string;
  Nama_Karyawan: string;
  Nominal: number;
  Tenor: number;
  Cicilan_Per_Bulan: number;
}

export interface PayrollRuleSettings {
  bonusHadirFull: number;
  bonusTargetDefault: number;
  tarifLemburPerJam: number;
  useDepnakerFormula: boolean;
  potonganAlpaPerHari: number;
  potonganTelatPerKejadian: number;
  potonganPulangAwalPerKejadian: number;
  potonganIzinPerHari: number;
  potonganSakitPerHari: number;
  bpjsKetenagakerjaanNominal: number;
  bpjsKesehatanNominal: number;
  pph21Nominal: number;
  namaPerusahaan: string;
  subNamaPerusahaan: string;
  penandatanganNama: string;
  penandatanganJabatan: string;
}

export interface PayrollHistoryItem {
  ID_Batch?: string;
  Tanggal_Pencairan?: string;
  Waktu_Pencairan?: string;
  Bulan_Tahun: string;
  ID_Karyawan: string;
  Nama_Karyawan: string;
  Gaji_Pokok: number;
  Tunjangan: number;
  Bonus_Hadir: number;
  Bonus_Target: number;
  Jam_Lembur?: number;
  Jam_Lembur_15?: number;
  Jam_Lembur_20?: number;
  Upah_Lembur: number;
  PPh21: number;
  BPJS: number;
  BPJS_Ketenagakerjaan?: number;
  BPJS_Kesehatan?: number;
  Kasbon: number;
  Potongan_Absen: number;
  Total_Pendapatan: number;
  Total_Potongan: number;
  Gaji_Bersih: number;
}

// ==================== KEUANGAN & AKUNTANSI ====================
export interface COAItem {
  KODE_AKUN: string;
  NAMA_AKUN: string;
  KATEGORI: 'Aset Lancar' | 'Aset Tetap' | 'Kontra Aset' | 'Liabilitas Pendek' | 'Liabilitas Panjang' | 'Ekuitas' | 'Pendapatan' | 'Harga Pokok' | 'Beban' | 'Pendapatan Lain' | 'Beban Lain';
  SALDO_NORMAL: 'Debit' | 'Kredit';
  STATUS: 'Aktif' | 'Non-Aktif';
}

export interface GeneralJournalItem {
  ID_JURNAL: string;
  TANGGAL: string;
  PERIODE: string;
  REFERENSI: string;
  KETERANGAN: string;
  KODE_AKUN: string;
  DEBIT: number;
  KREDIT: number;
  PEMBUAT: string;
}

export interface DraftJournalItem {
  ID_Draf: string;
  Sumber: 'Distribusi' | 'Pembelian Bahan' | 'Penggajian' | 'Lainnya';
  Tanggal: string;
  Referensi: string;
  Keterangan: string;
  Kode_Debit: string;
  Kode_Kredit: string;
  Nominal: number;
  Status: 'Menunggu Verifikasi' | 'Disetujui' | 'Ditolak';
  Waktu_Dibuat: string;
}

export interface ReceivablePayableItem {
  ID_DOKUMEN?: string;
  ID_Transaksi?: string;
  TIPE?: 'Piutang' | 'Utang';
  Jenis?: 'Piutang' | 'Utang';
  TANGGAL?: string;
  Tanggal?: string;
  JATUH_TEMPO?: string;
  Tgl_Jatuh_Tempo?: string;
  NAMA_ENTITAS?: string;
  Entitas?: string;
  TOTAL_TAGIHAN?: number;
  Nominal?: number;
  TOTAL_DIBAYAR?: number;
  Terbayar?: number;
  SISA_SALDO?: number;
  Sisa?: number;
  STATUS?: 'Lunas' | 'Belum Lunas' | 'Jatuh Tempo' | 'Lunas Sebagian';
  Status?: 'Lunas' | 'Belum Lunas' | 'Jatuh Tempo' | 'Lunas Sebagian';
  No_Ref?: string;
}

export interface CustomerPaymentRecord {
  ID_Pembayaran: string;
  Tanggal: string;
  ID_Pelanggan?: string;
  Nama_Pelanggan: string;
  Jumlah_Bayar: number;
  Metode: 'Transfer Bank' | 'Tunai / Cash' | 'Cek / Giro' | 'Saldo Deposit' | string;
  No_Referensi?: string;
  Keterangan?: string;
  Waktu_Input?: string;
}


export interface FixedAssetItem {
  ID_ASET: string;
  NAMA_ASET: string;
  TGL_BELI: string;
  NILAI_PEROLEHAN: number;
  NILAI_RESIDU: number;
  UMUR_EKONOMIS_BLN: number;
  BEBAN_PENYUSUTAN_BLN: number;
  AKUN_ASET: string;
  AKUN_AKUMULASI: string;
  AKUN_BEBAN: string;
}

// ==================== PERSURATAN & ADMINISTRASI ====================
export type SuratType = 'Surat Eksternal' | 'Surat Internal' | 'Surat Keterangan';

export interface LetterSignatory {
  id: string;
  Nama: string;
  Jabatan: string;
  Keterangan?: string; // e.g. "Hormat kami,", "Menyetujui,", "Mengetahui,"
  customTtdImage?: string;
  useCustomTtdImage?: boolean;
}

export interface POSignatory {
  id: string;
  keterangan: string; // e.g. "Diterima Vendor", "Dibuat Oleh (Purchasing)", "Disetujui (Direktur)"
  nama: string;
  jabatan: string;
  customTtdImage?: string;
  useCustomTtdImage?: boolean;
}

export interface PODocumentSettings {
  namaPerusahaan?: string;
  subNamaPerusahaan?: string;
  alamatPerusahaan?: string;
  kontakPerusahaan?: string;
  customKopImage?: string;
  useCustomKopImage?: boolean;
  kopWidth?: number;
  kopHeight?: number;
  showCap?: boolean;
  customCapImage?: string;
  useCustomCapImage?: boolean;
  capWidth?: number;
  capHeight?: number;
  signatories?: POSignatory[];
}

export interface LetterDocumentSettings {
  namaPerusahaan?: string;
  subNamaPerusahaan?: string;
  alamatPerusahaan?: string;
  kontakPerusahaan?: string;
  customKopImage?: string;
  useCustomKopImage?: boolean;
  kopWidth?: number;
  kopHeight?: number;
  customCapImage?: string;
  useCustomCapImage?: boolean;
  showCap?: boolean;
  capWidth?: number;
  capHeight?: number;
  customTtdImage?: string;
  useCustomTtdImage?: boolean;
  showTtd?: boolean;
  ttdWidth?: number;
  ttdHeight?: number;
}

export interface OfficialLetterItem {
  ID_Surat: string;
  Nomor_Surat: string;
  Tipe_Surat: SuratType;
  Tanggal: string;
  Perihal: string;
  Lampiran?: string;
  Kepada: string;
  Alamat_Tujuan?: string;
  Isi_Surat: string;
  Penandatangan_Nama: string;
  Penandatangan_Jabatan: string;
  Tembusan?: string;
  Dibuat_Oleh: string;
  Isi_Surat_HTML?: string;
  LetterDocSettings?: LetterDocumentSettings;
  Penandatangan_List?: LetterSignatory[];
}

export interface AdminPOHeader {
  ID_PO: string;
  Tanggal_PO: string;
  No_PO: string;
  Order_Ke: string;
  Alamat_Supplier: string;
  Syarat_Ketentuan: string;
  Grand_Total: number;
  Status: string;
  Signatories?: POSignatory[];
  POSettings?: PODocumentSettings;
}

export interface AdminPODetail {
  ID_Detail: string;
  ID_PO: string;
  Nama_Produk: string;
  Spesifikasi: string;
  Qty: number;
  Harga_Satuan: number;
  Total_Harga: number;
}

export interface CashTransactionItem {
  ID_Transaksi: string;
  Tanggal: string;
  Kategori: string;
  Keterangan: string;
  Jenis: 'Masuk' | 'Keluar';
  Nominal: number;
  Akun_Kas: string;
  No_Ref?: string;
}

// ==================== NOTIFIKASI & SUPABASE ====================
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date?: string;
  timestamp?: string;
  type?: 'spk' | 'produksi' | 'distribusi' | 'kritis' | 'qc' | 'keuangan' | 'error' | 'warning' | 'info';
  category?: 'stock' | 'material' | 'spk' | 'distribusi' | 'finance' | 'qc' | 'system' | string;
  read: boolean;
  targetView?: string;
  actionView?: string;
  priority?: 'tinggi' | 'sedang' | 'rendah';
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
  lastChecked?: string;
  autoSync: boolean;
}

// ==================== PENGATURAN DOKUMEN & KOP / TTD ====================
export interface DocumentTemplateSettings {
  // Kop Surat
  namaPerusahaan: string;
  subNamaPerusahaan: string;
  alamatPerusahaan: string;
  kontakPerusahaan: string;
  customKopImage?: string; // base64 or custom URL
  useCustomKopImage: boolean;
  kopWidth?: number;   // % lebar kop (default 100)
  kopHeight?: number;  // px tinggi kop (default 90)

  // Stempel & TTD
  customCapImage?: string;
  useCustomCapImage: boolean;
  showCap: boolean;
  capWidth?: number;   // px lebar cap (default 80)
  capHeight?: number;  // px tinggi cap (default 80)

  customTtdImage?: string;
  useCustomTtdImage: boolean;
  showTtd: boolean;
  ttdWidth?: number;   // px lebar ttd (default 110)
  ttdHeight?: number;  // px tinggi ttd (default 75)

  // Penandatangan
  namaPenandatangan: string;
  jabatanPenandatangan: string;

  // Info Pembayaran
  infoPembayaranTeks: string;
  bankRekening: string;
}

// ==================== TEXT STYLING SETTINGS ====================
export interface TextStyleSettings {
  fontFamily: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  color: string;
}

// ==================== SHIPMENT GROUP (DATA KIRIM) ====================
export interface ShipmentGroup {
  id: string;
  kirimKe: string;
  noSuratJalan: string;
  tanggalKirim: string;
  items: CustomInvoiceDetailItem[];
  subtotal: number;
}

// ==================== INVOICE CUSTOM (GABUNGAN PENGIRIMAN & MANUAL) ====================
export interface CustomInvoiceDetailItem {
  ID_Detail?: string;
  ID_Produk?: string;
  Nama_Produk: string;
  Spesifikasi?: string;
  Qty: number;
  Satuan: string;
  Harga_Satuan: number;
  Subtotal: number;
  No_SJ_Referensi?: string;
  Tanggal_Kirim?: string;
  Kirim_Ke?: string;
}

export interface CustomInvoiceItem {
  ID_Invoice: string;
  No_Invoice: string;
  Tanggal: string;
  Jatuh_Tempo?: string;
  Nama_Pelanggan: string;
  Level_Pelanggan?: string;
  Alamat_Pelanggan?: string;
  No_Kontak?: string;
  No_PO_Pelanggan?: string;
  No_Surat_Jalan_List: string[];
  ID_Distribusi_List: string[];
  Metode_Kirim?: string;
  Penerima?: string;
  Kirim_Ke?: string;
  Keterangan?: string;
  Items: CustomInvoiceDetailItem[];
  ShipmentGroups?: ShipmentGroup[];
  Subtotal: number;
  Potongan_Ekspedisi: number;
  Diskon: number;
  Pajak_PPN: number;
  Grand_Total: number;
  Status: 'Draft' | 'Terkirim' | 'Lunas' | 'Batal';
  Dibuat_Oleh?: string;
  Waktu_Input?: string;
}
