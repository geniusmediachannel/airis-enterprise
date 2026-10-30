import React, { useState, useMemo } from 'react';
import { 
  Factory, Plus, Play, CheckCircle2, Printer, 
  Download, Calendar, Clock, User, ChevronRight, X, AlertTriangle,
  Edit2, Trash2, Upload, FileSpreadsheet, BarChart2, FileText,
  FileDown, Filter, TrendingUp, Boxes, Package, PieChart, Search,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  SPKItem, ProductionItem, ProductItem, BOMItem, 
  RawMaterialItem, RawMaterialMutation, EmployeeItem 
} from '../types';
import { getTableData, setTableData, deleteTableRow } from '../services/dbAdapter';
import { exportDataToExcel } from '../services/excelService';
import { showToast } from './ToastContainer';
import { confirmAction } from './ConfirmDialog';
import { formatDateDDMMYYYY } from '../services/formatters';
import { 
  generateSPKPDF, 
  generateTableReportPDF, 
  generateProductionReportPDF, 
  generateAnnualProductionReportPDF 
} from '../services/pdfService';

// Konversi tanggal fleksibel ke timestamp numerik untuk sorting akurat
const toComparableDate = (dateStr?: string | number): number => {
  if (!dateStr && dateStr !== 0) return 0;
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

interface ProductionViewProps {
  spks: SPKItem[];
  productions: ProductionItem[];
  products: ProductItem[];
  boms: BOMItem[];
  rawMaterials: RawMaterialItem[];
  onRefresh: () => void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  spks,
  productions,
  products,
  boms,
  rawMaterials,
  onRefresh
}) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = String(now.getFullYear());
  
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth);
  const [searchQueryProd, setSearchQueryProd] = useState<string>('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('ALL');
  const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [showSpkModal, setShowSpkModal] = useState(false);
  const [editingSpk, setEditingSpk] = useState<SPKItem | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showDetailSpkModal, setShowDetailSpkModal] = useState<SPKItem | null>(null);
  const [viewSpkDocModal, setViewSpkDocModal] = useState<SPKItem | null>(null);
  const [editingProd, setEditingProd] = useState<ProductionItem | null>(null);
  const [showEditProdModal, setShowEditProdModal] = useState(false);

  // LAPORAN PRODUKSI MODAL (2 TABS: BULANAN & TAHUNAN)
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTab, setReportTab] = useState<'bulanan' | 'tahunan'>('bulanan');
  const [reportFilterType, setReportFilterType] = useState<'bulan' | 'tahun' | 'seluruh'>('bulan');
  const [reportMonth, setReportMonth] = useState<string>(currentMonth);
  const [reportYear, setReportYear] = useState<string>(currentYear);

  // Forms
  const [spkForm, setSpkForm] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    Shift: 'Shift 1 (Pagi)',
    ID_Produk: products[0]?.ID_Produk || 'ASH-CUP220',
    Target_Produksi: '' as any,
    Keterangan: ''
  });

  const [activeFinishItem, setActiveFinishItem] = useState<ProductionItem | null>(null);
  const [finishActualQty, setFinishActualQty] = useState<number | string>('');
  const [finishPic, setFinishPic] = useState<string>('');

  const [editProdForm, setEditProdForm] = useState({
    ID_Produksi: '',
    Tanggal: '',
    Shift: '',
    ID_Produk: '',
    Jumlah: '' as any,
    PIC_Produksi: '',
    Keterangan: ''
  });

  // Master Karyawan for PIC Operator Dropdown
  const employees = getTableData<EmployeeItem>('MD_Karyawan', []);
  const productionEmployees = employees.filter(e => e.Departemen === 'Produksi' && e.Status === 'Aktif');
  const otherActiveEmployees = employees.filter(e => e.Departemen !== 'Produksi' && e.Status === 'Aktif');

  // Direct Production Modal & Form
  const [showDirectProdModal, setShowDirectProdModal] = useState(false);
  const [directProdForm, setDirectProdForm] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    Shift: 'Shift 1 (Pagi)',
    ID_Produk: products[0]?.ID_Produk || 'ASH-CUP220',
    Jumlah: '' as any,
    PIC_Produksi: '',
    ID_SPK: '',
    Keterangan: ''
  });

  // Open Direct Production Modal
  const handleOpenDirectProd = (preselectedSpk?: SPKItem) => {
    const defaultPic = productionEmployees[0]?.Nama_Karyawan || otherActiveEmployees[0]?.Nama_Karyawan || 'Agus Setiawan';
    setDirectProdForm({
      Tanggal: preselectedSpk?.Tanggal || new Date().toISOString().slice(0, 10),
      Shift: preselectedSpk?.Shift || 'Shift 1 (Pagi)',
      ID_Produk: preselectedSpk?.ID_Produk || products[0]?.ID_Produk || 'ASH-CUP220',
      Jumlah: preselectedSpk?.Target_Produksi ?? ('' as any),
      PIC_Produksi: defaultPic,
      ID_SPK: preselectedSpk?.ID_SPK || '',
      Keterangan: preselectedSpk ? `Realisasi SPK: ${preselectedSpk.ID_SPK}` : ''
    });
    setShowDirectProdModal(true);
  };

  const handleSelectSpkForDirect = (spkId: string) => {
    if (!spkId) {
      setDirectProdForm(prev => ({ ...prev, ID_SPK: '' }));
      return;
    }
    const selectedSpk = spks.find(s => s.ID_SPK === spkId);
    if (selectedSpk) {
      setDirectProdForm(prev => ({
        ...prev,
        ID_SPK: spkId,
        ID_Produk: selectedSpk.ID_Produk || prev.ID_Produk,
        Tanggal: selectedSpk.Tanggal || prev.Tanggal,
        Shift: selectedSpk.Shift || prev.Shift,
        Jumlah: selectedSpk.Target_Produksi || prev.Jumlah
      }));
    }
  };

  const handleSaveDirectProd = () => {
    if (!directProdForm.Jumlah || Number(directProdForm.Jumlah) <= 0) {
      showToast('Jumlah Belum Diisi', 'Silakan masukkan jumlah hasil produksi yang valid.', 'warning');
      return;
    }

    const currentProds = getTableData<ProductionItem>('Produksi', []);
    const d = new Date(directProdForm.Tanggal);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const prefix = `PRD-${day}${mon}${yy}`;
    const count = currentProds.filter(p => p.ID_Produksi.startsWith(prefix)).length;
    const newProdId = `${prefix}${String(count + 1).padStart(2, '0')}`;

    const newProd: ProductionItem = {
      ID_Produksi: newProdId,
      Tanggal: directProdForm.Tanggal,
      Shift: directProdForm.Shift,
      ID_Produk: directProdForm.ID_Produk,
      Jumlah: Number(directProdForm.Jumlah),
      PIC_Produksi: directProdForm.PIC_Produksi || 'Agus Setiawan',
      Keterangan: directProdForm.ID_SPK
        ? `Realisasi SPK: ${directProdForm.ID_SPK} ${directProdForm.Keterangan && !directProdForm.Keterangan.includes('Realisasi SPK') ? '- ' + directProdForm.Keterangan : ''}`
        : (directProdForm.Keterangan || 'Input Produksi Langsung')
    };

    // Consume Raw Materials based on BOM
    const relatedBoms = boms.filter(b => b.ID_Produk === directProdForm.ID_Produk);
    const currentMutations = getTableData<RawMaterialMutation>('Mutasi_Bahan', []);
    const newMutations: RawMaterialMutation[] = [];

    relatedBoms.forEach(b => {
      const needed = Number(directProdForm.Jumlah) * (Number(b.Jumlah_Dibutuhkan) || 0);
      const rawMat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
      const mutationId = `MT-PRD-${Date.now().toString().slice(-6)}-${b.ID_Bahan}`;
      newMutations.push({
        ID_Mutasi: mutationId,
        Tanggal: directProdForm.Tanggal,
        ID_Bahan: b.ID_Bahan,
        Nama_Bahan: rawMat?.Nama_Bahan || b.ID_Bahan,
        Jenis_Mutasi: 'Keluar',
        Kategori: 'Pemakaian Produksi',
        Qty: needed,
        Keterangan: `Pemotongan Otomatis Produksi: ${newProdId}`
      });
    });

    if (newMutations.length > 0) {
      setTableData('Mutasi_Bahan', [...currentMutations, ...newMutations]);
    }

    if (directProdForm.ID_SPK) {
      const currentSpks = getTableData<SPKItem>('SPK', []);
      const updatedSpks = currentSpks.map(s => s.ID_SPK === directProdForm.ID_SPK ? { ...s, Status: 'Selesai' as const } : s);
      setTableData('SPK', updatedSpks);
    }

    setTableData('Produksi', [...currentProds, newProd]);
    setShowDirectProdModal(false);
    onRefresh();
    showToast(
      'Produksi Berhasil Dicatat',
      `Produksi ${newProdId} (${directProdForm.Jumlah} unit) berhasil disimpan & stok bahan penolong terpotong.`,
      'success'
    );
  };

  // Open Create SPK
  const handleOpenAddSpk = () => {
    setEditingSpk(null);
    setSpkForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      Shift: 'Shift 1 (Pagi)',
      ID_Produk: products[0]?.ID_Produk || 'ASH-CUP220',
      Target_Produksi: '' as any,
      Keterangan: ''
    });
    setShowSpkModal(true);
  };

  // Open Edit SPK
  const handleOpenEditSpk = (spk: SPKItem) => {
    setEditingSpk(spk);
    setSpkForm({
      Tanggal: spk.Tanggal,
      Shift: spk.Shift,
      ID_Produk: spk.ID_Produk,
      Target_Produksi: spk.Target_Produksi,
      Keterangan: spk.Keterangan
    });
    setShowSpkModal(true);
  };

  // Delete SPK
  const handleDeleteSpk = async (id: string) => {
    const ok = await confirmAction({
      title: 'Hapus Rencana SPK',
      message: `Hapus rencana SPK ${id}? Perintah kerja ini akan dibatalkan dan dihapus permanen dari database.`,
      confirmText: 'Ya, Hapus SPK',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;

    const res = await deleteTableRow('SPK', id);
    setShowDetailSpkModal(null);
    onRefresh();

    if (res.cloudError) {
      showToast('Peringatan Database', `SPK ${id} terhapus di aplikasi, namun gagal di database: ${res.cloudError}`, 'warning');
    } else {
      showToast('SPK Dihapus', `Rencana SPK ${id} telah dihapus dari sistem & database.`, 'info');
    }
  };

  // Print SPK
  const handlePrintSPK = (spk: SPKItem) => {
    const prod = products.find(p => p.ID_Produk === spk.ID_Produk);
    const relatedBoms = boms.filter(b => b.ID_Produk === spk.ID_Produk);
    const bomItems = relatedBoms.map(b => {
      const mat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
      return {
        bahan: mat?.Nama_Bahan || b.ID_Bahan,
        kebutuhan: spk.Target_Produksi * (Number(b.Jumlah_Dibutuhkan) || 0),
        satuan: b.Satuan
      };
    });

    generateSPKPDF({
      idSpk: spk.ID_SPK,
      tanggal: spk.Tanggal,
      shift: spk.Shift,
      namaProduk: prod?.Nama_Produk || spk.ID_Produk,
      targetProduksi: spk.Target_Produksi,
      keterangan: spk.Keterangan,
      bomItems
    });
  };

  // Save SPK (Add or Edit)
  const handleSaveSPK = () => {
    const currentSpks = getTableData<SPKItem>('SPK', []);
    if (editingSpk) {
      const updated = currentSpks.map(s => s.ID_SPK === editingSpk.ID_SPK ? {
        ...s,
        Tanggal: spkForm.Tanggal,
        Shift: spkForm.Shift,
        ID_Produk: spkForm.ID_Produk,
        Target_Produksi: Number(spkForm.Target_Produksi) || 0,
        Keterangan: spkForm.Keterangan
      } : s);
      setTableData('SPK', updated);
    } else {
      const d = new Date(spkForm.Tanggal);
      const day = String(d.getDate()).padStart(2, '0');
      const mon = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      const prefix = `SPK-${day}${mon}${yy}`;
      const count = currentSpks.filter(s => s.ID_SPK.startsWith(prefix)).length;
      const newId = `${prefix}${String(count + 1).padStart(2, '0')}`;

      const newSPK: SPKItem = {
        ID_SPK: newId,
        Tanggal: spkForm.Tanggal,
        Shift: spkForm.Shift,
        ID_Produk: spkForm.ID_Produk,
        Target_Produksi: Number(spkForm.Target_Produksi) || 0,
        Keterangan: spkForm.Keterangan,
        Status: 'Aktif'
      };
      setTableData('SPK', [...currentSpks, newSPK]);
    }
    setShowSpkModal(false);
    onRefresh();
    showToast('SPK Disimpan', 'Surat Perintah Kerja produksi berhasil dicatat.', 'info');
  };

  // Start Production from SPK
  const handleStartProductionFromSPK = (spk: SPKItem) => {
    const currentProds = getTableData<ProductionItem>('Produksi', []);
    const currentSpks = getTableData<SPKItem>('SPK', []);
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const prefix = `PRD-${day}${mon}${yy}`;
    const count = currentProds.filter(p => p.ID_Produksi.startsWith(prefix)).length;
    const newProdId = `${prefix}${String(count + 1).padStart(2, '0')}`;

    const newProd: ProductionItem = {
      ID_Produksi: newProdId,
      Tanggal: spk.Tanggal,
      Shift: spk.Shift,
      ID_Produk: spk.ID_Produk,
      Jumlah: 0,
      PIC_Produksi: productionEmployees[0]?.Nama_Karyawan || otherActiveEmployees[0]?.Nama_Karyawan || 'Agus Setiawan',
      Keterangan: `Realisasi SPK: ${spk.ID_SPK}`
    };

    const updatedSpks = currentSpks.map(s => s.ID_SPK === spk.ID_SPK ? { ...s, Status: 'Diproses' as const } : s);
    setTableData('SPK', updatedSpks);
    setTableData('Produksi', [...currentProds, newProd]);
    setShowDetailSpkModal(null);
    onRefresh();
  };

  // Finish Ongoing Production
  const handleCompleteProduction = () => {
    if (!activeFinishItem || finishActualQty <= 0) return;
    const currentProds = getTableData<ProductionItem>('Produksi', []);
    const updatedProds = currentProds.map(p => 
      p.ID_Produksi === activeFinishItem.ID_Produksi 
        ? { ...p, Jumlah: Number(finishActualQty), PIC_Produksi: finishPic }
        : p
    );
    setTableData('Produksi', updatedProds);

    // Consume Raw Materials based on BOM
    const relatedBoms = boms.filter(b => b.ID_Produk === activeFinishItem.ID_Produk);
    const currentMutations = getTableData<RawMaterialMutation>('Mutasi_Bahan', []);
    const newMutations: RawMaterialMutation[] = [];

    relatedBoms.forEach(b => {
      const needed = Number(finishActualQty) * (Number(b.Jumlah_Dibutuhkan) || 0);
      const rawMat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
      const mutationId = `MT-PRD-${Date.now().toString().slice(-6)}-${b.ID_Bahan}`;
      newMutations.push({
        ID_Mutasi: mutationId,
        Tanggal: activeFinishItem.Tanggal,
        ID_Bahan: b.ID_Bahan,
        Nama_Bahan: rawMat?.Nama_Bahan || b.ID_Bahan,
        Jenis_Mutasi: 'Keluar',
        Kategori: 'Pemakaian Produksi',
        Qty: needed,
        Keterangan: `Pemotongan Otomatis Produksi: ${activeFinishItem.ID_Produksi}`
      });
    });

    if (newMutations.length > 0) {
      setTableData('Mutasi_Bahan', [...currentMutations, ...newMutations]);
    }

    if (activeFinishItem.Keterangan.includes('Realisasi SPK:')) {
      const spkId = activeFinishItem.Keterangan.split('Realisasi SPK:')[1]?.trim();
      if (spkId) {
        const currentSpks = getTableData<SPKItem>('SPK', []);
        const updatedSpks = currentSpks.map(s => s.ID_SPK === spkId ? { ...s, Status: 'Selesai' as const } : s);
        setTableData('SPK', updatedSpks);
      }
    }

    setShowFinishModal(false);
    setActiveFinishItem(null);
    onRefresh();
    showToast(
      'Produksi Berhasil Dicatat', 
      `Produksi ${activeFinishItem.ID_Produksi} (${finishActualQty} unit) berhasil disimpan & stok bahan terpotong.`, 
      'success'
    );
  };

  // Open Edit Finished Production
  const handleOpenEditProd = (prod: ProductionItem) => {
    setEditingProd(prod);
    setEditProdForm({
      ID_Produksi: prod.ID_Produksi,
      Tanggal: prod.Tanggal,
      Shift: prod.Shift,
      ID_Produk: prod.ID_Produk,
      Jumlah: prod.Jumlah,
      PIC_Produksi: prod.PIC_Produksi,
      Keterangan: prod.Keterangan
    });
    setShowEditProdModal(true);
  };

  // Save Edit Finished Production
  const handleSaveEditProd = () => {
    if (!editingProd) return;
    const currentProds = getTableData<ProductionItem>('Produksi', []);
    const updated = currentProds.map(p => p.ID_Produksi === editingProd.ID_Produksi ? {
      ...p,
      Tanggal: editProdForm.Tanggal,
      Shift: editProdForm.Shift,
      ID_Produk: editProdForm.ID_Produk,
      Jumlah: Number(editProdForm.Jumlah) || 0,
      PIC_Produksi: editProdForm.PIC_Produksi,
      Keterangan: editProdForm.Keterangan
    } : p);
    setTableData('Produksi', updated);
    setShowEditProdModal(false);
    setEditingProd(null);
    onRefresh();
  };

  // Delete Finished Production
  const handleDeleteProd = async (id: string) => {
    const ok = await confirmAction({
      title: 'Hapus Catatan Produksi',
      message: `Hapus catatan hasil produksi ${id}? Data akan dihapus permanen dari database.`,
      confirmText: 'Ya, Hapus Data',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;

    const res = await deleteTableRow('Produksi', id);
    onRefresh();

    if (res.cloudError) {
      showToast('Peringatan Database', `Produksi ${id} terhapus di aplikasi, namun gagal di database: ${res.cloudError}`, 'warning');
    } else {
      showToast('Produksi Dihapus', `Catatan produksi ${id} telah dihapus dari sistem & database.`, 'info');
    }
  };

  const filteredProductions = useMemo(() => {
    const list = productions.filter(p => {
      const qty = Number(p.Jumlah);
      const isPeriodMatch = Boolean(p.Tanggal && typeof p.Tanggal === 'string' && p.Tanggal.startsWith(filterMonth) && !isNaN(qty) && qty > 0);
      if (!isPeriodMatch) return false;

      // Filter Produk Tertentu
      if (selectedProductFilter !== 'ALL' && p.ID_Produk !== selectedProductFilter) {
        return false;
      }

      // Filter Pencarian Teks
      if (searchQueryProd.trim()) {
        const q = searchQueryProd.toLowerCase();
        const prod = products.find(pr => pr.ID_Produk === p.ID_Produk);
        const matchId = String(p.ID_Produksi || '').toLowerCase().includes(q);
        const matchSpk = String(p.ID_SPK || '').toLowerCase().includes(q);
        const matchProdName = String(prod?.Nama_Produk || '').toLowerCase().includes(q);
        const matchPic = String(p.PIC_Produksi || '').toLowerCase().includes(q);
        const matchShift = String(p.Shift || '').toLowerCase().includes(q);
        const matchKet = String(p.Keterangan || '').toLowerCase().includes(q);
        return matchId || matchSpk || matchProdName || matchPic || matchShift || matchKet;
      }

      return true;
    });

    return list.slice().sort((a, b) => {
      // 1. Primary: Tanggal
      const timeA = toComparableDate(a.Tanggal);
      const timeB = toComparableDate(b.Tanggal);
      if (timeA !== timeB) {
        return dateSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }

      // 2. Secondary: Shift (Shift 1, Shift 2, Shift 3)
      const shiftVal = (s?: string) => {
        if (!s) return 0;
        if (s.includes('1') || s.toLowerCase().includes('pagi')) return 1;
        if (s.includes('2') || s.toLowerCase().includes('siang')) return 2;
        if (s.includes('3') || s.toLowerCase().includes('malam')) return 3;
        return 4;
      };
      const shiftA = shiftVal(a.Shift);
      const shiftB = shiftVal(b.Shift);
      if (shiftA !== shiftB) {
        return dateSortOrder === 'desc' ? shiftB - shiftA : shiftA - shiftB;
      }

      // 3. Tertiary: ID_Produksi
      return dateSortOrder === 'desc'
        ? String(b.ID_Produksi || '').localeCompare(String(a.ID_Produksi || ''), undefined, { numeric: true })
        : String(a.ID_Produksi || '').localeCompare(String(b.ID_Produksi || ''), undefined, { numeric: true });
    });
  }, [productions, filterMonth, selectedProductFilter, searchQueryProd, products, dateSortOrder]);
  const activeOngoingProds = productions.filter(p => !p.Jumlah || Number(p.Jumlah) === 0);
  const activeSpks = spks.filter(s => s.Status !== 'Selesai' && s.Status !== 'Diproses');

  // ==============================================================
  // DATA PERHITUNGAN LAPORAN PRODUKSI (BULANAN & TAHUNAN)
  // ==============================================================
  const getFilteredReportData = () => {
    return productions.filter(p => {
      const qty = Number(p.Jumlah);
      if (isNaN(qty) || qty <= 0) return false;
      const tgl = String(p.Tanggal || '');
      if (reportFilterType === 'bulan') {
        return tgl.startsWith(reportMonth);
      }
      if (reportFilterType === 'tahun') {
        return tgl.startsWith(reportYear);
      }
      return true; // seluruhnya
    });
  };

  const reportDataset = getFilteredReportData();

  // Annual data per month (Jan-Des) per product
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const annualReportByProduct: Record<string, number[]> = {};
  products.forEach(prod => {
    annualReportByProduct[prod.ID_Produk] = new Array(12).fill(0);
  });
  const annualTotalMonthly = new Array(12).fill(0);

  productions.forEach(p => {
    const qty = Number(p.Jumlah);
    if (!isNaN(qty) && qty > 0 && p.Tanggal) {
      const dt = new Date(p.Tanggal);
      if (!isNaN(dt.getTime())) {
        const yr = String(dt.getFullYear());
        if (reportFilterType === 'seluruh' || yr === reportYear) {
          const mIdx = dt.getMonth();
          if (mIdx >= 0 && mIdx < 12) {
            if (p.ID_Produk && annualReportByProduct[p.ID_Produk]) {
              annualReportByProduct[p.ID_Produk][mIdx] += qty;
            }
            annualTotalMonthly[mIdx] += qty;
          }
        }
      }
    }
  });

  const maxAnnualVal = Math.max(...annualTotalMonthly, 100);
  const totalReportAllQty = reportDataset.reduce((s, p) => s + (Number(p.Jumlah) || 0), 0);
  const totalAnnualAllQty = annualTotalMonthly.reduce((a, b) => a + b, 0);

  // Per-product calculation for selected period
  const reportProductSummary = products.map(prod => {
    const matched = reportDataset.filter(p => p.ID_Produk === prod.ID_Produk);
    const totalQty = matched.reduce((sum, p) => sum + (Number(p.Jumlah) || 0), 0);
    const batchCount = matched.length;
    const percentage = totalReportAllQty > 0 ? Math.round((totalQty / totalReportAllQty) * 100) : 0;
    return {
      product: prod,
      totalQty,
      batchCount,
      percentage,
      satuan: prod.Satuan || 'Dus',
      kategori: prod.Kategori
    };
  });

  // Annual per-product total
  const annualProductSummary = products.map(prod => {
    const rowVals = annualReportByProduct[prod.ID_Produk] || new Array(12).fill(0);
    const totalAnnualQty = rowVals.reduce((a, b) => a + b, 0);
    const percentage = totalAnnualAllQty > 0 ? Math.round((totalAnnualQty / totalAnnualAllQty) * 100) : 0;
    return {
      product: prod,
      totalAnnualQty,
      percentage,
      monthlyBreakdown: rowVals,
      satuan: prod.Satuan || 'Dus'
    };
  });

  // PDF Export for Production Report (Matches exact application UI layout)
  const handleExportReportPDF = () => {
    if (reportTab === 'bulanan') {
      generateProductionReportPDF({
        periode: reportFilterType === 'bulan' ? reportMonth : reportFilterType === 'tahun' ? reportYear : 'Seluruh Waktu',
        totalOutput: totalReportAllQty,
        totalBatch: reportDataset.length,
        rataRataBatch: reportDataset.length > 0 ? Math.round(totalReportAllQty / reportDataset.length) : 0,
        productSummary: reportProductSummary.map(ps => ({
          id: ps.product.ID_Produk,
          nama: ps.product.Nama_Produk,
          kategori: ps.kategori,
          satuan: ps.satuan,
          batchCount: ps.batchCount,
          totalQty: ps.totalQty,
          percentage: ps.percentage
        })),
        batchLogs: reportDataset.map(p => {
          const pr = products.find(prod => prod.ID_Produk === p.ID_Produk);
          return {
            tanggal: p.Tanggal,
            idBatch: p.ID_Produksi,
            shift: p.Shift,
            namaProduk: pr?.Nama_Produk || p.ID_Produk,
            jumlah: p.Jumlah,
            pic: p.PIC_Produksi
          };
        }),
        filename: `Laporan_Hasil_Produksi_${reportMonth || reportYear}.pdf`
      });
    } else {
      generateAnnualProductionReportPDF({
        tahun: reportYear,
        totalAnnualOutput: totalAnnualAllQty,
        monthNames,
        productRows: products.map(prod => {
          const rowVals = annualReportByProduct[prod.ID_Produk] || new Array(12).fill(0);
          const sum = rowVals.reduce((a, b) => a + b, 0);
          return {
            nama: prod.Nama_Produk,
            monthly: rowVals,
            total: sum
          };
        }),
        monthlyTotals: annualTotalMonthly,
        filename: `Laporan_Tahunan_Produksi_${reportYear}.pdf`
      });
    }
  };

  const formatTanggalSPK = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Juli', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const mon = monthNames[d.getMonth()] || 'Okt';
    return `${day}-${mon}-${d.getFullYear()}`;
  };

  const isProdModalPrinting = Boolean(showReportModal || viewSpkDocModal);

  return (
    <div className="space-y-6">
      {/* Background Main Content (Otomatis disembunyikan saat mencetak laporan modal) */}
      <div className={`space-y-6 ${isProdModalPrinting ? 'print:hidden' : ''}`}>
        {/* Header Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Factory className="text-blue-600" size={24} />
            Manajemen Produksi & SPK
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Penerbitan SPK, eksekusi batch produksi, pemotongan stok bahan penolong otomatis, dan laporan komprehensif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Working Print Button */}
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Cetak Halaman"
          >
            <Printer size={16} />
          </button>

          {/* New Laporan Produksi Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <BarChart2 size={14} />
            <span>Laporan Produksi</span>
          </button>

          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none"
          />

          <button
            onClick={() => handleOpenDirectProd()}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Catat dan input hasil produksi secara langsung tanpa harus melalui alur bertahap SPK"
          >
            <Plus size={14} />
            <span>Input Langsung</span>
          </button>

          <button
            onClick={handleOpenAddSpk}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Terbitkan SPK</span>
          </button>
        </div>
      </div>

      {/* Row 1: Rencana Produksi (SPK) Aktif */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Rencana Produksi (SPK) Menunggu Realisasi ({activeSpks.length})
            </h3>
          </div>
        </div>

        {activeSpks.length === 0 ? (
          <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-400 fst-italic">
            Seluruh rencana SPK telah diproses atau belum ada SPK baru.
          </div>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
            {activeSpks.map(s => {
              const prod = products.find(p => p.ID_Produk === s.ID_Produk);
              return (
                <div 
                  key={s.ID_SPK}
                  className="w-64 shrink-0 p-4 bg-white rounded-xl border-t-4 border-t-amber-500 border border-slate-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-mono font-semibold text-slate-700">{s.ID_SPK}</span>
                      <span>{formatDateDDMMYYYY(s.Tanggal)}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{prod?.Nama_Produk || s.ID_Produk}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.Shift}</p>
                    <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200 text-center">
                      <span className="text-[10px] text-amber-800 uppercase font-semibold block">Target Produksi</span>
                      <span className="text-lg font-bold text-amber-950 font-mono tabular-nums">{s.Target_Produksi.toLocaleString('id-ID')}</span>
                      <span className="text-[10px] text-amber-800 ml-1">Unit</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <button
                      onClick={() => setShowDetailSpkModal(s)}
                      className="w-full py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Rincian BOM</span>
                    </button>
                    
                    {/* Action buttons including print and delete */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[11px]">
                      <button
                        onClick={() => setViewSpkDocModal(s)}
                        className="text-slate-600 hover:text-blue-700 flex items-center gap-1 font-semibold cursor-pointer"
                        title="Pratinjau & Cetak Dokumen SPK"
                      >
                        <Printer size={12} /> Cetak
                      </button>
                      <button
                        onClick={() => handleOpenEditSpk(s)}
                        className="text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSpk(s.ID_SPK)}
                        className="text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold cursor-pointer"
                        title="Hapus SPK"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 2: Produksi Sedang Berjalan (Active Ongoing Batch) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Produksi Sedang Berjalan di Pabrik ({activeOngoingProds.length})
            </h3>
          </div>
        </div>

        {activeOngoingProds.length === 0 ? (
          <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-400 fst-italic">
            Tidak ada jalur produksi yang sedang aktif berjalan. Klik "Mulai Produksi" dari SPK di atas.
          </div>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
            {activeOngoingProds.map(p => {
              const prod = products.find(prodItem => prodItem.ID_Produk === p.ID_Produk);
              return (
                <div 
                  key={p.ID_Produksi}
                  className="w-64 shrink-0 p-4 bg-white rounded-xl border-t-4 border-t-blue-600 border border-slate-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-mono font-bold text-blue-700">{p.ID_Produksi}</span>
                      <span>{formatDateDDMMYYYY(p.Tanggal)}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{prod?.Nama_Produk || p.ID_Produk}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{p.Shift} • PIC: {p.PIC_Produksi}</p>
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200 text-center">
                      <span className="text-xs font-bold text-blue-800 flex items-center justify-center gap-1">
                        <Clock size={13} className="animate-spin text-blue-600" /> Sedang Diproses
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <button
                      onClick={() => {
                        setActiveFinishItem(p);
                        setFinishActualQty('' as any);
                        setFinishPic(p.PIC_Produksi || '');
                        setShowFinishModal(true);
                      }}
                      className="w-full py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>Input Hasil Selesai</span>
                    </button>
                    <div className="text-right">
                      <button
                        onClick={() => handleDeleteProd(p.ID_Produksi)}
                        className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-1 ml-auto font-medium cursor-pointer"
                      >
                        <Trash2 size={12} /> Batalkan / Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 3: Riwayat Produksi Selesai (Tabel Harian) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Hasil Produksi Selesai - Periode {filterMonth}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
                {filteredProductions.length} Data
              </span>
            </div>
            <p className="text-xs text-slate-500">Stok produk jadi otomatis bertambah dan bahan penolong terpotong.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenDirectProd()}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Input Hasil Langsung</span>
            </button>
            <button
              onClick={() => exportDataToExcel(filteredProductions, 'Produksi', `AIRIS_Produksi_${filterMonth}`, `LAPORAN HASIL PRODUKSI AMDK - PERIODE ${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar Produk */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari ID Produksi, SPK, PIC Operator, Shift..."
                value={searchQueryProd}
                onChange={e => setSearchQueryProd(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQueryProd && (
                <button
                  type="button"
                  onClick={() => setSearchQueryProd('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdown Produk */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium text-[11px] hidden sm:inline">Varian:</span>
              <select
                value={selectedProductFilter}
                onChange={e => setSelectedProductFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">Semua Varian Produk ({products.length})</option>
                {products.map(p => (
                  <option key={p.ID_Produk} value={p.ID_Produk}>
                    {p.Nama_Produk} ({p.Satuan})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Sort Urutan Tanggal (Terlama / Terbaru) */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 px-1.5 hidden md:inline">Urut:</span>
              <button
                type="button"
                onClick={() => setDateSortOrder('asc')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  dateSortOrder === 'asc'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Urutkan dari tanggal terlama ke terbaru (1 s.d. 31)"
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
                title="Urutkan dari tanggal terbaru ke terlama (31 s.d. 1)"
              >
                <ArrowDown size={12} />
                <span>Terbaru</span>
              </button>
            </div>
          </div>

          {(searchQueryProd || selectedProductFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQueryProd('');
                setSelectedProductFilter('ALL');
              }}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
            >
              <X size={12} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">ID Produksi</th>
                <th 
                  onClick={() => setDateSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-3 cursor-pointer hover:bg-blue-50/80 transition-colors select-none group min-w-[125px]"
                  title="Klik untuk mengubah urutan tanggal (Terlama / Terbaru)"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tanggal</span>
                    <span className="p-0.5 rounded bg-slate-100 group-hover:bg-blue-200 text-blue-700 transition">
                      {dateSortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    </span>
                  </div>
                  <span className="text-[9px] font-normal text-slate-500 block mt-0.5">
                    {dateSortOrder === 'asc' ? 'Terlama → Terbaru' : 'Terbaru → Terlama'}
                  </span>
                </th>
                <th className="p-3">Shift</th>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Hasil (Unit)</th>
                <th className="p-3">PIC Produksi</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProductions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic">
                    Belum ada data produksi selesai untuk bulan {filterMonth}.
                  </td>
                </tr>
              ) : (
                filteredProductions.map(p => {
                  const prod = products.find(item => item.ID_Produk === p.ID_Produk);
                  return (
                    <tr key={p.ID_Produksi} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{p.ID_Produksi}</td>
                      <td className="p-3 font-mono text-slate-500">{formatDateDDMMYYYY(p.Tanggal)}</td>
                      <td className="p-3 text-slate-600">{p.Shift}</td>
                      <td className="p-3 font-semibold text-slate-900">{prod?.Nama_Produk || p.ID_Produk}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {(Number(p.Jumlah) || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-slate-700">{p.PIC_Produksi}</td>
                      <td className="p-3 text-slate-500">{p.Keterangan}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditProd(p)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                            title="Edit Data Produksi"
                          >
                            <Edit2 size={13} />
                          </button>
                          {/* Working Delete Button on Finished Production */}
                          <button
                            onClick={() => handleDeleteProd(p.ID_Produksi)}
                            className="p-1 text-red-500 hover:text-red-700 rounded cursor-pointer"
                            title="Hapus Data Produksi"
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

      {/* ============================================================== */}
      {/* MODAL LAPORAN PRODUKSI (2 TABS: BULANAN & TAHUNAN + GRAFIK)    */}
      {/* ============================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95 printable-modal-card">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
              <div className="flex items-center gap-2">
                <BarChart2 className="text-cyan-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Laporan Hasil Produksi AMDK As-Shofaa
                </h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Filter Bar & Tabs */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
              {/* 2 Tabs as requested */}
              <div className="flex items-center gap-1 bg-white p-1 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setReportTab('bulanan')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-colors ${
                    reportTab === 'bulanan' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  1. Laporan Bulanan
                </button>
                <button
                  onClick={() => setReportTab('tahunan')}
                  className={`px-3 py-1.5 font-bold rounded-md transition-colors ${
                    reportTab === 'tahunan' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2. Laporan Tahunan
                </button>
              </div>

              {/* Filters: Bulan, Tahun, Seluruhnya */}
              <div className="flex items-center gap-2">
                <select
                  value={reportFilterType}
                  onChange={e => setReportFilterType(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium outline-none"
                >
                  <option value="bulan">Filter Bulan</option>
                  <option value="tahun">Filter Tahun</option>
                  <option value="seluruh">Seluruh Data</option>
                </select>

                {reportFilterType === 'bulan' && (
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={e => setReportMonth(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-semibold"
                  />
                )}

                {reportFilterType === 'tahun' && (
                  <input
                    type="number"
                    value={reportYear}
                    onChange={e => setReportYear(e.target.value)}
                    className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-semibold text-center"
                  />
                )}

                {/* Print and PDF Buttons as requested */}
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Cetak Laporan"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
                <button
                  onClick={handleExportReportPDF}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Unduh PDF Resmi"
                >
                  <FileDown size={13} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs printable-scroll-area printable-content">
              {/* Header Cetak Resmi Khusus Hasil Print */}
              <div className="hidden print:block text-center pb-4 mb-4 border-b-2 border-slate-900">
                <h1 className="text-base font-black text-slate-900 tracking-wider">PT. ANUGERAH ILLAHI RABBI</h1>
                <p className="text-[10px] text-slate-600 font-medium">Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa • Klaten, Jawa Tengah</p>
                <div className="mt-2 pt-2 border-t border-slate-300">
                  <h2 className="text-sm font-extrabold uppercase text-slate-900 tracking-tight">
                    {reportTab === 'bulanan' ? 'LAPORAN REALISASI PRODUKSI AIR MINUM DALAM KEMASAN' : 'LAPORAN TAHUNAN PRODUKSI AMDK 12 BULAN'}
                  </h2>
                  <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                    Periode: {reportFilterType === 'bulan' ? reportMonth : reportFilterType === 'tahun' ? `Tahun ${reportYear}` : 'Seluruh Waktu'} • Dicetak: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* TAB 1: LAPORAN BULANAN */}
              {reportTab === 'bulanan' && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-slate-600 block text-[11px]">Total Output Produksi:</span>
                      <span className="text-xl font-bold font-mono text-blue-900">
                        {totalReportAllQty.toLocaleString('id-ID')} Unit
                      </span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-slate-600 block text-[11px]">Jumlah Batch Selesai:</span>
                      <span className="text-xl font-bold font-mono text-emerald-900">
                        {reportDataset.length} Batch
                      </span>
                    </div>
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <span className="text-slate-600 block text-[11px]">Rata-rata per Batch:</span>
                      <span className="text-xl font-bold font-mono text-indigo-900">
                        {reportDataset.length > 0 
                          ? Math.round(totalReportAllQty / reportDataset.length).toLocaleString('id-ID')
                          : 0} Unit
                      </span>
                    </div>
                  </div>

                  {/* INFORMASI HASIL JUMLAH PRODUKSI MASING-MASING PRODUK */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Boxes className="text-blue-600" size={17} />
                        <div>
                          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                            Hasil Jumlah Produksi Masing-Masing Produk
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Rekapitulasi total kuantitas per jenis produk untuk periode {reportFilterType === 'bulan' ? reportMonth : reportFilterType === 'tahun' ? reportYear : 'Seluruh Waktu'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/70 px-2.5 py-1 rounded-md">
                        Total Output: <strong className="font-mono text-xs">{totalReportAllQty.toLocaleString('id-ID')} Unit</strong>
                      </span>
                    </div>

                    {/* Dedicated Accumulation Table per Product (Clean View) */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                          <tr>
                            <th className="p-2.5">ID Produk</th>
                            <th className="p-2.5">Nama Produk</th>
                            <th className="p-2.5">Kategori</th>
                            <th className="p-2.5">Satuan</th>
                            <th className="p-2.5 text-center">Batch Selesai</th>
                            <th className="p-2.5 text-right">Hasil Produksi</th>
                            <th className="p-2.5 text-right">Porsi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {reportProductSummary.map((ps) => (
                            <tr key={ps.product.ID_Produk} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-slate-600">{ps.product.ID_Produk}</td>
                              <td className="p-2.5 font-sans font-semibold text-slate-900">{ps.product.Nama_Produk}</td>
                              <td className="p-2.5 font-sans text-slate-600">{ps.kategori}</td>
                              <td className="p-2.5 font-sans">{ps.satuan}</td>
                              <td className="p-2.5 text-center text-slate-700">{ps.batchCount} Batch</td>
                              <td className="p-2.5 text-right font-bold text-blue-900 tabular-nums text-xs">
                                {ps.totalQty.toLocaleString('id-ID')} {ps.satuan}
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-600">{ps.percentage}%</td>
                            </tr>
                          ))}
                          <tr className="bg-blue-50/80 font-bold border-t-2 border-blue-200">
                            <td colSpan={4} className="p-2.5 font-sans text-blue-950 font-bold">
                              TOTAL SELURUH PRODUK
                            </td>
                            <td className="p-2.5 text-center text-blue-950 font-mono">{reportDataset.length} Batch</td>
                            <td className="p-2.5 text-right text-blue-950 font-mono text-sm">
                              {totalReportAllQty.toLocaleString('id-ID')} Unit
                            </td>
                            <td className="p-2.5 text-right text-blue-950 font-mono">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section: Detailed Batch Transactions Table */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                        Rincian Log Batch Produksi ({reportDataset.length})
                      </h4>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                          <tr>
                            <th className="p-2.5">Tanggal</th>
                            <th className="p-2.5">ID Batch</th>
                            <th className="p-2.5">Shift</th>
                            <th className="p-2.5">Nama Produk</th>
                            <th className="p-2.5 text-right">Hasil (Unit)</th>
                            <th className="p-2.5">PIC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {reportDataset.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400 font-sans">
                                Tidak ada data produksi pada periode yang dipilih.
                              </td>
                            </tr>
                          ) : (
                            reportDataset.map(p => {
                              const pr = products.find(prod => prod.ID_Produk === p.ID_Produk);
                              return (
                                <tr key={p.ID_Produksi} className="hover:bg-slate-50">
                                  <td className="p-2.5 text-slate-600">{formatDateDDMMYYYY(p.Tanggal)}</td>
                                  <td className="p-2.5 font-bold text-blue-700">{p.ID_Produksi}</td>
                                  <td className="p-2.5 font-sans">{p.Shift}</td>
                                  <td className="p-2.5 font-sans font-semibold text-slate-900">{pr?.Nama_Produk || p.ID_Produk}</td>
                                  <td className="p-2.5 text-right font-bold text-emerald-700">{(Number(p.Jumlah) || 0).toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 font-sans text-slate-600">{p.PIC_Produksi}</td>
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

              {/* TAB 2: LAPORAN TAHUNAN DENGAN GRAFIK & DATA LENGKAP */}
              {reportTab === 'tahunan' && (
                <div className="space-y-5">
                  {/* Total Hasil Produksi Tahunan Per Masing-Masing Produk */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Boxes className="text-blue-600" size={16} />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                          Total Hasil Produksi Tahunan Per Produk (Tahun {reportYear})
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-blue-900">
                        Total Akumulasi: <strong>{totalAnnualAllQty.toLocaleString('id-ID')} Unit</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {annualProductSummary.map((aps) => (
                        <div key={aps.product.ID_Produk} className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-bold text-slate-900 text-xs line-clamp-1">{aps.product.Nama_Produk}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold uppercase">
                              {aps.satuan}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-sm font-extrabold font-mono text-slate-900 tabular-nums">
                              {aps.totalAnnualQty.toLocaleString('id-ID')}
                              <span className="text-xs font-normal text-slate-500 ml-1">{aps.satuan}</span>
                            </span>
                            <span className="text-xs font-bold text-blue-600 font-mono">
                              {aps.percentage}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, aps.percentage))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Grafik Garis Tahunan untuk Masing-Masing Produk */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-600" />
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">Grafik Garis Tren Produksi Per Produk:</span>
                          <span className="text-[11px] text-slate-500">Pergerakan output bulanan masing-masing produk (Tahun {reportYear})</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        Tahun {reportYear}
                      </span>
                    </div>

                    {/* Interactive Legend for each Product */}
                    <div className="flex flex-wrap items-center gap-3 py-1">
                      {products.map((prod, pIdx) => {
                        const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#ea580c'];
                        const color = colors[pIdx % colors.length];
                        const total = (annualReportByProduct[prod.ID_Produk] || []).reduce((a, b) => a + b, 0);
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
                      const colors = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#ea580c'];
                      const chartH = 200;
                      const chartW = 740;
                      const padX = 45;
                      const padY = 25;
                      const innerW = chartW - padX * 2;
                      const innerH = chartH - padY * 2;

                      // Find max value across all product monthly numbers
                      let maxProductVal = 10;
                      products.forEach(prod => {
                        const row = annualReportByProduct[prod.ID_Produk] || [];
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
                                const row = annualReportByProduct[prod.ID_Produk] || new Array(12).fill(0);
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
                          const rowVals = annualReportByProduct[prod.ID_Produk] || new Array(12).fill(0);
                          const totalProd = rowVals.reduce((a, b) => a + b, 0);
                          return (
                            <tr key={prod.ID_Produk} className="hover:bg-slate-50">
                              <td className="p-2.5 font-sans font-semibold text-slate-900">{prod.Nama_Produk}</td>
                              {rowVals.map((v, i) => (
                                <td key={i} className="p-2 text-center tabular-nums text-slate-700">
                                  {v > 0 ? v.toLocaleString('id-ID') : '-'}
                                </td>
                              ))}
                              <td className="p-2.5 text-right font-bold text-blue-900 tabular-nums">
                                {totalProd.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-bold">
                          <td className="p-2.5 font-sans text-slate-900">TOTAL PRODUKSI SEMUA</td>
                          {annualTotalMonthly.map((tot, idx) => (
                            <td key={idx} className="p-2 text-center text-emerald-800">
                              {tot > 0 ? tot.toLocaleString('id-ID') : '-'}
                            </td>
                          ))}
                          <td className="p-2.5 text-right text-emerald-900 text-sm">
                            {annualTotalMonthly.reduce((a, b) => a + b, 0).toLocaleString('id-ID')}
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
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Form SPK (Create / Edit) */}
      {showSpkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingSpk ? `Edit SPK: ${editingSpk.ID_SPK}` : 'Terbitkan Surat Perintah Kerja (SPK)'}
              </h3>
              <button onClick={() => setShowSpkModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Rencana</label>
                  <input
                    type="date"
                    value={spkForm.Tanggal}
                    onChange={e => setSpkForm({ ...spkForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift</label>
                  <select
                    value={spkForm.Shift}
                    onChange={e => setSpkForm({ ...spkForm, Shift: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  >
                    <option>Shift 1 (Pagi)</option>
                    <option>Shift 2 (Siang)</option>
                    <option>Shift 3 (Malam)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Produk Target</label>
                <select
                  value={spkForm.ID_Produk}
                  onChange={e => setSpkForm({ ...spkForm, ID_Produk: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium"
                >
                  {products.map(p => (
                    <option key={p.ID_Produk} value={p.ID_Produk}>{p.Nama_Produk} ({p.Satuan})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Jumlah Produksi (Unit)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={spkForm.Target_Produksi ?? ''}
                  onChange={e => setSpkForm({ ...spkForm, Target_Produksi: e.target.value === '' ? ('' as any) : Number(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan Operator</label>
                <input
                  type="text"
                  placeholder="Misal: Prioritas kirim pesanan Toko Berkah"
                  value={spkForm.Keterangan}
                  onChange={e => setSpkForm({ ...spkForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowSpkModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
              <button onClick={handleSaveSPK} className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer">
                {editingSpk ? 'Simpan Perubahan SPK' : 'Simpan & Terbitkan SPK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Finished Production Record */}
      {showEditProdModal && editingProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">Edit Data Produksi Selesai</h3>
              <button onClick={() => setShowEditProdModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ID Produksi</label>
                <input
                  type="text"
                  value={editProdForm.ID_Produksi}
                  readOnly
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-100 font-mono text-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={editProdForm.Tanggal}
                    onChange={e => setEditProdForm({ ...editProdForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift</label>
                  <select
                    value={editProdForm.Shift}
                    onChange={e => setEditProdForm({ ...editProdForm, Shift: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  >
                    <option>Shift 1 (Pagi)</option>
                    <option>Shift 2 (Siang)</option>
                    <option>Shift 3 (Malam)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Produk</label>
                <select
                  value={editProdForm.ID_Produk}
                  onChange={e => setEditProdForm({ ...editProdForm, ID_Produk: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                >
                  {products.map(p => (
                    <option key={p.ID_Produk} value={p.ID_Produk}>{p.Nama_Produk}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Unit Selesai</label>
                <input
                  type="number"
                  value={editProdForm.Jumlah}
                  onChange={e => setEditProdForm({ ...editProdForm, Jumlah: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIC Produksi</label>
                <select
                  value={editProdForm.PIC_Produksi}
                  onChange={e => setEditProdForm({ ...editProdForm, PIC_Produksi: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium bg-white"
                >
                  <option value="">-- Pilih PIC Operator dari Master Karyawan --</option>
                  {editProdForm.PIC_Produksi && !employees.some(e => e.Nama_Karyawan === editProdForm.PIC_Produksi) && (
                    <option value={editProdForm.PIC_Produksi}>{editProdForm.PIC_Produksi}</option>
                  )}
                  {productionEmployees.length > 0 && (
                    <optgroup label="Divisi Produksi">
                      {productionEmployees.map(e => (
                        <option key={e.ID_Karyawan} value={e.Nama_Karyawan}>
                          {e.Nama_Karyawan} ({e.Jabatan})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherActiveEmployees.length > 0 && (
                    <optgroup label="Divisi Lainnya">
                      {otherActiveEmployees.map(e => (
                        <option key={e.ID_Karyawan} value={e.Nama_Karyawan}>
                          {e.Nama_Karyawan} ({e.Departemen} - {e.Jabatan})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {employees.length === 0 && (
                    <option value="Agus Setiawan">Agus Setiawan (Operator Produksi)</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan</label>
                <input
                  type="text"
                  value={editProdForm.Keterangan}
                  onChange={e => setEditProdForm({ ...editProdForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowEditProdModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
              <button onClick={handleSaveEditProd} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer">
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Input Produksi Langsung */}
      {showDirectProdModal && (() => {
        const selectedSpkInDirect = directProdForm.ID_SPK ? spks.find(s => s.ID_SPK === directProdForm.ID_SPK) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto no-print">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden my-6">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-2">
                  <Factory size={16} className="text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">Input Langsung Hasil Produksi</h3>
                </div>
                <button onClick={() => setShowDirectProdModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
              </div>

              <div className="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
                {/* SPK Selector (Optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gunakan Acuan SPK (Opsional)
                  </label>
                  <select
                    value={directProdForm.ID_SPK}
                    onChange={e => handleSelectSpkForDirect(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium bg-white"
                  >
                    <option value="">-- Tanpa SPK (Input Langsung Reguler) --</option>
                    {spks.filter(s => s.Status !== 'Selesai').map(s => {
                      const p = products.find(prod => prod.ID_Produk === s.ID_Produk);
                      return (
                        <option key={s.ID_SPK} value={s.ID_SPK}>
                          {s.ID_SPK} - {p?.Nama_Produk || s.ID_Produk} (Target: {s.Target_Produksi.toLocaleString('id-ID')} Unit, {s.Tanggal} - {s.Shift})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Target Reference Info Box if SPK is selected */}
                {selectedSpkInDirect && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-900">
                        🎯 Acuan Target Rencana SPK: {selectedSpkInDirect.ID_SPK}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDirectProdForm(prev => ({ ...prev, Jumlah: selectedSpkInDirect.Target_Produksi }))}
                        className="text-[11px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                        title="Klik untuk mengisi hasil aktual sama persis dengan target SPK"
                      >
                        Gunakan Target ({selectedSpkInDirect.Target_Produksi.toLocaleString('id-ID')} Unit)
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/70 text-xs text-amber-950">
                      <div>
                        <span className="text-amber-700 block text-[10px]">Target Rencana:</span>
                        <span className="font-mono font-extrabold text-amber-950 text-sm">{selectedSpkInDirect.Target_Produksi.toLocaleString('id-ID')} Unit</span>
                      </div>
                      <div>
                        <span className="text-amber-700 block text-[10px]">Shift / Jadwal:</span>
                        <span className="font-semibold">{selectedSpkInDirect.Shift} ({selectedSpkInDirect.Tanggal})</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Produksi</label>
                    <input
                      type="date"
                      value={directProdForm.Tanggal}
                      onChange={e => setDirectProdForm({ ...directProdForm, Tanggal: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Shift Kerja</label>
                    <select
                      value={directProdForm.Shift}
                      onChange={e => setDirectProdForm({ ...directProdForm, Shift: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium bg-white"
                    >
                      <option value="Shift 1 (Pagi)">Shift 1 (Pagi)</option>
                      <option value="Shift 2 (Siang)">Shift 2 (Siang)</option>
                      <option value="Shift 3 (Malam)">Shift 3 (Malam)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Produk</label>
                  <select
                    value={directProdForm.ID_Produk}
                    onChange={e => setDirectProdForm({ ...directProdForm, ID_Produk: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800 bg-white"
                  >
                    {products.map(p => (
                      <option key={p.ID_Produk} value={p.ID_Produk}>
                        {p.Nama_Produk} ({p.ID_Produk})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Hasil Selesai Aktual (Unit)</label>
                    {selectedSpkInDirect && Number(directProdForm.Jumlah) > 0 && (
                      <span className={`text-[11px] font-bold font-mono ${
                        Number(directProdForm.Jumlah) >= selectedSpkInDirect.Target_Produksi ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        Tercapai: {((Number(directProdForm.Jumlah) / selectedSpkInDirect.Target_Produksi) * 100).toFixed(1)}% ({Number(directProdForm.Jumlah) - selectedSpkInDirect.Target_Produksi >= 0 ? `+${Number(directProdForm.Jumlah) - selectedSpkInDirect.Target_Produksi}` : Number(directProdForm.Jumlah) - selectedSpkInDirect.Target_Produksi} Unit)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder="Contoh: 1500"
                    value={directProdForm.Jumlah ?? ''}
                    onChange={e => setDirectProdForm({ ...directProdForm, Jumlah: e.target.value === '' ? ('' as any) : Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg outline-none font-mono font-bold text-base text-blue-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIC Operator / Kepala Regu</label>
                  <select
                    value={directProdForm.PIC_Produksi}
                    onChange={e => setDirectProdForm({ ...directProdForm, PIC_Produksi: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium bg-white"
                  >
                    <option value="">-- Pilih PIC Operator dari Master Karyawan --</option>
                    {directProdForm.PIC_Produksi && !employees.some(e => e.Nama_Karyawan === directProdForm.PIC_Produksi) && (
                      <option value={directProdForm.PIC_Produksi}>{directProdForm.PIC_Produksi}</option>
                    )}
                    {productionEmployees.length > 0 && (
                      <optgroup label="Divisi Produksi">
                        {productionEmployees.map(e => (
                          <option key={e.ID_Karyawan} value={e.Nama_Karyawan}>
                            {e.Nama_Karyawan} ({e.Jabatan})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherActiveEmployees.length > 0 && (
                      <optgroup label="Divisi Lainnya">
                        {otherActiveEmployees.map(e => (
                          <option key={e.ID_Karyawan} value={e.Nama_Karyawan}>
                            {e.Nama_Karyawan} ({e.Departemen} - {e.Jabatan})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {employees.length === 0 && (
                      <option value="Agus Setiawan">Agus Setiawan (Operator Produksi)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Keterangan / Catatan Batch</label>
                  <input
                    type="text"
                    placeholder="Catatan tambahan (opsional)..."
                    value={directProdForm.Keterangan}
                    onChange={e => setDirectProdForm({ ...directProdForm, Keterangan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                  <span className="font-semibold block text-slate-800 mb-1">Otomatisasi Sistem:</span>
                  • Bahan baku langsung terpotong dari gudang sesuai standar formula BOM.<br/>
                  • Stok produk jadi langsung bertambah dan siap didistribusikan.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
                <button onClick={() => setShowDirectProdModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
                <button onClick={handleSaveDirectProd} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer">
                  Simpan Hasil Produksi
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Input Hasil Produksi Selesai */}
      {showFinishModal && activeFinishItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">Input Hasil Produksi Selesai</h3>
              <button onClick={() => setShowFinishModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-[11px] text-blue-800 font-semibold block">ID Produksi: {activeFinishItem.ID_Produksi}</span>
                <span className="text-xs text-slate-900 font-bold block mt-0.5">
                  {products.find(p => p.ID_Produk === activeFinishItem.ID_Produk)?.Nama_Produk}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Tanggal: {formatDateDDMMYYYY(activeFinishItem.Tanggal)} • {activeFinishItem.Shift}
                </span>
              </div>

              {/* Rujukan Data Rencana Target SPK */}
              {(() => {
                const spkMatch = activeFinishItem.Keterangan.match(/SPK-[\w\d]+/i);
                const spkId = spkMatch ? spkMatch[0] : null;
                const linkedSpk = spkId ? spks.find(s => s.ID_SPK === spkId) : null;

                if (!linkedSpk) return null;

                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                        <span>🎯 Acuan Target Rencana SPK</span>
                        <span className="font-mono bg-amber-200/80 px-1.5 py-0.5 rounded text-[10px] text-amber-950 font-bold">{linkedSpk.ID_SPK}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFinishActualQty(linkedSpk.Target_Produksi)}
                        className="text-[11px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                        title="Klik untuk menyamakan hasil produksi dengan target SPK"
                      >
                        Gunakan Target ({linkedSpk.Target_Produksi.toLocaleString('id-ID')} Unit)
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/70 text-xs text-amber-950">
                      <div>
                        <span className="text-amber-700 block text-[10px]">Target Rencana:</span>
                        <span className="font-mono font-extrabold text-amber-950 text-sm">
                          {linkedSpk.Target_Produksi.toLocaleString('id-ID')} Unit
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-700 block text-[10px]">Shift / Jadwal:</span>
                        <span className="font-semibold">{linkedSpk.Shift} ({linkedSpk.Tanggal})</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Hasil Aktual Selesai (Unit)</label>
                  {(() => {
                    const spkMatch = activeFinishItem.Keterangan.match(/SPK-[\w\d]+/i);
                    const spkId = spkMatch ? spkMatch[0] : null;
                    const linkedSpk = spkId ? spks.find(s => s.ID_SPK === spkId) : null;
                    if (!linkedSpk || !finishActualQty || Number(finishActualQty) <= 0) return null;
                    const pct = ((Number(finishActualQty) / linkedSpk.Target_Produksi) * 100).toFixed(1);
                    const diff = Number(finishActualQty) - linkedSpk.Target_Produksi;
                    return (
                      <span className={`text-[11px] font-bold font-mono ${
                        Number(finishActualQty) >= linkedSpk.Target_Produksi ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        Tercapai: {pct}% ({diff >= 0 ? `+${diff}` : diff} Unit)
                      </span>
                    );
                  })()}
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={finishActualQty ?? ''}
                  onChange={e => setFinishActualQty(e.target.value === '' ? ('' as any) : Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg outline-none font-mono font-bold text-base text-blue-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIC Operator / Kepala Regu</label>
                <select
                  value={finishPic}
                  onChange={e => setFinishPic(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium bg-white"
                >
                  <option value="">-- Pilih PIC Operator dari Master Karyawan --</option>
                  {finishPic && !employees.some(e => e.Nama_Karyawan === finishPic) && (
                    <option value={finishPic}>{finishPic}</option>
                  )}
                  {productionEmployees.length > 0 && (
                    <optgroup label="Divisi Produksi">
                      {productionEmployees.map(e => (
                        <option key={e.ID_Karyawan} value={e.Nama_Karyawan}>
                          {e.Nama_Karyawan} ({e.Jabatan})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherActiveEmployees.length > 0 && (
                    <optgroup label="Divisi Lainnya">
                      {otherActiveEmployees.map(e => (
                        <option key={e.ID_Karyawan} value={e.Nama_Karyawan}>
                          {e.Nama_Karyawan} ({e.Departemen} - {e.Jabatan})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {employees.length === 0 && (
                    <option value="Agus Setiawan">Agus Setiawan (Operator Produksi)</option>
                  )}
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                <span className="font-semibold block text-slate-800 mb-1">Otomatisasi Sistem:</span>
                • Bahan baku akan terpotong dari stok gudang berdasarkan formula BOM.<br/>
                • Antrean uji mutu akan diterbitkan otomatis ke modul Quality Control (QC).
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowFinishModal(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">Batal</button>
              <button onClick={handleCompleteProduction} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer">
                Selesaikan & Potong BOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rincian SPK & Mulai Produksi */}
      {showDetailSpkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">Detail Rencana SPK: {showDetailSpkModal.ID_SPK}</h3>
              <button onClick={() => setShowDetailSpkModal(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 text-slate-700">
                <div><span className="text-slate-400 block text-[10px]">Tanggal:</span><span className="font-semibold">{formatDateDDMMYYYY(showDetailSpkModal.Tanggal)}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Shift:</span><span className="font-semibold">{showDetailSpkModal.Shift}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Produk:</span><span className="font-semibold">{products.find(p => p.ID_Produk === showDetailSpkModal.ID_Produk)?.Nama_Produk}</span></div>
                <div><span className="text-slate-400 block text-[10px]">Target:</span><span className="font-bold text-blue-700 font-mono text-sm">{showDetailSpkModal.Target_Produksi} Unit</span></div>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">Estimasi Kebutuhan Bahan (BOM)</h4>
                <div className="space-y-1.5">
                  {boms.filter(b => b.ID_Produk === showDetailSpkModal.ID_Produk).map(b => {
                    const mat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
                    const totalNeeded = showDetailSpkModal.Target_Produksi * (Number(b.Jumlah_Dibutuhkan) || 0);
                    return (
                      <div key={b.ID_BOM} className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-700">{mat?.Nama_Bahan || b.ID_Bahan}</span>
                        <span className="font-mono font-bold text-slate-900">{totalNeeded.toLocaleString('id-ID')} {b.Satuan}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {/* Working Cetak SPK */}
                <button 
                  onClick={() => setViewSpkDocModal(showDetailSpkModal)} 
                  className="px-3 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Cetak SPK</span>
                </button>
                {/* Working Hapus SPK */}
                <button 
                  onClick={() => handleDeleteSpk(showDetailSpkModal.ID_SPK)} 
                  className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Hapus</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const s = showDetailSpkModal;
                    setShowDetailSpkModal(null);
                    handleOpenDirectProd(s);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Langsung input hasil selesai untuk SPK ini tanpa menunggu proses berjalan"
                >
                  <CheckCircle2 size={13} />
                  <span>Input Hasil Langsung</span>
                </button>
                <button
                  onClick={() => handleStartProductionFromSPK(showDetailSpkModal)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Play size={13} />
                  <span>Mulai Bertahap</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PRATINJAU DOKUMEN RESMI SPK (SESUAI CONTOH GAMBAR)       */}
      {/* ============================================================== */}
      {viewSpkDocModal && (() => {
        const targetProd = products.find(p => p.ID_Produk === viewSpkDocModal.ID_Produk);
        const relatedBoms = boms.filter(b => b.ID_Produk === viewSpkDocModal.ID_Produk);
        const bomList = relatedBoms.map(b => {
          const mat = rawMaterials.find(m => m.ID_Bahan === b.ID_Bahan);
          const totalQty = viewSpkDocModal.Target_Produksi * (Number(b.Jumlah_Dibutuhkan) || 0);
          return {
            nama: (mat?.Nama_Bahan || b.ID_Bahan).toUpperCase(),
            kebutuhan: `${totalQty.toLocaleString('id-ID')} ${(b.Satuan || 'PCS').toUpperCase()}`
          };
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto printable-modal-overlay">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto printable-modal-card flex flex-col max-h-[95vh]">
              {/* Header Action Bar (No-Print) */}
              <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white no-print shrink-0">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-cyan-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Pratinjau SPK: {viewSpkDocModal.ID_SPK}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    title="Cetak Dokumen SPK ke Kertas / Printer"
                  >
                    <Printer size={13} />
                    <span>Cetak SPK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintSPK(viewSpkDocModal)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    title="Unduh Dokumen SPK format PDF"
                  >
                    <Download size={13} />
                    <span>Unduh PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewSpkDocModal(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition ml-1"
                    title="Tutup Pratinjau SPK"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Dokumen Fisik SPK (Persis Format Gambar) */}
              <div className="p-6 sm:p-12 font-sans bg-white text-slate-900 overflow-y-auto printable-content">
                {/* 1. Header: Left Company, Right Title */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-blue-700 font-extrabold text-base sm:text-xl tracking-tight uppercase">
                      PT. ANUGERAH ILLAHI RABBI
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Sistem Manajemen Produksi AIRIS
                    </p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-slate-900 font-bold text-sm sm:text-lg tracking-tight uppercase">
                      SURAT PERINTAH KERJA (SPK)
                    </h2>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      ID: {viewSpkDocModal.ID_SPK}
                    </p>
                  </div>
                </div>

                {/* 2. Accent Solid Blue Line */}
                <div className="h-[3px] bg-blue-600 w-full mt-3 mb-5"></div>

                {/* 3. Metadata Grid (2 Kolom dengan Titik Dua Sejajar) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2 text-xs sm:text-[13px] text-slate-900 my-4 leading-relaxed">
                  {/* Kolom Kiri */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-[130px_16px_1fr] items-baseline">
                      <span className="font-bold">Tanggal Rencana</span>
                      <span className="font-bold">:</span>
                      <span>{formatTanggalSPK(viewSpkDocModal.Tanggal)}</span>
                    </div>
                    <div className="grid grid-cols-[130px_16px_1fr] items-baseline">
                      <span className="font-bold">Produk Target</span>
                      <span className="font-bold">:</span>
                      <span>{targetProd?.Nama_Produk || viewSpkDocModal.ID_Produk}</span>
                    </div>
                    <div className="grid grid-cols-[130px_16px_1fr] items-baseline">
                      <span className="font-bold">Keterangan</span>
                      <span className="font-bold">:</span>
                      <span>{viewSpkDocModal.Keterangan || '-'}</span>
                    </div>
                  </div>

                  {/* Kolom Kanan */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-[130px_16px_1fr] items-baseline">
                      <span className="font-bold">Shift Pengerjaan</span>
                      <span className="font-bold">:</span>
                      <span>{viewSpkDocModal.Shift}</span>
                    </div>
                    <div className="grid grid-cols-[130px_16px_1fr] items-baseline">
                      <span className="font-bold">Jumlah Target</span>
                      <span className="font-bold">:</span>
                      <span className="font-bold">{viewSpkDocModal.Target_Produksi.toLocaleString('id-ID')} Unit</span>
                    </div>
                  </div>
                </div>

                {/* 4. Bagian BOM */}
                <div className="mt-8">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 mb-2.5">
                    Rincian Kebutuhan Bahan Penolong (BOM)
                  </h3>

                  {/* Tabel BOM Bergaris Penuh */}
                  <div className="w-full">
                    <table className="w-full border-collapse border border-slate-900 text-xs text-slate-900">
                      <thead>
                        <tr className="border-b border-slate-900 font-bold bg-white">
                          <th className="border-r border-slate-900 px-3 py-2 w-12 text-center">No</th>
                          <th className="border-r border-slate-900 px-4 py-2 text-left">Nama Bahan Penolong</th>
                          <th className="px-4 py-2 text-left w-56 font-bold">Total Kebutuhan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomList.length === 0 ? (
                          <tr className="border-b border-slate-900">
                            <td colSpan={3} className="text-center py-6 text-slate-400 italic">
                              Belum ada formula BOM terdaftar untuk produk ini.
                            </td>
                          </tr>
                        ) : (
                          bomList.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-900">
                              <td className="border-r border-slate-900 px-3 py-2 text-center font-normal">{idx + 1}</td>
                              <td className="border-r border-slate-900 px-4 py-2 font-bold uppercase">{item.nama}</td>
                              <td className="px-4 py-2 font-bold uppercase">{item.kebutuhan}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. Tanda Tangan */}
                <div className="mt-20 sm:mt-24 grid grid-cols-2 text-center text-xs sm:text-sm text-slate-900">
                  <div>
                    <p className="font-medium">Disetujui Oleh,</p>
                    <div className="h-20 sm:h-24"></div>
                    <p className="font-bold">( Kepala Produksi )</p>
                  </div>
                  <div>
                    <p className="font-medium">Diterima Oleh,</p>
                    <div className="h-20 sm:h-24"></div>
                    <p className="font-bold">( Operator / PIC )</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
