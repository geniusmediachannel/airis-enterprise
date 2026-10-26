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
    COALESCE(do.total_out, 0) AS "Total_Keluar_Distribusi",
    (COALESCE(pi.total_in, 0) - COALESCE(do.total_out, 0)) AS "Sisa_Stok",
    CASE 
        WHEN (COALESCE(pi.total_in, 0) - COALESCE(do.total_out, 0)) > 200 THEN 'Aman'
        WHEN (COALESCE(pi.total_in, 0) - COALESCE(do.total_out, 0)) > 0 THEN 'Menipis'
        ELSE 'Kosong / Kritis'
    END AS "Status_Stok"
FROM "MD_Produk" p
LEFT JOIN prod_in pi ON p."ID_Produk" = pi."ID_Produk"
LEFT JOIN dist_out do ON p."ID_Produk" = do."ID_Produk"
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
