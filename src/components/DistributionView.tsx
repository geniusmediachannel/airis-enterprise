import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, Plus, FileText, Printer, Download, 
  MapPin, User, Calendar, Check, X, Eye, FileCheck,
  Edit2, Trash2, Upload, FileDown, CheckCircle2,
  Clock, ArrowRight, BarChart2, PackageCheck, Send, FolderOpen,
  Settings, Image, RotateCcw, TrendingUp, Sparkles, Search,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  DistributionItem, DistributionProductDetail, ProductItem, 
  CustomerItem, SpecialPriceItem, DraftJournalItem, ReceivablePayableItem,
  DeliveryPlanItem, DocumentTemplateSettings
} from '../types';
import { getTableData, setTableData } from '../services/dbAdapter';
import { exportDataToExcel } from '../services/excelService';
import { 
  generateInvoicePDF, generateSuratJalanPDF, generateDistributionReportPDF, generateTableReportPDF, sanitizeFilename, angkaKeTerbilang, formatRupiahSen 
} from '../services/pdfService';
import { KopSuratBanner, OfficialStampWithSignature } from './InvoiceOfficialAssets';
import { showToast } from './ToastContainer';
import { confirmAction } from './ConfirmDialog';
import { sanitizeAndRepairDistributionDatabase } from '../services/distributionService';

interface DistributionViewProps {
  distributions: DistributionItem[];
  distributionItems: DistributionProductDetail[];
  products: ProductItem[];
  customers: CustomerItem[];
  specialPrices: SpecialPriceItem[];
  onRefresh: () => void;
}

// Month matcher supporting ISO (2026-10-01), 2-digit years (01-Okt-26, 01/10/26), and "all" filter
const isMatchMonth = (dateStr?: string, targetMonth?: string): boolean => {
  if (!targetMonth || targetMonth === 'all' || targetMonth === '') return true;
  if (!dateStr) return false;
  if (dateStr.startsWith(targetMonth)) return true;

  const parts = targetMonth.split('-');
  if (parts.length === 2) {
    const yr = parts[0];              // '2026'
    const yr2 = parts[0].slice(-2);    // '26'
    const mNum = parts[1].padStart(2, '0'); // '10'
    const mIdx = parseInt(parts[1], 10) - 1;

    // 1. Check for 2-digit year ISO format: '26-10-...'
    if (dateStr.startsWith(`${yr2}-${mNum}`)) return true;

    // 2. Check for DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
    if (dateStr.includes(`/${mNum}/${yr}`) || dateStr.includes(`-${mNum}-${yr}`) ||
        dateStr.includes(`/${mNum}/${yr2}`) || dateStr.includes(`-${mNum}-${yr2}`)) {
      return true;
    }

    // 3. Check for Indonesian month name with 4-digit or 2-digit year (e.g. 'okt' and '2026' or '26')
    const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
    const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    if (mIdx >= 0 && mIdx < 12) {
      const monCode = months[mIdx];
      const monCodeEn = monthsEn[mIdx];
      const lower = dateStr.toLowerCase();
      const hasMonth = lower.includes(monCode) || lower.includes(monCodeEn);
      const hasYear = lower.includes(yr) || lower.includes(yr2);
      if (hasMonth && hasYear) return true;
    }
  }
  return false;
};

// Robust helper to parse year and month index (0-11) from various Indonesian & ISO date formats
const parseDateYearAndMonth = (dateStr?: string | number): { year: string; monthIndex: number } | null => {
  if (!dateStr) return null;

  // Handle Excel numeric date serials (e.g. 45590)
  if (typeof dateStr === 'number' || (!isNaN(Number(dateStr)) && Number(dateStr) > 30000 && Number(dateStr) < 60000)) {
    const serial = Number(dateStr);
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return { year: String(d.getFullYear()), monthIndex: d.getMonth() };
    }
  }

  const str = String(dateStr).trim();
  if (!str) return null;

  // 1. Pattern: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const yr = ymdMatch[1];
    const m = parseInt(ymdMatch[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: yr, monthIndex: m };
  }

  // 2. Pattern: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const yr = dmyMatch[3];
    const m = parseInt(dmyMatch[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: yr, monthIndex: m };
  }

  // 3. Pattern: DD/MM/YY or DD-MM-YY (2-digit year)
  const dmyShortMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const yr = '20' + dmyShortMatch[3];
    const m = parseInt(dmyShortMatch[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: yr, monthIndex: m };
  }

  // 4. Pattern: YY-MM-DD
  const ymdShortMatch = str.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdShortMatch && parseInt(ymdShortMatch[1], 10) >= 20 && parseInt(ymdShortMatch[1], 10) <= 35) {
    const yr = '20' + ymdShortMatch[1];
    const m = parseInt(ymdShortMatch[2], 10) - 1;
    if (m >= 0 && m < 12) return { year: yr, monthIndex: m };
  }

  // 5. Pattern with month names (Jan-Des / Jan-Dec)
  const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
  const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const lower = str.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (lower.includes(months[i]) || lower.includes(monthsEn[i])) {
      const yrMatch = str.match(/(20\d{2})/);
      if (yrMatch) {
        return { year: yrMatch[1], monthIndex: i };
      }
      const yrShortMatch = str.match(/(?:'|\s|-|\/)(\d{2})(?:\s|$)/);
      if (yrShortMatch) {
        return { year: '20' + yrShortMatch[1], monthIndex: i };
      }
    }
  }

  // 6. Native Date fallback
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return { year: String(dt.getFullYear()), monthIndex: dt.getMonth() };
  }

  return null;
};

// Robust timestamp extractor for sorting dates in diverse formats (ISO, DD/MM/YYYY, DD-MMM-YY, etc)
const toComparableDate = (dateStr?: string | number): number => {
  if (!dateStr && dateStr !== 0) return 0;
  // Handle Excel numeric date serials (e.g. 45590)
  if (typeof dateStr === 'number' || (!isNaN(Number(dateStr)) && Number(dateStr) > 30000 && Number(dateStr) < 60000)) {
    const serial = Number(dateStr);
    return (serial - 25569) * 86400 * 1000;
  }
  const str = String(dateStr).trim();
  if (!str) return 0;

  // 1. Pattern: YYYY-MM-DD or YYYY/MM/DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    return new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10)).getTime();
  }
  // 2. Pattern: DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10)).getTime();
  }
  // 3. Pattern: DD/MM/YY or DD-MM-YY (2-digit year)
  const dmyShort = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShort) {
    const yr = 2000 + parseInt(dmyShort[3], 10);
    return new Date(yr, parseInt(dmyShort[2], 10) - 1, parseInt(dmyShort[1], 10)).getTime();
  }
  // 4. Pattern: YY-MM-DD
  const ymdShort = str.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdShort) {
    const yr = 2000 + parseInt(ymdShort[1], 10);
    return new Date(yr, parseInt(ymdShort[2], 10) - 1, parseInt(ymdShort[3], 10)).getTime();
  }
  // 5. Pattern with month names (Jan-Des / Jan-Dec)
  const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
  const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const lower = str.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (lower.includes(months[i]) || lower.includes(monthsEn[i])) {
      const yrMatch = str.match(/(20\d{2})/);
      const dayMatch = str.match(/^(\d{1,2})/);
      const yr = yrMatch ? parseInt(yrMatch[1], 10) : 2026;
      const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
      return new Date(yr, i, day).getTime();
    }
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? 0 : fallback.getTime();
};

