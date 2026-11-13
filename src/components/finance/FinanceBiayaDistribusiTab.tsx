import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, Coins, Plus, Printer, Download, Eye, 
  Trash2, Edit2, FileCheck, X, Building, Save, FileText,
  FileDown, Send, CheckCircle2, Search, Check, RefreshCw, Calendar,
  RotateCcw, Filter, ExternalLink, Clock, PackageCheck, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { 
  DistributionItem, DistributionProductDetail, DriverSettlementItem, DriverSettlementDetail,
  GeneralJournalItem, DraftJournalItem 
} from '../../types';
import { getTableData, setTableData, deleteTableRow, isRadityaVariant, normalizeDistributionDriver } from '../../services/dbAdapter';
import { exportDataToExcel } from '../../services/excelService';
import { generateTableReportPDF, formatRupiahSen, angkaKeTerbilang } from '../../services/pdfService';
import { showToast as showToastGlobal } from '../ToastContainer';
import { confirmAction } from '../ConfirmDialog';
import { formatDateDDMMYYYY } from '../../services/formatters';

interface FinanceBiayaDistribusiTabProps {
  distributions?: DistributionItem[];
  distributionItems?: DistributionProductDetail[];
  driverSettlements: DriverSettlementItem[];
  setDriverSettlements: React.Dispatch<React.SetStateAction<DriverSettlementItem[]>>;
  defaultPeriod: string;
  onRefresh: () => void;
  showToast: (type: 'success' | 'warning' | 'error' | 'info', text: string) => void;
}

