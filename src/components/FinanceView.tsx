import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scale, Printer, FileDown, RefreshCw, Truck 
} from 'lucide-react';
import { 
  COAItem, GeneralJournalItem, DraftJournalItem, 
  ReceivablePayableItem, FixedAssetItem, DistributionItem, DistributionProductDetail,
  CustomerItem, RawMaterialPurchase, CustomerPaymentRecord, DriverSettlementItem
} from '../types';
import { 
  getTableData, setTableData, verifyAndPostDraftJournal, upgradeCOAToFactoryStandard 
} from '../services/dbAdapter';
import { syncAllModulesToFinance } from '../services/financeSyncService';
import { exportDataToExcel } from '../services/excelService';
import { generateTableReportPDF } from '../services/pdfService';
import { showToast as showToastGlobal } from './ToastContainer';
import { confirmAction } from './ConfirmDialog';

import { FinanceNeracaTab } from './finance/FinanceNeracaTab';
import { FinanceLabaRugiTab } from './finance/FinanceLabaRugiTab';
import { FinanceDraftsTab } from './finance/FinanceDraftsTab';
import { FinanceJurnalTab } from './finance/FinanceJurnalTab';
import { FinanceCOATab } from './finance/FinanceCOATab';
import { FinanceAsetTab } from './finance/FinanceAsetTab';
import { FinancePiutangTab } from './finance/FinancePiutangTab';
import { FinanceBiayaDistribusiTab } from './finance/FinanceBiayaDistribusiTab';

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
  const [activeTab, setActiveTab] = useState<'neraca' | 'labarugi' | 'drafts' | 'jurnal' | 'coa' | 'aset' | 'piutang' | 'biaya_distribusi'>('neraca');

  const now = new Date();
  const defaultPeriod = ${now.getFullYear()}-;
  const [filterPeriod, setFilterPeriod] = useState<string>(defaultPeriod);
  const [searchCoa, setSearchCoa] = useState<string>('');
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

  const [showAssetModal, setShowAssetModal] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<FixedAssetItem | null>(null);
  const [assetForm, setAssetForm] = useState({
    ID_ASET: '',
    NAMA_ASET: '',
    KATEGORI: 'Mesin & Peralatan Pabrik',
    TANGGAL_PEROLEHAN: new Date().toISOString().slice(0, 10),
    NILAI_PEROLEHAN: '' as any,
    NILAI_RESIDU: '' as any,
    UMUR_EKONOMIS_BLN: '' as any,
    BEBAN_PENYUSUTAN_BLN: '' as any,
    AKUN_ASET: '121-20',
    AKUN_AKUMULASI: '122-20',
    AKUN_BEBAN: '514-20'
  });

  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);

  // Quick Notification Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'warning' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (type: 'success' | 'warning' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    showToastGlobal(type === 'success' ? 'Sukses' : type === 'warning' ? 'Peringatan' : type === 'info' ? 'Informasi' : 'Pemberitahuan', text, type);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const [customerPayments, setCustomerPayments] = useState<CustomerPaymentRecord[]>(() => 
    getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', [])
  );

  const [driverSettlements, setDriverSettlements] = useState<DriverSettlementItem[]>(() => 
    getTableData<DriverSettlementItem>('Pencairan_Biaya_Distribusi', [])
  );
    onRefresh();
  };

  // Helper pencetakan resmi Voucher Kas Keluar Biaya Distribusi via hidden iframe (eksklusif voucher, bebas background halaman)
  const handlePrintVoucher = (item: DriverSettlementItem) => {
    const details = (item.Items_Detail && Array.isArray(item.Items_Detail) && item.Items_Detail.length > 0)
      ? item.Items_Detail
      : (() => {
          const idList = safeList(item.ID_Distribusi_List);
          const sjList = safeList(item.No_Surat_Jalan_List);
          const idSet = new Set(idList);
          const sjSet = new Set(sjList);
          const matched = (distributions || []).filter(d => idSet.has(d.ID_Distribusi) || sjSet.has(d.No_Surat_Jalan));
          return matched.map(d => {
            const dus = (distributionItems || [])
              .filter(it => it.ID_Distribusi === d.ID_Distribusi)
              .reduce((sum, it) => sum + (Number(it.Qty) || 0), 0);
            const tarif = Number(item.Tarif_Per_Dus || 1000);
            return {
              ID_Distribusi: d.ID_Distribusi,
              No_Surat_Jalan: d.No_Surat_Jalan || '-',
              Tanggal: d.Tanggal,
              Pelanggan: d.Nama_Pelanggan || 'Pelanggan',
              Tujuan: d.Tujuan_Pengiriman || d.Alamat || '-',
              Dus: dus,
              Tarif: tarif,
              Biaya: dus * tarif
            };
          });
        })();

    const rowsHtml = details.length > 0 ? details.map((d: any, idx: number) => `
      <tr>
        <td style="text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="font-weight: bold; color: #0f172a;">${d.No_Surat_Jalan || '-'}</td>
        <td style="color: #475569;">${formatDateDDMMYYYY(d.Tanggal)}</td>
        <td style="font-family: sans-serif; color: #1e293b;">${d.Pelanggan || '-'}${d.Tujuan ? ` (${d.Tujuan})` : ''}</td>
        <td style="text-align: center; font-weight: bold; color: #0f172a;">${Number(d.Dus || 0).toLocaleString('id-ID')}</td>
        <td style="text-align: right; color: #334155;">${Number(d.Tarif || 0).toLocaleString('id-ID')}</td>
        <td style="text-align: right; font-weight: bold; color: #0f172a;">${Number(d.Biaya || 0).toLocaleString('id-ID')}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="7" style="text-align: center; padding: 12px; color: #64748b; font-style: italic;">
          ${item.Jumlah_Pengiriman || 0} Pengiriman (${item.Total_Dus || 0} Dus)
        </td>
      </tr>
    `;

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Voucher Kas Keluar - ${item.ID_Pencairan}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 10px; color: #0f172a; background: #ffffff; font-size: 11px; }
    .voucher-card { max-width: 720px; margin: 0 auto; border: 1.5px solid #0f172a; border-radius: 8px; padding: 24px; background: #ffffff; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-title { font-size: 17px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: -0.01em; }
    .company-sub { font-size: 11px; color: #475569; margin: 2px 0 0 0; }
    .company-contact { font-size: 10px; color: #64748b; margin: 1px 0 0 0; }
    .badge-box { text-align: right; }
    .badge { background: #0f172a; color: #ffffff; padding: 4px 10px; font-weight: bold; font-size: 11px; border-radius: 4px; display: inline-block; font-family: monospace; letter-spacing: 0.05em; }
    .doc-id { font-family: monospace; font-weight: bold; font-size: 12px; color: #0f172a; margin-top: 5px; }
    .doc-date { font-size: 10px; color: #64748b; margin-top: 1px; }
    .info-box { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 11px; }
    .info-label { color: #64748b; font-size: 10px; display: block; margin-bottom: 2px; }
    .info-val { font-size: 13px; font-weight: bold; color: #0f172a; }
    .info-purpose { grid-column: span 2; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 7px 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; }
    .total-row td { background: #f8fafc; font-weight: bold; font-size: 12px; border-top: 2px solid #0f172a; color: #0f172a; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center; font-size: 11px; margin-top: 36px; padding-top: 8px; }
    .sig-space { height: 55px; }
    .sig-line { border-bottom: 1px solid #475569; width: 140px; margin: 0 auto; padding-bottom: 3px; font-weight: bold; color: #0f172a; }
    @media print {
      body { padding: 0; margin: 0; }
      .voucher-card { border: 1.5px solid #0f172a; margin: 0; width: 100%; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="voucher-card">
    <div class="header">
      <div>
        <h1 class="company-title">PT. ANUGERAH ILLAHI RABBI</h1>
        <p class="company-sub">Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa &amp; Airis</p>
        <p class="company-contact">Klaten, Jawa Tengah • Telp: (0272) 321xxx</p>
      </div>
      <div class="badge-box">
        <div class="badge">BUKTI KAS KELUAR</div>
        <div class="doc-id">${item.ID_Pencairan}</div>
        <div class="doc-date">Tgl: ${formatDateDDMMYYYY(item.Tanggal)}</div>
      </div>
    </div>

    <div class="info-box">
      <div>
        <span class="info-label">Dibayarkan Kepada (Driver):</span>
        <span class="info-val">${item.Nama_Driver}</span>
      </div>
      <div>
        <span class="info-label">Dibayarkan Melalui Akun:</span>
        <span class="info-val">${item.Nama_Akun_Kas || item.Akun_Kas}</span>
      </div>
      <div class="info-purpose">
        <span style="color: #64748b;">Untuk Keperluan: </span>
        <strong>${item.Keterangan || `Pencairan Ongkos Distribusi Driver: ${item.Nama_Driver}`}</strong>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">No</th>
          <th>No. Surat Jalan</th>
          <th>Tanggal</th>
          <th>Pelanggan / Tujuan</th>
          <th style="text-align: center;">Volume Dus</th>
          <th style="text-align: right;">Tarif (Rp)</th>
          <th style="text-align: right;">Jumlah (Rp)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4" style="text-align: right; text-transform: uppercase;">Total Dibayarkan:</td>
          <td style="text-align: center;">${Number(item.Total_Dus || 0).toLocaleString('id-ID')} Dus</td>
          <td></td>
          <td style="text-align: right;">Rp ${Number(item.Total_Biaya || 0).toLocaleString('id-ID')}</td>
        </tr>
      </tfoot>
    </table>

    <div class="sig-row">
      <div>
        <span style="color: #475569;">Diterima Oleh (Driver):</span>
        <div class="sig-space"></div>
        <div class="sig-line">${item.Nama_Driver}</div>
      </div>
      <div>
        <span style="color: #475569;">Kasir / Keuangan:</span>
        <div class="sig-space"></div>
        <div class="sig-line">Admin Finance</div>
      </div>
      <div>
        <span style="color: #475569;">Menyetujui (Manager):</span>
        <div class="sig-space"></div>
        <div class="sig-line">Marko Dwi N.</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    let iframe = document.getElementById('voucher-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'voucher-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 250);
    } else {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(printContent);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
          printWin.close();
        }, 300);
      }
    }
  };

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

    // 1. Sinkronkan pembatalan ke Pencairan Biaya Distribusi (agar status pengiriman kembali ke 'Belum Dicairkan' dan tidak ter-sinkron ulang)
    const currentSettlements = getTableData<DriverSettlementItem>('Pencairan_Biaya_Distribusi', []);
    const refStr = String(item.REFERENSI || '').trim();
    const ketStr = String(item.KETERANGAN || '').trim().toLowerCase();
    const matchedSettlement = currentSettlements.find(s => {
      const sId = String(s.ID_Pencairan || '').trim();
      if (!sId) return false;
      if (refStr && (refStr === sId || refStr.includes(sId) || sId.includes(refStr))) return true;
      if (ketStr && ketStr.includes(sId.toLowerCase())) return true;
      if (safeList(s.No_Surat_Jalan_List).some(sj => ketStr.includes(String(sj).toLowerCase()))) return true;
      if (s.Keterangan && s.Keterangan.trim().toLowerCase() === ketStr) return true;
      return false;
    });

    if (matchedSettlement) {
      const cleanSettlements = currentSettlements.filter(s => s.ID_Pencairan !== matchedSettlement.ID_Pencairan);
      setTableData('Pencairan_Biaya_Distribusi', cleanSettlements);
      setDriverSettlements(cleanSettlements);
    }

    // 2. Sinkronkan pembatalan ke Draf Jurnal
    const currentDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
    const cleanDrafts = currentDrafts.filter(d => {
      if (!d) return false;
      if (d.ID_Draf === item.ID_JURNAL) return false;
      return true;
    });
    setTableData('Draf_Jurnal', cleanDrafts);

    showToast('success', `Transaksi ${item.ID_JURNAL} berhasil dihapus.`);
    onRefresh();
  };

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

  // Hitung jumlah pengiriman armada yang belum dicairkan untuk badge notifikasi tab
  const pendingClaimCount = useMemo(() => {
    const settledSjSet = new Set<string>();
    (driverSettlements || []).forEach(s => {
      const list = Array.isArray(s.No_Surat_Jalan_List) ? s.No_Surat_Jalan_List : [];
      list.forEach(sj => settledSjSet.add(String(sj).trim().toLowerCase()));
    });
    return (distributions || []).filter(d => {
      if (!d || d.Metode_Kirim === 'Ambil Sendiri') return false;
      const sj = String(d.No_Surat_Jalan || '').trim().toLowerCase();
      return sj && !settledSjSet.has(sj);
    }).length;
  }, [distributions, driverSettlements]);

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="text-blue-600" size={24} />
            Akuntansi & Keuangan Terpadu
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jurnal Umum, Buku Pembantu Piutang, Biaya Distribusi Armada, COA Manufaktur, dan Laporan Keuangan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Cetak Halaman (Print)"
          >
            <Printer size={16} />
          </button>

          <button
            onClick={() => {
              if (activeTab === 'neraca') handleExportNeracaPDF();
              else if (activeTab === 'labarugi') handleExportLabaRugiPDF();
              else {
                generateTableReportPDF({
                  title: LAPORAN KEUANGAN (),
                  subtitle: Periode:  | PT. Anugerah Illahi Rabbi,
                  headers: ['Deskripsi', 'Nilai'],
                  rows: [['Laporan Keuangan Resmi', 'Tercatat']],
                  filename: Keuangan_.pdf
                });
              }
            }}
            className="p-2 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Download PDF Laporan"
          >
            <FileDown size={16} />
          </button>

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

      {/* Navigasi Tab Horizontal */}
      <div className="w-full min-w-0 max-w-full overflow-x-auto no-scrollbar py-0.5">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-medium no-print shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('neraca')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'neraca' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Laporan Neraca
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('labarugi')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'labarugi' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Laba Rugi
          </button>
          <button
            type="button"
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
            type="button"
            onClick={() => setActiveTab('jurnal')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'jurnal' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Jurnal Umum
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('coa')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'coa' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Master COA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('aset')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'aset' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aset Tetap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('piutang')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'piutang' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Piutang & Utang
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('biaya_distribusi')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'biaya_distribusi' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck size={14} />
            <span>Biaya Distribusi</span>
            {pendingClaimCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                {pendingClaimCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Render Modular Tabs */}
      {activeTab === 'neraca' && (
        <FinanceNeracaTab
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          kasKecil={kasKecil}
          kasBankBSI={kasBankBSI}
          piutangUsaha={piutangUsaha}
          persediaanBahan={persediaanBahan}
          persediaanBarangJadi={persediaanBarangJadi}
          totalAktivaLancar={totalAktivaLancar}
          totalAktivaTetap={totalAktivaTetapNetto}
          akumulasiPenyusutan={totalAkumulasiPenyusutan}
          nilaiBukuAset={totalAktivaTetapNetto}
          totalAktiva={totalAktiva}
          utangUsaha={utangUsahaSupplier}
          utangGaji={utangGaji}
          totalKewajibanLancar={totalKewajibanPendek}
          totalKewajiban={totalKewajiban}
          modalDisetor={modalDisetor}
          labaDitahan={labaDitahan}
          labaTahunBerjalan={labaTahunBerjalan}
          totalEkuitas={totalEkuitas}
          totalPasiva={totalPasiva}
          isBalance={isBalance}
          selisihBalance={selisihNeraca}
          handleExportNeracaPDF={handleExportNeracaPDF}
          assets={assets}
          coas={coas}
        />
      )}

      {activeTab === 'labarugi' && (
        <FinanceLabaRugiTab
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          pendapatanPenjualan={totalRevBersih}
          pendapatanLainnya={0}
          totalPendapatan={totalRevBersih}
          hppTotal={totalHPP}
          labaKotor={labaKotor}
          bebanOperasional={totalBebanOperasional}
          bebanPenyusutan={bebanSusutKendaraan}
          bebanGaji={bebanGajiStaff}
          totalBeban={totalBebanOperasional}
          labaBersih={labaBersihOperasional}
          handleExportLabaRugiPDF={handleExportLabaRugiPDF}
        />
      )}

      {activeTab === 'drafts' && (
        <FinanceDraftsTab
          draftJournals={draftJournals}
          filteredDrafts={filteredDrafts}
          draftFilterMonth={draftFilterMonth}
          setDraftFilterMonth={setDraftFilterMonth}
          draftSortOrder={draftSortOrder}
          setDraftSortOrder={setDraftSortOrder}
          draftSearchQuery={draftSearchQuery}
          setDraftSearchQuery={setDraftSearchQuery}
          selectedDraftIds={selectedDraftIds}
          toggleSelectDraft={(id) => {
            const next = new Set(selectedDraftIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setSelectedDraftIds(next);
          }}
          toggleSelectAllDrafts={() => {
            if (selectedDraftIds.size === filteredDrafts.length) {
              setSelectedDraftIds(new Set());
            } else {
              setSelectedDraftIds(new Set(filteredDrafts.map(d => d.ID_Draf)));
            }
          }}
          handleVerifyAndPostDraft={async (d) => handleVerifyDraft(d.ID_Draf)}
          handleVerifyBatchDrafts={async () => handleBulkVerifyDrafts()}
          handleDeleteDraft={handleDeleteDraft}
          handleDeleteBatchDrafts={async () => {
            const updated = draftJournals.filter(d => !selectedDraftIds.has(d.ID_Draf));
            setTableData('Draf_Jurnal', updated);
            setSelectedDraftIds(new Set());
            showToast('success', 'Draf jurnal terpilih berhasil dibersihkan.');
            onRefresh();
          }}
          handleSyncAllModules={async () => handleSyncAllModules()}
          isSyncing={isSyncing}
        />
      )}

      {activeTab === 'jurnal' && (
        <FinanceJurnalTab
          filteredJournals={filteredJournals}
          journalSearchQuery={journalSearchQuery}
          setJournalSearchQuery={setJournalSearchQuery}
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          coas={coas}
          onOpenAddJournal={handleOpenAddJournal}
          onOpenDoubleEntry={handleOpenAddJournal}
          onEditJournal={handleOpenEditJournal}
          onDeleteJournal={handleDeleteJournal}
          handleExportJournalExcel={() => {
            exportDataToExcel(filteredJournals, 'Jurnal_Umum', AIRIS_Jurnal_);
          }}
          showJournalModal={showJournalModal}
          setShowJournalModal={setShowJournalModal}
          editingJournal={editingJournal}
          journalForm={journalForm}
          setJournalForm={setJournalForm}
          handleSaveJournal={handleSaveJournal}
        />
      )}

      {activeTab === 'coa' && (
        <FinanceCOATab
          filteredCoas={filteredCoas}
          searchCoa={searchCoa}
          setSearchCoa={setSearchCoa}
          onOpenAddCoa={() => {
            setEditingCoa(null);
            setCoaForm({
              KODE_AKUN: '',
              NAMA_AKUN: '',
              KATEGORI: 'Aset Lancar',
              SALDO_NORMAL: 'Debit',
              STATUS: 'Aktif'
            });
            setShowCoaModal(true);
          }}
          onEditCoa={(c) => {
            setEditingCoa(c);
            setCoaForm(c);
            setShowCoaModal(true);
          }}
          onDeleteCoa={async (kode) => {
            const ok = await confirmAction({
              title: 'Hapus Akun COA',
              message: Hapus akun ? Pastikan akun ini tidak memiliki riwayat jurnal transaksi.,
              confirmText: 'Ya, Hapus Akun',
              cancelText: 'Batal',
              type: 'danger'
            });
            if (!ok) return;
            const updated = coas.filter(c => c.KODE_AKUN !== kode);
            setTableData('Bagan_Akun', updated);
            showToast('success', Akun  berhasil dihapus.);
            onRefresh();
          }}
          handleExportCoaExcel={() => {
            exportDataToExcel(filteredCoas, 'Master_COA', 'AIRIS_Bagan_Akun_COA');
          }}
          handleUpgradeCOA={handleResetFactoryCoa}
          showCoaModal={showCoaModal}
          setShowCoaModal={setShowCoaModal}
          editingCoa={editingCoa}
          coaForm={coaForm}
          setCoaForm={setCoaForm}
          handleSaveCoa={() => {
            if (editingCoa) {
              const updated = coas.map(c => c.KODE_AKUN === editingCoa.KODE_AKUN ? { ...c, ...coaForm } : c);
              setTableData('Bagan_Akun', updated);
              showToast('success', 'Akun COA berhasil diperbarui.');
            } else {
              setTableData('Bagan_Akun', [...coas, coaForm]);
              showToast('success', 'Akun COA baru berhasil ditambahkan.');
            }
            setShowCoaModal(false);
            onRefresh();
          }}
        />
      )}

      {activeTab === 'aset' && (
        <FinanceAsetTab
          assets={assets}
          onOpenAddAsset={() => {
            setEditingAsset(null);
            setAssetForm({
              ID_ASET: AST-,
              NAMA_ASET: '',
              KATEGORI: 'Mesin & Peralatan Pabrik',
              TANGGAL_PEROLEHAN: new Date().toISOString().slice(0, 10),
              NILAI_PEROLEHAN: '' as any,
              NILAI_RESIDU: '' as any,
              UMUR_EKONOMIS_BLN: '' as any,
              BEBAN_PENYUSUTAN_BLN: '' as any,
              AKUN_ASET: '121-20',
              AKUN_AKUMULASI: '122-20',
              AKUN_BEBAN: '514-20'
            });
            setShowAssetModal(true);
          }}
          onEditAsset={(a) => {
            setEditingAsset(a);
            setAssetForm(a);
            setShowAssetModal(true);
          }}
          onDeleteAsset={async (id) => {
            const ok = await confirmAction({
              title: 'Hapus Aset Tetap',
              message: Hapus data aset ?,
              confirmText: 'Ya, Hapus Aset',
              cancelText: 'Batal',
              type: 'danger'
            });
            if (!ok) return;
            const updated = assets.filter(a => a.ID_ASET !== id);
            setTableData('Aset_Tetap', updated);
            showToast('success', Aset  berhasil dihapus.);
            onRefresh();
          }}
          handleExportAssetExcel={() => {
            exportDataToExcel(assets, 'Aset_Tetap', 'AIRIS_Daftar_Aset_Tetap');
          }}
          showAssetModal={showAssetModal}
          setShowAssetModal={setShowAssetModal}
          editingAsset={editingAsset}
          assetForm={assetForm}
          setAssetForm={setAssetForm}
          handleSaveAsset={() => {
            if (editingAsset) {
              const updated = assets.map(a => a.ID_ASET === editingAsset.ID_ASET ? { ...a, ...assetForm } : a);
              setTableData('Aset_Tetap', updated);
              showToast('success', 'Data aset berhasil diperbarui.');
            } else {
              setTableData('Aset_Tetap', [...assets, assetForm]);
              showToast('success', 'Aset baru berhasil dicatat.');
            }
            setShowAssetModal(false);
            onRefresh();
          }}
        />
      )}

      {activeTab === 'piutang' && (
        <FinancePiutangTab
          receivables={receivables}
          distributions={distributions}
          distributionItems={distributionItems}
          customers={customers}
          customerPayments={customerPayments}
          setCustomerPayments={setCustomerPayments}
          defaultPeriod={defaultPeriod}
          onRefresh={onRefresh}
          showToast={showToast}
        />
      )}

      {activeTab === 'biaya_distribusi' && (
        <FinanceBiayaDistribusiTab
          distributions={distributions}
          distributionItems={distributionItems}
          driverSettlements={driverSettlements}
          setDriverSettlements={setDriverSettlements}
          defaultPeriod={defaultPeriod}
          onRefresh={onRefresh}
          showToast={showToast}
        />
      )}
    </div>
  );
};