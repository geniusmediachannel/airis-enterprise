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
