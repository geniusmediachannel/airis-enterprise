-- ============================================================================
-- AIRIS Enterprise - SQLite / LibSQL Database Schema for Turso
-- PT. Anugerah Illahi Rabbi (Sistem Manajemen AMDK Terintegrasi)
-- Skema Tabel Lengkap Khusus Turso Serverless Database
-- ============================================================================

-- 1. MASTER DATA
CREATE TABLE IF NOT EXISTS "MD_Produk" (
    "ID_Produk" TEXT PRIMARY KEY,
    "Nama_Produk" TEXT NOT NULL,
    "Kategori" TEXT NOT NULL,
    "Satuan" TEXT NOT NULL,
    "Harga_Distributor" NUMERIC DEFAULT 0,
    "Harga_Agen" NUMERIC DEFAULT 0,
    "Harga_Reseller" NUMERIC DEFAULT 0,
    "Harga_Konsumen" NUMERIC DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Aktif',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_Pelanggan" (
    "ID_Pelanggan" TEXT PRIMARY KEY,
    "Nama_Pelanggan" TEXT NOT NULL,
    "No_Telp" TEXT DEFAULT '',
    "Alamat" TEXT DEFAULT '',
    "Level_Pelanggan" TEXT NOT NULL DEFAULT 'Distributor',
    "Status" TEXT NOT NULL DEFAULT 'Aktif',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_Supplier" (
    "ID_Supplier" TEXT PRIMARY KEY,
    "Nama_Supplier" TEXT NOT NULL,
    "PIC" TEXT DEFAULT '',
    "No_Telp" TEXT DEFAULT '',
    "Alamat" TEXT DEFAULT '',
    "Status" TEXT NOT NULL DEFAULT 'Aktif',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_BahanPenolong" (
    "ID_Bahan" TEXT PRIMARY KEY,
    "Nama_Bahan" TEXT NOT NULL,
    "Kategori" TEXT NOT NULL DEFAULT 'Kemasan',
    "Satuan" TEXT NOT NULL DEFAULT 'Pcs',
    "Harga_Satuan" NUMERIC DEFAULT 0,
    "Tgl_Update_Harga" TEXT,
    "Minimum_Stock" NUMERIC DEFAULT 1000,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_BOM" (
    "ID_BOM" TEXT PRIMARY KEY,
    "ID_Produk" TEXT NOT NULL,
    "ID_Bahan" TEXT NOT NULL,
    "Jumlah_Dibutuhkan" NUMERIC DEFAULT 0,
    "Satuan" TEXT DEFAULT 'Pcs',
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_Karyawan" (
    "ID_Karyawan" TEXT PRIMARY KEY,
    "Nama_Karyawan" TEXT NOT NULL,
    "Departemen" TEXT NOT NULL,
    "Jabatan" TEXT NOT NULL,
    "Tgl_Masuk" TEXT DEFAULT (date('now', 'localtime')),
    "Status" TEXT NOT NULL DEFAULT 'Aktif',
    "Gaji_Pokok" NUMERIC DEFAULT 0,
    "Tunjangan" NUMERIC DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_UserAkses" (
    "ID_User" TEXT PRIMARY KEY,
    "Username" TEXT UNIQUE NOT NULL,
    "Nama" TEXT,
    "Password" TEXT,
    "Role" TEXT NOT NULL,
    "ID_Karyawan" TEXT,
    "Status_Akun" TEXT NOT NULL DEFAULT 'Aktif',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "MD_HargaKhusus" (
    "ID_Harga_Khusus" TEXT PRIMARY KEY,
    "ID_Pelanggan" TEXT NOT NULL,
    "ID_Produk" TEXT NOT NULL,
    "Harga_Custom" NUMERIC NOT NULL DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 2. MANAJEMEN PRODUKSI
CREATE TABLE IF NOT EXISTS "SPK" (
    "ID_SPK" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Shift" TEXT NOT NULL,
    "ID_Produk" TEXT NOT NULL,
    "Target_Produksi" NUMERIC DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "Status" TEXT NOT NULL DEFAULT 'Aktif',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Produksi" (
    "ID_Produksi" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Shift" TEXT NOT NULL,
    "ID_Produk" TEXT NOT NULL,
    "Jumlah" NUMERIC DEFAULT 0,
    "PIC_Produksi" TEXT DEFAULT '',
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 3. PERSEDIAAN & BAHAN BAKU
CREATE TABLE IF NOT EXISTS "Pembelian_Bahan" (
    "ID_Pembelian" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Bahan" TEXT NOT NULL,
    "Nama_Bahan" TEXT NOT NULL,
    "Supplier" TEXT DEFAULT '',
    "Harga_Satuan" NUMERIC DEFAULT 0,
    "Qty" NUMERIC DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Mutasi_Bahan" (
    "ID_Mutasi" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Bahan" TEXT NOT NULL,
    "Nama_Bahan" TEXT NOT NULL,
    "Tipe" TEXT NOT NULL,
    "Qty" NUMERIC DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 4. DISTRIBUSI & LOGISTIK
CREATE TABLE IF NOT EXISTS "Rencana_Distribusi" (
    "ID_Rencana" TEXT PRIMARY KEY,
    "Tanggal_Rencana" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Pelanggan" TEXT NOT NULL,
    "Nama_Pelanggan" TEXT NOT NULL,
    "Level_Pelanggan" TEXT DEFAULT 'Distributor',
    "Metode_Kirim" TEXT DEFAULT 'Diantar Armada',
    "Alamat_Tujuan" TEXT DEFAULT '',
    "Sopir" TEXT DEFAULT '',
    "Status" TEXT NOT NULL DEFAULT 'Menunggu Kirim',
    "Catatan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Distribusi" (
    "ID_Distribusi" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Pelanggan" TEXT NOT NULL,
    "Nama_Pelanggan" TEXT,
    "Level_Pelanggan" TEXT,
    "Pengirim" TEXT DEFAULT '',
    "Penerima" TEXT DEFAULT '',
    "Tujuan" TEXT DEFAULT '',
    "Metode_Kirim" TEXT NOT NULL DEFAULT 'Diantar Armada',
    "No_Surat_Jalan" TEXT NOT NULL,
    "No_Invoice" TEXT,
    "Total_Tagihan" NUMERIC DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "C120" NUMERIC DEFAULT 0,
    "C220" NUMERIC DEFAULT 0,
    "B330" NUMERIC DEFAULT 0,
    "B600" NUMERIC DEFAULT 0,
    "G19" NUMERIC DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Distribusi_Item" (
    "ID_Detail" TEXT PRIMARY KEY,
    "ID_Distribusi" TEXT NOT NULL,
    "Nama_Pelanggan" TEXT,
    "Tanggal" TEXT,
    "Level_Pelanggan" TEXT,
    "ID_Produk" TEXT NOT NULL,
    "Nama_Produk" TEXT,
    "Qty" NUMERIC DEFAULT 0,
    "Harga_Satuan" NUMERIC DEFAULT 0,
    "Subtotal" NUMERIC DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 5. QUALITY CONTROL (SNI 3553:2023)
CREATE TABLE IF NOT EXISTS "Data_QC" (
    "ID_QC" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Bulan_Tahun" TEXT NOT NULL,
    "Produk" TEXT NOT NULL,
    "Petugas_QC" TEXT DEFAULT '',
    "Kesimpulan" TEXT NOT NULL,
    "Status_Data" TEXT NOT NULL DEFAULT 'Lengkap',
    "ID_Produksi" TEXT,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_QC_Detail" (
    "ID_Detail" INTEGER PRIMARY KEY AUTOINCREMENT,
    "ID_QC" TEXT NOT NULL,
    "Siklus" INTEGER NOT NULL DEFAULT 1,
    "Baku_pH" TEXT DEFAULT '',
    "Baku_TDS" TEXT DEFAULT '',
    "Baku_Kekeruhan" TEXT DEFAULT '',
    "Baku_Bau" TEXT DEFAULT 'TB',
    "Baku_Coliform" TEXT DEFAULT '',
    "Proses_pH" TEXT DEFAULT '',
    "Proses_TDS" TEXT DEFAULT '',
    "Proses_Kekeruhan" TEXT DEFAULT '',
    "Proses_Bau" TEXT DEFAULT 'TB',
    "Proses_Rasa" TEXT DEFAULT 'Segar',
    "Proses_Ozon" TEXT DEFAULT '',
    "Jadi_pH" TEXT DEFAULT '',
    "Jadi_TDS" TEXT DEFAULT '',
    "Jadi_Kekeruhan" TEXT DEFAULT '',
    "Jadi_Bau" TEXT DEFAULT 'TB',
    "Jadi_Rasa" TEXT DEFAULT 'Segar',
    "Jadi_Ozon" TEXT DEFAULT '',
    "Jadi_ALT_Awal" TEXT DEFAULT '',
    "Jadi_ALT_Akhir" TEXT DEFAULT '',
    "Jadi_Coliform" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 6. KEUANGAN & AKUNTANSI
CREATE TABLE IF NOT EXISTS "Master_COA" (
    "KODE_AKUN" TEXT PRIMARY KEY,
    "NAMA_AKUN" TEXT NOT NULL,
    "KATEGORI" TEXT NOT NULL,
    "SUB_KATEGORI" TEXT DEFAULT '',
    "SALDO_NORMAL" TEXT NOT NULL,
    "SALDO_AWAL" NUMERIC DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Jurnal_Umum" (
    "ID_Entry" TEXT PRIMARY KEY,
    "ID_Transaksi" TEXT NOT NULL,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Kode_Akun" TEXT NOT NULL,
    "Nama_Akun" TEXT NOT NULL,
    "Keterangan" TEXT DEFAULT '',
    "Debit" NUMERIC DEFAULT 0,
    "Kredit" NUMERIC DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Draf_Jurnal" (
    "ID_Draf" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Kategori" TEXT NOT NULL,
    "Keterangan" TEXT NOT NULL,
    "Nominal" NUMERIC DEFAULT 0,
    "Akun_Debit" TEXT NOT NULL,
    "Akun_Kredit" TEXT NOT NULL,
    "Status" TEXT NOT NULL DEFAULT 'Menunggu Review',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_Piutang_Utang" (
    "ID_DOKUMEN" TEXT PRIMARY KEY,
    "TIPE" TEXT NOT NULL,
    "TANGGAL" TEXT DEFAULT (date('now', 'localtime')),
    "JATUH_TEMPO" TEXT,
    "ENTITAS" TEXT NOT NULL,
    "DESKRIPSI" TEXT DEFAULT '',
    "TOTAL_TAGIHAN" NUMERIC DEFAULT 0,
    "SISA_TAGIHAN" NUMERIC DEFAULT 0,
    "STATUS" TEXT NOT NULL DEFAULT 'Belum Lunas',
    "KETERANGAN" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_Aset_Tetap" (
    "ID_ASET" TEXT PRIMARY KEY,
    "NAMA_ASET" TEXT NOT NULL,
    "KATEGORI" TEXT NOT NULL,
    "TGL_PEROLEHAN" TEXT,
    "HARGA_PEROLEHAN" NUMERIC DEFAULT 0,
    "NILAI_SISA" NUMERIC DEFAULT 0,
    "MASA_MANFAAT" INTEGER DEFAULT 5,
    "METODE_PENYUSUTAN" TEXT DEFAULT 'Garis Lurus',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Transaksi_Kas" (
    "ID_Transaksi" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Tipe" TEXT NOT NULL,
    "Kategori" TEXT NOT NULL,
    "Nominal" NUMERIC DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_Pembayaran_Pelanggan" (
    "ID_Pembayaran" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Pelanggan" TEXT NOT NULL,
    "Nama_Pelanggan" TEXT NOT NULL,
    "Nominal" NUMERIC DEFAULT 0,
    "Metode" TEXT DEFAULT 'Transfer',
    "Catatan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 7. SDM, PRESENSI & PAYROLL
CREATE TABLE IF NOT EXISTS "Data_Presensi" (
    "ID_Presensi" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Karyawan" TEXT NOT NULL,
    "Nama_Karyawan" TEXT NOT NULL,
    "Status_Kehadiran" TEXT NOT NULL DEFAULT 'Hadir',
    "Jam_Masuk" TEXT DEFAULT '',
    "Jam_Pulang" TEXT DEFAULT '',
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_Lembur" (
    "ID_Lembur" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Karyawan" TEXT NOT NULL,
    "Nama_Karyawan" TEXT NOT NULL,
    "Durasi_Jam" NUMERIC DEFAULT 0,
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_Kasbon" (
    "ID_Kasbon" TEXT PRIMARY KEY,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Karyawan" TEXT NOT NULL,
    "Nama_Karyawan" TEXT NOT NULL,
    "Nominal" NUMERIC DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Aktif',
    "Keterangan" TEXT DEFAULT '',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Histori_Penggajian" (
    "ID_Histori" TEXT PRIMARY KEY,
    "Periode" TEXT NOT NULL,
    "Tanggal_Bayar" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Karyawan" TEXT NOT NULL,
    "Nama_Karyawan" TEXT NOT NULL,
    "Gaji_Pokok" NUMERIC DEFAULT 0,
    "Tunjangan" NUMERIC DEFAULT 0,
    "Lembur" NUMERIC DEFAULT 0,
    "Potongan_Kasbon" NUMERIC DEFAULT 0,
    "Total_Diterima" NUMERIC DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Dibayar',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 8. ADMINISTRASI, SURAT & PO
CREATE TABLE IF NOT EXISTS "Data_Surat" (
    "ID_Surat" TEXT PRIMARY KEY,
    "Nomor_Surat" TEXT NOT NULL,
    "Tipe_Surat" TEXT NOT NULL,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "Perihal" TEXT NOT NULL,
    "Lampiran" TEXT DEFAULT '',
    "Kepada" TEXT NOT NULL,
    "Alamat_Tujuan" TEXT DEFAULT '',
    "Isi_Surat" TEXT NOT NULL,
    "Penandatangan_Nama" TEXT NOT NULL,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Admin_PO" (
    "ID_PO" TEXT PRIMARY KEY,
    "No_PO" TEXT NOT NULL,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Supplier" TEXT NOT NULL,
    "Nama_Supplier" TEXT NOT NULL,
    "Perihal" TEXT DEFAULT '',
    "Total_Nilai" NUMERIC DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Draf',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Admin_PO_Detail" (
    "ID_Detail" TEXT PRIMARY KEY,
    "ID_PO" TEXT NOT NULL,
    "Nama_Barang" TEXT NOT NULL,
    "Spesifikasi" TEXT DEFAULT '',
    "Qty" NUMERIC DEFAULT 0,
    "Satuan" TEXT DEFAULT 'Pcs',
    "Harga_Satuan" NUMERIC DEFAULT 0,
    "Subtotal" NUMERIC DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Data_Custom_Invoice" (
    "ID_Invoice" TEXT PRIMARY KEY,
    "Nomor_Invoice" TEXT NOT NULL,
    "Tanggal" TEXT DEFAULT (date('now', 'localtime')),
    "ID_Pelanggan" TEXT,
    "Nama_Pelanggan" TEXT NOT NULL,
    "Total_Tagihan" NUMERIC DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'Draf',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime')),
    "updated_at" TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS "Audit_Log" (
    "ID_Log" TEXT PRIMARY KEY,
    "Waktu" TEXT DEFAULT (datetime('now', 'localtime')),
    "Aktivitas" TEXT NOT NULL,
    "Modul" TEXT NOT NULL,
    "User" TEXT DEFAULT 'System',
    "created_at" TEXT DEFAULT (datetime('now', 'localtime'))
);
