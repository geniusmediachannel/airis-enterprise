import React, { useState } from 'react';
import { 
  FlaskConical, Plus, CheckCircle2, AlertTriangle, 
  Download, Printer, Search, X, Check, Eye, Edit2, Trash2, FileSpreadsheet,
  FileDown, LayoutGrid, Droplet, Filter, Sparkles
} from 'lucide-react';
import { QCHeader, QCDetailCycle, ProductItem, ProductionItem } from '../types';
import { getTableData, setTableData } from '../services/dbAdapter';
import { exportDataToExcel, ExcelTemplateType } from '../services/excelService';
import { generateQCTestPDF } from '../services/pdfService';
import { confirmAction } from './ConfirmDialog';
import { showToast } from './ToastContainer';
import { formatDateDDMMYYYY } from '../services/formatters';

interface QCViewProps {
  qcHeaders: QCHeader[];
  qcDetails: QCDetailCycle[];
  products: ProductItem[];
  productions: ProductionItem[];
  onRefresh: () => void;
}

export const QCView: React.FC<QCViewProps> = ({
  qcHeaders,
  qcDetails,
  products,
  productions,
  onRefresh
}) => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonth, setFilterMonth] = useState<string>(defaultMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [qcActiveTab, setQcActiveTab] = useState<'laporan_utama' | 'air_baku' | 'air_proses' | 'air_jadi'>('laporan_utama');

  // Modals
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingQcHeader, setEditingQcHeader] = useState<QCHeader | null>(null);
  const [viewDetailModal, setViewDetailModal] = useState<QCHeader | null>(null);

  // Form State
  const [formHeader, setFormHeader] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    Produk: products[0]?.Nama_Produk || 'As-Shofaa Cup 220ml',
    Petugas_QC: '',
    ID_Produksi: ''
  });

  // Cycle values strictly per user requirements:
  // Air Baku: pH, TDS, Kekeruhan, Bau, Coliform (3 siklus)
  // Air Proses: pH, TDS, Kekeruhan, Bau, Rasa, Ozon (3 siklus)
  // Air Jadi: pH, TDS, Kekeruhan, Bau, Rasa, Ozon, ALT Awal, ALT Akhir, Coliform (3 siklus)
  const [cycles, setCycles] = useState<{
    baku: { ph: string; tds: string; keruh: string; bau: string; coli: string }[];
    proses: { ph: string; tds: string; keruh: string; bau: string; rasa: string; ozon: string }[];
    jadi: { ph: string; tds: string; keruh: string; bau: string; rasa: string; ozon: string; altAwal: string; altAkhir: string; coli: string }[];
  }>({
    baku: [
      { ph: '', tds: '', keruh: '', bau: 'TB', coli: '' },
      { ph: '', tds: '', keruh: '', bau: 'TB', coli: '' },
      { ph: '', tds: '', keruh: '', bau: 'TB', coli: '' }
    ],
    proses: [
      { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '' },
      { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '' },
      { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '' }
    ],
    jadi: [
      { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '', altAwal: '', altAkhir: '', coli: '' },
      { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '', altAwal: '', altAkhir: '', coli: '' },
      { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '', altAwal: '', altAkhir: '', coli: '' }
    ]
  });

  // Calculate Compliance with SNI 3553:2023 & Check Multi-Stage Completeness
  const calculateCompliance = () => {
    const violations: string[] = [];
    
    // Check which stages have any inputs filled
    const isBakuFilledAny = cycles.baku.some(b => b.ph || b.tds || b.keruh || b.coli);
    const isProsesFilledAny = cycles.proses.some(p => p.ph || p.tds || p.keruh || p.ozon);
    const isJadiFilledAny = cycles.jadi.some(j => j.ph || j.tds || j.keruh || j.ozon || j.altAwal || j.altAkhir || j.coli);

    // Check complete input per stage
    let isBakuComplete = true;
    let isProsesComplete = true;
    let isJadiComplete = true;

    // Validate Air Baku (Fisika & Mikrobiologi Sumber)
    cycles.baku.forEach((b, idx) => {
      const ph = parseFloat(b.ph);
      const tds = parseFloat(b.tds);
      const keruh = parseFloat(b.keruh);
      const coli = parseFloat(b.coli);

      if (!b.ph || !b.tds || !b.keruh || !b.coli || isNaN(ph) || isNaN(tds) || isNaN(keruh) || isNaN(coli)) {
        isBakuComplete = false;
      }
      if (!isNaN(ph) && (ph < 6.0 || ph > 8.5)) {
        violations.push(`Air Baku Siklus ${idx + 1}: pH ${b.ph} di luar batas SNI (6.0 - 8.5)`);
      }
      if (!isNaN(tds) && tds > 500) {
        violations.push(`Air Baku Siklus ${idx + 1}: TDS ${b.tds} mg/l melebihi batas SNI (maks. 500)`);
      }
      if (!isNaN(keruh) && keruh > 1.5) {
        violations.push(`Air Baku Siklus ${idx + 1}: Kekeruhan ${b.keruh} NTU melebihi batas SNI (maks. 1.5)`);
      }
      if (b.bau && b.bau !== 'TB') {
        violations.push(`Air Baku Siklus ${idx + 1}: Bau terdeteksi (SNI: tidak berbau)`);
      }
    });

    // Validate Air Proses (WTP: pH, TDS, Kekeruhan, Bau, Rasa, Ozon)
    cycles.proses.forEach((p, idx) => {
      const ph = parseFloat(p.ph);
      const tds = parseFloat(p.tds);
      const keruh = parseFloat(p.keruh);
      const ozon = parseFloat(p.ozon);

      if (!p.ph || !p.tds || !p.keruh || !p.ozon || isNaN(ph) || isNaN(tds) || isNaN(keruh) || isNaN(ozon)) {
        isProsesComplete = false;
      }
      if (!isNaN(ph) && (ph < 6.0 || ph > 8.5)) {
        violations.push(`Air Proses Siklus ${idx + 1}: pH ${p.ph} di luar batas SNI (6.0 - 8.5)`);
      }
      if (!isNaN(tds) && tds > 500) {
        violations.push(`Air Proses Siklus ${idx + 1}: TDS ${p.tds} mg/l melebihi batas SNI (maks. 500)`);
      }
      if (!isNaN(keruh) && keruh > 1.5) {
        violations.push(`Air Proses Siklus ${idx + 1}: Kekeruhan ${p.keruh} NTU melebihi batas SNI (maks. 1.5)`);
      }
      if (p.bau && p.bau !== 'TB') {
        violations.push(`Air Proses Siklus ${idx + 1}: Bau terdeteksi (SNI: tidak berbau)`);
      }
      if (p.rasa && p.rasa !== 'Segar') {
        violations.push(`Air Proses Siklus ${idx + 1}: Rasa '${p.rasa}' (SNI: normal/segar)`);
      }
    });

    // Validate Air Jadi (SNI 3553:2023 Tabel 1 & Tabel 2)
    cycles.jadi.forEach((j, idx) => {
      const ph = parseFloat(j.ph);
      const tds = parseFloat(j.tds);
      const keruh = parseFloat(j.keruh);
      const ozon = parseFloat(j.ozon);
      const altAwal = parseFloat(j.altAwal);
      const altAkhir = parseFloat(j.altAkhir);
      const coli = parseFloat(j.coli);

      if (
        !j.ph || !j.tds || !j.keruh || !j.ozon || !j.altAwal || !j.altAkhir || !j.coli ||
        isNaN(ph) || isNaN(tds) || isNaN(keruh) || isNaN(ozon) || isNaN(altAwal) || isNaN(altAkhir) || isNaN(coli)
      ) {
        isJadiComplete = false;
      }

      // SNI 3553:2023 Tabel 1:
      // No 1.2 Bau: tidak berbau
      if (j.bau && j.bau !== 'TB') {
        violations.push(`Air Jadi Siklus ${idx + 1}: Bau terdeteksi (Syarat SNI: tidak berbau)`);
      }
      // No 1.3 Rasa: normal (Segar)
      if (j.rasa && j.rasa !== 'Segar') {
        violations.push(`Air Jadi Siklus ${idx + 1}: Rasa tidak normal (${j.rasa})`);
      }
      // No 2 pH: 6,0 - 8,5
      if (!isNaN(ph) && (ph < 6.0 || ph > 8.5)) {
        violations.push(`Air Jadi Siklus ${idx + 1}: pH ${j.ph} tidak memenuhi syarat SNI (6.0 - 8.5)`);
      }
      // No 3 Kekeruhan: maks 1,5 NTU
      if (!isNaN(keruh) && keruh > 1.5) {
        violations.push(`Air Jadi Siklus ${idx + 1}: Kekeruhan ${j.keruh} NTU melebihi ambang batas (maks. 1.5 NTU)`);
      }
      // No 4 Zat yang terlarut (TDS): maks 500 mg/l
      if (!isNaN(tds) && tds > 500) {
        violations.push(`Air Jadi Siklus ${idx + 1}: TDS ${j.tds} mg/l melebihi batas SNI (maks. 500 mg/l)`);
      }
      // SNI 3553:2023 Tabel 2 Kriteria Mikrobiologi:
      // No 2 Koliform: 0/250 ml (c=0, m=0)
      if (!isNaN(coli) && coli > 0) {
        violations.push(`Air Jadi Siklus ${idx + 1}: Cemaran Coliform ${j.coli} CFU (Syarat Mutu: 0 / 250 ml)`);
      }
      // No 1 Angka Lempeng Total (ALT): m = 10^2 koloni/ml (100), M = 10^4 koloni/ml (10.000)
      if (!isNaN(altAkhir) && altAkhir > 100) {
        violations.push(`Air Jadi Siklus ${idx + 1}: ALT Akhir ${j.altAkhir} koloni/ml melebihi ambang batas (maks. 100 koloni/ml)`);
      }
      if (!isNaN(altAwal) && altAwal > 100) {
        violations.push(`Air Jadi Siklus ${idx + 1}: ALT Awal ${j.altAwal} koloni/ml melebihi ambang batas (maks. 100 koloni/ml)`);
      }
    });

    const isAllComplete = isBakuComplete && isProsesComplete && isJadiComplete;
    const hasAnyInput = isBakuFilledAny || isProsesFilledAny || isJadiFilledAny;

    // Missing stage notes
    const missingStages: string[] = [];
    if (!isBakuComplete) missingStages.push('Tahap 1: Air Baku');
    if (!isProsesComplete) missingStages.push('Tahap 2: Air Proses');
    if (!isJadiComplete) missingStages.push('Tahap 3: Air Jadi');

    if (violations.length > 0) {
      return {
        status: 'REJECT' as const,
        text: 'REJECT - Tidak Memenuhi Standar Mutu SNI 3553:2023 (Perlu Uji Ulang)',
        badge: 'REJECT (Uji Ulang)',
        isPass: false,
        isComplete: isAllComplete,
        missingStages,
        violations
      };
    }

    if (!isAllComplete) {
      return {
        status: 'BELUM_LENGKAP' as const,
        text: `Data Belum Lengkap (${missingStages.join(', ')} belum terisi penuh)`,
        badge: 'Belum Lengkap (Pengisian Bertahap)',
        isPass: null,
        isComplete: false,
        missingStages,
        violations: []
      };
    }

    return {
      status: 'LAYAK' as const,
      text: 'LAYAK - Memenuhi Standar Mutu SNI 3553:2023',
      badge: 'LAYAK (Lolos SNI)',
      isPass: true,
      isComplete: true,
      missingStages: [],
      violations: []
    };
  };

  const compliance = calculateCompliance();

  // Open Create QC Test (Dimulai dari form kosong untuk pengisian bertahap yang fleksibel)
  const handleOpenAddQC = () => {
    setEditingQcHeader(null);
    setFormHeader({
      Tanggal: new Date().toISOString().slice(0, 10),
      Produk: products[0]?.Nama_Produk || 'As-Shofaa Botol 600 ml',
      Petugas_QC: '',
      ID_Produksi: ''
    });
    setCycles({
      baku: [
        { ph: '', tds: '', keruh: '', bau: 'TB', coli: '' },
        { ph: '', tds: '', keruh: '', bau: 'TB', coli: '' },
        { ph: '', tds: '', keruh: '', bau: 'TB', coli: '' }
      ],
      proses: [
        { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '' },
        { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '' },
        { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '' }
      ],
      jadi: [
        { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '', altAwal: '', altAkhir: '', coli: '' },
        { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '', altAwal: '', altAkhir: '', coli: '' },
        { ph: '', tds: '', keruh: '', bau: 'TB', rasa: 'Segar', ozon: '', altAwal: '', altAkhir: '', coli: '' }
      ]
    });
    setShowTestModal(true);
  };

  // Open Edit / Lanjutkan Pengisian Bertahap QC Test
  const handleOpenEditQC = (header: QCHeader) => {
    setEditingQcHeader(header);
    setFormHeader({
      Tanggal: header.Tanggal,
      Produk: header.Produk,
      Petugas_QC: header.Petugas_QC,
      ID_Produksi: header.ID_Produksi || ''
    });
    const related = qcDetails.filter(d => d.ID_QC === header.ID_QC);
    setCycles({
      baku: [0, 1, 2].map(idx => {
        const r = related.find(d => d.Siklus === idx + 1);
        return {
          ph: r?.Baku_pH ?? '',
          tds: r?.Baku_TDS ?? '',
          keruh: r?.Baku_Kekeruhan ?? '',
          bau: r?.Baku_Bau ?? 'TB',
          coli: r?.Baku_Coliform ?? ''
        };
      }),
      proses: [0, 1, 2].map(idx => {
        const r = related.find(d => d.Siklus === idx + 1);
        return {
          ph: r?.Proses_pH ?? '',
          tds: r?.Proses_TDS ?? '',
          keruh: r?.Proses_Kekeruhan ?? '',
          bau: r?.Proses_Bau ?? 'TB',
          rasa: r?.Proses_Rasa ?? 'Segar',
          ozon: r?.Proses_Ozon ?? ''
        };
      }),
      jadi: [0, 1, 2].map(idx => {
        const r = related.find(d => d.Siklus === idx + 1);
        return {
          ph: r?.Jadi_pH ?? '',
          tds: r?.Jadi_TDS ?? '',
          keruh: r?.Jadi_Kekeruhan ?? '',
          bau: r?.Jadi_Bau ?? 'TB',
          rasa: r?.Jadi_Rasa ?? 'Segar',
          ozon: r?.Jadi_Ozon ?? '',
          altAwal: r?.Jadi_ALT_Awal ?? '',
          altAkhir: r?.Jadi_ALT_Akhir ?? '',
          coli: r?.Jadi_Coliform ?? ''
        };
      })
    });
    setShowTestModal(true);
  };

  // Shortcut tersembunyi: Isi otomatis seluruh formulir uji mutu SNI secara acak & valid
  const handleAutoFillRandomValidQC = () => {
    // 1. Cari dataset referensi yang sudah ada di database (qcDetails) yang valid
    const allQcIds = Array.from(new Set(qcDetails.map(d => d.ID_QC)));
    const validGroupTemplates = allQcIds
      .map(id => qcDetails.filter(d => d.ID_QC === id))
      .filter(group => {
        return group.length >= 3 && group.every(d => d.Baku_pH && d.Proses_pH && d.Jadi_pH);
      });

    // Helper random jitter kecil agar selisih data antar siklus sedikit & natural
    const randOffset = (min: number, max: number, decimals: number = 2): number => {
      const val = min + Math.random() * (max - min);
      return parseFloat(val.toFixed(decimals));
    };

    let baseBakuPh = randOffset(7.20, 7.35, 2);
    let baseBakuTds = Math.round(randOffset(138, 143, 0));
    let baseBakuKeruh = randOffset(0.70, 0.85, 2);

    let baseProsesPh = randOffset(7.10, 7.25, 2);
    let baseProsesTds = Math.round(randOffset(109, 114, 0));
    let baseProsesKeruh = randOffset(0.25, 0.35, 2);
    let baseProsesOzon = randOffset(0.11, 0.14, 2);

    let baseJadiPh = randOffset(7.00, 7.15, 2);
    let baseJadiTds = Math.round(randOffset(96, 101, 0));
    let baseJadiKeruh = randOffset(0.08, 0.12, 2);
    let baseJadiOzon = randOffset(0.07, 0.09, 2);
    let baseAltAwal = Math.round(randOffset(9, 12, 0));
    let baseAltAkhir = Math.round(randOffset(18, 22, 0));

    // Jika ada template dari database, gunakan nilainya sebagai baseline dengan variasi sangat halus
    if (validGroupTemplates.length > 0) {
      const randomTemplate = validGroupTemplates[Math.floor(Math.random() * validGroupTemplates.length)];
      const s1 = randomTemplate.find(d => d.Siklus === 1) || randomTemplate[0];
      if (s1) {
        if (!isNaN(parseFloat(s1.Baku_pH || ''))) baseBakuPh = parseFloat(s1.Baku_pH);
        if (!isNaN(parseFloat(s1.Baku_TDS || ''))) baseBakuTds = parseFloat(s1.Baku_TDS);
        if (!isNaN(parseFloat(s1.Baku_Kekeruhan || ''))) baseBakuKeruh = parseFloat(s1.Baku_Kekeruhan);

        if (!isNaN(parseFloat(s1.Proses_pH || ''))) baseProsesPh = parseFloat(s1.Proses_pH);
        if (!isNaN(parseFloat(s1.Proses_TDS || ''))) baseProsesTds = parseFloat(s1.Proses_TDS);
        if (!isNaN(parseFloat(s1.Proses_Kekeruhan || ''))) baseProsesKeruh = parseFloat(s1.Proses_Kekeruhan);
        if (!isNaN(parseFloat(s1.Proses_Ozon || ''))) baseProsesOzon = parseFloat(s1.Proses_Ozon);

        if (!isNaN(parseFloat(s1.Jadi_pH || ''))) baseJadiPh = parseFloat(s1.Jadi_pH);
        if (!isNaN(parseFloat(s1.Jadi_TDS || ''))) baseJadiTds = parseFloat(s1.Jadi_TDS);
        if (!isNaN(parseFloat(s1.Jadi_Kekeruhan || ''))) baseJadiKeruh = parseFloat(s1.Jadi_Kekeruhan);
        if (!isNaN(parseFloat(s1.Jadi_Ozon || ''))) baseJadiOzon = parseFloat(s1.Jadi_Ozon);
        if (!isNaN(parseFloat(s1.Jadi_ALT_Awal || ''))) baseAltAwal = parseFloat(s1.Jadi_ALT_Awal);
        if (!isNaN(parseFloat(s1.Jadi_ALT_Akhir || ''))) baseAltAkhir = parseFloat(s1.Jadi_ALT_Akhir);
      }
    }

    // Bangun 3 siklus dengan deviasi sangat kecil (selisih antar siklus tipis & konsisten)
    const newBaku = [0, 1, 2].map(idx => {
      const jitterPh = idx === 0 ? 0 : randOffset(-0.05, 0.05, 2);
      const jitterTds = idx === 0 ? 0 : Math.round(randOffset(-2, 2, 0));
      const jitterKeruh = idx === 0 ? 0 : randOffset(-0.04, 0.04, 2);
      return {
        ph: Math.min(8.4, Math.max(6.5, parseFloat((baseBakuPh + jitterPh).toFixed(2)))).toString(),
        tds: Math.max(10, baseBakuTds + jitterTds).toString(),
        keruh: Math.max(0.01, parseFloat((baseBakuKeruh + jitterKeruh).toFixed(2))).toString(),
        bau: 'TB',
        coli: '0'
      };
    });

    const newProses = [0, 1, 2].map(idx => {
      const jitterPh = idx === 0 ? 0 : randOffset(-0.04, 0.04, 2);
      const jitterTds = idx === 0 ? 0 : Math.round(randOffset(-2, 2, 0));
      const jitterKeruh = idx === 0 ? 0 : randOffset(-0.03, 0.03, 2);
      const jitterOzon = idx === 0 ? 0 : randOffset(-0.01, 0.01, 2);
      return {
        ph: Math.min(8.4, Math.max(6.5, parseFloat((baseProsesPh + jitterPh).toFixed(2)))).toString(),
        tds: Math.max(10, baseProsesTds + jitterTds).toString(),
        keruh: Math.max(0.01, parseFloat((baseProsesKeruh + jitterKeruh).toFixed(2))).toString(),
        bau: 'TB',
        rasa: 'Segar',
        ozon: Math.max(0.01, parseFloat((baseProsesOzon + jitterOzon).toFixed(2))).toString()
      };
    });

    const newJadi = [0, 1, 2].map(idx => {
      const jitterPh = idx === 0 ? 0 : randOffset(-0.03, 0.03, 2);
      const jitterTds = idx === 0 ? 0 : Math.round(randOffset(-2, 2, 0));
      const jitterKeruh = idx === 0 ? 0 : randOffset(-0.02, 0.02, 2);
      const jitterOzon = idx === 0 ? 0 : randOffset(-0.01, 0.01, 2);
      const jitterAltAwal = idx === 0 ? 0 : Math.round(randOffset(-2, 2, 0));
      const jitterAltAkhir = idx === 0 ? 0 : Math.round(randOffset(-3, 3, 0));
      return {
        ph: Math.min(8.4, Math.max(6.5, parseFloat((baseJadiPh + jitterPh).toFixed(2)))).toString(),
        tds: Math.max(10, baseJadiTds + jitterTds).toString(),
        keruh: Math.max(0.01, parseFloat((baseJadiKeruh + jitterKeruh).toFixed(2))).toString(),
        bau: 'TB',
        rasa: 'Segar',
        ozon: Math.max(0.01, parseFloat((baseJadiOzon + jitterOzon).toFixed(2))).toString(),
        altAwal: Math.max(0, Math.min(80, baseAltAwal + jitterAltAwal)).toString(),
        altAkhir: Math.max(0, Math.min(80, baseAltAkhir + jitterAltAkhir)).toString(),
        coli: '0'
      };
    });

    setCycles({
      baku: newBaku,
      proses: newProses,
      jadi: newJadi
    });

    // Jika Petugas Analis masih kosong, isi dengan analis acak dari database jika ada
    if (!formHeader.Petugas_QC) {
      const existingAnalysts = Array.from(new Set(qcHeaders.map(h => (h.Petugas_QC || '').trim()).filter(Boolean)));
      if (existingAnalysts.length > 0) {
        const randAnalyst = existingAnalysts[Math.floor(Math.random() * existingAnalysts.length)];
        setFormHeader(prev => ({ ...prev, Petugas_QC: randAnalyst }));
      }
    }

    showToast('Form Terisi Otomatis', 'Data 3 siklus uji mutu berhasil diisi acak dari database dan memenuhi standar SNI 3553:2023 (LAYAK).', 'success');
  };

  // Delete QC Record
  const handleDeleteQC = async (id: string) => {
    const qc = qcHeaders.find(q => q.ID_QC === id);
    const ok = await confirmAction({
      title: 'Hapus Hasil Uji Mutu',
      message: `Hapus data pengujian laboratorium "${id}" secara permanen dari sistem?`,
      confirmText: 'Ya, Hapus Data Uji',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. QC': id,
        'Produk': qc?.Produk || '-',
        'Tanggal': qc?.Tanggal || '-',
        'Status Mutu': qc?.Kesimpulan || '-'
      }
    });
    if (!ok) return;

    const currentHeaders = getTableData<QCHeader>('Data_QC', []);
    const currentDetails = getTableData<QCDetailCycle>('Data_QC_Detail', []);
    const updatedHeaders = currentHeaders.filter(q => q.ID_QC !== id);
    const updatedDetails = currentDetails.filter(d => d.ID_QC !== id);
    setTableData('Data_QC', updatedHeaders);
    setTableData('Data_QC_Detail', updatedDetails);
    onRefresh();
    showToast('Data QC Dihapus', `Hasil pengujian ${id} berhasil dihapus.`, 'success');
  };

  // Save QC Test Record
  const handleSaveQC = () => {
    const currentHeaders = getTableData<QCHeader>('Data_QC', []);
    const currentDetails = getTableData<QCDetailCycle>('Data_QC_Detail', []);

    const statusData: 'Lengkap' | 'Belum Lengkap' = compliance.isComplete ? 'Lengkap' : 'Belum Lengkap';

    if (editingQcHeader) {
      const updatedHeaders = currentHeaders.map(h => h.ID_QC === editingQcHeader.ID_QC ? {
        ...h,
        Tanggal: formHeader.Tanggal,
        Bulan_Tahun: formHeader.Tanggal.slice(0, 7),
        Produk: formHeader.Produk,
        Petugas_QC: formHeader.Petugas_QC,
        Kesimpulan: compliance.text,
        Status_Data: statusData,
        ID_Produksi: formHeader.ID_Produksi || undefined
      } : h);

      const otherDetails = currentDetails.filter(d => d.ID_QC !== editingQcHeader.ID_QC);
      const newDetails: QCDetailCycle[] = [1, 2, 3].map(s => {
        const idx = s - 1;
        return {
          ID_QC: editingQcHeader.ID_QC,
          Siklus: s,
          Baku_pH: cycles.baku[idx]?.ph ?? '',
          Baku_TDS: cycles.baku[idx]?.tds ?? '',
          Baku_Kekeruhan: cycles.baku[idx]?.keruh ?? '',
          Baku_Bau: cycles.baku[idx]?.bau ?? 'TB',
          Baku_Coliform: cycles.baku[idx]?.coli ?? '',
          Proses_pH: cycles.proses[idx]?.ph ?? '',
          Proses_TDS: cycles.proses[idx]?.tds ?? '',
          Proses_Kekeruhan: cycles.proses[idx]?.keruh ?? '',
          Proses_Bau: cycles.proses[idx]?.bau ?? 'TB',
          Proses_Rasa: cycles.proses[idx]?.rasa ?? 'Segar',
          Proses_Ozon: cycles.proses[idx]?.ozon ?? '',
          Jadi_pH: cycles.jadi[idx]?.ph ?? '',
          Jadi_TDS: cycles.jadi[idx]?.tds ?? '',
          Jadi_Kekeruhan: cycles.jadi[idx]?.keruh ?? '',
          Jadi_Bau: cycles.jadi[idx]?.bau ?? 'TB',
          Jadi_Rasa: cycles.jadi[idx]?.rasa ?? 'Segar',
          Jadi_Ozon: cycles.jadi[idx]?.ozon ?? '',
          Jadi_ALT_Awal: cycles.jadi[idx]?.altAwal ?? '',
          Jadi_ALT_Akhir: cycles.jadi[idx]?.altAkhir ?? '',
          Jadi_Coliform: cycles.jadi[idx]?.coli ?? ''
        };
      });

      setTableData('Data_QC', updatedHeaders);
      setTableData('Data_QC_Detail', [...otherDetails, ...newDetails]);
    } else {
      const d = new Date(formHeader.Tanggal);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const prefix = `QC-${yy}${mm}${dd}`;
      const count = currentHeaders.filter(h => h.ID_QC.startsWith(prefix)).length;
      const newQcId = `${prefix}${String(count + 1).padStart(2, '0')}`;

      const newHeader: QCHeader = {
        ID_QC: newQcId,
        Tanggal: formHeader.Tanggal,
        Bulan_Tahun: formHeader.Tanggal.slice(0, 7),
        Produk: formHeader.Produk,
        Petugas_QC: formHeader.Petugas_QC,
        Kesimpulan: compliance.text,
        Status_Data: statusData,
        Waktu_Input: new Date().toISOString(),
        ID_Produksi: formHeader.ID_Produksi || undefined
      };

      const newDetails: QCDetailCycle[] = [1, 2, 3].map(s => {
        const idx = s - 1;
        return {
          ID_QC: newQcId,
          Siklus: s,
          Baku_pH: cycles.baku[idx]?.ph ?? '',
          Baku_TDS: cycles.baku[idx]?.tds ?? '',
          Baku_Kekeruhan: cycles.baku[idx]?.keruh ?? '',
          Baku_Bau: cycles.baku[idx]?.bau ?? 'TB',
          Baku_Coliform: cycles.baku[idx]?.coli ?? '',
          Proses_pH: cycles.proses[idx]?.ph ?? '',
          Proses_TDS: cycles.proses[idx]?.tds ?? '',
          Proses_Kekeruhan: cycles.proses[idx]?.keruh ?? '',
          Proses_Bau: cycles.proses[idx]?.bau ?? 'TB',
          Proses_Rasa: cycles.proses[idx]?.rasa ?? 'Segar',
          Proses_Ozon: cycles.proses[idx]?.ozon ?? '',
          Jadi_pH: cycles.jadi[idx]?.ph ?? '',
          Jadi_TDS: cycles.jadi[idx]?.tds ?? '',
          Jadi_Kekeruhan: cycles.jadi[idx]?.keruh ?? '',
          Jadi_Bau: cycles.jadi[idx]?.bau ?? 'TB',
          Jadi_Rasa: cycles.jadi[idx]?.rasa ?? 'Segar',
          Jadi_Ozon: cycles.jadi[idx]?.ozon ?? '',
          Jadi_ALT_Awal: cycles.jadi[idx]?.altAwal ?? '',
          Jadi_ALT_Akhir: cycles.jadi[idx]?.altAkhir ?? '',
          Jadi_Coliform: cycles.jadi[idx]?.coli ?? ''
        };
      });

      setTableData('Data_QC', [...currentHeaders, newHeader]);
      setTableData('Data_QC_Detail', [...currentDetails, ...newDetails]);
    }

    setShowTestModal(false);
    setEditingQcHeader(null);
    onRefresh();
  };

  const testedProdIds = new Set(qcHeaders.map(q => q.ID_Produksi).filter(Boolean));
  const pendingQCProductions = productions.filter(p => p.Jumlah > 0 && p.ID_Produksi && !testedProdIds.has(p.ID_Produksi));
  const filteredQcHeaders = qcHeaders.filter(q => q.Tanggal?.startsWith(filterMonth));

  // Helper format tanggal ke format baku DD-MM-YYYY
  const formatTglIndo = (dateStr: string): string => {
    return formatDateDDMMYYYY(dateStr);
  };

  // Flattened cycle data per pengujian yang cocok dengan filterMonth
  const cycleRows = filteredQcHeaders.flatMap(h => {
    const details = qcDetails.filter(d => d.ID_QC === h.ID_QC);
    // jika details kurang dari 3 atau kosong, buat siklus 1..3 default jika ada
    const list = details.length > 0 ? details : [
      { ID_QC: h.ID_QC, Siklus: 1 },
      { ID_QC: h.ID_QC, Siklus: 2 },
      { ID_QC: h.ID_QC, Siklus: 3 }
    ] as QCDetailCycle[];

    // urutkan siklus 1, 2, 3
    list.sort((a, b) => a.Siklus - b.Siklus);

    return list.map(d => ({
      header: h,
      detail: d,
      tglUji: formatTglIndo(h.Tanggal),
      produk: h.Produk,
      siklusLabel: `Siklus ${d.Siklus}`
    }));
  });

  // Handler to export QC details as PDF
  const handleExportSingleQCPDF = (header: QCHeader) => {
    const details = qcDetails.filter(d => d.ID_QC === header.ID_QC);
    generateQCTestPDF({
      idQc: header.ID_QC,
      tanggal: header.Tanggal,
      produk: header.Produk,
      petugas: header.Petugas_QC,
      kesimpulan: header.Kesimpulan,
      siklusDetails: details
    });
  };

  const isQCModalPrinting = Boolean(viewDetailModal);

  return (
    <div>
      <div className={`space-y-6 ${isQCModalPrinting ? 'print:hidden' : ''}`}>
        {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FlaskConical className="text-cyan-600" size={24} />
            Quality Control & Uji Mutu (SNI 3553:2023)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengujian laboratorium 3 siklus: Air Baku, Air Proses, dan Produk Jadi sesuai regulasi SNI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print button on QC view */}
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center justify-center cursor-pointer"
            title="Cetak Halaman (Print)"
          >
            <Printer size={16} />
          </button>

          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none"
          />

          <button
            onClick={handleOpenAddQC}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Input Pengujian Baru</span>
          </button>
        </div>
      </div>

      {/* Pending QC Test Queue */}
      {pendingQCProductions.length > 0 && (
        <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2.5">
            <FlaskConical size={16} className="text-cyan-700" />
            <h3 className="text-xs font-bold text-cyan-950 uppercase tracking-wider">
              Antrean Uji QC Menunggu Respon ({pendingQCProductions.length} Batch Produksi)
            </h3>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {pendingQCProductions.map(p => (
              <div 
                key={p.ID_Produksi}
                className="p-3 bg-white border border-cyan-200 rounded-lg shadow-xs shrink-0 flex items-center gap-3"
              >
                <div>
                  <div className="font-mono text-[11px] font-bold text-blue-800">{p.ID_Produksi}</div>
                  <div className="text-xs font-semibold text-slate-900">{products.find(prod => prod.ID_Produk === p.ID_Produk)?.Nama_Produk}</div>
                  <div className="text-[10px] text-slate-500">{p.Jumlah} Unit Selesai • Shift {p.Shift}</div>
                </div>
                <button
                  onClick={() => {
                    const prodName = products.find(prod => prod.ID_Produk === p.ID_Produk)?.Nama_Produk || p.ID_Produk;
                    setFormHeader({
                      Tanggal: p.Tanggal,
                      Produk: prodName,
                      Petugas_QC: '',
                      ID_Produksi: p.ID_Produksi
                    });
                    setEditingQcHeader(null);
                    setShowTestModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-md transition-colors whitespace-nowrap shadow-xs cursor-pointer"
                >
                  Lakukan Uji Mutu
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs Navigation: 1. Laporan Utama | 2. Air Baku | 3. Air Proses | 4. Air Jadi */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px text-xs font-semibold">
        <button
          onClick={() => setQcActiveTab('laporan_utama')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            qcActiveTab === 'laporan_utama'
              ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <LayoutGrid size={15} />
          <span>1. Laporan Utama</span>
        </button>

        <button
          onClick={() => setQcActiveTab('air_baku')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            qcActiveTab === 'air_baku'
              ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Droplet size={15} />
          <span>2. Air Baku</span>
        </button>

        <button
          onClick={() => setQcActiveTab('air_proses')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            qcActiveTab === 'air_proses'
              ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Filter size={15} />
          <span>3. Air Proses</span>
        </button>

        <button
          onClick={() => setQcActiveTab('air_jadi')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            qcActiveTab === 'air_jadi'
              ? 'border-blue-600 text-blue-600 font-bold bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={15} />
          <span>4. Air Jadi</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: LAPORAN UTAMA                                           */}
      {/* ============================================================== */}
      {qcActiveTab === 'laporan_utama' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Riwayat Pengujian Mutu SNI 3553:2023 - Periode {filterMonth}</h3>
              <p className="text-xs text-slate-500">Hasil verifikasi mikrobiologi, fisika, dan kimiawi air kemasan.</p>
            </div>
            <button
              onClick={() => exportDataToExcel(filteredQcHeaders, 'QC_Mutu', `AIRIS_QC_${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID QC</th>
                  <th className="p-3">Tanggal Uji</th>
                  <th className="p-3">Produk Diuji</th>
                  <th className="p-3">Kesimpulan Mutu</th>
                  <th className="p-3">Status Data</th>
                  <th className="p-3">Petugas Analis</th>
                  <th className="p-3 text-center">Rincian / Cetak / PDF</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQcHeaders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic">
                      Belum ada hasil pengujian mutu untuk bulan {filterMonth}.
                    </td>
                  </tr>
                ) : (
                  filteredQcHeaders.map(q => (
                    <tr key={q.ID_QC} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{q.ID_QC}</td>
                      <td className="p-3 font-mono text-slate-500">{formatDateDDMMYYYY(q.Tanggal)}</td>
                      <td className="p-3 font-semibold text-slate-900">{q.Produk}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold inline-flex items-center gap-1 ${
                          q.Kesimpulan?.includes('REJECT')
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : q.Kesimpulan?.includes('LAYAK')
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {q.Kesimpulan?.includes('REJECT') && <AlertTriangle size={12} className="text-red-600 shrink-0" />}
                          <span>{q.Kesimpulan}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          q.Status_Data === 'Lengkap'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {q.Status_Data || 'Belum Lengkap'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">{q.Petugas_QC}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewDetailModal(q)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Lihat Rincian Pengujian"
                          >
                            <Eye size={13} />
                            <span>Rincian</span>
                          </button>
                          <button
                            onClick={() => handleExportSingleQCPDF(q)}
                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded cursor-pointer"
                            title="Unduh PDF Dokumen QC"
                          >
                            <FileDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditQC(q)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            title="Edit Data QC"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteQC(q.ID_QC)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Hapus Data QC"
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
      {/* TAB 2: AIR BAKU (Tgl Uji, Produk, Siklus, pH, TDS, Kekeruhan, Bau, Coliform) */}
      {/* ============================================================== */}
      {qcActiveTab === 'air_baku' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hasil Pengujian Mutu: 2. Air Baku</h3>
              <p className="text-xs text-slate-500">Parameter fisika &amp; mikrobiologi air baku sumber mata air alami.</p>
            </div>
            <button
              onClick={() => exportDataToExcel(cycleRows.map(r => ({
                Tanggal_Uji: r.tglUji,
                Produk: r.produk,
                Siklus: r.siklusLabel,
                pH: r.detail.Baku_pH ?? '',
                TDS: r.detail.Baku_TDS ?? '',
                Kekeruhan: r.detail.Baku_Kekeruhan ?? '',
                Bau: r.detail.Baku_Bau ?? '',
                Coliform: r.detail.Baku_Coliform ?? ''
              })), 'QC_Air_Baku', `AIRIS_QC_Air_Baku_${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3 text-center w-28">Tgl Uji</th>
                  <th className="p-3 text-left">Produk</th>
                  <th className="p-3 text-center w-28">Siklus</th>
                  <th className="p-3 text-center w-20">pH</th>
                  <th className="p-3 text-center w-20">TDS</th>
                  <th className="p-3 text-center w-24">Kekeruhan</th>
                  <th className="p-3 text-center w-20">Bau</th>
                  <th className="p-3 text-center w-24">Coliform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cycleRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      Belum ada data pengujian air baku untuk bulan {filterMonth}.
                    </td>
                  </tr>
                ) : (
                  cycleRows.map((r, idx) => (
                    <tr key={`${r.header.ID_QC}-${r.detail.Siklus}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-mono text-slate-600">{r.tglUji}</td>
                      <td className="p-3 font-semibold text-slate-900">{r.produk}</td>
                      <td className="p-3 text-center font-medium text-slate-700">{r.siklusLabel}</td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-800">{r.detail.Baku_pH ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Baku_TDS ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Baku_Kekeruhan ?? '-'}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{r.detail.Baku_Bau ?? 'TB'}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">{r.detail.Baku_Coliform ?? '0'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: AIR PROSES (Tgl Uji, Produk, Siklus, pH, TDS, Kekeruhan, Bau, Rasa, Ozon) */}
      {/* ============================================================== */}
      {qcActiveTab === 'air_proses' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hasil Pengujian Mutu: 3. Air Proses</h3>
              <p className="text-xs text-slate-500">Parameter filtrasi, ozonisasi &amp; sterilisasi water treatment plant.</p>
            </div>
            <button
              onClick={() => exportDataToExcel(cycleRows.map(r => ({
                Tanggal_Uji: r.tglUji,
                Produk: r.produk,
                Siklus: r.siklusLabel,
                pH: r.detail.Proses_pH ?? '',
                TDS: r.detail.Proses_TDS ?? '',
                Kekeruhan: r.detail.Proses_Kekeruhan ?? '',
                Bau: r.detail.Proses_Bau ?? '',
                Rasa: r.detail.Proses_Rasa ?? '',
                Ozon: r.detail.Proses_Ozon ?? ''
              })), 'QC_Air_Proses', `AIRIS_QC_Air_Proses_${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3 text-center w-28">Tgl Uji</th>
                  <th className="p-3 text-left">Produk</th>
                  <th className="p-3 text-center w-28">Siklus</th>
                  <th className="p-3 text-center w-20">pH</th>
                  <th className="p-3 text-center w-20">TDS</th>
                  <th className="p-3 text-center w-24">Kekeruhan</th>
                  <th className="p-3 text-center w-20">Bau</th>
                  <th className="p-3 text-center w-24">Rasa</th>
                  <th className="p-3 text-center w-24">Ozon (ppm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cycleRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                      Belum ada data pengujian air proses untuk bulan {filterMonth}.
                    </td>
                  </tr>
                ) : (
                  cycleRows.map((r, idx) => (
                    <tr key={`${r.header.ID_QC}-${r.detail.Siklus}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-mono text-slate-600">{r.tglUji}</td>
                      <td className="p-3 font-semibold text-slate-900">{r.produk}</td>
                      <td className="p-3 text-center font-medium text-slate-700">{r.siklusLabel}</td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-800">{r.detail.Proses_pH ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Proses_TDS ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Proses_Kekeruhan ?? '-'}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{r.detail.Proses_Bau ?? 'TB'}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{r.detail.Proses_Rasa ?? 'Segar'}</td>
                      <td className="p-3 text-center font-mono font-bold text-blue-700">{r.detail.Proses_Ozon ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: AIR JADI (Tgl Uji, Produk, Siklus, pH, TDS, Kekeruhan, Bau, Rasa, Ozon, ALT Awal, ALT Akhir, Coliform) */}
      {/* ============================================================== */}
      {qcActiveTab === 'air_jadi' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hasil Pengujian Mutu: 4. Air Jadi</h3>
              <p className="text-xs text-slate-500">Standar SNI 3553:2023 air minum dalam kemasan siap edar ke konsumen.</p>
            </div>
            <button
              onClick={() => exportDataToExcel(cycleRows.map(r => ({
                Tanggal_Uji: r.tglUji,
                Produk: r.produk,
                Siklus: r.siklusLabel,
                pH: r.detail.Jadi_pH ?? '',
                TDS: r.detail.Jadi_TDS ?? '',
                Kekeruhan: r.detail.Jadi_Kekeruhan ?? '',
                Bau: r.detail.Jadi_Bau ?? '',
                Rasa: r.detail.Jadi_Rasa ?? '',
                Ozon: r.detail.Jadi_Ozon ?? '',
                ALT_Awal: r.detail.Jadi_ALT_Awal ?? '',
                ALT_Akhir: r.detail.Jadi_ALT_Akhir ?? '',
                Coliform: r.detail.Jadi_Coliform ?? ''
              })), 'QC_Air_Jadi', `AIRIS_QC_Air_Jadi_${filterMonth}`)}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>Export Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3 text-center w-28">Tgl Uji</th>
                  <th className="p-3 text-left">Produk</th>
                  <th className="p-3 text-center w-24">Siklus</th>
                  <th className="p-3 text-center w-16">pH</th>
                  <th className="p-3 text-center w-16">TDS</th>
                  <th className="p-3 text-center w-20">Keruh</th>
                  <th className="p-3 text-center w-16">Bau</th>
                  <th className="p-3 text-center w-16">Rasa</th>
                  <th className="p-3 text-center w-20">Ozon</th>
                  <th className="p-3 text-center w-20">ALT Awal</th>
                  <th className="p-3 text-center w-20">ALT Akhir</th>
                  <th className="p-3 text-center w-20">Coliform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cycleRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400 italic">
                      Belum ada data pengujian air jadi untuk bulan {filterMonth}.
                    </td>
                  </tr>
                ) : (
                  cycleRows.map((r, idx) => (
                    <tr key={`${r.header.ID_QC}-${r.detail.Siklus}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-mono text-slate-600">{r.tglUji}</td>
                      <td className="p-3 font-semibold text-slate-900">{r.produk}</td>
                      <td className="p-3 text-center font-medium text-slate-700">{r.siklusLabel}</td>
                      <td className="p-3 text-center font-mono font-semibold text-slate-800">{r.detail.Jadi_pH ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Jadi_TDS ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Jadi_Kekeruhan ?? '-'}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{r.detail.Jadi_Bau ?? 'TB'}</td>
                      <td className="p-3 text-center font-medium text-slate-800">{r.detail.Jadi_Rasa ?? 'Segar'}</td>
                      <td className="p-3 text-center font-mono text-blue-700">{r.detail.Jadi_Ozon ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Jadi_ALT_Awal ?? '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-800">{r.detail.Jadi_ALT_Akhir ?? '-'}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">{r.detail.Jadi_Coliform ?? '0'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: FORMULIR INPUT & EDIT UJI MUTU 3 SIKLUS                 */}
      {/* Parameters strictly per user brief:                            */}
      {/* Air Baku: pH, TDS, Kekeruhan, Bau, Coliform                   */}
      {/* Air Proses: pH, TDS, Kekeruhan, Bau, Rasa, Ozon                */}
      {/* Air Jadi: pH, TDS, Kekeruhan, Bau, Rasa, Ozon, ALT Awal/Akhir, */}
      {/*           Coliform                                             */}
      {/* ============================================================== */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <FlaskConical className="text-cyan-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingQcHeader ? `Edit Pengujian Mutu (${editingQcHeader.ID_QC})` : 'Formulir Uji Mutu Laboratorium (SNI 3553:2023)'}
                </h3>
              </div>
              <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Uji</label>
                  <input
                    type="date"
                    value={formHeader.Tanggal}
                    onChange={e => setFormHeader({ ...formHeader, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Produk Diuji</label>
                  <select
                    value={formHeader.Produk}
                    onChange={e => setFormHeader({ ...formHeader, Produk: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                  >
                    {products.map(p => (
                      <option key={p.ID_Produk} value={p.Nama_Produk}>{p.Nama_Produk}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Petugas Analis QC</label>
                  <input
                    type="text"
                    list="qc-analis-suggestions"
                    placeholder="Kosongkan atau ketik nama analis QC..."
                    value={formHeader.Petugas_QC}
                    onChange={e => setFormHeader({ ...formHeader, Petugas_QC: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                  />
                  <datalist id="qc-analis-suggestions">
                    {Array.from(new Set(qcHeaders.map(h => (h.Petugas_QC || '').trim()).filter(Boolean))).map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Status Kelayakan Realtime & Notifikasi Validasi SNI */}
              <div className={`p-4 rounded-xl border transition-all ${
                compliance.status === 'LAYAK'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : compliance.status === 'REJECT'
                  ? 'bg-red-50 border-red-300 text-red-950 shadow-xs'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {compliance.status === 'LAYAK' ? (
                      <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                    ) : compliance.status === 'REJECT' ? (
                      <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                    ) : (
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    )}
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        Evaluasi Parameter SNI 3553:2023 Otomatis
                      </div>
                      <div className="text-sm font-bold flex items-center gap-2 mt-0.5">
                        <span>{compliance.text}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          compliance.status === 'LAYAK'
                            ? 'bg-emerald-200 text-emerald-900'
                            : compliance.status === 'REJECT'
                            ? 'bg-red-200 text-red-900 animate-pulse'
                            : 'bg-amber-200 text-amber-900'
                        }`}>
                          {compliance.badge}
                        </span>
                      </div>

                      {/* Notifikasi Data Belum Lengkap (Pengisian Bertahap) */}
                      {!compliance.isComplete && compliance.missingStages.length > 0 && (
                        <div className="mt-2 text-[11px] text-amber-800 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                          <span className="font-bold">⚠️ Catatan Pengisian Bertahap:</span> Pengujian dapat disimpan sementara untuk tahap yang sudah selesai. Tahap yang belum lengkap: <strong>{compliance.missingStages.join(', ')}</strong>. Status tersimpan sebagai <span className="font-bold text-amber-900">"Belum Lengkap"</span>.
                        </div>
                      )}

                      {/* Notifikasi Penyimpangan Standar Mutu (REJECT / PERLU UJI ULANG) */}
                      {compliance.violations.length > 0 && (
                        <div className="mt-2.5 p-3 bg-red-100/80 rounded-lg border border-red-200 text-red-900">
                          <div className="font-bold text-xs flex items-center gap-1.5 text-red-700">
                            <AlertTriangle size={14} />
                            <span>PERINGATAN: Nilai di luar batas toleransi SNI 3553:2023 (Perlu Uji Ulang / Reject Batch):</span>
                          </div>
                          <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-[11px]">
                            {compliance.violations.map((v, i) => (
                              <li key={i} className="font-medium text-red-800">{v}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Pengujian Air Baku: pH, TDS, Kekeruhan, Bau, Coliform (3 Siklus) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>1. Pengujian Air Baku (pH, TDS, Kekeruhan, Bau, Coliform - 3 Siklus)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Mata Air Alami</span>
                </div>
                <div className="overflow-x-auto p-3">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr className="text-slate-600 font-semibold border-b">
                        <th className="p-2 text-left">Siklus</th>
                        <th className="p-2">pH (6.5 - 8.5)</th>
                        <th className="p-2">TDS (mg/L &lt;500)</th>
                        <th className="p-2">Kekeruhan (NTU &lt;1.5)</th>
                        <th className="p-2">Bau</th>
                        <th className="p-2">Coliform (CFU/100ml)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2].map(idx => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="p-2 font-bold text-slate-700 text-left">Siklus {idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.baku[idx].ph}
                              onChange={e => {
                                const newB = [...cycles.baku];
                                newB[idx].ph = e.target.value;
                                setCycles({ ...cycles, baku: newB });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.baku[idx].tds}
                              onChange={e => {
                                const newB = [...cycles.baku];
                                newB[idx].tds = e.target.value;
                                setCycles({ ...cycles, baku: newB });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.baku[idx].keruh}
                              onChange={e => {
                                const newB = [...cycles.baku];
                                newB[idx].keruh = e.target.value;
                                setCycles({ ...cycles, baku: newB });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={cycles.baku[idx].bau}
                              onChange={e => {
                                const newB = [...cycles.baku];
                                newB[idx].bau = e.target.value;
                                setCycles({ ...cycles, baku: newB });
                              }}
                              className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs"
                            >
                              <option value="TB">TB (Tidak Berbau)</option>
                              <option value="B">B (Berbau)</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.baku[idx].coli}
                              onChange={e => {
                                const newB = [...cycles.baku];
                                newB[idx].coli = e.target.value;
                                setCycles({ ...cycles, baku: newB });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono font-bold"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Pengujian Air Proses: pH, TDS, Kekeruhan, Bau, Rasa, Ozon (3 Siklus) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>2. Pengujian Air Proses (pH, TDS, Kekeruhan, Bau, Rasa, Ozon - 3 Siklus)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Water Treatment Plant</span>
                </div>
                <div className="overflow-x-auto p-3">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr className="text-slate-600 font-semibold border-b">
                        <th className="p-2 text-left">Siklus</th>
                        <th className="p-2">pH (6.5 - 8.5)</th>
                        <th className="p-2">TDS (&lt;500)</th>
                        <th className="p-2">Kekeruhan (&lt;1.5)</th>
                        <th className="p-2">Bau</th>
                        <th className="p-2">Rasa</th>
                        <th className="p-2">Ozon (ppm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2].map(idx => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="p-2 font-bold text-slate-700 text-left">Siklus {idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.proses[idx].ph}
                              onChange={e => {
                                const newP = [...cycles.proses];
                                newP[idx].ph = e.target.value;
                                setCycles({ ...cycles, proses: newP });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.proses[idx].tds}
                              onChange={e => {
                                const newP = [...cycles.proses];
                                newP[idx].tds = e.target.value;
                                setCycles({ ...cycles, proses: newP });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.proses[idx].keruh}
                              onChange={e => {
                                const newP = [...cycles.proses];
                                newP[idx].keruh = e.target.value;
                                setCycles({ ...cycles, proses: newP });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={cycles.proses[idx].bau}
                              onChange={e => {
                                const newP = [...cycles.proses];
                                newP[idx].bau = e.target.value;
                                setCycles({ ...cycles, proses: newP });
                              }}
                              className="px-2 py-1 border border-slate-300 rounded text-xs"
                            >
                              <option value="TB">TB (Tidak Berbau)</option>
                              <option value="B">B (Berbau)</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={cycles.proses[idx].rasa}
                              onChange={e => {
                                const newP = [...cycles.proses];
                                newP[idx].rasa = e.target.value;
                                setCycles({ ...cycles, proses: newP });
                              }}
                              className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold"
                            >
                              <option value="Segar">Segar (Normal)</option>
                              <option value="Asam">Asam</option>
                              <option value="Pahit">Pahit</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.proses[idx].ozon}
                              onChange={e => {
                                const newP = [...cycles.proses];
                                newP[idx].ozon = e.target.value;
                                setCycles({ ...cycles, proses: newP });
                              }}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded font-mono font-bold text-blue-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Pengujian Air Jadi: pH, TDS, Kekeruhan, Bau, Rasa, Ozon, ALT Awal, ALT Akhir, Coliform (3 Siklus) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>3. Pengujian Air Jadi (pH, TDS, Kekeruhan, Bau, Rasa, Ozon, ALT Awal, ALT Akhir, Coliform - 3 Siklus)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Kemasan Produk Siap Edar</span>
                </div>
                <div className="overflow-x-auto p-3">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr className="text-slate-600 font-semibold border-b">
                        <th className="p-2 text-left">Siklus</th>
                        <th className="p-2">pH</th>
                        <th className="p-2">TDS</th>
                        <th className="p-2">Keruh</th>
                        <th className="p-2">Bau</th>
                        <th className="p-2">Rasa</th>
                        <th className="p-2">Ozon</th>
                        <th className="p-2">ALT Awal</th>
                        <th className="p-2">ALT Akhir</th>
                        <th className="p-2">Coliform</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2].map(idx => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="p-2 font-bold text-slate-700 text-left">Siklus {idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].ph}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].ph = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].tds}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].tds = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].keruh}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].keruh = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={cycles.jadi[idx].bau}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].bau = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="px-1.5 py-1 border border-slate-300 rounded text-xs"
                            >
                              <option value="TB">TB</option>
                              <option value="B">B</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={cycles.jadi[idx].rasa}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].rasa = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="px-1.5 py-1 border border-slate-300 rounded text-xs font-semibold"
                            >
                              <option value="Segar">Segar</option>
                              <option value="Asam">Asam</option>
                              <option value="Pahit">Pahit</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].ozon}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].ozon = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].altAwal}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].altAwal = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].altAkhir}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].altAkhir = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={cycles.jadi[idx].coli}
                              onChange={e => {
                                const newJ = [...cycles.jadi];
                                newJ[idx].coli = e.target.value;
                                setCycles({ ...cycles, jadi: newJ });
                              }}
                              className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono font-bold text-emerald-700"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                {/* Tombol Tersembunyi: Isi Otomatis SNI Acak Standar */}
                <button
                  type="button"
                  onClick={handleAutoFillRandomValidQC}
                  title="Isi Otomatis Seluruh Formulir SNI Standar (Shortcut Tersembunyi)"
                  className="opacity-30 hover:opacity-100 text-slate-400 hover:text-blue-700 hover:bg-blue-50/60 px-2 py-1.5 rounded-md transition-all flex items-center gap-1 cursor-pointer text-[11px]"
                >
                  <Sparkles size={13} className="text-amber-500/80" />
                  <span className="hidden sm:inline font-semibold">Auto-fill SNI</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveQC}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                    compliance.status === 'REJECT'
                      ? 'bg-red-600 hover:bg-red-700'
                      : !compliance.isComplete
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Check size={14} />
                  <span>
                    {editingQcHeader
                      ? 'Simpan Perubahan'
                      : !compliance.isComplete
                      ? 'Simpan Progres (Data Belum Lengkap)'
                      : compliance.status === 'REJECT'
                      ? 'Simpan Hasil (Reject / Perlu Uji Ulang)'
                      : 'Terbitkan Sertifikat QC'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RINCIAN PENGUJIAN MUTU LENGKAP (DENGAN CETAK & PDF)     */}
      {/* ============================================================== */}
      {viewDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 printable-modal-card">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
              <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Dokumen Rincian Pengujian Mutu SNI: {viewDetailModal.ID_QC}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Print button on document */}
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-semibold flex items-center gap-1 text-white shadow-xs cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Cetak</span>
                </button>
                {/* PDF button on document */}
                <button
                  onClick={() => handleExportSingleQCPDF(viewDetailModal)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold flex items-center gap-1 text-white shadow-xs cursor-pointer"
                >
                  <FileDown size={13} />
                  <span>Download PDF</span>
                </button>
                <button onClick={() => setViewDetailModal(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6 text-xs font-sans text-slate-900 print:p-0 printable-content">
              {/* Kop Surat Lab */}
              <div className="text-center pb-4 border-b-2 border-slate-900">
                <h2 className="text-lg font-black text-blue-900 tracking-wide uppercase">PT. ANUGERAH ILLAHI RABBI</h2>
                <p className="text-xs text-slate-600 font-medium">Laboratorium Quality Control & Pengujian Air Minum Dalam Kemasan</p>
                <p className="text-[11px] text-slate-500">Standar Nasional Indonesia (SNI 3553:2023) • Permenkes No. 2 Tahun 2023</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">No. Dokumen</span>
                  <span className="font-bold font-mono text-blue-800">{viewDetailModal.ID_QC}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Tanggal Uji</span>
                  <span className="font-semibold text-slate-900 font-mono">{formatDateDDMMYYYY(viewDetailModal.Tanggal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Produk Diuji</span>
                  <span className="font-semibold text-slate-900">{viewDetailModal.Produk}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Kesimpulan Mutu</span>
                  <span className={`font-bold inline-block mt-0.5 ${
                    viewDetailModal.Kesimpulan?.includes('REJECT')
                      ? 'text-red-700'
                      : viewDetailModal.Kesimpulan?.includes('LAYAK')
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}>
                    {viewDetailModal.Kesimpulan}
                  </span>
                </div>
              </div>

              {/* Rincian Matriks Hasil Uji 3 Siklus */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 uppercase text-[11px] border-b pb-1">
                  Matriks Hasil Pengujian 3 Siklus Laboratorium
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="p-2.5">Siklus</th>
                        <th className="p-2.5">Air Baku (pH / TDS / Keruh / Bau / Coli)</th>
                        <th className="p-2.5">Air Proses (pH / TDS / Rasa / Ozon)</th>
                        <th className="p-2.5">Air Jadi (pH / TDS / Keruh / Coli / ALT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {qcDetails.filter(d => d.ID_QC === viewDetailModal.ID_QC).map(d => (
                        <tr key={d.Siklus}>
                          <td className="p-2.5 font-bold text-blue-700">Siklus {d.Siklus}</td>
                          <td className="p-2.5 text-slate-700">
                            pH: {d.Baku_pH} • TDS: {d.Baku_TDS} • NTU: {d.Baku_Kekeruhan} • Bau: {d.Baku_Bau} • Coli: {d.Baku_Coliform}
                          </td>
                          <td className="p-2.5 text-slate-700">
                            pH: {d.Proses_pH} • TDS: {d.Proses_TDS} • Rasa: {d.Proses_Rasa} • Ozon: {d.Proses_Ozon} ppm
                          </td>
                          <td className="p-2.5 font-bold text-slate-900">
                            pH: {d.Jadi_pH} • TDS: {d.Jadi_TDS} • NTU: {d.Jadi_Kekeruhan} • Coli: {d.Jadi_Coliform} • ALT: {d.Jadi_ALT_Awal}/{d.Jadi_ALT_Akhir}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 text-center pt-8 border-t border-slate-200">
                <div>
                  <p className="text-slate-500 mb-12">Petugas Analis Laboratorium,</p>
                  <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[140px]">
                    ( {viewDetailModal.Petugas_QC} )
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-12">Kepala Bagian Quality Control,</p>
                  <p className="font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[140px]">
                    ( Nurul Hidayati, S.Si )
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end no-print">
              <button
                onClick={() => setViewDetailModal(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
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
