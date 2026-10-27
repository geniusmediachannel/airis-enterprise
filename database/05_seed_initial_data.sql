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

-- 15. Data Distribusi & Pengiriman Awal (Total 1.366 Unit)
INSERT INTO "Distribusi" ("ID_Distribusi", "Tanggal", "ID_Pelanggan", "Nama_Pelanggan", "Level_Pelanggan", "Pengirim", "Penerima", "Tujuan", "Metode_Kirim", "No_Surat_Jalan", "No_Invoice", "Total_Tagihan", "Keterangan")
VALUES
('DST-646', '2026-10-01', 'PLG-MWCKARANG', 'D. MWC NU KARANGNONGKO', 'Distributor', 'AGUS', '-', 'KARANGNONGKO', 'Ambil Sendiri', '646/x/26', 'INV-646/X/26', 2275000, ''),
('DST-647', '2026-10-02', 'PLG-PCJQHNU', 'D. PC JQH NU', 'Distributor', 'RADITYA', 'DILLAH', 'KLATEN UTARA', 'Diantar Armada', '647/x/26', 'INV-647/X/26', 2737500, ''),
('DST-648', '2026-10-02', 'PLG-MWCTULUNG', 'D. MWC NU TULUNG', 'Distributor', 'RADITYA', '-', 'TULUNG', 'Diantar Armada', '648/x/26', 'INV-648/X/26', 1975000, ''),
('DST-649', '2026-10-02', 'PLG-RADITYA', 'RADITYA', 'Agen', '-', '-', 'KALIKOTES', 'Diantar Armada', '649/x/26', 'INV-649/X/26', 37000, ''),
('DST-650', '2026-10-03', 'PLG-MWCCEPER', 'D. MWC NU CEPER', 'Distributor', 'RADITYA', '-', 'CEPER KLATEN', 'Diantar Armada', '650/x/26', 'INV-650/X/26', 7525000, ''),
('DST-651', '2026-10-03', 'PLG-MWCTRUCUK', 'D. MWC NU TRUCUK', 'Distributor', 'RADITYA', '-', 'TRUCUK', 'Diantar Armada', '651/x/26', 'INV-651/X/26', 1180000, ''),
('DST-652', '2026-10-03', 'PLG-CANDRA', 'CANDRA DITIA TRI A', 'Agen', 'RADITYA', '-', 'NGAWEN', 'Diantar Armada', '652/x/26', 'INV-652/X/26', 45000, ''),
('DST-652B', '2026-10-03', 'PLG-PARJOKO', 'PARJOKO', 'Agen', '-', '-', 'KLATEN UTARA', 'Diantar Armada', '652/X/26', 'INV-652B/X/26', 114000, ''),
('DST-653', '2026-10-05', 'PLG-JIWAN', 'D. PR NU JIWAN', 'Distributor', 'AGUS', '-', 'JIWAN KARANGNONGKO', 'Kirim Armada', '653/X/26', 'INV-653/X/26', 1950000, '(Total Qty Potongan: - Rp 100.000)'),
('DST-654', '2026-10-05', 'PLG-SUPRAPTO', 'AGEN SUPRAPTO', 'Agen', 'RADIT', '-', 'KARANGANOM', 'Kirim Armada', '654/X/26', 'INV-654/X/26', 2762000, ''),
('DST-655', '2026-10-05', 'PLG-KLATENUTARA', 'D. MWC NU KLATEN UTARA', 'Distributor', 'RENGGA', 'RENGGA', 'KLATEN UTARA', 'Ambil Sendiri', '655/X/26', 'INV-655/X/26', 2555000, '(Total Qty Potongan: - Rp 100.000)'),
('DST-656', '2026-10-06', 'PLG-0001', 'Toko Berkah Sejahtera', 'Distributor', 'Tri Wahyudi', 'Bpk. Hendra', 'Klaten', 'Diantar Armada', '656/X/26', 'INV-656/X/26', 2900000, 'Pesanan Reguler Toko'),
('DST-657', '2026-10-08', 'PLG-0002', 'Agen Sumber Segar', 'Agen', 'Tri Wahyudi', 'Bpk. Ahmad', 'Prambanan', 'Diantar Armada', '657/X/26', 'INV-657/X/26', 5000000, 'Pengiriman Galon & Botol'),
('DST-658', '2026-10-10', 'PLG-0003', 'Koperasi Karyawan BMT', 'Reseller', 'Agus', 'Ibu Rina', 'Klaten Utara', 'Ambil Sendiri', '658/X/26', 'INV-658/X/26', 840000, 'Pesanan Air Cup 120ml')
ON CONFLICT ("ID_Distribusi") DO NOTHING;