export const FinanceBiayaDistribusiTab: React.FC<FinanceBiayaDistribusiTabProps> = ({
  distributions = [],
  distributionItems = [],
  driverSettlements,
  setDriverSettlements,
  defaultPeriod,
  onRefresh,
  showToast
}) => {
  const [distCostSubView, setDistCostSubView] = useState<'rekap_driver' | 'semua_pengiriman' | 'riwayat_pencairan'>('rekap_driver');
  const [distFilterPeriod, setDistFilterPeriod] = useState<string>(defaultPeriod);
  const [distFilterDriver, setDistFilterDriver] = useState<string>('all');
  const [distFilterStatus, setDistFilterStatus] = useState<'all' | 'unclaimed' | 'claimed'>('all');
  const [distSearchQuery, setDistSearchQuery] = useState<string>('');
  const [defaultTarifPerDus, setDefaultTarifPerDus] = useState<number>(1000);
  const [customTarifMap, setCustomTarifMap] = useState<Record<string, number>>({});
  const [selectedDistIdsForClaim, setSelectedDistIdsForClaim] = useState<Set<string>>(new Set());

  // Modal pencairan biaya distribusi driver
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [claimModalDriver, setClaimModalDriver] = useState<string>('');
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

  useEffect(() => {
    const handleDbChange = () => {
      setDriverSettlements(getTableData<DriverSettlementItem>('Pencairan_Biaya_Distribusi', []));
    };
    window.addEventListener('airis_db_updated', handleDbChange);
    window.addEventListener('storage', handleDbChange);
    return () => {
      window.removeEventListener('airis_db_updated', handleDbChange);
      window.removeEventListener('storage', handleDbChange);
    };
  }, [setDriverSettlements]);
  // -------------------------------------------------------------
  // REKAPITULASI BIAYA DISTRIBUSI & PENCAIRAN DRIVER PABRIK
  // -------------------------------------------------------------
  // Helper parsing list string/array aman (menghindari error runtime jika properti tersimpan sebagai string JSON / comma text di SQLite)
  const safeList = (val: any): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return val.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const distSettlementMap = useMemo(() => {
    const map = new Map<string, DriverSettlementItem>();
    (driverSettlements || []).forEach(s => {
      safeList(s.ID_Distribusi_List).forEach(id => {
        if (id) map.set(String(id).trim(), s);
      });
      safeList(s.No_Surat_Jalan_List).forEach(sj => {
        if (sj) map.set(String(sj).trim(), s);
      });
    });
    return map;
  }, [driverSettlements]);

  const allArmadaShipments = useMemo(() => {
    return (distributions || [])
      .filter(d => {
        if (!d) return false;
        const metode = (d.Metode_Kirim || '').trim();
        return metode !== 'Ambil Sendiri';
      })
      .map(d => {
        const idDist = String(d.ID_Distribusi || '').trim();
        const noSJ = String(d.No_Surat_Jalan || '-').trim();
        const driverName = normalizeDistributionDriver(d.Pengirim, true);

        const itms = distItemsMap.get(idDist) || [];
        let totalDus = itms.reduce((s, it) => s + (Number(it.Qty) || 0), 0);
        if (totalDus === 0) {
          const anyD = d as any;
          totalDus = (Number(anyD.C120) || 0) + (Number(anyD.C220) || 0) + (Number(anyD.B330) || 0) + (Number(anyD.B600) || 0) + (Number(anyD.G19) || 0);
        }

        const customTarif = customTarifMap[idDist];
        const tarif = customTarif !== undefined ? customTarif : defaultTarifPerDus;
        const totalBiaya = totalDus * tarif;

        const matchedSettlement = distSettlementMap.get(idDist) || (noSJ !== '-' ? distSettlementMap.get(noSJ) : undefined);
        const isClaimed = !!matchedSettlement;

        return {
          idDistribusi: idDist,
          tanggal: d.Tanggal || '',
          noSuratJalan: noSJ,
          noInvoice: d.No_Invoice || `INV-${noSJ}`,
          namaDriver: driverName,
          pelanggan: d.Nama_Pelanggan || 'Pelanggan AMDK',
          tujuan: d.Tujuan || '-',
          totalDus,
          tarifPerDus: tarif,
          totalBiaya,
          isClaimed,
          settlementId: matchedSettlement?.ID_Pencairan,
          settlementDate: matchedSettlement?.Tanggal,
          settlementAkun: matchedSettlement?.Nama_Akun_Kas || matchedSettlement?.Akun_Kas
        };
      });
  }, [distributions, distItemsMap, customTarifMap, defaultTarifPerDus, distSettlementMap]);

  const uniqueDriverNames = useMemo(() => {
    const set = new Set<string>();
    allArmadaShipments.forEach(s => {
      if (s.namaDriver) set.add(s.namaDriver);
    });
    return Array.from(set).sort();
  }, [allArmadaShipments]);

  const driverCostSummaries = useMemo(() => {
    const map = new Map<string, {
      namaDriver: string;
      totalPengiriman: number;
      totalDus: number;
      totalBiaya: number;
      pengirimanDicairkan: number;
      dusDicairkan: number;
      biayaDicairkan: number;
      pengirimanBelumDicairkan: number;
      dusBelumDicairkan: number;
      biayaBelumDicairkan: number;
      items: typeof allArmadaShipments;
    }>();

    uniqueDriverNames.forEach(name => {
      map.set(name, {
        namaDriver: name,
        totalPengiriman: 0,
        totalDus: 0,
        totalBiaya: 0,
        pengirimanDicairkan: 0,
        dusDicairkan: 0,
        biayaDicairkan: 0,
        pengirimanBelumDicairkan: 0,
        dusBelumDicairkan: 0,
        biayaBelumDicairkan: 0,
        items: []
      });
    });

    allArmadaShipments.forEach(s => {
      if (distFilterPeriod) {
        const sMonth = s.tanggal.slice(0, 7);
        if (sMonth !== distFilterPeriod) return;
      }

      let cur = map.get(s.namaDriver);
      if (!cur) {
        cur = {
          namaDriver: s.namaDriver,
          totalPengiriman: 0,
          totalDus: 0,
          totalBiaya: 0,
          pengirimanDicairkan: 0,
          dusDicairkan: 0,
          biayaDicairkan: 0,
          pengirimanBelumDicairkan: 0,
          dusBelumDicairkan: 0,
          biayaBelumDicairkan: 0,
          items: []
        };
        map.set(s.namaDriver, cur);
      }

      cur.totalPengiriman += 1;
      cur.totalDus += s.totalDus;
      cur.totalBiaya += s.totalBiaya;
      cur.items.push(s);

      if (s.isClaimed) {
        cur.pengirimanDicairkan += 1;
        cur.dusDicairkan += s.totalDus;
        cur.biayaDicairkan += s.totalBiaya;
      } else {
        cur.pengirimanBelumDicairkan += 1;
        cur.dusBelumDicairkan += s.totalDus;
        cur.biayaBelumDicairkan += s.totalBiaya;
      }
    });

    return Array.from(map.values())
      .filter(d => d.totalPengiriman > 0)
      .sort((a, b) => b.biayaBelumDicairkan - a.biayaBelumDicairkan || b.totalDus - a.totalDus);
  }, [allArmadaShipments, uniqueDriverNames, distFilterPeriod]);

  const filteredShipments = useMemo(() => {
    return allArmadaShipments.filter(s => {
      if (distFilterPeriod && s.tanggal.slice(0, 7) !== distFilterPeriod) return false;
      if (distFilterDriver !== 'all' && s.namaDriver !== distFilterDriver) return false;
      if (distFilterStatus === 'unclaimed' && s.isClaimed) return false;
      if (distFilterStatus === 'claimed' && !s.isClaimed) return false;
      if (distSearchQuery) {
        const q = distSearchQuery.toLowerCase();
        const match = s.noSuratJalan.toLowerCase().includes(q) ||
                      s.namaDriver.toLowerCase().includes(q) ||
                      s.pelanggan.toLowerCase().includes(q) ||
                      s.tujuan.toLowerCase().includes(q) ||
                      s.noInvoice.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [allArmadaShipments, distFilterPeriod, distFilterDriver, distFilterStatus, distSearchQuery]);

  const distCostMetrics = useMemo(() => {
    let totalDus = 0;
    let totalTrip = 0;
    let totalBiaya = 0;
    let dicairkanBiaya = 0;
    let dicairkanDus = 0;
    let belumDicairkanBiaya = 0;
    let belumDicairkanDus = 0;
    let belumDicairkanTrip = 0;

    allArmadaShipments.forEach(s => {
      if (distFilterPeriod && s.tanggal.slice(0, 7) !== distFilterPeriod) return;
      totalDus += s.totalDus;
      totalTrip += 1;
      totalBiaya += s.totalBiaya;
      if (s.isClaimed) {
        dicairkanBiaya += s.totalBiaya;
        dicairkanDus += s.totalDus;
      } else {
        belumDicairkanBiaya += s.totalBiaya;
        belumDicairkanDus += s.totalDus;
        belumDicairkanTrip += 1;
      }
    });

    return {
      totalDus,
      totalTrip,
      totalBiaya,
      dicairkanBiaya,
      dicairkanDus,
      belumDicairkanBiaya,
      belumDicairkanDus,
      belumDicairkanTrip
    };
  }, [allArmadaShipments, distFilterPeriod]);

  const pendingClaimCount = distCostMetrics.belumDicairkanTrip;

  // Handlers untuk Pencairan Biaya Distribusi Driver
  const handleOpenClaimForDriver = (driverName: string) => {
    const unclaimed = allArmadaShipments.filter(s => {
      if (s.namaDriver !== driverName) return false;
      if (s.isClaimed) return false;
      if (distFilterPeriod && s.tanggal.slice(0, 7) !== distFilterPeriod) return false;
      return true;
    });
    if (unclaimed.length === 0) {
      showToast('error', `Tidak ada pengiriman pending yang belum dicairkan untuk ${driverName}`);
      return;
    }
    const newSet = new Set<string>();
    unclaimed.forEach(u => newSet.add(u.idDistribusi));
    setSelectedDistIdsForClaim(newSet);
    setClaimModalDriver(driverName);
    setClaimForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      Akun_Kas: '111-10',
      Keterangan: `Pencairan Ongkos Distribusi Driver: ${driverName} (${unclaimed.length} Surat Jalan)`,
      Catat_Ke_Jurnal: true
    });
    setShowClaimModal(true);
  };

  const handleOpenClaimSelected = () => {
    if (selectedDistIdsForClaim.size === 0) {
      showToast('error', 'Pilih minimal satu pengiriman untuk dicairkan!');
      return;
    }
    const selected = allArmadaShipments.filter(s => selectedDistIdsForClaim.has(s.idDistribusi));
    const drivers = Array.from(new Set(selected.map(s => s.namaDriver)));
    const driverLabel = drivers.length === 1 ? drivers[0] : `${drivers.length} Driver (${drivers.join(', ')})`;
    setClaimModalDriver(driverLabel);
    setClaimForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      Akun_Kas: '111-10',
      Keterangan: `Pencairan Ongkos Distribusi: ${driverLabel} (${selected.length} Pengiriman)`,
      Catat_Ke_Jurnal: true
    });
    setShowClaimModal(true);
  };

  const handleToggleSelectDist = (id: string) => {
    setSelectedDistIdsForClaim(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFilteredUnclaimed = () => {
    const unclaimed = filteredShipments.filter(s => !s.isClaimed);
    if (unclaimed.length === 0) return;
    const allSelected = unclaimed.every(s => selectedDistIdsForClaim.has(s.idDistribusi));
    setSelectedDistIdsForClaim(prev => {
      const next = new Set(prev);
      if (allSelected) {
        unclaimed.forEach(u => next.delete(u.idDistribusi));
      } else {
        unclaimed.forEach(u => next.add(u.idDistribusi));
      }
      return next;
    });
  };

  const handleUpdateCustomTarif = (idDist: string, newTarif: number) => {
    const val = Number(newTarif);
    if (isNaN(val) || val < 0) return;
    setCustomTarifMap(prev => ({
      ...prev,
      [idDist]: val
    }));
  };

  const handleSaveSettlement = () => {
    const selectedItems = allArmadaShipments.filter(s => selectedDistIdsForClaim.has(s.idDistribusi));
    if (selectedItems.length === 0) {
      showToast('error', 'Tidak ada pengiriman yang dipilih!');
      return;
    }

    const totalDus = selectedItems.reduce((s, it) => s + it.totalDus, 0);
    const totalBiaya = selectedItems.reduce((s, it) => s + it.totalBiaya, 0);
    const newId = `SET-DST-${Date.now().toString().slice(-6)}`;

    const akunKasName = claimForm.Akun_Kas === '111-10' 
      ? 'Kas Kecil (Petty Cash)' 
      : claimForm.Akun_Kas === '111-20' 
        ? 'Kas Bank BSI 1607134444' 
        : claimForm.Akun_Kas === '111-21' 
          ? 'Kas Bank BRI' 
          : 'Kas Perusahaan';

    const newSettlement: DriverSettlementItem = {
      ID_Pencairan: newId,
      Tanggal: claimForm.Tanggal,
      Nama_Driver: claimModalDriver,
      Tarif_Per_Dus: defaultTarifPerDus,
      Total_Dus: totalDus,
      Total_Biaya: totalBiaya,
      Jumlah_Pengiriman: selectedItems.length,
      ID_Distribusi_List: selectedItems.map(s => s.idDistribusi),
      No_Surat_Jalan_List: selectedItems.map(s => s.noSuratJalan),
      Akun_Kas: claimForm.Akun_Kas,
      Nama_Akun_Kas: akunKasName,
      Keterangan: claimForm.Keterangan || `Pencairan Biaya Distribusi ${claimModalDriver} (${totalDus} Dus)`,
      Waktu_Input: new Date().toISOString(),
      Items_Detail: selectedItems.map(s => ({
        ID_Distribusi: s.idDistribusi,
        No_Surat_Jalan: s.noSuratJalan,
        Tanggal: s.tanggal,
        Pelanggan: s.pelanggan,
        Tujuan: s.tujuan,
        Dus: s.totalDus,
        Tarif: s.tarifPerDus,
        Biaya: s.totalBiaya
      }))
    };

    const current = getTableData<DriverSettlementItem>('Pencairan_Biaya_Distribusi', []);
    const updated = [newSettlement, ...current];
    setTableData('Pencairan_Biaya_Distribusi', updated);
    setDriverSettlements(updated);

    if (claimForm.Catat_Ke_Jurnal) {
      // 1. Catat langsung ke Jurnal Umum (Double-Entry Seimbang)
      const currentJournals = getTableData<GeneralJournalItem>('Jurnal_Umum', []);
      const tgl = claimForm.Tanggal || new Date().toISOString().slice(0, 10);
      const periode = tgl.slice(0, 7);
      const yy = periode.slice(2, 4);
      const mm = periode.slice(5, 7);
      const prefix = `JUR-${yy}${mm}-`;

      let maxSeq = 0;
      currentJournals.forEach(j => {
        if (j.ID_JURNAL?.startsWith(prefix)) {
          const num = parseInt(j.ID_JURNAL.replace(prefix, ''), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      });
      const nextId = prefix + String(maxSeq + 1).padStart(3, '0');

      const debitRow: GeneralJournalItem = {
        ID_JURNAL: nextId,
        TANGGAL: tgl,
        PERIODE: periode,
        REFERENSI: newId,
        KETERANGAN: newSettlement.Keterangan || `Pencairan Biaya Distribusi: ${claimModalDriver}`,
        KODE_AKUN: '611-30', // Beban BBM & Uang Jalan Armada
        DEBIT: totalBiaya,
        KREDIT: 0,
        PEMBUAT: 'Admin Finance'
      };

      const creditRow: GeneralJournalItem = {
        ID_JURNAL: nextId,
        TANGGAL: tgl,
        PERIODE: periode,
        REFERENSI: newId,
        KETERANGAN: newSettlement.Keterangan || `Pencairan Biaya Distribusi: ${claimModalDriver}`,
        KODE_AKUN: claimForm.Akun_Kas,
        DEBIT: 0,
        KREDIT: totalBiaya,
        PEMBUAT: 'Admin Finance'
      };

      setTableData('Jurnal_Umum', [...currentJournals, debitRow, creditRow]);

      // 2. Catat juga ke Draf Jurnal dengan status 'Disetujui'
      const currentDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
      const newDraft: DraftJournalItem = {
        ID_Draf: `DRF-DST-${Date.now().toString().slice(-6)}`,
        Sumber: 'Distribusi',
        Tanggal: tgl,
        Referensi: newId,
        Keterangan: newSettlement.Keterangan || `Pencairan Biaya Distribusi: ${claimModalDriver}`,
        Kode_Debit: '611-30',
        Kode_Kredit: claimForm.Akun_Kas,
        Nominal: totalBiaya,
        Status: 'Disetujui',
        Waktu_Dibuat: new Date().toISOString()
      };
      setTableData('Draf_Jurnal', [newDraft, ...currentDrafts]);
    }

    showToast('success', `Berhasil mencairkan biaya distribusi Rp ${totalBiaya.toLocaleString('id-ID')} (${selectedItems.length} pengiriman) untuk ${claimModalDriver}!`);
    setShowClaimModal(false);
    setSelectedDistIdsForClaim(new Set());
    setShowDetailSettlementModal(newSettlement);
    onRefresh();
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    const s = driverSettlements.find(item => item.ID_Pencairan === settlementId);
    const ok = await confirmAction({
      title: 'Batalkan Pencairan Biaya Distribusi',
      message: `Batalkan pencairan "${settlementId}" (${s?.Nama_Driver || 'Driver'} - Rp ${(s?.Total_Biaya || 0).toLocaleString('id-ID')})? Seluruh pengiriman terkait akan dikembalikan ke status "Belum Dicairkan".`,
      confirmText: 'Ya, Batalkan Pencairan',
      cancelText: 'Kembali',
      type: 'danger',
      itemDetails: {
        'No. Pencairan': settlementId,
        'Driver': s?.Nama_Driver || '-',
        'Jumlah Pengiriman': `${s?.Jumlah_Pengiriman || 0} Pengiriman`,
        'Total Dus': `${s?.Total_Dus || 0} Dus`,
        'Total Biaya': `Rp ${(s?.Total_Biaya || 0).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const current = getTableData<DriverSettlementItem>('Pencairan_Biaya_Distribusi', []);
    const updated = current.filter(item => item.ID_Pencairan !== settlementId);
    setTableData('Pencairan_Biaya_Distribusi', updated);
    setDriverSettlements(updated);

    // Hapus jurnal terkait jika ada
    const currentJournals = getTableData<GeneralJournalItem>('Jurnal_Umum', []);
    const updatedJournals = currentJournals.filter(j => j.REFERENSI !== settlementId && !j.REFERENSI?.startsWith(settlementId));
    if (updatedJournals.length !== currentJournals.length) {
      setTableData('Jurnal_Umum', updatedJournals);
    }

    // Hapus draf jurnal terkait jika ada
    const currentDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
    const updatedDrafts = currentDrafts.filter(d => d.Referensi !== settlementId && !d.Referensi?.includes(settlementId));
    if (updatedDrafts.length !== currentDrafts.length) {
      setTableData('Draf_Jurnal', updatedDrafts);
    }

    showToast('success', `Pencairan ${settlementId} berhasil dibatalkan.`);
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

  return (
    <>
      <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Rekapitulasi Biaya Distribusi &amp; Ongkos Kirim Driver
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Armada Pabrik
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring dan pencairan biaya transportasi driver pabrik per pengiriman produk (Default Rp 1.000 / produk atau tarif custom).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="text-slate-500 font-medium">Tarif Acuan:</span>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-700">Rp</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={defaultTarifPerDus}
                    onChange={e => setDefaultTarifPerDus(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 px-2 py-0.5 font-mono font-bold text-blue-700 bg-white border border-slate-300 rounded text-xs outline-none focus:border-blue-500"
                    title="Tarif acuan biaya per dus/produk"
                  />
                  <span className="text-slate-500 text-[11px]">/ dus</span>
                </div>
              </div>

              {selectedDistIdsForClaim.size > 0 && (
                <button
                  onClick={handleOpenClaimSelected}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Coins size={14} />
                  <span>Cairkan ({selectedDistIdsForClaim.size} Pengiriman)</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Kartu Metrik Utama */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">Total Biaya Distribusi</span>
                <span className="p-1 rounded bg-blue-50 text-blue-600"><Truck size={14} /></span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                Rp {distCostMetrics.totalBiaya.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {distCostMetrics.totalDus.toLocaleString('id-ID')} dus • {distCostMetrics.totalTrip} trip pengiriman
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium text-emerald-700">Sudah Dicairkan</span>
                <span className="p-1 rounded bg-emerald-50 text-emerald-600"><CheckCircle2 size={14} /></span>
              </div>
              <div className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                Rp {distCostMetrics.dicairkanBiaya.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-emerald-600 mt-1">
                {distCostMetrics.dicairkanDus.toLocaleString('id-ID')} dus lunas dicairkan
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border shadow-xs ${distCostMetrics.belumDicairkanBiaya > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-semibold ${distCostMetrics.belumDicairkanBiaya > 0 ? 'text-amber-900' : 'text-slate-500'}`}>
                  Belum Dicairkan (Pending)
                </span>
                <span className="p-1 rounded bg-amber-100 text-amber-700"><Clock size={14} /></span>
              </div>
              <div className={`text-lg font-bold font-mono tabular-nums ${distCostMetrics.belumDicairkanBiaya > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                Rp {distCostMetrics.belumDicairkanBiaya.toLocaleString('id-ID')}
              </div>
              <div className={`text-[11px] mt-1 ${distCostMetrics.belumDicairkanBiaya > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                {distCostMetrics.belumDicairkanDus.toLocaleString('id-ID')} dus • {distCostMetrics.belumDicairkanTrip} pengiriman siap cair
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                <span className="font-medium">Rata-rata Muatan Driver</span>
                <span className="p-1 rounded bg-slate-50 text-slate-600"><Scale size={14} /></span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                {distCostMetrics.totalTrip > 0 ? Math.round(distCostMetrics.totalDus / distCostMetrics.totalTrip).toLocaleString('id-ID') : 0} Dus / Rit
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Dari {uniqueDriverNames.length} driver armada pabrik aktif
              </div>
            </div>
          </div>

          {/* Sub-Tabs Switcher & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setDistCostSubView('rekap_driver')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  distCostSubView === 'rekap_driver'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Users size={14} />
                <span>Rekap Per Driver</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  distCostSubView === 'rekap_driver' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {driverCostSummaries.length}
                </span>
              </button>

              <button
                onClick={() => setDistCostSubView('semua_pengiriman')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  distCostSubView === 'semua_pengiriman'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FileText size={14} />
                <span>Rincian Seluruh Pengiriman</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  distCostSubView === 'semua_pengiriman' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {filteredShipments.length}
                </span>
              </button>

              <button
                onClick={() => setDistCostSubView('riwayat_pencairan')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  distCostSubView === 'riwayat_pencairan'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <History size={14} />
                <span>Riwayat Pencairan Kas</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  distCostSubView === 'riwayat_pencairan' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {driverSettlements.length}
                </span>
              </button>
            </div>

            {/* Filter Periode Cepat */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">Bulan:</label>
              <input
                type="month"
                value={distFilterPeriod}
                onChange={e => setDistFilterPeriod(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
              />
              {distFilterPeriod && (
                <button
                  onClick={() => setDistFilterPeriod('')}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  title="Lihat Semua Periode"
                >
                  Semua
                </button>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SUB-VIEW 1: REKAPITULASI BIAYA PER DRIVER PABRIK          */}
          {/* ========================================================= */}
          {distCostSubView === 'rekap_driver' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {driverCostSummaries.length === 0 ? (
                  <div className="col-span-full p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 font-sans italic">
                    Belum ada data pengiriman armada pabrik untuk periode ini.
                  </div>
                ) : (
                  driverCostSummaries.map((drv, idx) => (
                    <div
                      key={drv.namaDriver || idx}
                      className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs uppercase shadow-xs ${
                              drv.namaDriver === 'Driver -' 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {drv.namaDriver === 'Driver -' ? 'D-' : drv.namaDriver.slice(0, 2)}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                {drv.namaDriver}
                                {drv.namaDriver === 'Driver -' && (
                                  <span className="text-[10px] font-normal text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Pengirim Kosong
                                  </span>
                                )}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {drv.totalPengiriman} Trip Pengiriman
                              </p>
                            </div>
                          </div>
                          {drv.biayaBelumDicairkan > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                              {drv.pengirimanBelumDicairkan} Pending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Lunas
                            </span>
                          )}
                        </div>

                        {/* Rincian Muatan & Biaya Driver */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg">
                            <span className="text-slate-500 block text-[10.5px]">Total Dus Terkirim</span>
                            <span className="text-xs font-bold text-slate-900 font-mono">
                              {drv.totalDus.toLocaleString('id-ID')} Dus
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg">
                            <span className="text-slate-500 block text-[10.5px]">Total Hak Biaya</span>
                            <span className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                              Rp {drv.totalBiaya.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                            <span className="text-emerald-700 block text-[10.5px] font-medium">Sudah Dicairkan</span>
                            <span className="text-xs font-bold text-emerald-800 font-mono tabular-nums">
                              Rp {drv.biayaDicairkan.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className={`p-2 rounded-lg border ${drv.biayaBelumDicairkan > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                            <span className={`block text-[10.5px] font-medium ${drv.biayaBelumDicairkan > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
                              Belum Dicairkan
                            </span>
                            <span className={`text-xs font-bold font-mono tabular-nums ${drv.biayaBelumDicairkan > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                              Rp {drv.biayaBelumDicairkan.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tombol Aksi Driver */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {drv.biayaBelumDicairkan > 0 ? (
                          <button
                            onClick={() => handleOpenClaimForDriver(drv.namaDriver)}
                            className="flex-1 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Coins size={13} />
                            <span>Cairkan ({drv.pengirimanBelumDicairkan} SJ)</span>
                          </button>
                        ) : (
                          <div className="flex-1 py-1.5 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                            Semua Telah Dicairkan
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setDistFilterDriver(drv.namaDriver);
                            setDistCostSubView('semua_pengiriman');
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          title="Lihat rincian surat jalan driver ini"
                        >
                          <Eye size={13} />
                          <span>Rincian</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-VIEW 2: RINCIAN SELURUH PENGIRIMAN & CHECKLIST CAIR   */}
          {/* ========================================================= */}
          {distCostSubView === 'semua_pengiriman' && (
            <div className="space-y-3">
              {/* Filter Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari No. Surat Jalan, Invoice, Driver, Pelanggan, atau Tujuan..."
                    value={distSearchQuery}
                    onChange={e => setDistSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Filter Driver */}
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">Driver:</span>
                    <select
                      value={distFilterDriver}
                      onChange={e => setDistFilterDriver(e.target.value)}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-semibold outline-none text-xs"
                    >
                      <option value="all">Semua Driver ({uniqueDriverNames.length})</option>
                      {uniqueDriverNames.map(drv => (
                        <option key={drv} value={drv}>{drv}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Status Pencairan */}
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 text-[11px]">Status:</span>
                    <select
                      value={distFilterStatus}
                      onChange={e => setDistFilterStatus(e.target.value as any)}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-semibold outline-none text-xs"
                    >
                      <option value="all">Semua Status</option>
                      <option value="unclaimed">Belum Dicairkan (Pending)</option>
                      <option value="claimed">Sudah Dicairkan</option>
                    </select>
                  </div>

                  {/* Pilih Semua / Reset */}
                  <button
                    onClick={handleSelectAllFilteredUnclaimed}
                    className="px-2.5 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    title="Pilih semua yang belum dicairkan pada daftar ini"
                  >
                    <CheckSquare size={13} />
                    <span>Pilih Semua Pending</span>
                  </button>

                  {selectedDistIdsForClaim.size > 0 && (
                    <button
                      onClick={() => setSelectedDistIdsForClaim(new Set())}
                      className="px-2 py-1.5 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                      title="Bersihkan Pilihan"
                    >
                      Batal Pilih
                    </button>
                  )}
                </div>
              </div>

              {/* Tabel Rincian Seluruh Pengiriman */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">Pilih</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">No. Surat Jalan / Inv</th>
                        <th className="p-2.5">Driver / Sopir</th>
                        <th className="p-2.5">Pelanggan &amp; Tujuan</th>
                        <th className="p-2.5 text-center">Volume Dus</th>
                        <th className="p-2.5 text-right">Tarif / Dus</th>
                        <th className="p-2.5 text-right">Total Biaya</th>
                        <th className="p-2.5 text-center">Status Pencairan</th>
                        <th className="p-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredShipments.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400 font-sans italic">
                            Tidak ada data pengiriman armada yang sesuai dengan filter pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredShipments.map(s => {
                          const isSelected = selectedDistIdsForClaim.has(s.idDistribusi);
                          return (
                            <tr
                              key={s.idDistribusi}
                              className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                            >
                              <td className="p-2.5 text-center">
                                {!s.isClaimed ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectDist(s.idDistribusi)}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                                  />
                                ) : (
                                  <Check size={14} className="text-slate-300 mx-auto" />
                                )}
                              </td>
                              <td className="p-2.5 text-slate-600 font-mono whitespace-nowrap">
                                {formatDateDDMMYYYY(s.tanggal)}
                              </td>
                              <td className="p-2.5 font-sans">
                                <div className="font-bold text-blue-700 font-mono">{s.noSuratJalan}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{s.noInvoice}</div>
                              </td>
                              <td className="p-2.5 font-sans font-bold text-slate-900">
                                {s.namaDriver}
                              </td>
                              <td className="p-2.5 font-sans">
                                <div className="font-semibold text-slate-800">{s.pelanggan}</div>
                                <div className="text-[10.5px] text-slate-500">{s.tujuan}</div>
                              </td>
                              <td className="p-2.5 text-center font-bold text-slate-900">
                                {s.totalDus.toLocaleString('id-ID')} Dus
                              </td>
                              <td className="p-2.5 text-right font-sans">
                                {!s.isClaimed ? (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-[11px] text-slate-400">Rp</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={100}
                                      value={s.tarifPerDus}
                                      onChange={e => handleUpdateCustomTarif(s.idDistribusi, Number(e.target.value) || 0)}
                                      className="w-16 px-1 py-0.5 text-right font-mono font-semibold text-xs border border-slate-200 rounded outline-none focus:border-blue-500 bg-slate-50 focus:bg-white"
                                      title="Ketik tarif custom jika berbeda"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-slate-600 font-mono">Rp {s.tarifPerDus.toLocaleString('id-ID')}</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-bold text-slate-900 tabular-nums">
                                Rp {s.totalBiaya.toLocaleString('id-ID')}
                              </td>
                              <td className="p-2.5 text-center font-sans">
                                {s.isClaimed ? (
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
                                {!s.isClaimed ? (
                                  <button
                                    onClick={() => {
                                      setSelectedDistIdsForClaim(new Set([s.idDistribusi]));
                                      setClaimModalDriver(s.namaDriver);
                                      setClaimForm({
                                        Tanggal: new Date().toISOString().slice(0, 10),
                                        Akun_Kas: '111-10',
                                        Keterangan: `Pencairan Biaya Transport Driver: ${s.namaDriver} (SJ: ${s.noSuratJalan})`,
                                        Catat_Ke_Jurnal: true
                                      });
                                      setShowClaimModal(true);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
                                  >
                                    <Coins size={12} />
                                    <span>Cairkan</span>
                                  </button>
                                ) : (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {s.settlementDate ? formatDateDDMMYYYY(s.settlementDate) : 'Lunas'}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                      <tr>
                        <td colSpan={5} className="p-2.5 text-right font-sans">
                          Total ({filteredShipments.length} Pengiriman):
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {filteredShipments.reduce((s, it) => s + it.totalDus, 0).toLocaleString('id-ID')} Dus
                        </td>
                        <td></td>
                        <td className="p-2.5 text-right font-mono tabular-nums text-blue-700">
                          Rp {filteredShipments.reduce((s, it) => s + it.totalBiaya, 0).toLocaleString('id-ID')}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-VIEW 3: RIWAYAT PENCAIRAN BIAYA DISTRIBUSI (VOUCHER)  */}
          {/* ========================================================= */}
          {distCostSubView === 'riwayat_pencairan' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800">Daftar Bukti Pencairan Ongkos Kirim Driver</h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {driverSettlements.length} Dokumen Pencairan
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">No. Dokumen</th>
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">Driver / Penerima</th>
                        <th className="p-2.5 text-center">Pengiriman</th>
                        <th className="p-2.5 text-center">Volume Dus</th>
                        <th className="p-2.5 text-right">Total Dicairkan</th>
                        <th className="p-2.5">Sumber Kas</th>
                        <th className="p-2.5">Keterangan</th>
                        <th className="p-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {driverSettlements.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-400 font-sans italic">
                            Belum ada riwayat pencairan biaya distribusi.
                          </td>
                        </tr>
                      ) : (
                        driverSettlements.map(item => (
                          <tr key={item.ID_Pencairan} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-blue-700">{item.ID_Pencairan}</td>
                            <td className="p-2.5 text-slate-600">{formatDateDDMMYYYY(item.Tanggal)}</td>
                            <td className="p-2.5 font-sans font-bold text-slate-900">{item.Nama_Driver}</td>
                            <td className="p-2.5 text-center font-bold text-slate-700">
                              {item.Jumlah_Pengiriman} SJ
                            </td>
                            <td className="p-2.5 text-center font-bold text-blue-700">
                              {item.Total_Dus.toLocaleString('id-ID')} Dus
                            </td>
                            <td className="p-2.5 text-right font-bold text-emerald-700 tabular-nums">
                              Rp {item.Total_Biaya.toLocaleString('id-ID')}
                            </td>
                            <td className="p-2.5 font-sans text-slate-700 text-[11px]">
                              {item.Nama_Akun_Kas || item.Akun_Kas}
                            </td>
                            <td className="p-2.5 font-sans text-slate-600 max-w-[180px] truncate" title={item.Keterangan}>
                              {item.Keterangan || '-'}
                            </td>
                            <td className="p-2.5 text-center font-sans">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setShowDetailSettlementModal(item)}
                                  className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Lihat & Cetak Voucher Kas Keluar"
                                >
                                  <Printer size={12} />
                                  <span>Voucher</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteSettlement(item.ID_Pencairan)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                  title="Batalkan Pencairan Ini"
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
            </div>
          )}
        </div>

      {/* MODAL PROSES PENCAIRAN BIAYA DISTRIBUSI */}
      {showClaimModal && (() => {
        const selectedItems = allArmadaShipments.filter(s => selectedDistIdsForClaim.has(s.idDistribusi));
        const totalDus = selectedItems.reduce((s, it) => s + it.totalDus, 0);
        const totalBiaya = selectedItems.reduce((s, it) => s + it.totalBiaya, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden my-6">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-emerald-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Form Pencairan Biaya Distribusi Driver
                  </h3>
                </div>
                <button onClick={() => setShowClaimModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
                {/* Banner Info Penerima */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-blue-700 font-semibold block">Driver / Armada Penerima:</span>
                    <span className="text-sm font-bold text-blue-950">{claimModalDriver}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-blue-700 font-semibold block">Total Pengiriman Dipilih:</span>
                    <span className="text-sm font-bold font-mono text-blue-950">
                      {selectedItems.length} Surat Jalan ({totalDus.toLocaleString('id-ID')} Dus)
                    </span>
                  </div>
                </div>

                {/* Tabel Surat Jalan yang Dicairkan */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 text-[11px] flex justify-between">
                    <span>Daftar Pengiriman yang Dicairkan</span>
                    <span className="font-mono text-slate-500">Tarif per dus dapat disesuaikan</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-100/70 text-slate-600 sticky top-0 border-b border-slate-200 font-mono">
                        <tr>
                          <th className="p-2">No. SJ</th>
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Pelanggan / Tujuan</th>
                          <th className="p-2 text-center">Dus</th>
                          <th className="p-2 text-right">Tarif</th>
                          <th className="p-2 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {selectedItems.map(it => (
                          <tr key={it.idDistribusi} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-blue-700">{it.noSuratJalan}</td>
                            <td className="p-2 text-slate-600">{formatDateDDMMYYYY(it.tanggal)}</td>
                            <td className="p-2 font-sans">
                              <div className="font-semibold text-slate-800">{it.pelanggan}</div>
                              <div className="text-[10px] text-slate-400">{it.tujuan}</div>
                            </td>
                            <td className="p-2 text-center font-bold">{it.totalDus}</td>
                            <td className="p-2 text-right font-sans">
                              <input
                                type="number"
                                min={0}
                                step={100}
                                value={it.tarifPerDus}
                                onChange={e => handleUpdateCustomTarif(it.idDistribusi, Number(e.target.value) || 0)}
                                className="w-16 px-1 py-0.5 text-right font-mono font-semibold border border-slate-300 rounded text-xs outline-none bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-2 text-right font-bold tabular-nums">
                              Rp {it.totalBiaya.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="p-2 text-right font-sans">Total Pencairan:</td>
                          <td className="p-2 text-center font-mono">{totalDus.toLocaleString('id-ID')}</td>
                          <td></td>
                          <td className="p-2 text-right font-mono text-emerald-700 text-xs tabular-nums">
                            Rp {totalBiaya.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Form Input Pembayaran */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tanggal Pencairan Kas:</label>
                    <input
                      type="date"
                      value={claimForm.Tanggal}
                      onChange={e => setClaimForm({ ...claimForm, Tanggal: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-xs focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Sumber Rekening / Akun Kas:</label>
                    <select
                      value={claimForm.Akun_Kas}
                      onChange={e => setClaimForm({ ...claimForm, Akun_Kas: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-xs bg-white focus:border-blue-500"
                    >
                      <option value="111-10">111-10 - Kas Kecil (Petty Cash)</option>
                      <option value="111-20">111-20 - Kas Bank BSI 1607134444</option>
                      <option value="111-21">111-21 - Kas Bank BRI Operasional</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Keterangan / Catatan Pengeluaran:</label>
                  <input
                    type="text"
                    value={claimForm.Keterangan}
                    onChange={e => setClaimForm({ ...claimForm, Keterangan: e.target.value })}
                    placeholder="Contoh: Pencairan uang jalan / ongkos kirim armada pabrik..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none text-xs focus:border-blue-500"
                  />
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="catatJurnal"
                    checked={claimForm.Catat_Ke_Jurnal}
                    onChange={e => setClaimForm({ ...claimForm, Catat_Ke_Jurnal: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="catatJurnal" className="text-xs text-emerald-900 font-semibold cursor-pointer">
                    Otomatis catat pengeluaran kas ke Draf Jurnal Akuntansi (Beban Transportasi 611-30)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-700">
                  Total Keluar Kas: <span className="text-base text-emerald-700 font-mono font-extrabold ml-1">Rp {totalBiaya.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettlement}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    <span>Konfirmasi &amp; Cairkan Kas</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL VOUCHER / BUKTI PENGELUARAN KAS DRIVER (PRINTABLE) */}
      {showDetailSettlementModal && (() => {
        const item = showDetailSettlementModal;
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

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto printable-modal-overlay">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden my-6 printable-modal-card">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white no-print">
                <div className="flex items-center gap-2">
                  <Printer size={18} className="text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Voucher Pengeluaran Kas - Biaya Distribusi Driver
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintVoucher(item)}
                    className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    title="Cetak Voucher Kas Keluar format A4 Resmi"
                  >
                    <Printer size={13} />
                    <span>Cetak Voucher</span>
                  </button>
                  <button onClick={() => setShowDetailSettlementModal(null)} className="text-slate-400 hover:text-white cursor-pointer ml-1">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* TAMPILAN RESMI VOUCHER KAS KELUAR */}
              <div className="p-6 space-y-4 text-xs font-sans bg-white printable-voucher printable-content">
                {/* Header Kop Perusahaan */}
                <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">PT. ANUGERAH ILLAHI RABBI</h2>
                    <p className="text-[11px] text-slate-600">Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa &amp; Airis</p>
                    <p className="text-[10px] text-slate-500">Klaten, Jawa Tengah • Telp: (0272) 321xxx</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded uppercase inline-block">
                      BUKTI KAS KELUAR
                    </span>
                    <div className="font-mono text-xs font-bold text-slate-800 mt-1">{item.ID_Pencairan}</div>
                    <div className="text-[10px] text-slate-500">Tgl: {formatDateDDMMYYYY(item.Tanggal)}</div>
                  </div>
                </div>

                {/* Info Penerima & Sumber Dana */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Dibayarkan Kepada (Driver):</span>
                    <span className="font-bold text-sm text-slate-900">{item.Nama_Driver}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Dibayarkan Melalui Akun:</span>
                    <span className="font-bold text-sm text-slate-900">{item.Nama_Akun_Kas || item.Akun_Kas}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 text-[11px]">
                    <span className="text-slate-500">Untuk Keperluan: </span>
                    <span className="font-semibold text-slate-800">{item.Keterangan || 'Biaya distribusi pengiriman produk'}</span>
                  </div>
                </div>

                {/* Tabel Rincian Pengiriman */}
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                      <tr>
                        <th className="p-2 text-center w-8">No</th>
                        <th className="p-2">No. Surat Jalan</th>
                        <th className="p-2">Tanggal</th>
                        <th className="p-2">Pelanggan / Tujuan</th>
                        <th className="p-2 text-center">Volume Dus</th>
                        <th className="p-2 text-right">Tarif (Rp)</th>
                        <th className="p-2 text-right">Jumlah (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {details.length > 0 ? (
                        details.map((d: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2 text-center text-slate-500">{i + 1}</td>
                            <td className="p-2 font-bold text-slate-900">{d.No_Surat_Jalan || '-'}</td>
                            <td className="p-2 text-slate-600">{formatDateDDMMYYYY(d.Tanggal)}</td>
                            <td className="p-2 font-sans">{d.Pelanggan || '-'}{d.Tujuan ? ` (${d.Tujuan})` : ''}</td>
                            <td className="p-2 text-center font-bold">{Number(d.Dus || 0).toLocaleString('id-ID')}</td>
                            <td className="p-2 text-right">{Number(d.Tarif || 0).toLocaleString('id-ID')}</td>
                            <td className="p-2 text-right font-bold tabular-nums">
                              {Number(d.Biaya || 0).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-3 text-center text-slate-400 font-sans italic">
                            {item.Jumlah_Pengiriman} Pengiriman ({item.Total_Dus} Dus)
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                      <tr>
                        <td colSpan={4} className="p-2 text-right font-sans uppercase">Total Dibayarkan:</td>
                        <td className="p-2 text-center font-mono">{Number(item.Total_Dus || 0).toLocaleString('id-ID')} Dus</td>
                        <td></td>
                        <td className="p-2 text-right font-mono text-sm tabular-nums">
                          Rp {Number(item.Total_Biaya || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Kolom Tanda Tangan */}
                <div className="grid grid-cols-3 gap-4 pt-6 text-center text-[11px]">
                  <div className="space-y-12">
                    <span className="text-slate-600 block">Diterima Oleh (Driver):</span>
                    <div className="border-b border-slate-400 w-32 mx-auto font-bold text-slate-900">{item.Nama_Driver}</div>
                  </div>
                  <div className="space-y-12">
                    <span className="text-slate-600 block">Kasir / Keuangan:</span>
                    <div className="border-b border-slate-400 w-32 mx-auto font-bold text-slate-900">Admin Finance</div>
                  </div>
                  <div className="space-y-12">
                    <span className="text-slate-600 block">Menyetujui (Manager):</span>
                    <div className="border-b border-slate-400 w-32 mx-auto font-bold text-slate-900">Marko Dwi N.</div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 no-print">
                <button
                  onClick={() => setShowDetailSettlementModal(null)}
                  className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => handlePrintVoucher(item)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer size={14} />
                  <span>Cetak Dokumen</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};