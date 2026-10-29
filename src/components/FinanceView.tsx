import React, { useState, useMemo } from 'react';
import { 
  Scale, FileText, CheckCircle2, AlertCircle, Plus, 
  Download, Printer, ArrowRight, Wallet, TrendingUp, 
  Calculator, Check, X, Building2, AlertTriangle, RefreshCw,
  Edit2, Trash2, FileSpreadsheet, Save, FileDown, Users, History, CreditCard, Search,
  ChevronRight, ArrowLeft, ArrowUpRight, ArrowDownLeft, Eye, ShoppingBag, Banknote, ShieldCheck,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  COAItem, GeneralJournalItem, DraftJournalItem, CashTransactionItem, 
  ReceivablePayableItem, FixedAssetItem, DistributionItem, DistributionProductDetail,
  CustomerItem, RawMaterialPurchase, CustomerPaymentRecord
} from '../types';
import { 
  getTableData, setTableData, verifyAndPostDraftJournal, upgradeCOAToFactoryStandard 
} from '../services/dbAdapter';
import { syncAllModulesToFinance, reconcileAndBalanceJournals } from '../services/financeSyncService';
import { exportDataToExcel, ExcelTemplateType } from '../services/excelService';
import { generateTableReportPDF } from '../services/pdfService';
import { showToast as showToastGlobal } from './ToastContainer';
import { confirmAction } from './ConfirmDialog';

interface FinanceViewProps {
  journals: GeneralJournalItem[];
  coas: COAItem[];
  draftJournals: DraftJournalItem[];
  assets: FixedAssetItem[];
  receivables: ReceivablePayableItem[];
  distributions?: DistributionItem[];
  distributionItems?: DistributionProductDetail[];
  customers?: CustomerItem[];
  purchases?: RawMaterialPurchase[];
  onRefresh: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  journals,
  coas,
  draftJournals,
  assets,
  receivables,
  distributions = [],
  distributionItems = [],
  customers = [],
  purchases = [],
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'neraca' | 'labarugi' | 'drafts' | 'jurnal' | 'coa' | 'aset' | 'piutang'>('neraca');

  // Filters
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [filterPeriod, setFilterPeriod] = useState<string>(defaultPeriod);
  const [searchCoa, setSearchCoa] = useState<string>('');
  // Filter bulan verifikasi draf default langsung aktif ke bulan ini agar tidak lag
  const [draftFilterMonth, setDraftFilterMonth] = useState<string>(defaultPeriod);
  const [draftSortOrder, setDraftSortOrder] = useState<'desc' | 'asc'>('desc');
  const [draftSearchQuery, setDraftSearchQuery] = useState<string>('');
  const [journalSearchQuery, setJournalSearchQuery] = useState<string>('');

  // Modals for CRUD
  const [showJournalModal, setShowJournalModal] = useState<boolean>(false);
  const [editingJournal, setEditingJournal] = useState<GeneralJournalItem | null>(null);
  const [journalForm, setJournalForm] = useState({
    ID_JURNAL: '',
    TANGGAL: new Date().toISOString().slice(0, 10),
    PERIODE: defaultPeriod,
    REFERENSI: 'MANUAL',
    KETERANGAN: '',
    KODE_AKUN: coas[0]?.KODE_AKUN || '111-10',
    DEBIT: '' as any,
    KREDIT: '' as any,
    PEMBUAT: 'Admin Finance'
  });

  const [doubleEntryForm, setDoubleEntryForm] = useState({
    ID_JURNAL: '',
    TANGGAL: new Date().toISOString().slice(0, 10),
    PERIODE: defaultPeriod,
    REFERENSI: 'MANUAL',
    KETERANGAN: '',
    KODE_DEBIT: '111-10',
    KODE_KREDIT: '111-20',
    NOMINAL: '' as any,
    PEMBUAT: 'Admin Finance'
  });

  const [showCoaModal, setShowCoaModal] = useState<boolean>(false);
  const [editingCoa, setEditingCoa] = useState<COAItem | null>(null);
  const [coaForm, setCoaForm] = useState({
    KODE_AKUN: '',
    NAMA_AKUN: '',
    KATEGORI: 'Aset Lancar',
    SALDO_NORMAL: 'Debit' as 'Debit' | 'Kredit',
    STATUS: 'Aktif' as 'Aktif' | 'Non-Aktif'
  });

  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [editingDraft, setEditingDraft] = useState<DraftJournalItem | null>(null);
  const [draftForm, setDraftForm] = useState({
    Tanggal: '',
    Sumber: '',
    Referensi: '',
    Keterangan: '',
    Kode_Debit: '',
    Kode_Kredit: '',
    Nominal: 0
  });

  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<FixedAssetItem | null>(null);
  const [assetForm, setAssetForm] = useState({
    ID_ASET: '',
    NAMA_ASET: '',
    TGL_BELI: new Date().toISOString().slice(0, 10),
    NILAI_PEROLEHAN: '' as any,
    NILAI_RESIDU: '' as any,
    UMUR_EKONOMIS_BLN: '' as any,
    BEBAN_PENYUSUTAN_BLN: '' as any,
    AKUN_ASET: '121-20',
    AKUN_AKUMULASI: '122-20',
    AKUN_BEBAN: '514-20'
  });

  const [showReceivableModal, setShowReceivableModal] = useState<boolean>(false);
  const [editingReceivable, setEditingReceivable] = useState<ReceivablePayableItem | null>(null);
  const [receivableForm, setReceivableForm] = useState({
    ID_Transaksi: '',
    Jenis: 'Piutang' as 'Piutang' | 'Utang',
    Entitas: '',
    Nominal: '' as any,
    Terbayar: 0,
    Sisa: '' as any,
    Tgl_Jatuh_Tempo: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    Status: 'Belum Lunas' as 'Belum Lunas' | 'Lunas Sebagian' | 'Lunas',
    No_Ref: ''
  });

