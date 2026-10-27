

-- ============================================================================
-- BERKAS: 01_tables_schema.sql
-- ============================================================================

-- ============================================================================
-- AIRIS Enterprise - PostgreSQL Database Schema for Supabase
-- PT. Anugerah Illahi Rabbi (Sistem Manajemen AMDK Terintegrasi)
-- Bagian 1: Definisi Tabel & Integritas Relasional
-- ============================================================================

-- Aktifkan ekstensi UUID jika diperlukan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. MASTER DATA
-- ============================================================================

-- Master Data Produk
CREATE TABLE IF NOT EXISTS "MD_Produk" (
    "ID_Produk" VARCHAR(50) PRIMARY KEY,
    "Nama_Produk" VARCHAR(150) NOT NULL,
    "Kategori" VARCHAR(50) NOT NULL CHECK ("Kategori" IN ('Air Mineral Cup', 'Air Mineral Botol', 'Air Mineral Galon')),
    "Satuan" VARCHAR(20) NOT NULL CHECK ("Satuan" IN ('Dus', 'Galon')),
    "Harga_Distributor" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Harga_Agen" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Harga_Reseller" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Harga_Konsumen" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("Status" IN ('Aktif', 'Non-Aktif')),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Data Pelanggan
CREATE TABLE IF NOT EXISTS "MD_Pelanggan" (
    "ID_Pelanggan" VARCHAR(50) PRIMARY KEY,
    "Nama_Pelanggan" VARCHAR(150) NOT NULL,
    "No_Telp" VARCHAR(50) DEFAULT '',
    "Alamat" TEXT DEFAULT '',
    "Level_Pelanggan" VARCHAR(50) NOT NULL DEFAULT 'Distributor' CHECK ("Level_Pelanggan" IN ('Distributor', 'Agen', 'Reseller', 'Konsumen Biasa')),
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("Status" IN ('Aktif', 'Non-Aktif')),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Data Supplier
CREATE TABLE IF NOT EXISTS "MD_Supplier" (
    "ID_Supplier" VARCHAR(50) PRIMARY KEY,
    "Nama_Supplier" VARCHAR(150) NOT NULL,
    "PIC" VARCHAR(100) DEFAULT '',
    "No_Telp" VARCHAR(50) DEFAULT '',
    "Alamat" TEXT DEFAULT '',
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("Status" IN ('Aktif', 'Non-Aktif')),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Data Bahan Penolong / Baku
CREATE TABLE IF NOT EXISTS "MD_BahanPenolong" (
    "ID_Bahan" VARCHAR(50) PRIMARY KEY,
    "Nama_Bahan" VARCHAR(150) NOT NULL,
    "Kategori" VARCHAR(50) NOT NULL DEFAULT 'Kemasan',
    "Satuan" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "Harga_Satuan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Tgl_Update_Harga" DATE,
    "Minimum_Stock" NUMERIC(15, 2) NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Data BOM (Bill of Materials / Resep Standar AMDK)
CREATE TABLE IF NOT EXISTS "MD_BOM" (
    "ID_BOM" VARCHAR(50) PRIMARY KEY,
    "ID_Produk" VARCHAR(50) NOT NULL REFERENCES "MD_Produk"("ID_Produk") ON UPDATE CASCADE ON DELETE RESTRICT,
    "ID_Bahan" VARCHAR(50) NOT NULL REFERENCES "MD_BahanPenolong"("ID_Bahan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Jumlah_Dibutuhkan" NUMERIC(15, 4) NOT NULL DEFAULT 0,
    "Satuan" VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    "Keterangan" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "UQ_BOM_Produk_Bahan" UNIQUE ("ID_Produk", "ID_Bahan")
);

-- Master Data Karyawan
CREATE TABLE IF NOT EXISTS "MD_Karyawan" (
    "ID_Karyawan" VARCHAR(50) PRIMARY KEY,
    "Nama_Karyawan" VARCHAR(150) NOT NULL,
    "Departemen" VARCHAR(50) NOT NULL,
    "Jabatan" VARCHAR(50) NOT NULL,
    "Tgl_Masuk" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("Status" IN ('Aktif', 'Resign', 'Nonaktif')),
    "Gaji_Pokok" NUMERIC(15, 2) DEFAULT 0,
    "Tunjangan" NUMERIC(15, 2) DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Data Akun Pengguna (RBAC)
CREATE TABLE IF NOT EXISTS "MD_UserAkses" (
    "ID_User" VARCHAR(50) PRIMARY KEY,
    "Username" VARCHAR(100) UNIQUE NOT NULL,
    "Nama" VARCHAR(150),
    "Password" VARCHAR(255),
    "Role" VARCHAR(50) NOT NULL CHECK ("Role" IN ('SuperAdmin', 'Admin Master', 'Admin Produksi', 'Admin Gudang', 'Kasir/Finance', 'HRD')),
    "ID_Karyawan" VARCHAR(50) REFERENCES "MD_Karyawan"("ID_Karyawan") ON UPDATE CASCADE ON DELETE SET NULL,
    "Status_Akun" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("Status_Akun" IN ('Aktif', 'Terblokir')),
    "Email" VARCHAR(150),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Data Harga Khusus
CREATE TABLE IF NOT EXISTS "MD_HargaKhusus" (
    "ID_Harga_Khusus" VARCHAR(50) PRIMARY KEY,
    "ID_Pelanggan" VARCHAR(50) NOT NULL REFERENCES "MD_Pelanggan"("ID_Pelanggan") ON UPDATE CASCADE ON DELETE CASCADE,
    "ID_Produk" VARCHAR(50) NOT NULL REFERENCES "MD_Produk"("ID_Produk") ON UPDATE CASCADE ON DELETE CASCADE,
    "Harga_Custom" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "UQ_HargaKhusus_Pelanggan_Produk" UNIQUE ("ID_Pelanggan", "ID_Produk")
);

-- ============================================================================
-- 2. MANAJEMEN PRODUKSI & SPK
-- ============================================================================

-- Surat Perintah Kerja (SPK)
CREATE TABLE IF NOT EXISTS "SPK" (
    "ID_SPK" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Shift" VARCHAR(50) NOT NULL,
    "ID_Produk" VARCHAR(50) NOT NULL REFERENCES "MD_Produk"("ID_Produk") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Target_Produksi" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("Status" IN ('Aktif', 'Diproses', 'Selesai', 'Dibatalkan')),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Realisasi Hasil Produksi
CREATE TABLE IF NOT EXISTS "Produksi" (
    "ID_Produksi" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Shift" VARCHAR(50) NOT NULL,
    "ID_Produk" VARCHAR(50) NOT NULL REFERENCES "MD_Produk"("ID_Produk") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Jumlah" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "PIC_Produksi" VARCHAR(100) DEFAULT '',
    "Keterangan" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. PERSEDIAAN & BAHAN BAKU
-- ============================================================================

-- Pembelian Bahan Penolong
CREATE TABLE IF NOT EXISTS "Pembelian_Bahan" (
    "ID_Pembelian" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ID_Bahan" VARCHAR(50) NOT NULL REFERENCES "MD_BahanPenolong"("ID_Bahan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Bahan" VARCHAR(150),
    "Supplier" VARCHAR(150) NOT NULL,
    "Harga_Satuan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Qty" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Mutasi, Reject, dan Pemakaian Bahan Penolong
CREATE TABLE IF NOT EXISTS "Mutasi_Bahan" (
    "ID_Mutasi" VARCHAR(100) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ID_Bahan" VARCHAR(50) NOT NULL REFERENCES "MD_BahanPenolong"("ID_Bahan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Bahan" VARCHAR(150),
    "Jenis_Mutasi" VARCHAR(20) NOT NULL CHECK ("Jenis_Mutasi" IN ('Masuk', 'Keluar')),
    "Kategori" VARCHAR(100) NOT NULL,
    "Qty" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. DISTRIBUSI & PENGIRIMAN
-- ============================================================================

-- Rencana Distribusi (Delivery Plan / Pesanan)
CREATE TABLE IF NOT EXISTS "Rencana_Distribusi" (
    "ID_Rencana" VARCHAR(50) PRIMARY KEY,
    "Tanggal_Rencana" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ID_Pelanggan" VARCHAR(50) NOT NULL REFERENCES "MD_Pelanggan"("ID_Pelanggan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Pelanggan" VARCHAR(150),
    "Level_Pelanggan" VARCHAR(50),
    "Metode_Kirim" VARCHAR(50) NOT NULL DEFAULT 'Kirim Armada',
    "Alamat_Tujuan" TEXT DEFAULT '',
    "Sopir" VARCHAR(100) DEFAULT '',
    "Status" VARCHAR(30) NOT NULL DEFAULT 'Menunggu' CHECK ("Status" IN ('Menunggu', 'Disetujui', 'Realisasi', 'Dibatalkan')),
    "Keterangan" TEXT DEFAULT '',
    "Items" JSONB DEFAULT '[]'::JSONB,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Transaksi Distribusi Header
CREATE TABLE IF NOT EXISTS "Distribusi" (
    "ID_Distribusi" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ID_Pelanggan" VARCHAR(50) NOT NULL REFERENCES "MD_Pelanggan"("ID_Pelanggan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Pelanggan" VARCHAR(150),
    "Level_Pelanggan" VARCHAR(50),
    "Pengirim" VARCHAR(100) DEFAULT '',
    "Penerima" VARCHAR(100) DEFAULT '',
    "Tujuan" TEXT DEFAULT '',
    "Metode_Kirim" VARCHAR(50) NOT NULL DEFAULT 'Diantar Armada',
    "No_Surat_Jalan" VARCHAR(100) NOT NULL,
    "No_Invoice" VARCHAR(100),
    "Total_Tagihan" NUMERIC(15, 2) DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Transaksi Distribusi Detail
CREATE TABLE IF NOT EXISTS "Distribusi_Item" (
    "ID_Detail" VARCHAR(100) PRIMARY KEY,
    "ID_Distribusi" VARCHAR(50) NOT NULL REFERENCES "Distribusi"("ID_Distribusi") ON UPDATE CASCADE ON DELETE CASCADE,
    "Nama_Pelanggan" VARCHAR(150),
    "Tanggal" DATE,
    "Level_Pelanggan" VARCHAR(50),
    "ID_Produk" VARCHAR(50) NOT NULL REFERENCES "MD_Produk"("ID_Produk") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Produk" VARCHAR(150),
    "Qty" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Harga_Satuan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Subtotal" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. QUALITY CONTROL (QC SNI 3553:2023)
-- ============================================================================

-- Header Pengujian QC
CREATE TABLE IF NOT EXISTS "Data_QC" (
    "ID_QC" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Bulan_Tahun" VARCHAR(10) NOT NULL,
    "Produk" VARCHAR(150) NOT NULL,
    "Petugas_QC" VARCHAR(100) NOT NULL,
    "Kesimpulan" TEXT NOT NULL,
    "Status_Data" VARCHAR(30) NOT NULL DEFAULT 'Belum Lengkap' CHECK ("Status_Data" IN ('Lengkap', 'Belum Lengkap')),
    "Waktu_Input" TIMESTAMPTZ DEFAULT NOW(),
    "ID_Produksi" VARCHAR(50) REFERENCES "Produksi"("ID_Produksi") ON UPDATE CASCADE ON DELETE SET NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Detail Siklus Pemeriksaan QC (Air Baku, Air Proses, Air Jadi)
CREATE TABLE IF NOT EXISTS "Data_QC_Detail" (
    "ID_QC_Detail" BIGSERIAL PRIMARY KEY,
    "ID_QC" VARCHAR(50) NOT NULL REFERENCES "Data_QC"("ID_QC") ON UPDATE CASCADE ON DELETE CASCADE,
    "Siklus" INT NOT NULL DEFAULT 1,
    -- Parameter Air Baku
    "Baku_pH" VARCHAR(20),
    "Baku_TDS" VARCHAR(20),
    "Baku_Kekeruhan" VARCHAR(20),
    "Baku_Bau" VARCHAR(20),
    "Baku_Coliform" VARCHAR(20),
    -- Parameter Air Proses WTP
    "Proses_pH" VARCHAR(20),
    "Proses_TDS" VARCHAR(20),
    "Proses_Kekeruhan" VARCHAR(20),
    "Proses_Bau" VARCHAR(20),
    "Proses_Rasa" VARCHAR(20),
    "Proses_Ozon" VARCHAR(20),
    -- Parameter Produk Jadi Siap Edar
    "Jadi_pH" VARCHAR(20),
    "Jadi_TDS" VARCHAR(20),
    "Jadi_Kekeruhan" VARCHAR(20),
    "Jadi_Bau" VARCHAR(20),
    "Jadi_Rasa" VARCHAR(20),
    "Jadi_Ozon" VARCHAR(20),
    "Jadi_ALT_Awal" VARCHAR(20),
    "Jadi_ALT_Akhir" VARCHAR(20),
    "Jadi_Coliform" VARCHAR(20),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "UQ_QC_Siklus" UNIQUE ("ID_QC", "Siklus")
);

-- ============================================================================
-- 6. KEUANGAN & AKUNTANSI
-- ============================================================================

-- Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS "Master_COA" (
    "KODE_AKUN" VARCHAR(30) PRIMARY KEY,
    "NAMA_AKUN" VARCHAR(150) NOT NULL,
    "KATEGORI" VARCHAR(50) NOT NULL,
    "SALDO_NORMAL" VARCHAR(10) NOT NULL CHECK ("SALDO_NORMAL" IN ('Debit', 'Kredit')),
    "STATUS" VARCHAR(20) NOT NULL DEFAULT 'Aktif' CHECK ("STATUS" IN ('Aktif', 'Non-Aktif')),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Jurnal Umum Resmi (Posted)
CREATE TABLE IF NOT EXISTS "Jurnal_Umum" (
    "ID_Entry" BIGSERIAL PRIMARY KEY,
    "ID_JURNAL" VARCHAR(50) NOT NULL,
    "TANGGAL" DATE NOT NULL,
    "PERIODE" VARCHAR(10) NOT NULL,
    "REFERENSI" VARCHAR(150),
    "KETERANGAN" TEXT NOT NULL,
    "KODE_AKUN" VARCHAR(30) NOT NULL REFERENCES "Master_COA"("KODE_AKUN") ON UPDATE CASCADE ON DELETE RESTRICT,
    "DEBIT" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "KREDIT" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "PEMBUAT" VARCHAR(100) DEFAULT 'System',
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_Jurnal_ID_Jurnal" ON "Jurnal_Umum"("ID_JURNAL");
CREATE INDEX IF NOT EXISTS "IDX_Jurnal_Tanggal" ON "Jurnal_Umum"("TANGGAL");
CREATE INDEX IF NOT EXISTS "IDX_Jurnal_Akun" ON "Jurnal_Umum"("KODE_AKUN");

-- Draf Jurnal (Menunggu Verifikasi Manajer Keuangan)
CREATE TABLE IF NOT EXISTS "Draf_Jurnal" (
    "ID_Draf" VARCHAR(50) PRIMARY KEY,
    "Sumber" VARCHAR(50) NOT NULL,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Referensi" VARCHAR(150),
    "Keterangan" TEXT NOT NULL,
    "Kode_Debit" VARCHAR(30) NOT NULL REFERENCES "Master_COA"("KODE_AKUN") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Kode_Kredit" VARCHAR(30) NOT NULL REFERENCES "Master_COA"("KODE_AKUN") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nominal" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Status" VARCHAR(30) NOT NULL DEFAULT 'Menunggu Verifikasi' CHECK ("Status" IN ('Menunggu Verifikasi', 'Disetujui', 'Ditolak')),
    "Waktu_Dibuat" TIMESTAMPTZ DEFAULT NOW(),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Buku Pembantu Piutang Usaha & Utang Supplier
CREATE TABLE IF NOT EXISTS "Data_Piutang_Utang" (
    "ID_Transaksi" VARCHAR(50) PRIMARY KEY,
    "ID_DOKUMEN" VARCHAR(50),
    "TIPE" VARCHAR(20) NOT NULL CHECK ("TIPE" IN ('Piutang', 'Utang')),
    "Jenis" VARCHAR(20) CHECK ("Jenis" IN ('Piutang', 'Utang')),
    "TANGGAL" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Tanggal" DATE,
    "JATUH_TEMPO" DATE NOT NULL,
    "Tgl_Jatuh_Tempo" DATE,
    "NAMA_ENTITAS" VARCHAR(150) NOT NULL,
    "Entitas" VARCHAR(150),
    "TOTAL_TAGIHAN" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Nominal" NUMERIC(15, 2) DEFAULT 0,
    "TOTAL_DIBAYAR" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Terbayar" NUMERIC(15, 2) DEFAULT 0,
    "SISA_SALDO" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Sisa" NUMERIC(15, 2) DEFAULT 0,
    "STATUS" VARCHAR(30) NOT NULL DEFAULT 'Belum Lunas' CHECK ("STATUS" IN ('Lunas', 'Belum Lunas', 'Jatuh Tempo', 'Lunas Sebagian')),
    "Status" VARCHAR(30),
    "No_Ref" VARCHAR(100),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Master Aset Tetap & Penyusutan
CREATE TABLE IF NOT EXISTS "Data_Aset_Tetap" (
    "ID_ASET" VARCHAR(50) PRIMARY KEY,
    "NAMA_ASET" VARCHAR(150) NOT NULL,
    "TGL_BELI" DATE NOT NULL,
    "NILAI_PEROLEHAN" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "NILAI_RESIDU" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "UMUR_EKONOMIS_BLN" INT NOT NULL DEFAULT 12,
    "BEBAN_PENYUSUTAN_BLN" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "AKUN_ASET" VARCHAR(30) REFERENCES "Master_COA"("KODE_AKUN"),
    "AKUN_AKUMULASI" VARCHAR(30) REFERENCES "Master_COA"("KODE_AKUN"),
    "AKUN_BEBAN" VARCHAR(30) REFERENCES "Master_COA"("KODE_AKUN"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Transaksi Kas & Bank
CREATE TABLE IF NOT EXISTS "Transaksi_Kas" (
    "ID_Transaksi" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Kategori" VARCHAR(100) NOT NULL,
    "Keterangan" TEXT NOT NULL,
    "Jenis" VARCHAR(20) NOT NULL CHECK ("Jenis" IN ('Masuk', 'Keluar')),
    "Nominal" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Akun_Kas" VARCHAR(30) NOT NULL REFERENCES "Master_COA"("KODE_AKUN"),
    "No_Ref" VARCHAR(100),
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. SDM, PRESENSI & PAYROLL
-- ============================================================================

-- Presensi Karyawan
CREATE TABLE IF NOT EXISTS "Data_Presensi" (
    "ID_Presensi" VARCHAR(50) PRIMARY KEY,
    "Bulan_Tahun" VARCHAR(10) NOT NULL,
    "ID_Karyawan" VARCHAR(50) NOT NULL REFERENCES "MD_Karyawan"("ID_Karyawan") ON UPDATE CASCADE ON DELETE CASCADE,
    "Nama_Karyawan" VARCHAR(150),
    "T1" VARCHAR(5), "T2" VARCHAR(5), "T3" VARCHAR(5), "T4" VARCHAR(5), "T5" VARCHAR(5),
    "T6" VARCHAR(5), "T7" VARCHAR(5), "T8" VARCHAR(5), "T9" VARCHAR(5), "T10" VARCHAR(5),
    "T11" VARCHAR(5), "T12" VARCHAR(5), "T13" VARCHAR(5), "T14" VARCHAR(5), "T15" VARCHAR(5),
    "T16" VARCHAR(5), "T17" VARCHAR(5), "T18" VARCHAR(5), "T19" VARCHAR(5), "T20" VARCHAR(5),
    "T21" VARCHAR(5), "T22" VARCHAR(5), "T23" VARCHAR(5), "T24" VARCHAR(5), "T25" VARCHAR(5),
    "T26" VARCHAR(5), "T27" VARCHAR(5), "T28" VARCHAR(5), "T29" VARCHAR(5), "T30" VARCHAR(5), "T31" VARCHAR(5),
    "Total_H" INT DEFAULT 0,
    "Total_T" INT DEFAULT 0,
    "Total_I" INT DEFAULT 0,
    "Total_S" INT DEFAULT 0,
    "Total_C" INT DEFAULT 0,
    "Total_A" INT DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "UQ_Presensi_Bulan_Karyawan" UNIQUE ("Bulan_Tahun", "ID_Karyawan")
);

-- Lembur Karyawan
CREATE TABLE IF NOT EXISTS "Data_Lembur" (
    "ID_Lembur" VARCHAR(50) PRIMARY KEY,
    "Bulan_Tahun" VARCHAR(10) NOT NULL,
    "ID_Karyawan" VARCHAR(50) NOT NULL REFERENCES "MD_Karyawan"("ID_Karyawan") ON UPDATE CASCADE ON DELETE CASCADE,
    "Nama_Karyawan" VARCHAR(150),
    "T1" NUMERIC(4, 1), "T2" NUMERIC(4, 1), "T3" NUMERIC(4, 1), "T4" NUMERIC(4, 1), "T5" NUMERIC(4, 1),
    "T6" NUMERIC(4, 1), "T7" NUMERIC(4, 1), "T8" NUMERIC(4, 1), "T9" NUMERIC(4, 1), "T10" NUMERIC(4, 1),
    "T11" NUMERIC(4, 1), "T12" NUMERIC(4, 1), "T13" NUMERIC(4, 1), "T14" NUMERIC(4, 1), "T15" NUMERIC(4, 1),
    "T16" NUMERIC(4, 1), "T17" NUMERIC(4, 1), "T18" NUMERIC(4, 1), "T19" NUMERIC(4, 1), "T20" NUMERIC(4, 1),
    "T21" NUMERIC(4, 1), "T22" NUMERIC(4, 1), "T23" NUMERIC(4, 1), "T24" NUMERIC(4, 1), "T25" NUMERIC(4, 1),
    "T26" NUMERIC(4, 1), "T27" NUMERIC(4, 1), "T28" NUMERIC(4, 1), "T29" NUMERIC(4, 1), "T30" NUMERIC(4, 1), "T31" NUMERIC(4, 1),
    "Total_Jam_Lembur" NUMERIC(6, 1) DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "UQ_Lembur_Bulan_Karyawan" UNIQUE ("Bulan_Tahun", "ID_Karyawan")
);

-- Pinjaman Kasbon Karyawan
CREATE TABLE IF NOT EXISTS "Data_Kasbon" (
    "ID_Kasbon" VARCHAR(50) PRIMARY KEY,
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "ID_Karyawan" VARCHAR(50) NOT NULL REFERENCES "MD_Karyawan"("ID_Karyawan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Karyawan" VARCHAR(150),
    "Nominal" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Tenor" INT NOT NULL DEFAULT 1,
    "Cicilan_Per_Bulan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Sisa_Kasbon" NUMERIC(15, 2) DEFAULT 0,
    "Status" VARCHAR(20) DEFAULT 'Aktif' CHECK ("Status" IN ('Aktif', 'Lunas')),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Histori Payroll & Penggajian Karyawan
CREATE TABLE IF NOT EXISTS "Histori_Penggajian" (
    "ID_Payroll" BIGSERIAL PRIMARY KEY,
    "Bulan_Tahun" VARCHAR(10) NOT NULL,
    "ID_Karyawan" VARCHAR(50) NOT NULL REFERENCES "MD_Karyawan"("ID_Karyawan") ON UPDATE CASCADE ON DELETE RESTRICT,
    "Nama_Karyawan" VARCHAR(150),
    "Gaji_Pokok" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Tunjangan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Bonus_Hadir" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Bonus_Target" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Upah_Lembur" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "PPh21" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "BPJS" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Kasbon" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Potongan_Absen" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Total_Pendapatan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Total_Potongan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Gaji_Bersih" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Tgl_Pencairan" DATE,
    "Status_Cair" VARCHAR(20) DEFAULT 'Sudah Ditransfer',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "UQ_Payroll_Bulan_Karyawan" UNIQUE ("Bulan_Tahun", "ID_Karyawan")
);

-- ============================================================================
-- 8. ADMINISTRASI, SURAT & PURCHASE ORDER (PO)
-- ============================================================================

-- Arsip Persuratan Resmi
CREATE TABLE IF NOT EXISTS "Data_Surat" (
    "ID_Surat" VARCHAR(50) PRIMARY KEY,
    "Nomor_Surat" VARCHAR(100) UNIQUE NOT NULL,
    "Tipe_Surat" VARCHAR(50) NOT NULL CHECK ("Tipe_Surat" IN ('Surat Eksternal', 'Surat Internal', 'Surat Keterangan')),
    "Tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,
    "Perihal" VARCHAR(255) NOT NULL,
    "Lampiran" VARCHAR(100) DEFAULT '-',
    "Kepada" VARCHAR(255) NOT NULL,
    "Alamat_Tujuan" TEXT DEFAULT '',
    "Isi_Surat" TEXT NOT NULL,
    "Penandatangan_Nama" VARCHAR(150) NOT NULL,
    "Penandatangan_Jabatan" VARCHAR(100) NOT NULL,
    "Tembusan" TEXT DEFAULT '',
    "Dibuat_Oleh" VARCHAR(100) DEFAULT '',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order (PO) Header
CREATE TABLE IF NOT EXISTS "Admin_PO" (
    "ID_PO" VARCHAR(50) PRIMARY KEY,
    "Tanggal_PO" DATE NOT NULL DEFAULT CURRENT_DATE,
    "No_PO" VARCHAR(100) UNIQUE NOT NULL,
    "Order_Ke" VARCHAR(150) NOT NULL,
    "Alamat_Supplier" TEXT DEFAULT '',
    "Syarat_Ketentuan" TEXT DEFAULT '',
    "Grand_Total" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Draf',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order (PO) Detail
CREATE TABLE IF NOT EXISTS "Admin_PO_Detail" (
    "ID_Detail" VARCHAR(50) PRIMARY KEY,
    "ID_PO" VARCHAR(50) NOT NULL REFERENCES "Admin_PO"("ID_PO") ON UPDATE CASCADE ON DELETE CASCADE,
    "Nama_Produk" VARCHAR(150) NOT NULL,
    "Spesifikasi" TEXT DEFAULT '',
    "Qty" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Harga_Satuan" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "Total_Harga" NUMERIC(15, 2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. AUDIT LOG & JEJAK PERUBAHAN
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Audit_Log" (
    "id" BIGSERIAL PRIMARY KEY,
    "waktu" TIMESTAMPTZ DEFAULT NOW(),
    "pengguna" VARCHAR(100) DEFAULT 'System',
    "entitas" VARCHAR(50) NOT NULL,
    "aksi" VARCHAR(30) NOT NULL,
    "id_dokumen" VARCHAR(100),
    "keterangan" TEXT,
    "data_sebelum" JSONB,
    "data_sesudah" JSONB
);

CREATE INDEX IF NOT EXISTS "IDX_Audit_Log_Waktu" ON "Audit_Log"("waktu");
CREATE INDEX IF NOT EXISTS "IDX_Audit_Log_Dokumen" ON "Audit_Log"("id_dokumen");


-- ============================================================================
-- BERKAS: 02_views_and_functions.sql
-- ============================================================================

-- ============================================================================
-- AIRIS Enterprise - PostgreSQL Database Schema for Supabase
-- PT. Anugerah Illahi Rabbi (Sistem Manajemen AMDK Terintegrasi)
-- Bagian 2: Views Laporan & Fungsi Utilitas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger Otomatis: Update updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
          AND table_schema = 'public'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
            CREATE TRIGGER trg_set_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- View 1: Real-time Stock Produk Jadi (Finished Goods Ledger)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW "v_stock_produk_jadi" AS
WITH prod_in AS (
    SELECT 
        "ID_Produk",
        COALESCE(SUM("Jumlah"), 0) AS total_in
    FROM "Produksi"
    GROUP BY "ID_Produk"
),
dist_out AS (
    SELECT 
        "ID_Produk",
        COALESCE(SUM("Qty"), 0) AS total_out
    FROM "Distribusi_Item"
    GROUP BY "ID_Produk"
)
SELECT 
    p."ID_Produk",
    p."Nama_Produk",
    p."Kategori",
    p."Satuan",
    p."Harga_Distributor",
    p."Harga_Agen",
    COALESCE(pi.total_in, 0) AS "Total_Masuk_Produksi",
    COALESCE(d_out.total_out, 0) AS "Total_Keluar_Distribusi",
    (COALESCE(pi.total_in, 0) - COALESCE(d_out.total_out, 0)) AS "Sisa_Stok",
    CASE 
        WHEN (COALESCE(pi.total_in, 0) - COALESCE(d_out.total_out, 0)) > 200 THEN 'Aman'
        WHEN (COALESCE(pi.total_in, 0) - COALESCE(d_out.total_out, 0)) > 0 THEN 'Menipis'
        ELSE 'Kosong / Kritis'
    END AS "Status_Stok"
FROM "MD_Produk" p
LEFT JOIN prod_in pi ON p."ID_Produk" = pi."ID_Produk"
LEFT JOIN dist_out d_out ON p."ID_Produk" = d_out."ID_Produk"
ORDER BY p."ID_Produk";

-- ----------------------------------------------------------------------------
-- View 2: Real-time Stock Bahan Penolong & Baku
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW "v_stock_bahan_penolong" AS
WITH purchases AS (
    SELECT 
        "ID_Bahan",
        COALESCE(SUM("Qty"), 0) AS total_beli
    FROM "Pembelian_Bahan"
    GROUP BY "ID_Bahan"
),
mut_in AS (
    SELECT 
        "ID_Bahan",
        COALESCE(SUM("Qty"), 0) AS total_mutasi_masuk
    FROM "Mutasi_Bahan"
    WHERE "Jenis_Mutasi" = 'Masuk'
    GROUP BY "ID_Bahan"
),
mut_out AS (
    SELECT 
        "ID_Bahan",
        COALESCE(SUM("Qty"), 0) AS total_mutasi_keluar
    FROM "Mutasi_Bahan"
    WHERE "Jenis_Mutasi" = 'Keluar'
    GROUP BY "ID_Bahan"
)
SELECT 
    b."ID_Bahan",
    b."Nama_Bahan",
    b."Kategori",
    b."Satuan",
    b."Harga_Satuan",
    b."Minimum_Stock",
    COALESCE(pur.total_beli, 0) + COALESCE(mi.total_mutasi_masuk, 0) AS "Total_Masuk",
    COALESCE(mo.total_mutasi_keluar, 0) AS "Total_Keluar",
    (COALESCE(pur.total_beli, 0) + COALESCE(mi.total_mutasi_masuk, 0) - COALESCE(mo.total_mutasi_keluar, 0)) AS "Sisa_Stok",
    CASE 
        WHEN (COALESCE(pur.total_beli, 0) + COALESCE(mi.total_mutasi_masuk, 0) - COALESCE(mo.total_mutasi_keluar, 0)) <= b."Minimum_Stock" THEN TRUE
        ELSE FALSE
    END AS "Is_Kritis"
FROM "MD_BahanPenolong" b
LEFT JOIN purchases pur ON b."ID_Bahan" = pur."ID_Bahan"
LEFT JOIN mut_in mi ON b."ID_Bahan" = mi."ID_Bahan"
LEFT JOIN mut_out mo ON b."ID_Bahan" = mo."ID_Bahan"
ORDER BY b."ID_Bahan";

-- ----------------------------------------------------------------------------
-- View 3: Neraca Saldo (Trial Balance) dari Jurnal Umum
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW "v_neraca_saldo" AS
WITH summary AS (
    SELECT 
        "KODE_AKUN",
        COALESCE(SUM("DEBIT"), 0) AS total_debit,
        COALESCE(SUM("KREDIT"), 0) AS total_kredit
    FROM "Jurnal_Umum"
    GROUP BY "KODE_AKUN"
)
SELECT 
    c."KODE_AKUN",
    c."NAMA_AKUN",
    c."KATEGORI",
    c."SALDO_NORMAL",
    COALESCE(s.total_debit, 0) AS "Total_Debit",
    COALESCE(s.total_kredit, 0) AS "Total_Kredit",
    CASE 
        WHEN c."SALDO_NORMAL" = 'Debit' THEN (COALESCE(s.total_debit, 0) - COALESCE(s.total_kredit, 0))
        ELSE (COALESCE(s.total_kredit, 0) - COALESCE(s.total_debit, 0))
    END AS "Saldo_Akhir"
FROM "Master_COA" c
LEFT JOIN summary s ON c."KODE_AKUN" = s."KODE_AKUN"
ORDER BY c."KODE_AKUN";

-- ----------------------------------------------------------------------------
-- View 4: Laba Rugi Operasional (YTD & Periode)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW "v_laba_rugi_ringkasan" AS
WITH akun_balance AS (
    SELECT 
        c."KODE_AKUN",
        c."NAMA_AKUN",
        c."KATEGORI",
        c."SALDO_NORMAL",
        CASE 
            WHEN c."SALDO_NORMAL" = 'Debit' THEN (COALESCE(SUM(j."DEBIT"), 0) - COALESCE(SUM(j."KREDIT"), 0))
            ELSE (COALESCE(SUM(j."KREDIT"), 0) - COALESCE(SUM(j."DEBIT"), 0))
        END AS net_amount
    FROM "Master_COA" c
    LEFT JOIN "Jurnal_Umum" j ON c."KODE_AKUN" = j."KODE_AKUN"
    GROUP BY c."KODE_AKUN", c."NAMA_AKUN", c."KATEGORI", c."SALDO_NORMAL"
)
SELECT 
    COALESCE(SUM(CASE WHEN "KATEGORI" = 'Pendapatan' THEN net_amount ELSE 0 END), 0) AS "Total_Pendapatan",
    COALESCE(SUM(CASE WHEN "KATEGORI" = 'Harga Pokok' THEN net_amount ELSE 0 END), 0) AS "Total_HPP",
    COALESCE(SUM(CASE WHEN "KATEGORI" = 'Pendapatan' THEN net_amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN "KATEGORI" = 'Harga Pokok' THEN net_amount ELSE 0 END), 0) AS "Laba_Kotor",
    COALESCE(SUM(CASE WHEN "KATEGORI" = 'Beban' THEN net_amount ELSE 0 END), 0) AS "Total_Beban_Operasional",
    (COALESCE(SUM(CASE WHEN "KATEGORI" = 'Pendapatan' THEN net_amount ELSE 0 END), 0) - 
     COALESCE(SUM(CASE WHEN "KATEGORI" = 'Harga Pokok' THEN net_amount ELSE 0 END), 0) - 
     COALESCE(SUM(CASE WHEN "KATEGORI" = 'Beban' THEN net_amount ELSE 0 END), 0)) AS "Laba_Bersih"
FROM akun_balance;


-- ============================================================================
-- BERKAS: 03_rpc_atomic_transactions.sql
-- ============================================================================

-- ============================================================================
-- AIRIS Enterprise - PostgreSQL Database Schema for Supabase
-- PT. Anugerah Illahi Rabbi (Sistem Manajemen AMDK Terintegrasi)
-- Bagian 3: Stored Procedures (RPC) untuk Transaksi Atomik Stok & Produksi
-- ============================================================================

-- ============================================================================
-- 1. REALISASI & PENYELESAIAN PRODUKSI (SPK -> HASIL JADI & POTONG BAHAN BAKU)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_complete_spk_production(
    p_id_spk VARCHAR(50),
    p_id_produksi VARCHAR(50),
    p_tanggal DATE,
    p_shift VARCHAR(50),
    p_id_produk VARCHAR(50),
    p_actual_qty NUMERIC,
    p_pic_produksi VARCHAR(100),
    p_keterangan TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spk RECORD;
    v_bom RECORD;
    v_needed NUMERIC;
    v_mat RECORD;
    v_mutation_id VARCHAR(100);
    v_total_material_cost NUMERIC := 0;
    v_prod_id VARCHAR(50);
    v_draft_id VARCHAR(50);
    v_mutations_count INT := 0;
BEGIN
    -- 1. Validasi input dasar
    IF p_actual_qty <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Jumlah realisasi produksi harus lebih besar dari 0 unit.'
        );
    END IF;

    -- 2. Kunci dan periksa status SPK (mencegah double completion secara concurrent)
    IF p_id_spk IS NOT NULL AND p_id_spk <> '' THEN
        SELECT * INTO v_spk
        FROM "SPK"
        WHERE "ID_SPK" = p_id_spk
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'SPK dengan ID ' || p_id_spk || ' tidak ditemukan.'
            );
        END IF;

        IF v_spk."Status" = 'Selesai' THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'SPK ' || p_id_spk || ' sudah pernah diselesaikan sebelumnya.'
            );
        END IF;
    END IF;

    -- 3. Tentukan ID Produksi
    v_prod_id := COALESCE(NULLIF(p_id_produksi, ''), 'PRD-' || TO_CHAR(p_tanggal, 'DDMMYY') || LPAD(FLOOR(RANDOM() * 90 + 10)::TEXT, 2, '0'));

    -- 4. Loop seluruh bahan dalam BOM produk ini dan potong stok bahan
    FOR v_bom IN
        SELECT b.*, bp."Nama_Bahan", bp."Harga_Satuan"
        FROM "MD_BOM" b
        JOIN "MD_BahanPenolong" bp ON b."ID_Bahan" = bp."ID_Bahan"
        WHERE b."ID_Produk" = p_id_produk
    LOOP
        v_needed := p_actual_qty * v_bom."Jumlah_Dibutuhkan";
        v_total_material_cost := v_total_material_cost + (v_needed * v_bom."Harga_Satuan");

        v_mutation_id := 'MT-PRD-' || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || '-' || v_bom."ID_Bahan";

        -- Masukkan mutasi pemakaian bahan penolong
        INSERT INTO "Mutasi_Bahan" (
            "ID_Mutasi",
            "Tanggal",
            "ID_Bahan",
            "Nama_Bahan",
            "Jenis_Mutasi",
            "Kategori",
            "Qty",
            "Keterangan"
        ) VALUES (
            v_mutation_id,
            p_tanggal,
            v_bom."ID_Bahan",
            v_bom."Nama_Bahan",
            'Keluar',
            'Pemakaian Produksi',
            v_needed,
            'Pemotongan Otomatis Produksi ' || v_prod_id || ' (SPK: ' || COALESCE(p_id_spk, '-') || ')'
        );

        v_mutations_count := v_mutations_count + 1;
    END LOOP;

    -- 5. Masukkan data realisasi produksi
    INSERT INTO "Produksi" (
        "ID_Produksi",
        "Tanggal",
        "Shift",
        "ID_Produk",
        "Jumlah",
        "PIC_Produksi",
        "Keterangan"
    ) VALUES (
        v_prod_id,
        p_tanggal,
        p_shift,
        p_id_produk,
        p_actual_qty,
        p_pic_produksi,
        COALESCE(p_keterangan, '') || CASE WHEN p_id_spk IS NOT NULL AND p_id_spk <> '' THEN ' (Realisasi SPK: ' || p_id_spk || ')' ELSE '' END
    );

    -- 6. Perbarui status SPK menjadi Selesai
    IF p_id_spk IS NOT NULL AND p_id_spk <> '' THEN
        UPDATE "SPK"
        SET "Status" = 'Selesai',
            "updated_at" = NOW()
        WHERE "ID_SPK" = p_id_spk;
    END IF;

    -- 7. Bentuk Draf Jurnal Harga Pokok Produksi (HPP) jika ada nilai bahan
    IF v_total_material_cost > 0 THEN
        v_draft_id := 'DRF-PRD-' || TO_CHAR(NOW(), 'YYMMDD') || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0');
        INSERT INTO "Draf_Jurnal" (
            "ID_Draf",
            "Sumber",
            "Tanggal",
            "Referensi",
            "Keterangan",
            "Kode_Debit",
            "Kode_Kredit",
            "Nominal",
            "Status"
        ) VALUES (
            v_draft_id,
            'Produksi',
            p_tanggal,
            v_prod_id,
            'Pemindahan Nilai Bahan Baku ke Persediaan Barang Jadi - Produksi ' || v_prod_id,
            '113-30', -- Persediaan Barang Jadi (Debit)
            '113-10', -- Persediaan Bahan Baku & Penolong (Kredit)
            v_total_material_cost,
            'Menunggu Verifikasi'
        );
    END IF;

    -- 8. Audit Log
    INSERT INTO "Audit_Log" (
        "pengguna",
        "entitas",
        "aksi",
        "id_dokumen",
        "keterangan"
    ) VALUES (
        COALESCE(p_pic_produksi, 'System'),
        'Produksi',
        'COMPLETE_SPK',
        v_prod_id,
        'Penyelesaian SPK ' || COALESCE(p_id_spk, '-') || ' dengan hasil ' || p_actual_qty || ' unit. ' || v_mutations_count || ' bahan dipotong.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'id_produksi', v_prod_id,
        'actual_qty', p_actual_qty,
        'materials_consumed_count', v_mutations_count,
        'total_material_cost', v_total_material_cost,
        'draft_journal_id', v_draft_id,
        'message', 'Produksi ' || v_prod_id || ' berhasil dicatat secara atomik. Stok bahan penolong telah terpotong.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Gagal memproses transaksi produksi: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- 2. PEMBATALAN REALISASI PRODUKSI & REVERSAL BAHAN PENOLONG
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_cancel_production(
    p_id_produksi VARCHAR(50),
    p_alasan TEXT DEFAULT 'Dibatalkan oleh manajemen'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prod RECORD;
    v_spk_id VARCHAR(50);
    v_deleted_mutations INT := 0;
BEGIN
    SELECT * INTO v_prod
    FROM "Produksi"
    WHERE "ID_Produksi" = p_id_produksi
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Produksi ' || p_id_produksi || ' tidak ditemukan.'
        );
    END IF;

    -- Ekstrak SPK jika ada
    IF v_prod."Keterangan" LIKE '%Realisasi SPK:%' THEN
        v_spk_id := TRIM(SPLIT_PART(v_prod."Keterangan", 'Realisasi SPK:', 2));
        v_spk_id := REPLACE(REPLACE(v_spk_id, ')', ''), '(', '');
    END IF;

    -- Kembalikan/Hapus mutasi bahan terkait produksi ini
    DELETE FROM "Mutasi_Bahan"
    WHERE "Keterangan" LIKE '%' || p_id_produksi || '%';
    GET DIAGNOSTICS v_deleted_mutations = ROW_COUNT;

    -- Batalkan Draf Jurnal terkait
    DELETE FROM "Draf_Jurnal"
    WHERE "Referensi" = p_id_produksi AND "Status" = 'Menunggu Verifikasi';

    -- Revert status SPK jika ada
    IF v_spk_id IS NOT NULL AND v_spk_id <> '' THEN
        UPDATE "SPK"
        SET "Status" = 'Diproses',
            "updated_at" = NOW()
        WHERE "ID_SPK" = v_spk_id;
    END IF;

    -- Hapus catatan produksi
    DELETE FROM "Produksi" WHERE "ID_Produksi" = p_id_produksi;

    -- Catat ke Audit Log
    INSERT INTO "Audit_Log" (
        "entitas",
        "aksi",
        "id_dokumen",
        "keterangan"
    ) VALUES (
        'Produksi',
        'CANCEL_PRODUCTION',
        p_id_produksi,
        'Pembatalan produksi ' || p_id_produksi || '. ' || v_deleted_mutations || ' mutasi bahan dibatalkan. Alasan: ' || p_alasan
    );

    RETURN jsonb_build_object(
        'success', true,
        'id_produksi', p_id_produksi,
        'reverted_mutations', v_deleted_mutations,
        'reverted_spk', v_spk_id,
        'message', 'Produksi ' || p_id_produksi || ' berhasil dibatalkan dan stok bahan telah dipulihkan.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Gagal membatalkan produksi: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- 3. REALISASI DISTRIBUSI PENGIRIMAN (POTONG STOK PRODUK & CATAT PIUTANG)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_dispatch_distribution(
    p_id_distribusi VARCHAR(50),
    p_tanggal DATE,
    p_id_pelanggan VARCHAR(50),
    p_pengirim VARCHAR(100),
    p_penerima VARCHAR(100),
    p_tujuan TEXT,
    p_metode_kirim VARCHAR(50),
    p_no_surat_jalan VARCHAR(100),
    p_no_invoice VARCHAR(100),
    p_keterangan TEXT,
    p_id_rencana VARCHAR(50),
    p_items JSONB -- Array of { id_produk, qty, harga_satuan }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cust RECORD;
    v_dist_id VARCHAR(50);
    v_inv_no VARCHAR(100);
    v_item RECORD;
    v_prod RECORD;
    v_current_stock NUMERIC;
    v_total_tagihan_awal NUMERIC := 0;
    v_total_qty NUMERIC := 0;
    v_grand_total NUMERIC := 0;
    v_subtotal NUMERIC;
    v_detail_id VARCHAR(100);
    v_item_idx INT := 1;
    v_draft_id VARCHAR(50);
    v_due_date DATE;
BEGIN
    -- 1. Validasi Pelanggan
    SELECT * INTO v_cust
    FROM "MD_Pelanggan"
    WHERE "ID_Pelanggan" = p_id_pelanggan;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pelanggan tidak ditemukan.');
    END IF;

    -- 2. Tentukan ID Distribusi dan No Invoice
    v_dist_id := COALESCE(NULLIF(p_id_distribusi, ''), 'DST-' || TO_CHAR(p_tanggal, 'YYMMDD') || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0'));
    v_inv_no := COALESCE(NULLIF(p_no_invoice, ''), 'INV-' || p_no_surat_jalan);

    -- 3. Validasi Stok untuk seluruh item yang akan dikirim
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("id_produk" VARCHAR, "qty" NUMERIC, "harga_satuan" NUMERIC)
    LOOP
        SELECT "Sisa_Stok" INTO v_current_stock
        FROM "v_stock_produk_jadi"
        WHERE "ID_Produk" = v_item."id_produk";

        IF v_current_stock IS NULL OR v_current_stock < v_item."qty" THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'Stok tidak mencukupi untuk produk ' || v_item."id_produk" || '. Stok tersedia: ' || COALESCE(v_current_stock, 0) || ', diminta: ' || v_item."qty"
            );
        END IF;

        v_subtotal := v_item."qty" * v_item."harga_satuan";
        v_total_tagihan_awal := v_total_tagihan_awal + v_subtotal;
        v_total_qty := v_total_qty + v_item."qty";
    END LOOP;

    -- 4. Hitung potongan ekspedisi jika Ambil Sendiri (Rp 1.000 / dus)
    v_grand_total := v_total_tagihan_awal;
    IF p_metode_kirim = 'Ambil Sendiri' THEN
        v_grand_total := v_grand_total - (v_total_qty * 1000);
    END IF;

    -- 5. Masukkan Distribusi Header
    INSERT INTO "Distribusi" (
        "ID_Distribusi",
        "Tanggal",
        "ID_Pelanggan",
        "Nama_Pelanggan",
        "Level_Pelanggan",
        "Pengirim",
        "Penerima",
        "Tujuan",
        "Metode_Kirim",
        "No_Surat_Jalan",
        "No_Invoice",
        "Total_Tagihan",
        "Keterangan"
    ) VALUES (
        v_dist_id,
        p_tanggal,
        p_id_pelanggan,
        v_cust."Nama_Pelanggan",
        v_cust."Level_Pelanggan",
        p_pengirim,
        p_penerima,
        p_tujuan,
        p_metode_kirim,
        p_no_surat_jalan,
        v_inv_no,
        v_grand_total,
        p_keterangan
    );

    -- 6. Masukkan Distribusi Items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("id_produk" VARCHAR, "qty" NUMERIC, "harga_satuan" NUMERIC)
    LOOP
        SELECT "Nama_Produk" INTO v_prod FROM "MD_Produk" WHERE "ID_Produk" = v_item."id_produk";
        v_detail_id := v_dist_id || '-D' || v_item_idx;
        v_subtotal := v_item."qty" * v_item."harga_satuan";

        INSERT INTO "Distribusi_Item" (
            "ID_Detail",
            "ID_Distribusi",
            "Nama_Pelanggan",
            "Tanggal",
            "Level_Pelanggan",
            "ID_Produk",
            "Nama_Produk",
            "Qty",
            "Harga_Satuan",
            "Subtotal"
        ) VALUES (
            v_detail_id,
            v_dist_id,
            v_cust."Nama_Pelanggan",
            p_tanggal,
            v_cust."Level_Pelanggan",
            v_item."id_produk",
            COALESCE(v_prod."Nama_Produk", v_item."id_produk"),
            v_item."qty",
            v_item."harga_satuan",
            v_subtotal
        );

        v_item_idx := v_item_idx + 1;
    END LOOP;

    -- 7. Bentuk Piutang Usaha (Jatuh tempo 14 hari)
    v_due_date := p_tanggal + INTERVAL '14 days';
    INSERT INTO "Data_Piutang_Utang" (
        "ID_Transaksi",
        "ID_DOKUMEN",
        "TIPE",
        "Jenis",
        "TANGGAL",
        "Tanggal",
        "JATUH_TEMPO",
        "Tgl_Jatuh_Tempo",
        "NAMA_ENTITAS",
        "Entitas",
        "TOTAL_TAGIHAN",
        "Nominal",
        "TOTAL_DIBAYAR",
        "Terbayar",
        "SISA_SALDO",
        "Sisa",
        "STATUS",
        "Status"
    ) VALUES (
        v_dist_id,
        v_dist_id,
        'Piutang',
        'Piutang',
        p_tanggal,
        p_tanggal,
        v_due_date,
        v_due_date,
        v_cust."Nama_Pelanggan",
        v_cust."Nama_Pelanggan",
        v_grand_total,
        v_grand_total,
        0,
        0,
        v_grand_total,
        v_grand_total,
        'Belum Lunas',
        'Belum Lunas'
    );

    -- 8. Bentuk Draf Jurnal Penjualan
    v_draft_id := 'DRF-DST-' || TO_CHAR(NOW(), 'YYMMDD') || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0');
    INSERT INTO "Draf_Jurnal" (
        "ID_Draf",
        "Sumber",
        "Tanggal",
        "Referensi",
        "Keterangan",
        "Kode_Debit",
        "Kode_Kredit",
        "Nominal",
        "Status"
    ) VALUES (
        v_draft_id,
        'Distribusi',
        p_tanggal,
        v_dist_id || ' / ' || v_cust."Nama_Pelanggan",
        'Penjualan ' || v_total_qty || ' unit ke ' || v_cust."Nama_Pelanggan" || ' (Inv: ' || v_inv_no || ')',
        '112-10', -- Piutang Usaha
        '411-10', -- Pendapatan Penjualan Air
        v_grand_total,
        'Menunggu Verifikasi'
    );

    -- 9. Perbarui status Rencana Distribusi jika ditautkan
    IF p_id_rencana IS NOT NULL AND p_id_rencana <> '' THEN
        UPDATE "Rencana_Distribusi"
        SET "Status" = 'Realisasi',
            "updated_at" = NOW()
        WHERE "ID_Rencana" = p_id_rencana;
    END IF;

    -- 10. Audit Log
    INSERT INTO "Audit_Log" (
        "pengguna",
        "entitas",
        "aksi",
        "id_dokumen",
        "keterangan"
    ) VALUES (
        COALESCE(p_pengirim, 'System'),
        'Distribusi',
        'DISPATCH_DISTRIBUTION',
        v_dist_id,
        'Pengiriman ' || v_total_qty || ' unit ke ' || v_cust."Nama_Pelanggan" || ' dengan total tagihan Rp ' || v_grand_total
    );

    RETURN jsonb_build_object(
        'success', true,
        'id_distribusi', v_dist_id,
        'no_invoice', v_inv_no,
        'total_qty', v_total_qty,
        'grand_total', v_grand_total,
        'draft_journal_id', v_draft_id,
        'message', 'Distribusi ' || v_dist_id || ' berhasil direalisasikan secara atomik. Stok berkurang & piutang tercatat.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Gagal memproses pengiriman distribusi: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- 4. PEMBATALAN DISTRIBUSI (REVERSAL STOK & PIUTANG)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_cancel_distribution(
    p_id_distribusi VARCHAR(50),
    p_alasan TEXT DEFAULT 'Dibatalkan'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_piutang RECORD;
BEGIN
    -- Periksa apakah sudah ada pembayaran piutang
    SELECT * INTO v_piutang
    FROM "Data_Piutang_Utang"
    WHERE "ID_Transaksi" = p_id_distribusi;

    IF FOUND AND v_piutang."TOTAL_DIBAYAR" > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Tidak dapat membatalkan distribusi yang sudah memiliki transaksi pembayaran angsuran/lunas.'
        );
    END IF;

    -- Hapus Piutang
    DELETE FROM "Data_Piutang_Utang" WHERE "ID_Transaksi" = p_id_distribusi;

    -- Batalkan Draf Jurnal terkait
    DELETE FROM "Draf_Jurnal" WHERE "Referensi" LIKE p_id_distribusi || '%' AND "Status" = 'Menunggu Verifikasi';

    -- Hapus Detail Barang (otomatis mengembalikan saldo stok di view)
    DELETE FROM "Distribusi_Item" WHERE "ID_Distribusi" = p_id_distribusi;

    -- Hapus Header Distribusi
    DELETE FROM "Distribusi" WHERE "ID_Distribusi" = p_id_distribusi;

    -- Audit Log
    INSERT INTO "Audit_Log" (
        "entitas",
        "aksi",
        "id_dokumen",
        "keterangan"
    ) VALUES (
        'Distribusi',
        'CANCEL_DISTRIBUTION',
        p_id_distribusi,
        'Pembatalan distribusi ' || p_id_distribusi || '. Piutang dihapus & stok dipulihkan. Alasan: ' || p_alasan
    );

    RETURN jsonb_build_object(
        'success', true,
        'id_distribusi', p_id_distribusi,
        'message', 'Distribusi ' || p_id_distribusi || ' berhasil dibatalkan. Stok barang jadi kembali pulih.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Gagal membatalkan distribusi: ' || SQLERRM
    );
END;
$$;

-- ============================================================================
-- 5. VERIFIKASI & POSTING DRAF JURNAL KE JURNAL UMUM (BUKU BESAR ATOMIK)
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_verify_and_post_draft_journal(
    p_id_draf VARCHAR(50),
    p_pembuat VARCHAR(100) DEFAULT 'Finance Manager'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_draft RECORD;
    v_periode VARCHAR(10);
    v_prefix VARCHAR(20);
    v_max_seq INT := 0;
    v_next_id VARCHAR(50);
BEGIN
    -- Kunci baris draf jurnal
    SELECT * INTO v_draft
    FROM "Draf_Jurnal"
    WHERE "ID_Draf" = p_id_draf
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Draf jurnal tidak ditemukan.');
    END IF;

    IF v_draft."Status" = 'Disetujui' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Draf jurnal sudah pernah disetujui sebelumnya.');
    END IF;

    IF v_draft."Nominal" <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Nominal jurnal harus lebih besar dari 0.');
    END IF;

    v_periode := TO_CHAR(v_draft."Tanggal", 'YYYY-MM');
    v_prefix := 'JUR-' || TO_CHAR(v_draft."Tanggal", 'YYMM') || '-';

    -- Cari nomor urut berikutnya untuk periode ini
    SELECT COALESCE(MAX(SUBSTRING("ID_JURNAL" FROM 12 FOR 3)::INT), 0) INTO v_max_seq
    FROM "Jurnal_Umum"
    WHERE "ID_JURNAL" LIKE v_prefix || '%';

    v_next_id := v_prefix || LPAD((v_max_seq + 1)::TEXT, 3, '0');

    -- Insert Debit Entry
    INSERT INTO "Jurnal_Umum" (
        "ID_JURNAL",
        "TANGGAL",
        "PERIODE",
        "REFERENSI",
        "KETERANGAN",
        "KODE_AKUN",
        "DEBIT",
        "KREDIT",
        "PEMBUAT"
    ) VALUES (
        v_next_id,
        v_draft."Tanggal",
        v_periode,
        v_draft."Referensi",
        v_draft."Keterangan",
        v_draft."Kode_Debit",
        v_draft."Nominal",
        0,
        p_pembuat
    );

    -- Insert Credit Entry
    INSERT INTO "Jurnal_Umum" (
        "ID_JURNAL",
        "TANGGAL",
        "PERIODE",
        "REFERENSI",
        "KETERANGAN",
        "KODE_AKUN",
        "DEBIT",
        "KREDIT",
        "PEMBUAT"
    ) VALUES (
        v_next_id,
        v_draft."Tanggal",
        v_periode,
        v_draft."Referensi",
        v_draft."Keterangan",
        v_draft."Kode_Kredit",
        0,
        v_draft."Nominal",
        p_pembuat
    );

    -- Update Draf Jurnal
    UPDATE "Draf_Jurnal"
    SET "Status" = 'Disetujui',
        "updated_at" = NOW()
    WHERE "ID_Draf" = p_id_draf;

    -- Audit Log
    INSERT INTO "Audit_Log" (
        "pengguna",
        "entitas",
        "aksi",
        "id_dokumen",
        "keterangan"
    ) VALUES (
        p_pembuat,
        'Jurnal',
        'POST_JOURNAL',
        v_next_id,
        'Posting resmi jurnal dari draf ' || p_id_draf || ' senilai Rp ' || v_draft."Nominal"
    );

    RETURN jsonb_build_object(
        'success', true,
        'id_jurnal', v_next_id,
        'nominal', v_draft."Nominal",
        'message', 'Jurnal ' || v_next_id || ' berhasil dibukukan resmi ke Jurnal Umum & Buku Besar.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', 'Gagal memposting jurnal: ' || SQLERRM
    );
END;
$$;


-- ============================================================================
-- BERKAS: 04_rls_security_policies.sql
-- ============================================================================

-- ============================================================================
-- AIRIS Enterprise - PostgreSQL Database Schema for Supabase
-- PT. Anugerah Illahi Rabbi (Sistem Manajemen AMDK Terintegrasi)
-- Bagian 4: Row Level Security (RLS) & Realtime Publication
-- ============================================================================

-- ============================================================================
-- 1. AKTIFKAN ROW LEVEL SECURITY (RLS) DI SELURUH TABEL
-- ============================================================================
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'MD_Produk', 'MD_Pelanggan', 'MD_Supplier', 'MD_BahanPenolong', 
        'MD_BOM', 'MD_Karyawan', 'MD_UserAkses', 'MD_HargaKhusus',
        'SPK', 'Produksi', 'Pembelian_Bahan', 'Mutasi_Bahan',
        'Rencana_Distribusi', 'Distribusi', 'Distribusi_Item',
        'Data_QC', 'Data_QC_Detail', 'Master_COA', 'Jurnal_Umum',
        'Draf_Jurnal', 'Data_Piutang_Utang', 'Data_Aset_Tetap',
        'Transaksi_Kas', 'Data_Presensi', 'Data_Lembur', 'Data_Kasbon',
        'Histori_Penggajian', 'Data_Surat', 'Admin_PO', 'Admin_PO_Detail',
        'Audit_Log'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Drop existing policies if any
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'Allow_Read_All', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'Allow_Write_All', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'Allow_Insert_All', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'Allow_Update_All', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', 'Allow_Delete_All', tbl);

        -- Buat kebijakan akses membaca publik / anon & authenticated
        EXECUTE format('
            CREATE POLICY "Allow_Read_All" ON %I
            FOR SELECT
            TO anon, authenticated
            USING (true);', tbl);

        -- Buat kebijakan modifikasi data untuk pengguna aplikasi
        EXECUTE format('
            CREATE POLICY "Allow_Insert_All" ON %I
            FOR INSERT
            TO anon, authenticated
            WITH CHECK (true);', tbl);

        EXECUTE format('
            CREATE POLICY "Allow_Update_All" ON %I
            FOR UPDATE
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);', tbl);

        EXECUTE format('
            CREATE POLICY "Allow_Delete_All" ON %I
            FOR DELETE
            TO anon, authenticated
            USING (true);', tbl);
    END LOOP;
END;
$$;

-- ============================================================================
-- 2. AKTIFKAN SUPABASE REALTIME REPLICATION
-- Mengaktifkan sinkronisasi otomatis antar-workstation (tanpa reload manual)
-- ============================================================================
DO $$
BEGIN
    -- Pastikan publication supabase_realtime ada
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END;
$$;

-- Tambahkan tabel operasional utama ke realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE 
    "MD_Produk",
    "MD_BahanPenolong",
    "SPK",
    "Produksi",
    "Mutasi_Bahan",
    "Rencana_Distribusi",
    "Distribusi",
    "Distribusi_Item",
    "Data_QC",
    "Draf_Jurnal",
    "Jurnal_Umum",
    "Data_Piutang_Utang",
    "Data_Presensi";


-- ============================================================================
-- BERKAS: 05_seed_initial_data.sql
-- ============================================================================

-- ============================================================================
-- AIRIS Enterprise - PostgreSQL Database Schema for Supabase
-- PT. Anugerah Illahi Rabbi (Sistem Manajemen AMDK Terintegrasi)
-- Bagian 5: Data Awal Master & Saldo Awal (Seed Data)
-- ============================================================================

-- 1. Master Data Produk
INSERT INTO "MD_Produk" ("ID_Produk", "Nama_Produk", "Kategori", "Satuan", "Harga_Distributor", "Harga_Agen", "Harga_Reseller", "Harga_Konsumen", "Status")
VALUES
('ASH-CUP120', 'As-Shofaa Cup 120ml', 'Air Mineral Cup', 'Dus', 12000, 13000, 14000, 16000, 'Aktif'),
('ASH-CUP220', 'As-Shofaa Cup 220ml', 'Air Mineral Cup', 'Dus', 14500, 15500, 16500, 18500, 'Aktif'),
('ASH-BTL330', 'As-Shofaa Botol 330ml', 'Air Mineral Botol', 'Dus', 24000, 26000, 28000, 32000, 'Aktif'),
('ASH-BTL600', 'As-Shofaa Botol 600ml', 'Air Mineral Botol', 'Dus', 28000, 30000, 32000, 36000, 'Aktif'),
('ASH-GLN19L', 'As-Shofaa Galon 19L', 'Air Mineral Galon', 'Galon', 9000, 10000, 11000, 13000, 'Aktif')
ON CONFLICT ("ID_Produk") DO NOTHING;

-- 2. Master Data Pelanggan
INSERT INTO "MD_Pelanggan" ("ID_Pelanggan", "Nama_Pelanggan", "No_Telp", "Alamat", "Level_Pelanggan", "Status")
VALUES
('PLG-0001', 'Toko Berkah Sejahtera', '081234567890', 'Jl. Raya Klaten No. 12', 'Distributor', 'Aktif'),
('PLG-0002', 'Agen Sumber Segar', '082198765432', 'Prambanan, Klaten', 'Agen', 'Aktif'),
('PLG-0003', 'Koperasi Karyawan BMT', '081345678912', 'Klaten Utara', 'Reseller', 'Aktif'),
('PLG-0004', 'Depo Air Amanah', '085678912345', 'Jatinom, Klaten', 'Konsumen Biasa', 'Aktif'),
('PLG-MWCKARANG', 'D. MWC NU KARANGNONGKO', '081222334455', 'KARANGNONGKO', 'Distributor', 'Aktif'),
('PLG-PCJQHNU', 'D. PC JQH NU', '081333445566', 'KLATEN UTARA', 'Distributor', 'Aktif'),
('PLG-MWCTULUNG', 'D. MWC NU TULUNG', '081444556677', 'TULUNG', 'Distributor', 'Aktif'),
('PLG-RADITYA', 'RADITYA', '081555667788', 'KALIKOTES', 'Agen', 'Aktif'),
('PLG-MWCCEPER', 'D. MWC NU CEPER', '081666778899', 'CEPER KLATEN', 'Distributor', 'Aktif'),
('PLG-MWCTRUCUK', 'D. MWC NU TRUCUK', '081777889900', 'TRUCUK', 'Distributor', 'Aktif'),
('PLG-CANDRA', 'CANDRA DITIA TRI A', '081888990011', 'NGAWEN', 'Agen', 'Aktif'),
('PLG-PARJOKO', 'PARJOKO', '081999001122', 'KLATEN UTARA', 'Agen', 'Aktif'),
('PLG-JIWAN', 'D. PR NU JIWAN', '082111223344', 'JIWAN KARANGNONGKO', 'Distributor', 'Aktif'),
('PLG-SUPRAPTO', 'AGEN SUPRAPTO', '082222334455', 'KARANGANOM', 'Agen', 'Aktif'),
('PLG-KLATENUTARA', 'D. MWC NU KLATEN UTARA', '082333445566', 'KLATEN UTARA', 'Distributor', 'Aktif')
ON CONFLICT ("ID_Pelanggan") DO NOTHING;

-- 3. Master Data Supplier
INSERT INTO "MD_Supplier" ("ID_Supplier", "Nama_Supplier", "PIC", "No_Telp", "Alamat", "Status")
VALUES
('SUP-0001', 'PT. Sumber Plastik Nusantara', 'Budi Santoso', '0811223344', 'Solo Baru, Sukoharjo', 'Aktif'),
('SUP-0002', 'CV. Karton Lestari Abadi', 'Hendro Gunawan', '0812998877', 'Ceper, Klaten', 'Aktif'),
('SUP-0003', 'PT. Tirta Kimia QC', 'Siti Rahma', '0813556677', 'Semarang Barat', 'Aktif')
ON CONFLICT ("ID_Supplier") DO NOTHING;

-- 4. Master Data Bahan Penolong
INSERT INTO "MD_BahanPenolong" ("ID_Bahan", "Nama_Bahan", "Kategori", "Satuan", "Harga_Satuan", "Minimum_Stock")
VALUES
('BHN-CUP120', 'Cup Plastik 120ml Polos', 'Kemasan', 'Pcs', 85, 5000),
('BHN-CUP220', 'Cup Plastik 220ml Printing', 'Kemasan', 'Pcs', 110, 8000),
('BHN-LIDSEAL', 'Lid Seal Roll As-Shofaa', 'Segel', 'Roll', 145000, 20),
('BHN-KARTON120', 'Karton Dus 120ml (isi 48)', 'Kemasan', 'Lembar', 2400, 1000),
('BHN-KARTON220', 'Karton Dus 220ml (isi 48)', 'Kemasan', 'Lembar', 2600, 1200),
('BHN-BTL330', 'Botol PET 330ml Short Neck', 'Kemasan', 'Pcs', 380, 4000),
('BHN-BTL600', 'Botol PET 600ml', 'Kemasan', 'Pcs', 460, 4000),
('BHN-TUTUPBTL', 'Tutup Botol Segel Biru', 'Segel', 'Pcs', 95, 6000),
('BHN-LABELBTL', 'Label Shrink Botol', 'Label', 'Pcs', 120, 5000),
('BHN-LAKBAN', 'Lakban Bening 2 Inch', 'Lakban', 'Roll', 9500, 50),
('BHN-TUTUPGLN', 'Tutup Galon Standar', 'Segel', 'Pcs', 420, 1500),
('BHN-TISUGLN', 'Tisu Alkohol Galon', 'Segel', 'Pcs', 130, 1500)
ON CONFLICT ("ID_Bahan") DO NOTHING;

-- 5. Master Data BOM
INSERT INTO "MD_BOM" ("ID_BOM", "ID_Produk", "ID_Bahan", "Jumlah_Dibutuhkan", "Satuan", "Keterangan")
VALUES
('BOM-0001', 'ASH-CUP220', 'BHN-CUP220', 48, 'Pcs', '48 cup per karton'),
('BOM-0002', 'ASH-CUP220', 'BHN-KARTON220', 1, 'Lembar', '1 kardus box'),
('BOM-0003', 'ASH-CUP220', 'BHN-LIDSEAL', 0.04, 'Roll', 'Estimasi seal'),
('BOM-0004', 'ASH-BTL600', 'BHN-BTL600', 24, 'Pcs', '24 botol per karton'),
('BOM-0005', 'ASH-BTL600', 'BHN-TUTUPBTL', 24, 'Pcs', '24 tutup segel'),
('BOM-0006', 'ASH-BTL600', 'BHN-LABELBTL', 24, 'Pcs', '24 label shrink'),
('BOM-0007', 'ASH-GLN19L', 'BHN-TUTUPGLN', 1, 'Pcs', '1 tutup galon'),
('BOM-0008', 'ASH-GLN19L', 'BHN-TISUGLN', 1, 'Pcs', '1 tisu antiseptik')
ON CONFLICT ("ID_BOM") DO NOTHING;

-- 6. Master Data Karyawan
INSERT INTO "MD_Karyawan" ("ID_Karyawan", "Nama_Karyawan", "Departemen", "Jabatan", "Tgl_Masuk", "Status", "Gaji_Pokok", "Tunjangan")
VALUES
('KAR-0001', 'Marko Dwi Nugroho', 'Keuangan', 'Manager', '2023-01-15', 'Aktif', 4500000, 750000),
('KAR-0002', 'H. Mujiburrahman SIP', 'Manajemen', 'Direktur', '2022-06-01', 'Aktif', 8000000, 1500000),
('KAR-0003', 'Agus Setiawan', 'Produksi', 'Supervisor', '2023-03-10', 'Aktif', 3400000, 500000),
('KAR-0004', 'Tri Wahyudi', 'Distribusi', 'Driver', '2023-05-20', 'Aktif', 2900000, 400000),
('KAR-0005', 'Nurul Hidayati', 'QC', 'Analis QC', '2023-08-01', 'Aktif', 3100000, 450000)
ON CONFLICT ("ID_Karyawan") DO NOTHING;

-- 7. Master Data Akun Pengguna
INSERT INTO "MD_UserAkses" ("ID_User", "Username", "Nama", "Password", "Role", "ID_Karyawan", "Status_Akun", "Email")
VALUES
('USR-01', 'admin', 'Marko Dwi Nugroho', 'admin123', 'SuperAdmin', 'KAR-0001', 'Aktif', 'admin@airis-amdk.com'),
('USR-02', 'produksi', 'Agus Setiawan', 'prod123', 'Admin Produksi', 'KAR-0003', 'Aktif', 'produksi@airis-amdk.com'),
('USR-03', 'gudang', 'Tri Wahyudi', 'gudang123', 'Admin Gudang', 'KAR-0004', 'Aktif', 'gudang@airis-amdk.com'),
('USR-04', 'finance', 'Marko Dwi Nugroho', 'fin123', 'Kasir/Finance', 'KAR-0001', 'Aktif', 'finance@airis-amdk.com'),
('USR-05', 'hrd', 'Nurul Hidayati', 'hrd123', 'HRD', 'KAR-0005', 'Aktif', 'hrd@airis-amdk.com')
ON CONFLICT ("ID_User") DO NOTHING;

-- 8. Master Data Harga Khusus
INSERT INTO "MD_HargaKhusus" ("ID_Harga_Khusus", "ID_Pelanggan", "ID_Produk", "Harga_Custom", "Keterangan")
VALUES
('SP-001', 'PLG-0001', 'ASH-CUP220', 14000, 'Harga Kontrak Distributor Utama')
ON CONFLICT ("ID_Harga_Khusus") DO NOTHING;

-- 9. Chart of Accounts (COA) Standar AMDK
INSERT INTO "Master_COA" ("KODE_AKUN", "NAMA_AKUN", "KATEGORI", "SALDO_NORMAL", "STATUS")
VALUES
('111-10', 'Kas Kecil (Petty Cash)', 'Aset Lancar', 'Debit', 'Aktif'),
('111-20', 'Kas Bank BSI 1607134444', 'Aset Lancar', 'Debit', 'Aktif'),
('111-21', 'Kas Bank BRI Operasional', 'Aset Lancar', 'Debit', 'Aktif'),
('112-10', 'Piutang Usaha (Distributor/Agen)', 'Aset Lancar', 'Debit', 'Aktif'),
('112-20', 'Piutang Karyawan (Kasbon)', 'Aset Lancar', 'Debit', 'Aktif'),
('113-10', 'Persediaan Bahan Baku & Penolong', 'Aset Lancar', 'Debit', 'Aktif'),
('113-30', 'Persediaan Barang Jadi (Air Minum)', 'Aset Lancar', 'Debit', 'Aktif'),
('121-10', 'Tanah & Bangunan Pabrik', 'Aset Tetap', 'Debit', 'Aktif'),
('121-20', 'Mesin Produksi & Water Treatment', 'Aset Tetap', 'Debit', 'Aktif'),
('121-30', 'Kendaraan Distribusi Armada', 'Aset Tetap', 'Debit', 'Aktif'),
('122-20', 'Akumulasi Penyusutan Mesin Produksi', 'Kontra Aset', 'Kredit', 'Aktif'),
('122-30', 'Akumulasi Penyusutan Kendaraan', 'Kontra Aset', 'Kredit', 'Aktif'),
('211-10', 'Utang Usaha (Supplier Bahan)', 'Liabilitas Pendek', 'Kredit', 'Aktif'),
('212-10', 'Utang Gaji & Upah Karyawan', 'Liabilitas Pendek', 'Kredit', 'Aktif'),
('212-20', 'Utang BPJS & Pajak PPh21', 'Liabilitas Pendek', 'Kredit', 'Aktif'),
('221-10', 'Utang Bank Jangka Panjang', 'Liabilitas Panjang', 'Kredit', 'Aktif'),
('311-10', 'Modal Disetor Pemilik', 'Ekuitas', 'Kredit', 'Aktif'),
('312-10', 'Laba Ditahan (Retained Earnings)', 'Ekuitas', 'Kredit', 'Aktif'),
('411-10', 'Pendapatan Penjualan Air Cup', 'Pendapatan', 'Kredit', 'Aktif'),
('411-20', 'Pendapatan Penjualan Air Botol', 'Pendapatan', 'Kredit', 'Aktif'),
('411-30', 'Pendapatan Penjualan Galon 19L', 'Pendapatan', 'Kredit', 'Aktif'),
('413-10', 'Potongan / Diskon Penjualan (Ekspedisi)', 'Pendapatan', 'Debit', 'Aktif'),
('512-10', 'Beban Pemakaian Bahan Baku & Penolong', 'Harga Pokok', 'Debit', 'Aktif'),
('513-10', 'Beban Tenaga Kerja Langsung Pabrik', 'Harga Pokok', 'Debit', 'Aktif'),
('514-10', 'Beban Listrik & Daya Pabrik', 'Harga Pokok', 'Debit', 'Aktif'),
('514-20', 'Beban Penyusutan Mesin Produksi', 'Harga Pokok', 'Debit', 'Aktif'),
('611-10', 'Beban Gaji Staf & Manajemen (HRD)', 'Beban', 'Debit', 'Aktif'),
('611-20', 'Beban Pemasaran & Operasional', 'Beban', 'Debit', 'Aktif'),
('611-30', 'Beban Bahan Bakar & Servis Armada', 'Beban', 'Debit', 'Aktif'),
('611-40', 'Beban Uji Lab & Sertifikasi QC (SNI)', 'Beban', 'Debit', 'Aktif'),
('611-70', 'Beban Penyusutan Kendaraan & Inventaris', 'Beban', 'Debit', 'Aktif')
ON CONFLICT ("KODE_AKUN") DO NOTHING;

-- 10. Master Data Aset Tetap
INSERT INTO "Data_Aset_Tetap" ("ID_ASET", "NAMA_ASET", "TGL_BELI", "NILAI_PEROLEHAN", "NILAI_RESIDU", "UMUR_EKONOMIS_BLN", "BEBAN_PENYUSUTAN_BLN", "AKUN_ASET", "AKUN_AKUMULASI", "AKUN_BEBAN")
VALUES
('AST-001', 'Mesin 8-Line Cup Sealing Auto', '2023-01-10', 85000000, 10000000, 60, 1250000, '121-20', '122-20', '514-20'),
('AST-002', 'Truk Engkel Isuzu Elf Box Distribusi', '2023-02-15', 195000000, 35000000, 96, 1666667, '121-30', '122-30', '611-70')
ON CONFLICT ("ID_ASET") DO NOTHING;

-- 11. Saldo Awal Jurnal Umum
INSERT INTO "Jurnal_Umum" ("ID_JURNAL", "TANGGAL", "PERIODE", "REFERENSI", "KETERANGAN", "KODE_AKUN", "DEBIT", "KREDIT", "PEMBUAT")
VALUES
('JUR-2610-001', '2026-10-01', '2026-10', 'SALDO-AWAL-01', 'Pencatatan Saldo Awal Kas Bank BSI', '111-20', 45000000, 0, 'System'),
('JUR-2610-001', '2026-10-01', '2026-10', 'SALDO-AWAL-01', 'Pencatatan Saldo Awal Modal Disetor', '311-10', 0, 45000000, 'System'),
('JUR-2610-002', '2026-10-01', '2026-10', 'SALDO-AWAL-02', 'Pencatatan Saldo Awal Kas Kecil', '111-10', 5000000, 0, 'System'),
('JUR-2610-002', '2026-10-01', '2026-10', 'SALDO-AWAL-02', 'Pencatatan Saldo Awal Modal Disetor', '311-10', 0, 5000000, 'System'),
('JUR-2610-003', '2026-10-01', '2026-10', 'SALDO-AWAL-03', 'Saldo Awal Mesin Produksi', '121-20', 85000000, 0, 'System'),
('JUR-2610-003', '2026-10-01', '2026-10', 'SALDO-AWAL-03', 'Modal Disetor Aset Mesin', '311-10', 0, 85000000, 'System'),
('JUR-2610-004', '2026-10-01', '2026-10', 'SALDO-AWAL-04', 'Saldo Awal Truk Distribusi', '121-30', 195000000, 0, 'System'),
('JUR-2610-004', '2026-10-01', '2026-10', 'SALDO-AWAL-04', 'Modal Disetor Armada', '311-10', 0, 195000000, 'System')
ON CONFLICT DO NOTHING;

-- 12. Contoh Pembelian Bahan & Mutasi Awal
INSERT INTO "Pembelian_Bahan" ("ID_Pembelian", "Tanggal", "ID_Bahan", "Nama_Bahan", "Supplier", "Harga_Satuan", "Qty", "Keterangan")
VALUES
('PB-261001', '2026-10-10', 'BHN-CUP220', 'Cup Plastik 220ml Printing', 'PT. Sumber Plastik Nusantara', 110, 20000, 'Pasokan Awal Bulan'),
('PB-261002', '2026-10-11', 'BHN-KARTON220', 'Karton Dus 220ml (isi 48)', 'CV. Karton Lestari Abadi', 2600, 2500, 'Box kemasan kardus'),
('PB-261003', '2026-10-11', 'BHN-LIDSEAL', 'Lid Seal Roll As-Shofaa', 'PT. Sumber Plastik Nusantara', 145000, 50, 'Pasokan roll segel'),
('PB-261004', '2026-10-12', 'BHN-BTL600', 'Botol PET 600ml', 'PT. Sumber Plastik Nusantara', 460, 5000, 'Botol PET'),
('PB-261005', '2026-10-12', 'BHN-TUTUPBTL', 'Tutup Botol Segel Biru', 'PT. Sumber Plastik Nusantara', 95, 6000, 'Tutup botol biru')
ON CONFLICT ("ID_Pembelian") DO NOTHING;

-- 13. SPK & Realisasi Produksi Awal
INSERT INTO "SPK" ("ID_SPK", "Tanggal", "Shift", "ID_Produk", "Target_Produksi", "Keterangan", "Status")
VALUES
('SPK-16102601', '2026-10-16', 'Shift 1 (Pagi)', 'ASH-CUP220', 500, 'Prioritas kirim Toko Berkah', 'Aktif'),
('SPK-16102602', '2026-10-16', 'Shift 2 (Siang)', 'ASH-BTL600', 300, 'Pesanan Agen Sumber Segar', 'Aktif')
ON CONFLICT ("ID_SPK") DO NOTHING;

INSERT INTO "Produksi" ("ID_Produksi", "Tanggal", "Shift", "ID_Produk", "Jumlah", "PIC_Produksi", "Keterangan")
VALUES
('PRD-15102601', '2026-10-15', 'Shift 1 (Pagi)', 'ASH-CUP220', 480, 'Agus Setiawan', 'Realisasi SPK Kemarin'),
('PRD-15102602', '2026-10-15', 'Shift 2 (Siang)', 'ASH-GLN19L', 250, 'Tri Wahyudi', 'Produksi Galon Reguler')
ON CONFLICT ("ID_Produksi") DO NOTHING;

-- 14. QC Header & Detail Siklus SNI 3553:2023
INSERT INTO "Data_QC" ("ID_QC", "Tanggal", "Bulan_Tahun", "Produk", "Petugas_QC", "Kesimpulan", "Status_Data", "ID_Produksi")
VALUES
('QC-26101501', '2026-10-15', '2026-10', 'As-Shofaa Cup 220ml', 'Nurul Hidayati', 'LAYAK - Memenuhi Standar Mutu SNI 3553:2023', 'Lengkap', 'PRD-15102601')
ON CONFLICT ("ID_QC") DO NOTHING;

INSERT INTO "Data_QC_Detail" (
    "ID_QC", "Siklus",
    "Baku_pH", "Baku_TDS", "Baku_Kekeruhan", "Baku_Bau", "Baku_Coliform",
    "Proses_pH", "Proses_TDS", "Proses_Kekeruhan", "Proses_Bau", "Proses_Rasa", "Proses_Ozon",
    "Jadi_pH", "Jadi_TDS", "Jadi_Kekeruhan", "Jadi_Bau", "Jadi_Rasa", "Jadi_Ozon", "Jadi_ALT_Awal", "Jadi_ALT_Akhir", "Jadi_Coliform"
) VALUES
('QC-26101501', 1, '7.2', '140', '0.8', 'TB', '0', '7.1', '110', '0.3', 'TB', 'Segar', '0.12', '7.0', '98', '0.1', 'TB', 'Segar', '0.08', '10', '20', '0'),
('QC-26101501', 2, '7.3', '142', '0.7', 'TB', '0', '7.2', '112', '0.3', 'TB', 'Segar', '0.13', '7.1', '99', '0.1', 'TB', 'Segar', '0.08', '12', '22', '0'),
('QC-26101501', 3, '7.2', '141', '0.8', 'TB', '0', '7.1', '111', '0.2', 'TB', 'Segar', '0.12', '7.0', '97', '0.1', 'TB', 'Segar', '0.09', '10', '18', '0')
ON CONFLICT ("ID_QC", "Siklus") DO NOTHING;

