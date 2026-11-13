import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, CreditCard, Plus, Printer, Download, Eye, 
  Trash2, Edit2, FileCheck, X, Building, Save, FileText,
  FileDown, Send, CheckCircle2, Search, Check, RefreshCw, Calendar,
  RotateCcw, Filter, ExternalLink, Clock, PackageCheck, AlertCircle, FileSpreadsheet,
  ArrowRight, ArrowUpRight, ArrowDownLeft, ChevronRight, ShieldCheck, Wallet, Calculator
} from 'lucide-react';
import { 
  ReceivablePayableItem, DistributionItem, DistributionProductDetail, 
  CustomerItem, CustomerPaymentRecord, CustomerLedgerSummary 
} from '../../types';
import { getTableData, setTableData, deleteTableRow, isRadityaVariant } from '../../services/dbAdapter';
import { exportDataToExcel } from '../../services/excelService';
import { generateTableReportPDF, formatRupiahSen, angkaKeTerbilang } from '../../services/pdfService';
import { showToast as showToastGlobal } from '../ToastContainer';
import { confirmAction } from '../ConfirmDialog';
import { formatDateDDMMYYYY } from '../../services/formatters';

interface FinancePiutangTabProps {
  receivables: ReceivablePayableItem[];
  distributions?: DistributionItem[];
  distributionItems?: DistributionProductDetail[];
  customers?: CustomerItem[];
  customerPayments: CustomerPaymentRecord[];
  setCustomerPayments: React.Dispatch<React.SetStateAction<CustomerPaymentRecord[]>>;
  defaultPeriod: string;
  onRefresh: () => void;
  showToast: (type: 'success' | 'warning' | 'error' | 'info', text: string) => void;
}

