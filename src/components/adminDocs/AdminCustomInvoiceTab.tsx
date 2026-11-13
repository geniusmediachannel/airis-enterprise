import React, { useState, useEffect, useMemo } from 'react';
import { 
  Receipt, Plus, Printer, Download, Eye, Trash2, Edit2, 
  FileCheck, X, Building, Save, FileText, FileDown, Send, 
  CheckCircle2, Copy, Truck, ShoppingBag, Search, Check, 
  RefreshCw, Calendar, Settings, Image, Sliders, RotateCcw,
  FileSpreadsheet
} from 'lucide-react';
import { 
  CustomInvoiceItem, CustomInvoiceDetailItem, CustomerItem, 
  DistributionItem, DistributionProductDetail, ProductItem, 
  DocumentTemplateSettings, ShipmentGroup
} from '../../types';
import { getTableData, setTableData, deleteTableRow } from '../../services/dbAdapter';
import { exportDataToExcel } from '../../services/excelService';
import { generateInvoicePDF, printInvoicePDF, sanitizeFilename, angkaKeTerbilang, formatRupiahSen } from '../../services/pdfService';
import { showToast as showToastGlobal } from '../ToastContainer';
import { confirmAction } from '../ConfirmDialog';
import { formatDateDDMMYYYY } from '../../services/formatters';

interface AdminCustomInvoiceTabProps {
  distributions?: DistributionItem[];
  distributionItems?: DistributionProductDetail[];
  products?: ProductItem[];
  customers?: CustomerItem[];
  onRefresh: () => void;
}

export const AdminCustomInvoiceTab: React.FC<AdminCustomInvoiceTabProps> = ({
  distributions = [],
  distributionItems = [],
  products = [],
  customers = [],
  onRefresh
}) => {
  const [customInvoices, setCustomInvoices] = useState<CustomInvoiceItem[]>(() => {
    const data = getTableData<CustomInvoiceItem>('Data_Custom_Invoice', []);
    return Array.isArray(data) ? data : [];
  });

  useEffect(() => {
    const handleDbChange = () => {
      setCustomInvoices(getTableData<CustomInvoiceItem>('Data_Custom_Invoice', []));
    };
    window.addEventListener('airis_db_updated', handleDbChange);
    window.addEventListener('storage', handleDbChange);
    return () => {
      window.removeEventListener('airis_db_updated', handleDbChange);
      window.removeEventListener('storage', handleDbChange);
    };
  }, []);
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

  // Helper to format date as standard DD-MM-YYYY (e.g. 15-10-2026)
  const formatDisplayDate = (dateStr?: string): string => {
    return formatDateDDMMYYYY(dateStr);
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

    await deleteTableRow('Data_Custom_Invoice', id);
    const filtered = customInvoices.filter(i => i.ID_Invoice !== id);
    setCustomInvoices(filtered);
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

  const handlePrintCustomInvoicePDF = async (inv: CustomInvoiceItem) => {
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

      await printInvoicePDF({
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
    } catch (e) {
      console.error(e);
      window.print();
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

  return (
    <div className="space-y-4">
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
                              {inv.Level_Pelanggan || 'Distributor'} {inv.No_Kontak ? `â€¢ ${inv.No_Kontak}` : ''}
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
                        <span>â€¢</span>
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
                {/* Kop Surat Header (Custom upload atau Kop Teks Resmi yang Rapi) */}
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
                  <div className="text-center pb-2.5 border-b-2 border-slate-900 mb-2">
                    <h1 className="text-xl font-black tracking-wide text-slate-950 uppercase">
                      {docSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                    </h1>
                    <p className="text-xs text-slate-600 font-semibold">
                      {docSettings.subNamaPerusahaan || 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {docSettings.alamatPerusahaan || 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara'} {docSettings.kontakPerusahaan ? `| Telp: ${docSettings.kontakPerusahaan}` : ''}
                    </p>
                  </div>
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
                            {/* Cap / Stempel: Hanya tampil jika diaktifkan dan ada gambar kustom */}
                            {docSettings.showCap && docSettings.useCustomCapImage && docSettings.customCapImage && (
                              <img 
                                src={docSettings.customCapImage} 
                                alt="Cap Stempel" 
                                style={{
                                  width: `${docSettings.capWidth ?? 80}px`,
                                  height: `${docSettings.capHeight ?? 80}px`
                                }}
                                className="absolute left-4 top-0 object-contain" 
                              />
                            )}

                            {/* TTD Custom: Hanya tampil jika diaktifkan dan ada gambar kustom */}
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
                  onClick={() => handlePrintCustomInvoicePDF(viewCustomInvoiceModal)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Cetak Dokumen Sesuai Format PDF Resmi"
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
    </div>
  );
};
