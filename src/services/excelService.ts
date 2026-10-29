/**
 * AIRIS Enterprise - Excel Migration & Export Service using SheetJS
 * Complete multi-module import/export templates
 */

import * as XLSX from 'xlsx';
import { getTableData, setTableData, normalizeTableRows, pushAllTablesToSupabase, isSupabaseConfigured } from './dbAdapter';

export type ExcelTemplateType = 
  | 'produk' 
  | 'pelanggan' 
  | 'supplier' 
  | 'bahan' 
  | 'bom' 
  | 'karyawan'
  | 'spk'
  | 'produksi'
  | 'distribusi'
  | 'pembelian_bahan'
  | 'mutasi_bahan'
  | 'qc'
  | 'coa_saldo'
  | 'jurnal'
  | 'kasbon'
  | 'aset'
  | 'po'
  | 'presensi'
  | 'lembur'
  | 'histori_penggajian';

export interface TemplateDefinition {
  type: ExcelTemplateType;
  title: string;
  filename: string;
  headers: string[];
  sampleRows: any[][];
}

export const EXCEL_TEMPLATES: Record<ExcelTemplateType, TemplateDefinition> = {
  produk: {
    type: 'produk',
    title: 'Master Produk AMDK',
    filename: 'Template_AIRIS_Master_Produk.xlsx',
    headers: ['ID_Produk', 'Nama_Produk', 'Kategori', 'Satuan', 'Harga_Distributor', 'Harga_Agen', 'Harga_Reseller', 'Harga_Konsumen', 'Status'],
    sampleRows: [
      ['ASH-CUP120', 'As-Shofaa Cup 120ml', 'Air Mineral Cup', 'Dus', 12000, 13000, 14000, 16000, 'Aktif'],
      ['ASH-CUP220', 'As-Shofaa Cup 220ml', 'Air Mineral Cup', 'Dus', 14500, 15500, 16500, 18500, 'Aktif'],
      ['ASH-BTL330', 'As-Shofaa Botol 330ml', 'Air Mineral Botol', 'Dus', 24000, 26000, 28000, 32000, 'Aktif'],
      ['ASH-BTL600', 'As-Shofaa Botol 600ml', 'Air Mineral Botol', 'Dus', 28000, 30000, 32000, 36000, 'Aktif'],
      ['ASH-GLN19L', 'As-Shofaa Galon 19L', 'Air Mineral Galon', 'Galon', 9000, 10000, 11000, 13000, 'Aktif']
    ]
  },
  pelanggan: {
    type: 'pelanggan',
    title: 'Master Pelanggan & Mitra',
    filename: 'Template_AIRIS_Pelanggan.xlsx',
    headers: ['ID_Pelanggan', 'Nama_Pelanggan', 'No_Telp', 'Alamat', 'Level_Pelanggan', 'Status'],
    sampleRows: [
      ['PLG-0001', 'Toko Berkah Sejahtera', '081234567890', 'Jl. Raya Klaten No. 12', 'Distributor', 'Aktif'],
      ['PLG-0002', 'Agen Sumber Segar', '082198765432', 'Prambanan, Klaten', 'Agen', 'Aktif'],
      ['PLG-0003', 'Koperasi Karyawan BMT', '081345678912', 'Klaten Utara', 'Reseller', 'Aktif']
    ]
  },
  supplier: {
    type: 'supplier',
    title: 'Master Pemasok / Supplier',
    filename: 'Template_AIRIS_Supplier.xlsx',
    headers: ['ID_Supplier', 'Nama_Supplier', 'PIC', 'No_Telp', 'Alamat', 'Status'],
    sampleRows: [
      ['SUP-0001', 'PT. Sumber Plastik Nusantara', 'Budi Santoso', '0811223344', 'Solo Baru, Sukoharjo', 'Aktif'],
      ['SUP-0002', 'CV. Karton Lestari Abadi', 'Hendro Gunawan', '0812998877', 'Ceper, Klaten', 'Aktif']
    ]
  },
  bahan: {
    type: 'bahan',
    title: 'Master Bahan Penolong & Stok',
    filename: 'Template_AIRIS_Bahan_Penolong.xlsx',
    headers: ['ID_Bahan', 'Nama_Bahan', 'Kategori', 'Satuan', 'Harga_Satuan', 'Minimum_Stock'],
    sampleRows: [
      ['BHN-CUP120', 'Cup Plastik 120ml Polos', 'Kemasan', 'Pcs', 85, 5000],
      ['BHN-CUP220', 'Cup Plastik 220ml Printing', 'Kemasan', 'Pcs', 110, 8000],
      ['BHN-LIDSEAL', 'Lid Seal Roll As-Shofaa', 'Segel', 'Roll', 145000, 20],
      ['BHN-KARTON220', 'Karton Dus 220ml (isi 48)', 'Kemasan', 'Lembar', 2600, 1200]
    ]
  },
  bom: {
    type: 'bom',
    title: 'Formula BOM / Resep Produksi',
    filename: 'Template_AIRIS_BOM.xlsx',
    headers: ['ID_BOM', 'ID_Produk', 'ID_Bahan', 'Jumlah_Dibutuhkan', 'Satuan', 'Keterangan'],
    sampleRows: [
      ['BOM-0001', 'ASH-CUP220', 'BHN-CUP220', 48, 'Pcs', '48 cup per karton'],
      ['BOM-0002', 'ASH-CUP220', 'BHN-KARTON220', 1, 'Lembar', '1 karton dus per karton'],
      ['BOM-0003', 'ASH-CUP220', 'BHN-LIDSEAL', 0.04, 'Roll', '0.04 roll per karton']
    ]
  },
  karyawan: {
    type: 'karyawan',
    title: 'Data Karyawan & Gaji Pokok',
    filename: 'Template_AIRIS_Karyawan.xlsx',
    headers: ['ID_Karyawan', 'Nama_Karyawan', 'Departemen', 'Jabatan', 'Tgl_Masuk', 'Status', 'Gaji_Pokok', 'Tunjangan'],
    sampleRows: [
      ['KAR-0001', 'Marko Dwi Nugroho', 'Keuangan', 'Manager', '2023-01-15', 'Aktif', 4500000, 750000],
      ['KAR-0002', 'Tri Wahyudi', 'Distribusi', 'Driver', '2023-05-20', 'Aktif', 2900000, 400000],
      ['KAR-0003', 'Nurul Hidayati', 'QC', 'Staff', '2023-08-01', 'Aktif', 3100000, 450000]
    ]
  },
  spk: {
    type: 'spk',
    title: 'Rencana Produksi (SPK)',
    filename: 'Template_AIRIS_SPK.xlsx',
    headers: ['ID_SPK', 'Tanggal', 'Shift', 'ID_Produk', 'Target_Produksi', 'Keterangan', 'Status'],
    sampleRows: [
      ['SPK-16102601', '2026-10-16', 'Shift 1 (Pagi)', 'ASH-CUP220', 500, 'Prioritas kirim Toko Berkah', 'Aktif'],
      ['SPK-16102602', '2026-10-16', 'Shift 2 (Siang)', 'ASH-BTL600', 300, 'Pesanan Agen Sumber Segar', 'Aktif']
    ]
  },
  produksi: {
    type: 'produksi',
    title: 'Hasil Produksi Selesai',
    filename: 'Template_AIRIS_Produksi.xlsx',
    headers: ['ID_Produksi', 'Tanggal', 'Shift', 'ID_Produk', 'Jumlah', 'PIC_Produksi', 'Keterangan'],
    sampleRows: [
      ['PRD-16102601', '2026-10-16', 'Shift 1 (Pagi)', 'ASH-CUP220', 500, 'Agus Setiawan', 'Realisasi SPK'],
      ['PRD-16102602', '2026-10-16', 'Shift 2 (Siang)', 'ASH-GLN19L', 250, 'Tri Wahyudi', 'Produksi Galon']
    ]
  },
  distribusi: {
    type: 'distribusi',
    title: 'Pengiriman Distribusi Armada (Format Standar AMDK)',
    filename: 'Template_AIRIS_Distribusi.xlsx',
    headers: [
      'ID DISTRIBUSI', 'NAMA PELANGGAN', 'LEVEL', 'TANGGAL KIRIM', 'NO SURAT JALAN', 'TUJUAN', 
      'C120', 'C220', 'B330', 'B600', 'G19', 
      'METODE KIRIM', 'TOTAL TAGIHAN', 'PENGIRIM', 'PENERIMA', 'KETERANGAN'
    ],
    sampleRows: [
      ['DST-202610-689-MARKO-00001', 'MARKO DWI NUGROHO', 'Agen', '21-Okt-2026', '689/X/26', 'KLATEN', 0, 2, 0, 0, 0, 'Ambil Sendiri', 34500, 'Tri Wahyudi', '-', ''],
      ['DST-202610-690-AHMAD-00002', 'AGEN AHMAD ZAMRONI', 'Agen', '22-Okt-2026', '690/X/26', 'KLATEN', 0, 10, 0, 0, 0, 'Ambil Sendiri', 172500, 'Tri Wahyudi', '-', ''],
      ['DST-202610-691-ONA-00003', 'ONA SETYO PURNOMO', 'Agen', '22-Okt-2026', '691/X/26', 'KLATEN', 0, 4, 0, 0, 0, 'Ambil Sendiri', 69000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-692-DRONO-00004', 'D. PR GP ANSOR DRONO', 'Distributor', '22-Okt-2026', '692/X/26', 'DRONO', 0, 100, 0, 0, 60, 'Ambil Sendiri', 1990000, 'Agus Setiawan', '-', ''],
      ['DST-202610-693-JATIN-00005', 'AGEN PAC FATAYAT JATINOM', 'Agen', '22-Okt-2026', '693/X/26', 'JATINOM', 20, 150, 0, 0, 30, 'Ambil Sendiri', 3265000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-694-MTS-00006', 'MTS AL-QURANI KARANGNONGKO', 'Agen', '22-Okt-2026', '694/X/26', 'KARANGNONGKO', 5, 0, 0, 0, 0, 'Ambil Sendiri', 60000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-695-DARUS-00007', 'AGEN MI DARUSSALAM', 'Agen', '22-Okt-2026', '695/X/26', 'KLATEN', 10, 0, 0, 0, 0, 'Ambil Sendiri', 120000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-696-HUSNA-00008', 'MTS TQ AL-HUSNA', 'Agen', '22-Okt-2026', '696/X/26', 'KLATEN', 30, 0, 0, 0, 0, 'Ambil Sendiri', 360000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-697-SMK-00009', 'SMK BATUR JAYA 2', 'Agen', '22-Okt-2026', '697/X/26', 'CEPER', 10, 0, 0, 0, 0, 'Ambil Sendiri', 120000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-698-ROUDO-00010', 'MI ROUDOTUZZAHIDIN', 'Agen', '22-Okt-2026', '698/X/26', 'KLATEN', 15, 0, 0, 0, 0, 'Ambil Sendiri', 180000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-699-JIWAN-00011', 'D. PR NU JIWAN', 'Distributor', '23-Okt-2026', '699/X/26', 'JIWAN', 0, 200, 0, 0, 0, 'Ambil Sendiri', 3600000, 'Agus Setiawan', '-', ''],
      ['DST-202610-700-SUPRA-00012', 'AGEN SUPRAPTO', 'Agen', '23-Okt-2026', '700/X/26', 'KARANGANOM', 0, 100, 0, 0, 0, 'Ambil Sendiri', 1900000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-701-ALAMI-00013', 'AGEN AL-AMIN', 'Agen', '23-Okt-2026', '701/X/26', 'KLATEN', 30, 0, 0, 0, 0, 'Ambil Sendiri', 360000, 'Tri Wahyudi', '-', ''],
      ['DST-202610-702-KARAN-00014', 'D. MWC NU KARANGNONGKO', 'Distributor', '23-Okt-2026', '702/X/26', 'KARANGNONGKO', 20, 50, 10, 15, 30, 'Diantar Armada', 2725000, 'Tri Wahyudi', 'Bpk Rohmad', '']
    ]
  },
  pembelian_bahan: {
    type: 'pembelian_bahan',
    title: 'Pembelian Bahan Baku (Masuk)',
    filename: 'Template_AIRIS_Pembelian_Bahan.xlsx',
    headers: ['ID_Pembelian', 'Tanggal', 'ID_Bahan', 'Nama_Bahan', 'Supplier', 'Harga_Satuan', 'Qty', 'Keterangan'],
    sampleRows: [
      ['PB-1001', '2026-10-16', 'BHN-CUP220', 'Cup Plastik 220ml Printing', 'PT. Sumber Plastik Nusantara', 110, 10000, 'Restock awal bulan']
    ]
  },
  mutasi_bahan: {
    type: 'mutasi_bahan',
    title: 'Mutasi Bahan / Pemakaian Keluar',
    filename: 'Template_AIRIS_Mutasi_Bahan.xlsx',
    headers: ['ID_Mutasi', 'Tanggal', 'ID_Bahan', 'Nama_Bahan', 'Jenis_Mutasi', 'Kategori', 'Qty', 'Keterangan'],
    sampleRows: [
      ['MT-1001', '2026-10-16', 'BHN-KARTON220', 'Karton Dus 220ml (isi 48)', 'Keluar', 'Barang Rusak (Reject)', 25, 'Karton sobek saat bongkar muat']
    ]
  },
  qc: {
    type: 'qc',
    title: 'Pengujian Mutu Laboratorium (QC SNI)',
    filename: 'Template_AIRIS_QC_Laboratorium.xlsx',
    headers: [
      'ID_QC', 'Tanggal', 'Produk', 'Petugas_QC', 'ID_Produksi', 'Siklus',
      'Baku_pH', 'Baku_TDS', 'Baku_Kekeruhan', 'Baku_Bau', 'Baku_Coliform',
      'Proses_pH', 'Proses_TDS', 'Proses_Kekeruhan', 'Proses_Bau', 'Proses_Rasa', 'Proses_Ozon',
      'Jadi_pH', 'Jadi_TDS', 'Jadi_Kekeruhan', 'Jadi_Bau', 'Jadi_Rasa', 'Jadi_Ozon', 'Jadi_ALT_Awal', 'Jadi_ALT_Akhir', 'Jadi_Coliform'
    ],
    sampleRows: [
      ['QC-26101601', '2026-10-16', 'As-Shofaa Botol 600 ml', 'Nurul Hidayati', 'PRD-16102601', 'Siklus 1', 7.5, 121, 0.25, 'TB', 0, 7.4, 115, 0.22, 'TB', 'Segar', 0.12, 7.5, 121, 0.25, 'TB', 'Segar', 0.08, 10, 20, 0],
      ['QC-26101601', '2026-10-16', 'As-Shofaa Botol 600 ml', 'Nurul Hidayati', 'PRD-16102601', 'Siklus 2', 7.5, 120, 0.19, 'TB', 0, 7.3, 114, 0.20, 'TB', 'Segar', 0.13, 7.5, 120, 0.19, 'TB', 'Segar', 0.08, 12, 22, 0],
      ['QC-26101601', '2026-10-16', 'As-Shofaa Botol 600 ml', 'Nurul Hidayati', 'PRD-16102601', 'Siklus 3', 7.4, 125, 0.22, 'TB', 0, 7.3, 116, 0.21, 'TB', 'Segar', 0.12, 7.4, 125, 0.22, 'TB', 'Segar', 0.09, 10, 18, 0],
      ['QC-26101301', '2026-10-13', 'As-Shofaa Cup 220 ml', 'Nurul Hidayati', 'PRD-13102601', 'Siklus 1', 7.3, 120, 0.23, 'TB', 0, 7.2, 112, 0.21, 'TB', 'Segar', 0.12, 7.3, 120, 0.23, 'TB', 'Segar', 0.08, 10, 20, 0],
      ['QC-26101301', '2026-10-13', 'As-Shofaa Cup 220 ml', 'Nurul Hidayati', 'PRD-13102601', 'Siklus 2', 7.4, 123, 0.26, 'TB', 0, 7.2, 113, 0.22, 'TB', 'Segar', 0.13, 7.4, 123, 0.26, 'TB', 'Segar', 0.08, 11, 21, 0],
      ['QC-26101301', '2026-10-13', 'As-Shofaa Cup 220 ml', 'Nurul Hidayati', 'PRD-13102601', 'Siklus 3', 7.4, 127, 0.18, 'TB', 0, 7.3, 115, 0.20, 'TB', 'Segar', 0.12, 7.4, 127, 0.18, 'TB', 'Segar', 0.09, 10, 19, 0]
    ]
  },
  coa_saldo: {
    type: 'coa_saldo',
    title: 'Bagan Akun Standar Manufaktur (Master COA)',
    filename: 'Template_AIRIS_Master_COA_Pabrik.xlsx',
    headers: ['KODE_AKUN', 'NAMA_AKUN', 'KATEGORI', 'SALDO_NORMAL', 'STATUS'],
    sampleRows: [
      ['111-10', 'Kas Kecil (Petty Cash Kantor)', 'Aset Lancar', 'Debit', 'Aktif'],
      ['111-20', 'Kas Bank BSI Operasional (1607134444)', 'Aset Lancar', 'Debit', 'Aktif'],
      ['112-10', 'Piutang Usaha (Distributor, Agen & Toko)', 'Aset Lancar', 'Debit', 'Aktif'],
      ['113-20', 'Persediaan Bahan Kemasan (Cup, Botol, Tutup, Sedotan)', 'Aset Lancar', 'Debit', 'Aktif'],
      ['113-40', 'Persediaan Barang Jadi (Air Mineral Cup, Botol, Galon Siap Kirim)', 'Aset Lancar', 'Debit', 'Aktif'],
      ['121-20', 'Mesin Water Treatment Plant (WTP) & Pengolahan Air', 'Aset Tetap', 'Debit', 'Aktif'],
      ['121-21', 'Mesin Filling & Sealing Otomatis (Cup, Botol, Galon)', 'Aset Tetap', 'Debit', 'Aktif'],
      ['122-20', 'Akumulasi Penyusutan Mesin Produksi & WTP', 'Kontra Aset', 'Kredit', 'Aktif'],
      ['211-10', 'Utang Usaha (Supplier Bahan Baku & Kemasan)', 'Liabilitas Pendek', 'Kredit', 'Aktif'],
      ['221-10', 'Utang Bank Jangka Panjang (Investasi Pabrik & Mesin)', 'Liabilitas Panjang', 'Kredit', 'Aktif'],
      ['311-10', 'Modal Disetor Pemilik / Pemegang Saham', 'Ekuitas', 'Kredit', 'Aktif'],
      ['411-10', 'Pendapatan Penjualan Air Cup (120ml & 220ml)', 'Pendapatan', 'Kredit', 'Aktif'],
      ['411-20', 'Pendapatan Penjualan Air Botol (330ml & 600ml)', 'Pendapatan', 'Kredit', 'Aktif'],
      ['411-30', 'Pendapatan Penjualan Air Galon (19 Liter)', 'Pendapatan', 'Kredit', 'Aktif'],
      ['512-10', 'Beban Pemakaian Bahan Baku & Penolong (Kemasan, Cup, Botol, Lid, Kardus)', 'Harga Pokok', 'Debit', 'Aktif'],
      ['513-10', 'Beban Upah Operator & Pekerja Line Produksi', 'Harga Pokok', 'Debit', 'Aktif'],
      ['514-10', 'Beban Listrik PLN & Daya Pabrik (Power Utility)', 'Harga Pokok', 'Debit', 'Aktif'],
      ['611-10', 'Beban Gaji Staf Kantor, Keuangan, & Manajemen (HRD)', 'Beban', 'Debit', 'Aktif'],
      ['611-30', 'Beban Bahan Bakar (BBM) & Uang Jalan Armada', 'Beban', 'Debit', 'Aktif'],
      ['711-10', 'Pendapatan Bunga Bank / Jasa Giro', 'Pendapatan Lain', 'Kredit', 'Aktif'],
      ['811-10', 'Beban Bunga Pinjaman Bank Jangka Panjang', 'Beban Lain', 'Debit', 'Aktif']
    ]
  },
  jurnal: {
    type: 'jurnal',
    title: 'Jurnal Umum Double-Entry',
    filename: 'Template_AIRIS_Jurnal_Umum.xlsx',
    headers: ['ID_JURNAL', 'TANGGAL', 'PERIODE', 'REFERENSI', 'KETERANGAN', 'KODE_AKUN', 'DEBIT', 'KREDIT', 'PEMBUAT'],
    sampleRows: [
      ['JUR-2610-001', '2026-10-01', '2026-10', 'SALDO-AWAL', 'Pencatatan Saldo Awal Bank', '111-20', 45000000, 0, 'Admin'],
      ['JUR-2610-001', '2026-10-01', '2026-10', 'SALDO-AWAL', 'Pencatatan Saldo Awal Modal', '311-10', 0, 45000000, 'Admin']
    ]
  },
  kasbon: {
    type: 'kasbon',
    title: 'Pinjaman Kasbon Karyawan',
    filename: 'Template_AIRIS_Kasbon.xlsx',
    headers: ['ID_Kasbon', 'Tanggal', 'ID_Karyawan', 'Nama_Karyawan', 'Nominal', 'Tenor', 'Cicilan_Per_Bulan'],
    sampleRows: [
      ['KSB-001', '2026-10-10', 'KAR-0002', 'Tri Wahyudi', 1000000, 2, 500000]
    ]
  },
  aset: {
    type: 'aset',
    title: 'Aset Tetap & Penyusutan',
    filename: 'Template_AIRIS_Aset_Tetap.xlsx',
    headers: ['ID_ASET', 'NAMA_ASET', 'TGL_BELI', 'NILAI_PEROLEHAN', 'NILAI_RESIDU', 'UMUR_EKONOMIS_BLN', 'BEBAN_PENYUSUTAN_BLN', 'AKUN_ASET', 'AKUN_AKUMULASI', 'AKUN_BEBAN'],
    sampleRows: [
      ['AST-001', 'Mesin 8-Line Cup Sealing Auto', '2023-01-10', 85000000, 10000000, 60, 1250000, '121-20', '122-20', '514-20'],
      ['AST-002', 'Truk Engkel Isuzu Elf Box Distribusi', '2023-02-15', 195000000, 35000000, 96, 1666667, '121-30', '122-30', '611-70']
    ]
  },
  po: {
    type: 'po',
    title: 'Purchase Order (PO)',
    filename: 'Template_AIRIS_Purchase_Order.xlsx',
    headers: ['ID_PO', 'Tanggal_PO', 'No_PO', 'Order_Ke', 'Alamat_Supplier', 'Syarat_Ketentuan', 'Grand_Total', 'Status'],
    sampleRows: [
      ['PO-001', '2026-10-15', '001-PO-X-26', 'PT. Sumber Plastik Nusantara', 'Solo Baru', 'Tempo 14 hari', 5200000, 'Terkirim ke Pemasok']
    ]
  },
  presensi: {
    type: 'presensi',
    title: 'Rekap Presensi Karyawan Harian',
    filename: 'Template_AIRIS_Presensi_Karyawan.xlsx',
    headers: [
      'ID_Karyawan', 'Nama_Karyawan', 'Bulan_Tahun',
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
      'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20',
      'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31'
    ],
    sampleRows: [
      ['KAR-0001', 'Marko Dwi Nugroho', '2026-10', 'H','H','H','H','H','H','L','H','H','H','H','H','H','L','H','H','H','H','H','H','L','H','H','H','H','H','H','L','H','H','H'],
      ['KAR-0002', 'Tri Wahyudi', '2026-10', 'H','H','T','H','H','H','L','H','H','S','H','H','H','L','H','H','H','PA','H','H','L','H','H','H','H','H','H','L','H','H','H']
    ]
  },
  lembur: {
    type: 'lembur',
    title: 'Rekap Lembur Karyawan Harian',
    filename: 'Template_AIRIS_Lembur_Karyawan.xlsx',
    headers: [
      'ID_Karyawan', 'Nama_Karyawan', 'Bulan_Tahun',
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
      'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20',
      'T21', 'T22', 'T23', 'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31'
    ],
    sampleRows: [
      ['KAR-0001', 'Marko Dwi Nugroho', '2026-10', 0, 2, 0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ['KAR-0002', 'Tri Wahyudi', '2026-10', 0, 0, 2, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]
  },
  histori_penggajian: {
    type: 'histori_penggajian',
    title: 'Histori Paket Penggajian Karyawan',
    filename: 'Template_AIRIS_Histori_Penggajian.xlsx',
    headers: [
      'ID_Batch', 'Bulan_Tahun', 'ID_Karyawan', 'Nama_Karyawan',
      'Gaji_Pokok', 'Tunjangan', 'Bonus_Hadir', 'Bonus_Target',
      'Upah_Lembur', 'PPh21', 'BPJS', 'Kasbon', 'Potongan_Absen', 'Gaji_Bersih'
    ],
    sampleRows: [
      ['BATCH-2026-10', '2026-10', 'KAR-0001', 'Marko Dwi Nugroho', 4500000, 750000, 75000, 0, 234104, 90000, 40000, 0, 0, 5429104],
      ['BATCH-2026-10', '2026-10', 'KAR-0002', 'Tri Wahyudi', 2900000, 400000, 0, 0, 176012, 58000, 40000, 500000, 111538, 2766474]
    ]
  }
};

/**
 * Downloads a pre-formatted Excel template with sample rows
 */
export function downloadExcelTemplate(type: ExcelTemplateType) {
  const def = EXCEL_TEMPLATES[type];
  if (!def) return;

  const data = [def.headers, ...def.sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = def.headers.map(() => ({ wch: 22 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Data');
  XLSX.writeFile(workbook, def.filename);
}

export interface ParseExcelResult {
  success: boolean;
  data?: any[];
  error?: string;
  sheetName?: string;
  sheetNames?: string[];
  totalRows?: number;
}

/**
 * Smart Worksheet Parser:
 * 1. Mendeteksi otomatis baris header tabel sesungguhnya (melewati baris judul, logo, kop, atau spasi kosong di atas).
 * 2. Membersihkan nama kolom (trim spasi, hapus karakter newline \r \n, dan beri alias jika duplikat).
 * 3. Menyaring baris kosong dan baris rekapitulasi / TOTAL di bagian bawah tabel.
 */
export function smartParseWorksheet(worksheet: XLSX.WorkSheet): any[] {
  if (!worksheet || !worksheet['!ref']) return [];

  // Konversi seluruh worksheet ke bentuk 2D array (baris x kolom)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
  if (!rawRows || rawRows.length === 0) return [];

  // Kata kunci umum yang biasa muncul di baris header tabel AMDK / pabrik
  const headerKeywords = [
    'pelanggan', 'customer', 'nama', 'tanggal', 'tgl', 'surat', 'jalan', 'sj',
    'produk', 'item', 'barang', 'c120', 'c220', 'b330', 'b600', 'g19', 'galon',
    '120', '220', '330', '600', 'qty', 'jumlah', 'volume', 'pengirim', 'driver',
    'sopir', 'supir', 'penerima', 'tujuan', 'alamat', 'metode', 'invoice', 'spk',
    'harga', 'total', 'tagihan', 'keterangan', 'kode', 'level', 'shift',
    'status', 'kategori', 'satuan', 'departemen', 'jabatan', 'supplier', 'nominal'
  ];

  let headerRowIdx = -1;
  let maxKeywordScore = 0;

  // Pindai hingga 20 baris pertama untuk mencari baris header tabel yang paling tepat
  const scanLimit = Math.min(rawRows.length, 20);
  for (let r = 0; r < scanLimit; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    let nonEmptyCount = 0;

    row.forEach(cell => {
      const cellStr = String(cell !== undefined && cell !== null ? cell : '').trim().toLowerCase();
      if (cellStr) {
        nonEmptyCount++;
        for (const kw of headerKeywords) {
          if (cellStr === kw || (kw.length >= 3 && cellStr.includes(kw))) {
            score += 2;
            break;
          }
        }
      }
    });

    if (score > maxKeywordScore && nonEmptyCount >= 2) {
      maxKeywordScore = score;
      headerRowIdx = r;
    }
  }

  // Fallback: cari baris dengan jumlah sel terisi terbanyak
  if (headerRowIdx === -1) {
    let maxNonEmpty = 0;
    for (let r = 0; r < scanLimit; r++) {
      const row = rawRows[r];
      const count = Array.isArray(row) ? row.filter(c => String(c !== undefined && c !== null ? c : '').trim() !== '').length : 0;
      if (count > maxNonEmpty) {
        maxNonEmpty = count;
        headerRowIdx = r;
      }
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  const headerRow = rawRows[headerRowIdx] || [];
  const cleanHeaders: string[] = [];
  const headerCounts: Record<string, number> = {};

  headerRow.forEach((h, colIdx) => {
    let clean = String(h !== undefined && h !== null ? h : '').trim().replace(/[\r\n\t]+/g, ' ');
    if (!clean) clean = `Kolom_${colIdx + 1}`;
    if (headerCounts[clean]) {
      headerCounts[clean]++;
      clean = `${clean}_${headerCounts[clean]}`;
    } else {
      headerCounts[clean] = 1;
    }
    cleanHeaders.push(clean);
  });

  // Deteksi cerdas: Dukung tabel dengan Header Gabungan 2 Baris (Merged 2-Row Header)
  // Hanya aktif jika baris berikutnya murni berupa label kolom produk dan BUKAN baris transaksi riil
  let dataStartIdx = headerRowIdx + 1;
  if (dataStartIdx < rawRows.length) {
    const nextRow = rawRows[dataStartIdx];
    const subHeaderKeywords = ['c120', 'c220', 'b330', 'b600', 'g19', 'galon', 'qty', 'dus', 'btl', 'botol', 'cup', 'volume', 'subtotal', 'satuan'];
    if (Array.isArray(nextRow)) {
      // Baris data transaksi pasti memiliki angka jumlah/tagihan, tanggal transaksi, nomor surat jalan, atau nama pelanggan
      const hasDataValues = nextRow.some(c => {
        if (typeof c === 'number' && c > 0) return true;
        if (c instanceof Date) return true;
        const str = String(c || '').trim();
        if (/^\d{1,2}[\/\-. ]\d{1,2}[\/\-. ]\d{2,4}/.test(str)) return true;
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
        if (/\d+\/[A-Z0-9]+\/\d+/.test(str)) return true;
        return false;
      });

      // Hanya merge jika baris tersebut BUKAN data transaksi dan memiliki label sub-header produk
      if (!hasDataValues) {
        let subKwCount = 0;
        nextRow.forEach(c => {
          const cStr = String(c || '').trim().toLowerCase();
          if (subHeaderKeywords.some(kw => cStr === kw || (kw.length >= 3 && cStr.includes(kw)))) {
            subKwCount++;
          }
        });

        if (subKwCount >= 2) {
          dataStartIdx = headerRowIdx + 2;
          nextRow.forEach((subH, colIdx) => {
            const subClean = String(subH || '').trim().replace(/[\r\n\t]+/g, ' ');
            if (subClean && colIdx < cleanHeaders.length) {
              const parentClean = cleanHeaders[colIdx] || '';
              if (parentClean.startsWith('Kolom_') || !parentClean) {
                cleanHeaders[colIdx] = subClean;
              } else {
                const parentLower = parentClean.toLowerCase();
                // Jika parent adalah kata umum kategori, gunakan sub-header produk langsung (misal 'C120' atau 'G19')
                const isGenericParent = ['produk', 'item', 'barang', 'kemasan', 'pesanan', 'varian'].some(g => parentLower === g || parentLower.startsWith(g));
                if (isGenericParent) {
                  cleanHeaders[colIdx] = subClean;
                } else if (!parentLower.includes(subClean.toLowerCase())) {
                  cleanHeaders[colIdx] = `${parentClean} ${subClean}`;
                }
              }
            } else if (subClean && colIdx >= cleanHeaders.length) {
              cleanHeaders.push(subClean);
            }
          });
        }
      }
    }
  }

  const result: any[] = [];
  for (let r = dataStartIdx; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    // Periksa apakah baris benar-benar kosong
    const nonEmpties = row.filter(c => String(c !== undefined && c !== null ? c : '').trim() !== '');
    if (nonEmpties.length === 0) continue;

    // Abaikan baris ringkasan / TOTAL di bagian bawah tabel HANYA jika baris tersebut BUKAN transaksi riil
    const firstCell = String(row[0] || '').trim().toLowerCase();
    const secondCell = String(row[1] || '').trim().toLowerCase();
    const thirdCell = String(row[2] || '').trim().toLowerCase();
    const isTotalKeyword = (
      firstCell.startsWith('total') || firstCell.startsWith('grand total') || firstCell.startsWith('jumlah total') || firstCell.startsWith('rekap') ||
      secondCell.startsWith('total') || secondCell.startsWith('grand total') || secondCell.startsWith('jumlah total') ||
      thirdCell.startsWith('total') || thirdCell.startsWith('grand total')
    );

    if (isTotalKeyword) {
      // Pastikan baris ini bukan transaksi riil (tidak ada tanggal, no surat jalan, atau tujuan)
      const hasTransactionData = row.some(c => {
        if (!c) return false;
        if (c instanceof Date) return true;
        const str = String(c).trim();
        if (/^\d{1,2}[\/\-. ]\d{1,2}[\/\-. ]\d{2,4}/.test(str)) return true;
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true;
        if (/\d+\/[A-Z0-9]+\/\d+/.test(str)) return true;
        return false;
      });

      // Hanya lewati jika benar-benar baris ringkasan footer (bukan transaksi pengiriman)
      if (!hasTransactionData) {
        continue;
      }
    }

    const rowObj: Record<string, any> = {};
    cleanHeaders.forEach((h, colIdx) => {
      rowObj[h] = row[colIdx] !== undefined ? row[colIdx] : '';
      rowObj[`__col_${colIdx}`] = row[colIdx] !== undefined ? row[colIdx] : '';
    });
    rowObj['__rawRow'] = row;
    result.push(rowObj);
  }

  return result;
}

/**
 * Parses an uploaded Excel or CSV file with smart sheet and header resolution
 */
export async function parseExcelFile(
  file: File, 
  targetModuleHint?: string, 
  specifiedSheetName?: string
): Promise<ParseExcelResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheetNames = workbook.SheetNames || [];

    if (sheetNames.length === 0) {
      return { success: false, error: 'File Excel tidak memiliki lembar kerja (sheet).' };
    }

    let targetSheetName = specifiedSheetName || '';

    // Jika sheet belum ditentukan, cari sheet terbaik yang sesuai dengan targetModuleHint
    if (!targetSheetName) {
      const hint = String(targetModuleHint || '').toLowerCase();
      const distAliases = ['distribusi', 'dist', 'pengiriman', 'kirim', 'suratjalan', 'sj', 'delivery', 'logistik', 'template_data', 'templatedata', 'template', 'transaksi'];

      // 1. Prioritaskan sheet yang memiliki nama sesuai modul target
      for (const name of sheetNames) {
        const norm = name.toLowerCase().replace(/[\s_\-]+/g, '');
        if (hint && (norm.includes(hint) || hint.includes(norm))) {
          targetSheetName = name;
          break;
        }
        if (hint === 'distribusi' && distAliases.some(alias => norm.includes(alias))) {
          targetSheetName = name;
          break;
        }
      }

      // 2. Jika tidak ada yang cocok langsung, pilih sheet dengan jumlah baris data terbanyak
      if (!targetSheetName) {
        let bestSheet = sheetNames[0];
        let maxRows = -1;
        for (const name of sheetNames) {
          const ws = workbook.Sheets[name];
          if (!ws || !ws['!ref']) continue;
          try {
            const range = XLSX.utils.decode_range(ws['!ref']);
            const count = range.e.r - range.s.r + 1;
            if (count > maxRows) {
              maxRows = count;
              bestSheet = name;
            }
          } catch {
            // Abaikan error range
          }
        }
        targetSheetName = bestSheet;
      }
    }

    const worksheet = workbook.Sheets[targetSheetName];
    if (!worksheet) {
      return { success: false, error: `Lembar kerja "${targetSheetName}" tidak ditemukan.` };
    }

    const parsedData = smartParseWorksheet(worksheet);

    if (!parsedData || parsedData.length === 0) {
      // Fallback: coba sheet_to_json standar jika smartParseWorksheet tidak menghasilkan baris
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (rawJson && rawJson.length > 0) {
        return {
          success: true,
          data: rawJson,
          sheetName: targetSheetName,
          sheetNames,
          totalRows: rawJson.length
        };
      }
      return { 
        success: false, 
        error: `Sheet "${targetSheetName}" kosong atau tidak memiliki baris data yang valid.`,
        sheetNames
      };
    }

    return {
      success: true,
      data: parsedData,
      sheetName: targetSheetName,
      sheetNames,
      totalRows: parsedData.length
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal membaca format file Excel.' };
  }
}

/**
 * Exports JSON data or HTML table to an Excel workbook with optional corporate header title
 */
export function exportDataToExcel(
  data: any[], 
  sheetName: string, 
  fileName: string, 
  reportHeaderTitle?: string
) {
  const workbook = XLSX.utils.book_new();
  let worksheet: XLSX.WorkSheet;

  if (reportHeaderTitle && Array.isArray(data) && data.length > 0) {
    // Official corporate title banner
    const titleRows = [
      ['PT. ANUGERAH ILLAHI RABBI'],
      ['PABRIK AIR MINUM DALAM KEMASAN (AMDK) AS-SHOFAA - KLATEN'],
      [reportHeaderTitle.toUpperCase()],
      [`Tanggal Unduh / Ekspor: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`],
      [] // separator empty row
    ];
    worksheet = XLSX.utils.aoa_to_sheet(titleRows);
    XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A6' });
  } else {
    worksheet = XLSX.utils.json_to_sheet(data);
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

// ================================================================
// MULTI-TAB DATABASE BACKUP & RESTORE SERVICE
// ================================================================

export interface DatabaseTableDefinition {
  tableName: string;
  sheetName: string;
  label: string;
  fallbackTable?: string;
}

export const ALL_DATABASE_TABLES: DatabaseTableDefinition[] = [
  { tableName: 'MD_Produk', sheetName: 'MD_Produk', label: 'Master Produk AMDK' },
  { tableName: 'MD_Pelanggan', sheetName: 'MD_Pelanggan', label: 'Master Pelanggan & Mitra' },
  { tableName: 'MD_Supplier', sheetName: 'MD_Supplier', label: 'Master Pemasok & Vendor' },
  { tableName: 'MD_BahanPenolong', sheetName: 'MD_BahanPenolong', label: 'Master Bahan Penolong' },
  { tableName: 'MD_BOM', sheetName: 'MD_BOM', label: 'Formula BOM Resep' },
  { tableName: 'MD_Karyawan', sheetName: 'MD_Karyawan', label: 'Master Data Karyawan' },
  { tableName: 'MD_UserAkses', sheetName: 'MD_UserAkses', label: 'User & Hak Akses' },
  { tableName: 'MD_HargaKhusus', sheetName: 'MD_HargaKhusus', label: 'Harga Khusus Mitra' },
  { tableName: 'SPK', sheetName: 'SPK', label: 'Surat Perintah Kerja (SPK)' },
  { tableName: 'Produksi', sheetName: 'Produksi', label: 'Realisasi Produksi' },
  { tableName: 'Rencana_Distribusi', sheetName: 'Rencana_Distribusi', label: 'Rencana Kirim & Pesanan' },
  { tableName: 'Distribusi', sheetName: 'Distribusi', label: 'Distribusi & Surat Jalan' },
  { tableName: 'Distribusi_Item', sheetName: 'Distribusi_Item', label: 'Item Produk Distribusi' },
  { tableName: 'Pembelian_Bahan', sheetName: 'Pembelian_Bahan', label: 'Pembelian Bahan Baku' },
  { tableName: 'Mutasi_Bahan', sheetName: 'Mutasi_Bahan', label: 'Mutasi Stok & Reject' },
  { tableName: 'Data_QC', sheetName: 'Data_QC', label: 'Uji Mutu Laboratorium' },
  { tableName: 'Data_QC_Detail', sheetName: 'Data_QC_Detail', label: 'Detail Siklus QC SNI' },
  { tableName: 'Data_Presensi', sheetName: 'Data_Presensi', label: 'Presensi Karyawan' },
  { tableName: 'Data_Lembur', sheetName: 'Data_Lembur', label: 'Lembur Karyawan' },
  { tableName: 'Data_Kasbon', sheetName: 'Data_Kasbon', label: 'Pinjaman Kasbon' },
  { tableName: 'Histori_Penggajian', sheetName: 'Histori_Penggajian', label: 'Histori Penggajian' },
  { tableName: 'HRD_Payroll_Settings', sheetName: 'HRD_Payroll_Settings', label: 'Pengaturan Payroll' },
  { tableName: 'Data_COA', sheetName: 'Data_COA', label: 'Bagan Akun (COA)', fallbackTable: 'Master_COA' },
  { tableName: 'Jurnal_Umum', sheetName: 'Jurnal_Umum', label: 'Jurnal Umum Keuangan' },
  { tableName: 'Draf_Jurnal', sheetName: 'Draf_Jurnal', label: 'Draf Jurnal Otomatis' },
  { tableName: 'Aset_Tetap', sheetName: 'Aset_Tetap', label: 'Aset Tetap & Penyusutan', fallbackTable: 'Data_Aset_Tetap' },
  { tableName: 'Data_Piutang_Utang', sheetName: 'Data_Piutang_Utang', label: 'Piutang & Utang Usaha' },
  { tableName: 'Data_Pembayaran_Pelanggan', sheetName: 'Data_Pembayaran_Pelanggan', label: 'Pembayaran Piutang' },
  { tableName: 'Data_Surat', sheetName: 'Data_Surat', label: 'Arsip Surat Resmi' },
  { tableName: 'Admin_PO', sheetName: 'Admin_PO', label: 'Purchase Order (PO)' },
  { tableName: 'Admin_PO_Detail', sheetName: 'Admin_PO_Detail', label: 'Detail Item PO' },
  { tableName: 'Data_Invoice_Custom', sheetName: 'Data_Invoice_Custom', label: 'Invoice Custom' },
  { tableName: 'Histori_Perubahan_Harga', sheetName: 'Histori_Perubahan_Harga', label: 'Histori Perubahan Harga' },
  { tableName: 'Log_Akses_Pengguna', sheetName: 'Log_Akses_Pengguna', label: 'Histori Akses Pengguna' },
];

/**
 * Exports the ENTIRE database into a single multi-sheet Excel workbook.
 * Every table lives on its own dedicated worksheet / tab.
 */
export function exportAllDatabaseToExcel(exportedBy: string = 'Admin', filename?: string): { 
  success: boolean; 
  totalTables: number; 
  totalRows: number; 
  filename: string 
} {
  const workbook = XLSX.utils.book_new();
  let totalRows = 0;
  let exportedTablesCount = 0;

  // Overview / Index Sheet
  const summaryRows: any[][] = [
    ['SISTEM PABRIK AMDK AS-SHOFAA • PT. ANUGERAH ILLAHI RABBI'],
    ['FILE CADANGAN DATABASE LENGKAP (MULTI-TAB EXCEL WORKBOOK)'],
    [`Tanggal & Waktu Ekspor: ${new Date().toLocaleString('id-ID')}`],
    [`Diekspor Oleh: ${exportedBy}`],
    [''],
    ['No', 'Nama Lembar Kerja (Sheet / Tab)', 'Modul / Tabel Database', 'Jumlah Baris Data', 'Status']
  ];

  ALL_DATABASE_TABLES.forEach((tbl, idx) => {
    let rows = getTableData<any>(tbl.tableName, []);
    if ((!rows || rows.length === 0) && tbl.fallbackTable) {
      rows = getTableData<any>(tbl.fallbackTable, []);
    }
    const rowCount = Array.isArray(rows) ? rows.length : 0;
    totalRows += rowCount;
    exportedTablesCount++;
    summaryRows.push([
      idx + 1,
      tbl.sheetName,
      tbl.label,
      rowCount,
      rowCount > 0 ? 'Berisi Data' : 'Tabel Kosong'
    ]);

    // Prepare clean row data for SheetJS (serialize nested objects so they don't become [object Object])
    const cleanRows = (rows || []).map(r => {
      const cleanObj: Record<string, any> = {};
      Object.entries(r).forEach(([k, v]) => {
        if (v !== null && typeof v === 'object') {
          cleanObj[k] = JSON.stringify(v);
        } else {
          cleanObj[k] = v;
        }
      });
      return cleanObj;
    });

    let ws: XLSX.WorkSheet;
    if (cleanRows.length > 0) {
      ws = XLSX.utils.json_to_sheet(cleanRows);
      // Auto-fit column widths
      const colKeys = Object.keys(cleanRows[0]);
      ws['!cols'] = colKeys.map(k => ({ wch: Math.max(k.length + 4, 15) }));
    } else {
      ws = XLSX.utils.aoa_to_sheet([['Belum ada catatan data pada tabel ini']]);
      ws['!cols'] = [{ wch: 45 }];
    }

    XLSX.utils.book_append_sheet(workbook, ws, tbl.sheetName);
  });

  // Create Summary worksheet and place it as the first sheet
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summaryWs, '_RINGKASAN_DATABASE');

  // Reorder so _RINGKASAN_DATABASE is sheet #1
  const sheetNames = workbook.SheetNames;
  const lastIndex = sheetNames.length - 1;
  const summaryName = sheetNames.splice(lastIndex, 1)[0];
  sheetNames.unshift(summaryName);

  const finalName = filename || `AIRIS_Backup_Lengkap_MultiTab_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, finalName);

  return { success: true, totalTables: exportedTablesCount, totalRows, filename: finalName };
}

/**
 * Restores entire database from an uploaded multi-sheet Excel workbook.
 * Reads every sheet, identifies corresponding table, and updates storage.
 */
export async function restoreAllDatabaseFromExcel(file: File): Promise<{
  success: boolean;
  restoredTables: { tableName: string; sheetName: string; rowCount: number }[];
  totalRows: number;
  message?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, restoredTables: [], totalRows: 0, message: 'File Excel tidak memiliki lembar kerja (sheet).' };
    }

    const restoredTables: { tableName: string; sheetName: string; rowCount: number }[] = [];
    let totalRows = 0;

    workbook.SheetNames.forEach(sheetName => {
      if (sheetName.startsWith('_')) return; // Skip summary / metadata sheets

      // Match sheet name with table
      const matched = ALL_DATABASE_TABLES.find(
        t => t.sheetName.toLowerCase() === sheetName.toLowerCase() ||
             t.tableName.toLowerCase() === sheetName.toLowerCase()
      );

      const targetTable = matched ? matched.tableName : sheetName;
      const worksheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Clean rows & deserialize JSON string properties
      const parsedRows = rawRows.filter(r => {
        const values = Object.values(r);
        return values.some(v => v !== 'Belum ada catatan data pada tabel ini' && v !== '');
      }).map(r => {
        const item: Record<string, any> = {};
        Object.entries(r).forEach(([k, v]) => {
          if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
            try {
              item[k] = JSON.parse(v);
            } catch {
              item[k] = v;
            }
          } else {
            item[k] = v;
          }
        });
        return item;
      });

      if (parsedRows.length > 0) {
        // Normalisasi data tabel agar lolos format dan constraint PostgreSQL Supabase
        const normalizedRows = normalizeTableRows(targetTable, parsedRows);
        setTableData(targetTable, normalizedRows.length > 0 ? normalizedRows : parsedRows);
        restoredTables.push({ tableName: targetTable, sheetName, rowCount: parsedRows.length });
        totalRows += parsedRows.length;
      }
    });

    if (restoredTables.length === 0) {
      return { success: false, restoredTables: [], totalRows: 0, message: 'Tidak ada baris data valid yang dapat dipulihkan dari sheet Excel.' };
    }

    // Jika Supabase aktif, jalankan pushAllTablesToSupabase untuk memastikan seluruh data masuk ke cloud
    if (isSupabaseConfigured()) {
      try {
        await pushAllTablesToSupabase();
      } catch (pushErr) {
        console.warn('[restoreAllDatabaseFromExcel] Cloud push warning:', pushErr);
      }
    }

    return { success: true, restoredTables, totalRows };
  } catch (err: any) {
    return { success: false, restoredTables: [], totalRows: 0, message: err.message || 'Gagal memulihkan database dari Excel.' };
  }
}

/**
 * Restores entire database from an uploaded JSON backup file.
 */
export async function restoreAllDatabaseFromJSON(file: File): Promise<{
  success: boolean;
  restoredTables: { tableName: string; rowCount: number }[];
  totalRows: number;
  message?: string;
}> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const db = parsed.database || parsed;
    const restoredTables: { tableName: string; rowCount: number }[] = [];
    let totalRows = 0;

    Object.entries(db).forEach(([tbl, rows]) => {
      if (Array.isArray(rows)) {
        setTableData(tbl, rows);
        restoredTables.push({ tableName: tbl, rowCount: rows.length });
        totalRows += rows.length;
      }
    });

    if (restoredTables.length === 0) {
      return { success: false, restoredTables: [], totalRows: 0, message: 'Format data JSON cadangan tidak berisi tabel yang valid.' };
    }

    return { success: true, restoredTables, totalRows };
  } catch (err: any) {
    return { success: false, restoredTables: [], totalRows: 0, message: err.message || 'File cadangan JSON tidak valid atau rusak.' };
  }
}