export const FinancePiutangTab: React.FC<FinancePiutangTabProps> = ({
  receivables,
  distributions = [],
  distributionItems = [],
  customers = [],
  customerPayments,
  setCustomerPayments,
  defaultPeriod,
  onRefresh,
  showToast
}) => {
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
  const [custDetailSubTab, setCustDetailSubTab] = useState<'transaksi' | 'transportasi'>('transaksi');
  const [searchCustQuery, setSearchCustQuery] = useState<string>('');
  const [custFilterStatus, setCustFilterStatus] = useState<'all' | 'piutang' | 'deposit' | 'lunas'>('all');
  const [piutangSearchQuery, setPiutangSearchQuery] = useState<string>('');
  const [piutangTypeFilter, setPiutangTypeFilter] = useState<'all' | 'Piutang' | 'Utang'>('all');
  const [piutangFilterYear, setPiutangFilterYear] = useState<string>('all');
  const [piutangFilterMonth, setPiutangFilterMonth] = useState<string>('all');

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
  useEffect(() => {
    const handleDbChange = () => {
      setCustomerPayments(getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', []));
    };
    window.addEventListener('airis_db_updated', handleDbChange);
    window.addEventListener('storage', handleDbChange);
    return () => {
      window.removeEventListener('airis_db_updated', handleDbChange);
      window.removeEventListener('storage', handleDbChange);
    };
  }, [setCustomerPayments]);
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

  // Helper ekstraksi komponen tanggal (Tahun, Bulan, Hari) secara presisi dan terstruktur
  const extractDateParts = (raw: any): { year: string; month: string; day: string } | null => {
    if (!raw && raw !== 0) return null;
    const str = String(raw).trim();
    if (!str || str === '-' || str === 'null' || str === 'undefined') return null;

    // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      return {
        year: isoMatch[1],
        month: isoMatch[2].padStart(2, '0'),
        day: isoMatch[3].padStart(2, '0')
      };
    }

    // 2. Format Indonesia dengan teks bulan (misal "5 FEBRUARI 2025", "05-Feb-2025")
    const monthMap: Record<string, string> = {
      jan: '01', januari: '01', january: '01',
      feb: '02', februari: '02', february: '02',
      mar: '03', maret: '03', march: '03',
      apr: '04', april: '04',
      mei: '05', may: '05',
      jun: '06', juni: '06', june: '06',
      jul: '07', juli: '07', july: '07',
      agu: '08', agust: '08', agustus: '08', aug: '08', august: '08',
      sep: '09', sept: '09', september: '09',
      okt: '10', oktober: '10', oct: '10', october: '10',
      nov: '11', nop: '11', nopember: '11', november: '11',
      des: '12', desember: '12', dec: '12', december: '12'
    };

    const textMonthMatch = str.match(/^(\d{1,2})[-\s/.]+([A-Za-z]+)[-\s/.]+(\d{2,4})/);
    if (textMonthMatch) {
      const day = textMonthMatch[1].padStart(2, '0');
      const monStr = textMonthMatch[2].toLowerCase();
      let mon = monthMap[monStr];
      if (!mon) {
        for (const [key, val] of Object.entries(monthMap)) {
          if (monStr.startsWith(key)) {
            mon = val;
            break;
          }
        }
      }
      let yr = textMonthMatch[3];
      if (yr.length === 2) {
        yr = parseInt(yr, 10) >= 50 ? '19' + yr : '20' + yr;
      }
      if (mon) {
        return { year: yr, month: mon, day };
      }
    }

    // 3. Format DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const mon = dmyMatch[2].padStart(2, '0');
      let yr = dmyMatch[3];
      if (yr.length === 2) {
        yr = parseInt(yr, 10) >= 50 ? '19' + yr : '20' + yr;
      }
      return { year: yr, month: mon, day };
    }

    // 4. Excel serial number (misal 45693 = 2025-02-05)
    if (/^\d{5}$/.test(str)) {
      const serial = parseInt(str, 10);
      const date = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return {
          year: String(date.getUTCFullYear()),
          month: String(date.getUTCMonth() + 1).padStart(2, '0'),
          day: String(date.getUTCDate()).padStart(2, '0')
        };
      }
    }

    return null;
  };

  // Helper ekstraksi bulan YYYY-MM dari record tagihan / utang
  const getReceivableMonthKey = (r: ReceivablePayableItem): string => {
    const parts = extractDateParts(r.Tanggal || r.TANGGAL) || extractDateParts(r.Tgl_Jatuh_Tempo || r.JATUH_TEMPO);
    return parts ? `${parts.year}-${parts.month}` : '';
  };

  // Helper ekstraksi tahun YYYY dari record tagihan / utang
  const getReceivableYear = (r: ReceivablePayableItem): string => {
    const parts = extractDateParts(r.Tanggal || r.TANGGAL) || extractDateParts(r.Tgl_Jatuh_Tempo || r.JATUH_TEMPO);
    return parts ? parts.year : '';
  };

  // Daftar tahun unik yang tersedia pada data tagihan/utang
  const availablePiutangYears = useMemo(() => {
    const map = new Map<string, number>();
    allReceivablesList.forEach(r => {
      const yr = getReceivableYear(r);
      if (yr && /^\d{4}$/.test(yr)) {
        map.set(yr, (map.get(yr) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [allReceivablesList]);

  // Daftar periode bulan unik yang tersedia pada data tagihan/utang (bisa difilter per tahun)
  const availablePiutangMonths = useMemo(() => {
    const map = new Map<string, number>();
    allReceivablesList.forEach(r => {
      if (piutangFilterYear !== 'all' && getReceivableYear(r) !== piutangFilterYear) return;
      const key = getReceivableMonthKey(r);
      if (key && /^\d{4}-\d{2}$/.test(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [allReceivablesList, piutangFilterYear]);

  // Format label bulan bahasa Indonesia (contoh: '2025-02' => 'Februari 2025')
  const formatPeriodMonthName = (periodStr: string): string => {
    if (!periodStr || periodStr === 'all') return 'Semua Periode';
    const parts = periodStr.split('-');
    if (parts.length !== 2) return periodStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[monthIdx] || parts[1]} ${year}`;
  };

  // Data tagihan dalam periode yang dipilih (mematuhi filter tahun dan filter bulan secara isolatif dan ketat)
  const receivablesInMonth = useMemo(() => {
    return allReceivablesList.filter(r => {
      if (piutangFilterYear !== 'all' && getReceivableYear(r) !== piutangFilterYear) return false;
      if (piutangFilterMonth !== 'all' && getReceivableMonthKey(r) !== piutangFilterMonth) return false;
      return true;
    });
  }, [allReceivablesList, piutangFilterYear, piutangFilterMonth]);

  // -------------------------------------------------------------
  // REKAPITULASI BUKU PEMBANTU PER PELANGGAN (PEMBELIAN, BAYAR, SALDO/DEPOSIT, LOGISTIK)
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
      metodeKirim: string;
      pengirim: string;
      penerima: string;
      totalQty: number;
      nominal: number;
      items: DistributionProductDetail[];
    }[];
    pembayaranList: CustomerPaymentRecord[];
    // METRIK SUBSIDI POTONGAN AMBIL SENDIRI (Rp 1.000 / DUS)
    ambilSendiriSummary: {
      totalTransaksi: number;
      totalDus: number;
      totalHakPotongan: number;
      potonganDicairkan: number;
      potonganBelumDicairkan: number;
      daftarTransaksi: {
        idDistribusi: string;
        tanggal: string;
        noSuratJalan: string;
        noInvoice: string;
        penerima: string;
        totalDus: number;
        hakPotongan: number;
        isClaimed: boolean;
        claimedDate?: string;
        claimedRef?: string;
      }[];
    };
    // METRIK PENGIRIMAN DRIVER ARMADA PABRIK (KIRIM ARMADA)
    driverSummary: {
      totalDus: number;
      totalTrip: number;
      estimasiBiayaTransport: number;
      perDriver: {
        namaDriver: string;
        totalDus: number;
        totalTrip: number;
        estimasiBiaya: number;
      }[];
      daftarPengiriman: {
        idDistribusi: string;
        tanggal: string;
        noSuratJalan: string;
        noInvoice: string;
        namaDriver: string;
        tujuan: string;
        totalDus: number;
        estimasiBiaya: number;
      }[];
    };
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
        const totalQty = itms.reduce((s, it) => s + (Number(it.Qty) || 0), 0);
        let nominal = Number(d.Total_Tagihan);
        if (isNaN(nominal) || nominal <= 0) {
          nominal = itms.reduce((s, it) => s + (Number(it.Subtotal) || (Number(it.Qty) * Number(it.Harga_Satuan)) || 0), 0);
        }
        return {
          id: d.ID_Distribusi,
          tanggal: d.Tanggal,
          noSuratJalan: d.No_Surat_Jalan || '-',
          noInvoice: d.No_Invoice || `INV-${d.No_Surat_Jalan || d.ID_Distribusi}`,
          metodeKirim: d.Metode_Kirim || 'Kirim Armada',
          pengirim: d.Pengirim || '-',
          penerima: d.Penerima || d.Nama_Pelanggan || '-',
          totalQty,
          nominal,
          items: itms
        };
      });

      const totalTagihan = pembelianList.reduce((s, p) => s + p.nominal, 0);

      // Semua transaksi pembayaran dari pelanggan ini (O(1) Map lookup)
      const pembayaranList = customerPaymentsByNameMap.get(key) || [];
      const totalBayar = pembayaranList.reduce((s, p) => s + Number(p.Jumlah_Bayar || 0), 0);

      // Saring pembayaran yang merupakan pencairan potongan ongkir ambil sendiri
      const claimPayments = pembayaranList.filter(p => {
        const met = String(p.Metode || '').toLowerCase();
        const ket = String(p.Keterangan || '').toLowerCase();
        return met.includes('ambil sendiri') || ket.includes('ambil sendiri') || ket.includes('potongan ongkir');
      });

      // 1. Akumulasi & Pelacakan Ambil Sendiri
      const ambilSendiriTransaksiList: CustomerLedgerSummary['ambilSendiriSummary']['daftarTransaksi'] = [];
      let totalDusAmbilSendiri = 0;
      let totalHakPotonganAmbilSendiri = 0;
      let totalPotonganDicairkan = 0;

      // 2. Akumulasi Pengiriman Driver Armada Pabrik
      const driverMap = new Map<string, { namaDriver: string; totalDus: number; totalTrip: number; estimasiBiaya: number }>();
      const daftarPengirimanDriver: CustomerLedgerSummary['driverSummary']['daftarPengiriman'] = [];
      let totalDusKirimArmada = 0;
      let totalTripDriver = 0;

      custDist.forEach(d => {
        const itms = distItemsMap.get(String(d.ID_Distribusi).trim()) || [];
        const totalDus = itms.reduce((s, it) => s + (Number(it.Qty) || 0), 0);
        const isAmbilSendiri = d.Metode_Kirim === 'Ambil Sendiri';

        if (isAmbilSendiri) {
          const hakPotongan = totalDus * 1000;
          totalDusAmbilSendiri += totalDus;
          totalHakPotonganAmbilSendiri += hakPotongan;

          const sj = String(d.No_Surat_Jalan || '').trim().toLowerCase();
          const id = String(d.ID_Distribusi || '').trim().toLowerCase();
          const match = claimPayments.find(p => {
            const ref = String(p.No_Referensi || '').trim().toLowerCase();
            const ket = String(p.Keterangan || '').trim().toLowerCase();
            return (sj && (ref === sj || ket.includes(sj))) || (id && (ref === id || ket.includes(id)));
          });

          const isClaimed = !!match;
          if (isClaimed) {
            totalPotonganDicairkan += hakPotongan;
          }

          ambilSendiriTransaksiList.push({
            idDistribusi: d.ID_Distribusi,
            tanggal: d.Tanggal,
            noSuratJalan: d.No_Surat_Jalan || '-',
            noInvoice: d.No_Invoice || `INV-${d.No_Surat_Jalan || d.ID_Distribusi}`,
            penerima: d.Penerima || d.Nama_Pelanggan || '-',
            totalDus,
            hakPotongan,
            isClaimed,
            claimedDate: match?.Tanggal,
            claimedRef: match?.No_Referensi || match?.ID_Pembayaran
          });
        } else {
          // Kirim Armada Pabrik
          const driverName = normalizeDistributionDriver(d.Pengirim, true);
          const estimasiBiaya = totalDus * 1000; // Standar biaya armada distribusi pabrik Rp 1.000/dus
          totalDusKirimArmada += totalDus;
          totalTripDriver += 1;

          const cur = driverMap.get(driverName) || { namaDriver: driverName, totalDus: 0, totalTrip: 0, estimasiBiaya: 0 };
          cur.totalDus += totalDus;
          cur.totalTrip += 1;
          cur.estimasiBiaya += estimasiBiaya;
          driverMap.set(driverName, cur);

          daftarPengirimanDriver.push({
            idDistribusi: d.ID_Distribusi,
            tanggal: d.Tanggal,
            noSuratJalan: d.No_Surat_Jalan || '-',
            noInvoice: d.No_Invoice || `INV-${d.No_Surat_Jalan || d.ID_Distribusi}`,
            namaDriver: driverName,
            tujuan: d.Tujuan || '-',
            totalDus,
            estimasiBiaya
          });
        }
      });

      const potonganBelumDicairkan = Math.max(0, totalHakPotonganAmbilSendiri - totalPotonganDicairkan);
      const estimasiTotalTransportDriver = totalDusKirimArmada * 1000;

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
        pembayaranList,
        ambilSendiriSummary: {
          totalTransaksi: ambilSendiriTransaksiList.length,
          totalDus: totalDusAmbilSendiri,
          totalHakPotongan: totalHakPotonganAmbilSendiri,
          potonganDicairkan: totalPotonganDicairkan,
          potonganBelumDicairkan,
          daftarTransaksi: ambilSendiriTransaksiList
        },
        driverSummary: {
          totalDus: totalDusKirimArmada,
          totalTrip: totalTripDriver,
          estimasiBiayaTransport: estimasiTotalTransportDriver,
          perDriver: Array.from(driverMap.values()).sort((a, b) => b.totalDus - a.totalDus),
          daftarPengiriman: daftarPengirimanDriver
        }
      };
    });
  }, [customers, distributions, distributionsByCustMap, distItemsMap, customerPaymentsByNameMap]);

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

  // Pencairan Kompensasi Subsidi Potongan Ongkir Ambil Sendiri (Rp 1.000 / dus) ke Saldo Piutang Konsumen
  const handleClaimAmbilSendiri = async (
    item: { idDistribusi: string; noSuratJalan: string; totalDus: number; hakPotongan: number },
    cust: { idPelanggan: string; namaPelanggan: string }
  ) => {
    const ok = await confirmAction({
      title: 'Cairkan Potongan Ongkir Ambil Sendiri',
      message: `Cairkan hak potongan ongkir sebesar Rp ${item.hakPotongan.toLocaleString('id-ID')} (${item.totalDus} dus x Rp 1.000) untuk Surat Jalan ${item.noSuratJalan} pelanggan "${cust.namaPelanggan}"? Potongan ini akan dicatat ke pembayaran dan langsung mengurangi sisa saldo piutang.`,
      confirmText: 'Ya, Cairkan ke Piutang',
      cancelText: 'Batal',
      type: 'info',
      itemDetails: {
        'Pelanggan': cust.namaPelanggan,
        'No. Surat Jalan': item.noSuratJalan,
        'Jumlah Muatan': `${item.totalDus} Dus`,
        'Tarif Kompensasi': 'Rp 1.000 / dus',
        'Total Kompensasi Ongkir': `Rp ${item.hakPotongan.toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const currentPayments = getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', []);
    const newPayId = `PAY-AMB-${Date.now().toString().slice(-6)}`;
    const newPayment: CustomerPaymentRecord = {
      ID_Pembayaran: newPayId,
      Tanggal: new Date().toISOString().slice(0, 10),
      ID_Pelanggan: cust.idPelanggan,
      Nama_Pelanggan: cust.namaPelanggan,
      Jumlah_Bayar: item.hakPotongan,
      Metode: 'Potongan Ambil Sendiri',
      No_Referensi: item.noSuratJalan || item.idDistribusi,
      Keterangan: `Pencairan potongan ongkir ambil sendiri (${item.totalDus} unit x Rp 1.000) untuk SJ ${item.noSuratJalan}`,
      Waktu_Input: new Date().toISOString()
    };

    const updated = [...currentPayments, newPayment];
    setTableData('Data_Pembayaran_Pelanggan', updated);
    setCustomerPayments(updated);
    showToast('success', `Hak kompensasi ongkir Rp ${item.hakPotongan.toLocaleString('id-ID')} untuk SJ ${item.noSuratJalan} berhasil dicairkan dan memotong piutang pelanggan!`);
    onRefresh();
  };

  const handleClaimAllAmbilSendiri = async (
    unclaimedItems: { idDistribusi: string; noSuratJalan: string; totalDus: number; hakPotongan: number }[],
    cust: { idPelanggan: string; namaPelanggan: string }
  ) => {
    if (!unclaimedItems || unclaimedItems.length === 0) return;
    const totalNominal = unclaimedItems.reduce((s, it) => s + it.hakPotongan, 0);
    const totalDus = unclaimedItems.reduce((s, it) => s + it.totalDus, 0);

    const ok = await confirmAction({
      title: 'Cairkan Semua Kompensasi Ongkir Pending',
      message: `Cairkan sekaligus ${unclaimedItems.length} transaksi ambil sendiri (${totalDus} dus) senilai total Rp ${totalNominal.toLocaleString('id-ID')} untuk pelanggan "${cust.namaPelanggan}"? Nilai ini akan langsung dipotongkan ke buku piutang.`,
      confirmText: 'Ya, Cairkan Semua Sekaligus',
      cancelText: 'Batal',
      type: 'info',
      itemDetails: {
        'Pelanggan': cust.namaPelanggan,
        'Total Transaksi': `${unclaimedItems.length} Pengiriman Ambil Sendiri`,
        'Total Dus Diambil': `${totalDus} Dus`,
        'Total Potongan Ongkir': `Rp ${totalNominal.toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const currentPayments = getTableData<CustomerPaymentRecord>('Data_Pembayaran_Pelanggan', []);
    const timestamp = Date.now().toString().slice(-6);
    const newRecords: CustomerPaymentRecord[] = unclaimedItems.map((item, idx) => ({
      ID_Pembayaran: `PAY-AMB-${timestamp}-${idx + 1}`,
      Tanggal: new Date().toISOString().slice(0, 10),
      ID_Pelanggan: cust.idPelanggan,
      Nama_Pelanggan: cust.namaPelanggan,
      Jumlah_Bayar: item.hakPotongan,
      Metode: 'Potongan Ambil Sendiri',
      No_Referensi: item.noSuratJalan || item.idDistribusi,
      Keterangan: `Pencairan potongan ongkir ambil sendiri (${item.totalDus} unit x Rp 1.000) untuk SJ ${item.noSuratJalan}`,
      Waktu_Input: new Date().toISOString()
    }));

    const updated = [...currentPayments, ...newRecords];
    setTableData('Data_Pembayaran_Pelanggan', updated);
    setCustomerPayments(updated);
    showToast('success', `Berhasil mencairkan ${newRecords.length} transaksi kompensasi ongkir (Total Rp ${totalNominal.toLocaleString('id-ID')}) ke saldo piutang!`);
    onRefresh();
  };

  return (
    <>
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

                      {/* Sub-Navigasi Detail Pelanggan */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCustDetailSubTab('transaksi')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                              custDetailSubTab === 'transaksi'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <FileText size={14} />
                            <span>Faktur & Pembayaran ({sel.pembelianList.length})</span>
                          </button>
                          <button
                            onClick={() => setCustDetailSubTab('transportasi')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                              custDetailSubTab === 'transportasi'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            <Truck size={14} />
                            <span>Distribusi & Transportasi</span>
                            {sel.ambilSendiriSummary.potonganBelumDicairkan > 0 && (
                              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-extrabold">
                                {sel.ambilSendiriSummary.daftarTransaksi.filter(t => !t.isClaimed).length} Pending
                              </span>
                            )}
                          </button>
                        </div>

                        {custDetailSubTab === 'transportasi' && sel.ambilSendiriSummary.potonganBelumDicairkan > 0 && (
                          <button
                            onClick={() => handleClaimAllAmbilSendiri(
                              sel.ambilSendiriSummary.daftarTransaksi.filter(t => !t.isClaimed),
                              { idPelanggan: sel.idPelanggan, namaPelanggan: sel.namaPelanggan }
                            )}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Coins size={14} />
                            <span>Cairkan Semua Potongan Pending (Rp {sel.ambilSendiriSummary.potonganBelumDicairkan.toLocaleString('id-ID')})</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* KONTEN SUB-TAB 1: FAKTUR PEMBELIAN & PEMBAYARAN */}
                    {custDetailSubTab === 'transaksi' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Tabel 1: Riwayat Pembelian (Distribusi Terkirim) */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                          <div className="flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <ShoppingBag size={15} className="text-blue-600" />
                              <h5 className="text-xs font-bold text-slate-800">Riwayat Pembelian & Distribusi ({sel.pembelianList.length})</h5>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">Faktur Tagihan (Bruto)</span>
                          </div>
                          <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="p-2.5">Tanggal</th>
                                  <th className="p-2.5">No Invoice / SJ</th>
                                  <th className="p-2.5">Metode Kirim</th>
                                  <th className="p-2.5">Rincian Barang</th>
                                  <th className="p-2.5 text-right">Nilai Tagihan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {sel.pembelianList.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="p-6 text-center text-slate-400 font-sans italic">
                                      Belum ada data distribusi penjualan untuk pelanggan ini.
                                    </td>
                                  </tr>
                                ) : (
                                  sel.pembelianList.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/70">
                                      <td className="p-2.5 text-slate-600 font-mono">{formatDateDDMMYYYY(item.tanggal)}</td>
                                      <td className="p-2.5 font-bold text-blue-700">
                                        <div>{item.noInvoice}</div>
                                        <div className="text-[10px] text-slate-400 font-normal">SJ: {item.noSuratJalan}</div>
                                      </td>
                                      <td className="p-2.5 font-sans">
                                        {item.metodeKirim === 'Ambil Sendiri' ? (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-white whitespace-nowrap inline-block">
                                            Ambil Sendiri
                                          </span>
                                        ) : (
                                          <div>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap inline-block">
                                              Kirim Armada
                                            </span>
                                            <div className="text-[10px] text-slate-500 mt-0.5">Sopir: {item.pengirim}</div>
                                          </div>
                                        )}
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
                                  <td colSpan={4} className="p-2.5 text-right font-sans">Total Tagihan (Bruto):</td>
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
                                      <td className="p-2.5 text-slate-600 font-mono">{formatDateDDMMYYYY(pay.Tanggal)}</td>
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
                    )}

                    {/* KONTEN SUB-TAB 2: DISTRIBUSI, SUBSIDI AMBIL SENDIRI & BIAYA TRANSPORTASI DRIVER */}
                    {custDetailSubTab === 'transportasi' && (
                      <div className="space-y-5">
                        {/* 1. BAGIAN SUBSIDI ONGKIR AMBIL SENDIRI */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Coins size={18} />
                              </span>
                              <div>
                                <h5 className="text-sm font-bold text-slate-900">
                                  Akumulasi Kompensasi Subsidi Ongkir (Ambil Sendiri)
                                </h5>
                                <p className="text-xs text-slate-500">
                                  Pengambilan mandiri langsung di pabrik berhak atas subsidi Rp 1.000 / dus yang dikurangkan ke saldo piutang.
                                </p>
                              </div>
                            </div>

                            {sel.ambilSendiriSummary.potonganBelumDicairkan > 0 && (
                              <button
                                onClick={() => handleClaimAllAmbilSendiri(
                                  sel.ambilSendiriSummary.daftarTransaksi.filter(t => !t.isClaimed),
                                  { idPelanggan: sel.idPelanggan, namaPelanggan: sel.namaPelanggan }
                                )}
                                className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <CheckCircle2 size={14} />
                                <span>Cairkan Semua Pending (Rp {sel.ambilSendiriSummary.potonganBelumDicairkan.toLocaleString('id-ID')})</span>
                              </button>
                            )}
                          </div>

                          {/* 4 Kartu Metrik Ambil Sendiri */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block text-[11px]">Total Transaksi Ambil Mandiri</span>
                              <span className="text-sm font-bold text-slate-900 font-mono">
                                {sel.ambilSendiriSummary.totalTransaksi} Transaksi ({sel.ambilSendiriSummary.totalDus.toLocaleString('id-ID')} Dus)
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block text-[11px]">Total Hak Subsidi (@ Rp 1.000)</span>
                              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                                Rp {sel.ambilSendiriSummary.totalHakPotongan.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                              <span className="text-emerald-700 block text-[11px] font-semibold">Sudah Dicairkan (Potong Piutang)</span>
                              <span className="text-sm font-bold text-emerald-800 font-mono tabular-nums">
                                Rp {sel.ambilSendiriSummary.potonganDicairkan.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className={`p-2.5 rounded-lg border ${sel.ambilSendiriSummary.potonganBelumDicairkan > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                              <span className="text-amber-800 block text-[11px] font-semibold">Belum Dicairkan (Pending Klaim)</span>
                              <span className={`text-sm font-bold font-mono tabular-nums ${sel.ambilSendiriSummary.potonganBelumDicairkan > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                                Rp {sel.ambilSendiriSummary.potonganBelumDicairkan.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>

                          {/* Tabel Rincian Transaksi Ambil Sendiri */}
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                              <span>Daftar Pengambilan Mandiri & Status Pencairan Ongkir</span>
                              <span className="text-[11px] text-slate-500 font-normal">
                                {sel.ambilSendiriSummary.daftarTransaksi.length} Data Pengambilan
                              </span>
                            </div>
                            <div className="overflow-x-auto max-h-72">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 sticky top-0">
                                  <tr>
                                    <th className="p-2.5">Tanggal</th>
                                    <th className="p-2.5">No. Surat Jalan / Invoice</th>
                                    <th className="p-2.5">Pengambil / Penerima</th>
                                    <th className="p-2.5 text-center">Volume Muatan</th>
                                    <th className="p-2.5 text-right">Hak Potongan</th>
                                    <th className="p-2.5 text-center">Status Ongkir</th>
                                    <th className="p-2.5 text-center">Aksi Pencairan</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                  {sel.ambilSendiriSummary.daftarTransaksi.length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="p-6 text-center text-slate-400 font-sans italic">
                                        Pelanggan ini belum memiliki riwayat transaksi metode 'Ambil Sendiri'.
                                      </td>
                                    </tr>
                                  ) : (
                                    sel.ambilSendiriSummary.daftarTransaksi.map((item, idx) => (
                                      <tr key={item.idDistribusi || idx} className="hover:bg-slate-50/70">
                                        <td className="p-2.5 text-slate-600">{formatDateDDMMYYYY(item.tanggal)}</td>
                                        <td className="p-2.5">
                                          <div className="font-bold text-blue-700">{item.noSuratJalan}</div>
                                          <div className="text-[10px] text-slate-400 font-normal">{item.noInvoice}</div>
                                        </td>
                                        <td className="p-2.5 font-sans text-slate-800">{item.penerima}</td>
                                        <td className="p-2.5 text-center font-bold text-slate-800">
                                          {item.totalDus.toLocaleString('id-ID')} Dus
                                        </td>
                                        <td className="p-2.5 text-right font-bold text-emerald-700 tabular-nums">
                                          Rp {item.hakPotongan.toLocaleString('id-ID')}
                                        </td>
                                        <td className="p-2.5 text-center font-sans">
                                          {item.isClaimed ? (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                              <CheckCircle2 size={11} className="text-emerald-600" />
                                              <span>Sudah Dicairkan</span>
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                                              Belum Dicairkan
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-center font-sans">
                                          {item.isClaimed ? (
                                            <span className="text-[11px] text-slate-400 italic font-mono">
                                              {item.claimedDate ? formatDateDDMMYYYY(item.claimedDate) : 'Lunas Potong'}
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleClaimAmbilSendiri(item, { idPelanggan: sel.idPelanggan, namaPelanggan: sel.namaPelanggan })}
                                              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
                                              title="Cairkan potongan ongkir ini langsung ke piutang pelanggan"
                                            >
                                              <Coins size={12} />
                                              <span>Cairkan</span>
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* 2. BAGIAN PENGIRIMAN DRIVER ARMADA PABRIK */}
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4">
                          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                            <span className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                              <Truck size={18} />
                            </span>
                            <div>
                              <h5 className="text-sm font-bold text-slate-900">
                                Rekapitulasi Distribusi Driver Armada Pabrik
                              </h5>
                              <p className="text-xs text-slate-500">
                                Pemantauan muatan produk yang diantar oleh driver/sopir pabrik per konsumen untuk evaluasi biaya transportasi.
                              </p>
                            </div>
                          </div>

                          {/* Kartu Ringkasan Muatan Driver */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block text-[11px]">Total Muatan Terkirim Armada Pabrik</span>
                              <span className="text-sm font-bold text-blue-700 font-mono">
                                {sel.driverSummary.totalDus.toLocaleString('id-ID')} Dus
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block text-[11px]">Frekuensi Pengiriman (Trip / Rit)</span>
                              <span className="text-sm font-bold text-slate-900 font-mono">
                                {sel.driverSummary.totalTrip} Kali Trip Pengiriman
                              </span>
                            </div>
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <span className="text-slate-500 block text-[11px]">Estimasi Alokasi Biaya Transport Pabrik</span>
                              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                                Rp {sel.driverSummary.estimasiBiayaTransport.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">* Berdasarkan acuan Rp 1.000 / dus</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
                            {/* Rekap Per Driver Pabrik */}
                            <div className="lg:col-span-1 border border-slate-200 rounded-lg overflow-hidden">
                              <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                                <span>Distribusi Per Driver</span>
                                <span className="text-[10px] text-slate-400 font-mono">{sel.driverSummary.perDriver.length} Driver</span>
                              </div>
                              <div className="overflow-x-auto max-h-64">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200">
                                    <tr>
                                      <th className="p-2">Nama Driver</th>
                                      <th className="p-2 text-center">Rit</th>
                                      <th className="p-2 text-right">Volume</th>
                                      <th className="p-2 text-right">Biaya Kirim</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                    {sel.driverSummary.perDriver.length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="p-4 text-center text-slate-400 font-sans italic">
                                          Belum ada data pengiriman armada.
                                        </td>
                                      </tr>
                                    ) : (
                                      sel.driverSummary.perDriver.map((drv, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                          <td className="p-2 font-bold font-sans text-slate-800">{drv.namaDriver}</td>
                                          <td className="p-2 text-center text-slate-600">{drv.totalTrip}x</td>
                                          <td className="p-2 text-right font-bold text-blue-700">{drv.totalDus.toLocaleString('id-ID')} Dus</td>
                                          <td className="p-2 text-right font-bold text-slate-800 tabular-nums">Rp {drv.estimasiBiaya.toLocaleString('id-ID')}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Log Riwayat Pengiriman Kirim Armada */}
                            <div className="lg:col-span-2 border border-slate-200 rounded-lg overflow-hidden">
                              <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                                <span>Riwayat Pengiriman Armada Pabrik ({sel.driverSummary.daftarPengiriman.length})</span>
                                <span className="text-[10px] text-slate-400">Log Pengantaran</span>
                              </div>
                              <div className="overflow-x-auto max-h-64">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200 sticky top-0">
                                    <tr>
                                      <th className="p-2">Tanggal</th>
                                      <th className="p-2">No. Surat Jalan</th>
                                      <th className="p-2">Driver / Sopir</th>
                                      <th className="p-2 text-center">Kuantitas</th>
                                      <th className="p-2 text-right">Biaya Kirim</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                    {sel.driverSummary.daftarPengiriman.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="p-4 text-center text-slate-400 font-sans italic">
                                          Belum ada pengiriman armada pabrik ke konsumen ini.
                                        </td>
                                      </tr>
                                    ) : (
                                      sel.driverSummary.daftarPengiriman.map((dItem, idx) => (
                                        <tr key={dItem.idDistribusi || idx} className="hover:bg-slate-50">
                                          <td className="p-2 text-slate-600">{formatDateDDMMYYYY(dItem.tanggal)}</td>
                                          <td className="p-2 font-bold text-blue-700">{dItem.noSuratJalan}</td>
                                          <td className="p-2 font-sans font-semibold text-slate-800">{dItem.namaDriver}</td>
                                          <td className="p-2 text-center font-bold text-slate-800">{dItem.totalDus.toLocaleString('id-ID')} Dus</td>
                                          <td className="p-2 text-right font-bold text-slate-800 tabular-nums">Rp {dItem.estimasiBiaya.toLocaleString('id-ID')}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
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
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                      <span>{c.idPelanggan}</span>
                                      {c.ambilSendiriSummary.totalDus > 0 && (
                                        <span className="text-slate-500 font-sans">• Ambil Sendiri: {c.ambilSendiriSummary.totalDus} dus</span>
                                      )}
                                      {c.driverSummary.totalDus > 0 && (
                                        <span className="text-slate-500 font-sans">• Kirim Driver: {c.driverSummary.totalDus} dus</span>
                                      )}
                                    </div>
                                    {c.ambilSendiriSummary.potonganBelumDicairkan > 0 && (
                                      <div className="mt-1">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                          <Coins size={10} className="text-amber-600" />
                                          <span>Pending Ongkir: Rp {c.ambilSendiriSummary.potonganBelumDicairkan.toLocaleString('id-ID')}</span>
                                        </span>
                                      </div>
                                    )}
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
              {/* Filter Bulanan, Tahun & Kontrol Periode Terpadu */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 font-semibold">
                    <Calendar size={15} className="text-blue-600" />
                    <span>Filter Periode:</span>
                  </div>

                  {/* Dropdown Pilihan Tahun */}
                  <select
                    value={piutangFilterYear}
                    onChange={(e) => {
                      setPiutangFilterYear(e.target.value);
                      setPiutangFilterMonth('all');
                    }}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    title="Pilih Tahun Transaksi"
                  >
                    <option value="all">Semua Tahun ({allReceivablesList.length} Transaksi)</option>
                    {availablePiutangYears.map((y) => (
                      <option key={y.year} value={y.year}>
                        Tahun {y.year} ({y.count} Transaksi)
                      </option>
                    ))}
                  </select>

                  {/* Dropdown Pilihan Bulan Cepat */}
                  <select
                    value={piutangFilterMonth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPiutangFilterMonth(val);
                      if (val !== 'all') {
                        setPiutangFilterYear(val.slice(0, 4));
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    title="Pilih Bulan Spesifik"
                  >
                    <option value="all">
                      {piutangFilterYear === 'all' ? `Semua Bulan (${allReceivablesList.length} Transaksi)` : `Seluruh Bulan di Tahun ${piutangFilterYear}`}
                    </option>
                    {availablePiutangMonths.map((m) => (
                      <option key={m.period} value={m.period}>
                        🗓️ {formatPeriodMonthName(m.period)} ({m.count} Transaksi)
                      </option>
                    ))}
                  </select>

                  {/* Input Bulan type="month" */}
                  <input
                    type="month"
                    value={piutangFilterMonth === 'all' ? '' : piutangFilterMonth}
                    onChange={(e) => {
                      const val = e.target.value || 'all';
                      setPiutangFilterMonth(val);
                      if (val !== 'all') {
                        setPiutangFilterYear(val.slice(0, 4));
                      }
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 text-slate-700 font-mono"
                    title="Pilih Bulan & Tahun Kustom"
                  />

                  {/* Tombol Pintas Tahun 2026 */}
                  <button
                    type="button"
                    onClick={() => {
                      setPiutangFilterYear('2026');
                      setPiutangFilterMonth('all');
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer border ${
                      piutangFilterYear === '2026' && piutangFilterMonth === 'all'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tahun 2026
                  </button>

                  {/* Tombol Pintas Bulan Ini */}
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const yr = String(now.getFullYear());
                      const ym = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      setPiutangFilterYear(yr);
                      setPiutangFilterMonth(ym);
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer border ${
                      piutangFilterMonth === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Bulan Ini
                  </button>

                  {(piutangFilterMonth !== 'all' || piutangFilterYear !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPiutangFilterMonth('all');
                        setPiutangFilterYear('all');
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
                    >
                      Reset (Semua)
                    </button>
                  )}
                </div>

                {/* Ringkasan Saldo Periode Terpilih */}
                <div className="flex items-center gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-sans">Total:</span>
                    <span className="font-bold text-slate-800">
                      Rp {receivablesInMonth.reduce((acc, r) => acc + Number(r.Nominal ?? r.TOTAL_TAGIHAN ?? 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-sans">Terbayar:</span>
                    <span className="font-bold text-emerald-600">
                      Rp {receivablesInMonth.reduce((acc, r) => acc + Number(r.Terbayar ?? r.TOTAL_DIBAYAR ?? 0), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-sans">Sisa:</span>
                    <span className="font-bold text-red-600">
                      Rp {receivablesInMonth.reduce((acc, r) => {
                        const n = Number(r.Nominal ?? r.TOTAL_TAGIHAN ?? 0);
                        const b = Number(r.Terbayar ?? r.TOTAL_DIBAYAR ?? 0);
                        return acc + Number(r.Sisa ?? r.SISA_SALDO ?? (n - b));
                      }, 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

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
                    Semua ({receivablesInMonth.length})
                  </button>
                  <button
                    onClick={() => setPiutangTypeFilter('Piutang')}
                    className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                      piutangTypeFilter === 'Piutang' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Piutang Pelanggan ({receivablesInMonth.filter(r => (r.Jenis || r.TIPE) === 'Piutang').length})
                  </button>
                  <button
                    onClick={() => setPiutangTypeFilter('Utang')}
                    className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors ${
                      piutangTypeFilter === 'Utang' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Utang Supplier ({receivablesInMonth.filter(r => (r.Jenis || r.TIPE) === 'Utang').length})
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
                        <th className="p-3">Tgl Dokumen</th>
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
                          if (piutangFilterYear !== 'all' && getReceivableYear(r) !== piutangFilterYear) return false;
                          if (piutangFilterMonth !== 'all' && getReceivableMonthKey(r) !== piutangFilterMonth) return false;
                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={11} className="p-8 text-center text-slate-400 font-sans italic">
                                Belum ada catatan tagihan atau piutang yang sesuai dengan filter yang dipilih.
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
                          const tglDokumen = r.Tanggal || r.TANGGAL || '-';
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
                              <td className="p-3 text-slate-700 font-semibold">{tglDokumen}</td>
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
                                        SJ: {inv.noSuratJalan} &middot; {formatDateDDMMYYYY(inv.tanggal)}
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
    </>
  );
};