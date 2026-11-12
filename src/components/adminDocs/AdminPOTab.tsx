import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Printer, Download, Eye, 
  Trash2, Edit2, FileCheck, X, Building, Save, FileDown, 
  CheckCircle2, Search, Check, RefreshCw, Calendar, Settings, 
  Image, Sliders, RotateCcw, Upload, FileText
} from 'lucide-react';
import { 
  AdminPOHeader, AdminPODetail, SupplierItem, RawMaterialItem, 
  POSignatory, PODocumentSettings, DocumentTemplateSettings
} from '../../types';
import { getTableData, setTableData, deleteTableRow } from '../../services/dbAdapter';
import { 
  exportPOUnifiedToExcel, importUnifiedPORows, parseExcelFile, downloadExcelTemplate 
} from '../../services/excelService';
import { generatePurchaseOrderPDF, sanitizeFilename, angkaKeTerbilang, formatRupiahSen } from '../../services/pdfService';
import { showToast as showToastGlobal } from '../ToastContainer';
import { confirmAction } from '../ConfirmDialog';
import { formatDateDDMMYYYY } from '../../services/formatters';

interface AdminPOTabProps {
  suppliers: SupplierItem[];
  rawMaterials: RawMaterialItem[];
  onRefresh: () => void;
}

export const AdminPOTab: React.FC<AdminPOTabProps> = ({
  suppliers,
  rawMaterials,
  onRefresh
}) => {
  const [poHeaders, setPoHeaders] = useState<AdminPOHeader[]>(() => {
    const data = getTableData<AdminPOHeader>('Admin_PO', []);
    return Array.isArray(data) ? data : [];
  });
  const [poDetails, setPoDetails] = useState<AdminPODetail[]>(() => {
    const data = getTableData<AdminPODetail>('Admin_PO_Detail', []);
    return Array.isArray(data) ? data : [];
  });
  useEffect(() => {
    const handleDbChange = () => {
      setPoHeaders(getTableData<AdminPOHeader>('Admin_PO', []));
      setPoDetails(getTableData<AdminPODetail>('Admin_PO_Detail', []));
    };
    window.addEventListener('airis_db_updated', handleDbChange);
    window.addEventListener('storage', handleDbChange);
    return () => {
      window.removeEventListener('airis_db_updated', handleDbChange);
      window.removeEventListener('storage', handleDbChange);
    };
  }, []);
  const [poSearchQuery, setPoSearchQuery] = useState<string>('');

  // State Filter Periode Purchase Order (PO)
  const [poFilterMonth, setPoFilterMonth] = useState<string>('all');
  const [poFilterYear, setPoFilterYear] = useState<string>('all');

  // Helper ekstraksi komponen tanggal (Tahun, Bulan, Hari) secara presisi dan terstruktur untuk PO
  const extractPoDateParts = (raw: any): { year: string; month: string; day: string } | null => {
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

  // Helper ekstraksi bulan YYYY-MM dari record PO
  const getPoMonthKey = (p: AdminPOHeader): string => {
    const parts = extractPoDateParts(p.Tanggal_PO);
    return parts ? ${parts.year}- : '';
  };

  const getPoYear = (p: AdminPOHeader): string => {
    const parts = extractPoDateParts(p.Tanggal_PO);
    return parts ? parts.year : '';
  };

  // Daftar tahun unik yang tersedia pada data PO
  const availablePoYears = useMemo(() => {
    const map = new Map<string, number>();
    (poHeaders || []).forEach(p => {
      const y = getPoYear(p);
      if (y) {
        map.set(y, (map.get(y) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [poHeaders]);

  // Daftar bulan unik yang tersedia pada data PO (tersaring tahun jika ada)
  const availablePoMonths = useMemo(() => {
    const map = new Map<string, number>();
    (poHeaders || []).forEach(p => {
      if (poFilterYear !== 'all' && getPoYear(p) !== poFilterYear) return;
      const key = getPoMonthKey(p);
      if (key && /^\d{4}-\d{2}$/.test(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([period, count]) => ({ period, count }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [poHeaders, poFilterYear]);

  // Format label bulan bahasa Indonesia (contoh: '2025-02' => 'Februari 2025')
  const formatPoMonthName = (periodStr: string): string => {
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

  const [showPoModal, setShowPoModal] = useState(false);
  const [editingPO, setEditingPO] = useState<AdminPOHeader | null>(null);
  const [viewPoModal, setViewPoModal] = useState<AdminPOHeader | null>(null);

  const [poForm, setPoForm] = useState({
    Tanggal_PO: new Date().toISOString().slice(0, 10),
    No_PO: '',
    Order_Ke: '',
    Alamat_Supplier: '',
    Syarat_Ketentuan: '',
    Status: 'Terkirim ke Pemasok'
  });
  const [poItems, setPoItems] = useState<{ Nama_Produk: string; Spesifikasi: string; Qty: number; Harga_Satuan: number }[]>([
    { Nama_Produk: '', Spesifikasi: '', Qty: '' as any, Harga_Satuan: '' as any }
  ]);
  const poFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportPOFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      if (!parsed.success || !parsed.data) {
        showToastGlobal('Gagal membaca file Excel PO', 'error');
        return;
      }
      const res = importUnifiedPORows(parsed.data);
      if (res.success) {
        setPoHeaders(getTableData<AdminPOHeader>('Admin_PO', []));
        setPoDetails(getTableData<AdminPODetail>('Admin_PO_Detail', []));
        onRefresh();
        showToastGlobal(
          'Import PO Berhasil!',
          `Berhasil mengimpor ${res.totalHeaders} surat PO dan ${res.totalDetails} rincian item barang ke sistem.`,
          'success'
        );
      } else {
        showToastGlobal(res.error || 'Gagal mengimpor data PO', 'error');
      }
    } catch (err: any) {
      showToastGlobal(`Error import: ${err.message}`, 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const defaultPOSignatories: POSignatory[] = [
    { id: 'pos-1', keterangan: 'Diterima & Dikonfirmasi Vendor,', nama: '( Pemasok / Vendor )', jabatan: 'Pemasok / Rekanan', useCustomTtdImage: false },
    { id: 'pos-2', keterangan: 'Dibuat Oleh (Purchasing),', nama: 'Marko Dwi Nugroho', jabatan: 'Staff Purchasing & Gudang', useCustomTtdImage: false },
    { id: 'pos-3', keterangan: 'Disetujui Oleh (Direktur),', nama: 'H. Mujiburrahman, SIP', jabatan: 'Direktur Utama', useCustomTtdImage: false }
  ];

  const defaultPOSettings: PODocumentSettings = {
    namaPerusahaan: 'PT. ANUGERAH ILLAHI RABBI',
    subNamaPerusahaan: 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa',
    alamatPerusahaan: 'Dk. Gading Baru, RT.03, RW.08, Belangwetan, Klaten Utara, Klaten',
    kontakPerusahaan: '0856 4000 1926 | (0272) 898123',
    customKopImage: '',
    useCustomKopImage: false,
    kopWidth: 100,
    kopHeight: 90,
    showCap: true,
    customCapImage: '',
    useCustomCapImage: false,
    capWidth: 80,
    capHeight: 80,
    signatories: defaultPOSignatories
  };
  const [poSettings, setPoSettings] = useState<PODocumentSettings>(() => {
    return getTableData<PODocumentSettings>('Pengaturan_Dokumen_PO', [defaultPOSettings])[0] || defaultPOSettings;
  });
  const [showPOSettingsModal, setShowPOSettingsModal] = useState<boolean>(false);
  const [tempPOSettings, setTempPOSettings] = useState<PODocumentSettings>(() => poSettings);

  const defaultDocSettings: DocumentTemplateSettings = {
    namaPerusahaan: 'PT. ANUGERAH ILLAHI RABBI',
    subNamaPerusahaan: 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa',
    alamatPerusahaan: 'Dk. Gading Baru, RT.03, RW.08, Belangwetan, Klaten Utara, Klaten',
    kontakPerusahaan: '0856 4000 1926 | (0272) 898123',
    customKopImage: '',
    useCustomKopImage: false,
    kopWidth: 100,
    kopHeight: 90,
    customCapImage: '',
    useCustomCapImage: false,
    showCap: true,
    capWidth: 80,
    capHeight: 80
  };
  const [docSettings] = useState<DocumentTemplateSettings>(() => {
    return getTableData<DocumentTemplateSettings>('Pengaturan_Dokumen', [defaultDocSettings])[0] || defaultDocSettings;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPOSettingsModal) setShowPOSettingsModal(false);
        else if (showPoModal) setShowPoModal(false);
        else if (viewPoModal) setViewPoModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPOSettingsModal, showPoModal, viewPoModal]);

  const handleOpenPOSettings = () => {
    setTempPOSettings(JSON.parse(JSON.stringify(poSettings)));
    setShowPOSettingsModal(true);
  };

  const handleSavePOSettings = () => {
    setPoSettings(tempPOSettings);
    setTableData('Pengaturan_Dokumen_PO', [tempPOSettings]);
    setShowPOSettingsModal(false);
    showToastGlobal('Pengaturan PO Berhasil Disimpan', 'Format dokumen dan penandatangan PO telah diperbarui.', 'success');
  };

  const handleResetPOSettings = () => {
    confirmAction({
      title: 'Reset Pengaturan PO?',
      message: 'Format dokumen dan penandatangan PO akan dikembalikan ke pengaturan default pabrik.',
      confirmText: 'Ya, Reset',
      confirmColor: 'amber',
      onConfirm: () => {
        setTempPOSettings(JSON.parse(JSON.stringify(defaultPOSettings)));
      }
    });
  };

  const handleAddPOSignatory = () => {
    const currentList: POSignatory[] = tempPOSettings.signatories || [];
    const newSig: POSignatory = {
      id: pos- + Date.now().toString(),
      keterangan: 'Mengetahui / Menyetujui,',
      nama: '',
      jabatan: '',
      useCustomTtdImage: false
    };
    setTempPOSettings(prev => ({
      ...prev,
      signatories: [...currentList, newSig]
    }));
  };

  const handleRemovePOSignatory = (id: string) => {
    setTempPOSettings(prev => ({
      ...prev,
      signatories: (prev.signatories || []).filter(s => s.id !== id)
    }));
  };

  const handleUpdatePOSignatory = (id: string, field: keyof POSignatory, value: any) => {
    setTempPOSettings(prev => ({
      ...prev,
      signatories: (prev.signatories || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  // ==============================================================
  // PURCHASE ORDER (PO) HANDLERS
  // ==============================================================
  const handleOpenAddPO = () => {
    setEditingPO(null);
    const d = new Date();
    setPoForm({
      Tanggal_PO: d.toISOString().slice(0, 10),
      No_PO: `${String(poHeaders.length + 1).padStart(3, '0')}-PO-X-${d.getFullYear().toString().slice(-2)}`,
      Order_Ke: '',
      Alamat_Supplier: '',
      Syarat_Ketentuan: '',
      Status: 'Terkirim ke Pemasok'
    });
    setPoItems([
      { Nama_Produk: '', Spesifikasi: '', Qty: '' as any, Harga_Satuan: '' as any }
    ]);
    setShowPoModal(true);
  };

  const handleOpenEditPO = (po: AdminPOHeader) => {
    setEditingPO(po);
    setPoForm({
      Tanggal_PO: po.Tanggal_PO,
      No_PO: po.No_PO,
      Order_Ke: po.Order_Ke,
      Alamat_Supplier: po.Alamat_Supplier,
      Syarat_Ketentuan: po.Syarat_Ketentuan,
      Status: po.Status
    });
    const related = poDetails.filter(d => d.ID_PO === po.ID_PO);
    if (related.length > 0) {
      setPoItems(related.map(r => ({
        Nama_Produk: r.Nama_Produk,
        Spesifikasi: r.Spesifikasi,
        Qty: r.Qty,
        Harga_Satuan: r.Harga_Satuan
      })));
    } else {
      setPoItems([{ Nama_Produk: 'Bahan Baku Kemasan AMDK', Spesifikasi: 'Standard', Qty: 1000, Harga_Satuan: 100 }]);
    }
    setShowPoModal(true);
  };

  const handleDeletePO = async (id: string) => {
    const po = poHeaders.find(h => h.ID_PO === id);
    const ok = await confirmAction({
      title: 'Hapus Purchase Order (PO)',
      message: `Hapus Purchase Order "${id}" secara permanen dari sistem?`,
      confirmText: 'Ya, Hapus PO',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. PO': id,
        'Supplier': po?.Supplier || (po as any)?.Order_Ke || (po as any)?.Nama_Supplier || '-',
        'Tanggal': po?.Tanggal || (po as any)?.Tanggal_PO || '-'
      }
    });
    if (!ok) return;

    await deleteTableRow('Admin_PO', id);
    await deleteTableRow('Admin_PO_Detail', id, 'ID_PO');

    const updatedH = poHeaders.filter(h => h.ID_PO !== id);
    const updatedD = poDetails.filter(d => d.ID_PO !== id);
    setPoHeaders(updatedH);
    setPoDetails(updatedD);
    onRefresh();
    showToastGlobal('PO Dihapus', `Purchase Order ${id} berhasil dihapus dari semua perangkat.`, 'success');
  };

  const formatDateIndonesia = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const bulanNama = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${d} ${bulanNama[m - 1]} ${y}`;
      }
      const dt = new Date(dateStr);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  };

  const handleDownloadPOPDF = async (po: AdminPOHeader) => {
    try {
      const details = poDetails.filter(d => d.ID_PO === po.ID_PO);
      const internalSig = (poSettings.signatories && poSettings.signatories.length > 1) 
        ? poSettings.signatories[1] 
        : (poSettings.signatories && poSettings.signatories.length === 1 ? poSettings.signatories[0] : null);

      await generatePurchaseOrderPDF({
        noPO: po.No_PO,
        tanggalPO: po.Tanggal_PO,
        orderKe: po.Order_Ke,
        alamatSupplier: po.Alamat_Supplier,
        syaratKetentuan: po.Syarat_Ketentuan,
        grandTotal: po.Grand_Total || 0,
        items: details.map(d => ({
          namaProduk: d.Nama_Produk,
          spesifikasi: d.Spesifikasi,
          qty: Number(d.Qty) || 0,
          hargaSatuan: Number(d.Harga_Satuan) || 0,
          totalHarga: Number(d.Total_Harga) || 0
        })),
        signatories: poSettings.signatories || [],
        customSettings: {
          namaPerusahaan: poSettings.namaPerusahaan || docSettings.namaPerusahaan,
          subNamaPerusahaan: poSettings.subNamaPerusahaan || docSettings.subNamaPerusahaan,
          alamatPerusahaan: poSettings.alamatPerusahaan || docSettings.alamatPerusahaan,
          kontakPerusahaan: poSettings.kontakPerusahaan || docSettings.kontakPerusahaan,
          customKopImage: (poSettings.useCustomKopImage && poSettings.customKopImage) ? poSettings.customKopImage : ((docSettings.useCustomKopImage && docSettings.customKopImage) ? docSettings.customKopImage : ''),
          useCustomKopImage: poSettings.useCustomKopImage || docSettings.useCustomKopImage,
          kopWidth: poSettings.kopWidth ?? docSettings.kopWidth ?? 100,
          kopHeight: poSettings.kopHeight ?? docSettings.kopHeight ?? 90,
          customCapImage: (poSettings.useCustomCapImage && poSettings.customCapImage) ? poSettings.customCapImage : ((docSettings.useCustomCapImage && docSettings.customCapImage) ? docSettings.customCapImage : ''),
          useCustomCapImage: poSettings.useCustomCapImage || docSettings.useCustomCapImage,
          showCap: poSettings.showCap ?? docSettings.showCap ?? true,
          capWidth: poSettings.capWidth ?? docSettings.capWidth ?? 80,
          capHeight: poSettings.capHeight ?? docSettings.capHeight ?? 80,
          customTtdImage: internalSig?.customTtdImage,
          useCustomTtdImage: internalSig?.useCustomTtdImage,
          showTtd: true,
          namaPenandatangan: internalSig?.nama || 'Marko Dwi Nugroho',
          jabatanPenandatangan: internalSig?.jabatan || 'Bag. Purcasing'
        }
      });
      showToastGlobal('PDF PO Berhasil Diunduh', `File Purchase Order ${po.No_PO} telah tersimpan.`, 'success');
    } catch (err) {
      console.error('Gagal unduh PDF PO:', err);
      showToastGlobal('Gagal Unduh PDF', 'Terjadi kesalahan saat memproses file PDF PO.', 'error');
    }
  };

  const handleAddPoItem = () => {
    setPoItems([...poItems, { Nama_Produk: '', Spesifikasi: '', Qty: '' as any, Harga_Satuan: '' as any }]);
  };

  const handleRemovePoItem = (idx: number) => {
    if (poItems.length <= 1) return;
    setPoItems(poItems.filter((_, i) => i !== idx));
  };

  const handleSavePO = () => {
    const d = new Date(poForm.Tanggal_PO);
    const poId = editingPO ? editingPO.ID_PO : `PO-${Date.now().toString().slice(-6)}`;
    const poNo = poForm.No_PO || `${String(poHeaders.length + 1).padStart(3, '0')}-PO-X-${d.getFullYear().toString().slice(-2)}`;
    let grandTotal = 0;
    const detailsToAdd: AdminPODetail[] = poItems.map((item, idx) => {
      const sub = Number(item.Qty) * Number(item.Harga_Satuan);
      grandTotal += sub;
      return {
        ID_Detail: `${poId}-D${idx + 1}`,
        ID_PO: poId,
        Nama_Produk: item.Nama_Produk,
        Nama_Barang: item.Nama_Produk,
        Spesifikasi: item.Spesifikasi || '',
        Qty: Number(item.Qty) || 0,
        Satuan: 'Pcs',
        Harga_Satuan: Number(item.Harga_Satuan) || 0,
        Total_Harga: sub,
        Subtotal: sub
      } as any;
    });

    if (editingPO) {
      const updatedH = poHeaders.map(h => h.ID_PO === editingPO.ID_PO ? {
        ...h,
        Tanggal_PO: poForm.Tanggal_PO,
        Tanggal: poForm.Tanggal_PO,
        No_PO: poNo,
        Order_Ke: poForm.Order_Ke,
        Nama_Supplier: poForm.Order_Ke,
        ID_Supplier: poForm.Order_Ke,
        Alamat_Supplier: poForm.Alamat_Supplier,
        Syarat_Ketentuan: poForm.Syarat_Ketentuan,
        Grand_Total: grandTotal,
        Total_Nilai: grandTotal,
        Status: poForm.Status
      } : h);
      const otherDetails = poDetails.filter(d => d.ID_PO !== editingPO.ID_PO);
      const updatedD = [...otherDetails, ...detailsToAdd];
      setTableData('Admin_PO', updatedH);
      setTableData('Admin_PO_Detail', updatedD);
      setPoHeaders(updatedH);
      setPoDetails(updatedD);
    } else {
      const newHeader: AdminPOHeader = {
        ID_PO: poId,
        Tanggal_PO: poForm.Tanggal_PO,
        Tanggal: poForm.Tanggal_PO,
        No_PO: poNo,
        Order_Ke: poForm.Order_Ke,
        Nama_Supplier: poForm.Order_Ke,
        ID_Supplier: poForm.Order_Ke,
        Alamat_Supplier: poForm.Alamat_Supplier,
        Syarat_Ketentuan: poForm.Syarat_Ketentuan,
        Grand_Total: grandTotal,
        Total_Nilai: grandTotal,
        Status: poForm.Status
      } as any;
      const updatedH = [...poHeaders, newHeader];
      const updatedD = [...poDetails, ...detailsToAdd];
      setTableData('Admin_PO', updatedH);
      setTableData('Admin_PO_Detail', updatedD);
      setPoHeaders(updatedH);
      setPoDetails(updatedD);
    }
    setShowPoModal(false);
    setEditingPO(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Purchase Order (PO) Pemasok</h3>
              <p className="text-xs text-slate-500">Seluruh dokumen pesanan pembelian dapat dicetak, diedit, atau dihapus.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                ref={poFileInputRef}
                onChange={handleImportPOFile}
                accept=".xlsx,.xls"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => downloadExcelTemplate('po')}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Download Template Excel PO & Detail 1 Baris"
              >
                <Download size={13} className="text-slate-500" />
                <span>Template Excel</span>
              </button>
              <button
                type="button"
                onClick={() => poFileInputRef.current?.click()}
                className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Impor File Excel Purchase Order (Format 1 Baris)"
              >
                <FileSpreadsheet size={13} />
                <span>Import Excel PO</span>
              </button>
              <button
                type="button"
                onClick={() => exportPOUnifiedToExcel(filteredPoHeaders, poDetails, 'AIRIS_PO_Supplier_1Baris')}
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Export seluruh data PO beserta detail barangnya menjadi 1 baris Excel"
              >
                <Download size={13} />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPOSettings}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Pengaturan Format Kop, Cap, & Penandatangan Purchase Order (PO)"
              >
                <Settings size={13} className="text-slate-500" />
                <span>Setting Format & TTD</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddPO}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Buat PO Baru</span>
              </button>
            </div>
          </div>

          {/* Filter Periode & Bulan Purchase Order (PO) */}
          <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 font-semibold">
                <Calendar size={14} className="text-blue-600" />
                <span>Filter Periode PO:</span>
              </div>

              {/* Pilihan Tahun */}
              <select
                value={poFilterYear}
                onChange={e => {
                  setPoFilterYear(e.target.value);
                  setPoFilterMonth('all');
                }}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                title="Pilih Tahun PO"
              >
                <option value="all">Semua Tahun ({poHeaders.length} PO)</option>
                {availablePoYears.map(y => (
                  <option key={y.year} value={y.year}>
                    Tahun {y.year} ({y.count} PO)
                  </option>
                ))}
              </select>

              {/* Pilihan Bulan Cepat */}
              <select
                value={poFilterMonth}
                onChange={e => {
                  const val = e.target.value;
                  setPoFilterMonth(val);
                  if (val !== 'all') {
                    setPoFilterYear(val.slice(0, 4));
                  }
                }}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                title="Pilih Bulan Spesifik"
              >
                <option value="all">
                  {poFilterYear === 'all' ? `Semua Bulan (${poHeaders.length} PO)` : `Seluruh Bulan di Tahun ${poFilterYear}`}
                </option>
                {availablePoMonths.map(m => (
                  <option key={m.period} value={m.period}>
                    Ã°Å¸â€”â€œÃ¯Â¸Â {formatPoMonthName(m.period)} ({m.count} PO)
                  </option>
                ))}
              </select>

              {/* Input Bulan type="month" */}
              <input
                type="month"
                value={poFilterMonth === 'all' ? '' : poFilterMonth}
                onChange={e => {
                  const val = e.target.value || 'all';
                  setPoFilterMonth(val);
                  if (val !== 'all') {
                    setPoFilterYear(val.slice(0, 4));
                  }
                }}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-slate-50 text-slate-700 font-mono"
                title="Pilih Bulan & Tahun Kustom"
              />

              {/* Tombol Pintas Bulan Ini */}
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const yr = String(now.getFullYear());
                  const ym = `${yr}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  setPoFilterYear(yr);
                  setPoFilterMonth(ym);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
              >
                Bulan Ini
              </button>

              {(poFilterMonth !== 'all' || poFilterYear !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setPoFilterMonth('all');
                    setPoFilterYear('all');
                  }}
                  className="px-2.5 py-1.5 text-xs rounded-lg font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  Reset (Semua)
                </button>
              )}
            </div>

            {/* Ringkasan Nilai PO Terfilter */}
            <div className="flex items-center gap-3 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
              <span className="text-slate-500 font-sans">Total PO: <strong className="text-slate-800 font-mono">{filteredPoHeaders.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 font-sans">Total Nilai: <strong className="text-blue-700 font-mono">Rp {filteredPoHeaders.reduce((sum, p) => sum + (Number(p.Total_Nilai_PO) || 0), 0).toLocaleString('id-ID')}</strong></span>
            </div>
          </div>

          {/* Search Bar Purchase Order */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari No PO, Pemasok / Vendor, Status, Tanggal..."
                value={poSearchQuery}
                onChange={e => setPoSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
              />
              {poSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPoSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                {filteredPoHeaders.length} Dokumen PO
              </span>
              {poSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPoSearchQuery('')}
                  className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <X size={12} />
                  <span>Reset Cari</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">No. PO</th>
                  <th className="p-3">Tanggal PO</th>
                  <th className="p-3">Pemasok / Vendor</th>
                  <th className="p-3 text-right">Nilai Pesanan</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredPoHeaders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 fst-italic font-sans">
                      {poSearchQuery 
                        ? `Tidak ada dokumen PO yang cocok dengan kata kunci "${poSearchQuery}".`
                        : 'Belum ada dokumen Purchase Order (PO) yang diterbitkan.'}
                    </td>
                  </tr>
                ) : (
                  filteredPoHeaders.map(po => (
                    <tr key={po.ID_PO} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-blue-700">{po.No_PO}</td>
                      <td className="p-3 text-slate-500">{po.Tanggal_PO}</td>
                      <td className="p-3 font-sans font-semibold text-slate-900">{po.Order_Ke}</td>
                      <td className="p-3 text-right font-bold text-slate-900 tabular-nums">Rp {po.Grand_Total?.toLocaleString('id-ID')}</td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                          {po.Status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewPoModal(po)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Lihat Dokumen PO Resmi"
                          >
                            <Eye size={12} />
                            <span>Lihat</span>
                          </button>
                          <button
                            onClick={() => handleDownloadPOPDF(po)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-200 cursor-pointer transition-colors"
                            title="Unduh File PDF PO Resmi"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            onClick={() => handleOpenEditPO(po)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            title="Edit PO"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeletePO(po.ID_PO)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Hapus PO"
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

      {showPoModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPoModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingPO ? `Edit Purchase Order (${editingPO.No_PO})` : 'Terbitkan Purchase Order (PO) Baru'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowPoModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal PO</label>
                  <input
                    type="date"
                    value={poForm.Tanggal_PO}
                    onChange={e => setPoForm({ ...poForm, Tanggal_PO: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor PO</label>
                  <input
                    type="text"
                    value={poForm.No_PO}
                    onChange={e => setPoForm({ ...poForm, No_PO: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pemasok / Vendor Tujuan</label>
                  <select
                    value={poForm.Order_Ke}
                    onChange={e => {
                      const sup = suppliers.find(s => s.Nama_Supplier === e.target.value);
                      setPoForm({
                        ...poForm,
                        Order_Ke: e.target.value,
                        Alamat_Supplier: sup?.Alamat || poForm.Alamat_Supplier
                      });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  >
                    {suppliers.map(s => (
                      <option key={s.ID_Supplier} value={s.Nama_Supplier}>{s.Nama_Supplier} ({s.PIC})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Pemasok</label>
                  <input
                    type="text"
                    value={poForm.Alamat_Supplier}
                    onChange={e => setPoForm({ ...poForm, Alamat_Supplier: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none text-slate-700"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-800 uppercase text-[11px]">Rincian Barang yang Dipesan</label>
                  <button
                    type="button"
                    onClick={handleAddPoItem}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Tambah Baris</span>
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {poItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Nama Barang..."
                          value={item.Nama_Produk}
                          onChange={e => {
                            const newItems = [...poItems];
                            newItems[idx].Nama_Produk = e.target.value;
                            setPoItems(newItems);
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          placeholder="Spesifikasi..."
                          value={item.Spesifikasi}
                          onChange={e => {
                            const newItems = [...poItems];
                            newItems[idx].Spesifikasi = e.target.value;
                            setPoItems(newItems);
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-600"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="0"
                          value={item.Qty ?? ''}
                          onChange={e => {
                            const newItems = [...poItems];
                            newItems[idx].Qty = e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0);
                            setPoItems(newItems);
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="0"
                          value={item.Harga_Satuan ?? ''}
                          onChange={e => {
                            const newItems = [...poItems];
                            newItems[idx].Harga_Satuan = e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0);
                            setPoItems(newItems);
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePoItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Syarat & Ketentuan Pengadaan</label>
                <textarea
                  rows={2}
                  value={poForm.Syarat_Ketentuan}
                  onChange={e => setPoForm({ ...poForm, Syarat_Ketentuan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none text-slate-700"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0 sticky bottom-0 z-20">
              <button onClick={() => setShowPoModal(false)} className="px-3.5 py-2 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSavePO} className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>{editingPO ? 'Perbarui PO' : 'Terbitkan PO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View PO Document */}
      {viewPoModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto printable-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setViewPoModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] printable-modal-card">
            {/* Header Modal Bar */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-30 shadow-sm no-print">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider truncate max-w-md">
                  Dokumen Purchase Order (PO): {viewPoModal.No_PO}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPOPDF(viewPoModal)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                  title="Unduh Dokumen PO Format Resmi PDF"
                >
                  <Download size={13} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                  title="Cetak Dokumen PO A4"
                >
                  <Printer size={13} />
                  <span>Cetak A4</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenPOSettings}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ml-1"
                  title="Atur Format Dokumen & Penandatangan PO"
                >
                  <Settings size={13} className="text-amber-400" />
                  <span className="hidden sm:inline">Setting PO</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setViewPoModal(null)} 
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors ml-1"
                  title="Tutup (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Konten Dokumen PO Resmi (Format 100% Persis Dokumen Cetak/Upload) */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 font-sans text-slate-900 bg-white printable-content printable-scroll-area">
              {/* 1. KOP SURAT PO (Sesuai Settingan PO: Custom Image, Custom Teks, atau Banner Resmi AIR) */}
              <div className="w-full mb-3">
                {((poSettings.useCustomKopImage && poSettings.customKopImage) || (docSettings.useCustomKopImage && docSettings.customKopImage)) ? (
                  <div className="flex items-center justify-center">
                    <img
                      src={(poSettings.useCustomKopImage && poSettings.customKopImage) ? poSettings.customKopImage : (docSettings.customKopImage || '')}
                      alt="Kop Dokumen PO"
                      style={{
                        width: `${Math.min(poSettings.kopWidth ?? docSettings.kopWidth ?? 100, 100)}%`,
                        height: `${poSettings.kopHeight ?? docSettings.kopHeight ?? 90}px`,
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                ) : (
                  <div className="pb-3 border-b-2 border-slate-900">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      {poSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                    </h3>
                    {poSettings.subNamaPerusahaan && (
                      <p className="text-xs text-slate-600 font-semibold">{poSettings.subNamaPerusahaan}</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {poSettings.alamatPerusahaan || 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara'} Ã¢â‚¬Â¢ Kontak: {poSettings.kontakPerusahaan || '0856 4000 1926'}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. JUDUL DOKUMEN & METADATA (Di Kanan) */}
              <div className="flex justify-end text-right my-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0052cc] tracking-tight">Purchase Order</h2>
                  <div className="mt-1 text-xs text-slate-800 font-medium space-y-0.5">
                    <div>No : <span className="font-semibold text-slate-900">{viewPoModal.No_PO}</span></div>
                    <div>Tanggal : <span className="font-semibold text-slate-900">{formatDateIndonesia(viewPoModal.Tanggal_PO)}</span></div>
                  </div>
                </div>
              </div>

              {/* 3. INFO PEMESAN & ORDER KE (2 Columns Sejajar) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10 my-4 text-xs text-slate-800">
                {/* Kiri: Info Pemesan */}
                <div>
                  <div className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 text-xs">Info Pemesan</div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">
                    {poSettings.namaPerusahaan || docSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                  </div>
                  <div className="text-slate-700 leading-relaxed mt-1 text-xs whitespace-pre-line">
                    {poSettings.alamatPerusahaan || docSettings.alamatPerusahaan || 'Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan,\nKec. Klaten Utara, Kab. Klaten, 57438'}
                  </div>
                </div>

                {/* Kanan: Order Ke */}
                <div>
                  <div className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 text-xs">Order Ke</div>
                  <div className="font-bold text-slate-900 uppercase text-xs sm:text-sm">
                    {viewPoModal.Order_Ke}
                  </div>
                  <div className="text-slate-700 leading-relaxed mt-1 text-xs whitespace-pre-line">
                    {viewPoModal.Alamat_Supplier || '-'}
                  </div>
                </div>
              </div>

              {/* 4. TABEL PRODUK (Header Dark Navy #0b2546 persis mockup) */}
              <div className="overflow-x-auto my-5">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0b2546] text-white font-bold text-xs">
                      <th className="py-2.5 px-3 text-left w-[42%]">Produk</th>
                      <th className="py-2.5 px-3 text-center w-[15%]">QTY</th>
                      <th className="py-2.5 px-3 text-center sm:text-right w-[20%]">Harga</th>
                      <th className="py-2.5 px-3 text-right w-[23%]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poDetails.filter(d => d.ID_PO === viewPoModal.ID_PO).map((item) => (
                      <tr key={item.ID_Detail} className="text-xs">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 uppercase">{item.Nama_Produk}</div>
                          {item.Spesifikasi && (
                            <div className="text-[11px] text-slate-500 mt-0.5 font-normal">{item.Spesifikasi}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-900">
                          {item.Qty.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center sm:text-right font-medium text-slate-900">
                          Rp{item.Harga_Satuan.toLocaleString('id-ID')},00
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                          Rp{item.Total_Harga.toLocaleString('id-ID')},00
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Baris Total bergaris tebal di atas dan bawah */}
                <div className="border-t-2 border-b-2 border-slate-900 py-2.5 mt-3 flex justify-between items-center text-xs sm:text-sm font-bold text-slate-900">
                  <div className="w-[55%] text-right pr-6">Total :</div>
                  <div className="w-[45%] text-right font-mono text-sm sm:text-base">
                    Rp{viewPoModal.Grand_Total?.toLocaleString('id-ID')},00
                  </div>
                </div>
              </div>

              {/* 5. SYARAT & KETENTUAN (Di Kiri) */}
              <div className="my-5 text-xs text-slate-800">
                <div className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 max-w-xs">
                  Syarat & Ketentuan
                </div>
                <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                  {viewPoModal.Syarat_Ketentuan || 'Kirim sesuai instruksi dan kesepakatan order.'}
                </div>
              </div>

              {/* 6. TANDA TANGAN DARI PO SETTINGS (Dinamis: 1 Penandatangan di kanan bawah, atau multiple penandatangan sejajar) */}
              {(() => {
                const sigList = (poSettings.signatories && poSettings.signatories.length > 0)
                  ? poSettings.signatories
                  : [{
                      id: 'single',
                      keterangan: `Klaten, ${formatDateIndonesia(viewPoModal.Tanggal_PO)}`,
                      nama: poSettings.namaPenandatangan || 'Marko Dwi Nugroho',
                      jabatan: poSettings.jabatanPenandatangan || 'Bag. Purcasing',
                      useCustomTtdImage: false
                    }];

                const showCap = poSettings.showCap ?? true;
                const useCustomCap = Boolean(poSettings.useCustomCapImage && poSettings.customCapImage);
                const capImg = useCustomCap ? poSettings.customCapImage : null;
                const capW = poSettings.capWidth ?? 85;

                if (sigList.length === 1) {
                  const sig = sigList[0];
                  const hasCustomTtd = Boolean(sig.customTtdImage && sig.customTtdImage.trim().length > 30);
                  const isMarko = String(sig?.nama || '').toLowerCase().includes('marko');

                  return (
                    <div className="flex justify-end mt-6 text-center">
                      <div className="inline-flex flex-col items-center min-w-[210px]">
                        <div className="text-xs text-slate-800 mb-1">
                          {sig.keterangan && sig.keterangan.trim() ? sig.keterangan : `Klaten, ${formatDateIndonesia(viewPoModal.Tanggal_PO)}`}
                        </div>

                        <div className="my-1 relative flex items-center justify-center select-none pointer-events-none min-h-[95px] w-[190px]">
                          {/* Cap Stempel jika aktif dan ada gambar custom */}
                          {showCap && capImg && (
                            <img
                              src={capImg}
                              alt="Cap Stempel"
                              style={{ width: `${capW}px`, height: `${capW}px` }}
                              className="absolute left-1 top-0 object-contain"
                            />
                          )}

                          {/* TTD: Custom upload atau ruang kosong tanda tangan basah */}
                          {hasCustomTtd && sig.customTtdImage ? (
                            <img
                              src={sig.customTtdImage}
                              alt="TTD"
                              style={{ maxHeight: '75px', maxWidth: '140px' }}
                              className="object-contain z-10"
                            />
                          ) : (
                            <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 italic">
                              [ Tanda Tangan Basah ]
                            </div>
                          )}
                        </div>

                        <div className="mt-1 text-center">
                          <div className="text-xs font-bold text-slate-900 border-b border-slate-900 inline-block px-1">
                            {sig.nama}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {sig.jabatan}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Multiple Signatories (Sejajar Rapi Horizontal)
                return (
                  <div className="pt-6 border-t border-slate-200 mt-6">
                    <div 
                      className="grid gap-6 text-center"
                      style={{ gridTemplateColumns: `repeat(${sigList.length}, minmax(130px, 1fr))` }}
                    >
                      {sigList.map((sig, idx) => {
                        const isInternal = idx === 1 || (idx === sigList.length - 1 && sigList.length > 1);
                        const hasCustomTtd = Boolean(sig.customTtdImage && sig.customTtdImage.trim().length > 30);
                        const isMarko = String(sig?.nama || '').toLowerCase().includes('marko');

                        return (
                          <div key={sig.id} className="flex flex-col justify-between min-w-[130px]">
                            <div className="h-8 flex items-end justify-center text-xs text-slate-600 mb-1 font-medium">
                              <span>{sig.keterangan || (idx === 0 ? 'Diterima & Dikonfirmasi Vendor,' : 'Hormat Kami (AIRIS),')}</span>
                            </div>

                            <div className="h-24 relative flex items-center justify-center my-1 select-none pointer-events-none">
                              {isInternal && showCap && capImg && (
                                <img
                                  src={capImg}
                                  alt="Cap Stempel"
                                  style={{ width: `${capW}px`, height: `${capW}px` }}
                                  className="absolute left-1 top-0 object-contain"
                                />
                              )}

                              {hasCustomTtd && sig.customTtdImage ? (
                                <img
                                  src={sig.customTtdImage}
                                  alt="TTD"
                                  style={{ maxHeight: '75px', maxWidth: '120px' }}
                                  className="object-contain z-10"
                                />
                              ) : (
                                <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 italic">
                                  [ Tanda Tangan Basah ]
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-900 mt-1">
                              <p className="text-xs font-bold text-slate-900 whitespace-nowrap">
                                {sig.nama}
                              </p>
                              <p className="text-[11px] text-slate-500 whitespace-nowrap mt-0.5">
                                {sig.jabatan}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer Modal Bar */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-30 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPOPDF(viewPoModal)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Download size={14} />
                  <span>Unduh PDF Resmi</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Printer size={14} />
                  <span>Cetak Dokumen PO</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenPOSettings}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs ml-1"
                >
                  <Settings size={13} className="text-amber-500" />
                  <span>Setting PO</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewPoModal(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Tutup Pratinjau PO (Esc)"
              >
                <X size={14} />
                <span>Tutup & Kembali</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PENGATURAN FORMAT & PENANDATANGAN PURCHASE ORDER (PO)  */}
      {/* ============================================================== */}
      {showPOSettingsModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPOSettingsModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-amber-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  Pengaturan Format Dokumen & Penandatangan PO
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowPOSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
              <p className="text-slate-600 leading-relaxed bg-amber-50 border border-amber-200 p-3 rounded-lg">
                Atur kop, stempel, serta <strong>daftar penandatangan Purchase Order (PO)</strong>. Anda dapat menambah, mengurangi, atau mengatur posisi penandatangan (Vendor, Purchasing, Direktur, dll.) serta mengunggah gambar tanda tangan atau membiarkannya kosong untuk tanda tangan basah fisik.
              </p>

              {/* Seksi 1: Kop Header PO */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  1. Kop Dokumen Purchase Order
                </h4>

                <div className="space-y-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan (Kop PO)</label>
                    <input
                      type="text"
                      value={tempPOSettings.namaPerusahaan || ''}
                      onChange={e => setTempPOSettings({ ...tempPOSettings, namaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-semibold text-slate-900 text-xs"
                      placeholder="PT. ANUGERAH ILLAHI RABBI"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sub Nama / Tagline Instansi</label>
                    <input
                      type="text"
                      value={tempPOSettings.subNamaPerusahaan || ''}
                      onChange={e => setTempPOSettings({ ...tempPOSettings, subNamaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs"
                      placeholder="Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor / Pabrik</label>
                    <input
                      type="text"
                      value={tempPOSettings.alamatPerusahaan || ''}
                      onChange={e => setTempPOSettings({ ...tempPOSettings, alamatPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs"
                      placeholder="Dk. Gading Baru, RT.03, RW.08, Belangwetan, Klaten Utara, Klaten"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kontak Resmi (Telepon / Email)</label>
                    <input
                      type="text"
                      value={tempPOSettings.kontakPerusahaan || ''}
                      onChange={e => setTempPOSettings({ ...tempPOSettings, kontakPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs"
                      placeholder="0856 4000 1926 | (0272) 898123"
                    />
                  </div>
                </div>

                {/* Upload Gambar Kop PO */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Image size={13} className="text-slate-500" />
                      <span>Gunakan Gambar Kop Custom Sendiri untuk Dokumen PO</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={tempPOSettings.useCustomKopImage || false}
                      onChange={e => setTempPOSettings({ ...tempPOSettings, useCustomKopImage: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>

                  {tempPOSettings.useCustomKopImage && (
                    <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const b64 = await compressUploadedImage(file, 900, 180);
                            setTempPOSettings({ ...tempPOSettings, customKopImage: b64 });
                          }}
                          className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        />
                        {tempPOSettings.customKopImage && (
                          <button
                            type="button"
                            onClick={() => setTempPOSettings({ ...tempPOSettings, customKopImage: '' })}
                            className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                          >
                            Hapus Gambar
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">
                            Lebar Kop: <strong>{tempPOSettings.kopWidth ?? 100}%</strong>
                          </label>
                          <input
                            type="range"
                            min="30"
                            max="100"
                            value={tempPOSettings.kopWidth ?? 100}
                            onChange={e => setTempPOSettings({ ...tempPOSettings, kopWidth: Number(e.target.value) })}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">
                            Tinggi Kop: <strong>{tempPOSettings.kopHeight ?? 90}px</strong>
                          </label>
                          <input
                            type="range"
                            min="40"
                            max="200"
                            step="5"
                            value={tempPOSettings.kopHeight ?? 90}
                            onChange={e => setTempPOSettings({ ...tempPOSettings, kopHeight: Number(e.target.value) })}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>

                      {tempPOSettings.customKopImage && (
                        <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                          <img
                            src={tempPOSettings.customKopImage}
                            alt="Preview Kop PO"
                            style={{
                              width: `${tempPOSettings.kopWidth ?? 100}%`,
                              height: `${tempPOSettings.kopHeight ?? 90}px`,
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Seksi 2: Cap Stempel PO */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  2. Cap / Stempel Resmi pada PO
                </h4>

                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Tampilkan Cap / Stempel pada PO</label>
                  <input
                    type="checkbox"
                    checked={tempPOSettings.showCap ?? true}
                    onChange={e => setTempPOSettings({ ...tempPOSettings, showCap: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="font-semibold text-slate-700">Gunakan Gambar Cap Custom Sendiri</label>
                  <input
                    type="checkbox"
                    checked={tempPOSettings.useCustomCapImage || false}
                    onChange={e => setTempPOSettings({ ...tempPOSettings, useCustomCapImage: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                {tempPOSettings.useCustomCapImage && (
                  <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const b64 = await compressUploadedImage(file, 200, 200);
                          setTempPOSettings({ ...tempPOSettings, customCapImage: b64 });
                        }}
                        className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                      {tempPOSettings.customCapImage && (
                        <button
                          type="button"
                          onClick={() => setTempPOSettings({ ...tempPOSettings, customCapImage: '' })}
                          className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus Cap
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Ukuran Cap: <strong>{tempPOSettings.capWidth ?? 80}px</strong>
                      </label>
                      <input
                        type="range"
                        min="40"
                        max="160"
                        step="5"
                        value={tempPOSettings.capWidth ?? 80}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setTempPOSettings({ ...tempPOSettings, capWidth: val, capHeight: val });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {tempPOSettings.customCapImage && (
                      <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                        <img
                          src={tempPOSettings.customCapImage}
                          alt="Cap Custom PO"
                          style={{
                            width: `${tempPOSettings.capWidth ?? 80}px`,
                            height: `${tempPOSettings.capHeight ?? 80}px`,
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Live Preview Stempel PO */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">Pratinjau Cap Stempel pada PO:</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tempPOSettings.showCap !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tempPOSettings.showCap !== false ? 'Cap Aktif (Akan Dicetak)' : 'Cap Nonaktif (Tanpa Stempel)'}
                    </span>
                  </div>
                  {tempPOSettings.showCap !== false && tempPOSettings.useCustomCapImage && tempPOSettings.customCapImage ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-center min-h-[90px]">
                      <img
                        src={tempPOSettings.customCapImage}
                        alt="Cap Stempel PO"
                        style={{
                          width: `${tempPOSettings.capWidth ?? 80}px`,
                          height: `${tempPOSettings.capHeight ?? 80}px`,
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center text-slate-400 text-xs italic">
                      {tempPOSettings.showCap !== false 
                        ? 'Belum ada gambar cap kustom yang diunggah (dokumen dicetak bersih tanpa gambar stempel tiruan).'
                        : 'Dokumen PO akan dicetak bersih tanpa cap stempel (tanda tangan polos)'}
                    </div>
                  )}
                </div>
              </div>

              {/* Seksi 3: Daftar Penandatangan PO (Multiple Dinamis & Aligned) */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                    3. Daftar Penandatangan Dokumen PO
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddPOSignatory}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <UserPlus size={13} />
                    <span>+ Tambah Penandatangan PO</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500">
                  Seluruh penandatangan akan otomatis disejajarkan secara horizontal pada dokumen PO agar cetakan rapi dan profesional.
                </p>

                {/* Pilihan Preset Penandatangan Cepat */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">Pilihan Format Cepat Penandatangan:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPOSignatoryPreset('single')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        (tempPOSettings.signatories?.length || 0) === 1
                          ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-blue-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs">1 Orang (Purchasing)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Kanan bawah (Sesuai File Upload)</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPOSignatoryPreset('dual')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        (tempPOSettings.signatories?.length || 0) === 2
                          ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-blue-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs">2 Orang (Vendor & Purchasing)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Sejajar Kiri & Kanan</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPOSignatoryPreset('triple')}
                      className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                        (tempPOSettings.signatories?.length || 0) === 3
                          ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-200 hover:border-blue-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs">3 Orang Lengkap</div>
                      <div className="text-[10px] text-slate-500 font-normal">Vendor, Purchasing, Direktur</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {(tempPOSettings.signatories || []).map((sig, idx) => (
                    <div key={sig.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 inline-flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          Posisi Penandatangan #{idx + 1}
                        </span>
                        {(tempPOSettings.signatories?.length || 1) > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePOSignatory(sig.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer transition-colors"
                            title="Hapus penandatangan ini dari PO"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Keterangan / Pengesahan</label>
                          <input
                            type="text"
                            value={sig.keterangan}
                            onChange={e => handleUpdatePOSignatory(sig.id, 'keterangan', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                            placeholder="Diterima Vendor / Dibuat Oleh / Disetujui,"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Nama Terang</label>
                          <input
                            type="text"
                            value={sig.nama}
                            onChange={e => handleUpdatePOSignatory(sig.id, 'nama', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900 text-xs"
                            placeholder="Nama Pejabat / Pihak"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-0.5">Jabatan / Bagian</label>
                          <input
                            type="text"
                            value={sig.jabatan}
                            onChange={e => handleUpdatePOSignatory(sig.id, 'jabatan', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs"
                            placeholder="Staff Purchasing / Direktur / Vendor"
                          />
                        </div>
                      </div>

                      {/* Upload Gambar Tanda Tangan (Opsional) */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-600 font-medium">Gambar TTD (opsional):</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const b64 = await compressUploadedImage(file, 300, 150);
                              handleUpdatePOSignatoryMultiple(sig.id, {
                                customTtdImage: b64,
                                useCustomTtdImage: true
                              });
                              showToastGlobal('Tanda tangan berhasil diunggah', 'success');
                            }}
                            className="text-[11px] text-slate-600 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                          />
                        </div>

                        {sig.customTtdImage ? (
                          <div className="flex items-center gap-2">
                            <img src={sig.customTtdImage} alt="TTD PO" className="h-8 w-auto max-w-[80px] object-contain border border-slate-200 rounded p-0.5 bg-white shadow-2xs" />
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdatePOSignatoryMultiple(sig.id, {
                                  customTtdImage: '',
                                  useCustomTtdImage: false
                                });
                              }}
                              className="text-[11px] text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                            >
                              Kosongkan TTD (Fisik)
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 italic">
                              (Kosong = Ruang tanda tangan basah fisik)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-20">
              <button
                type="button"
                onClick={handleResetPOSettings}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-700 border border-slate-300 rounded-lg hover:bg-red-50 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Kembalikan penandatangan PO ke standar (Vendor, Purchasing, Direktur)"
              >
                <RotateCcw size={13} />
                <span>Reset ke Standar</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPOSettingsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSavePOSettings}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Save size={14} />
                  <span>Simpan Pengaturan PO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
