/**
 * AIRIS Enterprise - Universal Finance Auto-Sync Engine
 * Automatically synchronizes operational transactions (Distribusi, Produksi,
 * Pembelian Bahan, Penggajian, Kasbon) into Double-Entry General Journals,
 * Draft Journals, and Accounts Receivable/Payable ledgers.
 */

import { 
  getTableData, 
  setTableData, 
  notifyDbChange 
} from './dbAdapter';
import { 
  DistributionItem, 
  DistributionProductDetail, 
  ProductionItem, 
  RawMaterialPurchase, 
  RawMaterialMutation, 
  PayrollHistoryItem, 
  KasbonRecord, 
  GeneralJournalItem, 
  DraftJournalItem, 
  ReceivablePayableItem, 
  BOMItem, 
  RawMaterialItem,
  ProductItem
} from '../types';

export interface FinanceSyncResult {
  success: boolean;
  syncedDistributions: number;
  syncedProductions: number;
  syncedPurchases: number;
  syncedPayrolls: number;
  syncedKasbons: number;
  syncedPayments: number;
  totalJournalsAdded: number;
  message: string;
}

/**
 * Standard AMDK HPP fallback estimates when BOM is missing or incomplete
 */
const DEFAULT_UNIT_HPP: Record<string, number> = {
  'ASH-CUP120': 6000,
  'ASH-CUP220': 7500,
  'ASH-BTL330': 12000,
  'ASH-BTL600': 14500,
  'ASH-GLN19L': 2500,
  'C120': 6000,
  'C220': 7500,
  'B330': 12000,
  'B600': 14500,
  'G19': 2500,
};

/**
 * Core engine that synchronizes all operational modules into Keuangan
 */
