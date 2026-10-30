import React, { useState, useMemo } from 'react';
import { 
  Boxes, Plus, Download, Printer, AlertTriangle, 
  CheckCircle2, ArrowDownRight, ArrowUpRight, X, PackagePlus, 
  PackageMinus, Edit2, Trash2, Upload, FileDown, BarChart2
} from 'lucide-react';
import { 
  ProductItem, ProductionItem, DistributionItem, DistributionProductDetail,
  RawMaterialItem, RawMaterialPurchase, RawMaterialMutation 
} from '../types';
import { getTableData, setTableData } from '../services/dbAdapter';
import { exportDataToExcel } from '../services/excelService';
import { generateTableReportPDF } from '../services/pdfService';
import { confirmAction } from './ConfirmDialog';
import { showToast } from './ToastContainer';
import { formatDateDDMMYYYY } from '../services/formatters';

interface StockViewProps {
  products: ProductItem[];
  productions: ProductionItem[];
  distributions: DistributionItem[];
  distributionItems: DistributionProductDetail[];
  rawMaterials: RawMaterialItem[];
  purchases: RawMaterialPurchase[];
  mutations: RawMaterialMutation[];
  onRefresh: () => void;
}

// ==============================================================
// DATE PARSER & FORMATTER (ISO, DD/MM/YYYY, Indonesian Month, Excel)
// ==============================================================
const parseDateObj = (raw: any): Date | null => {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number' && raw > 1000) {
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(raw).trim();
  if (!str) return null;

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. Slashed or dashed: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (dmyMatch) {
    let yr = Number(dmyMatch[3]);
    if (yr < 100) yr += 2000;
    const d = new Date(yr, Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // 3. Text month name: 01-Okt-2026, 01 Okt 2026, 1 Oktober 2026, 01-Oct-26
  const textMonthMatch = str.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2,4})$/);
  if (textMonthMatch) {
    const day = Number(textMonthMatch[1]);
    const mStr = textMonthMatch[2].toLowerCase();
    let yr = Number(textMonthMatch[3]);
    if (yr < 100) yr += 2000;

    const monthMap: Record<string, number> = {
      jan: 0, januari: 0, january: 0,
      feb: 1, februari: 1, february: 1,
      mar: 2, maret: 2, march: 2,
      apr: 3, april: 3,
      mei: 4, may: 4,
      jun: 5, juni: 5, june: 5,
      jul: 6, juli: 6, july: 6,
      agu: 7, ags: 7, agustus: 7, aug: 7, august: 7,
      sep: 8, september: 8,
      okt: 9, oktober: 9, oct: 9, october: 9,
      nov: 10, november: 10,
      des: 11, desember: 11, dec: 11, december: 11
    };

    const mIdx = monthMap[mStr] ?? monthMap[mStr.substring(0, 3)];
    if (mIdx !== undefined) {
      return new Date(yr, mIdx, day);
    }
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const formatDateToYMD = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Helper: shortcode label kolom (C120, C220, B330, B600, GLN 19 L, dst)
const getProductShortCode = (p: { Nama_Produk?: string; ID_Produk: string }): string => {
  const nm = (p.Nama_Produk || '').toUpperCase();
  if (nm.includes('120') || nm.includes('CUP 120')) return 'C120';
  if (nm.includes('220') || nm.includes('CUP 220')) return 'C220';
  if (nm.includes('330') || nm.includes('BOT 330') || nm.includes('BTL 330')) return 'B330';
  if (nm.includes('600') || nm.includes('BOT 600') || nm.includes('BTL 600')) return 'B600';
  if (nm.includes('19') || nm.includes('GALON') || nm.includes('GLN')) return 'GLN 19 L';
  const parts = (p.Nama_Produk || p.ID_Produk).split(' ');
  return parts[parts.length - 1].substring(0, 8);
};

// Helper: Ambil Qty produk spesifik dari record distribusi (O(1) direct property check anti-lag)
const getDistProductQty = (
  dist: DistributionItem,
  distItems: DistributionProductDetail[] | Map<string, DistributionProductDetail[]>,
  prod: ProductItem
): number => {
  const prodId = String(prod.ID_Produk || '').trim().toLowerCase();
  const shortCode = getProductShortCode(prod);
  const isGalon = shortCode === 'GLN 19 L' || shortCode === 'G19' || prodId.includes('gln') || prodId.includes('galon');

  // 1. Cek kolom langsung pada record dist dahulu (O(1) langsung dapat tanpa looping)
  const anyDist = dist as any;
  let candidates: string[] = [];

  if (shortCode === 'C120') {
    candidates = ['C120', 'c120', 'ASH-CUP120', 'Qty_C120', 'Jumlah_C120', 'cup120'];
  } else if (shortCode === 'C220') {
    candidates = ['C220', 'c220', 'ASH-CUP220', 'Qty_C220', 'Jumlah_C220', 'cup220'];
  } else if (shortCode === 'B330') {
    candidates = ['B330', 'b330', 'ASH-BTL330', 'Qty_B330', 'Jumlah_B330', 'btl330', 'botol330'];
  } else if (shortCode === 'B600') {
    candidates = ['B600', 'b600', 'ASH-BTL600', 'Qty_B600', 'Jumlah_B600', 'btl600', 'botol600'];
  } else if (isGalon) {
    candidates = ['G19', 'g19', 'GLN19', 'gln19', 'GLN 19 L', 'ASH-GLN19L', 'Galon', 'galon', 'Qty_G19', 'Jumlah_G19'];
  } else {
    candidates = [prod.ID_Produk, shortCode, shortCode.toLowerCase()];
  }

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    if (anyDist[cand] !== undefined && anyDist[cand] !== null && anyDist[cand] !== '') {
      const q = Number(anyDist[cand]);
      if (!isNaN(q) && q > 0) return q;
    }
  }

  // 2. Cek di distItems jika tidak ada di kolom langsung
  const distId = String(dist.ID_Distribusi || '').trim().toLowerCase();
  let matchingItems: DistributionProductDetail[] = [];
  if (distItems instanceof Map) {
    matchingItems = distItems.get(distId) || [];
  } else if (Array.isArray(distItems)) {
    matchingItems = distItems.filter(d => String(d.ID_Distribusi || '').trim().toLowerCase() === distId);
  }

  let sumItems = 0;
  for (let i = 0; i < matchingItems.length; i++) {
    const d = matchingItems[i];
    const itemProdId = String(d.ID_Produk || '').trim().toLowerCase();
    const itemProdName = String(d.Nama_Produk || '').trim().toLowerCase();

    let matched = false;
    if (itemProdId === prodId) matched = true;
    else if (shortCode === 'C120' && (itemProdId === 'c120' || itemProdName.includes('120'))) matched = true;
    else if (shortCode === 'C220' && (itemProdId === 'c220' || itemProdName.includes('220'))) matched = true;
    else if (shortCode === 'B330' && (itemProdId === 'b330' || itemProdId.includes('330') || itemProdName.includes('330'))) matched = true;
    else if (shortCode === 'B600' && (itemProdId === 'b600' || itemProdId.includes('600') || itemProdName.includes('600'))) matched = true;
    else if (isGalon && (itemProdId === 'g19' || itemProdId === 'gln19' || itemProdId.includes('gln') || itemProdName.includes('galon') || itemProdName.includes('19'))) matched = true;

    if (matched) {
      sumItems += (Number(d.Qty) || 0);
    }
  }

  // 3. Fallback Cerdas untuk Galon: Jika transaksi memiliki Total_Tagihan positif tetapi seluruh produk dus (C120, C220, B330, B600) bernilai 0:
  if (isGalon && sumItems === 0) {
    const c120 = Number(anyDist.C120 || 0);
    const c220 = Number(anyDist.C220 || 0);
    const b330 = Number(anyDist.B330 || 0);
    const b600 = Number(anyDist.B600 || 0);
    if (c120 === 0 && c220 === 0 && b330 === 0 && b600 === 0) {
      const tagihan = Number(dist.Total_Tagihan || anyDist.Tagihan || 0);
      if (tagihan > 0) {
        if (tagihan % 12000 === 0) return Math.round(tagihan / 12000);
        if (tagihan % 9000 === 0) return Math.round(tagihan / 9000);
        if (tagihan % 10000 === 0) return Math.round(tagihan / 10000);
        if (tagihan % 15000 === 0) return Math.round(tagihan / 15000);
        if (tagihan >= 9000) return Math.round(tagihan / 12000);
      }
    }
  }

  return sumItems;
};

