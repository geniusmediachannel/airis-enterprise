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
