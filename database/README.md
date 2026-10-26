# Panduan Setup Database Supabase & Transaksi Atomik (AIRIS Enterprise)
**PT. Anugerah Illahi Rabbi — Sistem ERP Pabrik Air Minum Dalam Kemasan (AMDK)**

Dokumen ini memandu langkah-langkah implementasi skema database PostgreSQL, views real-time, fungsi transaksi atomik (RPC), dan keamanan data (RLS) di platform Supabase.

---

## 1. Daftar Berkas SQL

Seluruh skrip SQL tersimpan di dalam folder `database/`:

| Berkas | Fungsi Utama |
|---|---|
| [`00_FULL_SETUP.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/00_FULL_SETUP.sql) | **Semua skrip tergabung jadi satu** (cukup jalankan berkas ini di Supabase SQL Editor). |
| [`01_tables_schema.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/01_tables_schema.sql) | DDL 29 tabel terelasi, primary key, foreign key, check constraint, index, & audit log. |
| [`02_views_and_functions.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/02_views_and_functions.sql) | Views stok produk jadi, stok bahan penolong, neraca saldo, laba rugi, dan trigger `updated_at`. |
| [`03_rpc_atomic_transactions.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/03_rpc_atomic_transactions.sql) | Fungsi PostgreSQL RPC: transaksi atomik produksi, distribusi, pembatalan, & posting jurnal. |
| [`04_rls_security_policies.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/04_rls_security_policies.sql) | Kebijakan Row Level Security (RLS) & aktivasi Realtime Publication multi-workstation. |
| [`05_seed_initial_data.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/05_seed_initial_data.sql) | Master produk, pelanggan, supplier, resep BOM, COA, saldo awal jurnal, dan aset tetap. |

---

## 2. Cara Menjalankan di Supabase Cloud

1. Buka dashboard proyek Supabase Anda di [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Masuk ke menu **SQL Editor** di bilah navigasi kiri.
3. Buat query baru (**New Query**).
4. Salin seluruh isi berkas [`00_FULL_SETUP.sql`](file:///C:/Users/marko/.gemini/antigravity/scratch/airis-enterprise/database/00_FULL_SETUP.sql).
5. Tempelkan (*paste*) ke SQL Editor lalu klik tombol **Run**.
6. Pastikan muncul pesan sukses: `Success. No rows returned` (atau daftar tabel berhasil dibuat).

---

## 3. Menghubungkan Aplikasi ke Supabase

Setelah script SQL dijalankan di Supabase:

1. Buka Supabase Dashboard > **Project Settings** > **API**.
2. Salin:
   - **Project URL** (contoh: `https://abcdefghijkl.supabase.co`)
   - **Project API Keys (anon public)** (contoh: `eyJhbGciOi...`)
3. Buka aplikasi AIRIS Enterprise di browser ([http://localhost:3000](http://localhost:3000)).
4. Klik tombol **Database** (ikon database) di bilah navigasi atas (Header).
5. Masukkan **Supabase Project URL** dan **Anon Key**.
6. Klik **Simpan & Hubungkan**.
7. Sistem akan memverifikasi koneksi ke tabel `Master_COA` dan status akan berubah menjadi **Supabase Cloud Connected**.

---

## 4. Cara Kerja Transaksi Atomik (RPC)

Untuk mengatasi masalah *race condition* dan selisih pencatatan, sistem kini menyediakan fungsi Stored Procedure PostgreSQL:

### A. Transaksi Realisasi Produksi & SPK (`rpc_complete_spk_production`)
- **Tujuan:** Saat operator menyelesaikan produksi dari SPK, stok produk jadi bertambah, bahan baku otomatis terpotong berdasarkan resep (BOM), dan draf jurnal HPP dibentuk dalam satu transaksi database tunggal (ACID).
- **Contoh Pemanggilan di Frontend (JavaScript/TypeScript):**
```ts
const { data, error } = await supabase.rpc('rpc_complete_spk_production', {
  p_id_spk: 'SPK-16102601',
  p_id_produksi: '', // Kosongkan untuk ID otomatis
  p_tanggal: '2026-10-19',
  p_shift: 'Shift 1 (Pagi)',
  p_id_produk: 'ASH-CUP220',
  p_actual_qty: 500,
  p_pic_produksi: 'Agus Setiawan',
  p_keterangan: 'Realisasi SPK Harian'
});
```

### B. Transaksi Realisasi Distribusi & Pengiriman (`rpc_dispatch_distribution`)
- **Tujuan:** Memvalidasi ketersediaan stok fisik barang jadi, memotong stok, membentuk tagihan piutang usaha (jatuh tempo 14 hari), dan mencatat draf jurnal penjualan secara otomatis.
- **Contoh Pemanggilan di Frontend:**
```ts
const { data, error } = await supabase.rpc('rpc_dispatch_distribution', {
  p_id_distribusi: '',
  p_tanggal: '2026-10-19',
  p_id_pelanggan: 'PLG-0001',
  p_pengirim: 'Tri Wahyudi',
  p_penerima: 'Bpk. Ahmad',
  p_tujuan: 'Klaten',
  p_metode_kirim: 'Kirim Armada',
  p_no_surat_jalan: 'SJ-001/X/26',
  p_no_invoice: 'INV-001/X/26',
  p_keterangan: 'Pengiriman reguler',
  p_id_rencana: 'ORD-261016-01',
  p_items: [
    { id_produk: 'ASH-CUP220', qty: 200, harga_satuan: 14500 }
  ]
});
```

### C. Pembukuan Draf Jurnal Resmi (`rpc_verify_and_post_draft_journal`)
- **Tujuan:** Melakukan verifikasi dan posting draf jurnal operasional ke Jurnal Umum dengan nomor urut resmi `JUR-YYMM-XXX`.
- **Contoh Pemanggilan di Frontend:**
```ts
const { data, error } = await supabase.rpc('rpc_verify_and_post_draft_journal', {
  p_id_draf: 'DRF-DST-001',
  p_pembuat: 'Marko Dwi Nugroho'
});
```
