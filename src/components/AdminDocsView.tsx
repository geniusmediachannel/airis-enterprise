import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Printer, Download, Eye, 
  Trash2, Edit2, FileCheck, X, Building, Save, FileText,
  FileDown, Send, CheckCircle2, Copy, Receipt, Truck, ShoppingBag, Search, Check, RefreshCw, Calendar,
  Settings, Image, Sliders, RotateCcw, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Palette, Table2, UserPlus, UserMinus, ChevronDown, ChevronUp, BookOpen, Sparkles
} from 'lucide-react';
import { 
  AdminPOHeader, AdminPODetail, SupplierItem, RawMaterialItem,
  OfficialLetterItem, SuratType, CustomerItem, DistributionItem, DistributionProductDetail,
  ProductItem, CustomInvoiceItem, CustomInvoiceDetailItem, DocumentTemplateSettings,
  ShipmentGroup, TextStyleSettings, LetterSignatory, LetterDocumentSettings, POSignatory, PODocumentSettings
} from '../types';
import { getTableData, setTableData } from '../services/dbAdapter';
import { exportDataToExcel, ExcelTemplateType } from '../services/excelService';
import { generateOfficialLetterPDF, generateInvoicePDF, generatePurchaseOrderPDF, sanitizeFilename, angkaKeTerbilang, formatRupiahSen } from '../services/pdfService';
import { KopSuratBanner, OfficialStampWithSignature, OfficialCapStamp, OfficialTtdMarko } from './InvoiceOfficialAssets';
import { showToast as showToastGlobal } from './ToastContainer';
import { confirmAction } from './ConfirmDialog';

interface AdminDocsViewProps {
  suppliers: SupplierItem[];
  rawMaterials: RawMaterialItem[];
  customers?: CustomerItem[];
  distributions?: DistributionItem[];
  distributionItems?: DistributionProductDetail[];
  products?: ProductItem[];
  onRefresh: () => void;
}