// Robust helper to extract numeric sequence from Surat Jalan (e.g. "001/X/26" -> 1, "224/X/26" -> 224)
const extractSjNumber = (sjStr?: string): number => {
  if (!sjStr) return 0;
  const match = String(sjStr).match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

export const DistributionView: React.FC<DistributionViewProps> = ({
  distributions,
  distributionItems,
  products,
  customers,
  specialPrices,
  onRefresh
}) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = String(now.getFullYear());
  
  // Default menampilkan seluruh data per bulan aktif dalam satu sheet (tanpa halaman)
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    try {
      const lastImported = localStorage.getItem('airis_last_imported_dist_month');
      if (lastImported) {
        return lastImported;
      }
    } catch {}
    return currentMonth;
  });

  const [searchQueryDist, setSearchQueryDist] = useState<string>('');

  // Sort order filter: 'asc' (Terlama: Tanggal 1 s.d. 31) vs 'desc' (Terbaru: Tanggal 31 s.d. 1)
  const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('asc');

  // Helper konversi nama bulan (misal "2026-10" -> "Oktober 2026")
  const formatMonthName = (mStr: string): string => {
    if (!mStr || mStr === 'all') return 'Semua Periode';
    const parts = mStr.split('-');
    if (parts.length === 2) {
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${months[mIdx]} ${parts[0]}`;
      }
    }
    return mStr;
  };

  // Pre-index distributionItems by ID_Distribusi using Map (O(1) hash lookup anti-lag)
  const distItemsMap = useMemo(() => {
    const map = new Map<string, DistributionProductDetail[]>();
    (distributionItems || []).forEach(it => {
      if (!it || !it.ID_Distribusi) return;
      const pid = String(it.ID_Distribusi).trim();
      let arr = map.get(pid);
      if (!arr) {
        arr = [];
        map.set(pid, arr);
      }
      arr.push(it);
    });
    return map;
  }, [distributionItems]);

  // Pre-index distributionItems by No Surat Jalan (O(1) hash lookup anti-lag)
  const distItemsBySjMap = useMemo(() => {
    const map = new Map<string, DistributionProductDetail[]>();
    (distributionItems || []).forEach(it => {
      if (!it || !it.ID_Detail) return;
      const parts = String(it.ID_Detail).split('-');
      if (parts.length >= 3) {
        const sjKey = parts[2].trim().toLowerCase();
        let arr = map.get(sjKey);
        if (!arr) {
          arr = [];
          map.set(sjKey, arr);
        }
        arr.push(it);
      }
    });
    return map;
  }, [distributionItems]);

  // Restore filter month from last imported batch & Auto-reconcile data Galon
  useEffect(() => {
    try {
      const lastImported = localStorage.getItem('airis_last_imported_dist_month');
      if (lastImported) {
        if (lastImported === 'all') {
          setFilterMonth('all');
        } else {
          const hasData = (distributions || []).some(d => isMatchMonth(d.Tanggal, lastImported));
          setFilterMonth(hasData ? lastImported : 'all');
        }
        localStorage.removeItem('airis_last_imported_dist_month');
      }

      // Auto-reconcile: Pulihkan item galon jika ada transaksi pesanan galon murni (semua dus = 0 & tagihan > 0)
      const allDists = getTableData<DistributionItem>('Distribusi', []);
      const allItems = getTableData<DistributionProductDetail>('Distribusi_Item', []);
      const existingItemParentIds = new Set(allItems.map(it => String(it.ID_Distribusi).trim()));
      const itemsToAdd: DistributionProductDetail[] = [];
      let hasHealedDist = false;

      const updatedDists = allDists.map(d => {
        const anyD = d as any;
        const totalDus = (Number(anyD.C120) || 0) + (Number(anyD.C220) || 0) + (Number(anyD.B330) || 0) + (Number(anyD.B600) || 0);
        const currentGalon = Number(anyD.G19 || anyD.g19 || anyD.Galon || anyD.galon || anyD.GLN19 || anyD['ASH-GLN19L'] || 0);
        const tagihan = Number(d.Total_Tagihan || anyD.Tagihan || 0);

        if (totalDus === 0 && currentGalon === 0 && tagihan > 0) {
          let derived = 0;
          if (tagihan % 12000 === 0) derived = Math.round(tagihan / 12000);
          else if (tagihan % 9000 === 0) derived = Math.round(tagihan / 9000);
          else if (tagihan % 10000 === 0) derived = Math.round(tagihan / 10000);
          else if (tagihan % 15000 === 0) derived = Math.round(tagihan / 15000);
          else if (tagihan >= 9000) derived = Math.round(tagihan / 12000);

          if (derived > 0) {
            hasHealedDist = true;
            anyD.G19 = derived;
            anyD.g19 = derived;
            anyD.Galon = derived;
            anyD.galon = derived;
            anyD.GLN19 = derived;
            anyD['ASH-GLN19L'] = derived;

            if (!existingItemParentIds.has(String(d.ID_Distribusi).trim())) {
              itemsToAdd.push({
                ID_Detail: `${d.ID_Distribusi}-G19`,
                ID_Distribusi: d.ID_Distribusi,
                Nama_Pelanggan: d.Nama_Pelanggan,
                Tanggal: d.Tanggal,
                Level_Pelanggan: d.Level_Pelanggan || 'Distributor',
                ID_Produk: 'ASH-GLN19L',
                Nama_Produk: 'As-Shofaa Galon 19L',
                Qty: derived,
                Harga_Satuan: Math.round(tagihan / derived),
                Subtotal: tagihan,
                Satuan: 'Galon'
              });
            }
          }
        }
        return d;
      });

      if (hasHealedDist) {
        setTableData('Distribusi', updatedDists);
        if (itemsToAdd.length > 0) {
          setTableData('Distribusi_Item', [...allItems, ...itemsToAdd]);
        }
      }
    } catch {
      // ignore
    }
  }, [distributions]);

  // Delivery Plans (Rencana Distribusi / List Pesanan) - Memoized anti-lag
  const deliveryPlans = useMemo(() => getTableData<DeliveryPlanItem>('Rencana_Distribusi', []), [distributions]);

  // Modals
  const [showAddDistModal, setShowAddDistModal] = useState(false);
  const [editingDist, setEditingDist] = useState<DistributionItem | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<DeliveryPlanItem | null>(null);
  const [planForm, setPlanForm] = useState({
    Tanggal_Rencana: new Date().toISOString().slice(0, 10),
    ID_Pelanggan: customers[0]?.ID_Pelanggan || 'PLG-0001',
    Metode_Kirim: 'Kirim Armada' as 'Kirim Armada' | 'Ambil Sendiri',
    Alamat_Tujuan: '',
    Sopir: '',
    Keterangan: ''
  });
  const [planItems, setPlanItems] = useState<{ ID_Produk: string; Qty: number; Harga_Satuan: number }[]>([
    { ID_Produk: products[0]?.ID_Produk || 'ASH-CUP220', Qty: '' as any, Harga_Satuan: '' as any }
  ]);

  const [viewDocModal, setViewDocModal] = useState<{ 
    dist: DistributionItem; 
    items: DistributionProductDetail[]; 
    docType: 'sj' | 'inv' 
  } | null>(null);

  // Document Template Settings State (Kop Surat, Cap, TTD, Penandatangan, Info Pembayaran)
  const defaultDocSettings: DocumentTemplateSettings = {
    namaPerusahaan: 'PT. ANUGERAH ILLAHI RABBI',
    subNamaPerusahaan: 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa',
    alamatPerusahaan: 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara',
    kontakPerusahaan: '(0272) 898123',
    customKopImage: '',
    useCustomKopImage: false,
    customCapImage: '',
    useCustomCapImage: false,
    showCap: true,
    customTtdImage: '',
    useCustomTtdImage: false,
    showTtd: true,
    namaPenandatangan: 'Marko Dwi Nugroho',
    jabatanPenandatangan: 'PT. ANUGERAH ILLAHI RABBI',
    infoPembayaranTeks: 'pembayaran dapat memalui Transfer/Cash By Driver',
    bankRekening: 'BSI 1607134444 (BMT Syech Hasyim Asyari)'
  };

  const [docSettings, setDocSettings] = useState<DocumentTemplateSettings>(() => {
    return getTableData<DocumentTemplateSettings>('Pengaturan_Dokumen', [defaultDocSettings])[0] || defaultDocSettings;
  });
  const [showDocSettingsModal, setShowDocSettingsModal] = useState(false);
  const [tempDocSettings, setTempDocSettings] = useState<DocumentTemplateSettings>(() => {
    return getTableData<DocumentTemplateSettings>('Pengaturan_Dokumen', [defaultDocSettings])[0] || defaultDocSettings;
  });

  const handleOpenDocSettings = () => {
    setTempDocSettings({ ...docSettings });
    setShowDocSettingsModal(true);
  };

  const handleSaveDocSettings = () => {
    setDocSettings(tempDocSettings);
    setTableData('Pengaturan_Dokumen', [tempDocSettings]);
    setShowDocSettingsModal(false);
    showToast('Pengaturan Disimpan', 'Format Kop Surat, Cap, TTD, dan Informasi Dokumen berhasil diperbarui.', 'success');
  };

  const handleResetDocSettings = () => {
    setTempDocSettings({ ...defaultDocSettings });
  };

  // Helper to downscale and compress uploaded images so PDF size remains under 250 KB
  const compressUploadedImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = document.createElement('img');
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
          }
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // LAPORAN DISTRIBUSI MODAL (3 TABS: REKAP DISTRIBUSI & PRODUK, PER KONSUMEN, TAHUNAN)
  const [showDistReportModal, setShowDistReportModal] = useState(false);
  const [distReportTab, setDistReportTab] = useState<'rekap' | 'konsumen' | 'tahunan'>('rekap');
  const [distReportFilter, setDistReportFilter] = useState<'bulan' | 'tahun' | 'seluruh'>('bulan');
  const [distReportMonth, setDistReportMonth] = useState<string>(currentMonth);
  const [distReportYear, setDistReportYear] = useState<string>(currentYear);

  // Helper to format Invoice Number as requested: (046-INV-X-26)
  // 046 = urutan input data dalam bulan itu (reset setiap pergantian bulan)
  // X = Bulan dalam Romawi
  // 26 = 2 digit tahun
  const formatInvoiceNumber = (distId?: string, tanggalStr?: string, customDistList?: DistributionItem[]): string => {
    // 1. Cek apakah record sudah memiliki No_Invoice valid tersimpan
    if (distId) {
      const existing = (distributions || []).find(d => d.ID_Distribusi === distId);
      if (existing && existing.No_Invoice && existing.No_Invoice.trim() !== '') {
        return existing.No_Invoice;
      }
    }

    const d = tanggalStr ? new Date(tanggalStr) : new Date();
    const validD = isNaN(d.getTime()) ? new Date() : d;
    const targetYear = validD.getFullYear();
    const targetMonth = validD.getMonth(); // 0 = Jan, 9 = Oct
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanMonth = romanMonths[targetMonth];
    const year2Digits = String(targetYear).slice(-2);

    // Source list of distributions (preserves original input order)
    const distSource = (customDistList && customDistList.length > 0)
      ? customDistList
      : (distributions && distributions.length > 0)
        ? distributions
        : getTableData<DistributionItem>('Distribusi', []);

    // Filter distributions for this specific month & year
    let seqNumber = 1;
    let countInMonth = 0;
    for (let i = 0; i < distSource.length; i++) {
      const item = distSource[i];
      if (!item || !item.Tanggal) continue;
      // Fast date prefix check (e.g. "2026-10" or "26-10") before Date object instantiation
      const targetPrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
      let match = item.Tanggal.startsWith(targetPrefix);
      if (!match) {
        const itemD = new Date(item.Tanggal);
        if (!isNaN(itemD.getTime()) && itemD.getFullYear() === targetYear && itemD.getMonth() === targetMonth) {
          match = true;
        }
      }
      if (match) {
        countInMonth++;
        if (distId && item.ID_Distribusi === distId) {
          seqNumber = countInMonth;
          break;
        }
      }
    }

    if (!distId) {
      seqNumber = countInMonth + 1;
    }

    const numStr = String(seqNumber).padStart(3, '0');
    return `${numStr}-INV-${romanMonth}-${year2Digits}`;
  };

  // Helper to format Surat Jalan Number: {NOMOR}/{ROMAN_MONTH}/{2_DIGIT_YEAR} (e.g. 707/X/26)
  // NOMOR = no terbesar di data tahun tersebut + 1 (reset setiap tahun)
  // X = Bulan dalam Romawi
  // 26 = 2 digit tahun
  const generateSuratJalanNumber = (tanggalStr?: string, customDistList?: DistributionItem[]): string => {
    const d = tanggalStr ? new Date(tanggalStr) : new Date();
    const validD = isNaN(d.getTime()) ? new Date() : d;
    const targetYear = validD.getFullYear();
    const targetMonth = validD.getMonth(); // 0 = Jan, 9 = Oct
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanMonth = romanMonths[targetMonth];
    const year2Digits = String(targetYear).slice(-2);

    const distSource = (customDistList && customDistList.length > 0)
      ? customDistList
      : (distributions && distributions.length > 0)
        ? distributions
        : getTableData<DistributionItem>('Distribusi', []);

    let maxNumberInYear = 0;
    for (let i = 0; i < distSource.length; i++) {
      const item = distSource[i];
      if (!item) continue;

      // Check if item belongs to the target year
      let isSameYear = false;
      if (item.Tanggal) {
        const itemD = new Date(item.Tanggal);
        if (!isNaN(itemD.getTime()) && itemD.getFullYear() === targetYear) {
          isSameYear = true;
        } else if (String(item.Tanggal).includes(String(targetYear)) || String(item.Tanggal).endsWith(year2Digits)) {
          isSameYear = true;
        }
      }
      if (!isSameYear && item.No_Surat_Jalan && String(item.No_Surat_Jalan).endsWith(`/${year2Digits}`)) {
        isSameYear = true;
      }

      if (isSameYear && item.No_Surat_Jalan) {
        // Extract starting number (e.g. "706/X/26" -> 706, "224/X/26" -> 224, "55/SJ/X/26" -> 55)
        const match = String(item.No_Surat_Jalan).trim().match(/^(\d+)/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNumberInYear) {
            maxNumberInYear = val;
          }
        }
      }
    }

    const nextSeq = maxNumberInYear + 1;
    return `${nextSeq}/${romanMonth}/${year2Digits}`;
  };

  // State for Customer Search Dropdown in Add/Edit Distribution Modal
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const filteredCustomersList = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    if (!q) return customers || [];
    return (customers || []).filter(c => 
      (c.Nama_Pelanggan && c.Nama_Pelanggan.toLowerCase().includes(q)) ||
      (c.ID_Pelanggan && c.ID_Pelanggan.toLowerCase().includes(q)) ||
      (c.Alamat && c.Alamat.toLowerCase().includes(q)) ||
      (c.Level_Pelanggan && c.Level_Pelanggan.toLowerCase().includes(q))
    );
  }, [customers, customerSearchQuery]);

  // List of frequently used driver / pengirim names sorted by usage frequency
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
  const frequentDrivers = useMemo(() => {
    const counts = new Map<string, number>();

    // 1. Count from distributions history
    (distributions || []).forEach(d => {
      const name = String(d?.Pengirim || '').trim();
      if (name && name !== '-' && name.toLowerCase() !== 'null' && name.toLowerCase() !== 'undefined') {
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    });

    // 2. Count from master employees if department is Distribusi / Driver
    try {
      const masterEmployees = getTableData<any>('MD_Karyawan', []);
      (masterEmployees || []).forEach((e: any) => {
        const name = String(e?.Nama_Karyawan || '').trim();
        const dept = String(e?.Departemen || '').toLowerCase();
        const jab = String(e?.Jabatan || '').toLowerCase();
        if (name && (dept === 'distribusi' || jab.includes('driver') || jab.includes('sopir'))) {
          counts.set(name, (counts.get(name) || 0) + 2); // boost master driver
        }
      });
    } catch {}

    // Default fallback drivers if list is empty
    const defaultDrivers = ['Tri Wahyudi', 'Agus Santoso', 'Sunardi', 'Bambang'];
    defaultDrivers.forEach(d => {
      if (!counts.has(d)) counts.set(d, 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => ({ name: entry[0], count: entry[1] }));
  }, [distributions]);

  // Form State for Direct Distribution
  const [formData, setFormData] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    ID_Pelanggan: '',
    Nama_Pelanggan: '',
    Level_Pelanggan: 'Distributor',
    Pengirim: '',
    Penerima: '',
    Tujuan: '',
    Metode_Kirim: 'Kirim Armada' as 'Diantar Armada' | 'Kirim Armada' | 'Ambil Sendiri' | string,
    No_Surat_Jalan: '',
    No_Invoice: '',
    Keterangan: ''
  });

  const [formItems, setFormItems] = useState<{ ID_Produk: string; Qty: number; Harga_Satuan: number }[]>([
    { ID_Produk: products[0]?.ID_Produk || '', Qty: '' as any, Harga_Satuan: '' as any }
  ]);

  // Price calculation based on customer level or special price
  const getProductPriceForCustomer = (prodId: string, custId: string) => {
    const cust = customers.find(c => c.ID_Pelanggan === custId);
    const prod = products.find(p => p.ID_Produk === prodId);
    if (!prod || !cust) return 0;
    const spec = specialPrices.find(s => s.ID_Pelanggan === custId && s.ID_Produk === prodId);
    if (spec && Number(spec.Harga_Custom) > 0) {
      return Number(spec.Harga_Custom);
    }
    if (cust.Level_Pelanggan === 'Distributor') return prod.Harga_Distributor;
    if (cust.Level_Pelanggan === 'Agen') return prod.Harga_Agen;
    if (cust.Level_Pelanggan === 'Reseller') return prod.Harga_Reseller;
    return prod.Harga_Konsumen;
  };

  // Open Add Distribution Modal
  const handleOpenAddDist = () => {
    setEditingDist(null);
    const today = new Date().toISOString().slice(0, 10);
    const initialSj = generateSuratJalanNumber(today);
    const initialInv = formatInvoiceNumber('', today);
    setFormData({
      Tanggal: today,
      ID_Pelanggan: '',
      Nama_Pelanggan: '',
      Level_Pelanggan: 'Distributor',
      Pengirim: '',
      Penerima: '',
      Tujuan: '',
      Metode_Kirim: 'Kirim Armada',
      No_Surat_Jalan: initialSj,
      No_Invoice: initialInv,
      Keterangan: ''
    });
    setCustomerSearchQuery('');
    setIsCustomerDropdownOpen(false);
    setFormItems([
      { ID_Produk: products[0]?.ID_Produk || '', Qty: '' as any, Harga_Satuan: products[0] ? (products[0].Harga_Distributor || 0) : '' as any }
    ]);
    setShowAddDistModal(true);
  };

  // Open Edit Distribution Modal
  const handleOpenEditDist = (dist: DistributionItem) => {
    setEditingDist(dist);
    // Find customer by ID or Name
    let matchedCust = customers.find(c => c.ID_Pelanggan === dist.ID_Pelanggan);
    if (!matchedCust && dist.Nama_Pelanggan) {
      const normName = dist.Nama_Pelanggan.trim().toLowerCase();
      matchedCust = customers.find(c => c.Nama_Pelanggan && c.Nama_Pelanggan.trim().toLowerCase() === normName);
    }
    const finalCustId = matchedCust ? matchedCust.ID_Pelanggan : (dist.ID_Pelanggan || `PLG-${(dist.Nama_Pelanggan || 'CUST').slice(0, 6).toUpperCase().replace(/\s+/g, '')}`);
    const finalCustName = matchedCust ? matchedCust.Nama_Pelanggan : (dist.Nama_Pelanggan || 'Pelanggan');
    const finalCustLevel = matchedCust ? matchedCust.Level_Pelanggan : (dist.Level_Pelanggan || 'Agen');

    const effectiveInvoice = formatInvoiceNumber(dist.ID_Distribusi, dist.Tanggal);

    setFormData({
      Tanggal: dist.Tanggal,
      ID_Pelanggan: finalCustId,
      Nama_Pelanggan: finalCustName,
      Level_Pelanggan: finalCustLevel,
      Pengirim: dist.Pengirim || '',
      Penerima: dist.Penerima || '',
      Tujuan: dist.Tujuan || '',
      Metode_Kirim: dist.Metode_Kirim || 'Kirim Armada',
      No_Surat_Jalan: dist.No_Surat_Jalan || '',
      No_Invoice: effectiveInvoice,
      Keterangan: dist.Keterangan || ''
    });
    setCustomerSearchQuery(finalCustName);
    setIsCustomerDropdownOpen(false);

    const rawItems = distributionItems.filter(i => i.ID_Distribusi === dist.ID_Distribusi);
    let finalItems: { ID_Produk: string; Qty: number; Harga_Satuan: number }[] = [];

    if (rawItems.length > 0) {
      finalItems = rawItems
        .filter(it => Number(it.Qty) > 0)
        .map(it => {
          const matchedProd = products.find(p => 
            p.ID_Produk === it.ID_Produk || 
            getProductShortCode(p) === it.ID_Produk || 
            (p.Nama_Produk && it.Nama_Produk && p.Nama_Produk.toLowerCase() === it.Nama_Produk.toLowerCase())
          );
          const pId = matchedProd?.ID_Produk || it.ID_Produk;
          const price = Number(it.Harga_Satuan) > 0 
            ? Number(it.Harga_Satuan) 
            : getProductPriceForCustomer(pId, finalCustId);
          return {
            ID_Produk: pId,
            Qty: it.Qty,
            Harga_Satuan: price
          };
        });
    }

    // If no detail records exist (common for imported distributions), reconstruct from products and direct columns
    if (finalItems.length === 0) {
      products.forEach(p => {
        const q = getDistProductQty(dist, p);
        if (q > 0) {
          const price = getProductPriceForCustomer(p.ID_Produk, finalCustId) || (finalCustLevel === 'Agen' ? (p.Harga_Agen || p.Harga_Distributor) : (p.Harga_Distributor || 12000));
          finalItems.push({
            ID_Produk: p.ID_Produk,
            Qty: q,
            Harga_Satuan: price
          });
        }
      });
    }

    // If still completely empty (brand new empty distribution), create 1 blank row
    if (finalItems.length === 0) {
      finalItems = [{
        ID_Produk: products[0]?.ID_Produk || '',
        Qty: '' as any,
        Harga_Satuan: products[0] ? getProductPriceForCustomer(products[0].ID_Produk, finalCustId) : 0
      }];
    }

    setFormItems(finalItems);
    setShowAddDistModal(true);
  };

  // Delete Distribution
  const handleDeleteDistribution = async (id: string) => {
    const ok = await confirmAction({
      title: 'Hapus Data Pengiriman',
      message: `Hapus data pengiriman ${id} secara permanen? Dokumen surat jalan dan invoice terkait akan dihapus dari sistem.`,
      confirmText: 'Ya, Hapus Pengiriman',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;
    const currentDist = getTableData<DistributionItem>('Distribusi', []);
    const currentItems = getTableData<DistributionProductDetail>('Distribusi_Item', []);
    const updatedDist = currentDist.filter(d => d.ID_Distribusi !== id);
    const updatedItems = currentItems.filter(i => i.ID_Distribusi !== id);
    setTableData('Distribusi', updatedDist);
    setTableData('Distribusi_Item', updatedItems);
    onRefresh();
    showToast('Pengiriman Dihapus', `Data pengiriman ${id} telah dihapus.`, 'info');
  };

  // Customer dropdown change
  const handleCustomerChange = (custId: string) => {
    const c = customers.find(cust => cust.ID_Pelanggan === custId);
    setFormData(prev => ({
      ...prev,
      ID_Pelanggan: custId,
      Nama_Pelanggan: c ? c.Nama_Pelanggan : prev.Nama_Pelanggan,
      Level_Pelanggan: c ? c.Level_Pelanggan : prev.Level_Pelanggan,
      Tujuan: c?.Alamat || prev.Tujuan
    }));
    setCustomerSearchQuery(c ? c.Nama_Pelanggan : '');
    setFormItems(prev => prev.map(item => ({
      ...item,
      Harga_Satuan: getProductPriceForCustomer(item.ID_Produk, custId)
    })));
  };

  // Customer selection from searchable dropdown
  const handleCustomerSelect = (c: CustomerItem) => {
    setFormData(prev => ({
      ...prev,
      ID_Pelanggan: c.ID_Pelanggan,
      Nama_Pelanggan: c.Nama_Pelanggan,
      Level_Pelanggan: c.Level_Pelanggan || 'Distributor',
      Tujuan: c.Alamat || prev.Tujuan
    }));
    setCustomerSearchQuery(c.Nama_Pelanggan);
    setIsCustomerDropdownOpen(false);
    setFormItems(prev => prev.map(item => ({
      ...item,
      Harga_Satuan: getProductPriceForCustomer(item.ID_Produk, c.ID_Pelanggan)
    })));
  };

  // Helper cerdas menentukan produk urutan berikutnya saat tombol '+ Tambah Produk' diklik
  const getNextProductForItems = (currentItems: { ID_Produk: string }[]): ProductItem | undefined => {
    if (!products || products.length === 0) return undefined;
    if (!currentItems || currentItems.length === 0) return products[0];

    const usedIds = new Set(currentItems.map(it => it.ID_Produk));
    const lastItem = currentItems[currentItems.length - 1];
    const lastIdx = lastItem ? products.findIndex(p => p.ID_Produk === lastItem.ID_Produk) : -1;

    // Cari produk berikutnya berurutan dari setelah baris terakhir yang belum ada di daftar
    for (let offset = 1; offset <= products.length; offset++) {
      const candidateIdx = (lastIdx + offset) % products.length;
      const candidate = products[candidateIdx];
      if (candidate && !usedIds.has(candidate.ID_Produk)) {
        return candidate;
      }
    }

    // Jika seluruh produk sudah ada di form, ambil produk berikutnya secara siklik
    if (lastIdx !== -1) {
      return products[(lastIdx + 1) % products.length];
    }

    return products[currentItems.length % products.length] || products[0];
  };

  const handleAddItemRow = () => {
    const nextP = getNextProductForItems(formItems) || products[0];
    const pId = nextP?.ID_Produk || '';
    const price = getProductPriceForCustomer(pId, formData.ID_Pelanggan);
    setFormItems([...formItems, { ID_Produk: pId, Qty: '' as any, Harga_Satuan: price }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  // Dynamic row handlers for Plan modal (Input Pesanan Baru)
  const handleAddPlanItemRow = () => {
    const nextP = getNextProductForItems(planItems) || products[0];
    const pId = nextP?.ID_Produk || '';
    const price = getProductPriceForCustomer(pId, planForm.ID_Pelanggan);
    setPlanItems([...planItems, { ID_Produk: pId, Qty: '' as any, Harga_Satuan: price }]);
  };

  const handleRemovePlanItemRow = (idx: number) => {
    if (planItems.length <= 1) return;
    setPlanItems(planItems.filter((_, i) => i !== idx));
  };

  // Save Distribution
  const handleSaveDistribution = () => {
    if (!formData.Nama_Pelanggan.trim() && !formData.ID_Pelanggan) {
      showToast('Pilih Pelanggan', 'Harap cari dan pilih pelanggan terlebih dahulu.', 'warning');
      return;
    }

    const cust = customers.find(c => c.ID_Pelanggan === formData.ID_Pelanggan);
    const finalCustName = cust?.Nama_Pelanggan || formData.Nama_Pelanggan || editingDist?.Nama_Pelanggan || 'Pelanggan';
    const finalCustLevel = cust?.Level_Pelanggan || formData.Level_Pelanggan || editingDist?.Level_Pelanggan || 'Distributor';

    const currentDist = getTableData<DistributionItem>('Distribusi', []);
    const currentItems = getTableData<DistributionProductDetail>('Distribusi_Item', []);

    const distId = editingDist ? editingDist.ID_Distribusi : (() => {
      const d = new Date(formData.Tanggal);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const prefix = `DST-${yy}${mm}${dd}`;
      const count = currentDist.filter(dist => dist.ID_Distribusi.startsWith(prefix)).length;
      return `${prefix}${String(count + 1).padStart(3, '0')}`;
    })();

    const distRecord: any = {
      ...(editingDist || {}),
      ID_Distribusi: distId,
      Tanggal: formData.Tanggal,
      ID_Pelanggan: formData.ID_Pelanggan,
      Nama_Pelanggan: finalCustName,
      Level_Pelanggan: finalCustLevel,
      Pengirim: formData.Pengirim,
      Penerima: formData.Penerima,
      Tujuan: formData.Tujuan,
      Metode_Kirim: formData.Metode_Kirim,
      No_Surat_Jalan: formData.No_Surat_Jalan,
      No_Invoice: formData.No_Invoice || formatInvoiceNumber(distId, formData.Tanggal),
      Keterangan: formData.Keterangan
    };

    let totalTagihanAwal = 0;
    let totalQty = 0;
    const newDetails: DistributionProductDetail[] = formItems
      .filter(item => Number(item.Qty) > 0)
      .map((item, idx) => {
        const prod = products.find(p => p.ID_Produk === item.ID_Produk);
        const subtotal = Number(item.Qty) * Number(item.Harga_Satuan);
        totalTagihanAwal += subtotal;
        totalQty += Number(item.Qty);
        return {
          ID_Detail: `${distId}-D${idx + 1}`,
          ID_Distribusi: distId,
          ID_Produk: item.ID_Produk,
          Nama_Produk: prod?.Nama_Produk || item.ID_Produk,
          Qty: Number(item.Qty),
          Harga_Satuan: Number(item.Harga_Satuan),
          Subtotal: subtotal
        };
      });

    // Sync direct product columns on distRecord (C120, C220, B330, B600, G19)
    products.forEach(p => {
      const code = getProductShortCode(p);
      const itemMatch = newDetails.filter(it => it.ID_Produk === p.ID_Produk);
      const sumQty = itemMatch.reduce((sum, it) => sum + it.Qty, 0);
      distRecord[code] = sumQty;
      distRecord[p.ID_Produk] = sumQty;
    });

    // Potongan ekspedisi jika Ambil Sendiri (Rp 1.000 / dus)
    let grandTotal = totalTagihanAwal;
    if (formData.Metode_Kirim === 'Ambil Sendiri') {
      grandTotal -= (totalQty * 1000);
    }
    distRecord.Total_Tagihan = Math.max(0, grandTotal);

    if (editingDist) {
      const updatedDist = currentDist.map(d => d.ID_Distribusi === editingDist.ID_Distribusi ? distRecord : d);
      const otherItems = currentItems.filter(i => i.ID_Distribusi !== editingDist.ID_Distribusi);
      setTableData('Distribusi', updatedDist);
      setTableData('Distribusi_Item', [...otherItems, ...newDetails]);
    } else {
      setTableData('Distribusi', [...currentDist, distRecord]);
      setTableData('Distribusi_Item', [...currentItems, ...newDetails]);

      // Create Draf Jurnal Keuangan
      const existingDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
      const newDraft: DraftJournalItem = {
        ID_Draf: `DRF-DST-${Date.now().toString().slice(-6)}`,
        Sumber: 'Distribusi',
        Tanggal: formData.Tanggal,
        Referensi: `${distId} / ${distRecord.Nama_Pelanggan}`,
        Keterangan: `Penjualan ${totalQty} dus ke ${distRecord.Nama_Pelanggan} (Inv: ${distRecord.No_Invoice})`,
        Kode_Debit: '112-10', // Piutang Usaha
        Kode_Kredit: '411-10', // Pendapatan Penjualan Air
        Nominal: grandTotal,
        Status: 'Menunggu Verifikasi',
        Waktu_Dibuat: new Date().toISOString()
      };
      setTableData('Draf_Jurnal', [...existingDrafts, newDraft]);

      // Record into Piutang Usaha (normalized fields)
      const existingPiutang = getTableData<ReceivablePayableItem>('Data_Piutang_Utang', []);
      const dueD = new Date(formData.Tanggal);
      dueD.setDate(dueD.getDate() + 14);
      const newPiutang: ReceivablePayableItem = {
        ID_DOKUMEN: distId,
        ID_Transaksi: distId,
        TIPE: 'Piutang',
        Jenis: 'Piutang',
        TANGGAL: formData.Tanggal,
        Tanggal: formData.Tanggal,
        JATUH_TEMPO: dueD.toISOString().slice(0, 10),
        Tgl_Jatuh_Tempo: dueD.toISOString().slice(0, 10),
        NAMA_ENTITAS: distRecord.Nama_Pelanggan,
        Entitas: distRecord.Nama_Pelanggan,
        TOTAL_TAGIHAN: grandTotal,
        Nominal: grandTotal,
        TOTAL_DIBAYAR: 0,
        Terbayar: 0,
        SISA_SALDO: grandTotal,
        Sisa: grandTotal,
        STATUS: 'Belum Lunas',
        Status: 'Belum Lunas'
      };
      setTableData('Data_Piutang_Utang', [...existingPiutang, newPiutang]);
    }

    // Auto register missing customer in MD_Pelanggan
    if (formData.ID_Pelanggan && finalCustName) {
      const currentCustomers = getTableData<CustomerItem>('MD_Pelanggan', []);
      if (!currentCustomers.some(c => c.ID_Pelanggan === formData.ID_Pelanggan || (c.Nama_Pelanggan && c.Nama_Pelanggan.trim().toLowerCase() === finalCustName.trim().toLowerCase()))) {
        const newCustomer: CustomerItem = {
          ID_Pelanggan: formData.ID_Pelanggan,
          Nama_Pelanggan: finalCustName,
          Level_Pelanggan: (finalCustLevel as any) || 'Distributor',
          Alamat: formData.Tujuan || '-',
          Kontak: '-',
          Status: 'Aktif'
        };
        setTableData('MD_Pelanggan', [...currentCustomers, newCustomer]);
      }
    }

    setShowAddDistModal(false);
    onRefresh();
    showToast(
      'Distribusi Disimpan',
      `Transaksi ${distId} berhasil disimpan, stok produk terpotong & draf piutang dicatat.`,
      'success'
    );
  };

  // ==============================================================
  // RENCANA DISTRIBUSI (LIST PESANAN) HANDLERS
  // ==============================================================
  const handleOpenAddPlan = () => {
    setEditingPlan(null);
    const cust = customers[0];
    setPlanForm({
      Tanggal_Rencana: new Date().toISOString().slice(0, 10),
      ID_Pelanggan: cust?.ID_Pelanggan || 'PLG-0001',
      Metode_Kirim: 'Kirim Armada',
      Alamat_Tujuan: '',
      Sopir: '',
      Keterangan: ''
    });
    setPlanItems([
      { ID_Produk: products[0]?.ID_Produk || 'ASH-CUP220', Qty: '' as any, Harga_Satuan: products[0] && cust ? getProductPriceForCustomer(products[0].ID_Produk, cust.ID_Pelanggan) : '' as any }
    ]);
    setShowPlanModal(true);
  };

  // Open Edit Plan Modal - pre-fill form with existing plan data
  const handleOpenEditPlan = (plan: DeliveryPlanItem) => {
    setEditingPlan(plan);
    setPlanForm({
      Tanggal_Rencana: plan.Tanggal_Rencana,
      ID_Pelanggan: plan.ID_Pelanggan,
      Metode_Kirim: plan.Metode_Kirim as 'Kirim Armada' | 'Ambil Sendiri',
      Alamat_Tujuan: plan.Alamat_Tujuan,
      Sopir: plan.Sopir || 'Tri Wahyudi',
      Keterangan: plan.Keterangan || ''
    });
    if (plan.Items && plan.Items.length > 0) {
      setPlanItems(plan.Items.map(it => ({
        ID_Produk: it.ID_Produk,
        Qty: it.Qty,
        Harga_Satuan: it.Harga_Satuan
      })));
    } else {
      setPlanItems([
        { ID_Produk: products[0]?.ID_Produk || '', Qty: 50, Harga_Satuan: 12000 }
      ]);
    }
    setShowPlanModal(true);
  };

  const handleSavePlan = () => {
    const cust = customers.find(c => c.ID_Pelanggan === planForm.ID_Pelanggan);
    const plans = getTableData<DeliveryPlanItem>('Rencana_Distribusi', []);
    const planId = editingPlan ? editingPlan.ID_Rencana : `ORD-${Date.now().toString().slice(-6)}`;

    const items = planItems.map(it => {
      const p = products.find(prod => prod.ID_Produk === it.ID_Produk);
      return {
        ID_Produk: it.ID_Produk,
        Nama_Produk: p?.Nama_Produk || it.ID_Produk,
        Qty: it.Qty,
        Harga_Satuan: it.Harga_Satuan,
        Subtotal: it.Qty * it.Harga_Satuan
      };
    });

    const planRecord: DeliveryPlanItem = {
      ID_Rencana: planId,
      Tanggal_Rencana: planForm.Tanggal_Rencana,
      ID_Pelanggan: planForm.ID_Pelanggan,
      Nama_Pelanggan: cust?.Nama_Pelanggan || 'Pelanggan',
      Level_Pelanggan: cust?.Level_Pelanggan || 'Distributor',
      Metode_Kirim: planForm.Metode_Kirim,
      Alamat_Tujuan: planForm.Alamat_Tujuan,
      Sopir: planForm.Sopir,
      Status: editingPlan ? editingPlan.Status : 'Menunggu',
      Keterangan: planForm.Keterangan,
      Items: items
    };

    if (editingPlan) {
      // Update existing plan
      const updatedPlans = plans.map(p => p.ID_Rencana === editingPlan.ID_Rencana ? planRecord : p);
      setTableData('Rencana_Distribusi', updatedPlans);
      showToast('Pesanan Diperbarui', `Rencana pesanan ${planId} berhasil diperbarui.`, 'success');
    } else {
      // Create new plan
      setTableData('Rencana_Distribusi', [...plans, planRecord]);
      showToast('Pesanan Disimpan', `Rencana pesanan ${planId} berhasil ditambahkan ke antrean.`, 'success');
    }

    setShowPlanModal(false);
    setEditingPlan(null);
    onRefresh();
  };

  const handleDeletePlan = async (id: string) => {
    const ok = await confirmAction({
      title: 'Hapus Rencana Pesanan',
      message: `Hapus rencana pesanan ${id}? Tindakan ini akan membatalkan antrean pesanan.`,
      confirmText: 'Ya, Hapus Pesanan',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;
    const plans = getTableData<DeliveryPlanItem>('Rencana_Distribusi', []);
    setTableData('Rencana_Distribusi', plans.filter(p => p.ID_Rencana !== id));
    onRefresh();
    showToast('Pesanan Dibatalkan', `Rencana pesanan ${id} berhasil dihapus.`, 'info');
  };

  // Realize Order: Transfer Rencana Pesanan -> Distribusi Resmi
  const handleExecutePlanToDistribution = async (plan: DeliveryPlanItem) => {
    const totalQty = plan.Items ? plan.Items.reduce((acc, it) => acc + (Number(it.Qty) || 0), 0) : 0;
    const totalNominal = plan.Items ? plan.Items.reduce((acc, it) => acc + (Number(it.Subtotal) || 0), 0) : 0;

    const ok = await confirmAction({
      title: 'Realisasi Pengiriman Resmi',
      message: `Realisasikan pesanan ${plan.ID_Rencana} (${plan.Nama_Pelanggan}) menjadi pengiriman resmi? Surat jalan, invoice tagihan, dan draf piutang akan langsung diterbitkan secara otomatis.`,
      confirmText: 'Realisasikan Sekarang',
      cancelText: 'Batal',
      type: 'success',
      itemDetails: {
        'No. Pesanan': plan.ID_Rencana,
        'Pelanggan': `${plan.Nama_Pelanggan} (${plan.Level_Pelanggan || 'Distributor'})`,
        'Total Muatan': `${totalQty} unit`,
        'Estimasi Tagihan': `Rp ${totalNominal.toLocaleString('id-ID')}`,
        'Metode Kirim': plan.Metode_Kirim,
        'Alamat Tujuan': plan.Alamat_Tujuan || '-'
      }
    });
    if (!ok) return;

    const currentDist = getTableData<DistributionItem>('Distribusi', []);
    const currentItems = getTableData<DistributionProductDetail>('Distribusi_Item', []);

    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const prefix = `DST-${yy}${mm}${dd}`;
    const count = currentDist.filter(dist => dist.ID_Distribusi.startsWith(prefix)).length;
    const distId = `${prefix}${String(count + 1).padStart(3, '0')}`;
    const sjNo = generateSuratJalanNumber(plan.Tanggal_Rencana, currentDist);
    const invNo = formatInvoiceNumber(distId, plan.Tanggal_Rencana, currentDist);

    const distRecord: DistributionItem = {
      ID_Distribusi: distId,
      Tanggal: plan.Tanggal_Rencana,
      ID_Pelanggan: plan.ID_Pelanggan,
      Nama_Pelanggan: plan.Nama_Pelanggan,
      Level_Pelanggan: plan.Level_Pelanggan,
      Pengirim: plan.Sopir,
      Penerima: 'Penerima Toko',
      Tujuan: plan.Alamat_Tujuan,
      Metode_Kirim: plan.Metode_Kirim,
      No_Surat_Jalan: sjNo,
      No_Invoice: invNo,
      Keterangan: `Realisasi Pesanan: ${plan.ID_Rencana} - ${plan.Keterangan || ''}`
    };

    let totalTagihanAwal = 0;
    let totalQtyCalc = 0;
    const newDetails: DistributionProductDetail[] = plan.Items.map((it, idx) => {
      totalTagihanAwal += it.Subtotal;
      totalQtyCalc += it.Qty;
      return {
        ID_Detail: `${distId}-D${idx + 1}`,
        ID_Distribusi: distId,
        ID_Produk: it.ID_Produk,
        Nama_Produk: it.Nama_Produk,
        Qty: it.Qty,
        Harga_Satuan: it.Harga_Satuan,
        Subtotal: it.Subtotal
      };
    });

    let grandTotal = totalTagihanAwal;
    if (plan.Metode_Kirim === 'Ambil Sendiri') {
      grandTotal -= (totalQtyCalc * 1000);
    }

    // Save to Distribusi
    setTableData('Distribusi', [...currentDist, distRecord]);
    setTableData('Distribusi_Item', [...currentItems, ...newDetails]);

    // Update Plan Status to 'Realisasi'
    const plans = getTableData<DeliveryPlanItem>('Rencana_Distribusi', []);
    const updatedPlans = plans.map(p => p.ID_Rencana === plan.ID_Rencana ? { ...p, Status: 'Realisasi' as const } : p);
    setTableData('Rencana_Distribusi', updatedPlans);

    // Create Draf Jurnal
    const existingDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
    const newDraft: DraftJournalItem = {
      ID_Draf: `DRF-DST-${Date.now().toString().slice(-6)}`,
      Sumber: 'Distribusi',
      Tanggal: plan.Tanggal_Rencana,
      Referensi: `${distId} / ${plan.Nama_Pelanggan}`,
      Keterangan: `Penjualan ${totalQtyCalc} unit ke ${plan.Nama_Pelanggan} (SJ: ${sjNo})`,
      Kode_Debit: '112-10',
      Kode_Kredit: '411-10',
      Nominal: grandTotal,
      Status: 'Menunggu Verifikasi',
      Waktu_Dibuat: new Date().toISOString()
    };
    setTableData('Draf_Jurnal', [...existingDrafts, newDraft]);

    // Create Piutang
    const existingPiutang = getTableData<ReceivablePayableItem>('Data_Piutang_Utang', []);
    const dueD = new Date(plan.Tanggal_Rencana);
    dueD.setDate(dueD.getDate() + 14);
    const newPiutang: ReceivablePayableItem = {
      ID_DOKUMEN: distId,
      ID_Transaksi: distId,
      TIPE: 'Piutang',
      Jenis: 'Piutang',
      TANGGAL: plan.Tanggal_Rencana,
      Tanggal: plan.Tanggal_Rencana,
      JATUH_TEMPO: dueD.toISOString().slice(0, 10),
      Tgl_Jatuh_Tempo: dueD.toISOString().slice(0, 10),
      NAMA_ENTITAS: plan.Nama_Pelanggan,
      Entitas: plan.Nama_Pelanggan,
      TOTAL_TAGIHAN: grandTotal,
      Nominal: grandTotal,
      TOTAL_DIBAYAR: 0,
      Terbayar: 0,
      SISA_SALDO: grandTotal,
      Sisa: grandTotal,
      STATUS: 'Belum Lunas',
      Status: 'Belum Lunas'
    };
    setTableData('Data_Piutang_Utang', [...existingPiutang, newPiutang]);

    onRefresh();
    showToast(
      'Pengiriman Berhasil Direalisasikan', 
      `Pesanan ${plan.ID_Rencana} (${plan.Nama_Pelanggan}) resmi diproses. No. Surat Jalan: ${sjNo}`, 
      'success'
    );
  };

  // Helper to get clean short code label for any product (C120, C220, B330, B600, G19, etc.)
  const getProductShortCode = (prod: ProductItem): string => {
    const customCode = (prod as any).Kode_Produk;
    if (customCode) return String(customCode);
    if (prod.ID_Produk.includes('CUP120')) return 'C120';
    if (prod.ID_Produk.includes('CUP220')) return 'C220';
    if (prod.ID_Produk.includes('BTL330')) return 'B330';
    if (prod.ID_Produk.includes('BTL600')) return 'B600';
    if (prod.ID_Produk.includes('GLN19') || prod.ID_Produk.includes('G19')) return 'G19';

    const numMatch = prod.Nama_Produk.match(/\d+/);
    const prefix = prod.Nama_Produk.toLowerCase().includes('botol') ? 'B' : 
                   prod.Nama_Produk.toLowerCase().includes('cup') ? 'C' : 
                   prod.Nama_Produk.toLowerCase().includes('galon') ? 'G' : 'P';
    if (numMatch) return `${prefix}${numMatch[0]}`;
    return prod.ID_Produk.slice(-4);
  };

  // Flexible helper to get qty of any product for a given distribution (dynamic from Master Produk & Ultra-resilient aliases)
  const getDistProductQty = (dist: DistributionItem, prod: ProductItem): number => {
    const code = getProductShortCode(prod);
    const anyDist = dist as any;
    const isGalon = code === 'G19' || prod.ID_Produk.includes('GLN') || prod.Nama_Produk.toLowerCase().includes('galon');

    // 1. Cek langsung pada kolom / property record distribusi (dari hasil import Excel)
    if (isGalon) {
      const galonCandidates = [
        'G19', 'g19', 'GLN19', 'gln19', 'GLN 19 L', 'ASH-GLN19L', 
        'Galon', 'galon', 'GALON', 'GLN', 'gln', 'Qty_G19', 'Jumlah_G19', 
        'Galon 19L', 'Galon 19', 'Qty_Galon', 'Jumlah_Galon'
      ];
      for (const cand of galonCandidates) {
        if (anyDist[cand] !== undefined && anyDist[cand] !== null && anyDist[cand] !== '') {
          const direct = Number(anyDist[cand]);
          if (!isNaN(direct) && direct > 0) return direct;
        }
      }
    } else {
      if (anyDist[code] !== undefined && anyDist[code] !== null && anyDist[code] !== '') {
        const direct = Number(anyDist[code]);
        if (!isNaN(direct) && direct > 0) return direct;
      }
      if (anyDist[prod.ID_Produk] !== undefined && anyDist[prod.ID_Produk] !== null && anyDist[prod.ID_Produk] !== '') {
        const direct = Number(anyDist[prod.ID_Produk]);
        if (!isNaN(direct) && direct > 0) return direct;
      }
    }

    // 2. Cek di relasi item resmi (Distribusi_Item) terlebih dahulu
    const items = distItemsMap.get(String(dist.ID_Distribusi).trim()) || [];
    if (items.length > 0) {
      if (isGalon) {
        const foundGalonItem = items.find(i => 
          i.ID_Produk === prod.ID_Produk ||
          String(i.ID_Produk || '').toLowerCase() === 'g19' || 
          String(i.ID_Produk || '').toLowerCase().includes('gln') || 
          String(i.Nama_Produk || '').toLowerCase().includes('galon')
        );
        if (foundGalonItem && Number(foundGalonItem.Qty) > 0) return Number(foundGalonItem.Qty);
      } else {
        const foundExact = items.find(i => i.ID_Produk === prod.ID_Produk);
        if (foundExact && Number(foundExact.Qty) > 0) return Number(foundExact.Qty);
        
        const foundByName = items.find(i => i.Nama_Produk === prod.Nama_Produk || 
          (prod.Nama_Produk && i.Nama_Produk && i.Nama_Produk.toLowerCase().includes(prod.Nama_Produk.toLowerCase()))
        );
        if (foundByName && Number(foundByName.Qty) > 0) return Number(foundByName.Qty);
      }
    }

    // 3. Fallback ke relasi surat jalan dari Map (O(1) memory lookup tanpa parsing localStorage)
    if (dist.No_Surat_Jalan && dist.No_Surat_Jalan !== '-') {
      const sjKey = String(dist.No_Surat_Jalan).trim().toLowerCase();
      const sjItems = distItemsBySjMap.get(sjKey) || [];
      if (sjItems.length > 0) {
        if (isGalon) {
          const found = sjItems.find(i => 
            i.ID_Produk === prod.ID_Produk ||
            String(i.ID_Produk || '').toUpperCase() === 'ASH-GLN19L' ||
            String(i.ID_Produk || '').toLowerCase() === 'g19' || 
            String(i.ID_Produk || '').toLowerCase().includes('gln') || 
            String(i.Nama_Produk || '').toLowerCase().includes('galon')
          );
          if (found && Number(found.Qty) > 0) return Number(found.Qty);
        } else {
          const found = sjItems.find(i => 
            i.ID_Produk === prod.ID_Produk ||
            String(i.ID_Produk || '').toLowerCase() === code.toLowerCase() ||
            (i.Nama_Produk && prod.Nama_Produk && i.Nama_Produk.toLowerCase().includes(prod.Nama_Produk.toLowerCase()))
          );
          if (found && Number(found.Qty) > 0) return Number(found.Qty);
        }
      }
    }

    // 4. Ultra-resilient Galon Fallback: Jika transaksi memiliki Total_Tagihan positif tetapi seluruh produk dus (C120, C220, B330, B600) bernilai 0:
    if (isGalon) {
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

    return 0;
  };

  // Backward-compatible helper for legacy string key lookup
  const getProductQtyByCode = (dist: DistributionItem, key: 'C120' | 'C220' | 'B330' | 'B600' | 'G19'): number => {
    const prod = products.find(p => getProductShortCode(p) === key || p.ID_Produk.includes(key));
    if (prod) return getDistProductQty(dist, prod);
    const anyDist = dist as any;
    if (key === 'G19') {
      const gq = Number(anyDist.G19 || anyDist.g19 || anyDist.Galon || anyDist.galon || anyDist.GLN19 || anyDist.gln19 || anyDist['ASH-GLN19L'] || 0);
      if (gq > 0) return gq;
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
    const direct = anyDist[key];
    return direct ? Number(direct) : 0;
  };

  // Download Invoice PDF with exact naming format: NO invoice (nama pelanggan).pdf
  const handleDownloadInvoicePDF = async (dist: DistributionItem, items: DistributionProductDetail[]) => {
    let subtotal = 0;
    let totalQty = 0;
    const pdfItems = items.map(it => {
      subtotal += it.Subtotal;
      totalQty += it.Qty;
      const prod = products.find(p => p.ID_Produk === it.ID_Produk);
      return {
        nama: it.Nama_Produk,
        qty: it.Qty,
        satuan: prod?.Satuan || 'Dus',
        harga: it.Harga_Satuan,
        subtotal: it.Subtotal
      };
    });

    const potong = dist.Metode_Kirim === 'Ambil Sendiri' ? (totalQty * 1000) : 0;
    const grandTotal = subtotal - potong;
    const invoiceNo = formatInvoiceNumber(dist.ID_Distribusi, dist.Tanggal);

    await generateInvoicePDF({
      noInvoice: invoiceNo,
      namaPelanggan: dist.Nama_Pelanggan,
      alamatPelanggan: dist.Tujuan,
      levelPelanggan: dist.Level_Pelanggan || 'Distributor',
      tanggal: dist.Tanggal,
      metodeKirim: dist.Metode_Kirim,
      noSuratJalan: dist.No_Surat_Jalan,
      penerima: dist.Penerima,
      items: pdfItems,
      potonganEkspedisi: potong,
      grandTotal,
      customSettings: docSettings
    });
  };

  // Download Surat Jalan PDF
  const handleDownloadSuratJalanPDF = (dist: DistributionItem, items: DistributionProductDetail[]) => {
    const pdfItems = items.map(it => {
      const prod = products.find(p => p.ID_Produk === it.ID_Produk);
      return {
        nama: it.Nama_Produk,
        qty: it.Qty,
        satuan: prod?.Satuan || 'Dus'
      };
    });

    generateSuratJalanPDF({
      noSuratJalan: dist.No_Surat_Jalan,
      namaPelanggan: dist.Nama_Pelanggan,
      alamatPelanggan: dist.Tujuan,
      tanggal: dist.Tanggal,
      sopir: dist.Pengirim,
      metodeKirim: dist.Metode_Kirim,
      items: pdfItems,
      catatan: dist.Keterangan,
      customSettings: docSettings
    });
  };

  // State for Image 1 "Buka" Detail Drawer/Modal
  const [openDetailDist, setOpenDetailDist] = useState<DistributionItem | null>(null);

  // Helper to format date as "01-Okt-2026"
  const formatDisplayDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      const d = parts[2].padStart(2, '0');
      if (m >= 0 && m < 12) {
        return `${d}-${months[m]}-${y}`;
      }
    }
    return dateStr;
  };

  // Helper to calculate total billing amount (O(1) fast lookup)
  const calculateTotalTagihan = (dist: DistributionItem): number => {
    const anyDist = dist as any;
    if (anyDist.Total_Tagihan !== undefined && anyDist.Total_Tagihan !== null && anyDist.Total_Tagihan !== '') {
      const val = Number(anyDist.Total_Tagihan);
      if (!isNaN(val) && val > 0) return val;
    }

    const items = distItemsMap.get(String(dist.ID_Distribusi).trim()) || [];
    if (items.length > 0) {
      let total = items.reduce((sum, item) => sum + item.Subtotal, 0);
      const totalQty = items.reduce((sum, item) => sum + item.Qty, 0);
      if (dist.Metode_Kirim === 'Ambil Sendiri') {
        total -= (totalQty * 1000);
      }
      if (total > 0) return total;
    }
    return 0;
  };

  // Filtered Distributions using month matcher, search query, and deterministic sorting
  const filteredDistributions = useMemo(() => {
    let list = (distributions || []).filter(d => isMatchMonth(d.Tanggal, filterMonth));
    if (searchQueryDist.trim()) {
      const q = searchQueryDist.toLowerCase();
      list = list.filter(d => 
        (d.Nama_Pelanggan && d.Nama_Pelanggan.toLowerCase().includes(q)) ||
        (d.No_Surat_Jalan && d.No_Surat_Jalan.toLowerCase().includes(q)) ||
        (d.No_Invoice && d.No_Invoice.toLowerCase().includes(q)) ||
        (d.Tujuan && d.Tujuan.toLowerCase().includes(q)) ||
        (d.Pengirim && d.Pengirim.toLowerCase().includes(q)) ||
        (d.Penerima && d.Penerima.toLowerCase().includes(q)) ||
        (d.Metode_Kirim && d.Metode_Kirim.toLowerCase().includes(q)) ||
        (d.Keterangan && d.Keterangan.toLowerCase().includes(q))
      );
    }

    // Stable, deterministic sorting according to Tanggal, No_Surat_Jalan, and ID (anti-geser)
    const sorted = [...list];
    sorted.sort((a, b) => {
      // 1. Primary: Tanggal
      const timeA = toComparableDate(a.Tanggal);
      const timeB = toComparableDate(b.Tanggal);
      if (timeA !== timeB) {
        return dateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }

      // 2. Secondary: No_Surat_Jalan
      const sjNumA = extractSjNumber(a.No_Surat_Jalan);
      const sjNumB = extractSjNumber(b.No_Surat_Jalan);
      if (sjNumA !== sjNumB && sjNumA > 0 && sjNumB > 0) {
        return dateSortOrder === 'desc' ? sjNumB - sjNumA : sjNumA - sjNumB;
      }
      const sjStrA = String(a.No_Surat_Jalan || '');
      const sjStrB = String(b.No_Surat_Jalan || '');
      const sjComp = sjStrA.localeCompare(sjStrB, undefined, { numeric: true, sensitivity: 'base' });
      if (sjComp !== 0) {
        return dateSortOrder === 'desc' ? -sjComp : sjComp;
      }

      // 3. Fallback tie-breaker: ID_Distribusi (100% stabil, mencegah baris bergeser sendiri)
      return String(a.ID_Distribusi || '').localeCompare(String(b.ID_Distribusi || ''));
    });

    return sorted;
  }, [distributions, filterMonth, searchQueryDist, dateSortOrder]);

  // Pre-calculate grand totals for footer in a single O(N) pass
  const tableTotals = useMemo(() => {
    const prodSums: Record<string, number> = {};
    products.forEach(p => { prodSums[p.ID_Produk] = 0; });
    let grandTotalTagihan = 0;

    filteredDistributions.forEach(dist => {
      products.forEach(p => {
        prodSums[p.ID_Produk] += getDistProductQty(dist, p);
      });
      grandTotalTagihan += calculateTotalTagihan(dist);
    });

    return { prodSums, grandTotalTagihan };
  }, [filteredDistributions, products, distItemsMap]);

  // Handler for Export Excel with flexible product columns matching Master Produk
  const handleExportDistributionExcel = () => {
    const exportRows = filteredDistributions.map(dist => {
      const rowObj: Record<string, any> = {
        'NAMA PELANGGAN': dist.Nama_Pelanggan,
        'LEVEL': dist.Level_Pelanggan || 'Distributor',
        'TANGGAL KIRIM': formatDisplayDate(dist.Tanggal),
        'NO SURAT JALAN': dist.No_Surat_Jalan,
        'METODE KIRIM': dist.Metode_Kirim,
        'PENGIRIM': dist.Pengirim || '-',
        'PENERIMA': dist.Penerima || '-',
        'TUJUAN': dist.Tujuan
      };

      // Add dynamic product quantity columns
      products.forEach(p => {
        const code = getProductShortCode(p);
        rowObj[code] = getDistProductQty(dist, p);
      });

      rowObj['TOTAL TAGIHAN'] = calculateTotalTagihan(dist);
      rowObj['KETERANGAN'] = dist.Keterangan || '';
      return rowObj;
    });

    const filePeriod = filterMonth === 'all' ? 'Semua_Bulan' : filterMonth;
    exportDataToExcel(exportRows, 'Data_Distribusi', `Laporan_Distribusi_${filePeriod}`);
  };

  // ==============================================================
  // LAPORAN DISTRIBUSI PRODUKSI CALCULATIONS (KONSUMEN & TAHUNAN)
  // ==============================================================
  const distByIdMap = useMemo(() => {
    const map = new Map<string, DistributionItem>();
    (distributions || []).forEach(d => {
      if (d && d.ID_Distribusi) map.set(String(d.ID_Distribusi).trim(), d);
    });
    return map;
  }, [distributions]);

  // 1. Data Distribusi yang Difilter Sesuai Periode Laporan (Tab 1 & Tab 2)
  const reportDistributions = useMemo(() => {
    return (distributions || []).filter(d => {
      if (!d) return false;
      if (distReportFilter === 'bulan') return isMatchMonth(d.Tanggal, distReportMonth);
      if (distReportFilter === 'tahun') {
        const parsed = parseDateYearAndMonth(d.Tanggal);
        if (parsed) return parsed.year === distReportYear;
        return d.Tanggal?.includes(distReportYear);
      }
      return true;
    });
  }, [distributions, distReportFilter, distReportMonth, distReportYear]);

  // 2. Tab 2: Laporan Per Konsumen (Akumulasi volume & nominal per pelanggan)
  // Membaca langsung dari reportDistributions dan getDistProductQty (pasti terisi & sinkron 100% dengan Tab 1)
  const customerSummaryMap = useMemo(() => {
    const summaryMap: Record<string, { 
      nama: string; 
      level: string; 
      totalQty: number; 
      totalNominal: number; 
      itemsBreakdown: Record<string, number>;
      productByCode: Record<string, number>;
    }> = {};

    reportDistributions.forEach(dist => {
      const rawName = dist.Nama_Pelanggan || dist.Penerima || '';
      const custName = (rawName && String(rawName).trim() !== '' && String(rawName).trim() !== '-') 
        ? String(rawName).trim() 
        : 'Konsumen Umum / Toko';

      const cKey = custName.toLowerCase();

      if (!summaryMap[cKey]) {
        summaryMap[cKey] = {
          nama: custName,
          level: dist.Level_Pelanggan || 'Distributor',
          totalQty: 0,
          totalNominal: 0,
          itemsBreakdown: {},
          productByCode: {}
        };
        // Inisialisasi 0 untuk semua produk
        products.forEach(p => {
          summaryMap[cKey].productByCode[p.ID_Produk] = 0;
        });
      }

      let distTotalQty = 0;
      let distCalculatedNominal = 0;

      products.forEach(prod => {
        const q = getDistProductQty(dist, prod);
        if (q > 0) {
          summaryMap[cKey].productByCode[prod.ID_Produk] = (summaryMap[cKey].productByCode[prod.ID_Produk] || 0) + q;
          summaryMap[cKey].itemsBreakdown[prod.Nama_Produk] = (summaryMap[cKey].itemsBreakdown[prod.Nama_Produk] || 0) + q;
          distTotalQty += q;

          // Cari harga satuan dari detail item atau master produk
          const items = distItemsMap.get(String(dist.ID_Distribusi).trim()) || [];
          const it = items.find(i => i.ID_Produk === prod.ID_Produk || i.Nama_Produk === prod.Nama_Produk);
          if (it && it.Qty > 0) {
            distCalculatedNominal += (it.Subtotal / it.Qty) * q;
          } else {
            const price = prod.Harga_Distributor || 12000;
            distCalculatedNominal += q * price;
          }
        }
      });

      const tagihan = Number(dist.Total_Tagihan);
      const nominalToAdd = (tagihan && !isNaN(tagihan) && tagihan > 0) 
        ? tagihan 
        : distCalculatedNominal;

      summaryMap[cKey].totalQty += distTotalQty;
      summaryMap[cKey].totalNominal += nominalToAdd;
    });

    return summaryMap;
  }, [reportDistributions, products, distItemsMap]);

  // 3. Tab 3: Laporan Tahunan (12 Bulan Jan-Des) Per Produk
  // Menggunakan parseDateYearAndMonth yang tangguh untuk format tanggal Indonesia & ISO
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const { annualDistByProduct, annualDistTotalMonthly } = useMemo(() => {
    const byProd: Record<string, number[]> = {};
    products.forEach(p => {
      byProd[p.ID_Produk] = new Array(12).fill(0);
    });
    const totalMonthly = new Array(12).fill(0);

    (distributions || []).forEach(dist => {
      if (!dist) return;
      const parsed = parseDateYearAndMonth(dist.Tanggal);
      if (!parsed) return;

      const { year: yr, monthIndex: mIdx } = parsed;
      if (distReportFilter === 'seluruh' || yr === distReportYear) {
        if (mIdx >= 0 && mIdx < 12) {
          products.forEach(p => {
            const q = getDistProductQty(dist, p);
            if (q > 0) {
              if (byProd[p.ID_Produk]) {
                byProd[p.ID_Produk][mIdx] += q;
              }
              totalMonthly[mIdx] += q;
            }
          });
        }
      }
    });

    return { annualDistByProduct: byProd, annualDistTotalMonthly: totalMonthly };
  }, [distributions, products, distReportFilter, distReportYear, distItemsMap]);

  const maxDistAnnual = Math.max(...annualDistTotalMonthly, 100);

  const reportProductSummary = useMemo(() => {
    return products.map(prod => {
      let totalQty = 0;
      let totalNominal = 0;

      reportDistributions.forEach(dist => {
        const q = getDistProductQty(dist, prod);
        totalQty += q;
        const items = distItemsMap.get(String(dist.ID_Distribusi).trim()) || [];
        const it = items.find(i => i.ID_Produk === prod.ID_Produk || i.Nama_Produk === prod.Nama_Produk);
        if (it && it.Qty > 0) {
          totalNominal += (it.Subtotal / it.Qty) * q;
        } else {
          totalNominal += q * (prod.Harga_Distributor || 12000);
        }
      });

      return {
        id: prod.ID_Produk,
        nama: prod.Nama_Produk,
        shortCode: getProductShortCode(prod),
        kategori: prod.Kategori,
        satuan: prod.Satuan,
        totalQty,
        subtotal: totalNominal
      };
    });
  }, [products, reportDistributions, distItemsMap]);

  const totalReportUnits = reportProductSummary.reduce((sum, p) => sum + p.totalQty, 0);
  const totalReportNominal = reportDistributions.reduce((sum, d) => sum + calculateTotalTagihan(d), 0);

  const reportProductSummaryWithPercent = reportProductSummary.map(p => ({
    ...p,
    percentage: totalReportUnits > 0 ? (p.totalQty / totalReportUnits) * 100 : 0
  }));

  const handleExportDistReportPDF = () => {
    if (distReportTab === 'rekap') {
      const periodLabel = distReportFilter === 'bulan' ? distReportMonth : distReportFilter === 'tahun' ? `Tahun ${distReportYear}` : 'Seluruh Waktu';
      generateDistributionReportPDF({
        periode: periodLabel,
        totalUnit: totalReportUnits,
        totalPengiriman: reportDistributions.length,
        totalTagihan: totalReportNominal,
        products: products.map(p => ({
          id: p.ID_Produk,
          nama: p.Nama_Produk,
          shortCode: getProductShortCode(p),
          satuan: p.Satuan
        })),
        productSummary: reportProductSummaryWithPercent,
        distributions: reportDistributions.map((dist, idx) => {
          const prodQtys: Record<string, number> = {};
          products.forEach(p => {
            prodQtys[p.ID_Produk] = getDistProductQty(dist, p);
          });
          return {
            no: idx + 1,
            namaPelanggan: dist.Nama_Pelanggan,
            levelPelanggan: dist.Level_Pelanggan || 'Distributor',
            tanggal: formatDisplayDate(dist.Tanggal),
            noSuratJalan: dist.No_Surat_Jalan,
            tujuan: dist.Tujuan,
            productQtys: prodQtys,
            metodeKirim: dist.Metode_Kirim,
            totalTagihan: calculateTotalTagihan(dist)
          };
        }),
        filename: `Laporan_Distribusi_${distReportFilter === 'bulan' ? distReportMonth : distReportYear}`
      });
    } else if (distReportTab === 'konsumen') {
      const prodHeaders = products.map(p => getProductShortCode(p));
      const headers = ['Pelanggan', 'Level', ...prodHeaders, 'Total Unit', 'Total Tagihan (Rp)'];
      const rows = Object.values(customerSummaryMap).map(c => [
        c.nama,
        c.level,
        ...products.map(p => (c.productByCode[p.ID_Produk] || 0).toLocaleString('id-ID')),
        c.totalQty.toLocaleString('id-ID'),
        `Rp ${c.totalNominal.toLocaleString('id-ID')}`
      ]);
      generateTableReportPDF({
        title: 'LAPORAN DISTRIBUSI PER KONSUMEN',
        subtitle: `Periode: ${distReportFilter === 'bulan' ? distReportMonth : distReportFilter === 'tahun' ? distReportYear : 'Seluruh Waktu'}`,
        headers,
        rows,
        filename: `Laporan_Distribusi_Konsumen_${distReportMonth}.pdf`
      });
    } else {
      const headers = ['Produk', ...monthNames, 'TOTAL'];
      const rows = products.map(p => {
        const rowVals = annualDistByProduct[p.ID_Produk] || new Array(12).fill(0);
        const sum = rowVals.reduce((a, b) => a + b, 0);
        return [p.Nama_Produk, ...rowVals, sum];
      });
      generateTableReportPDF({
        title: 'LAPORAN TAHUNAN DISTRIBUSI AMDK',
        subtitle: `Tahun ${distReportYear}`,
        headers,
        rows,
        filename: `Laporan_Tahunan_Distribusi_${distReportYear}.pdf`
      });
    }
  };

  const isDistModalPrinting = Boolean(viewDocModal || showDistReportModal);

  return (
    <div className="space-y-6">
      {/* Background Main Page (Otomatis disembunyikan saat mencetak dokumen modal) */}
      <div className={`space-y-6 ${isDistModalPrinting ? 'print:hidden' : ''}`}>
        {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Truck className="text-blue-600" size={24} />
            Distribusi & Logistik Armada
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rencana pesanan kirim, penerbitan Surat Jalan, invoice resmi, dan laporan per konsumen/tahunan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Working Print Button */}
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Cetak Halaman (Print)"
          >
            <Printer size={16} />
          </button>

          {/* New Laporan Distribusi Button */}
          <button
            onClick={() => {
              if (filterMonth && filterMonth !== 'all') {
                setDistReportMonth(filterMonth);
                const yr = filterMonth.split('-')[0];
                if (yr) setDistReportYear(yr);
              }
              setShowDistReportModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <BarChart2 size={14} />
            <span>Laporan Distribusi</span>
          </button>

          {/* Filter Periode Bulan (Tampil Lengkap 1 Sheet) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 hidden sm:inline">Periode:</span>
            <input
              type="month"
              value={filterMonth === 'all' ? '' : filterMonth}
              onChange={e => setFilterMonth(e.target.value || 'all')}
              className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-white focus:ring-1 focus:ring-blue-500 shadow-2xs"
              title="Pilih Bulan Spesifik untuk Ditampilkan Lengkap dalam 1 Sheet"
            />
            {filterMonth !== currentMonth && (
              <button
                type="button"
                onClick={() => setFilterMonth(currentMonth)}
                className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer shadow-2xs"
                title="Tampilkan Data Bulan Berjalan"
              >
                Bulan Ini
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterMonth(filterMonth === 'all' ? currentMonth : 'all')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                filterMonth === 'all' 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title={filterMonth === 'all' ? 'Kembali ke Bulan Ini' : 'Tampilkan Seluruh Data Semua Periode'}
            >
              {filterMonth === 'all' ? '✓ Semua Periode' : 'Semua Periode'}
            </button>
          </div>

          <button
            onClick={handleOpenAddDist}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Kirim Barang Baru</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: RENCANA DISTRIBUSI / LIST PESANAN (BAGIAN ATAS)    */}
      {/* Persis seperti pada menu Produksi (Rencana Produksi SPK)      */}
      {/* ============================================================== */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h3 className="text-sm font-bold text-slate-900">
                Rencana Distribusi / List Pesanan ({deliveryPlans.filter(p => p.Status !== 'Realisasi').length} Aktif)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar antrean pesanan pelanggan sebelum diinput ke surat jalan resmi. Klik "Realisasikan" untuk langsung memproses pengiriman.
            </p>
          </div>
          <button
            onClick={handleOpenAddPlan}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus size={14} />
            <span>Input Pesanan Baru</span>
          </button>
        </div>

        {deliveryPlans.length === 0 ? (
          <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-400 italic">
            Belum ada rencana pesanan aktif. Klik "+ Input Pesanan Baru" di atas.
          </div>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
            {deliveryPlans.map(plan => {
              const totalUnit = plan.Items?.reduce((a, b) => a + b.Qty, 0) || 0;
              const totalNominal = plan.Items?.reduce((a, b) => a + b.Subtotal, 0) || 0;
              const isRealized = plan.Status === 'Realisasi';

              return (
                <div 
                  key={plan.ID_Rencana}
                  className={`w-72 shrink-0 p-4 bg-white rounded-xl border shadow-xs flex flex-col justify-between ${
                    isRealized ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-t-4 border-t-amber-500 border-slate-200 hover:border-indigo-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span className="font-mono font-bold text-indigo-700">{plan.ID_Rencana}</span>
                      <span>{formatDisplayDate(plan.Tanggal_Rencana)}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{plan.Nama_Pelanggan}</h4>
                    <p className="text-[11px] text-slate-500">{plan.Level_Pelanggan} • {plan.Metode_Kirim}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{plan.Alamat_Tujuan}</p>

                    {/* Products List in this Order */}
                    <div className="mt-2.5 p-2 bg-slate-50 rounded-lg border border-slate-100 text-[11px] space-y-1">
                      <span className="font-bold text-slate-700 block text-[10px] uppercase">Rincian Barang Dipesan:</span>
                      {plan.Items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-slate-600 text-[10.5px]">
                          <span className="truncate max-w-[150px]">{it.Nama_Produk}</span>
                          <span className="font-mono font-bold">{it.Qty} unit</span>
                        </div>
                      ))}
                      <div className="pt-1 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-xs">
                        <span>Total ({totalUnit} Unit):</span>
                        <span className="font-mono text-indigo-700">Rp {totalNominal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeletePlan(plan.ID_Rencana)}
                        className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer font-medium"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>

                      {!isRealized && (
                        <button
                          onClick={() => handleOpenEditPlan(plan)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                      )}
                    </div>

                    {!isRealized ? (
                      <button
                        onClick={() => handleExecutePlanToDistribution(plan)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                      >
                        <Send size={12} />
                        <span>Realisasikan</span>
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Telah Dikirim
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: DATA DISTRIBUSI TERKIRIM (TABEL UTAMA DI BAWAH)     */}
      {/* Fleksibel dinamis sesuai Master Produk                          */}
      {/* ============================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Data Distribusi Terkirim</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-xs">
                {filterMonth === 'all' ? 'Seluruh Periode' : formatMonthName(filterMonth)}
              </span>
              <span className="text-slate-500 font-semibold text-xs">
                ({filteredDistributions.length} Data)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh data distribusi periode {filterMonth === 'all' ? 'semua bulan' : formatMonthName(filterMonth)} ditampilkan lengkap dalam 1 sheet.
            </p>
          </div>
          <button
            onClick={handleExportDistributionExcel}
            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Unduh Data Distribusi format Excel standar AMDK"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>

        {/* Search Bar Distribusi */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[240px] max-w-lg">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari No Surat Jalan, Invoice, Nama Pelanggan, Tujuan, Driver/Pengirim..."
              value={searchQueryDist}
              onChange={e => setSearchQueryDist(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
            />
            {searchQueryDist && (
              <button
                type="button"
                onClick={() => setSearchQueryDist('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Hapus kata kunci pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Toggle Buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 px-1 hidden sm:inline">Urut Tanggal:</span>
              <button
                type="button"
                onClick={() => setDateSortOrder('asc')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  dateSortOrder === 'asc'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Urutkan dari tanggal & surat jalan terlama ke terbaru (1 s.d. 31)"
              >
                <ArrowUp size={12} />
                <span>Terlama</span>
              </button>
              <button
                type="button"
                onClick={() => setDateSortOrder('desc')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  dateSortOrder === 'desc'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Urutkan dari tanggal & surat jalan terbaru ke terlama (31 s.d. 1)"
              >
                <ArrowDown size={12} />
                <span>Terbaru</span>
              </button>
            </div>

            {searchQueryDist && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                Menemukan {filteredDistributions.length} dari {distributions.length} transaksi
              </span>
            )}
            {searchQueryDist && (
              <button
                type="button"
                onClick={() => setSearchQueryDist('')}
                className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <X size={12} />
                <span>Reset Pencarian</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-800 font-bold bg-white">
                <th rowSpan={2} className="p-3 text-center w-12 border-r border-slate-200">No</th>
                <th rowSpan={2} className="p-3 min-w-[190px] border-r border-slate-200">Nama & Tipe</th>
                <th 
                  rowSpan={2} 
                  onClick={() => setDateSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-3 text-center min-w-[115px] border-r border-slate-200 cursor-pointer hover:bg-blue-50/80 transition-colors select-none group"
                  title="Klik untuk mengubah urutan tanggal & surat jalan (Terlama / Terbaru)"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Tanggal</span>
                    <span className="p-0.5 rounded bg-slate-100 group-hover:bg-blue-200 text-blue-700 transition">
                      {dateSortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    </span>
                  </div>
                  <span className="text-[9px] font-normal text-slate-500 block mt-0.5">
                    {dateSortOrder === 'asc' ? 'Terlama ➔ Baru' : 'Terbaru ➔ Lama'}
                  </span>
                </th>
                <th rowSpan={2} className="p-3 text-center min-w-[90px] border-r border-slate-200">No S.J.</th>
                <th rowSpan={2} className="p-3 min-w-[130px] border-r border-slate-200">Tujuan</th>
                {/* Group Header for PRODUK / QTY - Dynamic columns according to Master Produk */}
                <th colSpan={products.length} className="p-2 text-center bg-[#eef2ff] text-slate-800 font-extrabold uppercase border-r border-slate-200 tracking-wider">
                  PRODUK / QTY
                </th>
                <th rowSpan={2} className="p-3 text-center min-w-[110px] border-r border-slate-200">Metode</th>
                <th rowSpan={2} className="p-3 text-right min-w-[115px] border-r border-slate-200">Tagihan (Rp)</th>
                <th rowSpan={2} className="p-3 text-center min-w-[135px]">Aksi</th>
              </tr>
              <tr className="border-b border-slate-200 bg-[#f8faff] text-slate-700 font-extrabold text-[11px]">
                {products.map(prod => (
                  <th 
                    key={prod.ID_Produk} 
                    className="p-2 text-center min-w-[50px] border-r border-slate-200"
                    title={`${prod.Nama_Produk} (${prod.Satuan})`}
                  >
                    {getProductShortCode(prod)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDistributions.length === 0 ? (
                <tr>
                  <td colSpan={7 + products.length} className="p-8 text-center text-slate-400">
                    {filterMonth === 'all' ? (
                      'Belum ada data pengiriman distribusi di database. Anda dapat mengimpor data melalui Pengaturan Sistem > Pusat Import & Migrasi Data Excel.'
                    ) : distributions.length > 0 ? (
                      <div className="space-y-2">
                        <p>Belum ada data pengiriman distribusi untuk bulan {formatMonthName(filterMonth)} ({distributions.length} data tersimpan di periode lain).</p>
                        <button
                          type="button"
                          onClick={() => setFilterMonth('all')}
                          className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          Tampilkan Seluruh Data ({distributions.length} Data Semua Periode)
                        </button>
                      </div>
                    ) : (
                      `Belum ada data pengiriman distribusi untuk bulan ${formatMonthName(filterMonth)}.`
                    )}
                  </td>
                </tr>
              ) : (
                filteredDistributions.map((dist, idx) => {
                  const totalTagihan = calculateTotalTagihan(dist);
                  const isAmbilSendiri = dist.Metode_Kirim === 'Ambil Sendiri';
                  const rowNum = idx + 1;

                  return (
                    <tr key={dist.ID_Distribusi || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-100">
                        {rowNum}
                      </td>
                      <td className="p-3 border-r border-slate-100">
                        <div className="font-extrabold text-slate-900 uppercase tracking-tight text-xs">
                          {dist.Nama_Pelanggan}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                          {dist.Level_Pelanggan && dist.Level_Pelanggan !== '-' ? dist.Level_Pelanggan : '-'}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                        {formatDisplayDate(dist.Tanggal)}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        {dist.No_Surat_Jalan || '-'}
                      </td>
                      <td className="p-3 uppercase font-medium text-slate-800 border-r border-slate-100">
                        {dist.Tujuan || '-'}
                      </td>

                      {/* PRODUK / QTY DYNAMIC COLUMNS */}
                      {products.map(prod => {
                        const qty = getDistProductQty(dist, prod);
                        return (
                          <td key={prod.ID_Produk} className="p-2 text-center border-r border-slate-100">
                            {qty > 0 ? (
                              <span className="font-extrabold text-blue-600 font-mono text-xs">{qty}</span>
                            ) : (
                              <span className="font-normal text-slate-400 font-mono text-xs">0</span>
                            )}
                          </td>
                        );
                      })}

                      {/* METODE PILL */}
                      <td className="p-3 text-center border-r border-slate-100">
                        {isAmbilSendiri ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-white font-semibold text-[10.5px] inline-block shadow-xs whitespace-nowrap">
                            Ambil Sendiri
                          </span>
                        ) : (dist.Metode_Kirim === 'Diantar Armada' || (dist.Metode_Kirim && dist.Metode_Kirim !== '-')) ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10.5px] inline-block border border-slate-200/80 whitespace-nowrap">
                            {dist.Metode_Kirim}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* TAGIHAN */}
                      <td className="p-3 text-right font-bold text-slate-900 font-mono text-xs border-r border-slate-100 whitespace-nowrap">
                        Rp {totalTagihan.toLocaleString('id-ID')}
                      </td>

                      {/* AKSI BUTTONS: HANYA TOMBOL BUKA */}
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => setOpenDetailDist(dist)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer mx-auto"
                          title="Buka Rincian Pengiriman & Cetak Dokumen"
                        >
                          <FolderOpen size={13} />
                          <span>Buka</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* TOTAL FOOTER ROW */}
            {filteredDistributions.length > 0 && (
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <tr>
                  <td colSpan={5} className="p-3 text-right text-slate-800 uppercase tracking-wider font-extrabold text-xs border-r border-slate-200">
                    TOTAL SELURUH DISTRIBUSI ({filteredDistributions.length} Data)
                  </td>
                  {products.map(prod => {
                    const sumP = tableTotals.prodSums[prod.ID_Produk] || 0;
                    return (
                      <td key={prod.ID_Produk} className="p-2 text-center font-mono font-extrabold text-blue-700 text-xs border-r border-slate-200">
                        {sumP > 0 ? sumP : 0}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center border-r border-slate-200 text-slate-500 font-normal text-xs">-</td>
                  <td className="p-3 text-right font-mono font-extrabold text-emerald-700 text-xs border-r border-slate-200">
                    Rp {tableTotals.grandTotalTagihan.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* FOOTER INFO BAR: MENAMPILKAN SELURUH DATA DALAM SATU SHEET */}
        {filteredDistributions.length > 0 && (
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
              <span>Menampilkan seluruh</span>
              <span className="font-extrabold text-slate-900 font-mono text-sm">{filteredDistributions.length}</span>
              <span>data pengiriman periode</span>
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {filterMonth === 'all' ? 'Seluruh Periode' : formatMonthName(filterMonth)}
              </span>
              <span>dalam satu sheet (tanpa pemisah halaman).</span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Data tersinkronisasi real-time dengan Stok Produk & Keuangan
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL RINCIAN PENGIRIMAN (BUKA AKSI)                           */}
      {/* ============================================================== */}
      {openDetailDist && (() => {
        const dist = openDetailDist;
        const items = distributionItems.filter(i => i.ID_Distribusi === dist.ID_Distribusi);
        const total = calculateTotalTagihan(dist);
        const c120 = getProductQtyByCode(dist, 'C120');
        const c220 = getProductQtyByCode(dist, 'C220');
        const b330 = getProductQtyByCode(dist, 'B330');
        const b600 = getProductQtyByCode(dist, 'B600');
        const g19 = getProductQtyByCode(dist, 'G19');
        const totalQty = c120 + c220 + b330 + b600 + g19;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-teal-700 text-white">
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="text-teal-200" size={20} />
                  <div>
                    <h3 className="font-bold text-sm tracking-tight">
                      Surat Jalan No. {dist.No_Surat_Jalan || '-'}
                    </h3>
                    <p className="text-[11px] text-teal-100">
                      Tujuan: {dist.Nama_Pelanggan || '-'} {dist.Level_Pelanggan && dist.Level_Pelanggan !== '-' ? `(${dist.Level_Pelanggan})` : ''}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setOpenDetailDist(null)} 
                  className="p-1 text-teal-100 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
                {/* Meta Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Tanggal Kirim</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">{formatDisplayDate(dist.Tanggal)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">No. Invoice</span>
                    <span className="font-mono font-bold text-blue-700 text-xs">
                      {dist.No_Invoice && dist.No_Invoice !== '-' ? dist.No_Invoice : (dist.No_Invoice === '-' ? '-' : formatInvoiceNumber(dist.ID_Distribusi, dist.Tanggal))}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Metode Pengiriman</span>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      dist.Metode_Kirim === 'Ambil Sendiri' ? 'bg-slate-800 text-white' : (dist.Metode_Kirim && dist.Metode_Kirim !== '-') ? 'bg-slate-200 text-slate-800' : 'text-slate-500 bg-slate-100'
                    }`}>
                      {dist.Metode_Kirim || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Pengirim / Sopir</span>
                    <span className="font-semibold text-slate-800">{dist.Pengirim || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Penerima</span>
                    <span className="font-semibold text-slate-800">{dist.Penerima || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Alamat / Wilayah</span>
                    <span className="font-semibold text-slate-800 uppercase">{dist.Tujuan || '-'}</span>
                  </div>
                  {dist.Keterangan && dist.Keterangan !== '-' && (
                    <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-200/80">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block">Keterangan / Catatan</span>
                      <span className="font-medium text-slate-700">{dist.Keterangan}</span>
                    </div>
                  )}
                </div>

                {/* Table of Products Sent */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Rincian Produk Terkirim ({products.reduce((sum, p) => sum + getDistProductQty(dist, p), 0)} Unit Total)
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Kode</th>
                          <th className="p-2.5">Produk</th>
                          <th className="p-2.5 text-center">Jumlah</th>
                          <th className="p-2.5 text-right">Harga</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {products.map(p => {
                          const q = getDistProductQty(dist, p);
                          if (q <= 0) return null;
                          const item = items.find(i => i.ID_Produk === p.ID_Produk || i.Nama_Produk === p.Nama_Produk);
                          const price = item ? item.Harga_Satuan : (p.Harga_Distributor || 12000);
                          const sub = item ? item.Subtotal : (q * price);
                          return (
                            <tr key={p.ID_Produk} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-600">{getProductShortCode(p)}</td>
                              <td className="p-2.5 font-sans font-semibold text-slate-900">{p.Nama_Produk}</td>
                              <td className="p-2.5 text-center font-bold text-blue-700">{q.toLocaleString('id-ID')}</td>
                              <td className="p-2.5 text-right text-slate-600">Rp {price.toLocaleString('id-ID')}</td>
                              <td className="p-2.5 text-right font-bold text-slate-900">Rp {sub.toLocaleString('id-ID')}</td>
                            </tr>
                          );
                        })}
                        {products.reduce((sum, p) => sum + getDistProductQty(dist, p), 0) === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400 font-sans">
                              Tidak ada rincian produk untuk pengiriman ini.
                            </td>
                          </tr>
                        )}
                        <tr className="bg-teal-50/70 font-bold border-t border-teal-200">
                          <td colSpan={2} className="p-2.5 font-sans text-teal-950 font-bold">TOTAL TAGIHAN</td>
                          <td className="p-2.5 text-center text-teal-950 font-mono">
                            {products.reduce((sum, p) => sum + getDistProductQty(dist, p), 0)} Unit
                          </td>
                          <td colSpan={2} className="p-2.5 text-right text-teal-950 font-mono text-sm font-extrabold">
                            Rp {total.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {dist.Keterangan && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                    <strong>Catatan / Keterangan:</strong> {dist.Keterangan}
                  </div>
                )}

                {/* Action Buttons Toolbar: Surat Jalan & Invoice (Open Preview) */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setOpenDetailDist(null);
                        setViewDocModal({ dist, items, docType: 'inv' });
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      title="Buka Preview Invoice, Cetak, atau Download PDF"
                    >
                      <FileText size={15} />
                      <span>Invoice</span>
                    </button>
                    <button
                      onClick={() => {
                        setOpenDetailDist(null);
                        setViewDocModal({ dist, items, docType: 'sj' });
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                      title="Buka Preview Surat Jalan, Cetak, atau Download PDF"
                    >
                      <FileCheck size={15} />
                      <span>Surat Jalan</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setOpenDetailDist(null);
                        handleOpenEditDist(dist);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setOpenDetailDist(null);
                        handleDeleteDistribution(dist.ID_Distribusi);
                      }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>

      {/* ============================================================== */}
      {/* MODAL LAPORAN DISTRIBUSI (PER KONSUMEN & TAHUNAN)               */}
      {/* ============================================================== */}
      {showDistReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 printable-modal-card">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-purple-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Laporan Distribusi
                </h3>
              </div>
              <button onClick={() => setShowDistReportModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Filter Bar & 3 Tabs */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setDistReportTab('rekap')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                    distReportTab === 'rekap' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1. Rekap Distribusi & Produk
                </button>
                <button
                  onClick={() => setDistReportTab('konsumen')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                    distReportTab === 'konsumen' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2. Per Konsumen
                </button>
                <button
                  onClick={() => setDistReportTab('tahunan')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-colors cursor-pointer ${
                    distReportTab === 'tahunan' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3. Laporan Tahunan
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={distReportFilter}
                  onChange={e => setDistReportFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium outline-none"
                >
                  <option value="bulan">Filter Bulan</option>
                  <option value="tahun">Filter Tahun</option>
                  <option value="seluruh">Seluruh Data</option>
                </select>

                {distReportFilter === 'bulan' && (
                  <input
                    type="month"
                    value={distReportMonth}
                    onChange={e => setDistReportMonth(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-semibold"
                  />
                )}

                {distReportFilter === 'tahun' && (
                  <input
                    type="number"
                    value={distReportYear}
                    onChange={e => setDistReportYear(e.target.value)}
                    className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-semibold text-center"
                  />
                )}

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Cetak Laporan"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  onClick={handleExportDistReportPDF}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Unduh PDF Laporan Resmi AMDK"
                >
                  <FileDown size={13} />
                  <span>Unduh PDF</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs printable-scroll-area printable-content">
              {/* Header Cetak Resmi Khusus Hasil Print */}
              <div className="hidden print:block text-center pb-4 mb-4 border-b-2 border-slate-900">
                <h1 className="text-base font-black text-slate-900 tracking-wider">PT. ANUGERAH ILLAHI RABBI</h1>
                <p className="text-[10px] text-slate-600 font-medium">Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa • Klaten, Jawa Tengah</p>
                <div className="mt-2 pt-2 border-t border-slate-300">
                  <h2 className="text-sm font-extrabold uppercase text-slate-900 tracking-tight">
                    {distReportTab === 'rekap' 
                      ? 'LAPORAN REKAPITULASI PENGIRIMAN & DISTRIBUSI PRODUK' 
                      : distReportTab === 'konsumen' 
                      ? 'LAPORAN REKAPITULASI DISTRIBUSI PER KONSUMEN / MITRA' 
                      : 'LAPORAN TAHUNAN DISTRIBUSI AMDK 12 BULAN'}
                  </h2>
                  <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                    Periode: {distReportFilter === 'bulan' ? formatMonthName(distReportMonth) : distReportFilter === 'tahun' ? `Tahun ${distReportYear}` : 'Seluruh Waktu'} • Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* TAB 1: REKAP DISTRIBUSI & PRODUK (Sesuai Gambar 1 & 2) */}
              {distReportTab === 'rekap' && (
                <div className="space-y-6">
                  {/* 3 KPI Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider block">Total Unit Terkirim</span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono text-blue-950">{totalReportUnits.toLocaleString('id-ID')}</span>
                        <span className="text-xs font-semibold text-blue-700">Dus / Galon</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Akumulasi produk keluar pabrik</p>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider block">Total Pengiriman</span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black font-mono text-purple-950">{reportDistributions.length}</span>
                        <span className="text-xs font-semibold text-purple-700">Surat Jalan</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Armada kirim & ambil mandiri</p>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">Total Tagihan Distribusi</span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xs font-bold text-emerald-800">Rp</span>
                        <span className="text-2xl font-black font-mono text-emerald-950">{totalReportNominal.toLocaleString('id-ID')}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Faktur penjualan terbit</p>
                    </div>
                  </div>

                  {/* Section 1: Ringkasan Distribusi Masing-Masing Produk */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        Rekapitulasi Distribusi Masing-Masing Produk
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {reportProductSummaryWithPercent.length} Master Produk AMDK
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5 text-center w-10">No</th>
                            <th className="p-2.5">Nama Produk</th>
                            <th className="p-2.5 text-center">Kode</th>
                            <th className="p-2.5">Kategori</th>
                            <th className="p-2.5 text-center">Satuan</th>
                            <th className="p-2.5 text-right font-mono">Total Terkirim</th>
                            <th className="p-2.5 text-right font-mono">Kontribusi</th>
                            <th className="p-2.5 text-right font-mono">Estimasi Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {reportProductSummaryWithPercent.map((prod, idx) => (
                            <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 text-center font-bold text-slate-600">{idx + 1}</td>
                              <td className="p-2.5 font-sans font-bold text-slate-900">{prod.nama}</td>
                              <td className="p-2.5 text-center font-bold text-indigo-700">{prod.shortCode}</td>
                              <td className="p-2.5 font-sans text-slate-600">{prod.kategori}</td>
                              <td className="p-2.5 text-center font-sans text-slate-600">{prod.satuan}</td>
                              <td className="p-2.5 text-right font-bold text-blue-700">
                                {prod.totalQty.toLocaleString('id-ID')}
                              </td>
                              <td className="p-2.5 text-right font-semibold text-slate-700">
                                {prod.percentage.toFixed(1)}%
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-900">
                                Rp {prod.subtotal.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                          <tr>
                            <td colSpan={5} className="p-2.5 text-right uppercase tracking-wider text-slate-800">
                              TOTAL SELURUH PRODUK
                            </td>
                            <td className="p-2.5 text-right font-mono text-blue-800 text-xs font-black">
                              {totalReportUnits.toLocaleString('id-ID')} Unit
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-800">100.0%</td>
                            <td className="p-2.5 text-right font-mono text-emerald-800 text-xs font-black">
                              Rp {totalReportNominal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Section 2: Data Distribusi Terkirim (Persis format Gambar 1 & 2) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        Data Pengiriman Distribusi ({reportDistributions.length} Dokumen)
                      </h4>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-800 font-bold bg-white">
                            <th rowSpan={2} className="p-2.5 text-center w-10 border-r border-slate-200">No</th>
                            <th rowSpan={2} className="p-2.5 min-w-[160px] border-r border-slate-200">Nama & Tipe</th>
                            <th rowSpan={2} className="p-2.5 text-center min-w-[95px] border-r border-slate-200">Tanggal</th>
                            <th rowSpan={2} className="p-2.5 text-center min-w-[90px] border-r border-slate-200">No S.J.</th>
                            <th rowSpan={2} className="p-2.5 min-w-[120px] border-r border-slate-200">Tujuan</th>
                            <th colSpan={products.length} className="p-2 text-center bg-[#eef2ff] text-slate-800 font-extrabold uppercase border-r border-slate-200 tracking-wider">
                              PRODUK / QTY
                            </th>
                            <th rowSpan={2} className="p-2.5 text-center min-w-[100px] border-r border-slate-200">Metode</th>
                            <th rowSpan={2} className="p-2.5 text-right min-w-[110px]">Tagihan (Rp)</th>
                          </tr>
                          <tr className="border-b border-slate-200 bg-[#f8faff] text-slate-700 font-extrabold text-[10.5px]">
                            {products.map(prod => (
                              <th 
                                key={prod.ID_Produk} 
                                className="p-2 text-center min-w-[45px] border-r border-slate-200"
                                title={prod.Nama_Produk}
                              >
                                {getProductShortCode(prod)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportDistributions.length === 0 ? (
                            <tr>
                              <td colSpan={6 + products.length} className="p-6 text-center text-slate-400">
                                Tidak ada data pengiriman pada periode filter yang dipilih.
                              </td>
                            </tr>
                          ) : (
                            reportDistributions.map((dist, idx) => {
                              const tagihan = calculateTotalTagihan(dist);
                              return (
                                <tr key={dist.ID_Distribusi || idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-2.5 text-center font-bold text-slate-600 border-r border-slate-100">
                                    {idx + 1}
                                  </td>
                                  <td className="p-2.5 border-r border-slate-100">
                                    <div className="font-extrabold text-slate-900 uppercase text-xs">
                                      {dist.Nama_Pelanggan}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-semibold uppercase">
                                      {dist.Level_Pelanggan || 'DISTRIBUTOR'}
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                                    {formatDisplayDate(dist.Tanggal)}
                                  </td>
                                  <td className="p-2.5 text-center font-mono text-slate-700 border-r border-slate-100 whitespace-nowrap">
                                    {dist.No_Surat_Jalan}
                                  </td>
                                  <td className="p-2.5 uppercase text-slate-700 border-r border-slate-100">
                                    {dist.Tujuan}
                                  </td>
                                  {products.map(prod => {
                                    const qty = getDistProductQty(dist, prod);
                                    return (
                                      <td key={prod.ID_Produk} className="p-2 text-center border-r border-slate-100">
                                        {qty > 0 ? (
                                          <span className="font-bold text-blue-700 font-mono text-xs">{qty}</span>
                                        ) : (
                                          <span className="text-slate-300 font-mono text-xs">0</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="p-2.5 text-center border-r border-slate-100">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                      dist.Metode_Kirim === 'Ambil Sendiri' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {dist.Metode_Kirim}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                                    Rp {tagihan.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {reportDistributions.length > 0 && (
                          <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                            <tr>
                              <td colSpan={5} className="p-2.5 text-right text-slate-800 uppercase tracking-wider text-xs border-r border-slate-200">
                                TOTAL REKAP DISTRIBUSI
                              </td>
                              {products.map(prod => {
                                const sumP = reportDistributions.reduce((sum, d) => sum + getDistProductQty(d, prod), 0);
                                return (
                                  <td key={prod.ID_Produk} className="p-2 text-center font-mono font-black text-blue-800 text-xs border-r border-slate-200">
                                    {sumP}
                                  </td>
                                );
                              })}
                              <td className="p-2.5 text-center border-r border-slate-200 text-slate-400">-</td>
                              <td className="p-2.5 text-right font-mono font-black text-emerald-800 text-xs whitespace-nowrap">
                                Rp {totalReportNominal.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {/* TAB 2: LAPORAN PER KONSUMEN */}
              {distReportTab === 'konsumen' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Rekapitulasi volume produk yang terkirim ke masing-masing mitra/pelanggan:</span>
                    <span className="font-semibold text-purple-700">{Object.values(customerSummaryMap).length} Konsumen Aktif</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th rowSpan={2} className="p-2.5 min-w-[180px] border-r border-slate-200">Nama Konsumen / Toko</th>
                          <th rowSpan={2} className="p-2.5 text-center min-w-[100px] border-r border-slate-200">Level Mitra</th>
                          <th colSpan={products.length} className="p-2 text-center bg-purple-50 text-purple-900 uppercase font-extrabold tracking-wider border-r border-slate-200">
                            Rincian Produk Terkirim (Unit)
                          </th>
                          <th rowSpan={2} className="p-2.5 text-right min-w-[100px] border-r border-slate-200">Total Unit</th>
                          <th rowSpan={2} className="p-2.5 text-right min-w-[130px]">Total Nilai Tagihan</th>
                        </tr>
                        <tr className="bg-purple-50/60 text-purple-950 font-bold text-[11px] border-b border-slate-200">
                          {products.map(prod => (
                            <th 
                              key={prod.ID_Produk} 
                              className="p-2 text-center min-w-[65px] border-r border-slate-200"
                              title={prod.Nama_Produk}
                            >
                              {getProductShortCode(prod)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.values(customerSummaryMap).length === 0 ? (
                          <tr>
                            <td colSpan={4 + products.length} className="p-8 text-center text-slate-400 font-sans">
                              Tidak ada riwayat distribusi untuk periode ini.
                            </td>
                          </tr>
                        ) : (
                          Object.values(customerSummaryMap).map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">
                                <div>{c.nama}</div>
                              </td>
                              <td className="p-2.5 text-center text-slate-600 border-r border-slate-100">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 inline-block">
                                  {c.level}
                                </span>
                              </td>

                              {/* Dynamic Columns for Each Product */}
                              {products.map(prod => {
                                const qty = c.productByCode[prod.ID_Produk] || 0;
                                return (
                                  <td key={prod.ID_Produk} className="p-2 text-center font-mono border-r border-slate-100">
                                    {qty > 0 ? (
                                      <span className="font-bold text-purple-700">{qty.toLocaleString('id-ID')}</span>
                                    ) : (
                                      <span className="text-slate-300">0</span>
                                    )}
                                  </td>
                                );
                              })}

                              <td className="p-2.5 text-right font-mono font-bold text-purple-900 bg-purple-50/30 border-r border-slate-100">
                                {c.totalQty.toLocaleString('id-ID')}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                Rp {c.totalNominal.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {Object.values(customerSummaryMap).length > 0 && (
                        <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                          <tr>
                            <td colSpan={2} className="p-2.5 text-right text-slate-800 uppercase font-extrabold text-xs border-r border-slate-200">
                              TOTAL DISTRIBUSI
                            </td>
                            {products.map(prod => {
                              const sumP = Object.values(customerSummaryMap).reduce((s, c) => s + (c.productByCode[prod.ID_Produk] || 0), 0);
                              return (
                                <td key={prod.ID_Produk} className="p-2 text-center font-mono font-extrabold text-purple-800 text-xs border-r border-slate-200">
                                  {sumP.toLocaleString('id-ID')}
                                </td>
                              );
                            })}
                            <td className="p-2.5 text-right font-mono font-extrabold text-purple-900 text-xs border-r border-slate-200">
                              {Object.values(customerSummaryMap).reduce((s, c) => s + c.totalQty, 0).toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5 text-right font-mono font-extrabold text-emerald-800 text-xs">
                              Rp {Object.values(customerSummaryMap).reduce((s, c) => s + c.totalNominal, 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: LAPORAN TAHUNAN DENGAN GRAFIK GARIS & DATA LENGKAP */}
              {distReportTab === 'tahunan' && (
                <div className="space-y-5">
                  {/* Grafik Garis Tahunan untuk Masing-Masing Produk */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-purple-600" />
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">Grafik Garis Tren Distribusi Per Produk:</span>
                          <span className="text-[11px] text-slate-500">Pergerakan distribusi kirim bulanan masing-masing produk (Tahun {distReportYear})</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        Tahun {distReportYear}
                      </span>
                    </div>

                    {/* Interactive Legend for each Product */}
                    <div className="flex flex-wrap items-center gap-3 py-1">
                      {products.map((prod, pIdx) => {
                        const colors = ['#9333ea', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#ea580c'];
                        const color = colors[pIdx % colors.length];
                        const total = (annualDistByProduct[prod.ID_Produk] || []).reduce((a, b) => a + b, 0);
                        return (
                          <div key={prod.ID_Produk} className="flex items-center gap-1.5 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }}></span>
                            <span className="font-semibold text-slate-800">{prod.Nama_Produk}</span>
                            <span className="font-mono text-slate-500 font-bold">({total.toLocaleString('id-ID')})</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Multi-line SVG Chart */}
                    {(() => {
                      const colors = ['#9333ea', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#ea580c'];
                      const chartH = 200;
                      const chartW = 740;
                      const padX = 45;
                      const padY = 25;
                      const innerW = chartW - padX * 2;
                      const innerH = chartH - padY * 2;

                      // Find max value across all product monthly numbers
                      let maxProductVal = 10;
                      products.forEach(prod => {
                        const row = annualDistByProduct[prod.ID_Produk] || [];
                        row.forEach(v => {
                          if (v > maxProductVal) maxProductVal = v;
                        });
                      });
                      const yMaxProd = Math.ceil(maxProductVal / 50) * 50 || 100;

                      const getX = (idx: number) => padX + (idx / 11) * innerW;
                      const getY = (val: number) => padY + innerH - (val / yMaxProd) * innerH;

                      return (
                        <div className="w-full overflow-x-auto pt-2">
                          <div className="min-w-[620px]">
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-56 overflow-visible">
                              {/* Horizontal Grid lines */}
                              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                                const yPos = padY + innerH * (1 - pct);
                                const labelVal = Math.round(yMaxProd * pct);
                                return (
                                  <g key={i}>
                                    <line
                                      x1={padX}
                                      y1={yPos}
                                      x2={chartW - padX}
                                      y2={yPos}
                                      stroke="#f1f5f9"
                                      strokeDasharray="4 4"
                                    />
                                    <text
                                      x={padX - 8}
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

                              {/* Month labels at bottom */}
                              {monthNames.map((m, idx) => (
                                <text
                                  key={m}
                                  x={getX(idx)}
                                  y={chartH - 6}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fontWeight="600"
                                  fill="#64748b"
                                >
                                  {m}
                                </text>
                              ))}

                              {/* Render Line for each Product */}
                              {products.map((prod, pIdx) => {
                                const row = annualDistByProduct[prod.ID_Produk] || new Array(12).fill(0);
                                const color = colors[pIdx % colors.length];
                                const pts = row.map((val, idx) => ({ x: getX(idx), y: getY(val), val }));
                                const pathD = pts.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');

                                return (
                                  <g key={prod.ID_Produk}>
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="transition-all hover:stroke-[3.5]"
                                    />
                                    {pts.map((pt, mIdx) => (
                                      <g key={mIdx} className="group cursor-pointer">
                                        <circle
                                          cx={pt.x}
                                          cy={pt.y}
                                          r="3.5"
                                          fill={color}
                                          stroke="#ffffff"
                                          strokeWidth="1.5"
                                          className="hover:r-5 transition-all"
                                        />
                                        {pt.val > 0 && (
                                          <text
                                            x={pt.x}
                                            y={pt.y - 7}
                                            textAnchor="middle"
                                            fontSize="8"
                                            fontWeight="bold"
                                            fill={color}
                                            fontFamily="monospace"
                                          >
                                            {pt.val}
                                          </text>
                                        )}
                                      </g>
                                    ))}
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Matriks Tabel Tahunan per Produk */}
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                        <tr>
                          <th className="p-2.5">Produk</th>
                          {monthNames.map(m => (
                            <th key={m} className="p-2 text-center">{m}</th>
                          ))}
                          <th className="p-2.5 text-right font-bold">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {products.map(prod => {
                          const rowVals = annualDistByProduct[prod.ID_Produk] || new Array(12).fill(0);
                          const totalProd = rowVals.reduce((a, b) => a + b, 0);
                          return (
                            <tr key={prod.ID_Produk} className="hover:bg-slate-50">
                              <td className="p-2.5 font-sans font-semibold text-slate-900">{prod.Nama_Produk}</td>
                              {rowVals.map((v, i) => (
                                <td key={i} className="p-2 text-center tabular-nums text-slate-700">
                                  {v > 0 ? v.toLocaleString('id-ID') : '-'}
                                </td>
                              ))}
                              <td className="p-2.5 text-right font-bold text-purple-900 tabular-nums">
                                {totalProd.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-bold">
                          <td className="p-2.5 font-sans text-slate-900">TOTAL DISTRIBUSI KESELURUHAN</td>
                          {annualDistTotalMonthly.map((tot, idx) => (
                            <td key={idx} className="p-2 text-center text-purple-800">
                              {tot > 0 ? tot.toLocaleString('id-ID') : '-'}
                            </td>
                          ))}
                          <td className="p-2.5 text-right text-purple-900 text-sm">
                            {annualDistTotalMonthly.reduce((a, b) => a + b, 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDistReportModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input / Edit Pengiriman Langsung */}
      {showAddDistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingDist ? `Edit Pengiriman: ${editingDist.ID_Distribusi}` : 'Form Pengiriman Distribusi Langsung'}
              </h3>
              <button onClick={() => setShowAddDistModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Kirim</label>
                  <input
                    type="date"
                    value={formData.Tanggal}
                    onChange={e => {
                      const newTgl = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        Tanggal: newTgl,
                        No_Surat_Jalan: editingDist ? prev.No_Surat_Jalan : generateSuratJalanNumber(newTgl),
                        No_Invoice: editingDist ? prev.No_Invoice : formatInvoiceNumber('', newTgl)
                      }));
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Surat Jalan</label>
                  <input
                    type="text"
                    value={formData.No_Surat_Jalan}
                    onChange={e => setFormData({ ...formData, No_Surat_Jalan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono font-bold text-blue-700"
                    placeholder="Contoh: 707/X/26"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Invoice</label>
                  <input
                    type="text"
                    value={formData.No_Invoice}
                    onChange={e => setFormData({ ...formData, No_Invoice: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono font-bold text-purple-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Metode Pengiriman</label>
                  <select
                    value={formData.Metode_Kirim}
                    onChange={e => setFormData({ ...formData, Metode_Kirim: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium"
                  >
                    <option value="Kirim Armada">Kirim Armada Pabrik</option>
                    <option value="Ambil Sendiri">Ambil Sendiri (Potongan Rp 1.000/dus)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Searchable Customer Input with Dropdown */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Pilih Pelanggan / Mitra</label>
                    {formData.Level_Pelanggan && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {formData.Level_Pelanggan}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Ketik untuk mencari pelanggan..."
                      value={isCustomerDropdownOpen ? customerSearchQuery : (formData.Nama_Pelanggan || customerSearchQuery)}
                      onFocus={() => {
                        setCustomerSearchQuery(formData.Nama_Pelanggan || '');
                        setIsCustomerDropdownOpen(true);
                      }}
                      onChange={e => {
                        setCustomerSearchQuery(e.target.value);
                        setIsCustomerDropdownOpen(true);
                        setFormData(prev => ({ ...prev, Nama_Pelanggan: e.target.value }));
                      }}
                      className="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                    {(formData.Nama_Pelanggan || customerSearchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearchQuery('');
                          setFormData(prev => ({
                            ...prev,
                            ID_Pelanggan: '',
                            Nama_Pelanggan: '',
                            Level_Pelanggan: 'Distributor',
                            Tujuan: ''
                          }));
                          setIsCustomerDropdownOpen(true);
                        }}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Hapus pilihan pelanggan"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Menu Hasil Pencarian */}
                  {isCustomerDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-20" 
                        onClick={() => setIsCustomerDropdownOpen(false)}
                      />
                      <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl divide-y divide-slate-100 text-xs">
                        {filteredCustomersList.length === 0 ? (
                          <div className="p-3 text-center text-slate-400">
                            <p className="font-medium">Tidak ada pelanggan cocok dengan "{customerSearchQuery}".</p>
                            <p className="text-[11px] text-blue-600 mt-1">Nama ini akan disimpan sebagai pelanggan baru.</p>
                          </div>
                        ) : (
                          filteredCustomersList.map(c => {
                            const isSelected = c.ID_Pelanggan === formData.ID_Pelanggan;
                            return (
                              <div
                                key={c.ID_Pelanggan}
                                onClick={() => handleCustomerSelect(c)}
                                className={`p-2.5 cursor-pointer transition flex items-center justify-between hover:bg-blue-50/80 ${
                                  isSelected ? 'bg-blue-50 border-l-4 border-blue-600 font-bold' : ''
                                }`}
                              >
                                <div>
                                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                    <span>{c.Nama_Pelanggan}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                      {c.Level_Pelanggan || 'Distributor'}
                                    </span>
                                  </div>
                                  <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span className="font-mono text-slate-400">{c.ID_Pelanggan}</span>
                                    {c.Alamat && <span className="truncate max-w-[280px]">• {c.Alamat}</span>}
                                  </div>
                                </div>
                                {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Sopir / Pengirim</label>
                    {frequentDrivers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsDriverDropdownOpen(prev => !prev)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                      >
                        {isDriverDropdownOpen ? 'Tutup Pilihan' : 'Pilih Sopir Rutin ▼'}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      list="drivers-list-datalist"
                      placeholder="Ketik atau pilih nama sopir..."
                      value={formData.Pengirim}
                      onFocus={() => setIsDriverDropdownOpen(true)}
                      onChange={e => {
                        setFormData({ ...formData, Pengirim: e.target.value });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    />
                    <datalist id="drivers-list-datalist">
                      {frequentDrivers.map(d => (
                        <option key={d.name} value={d.name}>{d.name} ({d.count}x)</option>
                      ))}
                    </datalist>
                  </div>

                  {/* Dropdown Menu Sopir Sering Digunakan */}
                  {isDriverDropdownOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-20" 
                        onClick={() => setIsDriverDropdownOpen(false)}
                      />
                      <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl divide-y divide-slate-100 text-xs">
                        <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Sopir yang Sering Digunakan</span>
                          <span className="text-[9.5px] font-normal text-slate-400">Paling Sering</span>
                        </div>
                        {frequentDrivers.map(d => (
                          <div
                            key={d.name}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, Pengirim: d.name }));
                              setIsDriverDropdownOpen(false);
                            }}
                            className={`p-2.5 cursor-pointer transition flex items-center justify-between hover:bg-blue-50/80 ${
                              formData.Pengirim === d.name ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-800'
                            }`}
                          >
                            <span className="font-semibold">{d.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {d.count}x pengiriman
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Quick-pick pills (sering digunakan) */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-medium">Sering:</span>
                    {frequentDrivers.slice(0, 4).map(d => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, Pengirim: d.name }));
                          setIsDriverDropdownOpen(false);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition cursor-pointer border ${
                          formData.Pengirim === d.name
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-100 hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-200'
                        }`}
                        title={`Pilih ${d.name} (${d.count}x pengiriman)`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Tujuan Pengiriman</label>
                <input
                  type="text"
                  placeholder="Alamat tujuan pengiriman..."
                  value={formData.Tujuan}
                  onChange={e => setFormData({ ...formData, Tujuan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan Pengiriman</label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan (opsional)..."
                  value={formData.Keterangan}
                  onChange={e => setFormData({ ...formData, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none text-xs"
                />
              </div>

              {/* Rincian Produk Item */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">Rincian Barang yang Dimuat</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Tambah Produk</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <select
                        value={item.ID_Produk}
                        onChange={e => {
                          const pId = e.target.value;
                          const price = getProductPriceForCustomer(pId, formData.ID_Pelanggan);
                          const updated = [...formItems];
                          updated[idx] = { ...updated[idx], ID_Produk: pId, Harga_Satuan: price };
                          setFormItems(updated);
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white font-medium"
                      >
                        {products.map(p => (
                          <option key={p.ID_Produk} value={p.ID_Produk}>{p.Nama_Produk}</option>
                        ))}
                      </select>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="0"
                          value={item.Qty ?? ''}
                          onChange={e => {
                            const updated = [...formItems];
                            updated[idx].Qty = e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0);
                            setFormItems(updated);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono text-center font-bold"
                        />
                      </div>
                      <div className="w-28 text-right font-mono text-xs font-semibold text-slate-700">
                        @ Rp {Number(item.Harga_Satuan || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="w-28 text-right font-mono text-xs font-bold text-slate-900">
                        Rp {((Number(item.Qty) || 0) * (Number(item.Harga_Satuan) || 0)).toLocaleString('id-ID')}
                      </div>
                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rincian Total Tagihan & Keterangan Pengurangan Ambil Sendiri */}
              {(() => {
                const totalFormQty = formItems.reduce((acc, it) => acc + (Number(it.Qty) || 0), 0);
                const subtotalKotor = formItems.reduce((acc, it) => acc + ((Number(it.Qty) || 0) * (Number(it.Harga_Satuan) || 0)), 0);
                const isAmbilSendiri = formData.Metode_Kirim === 'Ambil Sendiri';
                const potonganAmbilSendiri = isAmbilSendiri ? (totalFormQty * 1000) : 0;
                const totalTagihanNetto = Math.max(0, subtotalKotor - potonganAmbilSendiri);

                return (
                  <div className="bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Subtotal Muatan Produk ({totalFormQty} Unit):</span>
                      <span className="font-mono font-bold text-slate-800">
                        Rp {subtotalKotor.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {isAmbilSendiri && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                            <span>Pengurangan Biaya (Ambil Sendiri):</span>
                          </span>
                          <span className="font-mono text-emerald-700">
                            - Rp {potonganAmbilSendiri.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-emerald-700 leading-relaxed">
                          Keterangan: Karena barang <strong>diambil sendiri</strong> langsung oleh pembeli di pabrik, sistem otomatis menerapkan potongan ongkos kirim sebesar <strong>Rp 1.000 / unit</strong> ({totalFormQty} unit × Rp 1.000 = Rp {potonganAmbilSendiri.toLocaleString('id-ID')}).
                        </p>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 block">
                          Jumlah Total yang Harus Dibayar:
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {isAmbilSendiri 
                            ? '* Total tagihan netto setelah dikurangi potongan ambil sendiri' 
                            : '* Total tagihan pengiriman armada pabrik'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold font-mono text-blue-700">
                          Rp {totalTagihanNetto.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Total Tagihan:</span>
                <span className="text-sm font-extrabold font-mono text-blue-700">
                  {(() => {
                    const totalFormQty = formItems.reduce((acc, it) => acc + (Number(it.Qty) || 0), 0);
                    const subtotalKotor = formItems.reduce((acc, it) => acc + ((Number(it.Qty) || 0) * (Number(it.Harga_Satuan) || 0)), 0);
                    const isAmbilSendiri = formData.Metode_Kirim === 'Ambil Sendiri';
                    const potonganAmbilSendiri = isAmbilSendiri ? (totalFormQty * 1000) : 0;
                    return `Rp ${Math.max(0, subtotalKotor - potonganAmbilSendiri).toLocaleString('id-ID')}`;
                  })()}
                </span>
                {formData.Metode_Kirim === 'Ambil Sendiri' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Potongan Rp 1.000/unit
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddDistModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
                <button onClick={handleSaveDistribution} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer">
                  {editingDist ? 'Simpan Perubahan' : 'Simpan & Terbitkan Surat Jalan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input Pesanan / Rencana Distribusi */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingPlan ? `Edit Pesanan: ${editingPlan.ID_Rencana}` : 'Input Rencana Distribusi (List Pesanan)'}
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Rencana Kirim</label>
                  <input
                    type="date"
                    value={planForm.Tanggal_Rencana}
                    onChange={e => setPlanForm({ ...planForm, Tanggal_Rencana: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Metode Pengiriman</label>
                  <select
                    value={planForm.Metode_Kirim}
                    onChange={e => setPlanForm({ ...planForm, Metode_Kirim: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  >
                    <option value="Kirim Armada">Kirim Armada Pabrik</option>
                    <option value="Ambil Sendiri">Ambil Sendiri</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pelanggan Pemesan</label>
                <select
                  value={planForm.ID_Pelanggan}
                  onChange={e => {
                    const c = customers.find(cust => cust.ID_Pelanggan === e.target.value);
                    setPlanForm({
                      ...planForm,
                      ID_Pelanggan: e.target.value,
                      Alamat_Tujuan: c?.Alamat || planForm.Alamat_Tujuan
                    });
                    // Auto-update harga sesuai level pelanggan baru
                    setPlanItems(prev => prev.map(item => ({
                      ...item,
                      Harga_Satuan: getProductPriceForCustomer(item.ID_Produk, e.target.value)
                    })));
                  }}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                >
                  {customers.map(c => (
                    <option key={c.ID_Pelanggan} value={c.ID_Pelanggan}>
                      {c.Nama_Pelanggan} ({c.Level_Pelanggan})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Tujuan</label>
                <input
                  type="text"
                  placeholder="Alamat tujuan..."
                  value={planForm.Alamat_Tujuan}
                  onChange={e => setPlanForm({ ...planForm, Alamat_Tujuan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sopir / Pengirim</label>
                <input
                  type="text"
                  list="plan-drivers-list-datalist"
                  placeholder="Nama sopir/pengirim..."
                  value={planForm.Sopir}
                  onChange={e => setPlanForm({ ...planForm, Sopir: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800 text-xs"
                />
                <datalist id="plan-drivers-list-datalist">
                  {frequentDrivers.map(d => (
                    <option key={d.name} value={d.name}>{d.name} ({d.count}x)</option>
                  ))}
                </datalist>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400 font-medium">Sering:</span>
                  {frequentDrivers.slice(0, 4).map(d => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => setPlanForm(prev => ({ ...prev, Sopir: d.name }))}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition cursor-pointer border ${
                        planForm.Sopir === d.name
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan</label>
                <input
                  type="text"
                  value={planForm.Keterangan}
                  onChange={e => setPlanForm({ ...planForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  placeholder="Opsional: catatan pesanan"
                />
              </div>

              {/* Rincian Produk Item - Dynamic Rows */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">Barang yang Dipesan</span>
                  <button
                    type="button"
                    onClick={handleAddPlanItemRow}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Tambah Produk</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {planItems.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <select
                        value={it.ID_Produk}
                        onChange={e => {
                          const pId = e.target.value;
                          const pr = getProductPriceForCustomer(pId, planForm.ID_Pelanggan);
                          const up = [...planItems];
                          up[idx] = { ...up[idx], ID_Produk: pId, Harga_Satuan: pr };
                          setPlanItems(up);
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white font-medium"
                      >
                        {products.map(p => (
                          <option key={p.ID_Produk} value={p.ID_Produk}>{p.Nama_Produk}</option>
                        ))}
                      </select>
                      <div className="w-24">
                        <input
                          type="number"
                          placeholder="0"
                          value={it.Qty ?? ''}
                          onChange={e => {
                            const up = [...planItems];
                            up[idx].Qty = e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0);
                            setPlanItems(up);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono text-center font-bold"
                        />
                      </div>
                      <div className="w-28 text-right font-mono text-xs font-semibold text-slate-700">
                        @ Rp {Number(it.Harga_Satuan || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="w-28 text-right font-mono text-xs font-bold text-slate-900">
                        Rp {((Number(it.Qty) || 0) * (Number(it.Harga_Satuan) || 0)).toLocaleString('id-ID')}
                      </div>
                      {planItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePlanItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Grand Total Pesanan */}
                <div className="mt-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">
                    Total Pesanan ({planItems.reduce((a, b) => a + (Number(b.Qty) || 0), 0)} unit)
                  </span>
                  <span className="text-sm font-black font-mono text-indigo-800">
                    Rp {planItems.reduce((a, b) => a + ((Number(b.Qty) || 0) * (Number(b.Harga_Satuan) || 0)), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowPlanModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
              <button onClick={handleSavePlan} className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer">
                {editingPlan ? 'Simpan Perubahan Pesanan' : 'Simpan ke Rencana Distribusi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Printable A4 Document (Surat Jalan / Invoice) */}
      {viewDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 printable-modal-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-900 text-white no-print border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                  <FileCheck size={16} className="text-emerald-400" />
                  <span>Preview Dokumen:</span>
                </div>
                {/* Switch between Invoice and Surat Jalan preview */}
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setViewDocModal({ ...viewDocModal, docType: 'inv' })}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      viewDocModal.docType === 'inv' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <FileText size={13} />
                    <span>Invoice</span>
                  </button>
                  <button
                    onClick={() => setViewDocModal({ ...viewDocModal, docType: 'sj' })}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      viewDocModal.docType === 'sj' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <FileCheck size={13} />
                    <span>Surat Jalan</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenDocSettings}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  title="Atur Kop Surat, Cap/Stempel, TTD & Info Penandatangan"
                >
                  <Settings size={14} className="text-amber-400" />
                  <span>Pengaturan Dokumen</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white shadow-xs cursor-pointer transition-colors"
                  title="Cetak Dokumen"
                >
                  <Printer size={14} />
                  <span>Cetak</span>
                </button>
                <button
                  onClick={() => {
                    if (viewDocModal.docType === 'inv') {
                      handleDownloadInvoicePDF(viewDocModal.dist, viewDocModal.items);
                    } else {
                      handleDownloadSuratJalanPDF(viewDocModal.dist, viewDocModal.items);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white shadow-xs cursor-pointer transition-colors"
                  title="Download File PDF"
                >
                  <FileDown size={14} />
                  <span>Download PDF</span>
                </button>
                <button 
                  onClick={() => {
                    const currentDist = viewDocModal.dist;
                    setViewDocModal(null);
                    setOpenDetailDist(currentDist);
                  }} 
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
                  title="Kembali ke Rincian Pengiriman"
                >
                  Kembali
                </button>
                <button 
                  onClick={() => setViewDocModal(null)} 
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                  title="Tutup Preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* A4 Paper Canvas */}
            <div className="p-6 sm:p-8 lg:p-10 font-sans text-slate-900 bg-white overflow-x-auto print:p-0 printable-content" style={{ minHeight: '650px' }}>
              {viewDocModal.docType === 'inv' ? (
                /* ============================================================== */
                /* EXACT REPLICA OF THE UPLOADED INVOICE TEMPLATE                 */
                /* ============================================================== */
                <div className="space-y-3.5 max-w-2xl mx-auto">
                  {/* Kop Surat Header (Custom upload or official banner) */}
                  {docSettings.useCustomKopImage && docSettings.customKopImage ? (
                    <img 
                      src={docSettings.customKopImage} 
                      alt="Kop Surat" 
                      className="w-full h-auto max-h-24 object-contain mb-1" 
                    />
                  ) : (
                    <KopSuratBanner className="w-full mb-1" />
                  )}

                  {/* Document Title: INVOICE with Blue Underline spanning across */}
                  <div className="text-center pt-0 border-b border-blue-600 pb-2">
                    <h2 className="text-xl font-black uppercase tracking-widest text-blue-600">
                      INVOICE
                    </h2>
                  </div>

                  {/* 2 Column Metadata with Aligned Colons */}
                  <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                    <div className="space-y-1">
                      <div className="grid grid-cols-[100px_10px_1fr]">
                        <span className="text-slate-800">Kepada</span>
                        <span>:</span>
                        <span className="font-bold text-slate-900 uppercase">{viewDocModal.dist.Nama_Pelanggan}</span>
                      </div>
                      <div className="grid grid-cols-[100px_10px_1fr]">
                        <span className="text-slate-800">Alamat</span>
                        <span>:</span>
                        <span className="text-slate-800 uppercase">{viewDocModal.dist.Tujuan}</span>
                      </div>
                      <div className="grid grid-cols-[100px_10px_1fr]">
                        <span className="text-slate-800">Jenis Konsumen</span>
                        <span>:</span>
                        <span className="text-slate-800">{viewDocModal.dist.Level_Pelanggan || 'Distributor'}</span>
                      </div>
                      <div className="grid grid-cols-[100px_10px_1fr]">
                        <span className="text-slate-800">No Surat Jalan</span>
                        <span>:</span>
                        <span className="font-mono text-slate-800">{viewDocModal.dist.No_Surat_Jalan}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="grid grid-cols-[110px_10px_1fr]">
                        <span className="text-slate-800">Tanggal Invoice</span>
                        <span>:</span>
                        <span className="font-mono text-slate-800">{formatDisplayDate(viewDocModal.dist.Tanggal)}</span>
                      </div>
                      <div className="grid grid-cols-[110px_10px_1fr]">
                        <span className="text-slate-800">No. Invoice</span>
                        <span>:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatInvoiceNumber(viewDocModal.dist.ID_Distribusi, viewDocModal.dist.Tanggal)}
                        </span>
                      </div>
                      <div className="grid grid-cols-[110px_10px_1fr]">
                        <span className="text-slate-800">Tanggal Kirim</span>
                        <span>:</span>
                        <span className="font-mono text-slate-800">{formatDisplayDate(viewDocModal.dist.Tanggal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="pt-2">
                    <table className="w-full text-xs border-collapse border border-black">
                      <thead>
                        <tr className="border-b border-black font-bold text-center bg-white">
                          <th className="border border-black p-2 w-10">No</th>
                          <th className="border border-black p-2 text-center">Nama Produk</th>
                          <th className="border border-black p-2 w-14">Qty</th>
                          <th className="border border-black p-2 w-20">Satuan</th>
                          <th className="border border-black p-2 w-32">Harga/satuan</th>
                          <th className="border border-black p-2 w-36">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black font-sans text-xs">
                        {viewDocModal.items.map((item, idx) => {
                          const prod = products.find(p => p.ID_Produk === item.ID_Produk || p.Nama_Produk === item.Nama_Produk);
                          const satuanStr = (prod?.Satuan?.toLowerCase().includes('galon') || item.Nama_Produk.toLowerCase().includes('galon')) ? 'Galon' : 'Karton';
                          return (
                            <tr key={idx} className="border-b border-black">
                              <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                              <td className="border border-black p-2 font-medium text-slate-900">{item.Nama_Produk}</td>
                              <td className="border border-black p-2 text-center font-mono font-bold">{item.Qty}</td>
                              <td className="border border-black p-2 text-center">{satuanStr}</td>
                              <td className="border border-black p-2 font-mono">
                                <div className="flex justify-between items-center px-1">
                                  <span>Rp</span>
                                  <span>{formatRupiahSen(item.Harga_Satuan)}</span>
                                </div>
                              </td>
                              <td className="border border-black p-2 font-mono font-semibold">
                                <div className="flex justify-between items-center px-1">
                                  <span>Rp</span>
                                  <span>{formatRupiahSen(item.Subtotal)}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Section (JUMLAH TAGIHAN, TOTAL, POTONGAN) */}
                  {(() => {
                    const subtotal = viewDocModal.items.reduce((sum, it) => sum + it.Subtotal, 0);
                    const totalQty = viewDocModal.items.reduce((sum, it) => sum + it.Qty, 0);
                    const discount = viewDocModal.dist.Metode_Kirim === 'Ambil Sendiri' ? totalQty * 1000 : 0;
                    const grandTotal = Math.max(0, subtotal - discount);

                    return (
                      <div className="pt-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div className="font-bold uppercase tracking-wider text-slate-900">
                            JUMLAH TAGIHAN
                          </div>

                          <div className="w-72 space-y-1.5 font-mono">
                            <div className="flex justify-between items-center">
                              <span className="font-bold font-sans">TOTAL</span>
                              <div className="flex justify-between w-40">
                                <span>Rp</span>
                                <span className="font-bold">{formatRupiahSen(subtotal)}</span>
                              </div>
                            </div>

                            {discount > 0 && (
                              <div>
                                <div className="flex justify-between items-center">
                                  <span className="font-bold font-sans">POTONGAN EKSPEDISI</span>
                                  <div className="flex justify-between w-40">
                                    <span>Rp</span>
                                    <span>{formatRupiahSen(discount)}</span>
                                  </div>
                                </div>
                                <div className="text-[10px] text-slate-500 font-sans">
                                  ({totalQty} Dus x Rp 1.000)
                                </div>
                              </div>
                            )}

                            <div className="border-t border-black pt-1.5 flex justify-between items-center text-sm font-bold text-slate-900">
                              <span></span>
                              <div className="flex justify-between w-40">
                                <span>Rp</span>
                                <span>{formatRupiahSen(grandTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Terbilang */}
                        <div className="pt-2 text-xs">
                          <p className="font-semibold text-slate-800">Terbilang :</p>
                          <p className="italic text-slate-800 text-[11px] mt-0.5">
                            {angkaKeTerbilang(grandTotal).toLowerCase()} rupiah
                          </p>
                        </div>

                        {/* Bottom Left: Payment & Bottom Right: Signature (Rapat ke atas pas di bawah text terbilang) */}
                        <div className="pt-2.5 flex justify-between items-end border-t border-slate-100 mt-1">
                          <div className="text-[11px] text-slate-700 space-y-1 max-w-[280px]">
                            <p>{docSettings.infoPembayaranTeks || 'pembayaran dapat memalui Transfer/Cash By Driver'}</p>
                            <p className="font-bold text-slate-900">{docSettings.bankRekening || 'BSI 1607134444 (BMT Syech Hasyim Asyari)'}</p>
                          </div>

                          <div className="text-center w-56 relative">
                            <p className="text-xs text-slate-800 mb-1">Hormat Kami,</p>

                            {/* Stamp & Signature Overlay */}
                            <div className="flex items-center justify-center my-0.5 select-none pointer-events-none relative h-20">
                              {/* Cap / Stempel */}
                              {docSettings.showCap && (
                                docSettings.useCustomCapImage && docSettings.customCapImage ? (
                                  <img 
                                    src={docSettings.customCapImage} 
                                    alt="Cap Stempel" 
                                    className="absolute left-4 top-0 w-20 h-20 object-contain" 
                                  />
                                ) : (
                                  <div className="absolute left-2 top-0 scale-90 origin-top-left">
                                    <OfficialStampWithSignature />
                                  </div>
                                )
                              )}

                              {/* TTD Custom jika ada */}
                              {docSettings.showTtd && docSettings.useCustomTtdImage && docSettings.customTtdImage && (
                                <img 
                                  src={docSettings.customTtdImage} 
                                  alt="Tanda Tangan" 
                                  className="absolute left-10 -top-1 w-28 h-20 object-contain z-10" 
                                />
                              )}

                              {/* TTD Default jika cap dimatikan tapi ttd aktif */}
                              {!docSettings.showCap && docSettings.showTtd && !docSettings.useCustomTtdImage && (
                                <div className="absolute left-10 -top-1 scale-90">
                                  <OfficialStampWithSignature />
                                </div>
                              )}
                            </div>

                            <p className="font-bold text-slate-900 text-xs mt-0.5">
                              {docSettings.namaPenandatangan || 'Marko Dwi Nugroho'}
                            </p>
                            <p className="text-[10px] text-slate-700 uppercase font-medium">
                              {docSettings.jabatanPenandatangan || docSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* ============================================================== */
                /* SURAT JALAN PENGIRIMAN TEMPLATE                                */
                /* ============================================================== */
                <div className="space-y-4 max-w-2xl mx-auto">
                  {docSettings.useCustomKopImage && docSettings.customKopImage ? (
                    <img 
                      src={docSettings.customKopImage} 
                      alt="Kop Surat" 
                      className="w-full h-auto max-h-24 object-contain mb-2" 
                    />
                  ) : (
                    <div className="text-center pb-3 border-b-2 border-slate-900">
                      <h1 className="text-xl font-black text-blue-900 tracking-wide uppercase">
                        {docSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                      </h1>
                      <p className="text-xs text-slate-600 font-medium">
                        {docSettings.subNamaPerusahaan || 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {docSettings.alamatPerusahaan || 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara'} • Telp: {docSettings.kontakPerusahaan || '(0272) 898123'}
                      </p>
                    </div>
                  )}

                  <div className="text-center my-2">
                    <h2 className="text-base font-black underline uppercase tracking-widest text-slate-900">
                      SURAT JALAN PENGIRIMAN
                    </h2>
                    <p className="text-xs font-mono font-semibold text-slate-600 mt-0.5">
                      No: {viewDocModal.dist.No_Surat_Jalan}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="space-y-1">
                      <div><span className="text-slate-500 inline-block w-24">Tanggal Kirim:</span><span className="font-semibold font-mono">{formatDisplayDate(viewDocModal.dist.Tanggal)}</span></div>
                      <div><span className="text-slate-500 inline-block w-24">Pengemudi/PIC:</span><span className="font-semibold">{viewDocModal.dist.Pengirim || '-'}</span></div>
                      <div><span className="text-slate-500 inline-block w-24">Metode Kirim:</span><span className="font-semibold">{viewDocModal.dist.Metode_Kirim}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div><span className="text-slate-500 inline-block w-24">Kepada Yth:</span><span className="font-bold text-blue-900">{viewDocModal.dist.Nama_Pelanggan}</span></div>
                      <div><span className="text-slate-500 inline-block w-24">Alamat Tujuan:</span><span className="font-medium text-slate-700">{viewDocModal.dist.Tujuan}</span></div>
                      <div><span className="text-slate-500 inline-block w-24">Jenis Mitra:</span><span className="font-semibold">{viewDocModal.dist.Level_Pelanggan || 'Distributor'}</span></div>
                    </div>
                  </div>

                  <table className="w-full text-xs border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold text-center border-b border-slate-400">
                        <th className="border border-slate-400 p-2 w-12">No</th>
                        <th className="border border-slate-400 p-2 text-left">Nama Barang / Produk</th>
                        <th className="border border-slate-400 p-2 w-28 text-center">Jumlah Terkirim</th>
                        <th className="border border-slate-400 p-2 w-24 text-center">Satuan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDocModal.items.map((item, idx) => {
                        const prod = products.find(p => p.ID_Produk === item.ID_Produk || p.Nama_Produk === item.Nama_Produk);
                        const satuanStr = (prod?.Satuan?.toLowerCase().includes('galon') || item.Nama_Produk.toLowerCase().includes('galon')) ? 'Galon' : 'Karton';
                        return (
                          <tr key={idx} className="border-b border-slate-300">
                            <td className="border border-slate-300 p-2.5 text-center font-mono">{idx + 1}</td>
                            <td className="border border-slate-300 p-2.5 font-medium">{item.Nama_Produk}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-mono font-bold text-blue-800">{item.Qty}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-mono">
                              {satuanStr}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {viewDocModal.dist.Keterangan && (
                    <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900">
                      <strong>Catatan:</strong> {viewDocModal.dist.Keterangan}
                    </div>
                  )}

                  <div className="grid grid-cols-3 text-center text-xs pt-8 border-t border-slate-200 mt-6">
                    <div>
                      <p className="text-slate-500 mb-14">Penerima Barang,</p>
                      <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[120px]">( {viewDocModal.dist.Penerima || '.....................'} )</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-14">Sopir / Pengirim,</p>
                      <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[120px]">( {viewDocModal.dist.Pengirim || 'Armada Pabrik'} )</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-14">Petugas Gudang,</p>
                      <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[120px]">Admin Gudang</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ============================================================== */}
      {/* MODAL PENGATURAN DOKUMEN (KOP, CAP, TTD, & PENANDATANGAN)      */}
      {/* ============================================================== */}
      {showDocSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Settings className="text-amber-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Pengaturan Dokumen (Kop Surat, Cap, TTD & Penandatangan)
                </h3>
              </div>
              <button 
                onClick={() => setShowDocSettingsModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
              {/* Section 1: Data Identitas Perusahaan */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  1. Informasi Perusahaan / Header Dokumen
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan</label>
                    <input
                      type="text"
                      value={tempDocSettings.namaPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, namaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-medium"
                      placeholder="PT. ANUGERAH ILLAHI RABBI"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sub-Nama / Brand</label>
                    <input
                      type="text"
                      value={tempDocSettings.subNamaPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, subNamaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Perusahaan</label>
                    <input
                      type="text"
                      value={tempDocSettings.alamatPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, alamatPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Telp / Kontak</label>
                    <input
                      type="text"
                      value={tempDocSettings.kontakPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, kontakPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="(0272) 898123"
                    />
                  </div>
                </div>

                {/* Upload Gambar Kop Surat Custom */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Image size={14} className="text-blue-600" />
                      <span>Gambar Banner Kop Surat Custom (Opsional)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 font-medium">
                      <input
                        type="checkbox"
                        checked={tempDocSettings.useCustomKopImage}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, useCustomKopImage: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Gunakan Gambar Custom</span>
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressUploadedImage(file, 1000, 155);
                          setTempDocSettings({
                            ...tempDocSettings,
                            customKopImage: compressed,
                            useCustomKopImage: true
                          });
                        }
                      }}
                      className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    {tempDocSettings.customKopImage && (
                      <button
                        type="button"
                        onClick={() => setTempDocSettings({ ...tempDocSettings, customKopImage: '', useCustomKopImage: false })}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus Gambar
                      </button>
                    )}
                  </div>
                  {tempDocSettings.customKopImage && (
                    <div className="mt-2 p-1.5 bg-white border border-slate-200 rounded-lg max-h-16 overflow-hidden flex items-center">
                      <img src={tempDocSettings.customKopImage} alt="Preview Kop" className="h-12 object-contain mx-auto" />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Penandatangan & Stempel / Cap */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  2. Tanda Tangan, Cap / Stempel, & Nama Penandatangan
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Penandatangan</label>
                    <input
                      type="text"
                      value={tempDocSettings.namaPenandatangan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, namaPenandatangan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-semibold"
                      placeholder="Marko Dwi Nugroho"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jabatan / Keterangan di Bawah Nama</label>
                    <input
                      type="text"
                      value={tempDocSettings.jabatanPenandatangan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, jabatanPenandatangan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="PT. ANUGERAH ILLAHI RABBI"
                    />
                  </div>
                </div>

                {/* TTD Settings */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>Gambar Tanda Tangan (TTD)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={tempDocSettings.showTtd}
                          onChange={e => setTempDocSettings({ ...tempDocSettings, showTtd: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Tampilkan TTD</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={tempDocSettings.useCustomTtdImage}
                          onChange={e => setTempDocSettings({ ...tempDocSettings, useCustomTtdImage: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Gunakan Custom</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressUploadedImage(file, 400, 300);
                          setTempDocSettings({
                            ...tempDocSettings,
                            customTtdImage: compressed,
                            useCustomTtdImage: true,
                            showTtd: true
                          });
                        }
                      }}
                      className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                    {tempDocSettings.customTtdImage && (
                      <button
                        type="button"
                        onClick={() => setTempDocSettings({ ...tempDocSettings, customTtdImage: '', useCustomTtdImage: false })}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus TTD Custom
                      </button>
                    )}
                  </div>
                  {tempDocSettings.customTtdImage && (
                    <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded max-h-16 flex items-center">
                      <img src={tempDocSettings.customTtdImage} alt="TTD Custom" className="h-12 object-contain" />
                    </div>
                  )}
                </div>

                {/* Cap / Stempel Settings */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>Gambar Cap / Stempel Perusahaan</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={tempDocSettings.showCap}
                          onChange={e => setTempDocSettings({ ...tempDocSettings, showCap: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Tampilkan Cap</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={tempDocSettings.useCustomCapImage}
                          onChange={e => setTempDocSettings({ ...tempDocSettings, useCustomCapImage: e.target.checked })}
                          className="rounded text-blue-600"
                        />
                        <span>Gunakan Custom</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const compressed = await compressUploadedImage(file, 300, 300);
                          setTempDocSettings({
                            ...tempDocSettings,
                            customCapImage: compressed,
                            useCustomCapImage: true,
                            showCap: true
                          });
                        }
                      }}
                      className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                    {tempDocSettings.customCapImage && (
                      <button
                        type="button"
                        onClick={() => setTempDocSettings({ ...tempDocSettings, customCapImage: '', useCustomCapImage: false })}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus Cap Custom
                      </button>
                    )}
                  </div>
                  {tempDocSettings.customCapImage && (
                    <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded max-h-16 flex items-center">
                      <img src={tempDocSettings.customCapImage} alt="Cap Custom" className="h-12 object-contain" />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Informasi Pembayaran & Rekening */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  3. Informasi Pembayaran Invoice
                </h4>

                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Teks Informasi Pembayaran</label>
                    <input
                      type="text"
                      value={tempDocSettings.infoPembayaranTeks}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, infoPembayaranTeks: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="pembayaran dapat memalui Transfer/Cash By Driver"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank & Nomor Rekening Tujuan</label>
                    <input
                      type="text"
                      value={tempDocSettings.bankRekening}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, bankRekening: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-mono font-bold text-slate-800"
                      placeholder="BSI 1607134444 (BMT Syech Hasyim Asyari)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetDocSettings}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset ke Standar Pabrik</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocSettingsModal(false)}
                  className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveDocSettings}
                  className="px-5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
