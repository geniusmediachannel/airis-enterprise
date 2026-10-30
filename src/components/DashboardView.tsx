import React, { useState, useMemo, useEffect } from 'react';
import { 
  Boxes, Factory, Truck, FlaskConical, Scale, 
  TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight,
  Package, Calendar, CheckCircle2, ChevronRight, Sparkles,
  Activity, ArrowRight, RotateCcw
} from 'lucide-react';
import { 
  ProductItem, ProductionItem, DistributionItem, 
  DistributionProductDetail, NotificationItem, GeneralJournalItem 
} from '../types';

interface DashboardViewProps {
  products: ProductItem[];
  productions: ProductionItem[];
  distributions: DistributionItem[];
  distributionItems: DistributionProductDetail[];
  notifications: NotificationItem[];
  journals: GeneralJournalItem[];
  onNavigateTo: (view: string) => void;
}

// ==============================================================
// ANIMATED COUNTER HOOK & COMPONENT (Count-up smoothly from 0)
// ==============================================================
const useAnimatedNumber = (target: number, duration: number = 1000): number => {
  const [current, setCurrent] = useState<number>(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animId: number;
    const startVal = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Easing out cubic: 1 - (1 - progress)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal + (target - startVal) * ease));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  return current;
};

const AnimatedCounter: React.FC<{
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  prefix?: string;
  suffix?: string;
}> = ({
  value,
  duration = 1100,
  formatter = (v) => v.toLocaleString('id-ID'),
  prefix = '',
  suffix = ''
}) => {
  const displayVal = useAnimatedNumber(value, duration);
  return (
    <>
      {prefix}{formatter(displayVal)}{suffix}
    </>
  );
};