export const AdminDocsView: React.FC<AdminDocsViewProps> = ({
  suppliers,
  rawMaterials,
  customers = [],
  distributions = [],
  distributionItems = [],
  products = [],
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'surat' | 'po' | 'invoice_custom'>('surat');

  // Letters Collection
  const [letters, setLetters] = useState<OfficialLetterItem[]>(() => {
    const data = getTableData<OfficialLetterItem>('Data_Surat', []);
    return Array.isArray(data) ? data : [];
  });
  const [poHeaders, setPoHeaders] = useState<AdminPOHeader[]>(() => {
    const data = getTableData<AdminPOHeader>('Admin_PO', []);
    return Array.isArray(data) ? data : [];
  });
  const [poDetails, setPoDetails] = useState<AdminPODetail[]>(() => {
    const data = getTableData<AdminPODetail>('Admin_PO_Detail', []);
    return Array.isArray(data) ? data : [];
  });
  const [customInvoices, setCustomInvoices] = useState<CustomInvoiceItem[]>(() => {
    const data = getTableData<CustomInvoiceItem>('Data_Custom_Invoice', []);
    return Array.isArray(data) ? data : [];
  });

  // Search Queries for Admin Modules
  const [letterSearchQuery, setLetterSearchQuery] = useState<string>('');
  const [poSearchQuery, setPoSearchQuery] = useState<string>('');

  // Filtered Letters (Surat Resmi) dengan pencarian teks
  const filteredLetters = useMemo(() => {
    let list = Array.isArray(letters) ? letters : [];
    if (letterSearchQuery.trim()) {
      const q = letterSearchQuery.toLowerCase();
      list = list.filter(l => 
        l && (
          String(l.Nomor_Surat || '').toLowerCase().includes(q) ||
          String(l.Perihal || '').toLowerCase().includes(q) ||
          String(l.Kepada || '').toLowerCase().includes(q) ||
          String(l.Tipe_Surat || '').toLowerCase().includes(q) ||
          String(l.Penandatangan_Nama || '').toLowerCase().includes(q) ||
          String(l.Isi_Surat || '').toLowerCase().includes(q) ||
          String(l.Tanggal || '').toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [letters, letterSearchQuery]);

  // Filtered Purchase Orders dengan pencarian teks
  const filteredPoHeaders = useMemo(() => {
    let list = Array.isArray(poHeaders) ? poHeaders : [];
    if (poSearchQuery.trim()) {
      const q = poSearchQuery.toLowerCase();
      list = list.filter(p => 
        p && (
          String(p.No_PO || '').toLowerCase().includes(q) ||
          String(p.Order_Ke || '').toLowerCase().includes(q) ||
          String(p.Alamat_Supplier || '').toLowerCase().includes(q) ||
          String(p.Status || '').toLowerCase().includes(q) ||
          String(p.Tanggal_PO || '').toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [poHeaders, poSearchQuery]);

  // Modals for Letters
  const [showLetterEditorModal, setShowLetterEditorModal] = useState(false);
  const [editingLetter, setEditingLetter] = useState<OfficialLetterItem | null>(null);
  const [viewLetterModal, setViewLetterModal] = useState<OfficialLetterItem | null>(null);

  // Form State for Letter Editor
  const [letterForm, setLetterForm] = useState<OfficialLetterItem>({
    ID_Surat: '',
    Nomor_Surat: '',
    Tipe_Surat: 'Surat Eksternal',
    Tanggal: new Date().toISOString().slice(0, 10),
    Perihal: '',
    Lampiran: '',
    Kepada: '',
    Alamat_Tujuan: '',
    Isi_Surat: '',
    Penandatangan_Nama: 'H. Mujiburrahman, SIP',
    Penandatangan_Jabatan: 'Direktur Utama',
    Tembusan: '',
    Dibuat_Oleh: 'Admin Sekretariat'
  });

  // Modals for PO
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

  // Modals and State for Custom Invoice
  const [showCustomInvoiceModal, setShowCustomInvoiceModal] = useState<boolean>(false);
  const [editingCustomInvoice, setEditingCustomInvoice] = useState<CustomInvoiceItem | null>(null);
  const [viewCustomInvoiceModal, setViewCustomInvoiceModal] = useState<CustomInvoiceItem | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState<string>('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  // Default Custom Invoice Form
  const defaultInvoiceForm: CustomInvoiceItem = {
    ID_Invoice: '',
    No_Invoice: '',
    Tanggal: new Date().toISOString().slice(0, 10),
    Jatuh_Tempo: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    Nama_Pelanggan: '',
    Level_Pelanggan: 'Distributor',
    Alamat_Pelanggan: '',
    No_Kontak: '',
    No_PO_Pelanggan: '',
    No_Surat_Jalan_List: [],
    ID_Distribusi_List: [],
    Metode_Kirim: 'Armada Pabrik',
    Penerima: '',
    Keterangan: '',
    Items: [
      {
        Nama_Produk: '',
        Spesifikasi: '',
        Qty: '' as any,
        Satuan: 'Dus',
        Harga_Satuan: '' as any,
        Subtotal: 0
      }
    ],
    Subtotal: 0,
    Potongan_Ekspedisi: 0,
    Diskon: 0,
    Pajak_PPN: 0,
    Grand_Total: 0,
    Status: 'Terkirim',
    Dibuat_Oleh: 'Admin Penjualan & Distribusi',
    Waktu_Input: new Date().toISOString()
  };

  const [invoiceForm, setInvoiceForm] = useState<CustomInvoiceItem>(defaultInvoiceForm);

  // Document Template Settings State (Kop Surat, Cap, TTD, Penandatangan, Info Pembayaran)
  const defaultDocSettings: DocumentTemplateSettings = {
    namaPerusahaan: 'PT. ANUGERAH ILLAHI RABBI',
    subNamaPerusahaan: 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa',
    alamatPerusahaan: 'Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan, Kec. Klaten Utara, Kab. Klaten, 57438',
    kontakPerusahaan: '0856 4000 1926 | anugerahillahirabbi@gmail.com',
    customKopImage: '',
    useCustomKopImage: false,
    kopWidth: 100,
    kopHeight: 90,
    customCapImage: '',
    useCustomCapImage: false,
    showCap: true,
    capWidth: 80,
    capHeight: 80,
    customTtdImage: '',
    useCustomTtdImage: false,
    showTtd: true,
    ttdWidth: 110,
    ttdHeight: 75,
    namaPenandatangan: 'Marko Dwi Nugroho',
    jabatanPenandatangan: 'Admin',
    infoPembayaranTeks: 'Pembayaran dapat dilakukan transfer atau Cash / By Driver',
    bankRekening: 'BSI 1607134444 (KSPPS BMT SYECH HASYIM ASYARI)'
  };

  const [docSettings, setDocSettings] = useState<DocumentTemplateSettings>(() => {
    return getTableData<DocumentTemplateSettings>('Pengaturan_Dokumen', [defaultDocSettings])[0] || defaultDocSettings;
  });
  const [showDocSettingsModal, setShowDocSettingsModal] = useState<boolean>(false);
  const [tempDocSettings, setTempDocSettings] = useState<DocumentTemplateSettings>(() => docSettings);

  // ==================== PENGATURAN DOKUMEN SURAT RESMI ====================
  const defaultGlobalLetterSettings: LetterDocumentSettings = {
    namaPerusahaan: 'PT. ANUGERAH ILLAHI RABBI',
    subNamaPerusahaan: 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa',
    alamatPerusahaan: 'Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan, Kec. Klaten Utara, Kab. Klaten, 57438',
    kontakPerusahaan: '0856 4000 1926 | official@airis-amdk.com',
    customKopImage: '',
    useCustomKopImage: false,
    kopWidth: 100,
    kopHeight: 90,
    customCapImage: '',
    useCustomCapImage: false,
    showCap: true,
    capWidth: 80,
    capHeight: 80,
    customTtdImage: '',
    useCustomTtdImage: false,
    showTtd: true,
    ttdWidth: 110,
    ttdHeight: 75,
  };
  const [globalLetterSettings, setGlobalLetterSettings] = useState<LetterDocumentSettings>(() => {
    return getTableData<LetterDocumentSettings>('Pengaturan_Dokumen_Surat_Resmi', [defaultGlobalLetterSettings])[0] || defaultGlobalLetterSettings;
  });
  const [showGlobalLetterSettingsModal, setShowGlobalLetterSettingsModal] = useState<boolean>(false);
  const [tempGlobalLetterSettings, setTempGlobalLetterSettings] = useState<LetterDocumentSettings>(() => globalLetterSettings);

  // ==================== PENGATURAN DOKUMEN & PENANDATANGAN PO ====================
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

  // Template Gallery Modal State
  const [showTemplateGalleryModal, setShowTemplateGalleryModal] = useState<boolean>(false);
  const [templateFilter, setTemplateFilter] = useState<'All' | SuratType>('All');

  // Letter Text Styling State (Font, Ukuran, Rata Teks, Tebal/Miring/Garis, Warna)
  const defaultLetterStyle: TextStyleSettings = {
    fontFamily: 'sans-serif',
    fontSize: 12,
    textAlign: 'left',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#1e293b'
  };
  const [letterTextStyle, setLetterTextStyle] = useState<TextStyleSettings>(() => {
    return getTableData<TextStyleSettings>('Pengaturan_Gaya_Teks_Surat', [defaultLetterStyle])[0] || defaultLetterStyle;
  });

  // Rich Text Editor Ref and State
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [showInsertTableDialog, setShowInsertTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableWidthPercent, setTableWidthPercent] = useState<string>('100%');
  const [editorKey, setEditorKey] = useState(0);

  // Per-letter document settings accordion state
  const [showLetterDocSettingsPanel, setShowLetterDocSettingsPanel] = useState(false);

  // Keyboard shortcut: Tekan tombol ESC untuk langsung menutup modal pratinjau surat atau modal aktif
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewLetterModal) setViewLetterModal(null);
        else if (viewPoModal) setViewPoModal(null);
        else if (viewCustomInvoiceModal) setViewCustomInvoiceModal(null);
        else if (showTemplateGalleryModal) setShowTemplateGalleryModal(false);
        else if (showGlobalLetterSettingsModal) setShowGlobalLetterSettingsModal(false);
        else if (showPOSettingsModal) setShowPOSettingsModal(false);
        else if (showDocSettingsModal) setShowDocSettingsModal(false);
        else if (showInsertTableDialog) setShowInsertTableDialog(false);
        else if (showPoModal) setShowPoModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewLetterModal, viewPoModal, viewCustomInvoiceModal,
    showTemplateGalleryModal, showGlobalLetterSettingsModal, showPOSettingsModal,
    showDocSettingsModal, showInsertTableDialog, showPoModal
  ]);

  const handleOpenDocSettings = () => {
    setTempDocSettings({ ...docSettings });
    setShowDocSettingsModal(true);
  };

  const handleSaveDocSettings = () => {
    setDocSettings(tempDocSettings);
    setTableData('Pengaturan_Dokumen', [tempDocSettings]);
    setShowDocSettingsModal(false);
    showToastGlobal('Pengaturan Invoice Custom berhasil disimpan!', 'success');
  };

  const handleResetDocSettings = () => {
    setTempDocSettings({ ...defaultDocSettings });
  };

  // Surat Resmi Global Settings Handlers
  const handleOpenGlobalLetterSettings = () => {
    setTempGlobalLetterSettings({ ...globalLetterSettings });
    setShowGlobalLetterSettingsModal(true);
  };

  const handleSaveGlobalLetterSettings = () => {
    setGlobalLetterSettings(tempGlobalLetterSettings);
    setTableData('Pengaturan_Dokumen_Surat_Resmi', [tempGlobalLetterSettings]);
    setShowGlobalLetterSettingsModal(false);
    showToastGlobal('Pengaturan Format Surat Resmi berhasil disimpan!', 'success');
  };

  const handleResetGlobalLetterSettings = () => {
    setTempGlobalLetterSettings({ ...defaultGlobalLetterSettings });
  };

  // PO Settings Handlers
  const handleOpenPOSettings = () => {
    setTempPOSettings(JSON.parse(JSON.stringify(poSettings)));
    setShowPOSettingsModal(true);
  };

  const handleSavePOSettings = () => {
    setPoSettings(tempPOSettings);
    setTableData('Pengaturan_Dokumen_PO', [tempPOSettings]);
    setShowPOSettingsModal(false);
    showToastGlobal('Pengaturan Format & Penandatangan PO berhasil disimpan!', 'success');
  };

  const handleResetPOSettings = () => {
    setTempPOSettings(JSON.parse(JSON.stringify(defaultPOSettings)));
  };

  const handleAddPOSignatory = () => {
    const list = tempPOSettings.signatories || [];
    const newSig: POSignatory = {
      id: `pos-${Date.now()}`,
      keterangan: 'Mengetahui,',
      nama: 'Nama Pejabat',
      jabatan: 'Jabatan Terkait',
      useCustomTtdImage: false
    };
    setTempPOSettings({
      ...tempPOSettings,
      signatories: [...list, newSig]
    });
  };

  const handleRemovePOSignatory = (id: string) => {
    const list = tempPOSettings.signatories || [];
    if (list.length <= 1) {
      showToastGlobal('Minimal harus ada 1 penandatangan pada dokumen PO', 'warning');
      return;
    }
    setTempPOSettings({
      ...tempPOSettings,
      signatories: list.filter(s => s.id !== id)
    });
  };

  const handleUpdatePOSignatory = (id: string, field: keyof POSignatory, value: any) => {
    setTempPOSettings(prev => {
      const list = (prev.signatories || []).map(s => {
        if (s.id !== id) return s;
        return { ...s, [field]: value };
      });
      return {
        ...prev,
        signatories: list
      };
    });
  };

  const handleUpdatePOSignatoryMultiple = (id: string, updates: Partial<POSignatory>) => {
    setTempPOSettings(prev => {
      const list = (prev.signatories || []).map(s => {
        if (s.id !== id) return s;
        return { ...s, ...updates };
      });
      return {
        ...prev,
        signatories: list
      };
    });
  };

  const handleApplyPOSignatoryPreset = (preset: 'single' | 'dual' | 'triple') => {
    if (preset === 'single') {
      setTempPOSettings({
        ...tempPOSettings,
        signatories: [
          {
            id: 'pos-1',
            keterangan: '',
            nama: 'Marko Dwi Nugroho',
            jabatan: 'Bag. Purcasing',
            useCustomTtdImage: false
          }
        ]
      });
      showToastGlobal('Template Penandatangan 1 Orang (Kanan Bawah) diterapkan', 'info');
    } else if (preset === 'dual') {
      setTempPOSettings({
        ...tempPOSettings,
        signatories: [
          {
            id: 'pos-1',
            keterangan: 'Diterima & Dikonfirmasi Vendor,',
            nama: '( Pemasok / Vendor )',
            jabatan: 'Pemasok / Rekanan',
            useCustomTtdImage: false
          },
          {
            id: 'pos-2',
            keterangan: 'Hormat Kami (AIRIS),',
            nama: 'Marko Dwi Nugroho',
            jabatan: 'Bag. Purcasing',
            useCustomTtdImage: false
          }
        ]
      });
      showToastGlobal('Template Penandatangan 2 Orang diterapkan', 'info');
    } else {
      setTempPOSettings({
        ...tempPOSettings,
        signatories: [
          {
            id: 'pos-1',
            keterangan: 'Diterima & Dikonfirmasi Vendor,',
            nama: '( Pemasok / Vendor )',
            jabatan: 'Pemasok / Rekanan',
            useCustomTtdImage: false
          },
          {
            id: 'pos-2',
            keterangan: 'Dibuat Oleh (Purchasing),',
            nama: 'Marko Dwi Nugroho',
            jabatan: 'Bag. Purcasing',
            useCustomTtdImage: false
          },
          {
            id: 'pos-3',
            keterangan: 'Disetujui Oleh (Direktur),',
            nama: 'H. Mujiburrahman, SIP',
            jabatan: 'Direktur Utama',
            useCustomTtdImage: false
          }
        ]
      });
      showToastGlobal('Template Penandatangan 3 Orang diterapkan', 'info');
    }
  };

  // ============================================================
  // RICH TEXT EDITOR HELPERS
  // ============================================================
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  }, []);

  const execFormat = useCallback((command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [restoreSelection]);

  const handleInsertTable = useCallback((rows: number, cols: number, width: string = '100%') => {
    const colWidth = (100 / cols).toFixed(1);
    const headerRow = `<tr>${Array(cols).fill(0).map((_, ci) => `<th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:${colWidth}%;resize:horizontal;overflow:auto;min-width:45px;">Kolom ${ci + 1}</th>`).join('')}</tr>`;
    const bodyRows = Array(Math.max(1, rows - 1)).fill(0).map(() =>
      `<tr>${Array(cols).fill(0).map(() => `<td style="border:1px solid #cbd5e1;padding:8px 10px;resize:both;overflow:auto;min-width:45px;min-height:24px;">&nbsp;</td>`).join('')}</tr>`
    ).join('');
    const tableHtml = `<br/><table class="airis-resizable-table" style="border-collapse:collapse;width:${width};margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table><br/>`;
    restoreSelection();
    document.execCommand('insertHTML', false, tableHtml);
    if (editorRef.current) editorRef.current.focus();
    setShowInsertTableDialog(false);
  }, [restoreSelection]);

  const handleAddTableRowAtCursor = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    if (tables.length === 0) {
      showToastGlobal('Belum ada tabel pada naskah surat. Klik tombol "Tabel" terlebih dahulu.', 'warning');
      return;
    }
    const table = tables[tables.length - 1];
    const colCount = table.rows[0]?.cells.length || 3;
    const newRow = table.insertRow(-1);
    for (let i = 0; i < colCount; i++) {
      const cell = newRow.insertCell(i);
      cell.style.border = '1px solid #cbd5e1';
      cell.style.padding = '8px 10px';
      cell.style.resize = 'both';
      cell.style.overflow = 'auto';
      cell.innerHTML = '&nbsp;';
    }
    showToastGlobal('Baris tabel berhasil ditambahkan!', 'success');
  };

  const handleAddTableColAtCursor = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    if (tables.length === 0) {
      showToastGlobal('Belum ada tabel pada naskah surat', 'warning');
      return;
    }
    const table = tables[tables.length - 1];
    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (r === 0 && row.cells[0]?.tagName === 'TH') {
        const th = document.createElement('th');
        th.style.border = '1px solid #94a3b8';
        th.style.padding = '8px 10px';
        th.style.background = '#f1f5f9';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'left';
        th.style.resize = 'horizontal';
        th.style.overflow = 'auto';
        th.textContent = `Kolom ${row.cells.length + 1}`;
        row.appendChild(th);
      } else {
        const cell = row.insertCell(-1);
        cell.style.border = '1px solid #cbd5e1';
        cell.style.padding = '8px 10px';
        cell.style.resize = 'both';
        cell.style.overflow = 'auto';
        cell.innerHTML = '&nbsp;';
      }
    }
    showToastGlobal('Kolom tabel berhasil ditambahkan!', 'success');
  };

  const handleSetLastTableWidth = (widthStr: string) => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    if (tables.length === 0) {
      showToastGlobal('Belum ada tabel pada naskah surat', 'warning');
      return;
    }
    const table = tables[tables.length - 1];
    table.style.width = widthStr;
    showToastGlobal(`Lebar tabel diatur ke ${widthStr}`, 'info');
  };

  const getEditorHTML = useCallback((): string => {
    return editorRef.current?.innerHTML || '';
  }, []);

  const getEditorPlainText = useCallback((): string => {
    return editorRef.current?.innerText || editorRef.current?.textContent || '';
  }, []);

  // ============================================================
  // SIGNATORY HANDLERS (Multiple Penandatangan)
  // ============================================================
  const handleAddSignatory = () => {
    const currentList: LetterSignatory[] = (letterForm.Penandatangan_List && letterForm.Penandatangan_List.length > 0)
      ? letterForm.Penandatangan_List
      : [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: letterForm.Penandatangan_Nama, Jabatan: letterForm.Penandatangan_Jabatan }];
    const newSignatory: LetterSignatory = {
      id: `sg-${Date.now()}`,
      Keterangan: 'Mengetahui / Menyetujui,',
      Nama: 'Nama Penandatangan',
      Jabatan: 'Jabatan Terkait',
      useCustomTtdImage: false
    };
    setLetterForm(prev => ({ ...prev, Penandatangan_List: [...currentList, newSignatory] }));
  };

  const handleRemoveSignatory = (id: string) => {
    const currentList = letterForm.Penandatangan_List || [];
    if (currentList.length <= 1) {
      showToastGlobal('Minimal harus ada 1 penandatangan', 'warning');
      return;
    }
    setLetterForm(prev => ({ ...prev, Penandatangan_List: (prev.Penandatangan_List || []).filter(s => s.id !== id) }));
  };

  const handleUpdateSignatory = (id: string, field: keyof LetterSignatory, value: any) => {
    setLetterForm(prev => ({
      ...prev,
      Penandatangan_List: (prev.Penandatangan_List || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  // ============================================================
  // PER-LETTER DOC SETTINGS HANDLERS
  // ============================================================
  const handleUpdateLetterDocSetting = (field: keyof LetterDocumentSettings, value: any) => {
    setLetterForm(prev => ({
      ...prev,
      LetterDocSettings: { ...(prev.LetterDocSettings || {}), [field]: value } as LetterDocumentSettings
    }));
  };

  // Helper to downscale and compress uploaded images
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

  // Helper to format date in full Indonesian format (e.g. 16 September 2026)
  const formatIndonesianFullDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (m >= 0 && m < 12) {
        return `${d} ${months[m]} ${y}`;
      }
    }
    return dateStr;
  };

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

  // Helper to group items by shipment (No_SJ_Referensi / Tanggal_Kirim / Kirim_Ke)
  const groupInvoiceItemsByShipment = (
    items: CustomInvoiceDetailItem[],
    defaultSJ?: string,
    defaultTgl?: string,
    defaultTujuan?: string
  ) => {
    const groups: {
      key: string;
      noSuratJalan: string;
      tanggalKirim: string;
      kirimKe: string;
      items: CustomInvoiceDetailItem[];
      subtotal: number;
      totalQty: number;
    }[] = [];

    items.forEach(item => {
      const sjKey = (item.No_SJ_Referensi && item.No_SJ_Referensi.trim()) 
        ? item.No_SJ_Referensi.trim() 
        : (defaultSJ || '-');
      const tglKey = (item.Tanggal_Kirim && item.Tanggal_Kirim.trim()) 
        ? item.Tanggal_Kirim.trim() 
        : (defaultTgl || new Date().toISOString().slice(0, 10));
      const kirimKeKey = (item.Kirim_Ke && item.Kirim_Ke.trim())
        ? item.Kirim_Ke.trim()
        : (defaultTujuan || '');
      const groupKey = `${sjKey}__${tglKey}__${kirimKeKey}`;

      let found = groups.find(g => g.key === groupKey);
      if (!found) {
        found = {
          key: groupKey,
          noSuratJalan: sjKey,
          tanggalKirim: tglKey,
          kirimKe: kirimKeKey,
          items: [],
          subtotal: 0,
          totalQty: 0
        };
        groups.push(found);
      }
      found.items.push(item);
      found.subtotal += Number(item.Subtotal) || 0;
      found.totalQty += Number(item.Qty) || 0;
    });

    return groups;
  };

  // Helper to aggregate items across all shipments by product name
  const getAggregatedInvoiceItems = (items: CustomInvoiceDetailItem[]) => {
    const aggregated: {
      nama: string;
      qty: number;
      satuan: string;
      harga: number;
      subtotal: number;
    }[] = [];

    (items || []).forEach(it => {
      if (!it) return;
      const key = String(it.Nama_Produk || '').trim().toLowerCase();
      const existing = aggregated.find(a => String(a.nama || '').trim().toLowerCase() === key);
      if (existing) {
        existing.qty += Number(it.Qty) || 0;
        existing.subtotal += Number(it.Subtotal) || 0;
      } else {
        aggregated.push({
          nama: it.Nama_Produk || '-',
          qty: Number(it.Qty) || 0,
          satuan: it.Satuan || 'Karton',
          harga: Number(it.Harga_Satuan) || 0,
          subtotal: Number(it.Subtotal) || 0
        });
      }
    });

    return aggregated;
  };

  // ==============================================================
  // KOLEKSI CONTOH TEMPLATE SURAT RESMI AIRIS
  // ==============================================================
  interface OfficialLetterTemplate {
    id: string;
    tipe: SuratType;
    judul: string;
    deskripsi: string;
    perihal: string;
    lampiran?: string;
    kepada: string;
    alamatTujuan: string;
    isiHTML: string;
    isiPlain: string;
    signatories: LetterSignatory[];
  }

  const OFFICIAL_LETTER_TEMPLATES: OfficialLetterTemplate[] = [
    {
      id: 'tpl-ext-1',
      tipe: 'Surat Eksternal',
      judul: 'Penawaran Harga & Pasokan Produk AMDK',
      deskripsi: 'Surat resmi penawaran harga produk air minum untuk mitra distributor, agen, dan instansi lengkap dengan tabel harga.',
      perihal: 'Penawaran Kerjasama Pengadaan Air Minum Dalam Kemasan (AMDK)',
      lampiran: '1 Berkas Brosur & Price List',
      kepada: 'Yth. Pimpinan / Manager Pengadaan Mitra Usaha',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p>Dengan hormat,</p>
<p>Sehubungan dengan kebutuhan pasokan air minum berkualitas tinggi untuk operasional instansi/perusahaan Bapak/Ibu, kami dari <strong>PT. ANUGERAH ILLAHI RABBI</strong> selaku produsen AMDK merk <em>As-Shofaa</em> bermaksud mengajukan penawaran harga pasokan resmi.</p>
<p>Produk kami telah tersertifikasi <strong>SNI 3553:2023</strong>, <strong>Halal Indonesia</strong>, dan izin edar <strong>BPOM RI</strong> dengan rincian harga spesial distributor sebagai berikut:</p>
<table class="airis-resizable-table" style="border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:10%;">No</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:35%;">Varian Produk</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:25%;">Kemasan</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:right;width:30%;">Harga Khusus (Rp)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">1</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Cup 220ml</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Dus (isi 48 cup)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 16.500 / dus</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">2</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Botol 330ml</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Dus (isi 24 botol)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 28.000 / dus</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">3</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Botol 600ml</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Dus (isi 24 botol)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 34.000 / dus</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">4</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Galon 19L</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Galon Refill Resmi</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 6.000 / galon</td>
    </tr>
  </tbody>
</table>
<p>Harga di atas sudah termasuk pengiriman sampai ke gudang pemesan (area Klaten & Solo Raya) dengan armada logistik pabrik. Ketentuan pembayaran tempo dapat dibahas lebih lanjut.</p>
<p>Demikian penawaran ini kami sampaikan. Besar harapan kami untuk dapat menjalin kerjasama yang saling menguntungkan.</p>`,
      isiPlain: `Dengan hormat,\n\nSehubungan dengan kebutuhan pasokan air minum berkualitas tinggi untuk operasional instansi/perusahaan Bapak/Ibu, kami dari PT. ANUGERAH ILLAHI RABBI selaku produsen AMDK merk As-Shofaa bermaksud mengajukan penawaran harga pasokan resmi.\n\nProduk kami telah tersertifikasi SNI 3553:2023, Halal Indonesia, dan izin edar BPOM RI.\n\nDemikian penawaran ini kami sampaikan. Besar harapan kami untuk dapat menjalin kerjasama yang saling menguntungkan.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Manager Penjualan,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Head of Marketing', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ext-2',
      tipe: 'Surat Eksternal',
      judul: 'Pemberitahuan Penyesuaian Pengiriman Produk',
      deskripsi: 'Surat resmi kepada distributor dan agen mengenai jadwal dan teknis pengiriman produk baru.',
      perihal: 'Pemberitahuan Penyesuaian Jadwal & Rute Pengiriman AMDK',
      lampiran: '-',
      kepada: 'Yth. Seluruh Mitra Distributor & Agen Resmi As-Shofaa',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p>Dengan hormat,</p>
<p>Sehubungan dengan optimalisasi armada logistik dan peningkatan kapasitas lini produksi di pabrik kami, bersama surat ini kami sampaikan penyesuaian jadwal pengiriman produk yang akan berlaku efektif mulai awal bulan mendatang:</p>
<ol style="margin-left:20px;padding-left:10px;">
  <li><strong>Wilayah Klaten Utara & Delanggu:</strong> Pengiriman dilakukan setiap hari <em>Senin, Rabu, dan Jumat</em>.</li>
  <li><strong>Wilayah Klaten Selatan, Wedi & Cawas:</strong> Pengiriman dilakukan setiap hari <em>Selasa, Kamis, dan Sabtu</em>.</li>
  <li><strong>Order Pemesanan (PO):</strong> Mohon diteruskan maksimal H-1 sebelum jadwal keberangkatan armada pukul 15.00 WIB.</li>
</ol>
<p>Langkah ini diambil guna menjamin ketersediaan stok produk selalu terjaga prima dan tepat waktu di gerai Bapak/Ibu sekalian.</p>
<p>Demikian pemberitahuan ini kami sampaikan. Atas perhatian, kepercayaan, dan kerjasamanya kami ucapkan terima kasih.</p>`,
      isiPlain: `Dengan hormat,\n\nSehubungan dengan optimalisasi armada logistik dan peningkatan kapasitas lini produksi di pabrik kami, bersama surat ini kami sampaikan penyesuaian jadwal pengiriman produk yang akan berlaku efektif mulai awal bulan mendatang.\n\nDemikian pemberitahuan ini kami sampaikan. Atas kerjasama dan kepercayaannya kami ucapkan terima kasih.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ext-3',
      tipe: 'Surat Eksternal',
      judul: 'Perjanjian Kemitraan Distributor (Multi-TTD)',
      deskripsi: 'Surat persetujuan kemitraan resmi dengan format 2 penandatangan sejajar (Pihak Pertama & Pihak Kedua).',
      perihal: 'Surat Kesepakatan Kemitraan Distribusi Resmi AMDK As-Shofaa',
      lampiran: '1 Rangkap Perjanjian Kerjasama',
      kepada: 'Yth. Pimpinan CV. Mitra Berkah Bersama',
      alamatTujuan: 'Solo Baru, Sukoharjo',
      isiHTML: `<p>Dengan hormat,</p>
<p>Menindaklanjuti permohonan keagenan yang telah diajukan, bersama ini kedua belah pihak sepakat mengikatkan diri dalam kerjasama kemitraan distribusi produk AMDK As-Shofaa dengan ketentuan pokok:</p>
<p>1. <strong>Pihak Pertama (Produsen):</strong> PT. Anugerah Illahi Rabbi bertindak sebagai penjamin suplai produk resmi bersertifikasi SNI dan Halal secara berkesinambungan.<br/>
2. <strong>Pihak Kedua (Distributor):</strong> Bertindak sebagai distributor resmi untuk wilayah Solo Baru dan sekitarnya dengan target pemesanan minimal bulanan yang disepakati.</p>
<p>Kesepakatan ini dibuat dalam 2 (dua) rangkap bermaterai cukup dan memiliki kekuatan hukum yang sama bagi kedua belah pihak.</p>`,
      isiPlain: `Dengan hormat,\n\nMenindaklanjuti permohonan keagenan yang telah diajukan, bersama ini kedua belah pihak sepakat mengikatkan diri dalam kerjasama kemitraan distribusi produk AMDK As-Shofaa.\n\nKesepakatan ini dibuat dalam 2 rangkap untuk dipergunakan semestinya.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'PIHAK PERTAMA (Produsen),', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama PT. AIR', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'PIHAK KEDUA (Mitra),', Nama: 'Ir. Hendra Suryanto', Jabatan: 'Direktur CV. Mitra Berkah', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-int-1',
      tipe: 'Surat Internal',
      judul: 'Instruksi Kerja & Penegakan SOP Kebersihan Pabrik',
      deskripsi: 'Memo penegakan Good Manufacturing Practice (GMP) dan standar higienitas ruang produksi.',
      perihal: 'Instruksi Kerja & Penegakan SOP Kebersihan Ruang Steril Produksi',
      lampiran: '-',
      kepada: 'Seluruh Operator & Staf Divisi Produksi Pabrik AIRIS',
      alamatTujuan: 'Area Pabrik Belangwetan, Klaten',
      isiHTML: `<p><strong><u>MEMO INTERNAL DIVISI OPERASIONAL</u></strong></p>
<p>Dalam rangka menjaga konsistensi mutu SNI 3553:2023 dan Good Manufacturing Practices (GMP), diinstruksikan kepada seluruh kepala shift dan operator produksi untuk mematuhi kewajiban berikut:</p>
<ol style="margin-left:20px;padding-left:10px;">
  <li>Wajib mengenakan Alat Pelindung Diri (APD) sanitasi lengkap: hairnet, masker medis, sarung tangan steril, dan sepatu boot sebelum memasuki ruang filling.</li>
  <li>Mencuci tangan dengan cairan antiseptik pada bak cuci tangan otomatis di pintu masuk koridor air shower.</li>
  <li>Dilarang membawa makanan, minuman pribadi, atau aksesoris logam ke dalam area pengisian cup dan galon.</li>
  <li>Mencatat parameter pH, TDS, dan ozon secara berkala setiap 2 jam sekali ke logbook QC.</li>
</ol>
<p>Instruksi ini berlaku terhitung mulai tanggal ditetapkan dan akan dipantau ketat oleh petugas Quality Control.</p>`,
      isiPlain: `MEMO INTERNAL\n\nDalam rangka menjaga standar mutu SNI 3553:2023 dan Good Manufacturing Practices (GMP), diinstruksikan kepada seluruh staf dan operator produksi untuk mematuhi SOP kebersihan yang berlaku.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Mengetahui & Menyetujui,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Diterbitkan Oleh,', Nama: 'Agus Setiawan, ST', Jabatan: 'Supervisor Pabrik & QC', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-int-2',
      tipe: 'Surat Internal',
      judul: 'Jadwal Shift Kerja & Operasional Mesin',
      deskripsi: 'Pemberitahuan pembagian jam kerja dan shift operator mesin produksi lengkap dengan tabel jadwal.',
      perihal: 'Penetapan Jadwal Shift Kerja Operator Mesin Filling AMDK',
      lampiran: '1 Lembar Pembagian Shift',
      kepada: 'Seluruh Karyawan Shift Pabrik PT. AIR',
      alamatTujuan: 'Pabrik Klaten',
      isiHTML: `<p>Diberitahukan kepada seluruh operator mesin dan tim packing, terhitung mulai minggu depan diterapkan jadwal 2 shift kerja sebagai berikut:</p>
<table class="airis-resizable-table" style="border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:20%;">Shift</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:30%;">Jam Kerja</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:25%;">PIC Shift</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:25%;">Target Produksi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Shift 1 (Pagi)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">07.00 - 15.00 WIB</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Budi Santoso</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">1.500 Dus Cup</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Shift 2 (Siang)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">15.00 - 23.00 WIB</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Joko Susilo</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">1.200 Dus Cup</td>
    </tr>
  </tbody>
</table>
<p>Serah terima operasional mesin wajib dilakukan 15 menit sebelum pergantian shift. Demikian memo ini disampaikan untuk dilaksanakan dengan penuh rasa tanggung jawab.</p>`,
      isiPlain: `Diberitahukan kepada seluruh operator mesin dan tim packing mengenai pembagian shift kerja 07.00-15.00 dan 15.00-23.00 WIB. Harap hadir tepat waktu.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Manager Operasional,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Operasional & HRD', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-int-3',
      tipe: 'Surat Internal',
      judul: 'Surat Tugas Perjalanan Dinas / Logistik',
      deskripsi: 'Surat penugasan pengemudi dan helper untuk pengiriman produk atau urusan operasional luar kota.',
      perihal: 'Surat Perintah Perjalanan Dinas & Distribusi Logistik',
      lampiran: '1 Lembar Surat Jalan',
      kepada: 'Sdr. Tri Wahyudi (Driver) & Sdr. Wahyu Pratama (Helper)',
      alamatTujuan: 'Divisi Logistik & Armada',
      isiHTML: `<p>Yang bertanda tangan di bawah ini memberikan penugasan dinas resmi kepada:</p>
<p><strong>Nama / ID Driver:</strong> Tri Wahyudi (KAR-0004)<br/>
<strong>Nama / ID Helper:</strong> Wahyu Pratama (KAR-0012)<br/>
<strong>Kendaraan:</strong> Truk Engkel Box No. Pol AD 8129 LK<br/>
<strong>Tujuan Dinas:</strong> Pengiriman 800 Dus AMDK Cup 220ml ke Depo Distributor Solo Baru<br/>
<strong>Waktu Berangkat:</strong> Pukul 08.00 WIB s/d selesai</p>
<p>Demikian surat tugas ini diterbitkan untuk dilaksanakan sebaik-baiknya dengan senantiasa mengutamakan keselamatan berkendara.</p>`,
      isiPlain: `Memberikan tugas dinas resmi kepada driver dan helper untuk pengantaran produk AMDK ke mitra distributor.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Kepala Divisi Distribusi,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Distribusi & Logistik', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ket-1',
      tipe: 'Surat Keterangan',
      judul: 'Surat Keterangan Kerja (Paklaring)',
      deskripsi: 'Surat bukti pengalaman kerja karyawan yang berprestasi dan berdedikasi baik di pabrik.',
      perihal: 'Surat Keterangan Pengalaman Kerja',
      lampiran: '-',
      kepada: 'Pihak yang Berkepentingan',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p style="text-align:center;font-weight:bold;font-size:14px;text-decoration:underline;">SURAT KETERANGAN KERJA</p>
<p style="text-align:center;font-size:11px;font-family:monospace;margin-top:-8px;">Nomor: 045/KET/HRD/X/2026</p>
<br/>
<p>Yang bertanda tangan di bawah ini menerangkan dengan sebenarnya bahwa:</p>
<table style="width:100%;margin:6px 0;font-size:12px;border:none;">
  <tr><td style="width:140px;padding:3px 0;">Nama Lengkap</td><td style="width:15px;">:</td><td><strong>Tri Wahyudi</strong></td></tr>
  <tr><td style="padding:3px 0;">ID Karyawan</td><td>:</td><td>KAR-0004</td></tr>
  <tr><td style="padding:3px 0;">Jabatan Terakhir</td><td>:</td><td>Driver / Pengemudi Distribusi Armada Pabrik</td></tr>
  <tr><td style="padding:3px 0;">Masa Kerja</td><td>:</td><td>20 Mei 2023 s/d 18 Oktober 2026</td></tr>
</table>
<br/>
<p>Adalah benar pernah tercatat sebagai karyawan tetap di PT. Anugerah Illahi Rabbi. Selama masa baktinya, yang bersangkutan senantiasa menunjukkan integritas, loyalitas, serta kedisiplinan kerja yang terpuji.</p>
<p>Demikian surat keterangan ini kami terbitkan atas permohonan yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya.</p>`,
      isiPlain: `Yang bertanda tangan di bawah ini menerangkan bahwa Tri Wahyudi adalah benar pernah bekerja di PT. Anugerah Illahi Rabbi sejak 20 Mei 2023 sampai 18 Oktober 2026 dengan dedikasi dan kinerja yang sangat baik.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Manager HRD,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Keuangan & HRD', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ket-2',
      tipe: 'Surat Keterangan',
      judul: 'Surat Keterangan Penghasilan Karyawan',
      deskripsi: 'Surat rincian penghasilan untuk keperluan pengajuan bank, kredit, atau keperluan formal karyawan.',
      perihal: 'Surat Keterangan Penghasilan / Gaji Karyawan',
      lampiran: '-',
      kepada: 'Yth. Pimpinan Lembaga Pembiayaan / Bank',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p>Yang bertanda tangan di bawah ini menerangkan rincian penghasilan resmi karyawan PT. Anugerah Illahi Rabbi:</p>
<table style="width:100%;margin:6px 0;font-size:12px;">
  <tr><td style="width:140px;padding:3px 0;">Nama Karyawan</td><td style="width:15px;">:</td><td><strong>Supriyadi, A.Md</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Teknisi Mesin Filling & Maintenance</td></tr>
  <tr><td style="padding:3px 0;">Status Kerja</td><td>:</td><td>Karyawan Tetap (sejak 2022)</td></tr>
</table>
<table class="airis-resizable-table" style="border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;padding:6px 10px;background:#f1f5f9;font-weight:bold;text-align:left;">Komponen Penghasilan</th>
      <th style="border:1px solid #94a3b8;padding:6px 10px;background:#f1f5f9;font-weight:bold;text-align:right;">Nominal (Rp)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Gaji Pokok</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;">Rp 3.500.000</td></tr>
    <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Tunjangan Jabatan & Keahlian</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;">Rp 850.000</td></tr>
    <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Insentif Kehadiran & Target</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;">Rp 500.000</td></tr>
    <tr style="font-weight:bold;background:#f8fafc;"><td style="border:1px solid #cbd5e1;padding:6px 10px;">TOTAL TAKE HOME PAY</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;color:#1e3a8a;">Rp 4.850.000</td></tr>
  </tbody>
</table>
<p>Surat keterangan ini dibuat dengan sebenar-benarnya untuk digunakan sebagai syarat administrasi perbankan.</p>`,
      isiPlain: `Surat rincian penghasilan resmi karyawan Supriyadi, A.Md dengan total take home pay Rp 4.850.000 per bulan.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Manager Keuangan & HRD,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Keuangan & HRD', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ket-3',
      tipe: 'Surat Keterangan',
      judul: 'Surat Peringatan Pertama (SP 1)',
      deskripsi: 'Surat pembinaan disiplin kerja formal bagi karyawan yang melanggar SOP operasional.',
      perihal: 'Surat Peringatan Pertama (SP 1) Pelanggaran Disiplin Kerja',
      lampiran: '-',
      kepada: 'Sdr. Karyawan Terkait',
      alamatTujuan: 'Divisi Produksi Pabrik',
      isiHTML: `<p style="text-align:center;font-weight:bold;font-size:14px;color:#b91c1c;text-decoration:underline;">SURAT PERINGATAN PERTAMA (SP-1)</p>
<p style="text-align:center;font-size:11px;font-family:monospace;margin-top:-8px;">Nomor: 012/SP-1/HRD/X/2026</p>
<br/>
<p>Surat peringatan ini diterbitkan sehubungan dengan ketidakhadiran tanpa keterangan sah (alpa) dan keterlambatan berulang yang melanggar peraturan tata tertib perusahaan.</p>
<p>Diharapkan kepada yang bersangkutan untuk segera memperbaiki kedisiplinan dan etos kerja. Apabila dalam kurun waktu 3 (tiga) bulan ke depan terjadi pelanggaran serupa, maka perusahaan akan mengambil tindakan sanksi bertingkat (SP-2) sesuai ketentuan ketenagakerjaan.</p>
<p>Demikian surat peringatan ini dikeluarkan sebagai sarana pembinaan dan evaluasi kinerja bersama.</p>`,
      isiPlain: `Surat Peringatan Pertama (SP-1) diterbitkan atas ketidakhadiran dan keterlambatan berulang. Harap diperbaiki dan menjadi evaluasi kinerja ke depan.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Manager HRD,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Keuangan & HRD', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Mengetahui Direktur Utama,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false }
      ]
    }
  ];

  // Helper to load a template into the letter editor
  const handleApplyTemplate = (tpl: OfficialLetterTemplate) => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const num = String(letters.length + 1).padStart(3, '0');
    const typeCode = tpl.tipe === 'Surat Eksternal' ? 'EXT' : tpl.tipe === 'Surat Internal' ? 'INT' : 'KET';

    setEditingLetter(null);
    setLetterForm({
      ID_Surat: `SRT-${Date.now().toString().slice(-6)}`,
      Nomor_Surat: `${num}/${typeCode}/AIRIS/${mm}/${yy}`,
      Tipe_Surat: tpl.tipe,
      Tanggal: d.toISOString().slice(0, 10),
      Perihal: tpl.perihal,
      Lampiran: tpl.lampiran || '-',
      Kepada: tpl.kepada,
      Alamat_Tujuan: tpl.alamatTujuan,
      Isi_Surat: tpl.isiPlain,
      Isi_Surat_HTML: tpl.isiHTML,
      Penandatangan_Nama: tpl.signatories[0]?.Nama || 'H. Mujiburrahman, SIP',
      Penandatangan_Jabatan: tpl.signatories[0]?.Jabatan || 'Direktur Utama',
      Penandatangan_List: tpl.signatories.map(s => ({ ...s })),
      LetterDocSettings: undefined,
      Tembusan: 'Arsip Sekretariat',
      Dibuat_Oleh: 'Admin Sekretariat'
    });
    setEditorKey(k => k + 1);
    setShowTemplateGalleryModal(false);
    setShowLetterEditorModal(true);
    showToastGlobal(`Template "${tpl.judul}" berhasil dimuat ke editor!`, 'success');
  };
  const applyLetterTemplate = (type: SuratType) => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const num = String(letters.length + 1).padStart(3, '0');

    if (type === 'Surat Eksternal') {
      setLetterForm({
        ...letterForm,
        Tipe_Surat: 'Surat Eksternal',
        Nomor_Surat: `${num}/EXT/AIRIS/${mm}/${yy}`,
        Perihal: 'Pemberitahuan Penyesuaian Pengiriman Produk AMDK',
        Kepada: 'Yth. Seluruh Mitra Distributor & Agen Resmi',
        Alamat_Tujuan: 'Wilayah Klaten & Sekitarnya',
        Isi_Surat: `Dengan hormat,\n\nSehubungan dengan peningkatan kapasitas lini produksi mesin filling otomatis pabrik kami, bersama ini kami informasikan adanya jadwal operasional pengiriman baru yang akan mulai efektif berlaku per minggu depan.\n\nKami mengimbau kepada seluruh mitra distributor agar dapat mengirimkan purchase order (PO) H-1 sebelum jadwal pengiriman agar ketersediaan stok dapat teralokasi secara maksimal.\n\nDemikian pemberitahuan ini kami sampaikan. Atas kerjasama dan kepercayaannya, kami ucapkan terima kasih.`,
        Penandatangan_Nama: 'H. Mujiburrahman, SIP',
        Penandatangan_Jabatan: 'Direktur Utama'
      });
    } else if (type === 'Surat Internal') {
      setLetterForm({
        ...letterForm,
        Tipe_Surat: 'Surat Internal',
        Nomor_Surat: `${num}/INT/AIRIS/${mm}/${yy}`,
        Perihal: 'Instruksi Kerja & Penegakan SOP Kebersihan Pabrik',
        Kepada: 'Seluruh Karyawan dan Operator Divisi Pabrik',
        Alamat_Tujuan: 'Pabrik AIRIS Klaten',
        Isi_Surat: `MEMO INTERNAL\n\nDalam rangka menjaga standar mutu SNI 3553:2023 dan Good Manufacturing Practices (GMP), diinstruksikan kepada seluruh staf dan operator produksi untuk:\n\n1. Selalu mengenakan perlengkapan sanitasi steril (hairnet, masker, sarung tangan, sepatu kerja) di area water treatment dan packaging.\n2. Melakukan sterilisasi tangan dan alas kaki sebelum memasuki ruang steril.\n3. Melaporkan segera setiap indikasi kebocoran seal atau selisih takaran ke supervisor QC.\n\nInstruksi ini berlaku segera dan wajib dipatuhi dengan disiplin.`,
        Penandatangan_Nama: 'Agus Setiawan',
        Penandatangan_Jabatan: 'Supervisor Produksi'
      });
    } else if (type === 'Surat Keterangan') {
      setLetterForm({
        ...letterForm,
        Tipe_Surat: 'Surat Keterangan',
        Nomor_Surat: `${num}/KET/HRD/${mm}/${yy}`,
        Perihal: 'Surat Keterangan Kerja Karyawan',
        Kepada: 'Pihak yang Berkepentingan',
        Alamat_Tujuan: 'Di Tempat',
        Isi_Surat: `Yang bertanda tangan di bawah ini menerangkan dengan sebenarnya bahwa:\n\nNama        : Tri Wahyudi\nID Karyawan : KAR-0004\nJabatan     : Driver / Pengemudi Distribusi Armada\nAlamat      : Belangwetan, Klaten Utara\n\nAdalah benar tercatat sebagai karyawan tetap di PT. Anugerah Illahi Rabbi terhitung sejak tanggal 20 Mei 2023 sampai dengan saat ini.\n\nSelama bekerja di perusahaan kami, yang bersangkutan senantiasa menunjukkan kinerja, kedisiplinan, dan dedikasi yang sangat baik.\n\nDemikian surat keterangan ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.`,
        Penandatangan_Nama: 'Marko Dwi Nugroho',
        Penandatangan_Jabatan: 'Manager Keuangan & HRD'
      });
    }
  };

  const handleOpenAddLetter = (type: SuratType = 'Surat Eksternal') => {
    setEditingLetter(null);
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const num = String(letters.length + 1).padStart(3, '0');

    setLetterForm({
      ID_Surat: `SRT-${Date.now().toString().slice(-6)}`,
      Nomor_Surat: `${num}/${type === 'Surat Eksternal' ? 'EXT' : type === 'Surat Internal' ? 'INT' : 'KET'}/AIRIS/${mm}/${yy}`,
      Tipe_Surat: type,
      Tanggal: d.toISOString().slice(0, 10),
      Perihal: '',
      Lampiran: '',
      Kepada: '',
      Alamat_Tujuan: '',
      Isi_Surat: '',
      Isi_Surat_HTML: '',
      Penandatangan_Nama: 'H. Mujiburrahman, SIP',
      Penandatangan_Jabatan: 'Direktur Utama',
      Penandatangan_List: [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false }],
      LetterDocSettings: undefined,
      Tembusan: '',
      Dibuat_Oleh: 'Admin'
    });
    setEditorKey(k => k + 1);
    setShowLetterDocSettingsPanel(false);
    setShowLetterEditorModal(true);
  };

  const handleOpenEditLetter = (letter: OfficialLetterItem) => {
    setEditingLetter(letter);
    const formWithList: OfficialLetterItem = {
      ...letter,
      Penandatangan_List: letter.Penandatangan_List && letter.Penandatangan_List.length > 0
        ? letter.Penandatangan_List.map((s, idx) => ({ ...s, Keterangan: s.Keterangan || (idx === 0 ? 'Hormat kami,' : 'Mengetahui / Menyetujui,') }))
        : [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: letter.Penandatangan_Nama, Jabatan: letter.Penandatangan_Jabatan, useCustomTtdImage: false }]
    };
    setLetterForm(formWithList);
    setEditorKey(k => k + 1);
    setShowLetterDocSettingsPanel(false);
    setShowLetterEditorModal(true);
  };

  const handleDeleteLetter = async (id: string) => {
    const letter = letters.find(l => l.ID_Surat === id);
    const ok = await confirmAction({
      title: 'Hapus Surat Resmi',
      message: `Hapus dokumen surat "${letter?.Perihal || id}" secara permanen dari arsip persuratan?`,
      confirmText: 'Ya, Hapus Surat',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Surat': id,
        'Perihal': letter?.Perihal || '-',
        'Tipe Surat': letter?.Tipe_Surat || '-'
      }
    });
    if (!ok) return;

    const currentList = getTableData<OfficialLetterItem>('Data_Surat', []);
    const updated = currentList.filter(l => l.ID_Surat !== id);
    setTableData('Data_Surat', updated);
    setLetters(updated);
    onRefresh();
    showToastGlobal('Surat Resmi Dihapus', `Surat ${id} berhasil dihapus dari arsip.`, 'success');
  };

  const handleSaveLetter = () => {
    const htmlContent = getEditorHTML();
    const plainText = getEditorPlainText();
    const sigList = (letterForm.Penandatangan_List && letterForm.Penandatangan_List.length > 0)
      ? letterForm.Penandatangan_List
      : [{ id: 'sg-1', Nama: letterForm.Penandatangan_Nama, Jabatan: letterForm.Penandatangan_Jabatan }];
    const firstSig = sigList[0];
    
    const toSave: OfficialLetterItem = {
      ...letterForm,
      Isi_Surat: plainText || letterForm.Isi_Surat,
      Isi_Surat_HTML: htmlContent || letterForm.Isi_Surat_HTML || '',
      Penandatangan_Nama: firstSig?.Nama || letterForm.Penandatangan_Nama,
      Penandatangan_Jabatan: firstSig?.Jabatan || letterForm.Penandatangan_Jabatan,
      Penandatangan_List: sigList
    };

    const currentList = getTableData<OfficialLetterItem>('Data_Surat', []);
    if (editingLetter) {
      const updated = currentList.map(l => l.ID_Surat === editingLetter.ID_Surat ? toSave : l);
      setTableData('Data_Surat', updated);
      setLetters(updated);
    } else {
      const newSurat: OfficialLetterItem = {
        ...toSave,
        ID_Surat: toSave.ID_Surat || `SRT-${Date.now().toString().slice(-6)}`
      };
      const updated = [...currentList, newSurat];
      setTableData('Data_Surat', updated);
      setLetters(updated);
    }
    setShowLetterEditorModal(false);
    setEditingLetter(null);
    onRefresh();
  };

  const handleExportLetterPDF = (letter: OfficialLetterItem) => {
    generateOfficialLetterPDF({
      nomorSurat: letter.Nomor_Surat,
      tipeSurat: letter.Tipe_Surat,
      tanggal: letter.Tanggal,
      perihal: letter.Perihal,
      lampiran: letter.Lampiran,
      kepada: letter.Kepada,
      alamatTujuan: letter.Alamat_Tujuan,
      isiSurat: letter.Isi_Surat,
      penandatanganNama: letter.Penandatangan_Nama,
      penandatanganJabatan: letter.Penandatangan_Jabatan,
      tembusan: letter.Tembusan
    });
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
        'Supplier': po?.Supplier || '-',
        'Tanggal': po?.Tanggal || '-'
      }
    });
    if (!ok) return;

    const updatedH = poHeaders.filter(h => h.ID_PO !== id);
    const updatedD = poDetails.filter(d => d.ID_PO !== id);
    setTableData('Admin_PO', updatedH);
    setTableData('Admin_PO_Detail', updatedD);
    setPoHeaders(updatedH);
    setPoDetails(updatedD);
    onRefresh();
    showToastGlobal('PO Dihapus', `Purchase Order ${id} berhasil dihapus.`, 'success');
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
        Spesifikasi: item.Spesifikasi,
        Qty: Number(item.Qty) || 0,
        Harga_Satuan: Number(item.Harga_Satuan) || 0,
        Total_Harga: sub
      };
    });

    if (editingPO) {
      const updatedH = poHeaders.map(h => h.ID_PO === editingPO.ID_PO ? {
        ...h,
        Tanggal_PO: poForm.Tanggal_PO,
        No_PO: poNo,
        Order_Ke: poForm.Order_Ke,
        Alamat_Supplier: poForm.Alamat_Supplier,
        Syarat_Ketentuan: poForm.Syarat_Ketentuan,
        Grand_Total: grandTotal,
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
        No_PO: poNo,
        Order_Ke: poForm.Order_Ke,
        Alamat_Supplier: poForm.Alamat_Supplier,
        Syarat_Ketentuan: poForm.Syarat_Ketentuan,
        Grand_Total: grandTotal,
        Status: poForm.Status
      };
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

  // ==============================================================
  // CUSTOM INVOICE HANDLERS & LOGIC
  // ==============================================================
  const handleOpenAddCustomInvoice = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const invCount = customInvoices.length + 1;
    const invNo = `INV-CST/${invCount.toString().padStart(4, '0')}/${mm}/${yy}`;
    const invId = `CST-INV-${Date.now()}`;

    // Pick first customer if available
    const firstCust = customers[0];
    const initialShipmentGroup: ShipmentGroup = {
      id: `SG-${Date.now()}-1`,
      kirimKe: firstCust ? firstCust.Nama_Pelanggan : '',
      noSuratJalan: `SJ-${d.getFullYear()}${mm}${String(d.getDate()).padStart(2, '0')}-01`,
      tanggalKirim: d.toISOString().slice(0, 10),
      items: [
        {
          Nama_Produk: '',
          Spesifikasi: '',
          Qty: '' as any,
          Satuan: 'Dus',
          Harga_Satuan: '' as any,
          Subtotal: 0,
          Kirim_Ke: firstCust ? firstCust.Nama_Pelanggan : '',
          No_SJ_Referensi: `SJ-${d.getFullYear()}${mm}${String(d.getDate()).padStart(2, '0')}-01`,
          Tanggal_Kirim: d.toISOString().slice(0, 10)
        }
      ],
      subtotal: 0
    };

    const initialForm: CustomInvoiceItem = {
      ID_Invoice: invId,
      No_Invoice: invNo,
      Tanggal: d.toISOString().slice(0, 10),
      Jatuh_Tempo: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      Nama_Pelanggan: firstCust ? firstCust.Nama_Pelanggan : '',
      Level_Pelanggan: firstCust ? firstCust.Level_Pelanggan : 'Distributor',
      Alamat_Pelanggan: firstCust ? firstCust.Alamat : '',
      No_Kontak: firstCust ? firstCust.No_Telp : '',
      No_PO_Pelanggan: '',
      No_Surat_Jalan_List: [initialShipmentGroup.noSuratJalan],
      ID_Distribusi_List: [],
      Metode_Kirim: 'Kirim Armada',
      Penerima: firstCust ? firstCust.Nama_Pelanggan : '',
      Keterangan: '',
      Items: [...initialShipmentGroup.items],
      ShipmentGroups: [initialShipmentGroup],
      Subtotal: 1650000,
      Potongan_Ekspedisi: 0,
      Diskon: 0,
      Pajak_PPN: 0,
      Grand_Total: 1650000,
      Status: 'Terkirim',
      Dibuat_Oleh: 'Admin Administrasi',
      Waktu_Input: new Date().toISOString()
    };

    setInvoiceForm(initialForm);
    setSelectedShipmentIds([]);
    setEditingCustomInvoice(null);
    setShowCustomInvoiceModal(true);
  };

  const handleOpenEditCustomInvoice = (inv: CustomInvoiceItem) => {
    // If inv already has ShipmentGroups, keep them; otherwise group from Items
    let groups: ShipmentGroup[] = [];
    if (inv.ShipmentGroups && inv.ShipmentGroups.length > 0) {
      groups = inv.ShipmentGroups;
    } else {
      const rawGroups = groupInvoiceItemsByShipment(
        inv.Items || [],
        inv.No_Surat_Jalan_List?.[0] || '',
        inv.Tanggal,
        inv.Kirim_Ke || inv.Penerima || inv.Nama_Pelanggan
      );
      groups = rawGroups.map((rg, idx) => ({
        id: `SG-${idx + 1}`,
        kirimKe: rg.kirimKe,
        noSuratJalan: rg.noSuratJalan,
        tanggalKirim: rg.tanggalKirim,
        items: rg.items,
        subtotal: rg.subtotal
      }));
      if (groups.length === 0) {
        groups = [{
          id: `SG-${Date.now()}`,
          kirimKe: inv.Nama_Pelanggan,
          noSuratJalan: inv.No_Surat_Jalan_List?.[0] || '',
          tanggalKirim: inv.Tanggal,
          items: inv.Items || [],
          subtotal: inv.Subtotal || 0
        }];
      }
    }

    setInvoiceForm({ ...inv, ShipmentGroups: groups });
    setSelectedShipmentIds(inv.ID_Distribusi_List || []);
    setEditingCustomInvoice(inv);
    setShowCustomInvoiceModal(true);
  };

  const handleDeleteCustomInvoice = async (id: string) => {
    const isConfirmed = await confirmAction({
      title: 'Hapus Invoice Custom?',
      message: 'Apakah Anda yakin ingin menghapus invoice custom ini? Data yang terhapus tidak dapat dikembalikan.',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!isConfirmed) return;

    const filtered = customInvoices.filter(i => i.ID_Invoice !== id);
    setCustomInvoices(filtered);
    setTableData('Data_Custom_Invoice', filtered);
    showToastGlobal('Invoice Custom berhasil dihapus', 'success');
    onRefresh();
  };

  // Recalculate invoice totals
  const recalculateTotals = (
    items: CustomInvoiceDetailItem[],
    potongan: number,
    diskon: number,
    ppn: number
  ) => {
    const subtotal = items.reduce((acc, curr) => acc + (Number(curr.Subtotal) || 0), 0);
    const grandTotal = Math.max(0, subtotal - (Number(potongan) || 0) - (Number(diskon) || 0) + (Number(ppn) || 0));
    return { subtotal, grandTotal };
  };

  const handleCustomerChange = (custName: string) => {
    const cust = customers.find(c => c.Nama_Pelanggan === custName);
    if (cust) {
      setInvoiceForm(prev => ({
        ...prev,
        Nama_Pelanggan: cust.Nama_Pelanggan,
        Level_Pelanggan: cust.Level_Pelanggan || 'Distributor',
        Alamat_Pelanggan: cust.Alamat || '',
        No_Kontak: cust.No_Telp || '',
        Penerima: cust.Nama_Pelanggan
      }));
    } else {
      setInvoiceForm(prev => ({
        ...prev,
        Nama_Pelanggan: custName
      }));
    }
  };

  // Pull products from selected shipments
  const handleConsolidateShipments = () => {
    if (selectedShipmentIds.length === 0) {
      showToastGlobal('Pilih minimal 1 pengiriman terlebih dahulu', 'warning');
      return;
    }

    const matchedDistributions = distributions.filter(d => selectedShipmentIds.includes(d.ID_Distribusi));
    const matchedSJNumbers = matchedDistributions.map(d => d.No_Surat_Jalan || d.ID_Distribusi);

    // Group distributions into ShipmentGroup cards
    const newGroups: ShipmentGroup[] = matchedDistributions.map((dist, idx) => {
      const itemsForDist = distributionItems.filter(di => di.ID_Distribusi === dist.ID_Distribusi);
      const groupItems: CustomInvoiceDetailItem[] = itemsForDist.length > 0
        ? itemsForDist.map(it => ({
            Nama_Produk: it.Nama_Produk,
            Spesifikasi: `Pengiriman SJ: ${dist.No_Surat_Jalan || dist.ID_Distribusi} (${dist.Tanggal})`,
            Qty: Number(it.Qty) || 0,
            Satuan: it.Satuan || 'Dus',
            Harga_Satuan: Number(it.Harga_Satuan) || 0,
            Subtotal: (Number(it.Qty) || 0) * (Number(it.Harga_Satuan) || 0),
            No_SJ_Referensi: dist.No_Surat_Jalan || dist.ID_Distribusi,
            Tanggal_Kirim: dist.Tanggal,
            Kirim_Ke: dist.Tujuan || dist.Penerima || invoiceForm.Nama_Pelanggan || ''
          }))
        : [{
            Nama_Produk: 'Air Minum As-Shofaa Galon 19L',
            Spesifikasi: `Pengiriman SJ: ${dist.No_Surat_Jalan || dist.ID_Distribusi} (${dist.Tanggal})`,
            Qty: 1,
            Satuan: 'Galon',
            Harga_Satuan: Number(dist.Total_Tagihan) || 0,
            Subtotal: Number(dist.Total_Tagihan) || 0,
            No_SJ_Referensi: dist.No_Surat_Jalan || dist.ID_Distribusi,
            Tanggal_Kirim: dist.Tanggal,
            Kirim_Ke: dist.Tujuan || dist.Penerima || invoiceForm.Nama_Pelanggan || ''
          }];

      const groupSubtotal = groupItems.reduce((acc, it) => acc + (Number(it.Subtotal) || 0), 0);

      return {
        id: `SG-${dist.ID_Distribusi || idx + 1}`,
        kirimKe: dist.Tujuan || dist.Penerima || invoiceForm.Nama_Pelanggan || '',
        noSuratJalan: dist.No_Surat_Jalan || dist.ID_Distribusi,
        tanggalKirim: dist.Tanggal,
        items: groupItems,
        subtotal: groupSubtotal
      };
    });

    const flattenedItems = newGroups.flatMap(g => g.items);

    if (flattenedItems.length === 0) {
      showToastGlobal('Tidak ditemukan rincian produk pada pengiriman terpilih', 'warning');
      return;
    }

    const { subtotal, grandTotal } = recalculateTotals(
      flattenedItems,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    setInvoiceForm(prev => ({
      ...prev,
      No_Surat_Jalan_List: matchedSJNumbers,
      ID_Distribusi_List: selectedShipmentIds,
      ShipmentGroups: newGroups,
      Items: flattenedItems,
      Subtotal: subtotal,
      Grand_Total: grandTotal
    }));

    showToastGlobal(`Berhasil menarik ${flattenedItems.length} item dari ${selectedShipmentIds.length} pengiriman!`, 'success');
  };

  // Helper functions for card-based ShipmentGroups editing
  const handleAddShipmentGroup = () => {
    const currentGroups = invoiceForm.ShipmentGroups || [];
    const newIdx = currentGroups.length + 1;
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const newGroup: ShipmentGroup = {
      id: `SG-${Date.now()}-${newIdx}`,
      kirimKe: invoiceForm.Nama_Pelanggan || `Tujuan Kirim #${newIdx}`,
      noSuratJalan: `SJ-${d.getFullYear()}${mm}${String(d.getDate()).padStart(2, '0')}-${String(newIdx).padStart(2, '0')}`,
      tanggalKirim: invoiceForm.Tanggal || d.toISOString().slice(0, 10),
      items: [
        {
          Nama_Produk: '',
          Spesifikasi: '',
          Qty: '' as any,
          Satuan: 'Dus',
          Harga_Satuan: '' as any,
          Subtotal: 0,
          Kirim_Ke: invoiceForm.Nama_Pelanggan || `Tujuan Kirim #${newIdx}`,
          No_SJ_Referensi: `SJ-${d.getFullYear()}${mm}${String(d.getDate()).padStart(2, '0')}-${String(newIdx).padStart(2, '0')}`,
          Tanggal_Kirim: invoiceForm.Tanggal || d.toISOString().slice(0, 10)
        }
      ],
      subtotal: 0
    };

    const nextGroups = [...currentGroups, newGroup];
    const flattened = nextGroups.flatMap(g => g.items);
    const { subtotal, grandTotal } = recalculateTotals(
      flattened,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    setInvoiceForm(prev => ({
      ...prev,
      ShipmentGroups: nextGroups,
      Items: flattened,
      Subtotal: subtotal,
      Grand_Total: grandTotal
    }));
  };

  const handleRemoveShipmentGroup = (groupId: string) => {
    const currentGroups = invoiceForm.ShipmentGroups || [];
    if (currentGroups.length <= 1) {
      showToastGlobal('Minimal harus ada 1 tujuan pengiriman', 'warning');
      return;
    }
    const nextGroups = currentGroups.filter(g => g.id !== groupId);
    const flattened = nextGroups.flatMap(g => g.items);
    const { subtotal, grandTotal } = recalculateTotals(
      flattened,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    setInvoiceForm(prev => ({
      ...prev,
      ShipmentGroups: nextGroups,
      Items: flattened,
      Subtotal: subtotal,
      Grand_Total: grandTotal
    }));
  };

  const handleUpdateShipmentGroupHeader = (
    groupId: string,
    field: 'kirimKe' | 'noSuratJalan' | 'tanggalKirim',
    value: string
  ) => {
    const nextGroups = (invoiceForm.ShipmentGroups || []).map(grp => {
      if (grp.id !== groupId) return grp;
      const updatedGrp = { ...grp, [field]: value };
      // Also sync to items inside this group
      updatedGrp.items = updatedGrp.items.map(it => ({
        ...it,
        Kirim_Ke: field === 'kirimKe' ? value : it.Kirim_Ke,
        No_SJ_Referensi: field === 'noSuratJalan' ? value : it.No_SJ_Referensi,
        Tanggal_Kirim: field === 'tanggalKirim' ? value : it.Tanggal_Kirim
      }));
      return updatedGrp;
    });

    const flattened = nextGroups.flatMap(g => g.items);
    setInvoiceForm(prev => ({
      ...prev,
      ShipmentGroups: nextGroups,
      Items: flattened
    }));
  };

  const handleAddProductToGroup = (groupId: string) => {
    const nextGroups = (invoiceForm.ShipmentGroups || []).map(grp => {
      if (grp.id !== groupId) return grp;
      const firstProd = products[0];
      const newItem: CustomInvoiceDetailItem = {
        Nama_Produk: '',
        Spesifikasi: '',
        Qty: '' as any,
        Satuan: 'Dus',
        Harga_Satuan: '' as any,
        Subtotal: 0,
        Kirim_Ke: grp.kirimKe,
        No_SJ_Referensi: grp.noSuratJalan,
        Tanggal_Kirim: grp.tanggalKirim
      };
      const updatedItems = [...grp.items, newItem];
      const updatedSubtotal = updatedItems.reduce((acc, it) => acc + (Number(it.Subtotal) || 0), 0);
      return { ...grp, items: updatedItems, subtotal: updatedSubtotal };
    });

    const flattened = nextGroups.flatMap(g => g.items);
    const { subtotal, grandTotal } = recalculateTotals(
      flattened,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    setInvoiceForm(prev => ({
      ...prev,
      ShipmentGroups: nextGroups,
      Items: flattened,
      Subtotal: subtotal,
      Grand_Total: grandTotal
    }));
  };

  const handleRemoveProductFromGroup = (groupId: string, itemIdx: number) => {
    const nextGroups = (invoiceForm.ShipmentGroups || []).map(grp => {
      if (grp.id !== groupId) return grp;
      if (grp.items.length <= 1) {
        showToastGlobal('Minimal harus ada 1 produk dalam data kirim ini', 'warning');
        return grp;
      }
      const updatedItems = grp.items.filter((_, i) => i !== itemIdx);
      const updatedSubtotal = updatedItems.reduce((acc, it) => acc + (Number(it.Subtotal) || 0), 0);
      return { ...grp, items: updatedItems, subtotal: updatedSubtotal };
    });

    const flattened = nextGroups.flatMap(g => g.items);
    const { subtotal, grandTotal } = recalculateTotals(
      flattened,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    setInvoiceForm(prev => ({
      ...prev,
      ShipmentGroups: nextGroups,
      Items: flattened,
      Subtotal: subtotal,
      Grand_Total: grandTotal
    }));
  };

  const handleUpdateProductInGroup = (
    groupId: string,
    itemIdx: number,
    field: keyof CustomInvoiceDetailItem,
    value: any
  ) => {
    const nextGroups = (invoiceForm.ShipmentGroups || []).map(grp => {
      if (grp.id !== groupId) return grp;
      const updatedItems = [...grp.items];
      const curItem = { ...updatedItems[itemIdx], [field]: value };

      if (field === 'Nama_Produk') {
        const found = products.find(p => p.Nama_Produk === value);
        if (found) {
          curItem.Harga_Satuan = Number(found.Harga_Distributor || found.Harga_Agen || curItem.Harga_Satuan || 0);
          curItem.Satuan = found.Satuan || curItem.Satuan || 'Dus';
        }
      }

      const q = Number(curItem.Qty) || 0;
      const h = Number(curItem.Harga_Satuan) || 0;
      curItem.Subtotal = q * h;
      curItem.Kirim_Ke = grp.kirimKe;
      curItem.No_SJ_Referensi = grp.noSuratJalan;
      curItem.Tanggal_Kirim = grp.tanggalKirim;

      updatedItems[itemIdx] = curItem;
      const updatedSubtotal = updatedItems.reduce((acc, it) => acc + (Number(it.Subtotal) || 0), 0);
      return { ...grp, items: updatedItems, subtotal: updatedSubtotal };
    });

    const flattened = nextGroups.flatMap(g => g.items);
    const { subtotal, grandTotal } = recalculateTotals(
      flattened,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    setInvoiceForm(prev => ({
      ...prev,
      ShipmentGroups: nextGroups,
      Items: flattened,
      Subtotal: subtotal,
      Grand_Total: grandTotal
    }));
  };

  const handleSaveCustomInvoice = () => {
    if (!invoiceForm.No_Invoice.trim()) {
      showToastGlobal('Nomor Invoice wajib diisi', 'warning');
      return;
    }
    if (!invoiceForm.Nama_Pelanggan.trim()) {
      showToastGlobal('Nama Pelanggan wajib diisi', 'warning');
      return;
    }
    if (!invoiceForm.Items || invoiceForm.Items.length === 0) {
      showToastGlobal('Minimal tambahkan 1 item produk', 'warning');
      return;
    }

    const { subtotal, grandTotal } = recalculateTotals(
      invoiceForm.Items,
      invoiceForm.Potongan_Ekspedisi,
      invoiceForm.Diskon,
      invoiceForm.Pajak_PPN
    );

    const invoiceToSave: CustomInvoiceItem = {
      ...invoiceForm,
      Subtotal: subtotal,
      Grand_Total: grandTotal,
      Waktu_Input: invoiceForm.Waktu_Input || new Date().toISOString()
    };

    let updatedList: CustomInvoiceItem[];
    if (editingCustomInvoice) {
      updatedList = customInvoices.map(i => i.ID_Invoice === invoiceToSave.ID_Invoice ? invoiceToSave : i);
    } else {
      updatedList = [invoiceToSave, ...customInvoices];
    }

    setCustomInvoices(updatedList);
    setTableData('Data_Custom_Invoice', updatedList);
    showToastGlobal('Invoice Custom berhasil disimpan!', 'success');
    setShowCustomInvoiceModal(false);
    setEditingCustomInvoice(null);
    onRefresh();
  };

  const handleDownloadCustomInvoicePDF = async (inv: CustomInvoiceItem) => {
    try {
      const pdfItems = inv.Items.map(item => ({
        nama: item.Nama_Produk,
        qty: Number(item.Qty) || 0,
        satuan: item.Satuan || 'Dus',
        harga: Number(item.Harga_Satuan) || 0,
        subtotal: Number(item.Subtotal) || 0,
        noSuratJalan: item.No_SJ_Referensi,
        tanggalKirim: item.Tanggal_Kirim
      }));

      // Group items by shipment if multiple SJ or references exist
      const itemGroups = groupInvoiceItemsByShipment(
        inv.Items,
        inv.No_Surat_Jalan_List?.[0] || '-',
        inv.Tanggal,
        inv.Kirim_Ke || inv.Penerima || inv.Nama_Pelanggan
      );
      const shipmentGroupsForPdf = itemGroups.map(g => ({
        kirimKe: g.kirimKe,
        noSuratJalan: g.noSuratJalan,
        tanggalKirim: g.tanggalKirim,
        items: g.items.map(it => ({
          nama: it.Nama_Produk,
          qty: Number(it.Qty) || 0,
          satuan: it.Satuan || 'Dus',
          harga: Number(it.Harga_Satuan) || 0,
          subtotal: Number(it.Subtotal) || 0
        }))
      }));

      const sjDisplay = inv.No_Surat_Jalan_List && inv.No_Surat_Jalan_List.length > 0
        ? inv.No_Surat_Jalan_List.join(', ')
        : (itemGroups[0]?.noSuratJalan || '-');

      await generateInvoicePDF({
        noInvoice: inv.No_Invoice,
        namaPelanggan: inv.Nama_Pelanggan,
        alamatPelanggan: inv.Alamat_Pelanggan || 'Alamat Mitra Pabrik',
        levelPelanggan: inv.Level_Pelanggan || 'Distributor',
        tanggal: inv.Tanggal,
        metodeKirim: inv.Metode_Kirim || 'Armada Pabrik',
        noSuratJalan: sjDisplay,
        penerima: inv.Penerima || inv.Nama_Pelanggan,
        items: pdfItems,
        shipmentGroups: shipmentGroupsForPdf,
        potonganEkspedisi: inv.Potongan_Ekspedisi || 0,
        grandTotal: inv.Grand_Total,
        customSettings: {
          namaPerusahaan: docSettings.namaPerusahaan,
          subNamaPerusahaan: docSettings.subNamaPerusahaan,
          alamatPerusahaan: docSettings.alamatPerusahaan,
          kontakPerusahaan: docSettings.kontakPerusahaan,
          customKopImage: docSettings.customKopImage,
          useCustomKopImage: docSettings.useCustomKopImage,
          customCapImage: docSettings.customCapImage,
          useCustomCapImage: docSettings.useCustomCapImage,
          showCap: docSettings.showCap,
          customTtdImage: docSettings.customTtdImage,
          useCustomTtdImage: docSettings.useCustomTtdImage,
          showTtd: docSettings.showTtd,
          namaPenandatangan: docSettings.namaPenandatangan,
          jabatanPenandatangan: docSettings.jabatanPenandatangan,
          infoPembayaranTeks: docSettings.infoPembayaranTeks,
          bankRekening: docSettings.bankRekening
        }
      });
      showToastGlobal('PDF Invoice Custom berhasil diunduh', 'success');
    } catch (e) {
      console.error(e);
      showToastGlobal('Gagal mengekspor PDF Invoice', 'error');
    }
  };

  // Filtered shipments available for selected customer
  const customerAvailableShipments = (distributions || []).filter(d => {
    if (!d || !invoiceForm?.Nama_Pelanggan) return false;
    return String(d.Nama_Pelanggan || '').trim().toLowerCase() === String(invoiceForm.Nama_Pelanggan || '').trim().toLowerCase();
  });

  // Filtered invoices for list view
  const filteredCustomInvoices = (customInvoices || []).filter(inv => {
    if (!inv) return false;
    const q = (invoiceSearchQuery || '').toLowerCase();
    const matchesSearch = 
      String(inv.No_Invoice || '').toLowerCase().includes(q) ||
      String(inv.Nama_Pelanggan || '').toLowerCase().includes(q) ||
      (inv.No_PO_Pelanggan && String(inv.No_PO_Pelanggan).toLowerCase().includes(q)) ||
      (inv.No_Surat_Jalan_List && Array.isArray(inv.No_Surat_Jalan_List) && inv.No_Surat_Jalan_List.join(' ').toLowerCase().includes(q));

    const matchesStatus = invoiceStatusFilter === 'all' || inv.Status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Flag untuk mendeteksi apakah salah satu dokumen pratinjau resmi sedang dibuka
  // Jika sedang dibuka, seluruh tabel latar belakang otomatis disembunyikan saat dicetak
  const isAnyDocPreviewOpen = Boolean(viewLetterModal || viewPoModal || viewCustomInvoiceModal);

  return (
    <div className="space-y-6">
      {/* Background Page Content (Otomatis disembunyikan saat mencetak dokumen pratinjau surat / PO / Invoice) */}
      <div className={`space-y-6 ${isAnyDocPreviewOpen ? 'print:hidden' : ''}`}>
        {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" size={24} />
            Administrasi & Persuratan Resmi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pembuatan surat resmi (Eksternal, Internal, Keterangan), Purchase Order (PO), dan Invoice Custom Gabungan Pengiriman.
          </p>
        </div>
      </div>

      {/* Tabs Switcher: Persuratan Resmi vs Purchase Order vs Invoice Custom */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-medium">
        <button
          onClick={() => setActiveTab('surat')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'surat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText size={14} />
          <span>Arsip Persuratan Resmi ({letters.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('po')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'po' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Purchase Order Pemasok ({poHeaders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('invoice_custom')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'invoice_custom' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Receipt size={14} />
          <span>Invoice Custom Gabungan ({customInvoices.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 1. TAB PERSURATAN RESMI (3 TIPE: EKSTERNAL, INTERNAL, KET)    */}
      {/* ============================================================== */}
      {activeTab === 'surat' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={16} />
                Daftar Dokumen Persuratan Pabrik AIRIS
              </h3>
              <p className="text-xs text-slate-500">Mencakup Surat Eksternal ke Mitra, Surat Internal SOP/Memo, dan Surat Keterangan Karyawan.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Setting Format Surat Resmi */}
              <button
                onClick={handleOpenGlobalLetterSettings}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Pengaturan Kop Surat, Cap, dan TTD Default untuk Surat Resmi"
              >
                <Settings size={14} className="text-slate-500" />
                <span>Setting Format Surat</span>
              </button>

              {/* Tombol Contoh Template Surat */}
              <button
                onClick={() => setShowTemplateGalleryModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Pilih dari berbagai contoh template surat resmi siap pakai"
              >
                <Sparkles size={13} />
                <span>Contoh Template</span>
              </button>

              <div className="h-5 w-px bg-slate-300 hidden sm:block"></div>

              {/* Tombol Buat 3 Tipe Surat Resmi */}
              <button
                onClick={() => handleOpenAddLetter('Surat Eksternal')}
                className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Surat Eksternal</span>
              </button>
              <button
                onClick={() => handleOpenAddLetter('Surat Internal')}
                className="px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Surat Internal</span>
              </button>
              <button
                onClick={() => handleOpenAddLetter('Surat Keterangan')}
                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Surat Keterangan</span>
              </button>

              <button
                onClick={() => exportDataToExcel(filteredLetters, 'Surat_Resmi', 'AIRIS_Arsip_Persuratan', 'ARSIP DOKUMEN PERSURATAN RESMI AMDK')}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Search Bar Surat Resmi */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari Nomor Surat, Perihal, Kepada/Tujuan, Penandatangan..."
                value={letterSearchQuery}
                onChange={e => setLetterSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
              />
              {letterSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLetterSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                {filteredLetters.length} Dokumen
              </span>
              {letterSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLetterSearchQuery('')}
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
                  <th className="p-3">Nomor Surat</th>
                  <th className="p-3">Tipe Surat</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Perihal Dokumen</th>
                  <th className="p-3">Tujuan / Kepada</th>
                  <th className="p-3">Penandatangan</th>
                  <th className="p-3 text-center">Cetak / PDF</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLetters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic">
                      {letterSearchQuery
                        ? `Tidak ada dokumen surat yang cocok dengan kata kunci "${letterSearchQuery}".`
                        : 'Belum ada dokumen surat yang dibuat. Klik salah satu tombol "Buat Surat" di atas.'}
                    </td>
                  </tr>
                ) : (
                  filteredLetters.map(letter => (
                    <tr key={letter.ID_Surat} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{letter.Nomor_Surat}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          letter.Tipe_Surat === 'Surat Eksternal' ? 'bg-blue-100 text-blue-800' :
                          letter.Tipe_Surat === 'Surat Internal' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {letter.Tipe_Surat}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{letter.Tanggal}</td>
                      <td className="p-3 font-semibold text-slate-900 max-w-xs">{letter.Perihal}</td>
                      <td className="p-3 text-slate-700">{letter.Kepada}</td>
                      <td className="p-3 text-slate-600">
                        {letter.Penandatangan_Nama}
                        <span className="block text-[10px] text-slate-400">{letter.Penandatangan_Jabatan}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewLetterModal(letter)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Pratinjau Surat Resmi"
                          >
                            <Eye size={12} />
                            <span>Lihat</span>
                          </button>
                          <button
                            onClick={() => handleExportLetterPDF(letter)}
                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded cursor-pointer"
                            title="Unduh PDF Resmi"
                          >
                            <FileDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditLetter(letter)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                            title="Edit Dokumen Surat"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteLetter(letter.ID_Surat)}
                            className="p-1 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                            title="Hapus Surat"
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

      {/* ============================================================== */}
      {/* 2. TAB PURCHASE ORDER (PO)                                     */}
      {/* ============================================================== */}
      {activeTab === 'po' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Purchase Order (PO) Pemasok</h3>
              <p className="text-xs text-slate-500">Seluruh dokumen pesanan pembelian dapat dicetak, diedit, atau dihapus.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenPOSettings}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Pengaturan Format Kop, Cap, & Penandatangan Purchase Order (PO)"
              >
                <Settings size={14} className="text-slate-500" />
                <span>Setting Format & TTD PO</span>
              </button>
              <button
                onClick={() => exportDataToExcel(filteredPoHeaders, 'Purchase_Order', 'AIRIS_PO_Supplier', 'DAFTAR PURCHASE ORDER (PO) PEMASOK & VENDOR')}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleOpenAddPO}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Buat PO Baru</span>
              </button>
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
      )}

      {/* ============================================================== */}
      {/* 3. TAB INVOICE CUSTOM GABUNGAN PENGIRIMAN & MANUAL             */}
      {/* ============================================================== */}
      {activeTab === 'invoice_custom' && (
        <div className="space-y-4">
          {/* Quick Stats / Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Invoice Custom</p>
                <h4 className="text-xl font-bold text-slate-900 mt-0.5">{customInvoices.length}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Dokumen terbit</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Receipt size={20} />
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Nilai Tagihan</p>
                <h4 className="text-xl font-bold text-indigo-600 mt-0.5">
                  Rp {customInvoices.reduce((acc, curr) => acc + (Number(curr.Grand_Total) || 0), 0).toLocaleString('id-ID')}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Grand total kumulatif</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShoppingBag size={20} />
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status Lunas</p>
                <h4 className="text-xl font-bold text-emerald-600 mt-0.5">
                  {customInvoices.filter(i => i.Status === 'Lunas').length}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Invoice terbayar</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Multi-Pengiriman</p>
                <h4 className="text-xl font-bold text-purple-600 mt-0.5">
                  {customInvoices.filter(i => (i.No_Surat_Jalan_List?.length || 0) > 1).length}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Gabungan &gt;1 Surat Jalan</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Truck size={20} />
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="text-indigo-600" size={16} />
                  Daftar Invoice Custom & Gabungan Pengiriman
                </h3>
                <p className="text-xs text-slate-500">
                  Faktur khusus yang menggabungkan beberapa pengiriman surat jalan sekaligus atau tagihan produk custom.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari invoice / pelanggan / SJ..."
                    value={invoiceSearchQuery}
                    onChange={e => setInvoiceSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={invoiceStatusFilter}
                  onChange={e => setInvoiceStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Semua Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Terkirim">Terkirim</option>
                  <option value="Lunas">Lunas</option>
                  <option value="Batal">Batal</option>
                </select>

                <button
                  onClick={handleOpenDocSettings}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Setting Kop Surat, Cap, TTD, & Penandatangan"
                >
                  <Settings size={14} className="text-slate-500" />
                  <span>Setting Kop & TTD</span>
                </button>

                <button
                  onClick={() => exportDataToExcel(customInvoices, 'Custom_Invoice', 'AIRIS_Invoice_Custom')}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100"
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                </button>

                <button
                  onClick={handleOpenAddCustomInvoice}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  <span>+ Buat Invoice Custom</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nomor Invoice</th>
                    <th className="p-3">Tanggal / Jatuh Tempo</th>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3">Surat Jalan Tergabung</th>
                    <th className="p-3 text-center">Item Produk</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Cetak / PDF</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                        {customInvoices.length === 0
                          ? 'Belum ada data Invoice Custom. Klik tombol "+ Buat Invoice Custom" untuk membuat faktur gabungan baru.'
                          : 'Tidak ada invoice custom yang cocok dengan pencarian / filter status.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomInvoices.map(inv => {
                      const sjCount = inv.No_Surat_Jalan_List?.length || 0;
                      return (
                        <tr key={inv.ID_Invoice} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-indigo-700">
                            {inv.No_Invoice}
                            {inv.No_PO_Pelanggan && (
                              <span className="block text-[10px] text-slate-400 font-sans">
                                PO: {inv.No_PO_Pelanggan}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-slate-700">{inv.Tanggal}</span>
                            {inv.Jatuh_Tempo && (
                              <span className="block text-[10px] text-amber-600 font-mono">
                                Tempo: {inv.Jatuh_Tempo}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900">{inv.Nama_Pelanggan}</span>
                            <span className="block text-[10px] text-slate-500">
                              {inv.Level_Pelanggan || 'Distributor'} {inv.No_Kontak ? `• ${inv.No_Kontak}` : ''}
                            </span>
                          </td>
                          <td className="p-3">
                            {sjCount > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {inv.No_Surat_Jalan_List.map((sj, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-mono"
                                  >
                                    SJ: {sj}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Input Manual (Tanpa Ref SJ)</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-full text-[10px]">
                              {inv.Items?.length || 0} Item
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                            Rp {inv.Grand_Total?.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.Status === 'Lunas'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.Status === 'Terkirim'
                                  ? 'bg-blue-100 text-blue-800'
                                  : inv.Status === 'Draft'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {inv.Status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setViewCustomInvoiceModal(inv)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                title="Pratinjau Resmi Invoice Custom"
                              >
                                <Eye size={12} />
                                <span>Lihat</span>
                              </button>
                              <button
                                onClick={() => handleDownloadCustomInvoicePDF(inv)}
                                className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 cursor-pointer"
                                title="Unduh PDF Resmi Invoice Custom"
                              >
                                <FileDown size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditCustomInvoice(inv)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Invoice Custom"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCustomInvoice(inv.ID_Invoice)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Invoice Custom"
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
      </div>

      {/* ============================================================== */}
      {/* MODAL: EDITOR SURAT RESMI (SURAT EKSTERNAL / INTERNAL / KET)   */}
      {/* ============================================================== */}
      {showLetterEditorModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLetterEditorModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="text-cyan-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingLetter ? 'Edit Dokumen Surat Resmi' : 'Editor Surat Resmi AIRIS'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateGalleryModal(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-purple-200 bg-purple-900/60 hover:bg-purple-800 border border-purple-400/40 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Pilih dari berbagai contoh template surat resmi siap pakai"
                >
                  <Sparkles size={13} className="text-purple-300" />
                  <span>Pilih Contoh Template</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowLetterEditorModal(false)} 
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                  title="Tutup (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
              {/* Tipe Surat Selector Buttons */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Pilih Tipe Utama Surat:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Surat Eksternal', 'Surat Internal', 'Surat Keterangan'] as SuratType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => applyLetterTemplate(t)}
                      className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                        letterForm.Tipe_Surat === t 
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs' 
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Surat</label>
                  <input
                    type="text"
                    value={letterForm.Nomor_Surat}
                    onChange={e => setLetterForm({ ...letterForm, Nomor_Surat: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-blue-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Surat</label>
                  <input
                    type="date"
                    value={letterForm.Tanggal}
                    onChange={e => setLetterForm({ ...letterForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perihal</label>
                  <input
                    type="text"
                    value={letterForm.Perihal}
                    onChange={e => setLetterForm({ ...letterForm, Perihal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lampiran</label>
                  <input
                    type="text"
                    value={letterForm.Lampiran || '-'}
                    onChange={e => setLetterForm({ ...letterForm, Lampiran: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kepada Yth.</label>
                  <input
                    type="text"
                    value={letterForm.Kepada}
                    onChange={e => setLetterForm({ ...letterForm, Kepada: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Tujuan / Lokasi</label>
                  <input
                    type="text"
                    value={letterForm.Alamat_Tujuan || ''}
                    onChange={e => setLetterForm({ ...letterForm, Alamat_Tujuan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
                  />
                </div>
              </div>

              {/* Rich Text Editor: Formatting Toolbar + ContentEditable */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block font-semibold text-slate-700">
                    Isi Naskah Surat (Rich Text Editor)
                  </label>
                  <span className="text-[11px] text-slate-500">Seleksi teks dahulu, lalu klik tombol format</span>
                </div>

                {/* Styling Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100 border border-slate-200 rounded-t-xl text-xs">
                  {/* Font Family */}
                  <select
                    title="Jenis Font"
                    onMouseDown={saveSelection}
                    onChange={e => { saveSelection(); execFormat('fontName', e.target.value); }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="sans-serif">Sans-Serif</option>
                    <option value="serif">Serif</option>
                    <option value="Times New Roman, Times, serif">Times New Roman</option>
                    <option value="Arial, Helvetica, sans-serif">Arial</option>
                    <option value="Calibri, Candara, Segoe, sans-serif">Calibri</option>
                    <option value="Roboto, sans-serif">Roboto</option>
                    <option value="monospace">Monospace</option>
                  </select>

                  {/* Font Size: execCommand fontSize uses 1-7 scale */}
                  <select
                    title="Ukuran Font"
                    onMouseDown={saveSelection}
                    onChange={e => { saveSelection(); execFormat('fontSize', e.target.value); }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="1">8pt</option>
                    <option value="2">10pt</option>
                    <option value="3">12pt (Normal)</option>
                    <option value="4">14pt</option>
                    <option value="5">18pt</option>
                    <option value="6">24pt</option>
                    <option value="7">36pt</option>
                  </select>

                  <div className="h-5 w-px bg-slate-300 mx-0.5"></div>

                  {/* Bold, Italic, Underline */}
                  <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => execFormat('bold')}
                      className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100 hover:text-blue-700 font-bold"
                      title="Tebal (Bold) — Ctrl+B"
                    ><Bold size={13} /></button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => execFormat('italic')}
                      className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100 hover:text-blue-700 italic"
                      title="Miring (Italic) — Ctrl+I"
                    ><Italic size={13} /></button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => execFormat('underline')}
                      className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100 hover:text-blue-700 underline"
                      title="Garis Bawah (Underline) — Ctrl+U"
                    ><Underline size={13} /></button>
                  </div>

                  {/* Alignment */}
                  <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded p-0.5">
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyLeft')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Rata Kiri"><AlignLeft size={13} /></button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyCenter')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Rata Tengah"><AlignCenter size={13} /></button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyRight')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Rata Kanan"><AlignRight size={13} /></button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyFull')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Justify"><AlignJustify size={13} /></button>
                  </div>

                  <div className="h-5 w-px bg-slate-300 mx-0.5"></div>

                  {/* Text Color */}
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5">
                    <Palette size={13} className="text-slate-500" />
                    <input
                      type="color"
                      defaultValue="#1e293b"
                      onMouseDown={saveSelection}
                      onChange={e => { restoreSelection(); execFormat('foreColor', e.target.value); }}
                      className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
                      title="Warna Teks"
                    />
                  </div>

                  {/* Insert Table Button & Size Controllers */}
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => setShowInsertTableDialog(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-300 rounded text-xs font-semibold text-green-800 hover:bg-green-100 cursor-pointer"
                      title="Insert Tabel Baru"
                    >
                      <Table2 size={13} />
                      <span>+ Tabel</span>
                    </button>
                    
                    <div className="h-4 w-px bg-slate-300 mx-0.5"></div>

                    <span className="text-[10px] text-slate-500 font-medium px-1">Lebar:</span>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSetLastTableWidth('100%')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                      title="Ubah lebar tabel ke 100% (Penuh)"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSetLastTableWidth('80%')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                      title="Ubah lebar tabel ke 80% (Sedang)"
                    >
                      80%
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSetLastTableWidth('60%')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                      title="Ubah lebar tabel ke 60% (Ringkas)"
                    >
                      60%
                    </button>

                    <div className="h-4 w-px bg-slate-300 mx-0.5"></div>

                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleAddTableRowAtCursor}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                      title="Tambah baris baru pada tabel"
                    >
                      + Baris
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleAddTableColAtCursor}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                      title="Tambah kolom baru pada tabel"
                    >
                      + Kolom
                    </button>
                  </div>
                </div>

                {/* ContentEditable Editor */}
                <div
                  key={editorKey}
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onMouseUp={saveSelection}
                  onKeyUp={saveSelection}
                  onFocus={saveSelection}
                  dangerouslySetInnerHTML={{ __html: letterForm.Isi_Surat_HTML || letterForm.Isi_Surat.replace(/\n/g, '<br/>') }}
                  style={{ minHeight: '180px', outline: 'none', fontFamily: 'inherit', fontSize: '12px', lineHeight: '1.7' }}
                  className="w-full p-3 border border-t-0 border-slate-300 rounded-b-xl bg-white focus:ring-2 focus:ring-blue-400 leading-relaxed"
                />
              </div>

              {/* Multiple Signatories */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Daftar Penandatangan Surat</label>
                    <span className="text-[11px] text-slate-400">Posisi penandatangan akan otomatis disejajarkan rapi pada pratinjau & cetak</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSignatory}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded cursor-pointer"
                  >
                    <UserPlus size={13} />
                    <span>Tambah Penandatangan</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {(letterForm.Penandatangan_List && letterForm.Penandatangan_List.length > 0
                    ? letterForm.Penandatangan_List
                    : [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: letterForm.Penandatangan_Nama, Jabatan: letterForm.Penandatangan_Jabatan }]
                  ).map((sig, idx) => (
                    <div key={sig.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          Penandatangan #{idx + 1}
                        </span>
                        {(letterForm.Penandatangan_List?.length || 1) > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSignatory(sig.id)}
                            className="px-2 py-0.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded cursor-pointer flex items-center gap-1"
                            title="Hapus penandatangan ini"
                          >
                            <UserMinus size={12} />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Keterangan / Posisi</label>
                          <input
                            type="text"
                            placeholder={idx === 0 ? 'Hormat kami,' : 'Mengetahui / Menyetujui,'}
                            value={sig.Keterangan || ''}
                            onChange={e => handleUpdateSignatory(sig.id, 'Keterangan', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Nama Lengkap</label>
                          <input
                            type="text"
                            value={sig.Nama}
                            onChange={e => handleUpdateSignatory(sig.id, 'Nama', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Jabatan Resmi</label>
                          <input
                            type="text"
                            value={sig.Jabatan}
                            onChange={e => handleUpdateSignatory(sig.id, 'Jabatan', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Gambar Tanda Tangan (Opsional - Bisa diisi atau dikosongkan) */}
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                            <span>Gambar Tanda Tangan (Opsional):</span>
                          </label>
                          {sig.customTtdImage ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateSignatory(sig.id, 'customTtdImage', '');
                                handleUpdateSignatory(sig.id, 'useCustomTtdImage', false);
                              }}
                              className="px-2 py-0.5 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <X size={11} />
                              <span>Kosongkan / Hapus TTD</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Dikosongkan (untuk tanda tangan basah/manual saat dicetak)
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const b64 = await compressUploadedImage(file, 300, 150);
                              handleUpdateSignatory(sig.id, 'customTtdImage', b64);
                              handleUpdateSignatory(sig.id, 'useCustomTtdImage', true);
                            }}
                            className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                          />
                          {sig.customTtdImage && (
                            <div className="flex items-center gap-2 p-1 border border-slate-200 rounded bg-slate-50">
                              <img src={sig.customTtdImage} alt="TTD Preview" className="h-9 w-auto object-contain" />
                              <span className="text-[10px] text-emerald-600 font-semibold">✓ TTD Terpasang</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Letter Document Settings Accordion */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowLetterDocSettingsPanel(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings size={13} className="text-slate-500" />
                    ⚙️ Pengaturan Kop, Cap & TTD Surat Ini
                  </span>
                  {showLetterDocSettingsPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showLetterDocSettingsPanel && (
                  <div className="p-4 bg-white space-y-3 border-t border-slate-200 text-xs">
                    <p className="text-[11px] text-slate-500 mb-2">Jika dikosongkan, surat akan menggunakan pengaturan global Invoice Custom.</p>
                    
                    {/* Nama Perusahaan */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan (Kop)</label>
                      <input
                        type="text"
                        placeholder={docSettings.namaPerusahaan}
                        value={letterForm.LetterDocSettings?.namaPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('namaPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Sub Nama / Tagline</label>
                      <input
                        type="text"
                        placeholder={docSettings.subNamaPerusahaan}
                        value={letterForm.LetterDocSettings?.subNamaPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('subNamaPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Alamat Perusahaan</label>
                      <input
                        type="text"
                        placeholder={docSettings.alamatPerusahaan}
                        value={letterForm.LetterDocSettings?.alamatPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('alamatPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kontak Perusahaan</label>
                      <input
                        type="text"
                        placeholder={docSettings.kontakPerusahaan}
                        value={letterForm.LetterDocSettings?.kontakPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('kontakPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    {/* Upload Kop */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-slate-700 mb-1">Kop Surat Custom (Gambar)</label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={letterForm.LetterDocSettings?.useCustomKopImage || false}
                            onChange={e => handleUpdateLetterDocSetting('useCustomKopImage', e.target.checked)}
                          />
                          <span className="text-slate-600">Gunakan Gambar Kop Custom</span>
                        </label>
                      </div>
                      {letterForm.LetterDocSettings?.useCustomKopImage && (
                        <div className="mt-1.5 space-y-1">
                          <input
                            type="file" accept="image/*"
                            onChange={async e => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const b64 = await compressUploadedImage(file, 900, 180);
                              handleUpdateLetterDocSetting('customKopImage', b64);
                            }}
                            className="text-[11px] cursor-pointer"
                          />
                          {letterForm.LetterDocSettings?.customKopImage && (
                            <img src={letterForm.LetterDocSettings.customKopImage} alt="Kop" className="h-12 w-auto object-contain border border-slate-200 rounded" />
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Lebar:</label>
                            <input type="range" min={30} max={100} value={letterForm.LetterDocSettings?.kopWidth ?? 100} onChange={e => handleUpdateLetterDocSetting('kopWidth', Number(e.target.value))} className="flex-1" />
                            <span className="text-[11px] font-mono w-10">{letterForm.LetterDocSettings?.kopWidth ?? 100}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Tinggi:</label>
                            <input type="range" min={40} max={200} value={letterForm.LetterDocSettings?.kopHeight ?? 90} onChange={e => handleUpdateLetterDocSetting('kopHeight', Number(e.target.value))} className="flex-1" />
                            <span className="text-[11px] font-mono w-12">{letterForm.LetterDocSettings?.kopHeight ?? 90}px</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cap */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-slate-700 mb-1">Cap / Stempel</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.showCap ?? true} onChange={e => handleUpdateLetterDocSetting('showCap', e.target.checked)} />
                          <span className="text-slate-600">Tampilkan Cap</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.useCustomCapImage || false} onChange={e => handleUpdateLetterDocSetting('useCustomCapImage', e.target.checked)} />
                          <span className="text-slate-600">Gunakan Gambar Cap Custom</span>
                        </label>
                      </div>
                      {letterForm.LetterDocSettings?.useCustomCapImage && (
                        <div className="mt-1.5 space-y-1">
                          <input type="file" accept="image/*" onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const b64 = await compressUploadedImage(file, 200, 200);
                            handleUpdateLetterDocSetting('customCapImage', b64);
                          }} className="text-[11px] cursor-pointer" />
                          {letterForm.LetterDocSettings?.customCapImage && (
                            <img src={letterForm.LetterDocSettings.customCapImage} alt="Cap" className="h-12 w-auto object-contain" />
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Ukuran:</label>
                            <input type="range" min={40} max={160} value={letterForm.LetterDocSettings?.capWidth ?? 80} onChange={e => { handleUpdateLetterDocSetting('capWidth', Number(e.target.value)); handleUpdateLetterDocSetting('capHeight', Number(e.target.value)); }} className="flex-1" />
                            <span className="text-[11px] font-mono w-12">{letterForm.LetterDocSettings?.capWidth ?? 80}px</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TTD */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-slate-700 mb-1">Tanda Tangan (Global untuk Surat Ini)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.showTtd ?? true} onChange={e => handleUpdateLetterDocSetting('showTtd', e.target.checked)} />
                          <span className="text-slate-600">Tampilkan TTD</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.useCustomTtdImage || false} onChange={e => handleUpdateLetterDocSetting('useCustomTtdImage', e.target.checked)} />
                          <span className="text-slate-600">TTD Custom</span>
                        </label>
                      </div>
                      {letterForm.LetterDocSettings?.useCustomTtdImage && (
                        <div className="mt-1.5 space-y-1">
                          <input type="file" accept="image/*" onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const b64 = await compressUploadedImage(file, 300, 150);
                            handleUpdateLetterDocSetting('customTtdImage', b64);
                          }} className="text-[11px] cursor-pointer" />
                          {letterForm.LetterDocSettings?.customTtdImage && (
                            <img src={letterForm.LetterDocSettings.customTtdImage} alt="TTD" className="h-10 w-auto object-contain" />
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Lebar:</label>
                            <input type="range" min={60} max={200} value={letterForm.LetterDocSettings?.ttdWidth ?? 110} onChange={e => handleUpdateLetterDocSetting('ttdWidth', Number(e.target.value))} className="flex-1" />
                            <span className="text-[11px] font-mono w-12">{letterForm.LetterDocSettings?.ttdWidth ?? 110}px</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tembusan (Opsional)</label>
                <input
                  type="text"
                  value={letterForm.Tembusan || ''}
                  onChange={e => setLetterForm({ ...letterForm, Tembusan: e.target.value })}
                  placeholder="Contoh: Kepala Operasional, Arsip"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0 sticky bottom-0 z-20">
              <button
                type="button"
                onClick={() => setShowLetterEditorModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Batal
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportLetterPDF(letterForm)}
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown size={14} />
                  <span>Download PDF Langsung</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveLetter}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>Simpan Surat Resmi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insert Table Dialog */}
      {showInsertTableDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-72 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-800 mb-4">Insert Tabel</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Baris</label>
                <input
                  type="number" min={1} max={20}
                  value={tableRows}
                  onChange={e => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Kolom</label>
                <input
                  type="number" min={1} max={10}
                  value={tableCols}
                  onChange={e => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lebar Panjang Tabel</label>
                <select
                  value={tableWidthPercent}
                  onChange={e => setTableWidthPercent(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800"
                >
                  <option value="100%">100% (Penuh Halaman)</option>
                  <option value="80%">80% (Sedang Proporsional)</option>
                  <option value="60%">60% (Ringkas Tengah)</option>
                  <option value="auto">Auto (Mengikuti Lebar Teks)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowInsertTableDialog(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >Batal</button>
              <button
                type="button"
                onClick={() => handleInsertTable(tableRows, tableCols, tableWidthPercent)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Table2 size={13} />
                Insert Tabel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PRATINJAU CETAK A4 SURAT RESMI (DAPAT DICETAK & PDF)    */}
      {/* ============================================================== */}
      {viewLetterModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto printable-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setViewLetterModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] printable-modal-card">
            {/* Header Pratinjau Tetap (Sticky di Atas — Selalu Terlihat) */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-30 shadow-sm no-print">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider truncate max-w-md">
                  Pratinjau Dokumen Surat: {viewLetterModal.Nomor_Surat}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                >
                  <Printer size={13} />
                  <span>Cetak A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLetterPDF(viewLetterModal)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                >
                  <FileDown size={13} />
                  <span>Download PDF</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setViewLetterModal(null)} 
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors ml-1"
                  title="Tutup Pratinjau (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* A4 Canvas Area: Scrollable di Layar, Penuh tanpa terpotong saat Cetak */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 font-sans text-slate-900 bg-white printable-content printable-scroll-area" style={{ minHeight: '650px' }}>
              {/* Kop Surat Header (Per-letter settings with globalLetterSettings fallback) */}
              <div className="pb-4 border-b-2 border-slate-900 mb-6">
                {(viewLetterModal.LetterDocSettings?.useCustomKopImage ?? globalLetterSettings.useCustomKopImage) && (viewLetterModal.LetterDocSettings?.customKopImage || globalLetterSettings.customKopImage) ? (
                  <div className="flex justify-center mb-2">
                    <img
                      src={viewLetterModal.LetterDocSettings?.customKopImage || globalLetterSettings.customKopImage}
                      alt="Kop Surat"
                      style={{
                        width: `${viewLetterModal.LetterDocSettings?.kopWidth ?? globalLetterSettings.kopWidth ?? 100}%`,
                        height: `${viewLetterModal.LetterDocSettings?.kopHeight ?? globalLetterSettings.kopHeight ?? 90}px`,
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <h1 className="text-xl font-black text-blue-900 tracking-wide uppercase">
                      {viewLetterModal.LetterDocSettings?.namaPerusahaan || globalLetterSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      {viewLetterModal.LetterDocSettings?.subNamaPerusahaan || globalLetterSettings.subNamaPerusahaan || 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {viewLetterModal.LetterDocSettings?.alamatPerusahaan || globalLetterSettings.alamatPerusahaan || 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara, Klaten, Jawa Tengah'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Telepon / Kontak: {viewLetterModal.LetterDocSettings?.kontakPerusahaan || globalLetterSettings.kontakPerusahaan || '(0272) 898123 • Email: official@airis-amdk.com'}
                    </p>
                  </div>
                )}
              </div>

              {/* Meta Surat */}
              <div className="my-6 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Nomor: <strong className="font-mono">{viewLetterModal.Nomor_Surat}</strong></span>
                  <span>Klaten, {viewLetterModal.Tanggal}</span>
                </div>
                <div>Lampiran: {viewLetterModal.Lampiran || '-'}</div>
                <div>Perihal : <strong>{viewLetterModal.Perihal}</strong></div>
              </div>

              <div className="my-5 text-xs">
                <div>Kepada Yth.</div>
                <div className="font-bold text-slate-900">{viewLetterModal.Kepada}</div>
                {viewLetterModal.Alamat_Tujuan && <div className="text-slate-700">{viewLetterModal.Alamat_Tujuan}</div>}
                <div>Di Tempat</div>
              </div>

              {viewLetterModal.Tipe_Surat === 'Surat Keterangan' && (
                <div className="text-center my-6">
                  <h3 className="text-sm font-black underline uppercase tracking-widest text-slate-900">SURAT KETERANGAN</h3>
                  <p className="font-mono text-xs text-slate-600">Nomor: {viewLetterModal.Nomor_Surat}</p>
                </div>
              )}

              {/* Isi Surat with rich HTML support or plain text fallback */}
              <div className="my-6 leading-relaxed">
                {viewLetterModal.Isi_Surat_HTML ? (
                  <div 
                    className="prose prose-slate max-w-none text-xs leading-relaxed" 
                    dangerouslySetInnerHTML={{ __html: viewLetterModal.Isi_Surat_HTML }} 
                  />
                ) : (
                  <div 
                    className="whitespace-pre-wrap leading-relaxed"
                    style={{
                      fontFamily: letterTextStyle.fontFamily,
                      fontSize: `${letterTextStyle.fontSize}px`,
                      textAlign: letterTextStyle.textAlign,
                      fontWeight: letterTextStyle.fontWeight,
                      fontStyle: letterTextStyle.fontStyle,
                      textDecoration: letterTextStyle.textDecoration,
                      color: letterTextStyle.color
                    }}
                  >
                    {viewLetterModal.Isi_Surat}
                  </div>
                )}
              </div>

              {/* Tanda Tangan & Cap Resmi — Multiple Signatories (Sejajar Rapi) */}
              {(() => {
                const effectiveSig = (viewLetterModal.Penandatangan_List && viewLetterModal.Penandatangan_List.length > 0)
                  ? viewLetterModal.Penandatangan_List
                  : [{ 
                      id: 'sg-1', 
                      Keterangan: 'Hormat kami,',
                      Nama: viewLetterModal.Penandatangan_Nama || 'H. Mujiburrahman, SIP', 
                      Jabatan: viewLetterModal.Penandatangan_Jabatan || 'Direktur Utama', 
                      useCustomTtdImage: false, 
                      customTtdImage: undefined 
                    }];
                const ls = viewLetterModal.LetterDocSettings || globalLetterSettings;
                const effShowCap = ls?.showCap ?? globalLetterSettings.showCap ?? docSettings.showCap;
                const effShowTtd = ls?.showTtd ?? globalLetterSettings.showTtd ?? docSettings.showTtd;
                const effCapW = ls?.capWidth ?? globalLetterSettings.capWidth ?? docSettings.capWidth ?? 80;
                const effCapH = ls?.capHeight ?? globalLetterSettings.capHeight ?? docSettings.capHeight ?? 80;
                const effCapImg = (ls?.useCustomCapImage && ls.customCapImage) 
                  ? ls.customCapImage 
                  : ((globalLetterSettings.useCustomCapImage && globalLetterSettings.customCapImage) 
                      ? globalLetterSettings.customCapImage 
                      : (docSettings.useCustomCapImage ? docSettings.customCapImage : null));
                const effTtdW = ls?.ttdWidth ?? globalLetterSettings.ttdWidth ?? docSettings.ttdWidth ?? 110;
                const effTtdH = ls?.ttdHeight ?? globalLetterSettings.ttdHeight ?? docSettings.ttdHeight ?? 75;
                const effTtdImg = (ls?.useCustomTtdImage && ls.customTtdImage) 
                  ? ls.customTtdImage 
                  : ((globalLetterSettings.useCustomTtdImage && globalLetterSettings.customTtdImage) 
                      ? globalLetterSettings.customTtdImage 
                      : (docSettings.useCustomTtdImage ? docSettings.customTtdImage : null));
                const effNamaPerus = ls?.namaPerusahaan || globalLetterSettings.namaPerusahaan || docSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI';
                
                return (
                  <div className="mt-12 pt-6">
                    {/* Header Kota & Perusahaan di atas penandatangan */}
                    <div className="text-right mb-4">
                      <p className="text-xs text-slate-600 font-medium">Klaten, {viewLetterModal.Tanggal}</p>
                      <p className="text-xs font-bold text-blue-900">{effNamaPerus}</p>
                    </div>

                    {/* Container Penandatangan (Grid Rata Bawah - Nama Sejajar Horizontal) */}
                    <div 
                      className="flex flex-wrap justify-end gap-8"
                      style={{ 
                        display: 'grid', 
                        gridAutoFlow: 'column', 
                        gridAutoColumns: effectiveSig.length > 2 ? 'minmax(160px, 190px)' : 'minmax(190px, 220px)', 
                        justifyContent: 'end' 
                      }}
                    >
                      {effectiveSig.map((sig, idx) => (
                        <div key={sig.id} className="flex flex-col justify-between text-center min-w-[160px]">
                          {/* 1. Baris Keterangan Pengesahan (Tinggi Seragam h-8) */}
                          <div className="h-8 flex items-end justify-center text-xs text-slate-600 mb-1 font-medium">
                            <span>{sig.Keterangan || (idx === 0 ? 'Hormat kami,' : 'Mengetahui / Menyetujui,')}</span>
                          </div>

                          {/* 2. Area Tanda Tangan & Cap (Tinggi Seragam h-24) */}
                          <div className="h-24 relative flex items-center justify-center my-1 select-none pointer-events-none">
                            {/* Cap Stempel (pada yang pertama jika aktif) */}
                            {idx === 0 && effShowCap && (
                              effCapImg ? (
                                <img src={effCapImg} alt="Cap" style={{ width: `${effCapW}px`, height: `${effCapH}px` }} className="absolute left-2 top-0 object-contain" />
                              ) : (
                                <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${(effCapW / 90).toFixed(2)})` }}>
                                  <OfficialCapStamp />
                                </div>
                              )
                            )}

                            {/* TTD (jika ada gambar TTD custom atau default pada yang pertama jika aktif) */}
                            {effShowTtd && (
                              sig.useCustomTtdImage && sig.customTtdImage ? (
                                <img src={sig.customTtdImage} alt="TTD" style={{ width: `${effTtdW}px`, height: `${effTtdH}px` }} className="absolute left-10 -top-1 object-contain z-10" />
                              ) : (idx === 0 && !sig.useCustomTtdImage) ? (
                                effTtdImg ? (
                                  <img src={effTtdImg} alt="TTD" style={{ width: `${effTtdW}px`, height: `${effTtdH}px` }} className="absolute left-10 -top-1 object-contain z-10" />
                                ) : (
                                  <div className="absolute left-8 -top-1 origin-top-left z-10" style={{ transform: `scale(${(effTtdW / 110).toFixed(2)})` }}>
                                    <OfficialTtdMarko />
                                  </div>
                                )
                              ) : null
                            )}
                          </div>

                          {/* 3. Baris Nama & Jabatan (Garis & Nama Sejajar Sempurna Horizontal) */}
                          <div className="pt-2 border-t border-slate-900 mt-1">
                            <p className="text-xs font-bold text-slate-900 underline whitespace-nowrap">
                              {sig.Nama}
                            </p>
                            <p className="text-[11px] text-slate-500 whitespace-nowrap mt-0.5">
                              {sig.Jabatan}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {viewLetterModal.Tembusan && (
                <div className="mt-8 pt-4 border-t border-slate-100 text-[10px] text-slate-500">
                  <span>Tembusan: {viewLetterModal.Tembusan}</span>
                </div>
              )}
            </div>

            {/* Footer Pratinjau Tetap (Sticky di Bawah — Selalu Terlihat & Mudah Ditutup) */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-30 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Cetak Dokumen (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLetterPDF(viewLetterModal)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileDown size={13} />
                  <span>Unduh PDF</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewLetterModal(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Tutup Pratinjau Surat dan Kembali ke Daftar Arsip (Esc)"
              >
                <X size={14} />
                <span>Tutup & Kembali</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Form Tambah / Edit PO */}
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
                ) : (poSettings.namaPerusahaan && poSettings.namaPerusahaan.trim().toUpperCase() !== 'PT. ANUGERAH ILLAHI RABBI') ? (
                  <div className="pb-3 border-b-2 border-blue-900">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      {poSettings.namaPerusahaan}
                    </h3>
                    {poSettings.subNamaPerusahaan && (
                      <p className="text-xs text-slate-600 font-semibold">{poSettings.subNamaPerusahaan}</p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {poSettings.alamatPerusahaan || 'Klaten, Jawa Tengah'} • Kontak: {poSettings.kontakPerusahaan || '0856 4000 1926'}
                    </p>
                  </div>
                ) : (
                  <KopSuratBanner className="w-full" />
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
                          {/* Cap Stempel jika aktif */}
                          {showCap && (
                            capImg ? (
                              <img
                                src={capImg}
                                alt="Cap Stempel"
                                style={{ width: `${capW}px`, height: `${capW}px` }}
                                className="absolute left-1 top-0 object-contain"
                              />
                            ) : (
                              <div className="absolute left-1 top-0 origin-top-left" style={{ transform: `scale(${((capW) / 110).toFixed(2)})` }}>
                                <OfficialCapStamp size={110} />
                              </div>
                            )
                          )}

                          {/* TTD: Custom upload, atau TTD Marko jika nama Marko, atau ruang kosong basah */}
                          {hasCustomTtd && sig.customTtdImage ? (
                            <img
                              src={sig.customTtdImage}
                              alt="TTD"
                              style={{ maxHeight: '75px', maxWidth: '140px' }}
                              className="object-contain z-10"
                            />
                          ) : isMarko && sig.useCustomTtdImage !== false ? (
                            <div className="absolute -top-3 left-8 z-10">
                              <OfficialTtdMarko width={160} height={100} />
                            </div>
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
                              {isInternal && showCap && (
                                capImg ? (
                                  <img
                                    src={capImg}
                                    alt="Cap Stempel"
                                    style={{ width: `${capW}px`, height: `${capW}px` }}
                                    className="absolute left-1 top-0 object-contain"
                                  />
                                ) : (
                                  <div className="absolute left-1 top-0 origin-top-left" style={{ transform: `scale(${((capW) / 110).toFixed(2)})` }}>
                                    <OfficialCapStamp size={110} />
                                  </div>
                                )
                              )}

                              {hasCustomTtd && sig.customTtdImage ? (
                                <img
                                  src={sig.customTtdImage}
                                  alt="TTD"
                                  style={{ maxHeight: '75px', maxWidth: '120px' }}
                                  className="object-contain z-10"
                                />
                              ) : isMarko && sig.useCustomTtdImage !== false ? (
                                <div className="absolute -top-2 left-4 z-10">
                                  <OfficialTtdMarko width={140} height={90} />
                                </div>
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
      {/* MODAL: EDITOR INVOICE CUSTOM (MULTI-PENGIRIMAN & MANUAL)       */}
      {/* MODEL CARD DATA KIRIM SESUAI MOCKUP                           */}
      {/* ============================================================== */}
      {showCustomInvoiceModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCustomInvoiceModal(false);
              setEditingCustomInvoice(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-indigo-950 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <Receipt className="text-indigo-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingCustomInvoice ? 'Edit Invoice Custom Gabungan' : 'Buat Invoice Custom Gabungan / Manual'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCustomInvoiceModal(false);
                  setEditingCustomInvoice(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto text-xs bg-slate-50/50">
              {/* BARIS ATAS: Tanggal Invoice, No. Invoice, Pelanggan, Alamat */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Invoice</label>
                    <input
                      type="date"
                      value={invoiceForm.Tanggal}
                      onChange={e => setInvoiceForm({ ...invoiceForm, Tanggal: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      No. Invoice <span className="text-[10px] text-slate-400 font-normal">(Otomatis/Edit)</span>
                    </label>
                    <input
                      type="text"
                      value={invoiceForm.No_Invoice}
                      onChange={e => setInvoiceForm({ ...invoiceForm, No_Invoice: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-indigo-700 focus:outline-none focus:border-indigo-500"
                      placeholder="INV-CST/0001/10/2026"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kepada (Pelanggan)</label>
                    <input
                      list="customerListOptionsModal"
                      value={invoiceForm.Nama_Pelanggan}
                      onChange={e => handleCustomerChange(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 font-bold text-slate-900"
                      placeholder="Cari / Pilih Pelanggan..."
                    />
                    <datalist id="customerListOptionsModal">
                      {customers.map(c => (
                        <option key={c.ID_Pelanggan} value={c.Nama_Pelanggan}>
                          {c.Level_Pelanggan} {c.Alamat ? `- ${c.Alamat}` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Pelanggan</label>
                    <input
                      type="text"
                      value={invoiceForm.Alamat_Pelanggan || ''}
                      onChange={e => setInvoiceForm({ ...invoiceForm, Alamat_Pelanggan: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                      placeholder="Alamat kirim / penagihan..."
                    />
                  </div>
                </div>

                {/* PILIHAN EKSPEDISI (KIRIM ARMADA / AMBIL SENDIRI) & JATUH TEMPO */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700">Pilihan Ekspedisi:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                      <input
                        type="radio"
                        name="metodeKirimRadio"
                        value="Kirim Armada"
                        checked={invoiceForm.Metode_Kirim !== 'Ambil Sendiri'}
                        onChange={() => setInvoiceForm({ ...invoiceForm, Metode_Kirim: 'Kirim Armada' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Kirim Armada</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                      <input
                        type="radio"
                        name="metodeKirimRadio"
                        value="Ambil Sendiri"
                        checked={invoiceForm.Metode_Kirim === 'Ambil Sendiri'}
                        onChange={() => setInvoiceForm({ ...invoiceForm, Metode_Kirim: 'Ambil Sendiri' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Ambil Sendiri</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">Jatuh Tempo:</span>
                    <input
                      type="date"
                      value={invoiceForm.Jatuh_Tempo || ''}
                      onChange={e => setInvoiceForm({ ...invoiceForm, Jatuh_Tempo: e.target.value })}
                      className="p-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* ACCORDION TARIK DATA DISTRIBUSI (JIKA TERSEDIA) */}
              <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck size={15} className="text-indigo-600" />
                    <span className="font-bold text-indigo-950">
                      Tarik Data dari Riwayat Pengiriman / Surat Jalan
                    </span>
                    <span className="text-[10px] bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                      {customerAvailableShipments.length} Tersedia
                    </span>
                  </div>

                  {customerAvailableShipments.length > 0 && (
                    <button
                      type="button"
                      onClick={handleConsolidateShipments}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <RefreshCw size={12} />
                      <span>Tarik ke Form Card ({selectedShipmentIds.length})</span>
                    </button>
                  )}
                </div>

                {customerAvailableShipments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Centang riwayat surat jalan untuk digabung ke invoice:</span>
                      <div className="flex gap-2 font-medium">
                        <button
                          type="button"
                          onClick={() => setSelectedShipmentIds(customerAvailableShipments.map(d => d.ID_Distribusi))}
                          className="text-indigo-600 hover:underline cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedShipmentIds([])}
                          className="text-slate-500 hover:underline cursor-pointer"
                        >
                          Batal Pilih
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1 bg-white/60 rounded-lg border border-indigo-100">
                      {customerAvailableShipments.map(dist => {
                        const isSelected = selectedShipmentIds.includes(dist.ID_Distribusi);
                        return (
                          <div
                            key={dist.ID_Distribusi}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedShipmentIds(selectedShipmentIds.filter(id => id !== dist.ID_Distribusi));
                              } else {
                                setSelectedShipmentIds([...selectedShipmentIds, dist.ID_Distribusi]);
                              }
                            }}
                            className={`p-2 rounded border cursor-pointer transition-all flex items-start gap-2 ${
                              isSelected
                                ? 'bg-indigo-100/90 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1 min-w-0 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-slate-900 truncate">
                                  {dist.No_Surat_Jalan || dist.ID_Distribusi}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{dist.Tanggal}</span>
                              </div>
                              <p className="text-[10px] text-slate-600 truncate mt-0.5">
                                Tujuan: {dist.Tujuan || dist.Penerima || '-'}
                              </p>
                              <p className="text-[10px] font-bold text-indigo-700">
                                Rp {Number(dist.Total_Tagihan || 0).toLocaleString('id-ID')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SEKSI: DAFTAR TUJUAN KIRIM / CABANG DENGAN MODEL CARD PERSIS MOCKUP */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pt-1">
                  <h4 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                    Daftar Tujuan Kirim / Cabang
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddShipmentGroup}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                  >
                    <Plus size={14} />
                    <span>+ Tambah Tujuan Kirim</span>
                  </button>
                </div>

                {/* LOOPING CARD DATA KIRIM #N */}
                {(invoiceForm.ShipmentGroups || []).map((grp, gIdx) => (
                  <div 
                    key={grp.id || gIdx} 
                    className="border border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white"
                  >
                    {/* Header Card: Biru Terang dengan Label Data Kirim #N & Tombol Hapus Merah */}
                    <div className="bg-[#1e60aa] text-white px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck size={15} className="text-blue-200" />
                        <span className="font-extrabold text-xs uppercase tracking-wider">
                          Data Kirim #{gIdx + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveShipmentGroup(grp.id)}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded flex items-center gap-1 cursor-pointer transition-colors"
                        title="Hapus Tujuan Kirim ini"
                      >
                        <Trash2 size={12} />
                        <span>Hapus</span>
                      </button>
                    </div>

                    {/* Form Input Header Pengiriman: Kirim Ke, No. Surat Jalan, Tanggal Kirim */}
                    <div className="p-4 space-y-3 bg-white">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Kirim Ke (Tujuan)</label>
                          <input
                            type="text"
                            value={grp.kirimKe}
                            onChange={e => handleUpdateShipmentGroupHeader(grp.id, 'kirimKe', e.target.value)}
                            placeholder="Contoh: TAJI / Cabang Utama"
                            className="w-full p-2 border border-slate-300 rounded-lg focus:border-blue-600 font-semibold text-slate-900 bg-slate-50/50"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">No. Surat Jalan</label>
                          <input
                            type="text"
                            value={grp.noSuratJalan}
                            onChange={e => handleUpdateShipmentGroupHeader(grp.id, 'noSuratJalan', e.target.value)}
                            placeholder="Contoh: 612/IX/26"
                            className="w-full p-2 border border-slate-300 rounded-lg focus:border-blue-600 font-mono font-bold text-blue-800 bg-slate-50/50"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Tanggal Kirim</label>
                          <input
                            type="date"
                            value={grp.tanggalKirim}
                            onChange={e => handleUpdateShipmentGroupHeader(grp.id, 'tanggalKirim', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg focus:border-blue-600 font-mono text-slate-800 bg-slate-50/50"
                          />
                        </div>
                      </div>

                      {/* Tabel Produk Pengiriman Ini */}
                      <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Nama Produk</th>
                              <th className="p-2.5 w-28 text-center">Qty (Karton/Galon)</th>
                              <th className="p-2.5 w-36 text-right">Harga / Satuan (Rp)</th>
                              <th className="p-2.5 w-36 text-right">Total (Rp)</th>
                              <th className="p-2.5 w-16 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {grp.items.map((item, pIdx) => (
                              <tr key={pIdx} className="hover:bg-slate-50/80">
                                <td className="p-2">
                                  <select
                                    value={item.Nama_Produk}
                                    onChange={e => handleUpdateProductInGroup(grp.id, pIdx, 'Nama_Produk', e.target.value)}
                                    className="w-full p-1.5 border border-slate-300 rounded font-semibold text-slate-900 bg-white focus:border-blue-500"
                                  >
                                    {products.map(p => (
                                      <option key={p.ID_Produk} value={p.Nama_Produk}>
                                        {p.Nama_Produk} ({p.Satuan})
                                      </option>
                                    ))}
                                    {/* Fallback option if not in catalog */}
                                    {!products.some(p => p.Nama_Produk === item.Nama_Produk) && (
                                      <option value={item.Nama_Produk}>{item.Nama_Produk}</option>
                                    )}
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={item.Qty ?? ''}
                                    onChange={e => handleUpdateProductInGroup(grp.id, pIdx, 'Qty', e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0))}
                                    className="w-full p-1.5 border border-slate-300 rounded text-center font-mono font-bold focus:border-blue-500"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={item.Harga_Satuan ?? ''}
                                    onChange={e => handleUpdateProductInGroup(grp.id, pIdx, 'Harga_Satuan', e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0))}
                                    className="w-full p-1.5 border border-slate-300 rounded text-right font-mono focus:border-blue-500"
                                  />
                                </td>
                                <td className="p-2 text-right font-mono font-bold text-slate-900">
                                  Rp {Number(item.Subtotal || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="p-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const customName = prompt('Ubah deskripsi manual produk:', item.Nama_Produk);
                                        if (customName) {
                                          handleUpdateProductInGroup(grp.id, pIdx, 'Nama_Produk', customName);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                                      title="Pengaturan Rincian Produk Manual"
                                    >
                                      <Settings size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProductFromGroup(grp.id, pIdx)}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                      title="Hapus Produk"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Tombol Tambah Produk di Dalam Card */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddProductToGroup(grp.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus size={13} />
                          <span>+ Tambah Produk</span>
                        </button>
                        <div className="text-right text-xs">
                          <span className="text-slate-500 mr-2">Subtotal Data Kirim #{gIdx + 1}:</span>
                          <span className="font-mono font-bold text-slate-900">
                            Rp {grp.subtotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* GRAND TOTAL KESELURUHAN & CATATAN */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-300 font-bold block">
                    GRAND TOTAL KESELURUHAN
                  </span>
                  <span className="text-[11px] text-slate-400 italic">
                    Terbilang: {angkaKeTerbilang(invoiceForm.Grand_Total).toLowerCase()} rupiah
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-amber-400">
                  Rp {invoiceForm.Grand_Total.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions: Batal (Abu-abu/Merah) & Simpan (Kuning/Gold) */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-100 border-t border-slate-200 flex-shrink-0 sticky bottom-0 z-20">
              <button
                type="button"
                onClick={() => {
                  setShowCustomInvoiceModal(false);
                  setEditingCustomInvoice(null);
                }}
                className="px-5 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-200 font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSaveCustomInvoice}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Save size={15} />
                <span>Simpan & Buat Draft Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PRATINJAU RESMI & CETAK INVOICE CUSTOM                  */}
      {/* ============================================================== */}
      {viewCustomInvoiceModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto printable-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setViewCustomInvoiceModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] printable-modal-card">
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-30 shadow-sm no-print">
              <div className="flex items-center gap-2">
                <Receipt className="text-indigo-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Pratinjau Resmi Invoice Custom Gabungan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewCustomInvoiceModal(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                title="Tutup (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Document Area: EXACT REPLICA OF THE UPLOADED DISTRIBUTION INVOICE TEMPLATE */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 font-sans text-slate-900 bg-white overflow-x-auto print:p-0 printable-content printable-scroll-area" style={{ minHeight: '650px' }}>
              <div className="space-y-3.5 max-w-2xl mx-auto">
                {/* Kop Surat Header (Custom upload or official banner) */}
                {docSettings.useCustomKopImage && docSettings.customKopImage ? (
                  <div className="flex justify-center mb-1">
                    <img 
                      src={docSettings.customKopImage} 
                      alt="Kop Surat" 
                      style={{
                        width: `${docSettings.kopWidth ?? 100}%`,
                        height: `${docSettings.kopHeight ?? 90}px`,
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                ) : (
                  <KopSuratBanner className="w-full mb-1" />
                )}

                {/* Document Title: INVOICE (Clean centered, no blue underline) */}
                <div className="text-center my-3">
                  <h2 className="text-sm font-bold tracking-wider text-black">
                    INVOICE
                  </h2>
                </div>

                {/* Group items by shipment for distinct delivery tables */}
                {(() => {
                  const groups = groupInvoiceItemsByShipment(
                    viewCustomInvoiceModal.Items,
                    viewCustomInvoiceModal.No_Surat_Jalan_List?.[0] || '-',
                    viewCustomInvoiceModal.Tanggal,
                    viewCustomInvoiceModal.Kirim_Ke || viewCustomInvoiceModal.Penerima || viewCustomInvoiceModal.Nama_Pelanggan
                  );
                  const isMulti = groups.length > 1;
                  const aggregatedItems = getAggregatedInvoiceItems(viewCustomInvoiceModal.Items);
                  const grandTotal = viewCustomInvoiceModal.Grand_Total || viewCustomInvoiceModal.Items.reduce((acc, curr) => acc + (Number(curr.Subtotal) || 0), 0);

                  return (
                    <div className="space-y-4">
                      {/* 2 Column Metadata with Aligned Colons */}
                      <div className="grid grid-cols-2 gap-6 text-xs mb-2">
                        <div className="space-y-1">
                          <div className="grid grid-cols-[60px_10px_1fr]">
                            <span className="text-slate-800">Kepada</span>
                            <span>:</span>
                            <span className="font-bold text-slate-900 uppercase">{viewCustomInvoiceModal.Nama_Pelanggan}</span>
                          </div>
                          <div className="grid grid-cols-[60px_10px_1fr]">
                            <span className="text-slate-800">Alamat</span>
                            <span>:</span>
                            <span className="text-slate-800 uppercase">{viewCustomInvoiceModal.Alamat_Pelanggan || '-'}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="grid grid-cols-[100px_10px_1fr]">
                            <span className="text-slate-800">Tanggal Invoice</span>
                            <span>:</span>
                            <span className="text-slate-900">{formatIndonesianFullDate(viewCustomInvoiceModal.Tanggal)}</span>
                          </div>
                          <div className="grid grid-cols-[100px_10px_1fr]">
                            <span className="text-slate-800">No. Invoice</span>
                            <span>:</span>
                            <span className="font-mono text-slate-900">
                              {viewCustomInvoiceModal.No_Invoice}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Items Tables: Separate Table for each delivery */}
                      <div className="space-y-4 pt-1">
                        {groups.map((grp, gIdx) => (
                          <div key={gIdx} className="mb-3">
                            {/* Centered: Kirim Ke : [Tujuan] */}
                            <div className="text-center font-bold text-xs mb-1 uppercase tracking-wide text-black">
                              Kirim Ke : {grp.kirimKe || viewCustomInvoiceModal.Penerima || viewCustomInvoiceModal.Nama_Pelanggan}
                            </div>

                            {/* No Surat Jalan (Left) & Tanggal Kirim (Right) */}
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div>
                                <span className="text-slate-800">No Surat Jalan  : </span>
                                <span className="font-mono text-slate-900">{grp.noSuratJalan}</span>
                              </div>
                              <div>
                                <span className="text-slate-800">Tanggal Kirim  : </span>
                                <span className="text-slate-900">{formatIndonesianFullDate(grp.tanggalKirim)}</span>
                              </div>
                            </div>

                            <table className="w-full text-xs border-collapse border border-black">
                              <thead>
                                <tr className="border border-black font-semibold text-center bg-white">
                                  <th className="border border-black px-2 py-1 w-10 text-center">No</th>
                                  <th className="border border-black px-2 py-1 text-center">Nama Produk</th>
                                  <th className="border border-black px-2 py-1 w-12 text-center">Qty</th>
                                  <th className="border border-black px-2 py-1 w-16 text-center">Satuan</th>
                                  <th className="border border-black px-2 py-1 w-28 text-center">Harga/satuan</th>
                                  <th className="border border-black px-2 py-1 w-32 text-center">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grp.items.map((item, idx) => {
                                  const prod = (products || []).find(p => p && (p.ID_Produk === item?.ID_Produk || p.Nama_Produk === item?.Nama_Produk));
                                  const satuanStr = item?.Satuan || (prod?.Satuan?.toLowerCase().includes('galon') || String(item?.Nama_Produk || '').toLowerCase().includes('galon') ? 'Galon' : 'Karton');
                                  const isZero = (Number(item?.Qty) || 0) === 0 || (Number(item?.Subtotal) || 0) === 0;

                                  return (
                                    <tr key={idx} className="border border-black">
                                      <td className="border border-black px-2 py-0.5 text-center font-mono">{idx + 1}</td>
                                      <td className="border border-black px-2 py-0.5 text-left font-medium text-slate-900">{item.Nama_Produk}</td>
                                      <td className="border border-black px-2 py-0.5 text-center font-mono">{item.Qty}</td>
                                      <td className="border border-black px-2 py-0.5 text-center">{satuanStr}</td>
                                      <td className="border border-black px-2 py-0.5 font-mono">
                                        <div className="flex justify-between items-center px-0.5">
                                          <span>Rp</span>
                                          <span>{item.Harga_Satuan ? formatRupiahSen(item.Harga_Satuan) : '-'}</span>
                                        </div>
                                      </td>
                                      <td className="border border-black px-2 py-0.5 font-mono">
                                        <div className="flex justify-between items-center px-0.5">
                                          <span>Rp</span>
                                          <span>{isZero ? '-' : formatRupiahSen(item.Subtotal)}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* Subtotal Row */}
                                <tr className="border border-black">
                                  <td colSpan={5} className="border-0"></td>
                                  <td className="border border-black px-2 py-0.5 font-mono font-bold">
                                    <div className="flex justify-between items-center px-0.5">
                                      <span>Rp</span>
                                      <span>{formatRupiahSen(grp.subtotal)}</span>
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>

                            {/* Terbilang per Pengiriman */}
                            <div className="text-xs mt-1">
                              <p className="font-normal text-slate-800">Terbilang :</p>
                              <p className="italic text-slate-800 font-normal">
                                {angkaKeTerbilang(grp.subtotal).toLowerCase()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* TOTAL Summary Table (When multi-shipment) */}
                      {isMulti && (
                        <div className="mt-4 mb-3">
                          <table className="w-full text-xs border-collapse border border-black">
                            <thead>
                              <tr className="border border-black font-semibold text-center bg-white">
                                <th rowSpan={2} className="border border-black px-2 py-1 w-10 text-center">No</th>
                                <th rowSpan={2} className="border border-black px-2 py-1 text-center">Nama Produk</th>
                                <th rowSpan={2} className="border border-black px-2 py-1 w-12 text-center">Qty</th>
                                <th colSpan={3} className="border border-black px-2 py-1 text-center font-bold tracking-wider">TOTAL</th>
                              </tr>
                              <tr className="border border-black font-semibold text-center bg-white">
                                <th className="border border-black px-2 py-1 w-16 text-center">Satuan</th>
                                <th className="border border-black px-2 py-1 w-28 text-center">Harga/satuan</th>
                                <th className="border border-black px-2 py-1 w-32 text-center">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {aggregatedItems.map((item, idx) => {
                                const isZero = (Number(item.qty) || 0) === 0 || (Number(item.subtotal) || 0) === 0;

                                return (
                                  <tr key={idx} className="border border-black">
                                    <td className="border border-black px-2 py-0.5 text-center font-mono">{idx + 1}</td>
                                    <td className="border border-black px-2 py-0.5 text-left font-medium text-slate-900">{item.nama}</td>
                                    <td className="border border-black px-2 py-0.5 text-center font-mono">{item.qty}</td>
                                    <td className="border border-black px-2 py-0.5 text-center">{item.satuan}</td>
                                    <td className="border border-black px-2 py-0.5 font-mono">
                                      <div className="flex justify-between items-center px-0.5">
                                        <span>Rp</span>
                                        <span>{item.harga ? formatRupiahSen(item.harga) : '-'}</span>
                                      </div>
                                    </td>
                                    <td className="border border-black px-2 py-0.5 font-mono">
                                      <div className="flex justify-between items-center px-0.5">
                                        <span>Rp</span>
                                        <span>{isZero ? '-' : formatRupiahSen(item.subtotal)}</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Grand Total Row */}
                              <tr className="border border-black">
                                <td colSpan={5} className="border-0"></td>
                                <td className="border border-black px-2 py-0.5 font-mono font-bold">
                                  <div className="flex justify-between items-center px-0.5">
                                    <span>Rp</span>
                                    <span>{formatRupiahSen(grandTotal)}</span>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Terbilang for Grand Total */}
                          <div className="text-xs mt-1">
                            <p className="font-normal text-slate-800">Terbilang :</p>
                            <p className="italic text-slate-800 font-normal">
                              {angkaKeTerbilang(grandTotal).toLowerCase()}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Footer: Left Payment Info & Right Signature/Stamp */}
                      <div className="pt-4 flex justify-between items-end">
                        <div className="text-xs text-slate-800 space-y-0.5 max-w-[340px]">
                          <p>{docSettings.infoPembayaranTeks || 'Pembayaran dapat dilakukan transfer atau Cash / By Driver'}</p>
                          <p className="font-bold">{docSettings.bankRekening || 'BSI 1607134444 (KSPPS BMT SYECH HASYIM ASYARI)'}</p>
                          {viewCustomInvoiceModal.Keterangan && (
                            <p className="text-[10px] italic text-slate-500 pt-0.5">
                              Catatan: {viewCustomInvoiceModal.Keterangan}
                            </p>
                          )}
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
                                  style={{
                                    width: `${docSettings.capWidth ?? 80}px`,
                                    height: `${docSettings.capHeight ?? 80}px`
                                  }}
                                  className="absolute left-4 top-0 object-contain" 
                                />
                              ) : (
                                <div 
                                  className="absolute left-2 top-0 origin-top-left"
                                  style={{ transform: `scale(${((docSettings.capWidth ?? 80) / 90).toFixed(2)})` }}
                                >
                                  <OfficialStampWithSignature />
                                </div>
                              )
                            )}

                            {/* TTD Custom jika ada */}
                            {docSettings.showTtd && docSettings.useCustomTtdImage && docSettings.customTtdImage && (
                              <img 
                                src={docSettings.customTtdImage} 
                                alt="Tanda Tangan" 
                                style={{
                                  width: `${docSettings.ttdWidth ?? 110}px`,
                                  height: `${docSettings.ttdHeight ?? 75}px`
                                }}
                                className="absolute left-10 -top-1 object-contain z-10" 
                              />
                            )}

                            {/* TTD Default jika cap dimatikan tapi ttd aktif */}
                            {!docSettings.showCap && docSettings.showTtd && !docSettings.useCustomTtdImage && (
                              <div 
                                className="absolute left-10 -top-1 origin-top-left"
                                style={{ transform: `scale(${((docSettings.ttdWidth ?? 110) / 110).toFixed(2)})` }}
                              >
                                <OfficialStampWithSignature />
                              </div>
                            )}
                          </div>

                          <p className="font-bold text-slate-900 text-xs underline mt-0.5">
                            {docSettings.namaPenandatangan || 'Marko Dwi Nugroho'}
                          </p>
                          <p className="text-[11px] text-slate-800">
                            ({docSettings.jabatanPenandatangan || 'Admin'})
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-30 no-print">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Cetak Langsung</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCustomInvoicePDF(viewCustomInvoiceModal)}
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileDown size={14} />
                  <span>Unduh PDF Resmi</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenDocSettings}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                >
                  <Settings size={13} />
                  <span>Ubah Setting Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewCustomInvoiceModal(null)}
                  className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <X size={14} />
                  <span>Tutup & Kembali</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SETTING INVOICE CUSTOM (KOP, CAP, TTD, & PENANDATANGAN)  */}
      {/* ============================================================== */}
      {showDocSettingsModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDocSettingsModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <Settings className="text-cyan-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Pengaturan Dokumen & Branding Invoice Custom
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDocSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 flex items-start gap-2.5">
                <Sliders size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  Pengaturan di sini akan langsung diterapkan pada <b>Pratinjau Layar</b>, <b>Cetak Langsung (Print)</b>, serta <b>File PDF Resmi</b> untuk Invoice Custom. Anda dapat mengunggah gambar Kop Surat, Cap Stempel, Tanda Tangan Anda sendiri, serta mengganti nama penandatangan.
                </p>
              </div>

              {/* Seksi 1: Kop Surat Perusahaan */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    1. Kop Surat & Identitas Perusahaan
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={tempDocSettings.useCustomKopImage}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, useCustomKopImage: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Gunakan Banner Kop Custom</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan / Lembaga</label>
                    <input
                      type="text"
                      value={tempDocSettings.namaPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, namaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-semibold"
                      placeholder="PT. ANUGERAH ILLAHI RABBI"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sub-Nama / Deskripsi Usaha</label>
                    <input
                      type="text"
                      value={tempDocSettings.subNamaPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, subNamaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor / Pabrik</label>
                    <input
                      type="text"
                      value={tempDocSettings.alamatPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, alamatPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Kontak / Telepon Pabrik</label>
                    <input
                      type="text"
                      value={tempDocSettings.kontakPerusahaan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, kontakPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="(0272) 898123"
                    />
                  </div>
                </div>

                {/* Upload Banner Kop Custom & Kontrol Ukuran */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Image size={14} className="text-blue-600" />
                    <span>Upload Banner Kop Surat Custom & Pengaturan Ukuran (Berlaku untuk Surat, PO & Invoice)</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
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
                        Hapus Kop Custom
                      </button>
                    )}
                  </div>

                  {/* Kontrol Ukuran Kop Surat */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 bg-white rounded-lg border border-slate-200">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Lebar Kop Surat (%):</span>
                        <span className="font-mono text-blue-700">{tempDocSettings.kopWidth ?? 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="100"
                        step="5"
                        value={tempDocSettings.kopWidth ?? 100}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, kopWidth: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Tinggi Kop Surat (px):</span>
                        <span className="font-mono text-blue-700">{tempDocSettings.kopHeight ?? 90}px</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="180"
                        step="5"
                        value={tempDocSettings.kopHeight ?? 90}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, kopHeight: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {tempDocSettings.customKopImage && (
                    <div className="mt-2 p-1.5 bg-white border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                      <img 
                        src={tempDocSettings.customKopImage} 
                        alt="Preview Kop" 
                        style={{
                          width: `${tempDocSettings.kopWidth ?? 100}%`,
                          height: `${tempDocSettings.kopHeight ?? 90}px`,
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Seksi 2: Nama Penandatangan, Tanda Tangan (TTD), & Cap Stempel */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  2. Nama Penandatangan, Tanda Tangan, & Cap / Stempel
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Penandatangan</label>
                    <input
                      type="text"
                      value={tempDocSettings.namaPenandatangan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, namaPenandatangan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-bold text-slate-900"
                      placeholder="H. Mujiburrahman, SIP"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jabatan / Keterangan Penandatangan</label>
                    <input
                      type="text"
                      value={tempDocSettings.jabatanPenandatangan}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, jabatanPenandatangan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white"
                      placeholder="Direktur Utama PT. AIR"
                    />
                  </div>
                </div>

                {/* Upload & Pengaturan TTD */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800">Tanda Tangan (TTD)</label>
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

                  {/* Kontrol Ukuran TTD */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Lebar TTD:</span>
                        <span className="font-mono text-blue-700">{tempDocSettings.ttdWidth ?? 110}px</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={tempDocSettings.ttdWidth ?? 110}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, ttdWidth: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Tinggi TTD:</span>
                        <span className="font-mono text-blue-700">{tempDocSettings.ttdHeight ?? 75}px</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="140"
                        step="5"
                        value={tempDocSettings.ttdHeight ?? 75}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, ttdHeight: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {tempDocSettings.customTtdImage && (
                    <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                      <img 
                        src={tempDocSettings.customTtdImage} 
                        alt="TTD Custom" 
                        style={{
                          width: `${tempDocSettings.ttdWidth ?? 110}px`,
                          height: `${tempDocSettings.ttdHeight ?? 75}px`,
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Upload & Pengaturan Cap / Stempel */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800">Cap / Stempel Perusahaan</label>
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

                  {/* Kontrol Ukuran Cap / Stempel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Lebar Cap:</span>
                        <span className="font-mono text-blue-700">{tempDocSettings.capWidth ?? 80}px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="160"
                        step="5"
                        value={tempDocSettings.capWidth ?? 80}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, capWidth: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Tinggi Cap:</span>
                        <span className="font-mono text-blue-700">{tempDocSettings.capHeight ?? 80}px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="160"
                        step="5"
                        value={tempDocSettings.capHeight ?? 80}
                        onChange={e => setTempDocSettings({ ...tempDocSettings, capHeight: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {tempDocSettings.customCapImage && (
                    <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                      <img 
                        src={tempDocSettings.customCapImage} 
                        alt="Cap Custom" 
                        style={{
                          width: `${tempDocSettings.capWidth ?? 80}px`,
                          height: `${tempDocSettings.capHeight ?? 80}px`,
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Seksi 3: Informasi Pembayaran & Rekening Bank */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  3. Informasi Pembayaran Transfer Resmi
                </h4>

                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Teks Informasi Pembayaran</label>
                    <textarea
                      rows={2}
                      value={tempDocSettings.infoPembayaranTeks}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, infoPembayaranTeks: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs leading-relaxed"
                      placeholder="Bank Mandiri / BCA: Atas Nama PT. ANUGERAH ILLAHI RABBI..."
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor Rekening & Nama Bank</label>
                    <input
                      type="text"
                      value={tempDocSettings.bankRekening}
                      onChange={e => setTempDocSettings({ ...tempDocSettings, bankRekening: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-mono text-xs"
                      placeholder="Bank Mandiri: 138-00-1234567-8 / BCA: 015-888-9999"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-20">
              <button
                type="button"
                onClick={handleResetDocSettings}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-700 border border-slate-300 rounded-lg hover:bg-red-50 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Kembalikan ke template default As-Shofaa"
              >
                <RotateCcw size={13} />
                <span>Reset ke Default</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocSettingsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveDocSettings}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Save size={14} />
                  <span>Simpan Pengaturan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PENGATURAN FORMAT DOKUMEN & KOP SURAT RESMI             */}
      {/* ============================================================== */}
      {showGlobalLetterSettingsModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowGlobalLetterSettingsModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  Pengaturan Format & Kop Surat Resmi
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowGlobalLetterSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
              <p className="text-slate-600 leading-relaxed bg-blue-50 border border-blue-200 p-3 rounded-lg">
                Pengaturan ini menjadi standar kop, stempel, dan tanda tangan default untuk seluruh <strong>Surat Eksternal, Surat Internal, dan Surat Keterangan</strong>. Pengaturan ini terpisah dari Invoice Custom dan PO.
              </p>

              {/* Seksi 1: Teks Kop Surat */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  1. Kop Surat & Identitas Instansi
                </h4>

                <div className="space-y-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan / Organisasi</label>
                    <input
                      type="text"
                      value={tempGlobalLetterSettings.namaPerusahaan || ''}
                      onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, namaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white font-semibold text-slate-900 text-xs"
                      placeholder="PT. ANUGERAH ILLAHI RABBI"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sub Nama / Tagline Instansi</label>
                    <input
                      type="text"
                      value={tempGlobalLetterSettings.subNamaPerusahaan || ''}
                      onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, subNamaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs"
                      placeholder="Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Kantor / Pabrik</label>
                    <input
                      type="text"
                      value={tempGlobalLetterSettings.alamatPerusahaan || ''}
                      onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, alamatPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs"
                      placeholder="Dk. Gading Baru, RT.03, RW.08, Belangwetan, Klaten Utara, Klaten"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kontak Resmi (Telepon / Email / WhatsApp)</label>
                    <input
                      type="text"
                      value={tempGlobalLetterSettings.kontakPerusahaan || ''}
                      onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, kontakPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none bg-white text-xs"
                      placeholder="0856 4000 1926 | (0272) 898123"
                    />
                  </div>
                </div>

                {/* Upload Gambar Kop Surat */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Image size={13} className="text-slate-500" />
                      <span>Gunakan Gambar Kop Custom (Banner Header)</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={tempGlobalLetterSettings.useCustomKopImage || false}
                      onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, useCustomKopImage: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                  </div>

                  {tempGlobalLetterSettings.useCustomKopImage && (
                    <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const b64 = await compressUploadedImage(file, 900, 180);
                            setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, customKopImage: b64 });
                          }}
                          className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        />
                        {tempGlobalLetterSettings.customKopImage && (
                          <button
                            type="button"
                            onClick={() => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, customKopImage: '' })}
                            className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                          >
                            Hapus Gambar
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">
                            Lebar Kop: <strong>{tempGlobalLetterSettings.kopWidth ?? 100}%</strong>
                          </label>
                          <input
                            type="range"
                            min="30"
                            max="100"
                            value={tempGlobalLetterSettings.kopWidth ?? 100}
                            onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, kopWidth: Number(e.target.value) })}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">
                            Tinggi Kop: <strong>{tempGlobalLetterSettings.kopHeight ?? 90}px</strong>
                          </label>
                          <input
                            type="range"
                            min="40"
                            max="200"
                            step="5"
                            value={tempGlobalLetterSettings.kopHeight ?? 90}
                            onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, kopHeight: Number(e.target.value) })}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>

                      {tempGlobalLetterSettings.customKopImage && (
                        <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                          <img
                            src={tempGlobalLetterSettings.customKopImage}
                            alt="Preview Kop Surat Resmi"
                            style={{
                              width: `${tempGlobalLetterSettings.kopWidth ?? 100}%`,
                              height: `${tempGlobalLetterSettings.kopHeight ?? 90}px`,
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Seksi 2: Cap & Stempel Surat Resmi */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  2. Cap & Stempel Resmi Perusahaan
                </h4>

                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Tampilkan Cap / Stempel pada Surat Resmi</label>
                  <input
                    type="checkbox"
                    checked={tempGlobalLetterSettings.showCap ?? true}
                    onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, showCap: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="font-semibold text-slate-700">Gunakan Gambar Cap Custom Sendiri</label>
                  <input
                    type="checkbox"
                    checked={tempGlobalLetterSettings.useCustomCapImage || false}
                    onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, useCustomCapImage: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                {tempGlobalLetterSettings.useCustomCapImage && (
                  <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const b64 = await compressUploadedImage(file, 200, 200);
                          setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, customCapImage: b64 });
                        }}
                        className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                      {tempGlobalLetterSettings.customCapImage && (
                        <button
                          type="button"
                          onClick={() => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, customCapImage: '' })}
                          className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus Cap
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Ukuran Cap: <strong>{tempGlobalLetterSettings.capWidth ?? 80}px</strong>
                      </label>
                      <input
                        type="range"
                        min="40"
                        max="160"
                        step="5"
                        value={tempGlobalLetterSettings.capWidth ?? 80}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, capWidth: val, capHeight: val });
                        }}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {tempGlobalLetterSettings.customCapImage && (
                      <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                        <img
                          src={tempGlobalLetterSettings.customCapImage}
                          alt="Cap Custom"
                          style={{
                            width: `${tempGlobalLetterSettings.capWidth ?? 80}px`,
                            height: `${tempGlobalLetterSettings.capHeight ?? 80}px`,
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seksi 3: Tanda Tangan Default */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  3. Tanda Tangan Default (Opsional Gambar)
                </h4>

                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Tampilkan Tanda Tangan Digital pada Surat</label>
                  <input
                    type="checkbox"
                    checked={tempGlobalLetterSettings.showTtd ?? true}
                    onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, showTtd: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="font-semibold text-slate-700">Gunakan Gambar TTD Custom</label>
                  <input
                    type="checkbox"
                    checked={tempGlobalLetterSettings.useCustomTtdImage || false}
                    onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, useCustomTtdImage: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  />
                </div>

                {tempGlobalLetterSettings.useCustomTtdImage && (
                  <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const b64 = await compressUploadedImage(file, 300, 150);
                          setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, customTtdImage: b64 });
                        }}
                        className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                      />
                      {tempGlobalLetterSettings.customTtdImage && (
                        <button
                          type="button"
                          onClick={() => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, customTtdImage: '' })}
                          className="text-xs text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus TTD
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Lebar TTD: <strong>{tempGlobalLetterSettings.ttdWidth ?? 110}px</strong>
                        </label>
                        <input
                          type="range"
                          min="60"
                          max="200"
                          value={tempGlobalLetterSettings.ttdWidth ?? 110}
                          onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, ttdWidth: Number(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">
                          Tinggi TTD: <strong>{tempGlobalLetterSettings.ttdHeight ?? 75}px</strong>
                        </label>
                        <input
                          type="range"
                          min="40"
                          max="150"
                          value={tempGlobalLetterSettings.ttdHeight ?? 75}
                          onChange={e => setTempGlobalLetterSettings({ ...tempGlobalLetterSettings, ttdHeight: Number(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>

                    {tempGlobalLetterSettings.customTtdImage && (
                      <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded flex items-center justify-center">
                        <img
                          src={tempGlobalLetterSettings.customTtdImage}
                          alt="TTD Custom"
                          style={{
                            width: `${tempGlobalLetterSettings.ttdWidth ?? 110}px`,
                            height: `${tempGlobalLetterSettings.ttdHeight ?? 75}px`,
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-20">
              <button
                type="button"
                onClick={handleResetGlobalLetterSettings}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-red-700 border border-slate-300 rounded-lg hover:bg-red-50 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Kembalikan format kop surat ke template standar"
              >
                <RotateCcw size={13} />
                <span>Reset ke Standar</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGlobalLetterSettingsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveGlobalLetterSettings}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <Save size={14} />
                  <span>Simpan Pengaturan Surat</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: KOLEKSI CONTOH TEMPLATE SURAT RESMI AIRIS               */}
      {/* ============================================================== */}
      {showTemplateGalleryModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowTemplateGalleryModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider">
                    Koleksi Contoh Template Surat Resmi
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Pilih template surat untuk membuat naskah surat resmi secara instan dengan tabel dan format rapi
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowTemplateGalleryModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title="Tutup (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(['All', 'Surat Eksternal', 'Surat Internal', 'Surat Keterangan'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setTemplateFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      templateFilter === cat
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat === 'All' ? 'Semua Kategori' : cat}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-500">
                Menampilkan{' '}
                <strong>
                  {templateFilter === 'All'
                    ? OFFICIAL_LETTER_TEMPLATES.length
                    : OFFICIAL_LETTER_TEMPLATES.filter(t => t.tipe === templateFilter).length}
                </strong>{' '}
                Template
              </span>
            </div>

            {/* Grid of Templates */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50">
              {OFFICIAL_LETTER_TEMPLATES.filter(t => templateFilter === 'All' || t.tipe === templateFilter).map(tpl => (
                <div 
                  key={tpl.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tpl.tipe === 'Surat Eksternal'
                          ? 'bg-blue-100 text-blue-800'
                          : tpl.tipe === 'Surat Internal'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {tpl.tipe}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {tpl.signatories.length} Penandatangan
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {tpl.judul}
                    </h4>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {tpl.deskripsi}
                    </p>

                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                      <div><strong className="text-slate-700">Perihal:</strong> {tpl.perihal}</div>
                      <div><strong className="text-slate-700">Kepada:</strong> {tpl.kepada}</div>
                      {tpl.lampiran && tpl.lampiran !== '-' && (
                        <div><strong className="text-slate-700">Lampiran:</strong> {tpl.lampiran}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                    >
                      <Sparkles size={13} />
                      <span>Gunakan Template Ini</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateGalleryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Tutup
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
                  {tempPOSettings.showCap !== false ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-center min-h-[90px]">
                      {tempPOSettings.useCustomCapImage && tempPOSettings.customCapImage ? (
                        <img
                          src={tempPOSettings.customCapImage}
                          alt="Cap Stempel PO"
                          style={{
                            width: `${tempPOSettings.capWidth ?? 80}px`,
                            height: `${tempPOSettings.capHeight ?? 80}px`,
                            objectFit: 'contain'
                          }}
                        />
                      ) : (
                        <OfficialCapStamp size={tempPOSettings.capWidth ?? 85} />
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded text-center text-slate-400 text-xs italic">
                      Dokumen PO akan dicetak bersih tanpa cap stempel (tanda tangan polos)
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