INSERT INTO "Distribusi_Item" ("ID_Detail", "ID_Distribusi", "Nama_Pelanggan", "Tanggal", "Level_Pelanggan", "ID_Produk", "Nama_Produk", "Qty", "Harga_Satuan", "Subtotal")
VALUES
('DET-646-1', 'DST-646', 'D. MWC NU KARANGNONGKO', '2026-10-01', 'Distributor', 'ASH-CUP120', 'As-Shofaa Cup 120ml', 20, 13000, 260000),
('DET-646-2', 'DST-646', 'D. MWC NU KARANGNONGKO', '2026-10-01', 'Distributor', 'ASH-BTL330', 'As-Shofaa Botol 330ml', 10, 27500, 275000),
('DET-646-3', 'DST-646', 'D. MWC NU KARANGNONGKO', '2026-10-01', 'Distributor', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 45, 38666, 1740000),
('DET-647-1', 'DST-647', 'D. PC JQH NU', '2026-10-02', 'Distributor', 'ASH-CUP120', 'As-Shofaa Cup 120ml', 15, 13500, 202500),
('DET-647-2', 'DST-647', 'D. PC JQH NU', '2026-10-02', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 30, 15500, 465000),
('DET-647-3', 'DST-647', 'D. PC JQH NU', '2026-10-02', 'Distributor', 'ASH-BTL330', 'As-Shofaa Botol 330ml', 30, 27000, 810000),
('DET-647-4', 'DST-647', 'D. PC JQH NU', '2026-10-02', 'Distributor', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 25, 50400, 1260000),
('DET-648-1', 'DST-648', 'D. MWC NU TULUNG', '2026-10-02', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 70, 15500, 1085000),
('DET-648-2', 'DST-648', 'D. MWC NU TULUNG', '2026-10-02', 'Distributor', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 15, 59333, 890000),
('DET-649-1', 'DST-649', 'RADITYA', '2026-10-02', 'Agen', 'ASH-CUP120', 'As-Shofaa Cup 120ml', 2, 18500, 37000),
('DET-650-1', 'DST-650', 'D. MWC NU CEPER', '2026-10-03', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 200, 15500, 3100000),
('DET-650-2', 'DST-650', 'D. MWC NU CEPER', '2026-10-03', 'Distributor', 'ASH-BTL330', 'As-Shofaa Botol 330ml', 50, 28500, 1425000),
('DET-650-3', 'DST-650', 'D. MWC NU CEPER', '2026-10-03', 'Distributor', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 50, 60000, 3000000),
('DET-651-1', 'DST-651', 'D. MWC NU TRUCUK', '2026-10-03', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 40, 15500, 620000),
('DET-651-2', 'DST-651', 'D. MWC NU TRUCUK', '2026-10-03', 'Distributor', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 10, 56000, 560000),
('DET-652-1', 'DST-652', 'CANDRA DITIA TRI A', '2026-10-03', 'Agen', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 2, 22500, 45000),
('DET-652B-1', 'DST-652B', 'PARJOKO', '2026-10-03', 'Agen', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 3, 38000, 114000),
('DET-653-1', 'DST-653', 'D. PR NU JIWAN', '2026-10-05', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 100, 20500, 2050000),
('DET-654-1', 'DST-654', 'AGEN SUPRAPTO', '2026-10-05', 'Agen', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 40, 16500, 660000),
('DET-654-2', 'DST-654', 'AGEN SUPRAPTO', '2026-10-05', 'Agen', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 49, 42897, 2102000),
('DET-655-1', 'DST-655', 'D. MWC NU KLATEN UTARA', '2026-10-05', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 50, 16500, 825000),
('DET-655-2', 'DST-655', 'D. MWC NU KLATEN UTARA', '2026-10-05', 'Distributor', 'ASH-BTL330', 'As-Shofaa Botol 330ml', 20, 27500, 550000),
('DET-655-3', 'DST-655', 'D. MWC NU KLATEN UTARA', '2026-10-05', 'Distributor', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 30, 42666, 1280000),
('DET-656-1', 'DST-656', 'Toko Berkah Sejahtera', '2026-10-06', 'Distributor', 'ASH-CUP220', 'As-Shofaa Cup 220ml', 200, 14500, 2900000),
('DET-657-1', 'DST-657', 'Agen Sumber Segar', '2026-10-08', 'Agen', 'ASH-GLN19L', 'As-Shofaa Galon 19L', 50, 10000, 500000),
('DET-657-2', 'DST-657', 'Agen Sumber Segar', '2026-10-08', 'Agen', 'ASH-BTL600', 'As-Shofaa Botol 600ml', 150, 30000, 4500000),
('DET-658-1', 'DST-658', 'Koperasi Karyawan BMT', '2026-10-10', 'Reseller', 'ASH-CUP120', 'As-Shofaa Cup 120ml', 60, 14000, 840000)
ON CONFLICT ("ID_Detail") DO NOTHING;