  // State untuk sub-tab Piutang: Rekap Tagihan vs Buku Pelanggan
  const [piutangSubTab, setPiutangSubTab] = useState<'semua_tagihan' | 'pelanggan'>('pelanggan');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchCustQuery, setSearchCustQuery] = useState<string>('');
  const [custFilterStatus, setCustFilterStatus] = useState<'all' | 'piutang' | 'deposit' | 'lunas'>('all');
  const [piutangSearchQuery, setPiutangSearchQuery] = useState<string>('');
  const [piutangTypeFilter, setPiutangTypeFilter] = useState<'all' | 'Piutang' | 'Utang'>('all');

  // Modal input pembayaran pelanggan
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentForm, setPaymentForm] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    ID_Pelanggan: '',
    Nama_Pelanggan: '',
    Jumlah_Bayar: '' as any,
    Metode: 'Transfer Bank BCA',
    No_Referensi: '',
    Keterangan: ''
  });
  // Kalkulator pembelian: set ID distribusi yang dipilih untuk dilunasi & kalkulator manual parsial
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [showCalcPanel, setShowCalcPanel] = useState<boolean>(false);
  const [calcMode, setCalcMode] = useState<'invoice' | 'partial'>('invoice');
  const [partialPayItems, setPartialPayItems] = useState<{
    id: string;
    nama: string;
    satuan: string;
    harga: number;
    maxQty: number;
    payQty: number;
  }[]>([]);

  // Quick Notification Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    showToastGlobal(type === 'success' ? 'Sukses' : 'Pemberitahuan', text, type);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Load riwayat pembayaran pelanggan dari storage secara reaktif
  const [customerPayments, setCustomerPayments] = useState<CustomerPaymentRecord[]>(() => 
    getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', [])
  );

  React.useEffect(() => {
    setCustomerPayments(getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', []));
  }, [distributions, receivables]);

  // Pembersihan otomatis data duplikat di storage Draf_Jurnal (jika pernah terjadi sinkronisasi ganda)
  React.useEffect(() => {
    try {
      const rawDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
      if (!Array.isArray(rawDrafts) || rawDrafts.length === 0) return;

      const seenIds = new Set<string>();
      const seenComposites = new Set<string>();
      let hasDuplicates = false;
      const cleanDrafts: DraftJournalItem[] = [];

      for (const d of rawDrafts) {
        if (!d) continue;
        const id = String(d.ID_Draf || '').trim();
        const comp = `${String(d.Referensi || '').trim()}|${String(d.Tanggal || '').trim()}|${Number(d.Nominal) || 0}|${String(d.Kode_Debit || '').trim()}|${String(d.Kode_Kredit || '').trim()}`;

        if ((id && seenIds.has(id)) || (comp && seenComposites.has(comp))) {
          hasDuplicates = true;
          continue;
        }

        if (id) seenIds.add(id);
        if (comp) seenComposites.add(comp);
        cleanDrafts.push(d);
      }

      if (hasDuplicates) {
        setTableData('Draf_Jurnal', cleanDrafts);
        onRefresh();
      }
    } catch {
      // safe fallback
    }
  }, []);

  // -------------------------------------------------------------
  // SINKRONISASI DATA DISTRIBUSI & PEMBELIAN DENGAN PIUTANG/UTANG (MEMOIZED & INDEXED)
  // -------------------------------------------------------------
  const distItemsMap = useMemo(() => {
    const map = new Map<string, DistributionProductDetail[]>();
    (distributionItems || []).forEach(it => {
      if (!it || !it.ID_Distribusi) return;
      const key = String(it.ID_Distribusi).trim();
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(it);
    });
    return map;
  }, [distributionItems]);

  const customerPaymentsByRefMap = useMemo(() => {
    const map = new Map<string, number>();
    (customerPayments || []).forEach(p => {
      if (!p || !p.No_Referensi) return;
      const ref = String(p.No_Referensi).trim();
      const amt = Number(p.Jumlah_Bayar || 0);
      map.set(ref, (map.get(ref) || 0) + amt);
    });
    return map;
  }, [customerPayments]);

  const customerPaymentsByNameMap = useMemo(() => {
    const map = new Map<string, CustomerPaymentRecord[]>();
    (customerPayments || []).forEach(p => {
      if (!p || !p.Nama_Pelanggan) return;
      const key = String(p.Nama_Pelanggan).trim().toLowerCase();
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(p);
    });
    return map;
  }, [customerPayments]);

  // 1. Tagihan dari Distribusi (memoized)
  const distReceivables: ReceivablePayableItem[] = useMemo(() => {
    return (distributions || []).map(d => {
      let totalTagihan = Number(d.Total_Tagihan);
      if (isNaN(totalTagihan) || totalTagihan <= 0) {
        const items = distItemsMap.get(String(d.ID_Distribusi).trim()) || [];
        totalTagihan = items.reduce((sum, it) => sum + (Number(it.Subtotal) || (Number(it.Qty) * Number(it.Harga_Satuan)) || 0), 0);
      }
      totalTagihan = totalTagihan || 0;

      // Hitung pembayaran spesifik referensi distribusi ini (O(1) lookup)
      const distId = String(d.ID_Distribusi || '').trim();
      const invNo = String(d.No_Invoice || '').trim();
      const sjNo = String(d.No_Surat_Jalan || '').trim();
      const matchedPay = (customerPaymentsByRefMap.get(distId) || 0) +
        (invNo && invNo !== distId ? (customerPaymentsByRefMap.get(invNo) || 0) : 0) +
        (sjNo && sjNo !== distId && sjNo !== invNo ? (customerPaymentsByRefMap.get(sjNo) || 0) : 0);

      const tglKirim = d.Tanggal ? new Date(d.Tanggal) : new Date();
      const jatuhTempo = new Date(tglKirim.getTime() + 14 * 86400000).toISOString().slice(0, 10);
      const sisa = Math.max(0, totalTagihan - matchedPay);
      const status = sisa <= 0 ? 'Lunas' : (matchedPay > 0 ? 'Lunas Sebagian' : 'Belum Lunas');

      return {
        ID_Transaksi: d.No_Invoice || `INV-${d.No_Surat_Jalan || d.ID_Distribusi}`,
        ID_DOKUMEN: d.No_Invoice || d.ID_Distribusi,
        Jenis: 'Piutang',
        TIPE: 'Piutang',
        Tanggal: d.Tanggal,
        TANGGAL: d.Tanggal,
        Entitas: d.Nama_Pelanggan || 'Pelanggan AMDK',
        NAMA_ENTITAS: d.Nama_Pelanggan || 'Pelanggan AMDK',
        Nominal: totalTagihan,
        TOTAL_TAGIHAN: totalTagihan,
        Terbayar: matchedPay,
        TOTAL_DIBAYAR: matchedPay,
        Sisa: sisa,
        SISA_SALDO: sisa,
        Tgl_Jatuh_Tempo: jatuhTempo,
        JATUH_TEMPO: jatuhTempo,
        Status: status,
        STATUS: status,
        No_Ref: d.No_Surat_Jalan || d.ID_Distribusi
      };
    });
  }, [distributions, distItemsMap, customerPaymentsByRefMap]);

  // 2. Utang Pembelian Bahan ke Supplier (memoized)
  const purchasePayables: ReceivablePayableItem[] = useMemo(() => {
    return (purchases || []).map(p => {
      const total = Number(p.Harga_Satuan || 0) * Number(p.Qty || 0);
      const tglBeli = p.Tanggal ? new Date(p.Tanggal) : new Date();
      const jatuhTempo = new Date(tglBeli.getTime() + 30 * 86400000).toISOString().slice(0, 10);

      return {
        ID_Transaksi: p.ID_Pembelian,
        ID_DOKUMEN: p.ID_Pembelian,
        Jenis: 'Utang',
        TIPE: 'Utang',
        Tanggal: p.Tanggal,
        TANGGAL: p.Tanggal,
        Entitas: p.Supplier || 'Vendor Kemasan',
        NAMA_ENTITAS: p.Supplier || 'Vendor Kemasan',
        Nominal: total,
        TOTAL_TAGIHAN: total,
        Terbayar: 0,
        TOTAL_DIBAYAR: 0,
        Sisa: total,
        SISA_SALDO: total,
        Tgl_Jatuh_Tempo: jatuhTempo,
        JATUH_TEMPO: jatuhTempo,
        Status: 'Belum Lunas',
        STATUS: 'Belum Lunas',
        No_Ref: p.ID_Bahan
      };
    });
  }, [purchases]);

  // Gabungkan dengan piutang/utang manual yang bukan duplikat dari distribusi/pembelian (memoized with Set)
  const allReceivablesList: ReceivablePayableItem[] = useMemo(() => {
    const existingIds = new Set<string>();
    distReceivables.forEach(d => {
      if (d.ID_Transaksi) existingIds.add(d.ID_Transaksi);
      if (d.ID_DOKUMEN) existingIds.add(d.ID_DOKUMEN);
    });
    purchasePayables.forEach(p => {
      if (p.ID_Transaksi) existingIds.add(p.ID_Transaksi);
      if (p.ID_DOKUMEN) existingIds.add(p.ID_DOKUMEN);
    });

    const manual = (receivables || []).filter(r => {
      const id = r.ID_Transaksi || r.ID_DOKUMEN || '';
      return !existingIds.has(id);
    });

    return [...distReceivables, ...purchasePayables, ...manual];
  }, [distReceivables, purchasePayables, receivables]);

  // -------------------------------------------------------------
  // REKAPITULASI BUKU PEMBANTU PER PELANGGAN (PEMBELIAN, BAYAR, SALDO/DEPOSIT)
  // -------------------------------------------------------------
  interface CustomerLedgerSummary {
    idPelanggan: string;
    namaPelanggan: string;
    level: string;
    totalTagihan: number;
    totalBayar: number;
    sisaPiutang: number;
    saldoDeposit: number; // Kelebihan bayar yang menjadi saldo/deposit
    pembelianList: {
      id: string;
      tanggal: string;
      noSuratJalan: string;
      noInvoice: string;
      nominal: number;
      items: DistributionProductDetail[];
    }[];
    pembayaranList: CustomerPaymentRecord[];
  }

  // Pre-group distributions by customer name key in a single O(N) pass
  const distributionsByCustMap = useMemo(() => {
    const map = new Map<string, DistributionItem[]>();
    (distributions || []).forEach(d => {
      if (!d || !d.Nama_Pelanggan) return;
      const key = d.Nama_Pelanggan.trim().toLowerCase();
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(d);
    });
    return map;
  }, [distributions]);

  // Bangun daftar pelanggan unik dari master pelanggan dan data distribusi (memoized)
  const customerLedgers: CustomerLedgerSummary[] = useMemo(() => {
    const customerNamesMap = new Map<string, { id: string; nama: string; level: string }>();
    (customers || []).forEach(c => {
      if (c?.Nama_Pelanggan) {
        customerNamesMap.set(c.Nama_Pelanggan.trim().toLowerCase(), {
          id: c.ID_Pelanggan,
          nama: c.Nama_Pelanggan,
          level: c.Level_Pelanggan || 'Konsumen'
        });
      }
    });

    (distributions || []).forEach(d => {
      if (d?.Nama_Pelanggan) {
        const key = d.Nama_Pelanggan.trim().toLowerCase();
        if (!customerNamesMap.has(key)) {
          const generatedId = d.ID_Pelanggan || `PLG-${key.replace(/[^a-z0-9]/g, '').toUpperCase()}`;
          customerNamesMap.set(key, {
            id: generatedId,
            nama: d.Nama_Pelanggan,
            level: d.Level_Pelanggan || 'Distributor'
          });
        }
      }
    });

    return Array.from(customerNamesMap.values()).map(c => {
      const key = c.nama.trim().toLowerCase();

      // Semua transaksi pembelian/distribusi untuk pelanggan ini (O(1) Map lookup)
      const custDist = distributionsByCustMap.get(key) || [];
      const pembelianList = custDist.map(d => {
        const itms = distItemsMap.get(String(d.ID_Distribusi).trim()) || [];
        let nominal = Number(d.Total_Tagihan);
        if (isNaN(nominal) || nominal <= 0) {
          nominal = itms.reduce((s, it) => s + (Number(it.Subtotal) || (Number(it.Qty) * Number(it.Harga_Satuan)) || 0), 0);
        }
        return {
          id: d.ID_Distribusi,
          tanggal: d.Tanggal,
          noSuratJalan: d.No_Surat_Jalan || '-',
          noInvoice: d.No_Invoice || `INV-${d.No_Surat_Jalan || d.ID_Distribusi}`,
          nominal,
          items: itms
        };
      });

      const totalTagihan = pembelianList.reduce((s, p) => s + p.nominal, 0);

      // Semua transaksi pembayaran dari pelanggan ini (O(1) Map lookup)
      const pembayaranList = customerPaymentsByNameMap.get(key) || [];
      const totalBayar = pembayaranList.reduce((s, p) => s + Number(p.Jumlah_Bayar || 0), 0);

      const net = totalBayar - totalTagihan;
      const sisaPiutang = net < 0 ? Math.abs(net) : 0;
      const saldoDeposit = net > 0 ? net : 0;

      return {
        idPelanggan: c.id,
        namaPelanggan: c.nama,
        level: c.level,
        totalTagihan,
        totalBayar,
        sisaPiutang,
        saldoDeposit,
        pembelianList,
        pembayaranList
      };
    });
  }, [customers, distributions, distributionsByCustMap, distItemsMap, customerPaymentsByNameMap]);

  // -------------------------------------------------------------
  // 1. HITUNG SALDO BUKU BESAR DARI JURNAL UMUM
  // -------------------------------------------------------------
  const accountBalances: Record<string, number> = {};
  coas.forEach(c => {
    accountBalances[c.KODE_AKUN] = 0;
  });

  journals.forEach(j => {
    const code = j.KODE_AKUN;
    const debit = Number(j.DEBIT) || 0;
    const kredit = Number(j.KREDIT) || 0;
    const coa = coas.find(c => c.KODE_AKUN === code);
    const normal = coa?.SALDO_NORMAL || 'Debit';

    if (accountBalances[code] === undefined) {
      accountBalances[code] = 0;
    }

    if (normal === 'Debit') {
      accountBalances[code] += (debit - kredit);
    } else {
      accountBalances[code] += (kredit - debit);
    }
  });

  const getBalance = (code: string) => accountBalances[code] || 0;

  // -------------------------------------------------------------
  // 2. KALKULASI LAPORAN LABA RUGI (INCOME STATEMENT)
  // -------------------------------------------------------------
  const periodJournals = useMemo(() => {
    if (filterPeriod === 'all') return journals;
    return journals.filter(j => j.PERIODE === filterPeriod || j.TANGGAL?.startsWith(filterPeriod));
  }, [journals, filterPeriod]);

  // Filtered Journals for Jurnal Umum tab (pencarian teks dinamis)
  const filteredJournals = useMemo(() => {
    let list = periodJournals;
    if (journalSearchQuery.trim()) {
      const q = journalSearchQuery.toLowerCase();
      list = list.filter(j => {
        const coa = coas.find(c => c.KODE_AKUN === j.KODE_AKUN);
        const matchId = String(j.ID_JURNAL || '').toLowerCase().includes(q);
        const matchRef = String(j.REFERENSI || '').toLowerCase().includes(q);
        const matchKet = String(j.KETERANGAN || '').toLowerCase().includes(q);
        const matchAkun = String(j.KODE_AKUN || '').toLowerCase().includes(q);
        const matchNamaAkun = String(coa?.NAMA_AKUN || '').toLowerCase().includes(q);
        return matchId || matchRef || matchKet || matchAkun || matchNamaAkun;
      });
    }
    return list;
  }, [periodJournals, journalSearchQuery, coas]);

  const journalTotalDebit = useMemo(() => {
    return filteredJournals.reduce((acc, j) => acc + (Number(j.DEBIT) || 0), 0);
  }, [filteredJournals]);

  const journalTotalKredit = useMemo(() => {
    return filteredJournals.reduce((acc, j) => acc + (Number(j.KREDIT) || 0), 0);
  }, [filteredJournals]);

  const journalDiff = Math.abs(journalTotalDebit - journalTotalKredit);
  const isJournalBalanced = journalDiff < 0.01;

  // Filtered Draft Journals for Verifikasi tab (filter bulan, pencarian teks, deduplikasi & sort tanggal stabil)
  const filteredDraftJournals = useMemo(() => {
    let list = Array.isArray(draftJournals) ? draftJournals : [];
    if (draftFilterMonth !== 'all') {
      list = list.filter(d => d && d.Tanggal && String(d.Tanggal).startsWith(draftFilterMonth));
    }
    if (draftSearchQuery.trim()) {
      const q = draftSearchQuery.toLowerCase();
      list = list.filter(d => {
        if (!d) return false;
        const coaDebit = coas.find(c => c.KODE_AKUN === d.Kode_Debit);
        const coaKredit = coas.find(c => c.KODE_AKUN === d.Kode_Kredit);
        const matchRef = String(d.Referensi || '').toLowerCase().includes(q);
        const matchKet = String(d.Keterangan || '').toLowerCase().includes(q);
        const matchSumber = String(d.Sumber || '').toLowerCase().includes(q);
        const matchDebit = String(d.Kode_Debit || '').toLowerCase().includes(q) || String(coaDebit?.NAMA_AKUN || '').toLowerCase().includes(q);
        const matchKredit = String(d.Kode_Kredit || '').toLowerCase().includes(q) || String(coaKredit?.NAMA_AKUN || '').toLowerCase().includes(q);
        const matchStatus = String(d.Status || '').toLowerCase().includes(q);
        return matchRef || matchKet || matchSumber || matchDebit || matchKredit || matchStatus;
      });
    }

    // Deduplikasi ketat di level memori agar tidak pernah merender baris duplikat
    const seenIds = new Set<string>();
    const seenComposites = new Set<string>();
    const uniqueList: DraftJournalItem[] = [];

    for (const item of list) {
      if (!item) continue;
      const id = String(item.ID_Draf || '').trim();
      const comp = `${String(item.Referensi || '').trim()}|${String(item.Tanggal || '').trim()}|${Number(item.Nominal) || 0}|${String(item.Kode_Debit || '').trim()}|${String(item.Kode_Kredit || '').trim()}`;

      if (id && seenIds.has(id)) continue;
      if (comp && seenComposites.has(comp)) continue;

      if (id) seenIds.add(id);
      if (comp) seenComposites.add(comp);
      uniqueList.push(item);
    }

    // Sort berdasarkan Tanggal Transaksi (Kuat & Stabil: Terbaru ↔ Terlama)
    return uniqueList.sort((a, b) => {
      const parseTime = (tglStr?: string) => {
        if (!tglStr) return 0;
        const clean = String(tglStr).trim();
        const t = new Date(clean).getTime();
        return isNaN(t) ? 0 : t;
      };

      const timeA = parseTime(a.Tanggal);
      const timeB = parseTime(b.Tanggal);

      if (timeA !== timeB) {
        return draftSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // Jika tanggal identik, bandingkan string tanggal secara leksikal
      const cmpStr = String(a.Tanggal || '').localeCompare(String(b.Tanggal || ''));
      if (cmpStr !== 0) {
        return draftSortOrder === 'asc' ? cmpStr : -cmpStr;
      }

      // Sub-urutan sekunder berdasarkan ID_Draf / Waktu_Dibuat
      const wA = String(a.Waktu_Dibuat || a.ID_Draf || '');
      const wB = String(b.Waktu_Dibuat || b.ID_Draf || '');
      return draftSortOrder === 'asc' ? wA.localeCompare(wB) : wB.localeCompare(wA);
    });
  }, [draftJournals, draftFilterMonth, draftSearchQuery, draftSortOrder, coas]);
  const periodBalances: Record<string, number> = {};
  periodJournals.forEach(j => {
    const code = j.KODE_AKUN;
    const debit = Number(j.DEBIT) || 0;
    const kredit = Number(j.KREDIT) || 0;
    const coa = coas.find(c => c.KODE_AKUN === code);
    const normal = coa?.SALDO_NORMAL || 'Debit';

    if (periodBalances[code] === undefined) periodBalances[code] = 0;
    if (normal === 'Debit') periodBalances[code] += (debit - kredit);
    else periodBalances[code] += (kredit - debit);
  });

  const getPeriodBal = (code: string) => periodBalances[code] || 0;

  // Pendapatan Operasional
  const revCup = getPeriodBal('411-10');
  const revBotol = getPeriodBal('411-20');
  const revGalon = getPeriodBal('411-30');
  const totalRevKotor = revCup + revBotol + revGalon;
  const diskonPenjualan = getPeriodBal('413-10');
  const totalRevBersih = totalRevKotor - diskonPenjualan;

  // HPP
  const hppBahan = getPeriodBal('512-10');
  const hppTenagaKerja = getPeriodBal('513-10');
  const hppListrikPabrik = getPeriodBal('514-10');
  const hppSusutMesin = getPeriodBal('514-20');
  const totalHPP = hppBahan + hppTenagaKerja + hppListrikPabrik + hppSusutMesin;
  const labaKotor = totalRevBersih - totalHPP;

  // Beban Operasional & Administrasi
  const bebanGajiStaff = getPeriodBal('611-10');
  const bebanPemasaran = getPeriodBal('611-20');
  const bebanDistribusiArmada = getPeriodBal('611-30');
  const bebanQCSNI = getPeriodBal('611-40');
  const bebanSusutKendaraan = getPeriodBal('611-70');
  const totalBebanOperasional = bebanGajiStaff + bebanPemasaran + bebanDistribusiArmada + bebanQCSNI + bebanSusutKendaraan;
  const labaBersihOperasional = labaKotor - totalBebanOperasional;

  // -------------------------------------------------------------
  // 3. KALKULASI LAPORAN NERACA (BALANCE SHEET)
  // -------------------------------------------------------------
  // Aktiva Lancar
  const kasKecil = getBalance('111-10');
  const kasBankBSI = getBalance('111-20');
  const kasBankBRI = getBalance('111-21');
  const piutangUsaha = getBalance('112-10');
  const piutangKasbon = getBalance('112-20');
  const persediaanBahan = getBalance('113-10');
  const persediaanBarangJadi = getBalance('113-30');
  const totalAktivaLancar = kasKecil + kasBankBSI + kasBankBRI + piutangUsaha + piutangKasbon + persediaanBahan + persediaanBarangJadi;

  // Aktiva Tetap
  const tanahBangunan = getBalance('121-10');
  const mesinProduksi = getBalance('121-20');
  const kendaraanArmada = getBalance('121-30');
  const totalAsetTetapBruto = tanahBangunan + mesinProduksi + kendaraanArmada;

  // Kontra Aset
  const akumSusutMesin = getBalance('122-20');
  const akumSusutKendaraan = getBalance('122-30');
  const totalAkumulasiPenyusutan = akumSusutMesin + akumSusutKendaraan;
  const totalAktivaTetapNetto = totalAsetTetapBruto - totalAkumulasiPenyusutan;
  const totalAktiva = totalAktivaLancar + totalAktivaTetapNetto;

  // Kewajiban Jangka Pendek
  const utangUsahaSupplier = getBalance('211-10');
  const utangGaji = getBalance('212-10');
  const utangBPJSPajak = getBalance('212-20');
  const totalKewajibanPendek = utangUsahaSupplier + utangGaji + utangBPJSPajak;

  // Kewajiban Jangka Panjang
  const utangBank = getBalance('221-10');
  const totalKewajiban = totalKewajibanPendek + utangBank;

  // Ekuitas
  const modalDisetor = getBalance('311-10');
  const labaDitahan = getBalance('312-10');
  const labaTahunBerjalan = labaBersihOperasional;
  const totalEkuitas = modalDisetor + labaDitahan + labaTahunBerjalan;

  const totalPasiva = totalKewajiban + totalEkuitas;
  const selisihNeraca = Math.abs(totalAktiva - totalPasiva);
  const isBalance = selisihNeraca < 1;

  // -------------------------------------------------------------
  // DRAFT VERIFICATION HANDLERS
  // -------------------------------------------------------------
  const handleVerifyDraft = (id: string) => {
    const res = verifyAndPostDraftJournal(id, 'Admin Finance');
    if (res.success) {
      showToast('success', res.message);
      onRefresh();
    } else {
      showToast('error', res.message);
    }
  };

  const handleBulkVerifyDrafts = () => {
    const pending = draftJournals.filter(d => d.Status === 'Menunggu Verifikasi');
    if (pending.length === 0) return;
    let count = 0;
    pending.forEach(d => {
      const res = verifyAndPostDraftJournal(d.ID_Draf, 'Admin Finance');
      if (res.success) count++;
    });
    showToast('success', `${count} draf jurnal berhasil disetujui & dibukukan sekaligus.`);
    onRefresh();
  };

  const handleSyncAllModules = () => {
    const res = syncAllModulesToFinance({ autoPostToGeneralJournal: true });
    showToast('success', res.message);
    onRefresh();
  };

  const handleResetFactoryCoa = async () => {
    const ok = await confirmAction({
      title: 'Terapkan Standar COA Pabrik',
      message: 'Muat seluruh bagan akun standar manufaktur (Persediaan Bahan, HPP, Tenaga Kerja Langsung, Biaya Overhead Pabrik, Aset Tetap, dll.)? Akun yang sudah ada akan diselaraskan tanpa menghapus kustomisasi Anda.',
      confirmText: 'Ya, Terapkan Standar',
      cancelText: 'Batal',
      type: 'info'
    });
    if (!ok) return;
    const res = upgradeCOAToFactoryStandard(false);
    showToast('success', `Berhasil menerapkan ${res.totalAccounts} akun standar akuntansi manufaktur (${res.addedCount} akun baru ditambahkan).`);
    onRefresh();
  };

  const handleDeleteDraft = async (id: string) => {
    const ok = await confirmAction({
      title: 'Hapus Draf Jurnal',
      message: `Hapus draf jurnal ${id}? Transaksi ini tidak akan dibukukan ke Jurnal Umum.`,
      confirmText: 'Ya, Hapus Draf',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;
    const updated = draftJournals.filter(d => d.ID_Draf !== id);
    setTableData('Draf_Jurnal', updated);
    showToast('success', `Draf jurnal ${id} telah dihapus.`);
    onRefresh();
  };

  const handleOpenEditDraft = (draft: DraftJournalItem) => {
    setEditingDraft(draft);
    setDraftForm({
      Tanggal: draft.Tanggal,
      Sumber: draft.Sumber,
      Referensi: draft.Referensi,
      Keterangan: draft.Keterangan,
      Kode_Debit: draft.Kode_Debit,
      Kode_Kredit: draft.Kode_Kredit,
      Nominal: draft.Nominal
    });
    setShowDraftModal(true);
  };

  const handleSaveDraft = () => {
    if (!editingDraft) return;
    const updated = draftJournals.map(d => d.ID_Draf === editingDraft.ID_Draf ? {
      ...d,
      Tanggal: draftForm.Tanggal,
      Sumber: draftForm.Sumber,
      Referensi: draftForm.Referensi,
      Keterangan: draftForm.Keterangan,
      Kode_Debit: draftForm.Kode_Debit,
      Kode_Kredit: draftForm.Kode_Kredit,
      Nominal: Number(draftForm.Nominal) || 0
    } : d);
    setTableData('Draf_Jurnal', updated);
    setShowDraftModal(false);
    setEditingDraft(null);
    showToast('success', 'Draf jurnal berhasil diperbarui.');
    onRefresh();
  };

  // -------------------------------------------------------------
  // JURNAL UMUM CRUD & DOUBLE-ENTRY
  // -------------------------------------------------------------
  const handleOpenAddJournal = () => {
    setEditingJournal(null);
    const d = new Date();
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `JUR-${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
    let maxSeq = 0;
    journals.forEach(j => {
      if (j.ID_JURNAL && j.ID_JURNAL.startsWith(prefix)) {
        const num = parseInt(j.ID_JURNAL.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    const newId = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;

    setDoubleEntryForm({
      ID_JURNAL: newId,
      TANGGAL: d.toISOString().slice(0, 10),
      PERIODE: period,
      REFERENSI: 'MANUAL',
      KETERANGAN: '',
      KODE_DEBIT: coas[0]?.KODE_AKUN || '111-10',
      KODE_KREDIT: coas.find(c => c.KODE_AKUN === '111-20')?.KODE_AKUN || coas[1]?.KODE_AKUN || '111-20',
      NOMINAL: '' as any,
      PEMBUAT: 'Admin Finance'
    });
    setShowJournalModal(true);
  };

  const handleOpenEditJournal = (j: GeneralJournalItem) => {
    setEditingJournal(j);
    setJournalForm({
      ID_JURNAL: j.ID_JURNAL,
      TANGGAL: j.TANGGAL,
      PERIODE: j.PERIODE,
      REFERENSI: j.REFERENSI,
      KETERANGAN: j.KETERANGAN,
      KODE_AKUN: j.KODE_AKUN,
      DEBIT: Number(j.DEBIT) || 0,
      KREDIT: Number(j.KREDIT) || 0,
      PEMBUAT: j.PEMBUAT || 'Admin Finance'
    });
    setShowJournalModal(true);
  };

  const handleSaveJournal = () => {
    if (editingJournal) {
      const updated = journals.map(j => (j.ID_JURNAL === editingJournal.ID_JURNAL && j.KODE_AKUN === editingJournal.KODE_AKUN && j.TANGGAL === editingJournal.TANGGAL) ? {
        ...j,
        TANGGAL: journalForm.TANGGAL,
        PERIODE: journalForm.PERIODE || (journalForm.TANGGAL ? journalForm.TANGGAL.slice(0, 7) : defaultPeriod),
        REFERENSI: journalForm.REFERENSI,
        KETERANGAN: journalForm.KETERANGAN,
        KODE_AKUN: journalForm.KODE_AKUN,
        DEBIT: Number(journalForm.DEBIT) || 0,
        KREDIT: Number(journalForm.KREDIT) || 0,
        PEMBUAT: journalForm.PEMBUAT || 'Admin Finance'
      } : j);
      setTableData('Jurnal_Umum', updated);
      showToast('success', 'Entri jurnal berhasil diperbarui.');
    } else {
      const nominal = Number(doubleEntryForm.NOMINAL) || 0;
      if (nominal <= 0) {
        showToast('warning', 'Nominal transaksi harus lebih besar dari 0.');
        return;
      }
      if (doubleEntryForm.KODE_DEBIT === doubleEntryForm.KODE_KREDIT) {
        showToast('warning', 'Akun Debit dan Akun Kredit tidak boleh sama.');
        return;
      }
      if (!doubleEntryForm.KETERANGAN.trim()) {
        showToast('warning', 'Keterangan transaksi wajib diisi.');
        return;
      }

      const period = doubleEntryForm.TANGGAL ? doubleEntryForm.TANGGAL.slice(0, 7) : defaultPeriod;
      const debitRow: GeneralJournalItem = {
        ID_JURNAL: doubleEntryForm.ID_JURNAL,
        TANGGAL: doubleEntryForm.TANGGAL,
        PERIODE: period,
        REFERENSI: doubleEntryForm.REFERENSI || 'MANUAL',
        KETERANGAN: doubleEntryForm.KETERANGAN,
        KODE_AKUN: doubleEntryForm.KODE_DEBIT,
        DEBIT: nominal,
        KREDIT: 0,
        PEMBUAT: doubleEntryForm.PEMBUAT || 'Admin Finance'
      };

      const creditRow: GeneralJournalItem = {
        ID_JURNAL: doubleEntryForm.ID_JURNAL,
        TANGGAL: doubleEntryForm.TANGGAL,
        PERIODE: period,
        REFERENSI: doubleEntryForm.REFERENSI || 'MANUAL',
        KETERANGAN: doubleEntryForm.KETERANGAN,
        KODE_AKUN: doubleEntryForm.KODE_KREDIT,
        DEBIT: 0,
        KREDIT: nominal,
        PEMBUAT: doubleEntryForm.PEMBUAT || 'Admin Finance'
      };

      setTableData('Jurnal_Umum', [...journals, debitRow, creditRow]);
      showToast('success', 'Transaksi jurnal berpasangan (Double-Entry) berhasil dibukukan secara seimbang.');
    }
    setShowJournalModal(false);
    setEditingJournal(null);
    onRefresh();
  };

  const handleDeleteJournal = async (item: GeneralJournalItem) => {
    const relatedEntries = journals.filter(j => j.ID_JURNAL === item.ID_JURNAL);
    const isMulti = relatedEntries.length > 1;

    const ok = await confirmAction({
      title: isMulti ? 'Hapus Seluruh Transaksi Jurnal' : 'Hapus Baris Jurnal',
      message: isMulti 
        ? `Hapus seluruh transaksi "${item.ID_JURNAL}" sebanyak ${relatedEntries.length} baris berpasangan agar pembukuan tetap seimbang?`
        : `Hapus baris jurnal "${item.ID_JURNAL}" dengan akun ${item.KODE_AKUN}?`,
      confirmText: 'Ya, Hapus Jurnal',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Jurnal': item.ID_JURNAL,
        'Keterangan': item.KETERANGAN || '-',
        'Baris Akun': `${relatedEntries.length} baris`,
        'Total Nominal': `Rp ${relatedEntries.reduce((s, r) => s + (Number(r.DEBIT) || 0), 0).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    // Hapus seluruh baris dengan ID_JURNAL yang sama agar saldo tetap seimbang!
    const updated = journals.filter(j => j.ID_JURNAL !== item.ID_JURNAL);
    setTableData('Jurnal_Umum', updated);
    showToast('success', `Seluruh transaksi jurnal ${item.ID_JURNAL} telah dihapus.`);
    onRefresh();
  };

  const handleReconcileJournals = () => {
    const res = reconcileAndBalanceJournals();
    if (res.fixedCount > 0) {
      showToast('success', res.message);
    } else {
      showToast('info', res.message);
    }
    onRefresh();
  };

  // -------------------------------------------------------------
  // COA CRUD
  // -------------------------------------------------------------
  const handleOpenAddCoa = () => {
    setEditingCoa(null);
    setCoaForm({
      KODE_AKUN: '',
      NAMA_AKUN: '',
      KATEGORI: 'Aset Lancar',
      SALDO_NORMAL: 'Debit',
      STATUS: 'Aktif'
    });
    setShowCoaModal(true);
  };

  const handleOpenEditCoa = (c: COAItem) => {
    setEditingCoa(c);
    setCoaForm({
      KODE_AKUN: c.KODE_AKUN,
      NAMA_AKUN: c.NAMA_AKUN,
      KATEGORI: c.KATEGORI,
      SALDO_NORMAL: c.SALDO_NORMAL,
      STATUS: c.STATUS
    });
    setShowCoaModal(true);
  };

  const handleSaveCoa = () => {
    if (editingCoa) {
      const updated = coas.map(c => c.KODE_AKUN === editingCoa.KODE_AKUN ? {
        ...c,
        NAMA_AKUN: coaForm.NAMA_AKUN,
        KATEGORI: coaForm.KATEGORI,
        SALDO_NORMAL: coaForm.SALDO_NORMAL,
        STATUS: coaForm.STATUS
      } : c);
      setTableData('Master_COA', updated);
      showToast('success', 'Akun COA berhasil diperbarui.');
    } else {
      if (!coaForm.KODE_AKUN || !coaForm.NAMA_AKUN) {
        showToast('error', 'Mohon lengkapi kode dan nama akun COA!');
        return;
      }
      setTableData('Master_COA', [...coas, coaForm]);
      showToast('success', 'Akun COA baru berhasil didaftarkan.');
    }
    setShowCoaModal(false);
    setEditingCoa(null);
    onRefresh();
  };

  const handleDeleteCoa = async (code: string) => {
    const coa = coas.find(c => c.KODE_AKUN === code);
    const ok = await confirmAction({
      title: 'Hapus Akun COA',
      message: `Hapus akun "${code} - ${coa?.NAMA_AKUN || ''}"? Pastikan tidak ada transaksi aktif pada akun ini.`,
      confirmText: 'Ya, Hapus Akun',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'Kode Akun': code,
        'Nama Akun': coa?.NAMA_AKUN || '-',
        'Kategori': coa?.KATEGORI || '-'
      }
    });
    if (!ok) return;

    const updated = coas.filter(c => c.KODE_AKUN !== code);
    setTableData('Master_COA', updated);
    showToast('success', `Akun ${code} berhasil dihapus.`);
    onRefresh();
  };

  // -------------------------------------------------------------
  // ASET TETAP CRUD
  // -------------------------------------------------------------
  const handleOpenAddAsset = () => {
    setEditingAsset(null);
    setAssetForm({
      ID_ASET: `AST-${String(assets.length + 1).padStart(3, '0')}`,
      NAMA_ASET: '',
      TGL_BELI: new Date().toISOString().slice(0, 10),
      NILAI_PEROLEHAN: '' as any,
      NILAI_RESIDU: '' as any,
      UMUR_EKONOMIS_BLN: '' as any,
      BEBAN_PENYUSUTAN_BLN: '' as any,
      AKUN_ASET: '121-20',
      AKUN_AKUMULASI: '122-20',
      AKUN_BEBAN: '514-20'
    });
    setShowAssetModal(true);
  };

  const handleOpenEditAsset = (a: FixedAssetItem) => {
    setEditingAsset(a);
    setAssetForm({
      ID_ASET: a.ID_ASET,
      NAMA_ASET: a.NAMA_ASET,
      TGL_BELI: a.TGL_BELI,
      NILAI_PEROLEHAN: a.NILAI_PEROLEHAN,
      NILAI_RESIDU: a.NILAI_RESIDU,
      UMUR_EKONOMIS_BLN: a.UMUR_EKONOMIS_BLN,
      BEBAN_PENYUSUTAN_BLN: a.BEBAN_PENYUSUTAN_BLN,
      AKUN_ASET: a.AKUN_ASET,
      AKUN_AKUMULASI: a.AKUN_AKUMULASI,
      AKUN_BEBAN: a.AKUN_BEBAN
    });
    setShowAssetModal(true);
  };

  const handleSaveAsset = () => {
    if (editingAsset) {
      const updated = assets.map(a => a.ID_ASET === editingAsset.ID_ASET ? { ...assetForm } : a);
      setTableData('Data_Aset_Tetap', updated);
      showToast('success', 'Data aset tetap berhasil diperbarui.');
    } else {
      setTableData('Data_Aset_Tetap', [...assets, assetForm]);
      showToast('success', 'Aset tetap baru berhasil didaftarkan.');
    }
    setShowAssetModal(false);
    setEditingAsset(null);
    onRefresh();
  };

  const handleDeleteAsset = async (id: string) => {
    const asset = assets.find(a => a.ID_ASET === id);
    const ok = await confirmAction({
      title: 'Hapus Aset Tetap',
      message: `Hapus catatan inventaris aset tetap "${asset?.NAMA_ASET || id}"?`,
      confirmText: 'Ya, Hapus Aset',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'ID Aset': id,
        'Nama Aset': asset?.NAMA_ASET || '-',
        'Nilai Perolehan': `Rp ${(asset?.NILAI_PEROLEHAN || 0).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const updated = assets.filter(a => a.ID_ASET !== id);
    setTableData('Data_Aset_Tetap', updated);
    showToast('success', `Aset ${id} telah dihapus.`);
    onRefresh();
  };

  // -------------------------------------------------------------
  // PIUTANG / UTANG CRUD - WITH FIXED ROBUST DATA NORMALIZATION!
  // Prevents the white-screen bug!
  // -------------------------------------------------------------
  const handleOpenAddReceivable = () => {
    setEditingReceivable(null);
    setReceivableForm({
      ID_Transaksi: `PU-${Date.now().toString().slice(-6)}`,
      Jenis: 'Piutang',
      Entitas: '',
      Nominal: '' as any,
      Terbayar: 0,
      Sisa: '' as any,
      Tgl_Jatuh_Tempo: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      Status: 'Belum Lunas',
      No_Ref: ''
    });
    setShowReceivableModal(true);
  };

  const handleOpenEditReceivable = (item: ReceivablePayableItem) => {
    setEditingReceivable(item);
    const nominal = Number(item.Nominal ?? item.TOTAL_TAGIHAN ?? 0);
    const terbayar = Number(item.Terbayar ?? item.TOTAL_DIBAYAR ?? 0);
    const sisa = Number(item.Sisa ?? item.SISA_SALDO ?? (nominal - terbayar));

    setReceivableForm({
      ID_Transaksi: item.ID_Transaksi || item.ID_DOKUMEN || `PU-${Date.now()}`,
      Jenis: (item.Jenis || item.TIPE || 'Piutang') as any,
      Entitas: item.Entitas || item.NAMA_ENTITAS || '',
      Nominal: nominal,
      Terbayar: terbayar,
      Sisa: sisa,
      Tgl_Jatuh_Tempo: item.Tgl_Jatuh_Tempo || item.JATUH_TEMPO || new Date().toISOString().slice(0, 10),
      Status: (item.Status || item.STATUS || 'Belum Lunas') as any,
      No_Ref: item.No_Ref || item.ID_DOKUMEN || ''
    });
    setShowReceivableModal(true);
  };

  const handleSaveReceivable = () => {
    const nominal = Number(receivableForm.Nominal) || 0;
    const terbayar = Number(receivableForm.Terbayar) || 0;
    const sisa = Math.max(0, nominal - terbayar);
    const status = sisa <= 0 ? 'Lunas' : (terbayar > 0 ? 'Lunas Sebagian' : 'Belum Lunas');

    const id = receivableForm.ID_Transaksi || `PU-${Date.now().toString().slice(-6)}`;

    // Store with both legacy and new field names so nothing can ever fail!
    const payload: ReceivablePayableItem = {
      ID_Transaksi: id,
      ID_DOKUMEN: id,
      Jenis: receivableForm.Jenis,
      TIPE: receivableForm.Jenis,
      Entitas: receivableForm.Entitas,
      NAMA_ENTITAS: receivableForm.Entitas,
      Nominal: nominal,
      TOTAL_TAGIHAN: nominal,
      Terbayar: terbayar,
      TOTAL_DIBAYAR: terbayar,
      Sisa: sisa,
      SISA_SALDO: sisa,
      Tgl_Jatuh_Tempo: receivableForm.Tgl_Jatuh_Tempo,
      JATUH_TEMPO: receivableForm.Tgl_Jatuh_Tempo,
      Status: status as any,
      STATUS: status as any,
      Tanggal: new Date().toISOString().slice(0, 10),
      TANGGAL: new Date().toISOString().slice(0, 10)
    };

    if (editingReceivable) {
      const editId = editingReceivable.ID_Transaksi || editingReceivable.ID_DOKUMEN;
      const updated = receivables.map(r => (r.ID_Transaksi === editId || r.ID_DOKUMEN === editId) ? payload : r);
      setTableData('Data_Piutang_Utang', updated);
      showToast('success', 'Catatan piutang/utang diperbarui.');
    } else {
      setTableData('Data_Piutang_Utang', [...receivables, payload]);
      showToast('success', 'Catatan piutang/utang baru ditambahkan.');
    }
    setShowReceivableModal(false);
    setEditingReceivable(null);
    onRefresh();
  };

  const handleDeleteReceivable = async (id: string) => {
    const rec = receivables.find(r => r.ID_Transaksi === id || r.ID_DOKUMEN === id);
    const ok = await confirmAction({
      title: 'Hapus Catatan Tagihan / Utang',
      message: `Hapus catatan "${rec?.Jenis || 'transaksi'}" untuk mitra "${rec?.Entitas || id}"?`,
      confirmText: 'Ya, Hapus Tagihan',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Transaksi': id,
        'Mitra': rec?.Entitas || '-',
        'Jenis': rec?.Jenis || '-',
        'Sisa Tagihan': `Rp ${(rec?.Sisa || rec?.Nominal || 0).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const updated = receivables.filter(r => r.ID_Transaksi !== id && r.ID_DOKUMEN !== id);
    setTableData('Data_Piutang_Utang', updated);
    showToast('success', `Catatan ${id} telah dihapus.`);
    onRefresh();
  };

  // -------------------------------------------------------------
  // CUSTOMER PAYMENT HANDLERS
  // -------------------------------------------------------------
  const initPartialItems = (custName: string) => {
    const ledger = customerLedgers.find(c => c.namaPelanggan.trim().toLowerCase() === custName.trim().toLowerCase());
    if (!ledger) {
      setPartialPayItems([]);
      return;
    }
    const map = new Map<string, { id: string; nama: string; satuan: string; harga: number; maxQty: number; payQty: number }>();
    ledger.pembelianList.forEach(inv => {
      inv.items.forEach(it => {
        const k = it.ID_Produk || it.Nama_Produk;
        const exist = map.get(k);
        const qty = Number(it.Qty) || 0;
        const harga = Number(it.Harga_Satuan) || 0;
        if (exist) {
          exist.maxQty += qty;
          if (harga > 0) exist.harga = harga;
        } else {
          map.set(k, {
            id: k,
            nama: it.Nama_Produk,
            satuan: it.Satuan || 'Dus',
            harga: harga,
            maxQty: qty,
            payQty: 0
          });
        }
      });
    });
    setPartialPayItems(Array.from(map.values()));
  };

  const handleOpenAddPayment = (cust?: { id: string; nama: string }) => {
    const defaultCust = cust || (customers[0] ? { id: customers[0].ID_Pelanggan, nama: customers[0].Nama_Pelanggan } : { id: '', nama: '' });
    setPaymentForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      ID_Pelanggan: defaultCust.id,
      Nama_Pelanggan: defaultCust.nama,
      Jumlah_Bayar: '' as any,
      Metode: 'Transfer Bank BCA',
      No_Referensi: '',
      Keterangan: ''
    });
    setSelectedInvoiceIds(new Set());
    setCalcMode('invoice');
    setShowCalcPanel(false);
    if (defaultCust.nama) {
      initPartialItems(defaultCust.nama);
    } else {
      setPartialPayItems([]);
    }
    setShowPaymentModal(true);
  };

  const handleSavePayment = () => {
    if (!paymentForm.Nama_Pelanggan) {
      showToast('error', 'Mohon pilih nama pelanggan!');
      return;
    }
    const jumlah = Number(paymentForm.Jumlah_Bayar) || 0;
    if (jumlah <= 0) {
      showToast('error', 'Jumlah pembayaran harus lebih dari 0!');
      return;
    }

    const currentPayments = getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', []);
    const newPayId = `PAY-${Date.now().toString().slice(-6)}`;

    const newPayment: CustomerPaymentRecord = {
      ID_Pembayaran: newPayId,
      Tanggal: paymentForm.Tanggal,
      ID_Pelanggan: paymentForm.ID_Pelanggan,
      Nama_Pelanggan: paymentForm.Nama_Pelanggan,
      Jumlah_Bayar: jumlah,
      Metode: paymentForm.Metode,
      No_Referensi: paymentForm.No_Referensi || undefined,
      Keterangan: paymentForm.Keterangan || undefined,
      Waktu_Input: new Date().toISOString()
    };

    const updated = [...currentPayments, newPayment];
    setTableData('Data_Pembayaran_Pelanggan', updated);
    setCustomerPayments(updated);
    showToast('success', `Pembayaran Rp ${jumlah.toLocaleString('id-ID')} untuk ${paymentForm.Nama_Pelanggan} berhasil dicatat!`);
    setShowPaymentModal(false);
    onRefresh();
  };

  const handleDeletePayment = async (payId: string) => {
    const pay = customerPayments.find(p => p.ID_Pembayaran === payId);
    const ok = await confirmAction({
      title: 'Hapus Catatan Pembayaran',
      message: `Hapus catatan pembayaran masuk "${payId}" dari pelanggan "${pay?.Nama_Pelanggan || 'pelanggan'}"?`,
      confirmText: 'Ya, Hapus Pembayaran',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Pembayaran': payId,
        'Pelanggan': pay?.Nama_Pelanggan || '-',
        'Jumlah Bayar': `Rp ${(pay?.Jumlah_Bayar || 0).toLocaleString('id-ID')}`,
        'Tanggal': pay?.Tanggal || '-'
      }
    });
    if (!ok) return;

    const currentPayments = getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', []);
    const updated = currentPayments.filter(p => p.ID_Pembayaran !== payId);
    setTableData('Data_Pembayaran_Pelanggan', updated);
    setCustomerPayments(updated);
    showToast('success', `Catatan pembayaran ${payId} telah dihapus.`);
    onRefresh();
  };

  // PDF Export Handlers for Finance Tabs
  const handleExportNeracaPDF = () => {
    const headers = ['Komponen Laporan', 'Golongan Akun', 'Saldo Terkini (Rp)'];
    const rows = [
      ['Kas Kecil (Petty Cash)', 'Aset Lancar', `Rp ${kasKecil.toLocaleString('id-ID')}`],
      ['Kas Bank BSI 1607134444', 'Aset Lancar', `Rp ${kasBankBSI.toLocaleString('id-ID')}`],
      ['Kas Bank BRI', 'Aset Lancar', `Rp ${kasBankBRI.toLocaleString('id-ID')}`],
      ['Piutang Usaha', 'Aset Lancar', `Rp ${piutangUsaha.toLocaleString('id-ID')}`],
      ['Persediaan Bahan & Produk', 'Aset Lancar', `Rp ${(persediaanBahan + persediaanBarangJadi).toLocaleString('id-ID')}`],
      ['TOTAL AKTIVA LANCAR', 'SUBTOTAL', `Rp ${totalAktivaLancar.toLocaleString('id-ID')}`],
      ['Aset Tetap & Mesin (Netto)', 'Aset Tetap', `Rp ${totalAktivaTetapNetto.toLocaleString('id-ID')}`],
      ['TOTAL AKTIVA PERUSAHAAN', 'TOTAL', `Rp ${totalAktiva.toLocaleString('id-ID')}`],
      ['Utang Usaha & Jangka Pendek', 'Kewajiban', `Rp ${totalKewajibanPendek.toLocaleString('id-ID')}`],
      ['Utang Bank Jangka Panjang', 'Kewajiban', `Rp ${utangBank.toLocaleString('id-ID')}`],
      ['Modal Disetor & Laba Ditahan', 'Ekuitas', `Rp ${(modalDisetor + labaDitahan).toLocaleString('id-ID')}`],
      ['Laba Tahun Berjalan (Laba Rugi)', 'Ekuitas', `Rp ${labaTahunBerjalan.toLocaleString('id-ID')}`],
      ['TOTAL PASIVA (KEWAJIBAN & EKUITAS)', 'TOTAL', `Rp ${totalPasiva.toLocaleString('id-ID')}`]
    ];
    generateTableReportPDF({
      title: 'LAPORAN POSISI KEUANGAN (NERACA)',
      subtitle: `Periode: ${filterPeriod} | PT. Anugerah Illahi Rabbi`,
      headers,
      rows,
      filename: `Neraca_AIRIS_${filterPeriod}.pdf`
    });
  };

  const handleExportLabaRugiPDF = () => {
    const headers = ['Pos Laba Rugi', 'Keterangan', 'Nominal (Rp)'];
    const rows = [
      ['Pendapatan Penjualan Air Cup', 'Operasional', `Rp ${revCup.toLocaleString('id-ID')}`],
      ['Pendapatan Penjualan Air Botol', 'Operasional', `Rp ${revBotol.toLocaleString('id-ID')}`],
      ['Pendapatan Penjualan Galon', 'Operasional', `Rp ${revGalon.toLocaleString('id-ID')}`],
      ['Diskon Ekspedisi Ambil Sendiri', 'Potongan', `-Rp ${diskonPenjualan.toLocaleString('id-ID')}`],
      ['TOTAL PENDAPATAN BERSIH', 'SUBTOTAL', `Rp ${totalRevBersih.toLocaleString('id-ID')}`],
      ['HPP Bahan Baku & Kemasan', 'Harga Pokok', `Rp ${hppBahan.toLocaleString('id-ID')}`],
      ['HPP Tenaga Kerja Langsung', 'Harga Pokok', `Rp ${hppTenagaKerja.toLocaleString('id-ID')}`],
      ['HPP Listrik & Daya Pabrik', 'Harga Pokok', `Rp ${hppListrikPabrik.toLocaleString('id-ID')}`],
      ['TOTAL HARGA POKOK PENJUALAN', 'SUBTOTAL', `Rp ${totalHPP.toLocaleString('id-ID')}`],
      ['LABA KOTOR (GROSS PROFIT)', 'SUBTOTAL', `Rp ${labaKotor.toLocaleString('id-ID')}`],
      ['Beban Gaji Staf Kantor', 'Operasional', `Rp ${bebanGajiStaff.toLocaleString('id-ID')}`],
      ['Beban Pemasaran & Operasional', 'Operasional', `Rp ${bebanPemasaran.toLocaleString('id-ID')}`],
      ['Beban Bahan Bakar & Armada', 'Operasional', `Rp ${bebanDistribusiArmada.toLocaleString('id-ID')}`],
      ['Beban Pengujian Lab QC SNI', 'Operasional', `Rp ${bebanQCSNI.toLocaleString('id-ID')}`],
      ['TOTAL BEBAN OPERASIONAL', 'SUBTOTAL', `Rp ${totalBebanOperasional.toLocaleString('id-ID')}`],
      ['LABA BERSIH BERJALAN', 'HASIL AKHIR', `Rp ${labaBersihOperasional.toLocaleString('id-ID')}`]
    ];
    generateTableReportPDF({
      title: 'LAPORAN LABA RUGI OPERASIONAL',
      subtitle: `Periode: ${filterPeriod} | PT. Anugerah Illahi Rabbi`,
      headers,
      rows,
      filename: `Laba_Rugi_${filterPeriod}.pdf`
    });
  };

  const handleExportPiutangPDF = () => {
    if (piutangSubTab === 'pelanggan') {
      const headers = ['Nama Pelanggan', 'Level', 'Total Pembelian', 'Total Bayar', 'Sisa Piutang', 'Saldo Deposit', 'Status'];
      const rows = customerLedgers.map(c => [
        c.namaPelanggan,
        c.level,
        `Rp ${c.totalTagihan.toLocaleString('id-ID')}`,
        `Rp ${c.totalBayar.toLocaleString('id-ID')}`,
        `Rp ${c.sisaPiutang.toLocaleString('id-ID')}`,
        `Rp ${c.saldoDeposit.toLocaleString('id-ID')}`,
        c.sisaPiutang > 0 ? 'Ada Piutang' : (c.saldoDeposit > 0 ? 'Lebih Bayar (Deposit)' : 'Lunas')
      ]);

      generateTableReportPDF({
        title: 'BUKU PEMBANTU PIUTANG PER PELANGGAN & SALDO DEPOSIT',
        subtitle: `PT. Anugerah Illahi Rabbi - Posisi Tagihan & Saldo Pelanggan`,
        headers,
        rows,
        filename: `Buku_Piutang_Per_Pelanggan.pdf`
      });
      return;
    }

    const headers = ['ID Dokumen', 'Jenis', 'Mitra / Entitas', 'Total Tagihan', 'Terbayar', 'Sisa', 'Jatuh Tempo', 'Status'];
    const rows = allReceivablesList.map(r => {
      const id = r.ID_Transaksi || r.ID_DOKUMEN || '-';
      const jenis = r.Jenis || r.TIPE || 'Piutang';
      const entitas = r.Entitas || r.NAMA_ENTITAS || '-';
      const nom = Number(r.Nominal ?? r.TOTAL_TAGIHAN ?? 0);
      const bayar = Number(r.Terbayar ?? r.TOTAL_DIBAYAR ?? 0);
      const sisa = Number(r.Sisa ?? r.SISA_SALDO ?? (nom - bayar));
      const tempo = r.Tgl_Jatuh_Tempo || r.JATUH_TEMPO || '-';
      const stat = r.Status || r.STATUS || 'Belum Lunas';
      return [id, jenis, entitas, `Rp ${nom.toLocaleString('id-ID')}`, `Rp ${bayar.toLocaleString('id-ID')}`, `Rp ${sisa.toLocaleString('id-ID')}`, tempo, stat];
    });

    generateTableReportPDF({
      title: 'DAFTAR TAGIHAN PIUTANG & UTANG USAHA (SINKRON)',
      subtitle: `PT. Anugerah Illahi Rabbi - Sinkronisasi Distribusi & Pembelian`,
      headers,
      rows,
      filename: `Buku_Piutang_Utang_Sinkron.pdf`
    });
  };

  return (
    <div className="space-y-5 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div 
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            toastMsg.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'
          }`}
        >
          {toastMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-200 no-print w-full min-w-0">
        {/* Baris 1: Judul dan Tombol Aksi Global */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Scale className="text-blue-600 shrink-0" size={22} />
              <span className="truncate">Keuangan &amp; Akuntansi Terpadu</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Pembukuan Double-Entry otomatis, Verifikasi Jurnal, Neraca, Laba Rugi, Aset Tetap, dan Piutang Usaha.
            </p>
          </div>

          {/* Global Finance Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Universal Working Print Button */}
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
              title="Cetak Halaman (Print)"
            >
              <Printer size={16} />
            </button>

            {/* Universal PDF Export Button */}
            <button
              onClick={() => {
                if (activeTab === 'neraca') handleExportNeracaPDF();
                else if (activeTab === 'labarugi') handleExportLabaRugiPDF();
                else if (activeTab === 'piutang') handleExportPiutangPDF();
                else {
                  generateTableReportPDF({
                    title: `LAPORAN KEUANGAN (${activeTab.toUpperCase()})`,
                    subtitle: `Periode: ${filterPeriod} | PT. Anugerah Illahi Rabbi`,
                    headers: ['Deskripsi', 'Nilai'],
                    rows: [['Laporan Keuangan Resmi', 'Tercatat']],
                    filename: `Keuangan_${activeTab}.pdf`
                  });
                }
              }}
              className="p-2 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
              title="Download PDF Laporan"
            >
              <FileDown size={16} />
            </button>

            {/* Tombol Sinkronisasi Otomatis Semua Modul ke Keuangan */}
            <button
              onClick={handleSyncAllModules}
              className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Sinkronkan Otomatis Seluruh Transaksi Distribusi, Produksi, dan Pembelian ke Keuangan"
            >
              <RefreshCw size={14} className="text-emerald-600" />
              <span>Sinkron Otomatis</span>
            </button>
          </div>
        </div>

        {/* Baris 2: Navigasi Tab Horizontal yang Responsif & Mandiri */}
        <div className="w-full min-w-0 max-w-full overflow-x-auto no-scrollbar py-0.5">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium no-print shrink-0">
            <button
              onClick={() => setActiveTab('neraca')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'neraca' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laporan Neraca
            </button>
            <button
              onClick={() => setActiveTab('labarugi')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'labarugi' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laba Rugi
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'drafts' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Verifikasi Jurnal</span>
              {draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                  {draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('jurnal')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'jurnal' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jurnal Umum
            </button>
            <button
              onClick={() => setActiveTab('coa')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'coa' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Master COA
            </button>
            <button
              onClick={() => setActiveTab('aset')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'aset' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Aset Tetap
            </button>
            <button
              onClick={() => setActiveTab('piutang')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'piutang' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Piutang &amp; Utang
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. TAB: LAPORAN NERACA (BALANCE SHEET)                    */}
      {/* ========================================================= */}
      {activeTab === 'neraca' && (
        <div className="space-y-5 w-full min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs no-print w-full min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Periode Neraca:</label>
              <input
                type="month"
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  const dataRows = [
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Kas Kecil', Saldo: kasKecil },
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Kas Bank BSI', Saldo: kasBankBSI },
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Piutang Usaha', Saldo: piutangUsaha },
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Persediaan', Saldo: persediaanBahan + persediaanBarangJadi },
                    { Kategori: 'TOTAL AKTIVA', Akun: 'Total Aktiva', Saldo: totalAktiva },
                    { Kategori: 'TOTAL PASIVA', Akun: 'Total Kewajiban & Modal', Saldo: totalPasiva }
                  ];
                  exportDataToExcel(dataRows, 'Laporan_Neraca', `AIRIS_Neraca_${filterPeriod}`);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportNeracaPDF}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileDown size={14} />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Cetak Neraca</span>
              </button>
            </div>
          </div>

          {/* Balance Indicator Status */}
          <div className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print w-full min-w-0 ${
            isBalance 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
              {isBalance ? (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="min-w-0">
                <span className="font-bold text-xs uppercase tracking-wide block truncate">
                  Status Keseimbangan Neraca (Balance Verification)
                </span>
                <span className="text-xs text-slate-700 block break-words mt-0.5">
                  {isBalance 
                    ? 'NERACA SEIMBANG (BALANCED): Total Aktiva sama persis dengan Total Pasiva.' 
                    : `PERINGATAN SELISIH: Terdapat perbedaan Rp ${selisihNeraca.toLocaleString('id-ID')} antara Aktiva dan Pasiva.`}
                </span>
              </div>
            </div>
            <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Nilai Neraca</span>
              <span className="text-sm font-mono font-black text-slate-900">Rp {totalAktiva.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* T-Account Balance Sheet Paper Display */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm text-slate-900 print:border-none print:shadow-none print:p-0 printable-content">
            <div className="text-center pb-6 border-b-2 border-slate-900">
              <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide">PT. ANUGERAH ILLAHI RABBI</h2>
              <h3 className="text-sm font-bold text-slate-800 uppercase mt-1">LAPORAN POSISI KEUANGAN (NERACA)</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Per {filterPeriod}-30 (Berdasarkan Standar SAK EMKM)</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
              {/* SISI KIRI: AKTIVA */}
              <div className="space-y-6">
                <div className="border-b border-slate-300 pb-1.5">
                  <h3 className="text-sm font-bold text-blue-900 tracking-tight uppercase">AKTIVA (ASET PERUSAHAAN)</h3>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Aset Lancar</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kas Kecil (Petty Cash Pabrik)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kasKecil.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kas Bank BSI 1607134444</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kasBankBSI.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kas Bank BRI Operasional</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kasBankBRI.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Piutang Usaha (Toko & Mitra)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {piutangUsaha.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Piutang Kasbon Karyawan</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {piutangKasbon.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Persediaan Bahan Baku & Penolong</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {persediaanBahan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Persediaan Barang Jadi (Air Minum)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {persediaanBarangJadi.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Aset Lancar</span>
                      <span className="font-mono tabular-nums">Rp {totalAktivaLancar.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Aset Tetap</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Tanah & Bangunan Pabrik</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {tanahBangunan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Mesin Produksi & Water Treatment</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {mesinProduksi.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kendaraan Armada Distribusi</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kendaraanArmada.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                      <span>Akumulasi Penyusutan Mesin & Armada</span>
                      <span className="font-mono tabular-nums font-semibold">(Rp {totalAkumulasiPenyusutan.toLocaleString('id-ID')})</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Nilai Buku Aset Tetap</span>
                      <span className="font-mono tabular-nums">Rp {totalAktivaTetapNetto.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center text-sm font-black text-blue-950">
                  <span>TOTAL AKTIVA</span>
                  <span className="font-mono tabular-nums text-base">Rp {totalAktiva.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* SISI KANAN: PASIVA */}
              <div className="space-y-6">
                <div className="border-b border-slate-300 pb-1.5">
                  <h3 className="text-sm font-bold text-blue-900 tracking-tight uppercase">PASIVA (KEWAJIBAN & EKUITAS)</h3>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Liabilitas Jangka Pendek</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang Usaha (Supplier Bahan)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangUsahaSupplier.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang Gaji & Upah Karyawan</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangGaji.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang BPJS & Pajak PPh 21</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangBPJSPajak.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Liabilitas Pendek</span>
                      <span className="font-mono tabular-nums">Rp {totalKewajibanPendek.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Liabilitas Jangka Panjang</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang Bank Jangka Panjang</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangBank.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Kewajiban</span>
                      <span className="font-mono tabular-nums">Rp {totalKewajiban.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Ekuitas</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Modal Disetor Pemilik</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {modalDisetor.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Laba Ditahan (Retained Earnings)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {labaDitahan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-indigo-700">
                      <span>Laba Tahun Berjalan (Laba Rugi)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {labaTahunBerjalan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Ekuitas</span>
                      <span className="font-mono tabular-nums">Rp {totalEkuitas.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center text-sm font-black text-blue-950">
                  <span>TOTAL PASIVA</span>
                  <span className="font-mono tabular-nums text-base">Rp {totalPasiva.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TAB: VERIFIKASI DRAF JURNAL                            */}
      {/* ========================================================= */}
      {activeTab === 'drafts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Antrean Verifikasi Pembukuan (Staging)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 font-mono">
                  {filteredDraftJournals.length} Draf
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap transaksi dapat diedit atau dihapus sebelum disetujui untuk dibukukan resmi ke Jurnal Umum.
              </p>
            </div>
            {draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length > 0 && (
              <button
                onClick={handleBulkVerifyDrafts}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check size={14} />
                <span>Setujui Semua Draf ({draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length})</span>
              </button>
            )}
          </div>

          {/* Search, Month Filter & Sort Bar untuk Draf Jurnal */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Referensi, Keterangan, Akun, Modul..."
                  value={draftSearchQuery}
                  onChange={e => setDraftSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
                />
                {draftSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDraftSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Bulan (Default Aktif ke Bulan Ini) */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px] hidden sm:inline">Periode:</span>
                <input
                  type="month"
                  value={draftFilterMonth === 'all' ? '' : draftFilterMonth}
                  onChange={e => setDraftFilterMonth(e.target.value || 'all')}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  title="Pilih Bulan Spesifik untuk Verifikasi Draf"
                />
                {draftFilterMonth !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setDraftFilterMonth('all')}
                    className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                    title="Tampilkan seluruh data tanpa batasan bulan"
                  >
                    Semua Periode
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDraftFilterMonth(defaultPeriod)}
                    className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                    title="Kembali ke filter bulan ini untuk performa lebih cepat"
                  >
                    Bulan Ini ({defaultPeriod})
                  </button>
                )}
                {draftFilterMonth !== 'all' && draftFilterMonth !== defaultPeriod && (
                  <button
                    type="button"
                    onClick={() => setDraftFilterMonth(defaultPeriod)}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                    title="Kembali ke bulan ini"
                  >
                    Bulan Ini
                  </button>
                )}
              </div>

              {/* Tombol Sort Tanggal */}
              <button
                type="button"
                onClick={() => setDraftSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                title={draftSortOrder === 'desc' ? 'Urutan saat ini: Terbaru ke Terlama. Klik untuk Terlama ke Terbaru' : 'Urutan saat ini: Terlama ke Terbaru. Klik untuk Terbaru ke Terlama'}
              >
                <ArrowUpDown size={13} className="text-blue-600" />
                <span className="hidden md:inline text-slate-500">Urut:</span>
                <span className="font-semibold text-slate-800">
                  {draftSortOrder === 'desc' ? 'Terbaru → Terlama' : 'Terlama → Terbaru'}
                </span>
              </button>
            </div>

            {(draftSearchQuery || draftFilterMonth !== defaultPeriod) && (
              <button
                type="button"
                onClick={() => {
                  setDraftSearchQuery('');
                  setDraftFilterMonth(defaultPeriod);
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <X size={12} />
                <span>Reset ke Bulan Ini ({filteredDraftJournals.length} Hasil)</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th 
                      className="p-3 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                      onClick={() => setDraftSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Klik untuk mengubah urutan tanggal transaksi (Terlama ↔ Terbaru)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Waktu / Tgl</span>
                        <span className="p-0.5 rounded text-blue-600 bg-blue-50">
                          {draftSortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        </span>
                      </div>
                    </th>
                    <th className="p-3">Sumber Modul</th>
                    <th className="p-3">Referensi</th>
                    <th className="p-3">Keterangan Transaksi</th>
                    <th className="p-3">Akun Debit</th>
                    <th className="p-3">Akun Kredit</th>
                    <th className="p-3 text-right">Nominal</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi Verifikasi & Modifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDraftJournals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-slate-500 italic">
                            {draftSearchQuery || draftFilterMonth !== 'all'
                              ? `Tidak ada draf jurnal yang sesuai dengan filter ${draftFilterMonth !== 'all' ? `periode (${draftFilterMonth})` : ''} ${draftSearchQuery ? `kata kunci "${draftSearchQuery}"` : ''}.`
                              : 'Belum ada draf jurnal transaksi. Transaksi operasional baru akan otomatis masuk ke antrean ini.'}
                          </p>
                          {draftFilterMonth !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setDraftFilterMonth('all')}
                              className="px-3 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                            >
                              Tampilkan Semua Periode ({draftJournals.length} total draf)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDraftJournals.map((d, dIdx) => {
                      const coaDebit = coas.find(c => c.KODE_AKUN === d.Kode_Debit);
                      const coaKredit = coas.find(c => c.KODE_AKUN === d.Kode_Kredit);
                      return (
                        <tr key={`draft-row-${d.ID_Draf || 'item'}-${dIdx}`} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono">{d.Tanggal}</td>
                          <td className="p-3 font-medium">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                              {d.Sumber}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] font-semibold text-slate-700">{d.Referensi}</td>
                          <td className="p-3 max-w-xs">{d.Keterangan}</td>
                          <td className="p-3 font-mono text-[11px] text-emerald-700">
                            {d.Kode_Debit} ({coaDebit?.NAMA_AKUN || 'Debit'})
                          </td>
                          <td className="p-3 font-mono text-[11px] text-blue-700">
                            {d.Kode_Kredit} ({coaKredit?.NAMA_AKUN || 'Kredit'})
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            Rp {d.Nominal.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              d.Status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.Status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {d.Status === 'Menunggu Verifikasi' && (
                                <button
                                  onClick={() => handleVerifyDraft(d.ID_Draf)}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs cursor-pointer"
                                  title="Posting Jurnal Resmi"
                                >
                                  Posting
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditDraft(d)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Draf"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(d.ID_Draf)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Draf"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. TAB: LAPORAN LABA RUGI                                 */}
      {/* ========================================================= */}
      {activeTab === 'labarugi' && (
        <div className="space-y-5 w-full min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs no-print w-full min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Periode:</label>
              <input
                type="month"
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => exportDataToExcel(periodJournals, 'Laba_Rugi', `AIRIS_LabaRugi_${filterPeriod}`)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportLabaRugiPDF}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileDown size={14} />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Cetak Laporan</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto shadow-sm text-slate-900 print:border-none print:shadow-none printable-content">
            <div className="text-center pb-6 border-b-2 border-slate-900">
              <h2 className="text-lg font-black text-blue-900 uppercase">PT. ANUGERAH ILLAHI RABBI</h2>
              <h3 className="text-sm font-bold text-slate-800 uppercase mt-1">LAPORAN LABA RUGI OPERASIONAL</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Periode: {filterPeriod}</p>
            </div>

            <div className="py-6 space-y-6 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 border-b border-slate-200 pb-1">1. PENDAPATAN OPERASIONAL</h4>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penjualan Kemasan Cup (120ml / 220ml)</span>
                    <span className="font-mono font-semibold">Rp {revCup.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penjualan Kemasan Botol (330ml / 600ml)</span>
                    <span className="font-mono font-semibold">Rp {revBotol.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penjualan Galon 19L</span>
                    <span className="font-mono font-semibold">Rp {revGalon.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                    <span>Potongan / Diskon Ekspedisi</span>
                    <span className="font-mono font-semibold">(Rp {diskonPenjualan.toLocaleString('id-ID')})</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>TOTAL PENDAPATAN BERSIH</span>
                    <span className="font-mono tabular-nums">Rp {totalRevBersih.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 border-b border-slate-200 pb-1">2. HARGA POKOK PENJUALAN (HPP)</h4>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Beban Pemakaian Bahan Baku & Penolong (BOM)</span>
                    <span className="font-mono font-semibold">Rp {hppBahan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Biaya Tenaga Kerja Langsung Pabrik</span>
                    <span className="font-mono font-semibold">Rp {hppTenagaKerja.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Biaya Daya & Listrik Pabrik</span>
                    <span className="font-mono font-semibold">Rp {hppListrikPabrik.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Biaya Penyusutan Mesin Produksi</span>
                    <span className="font-mono font-semibold">Rp {hppSusutMesin.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>TOTAL BEBAN POKOK (HPP)</span>
                    <span className="font-mono tabular-nums">Rp {totalHPP.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs font-bold text-slate-900">
                <span>LABA KOTOR (GROSS PROFIT)</span>
                <span className="font-mono tabular-nums text-sm">Rp {labaKotor.toLocaleString('id-ID')}</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 border-b border-slate-200 pb-1">3. BEBAN OPERASIONAL & UMUM</h4>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Gaji Staf & Manajemen Kantor</span>
                    <span className="font-mono font-semibold">Rp {bebanGajiStaff.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Beban Pemasaran & Operasional</span>
                    <span className="font-mono font-semibold">Rp {bebanPemasaran.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Bahan Bakar & Distribusi Armada</span>
                    <span className="font-mono font-semibold">Rp {bebanDistribusiArmada.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Uji Laboratorium & Sertifikasi QC (SNI)</span>
                    <span className="font-mono font-semibold">Rp {bebanQCSNI.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penyusutan Kendaraan & Inventaris</span>
                    <span className="font-mono font-semibold">Rp {bebanSusutKendaraan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>TOTAL BEBAN OPERASIONAL</span>
                    <span className="font-mono tabular-nums">Rp {totalBebanOperasional.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl flex justify-between items-center text-sm font-black border ${
                labaBersihOperasional >= 0 ? 'bg-emerald-50 text-emerald-950 border-emerald-200' : 'bg-red-50 text-red-950 border-red-200'
              }`}>
                <span>LABA BERSIH BERJALAN (NET PROFIT)</span>
                <span className="font-mono tabular-nums text-lg">Rp {labaBersihOperasional.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. TAB: JURNAL UMUM (DENGAN TAMBAH, EDIT & HAPUS)         */}
      {/* ========================================================= */}
      {activeTab === 'jurnal' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700">Filter Periode:</label>
                {filterPeriod === 'all' ? (
                  <span className="px-3 py-1.5 text-xs font-mono font-bold bg-blue-100 text-blue-800 rounded-lg border border-blue-300">
                    Semua Periode (All-Time)
                  </span>
                ) : (
                  <input
                    type="month"
                    value={filterPeriod}
                    onChange={e => setFilterPeriod(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {filterPeriod !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setFilterPeriod('all')}
                    className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                    title="Tampilkan seluruh data tanpa batasan bulan"
                  >
                    Semua Periode
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilterPeriod(defaultPeriod)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 cursor-pointer transition-colors"
                    title="Kembali ke filter bulan ini"
                  >
                    Bulan Ini
                  </button>
                )}
              </div>

              {/* Search Bar Jurnal Umum */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari ID Jurnal, Ref, Keterangan, Akun..."
                  value={journalSearchQuery}
                  onChange={e => setJournalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                {journalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setJournalSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {journalSearchQuery && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  {filteredJournals.length} baris cocok
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportDataToExcel(filteredJournals, 'Jurnal_Umum', `AIRIS_Jurnal_${filterPeriod}`, `JURNAL UMUM TRANSAKSI - PERIODE ${filterPeriod}`)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => {
                  const headers = ['Tanggal', 'ID Jurnal', 'Referensi', 'Keterangan', 'Akun', 'Debit', 'Kredit'];
                  const rows = filteredJournals.map(j => [j.TANGGAL, j.ID_JURNAL, j.REFERENSI, j.KETERANGAN, j.KODE_AKUN, j.DEBIT, j.KREDIT]);
                  generateTableReportPDF({
                    title: 'JURNAL UMUM TRANSAKSI',
                    subtitle: `Periode ${filterPeriod}`,
                    headers,
                    rows,
                    filename: `Jurnal_${filterPeriod}.pdf`
                  });
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileDown size={14} />
                <span>PDF</span>
              </button>
              <button
                onClick={handleOpenAddJournal}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Tambah Jurnal Manual</span>
              </button>
            </div>
          </div>

          {/* Card Ringkasan Keseimbangan Jurnal (Double-Entry Balance Indicator) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Debit ({filterPeriod === 'all' ? 'Semua' : filterPeriod})</span>
              <span className="text-lg font-black text-slate-900 font-mono">Rp {journalTotalDebit.toLocaleString('id-ID')}</span>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Kredit ({filterPeriod === 'all' ? 'Semua' : filterPeriod})</span>
              <span className="text-lg font-black text-slate-900 font-mono">Rp {journalTotalKredit.toLocaleString('id-ID')}</span>
            </div>
            <div className={`p-3.5 rounded-lg border shadow-2xs flex flex-col justify-between ${
              isJournalBalanced 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                : 'bg-red-50/80 border-red-200 text-red-950'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">Status Pembukuan</span>
                {isJournalBalanced ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={13} /> SEIMBANG (BALANCED)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                    <AlertTriangle size={13} /> SELISIH Rp {journalDiff.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-600">
                  {isJournalBalanced 
                    ? 'Debit dan Kredit 100% cocok presisi.' 
                    : 'Terdapat selisih antara Debit dan Kredit.'}
                </span>
                {!isJournalBalanced && (
                  <button
                    onClick={handleReconcileJournals}
                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-2xs flex items-center gap-1 cursor-pointer"
                    title="Perbaiki dan seimbangkan transaksi jurnal secara otomatis"
                  >
                    <RefreshCw size={11} /> Seimbangkan
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">ID Jurnal</th>
                    <th className="p-3">No. Ref</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3">Kode Akun</th>
                    <th className="p-3 text-right">Debit (Rp)</th>
                    <th className="p-3 text-right">Kredit (Rp)</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic">
                        {journalSearchQuery 
                          ? `Tidak ada entri jurnal yang cocok dengan kata kunci "${journalSearchQuery}" pada periode ${filterPeriod}.`
                          : `Tidak ada entri jurnal pada periode ${filterPeriod}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map((j, i) => {
                      const coa = coas.find(c => c.KODE_AKUN === j.KODE_AKUN);
                      const isCredit = Number(j.KREDIT) > 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="p-3 text-slate-500">{j.TANGGAL}</td>
                          <td className="p-3 font-semibold text-blue-700">{j.ID_JURNAL}</td>
                          <td className="p-3 text-slate-700">{j.REFERENSI}</td>
                          <td className={`p-3 font-sans ${isCredit ? 'pl-8 text-slate-600' : 'font-medium text-slate-900'}`}>
                            {j.KETERANGAN}
                          </td>
                          <td className="p-3 text-slate-700">
                            {j.KODE_AKUN} <span className="font-sans text-[11px] text-slate-400">({coa?.NAMA_AKUN})</span>
                          </td>
                          <td className="p-3 text-right tabular-nums font-semibold text-slate-900">
                            {Number(j.DEBIT) > 0 ? Number(j.DEBIT).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="p-3 text-right tabular-nums font-semibold text-slate-900">
                            {Number(j.KREDIT) > 0 ? Number(j.KREDIT).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="p-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditJournal(j)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Baris Jurnal"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteJournal(j)}
                                className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Baris Jurnal"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={5} className="p-3 text-right font-sans font-bold text-slate-700 uppercase tracking-wider">
                      TOTAL ({filteredJournals.length} Baris):
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-950 text-sm font-black">
                      Rp {journalTotalDebit.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-950 text-sm font-black">
                      Rp {journalTotalKredit.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center font-sans">
                      {isJournalBalanced ? (
                        <span className="inline-flex items-center text-emerald-600 font-bold text-[11px]" title="Seimbang">
                          <CheckCircle2 size={15} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-bold text-[11px]" title="Selisih">
                          <AlertTriangle size={15} />
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB: BAGAN AKUN (COA)                                  */}
      {/* ========================================================= */}
      {activeTab === 'coa' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bagan Akun Standar Manufaktur (Master COA)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Seluruh akun dapat diedit, dihapus, atau ditambah akun baru sesuai kebutuhan.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cari kode / nama akun..."
                value={searchCoa}
                onChange={e => setSearchCoa(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none w-52"
              />
              <button
                onClick={handleResetFactoryCoa}
                className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                title="Terapkan Seluruh Bagan Akun Standar Akuntansi Pabrik & Manufaktur"
              >
                <RefreshCw size={14} className="text-emerald-600" />
                <span>Terapkan Standar Pabrik</span>
              </button>
              <button
                onClick={handleOpenAddCoa}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus size={14} />
                <span>Tambah Akun COA</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Kode Akun</th>
                    <th className="p-3">Nama Akun</th>
                    <th className="p-3">Kategori Laporan</th>
                    <th className="p-3">Saldo Normal</th>
                    <th className="p-3 text-right">Saldo Terkini</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {coas
                    .filter(c => 
                      c.KODE_AKUN.toLowerCase().includes(searchCoa.toLowerCase()) ||
                      c.NAMA_AKUN.toLowerCase().includes(searchCoa.toLowerCase())
                    )
                    .map(c => {
                      const bal = getBalance(c.KODE_AKUN);
                      return (
                        <tr key={c.KODE_AKUN} className="hover:bg-slate-50/70">
                          <td className="p-3 font-bold text-blue-800">{c.KODE_AKUN}</td>
                          <td className="p-3 font-sans font-medium text-slate-900">{c.NAMA_AKUN}</td>
                          <td className="p-3 font-sans text-slate-600">{c.KATEGORI}</td>
                          <td className="p-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              c.SALDO_NORMAL === 'Debit' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {c.SALDO_NORMAL}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                            Rp {bal.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center font-sans">
                            <span className="text-emerald-700 font-medium text-[11px]">{c.STATUS}</span>
                          </td>
                          <td className="p-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditCoa(c)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Akun"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCoa(c.KODE_AKUN)}
                                className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Akun"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB: ASET TETAP & PENYUSUTAN                           */}
      {/* ========================================================= */}
      {activeTab === 'aset' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Aktiva Tetap & Jadwal Penyusutan</h3>
              <p className="text-xs text-slate-500 mt-0.5">Pencatatan aset mesin, armada, dan fasilitas pabrik AMDK.</p>
            </div>
            <button
              onClick={handleOpenAddAsset}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah Aset Tetap</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">ID Aset</th>
                    <th className="p-3">Nama Aktiva</th>
                    <th className="p-3">Tgl Perolehan</th>
                    <th className="p-3 text-right">Nilai Perolehan</th>
                    <th className="p-3 text-right">Nilai Residu</th>
                    <th className="p-3 text-center">Umur (Bln)</th>
                    <th className="p-3 text-right">Susut / Bln</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {assets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic font-sans">
                        Belum ada aset tetap yang dicatat.
                      </td>
                    </tr>
                  ) : (
                    assets.map(a => (
                      <tr key={a.ID_ASET} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-blue-800">{a.ID_ASET}</td>
                        <td className="p-3 font-sans font-semibold text-slate-900">{a.NAMA_ASET}</td>
                        <td className="p-3 text-slate-500">{a.TGL_BELI}</td>
                        <td className="p-3 text-right font-bold text-slate-900 tabular-nums">Rp {a.NILAI_PEROLEHAN.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-right tabular-nums text-slate-600">Rp {a.NILAI_RESIDU.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center">{a.UMUR_EKONOMIS_BLN} Bln</td>
                        <td className="p-3 text-right font-bold text-red-600 tabular-nums">Rp {a.BEBAN_PENYUSUTAN_BLN.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleOpenEditAsset(a)} className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="Edit Aset">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDeleteAsset(a.ID_ASET)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Hapus Aset">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB: PIUTANG & UTANG REKAP - SINKRONISASI DISTRIBUSI & BUKU PELANGGAN */}
      {/* ========================================================= */}
      {activeTab === 'piutang' && (
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Buku Pembantu Piutang & Utang Usaha</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                  Sinkron Distribusi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring tagihan penjualan dari Modul Distribusi, kewajiban vendor, dan riwayat pembayaran pelanggan dengan saldo deposit otomatis.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportPiutangPDF}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                title="Export Laporan PDF"
              >
                <FileDown size={14} />
                <span>Unduh PDF</span>
              </button>
              <button
                onClick={() => handleOpenAddPayment()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Catat Pembayaran Masuk dari Pelanggan"
              >
                <CreditCard size={14} />
                <span>Catat Bayar Pelanggan</span>
              </button>
              <button
                onClick={handleOpenAddReceivable}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Tambah Piutang/Utang Manual"
              >
                <Plus size={14} />
                <span>Tambah Manual</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">Total Piutang Berjalan</span>
                <span className="p-1 rounded bg-red-50 text-red-600"><TrendingUp size={14} /></span>
              </div>
              <div className="text-lg font-bold text-red-600 font-mono tabular-nums">
                Rp {customerLedgers.reduce((s, c) => s + c.sisaPiutang, 0).toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Dari {customerLedgers.filter(c => c.sisaPiutang > 0).length} pelanggan berpiutang
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">Total Utang Supplier</span>
                <span className="p-1 rounded bg-amber-50 text-amber-700"><Building2 size={14} /></span>
              </div>
              <div className="text-lg font-bold text-amber-800 font-mono tabular-nums">
                Rp {allReceivablesList.filter(r => (r.Jenis || r.TIPE) === 'Utang').reduce((s, r) => s + Number(r.Sisa ?? 0), 0).toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Kewajiban bahan baku & vendor
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">Total Pembayaran Masuk</span>
                <span className="p-1 rounded bg-blue-50 text-blue-600"><Wallet size={14} /></span>
              </div>
              <div className="text-lg font-bold text-blue-700 font-mono tabular-nums">
                Rp {customerPayments.reduce((s, p) => s + Number(p.Jumlah_Bayar || 0), 0).toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {customerPayments.length} transaksi pembayaran tercatat
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-800 text-xs mb-1">
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Saldo Lebih Bayar (Deposit)
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">Deposit</span>
              </div>
              <div className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                Rp {customerLedgers.reduce((s, c) => s + c.saldoDeposit, 0).toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                Kelebihan bayar milik {customerLedgers.filter(c => c.saldoDeposit > 0).length} pelanggan
              </div>
            </div>
          </div>

          {/* Sub-Tabs Switcher */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPiutangSubTab('pelanggan'); setSelectedCustomerId(null); }}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                  piutangSubTab === 'pelanggan'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Users size={14} />
                <span>Buku Piutang Per Pelanggan & Deposit</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  piutangSubTab === 'pelanggan' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {customerLedgers.length}
                </span>
              </button>

              <button
                onClick={() => { setPiutangSubTab('semua_tagihan'); setSelectedCustomerId(null); }}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                  piutangSubTab === 'semua_tagihan'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText size={14} />
                <span>Daftar Semua Tagihan & Utang (Sinkron)</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  piutangSubTab === 'semua_tagihan' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {allReceivablesList.length}
                </span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SUB-TAB 1: BUKU PIUTANG PER PELANGGAN */}
          {/* ========================================================= */}
          {piutangSubTab === 'pelanggan' && (
            <div className="space-y-4">
              {/* JIKA PELANGGAN DIPILIH: TAMPILKAN DRILLDOWN RIWAYAT PEMBELIAN & PEMBAYARAN */}
              {selectedCustomerId ? (() => {
                const sel = customerLedgers.find(c => c.idPelanggan === selectedCustomerId || c.namaPelanggan.trim().toLowerCase() === selectedCustomerId.trim().toLowerCase());
                if (!sel) return null;

                return (
                  <div className="space-y-4">
                    {/* Header Detail Pelanggan */}
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedCustomerId(null)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1 text-xs font-semibold"
                            title="Kembali ke Daftar Pelanggan"
                          >
                            <ArrowLeft size={16} />
                            <span>Kembali</span>
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold text-slate-900">{sel.namaPelanggan}</h4>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
                                {sel.level}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">({sel.idPelanggan})</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Buku Besar Pembantu: Riwayat Pengiriman Produk & Pembayaran Diterima</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenAddPayment({ id: sel.idPelanggan, nama: sel.namaPelanggan })}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard size={14} />
                          <span>Input Pembayaran Pelanggan</span>
                        </button>
                      </div>

                      {/* Kartu Ringkasan Posisi Keuangan Pelanggan */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[11px]">Total Tagihan Pembelian</span>
                          <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                            Rp {sel.totalTagihan.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[11px]">Total Pembayaran Masuk</span>
                          <span className="text-sm font-bold text-blue-700 font-mono tabular-nums">
                            Rp {sel.totalBayar.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${sel.sisaPiutang > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-slate-500 block text-[11px]">Sisa Piutang Berjalan</span>
                          <span className={`text-sm font-bold font-mono tabular-nums ${sel.sisaPiutang > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            Rp {sel.sisaPiutang.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className={`p-2.5 rounded-lg border ${sel.saldoDeposit > 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-slate-500 block text-[11px]">Saldo Deposit (Lebih Bayar)</span>
                          <span className={`text-sm font-bold font-mono tabular-nums ${sel.saldoDeposit > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            Rp {sel.saldoDeposit.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Banner Informasi Kelebihan Bayar / Piutang */}
                      {sel.saldoDeposit > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                          <div>
                            <strong>Pelanggan Memiliki Saldo Lebih Bayar (Deposit): </strong>
                            Terdapat kelebihan pembayaran sebesar <span className="font-bold underline">Rp {sel.saldoDeposit.toLocaleString('id-ID')}</span> yang tersimpan sebagai saldo deposit. Saldo ini siap digunakan untuk memotong tagihan distribusi produk berikutnya.
                          </div>
                        </div>
                      )}

                      {sel.sisaPiutang > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                          <AlertCircle size={16} className="text-amber-600 shrink-0" />
                          <div>
                            <strong>Pelanggan Memiliki Sisa Piutang Belum Lunas: </strong>
                            Masih terdapat sisa kewajiban pembayaran sebesar <span className="font-bold text-red-600">Rp {sel.sisaPiutang.toLocaleString('id-ID')}</span> dari riwayat pengiriman produk.
                          </div>
                        </div>
                      )}

                      {sel.sisaPiutang === 0 && sel.saldoDeposit === 0 && (
                        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                          <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                          <div>
                            <strong>Semua Tagihan & Pembayaran Lunas Seimbang: </strong>
                            Total pembayaran tepat melunasi seluruh riwayat pembelian (Sisa Saldo Rp 0).
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dua Tabel: Riwayat Pembelian vs Riwayat Pembayaran */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Tabel 1: Riwayat Pembelian (Distribusi Terkirim) */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <ShoppingBag size={15} className="text-blue-600" />
                            <h5 className="text-xs font-bold text-slate-800">Riwayat Pembelian & Distribusi ({sel.pembelianList.length})</h5>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">Faktur Tagihan</span>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                              <tr>
                                <th className="p-2.5">Tanggal</th>
                                <th className="p-2.5">No Invoice / SJ</th>
                                <th className="p-2.5">Rincian Barang</th>
                                <th className="p-2.5 text-right">Nilai Tagihan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {sel.pembelianList.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-6 text-center text-slate-400 font-sans italic">
                                    Belum ada data distribusi penjualan untuk pelanggan ini.
                                  </td>
                                </tr>
                              ) : (
                                sel.pembelianList.map(item => (
                                  <tr key={item.id} className="hover:bg-slate-50/70">
                                    <td className="p-2.5 text-slate-600 font-sans">{item.tanggal}</td>
                                    <td className="p-2.5 font-bold text-blue-700">
                                      <div>{item.noInvoice}</div>
                                      <div className="text-[10px] text-slate-400 font-normal">SJ: {item.noSuratJalan}</div>
                                    </td>
                                    <td className="p-2.5 font-sans">
                                      {item.items.length === 0 ? (
                                        <span className="text-slate-400 italic">Produk terdistribusi</span>
                                      ) : (
                                        <div className="space-y-1">
                                          {item.items.map((it, idx) => (
                                            <div key={idx} className="text-[11px] text-slate-700">
                                              • {it.Nama_Produk}: <span className="font-semibold">{it.Qty} {it.Satuan || 'Dus'}</span> @ Rp {(Number(it.Harga_Satuan) || 0).toLocaleString('id-ID')}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-slate-900 tabular-nums">
                                      Rp {item.nominal.toLocaleString('id-ID')}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                              <tr>
                                <td colSpan={3} className="p-2.5 text-right font-sans">Total Pembelian:</td>
                                <td className="p-2.5 text-right font-mono tabular-nums">
                                  Rp {sel.totalTagihan.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Tabel 2: Riwayat Pembayaran Masuk */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <CreditCard size={15} className="text-emerald-600" />
                            <h5 className="text-xs font-bold text-slate-800">Riwayat Pembayaran Diterima ({sel.pembayaranList.length})</h5>
                          </div>
                          <button
                            onClick={() => handleOpenAddPayment({ id: sel.idPelanggan, nama: sel.namaPelanggan })}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>Tambah Bayar</span>
                          </button>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                              <tr>
                                <th className="p-2.5">Tanggal</th>
                                <th className="p-2.5">Metode / Ref</th>
                                <th className="p-2.5">Keterangan</th>
                                <th className="p-2.5 text-right">Jumlah Bayar</th>
                                <th className="p-2.5 text-center">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {sel.pembayaranList.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-6 text-center text-slate-400 font-sans italic">
                                    Belum ada catatan pembayaran. Klik 'Tambah Bayar' untuk menginput pembayaran.
                                  </td>
                                </tr>
                              ) : (
                                sel.pembayaranList.map(pay => (
                                  <tr key={pay.ID_Pembayaran} className="hover:bg-slate-50/70">
                                    <td className="p-2.5 text-slate-600 font-sans">{pay.Tanggal}</td>
                                    <td className="p-2.5 font-sans">
                                      <div className="font-semibold text-slate-800">{pay.Metode}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">{pay.No_Referensi || pay.ID_Pembayaran}</div>
                                    </td>
                                    <td className="p-2.5 font-sans text-slate-600 max-w-[150px] truncate" title={pay.Keterangan}>
                                      {pay.Keterangan || '-'}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-emerald-700 tabular-nums">
                                      Rp {Number(pay.Jumlah_Bayar || 0).toLocaleString('id-ID')}
                                    </td>
                                    <td className="p-2.5 text-center font-sans">
                                      <button
                                        onClick={() => handleDeletePayment(pay.ID_Pembayaran)}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                        title="Hapus Pembayaran"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                              <tr>
                                <td colSpan={3} className="p-2.5 text-right font-sans">Total Terbayar:</td>
                                <td className="p-2.5 text-right font-mono tabular-nums text-emerald-700">
                                  Rp {sel.totalBayar.toLocaleString('id-ID')}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                /* JIKA TIDAK ADA PELANGGAN DIPILIH: TAMPILKAN DAFTAR SEMUA PELANGGAN & STATUSNYA */
                <div className="space-y-3">
                  {/* Filter & Search Bar Pelanggan */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama pelanggan atau ID..."
                        value={searchCustQuery}
                        onChange={e => setSearchCustQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                      <button
                        onClick={() => setCustFilterStatus('all')}
                        className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                          custFilterStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Semua ({customerLedgers.length})
                      </button>
                      <button
                        onClick={() => setCustFilterStatus('piutang')}
                        className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                          custFilterStatus === 'piutang' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        Ada Piutang ({customerLedgers.filter(c => c.sisaPiutang > 0).length})
                      </button>
                      <button
                        onClick={() => setCustFilterStatus('deposit')}
                        className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                          custFilterStatus === 'deposit' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        Lebih Bayar / Deposit ({customerLedgers.filter(c => c.saldoDeposit > 0).length})
                      </button>
                      <button
                        onClick={() => setCustFilterStatus('lunas')}
                        className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                          custFilterStatus === 'lunas' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        Lunas ({customerLedgers.filter(c => c.sisaPiutang === 0 && c.saldoDeposit === 0).length})
                      </button>
                    </div>
                  </div>

                  {/* Tabel Buku Pembantu Per Pelanggan */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-3">Pelanggan</th>
                            <th className="p-3">Level</th>
                            <th className="p-3 text-right">Total Pembelian</th>
                            <th className="p-3 text-right">Total Pembayaran</th>
                            <th className="p-3 text-right">Sisa Piutang</th>
                            <th className="p-3 text-right">Saldo Deposit (Lebih Bayar)</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {(() => {
                            const filtered = customerLedgers.filter(c => {
                              const matchSearch = c.namaPelanggan.toLowerCase().includes(searchCustQuery.toLowerCase()) ||
                                                  c.idPelanggan.toLowerCase().includes(searchCustQuery.toLowerCase());
                              if (!matchSearch) return false;
                              if (custFilterStatus === 'piutang') return c.sisaPiutang > 0;
                              if (custFilterStatus === 'deposit') return c.saldoDeposit > 0;
                              if (custFilterStatus === 'lunas') return c.sisaPiutang === 0 && c.saldoDeposit === 0;
                              return true;
                            });

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={8} className="p-8 text-center text-slate-400 font-sans italic">
                                    Tidak ada data pelanggan yang sesuai dengan filter pencarian.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map(c => {
                                return (
                                <tr key={c.namaPelanggan} className="hover:bg-slate-50/70">
                                  <td className="p-3 font-sans">
                                    <div className="font-bold text-slate-900">{c.namaPelanggan}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{c.idPelanggan}</div>
                                  </td>
                                  <td className="p-3 font-sans">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                      {c.level}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                                    Rp {c.totalTagihan.toLocaleString('id-ID')}
                                  </td>
                                  <td className="p-3 text-right text-blue-700 font-semibold tabular-nums">
                                    Rp {c.totalBayar.toLocaleString('id-ID')}
                                  </td>
                                  <td className="p-3 text-right tabular-nums">
                                    {c.sisaPiutang > 0 ? (
                                      <span className="font-bold text-red-600">Rp {c.sisaPiutang.toLocaleString('id-ID')}</span>
                                    ) : (
                                      <span className="text-slate-400">Rp 0</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right tabular-nums">
                                    {c.saldoDeposit > 0 ? (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Rp {c.saldoDeposit.toLocaleString('id-ID')}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">Rp 0</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center font-sans">
                                    {c.sisaPiutang > 0 ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">
                                        Ada Piutang
                                      </span>
                                    ) : c.saldoDeposit > 0 ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        Lebih Bayar (Deposit)
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                                        Lunas
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center font-sans">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => handleOpenAddPayment({ id: c.idPelanggan, nama: c.namaPelanggan })}
                                        className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors"
                                        title="Catat Pembayaran"
                                      >
                                        <CreditCard size={12} />
                                        <span>Bayar</span>
                                      </button>
                                      <button
                                        onClick={() => setSelectedCustomerId(c.idPelanggan)}
                                        className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                                        title="Buka Rincian Riwayat"
                                      >
                                        <History size={12} />
                                        <span>Riwayat</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 2: DAFTAR SEMUA TAGIHAN & UTANG (SINKRON) */}
          {/* ========================================================= */}
          {piutangSubTab === 'semua_tagihan' && (
            <div className="space-y-3">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari ID dokumen, invoice, surat jalan, atau mitra..."
                    value={piutangSearchQuery}
                    onChange={e => setPiutangSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setPiutangTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                      piutangTypeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({allReceivablesList.length})
                  </button>
                  <button
                    onClick={() => setPiutangTypeFilter('Piutang')}
                    className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                      piutangTypeFilter === 'Piutang' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Piutang Pelanggan ({allReceivablesList.filter(r => (r.Jenis || r.TIPE) === 'Piutang').length})
                  </button>
                  <button
                    onClick={() => setPiutangTypeFilter('Utang')}
                    className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                      piutangTypeFilter === 'Utang' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Utang Supplier ({allReceivablesList.filter(r => (r.Jenis || r.TIPE) === 'Utang').length})
                  </button>
                </div>
              </div>

              {/* Tabel Semua Tagihan */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">ID Dokumen</th>
                        <th className="p-3">Jenis</th>
                        <th className="p-3">Sumber Data</th>
                        <th className="p-3">Pelanggan / Pemasok</th>
                        <th className="p-3 text-right">Total Tagihan</th>
                        <th className="p-3 text-right">Terbayar</th>
                        <th className="p-3 text-right">Sisa Tagihan</th>
                        <th className="p-3">Jatuh Tempo</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(() => {
                        const filtered = allReceivablesList.filter(r => {
                          const id = r.ID_Transaksi || r.ID_DOKUMEN || '';
                          const entitas = r.Entitas || r.NAMA_ENTITAS || '';
                          const noRef = r.No_Ref || '';
                          const matchSearch = id.toLowerCase().includes(piutangSearchQuery.toLowerCase()) ||
                                              entitas.toLowerCase().includes(piutangSearchQuery.toLowerCase()) ||
                                              noRef.toLowerCase().includes(piutangSearchQuery.toLowerCase());
                          if (!matchSearch) return false;
                          const jenis = r.Jenis || r.TIPE || 'Piutang';
                          if (piutangTypeFilter !== 'all' && jenis !== piutangTypeFilter) return false;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={10} className="p-8 text-center text-slate-400 font-sans italic">
                                Belum ada catatan tagihan atau piutang yang sesuai.
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map(r => {
                          const id = r.ID_Transaksi || r.ID_DOKUMEN || 'PU-001';
                          const jenis = r.Jenis || r.TIPE || 'Piutang';
                          const entitas = r.Entitas || r.NAMA_ENTITAS || 'Mitra';
                          const nominal = Number(r.Nominal ?? r.TOTAL_TAGIHAN ?? 0);
                          const terbayar = Number(r.Terbayar ?? r.TOTAL_DIBAYAR ?? 0);
                          const sisa = Number(r.Sisa ?? r.SISA_SALDO ?? (nominal - terbayar));
                          const tempo = r.Tgl_Jatuh_Tempo || r.JATUH_TEMPO || '-';
                          const status = r.Status || r.STATUS || 'Belum Lunas';

                          // Periksa apakah berasal dari distribusi atau pembelian
                          const isDist = distReceivables.some(d => d.ID_Transaksi === id || d.ID_DOKUMEN === id);
                          const isPurch = purchasePayables.some(p => p.ID_Transaksi === id || p.ID_DOKUMEN === id);

                          return (
                            <tr key={id} className="hover:bg-slate-50/70">
                              <td className="p-3 font-bold text-blue-800">{id}</td>
                              <td className="p-3 font-sans">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  jenis === 'Piutang' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {jenis}
                                </span>
                              </td>
                              <td className="p-3 font-sans">
                                {isDist ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Distribusi (Auto)
                                  </span>
                                ) : isPurch ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    Pembelian Bahan (Auto)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-sans font-semibold text-slate-900">{entitas}</td>
                              <td className="p-3 text-right font-bold tabular-nums">Rp {nominal.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right tabular-nums text-emerald-700">Rp {terbayar.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-right font-bold tabular-nums text-red-600">Rp {sisa.toLocaleString('id-ID')}</td>
                              <td className="p-3 text-slate-500">{tempo}</td>
                              <td className="p-3 text-center font-sans">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  status === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="p-3 text-center font-sans">
                                <div className="flex items-center justify-center gap-1.5">
                                  {jenis === 'Piutang' && (
                                    <button
                                      onClick={() => handleOpenAddPayment({ id: '', nama: entitas })}
                                      className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Catat Pembayaran Tagihan Ini"
                                    >
                                      <CreditCard size={12} />
                                      <span>Bayar</span>
                                    </button>
                                  )}
                                  {!isDist && !isPurch && (
                                    <>
                                      <button
                                        onClick={() => handleOpenEditReceivable(r)}
                                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                        title="Edit"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteReceivable(id)}
                                        className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                        title="Hapus"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Edit/Add Jurnal */}
      {showJournalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className={`bg-white rounded-xl shadow-2xl w-full border border-slate-200 overflow-hidden my-6 ${editingJournal ? 'max-w-md' : 'max-w-xl'}`}>
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-blue-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingJournal ? 'Edit Baris Jurnal Umum' : 'Tambah Jurnal Manual (Double-Entry Seimbang)'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowJournalModal(false);
                  setEditingJournal(null);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editingJournal ? (
              /* FORM MODE EDIT SATU BARIS */
              <div className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Jurnal</label>
                    <input
                      type="text"
                      value={journalForm.ID_JURNAL}
                      readOnly
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-slate-100 text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      value={journalForm.TANGGAL}
                      onChange={e => {
                        const val = e.target.value;
                        setJournalForm({ ...journalForm, TANGGAL: val, PERIODE: val.slice(0, 7) });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Referensi</label>
                  <input
                    type="text"
                    value={journalForm.REFERENSI}
                    onChange={e => setJournalForm({ ...journalForm, REFERENSI: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi</label>
                  <input
                    type="text"
                    value={journalForm.KETERANGAN}
                    onChange={e => setJournalForm({ ...journalForm, KETERANGAN: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Akun (COA)</label>
                  <select
                    value={journalForm.KODE_AKUN}
                    onChange={e => setJournalForm({ ...journalForm, KODE_AKUN: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-slate-800 font-semibold"
                  >
                    {coas.map(c => (
                      <option key={c.KODE_AKUN} value={c.KODE_AKUN}>
                        {c.KODE_AKUN} - {c.NAMA_AKUN} ({c.KATEGORI})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nominal Debit (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={journalForm.DEBIT ?? ''}
                      onChange={e => setJournalForm({ ...journalForm, DEBIT: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0), KREDIT: 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nominal Kredit (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={journalForm.KREDIT ?? ''}
                      onChange={e => setJournalForm({ ...journalForm, KREDIT: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0), DEBIT: 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* FORM MODE TAMBAH BARU (DOUBLE-ENTRY BERPASANGAN) */
              <div className="p-5 space-y-4 text-xs">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900 flex items-start gap-2.5">
                  <Scale size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Prinsip Akuntansi Berpasangan (Double-Entry):</strong> Setiap transaksi jurnal manual akan secara otomatis membuat 2 baris seimbang berpasangan: satu di sisi <strong>Debit</strong> dan satu di sisi <strong>Kredit</strong> dengan nominal yang sama persis.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Jurnal (Otomatis)</label>
                    <input
                      type="text"
                      value={doubleEntryForm.ID_JURNAL}
                      readOnly
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-slate-100 text-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                    <input
                      type="date"
                      value={doubleEntryForm.TANGGAL}
                      onChange={e => {
                        const val = e.target.value;
                        setDoubleEntryForm({ ...doubleEntryForm, TANGGAL: val, PERIODE: val.slice(0, 7) });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Ref / Dokumen</label>
                    <input
                      type="text"
                      value={doubleEntryForm.REFERENSI}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, REFERENSI: e.target.value })}
                      placeholder="MANUAL / BKK-01"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={doubleEntryForm.KETERANGAN}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, KETERANGAN: e.target.value })}
                      placeholder="Contoh: Pengisian Kas Kecil dari Bank, Pembayaran Listrik, dll."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                </div>

                {/* SISI DEBIT & KREDIT */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                        1. Akun Sisi DEBIT (Bertambah / Masuk)
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Aset bertambah, Beban bertambah</span>
                    </div>
                    <select
                      value={doubleEntryForm.KODE_DEBIT}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, KODE_DEBIT: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-slate-800 font-semibold bg-white"
                    >
                      {coas.map(c => (
                        <option key={c.KODE_AKUN} value={c.KODE_AKUN}>
                          {c.KODE_AKUN} - {c.NAMA_AKUN} ({c.KATEGORI})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
                        2. Akun Sisi KREDIT (Berkurang / Keluar)
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Kas/Bank berkurang, Pendapatan, Modal</span>
                    </div>
                    <select
                      value={doubleEntryForm.KODE_KREDIT}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, KODE_KREDIT: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-slate-800 font-semibold bg-white"
                    >
                      {coas.map(c => (
                        <option key={c.KODE_AKUN} value={c.KODE_AKUN}>
                          {c.KODE_AKUN} - {c.NAMA_AKUN} ({c.KATEGORI})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nominal Transaksi (Rp) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        min="1"
                        value={doubleEntryForm.NOMINAL ?? ''}
                        onChange={e => setDoubleEntryForm({ ...doubleEntryForm, NOMINAL: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 })}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {Number(doubleEntryForm.NOMINAL) > 0 && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                        Terbilang nominal: Rp {Number(doubleEntryForm.NOMINAL).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button 
                onClick={() => {
                  setShowJournalModal(false);
                  setEditingJournal(null);
                }} 
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveJournal} 
                className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Save size={14} />
                <span>{editingJournal ? 'Perbarui Baris' : 'Bukukan Jurnal Berpasangan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit/Add COA */}
      {showCoaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingCoa ? `Edit Akun (${editingCoa.KODE_AKUN})` : 'Tambah Akun Baru (COA)'}
              </h3>
              <button onClick={() => setShowCoaModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Akun</label>
                <input
                  type="text"
                  value={coaForm.KODE_AKUN}
                  readOnly={Boolean(editingCoa)}
                  placeholder="Contoh: 111-99"
                  onChange={e => setCoaForm({ ...coaForm, KODE_AKUN: e.target.value })}
                  className={`w-full px-3 py-1.5 border rounded-lg font-mono font-bold ${
                    editingCoa ? 'bg-slate-100 text-slate-500' : 'bg-white border-slate-300'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Akun</label>
                <input
                  type="text"
                  value={coaForm.NAMA_AKUN}
                  onChange={e => setCoaForm({ ...coaForm, NAMA_AKUN: e.target.value })}
                  placeholder="Nama Akun Standar..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Akun</label>
                <select
                  value={coaForm.KATEGORI}
                  onChange={e => setCoaForm({ ...coaForm, KATEGORI: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
                >
                  <option value="Aset Lancar">Aset Lancar</option>
                  <option value="Aset Tetap">Aset Tetap</option>
                  <option value="Kontra Aset">Kontra Aset (Penyusutan)</option>
                  <option value="Liabilitas Pendek">Liabilitas Jangka Pendek</option>
                  <option value="Liabilitas Panjang">Liabilitas Jangka Panjang</option>
                  <option value="Ekuitas">Ekuitas / Modal</option>
                  <option value="Pendapatan">Pendapatan Operasional</option>
                  <option value="Harga Pokok">Harga Pokok Penjualan (HPP)</option>
                  <option value="Beban">Beban Operasional & Umum</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Saldo Normal</label>
                  <select
                    value={coaForm.SALDO_NORMAL}
                    onChange={e => setCoaForm({ ...coaForm, SALDO_NORMAL: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  >
                    <option value="Debit">Debit</option>
                    <option value="Kredit">Kredit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={coaForm.STATUS}
                    onChange={e => setCoaForm({ ...coaForm, STATUS: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowCoaModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveCoa} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Draf Jurnal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                Edit Draf Jurnal ({editingDraft?.ID_Draf})
              </h3>
              <button onClick={() => setShowDraftModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi</label>
                <input
                  type="text"
                  value={draftForm.Keterangan}
                  onChange={e => setDraftForm({ ...draftForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Akun Debit</label>
                  <select
                    value={draftForm.Kode_Debit}
                    onChange={e => setDraftForm({ ...draftForm, Kode_Debit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold"
                  >
                    {coas.map(c => (
                      <option key={c.KODE_AKUN} value={c.KODE_AKUN}>{c.KODE_AKUN} - {c.NAMA_AKUN}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Akun Kredit</label>
                  <select
                    value={draftForm.Kode_Kredit}
                    onChange={e => setDraftForm({ ...draftForm, Kode_Kredit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold"
                  >
                    {coas.map(c => (
                      <option key={c.KODE_AKUN} value={c.KODE_AKUN}>{c.KODE_AKUN} - {c.NAMA_AKUN}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Transaksi (Rp)</label>
                <input
                  type="number"
                  value={draftForm.Nominal}
                  onChange={e => setDraftForm({ ...draftForm, Nominal: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowDraftModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveDraft} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Aset Tetap */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingAsset ? `Edit Aset (${editingAsset.ID_ASET})` : 'Tambah Aset Tetap Baru'}
              </h3>
              <button onClick={() => setShowAssetModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Aset Tetap</label>
                <input
                  type="text"
                  value={assetForm.NAMA_ASET}
                  placeholder="Contoh: Mesin Water Treatment 8-Stage..."
                  onChange={e => setAssetForm({ ...assetForm, NAMA_ASET: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Perolehan</label>
                  <input
                    type="date"
                    value={assetForm.TGL_BELI}
                    onChange={e => setAssetForm({ ...assetForm, TGL_BELI: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Umur Ekonomis (Bulan)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 48"
                    value={assetForm.UMUR_EKONOMIS_BLN ?? ''}
                    onChange={e => {
                      const m = parseInt(e.target.value, 10);
                      const np = Number(assetForm.NILAI_PEROLEHAN) || 0;
                      const nr = Number(assetForm.NILAI_RESIDU) || 0;
                      const susut = m > 0 ? Math.round((np - nr) / m) : 0;
                      setAssetForm({ ...assetForm, UMUR_EKONOMIS_BLN: e.target.value === '' ? ('' as any) : m, BEBAN_PENYUSUTAN_BLN: Math.max(0, susut) });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nilai Perolehan (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={assetForm.NILAI_PEROLEHAN ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0);
                      const m = Number(assetForm.UMUR_EKONOMIS_BLN) || 1;
                      const nr = Number(assetForm.NILAI_RESIDU) || 0;
                      const susut = Math.round(((Number(val) || 0) - nr) / m);
                      setAssetForm({ ...assetForm, NILAI_PEROLEHAN: val, BEBAN_PENYUSUTAN_BLN: Math.max(0, susut) });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nilai Residu (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={assetForm.NILAI_RESIDU ?? ''}
                    onChange={e => {
                      const res = e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0);
                      const m = Number(assetForm.UMUR_EKONOMIS_BLN) || 1;
                      const np = Number(assetForm.NILAI_PEROLEHAN) || 0;
                      const susut = Math.round((np - (Number(res) || 0)) / m);
                      setAssetForm({ ...assetForm, NILAI_RESIDU: res, BEBAN_PENYUSUTAN_BLN: Math.max(0, susut) });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Beban Susut per Bulan (Rp)</label>
                <input
                  type="number"
                  value={assetForm.BEBAN_PENYUSUTAN_BLN}
                  readOnly
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-red-600 bg-slate-50"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowAssetModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveAsset} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Aset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Piutang & Utang */}
      {showReceivableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingReceivable ? 'Edit Data Tagihan / Utang' : 'Tambah Piutang / Utang Baru'}
              </h3>
              <button onClick={() => setShowReceivableModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Transaksi</label>
                  <select
                    value={receivableForm.Jenis}
                    onChange={e => setReceivableForm({ ...receivableForm, Jenis: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-bold text-slate-900"
                  >
                    <option value="Piutang">Piutang (Tagihan Pelanggan)</option>
                    <option value="Utang">Utang (Kewajiban Supplier)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={receivableForm.Tgl_Jatuh_Tempo}
                    onChange={e => setReceivableForm({ ...receivableForm, Tgl_Jatuh_Tempo: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Mitra / Pelanggan / Vendor</label>
                <input
                  type="text"
                  value={receivableForm.Entitas}
                  placeholder="Nama toko atau supplier..."
                  onChange={e => setReceivableForm({ ...receivableForm, Entitas: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Tagihan (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={receivableForm.Nominal ?? ''}
                    onChange={e => setReceivableForm({ ...receivableForm, Nominal: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sudah Dibayar (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={receivableForm.Terbayar ?? ''}
                    onChange={e => setReceivableForm({ ...receivableForm, Terbayar: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowReceivableModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveReceivable} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Tagihan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Pembayaran Pelanggan */}
      {showPaymentModal && (() => {
        const foundCust = customerLedgers.find(c => 
          (paymentForm.ID_Pelanggan && c.idPelanggan === paymentForm.ID_Pelanggan) || 
          c.namaPelanggan.trim().toLowerCase() === paymentForm.Nama_Pelanggan.trim().toLowerCase()
        );
        const currentNet = foundCust ? (foundCust.totalBayar - foundCust.totalTagihan) : 0;
        const inputAmount = Number(paymentForm.Jumlah_Bayar) || 0;
        const newNet = currentNet + inputAmount;

        // --- KALKULATOR PEMBELIAN DATA ---
        // Daftar invoice distribusi yang belum lunas untuk pelanggan ini
        const invoiceList = foundCust ? foundCust.pembelianList : [];
        // Hitung total yang sudah terbayar untuk masing-masing invoice via pembayaran terkait
        // (untuk simplicity: kami pakai sisa dari pembayaran pelanggan total vs tagihan total)
        // Hitung total nilai invoice yang dipilih di kalkulator
        const calcSelectedTotal = invoiceList
          .filter(inv => selectedInvoiceIds.has(inv.id))
          .reduce((s, inv) => s + inv.nominal, 0);
        // Gabungkan semua item produk dari semua invoice yang dipilih untuk ringkasan produk
        const calcProductMap = new Map<string, { nama: string; qty: number; satuan: string; harga: number; subtotal: number }>();
        invoiceList
          .filter(inv => selectedInvoiceIds.has(inv.id))
          .forEach(inv => {
            inv.items.forEach(item => {
              const key = item.ID_Produk || item.Nama_Produk;
              const existing = calcProductMap.get(key);
              if (existing) {
                existing.qty += Number(item.Qty) || 0;
                existing.subtotal += Number(item.Subtotal) || (Number(item.Qty) * Number(item.Harga_Satuan));
              } else {
                calcProductMap.set(key, {
                  nama: item.Nama_Produk,
                  qty: Number(item.Qty) || 0,
                  satuan: item.Satuan || 'Dus',
                  harga: Number(item.Harga_Satuan) || 0,
                  subtotal: Number(item.Subtotal) || (Number(item.Qty) * Number(item.Harga_Satuan))
                });
              }
            });
          });
        const calcProducts = Array.from(calcProductMap.values());
        const calcPartialTotal = partialPayItems.reduce((s, it) => s + ((Number(it.payQty) || 0) * (Number(it.harga) || 0)), 0);
        const activePartialItems = partialPayItems.filter(it => (Number(it.payQty) || 0) > 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={14} />
                    Catat Pembayaran Masuk Pelanggan
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Lengkapi data pembayaran · Gunakan kalkulator faktur atau parsial produk</p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
              </div>

              <div className="flex flex-col lg:flex-row">
                {/* ===== PANEL KIRI: FORM PEMBAYARAN ===== */}
                <div className="flex-1 p-5 space-y-4 text-xs overflow-y-auto max-h-[80vh]">

                {/* Pilih Pelanggan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Pelanggan</label>
                  <select
                    value={paymentForm.Nama_Pelanggan}
                    onChange={e => {
                      const val = e.target.value;
                      const sel = customerLedgers.find(c => c.namaPelanggan === val);
                      setPaymentForm({
                        ...paymentForm,
                        Nama_Pelanggan: val,
                        ID_Pelanggan: sel?.idPelanggan || ''
                      });
                      setSelectedInvoiceIds(new Set());
                      initPartialItems(val);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900 focus:border-blue-500"
                  >
                    <option value="">-- Pilih Pelanggan --</option>
                    {customerLedgers.map(c => (
                      <option key={c.namaPelanggan} value={c.namaPelanggan}>
                        {c.namaPelanggan} ({c.level}) - Sisa Piutang: Rp {c.sisaPiutang.toLocaleString('id-ID')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Ringkas Pelanggan Saat Ini */}
                {foundCust && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Total Tagihan Distribusi:</span>
                      <span className="font-bold font-mono text-slate-800">Rp {foundCust.totalTagihan.toLocaleString('id-ID')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Pembayaran Sebelumnya:</span>
                      <span className="font-bold font-mono text-blue-700">Rp {foundCust.totalBayar.toLocaleString('id-ID')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Sisa Piutang Saat Ini:</span>
                      <span className={`font-bold font-mono ${foundCust.sisaPiutang > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                        Rp {foundCust.sisaPiutang.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Saldo Deposit Saat Ini:</span>
                      <span className={`font-bold font-mono ${foundCust.saldoDeposit > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                        Rp {foundCust.saldoDeposit.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tanggal & Nominal Bayar */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Pembayaran</label>
                    <input
                      type="date"
                      value={paymentForm.Tanggal}
                      onChange={e => setPaymentForm({ ...paymentForm, Tanggal: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jumlah Bayar (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={paymentForm.Jumlah_Bayar || ''}
                      onChange={e => setPaymentForm({ ...paymentForm, Jumlah_Bayar: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700 outline-none focus:border-emerald-500 text-sm"
                    />
                  </div>
                </div>

                {/* Simulasi Otomatis Kelebihan Bayar / Sisa Piutang */}
                {inputAmount > 0 && foundCust && (
                  <div className="p-3 rounded-lg border text-xs transition-all">
                    {newNet > 0 ? (
                      <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-md">
                        <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">Otomatis Masuk Saldo Deposit Pelanggan!</div>
                          <div className="text-[11px] mt-0.5">
                            Pembayaran ini melunasi seluruh tagihan dan menghasilkan <strong>kelebihan bayar sebesar Rp {newNet.toLocaleString('id-ID')}</strong> yang akan disimpan sebagai saldo deposit aktif pelanggan.
                          </div>
                        </div>
                      </div>
                    ) : newNet < 0 ? (
                      <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-md">
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">Pembayaran Sebagian (Cicilan)</div>
                          <div className="text-[11px] mt-0.5">
                            Setelah pembayaran Rp {inputAmount.toLocaleString('id-ID')}, <strong>sisa piutang pelanggan menjadi Rp {Math.abs(newNet).toLocaleString('id-ID')}</strong>.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-blue-800 bg-blue-50 border border-blue-200 p-2.5 rounded-md">
                        <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">Pembayaran Tepat Melunasi Seluruh Tagihan!</div>
                          <div className="text-[11px] mt-0.5">
                            Sisa saldo piutang pelanggan akan menjadi Rp 0 (Lunas Bersih).
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Metode Pembayaran & No Referensi */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Metode Pembayaran</label>
                    <select
                      value={paymentForm.Metode}
                      onChange={e => setPaymentForm({ ...paymentForm, Metode: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
                    >
                      <option value="Transfer Bank BCA">Transfer Bank BCA</option>
                      <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                      <option value="Transfer Bank BRI">Transfer Bank BRI</option>
                      <option value="Transfer Bank BNI">Transfer Bank BNI</option>
                      <option value="Tunai / Kas">Tunai / Kas Langsung</option>
                      <option value="QRIS">QRIS</option>
                      <option value="Cek / Bilyet Giro">Cek / Bilyet Giro</option>
                      <option value="Saldo Deposit">Potong Saldo Deposit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Referensi / Bukti Transfer</label>
                    <input
                      type="text"
                      placeholder="Contoh: TRF-BCA-9810 atau No Struk"
                      value={paymentForm.No_Referensi}
                      onChange={e => setPaymentForm({ ...paymentForm, No_Referensi: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none text-slate-900"
                    />
                  </div>
                </div>

                {/* Keterangan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan / Keterangan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Pembayaran invoice tagihan distribusi..."
                    value={paymentForm.Keterangan}
                    onChange={e => setPaymentForm({ ...paymentForm, Keterangan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none text-slate-900"
                  />
                </div>
                {/* END FORM FIELDS */}
              </div>
              {/* END LEFT PANEL */}

              {/* ===== PANEL KANAN: KALKULATOR PEMBELIAN PRODUK ===== */}
              {foundCust && (
                <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 flex flex-col">
                  {/* Toggle Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <Calculator size={14} />
                      Kalkulator Tagihan Produk
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCalcPanel(!showCalcPanel)}
                      className="flex items-center gap-1.5 text-[11px] text-blue-100 hover:text-white cursor-pointer transition-colors"
                    >
                      <span>{showCalcPanel ? 'Tutup' : 'Buka'}</span>
                      <ChevronRight size={14} className={`transition-transform ${showCalcPanel ? 'rotate-90' : ''}`} />
                    </button>
                  </div>

                  {showCalcPanel && (
                    <div className="flex flex-col flex-1 overflow-hidden">
                      {/* Mode Switcher Tabs */}
                      <div className="grid grid-cols-2 bg-slate-200/70 p-1 border-b border-slate-200 text-xs gap-1">
                        <button
                          type="button"
                          onClick={() => setCalcMode('invoice')}
                          className={`py-1.5 px-2 rounded-md font-bold transition-all cursor-pointer text-center text-[11px] ${
                            calcMode === 'invoice'
                              ? 'bg-white text-blue-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Per Faktur/Invoice ({invoiceList.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCalcMode('partial');
                            if (partialPayItems.length === 0 && foundCust) {
                              initPartialItems(foundCust.namaPelanggan);
                            }
                          }}
                          className={`py-1.5 px-2 rounded-md font-bold transition-all cursor-pointer text-center text-[11px] ${
                            calcMode === 'partial'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Bayar Sebagian Produk
                        </button>
                      </div>

                      {/* MODE 1: PER INVOICE */}
                      {calcMode === 'invoice' && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <div className="px-3 pt-2.5 pb-1">
                            <p className="text-[11px] font-semibold text-slate-600 mb-1">
                              Centang faktur yang ingin dilunasi sekaligus:
                            </p>
                          </div>

                          <div className="overflow-y-auto flex-1 px-3 space-y-2 max-h-64">
                            {invoiceList.length === 0 ? (
                              <div className="text-[11px] text-slate-400 italic text-center py-4">
                                Belum ada data distribusi untuk pelanggan ini.
                              </div>
                            ) : (
                              invoiceList.map(inv => {
                                const isSelected = selectedInvoiceIds.has(inv.id);
                                return (
                                  <label
                                    key={inv.id}
                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-blue-50 border-blue-400 shadow-xs'
                                        : 'bg-white border-slate-200 hover:border-blue-300'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        const next = new Set(selectedInvoiceIds);
                                        if (isSelected) {
                                          next.delete(inv.id);
                                        } else {
                                          next.add(inv.id);
                                        }
                                        setSelectedInvoiceIds(next);
                                        const newTotal = invoiceList
                                          .filter(i => next.has(i.id))
                                          .reduce((s, i) => s + i.nominal, 0);
                                        setPaymentForm(prev => ({ ...prev, Jumlah_Bayar: newTotal }));
                                      }}
                                      className="mt-0.5 accent-blue-600 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0 text-xs">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`font-bold truncate ${isSelected ? 'text-blue-800' : 'text-slate-800'}`}>
                                          {inv.noInvoice}
                                        </span>
                                        <span className="font-bold font-mono text-slate-900 whitespace-nowrap">
                                          Rp {inv.nominal.toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        SJ: {inv.noSuratJalan} · {inv.tanggal}
                                      </div>
                                      {inv.items.length > 0 && (
                                        <div className="mt-1 space-y-0.5">
                                          {inv.items.map((it, idx) => (
                                            <div key={idx} className="text-[10px] text-slate-600 flex justify-between">
                                              <span>• {it.Nama_Produk} {it.Qty} {it.Satuan || 'Dus'}</span>
                                              <span className="font-mono text-slate-700">Rp {Number(it.Subtotal || (Number(it.Qty) * Number(it.Harga_Satuan)) || 0).toLocaleString('id-ID')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>

                          <div className="flex items-center gap-2 px-3 pt-2 pb-1 border-t border-slate-200 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const allIds = new Set(invoiceList.map(i => i.id));
                                setSelectedInvoiceIds(allIds);
                                const total = invoiceList.reduce((s, i) => s + i.nominal, 0);
                                setPaymentForm(prev => ({ ...prev, Jumlah_Bayar: total }));
                              }}
                              className="flex-1 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer transition-colors"
                            >
                              Pilih Semua
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceIds(new Set());
                                setPaymentForm(prev => ({ ...prev, Jumlah_Bayar: 0 }));
                              }}
                              className="flex-1 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 cursor-pointer transition-colors"
                            >
                              Hapus Pilihan
                            </button>
                          </div>

                          {calcProducts.length > 0 && (
                            <div className="border-t border-slate-200 mt-1 px-3 py-2 bg-white">
                              <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <ShoppingBag size={12} className="text-blue-600" />
                                Ringkasan Produk Terpilih:
                              </div>
                              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                {calcProducts.map((p, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-700 truncate max-w-[170px]">
                                      {p.nama} <span className="text-slate-400 font-mono">({p.qty} {p.satuan})</span>
                                    </span>
                                    <span className="font-bold font-mono text-slate-800">
                                      Rp {p.subtotal.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">Total Invoice:</span>
                                <span className="font-bold font-mono text-blue-700 text-sm">
                                  Rp {calcSelectedTotal.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPaymentForm(prev => ({ ...prev, Jumlah_Bayar: calcSelectedTotal }))}
                                className="w-full mt-2 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                              >
                                <ArrowDownLeft size={13} />
                                Terapkan ke Jumlah Bayar
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* MODE 2: BAYAR SEBAGIAN PRODUK (MANUAL / PARSIAL) */}
                      {calcMode === 'partial' && (
                        <div className="flex flex-col flex-1 overflow-hidden">
                          <div className="px-3 pt-2.5 pb-1">
                            <p className="text-[11px] text-slate-600 leading-tight">
                              Tentukan kuantiti (Qty) sebagian produk yang ingin dibayar pelanggan:
                            </p>
                          </div>

                          <div className="overflow-y-auto flex-1 px-3 space-y-2 max-h-64">
                            {partialPayItems.length === 0 ? (
                              <div className="text-[11px] text-slate-400 italic text-center py-4 bg-white rounded-lg border border-dashed border-slate-200">
                                Belum ada produk terkirim tercatat untuk pelanggan ini. Anda dapat menambahkan produk secara manual di bawah.
                              </div>
                            ) : (
                              partialPayItems.map(item => {
                                const subtotal = (Number(item.payQty) || 0) * (Number(item.harga) || 0);
                                const isCustom = item.id.startsWith('custom-');
                                return (
                                  <div
                                    key={item.id}
                                    className={`p-2.5 rounded-lg border transition-all ${
                                      item.payQty > 0 ? 'bg-emerald-50/60 border-emerald-300 shadow-xs' : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1.5">
                                      <div className="flex-1 min-w-0">
                                        {isCustom ? (
                                          <input
                                            type="text"
                                            value={item.nama}
                                            placeholder="Nama produk manual..."
                                            onChange={e => {
                                              const v = e.target.value;
                                              setPartialPayItems(prev => prev.map(it => it.id === item.id ? { ...it, nama: v } : it));
                                            }}
                                            className="w-full text-xs font-bold border-b border-slate-300 pb-0.5 outline-none focus:border-blue-500 bg-transparent"
                                          />
                                        ) : (
                                          <div className="font-bold text-slate-800 text-xs truncate">{item.nama}</div>
                                        )}
                                        <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                          {!isCustom && (
                                            <>
                                              <span>Terkirim: <strong className="text-slate-700">{item.maxQty} {item.satuan}</strong></span>
                                              <span>·</span>
                                            </>
                                          )}
                                          <span className="flex items-center gap-1">
                                            @ Rp 
                                            {isCustom ? (
                                              <input
                                                type="number"
                                                value={item.harga}
                                                onChange={e => {
                                                  const h = parseFloat(e.target.value) || 0;
                                                  setPartialPayItems(prev => prev.map(it => it.id === item.id ? { ...it, harga: h } : it));
                                                }}
                                                className="w-20 px-1 py-0.5 text-[10px] border border-slate-300 rounded font-mono font-bold"
                                              />
                                            ) : (
                                              <span className="font-mono text-slate-700">{item.harga.toLocaleString('id-ID')}</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      {isCustom && (
                                        <button
                                          type="button"
                                          onClick={() => setPartialPayItems(prev => prev.filter(it => it.id !== item.id))}
                                          className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                                          title="Hapus item manual"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-1">
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPartialPayItems(prev => prev.map(it => it.id === item.id ? { ...it, payQty: Math.max(0, it.payQty - 1) } : it));
                                          }}
                                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 cursor-pointer text-xs"
                                        >
                                          -
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={item.payQty || ''}
                                          placeholder="0"
                                          onChange={e => {
                                            const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                                            setPartialPayItems(prev => prev.map(it => it.id === item.id ? { ...it, payQty: v } : it));
                                          }}
                                          className="w-14 text-center font-mono font-bold text-xs py-0.5 border border-slate-300 rounded outline-none focus:border-emerald-500 bg-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPartialPayItems(prev => prev.map(it => it.id === item.id ? { ...it, payQty: it.payQty + 1 } : it));
                                          }}
                                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 cursor-pointer text-xs"
                                        >
                                          +
                                        </button>
                                        {!isCustom && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPartialPayItems(prev => prev.map(it => it.id === item.id ? { ...it, payQty: it.maxQty } : it));
                                            }}
                                            className="px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer ml-1"
                                            title="Bayar 100% Qty produk ini"
                                          >
                                            Maks
                                          </button>
                                        )}
                                      </div>

                                      <div className="text-right">
                                        <span className="font-bold font-mono text-xs text-slate-900 block">
                                          Rp {subtotal.toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Action Bar Parsial */}
                          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 border-t border-slate-200 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPartialPayItems(prev => prev.map(it => ({ ...it, payQty: it.maxQty })));
                              }}
                              className="flex-1 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer transition-colors"
                            >
                              Semua Maks
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPartialPayItems(prev => prev.map(it => ({ ...it, payQty: 0 })));
                              }}
                              className="flex-1 py-1 text-[10px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 cursor-pointer transition-colors"
                            >
                              Reset 0
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPartialPayItems(prev => [
                                  ...prev,
                                  {
                                    id: 'custom-' + Date.now(),
                                    nama: 'Produk Tambahan',
                                    satuan: 'Dus',
                                    harga: 20000,
                                    maxQty: 9999,
                                    payQty: 1
                                  }
                                ]);
                              }}
                              className="flex-1 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer transition-colors flex items-center justify-center gap-0.5"
                            >
                              <Plus size={11} />
                              <span>Item Bebas</span>
                            </button>
                          </div>

                          {/* Ringkasan Parsial & Terapkan */}
                          <div className="border-t border-slate-200 mt-1 px-3 py-2 bg-white">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold text-slate-700">Total Sebagian Produk:</span>
                              <span className="font-bold font-mono text-emerald-700 text-sm">
                                Rp {calcPartialTotal.toLocaleString('id-ID')}
                              </span>
                            </div>

                            {activePartialItems.length > 0 && (
                              <div className="text-[10px] text-slate-500 mb-1.5 truncate max-w-full">
                                {activePartialItems.map(it => `${it.payQty} ${it.satuan} ${it.nama}`).join(', ')}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const summaryStr = activePartialItems.map(it => `${it.payQty} ${it.satuan} ${it.nama}`).join(', ');
                                setPaymentForm(prev => ({
                                  ...prev,
                                  Jumlah_Bayar: calcPartialTotal,
                                  Keterangan: summaryStr ? `Bayar sebagian: ${summaryStr}` : prev.Keterangan
                                }));
                                showToast('success', `Jumlah bayar parsial Rp ${calcPartialTotal.toLocaleString('id-ID')} diterapkan!`);
                              }}
                              disabled={calcPartialTotal <= 0}
                              className={`w-full py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                                calcPartialTotal > 0
                                  ? 'text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs'
                                  : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              <ArrowDownLeft size={13} />
                              Terapkan ke Jumlah Bayar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!showCalcPanel && (
                    <div className="p-3 text-[11px] text-slate-500 italic">
                      Klik tombol di atas untuk memilih invoice atau menghitung pembayaran sebagian dari produk yang sudah terkirim.
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Modal Footer - spans full width, outside left/right panel row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                {calcMode === 'invoice' && calcSelectedTotal > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Calculator size={13} className="text-blue-600" />
                    Total invoice dipilih: <strong className="text-blue-700 font-mono">Rp {calcSelectedTotal.toLocaleString('id-ID')}</strong>
                  </span>
                )}
                {calcMode === 'partial' && calcPartialTotal > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Calculator size={13} className="text-emerald-600" />
                    Total parsial produk: <strong className="text-emerald-700 font-mono">Rp {calcPartialTotal.toLocaleString('id-ID')}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSavePayment}
                  className="px-5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>Simpan Pembayaran</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