export const StockView: React.FC<StockViewProps> = ({
  products,
  productions,
  distributions,
  distributionItems,
  rawMaterials,
  purchases,
  mutations,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'laporan_stok' | 'bahan_penolong' | 'pembelian' | 'pemakaian'>('laporan_stok');
  const now = new Date();

  // Tentukan default filterMonth: cari bulan transaksi terbaru jika bulan sistem saat ini kosong
  const allTxDates: Date[] = [];
  productions.forEach(p => { const d = parseDateObj(p.Tanggal); if (d) allTxDates.push(d); });
  distributions.forEach(d => { const dt = parseDateObj(d.Tanggal); if (dt) allTxDates.push(dt); });

  const currentSystemMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const hasTxInCurrentMonth = allTxDates.some(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === currentSystemMonth);

  const latestTxMonth = allTxDates.length > 0 
    ? (() => {
        const sorted = [...allTxDates].sort((a, b) => b.getTime() - a.getTime());
        const d = sorted[0];
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })()
    : currentSystemMonth;

  const initialMonth = hasTxInCurrentMonth ? currentSystemMonth : latestTxMonth;
  const [filterMonth, setFilterMonth] = useState<string>(initialMonth);

  // Modals for manual purchase or usage
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<RawMaterialPurchase | null>(null);
  const [showAddMutationModal, setShowAddMutationModal] = useState(false);
  const [editingMutation, setEditingMutation] = useState<RawMaterialMutation | null>(null);

  const [purchaseForm, setPurchaseForm] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    ID_Bahan: rawMaterials[0]?.ID_Bahan || '',
    Supplier: '',
    Harga_Satuan: '' as any,
    Qty: '' as any,
    Keterangan: ''
  });

  const [mutationForm, setMutationForm] = useState<{
    Tanggal: string;
    ID_Bahan: string;
    Jenis_Mutasi: 'Masuk' | 'Keluar';
    Kategori: string;
    Qty: number;
    Keterangan: string;
  }>({
    Tanggal: new Date().toISOString().slice(0, 10),
    ID_Bahan: rawMaterials[0]?.ID_Bahan || '',
    Jenis_Mutasi: 'Keluar',
    Kategori: 'Barang Rusak (Reject)',
    Qty: '' as any,
    Keterangan: ''
  });

  // Calculate Raw Material Stocks
  const materialStockMap: Record<string, { material: RawMaterialItem; inQty: number; outQty: number; endStock: number; isCritical: boolean }> = {};
  rawMaterials.forEach(b => {
    materialStockMap[b.ID_Bahan] = {
      material: b,
      inQty: 0,
      outQty: 0,
      endStock: 0,
      isCritical: false
    };
  });

  purchases.forEach(p => {
    if (materialStockMap[p.ID_Bahan]) {
      materialStockMap[p.ID_Bahan].inQty += (Number(p.Qty) || 0);
    }
  });

  mutations.forEach(m => {
    if (materialStockMap[m.ID_Bahan]) {
      if (m.Jenis_Mutasi === 'Masuk') {
        materialStockMap[m.ID_Bahan].inQty += (Number(m.Qty) || 0);
      } else {
        materialStockMap[m.ID_Bahan].outQty += (Number(m.Qty) || 0);
      }
    }
  });

  Object.values(materialStockMap).forEach(item => {
    item.endStock = item.inQty - item.outQty;
    const min = item.material.Minimum_Stock ?? 1000;
    item.isCritical = item.endStock <= min;
  });

  // ==============================================================
  // DAILY MATRIX: PRODUKSI | DISTRIBUSI | STOCK PRODUK
  // ==============================================================

  // Daftar produk aktif yang terlibat produksi/distribusi (atau semua produk aktif)
  const activeProducts = useMemo(() => products.filter(p => p.Status === 'Aktif'), [products]);

  // Pre-index distribution items map for O(1) hash lookup
  const distItemsMap = useMemo(() => {
    const map = new Map<string, DistributionProductDetail[]>();
    (distributionItems || []).forEach(it => {
      if (!it || !it.ID_Distribusi) return;
      const key = String(it.ID_Distribusi).trim().toLowerCase();
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(it);
    });
    return map;
  }, [distributionItems]);

  // Parse bulan filter ke tahun & bulan angka
  const [fyear, fmonth] = filterMonth.split('-').map(Number);

  // Hitung saldo awal (sebelum bulan filter) - memoized
  const saldoLalu: Record<string, number> = useMemo(() => {
    const saldo: Record<string, number> = {};
    activeProducts.forEach(p => {
      let totalProd = 0;
      let totalDist = 0;

      productions.forEach(pr => {
        const dt = parseDateObj(pr.Tanggal);
        if (dt && (dt.getFullYear() < fyear || (dt.getFullYear() === fyear && dt.getMonth() + 1 < fmonth))) {
          if (pr.ID_Produk === p.ID_Produk || getProductShortCode({ ID_Produk: pr.ID_Produk }) === getProductShortCode(p)) {
            totalProd += Number(pr.Jumlah) || 0;
          }
        }
      });

      distributions.forEach(dist => {
        const dt = parseDateObj(dist.Tanggal);
        if (dt && (dt.getFullYear() < fyear || (dt.getFullYear() === fyear && dt.getMonth() + 1 < fmonth))) {
          totalDist += getDistProductQty(dist, distItemsMap, p);
        }
      });

      saldo[p.ID_Produk] = totalProd - totalDist;
    });
    return saldo;
  }, [activeProducts, productions, distributions, distItemsMap, fyear, fmonth]);

  // Kumpulkan semua tanggal unik dalam bulan filter yang ada transaksi
  const allDaysOfMonth = useMemo(() => {
    const daysInMonth = new Date(fyear, fmonth, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${fyear}-${String(fmonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  }, [fyear, fmonth]);

  // Map: tanggal (YYYY-MM-DD) -> produk -> qty produksi (memoized)
  const dailyProd: Record<string, Record<string, number>> = useMemo(() => {
    const dp: Record<string, Record<string, number>> = {};
    productions.forEach(pr => {
      const dt = parseDateObj(pr.Tanggal);
      if (dt && dt.getFullYear() === fyear && dt.getMonth() + 1 === fmonth) {
        const dayKey = formatDateToYMD(dt);
        if (!dp[dayKey]) dp[dayKey] = {};
        const targetProd = activeProducts.find(p => p.ID_Produk === pr.ID_Produk || getProductShortCode(p) === getProductShortCode({ ID_Produk: pr.ID_Produk }));
        const pid = targetProd ? targetProd.ID_Produk : pr.ID_Produk;
        dp[dayKey][pid] = (dp[dayKey][pid] || 0) + (Number(pr.Jumlah) || 0);
      }
    });
    return dp;
  }, [productions, activeProducts, fyear, fmonth]);

  // Map: tanggal (YYYY-MM-DD) -> produk -> qty distribusi (memoized)
  const dailyDist: Record<string, Record<string, number>> = useMemo(() => {
    const dd: Record<string, Record<string, number>> = {};
    distributions.forEach(dist => {
      const dt = parseDateObj(dist.Tanggal);
      if (dt && dt.getFullYear() === fyear && dt.getMonth() + 1 === fmonth) {
        const dayKey = formatDateToYMD(dt);
        if (!dd[dayKey]) dd[dayKey] = {};
        activeProducts.forEach(p => {
          const qty = getDistProductQty(dist, distItemsMap, p);
          if (qty > 0) {
            dd[dayKey][p.ID_Produk] = (dd[dayKey][p.ID_Produk] || 0) + qty;
          }
        });
      }
    });
    return dd;
  }, [distributions, activeProducts, distItemsMap, fyear, fmonth]);

  // Filter: hanya hari yg ada produksi ATAU distribusi
  const activeDays = useMemo(() => {
    return allDaysOfMonth.filter(day => {
      return (dailyProd[day] && Object.values(dailyProd[day]).some(v => v > 0)) ||
             (dailyDist[day] && Object.values(dailyDist[day]).some(v => v > 0));
    });
  }, [allDaysOfMonth, dailyProd, dailyDist]);

  // Hitung running stock harian (memoized)
  const runningStock: Record<string, Record<string, number>> = useMemo(() => {
    const rs: Record<string, Record<string, number>> = {};
    let currentStock: Record<string, number> = {};
    activeProducts.forEach(p => { currentStock[p.ID_Produk] = saldoLalu[p.ID_Produk] || 0; });

    allDaysOfMonth.forEach(day => {
      activeProducts.forEach(p => {
        const pid = p.ID_Produk;
        const masuk = dailyProd[day]?.[pid] || 0;
        const keluar = dailyDist[day]?.[pid] || 0;
        currentStock[pid] = currentStock[pid] + masuk - keluar;
      });
      rs[day] = { ...currentStock };
    });
    return rs;
  }, [activeProducts, saldoLalu, allDaysOfMonth, dailyProd, dailyDist]);

  // Export Excel untuk tabel harian
  const handleExportDailyExcel = () => {
    const rows: Record<string, string | number>[] = [];
    // baris saldo lalu
    const saldoRow: Record<string, string | number> = { Tanggal: 'SALDO LALU' };
    activeProducts.forEach(p => {
      const code = getProductShortCode(p);
      saldoRow[`PROD_${code}`] = '';
      saldoRow[`DIST_${code}`] = '';
      saldoRow[`STOCK_${code}`] = saldoLalu[p.ID_Produk] || 0;
    });
    rows.push(saldoRow);
    activeDays.forEach(day => {
      const row: Record<string, string | number> = { Tanggal: formatTanggalIndo(day) };
      activeProducts.forEach(p => {
        const code = getProductShortCode(p);
        const prod = dailyProd[day]?.[p.ID_Produk] || 0;
        const dist = dailyDist[day]?.[p.ID_Produk] || 0;
        const stk = runningStock[day]?.[p.ID_Produk] || 0;
        row[`PROD_${code}`] = prod > 0 ? prod : '';
        row[`DIST_${code}`] = dist > 0 ? dist : '';
        row[`STOCK_${code}`] = stk;
      });
      rows.push(row);
    });
    exportDataToExcel(rows, 'Rekap_Harian', `Rekap_PDS_${filterMonth}`);
  };

  // PDF Export for Laporan Rekapitulasi Stok (legacy, keep for compatibility)
  const handleExportStockPDF = () => {
    const headers = ['Tanggal', ...activeProducts.map(p => `PROD ${getProductShortCode(p)}`), ...activeProducts.map(p => `DIST ${getProductShortCode(p)}`), ...activeProducts.map(p => `STOCK ${getProductShortCode(p)}`)];
    const rows: (string | number)[][] = [];
    // saldo lalu
    rows.push(['SALDO LALU', ...activeProducts.map(() => ''), ...activeProducts.map(() => ''), ...activeProducts.map(p => saldoLalu[p.ID_Produk] || 0)]);
    activeDays.forEach(day => {
      rows.push([
        formatTanggalIndo(day),
        ...activeProducts.map(p => dailyProd[day]?.[p.ID_Produk] || ''),
        ...activeProducts.map(p => dailyDist[day]?.[p.ID_Produk] || ''),
        ...activeProducts.map(p => runningStock[day]?.[p.ID_Produk] || 0)
      ]);
    });
    generateTableReportPDF({
      title: 'LAPORAN PRODUKSI, DISTRIBUSI & SISA STOK HARIAN',
      subtitle: `Periode: ${formatBulanIndo(filterMonth)} | PT. Anugerah Illahi Rabbi`,
      headers,
      rows,
      filename: `Laporan_PDS_Harian_${filterMonth}.pdf`
    });
  };

  // Helper format tanggal ke format baku "DD-MM-YYYY"
  const formatTanggalIndo = (dateStr: string): string => {
    return formatDateDDMMYYYY(dateStr);
  };

  const formatBulanIndo = (ym: string): string => {
    const bulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const [y, m] = ym.split('-').map(Number);
    return `${bulanIndo[m - 1]} ${y}`;
  };

  // Open Add Purchase
  const handleOpenAddPurchase = () => {
    setEditingPurchase(null);
    setPurchaseForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      ID_Bahan: rawMaterials[0]?.ID_Bahan || '',
      Supplier: '',
      Harga_Satuan: '' as any,
      Qty: '' as any,
      Keterangan: ''
    });
    setShowAddPurchaseModal(true);
  };

  // Open Edit Purchase
  const handleOpenEditPurchase = (p: RawMaterialPurchase) => {
    setEditingPurchase(p);
    setPurchaseForm({
      Tanggal: p.Tanggal,
      ID_Bahan: p.ID_Bahan,
      Supplier: p.Supplier,
      Harga_Satuan: p.Harga_Satuan,
      Qty: p.Qty,
      Keterangan: p.Keterangan
    });
    setShowAddPurchaseModal(true);
  };

  // Delete Purchase
  const handleDeletePurchase = async (id: string) => {
    const purchase = purchases.find(p => p.ID_Pembelian === id);
    const ok = await confirmAction({
      title: 'Hapus Riwayat Pembelian',
      message: `Hapus catatan pembelian bahan "${purchase?.Nama_Bahan || id}" dari supplier?`,
      confirmText: 'Ya, Hapus Pembelian',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Pembelian': id,
        'Bahan': purchase?.Nama_Bahan || '-',
        'Supplier': purchase?.Supplier || '-',
        'Jumlah Masuk': `${purchase?.Qty || 0} unit`
      }
    });
    if (!ok) return;

    const currentPurchases = getTableData<RawMaterialPurchase>('Pembelian_Bahan', []);
    const updated = currentPurchases.filter(p => p.ID_Pembelian !== id);
    setTableData('Pembelian_Bahan', updated);
    onRefresh();
    showToast('Pembelian Dihapus', `Catatan pembelian ${id} berhasil dihapus.`, 'success');
  };

  // Save Purchase
  const handleSavePurchase = () => {
    const rawMat = rawMaterials.find(m => m.ID_Bahan === purchaseForm.ID_Bahan);
    const currentPurchases = getTableData<RawMaterialPurchase>('Pembelian_Bahan', []);

    if (editingPurchase) {
      const updated = currentPurchases.map(p => p.ID_Pembelian === editingPurchase.ID_Pembelian ? {
        ...p,
        Tanggal: purchaseForm.Tanggal,
        ID_Bahan: purchaseForm.ID_Bahan,
        Nama_Bahan: rawMat?.Nama_Bahan || purchaseForm.ID_Bahan,
        Supplier: purchaseForm.Supplier,
        Harga_Satuan: Number(purchaseForm.Harga_Satuan),
        Qty: Number(purchaseForm.Qty),
        Keterangan: purchaseForm.Keterangan
      } : p);
      setTableData('Pembelian_Bahan', updated);
    } else {
      const newPurchase: RawMaterialPurchase = {
        ID_Pembelian: `PB-${Date.now().toString().slice(-6)}`,
        Tanggal: purchaseForm.Tanggal,
        ID_Bahan: purchaseForm.ID_Bahan,
        Nama_Bahan: rawMat?.Nama_Bahan || purchaseForm.ID_Bahan,
        Supplier: purchaseForm.Supplier,
        Harga_Satuan: Number(purchaseForm.Harga_Satuan),
        Qty: Number(purchaseForm.Qty),
        Keterangan: purchaseForm.Keterangan
      };
      setTableData('Pembelian_Bahan', [...currentPurchases, newPurchase]);
    }
    setShowAddPurchaseModal(false);
    onRefresh();
  };

  // Open Add Mutation
  const handleOpenAddMutation = () => {
    setEditingMutation(null);
    setMutationForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      ID_Bahan: rawMaterials[0]?.ID_Bahan || '',
      Jenis_Mutasi: 'Keluar',
      Kategori: 'Barang Rusak (Reject)',
      Qty: '' as any,
      Keterangan: ''
    });
    setShowAddMutationModal(true);
  };

  // Open Edit Mutation
  const handleOpenEditMutation = (m: RawMaterialMutation) => {
    setEditingMutation(m);
    setMutationForm({
      Tanggal: m.Tanggal,
      ID_Bahan: m.ID_Bahan,
      Jenis_Mutasi: m.Jenis_Mutasi,
      Kategori: m.Kategori,
      Qty: m.Qty,
      Keterangan: m.Keterangan
    });
    setShowAddMutationModal(true);
  };

  // Delete Mutation
  const handleDeleteMutation = async (id: string) => {
    const mutation = mutations.find(m => m.ID_Mutasi === id);
    const ok = await confirmAction({
      title: 'Hapus Catatan Mutasi',
      message: `Hapus catatan mutasi/pemakaian bahan "${mutation?.Nama_Bahan || id}"?`,
      confirmText: 'Ya, Hapus Mutasi',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Mutasi': id,
        'Bahan': mutation?.Nama_Bahan || '-',
        'Jenis Mutasi': mutation?.Jenis_Mutasi || '-',
        'Jumlah': `${mutation?.Qty || 0} unit`
      }
    });
    if (!ok) return;

    const currentMutations = getTableData<RawMaterialMutation>('Mutasi_Bahan', []);
    const updated = currentMutations.filter(m => m.ID_Mutasi !== id);
    setTableData('Mutasi_Bahan', updated);
    onRefresh();
    showToast('Mutasi Dihapus', `Catatan mutasi ${id} berhasil dihapus.`, 'success');
  };

  // Save Mutation
  const handleSaveMutation = () => {
    const rawMat = rawMaterials.find(m => m.ID_Bahan === mutationForm.ID_Bahan);
    const currentMutations = getTableData<RawMaterialMutation>('Mutasi_Bahan', []);

    if (editingMutation) {
      const updated = currentMutations.map(m => m.ID_Mutasi === editingMutation.ID_Mutasi ? {
        ...m,
        Tanggal: mutationForm.Tanggal,
        ID_Bahan: mutationForm.ID_Bahan,
        Nama_Bahan: rawMat?.Nama_Bahan || mutationForm.ID_Bahan,
        Jenis_Mutasi: mutationForm.Jenis_Mutasi,
        Kategori: mutationForm.Kategori,
        Qty: Number(mutationForm.Qty),
        Keterangan: mutationForm.Keterangan
      } : m);
      setTableData('Mutasi_Bahan', updated);
    } else {
      const newMutation: RawMaterialMutation = {
        ID_Mutasi: `MT-${Date.now().toString().slice(-6)}`,
        Tanggal: mutationForm.Tanggal,
        ID_Bahan: mutationForm.ID_Bahan,
        Nama_Bahan: rawMat?.Nama_Bahan || mutationForm.ID_Bahan,
        Jenis_Mutasi: mutationForm.Jenis_Mutasi,
        Kategori: mutationForm.Kategori,
        Qty: Number(mutationForm.Qty),
        Keterangan: mutationForm.Keterangan
      };
      setTableData('Mutasi_Bahan', [...currentMutations, newMutation]);
    }
    setShowAddMutationModal(false);
    onRefresh();
  };

  const handlePrintStockLandscape = () => {
    document.body.classList.remove('print-portrait');
    document.body.classList.add('print-landscape');
    window.print();
    const cleanup = () => {
      document.body.classList.remove('print-landscape');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Boxes className="text-blue-600" size={24} />
            Manajemen Stok & Mutasi Gudang
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan produksi vs distribusi, sisa stok produk jadi, dan bahan penolong kemasan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print Button */}
          <button
            onClick={handlePrintStockLandscape}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Cetak Halaman (Print Lanskap)"
          >
            <Printer size={16} />
          </button>

          {/* PDF Button */}
          <button
            onClick={handleExportStockPDF}
            className="p-2 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Download PDF Laporan Stok"
          >
            <FileDown size={16} />
          </button>

          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none"
          />

          <button
            onClick={handleOpenAddPurchase}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <PackagePlus size={14} />
            <span>Input Pembelian</span>
          </button>

          <button
            onClick={handleOpenAddMutation}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <PackageMinus size={14} />
            <span>Catat Reject / Pakai</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher - includes the new required Tab */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-medium no-print">
        <button
          onClick={() => setActiveTab('laporan_stok')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'laporan_stok' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BarChart2 size={14} />
          <span>Laporan Produksi, Distribusi & Sisa Stock</span>
        </button>
        <button
          onClick={() => setActiveTab('bahan_penolong')}
          className={`px-4 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'bahan_penolong' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Stok Bahan Penolong ({rawMaterials.length})
        </button>
        <button
          onClick={() => setActiveTab('pembelian')}
          className={`px-4 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'pembelian' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Riwayat Pembelian Masuk ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('pemakaian')}
          className={`px-4 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'pemakaian' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Pemakaian & Reject ({mutations.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB LAPORAN PRODUKSI, DISTRIBUSI & SISA STOCK — TABEL HARIAN   */}
      {/* ============================================================== */}
      {activeTab === 'laporan_stok' && (
        <div className="space-y-4">
          {/* Header + Filter + Tombol Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs print:hidden">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Laporan Harian: Produksi, Distribusi &amp; Sisa Stock Produk
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekapitulasi mutasi harian barang jadi AMDK As-Shofaa — Periode: <strong>{formatBulanIndo(filterMonth)}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="month"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handlePrintStockLandscape}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Cetak Laporan Rekap Harian (Lanskap)"
              >
                <Printer size={14} />
                <span>Cetak</span>
              </button>
              <button
                onClick={handleExportStockPDF}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileDown size={14} />
                <span>PDF</span>
              </button>
              <button
                onClick={handleExportDailyExcel}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Tabel 3-Seksi Harian */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse" style={{ borderSpacing: 0 }}>
                <thead>
                  {/* Baris Header Level 1: TANGGAL | PRODUKSI | DISTRIBUSI | STOCK PRODUK */}
                  <tr>
                    <th
                      rowSpan={2}
                      className="border border-slate-300 bg-slate-100 text-slate-800 font-bold text-center px-3 py-2 whitespace-nowrap align-middle"
                      style={{ minWidth: 110 }}
                    >
                      TANGGAL
                    </th>
                    {/* PRODUKSI – hijau */}
                    <th
                      colSpan={activeProducts.length}
                      className="border border-emerald-300 bg-emerald-100 text-emerald-900 font-bold text-center px-3 py-2"
                    >
                      PRODUKSI
                    </th>
                    {/* DISTRIBUSI – biru */}
                    <th
                      colSpan={activeProducts.length}
                      className="border border-blue-300 bg-blue-100 text-blue-900 font-bold text-center px-3 py-2"
                    >
                      DISTRIBUSI
                    </th>
                    {/* STOCK PRODUK – amber/kuning */}
                    <th
                      colSpan={activeProducts.length}
                      className="border border-amber-300 bg-amber-100 text-amber-900 font-bold text-center px-3 py-2"
                    >
                      STOCK PRODUK
                    </th>
                  </tr>
                  {/* Baris Header Level 2: sub-kolom per produk */}
                  <tr>
                    {/* Produksi sub-cols */}
                    {activeProducts.map(p => (
                      <th
                        key={`ph-${p.ID_Produk}`}
                        className="border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold text-center px-3 py-1.5 whitespace-nowrap"
                        style={{ minWidth: 64 }}
                      >
                        {getProductShortCode(p)}
                      </th>
                    ))}
                    {/* Distribusi sub-cols */}
                    {activeProducts.map(p => (
                      <th
                        key={`dh-${p.ID_Produk}`}
                        className="border border-blue-200 bg-blue-50 text-blue-800 font-semibold text-center px-3 py-1.5 whitespace-nowrap"
                        style={{ minWidth: 64 }}
                      >
                        {getProductShortCode(p)}
                      </th>
                    ))}
                    {/* Stock sub-cols */}
                    {activeProducts.map(p => (
                      <th
                        key={`sh-${p.ID_Produk}`}
                        className="border border-amber-200 bg-amber-50 text-amber-800 font-semibold text-center px-3 py-1.5 whitespace-nowrap"
                        style={{ minWidth: 64 }}
                      >
                        {getProductShortCode(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Baris SALDO LALU */}
                  <tr className="font-bold">
                    <td className="border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 font-bold whitespace-nowrap">
                      SALDO LALU
                    </td>
                    {/* Produksi kolom SALDO LALU: kosong */}
                    {activeProducts.map(p => (
                      <td key={`psl-${p.ID_Produk}`} className="border border-emerald-100 bg-emerald-50/30 text-center px-2 py-2"></td>
                    ))}
                    {/* Distribusi kolom SALDO LALU: kosong */}
                    {activeProducts.map(p => (
                      <td key={`dsl-${p.ID_Produk}`} className="border border-blue-100 bg-blue-50/30 text-center px-2 py-2"></td>
                    ))}
                    {/* Stock kolom SALDO LALU: nilai saldo awal */}
                    {activeProducts.map(p => {
                      const val = saldoLalu[p.ID_Produk] || 0;
                      return (
                        <td key={`ssl-${p.ID_Produk}`} className="border border-amber-200 bg-amber-50 text-center px-2 py-2 font-bold text-slate-800 tabular-nums">
                          {val > 0 ? val.toLocaleString('id-ID') : ''}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Baris per hari aktif */}
                  {activeDays.length === 0 ? (
                    <tr>
                      <td
                        colSpan={1 + activeProducts.length * 3}
                        className="border border-slate-200 text-center py-8 text-slate-400 italic"
                      >
                        Tidak ada data transaksi untuk periode {formatBulanIndo(filterMonth)}
                      </td>
                    </tr>
                  ) : (
                    activeDays.map((day, idx) => {
                      const isEven = idx % 2 === 0;
                      const rowBg = isEven ? '' : 'bg-slate-50/50';
                      return (
                        <tr key={day} className={`hover:bg-blue-50/40 transition-colors ${rowBg}`}>
                          {/* Kolom Tanggal */}
                          <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">
                            {formatTanggalIndo(day)}
                          </td>
                          {/* Kolom Produksi per produk */}
                          {activeProducts.map(p => {
                            const val = dailyProd[day]?.[p.ID_Produk] || 0;
                            return (
                              <td
                                key={`p-${day}-${p.ID_Produk}`}
                                className="border border-emerald-100 text-center px-2 py-2 tabular-nums"
                              >
                                {val > 0 ? (
                                  <span className="font-bold text-emerald-700">{val.toLocaleString('id-ID')}</span>
                                ) : ''}
                              </td>
                            );
                          })}
                          {/* Kolom Distribusi per produk */}
                          {activeProducts.map(p => {
                            const val = dailyDist[day]?.[p.ID_Produk] || 0;
                            return (
                              <td
                                key={`d-${day}-${p.ID_Produk}`}
                                className="border border-blue-100 text-center px-2 py-2 tabular-nums text-slate-700"
                              >
                                {val > 0 ? val.toLocaleString('id-ID') : ''}
                              </td>
                            );
                          })}
                          {/* Kolom Stock per produk */}
                          {activeProducts.map(p => {
                            const val = runningStock[day]?.[p.ID_Produk] ?? 0;
                            return (
                              <td
                                key={`s-${day}-${p.ID_Produk}`}
                                className="border border-amber-200 bg-amber-50/50 text-center px-2 py-2 font-bold text-slate-800 tabular-nums"
                              >
                                {val.toLocaleString('id-ID')}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}

                  {/* Baris Total Produksi & Distribusi bulan ini */}
                  {activeDays.length > 0 && (
                    <tr className="font-bold bg-slate-100 border-t-2 border-slate-300">
                      <td className="border border-slate-300 px-3 py-2 text-slate-800 text-right whitespace-nowrap">
                        TOTAL BULAN INI
                      </td>
                      {activeProducts.map(p => {
                        const total = activeDays.reduce((s, d) => s + (dailyProd[d]?.[p.ID_Produk] || 0), 0);
                        return (
                          <td key={`tp-${p.ID_Produk}`} className="border border-emerald-300 bg-emerald-100 text-center px-2 py-2 text-emerald-900 tabular-nums">
                            {total > 0 ? total.toLocaleString('id-ID') : '-'}
                          </td>
                        );
                      })}
                      {activeProducts.map(p => {
                        const total = activeDays.reduce((s, d) => s + (dailyDist[d]?.[p.ID_Produk] || 0), 0);
                        return (
                          <td key={`td-${p.ID_Produk}`} className="border border-blue-300 bg-blue-100 text-center px-2 py-2 text-blue-900 tabular-nums">
                            {total > 0 ? total.toLocaleString('id-ID') : '-'}
                          </td>
                        );
                      })}
                      {/* Stock akhir = running stock di hari terakhir aktif */}
                      {activeProducts.map(p => {
                        const lastDay = activeDays[activeDays.length - 1];
                        const val = runningStock[lastDay]?.[p.ID_Produk] ?? 0;
                        return (
                          <td key={`ts-${p.ID_Produk}`} className="border border-amber-300 bg-amber-100 text-center px-2 py-2 text-amber-900 tabular-nums">
                            {val.toLocaleString('id-ID')}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Keterangan warna */}
            <div className="p-3 border-t border-slate-200 flex flex-wrap gap-4 text-xs text-slate-500 print:hidden">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-200 inline-block border border-emerald-300"></span>
                Produksi (angka hijau = qty masuk)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-blue-200 inline-block border border-blue-300"></span>
                Distribusi (qty keluar ke pelanggan)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-200 inline-block border border-amber-300"></span>
                Stock Produk (saldo berjalan = saldo kemarin + masuk − keluar)
              </span>
            </div>
          </div>
        </div>
      )}


      {/* Tab 2: Stok Bahan Penolong */}
      {activeTab === 'bahan_penolong' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Total Jenis Bahan Penolong</span>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{rawMaterials.length} Jenis</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Bahan Mendekati Minimum</span>
              <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">
                {Object.values(materialStockMap).filter(m => m.isCritical).length} Bahan
              </div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Stok Aman Terkendali</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                {Object.values(materialStockMap).filter(m => !m.isCritical).length} Bahan
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Monitoring Stok Bahan Baku & Penolong AMDK</h3>
              <button
                onClick={() => exportDataToExcel(Object.values(materialStockMap).map(i => ({
                  ID_Bahan: i.material.ID_Bahan,
                  Nama_Bahan: i.material.Nama_Bahan,
                  Satuan: i.material.Satuan,
                  Total_Masuk: i.inQty,
                  Total_Keluar: i.outQty,
                  Stok_Akhir: i.endStock,
                  Status: i.isCritical ? 'Kritis' : 'Aman'
                })), 'Stok_Bahan', 'AIRIS_Stok_Bahan_Penolong')}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">ID Bahan</th>
                    <th className="p-3">Nama Bahan Penolong</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Total Beli (Masuk)</th>
                    <th className="p-3 text-right">Total Pakai (Keluar)</th>
                    <th className="p-3 text-right">Stok Gudang Akhir</th>
                    <th className="p-3 text-center">Status Kelayakan Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {Object.values(materialStockMap).map(({ material, inQty, outQty, endStock, isCritical }) => (
                    <tr key={material.ID_Bahan} className={`hover:bg-slate-50/70 ${isCritical ? 'bg-red-50/30' : ''}`}>
                      <td className="p-3 font-bold text-blue-700">{material.ID_Bahan}</td>
                      <td className="p-3 font-sans font-semibold text-slate-900">{material.Nama_Bahan}</td>
                      <td className="p-3 font-sans text-slate-600">{material.Kategori}</td>
                      <td className="p-3 text-right font-semibold text-emerald-700 tabular-nums">+{inQty.toLocaleString('id-ID')} {material.Satuan}</td>
                      <td className="p-3 text-right font-semibold text-red-600 tabular-nums">-{outQty.toLocaleString('id-ID')} {material.Satuan}</td>
                      <td className="p-3 text-right font-bold text-base text-slate-900 tabular-nums">{endStock.toLocaleString('id-ID')} {material.Satuan}</td>
                      <td className="p-3 text-center font-sans">
                        {isCritical ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 flex items-center justify-center gap-1 w-max mx-auto">
                            <AlertTriangle size={12} /> Kritis! Segera PO
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 flex items-center justify-center gap-1 w-max mx-auto">
                            <CheckCircle2 size={12} /> Stok Aman
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Pembelian Bahan Masuk */}
      {activeTab === 'pembelian' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Riwayat Pembelian Bahan Penolong (Masuk)</h3>
            <button
              onClick={() => exportDataToExcel(purchases, 'Pembelian', `AIRIS_Pembelian_Bahan_${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Pembelian</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Nama Bahan</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-right">Qty Beli</th>
                  <th className="p-3 text-right">Harga Satuan</th>
                  <th className="p-3 text-right">Total Biaya</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 fst-italic font-sans">
                      Belum ada data pembelian bahan yang tercatat.
                    </td>
                  </tr>
                ) : (
                  purchases.map(p => (
                    <tr key={p.ID_Pembelian} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-blue-700">{p.ID_Pembelian}</td>
                      <td className="p-3 text-slate-500 font-mono">{formatDateDDMMYYYY(p.Tanggal)}</td>
                      <td className="p-3 font-sans font-semibold text-slate-900">{p.Nama_Bahan}</td>
                      <td className="p-3 font-sans text-slate-700">{p.Supplier}</td>
                      <td className="p-3 text-right font-bold text-emerald-700 tabular-nums">+{p.Qty.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right tabular-nums">Rp {p.Harga_Satuan.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right font-bold text-slate-900 tabular-nums">Rp {(p.Qty * p.Harga_Satuan).toLocaleString('id-ID')}</td>
                      <td className="p-3 font-sans text-slate-500">{p.Keterangan}</td>
                      <td className="p-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditPurchase(p)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                            title="Edit Pembelian"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(p.ID_Pembelian)}
                            className="p-1 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                            title="Hapus Pembelian"
                          >
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
      )}

      {/* Tab 4: Pemakaian Bahan Keluar */}
      {activeTab === 'pemakaian' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Riwayat Mutasi Pemakaian & Barang Rusak (Keluar)</h3>
            <button
              onClick={() => exportDataToExcel(mutations, 'Mutasi_Keluar', `AIRIS_Pemakaian_Bahan_${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Mutasi</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Nama Bahan</th>
                  <th className="p-3">Kategori Pemakaian</th>
                  <th className="p-3 text-right">Qty Keluar</th>
                  <th className="p-3">Keterangan / Referensi</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {mutations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 fst-italic font-sans">
                      Belum ada data mutasi pemakaian atau barang rusak tercatat.
                    </td>
                  </tr>
                ) : (
                  mutations.map(m => (
                    <tr key={m.ID_Mutasi} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-red-700">{m.ID_Mutasi}</td>
                      <td className="p-3 text-slate-500 font-mono">{formatDateDDMMYYYY(m.Tanggal)}</td>
                      <td className="p-3 font-sans font-semibold text-slate-900">{m.Nama_Bahan}</td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {m.Kategori}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-red-600 tabular-nums">-{m.Qty.toLocaleString('id-ID')}</td>
                      <td className="p-3 font-sans text-slate-500">{m.Keterangan}</td>
                      <td className="p-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditMutation(m)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                            title="Edit Mutasi"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteMutation(m.ID_Mutasi)}
                            className="p-1 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                            title="Hapus Mutasi"
                          >
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
      )}

      {/* Modal: Input / Edit Pembelian Bahan */}
      {showAddPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingPurchase ? `Edit Pembelian: ${editingPurchase.ID_Pembelian}` : 'Input Pembelian Bahan Baru (Masuk)'}
              </h3>
              <button onClick={() => setShowAddPurchaseModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={purchaseForm.Tanggal}
                    onChange={e => setPurchaseForm({ ...purchaseForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pemasok / Supplier</label>
                  <input
                    type="text"
                    placeholder="Nama vendor/supplier..."
                    value={purchaseForm.Supplier}
                    onChange={e => setPurchaseForm({ ...purchaseForm, Supplier: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Bahan Baku / Penolong</label>
                <select
                  value={purchaseForm.ID_Bahan}
                  onChange={e => setPurchaseForm({ ...purchaseForm, ID_Bahan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium"
                >
                  {rawMaterials.map(m => (
                    <option key={m.ID_Bahan} value={m.ID_Bahan}>{m.Nama_Bahan} ({m.Satuan})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jumlah (Qty Beli)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={purchaseForm.Qty ?? ''}
                    onChange={e => setPurchaseForm({ ...purchaseForm, Qty: e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={purchaseForm.Harga_Satuan ?? ''}
                    onChange={e => setPurchaseForm({ ...purchaseForm, Harga_Satuan: e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / No. Nota</label>
                <input
                  type="text"
                  placeholder="Keterangan..."
                  value={purchaseForm.Keterangan}
                  onChange={e => setPurchaseForm({ ...purchaseForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowAddPurchaseModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
              <button onClick={handleSavePurchase} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer">
                {editingPurchase ? 'Simpan Perubahan' : 'Simpan & Tambah Stok'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Catat / Edit Reject / Pemakaian */}
      {showAddMutationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingMutation ? `Edit Mutasi: ${editingMutation.ID_Mutasi}` : 'Catat Pemakaian Manual / Barang Rusak'}
              </h3>
              <button onClick={() => setShowAddMutationModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={mutationForm.Tanggal}
                    onChange={e => setMutationForm({ ...mutationForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={mutationForm.Kategori}
                    onChange={e => setMutationForm({ ...mutationForm, Kategori: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  >
                    <option>Barang Rusak (Reject)</option>
                    <option>Pemakaian Operasional</option>
                    <option>Barang Hilang / Selisih</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bahan yang Berkurang</label>
                <select
                  value={mutationForm.ID_Bahan}
                  onChange={e => setMutationForm({ ...mutationForm, ID_Bahan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                >
                  {rawMaterials.map(m => (
                    <option key={m.ID_Bahan} value={m.ID_Bahan}>{m.Nama_Bahan} ({m.Satuan})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Pengurangan (Qty)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={mutationForm.Qty ?? ''}
                  onChange={e => setMutationForm({ ...mutationForm, Qty: e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono font-bold text-red-600 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan / Catatan</label>
                <input
                  type="text"
                  placeholder="Alasan / catatan..."
                  value={mutationForm.Keterangan}
                  onChange={e => setMutationForm({ ...mutationForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowAddMutationModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
              <button onClick={handleSaveMutation} className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer">
                {editingMutation ? 'Simpan Perubahan' : 'Kurangi Stok Gudang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
