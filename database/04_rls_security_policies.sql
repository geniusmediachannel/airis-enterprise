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