export function syncAllModulesToFinance(options?: { autoPostToGeneralJournal?: boolean }): FinanceSyncResult {
  try {
    const autoPost = options?.autoPostToGeneralJournal !== false; // Default: true

    // 1. Load operational data (safely filter null/undefined records)
    const rawDistributions = getTableData<DistributionItem>('Distribusi', []) || [];
    const rawDistItems = getTableData<DistributionProductDetail>('Distribusi_Item', []) || [];
    const rawProductions = getTableData<ProductionItem>('Produksi', []) || [];
    const rawPurchases = getTableData<RawMaterialPurchase>('Pembelian_Bahan', []) || [];
    const rawPayrolls = getTableData<PayrollHistoryItem>('Histori_Penggajian', []) || [];
    const rawKasbons = getTableData<KasbonRecord>('Data_Kasbon', []) || [];
    const rawCustomerPayments = getTableData<any>('Data_Pembayaran_Pelanggan', []) || [];
    const rawBoms = getTableData<BOMItem>('MD_BOM', []) || [];
    const rawRawMaterials = getTableData<RawMaterialItem>('MD_BahanPenolong', []) || [];
    const rawProducts = getTableData<ProductItem>('MD_Produk', []) || [];

    const distributions = (Array.isArray(rawDistributions) ? rawDistributions : []).filter(d => d && typeof d === 'object');
    const distItems = (Array.isArray(rawDistItems) ? rawDistItems : []).filter(di => di && typeof di === 'object');
    const productions = (Array.isArray(rawProductions) ? rawProductions : []).filter(p => p && typeof p === 'object');
    const purchases = (Array.isArray(rawPurchases) ? rawPurchases : []).filter(pu => pu && typeof pu === 'object');
    const payrolls = (Array.isArray(rawPayrolls) ? rawPayrolls : []).filter(pa => pa && typeof pa === 'object');
    const kasbons = (Array.isArray(rawKasbons) ? rawKasbons : []).filter(k => k && typeof k === 'object');
    const customerPayments = (Array.isArray(rawCustomerPayments) ? rawCustomerPayments : []).filter(cp => cp && typeof cp === 'object');
    const boms = (Array.isArray(rawBoms) ? rawBoms : []).filter(b => b && typeof b === 'object');
    const rawMaterials = (Array.isArray(rawRawMaterials) ? rawRawMaterials : []).filter(rm => rm && typeof rm === 'object');
    const products = (Array.isArray(rawProducts) ? rawProducts : []).filter(p => p && typeof p === 'object');

    const hasAnyOperationalData = distributions.length > 0 || productions.length > 0 || purchases.length > 0 || payrolls.length > 0 || kasbons.length > 0 || customerPayments.length > 0;

    if (!hasAnyOperationalData) {
      // Jika data operasional kosong total (misal pasca reset database)
      // Jaga agar keuangan tetap bersih (tidak membangkitkan draf atau jurnal baru)
      const currentJournals = (getTableData<GeneralJournalItem>('Jurnal_Umum', []) || []).filter(j => j && typeof j === 'object');
      if (currentJournals.length === 0) {
        setTableData('Draf_Jurnal', []);
        setTableData('Data_Piutang_Utang', []);
        return {
          success: true,
          syncedDistributions: 0,
          syncedProductions: 0,
          syncedPurchases: 0,
          syncedPayrolls: 0,
          syncedKasbons: 0,
          syncedPayments: 0,
          totalJournalsAdded: 0,
          message: 'Data operasional kosong. Modul keuangan tetap bersih Rp 0.'
        };
      }
    }

    // 2. Load financial tables (safely filter null/undefined records)
    let journals = [...(getTableData<GeneralJournalItem>('Jurnal_Umum', []) || [])].filter(j => j && typeof j === 'object');
    let drafts = [...(getTableData<DraftJournalItem>('Draf_Jurnal', []) || [])].filter(d => d && typeof d === 'object');
    let piutangUtang = [...(getTableData<ReceivablePayableItem>('Data_Piutang_Utang', []) || [])].filter(pu => pu && typeof pu === 'object');
    let mutations = [...(getTableData<RawMaterialMutation>('Mutasi_Bahan', []) || [])].filter(m => m && typeof m === 'object');

    // Helper to check existing journal reference
    const existingJournalRefs = new Set(journals.map(j => (j?.REFERENSI || '').trim()));
    const existingDraftRefs = new Set<string>();
    drafts.forEach(d => {
      if (!d) return;
      const ref = (d.Referensi || '').trim();
      if (ref) {
        existingDraftRefs.add(ref);
        if (ref.startsWith('DIST-')) existingDraftRefs.add(ref.slice(5));
      }
    });
    const existingPiutangDocIds = new Set(piutangUtang.map(p => (p?.ID_DOKUMEN || p?.ID_Transaksi || '').trim()));
    const existingMutationDesc = new Set(mutations.map(m => (m?.Keterangan || '').trim()));

    // Sequence generator for journal IDs per period: JUR-YYMM-001, JUR-YYMM-002, ...
    const seqMap = new Map<string, number>();
    journals.forEach(j => {
      if (!j) return;
      const id = j.ID_JURNAL || '';
    const match = id.match(/^JUR-(\d{4})-(\d+)$/);
    if (match) {
      const periodKey = match[1];
      const seq = parseInt(match[2], 10);
      const curMax = seqMap.get(periodKey) || 0;
      if (seq > curMax) seqMap.set(periodKey, seq);
    }
  });

  const getNextJournalId = (dateStr: string): string => {
    const cleanDate = dateStr && /^\d{4}-\d{2}/.test(dateStr) ? dateStr : new Date().toISOString().slice(0, 10);
    const yy = cleanDate.slice(2, 4);
    const mm = cleanDate.slice(5, 7);
    const periodKey = `${yy}${mm}`;
    const nextSeq = (seqMap.get(periodKey) || 0) + 1;
    seqMap.set(periodKey, nextSeq);
    return `JUR-${periodKey}-${String(nextSeq).padStart(3, '0')}`;
  };

  let countDist = 0;
  let countProd = 0;
  let countPurch = 0;
  let countPayroll = 0;
  let countKasbon = 0;
  let countPayments = 0;
  let countJournalsAdded = 0;

  // =========================================================================
  // 1. SINKRONISASI DISTRIBUSI (Penjualan & Piutang Usaha)
  // =========================================================================
  distributions.forEach(d => {
    const distId = (d.ID_Distribusi || '').trim();
    if (!distId) return;

    const refKey = `DIST-${distId}`;
    const invoiceNo = d.No_Invoice || `INV-${d.No_Surat_Jalan || distId}`;
    const cleanDate = d.Tanggal && /^\d{4}-\d{2}-\d{2}/.test(d.Tanggal) ? d.Tanggal : new Date().toISOString().slice(0, 10);
    const periode = cleanDate.slice(0, 7);

    // Calculate distribution sales breakdown by product
    const items = distItems.filter(di => di.ID_Distribusi === distId);
    let cupNominal = 0;
    let botolNominal = 0;
    let galonNominal = 0;
    let otherNominal = 0;

    items.forEach(it => {
      const pId = (it.ID_Produk || '').toUpperCase();
      const pName = (it.Nama_Produk || '').toLowerCase();
      const sub = Number(it.Subtotal) || (Number(it.Qty) * Number(it.Harga_Satuan)) || 0;

      if (pId.includes('CUP') || pId.includes('C120') || pId.includes('C220') || pName.includes('cup')) {
        cupNominal += sub;
      } else if (pId.includes('BTL') || pId.includes('B330') || pId.includes('B600') || pName.includes('botol')) {
        botolNominal += sub;
      } else if (pId.includes('GLN') || pId.includes('G19') || pName.includes('galon')) {
        galonNominal += sub;
      } else {
        otherNominal += sub;
      }
    });

    let calculatedTotal = cupNominal + botolNominal + galonNominal + otherNominal;
    if (calculatedTotal === 0 && d.Total_Tagihan) {
      calculatedTotal = Number(d.Total_Tagihan);
      cupNominal = calculatedTotal; // default category
    }

    // Expedisi discount if Ambil Sendiri
    let discount = 0;
    if (d.Metode_Kirim === 'Ambil Sendiri') {
      const totalQty = items.reduce((s, it) => s + (Number(it.Qty) || 0), 0);
      discount = totalQty * 1000;
    }
    const grandTotal = Math.max(0, calculatedTotal - discount);

    if (grandTotal <= 0) return;

    // A. Add to General Journal if not yet posted
    const alreadyInJournal = existingJournalRefs.has(refKey) || 
      journals.some(j => j.REFERENSI === refKey || j.REFERENSI === distId || (j.REFERENSI && j.REFERENSI.includes(distId)));

    if (!alreadyInJournal && autoPost) {
      const jId = getNextJournalId(cleanDate);
      const desc = `Penjualan ${d.Nama_Pelanggan} (SJ: ${d.No_Surat_Jalan || distId}, Inv: ${invoiceNo})`;

      // 1. Debit: Piutang Usaha
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: desc,
        KODE_AKUN: '112-10', // Piutang Usaha
        DEBIT: grandTotal,
        KREDIT: 0,
        PEMBUAT: 'Auto Sync Distribusi'
      });
      countJournalsAdded++;

      // 2. Kredit: Revenue split by category or single credit
      const revenueStreams: { akun: string; nama: string; nominal: number }[] = [];
      if (cupNominal > 0) revenueStreams.push({ akun: '411-10', nama: 'Pendapatan Air Cup', nominal: cupNominal });
      if (botolNominal > 0) revenueStreams.push({ akun: '411-20', nama: 'Pendapatan Air Botol', nominal: botolNominal });
      if (galonNominal > 0) revenueStreams.push({ akun: '411-30', nama: 'Pendapatan Air Galon', nominal: galonNominal });
      if (otherNominal > 0) revenueStreams.push({ akun: '411-40', nama: 'Pendapatan Penjualan Lainnya', nominal: otherNominal });

      if (revenueStreams.length > 1) {
        revenueStreams.forEach(stream => {
          journals.push({
            ID_JURNAL: jId,
            TANGGAL: cleanDate,
            PERIODE: periode,
            REFERENSI: refKey,
            KETERANGAN: `${stream.nama} - ${d.Nama_Pelanggan}`,
            KODE_AKUN: stream.akun,
            DEBIT: 0,
            KREDIT: stream.nominal,
            PEMBUAT: 'Auto Sync Distribusi'
          });
          countJournalsAdded++;
        });
      } else if (revenueStreams.length === 1) {
        const stream = revenueStreams[0];
        journals.push({
          ID_JURNAL: jId,
          TANGGAL: cleanDate,
          PERIODE: periode,
          REFERENSI: refKey,
          KETERANGAN: `${stream.nama} - ${d.Nama_Pelanggan}`,
          KODE_AKUN: stream.akun,
          DEBIT: 0,
          KREDIT: stream.nominal || calculatedTotal,
          PEMBUAT: 'Auto Sync Distribusi'
        });
        countJournalsAdded++;
      } else {
        journals.push({
          ID_JURNAL: jId,
          TANGGAL: cleanDate,
          PERIODE: periode,
          REFERENSI: refKey,
          KETERANGAN: `Pendapatan Penjualan Air - ${d.Nama_Pelanggan}`,
          KODE_AKUN: '411-10',
          DEBIT: 0,
          KREDIT: calculatedTotal,
          PEMBUAT: 'Auto Sync Distribusi'
        });
        countJournalsAdded++;
      }

      // If discount applied, record debit discount
      if (discount > 0) {
        journals.push({
          ID_JURNAL: jId,
          TANGGAL: cleanDate,
          PERIODE: periode,
          REFERENSI: refKey,
          KETERANGAN: `Potongan Ambil Sendiri - ${d.Nama_Pelanggan}`,
          KODE_AKUN: '413-10',
          DEBIT: discount,
          KREDIT: 0,
          PEMBUAT: 'Auto Sync Distribusi'
        });
        countJournalsAdded++;
      }

      existingJournalRefs.add(refKey);
      countDist++;
    }

    // B. Also add/update Draf_Jurnal as record (Cegah duplikasi mutlak)
    const alreadyInDrafts = existingDraftRefs.has(refKey) || 
      existingDraftRefs.has(distId) ||
      drafts.some(dr => dr?.Referensi === refKey || dr?.Referensi === distId || (dr?.Referensi && dr.Referensi.includes(distId)));

    if (!alreadyInDrafts) {
      drafts.push({
        ID_Draf: `DRF-DST-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 100)}`,
        Sumber: 'Distribusi',
        Tanggal: cleanDate,
        Referensi: refKey,
        Keterangan: `Penjualan ${d.Nama_Pelanggan} (Inv: ${invoiceNo})`,
        Kode_Debit: '112-10',
        Kode_Kredit: (galonNominal > 0 && galonNominal >= cupNominal && galonNominal >= botolNominal) ? '411-30' : (botolNominal > cupNominal ? '411-20' : '411-10'),
        Nominal: grandTotal,
        Status: 'Disetujui',
        Waktu_Dibuat: new Date().toISOString()
      });
      existingDraftRefs.add(refKey);
      existingDraftRefs.add(distId);
    }

    // C. Ensure Data_Piutang_Utang has entry for this invoice
    if (!existingPiutangDocIds.has(distId) && !existingPiutangDocIds.has(invoiceNo)) {
      const due = new Date(cleanDate);
      due.setDate(due.getDate() + 14);
      piutangUtang.push({
        ID_DOKUMEN: invoiceNo,
        ID_Transaksi: invoiceNo,
        Tgl_Jatuh_Tempo: due.toISOString().slice(0, 10),
        TANGGAL: cleanDate,
        Tanggal: cleanDate,
        Jenis: 'Piutang',
        TIPE: 'Piutang',
        Entitas: d.Nama_Pelanggan,
        NAMA_ENTITAS: d.Nama_Pelanggan,
        Nominal: grandTotal,
        TOTAL_TAGIHAN: grandTotal,
        Terbayar: 0,
        TOTAL_DIBAYAR: 0,
        Sisa: grandTotal,
        SISA_SALDO: grandTotal,
        Status: 'Belum Lunas',
        STATUS: 'Belum Lunas',
        Keterangan: `Faktur Penjualan Distribusi: ${d.No_Surat_Jalan || distId}`,
        No_Ref: d.No_Surat_Jalan || distId
      });
      existingPiutangDocIds.add(invoiceNo);
      existingPiutangDocIds.add(distId);
    }
  });

  // =========================================================================
  // 2. SINKRONISASI PRODUKSI (HPP Bahan Baku & Mutasi Stok Pemakaian)
  // =========================================================================
  productions.forEach(p => {
    const prodId = (p.ID_Produksi || '').trim();
    if (!prodId) return;

    const refKey = `PRD-${prodId}`;
    const cleanDate = p.Tanggal && /^\d{4}-\d{2}-\d{2}/.test(p.Tanggal) ? p.Tanggal : new Date().toISOString().slice(0, 10);
    const periode = cleanDate.slice(0, 7);
    const qty = Number(p.Jumlah) || 0;
    if (qty <= 0) return;

    // Calculate BOM material costs
    const relatedBoms = boms.filter(b => b.ID_Produk === p.ID_Produk);
    let totalHppCost = 0;

    if (relatedBoms.length > 0) {
      relatedBoms.forEach(b => {
        const mat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
        const unitPrice = Number(mat?.Harga_Satuan) || 0;
        const requiredPerDus = Number(b.Jumlah_Dibutuhkan) || 0;
        totalHppCost += (requiredPerDus * unitPrice) * qty;
      });
    }

    // Fallback: realistic standard unit HPP if BOM not defined or 0
    if (totalHppCost === 0) {
      const prod = products.find(pr => pr.ID_Produk === p.ID_Produk);
      const fallbackUnit = DEFAULT_UNIT_HPP[p.ID_Produk] || 
        (prod ? Math.round(Number(prod.Harga_Distributor || 14000) * 0.55) : 7500);
      totalHppCost = fallbackUnit * qty;
    }

    const roundedHpp = Math.round(totalHppCost);
    if (roundedHpp <= 0) return;

    // A. Add to General Journal if not yet posted
    const alreadyInJournal = existingJournalRefs.has(refKey) || 
      journals.some(j => j.REFERENSI === refKey || (j.REFERENSI && j.REFERENSI.includes(prodId)));

    if (!alreadyInJournal && autoPost) {
      const jId = getNextJournalId(cleanDate);
      const desc = `HPP Bahan Baku Produksi ${qty} unit ${p.ID_Produk} (Batch: ${prodId})`;

      // 1. Debit: HPP Beban Pemakaian Bahan Baku & Penolong (512-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: desc,
        KODE_AKUN: '512-10', // Beban Pemakaian Bahan Baku & Penolong
        DEBIT: roundedHpp,
        KREDIT: 0,
        PEMBUAT: 'Auto Sync Produksi'
      });
      countJournalsAdded++;

      // 2. Kredit: Persediaan Bahan Baku & Penolong (113-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: `Pengurangan Stok Persediaan Bahan Baku (Batch: ${prodId})`,
        KODE_AKUN: '113-10', // Persediaan Bahan Baku & Penolong
        DEBIT: 0,
        KREDIT: roundedHpp,
        PEMBUAT: 'Auto Sync Produksi'
      });
      countJournalsAdded++;

      existingJournalRefs.add(refKey);
      countProd++;
    }

    // B. Check & deduct raw materials in Mutasi_Bahan if not yet recorded
    const mutationDescKey = `Pemotongan Otomatis Produksi: ${prodId}`;
    if (!existingMutationDesc.has(mutationDescKey) && relatedBoms.length > 0) {
      relatedBoms.forEach(b => {
        const needed = qty * (Number(b.Jumlah_Dibutuhkan) || 0);
        const rawMat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
        mutations.push({
          ID_Mutasi: `MT-PRD-${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 100)}-${b.ID_Bahan}`,
          Tanggal: cleanDate,
          ID_Bahan: b.ID_Bahan,
          Nama_Bahan: rawMat?.Nama_Bahan || b.ID_Bahan,
          Jenis_Mutasi: 'Keluar',
          Kategori: 'Pemakaian Produksi',
          Qty: Math.round(needed * 100) / 100,
          Keterangan: mutationDescKey
        });
      });
      existingMutationDesc.add(mutationDescKey);
    }
  });

  // =========================================================================
  // 3. SINKRONISASI PEMBELIAN BAHAN (Persediaan & Utang Usaha Vendor)
  // =========================================================================
  purchases.forEach(pb => {
    const purchId = (pb.ID_Pembelian || '').trim();
    if (!purchId) return;

    const refKey = `PB-${purchId}`;
    const cleanDate = pb.Tanggal && /^\d{4}-\d{2}-\d{2}/.test(pb.Tanggal) ? pb.Tanggal : new Date().toISOString().slice(0, 10);
    const periode = cleanDate.slice(0, 7);
    const nominal = Math.round((Number(pb.Qty) || 0) * (Number(pb.Harga_Satuan) || 0));
    if (nominal <= 0) return;

    // A. Add to General Journal
    const alreadyInJournal = existingJournalRefs.has(refKey) || 
      journals.some(j => j.REFERENSI === refKey || (j.REFERENSI && j.REFERENSI.includes(purchId)));

    if (!alreadyInJournal && autoPost) {
      const jId = getNextJournalId(cleanDate);
      const desc = `Pembelian Bahan ${pb.Nama_Bahan || pb.ID_Bahan} (${pb.Qty} pcs) dari ${pb.Supplier || 'Supplier'}`;

      // 1. Debit: Persediaan Bahan Baku (113-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: desc,
        KODE_AKUN: '113-10', // Persediaan Bahan Baku & Penolong
        DEBIT: nominal,
        KREDIT: 0,
        PEMBUAT: 'Auto Sync Pembelian'
      });
      countJournalsAdded++;

      // 2. Kredit: Utang Usaha Supplier (211-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: `Utang Pembelian Bahan ke ${pb.Supplier || 'Supplier'} (${purchId})`,
        KODE_AKUN: '211-10', // Utang Usaha (Supplier Bahan)
        DEBIT: 0,
        KREDIT: nominal,
        PEMBUAT: 'Auto Sync Pembelian'
      });
      countJournalsAdded++;

      existingJournalRefs.add(refKey);
      countPurch++;
    }

    // B. Add to Data_Piutang_Utang as Utang
    if (!existingPiutangDocIds.has(purchId)) {
      piutangUtang.push({
        ID_DOKUMEN: purchId,
        ID_Transaksi: purchId,
        Tgl_Jatuh_Tempo: cleanDate,
        Tanggal: cleanDate,
        Jenis: 'Utang',
        TIPE: 'Utang',
        Entitas: pb.Supplier || 'Vendor Supplier',
        NAMA_ENTITAS: pb.Supplier || 'Vendor Supplier',
        Nominal: nominal,
        TOTAL_TAGIHAN: nominal,
        Terbayar: 0,
        TOTAL_DIBAYAR: 0,
        Sisa: nominal,
        SISA_SALDO: nominal,
        Status: 'Belum Lunas',
        STATUS: 'Belum Lunas',
        Keterangan: `Utang Pembelian: ${pb.Nama_Bahan || pb.ID_Bahan} (${purchId})`,
        No_Ref: purchId
      });
      existingPiutangDocIds.add(purchId);
    }
  });

  // =========================================================================
  // 4. SINKRONISASI PENGGAJIAN (Beban Gaji & Kas Bank BSI)
  // =========================================================================
  const payrollMonths = Array.from(new Set(payrolls.map(h => (h.Bulan_Tahun || '').trim()).filter(Boolean)));
  payrollMonths.forEach(mStr => {
    const refKey = `PAYROLL-${mStr}`;
    const monthItems = payrolls.filter(h => h.Bulan_Tahun === mStr);
    const totalGaji = monthItems.reduce((s, h) => s + (Number(h.Gaji_Bersih) || 0), 0);
    if (totalGaji <= 0) return;

    const cleanDate = `${mStr}-25`;
    const periode = mStr;

    const alreadyInJournal = existingJournalRefs.has(refKey) || 
      journals.some(j => j.REFERENSI === refKey);

    if (!alreadyInJournal && autoPost) {
      const jId = getNextJournalId(cleanDate);
      const desc = `Beban Penggajian Karyawan & Staf Periode ${mStr} (${monthItems.length} Karyawan)`;

      // 1. Debit: Beban Gaji Staf (611-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: desc,
        KODE_AKUN: '611-10', // Beban Gaji Staf
        DEBIT: totalGaji,
        KREDIT: 0,
        PEMBUAT: 'Auto Sync Payroll'
      });
      countJournalsAdded++;

      // 2. Kredit: Kas Bank BSI (111-20)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: `Pencairan Payroll Periode ${mStr} via Bank BSI`,
        KODE_AKUN: '111-20', // Kas Bank BSI 1607134444
        DEBIT: 0,
        KREDIT: totalGaji,
        PEMBUAT: 'Auto Sync Payroll'
      });
      countJournalsAdded++;

      existingJournalRefs.add(refKey);
      countPayroll++;
    }
  });

  // =========================================================================
  // 5. SINKRONISASI KASBON KARYAWAN (Piutang Kasbon & Kas Kecil)
  // =========================================================================
  kasbons.forEach(k => {
    const kId = (k.ID_Kasbon || '').trim();
    if (!kId) return;

    const refKey = `KSB-${kId}`;
    const cleanDate = k.Tanggal && /^\d{4}-\d{2}-\d{2}/.test(k.Tanggal) ? k.Tanggal : new Date().toISOString().slice(0, 10);
    const periode = cleanDate.slice(0, 7);
    const nominal = Number(k.Nominal) || 0;
    if (nominal <= 0) return;

    const alreadyInJournal = existingJournalRefs.has(refKey) || 
      journals.some(j => j.REFERENSI === refKey);

    if (!alreadyInJournal && autoPost) {
      const jId = getNextJournalId(cleanDate);
      const desc = `Pencairan Kasbon: ${k.Nama_Karyawan || k.ID_Karyawan} (${k.Keterangan || 'Pinjaman Operasional'})`;

      // 1. Debit: Piutang Kasbon Karyawan (112-20)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: desc,
        KODE_AKUN: '112-20', // Piutang Karyawan (Kasbon)
        DEBIT: nominal,
        KREDIT: 0,
        PEMBUAT: 'Auto Sync Kasbon'
      });
      countJournalsAdded++;

      // 2. Kredit: Kas Kecil (111-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: `Pengeluaran Kas Kecil untuk Kasbon ${k.Nama_Karyawan || k.ID_Karyawan}`,
        KODE_AKUN: '111-10', // Kas Kecil
        DEBIT: 0,
        KREDIT: nominal,
        PEMBUAT: 'Auto Sync Kasbon'
      });
      countJournalsAdded++;

      existingJournalRefs.add(refKey);
      countKasbon++;
    }
  });

  // =========================================================================
  // 6. SINKRONISASI PEMBAYARAN PELANGGAN (Kas/Bank & Pelunasan Piutang)
  // =========================================================================
  customerPayments.forEach(pay => {
    const payId = (pay.ID_Bayar || '').trim();
    if (!payId) return;

    const refKey = `PAY-${payId}`;
    const cleanDate = pay.Tanggal_Bayar && /^\d{4}-\d{2}-\d{2}/.test(pay.Tanggal_Bayar) ? pay.Tanggal_Bayar : new Date().toISOString().slice(0, 10);
    const periode = cleanDate.slice(0, 7);
    const nominal = Number(pay.Jumlah_Bayar) || 0;
    if (nominal <= 0) return;

    const alreadyInJournal = existingJournalRefs.has(refKey) || 
      journals.some(j => j.REFERENSI === refKey);

    if (!alreadyInJournal && autoPost) {
      const jId = getNextJournalId(cleanDate);
      const isCash = (pay.Metode_Bayar || '').toLowerCase().includes('tunai') || (pay.Metode_Bayar || '').toLowerCase().includes('cash');
      const cashAccount = isCash ? '111-10' : '111-20'; // Kas Kecil vs Bank BSI
      const desc = `Pembayaran Piutang dari ${pay.Nama_Pelanggan} (Ref: ${pay.No_Referensi || payId})`;

      // 1. Debit: Kas / Bank BSI
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: desc,
        KODE_AKUN: cashAccount,
        DEBIT: nominal,
        KREDIT: 0,
        PEMBUAT: 'Auto Sync Pembayaran'
      });
      countJournalsAdded++;

      // 2. Kredit: Piutang Usaha (112-10)
      journals.push({
        ID_JURNAL: jId,
        TANGGAL: cleanDate,
        PERIODE: periode,
        REFERENSI: refKey,
        KETERANGAN: `Pengurangan Piutang Pelanggan ${pay.Nama_Pelanggan}`,
        KODE_AKUN: '112-10', // Piutang Usaha
        DEBIT: 0,
        KREDIT: nominal,
        PEMBUAT: 'Auto Sync Pembayaran'
      });
      countJournalsAdded++;

      existingJournalRefs.add(refKey);
      countPayments++;
    }
  });

  // Auto-reconcile any historical journal imbalance (e.g. from previous discount calculations)
  const groupedJournals: Record<string, GeneralJournalItem[]> = {};
  journals.forEach(j => {
    if (!j.ID_JURNAL) return;
    if (!groupedJournals[j.ID_JURNAL]) groupedJournals[j.ID_JURNAL] = [];
    groupedJournals[j.ID_JURNAL].push(j);
  });

  let autoHealedCount = 0;
  Object.entries(groupedJournals).forEach(([_, entries]) => {
    const dTotal = entries.reduce((s, e) => s + (Number(e.DEBIT) || 0), 0);
    const kTotal = entries.reduce((s, e) => s + (Number(e.KREDIT) || 0), 0);
    const diff = dTotal - kTotal;
    if (Math.abs(diff) > 0.01) {
      const discountRow = entries.find(e => e.KODE_AKUN === '413-10' && (Number(e.DEBIT) || 0) > 0);
      const revenueRow = entries.find(e => e.KODE_AKUN?.startsWith('411-') && (Number(e.KREDIT) || 0) > 0);
      if (discountRow && revenueRow && Math.abs(diff - Number(discountRow.DEBIT)) < 1) {
        revenueRow.KREDIT = Number(revenueRow.KREDIT) + Number(discountRow.DEBIT);
        autoHealedCount++;
      } else if (revenueRow && diff > 0) {
        revenueRow.KREDIT = Number(revenueRow.KREDIT) + diff;
        autoHealedCount++;
      }
    }
  });

  // Save changes if new journals or records created or journals auto-healed
  if (countJournalsAdded > 0 || countDist > 0 || countProd > 0 || autoHealedCount > 0) {
    // Sanitasi dan deduplikasi draf sebelum disimpan ke storage
    const seenDraftIds = new Set<string>();
    const seenDraftComposites = new Set<string>();
    const cleanDrafts = drafts.filter(d => {
      if (!d) return false;
      const id = String(d.ID_Draf || '').trim();
      const comp = `${String(d.Referensi || '').trim()}|${String(d.Tanggal || '').trim()}|${Number(d.Nominal) || 0}|${String(d.Kode_Debit || '').trim()}|${String(d.Kode_Kredit || '').trim()}`;
      if (id && seenDraftIds.has(id)) return false;
      if (comp && seenDraftComposites.has(comp)) return false;
      if (id) seenDraftIds.add(id);
      if (comp) seenDraftComposites.add(comp);
      return true;
    });

    setTableData('Jurnal_Umum', journals);
    setTableData('Draf_Jurnal', cleanDrafts);
    setTableData('Data_Piutang_Utang', piutangUtang);
    setTableData('Mutasi_Bahan', mutations);
    notifyDbChange();
  }

  const msgParts: string[] = [];
  if (countDist > 0) msgParts.push(`${countDist} distribusi`);
  if (countProd > 0) msgParts.push(`${countProd} produksi (HPP)`);
  if (countPurch > 0) msgParts.push(`${countPurch} pembelian bahan`);
  if (countPayroll > 0) msgParts.push(`${countPayroll} periode gaji`);
  if (countKasbon > 0) msgParts.push(`${countKasbon} kasbon`);
  if (countPayments > 0) msgParts.push(`${countPayments} pembayaran piutang`);
  if (autoHealedCount > 0) msgParts.push(`${autoHealedCount} jurnal diselaraskan seimbang`);

  const summary = msgParts.length > 0 
    ? `Sinkronisasi berhasil: ${msgParts.join(', ')} (${countJournalsAdded} ayat jurnal dibukukan).`
    : 'Semua data operasional sudah tersinkronisasi rapi dengan Keuangan.';

    return {
      success: true,
      syncedDistributions: countDist,
      syncedProductions: countProd,
      syncedPurchases: countPurch,
      syncedPayrolls: countPayroll,
      syncedKasbons: countKasbon,
      syncedPayments: countPayments,
      totalJournalsAdded: countJournalsAdded,
      message: summary
    };
  } catch (syncErr: any) {
    console.warn('Finance sync warning:', syncErr);
    return {
      success: false,
      syncedDistributions: 0,
      syncedProductions: 0,
      syncedPurchases: 0,
      syncedPayrolls: 0,
      syncedKasbons: 0,
      syncedPayments: 0,
      totalJournalsAdded: 0,
      message: `Peringatan sinkronisasi keuangan: ${syncErr?.message || 'dilewati'}`
    };
  }
}

