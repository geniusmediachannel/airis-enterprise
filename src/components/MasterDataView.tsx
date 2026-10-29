import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Plus, Search, Edit2, Trash2, Download, 
  Printer, CheckCircle2, AlertCircle, X, Save, FileSpreadsheet,
  FileDown, RefreshCw, TrendingUp, TrendingDown, Calendar, CalendarClock, History, Tag, ArrowRight, Clock,
  ShieldCheck, UserCheck, UserX, Layers, Check
} from 'lucide-react';
import { 
  ProductItem, CustomerItem, SupplierItem, RawMaterialItem, 
  BOMItem, EmployeeItem, UserAccount, SpecialPriceItem, UserRole, PriceHistoryItem 
} from '../types';
import { getTableData, setTableData } from '../services/dbAdapter';
import { exportDataToExcel, ExcelTemplateType } from '../services/excelService';
import { generateTableReportPDF } from '../services/pdfService';
import { 
  getAllPriceHistories, recordRawMaterialPriceChange, recordProductPriceChange, 
  deletePriceHistory, getPrecedingReferencePrice, recalculateChainedPriceHistories 
} from '../services/priceService';
import { AVAILABLE_DIVISIONS, getUserRoles } from '../services/permissionService';
import { approveUserAccount, rejectUserAccount } from '../services/supabaseAuth';
import { confirmAction } from './ConfirmDialog';
import { showToast } from './ToastContainer';

interface MasterDataViewProps {
  products: ProductItem[];
  customers: CustomerItem[];
  suppliers: SupplierItem[];
  rawMaterials: RawMaterialItem[];
  boms: BOMItem[];
  employees: EmployeeItem[];
  users: UserAccount[];
  specialPrices: SpecialPriceItem[];
  onRefresh: () => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  products,
  customers,
  suppliers,
  rawMaterials,
  boms,
  employees,
  users,
  specialPrices,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'produk' | 'pelanggan' | 'supplier' | 'bahan' | 'bom' | 'karyawan' | 'harga_khusus' | 'user' | 'histori_harga'>('produk');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // State untuk Histori & Pengaturan Perubahan Harga Berdasarkan Tanggal
  const [priceHistories, setPriceHistories] = useState<PriceHistoryItem[]>(() => getAllPriceHistories());
  const [showPriceModal, setShowPriceModal] = useState<boolean>(false);
  const [priceFilterType, setPriceFilterType] = useState<'all' | 'Bahan Penolong' | 'Produk'>('all');
  const [priceFilterMonth, setPriceFilterMonth] = useState<string>('all');
  const [priceSearchQuery, setPriceSearchQuery] = useState<string>('');

  const [priceForm, setPriceForm] = useState<{
    tipe: 'Bahan Penolong' | 'Produk';
    idItem: string;
    tanggalBerlaku: string;
    keterangan: string;
    hargaBaruBahan: number | '';
    hargaDistributor: number | '';
    hargaAgen: number | '';
    hargaReseller: number | '';
    hargaKonsumen: number | '';
  }>({
    tipe: 'Bahan Penolong',
    idItem: '',
    tanggalBerlaku: new Date().toISOString().slice(0, 10),
    keterangan: '',
    hargaBaruBahan: '',
    hargaDistributor: '',
    hargaAgen: '',
    hargaReseller: '',
    hargaKonsumen: ''
  });

  const reloadPriceHistories = () => {
    setPriceHistories(getAllPriceHistories());
  };

  useEffect(() => {
    if (activeTab === 'histori_harga') {
      reloadPriceHistories();
    }
  }, [activeTab]);