// ==============================================================
// DATE PARSER: Supports ISO, Indonesian Month Names, Slashed, Excel Serials
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

  // ISO: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Slashed: DD/MM/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let yr = Number(slashMatch[3]);
    if (yr < 100) yr += 2000;
    const d = new Date(yr, Number(slashMatch[2]) - 1, Number(slashMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Text month name: 15-Okt-2026, 15 Okt 2026, 15-Oktober-2026
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
      if (!isNaN(q) && q >= 0) return Math.max(0, q);
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

  return sumItems;
};

// Helper: Get total qty for a distribution record (from all product quantities)
const getDistTotalQty = (
  dist: DistributionItem, 
  distItems: DistributionProductDetail[] | Map<string, DistributionProductDetail[]>,
  productList: ProductItem[]
): number => {
  const anyDist = dist as any;
  if (anyDist.Total_Qty !== undefined && Number(anyDist.Total_Qty) > 0) return Number(anyDist.Total_Qty);
  if (anyDist.Jumlah !== undefined && Number(anyDist.Jumlah) > 0) return Number(anyDist.Jumlah);
  if (anyDist.Qty !== undefined && Number(anyDist.Qty) > 0) return Number(anyDist.Qty);

  // Check sum of direct standard columns
  const c120 = Number(anyDist.C120 || anyDist.c120 || 0);
  const c220 = Number(anyDist.C220 || anyDist.c220 || 0);
  const b330 = Number(anyDist.B330 || anyDist.b330 || 0);
  const b600 = Number(anyDist.B600 || anyDist.b600 || 0);
  const g19 = Number(anyDist.G19 || anyDist.g19 || anyDist.GLN19 || anyDist.Galon || 0);
  const sumDirect = c120 + c220 + b330 + b600 + g19;
  if (sumDirect > 0) return sumDirect;

  let total = 0;
  for (let i = 0; i < productList.length; i++) {
    total += getDistProductQty(dist, distItems, productList[i]);
  }

  return total;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  productions,
  distributions,
  distributionItems,
  notifications,
  journals,
  onNavigateTo
}) => {
  const now = new Date();

  // 1. Deteksi seluruh tahun transaksi dari Produksi & Distribusi
  const detectedYears = new Set<number>();
  productions.forEach(p => {
    const dt = parseDateObj(p.Tanggal);
    if (dt) detectedYears.add(dt.getFullYear());
  });
  distributions.forEach(d => {
    const dt = parseDateObj(d.Tanggal);
    if (dt) detectedYears.add(dt.getFullYear());
  });

  const availableYears = Array.from(detectedYears).sort((a, b) => b - a);
  const defaultYear = availableYears.includes(now.getFullYear())
    ? now.getFullYear()
    : (availableYears[0] || now.getFullYear());

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const currentYear = selectedYear;

  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

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

  // 2. Standard Products (5 Varian Utama AMDK Tanpa Duplikasi)
  const standardProducts = useMemo(() => {
    const orderMap: Record<string, number> = { 'C120': 1, 'C220': 2, 'B330': 3, 'B600': 4, 'G19': 5 };
    const seen = new Set<string>();
    const list: ProductItem[] = [];

    const getCode = (p: any): string => {
      const code = getProductShortCode(p);
      return (code === 'GLN 19 L' || code.includes('GLN') || code.includes('G19')) ? 'G19' : code;
    };

    (products || []).forEach(p => {
      if (!p) return;
      const c = getCode(p);
      if (!seen.has(c)) {
        seen.add(c);
        list.push(p);
      }
    });

    // Pastikan 5 varian standar selalu ada
    const fallbackDefaults: ProductItem[] = [
      { ID_Produk: 'ASH-CUP120', Nama_Produk: 'As-Shofaa Cup 120ml', Kategori: 'Air Mineral Cup', Satuan: 'Dus', Harga_Distributor: 12000, Harga_Agen: 13000, Harga_Reseller: 14000, Harga_Konsumen: 16000, Status: 'Aktif' },
      { ID_Produk: 'ASH-CUP220', Nama_Produk: 'As-Shofaa Cup 220ml', Kategori: 'Air Mineral Cup', Satuan: 'Dus', Harga_Distributor: 14500, Harga_Agen: 15500, Harga_Reseller: 16500, Harga_Konsumen: 18500, Status: 'Aktif' },
      { ID_Produk: 'ASH-BTL330', Nama_Produk: 'As-Shofaa Botol 330ml', Kategori: 'Air Mineral Botol', Satuan: 'Dus', Harga_Distributor: 24000, Harga_Agen: 26000, Harga_Reseller: 28000, Harga_Konsumen: 32000, Status: 'Aktif' },
      { ID_Produk: 'ASH-BTL600', Nama_Produk: 'As-Shofaa Botol 600ml', Kategori: 'Air Mineral Botol', Satuan: 'Dus', Harga_Distributor: 28000, Harga_Agen: 30000, Harga_Reseller: 32000, Harga_Konsumen: 36000, Status: 'Aktif' },
      { ID_Produk: 'ASH-GLN19L', Nama_Produk: 'As-Shofaa Galon 19L', Kategori: 'Air Mineral Galon', Satuan: 'Galon', Harga_Distributor: 9000, Harga_Agen: 10000, Harga_Reseller: 11000, Harga_Konsumen: 13000, Status: 'Aktif' }
    ];

    fallbackDefaults.forEach(dp => {
      const c = getCode(dp);
      if (!seen.has(c)) {
        seen.add(c);
        list.push(dp);
      }
    });

    list.sort((a, b) => (orderMap[getCode(a)] || 99) - (orderMap[getCode(b)] || 99));
    return list;
  }, [products]);

  // 3. Real-Time Stock per Product (Produksi Masuk - Distribusi Keluar) - memoized
  const productStockMap = useMemo(() => {
    const stockMap: Record<string, { product: ProductItem; inQty: number; outQty: number; stock: number }> = {};
    const getCode = (p: any): string => {
      const code = getProductShortCode(p);
      return (code === 'GLN 19 L' || code.includes('GLN') || code.includes('G19')) ? 'G19' : code;
    };

    standardProducts.forEach(p => {
      const c = getCode(p);
      stockMap[c] = { product: p, inQty: 0, outQty: 0, stock: 0 };
    });

    productions.forEach(p => {
      const c = getCode({ ID_Produk: p.ID_Produk, Nama_Produk: (p as any).Nama_Produk });
      if (stockMap[c]) {
        stockMap[c].inQty += (Number(p.Jumlah) || 0);
      }
    });

    distributions.forEach(dist => {
      standardProducts.forEach(p => {
        const c = getCode(p);
        const q = getDistProductQty(dist, distItemsMap, p);
        if (stockMap[c]) {
          stockMap[c].outQty += q;
        }
      });
    });

    Object.values(stockMap).forEach(item => {
      item.stock = item.inQty - item.outQty;
    });

    return stockMap;
  }, [standardProducts, productions, distributions, distItemsMap]);

  // 3. Monthly trends 12 months array for Line Chart (Tahun Terpilih) - memoized
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const { prodMonthly, distMonthly } = useMemo(() => {
    const pm = new Array(12).fill(0);
    const dm = new Array(12).fill(0);

    productions.forEach(p => {
      if (p.Tanggal) {
        const dt = parseDateObj(p.Tanggal);
        if (dt && dt.getFullYear() === currentYear) {
          const m = dt.getMonth();
          if (m >= 0 && m < 12) {
            pm[m] += (Number(p.Jumlah) || 0);
          }
        }
      }
    });

    distributions.forEach(d => {
      if (d.Tanggal) {
        const dt = parseDateObj(d.Tanggal);
        if (dt && dt.getFullYear() === currentYear) {
          const m = dt.getMonth();
          if (m >= 0 && m < 12) {
            const qty = getDistTotalQty(d, distItemsMap, products);
            dm[m] += qty;
          }
        }
      }
    });

    return { prodMonthly: pm, distMonthly: dm };
  }, [productions, distributions, distItemsMap, products, currentYear]);

  // 4. Production vs Distribution Stats for Current / Latest Active Month (O(1) derived from monthly trends)
  const targetMonth = now.getMonth();
  let monthlyProduction = prodMonthly[targetMonth] || 0;
  let monthlyDistribution = distMonthly[targetMonth] || 0;

  // Jika bulan sistem saat ini bernilai 0 di tahun terpilih, tampilkan bulan aktif terakhir di tahun terpilih
  let activeMonthLabel = months[targetMonth];
  if (monthlyProduction === 0 && monthlyDistribution === 0) {
    let lastActiveMonth = -1;
    for (let m = 11; m >= 0; m--) {
      if (prodMonthly[m] > 0 || distMonthly[m] > 0) {
        lastActiveMonth = m;
        break;
      }
    }
    if (lastActiveMonth !== -1) {
      monthlyProduction = prodMonthly[lastActiveMonth];
      monthlyDistribution = distMonthly[lastActiveMonth];
      activeMonthLabel = months[lastActiveMonth];
    }
  }

  // 5. Operational KPI Totals (Tahun Terpilih & Total Stok Gudang Siap Kirim)
  const annualProduction = prodMonthly.reduce((s, v) => s + v, 0);
  const totalStockReady = Object.values(productStockMap).reduce((s, item) => s + Math.max(0, item.stock), 0);

  // 6. Coordinates for SVG Line Chart (diagram garis)
  const chartHeight = 200;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 20;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const rawMax = Math.max(...prodMonthly, ...distMonthly, 100);
  const yMax = Math.ceil(rawMax / 100) * 100;

  const getX = (idx: number) => paddingX + (idx / 11) * innerWidth;
  const getY = (val: number) => paddingY + innerHeight - (val / yMax) * innerHeight;

  // Animation progress untuk grafik diagram garis & visual tumbuh dari 0 (0.0 -> 1.0)
  const [animTrigger, setAnimTrigger] = useState<number>(0);
  const [chartAnimProgress, setChartAnimProgress] = useState<number>(0);

  useEffect(() => {
    setChartAnimProgress(0);
    let startTimestamp: number | null = null;
    let animId: number;
    const duration = 1200; // 1.2 detik smooth easing

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Easing out cubic: kurva halus meluncur naik dari 0
      const ease = 1 - Math.pow(1 - progress, 3);
      setChartAnimProgress(ease);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setChartAnimProgress(1);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [selectedYear, animTrigger]);

  // Interpolasi titik kurva dari 0 ke nilai aktual saat dashboard dibuka
  const animatedProdMonthly = useMemo(() => {
    return prodMonthly.map(val => val * chartAnimProgress);
  }, [prodMonthly, chartAnimProgress]);

  const animatedDistMonthly = useMemo(() => {
    return distMonthly.map(val => val * chartAnimProgress);
  }, [distMonthly, chartAnimProgress]);

  // Build SVG path strings menggunakan data teranimasi
  const prodPoints = animatedProdMonthly.map((val, idx) => ({ x: getX(idx), y: getY(val), val: prodMonthly[idx] }));
  const distPoints = animatedDistMonthly.map((val, idx) => ({ x: getX(idx), y: getY(val), val: distMonthly[idx] }));

  const prodPath = prodPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const distPath = distPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

  // Area paths for subtle gradient fills
  const prodArea = `${prodPath} L ${getX(11)} ${paddingY + innerHeight} L ${getX(0)} ${paddingY + innerHeight} Z`;
  const distArea = `${distPath} L ${getX(11)} ${paddingY + innerHeight} L ${getX(0)} ${paddingY + innerHeight} Z`;

  return (
    <div key={animTrigger} className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl text-white shadow-lg relative overflow-hidden group">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Pabrik AMDK Terpadu
            </span>
            <span className="text-xs text-blue-200">•</span>
            <span className="text-xs text-blue-200">Klaten, Jawa Tengah</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1 flex items-center gap-2">
            Sistem Manajemen Terpadu AIRIS
            <Sparkles size={16} className="text-amber-300 animate-pulse" />
          </h2>
          <p className="text-xs text-blue-100/90 mt-1 max-w-xl">
            Monitoring produksi, logistik armada, mutu SNI 3553:2023, serta ketersediaan stok produk jadi secara terintegrasi real-time.
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="relative z-10 flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => onNavigateTo('produksi')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-xs"
          >
            <Factory size={13} className="text-blue-300" />
            <span>Produksi</span>
          </button>
          <button
            onClick={() => onNavigateTo('distribusi')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-xs"
          >
            <Truck size={13} className="text-purple-300" />
            <span>Distribusi</span>
          </button>
          <button
            onClick={() => onNavigateTo('stock')}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-xs shadow-xs"
          >
            <Boxes size={13} className="text-amber-300" />
            <span>Gudang Stok</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigateTo('produksi')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 group-hover:w-1.5 transition-all"></div>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pl-1">
            <span>Produksi Bulan Ini ({activeMonthLabel})</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
              <Factory size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums pl-1">
            <AnimatedCounter value={monthlyProduction} /> <span className="text-xs font-normal text-slate-500">Unit</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-600 font-medium pl-1">
            <span className="flex items-center gap-1">
              <ArrowUpRight size={13} />
              Tercatat aktif di jalur produksi
            </span>
            <ChevronRight size={13} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTo('distribusi')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-600 group-hover:w-1.5 transition-all"></div>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pl-1">
            <span>Distribusi Bulan Ini ({activeMonthLabel})</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
              <Truck size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums pl-1">
            <AnimatedCounter value={monthlyDistribution} /> <span className="text-xs font-normal text-slate-500">Dus/Gln</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-purple-600 font-medium pl-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} />
              Surat Jalan &amp; Invoice terbit
            </span>
            <ChevronRight size={13} className="text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTo('produksi')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600 group-hover:w-1.5 transition-all"></div>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pl-1">
            <span>Total Produksi {currentYear}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
              <Package size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums pl-1">
            <AnimatedCounter value={annualProduction} /> <span className="text-xs font-normal text-slate-500">Unit</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 pl-1">
            <span>Akumulasi produksi tahun {currentYear}</span>
            <ChevronRight size={13} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTo('stock')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-600 group-hover:w-1.5 transition-all"></div>
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pl-1">
            <span>Total Stok Siap Kirim</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
              <Boxes size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono tabular-nums pl-1">
            <AnimatedCounter value={totalStockReady} /> <span className="text-xs font-normal text-slate-500">Dus/Gln</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 pl-1">
            <span>{standardProducts.length} Varian produk di gudang</span>
            <ChevronRight size={13} className="text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </div>

      {/* Real-Time Warehouse Stock Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Stok Gudang Produk Jadi (Real-Time)</h3>
            <span className="text-xs text-slate-500">(Produksi Masuk - Distribusi Keluar)</span>
          </div>
          <button
            onClick={() => onNavigateTo('stock')}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            <span>Buku Stok Lengkap</span>
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {Object.values(productStockMap).map(({ product, inQty, outQty, stock }) => {
            const isCritical = stock <= 50;
            const isWarning = stock > 50 && stock <= 200;
            const cleanName = product.Nama_Produk.replace(/As-Shofaa[']?\s*/gi, '');
            return (
              <div 
                key={product.ID_Produk}
                onClick={() => onNavigateTo('stock')}
                className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                    {cleanName}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                    {product.Satuan}
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono tabular-nums tracking-tight">
                  <AnimatedCounter value={stock} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full inline-flex items-center gap-1 ${
                    isCritical 
                      ? 'bg-rose-100 text-rose-700' 
                      : isWarning 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-rose-600 animate-ping' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'}`}></span>
                    {isCritical ? 'Menipis' : isWarning ? 'Siap Produksi' : 'Stok Aman'}
                  </span>
                </div>
                {/* Visual bar level stok animasi tumbuh dari 0 */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, Math.max(10, inQty > 0 ? (stock / inQty) * 100 : 35)) * chartAnimProgress}%` 
                    }}
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-emerald-700 font-semibold">+<AnimatedCounter value={inQty} /> in</span>
                  <span className="text-rose-600 font-semibold">-<AnimatedCounter value={outQty} /> out</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid: DIAGRAM GARIS Tren Produksi vs Distribusi & Feed Notifikasi */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: LINE CHART DIAGRAM GARIS */}
        <div className="lg:col-span-2 p-5 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Diagram Garis Tren Produksi vs Distribusi ({currentYear})</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Diagram garis perbandingan kuantitas unit produk per bulan</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
              {availableYears.length > 1 && (
                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-normal">Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => setAnimTrigger(prev => prev + 1)}
                title="Putar ulang animasi grafik & angka dari 0"
                className="px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <RotateCcw size={12} className="hover:-rotate-90 transition-transform duration-300 text-blue-600" />
                <span className="text-[11px] font-medium hidden sm:inline">Animasi</span>
              </button>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-blue-600 inline-block"></span>
                <span className="text-slate-700">Garis Produksi (In)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-purple-600 inline-block"></span>
                <span className="text-slate-700">Garis Distribusi (Out)</span>
              </div>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[620px]">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-64 overflow-visible">
                <defs>
                  <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity="0.20" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                  const yPos = paddingY + innerHeight * (1 - pct);
                  const labelVal = Math.round(yMax * pct);
                  return (
                    <g key={i}>
                      <line
                        x1={paddingX}
                        y1={yPos}
                        x2={chartWidth - paddingX}
                        y2={yPos}
                        stroke="#e2e8f0"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={paddingX - 8}
                        y={yPos + 3.5}
                        textAnchor="end"
                        fontSize="9"
                        fill="#94a3b8"
                        fontFamily="monospace"
                      >
                        {labelVal}
                      </text>
                    </g>
                  );
                })}

                {/* Area Fills */}
                <path d={prodArea} fill="url(#prodGradient)" />
                <path d={distArea} fill="url(#distGradient)" />

                {/* Line Paths */}
                <path
                  d={prodPath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={distPath}
                  fill="none"
                  stroke="#9333ea"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points (Dots) & Hover triggers */}
                {months.map((m, idx) => {
                  const pPt = prodPoints[idx];
                  const dPt = distPoints[idx];
                  const isHovered = hoveredMonthIdx === idx;

                  return (
                    <g key={m} className="cursor-pointer">
                      {/* Vertical highlight line on hover */}
                      {isHovered && (
                        <line
                          x1={pPt.x}
                          y1={paddingY}
                          x2={pPt.x}
                          y2={paddingY + innerHeight}
                          stroke="#cbd5e1"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Produksi Dot */}
                      <circle
                        cx={pPt.x}
                        cy={pPt.y}
                        r={isHovered ? 6 : 4}
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-all"
                      />

                      {/* Distribusi Dot */}
                      <circle
                        cx={dPt.x}
                        cy={dPt.y}
                        r={isHovered ? 6 : 4}
                        fill="#9333ea"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-all"
                      />

                      {/* Transparent Hover Area */}
                      <rect
                        x={pPt.x - (innerWidth / 24)}
                        y={paddingY}
                        width={innerWidth / 12}
                        height={innerHeight}
                        fill="transparent"
                        onMouseEnter={() => setHoveredMonthIdx(idx)}
                        onMouseLeave={() => setHoveredMonthIdx(null)}
                      />

                      {/* Month Label */}
                      <text
                        x={pPt.x}
                        y={paddingY + innerHeight + 16}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight={isHovered ? 'bold' : 'normal'}
                        fill={isHovered ? '#0f172a' : '#64748b'}
                      >
                        {m}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Line Chart Hover Detail Box */}
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50/60 via-purple-50/40 to-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between text-xs transition-all duration-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="font-bold text-slate-800">
                {hoveredMonthIdx !== null 
                  ? `Rincian Bulan ${months[hoveredMonthIdx]} ${currentYear}:`
                  : `Arahkan kursor pada titik garis untuk melihat angka per bulan:`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono text-xs font-bold">
              <span className="text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md border border-blue-200">
                Produksi: {hoveredMonthIdx !== null ? prodMonthly[hoveredMonthIdx].toLocaleString('id-ID') : monthlyProduction.toLocaleString('id-ID')} Unit
              </span>
              <span className="text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md border border-purple-200">
                Distribusi: {hoveredMonthIdx !== null ? distMonthly[hoveredMonthIdx].toLocaleString('id-ID') : monthlyDistribution.toLocaleString('id-ID')} Unit
              </span>
              {hoveredMonthIdx !== null && prodMonthly[hoveredMonthIdx] > 0 && (
                <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200 font-sans text-[11px]">
                  Rasio Distribusi: {Math.round((distMonthly[hoveredMonthIdx] / prodMonthly[hoveredMonthIdx]) * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Urgent Activity Alerts */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Perhatian & Antrean Tugas</h3>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
              <AnimatedCounter value={notifications.length} duration={600} /> Perlu Respon
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-72">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                Semua tugas operasional telah selesai dikerjakan!
              </div>
            ) : (
              notifications.slice(0, 4).map(n => (
                <div
                  key={n.id}
                  onClick={() => onNavigateTo(n.targetView || n.actionView || 'dashboard')}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                    n.type === 'kritis' 
                      ? 'bg-red-50/70 border-red-200 hover:bg-red-50' 
                      : n.type === 'spk' 
                      ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate">{n.title}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{n.date}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug line-clamp-2">{n.message}</p>
                </div>
              ))
            )}
          </div>

          {notifications.length > 4 && (
            <button
              onClick={() => onNavigateTo('produksi')}
              className="mt-3 pt-2 border-t border-slate-100 text-xs font-semibold text-blue-600 text-center hover:underline block"
            >
              Lihat seluruh ({notifications.length}) notifikasi aktivitas
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