/**
 * Utilitas untuk merekonsiliasi dan menyeimbangkan seluruh ayat jurnal di Jurnal Umum
 */
export function reconcileAndBalanceJournals(): { fixedCount: number; remainingImbalanced: number; message: string } {
  try {
    const rawJournals: GeneralJournalItem[] = getTableData('Jurnal_Umum') || [];
    let fixedCount = 0;
    let remainingImbalanced = 0;

    const grouped: Record<string, GeneralJournalItem[]> = {};
    rawJournals.forEach(j => {
      if (!j.ID_JURNAL) return;
      if (!grouped[j.ID_JURNAL]) grouped[j.ID_JURNAL] = [];
      grouped[j.ID_JURNAL].push(j);
    });

    Object.entries(grouped).forEach(([_, entries]) => {
      const dTotal = entries.reduce((s, e) => s + (Number(e.DEBIT) || 0), 0);
      const kTotal = entries.reduce((s, e) => s + (Number(e.KREDIT) || 0), 0);
      const diff = dTotal - kTotal;

      if (Math.abs(diff) > 0.01) {
        const discountRow = entries.find(e => e.KODE_AKUN === '413-10' && (Number(e.DEBIT) || 0) > 0);
        const revenueRow = entries.find(e => e.KODE_AKUN?.startsWith('411-') && (Number(e.KREDIT) || 0) > 0);

        if (discountRow && revenueRow && Math.abs(diff - Number(discountRow.DEBIT)) < 1) {
          revenueRow.KREDIT = Number(revenueRow.KREDIT) + Number(discountRow.DEBIT);
          fixedCount++;
        } else if (revenueRow && diff > 0) {
          revenueRow.KREDIT = Number(revenueRow.KREDIT) + diff;
          fixedCount++;
        } else {
          remainingImbalanced++;
        }
      }
    });

    if (fixedCount > 0) {
      setTableData('Jurnal_Umum', rawJournals);
      notifyDbChange();
    }

    return {
      fixedCount,
      remainingImbalanced,
      message: fixedCount > 0 
        ? `Berhasil menyeimbangkan ${fixedCount} transaksi jurnal.${remainingImbalanced > 0 ? ` (Masih ada ${remainingImbalanced} transaksi manual yang perlu dicek).` : ' Seluruh jurnal kini seimbang 100%!'}`
        : remainingImbalanced === 0 
          ? 'Seluruh jurnal umum sudah seimbang sempurna (Debit = Kredit).'
          : `Ditemukan ${remainingImbalanced} transaksi jurnal manual yang selisih.`
    };
  } catch (err: any) {
    return {
      fixedCount: 0,
      remainingImbalanced: 0,
      message: `Gagal merekonsiliasi jurnal: ${err?.message || 'Error tidak diketahui'}`
    };
  }
}