  // Open Add modal with proper defaults
  const handleOpenAdd = () => {
    if (activeTab === 'histori_harga') {
      handleOpenPriceModal('Produk');
      return;
    }
    setEditingItem(null);
    let initial: Record<string, any> = {};
    if (activeTab === 'produk') {
      const maxNum = products.length + 1;
      initial = { 
        ID_Produk: `ASH-PRD${String(maxNum).padStart(3, '0')}`, 
        Nama_Produk: '', 
        Kategori: 'Air Mineral Cup', 
        Satuan: 'Dus', 
        Harga_Distributor: '', 
        Harga_Agen: '', 
        Harga_Reseller: '', 
        Harga_Konsumen: '', 
        Status: 'Aktif' 
      };
    } else if (activeTab === 'pelanggan') {
      const maxNum = customers.length + 1;
      initial = { 
        ID_Pelanggan: `PLG-${String(maxNum).padStart(4, '0')}`, 
        Nama_Pelanggan: '', 
        No_Telp: '', 
        Alamat: '', 
        Level_Pelanggan: 'Agen', 
        Status: 'Aktif' 
      };
    } else if (activeTab === 'supplier') {
      const maxNum = suppliers.length + 1;
      initial = { 
        ID_Supplier: `SUP-${String(maxNum).padStart(4, '0')}`, 
        Nama_Supplier: '', 
        PIC: '', 
        No_Telp: '', 
        Alamat: '', 
        Status: 'Aktif' 
      };
    } else if (activeTab === 'bahan') {
      const nextSeq = String(rawMaterials.length + 1).padStart(3, '0');
      initial = { 
        ID_Bahan: `BHN-${nextSeq}`, 
        Nama_Bahan: '', 
        Kategori: 'Kemasan', 
        Satuan: 'Pcs', 
        Harga_Satuan: '', 
        Minimum_Stock: '' 
      };
    } else if (activeTab === 'bom') {
      initial = { 
        ID_BOM: `BOM-${String(boms.length + 1).padStart(4, '0')}`, 
        ID_Produk: products[0]?.ID_Produk || '', 
        ID_Bahan: rawMaterials[0]?.ID_Bahan || '', 
        Jumlah_Dibutuhkan: '', 
        Satuan: 'Pcs', 
        Keterangan: '' 
      };
    } else if (activeTab === 'karyawan') {
      initial = { 
        ID_Karyawan: `KAR-${String(employees.length + 1).padStart(4, '0')}`, 
        Nama_Karyawan: '', 
        Departemen: 'Produksi', 
        Jabatan: 'Operator', 
        Tgl_Masuk: new Date().toISOString().slice(0, 10), 
        Status: 'Aktif', 
        Gaji_Pokok: '', 
        Tunjangan: '' 
      };
    } else if (activeTab === 'harga_khusus') {
      initial = { 
        ID_Harga_Khusus: `SP-${Date.now().toString().slice(-4)}`, 
        ID_Pelanggan: customers[0]?.ID_Pelanggan || '', 
        ID_Produk: products[0]?.ID_Produk || '', 
        Harga_Custom: '', 
        Keterangan: '' 
      };
    } else if (activeTab === 'user') {
      initial = { 
        ID_User: `USR-${String(users.length + 1).padStart(2, '0')}`, 
        Username: '', 
        Role: 'Admin Produksi', 
        Roles: ['Admin Produksi'],
        ID_Karyawan: employees[0]?.ID_Karyawan || '', 
        Status_Akun: 'Aktif' 
      };
    }
    setFormData(initial);
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'user') {
      const existingRoles = item.Roles && item.Roles.length > 0 ? item.Roles : [item.Role || 'Admin Produksi'];
      setFormData({ ...item, Roles: existingRoles });
    } else {
      setFormData({ ...item });
    }
    setShowModal(true);
  };

  const handleApproveUser = async (userItem: UserAccount) => {
    const ok = await confirmAction({
      title: 'Persetujuan Akun Pengguna',
      message: `Setujui dan aktifkan akun "${userItem.Username}" (${userItem.Roles?.join(', ') || userItem.Role})? Pengguna akan langsung dapat masuk ke sistem.`,
      confirmText: 'Ya, Setujui & Aktifkan',
      cancelText: 'Batal',
      type: 'success'
    });
    if (!ok) return;

    approveUserAccount(userItem.ID_User);
    onRefresh();
    showToast('Akun Disetujui', `Akun ${userItem.Username} berhasil diaktifkan.`, 'success');
  };

  const handleRejectUser = async (userItem: UserAccount) => {
    const ok = await confirmAction({
      title: 'Tolak Pendaftaran Akun',
      message: `Tolak permohonan akun "${userItem.Username}"? Pengguna tidak akan dapat masuk ke sistem.`,
      confirmText: 'Ya, Tolak Permohonan',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;

    rejectUserAccount(userItem.ID_User);
    onRefresh();
    showToast('Akun Ditolak', `Permohonan akun ${userItem.Username} telah ditolak.`, 'info');
  };

  const handleSave = () => {
    let tableName = '';
    let currentList: any[] = [];
    let idField = '';

    if (activeTab === 'produk') { tableName = 'MD_Produk'; currentList = products; idField = 'ID_Produk'; }
    else if (activeTab === 'pelanggan') { tableName = 'MD_Pelanggan'; currentList = customers; idField = 'ID_Pelanggan'; }
    else if (activeTab === 'supplier') { tableName = 'MD_Supplier'; currentList = suppliers; idField = 'ID_Supplier'; }
    else if (activeTab === 'bahan') { tableName = 'MD_BahanPenolong'; currentList = rawMaterials; idField = 'ID_Bahan'; }
    else if (activeTab === 'bom') { tableName = 'MD_BOM'; currentList = boms; idField = 'ID_BOM'; }
    else if (activeTab === 'karyawan') { tableName = 'MD_Karyawan'; currentList = employees; idField = 'ID_Karyawan'; }
    else if (activeTab === 'harga_khusus') { tableName = 'MD_HargaKhusus'; currentList = specialPrices; idField = 'ID_Harga_Khusus'; }
    else if (activeTab === 'user') { tableName = 'MD_UserAkses'; currentList = users; idField = 'ID_User'; }

    const sanitized = { ...formData };
    ['Harga_Distributor', 'Harga_Agen', 'Harga_Reseller', 'Harga_Konsumen', 'Harga_Satuan', 'Minimum_Stock', 'Jumlah_Dibutuhkan', 'Gaji_Pokok', 'Tunjangan', 'Harga_Custom'].forEach(k => {
      if (k in sanitized && (sanitized[k] === '' || sanitized[k] === null || sanitized[k] === undefined)) {
        sanitized[k] = 0;
      }
    });

    // Validasi & Penanganan Khusus ID Bahan Custom
    if (activeTab === 'bahan') {
      const customId = (sanitized.ID_Bahan || '').trim();
      if (!customId) {
        showToast('Validasi Gagal', 'ID Bahan tidak boleh kosong!', 'warning');
        return;
      }
      if (!sanitized.Nama_Bahan || !sanitized.Nama_Bahan.trim()) {
        showToast('Validasi Gagal', 'Nama Bahan Penolong wajib diisi!', 'warning');
        return;
      }

      // Cek duplikasi ID Bahan (kecuali jika mengedit bahan yang sama tanpa mengubah ID-nya)
      const duplicate = rawMaterials.find(b => 
        b.ID_Bahan.trim().toLowerCase() === customId.toLowerCase() &&
        (!editingItem || editingItem.ID_Bahan.trim().toLowerCase() !== customId.toLowerCase())
      );
      if (duplicate) {
        showToast('ID Bahan Sudah Ada', `ID Bahan "${customId}" sudah digunakan oleh "${duplicate.Nama_Bahan}". Harap gunakan ID lain yang unik.`, 'error');
        return;
      }
      sanitized.ID_Bahan = customId;

      // Jika sedang edit dan ID Bahan diubah, lakukan cascade update ke tabel terkait
      if (editingItem && editingItem.ID_Bahan !== customId) {
        const oldId = editingItem.ID_Bahan;

        // Cascade update ke Master BOM
        const allBOMs = getTableData<BOMItem>('MD_BOM', []);
        if (allBOMs.some(bom => bom.ID_Bahan === oldId)) {
          const updatedBOMs = allBOMs.map(bom => 
            bom.ID_Bahan === oldId ? { ...bom, ID_Bahan: customId } : bom
          );
          setTableData('MD_BOM', updatedBOMs);
        }

        // Cascade update ke Bahan_Penolong_Masuk (Pembelian)
        const allPurchases = getTableData<any>('Bahan_Penolong_Masuk', []);
        if (allPurchases.some(p => p.ID_Bahan === oldId)) {
          const updatedPurchases = allPurchases.map(p => 
            p.ID_Bahan === oldId ? { ...p, ID_Bahan: customId, Nama_Bahan: sanitized.Nama_Bahan } : p
          );
          setTableData('Bahan_Penolong_Masuk', updatedPurchases);
        }

        // Cascade update ke Mutasi_Bahan_Penolong (Stok Gudang)
        const allMutations = getTableData<any>('Mutasi_Bahan_Penolong', []);
        if (allMutations.some(m => m.ID_Bahan === oldId)) {
          const updatedMutations = allMutations.map(m => 
            m.ID_Bahan === oldId ? { ...m, ID_Bahan: customId, Nama_Bahan: sanitized.Nama_Bahan } : m
          );
          setTableData('Mutasi_Bahan_Penolong', updatedMutations);
        }
      }
    }

    if (editingItem) {
      const updated = currentList.map(item => item[idField] === editingItem[idField] ? sanitized : item);
      setTableData(tableName, updated);
      if (activeTab === 'bahan') {
        setTableData('MD_Bahan', updated);
        // Catat histori perubahan harga jika nominal diubah
        if (Number(editingItem.Harga_Satuan) !== Number(sanitized.Harga_Satuan)) {
          recordRawMaterialPriceChange({
            idBahan: customId || sanitized.ID_Bahan,
            hargaBaru: Number(sanitized.Harga_Satuan) || 0,
            tanggalBerlaku: sanitized.Tgl_Update_Harga || new Date().toISOString().slice(0, 10),
            keterangan: 'Pembaruan dari Form Master Bahan Penolong'
          });
          reloadPriceHistories();
        }
      } else if (activeTab === 'produk') {
        // Catat histori perubahan harga produk jika ada tier yang diubah
        if (
          Number(editingItem.Harga_Distributor) !== Number(sanitized.Harga_Distributor) ||
          Number(editingItem.Harga_Agen) !== Number(sanitized.Harga_Agen) ||
          Number(editingItem.Harga_Reseller) !== Number(sanitized.Harga_Reseller) ||
          Number(editingItem.Harga_Konsumen) !== Number(sanitized.Harga_Konsumen)
        ) {
          recordProductPriceChange({
            idProduk: sanitized.ID_Produk,
            hargaDistributor: Number(sanitized.Harga_Distributor) || 0,
            hargaAgen: Number(sanitized.Harga_Agen) || 0,
            hargaReseller: Number(sanitized.Harga_Reseller) || 0,
            hargaKonsumen: Number(sanitized.Harga_Konsumen) || 0,
            tanggalBerlaku: sanitized.Tgl_Update_Harga || new Date().toISOString().slice(0, 10),
            keterangan: 'Pembaruan dari Form Master Produk'
          });
          reloadPriceHistories();
        }
      }
    } else {
      setTableData(tableName, [...currentList, sanitized]);
      if (activeTab === 'bahan') {
        setTableData('MD_Bahan', [...currentList, sanitized]);
      }
    }
    setShowModal(false);
    onRefresh();
  };

  // Buka Modal Pengaturan Perubahan Harga Berdasarkan Tanggal
  const handleOpenPriceModal = (tipe: 'Bahan Penolong' | 'Produk', item?: any) => {
    const today = new Date().toISOString().slice(0, 10);
    if (tipe === 'Bahan Penolong') {
      const selectedMat = item || rawMaterials[0];
      const itemId = selectedMat ? selectedMat.ID_Bahan : '';
      const ref = itemId ? getPrecedingReferencePrice(itemId, today, 'Bahan Penolong') : null;
      setPriceForm({
        tipe: 'Bahan Penolong',
        idItem: itemId,
        tanggalBerlaku: today,
        keterangan: '',
        hargaBaruBahan: ref ? ref.hargaLamaBahan : (selectedMat ? Number(selectedMat.Harga_Satuan) || 0 : ''),
        hargaDistributor: '',
        hargaAgen: '',
        hargaReseller: '',
        hargaKonsumen: ''
      });
    } else {
      const selectedPrd = item || products[0];
      const itemId = selectedPrd ? selectedPrd.ID_Produk : '';
      const ref = itemId ? getPrecedingReferencePrice(itemId, today, 'Produk') : null;
      setPriceForm({
        tipe: 'Produk',
        idItem: itemId,
        tanggalBerlaku: today,
        keterangan: '',
        hargaBaruBahan: '',
        hargaDistributor: ref ? ref.hargaLamaDistributor : (selectedPrd ? Number(selectedPrd.Harga_Distributor) || 0 : ''),
        hargaAgen: ref ? ref.hargaLamaAgen : (selectedPrd ? Number(selectedPrd.Harga_Agen) || 0 : ''),
        hargaReseller: ref ? ref.hargaLamaReseller : (selectedPrd ? Number(selectedPrd.Harga_Reseller) || 0 : ''),
        hargaKonsumen: ref ? ref.hargaLamaKonsumen : (selectedPrd ? Number(selectedPrd.Harga_Konsumen) || 0 : '')
      });
    }
    setShowPriceModal(true);
  };

  const handlePriceTypeToggle = (tipe: 'Bahan Penolong' | 'Produk') => {
    const date = priceForm.tanggalBerlaku || new Date().toISOString().slice(0, 10);
    if (tipe === 'Bahan Penolong') {
      const firstMat = rawMaterials[0];
      const itemId = firstMat ? firstMat.ID_Bahan : '';
      const ref = itemId ? getPrecedingReferencePrice(itemId, date, 'Bahan Penolong') : null;
      setPriceForm({
        tipe: 'Bahan Penolong',
        idItem: itemId,
        tanggalBerlaku: date,
        keterangan: priceForm.keterangan || '',
        hargaBaruBahan: ref ? ref.hargaLamaBahan : (firstMat ? Number(firstMat.Harga_Satuan) || 0 : ''),
        hargaDistributor: '',
        hargaAgen: '',
        hargaReseller: '',
        hargaKonsumen: ''
      });
    } else {
      const firstProd = products[0];
      const itemId = firstProd ? firstProd.ID_Produk : '';
      const ref = itemId ? getPrecedingReferencePrice(itemId, date, 'Produk') : null;
      setPriceForm({
        tipe: 'Produk',
        idItem: itemId,
        tanggalBerlaku: date,
        keterangan: priceForm.keterangan || '',
        hargaBaruBahan: '',
        hargaDistributor: ref ? ref.hargaLamaDistributor : (firstProd ? Number(firstProd.Harga_Distributor) || 0 : ''),
        hargaAgen: ref ? ref.hargaLamaAgen : (firstProd ? Number(firstProd.Harga_Agen) || 0 : ''),
        hargaReseller: ref ? ref.hargaLamaReseller : (firstProd ? Number(firstProd.Harga_Reseller) || 0 : ''),
        hargaKonsumen: ref ? ref.hargaLamaKonsumen : (firstProd ? Number(firstProd.Harga_Konsumen) || 0 : '')
      });
    }
  };

  const handlePriceItemChange = (newItemId: string) => {
    const date = priceForm.tanggalBerlaku || new Date().toISOString().slice(0, 10);
    if (priceForm.tipe === 'Bahan Penolong') {
      const ref = getPrecedingReferencePrice(newItemId, date, 'Bahan Penolong');
      const mat = rawMaterials.find(m => m.ID_Bahan === newItemId);
      setPriceForm(prev => ({
        ...prev,
        idItem: newItemId,
        hargaBaruBahan: ref.hargaLamaBahan || (mat ? Number(mat.Harga_Satuan) || 0 : '')
      }));
    } else {
      const ref = getPrecedingReferencePrice(newItemId, date, 'Produk');
      const prod = products.find(p => p.ID_Produk === newItemId);
      setPriceForm(prev => ({
        ...prev,
        idItem: newItemId,
        hargaDistributor: ref.hargaLamaDistributor || (prod ? Number(prod.Harga_Distributor) || 0 : ''),
        hargaAgen: ref.hargaLamaAgen || (prod ? Number(prod.Harga_Agen) || 0 : ''),
        hargaReseller: ref.hargaLamaReseller || (prod ? Number(prod.Harga_Reseller) || 0 : ''),
        hargaKonsumen: ref.hargaLamaKonsumen || (prod ? Number(prod.Harga_Konsumen) || 0 : '')
      }));
    }
  };

  // Simpan Perubahan Harga Berdasarkan Tanggal
  const handleSavePriceModal = () => {
    if (!priceForm.idItem) {
      showToast('Validasi Gagal', 'Harap pilih item yang akan diubah harganya.', 'warning');
      return;
    }
    if (!priceForm.tanggalBerlaku) {
      showToast('Validasi Gagal', 'Tanggal berlaku harga wajib diisi.', 'warning');
      return;
    }

    if (priceForm.tipe === 'Bahan Penolong') {
      if (priceForm.hargaBaruBahan === '' || Number(priceForm.hargaBaruBahan) < 0) {
        showToast('Validasi Gagal', 'Harga baru satuan bahan penolong tidak boleh kosong atau negatif.', 'warning');
        return;
      }
      const res = recordRawMaterialPriceChange({
        idBahan: priceForm.idItem,
        hargaBaru: Number(priceForm.hargaBaruBahan),
        tanggalBerlaku: priceForm.tanggalBerlaku,
        keterangan: priceForm.keterangan
      });
      if (res.success) {
        showToast('Perubahan Harga Tersimpan', res.message, 'success');
        setShowPriceModal(false);
        reloadPriceHistories();
        onRefresh();
      } else {
        showToast('Gagal Simpan', res.message, 'error');
      }
    } else {
      if (
        priceForm.hargaDistributor === '' ||
        priceForm.hargaAgen === '' ||
        priceForm.hargaReseller === '' ||
        priceForm.hargaKonsumen === ''
      ) {
        showToast('Validasi Gagal', 'Semua tingkatan harga produk (Distributor, Agen, Reseller, Konsumen) wajib diisi.', 'warning');
        return;
      }
      const res = recordProductPriceChange({
        idProduk: priceForm.idItem,
        hargaDistributor: Number(priceForm.hargaDistributor),
        hargaAgen: Number(priceForm.hargaAgen),
        hargaReseller: Number(priceForm.hargaReseller),
        hargaKonsumen: Number(priceForm.hargaKonsumen),
        tanggalBerlaku: priceForm.tanggalBerlaku,
        keterangan: priceForm.keterangan
      });
      if (res.success) {
        showToast('Perubahan Harga Tersimpan', res.message, 'success');
        setShowPriceModal(false);
        reloadPriceHistories();
        onRefresh();
      } else {
        showToast('Gagal Simpan', res.message, 'error');
      }
    }
  };

  // Hapus Riwayat Histori Perubahan Harga
  const handleDeletePriceHistory = async (idHistori: string) => {
    const ok = await confirmAction({
      title: 'Hapus Catatan Histori Harga',
      message: `Hapus log histori perubahan harga "${idHistori}"? Catatan ini akan dihapus dari histori. (Harga master saat ini tidak terpengaruh).`,
      confirmText: 'Ya, Hapus Log',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;

    deletePriceHistory(idHistori);
    reloadPriceHistories();
    showToast('Histori Dihapus', `Catatan histori ${idHistori} telah dihapus.`, 'success');
  };

  // Filter Data Histori Perubahan Harga
  const filteredPriceHistories = useMemo(() => {
    let list = priceHistories;
    if (priceFilterType !== 'all') {
      list = list.filter(h => h.Tipe_Item === priceFilterType);
    }
    if (priceFilterMonth !== 'all') {
      list = list.filter(h => h.Tanggal_Berlaku && h.Tanggal_Berlaku.startsWith(priceFilterMonth));
    }
    if (priceSearchQuery.trim()) {
      const q = priceSearchQuery.toLowerCase();
      list = list.filter(h =>
        h.Nama_Item?.toLowerCase().includes(q) ||
        h.ID_Item?.toLowerCase().includes(q) ||
        h.Keterangan?.toLowerCase().includes(q) ||
        h.Diubah_Oleh?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.Tanggal_Berlaku.localeCompare(a.Tanggal_Berlaku));
  }, [priceHistories, priceFilterType, priceFilterMonth, priceSearchQuery]);

  // Jumlah Akun yang Menunggu Persetujuan SuperAdmin
  const pendingUsersCount = useMemo(() => {
    return users.filter(u => u.Status_Akun === 'Menunggu Persetujuan').length;
  }, [users]);

  const handleDelete = async (id: string) => {
    let tableName = '';
    let currentList: any[] = [];
    let idField = '';
    let itemLabel = id;

    if (activeTab === 'produk') {
      tableName = 'MD_Produk'; currentList = products; idField = 'ID_Produk';
      const found = products.find(p => p.ID_Produk === id);
      if (found) itemLabel = `${found.Nama_Produk} (${found.ID_Produk})`;
    }
    else if (activeTab === 'pelanggan') {
      tableName = 'MD_Pelanggan'; currentList = customers; idField = 'ID_Pelanggan';
      const found = customers.find(c => c.ID_Pelanggan === id);
      if (found) itemLabel = `${found.Nama_Pelanggan} (${found.ID_Pelanggan})`;
    }
    else if (activeTab === 'supplier') {
      tableName = 'MD_Supplier'; currentList = suppliers; idField = 'ID_Supplier';
      const found = suppliers.find(s => s.ID_Supplier === id);
      if (found) itemLabel = `${found.Nama_Supplier} (${found.ID_Supplier})`;
    }
    else if (activeTab === 'bahan') {
      tableName = 'MD_BahanPenolong'; currentList = rawMaterials; idField = 'ID_Bahan';
      const found = rawMaterials.find(m => m.ID_Bahan === id);
      if (found) itemLabel = `${found.Nama_Bahan} (${found.ID_Bahan})`;
    }
    else if (activeTab === 'bom') { tableName = 'MD_BOM'; currentList = boms; idField = 'ID_BOM'; }
    else if (activeTab === 'karyawan') {
      tableName = 'MD_Karyawan'; currentList = employees; idField = 'ID_Karyawan';
      const found = employees.find(e => e.ID_Karyawan === id);
      if (found) itemLabel = `${found.Nama_Karyawan} (${found.ID_Karyawan})`;
    }
    else if (activeTab === 'harga_khusus') { tableName = 'MD_HargaKhusus'; currentList = specialPrices; idField = 'ID_Harga_Khusus'; }
    else if (activeTab === 'user') {
      tableName = 'MD_UserAkses'; currentList = users; idField = 'ID_User';
      const found = users.find(u => u.ID_User === id);
      if (found) itemLabel = `${found.Username} (${found.Nama_Lengkap})`;
    }

    const ok = await confirmAction({
      title: 'Hapus Data Master',
      message: `Hapus data "${itemLabel}" secara permanen? Data yang telah dihapus tidak dapat dipulihkan.`,
      confirmText: 'Ya, Hapus Data',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'Kategori': activeTab.toUpperCase(),
        'Identitas Item': itemLabel
      }
    });
    if (!ok) return;

    const updated = currentList.filter(item => item[idField] !== id);
    setTableData(tableName, updated);
    onRefresh();
    showToast('Data Dihapus', `Data ${id} telah berhasil dihapus permanen.`, 'success');
  };

  const handleExportExcel = () => {
    let data: any[] = [];
    if (activeTab === 'produk') data = products;
    else if (activeTab === 'pelanggan') data = customers;
    else if (activeTab === 'supplier') data = suppliers;
    else if (activeTab === 'bahan') data = rawMaterials;
    else if (activeTab === 'bom') data = boms;
    else if (activeTab === 'karyawan') data = employees;
    else if (activeTab === 'harga_khusus') data = specialPrices;
    else if (activeTab === 'user') data = users;
    else if (activeTab === 'histori_harga') {
      data = filteredPriceHistories.map(h => ({
        'ID Histori': h.ID_Histori,
        'Tanggal Berlaku': h.Tanggal_Berlaku,
        'Tipe Item': h.Tipe_Item,
        'ID Item': h.ID_Item,
        'Nama Item': h.Nama_Item,
        'Acuan Tanggal Sblm': h.Tanggal_Acuan_Sebelumnya || 'Master Data',
        'Harga Lama Distributor': Number(h.Harga_Lama_Distributor ?? h.Harga_Distributor_Lama ?? h.Harga_Lama) || 0,
        'Harga Baru Distributor': Number(h.Harga_Baru_Distributor ?? h.Harga_Distributor_Baru ?? h.Harga_Baru) || 0,
        'Selisih Distributor': Number(h.Selisih) || 0,
        'Persentase Perubahan': `${h.Persentase_Perubahan ?? 0}%`,
        'Harga Lama Agen': Number(h.Harga_Lama_Agen ?? h.Harga_Agen_Lama) || 0,
        'Harga Baru Agen': Number(h.Harga_Baru_Agen ?? h.Harga_Agen_Baru) || 0,
        'Harga Lama Reseller': Number(h.Harga_Lama_Reseller ?? h.Harga_Reseller_Lama) || 0,
        'Harga Baru Reseller': Number(h.Harga_Baru_Reseller ?? h.Harga_Reseller_Baru) || 0,
        'Harga Lama Konsumen': Number(h.Harga_Lama_Konsumen ?? h.Harga_Konsumen_Lama) || 0,
        'Harga Baru Konsumen': Number(h.Harga_Baru_Konsumen ?? h.Harga_Konsumen_Baru) || 0,
        'Status Penerapan': h.Status_Penerapan || 'Aktif',
        'Alasan / Keterangan': h.Keterangan || '',
        'Diubah Oleh': h.Diubah_Oleh || 'Admin',
        'Tanggal Dicatat': h.Tanggal_Diubah || ''
      }));
    }
    exportDataToExcel(data, activeTab, `AIRIS_Master_${activeTab}`);
  };

  const handleExportPDF = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const title = `DATA MASTER ${activeTab.toUpperCase()}`;

    if (activeTab === 'produk') {
      headers = ['ID Produk', 'Nama Produk', 'Kategori', 'Satuan', 'Distributor', 'Konsumen', 'Status'];
      rows = products.map(p => [p.ID_Produk, p.Nama_Produk, p.Kategori, p.Satuan, p.Harga_Distributor, p.Harga_Konsumen, p.Status]);
    } else if (activeTab === 'pelanggan') {
      headers = ['ID Pelanggan', 'Nama Pelanggan', 'No Telp', 'Alamat', 'Level', 'Status'];
      rows = customers.map(c => [c.ID_Pelanggan, c.Nama_Pelanggan, c.No_Telp, c.Alamat, c.Level_Pelanggan, c.Status]);
    } else if (activeTab === 'supplier') {
      headers = ['ID Supplier', 'Nama Supplier', 'PIC', 'No Telp', 'Alamat', 'Status'];
      rows = suppliers.map(s => [s.ID_Supplier, s.Nama_Supplier, s.PIC, s.No_Telp, s.Alamat, s.Status]);
    } else if (activeTab === 'bahan') {
      headers = ['ID Bahan', 'Nama Bahan', 'Kategori', 'Satuan', 'Harga Satuan', 'Min Stok'];
      rows = rawMaterials.map(b => [b.ID_Bahan, b.Nama_Bahan, b.Kategori, b.Satuan, b.Harga_Satuan, b.Minimum_Stock ?? 0]);
    } else if (activeTab === 'bom') {
      headers = ['ID BOM', 'Produk', 'Bahan Penolong', 'Kebutuhan', 'Satuan', 'Keterangan'];
      rows = boms.map(b => [b.ID_BOM, b.ID_Produk, b.ID_Bahan, b.Jumlah_Dibutuhkan, b.Satuan, b.Keterangan || '-']);
    } else if (activeTab === 'karyawan') {
      headers = ['ID Karyawan', 'Nama Karyawan', 'Departemen', 'Jabatan', 'Gaji Pokok', 'Status'];
      rows = employees.map(k => [k.ID_Karyawan, k.Nama_Karyawan, k.Departemen, k.Jabatan, k.Gaji_Pokok ?? 0, k.Status]);
    } else if (activeTab === 'harga_khusus') {
      headers = ['ID', 'Pelanggan', 'Produk', 'Harga Khusus', 'Keterangan'];
      rows = specialPrices.map(s => [s.ID_Harga_Khusus, s.ID_Pelanggan, s.ID_Produk, s.Harga_Custom, s.Keterangan || '-']);
    } else if (activeTab === 'user') {
      headers = ['ID User', 'Username', 'Role Akses', 'ID Karyawan', 'Status Akun'];
      rows = users.map(u => [u.ID_User, u.Username, u.Role, u.ID_Karyawan, u.Status_Akun]);
    } else if (activeTab === 'histori_harga') {
      headers = ['Tgl Berlaku', 'Tipe', 'Nama Item', 'Acuan Tgl Sblm', 'Harga Lama', 'Harga Baru', 'Selisih', 'Status', 'Alasan'];
      rows = filteredPriceHistories.map(h => {
        const oldPrice = Number(h.Harga_Lama_Distributor ?? h.Harga_Distributor_Lama ?? h.Harga_Lama) || 0;
        const newPrice = Number(h.Harga_Baru_Distributor ?? h.Harga_Distributor_Baru ?? h.Harga_Baru) || 0;
        const diff = newPrice - oldPrice;
        return [
          h.Tanggal_Berlaku,
          h.Tipe_Item,
          `${h.Nama_Item} (${h.ID_Item})`,
          h.Tanggal_Acuan_Sebelumnya || '-',
          `Rp ${oldPrice.toLocaleString('id-ID')}`,
          `Rp ${newPrice.toLocaleString('id-ID')}`,
          `${diff >= 0 ? '+' : ''}Rp ${diff.toLocaleString('id-ID')} (${h.Persentase_Perubahan ?? 0}%)`,
          h.Status_Penerapan || 'Aktif',
          h.Keterangan || '-'
        ];
      });
    }

    generateTableReportPDF({
      title,
      subtitle: 'PT. Anugerah Illahi Rabbi - AMDK As-Shofaa',
      headers,
      rows,
      filename: `Master_${activeTab}.pdf`
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Database className="text-blue-600" size={24} />
            Master Data Central
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat konfigurasi produk AMDK, formula BOM, data pelanggan, supplier, karyawan, dan hak akses.
          </p>
        </div>

        {/* Action Buttons: Logo-Only Print & PDF as requested + Excel & Add Data */}
        <div className="flex items-center gap-1.5 no-print">
          {/* Logo-only Print Button */}
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Cetak Halaman (Print)"
            aria-label="Cetak"
          >
            <Printer size={16} />
          </button>

          {/* Logo-only PDF Button */}
          <button
            onClick={handleExportPDF}
            className="p-2 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Export PDF Resmi"
            aria-label="Export PDF"
          >
            <FileDown size={16} />
          </button>

          <button
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            title="Export Excel"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors ml-1"
          >
            <Plus size={14} />
            <span>Tambah Data</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-medium">
        {[
          { id: 'produk', label: `Produk (${products.length})` },
          { id: 'pelanggan', label: `Pelanggan (${customers.length})` },
          { id: 'supplier', label: `Supplier (${suppliers.length})` },
          { id: 'bahan', label: `Bahan Penolong (${rawMaterials.length})` },
          { id: 'bom', label: `BOM / Resep (${boms.length})` },
          { id: 'karyawan', label: `Karyawan (${employees.length})` },
          { id: 'harga_khusus', label: `Harga Khusus (${specialPrices.length})` },
          { 
            id: 'user', 
            label: `User Akses (${users.length})`,
            badge: pendingUsersCount > 0 ? `${pendingUsersCount} Persetujuan` : null
          },
          { id: 'histori_harga', label: `Histori Harga (${priceHistories.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id as any); setSearchQuery(''); }}
            className={`px-3.5 py-2 border-b-2 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{t.label}</span>
            {t.badge && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search Input for standard master tabs */}
      {activeTab !== 'histori_harga' && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={`Cari dalam ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Histori Harga Top Cards and Filter Toolbar */}
      {activeTab === 'histori_harga' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Catatan</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{priceHistories.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Histori perubahan harga</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <History size={20} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Bahan Penolong</p>
                <p className="text-xl font-bold text-amber-700 mt-0.5">
                  {priceHistories.filter(h => h.Tipe_Item === 'Bahan Penolong').length}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Penyesuaian bahan</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Tag size={20} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Produk Jadi</p>
                <p className="text-xl font-bold text-emerald-700 mt-0.5">
                  {priceHistories.filter(h => h.Tipe_Item === 'Produk').length}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Perubahan tier produk</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Terjadwal</p>
                <p className="text-xl font-bold text-indigo-700 mt-0.5">
                  {priceHistories.filter(h => h.Status_Penerapan === 'Terjadwal').length}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Menunggu tanggal berlaku</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CalendarClock size={20} />
              </div>
            </div>
          </div>

          {/* Filter Bar & Action Button */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tipe Item Pills */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
                {(['all', 'Bahan Penolong', 'Produk'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPriceFilterType(t)}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      priceFilterType === t 
                        ? 'bg-white text-blue-700 font-bold shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'all' ? 'Semua Tipe' : t}
                  </button>
                ))}
              </div>

              {/* Filter Bulan Dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Calendar size={14} className="text-slate-400" />
                <select
                  value={priceFilterMonth}
                  onChange={e => setPriceFilterMonth(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="all">Semua Periode</option>
                  {Array.from(new Set(priceHistories.map(h => (h.Tanggal_Berlaku || '').slice(0, 7)).filter(Boolean)))
                    .sort()
                    .reverse()
                    .map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Box */}
              <div className="relative flex-1 md:w-60">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Cari item, ID, keterangan..."
                  value={priceSearchQuery}
                  onChange={e => setPriceSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Add Price Change Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenPriceModal('Bahan Penolong')}
                  className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                  title="Atur perubahan harga bahan penolong"
                >
                  <Tag size={13} />
                  <span>+ Harga Bahan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPriceModal('Produk')}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                  title="Atur perubahan harga produk jadi"
                >
                  <TrendingUp size={13} />
                  <span>+ Harga Produk</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tables based on active tab */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {activeTab === 'produk' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Produk</th>
                  <th className="p-3">Nama Produk</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Satuan</th>
                  <th className="p-3 text-right">Harga Distributor</th>
                  <th className="p-3 text-right">Harga Agen</th>
                  <th className="p-3 text-right">Harga Reseller</th>
                  <th className="p-3 text-right">Harga Konsumen</th>
                  <th className="p-3 text-center">Tgl Berlaku</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products
                  .filter(p => p.Nama_Produk?.toLowerCase().includes(searchQuery.toLowerCase()) || p.ID_Produk?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(p => (
                    <tr key={p.ID_Produk} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{p.ID_Produk}</td>
                      <td className="p-3 font-semibold text-slate-900">{p.Nama_Produk}</td>
                      <td className="p-3 text-slate-600">{p.Kategori}</td>
                      <td className="p-3 font-mono">{p.Satuan}</td>
                      <td className="p-3 text-right font-mono tabular-nums font-semibold text-blue-900">Rp {p.Harga_Distributor?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right font-mono tabular-nums">Rp {p.Harga_Agen?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right font-mono tabular-nums">Rp {p.Harga_Reseller?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right font-mono tabular-nums text-slate-600">Rp {p.Harga_Konsumen?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-100 text-slate-700 border border-slate-200" title="Tanggal update atau mulai berlakunya harga">
                          {p.Tgl_Update_Harga || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.Status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {p.Status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => handleOpenPriceModal('Produk', p)} 
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors" 
                            title="Atur Perubahan Harga Berdasarkan Tanggal"
                          >
                            <TrendingUp size={14} />
                          </button>
                          <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Data"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(p.ID_Produk)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Data"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'pelanggan' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Pelanggan</th>
                  <th className="p-3">Nama Pelanggan</th>
                  <th className="p-3">No. Telp</th>
                  <th className="p-3">Alamat</th>
                  <th className="p-3">Level Konsumen</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers
                  .filter(c => c.Nama_Pelanggan?.toLowerCase().includes(searchQuery.toLowerCase()) || c.ID_Pelanggan?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(c => (
                    <tr key={c.ID_Pelanggan} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{c.ID_Pelanggan}</td>
                      <td className="p-3 font-semibold text-slate-900">{c.Nama_Pelanggan}</td>
                      <td className="p-3 font-mono text-slate-600">{c.No_Telp || '-'}</td>
                      <td className="p-3 text-slate-600">{c.Alamat || '-'}</td>
                      <td className="p-3 font-medium text-blue-800">{c.Level_Pelanggan}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.Status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {c.Status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenEdit(c)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Data"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(c.ID_Pelanggan)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Data"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'supplier' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Supplier</th>
                  <th className="p-3">Nama Supplier</th>
                  <th className="p-3">PIC</th>
                  <th className="p-3">No. Telp</th>
                  <th className="p-3">Alamat</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers
                  .filter(s => s.Nama_Supplier?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                    <tr key={s.ID_Supplier} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{s.ID_Supplier}</td>
                      <td className="p-3 font-semibold text-slate-900">{s.Nama_Supplier}</td>
                      <td className="p-3 text-slate-600">{s.PIC}</td>
                      <td className="p-3 font-mono text-slate-600">{s.No_Telp}</td>
                      <td className="p-3 text-slate-600">{s.Alamat}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">{s.Status}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenEdit(s)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Data"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(s.ID_Supplier)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Data"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'bahan' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Bahan</th>
                  <th className="p-3">Nama Bahan Penolong</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Satuan</th>
                  <th className="p-3 text-right">Harga Satuan</th>
                  <th className="p-3 text-center">Tgl Berlaku</th>
                  <th className="p-3 text-right">Batas Minimum Stok</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawMaterials
                  .filter(b => 
                    b.Nama_Bahan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    b.ID_Bahan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    b.Kategori?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(b => (
                    <tr key={b.ID_Bahan} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{b.ID_Bahan}</td>
                      <td className="p-3 font-semibold text-slate-900">{b.Nama_Bahan}</td>
                      <td className="p-3 text-slate-600">{b.Kategori}</td>
                      <td className="p-3 font-mono">{b.Satuan}</td>
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-emerald-800">Rp {b.Harga_Satuan?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-100 text-slate-700 border border-slate-200" title="Tanggal update atau mulai berlakunya harga">
                          {b.Tgl_Update_Harga || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums text-red-600">{b.Minimum_Stock?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => handleOpenPriceModal('Bahan Penolong', b)} 
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors" 
                            title="Atur Perubahan Harga Berdasarkan Tanggal"
                          >
                            <TrendingUp size={14} />
                          </button>
                          <button onClick={() => handleOpenEdit(b)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Data"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(b.ID_Bahan)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Data"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'bom' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID BOM</th>
                  <th className="p-3">Target Produk</th>
                  <th className="p-3">Bahan Penolong Dibutuhkan</th>
                  <th className="p-3 text-center">Rasio Kebutuhan</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boms.map(bom => {
                  const prod = products.find(p => p.ID_Produk === bom.ID_Produk);
                  const mat = rawMaterials.find(m => m.ID_Bahan === bom.ID_Bahan);
                  return (
                    <tr key={bom.ID_BOM} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{bom.ID_BOM}</td>
                      <td className="p-3 font-semibold text-slate-900">{prod?.Nama_Produk || bom.ID_Produk}</td>
                      <td className="p-3 text-slate-700">{mat?.Nama_Bahan || bom.ID_Bahan}</td>
                      <td className="p-3 text-center font-mono font-bold text-indigo-700">
                        {bom.Jumlah_Dibutuhkan} {bom.Satuan} / unit
                      </td>
                      <td className="p-3 text-slate-500">{bom.Keterangan || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenEdit(bom)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit BOM"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(bom.ID_BOM)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus BOM"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'karyawan' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Karyawan</th>
                  <th className="p-3">Nama Karyawan</th>
                  <th className="p-3">Departemen</th>
                  <th className="p-3">Jabatan</th>
                  <th className="p-3">Tgl Masuk</th>
                  <th className="p-3 text-right">Gaji Pokok</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees
                  .filter(k => k.Nama_Karyawan?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(k => (
                    <tr key={k.ID_Karyawan} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{k.ID_Karyawan}</td>
                      <td className="p-3 font-semibold text-slate-900">{k.Nama_Karyawan}</td>
                      <td className="p-3 text-slate-600">{k.Departemen}</td>
                      <td className="p-3 text-slate-600">{k.Jabatan}</td>
                      <td className="p-3 font-mono text-slate-500">{k.Tgl_Masuk}</td>
                      <td className="p-3 text-right font-mono tabular-nums font-semibold">Rp {k.Gaji_Pokok?.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          k.Status === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {k.Status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenEdit(k)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Karyawan"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(k.ID_Karyawan)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Karyawan"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {activeTab === 'harga_khusus' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID Harga Khusus</th>
                  <th className="p-3">Pelanggan</th>
                  <th className="p-3">Produk</th>
                  <th className="p-3 text-right">Harga Khusus Disepakati</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {specialPrices.map(sp => {
                  const cust = customers.find(c => c.ID_Pelanggan === sp.ID_Pelanggan);
                  const prod = products.find(p => p.ID_Produk === sp.ID_Produk);
                  return (
                    <tr key={sp.ID_Harga_Khusus} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{sp.ID_Harga_Khusus}</td>
                      <td className="p-3 font-semibold text-slate-900">{cust?.Nama_Pelanggan || sp.ID_Pelanggan}</td>
                      <td className="p-3 text-slate-700">{prod?.Nama_Produk || sp.ID_Produk}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        Rp {sp.Harga_Custom?.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-slate-500">{sp.Keterangan || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenEdit(sp)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Harga"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(sp.ID_Harga_Khusus)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" title="Hapus Harga"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {activeTab === 'user' && (
            <div>
              {/* Banner Alert jika ada Akun Menunggu Persetujuan SuperAdmin */}
              {pendingUsersCount > 0 && (
                <div className="mb-4 p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                    <div>
                      <span className="font-bold">Permohonan Akun Karyawan Menunggu Persetujuan:</span>
                      <span className="ml-1 text-amber-800">
                        Terdapat <strong>{pendingUsersCount}</strong> akun baru yang baru diajukan dan memerlukan verifikasi persetujuan SuperAdmin sebelum dapat masuk ke sistem.
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-[10px] font-bold text-amber-900 uppercase tracking-wide shrink-0">
                    Perlu Tindakan
                  </span>
                </div>
              )}

              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">ID User</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Divisi Tugas (Multi-Role)</th>
                    <th className="p-3">Karyawan Terkait</th>
                    <th className="p-3 text-center">Status Akun</th>
                    <th className="p-3 text-center">Aksi & Persetujuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users
                    .filter(u => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        u.Username?.toLowerCase().includes(q) ||
                        u.Nama?.toLowerCase().includes(q) ||
                        u.Role?.toLowerCase().includes(q) ||
                        u.Roles?.some(r => r.toLowerCase().includes(q))
                      );
                    })
                    .sort((a, b) => {
                      // Utamakan akun yang menunggu persetujuan di urutan paling atas
                      if (a.Status_Akun === 'Menunggu Persetujuan' && b.Status_Akun !== 'Menunggu Persetujuan') return -1;
                      if (b.Status_Akun === 'Menunggu Persetujuan' && a.Status_Akun !== 'Menunggu Persetujuan') return 1;
                      return a.Username.localeCompare(b.Username);
                    })
                    .map(u => {
                      const emp = employees.find(e => e.ID_Karyawan === u.ID_Karyawan);
                      const userRolesList = u.Roles && u.Roles.length > 0 ? u.Roles : [u.Role];
                      const isPending = u.Status_Akun === 'Menunggu Persetujuan';

                      return (
                        <tr 
                          key={u.ID_User} 
                          className={`transition-colors ${
                            isPending ? 'bg-amber-50/60 hover:bg-amber-100/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-3 font-mono font-bold text-blue-700">{u.ID_User}</td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{u.Username}</div>
                            {u.Nama && <div className="text-[11px] text-slate-500">{u.Nama}</div>}
                            {u.Email && <div className="text-[10px] text-slate-400 font-mono">{u.Email}</div>}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {userRolesList.map(r => (
                                <span
                                  key={r}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                    r === 'SuperAdmin'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : r === 'Admin Produksi'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : r === 'Admin Gudang'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : r === 'Kasir/Finance'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : r === 'HRD'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : r === 'Admin Dokumen'
                                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                            {u.Alasan_Daftar && (
                              <div className="text-[10px] text-slate-400 mt-1 italic line-clamp-1">
                                Catatan: &ldquo;{u.Alasan_Daftar}&rdquo;
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-800">
                              {emp?.Nama_Karyawan || u.Nama || '-'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {u.ID_Karyawan}
                            </div>
                            {u.Tanggal_Daftar && (
                              <div className="text-[10px] text-slate-400">
                                Daftar: {u.Tanggal_Daftar.slice(0, 10)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPending ? (
                              <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Menunggu Persetujuan
                              </span>
                            ) : u.Status_Akun === 'Aktif' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Aktif
                              </span>
                            ) : u.Status_Akun === 'Ditolak' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                Ditolak
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {u.Status_Akun}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Tombol Persetujuan Cepat untuk SuperAdmin */}
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleApproveUser(u)}
                                    className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs font-semibold flex items-center gap-1 cursor-pointer"
                                    title="Setujui dan Aktifkan Akun Ini"
                                  >
                                    <UserCheck size={14} />
                                    <span className="text-[10px]">Setujui</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectUser(u)}
                                    className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg shadow-2xs font-semibold flex items-center gap-1 cursor-pointer"
                                    title="Tolak Pendaftaran Akun Ini"
                                  >
                                    <UserX size={14} />
                                    <span className="text-[10px]">Tolak</span>
                                  </button>
                                </>
                              )}

                              <button 
                                onClick={() => handleOpenEdit(u)} 
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer" 
                                title="Edit Akun"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(u.ID_User)} 
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" 
                                title="Hapus Akun"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'histori_harga' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Tgl Berlaku</th>
                  <th className="p-3">Tipe Item</th>
                  <th className="p-3">Nama & Kode Item</th>
                  <th className="p-3">Perubahan Harga</th>
                  <th className="p-3">Keterangan / Alasan</th>
                  <th className="p-3">Dicatat Oleh & Waktu</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPriceHistories.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <History size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600 text-sm">Belum Ada Riwayat Perubahan Harga</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Gunakan tombol "+ Harga Bahan" atau "+ Harga Produk" di atas atau tombol aksi di tabel Master untuk mengatur perubahan harga.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPriceHistories.map(h => (
                    <tr key={h.ID_Histori} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 align-top whitespace-nowrap">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Calendar size={13} className="text-blue-600 shrink-0" />
                          <span>{h.Tanggal_Berlaku}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{h.ID_Histori}</div>
                      </td>

                      <td className="p-3 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          h.Tipe_Item === 'Bahan Penolong'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {h.Tipe_Item === 'Bahan Penolong' ? <Tag size={11} /> : <TrendingUp size={11} />}
                          {h.Tipe_Item}
                        </span>
                        {h.Kategori && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{h.Kategori}</div>
                        )}
                      </td>

                      <td className="p-3 align-top">
                        <div className="font-bold text-slate-900">{h.Nama_Item}</div>
                        <div className="font-mono text-[11px] text-blue-700 font-semibold">{h.ID_Item}</div>
                        {h.Satuan && <div className="text-[10px] text-slate-400">Satuan: {h.Satuan}</div>}
                      </td>

                      <td className="p-3 align-top">
                        {h.Tipe_Item === 'Bahan Penolong' ? (
                          (() => {
                            const oldMatPrice = Number(h.Harga_Lama) || 0;
                            const newMatPrice = Number(h.Harga_Baru) || 0;
                            const diffMat = newMatPrice - oldMatPrice;
                            const pctMat = oldMatPrice > 0 ? Number(((diffMat / oldMatPrice) * 100).toFixed(1)) : 0;

                            return (
                              <div className="space-y-1.5 py-0.5">
                                {h.Tanggal_Acuan_Sebelumnya && (
                                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                    <Calendar size={11} className="text-amber-500 shrink-0" />
                                    <span>Acuan dari tgl: <strong className="text-slate-700">{h.Tanggal_Acuan_Sebelumnya}</strong></span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-2 p-1.5 bg-amber-50/70 rounded-md border border-amber-200/70 text-xs font-mono">
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="text-slate-400 line-through tabular-nums">
                                      Rp {oldMatPrice.toLocaleString('id-ID')}
                                    </span>
                                    <ArrowRight size={12} className="text-amber-600 shrink-0" />
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      Rp {newMatPrice.toLocaleString('id-ID')}
                                    </span>
                                    {h.Satuan && <span className="text-[10px] text-slate-400 font-normal">/{h.Satuan}</span>}
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    diffMat > 0 ? 'bg-rose-100 text-rose-700' : diffMat < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {diffMat > 0 ? '+' : ''}Rp {diffMat.toLocaleString('id-ID')} ({pctMat > 0 ? '+' : ''}{pctMat}%)
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          (() => {
                            const oldDist = Number(h.Harga_Lama_Distributor ?? h.Harga_Distributor_Lama ?? h.Harga_Lama) || 0;
                            const newDist = Number(h.Harga_Baru_Distributor ?? h.Harga_Distributor_Baru ?? h.Harga_Baru) || 0;
                            const diffDist = newDist - oldDist;
                            const pctDist = oldDist > 0 ? Number(((diffDist / oldDist) * 100).toFixed(1)) : 0;

                            const oldAgen = Number(h.Harga_Lama_Agen ?? h.Harga_Agen_Lama) || 0;
                            const newAgen = Number(h.Harga_Baru_Agen ?? h.Harga_Agen_Baru) || 0;
                            const diffAgen = newAgen - oldAgen;

                            const oldRes = Number(h.Harga_Lama_Reseller ?? h.Harga_Reseller_Lama) || 0;
                            const newRes = Number(h.Harga_Baru_Reseller ?? h.Harga_Reseller_Baru) || 0;
                            const diffRes = newRes - oldRes;

                            const oldKons = Number(h.Harga_Lama_Konsumen ?? h.Harga_Konsumen_Lama) || 0;
                            const newKons = Number(h.Harga_Baru_Konsumen ?? h.Harga_Konsumen_Baru) || 0;
                            const diffKons = newKons - oldKons;

                            return (
                              <div className="space-y-1.5 py-0.5">
                                {h.Tanggal_Acuan_Sebelumnya && (
                                  <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                    <Calendar size={11} className="text-blue-500 shrink-0" />
                                    <span>Acuan dari tgl: <strong className="text-slate-700">{h.Tanggal_Acuan_Sebelumnya}</strong></span>
                                  </div>
                                )}

                                {/* Tier Distributor */}
                                <div className="flex items-center justify-between gap-1.5 p-1.5 bg-blue-50/70 rounded-md border border-blue-100 text-xs">
                                  <div className="flex items-center gap-1 font-sans">
                                    <span className="font-bold text-blue-900 text-[11px] w-18 shrink-0">Distributor:</span>
                                    <span className="text-slate-400 line-through tabular-nums font-mono">
                                      Rp {oldDist.toLocaleString('id-ID')}
                                    </span>
                                    <ArrowRight size={11} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-blue-900 tabular-nums font-mono">
                                      Rp {newDist.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    diffDist > 0 ? 'bg-rose-100 text-rose-700' : diffDist < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {diffDist > 0 ? '+' : ''}Rp {diffDist.toLocaleString('id-ID')} ({pctDist > 0 ? '+' : ''}{pctDist}%)
                                  </span>
                                </div>

                                {/* Rincian 3 Tier Lainnya Dari Harga ke Harga */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                                  {/* Agen */}
                                  <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200">
                                    <div className="font-bold text-slate-700">Agen:</div>
                                    <div className="flex items-center gap-1 font-mono text-slate-800">
                                      <span className="text-slate-400 line-through">Rp {oldAgen.toLocaleString('id-ID')}</span>
                                      <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                      <span className="font-bold">Rp {newAgen.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className={`font-semibold mt-0.5 ${diffAgen > 0 ? 'text-rose-600' : diffAgen < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {diffAgen > 0 ? '+' : ''}Rp {diffAgen.toLocaleString('id-ID')}
                                    </div>
                                  </div>

                                  {/* Reseller */}
                                  <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200">
                                    <div className="font-bold text-slate-700">Reseller:</div>
                                    <div className="flex items-center gap-1 font-mono text-slate-800">
                                      <span className="text-slate-400 line-through">Rp {oldRes.toLocaleString('id-ID')}</span>
                                      <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                      <span className="font-bold">Rp {newRes.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className={`font-semibold mt-0.5 ${diffRes > 0 ? 'text-rose-600' : diffRes < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {diffRes > 0 ? '+' : ''}Rp {diffRes.toLocaleString('id-ID')}
                                    </div>
                                  </div>

                                  {/* Konsumen */}
                                  <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200">
                                    <div className="font-bold text-slate-700">Konsumen:</div>
                                    <div className="flex items-center gap-1 font-mono text-slate-800">
                                      <span className="text-slate-400 line-through">Rp {oldKons.toLocaleString('id-ID')}</span>
                                      <ArrowRight size={10} className="text-slate-400 shrink-0" />
                                      <span className="font-bold">Rp {newKons.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className={`font-semibold mt-0.5 ${diffKons > 0 ? 'text-rose-600' : diffKons < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {diffKons > 0 ? '+' : ''}Rp {diffKons.toLocaleString('id-ID')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </td>

                      <td className="p-3 align-top max-w-xs">
                        <p className="text-slate-700 text-xs italic">{h.Keterangan || '-'}</p>
                      </td>

                      <td className="p-3 align-top whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{h.Diubah_Oleh || 'System'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {h.Tanggal_Diubah ? new Date(h.Tanggal_Diubah).toLocaleString('id-ID') : '-'}
                        </div>
                      </td>

                      <td className="p-3 align-top text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          h.Status_Penerapan === 'Aktif'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {h.Status_Penerapan === 'Aktif' ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                          {h.Status_Penerapan === 'Aktif' ? 'Aktif Berlaku' : 'Terjadwal'}
                        </span>
                      </td>

                      <td className="p-3 align-top text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeletePriceHistory(h.ID_Histori)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Hapus Catatan Histori Ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FORM MODAL WITH EXPLICIT DROPDOWNS AS SPECIFIED */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingItem ? 'Edit Data' : 'Tambah Data Baru'} ({activeTab.toUpperCase()})
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto text-xs">
              {/* TAB PRODUK FORM */}
              {activeTab === 'produk' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Produk</label>
                    <input
                      type="text"
                      value={formData.ID_Produk || ''}
                      readOnly={Boolean(editingItem)}
                      onChange={e => setFormData({ ...formData, ID_Produk: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Produk</label>
                    <input
                      type="text"
                      value={formData.Nama_Produk || ''}
                      placeholder="Contoh: As-Shofaa Cup 220ml"
                      onChange={e => setFormData({ ...formData, Nama_Produk: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Kategori Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kategori Produk</label>
                      <select
                        value={formData.Kategori || 'Air Mineral Cup'}
                        onChange={e => setFormData({ ...formData, Kategori: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium"
                      >
                        <option value="Air Mineral Cup">Air Mineral Cup</option>
                        <option value="Air Mineral Botol">Air Mineral Botol</option>
                        <option value="Air Mineral Galon">Air Mineral Galon</option>
                      </select>
                    </div>
                    {/* Satuan Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Satuan Kemasan</label>
                      <select
                        value={formData.Satuan || 'Dus'}
                        onChange={e => setFormData({ ...formData, Satuan: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium"
                      >
                        <option value="Dus">Dus</option>
                        <option value="Galon">Galon</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Harga Distributor (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Harga_Distributor ?? ''}
                        onChange={e => setFormData({ ...formData, Harga_Distributor: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Harga Agen (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Harga_Agen ?? ''}
                        onChange={e => setFormData({ ...formData, Harga_Agen: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Harga Reseller (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Harga_Reseller ?? ''}
                        onChange={e => setFormData({ ...formData, Harga_Reseller: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Harga Konsumen (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Harga_Konsumen ?? ''}
                        onChange={e => setFormData({ ...formData, Harga_Konsumen: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>
                  {/* Status Dropdown */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Produk</label>
                    <select
                      value={formData.Status || 'Aktif'}
                      onChange={e => setFormData({ ...formData, Status: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Non-Aktif">Non-Aktif</option>
                    </select>
                  </div>
                </>
              )}

              {/* TAB PELANGGAN FORM */}
              {activeTab === 'pelanggan' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Pelanggan</label>
                    <input
                      type="text"
                      value={formData.ID_Pelanggan || ''}
                      readOnly={Boolean(editingItem)}
                      className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Pelanggan / Toko</label>
                    <input
                      type="text"
                      value={formData.Nama_Pelanggan || ''}
                      onChange={e => setFormData({ ...formData, Nama_Pelanggan: e.target.value })}
                      placeholder="Nama toko atau mitra"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">No. Telp / WhatsApp</label>
                      <input
                        type="text"
                        value={formData.No_Telp || ''}
                        onChange={e => setFormData({ ...formData, No_Telp: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    {/* Level Pelanggan Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Level Pelanggan</label>
                      <select
                        value={formData.Level_Pelanggan || 'Agen'}
                        onChange={e => setFormData({ ...formData, Level_Pelanggan: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-blue-900"
                      >
                        <option value="Distributor">Distributor</option>
                        <option value="Agen">Agen</option>
                        <option value="Reseller">Reseller</option>
                        <option value="Konsumen Biasa">Konsumen Biasa</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                    <input
                      type="text"
                      value={formData.Alamat || ''}
                      onChange={e => setFormData({ ...formData, Alamat: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={formData.Status || 'Aktif'}
                      onChange={e => setFormData({ ...formData, Status: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Non-Aktif">Non-Aktif</option>
                    </select>
                  </div>
                </>
              )}

              {/* TAB SUPPLIER FORM */}
              {activeTab === 'supplier' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Supplier</label>
                    <input type="text" value={formData.ID_Supplier || ''} readOnly className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Supplier / Vendor</label>
                    <input type="text" value={formData.Nama_Supplier || ''} onChange={e => setFormData({ ...formData, Nama_Supplier: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg font-semibold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">PIC (Kontak Person)</label>
                      <input type="text" value={formData.PIC || ''} onChange={e => setFormData({ ...formData, PIC: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">No. Telp</label>
                      <input type="text" value={formData.No_Telp || ''} onChange={e => setFormData({ ...formData, No_Telp: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alamat</label>
                    <input type="text" value={formData.Alamat || ''} onChange={e => setFormData({ ...formData, Alamat: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status</label>
                    <select value={formData.Status || 'Aktif'} onChange={e => setFormData({ ...formData, Status: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg">
                      <option value="Aktif">Aktif</option>
                      <option value="Non-Aktif">Non-Aktif</option>
                    </select>
                  </div>
                </>
              )}

              {/* TAB BAHAN PENOLONG FORM */}
              {activeTab === 'bahan' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">
                        ID Bahan <span className="text-blue-600 font-normal">(Bisa Custom)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextNum = String(rawMaterials.length + 1).padStart(3, '0');
                          setFormData({ ...formData, ID_Bahan: `BHN-${nextNum}` });
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        title="Buat kode otomatis standar (BHN-xxx)"
                      >
                        <RefreshCw size={11} />
                        <span>Generate Otomatis</span>
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={formData.ID_Bahan || ''} 
                      onChange={e => setFormData({ ...formData, ID_Bahan: e.target.value })}
                      placeholder="Contoh: BHN-001, CUP-220, LBL-AS, SEDOTAN"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" 
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ketik bebas ID / Kode Bahan sesuai standarisasi gudang perusahaan Anda.
                    </p>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Bahan Penolong</label>
                    <input type="text" value={formData.Nama_Bahan || ''} onChange={e => setFormData({ ...formData, Nama_Bahan: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg font-semibold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Kategori Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kategori Bahan</label>
                      <select
                        value={formData.Kategori || 'Kemasan'}
                        onChange={e => setFormData({ ...formData, Kategori: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                      >
                        <option value="Kemasan">Kemasan</option>
                        <option value="Segel">Segel</option>
                        <option value="Label">Label</option>
                        <option value="Lakban">Lakban</option>
                        <option value="Kimia/Laboratorium">Kimia/Laboratorium</option>
                        <option value="Bahan Tambahan">Bahan Tambahan</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    {/* Satuan Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Satuan Bahan</label>
                      <select
                        value={formData.Satuan || 'Pcs'}
                        onChange={e => setFormData({ ...formData, Satuan: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono"
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Roll">Roll</option>
                        <option value="Lembar">Lembar</option>
                        <option value="Kg">Kg</option>
                        <option value="Liter">Liter</option>
                        <option value="Box">Box</option>
                        <option value="Dus">Dus</option>
                        <option value="Batang">Batang</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Harga Satuan (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Harga_Satuan ?? ''}
                        onChange={e => setFormData({ ...formData, Harga_Satuan: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Batas Minimum Stok</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Minimum_Stock ?? ''}
                        onChange={e => setFormData({ ...formData, Minimum_Stock: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono text-red-600 font-bold"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* TAB BOM FORM */}
              {activeTab === 'bom' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID BOM</label>
                    <input type="text" value={formData.ID_BOM || ''} readOnly className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono" />
                  </div>
                  {/* Dropdown ID Produk */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Produk</label>
                    <select
                      value={formData.ID_Produk || ''}
                      onChange={e => setFormData({ ...formData, ID_Produk: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    >
                      {products.map(p => (
                        <option key={p.ID_Produk} value={p.ID_Produk}>
                          {p.ID_Produk} - {p.Nama_Produk} ({p.Satuan})
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Dropdown ID Bahan */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bahan Penolong yang Digunakan</label>
                    <select
                      value={formData.ID_Bahan || ''}
                      onChange={e => {
                        const mat = rawMaterials.find(m => m.ID_Bahan === e.target.value);
                        setFormData({ 
                          ...formData, 
                          ID_Bahan: e.target.value,
                          Satuan: mat?.Satuan || formData.Satuan
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    >
                      {rawMaterials.map(m => (
                        <option key={m.ID_Bahan} value={m.ID_Bahan}>
                          {m.ID_Bahan} - {m.Nama_Bahan} ({m.Satuan})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jumlah Dibutuhkan per Unit</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={formData.Jumlah_Dibutuhkan ?? ''}
                        onChange={e => setFormData({ ...formData, Jumlah_Dibutuhkan: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold text-blue-900"
                      />
                    </div>
                    {/* Satuan Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                      <select
                        value={formData.Satuan || 'Pcs'}
                        onChange={e => setFormData({ ...formData, Satuan: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-medium"
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Roll">Roll</option>
                        <option value="Lembar">Lembar</option>
                        <option value="Kg">Kg</option>
                        <option value="Liter">Liter</option>
                        <option value="Box">Box</option>
                        <option value="Dus">Dus</option>
                        <option value="Batang">Batang</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Keterangan Formula</label>
                    <input
                      type="text"
                      value={formData.Keterangan || ''}
                      onChange={e => setFormData({ ...formData, Keterangan: e.target.value })}
                      placeholder="Contoh: 48 cup per karton dus"
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </>
              )}

              {/* TAB KARYAWAN FORM */}
              {activeTab === 'karyawan' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Karyawan</label>
                    <input type="text" value={formData.ID_Karyawan || ''} readOnly className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Karyawan</label>
                    <input type="text" value={formData.Nama_Karyawan || ''} onChange={e => setFormData({ ...formData, Nama_Karyawan: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg font-semibold" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Departemen Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Departemen</label>
                      <select
                        value={formData.Departemen || 'Produksi'}
                        onChange={e => setFormData({ ...formData, Departemen: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-medium"
                      >
                        <option value="Manajemen">Manajemen</option>
                        <option value="Produksi">Produksi</option>
                        <option value="Distribusi">Distribusi</option>
                        <option value="QC">QC (Quality Control)</option>
                        <option value="Keuangan">Keuangan</option>
                        <option value="HRD">HRD</option>
                        <option value="Gudang">Gudang</option>
                      </select>
                    </div>
                    {/* Jabatan Dropdown */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jabatan</label>
                      <select
                        value={formData.Jabatan || 'Operator'}
                        onChange={e => setFormData({ ...formData, Jabatan: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-medium"
                      >
                        <option value="Direktur">Direktur</option>
                        <option value="Manager">Manager</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Staff">Staff</option>
                        <option value="Operator">Operator</option>
                        <option value="Driver">Driver</option>
                        <option value="Analis QC">Analis QC</option>
                        <option value="Kasir">Kasir</option>
                        <option value="Kurir">Kurir</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tanggal Masuk</label>
                      <input type="date" value={formData.Tgl_Masuk || ''} onChange={e => setFormData({ ...formData, Tgl_Masuk: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg font-mono" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Status Karyawan</label>
                      <select value={formData.Status || 'Aktif'} onChange={e => setFormData({ ...formData, Status: e.target.value })} className="w-full px-3 py-1.5 border rounded-lg">
                        <option value="Aktif">Aktif</option>
                        <option value="Resign">Resign</option>
                        <option value="Nonaktif">Nonaktif</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Gaji Pokok (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Gaji_Pokok ?? ''}
                        onChange={e => setFormData({ ...formData, Gaji_Pokok: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tunjangan (Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.Tunjangan ?? ''}
                        onChange={e => setFormData({ ...formData, Tunjangan: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border rounded-lg font-mono font-bold"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* TAB HARGA KHUSUS FORM */}
              {activeTab === 'harga_khusus' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Harga Khusus</label>
                    <input type="text" value={formData.ID_Harga_Khusus || ''} readOnly className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono" />
                  </div>
                  {/* Dropdown ID Pelanggan */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pilih Pelanggan / Mitra</label>
                    <select
                      value={formData.ID_Pelanggan || ''}
                      onChange={e => setFormData({ ...formData, ID_Pelanggan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    >
                      {customers.map(c => (
                        <option key={c.ID_Pelanggan} value={c.ID_Pelanggan}>
                          {c.ID_Pelanggan} - {c.Nama_Pelanggan} ({c.Level_Pelanggan})
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Dropdown ID Produk */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pilih Produk</label>
                    <select
                      value={formData.ID_Produk || ''}
                      onChange={e => setFormData({ ...formData, ID_Produk: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    >
                      {products.map(p => (
                        <option key={p.ID_Produk} value={p.ID_Produk}>
                          {p.ID_Produk} - {p.Nama_Produk}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Harga Khusus Disepakati (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.Harga_Custom ?? ''}
                      onChange={e => setFormData({ ...formData, Harga_Custom: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Keterangan Kontrak</label>
                    <input
                      type="text"
                      value={formData.Keterangan || ''}
                      onChange={e => setFormData({ ...formData, Keterangan: e.target.value })}
                      placeholder="Misal: Kontrak komitmen minimal 500 dus/bulan"
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </>
              )}

              {/* TAB USER AKSES FORM */}
              {activeTab === 'user' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">ID User</label>
                      <input type="text" value={formData.ID_User || ''} readOnly className="w-full px-3 py-1.5 border rounded-lg bg-slate-50 font-mono text-slate-500" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Username Login *</label>
                      <input
                        type="text"
                        value={formData.Username || ''}
                        onChange={e => setFormData({ ...formData, Username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                        placeholder="hurufkecil/angka"
                        className="w-full px-3 py-1.5 border rounded-lg font-semibold font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                      <input
                        type="text"
                        value={formData.Nama || ''}
                        onChange={e => setFormData({ ...formData, Nama: e.target.value })}
                        placeholder="Nama Lengkap Karyawan"
                        className="w-full px-3 py-1.5 border rounded-lg font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kata Sandi (Password)</label>
                      <input
                        type="password"
                        value={formData.Password || ''}
                        onChange={e => setFormData({ ...formData, Password: e.target.value })}
                        placeholder={editingItem ? 'Kosongkan jika tidak diubah' : 'Minimal 4 karakter'}
                        className="w-full px-3 py-1.5 border rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Dropdown ID Karyawan */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hubungkan Data Karyawan</label>
                    <select
                      value={formData.ID_Karyawan || ''}
                      onChange={e => {
                        const id = e.target.value;
                        const emp = employees.find(k => k.ID_Karyawan === id);
                        setFormData({ 
                          ...formData, 
                          ID_Karyawan: id,
                          Nama: formData.Nama || emp?.Nama_Karyawan || ''
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-medium"
                    >
                      <option value="">Pilih Karyawan Terdaftar</option>
                      {employees.map(e => (
                        <option key={e.ID_Karyawan} value={e.ID_Karyawan}>
                          {e.ID_Karyawan} - {e.Nama_Karyawan} ({e.Departemen} - {e.Jabatan})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Pilihan Multi-Divisi (Merangkap Beberapa Divisi) */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Layers size={14} className="text-blue-600" />
                        <span>Divisi Penugasan (Bisa Merangkap Beberapa Divisi)</span>
                      </label>
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        {(formData.Roles || [formData.Role || 'Admin Produksi']).length} Divisi
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {AVAILABLE_DIVISIONS.map(div => {
                        const currentRoles: UserRole[] = formData.Roles || (formData.Role ? [formData.Role] : ['Admin Produksi']);
                        const isChecked = currentRoles.includes(div.role);

                        return (
                          <label
                            key={div.role}
                            className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                let updatedRoles: UserRole[];
                                if (isChecked) {
                                  if (currentRoles.length === 1) return; // Pertahankan minimal 1 role
                                  updatedRoles = currentRoles.filter(r => r !== div.role);
                                } else {
                                  updatedRoles = [...currentRoles, div.role];
                                }
                                setFormData({
                                  ...formData,
                                  Roles: updatedRoles,
                                  Role: updatedRoles[0] || 'Admin Produksi'
                                });
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            <span>{div.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Akun Dropdown */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Akun</label>
                    <select
                      value={formData.Status_Akun || 'Aktif'}
                      onChange={e => setFormData({ ...formData, Status_Akun: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value="Aktif">Aktif (Dapat Masuk)</option>
                      <option value="Menunggu Persetujuan">Menunggu Persetujuan (Perlu Approval)</option>
                      <option value="Terblokir">Terblokir (Tidak Dapat Masuk)</option>
                      <option value="Ditolak">Ditolak (Permohonan Ditolak)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium">
                Batal
              </button>
              <button onClick={handleSave} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors">
                <Save size={14} />
                <span>{editingItem ? 'Perbarui Data' : 'Simpan Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN PERUBAHAN HARGA BERDASARKAN TANGGAL */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div>
                <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                  <CalendarClock size={18} className="text-blue-400" />
                  Atur Perubahan Harga Berdasarkan Tanggal
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Tentukan tanggal berlaku dan harga baru. Perubahan otomatis dicatat ke histori.
                </p>
              </div>
              <button 
                onClick={() => setShowPriceModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Tipe Item Switcher */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Tipe Komoditas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePriceTypeToggle('Bahan Penolong')}
                    className={`p-2.5 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      priceForm.tipe === 'Bahan Penolong'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Tag size={15} className={priceForm.tipe === 'Bahan Penolong' ? 'text-amber-600' : 'text-slate-400'} />
                    <span>Bahan Penolong</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePriceTypeToggle('Produk')}
                    className={`p-2.5 rounded-lg border font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      priceForm.tipe === 'Produk'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-900 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingUp size={15} className={priceForm.tipe === 'Produk' ? 'text-blue-600' : 'text-slate-400'} />
                    <span>Produk Jadi (AMDK)</span>
                  </button>
                </div>
              </div>

              {/* Item Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih {priceForm.tipe === 'Bahan Penolong' ? 'Bahan Penolong' : 'Produk Jadi'}
                </label>
                <select
                  value={priceForm.idItem}
                  onChange={e => handlePriceItemChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {priceForm.tipe === 'Bahan Penolong' ? (
                    rawMaterials.map(m => (
                      <option key={m.ID_Bahan} value={m.ID_Bahan}>
                        {m.ID_Bahan} - {m.Nama_Bahan} (Harga Saat Ini: Rp {Number(m.Harga_Satuan || 0).toLocaleString('id-ID')})
                      </option>
                    ))
                  ) : (
                    products.map(p => (
                      <option key={p.ID_Produk} value={p.ID_Produk}>
                        {p.ID_Produk} - {p.Nama_Produk} (Dist: Rp {Number(p.Harga_Distributor || 0).toLocaleString('id-ID')})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Tanggal Mulai Berlaku */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Tanggal Mulai Berlaku</label>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    priceForm.tanggalBerlaku <= new Date().toISOString().slice(0, 10)
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {priceForm.tanggalBerlaku <= new Date().toISOString().slice(0, 10)
                      ? '● Langsung Aktif Berlaku'
                      : '● Terjadwal Mendatang'}
                  </span>
                </div>
                <input
                  type="date"
                  value={priceForm.tanggalBerlaku}
                  onChange={e => setPriceForm({ ...priceForm, tanggalBerlaku: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {priceForm.tanggalBerlaku <= new Date().toISOString().slice(0, 10)
                    ? 'Harga pada master data akan langsung diperbarui saat disimpan.'
                    : 'Harga baru akan otomatis aktif ketika tanggal tersebut tiba (diperiksa otomatis saat aplikasi dibuka).'}
                </p>
              </div>

              {/* INPUT HARGA BARU */}
              {priceForm.tipe === 'Bahan Penolong' ? (
                (() => {
                  const currentMat = rawMaterials.find(m => m.ID_Bahan === priceForm.idItem);
                  const ref = getPrecedingReferencePrice(priceForm.idItem, priceForm.tanggalBerlaku, 'Bahan Penolong');
                  const currentPrice = ref.hargaLamaBahan;
                  const newPrice = Number(priceForm.hargaBaruBahan) || 0;
                  const diff = newPrice - currentPrice;
                  const pct = currentPrice > 0 ? ((diff / currentPrice) * 100).toFixed(1) : '0';

                  return (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-2 gap-1">
                        <div>
                          <span className="text-slate-600 font-bold block text-xs">Harga Acuan Sebelumnya:</span>
                          <span className="text-[10px] text-slate-500">
                            {ref.tanggalAcuan ? `Acuan harga yang berlaku sejak ${ref.tanggalAcuan}` : 'Acuan dari data Master'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded text-xs">
                          Rp {currentPrice.toLocaleString('id-ID')} / {currentMat?.Satuan || 'unit'}
                        </span>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">
                          Harga Satuan Baru (Rp)
                        </label>
                        <input
                          type="number"
                          value={priceForm.hargaBaruBahan}
                          onChange={e => setPriceForm({ ...priceForm, hargaBaruBahan: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="Masukkan harga satuan baru"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {priceForm.hargaBaruBahan !== '' && (
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-slate-500 font-medium">Simulasi Selisih dari Acuan Sebelumnya:</span>
                          <span className={`font-bold inline-flex items-center gap-1 ${
                            diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-600'
                          }`}>
                            {diff > 0 ? <TrendingUp size={13} /> : diff < 0 ? <TrendingDown size={13} /> : null}
                            {diff > 0 ? '+' : ''}Rp {diff.toLocaleString('id-ID')} ({pct}%)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const currentProd = products.find(p => p.ID_Produk === priceForm.idItem);
                  const ref = getPrecedingReferencePrice(priceForm.idItem, priceForm.tanggalBerlaku, 'Produk');
                  const curDist = ref.hargaLamaDistributor;
                  const curAgen = ref.hargaLamaAgen;
                  const curRes = ref.hargaLamaReseller;
                  const curKons = ref.hargaLamaKonsumen;

                  const newDist = Number(priceForm.hargaDistributor) || 0;
                  const diffDist = newDist - curDist;
                  const pctDist = curDist > 0 ? ((diffDist / curDist) * 100).toFixed(1) : '0';

                  return (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-2 gap-1">
                        <div>
                          <span className="text-slate-700 font-bold block text-xs">Acuan Harga dari Tanggal Sebelumnya:</span>
                          <span className="text-[10px] text-slate-500">
                            {ref.tanggalAcuan ? `Acuan harga yang berlaku sejak ${ref.tanggalAcuan}` : 'Acuan dari data Master'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                          Satuan: {currentProd?.Satuan || 'Dus'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            Harga Distributor (Rp)
                          </label>
                          <input
                            type="number"
                            value={priceForm.hargaDistributor}
                            onChange={e => setPriceForm({ ...priceForm, hargaDistributor: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-blue-900 bg-white"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Acuan Sblm: Rp {curDist.toLocaleString('id-ID')}</p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            Harga Agen (Rp)
                          </label>
                          <input
                            type="number"
                            value={priceForm.hargaAgen}
                            onChange={e => setPriceForm({ ...priceForm, hargaAgen: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Acuan Sblm: Rp {curAgen.toLocaleString('id-ID')}</p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            Harga Reseller (Rp)
                          </label>
                          <input
                            type="number"
                            value={priceForm.hargaReseller}
                            onChange={e => setPriceForm({ ...priceForm, hargaReseller: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Acuan Sblm: Rp {curRes.toLocaleString('id-ID')}</p>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                            Harga Konsumen (Rp)
                          </label>
                          <input
                            type="number"
                            value={priceForm.hargaKonsumen}
                            onChange={e => setPriceForm({ ...priceForm, hargaKonsumen: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                          />
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Acuan Sblm: Rp {curKons.toLocaleString('id-ID')}</p>
                        </div>
                      </div>

                      {priceForm.hargaDistributor !== '' && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                          <span className="text-slate-500 font-medium">Selisih Distributor dari Acuan Sebelumnya:</span>
                          <span className={`font-bold inline-flex items-center gap-1 ${
                            diffDist >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {diffDist >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {diffDist >= 0 ? '+' : ''}Rp {diffDist.toLocaleString('id-ID')} ({pctDist}%)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Alasan / Keterangan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan / Alasan Perubahan Harga
                </label>
                <textarea
                  rows={2}
                  value={priceForm.keterangan}
                  onChange={e => setPriceForm({ ...priceForm, keterangan: e.target.value })}
                  placeholder="Contoh: Kenaikan harga bahan baku plastik supplier, penyesuaian tarif per 1 November, promo diskon, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPriceModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePriceModal}
                className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Simpan & Terapkan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
