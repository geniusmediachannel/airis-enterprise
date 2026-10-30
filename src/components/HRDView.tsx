import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, DollarSign, Printer, 
  Download, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X, Receipt,
  FileSpreadsheet, Save, FileDown, CheckCheck, Settings, ChevronDown,
  ChevronUp, Layers, MessageSquare, Info, ShieldAlert, Building2
} from 'lucide-react';
import { 
  EmployeeItem, AttendanceRecord, AttendanceNoteItem, OvertimeRecord, 
  KasbonRecord, PayrollHistoryItem, PayrollRuleSettings, DraftJournalItem 
} from '../types';
import { getTableData, setTableData } from '../services/dbAdapter';
import { exportDataToExcel, ExcelTemplateType } from '../services/excelService';
import { confirmAction } from './ConfirmDialog';
import { showToast } from './ToastContainer';
import { formatDateDDMMYYYY } from '../services/formatters';

interface HRDViewProps {
  employees: EmployeeItem[];
  attendances: AttendanceRecord[];
  overtimes: OvertimeRecord[];
  kasbons: KasbonRecord[];
  payrollHistory: PayrollHistoryItem[];
  onRefresh: () => void;
}

const DEFAULT_PAYROLL_SETTINGS: PayrollRuleSettings = {
  bonusHadirFull: 75000,
  bonusTargetDefault: 0,
  tarifLemburPerJam: 15000,
  useDepnakerFormula: true,
  potonganAlpaPerHari: 50000,
  potonganTelatPerKejadian: 10000,
  potonganPulangAwalPerKejadian: 10000,
  potonganIzinPerHari: 25000,
  potonganSakitPerHari: 0,
  bpjsKetenagakerjaanNominal: 40000,
  bpjsKesehatanNominal: 0,
  pph21Nominal: 0,
  namaPerusahaan: 'PT ANUGERAH ILLAHI RABBI',
  subNamaPerusahaan: 'Klaten, Jawa Tengah - Sistem Manajemen Terpadu AIRIS',
  penandatanganNama: 'Manajer HRD',
  penandatanganJabatan: 'Manajer HRD'
};

export const HRDView: React.FC<HRDViewProps> = ({
  employees,
  attendances,
  overtimes,
  kasbons,
  payrollHistory,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'presensi' | 'lembur' | 'gaji' | 'kasbon' | 'histori'>('presensi');
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonth, setFilterMonth] = useState<string>(defaultMonth);

  // Payroll Rule Settings State
  const [payrollSettings, setPayrollSettings] = useState<PayrollRuleSettings>(() => {
    const saved = getTableData<PayrollRuleSettings>('HRD_Payroll_Settings', []);
    return saved.length > 0 ? { ...DEFAULT_PAYROLL_SETTINGS, ...saved[0] } : DEFAULT_PAYROLL_SETTINGS;
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Attendance Note Dialog State
  const [attendanceNoteModal, setAttendanceNoteModal] = useState<{
    isOpen: boolean;
    empId: string;
    empName: string;
    day: number;
    status: string;
    keterangan: string;
    menitTelat?: number;
  } | null>(null);

  // Kasbon Modal State
  const [showKasbonModal, setShowKasbonModal] = useState(false);
  const [editingKasbon, setEditingKasbon] = useState<KasbonRecord | null>(null);
  const [kasbonForm, setKasbonForm] = useState({
    Tanggal: new Date().toISOString().slice(0, 10),
    ID_Karyawan: employees[0]?.ID_Karyawan || '',
    Nominal: '' as any,
    Tenor: 1
  });

  // Slip Gaji Modal State
  const [viewSlipModal, setViewSlipModal] = useState<any | null>(null);

  // Histori Penggajian: Expanded Batch Collapsible Map
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  // Helper to handle print with dynamic paper orientation
  const handlePrintDocument = (orientation: 'portrait' | 'landscape' = 'portrait') => {
    document.body.classList.remove('print-portrait', 'print-landscape');
    document.body.classList.add(orientation === 'landscape' ? 'print-landscape' : 'print-portrait');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-portrait', 'print-landscape');
    }, 1500);
  };

  // Calculate Days in Month
  const [yearStr, monthStr] = filterMonth.split('-');
  const year = parseInt(yearStr, 10) || now.getFullYear();
  const month = parseInt(monthStr, 10) || (now.getMonth() + 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const formatBulanIndo = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split('-');
    const mNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${mNames[(parseInt(m, 10) || 1) - 1]} ${y}`;
  };

  // ==============================================================
  // 1. PRESENSI KARYAWAN TABLE KE SAMPING (T1 - T31)
  // Status: H, T, I, S, C, A, PA, L
  // ==============================================================
  const currentAttendances = getTableData<AttendanceRecord>('Data_Presensi', []);

  // Ensure attendance record exists for all employees
  const attendanceRows = employees.map(emp => {
    let rec = currentAttendances.find(a => a.ID_Karyawan === emp.ID_Karyawan && a.Bulan_Tahun === filterMonth);
    if (!rec) {
      rec = {
        ID_Presensi: `PRS-${emp.ID_Karyawan}-${filterMonth}`,
        Bulan_Tahun: filterMonth,
        ID_Karyawan: emp.ID_Karyawan,
        Nama_Karyawan: emp.Nama_Karyawan,
        Catatan_Presensi: {}
      };
      // Default fill weekdays as H, Sundays as L
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        rec[`T${d}` as `T${number}`] = dateObj.getDay() === 0 ? 'L' : 'H';
      }
    }

    // Calculate totals
    let h = 0, t = 0, i = 0, s = 0, c = 0, a = 0, pa = 0, l = 0;
    let totalMenitTelat = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const code = rec[`T${d}` as `T${number}`];
      if (code === 'H') h++;
      else if (code === 'T') {
        t++;
        const note = rec.Catatan_Presensi?.[d];
        totalMenitTelat += (Number(note?.menitTelat) || 0);
      }
      else if (code === 'I') i++;
      else if (code === 'S') s++;
      else if (code === 'C') c++;
      else if (code === 'A') a++;
      else if (code === 'PA') pa++;
      else if (code === 'L') l++;
    }

    return {
      ...rec,
      Total_H: h,
      Total_T: t,
      Total_Menit_Telat: totalMenitTelat,
      Total_I: i,
      Total_S: s,
      Total_C: c,
      Total_A: a,
      Total_PA: pa,
      Total_L: l
    };
  });

  // Cell change handler: if non-H/L status is chosen, prompt note dialog
  const handleUpdateAttendanceCell = (empId: string, day: number, value: string) => {
    const emp = employees.find(e => e.ID_Karyawan === empId);
    const existingRec = currentAttendances.find(a => a.ID_Karyawan === empId && a.Bulan_Tahun === filterMonth);
    const existingNote = existingRec?.Catatan_Presensi?.[day];
    const currentNote = existingNote?.keterangan || '';
    const currentMenitTelat = existingNote?.menitTelat;

    // If selecting T, I, S, C, A, PA, open note modal
    if (['T', 'I', 'S', 'C', 'A', 'PA'].includes(value)) {
      setAttendanceNoteModal({
        isOpen: true,
        empId,
        empName: emp?.Nama_Karyawan || empId,
        day,
        status: value,
        keterangan: currentNote || (value === 'T' && currentMenitTelat ? `Terlambat ${currentMenitTelat} menit` : ''),
        menitTelat: currentMenitTelat !== undefined ? currentMenitTelat : (value === 'T' ? 15 : undefined)
      });
      return;
    }

    // Otherwise (H, L), save directly
    saveAttendanceValue(empId, day, value, currentNote);
  };

  const saveAttendanceValue = (empId: string, day: number, status: string, keterangan?: string, menitTelat?: number) => {
    const list = getTableData<AttendanceRecord>('Data_Presensi', []);
    let foundIdx = list.findIndex(a => a.ID_Karyawan === empId && a.Bulan_Tahun === filterMonth);
    const emp = employees.find(e => e.ID_Karyawan === empId);

    const hasKeterangan = Boolean(keterangan && keterangan.trim() !== '');
    const hasMenit = menitTelat !== undefined && Number(menitTelat) > 0;

    if (foundIdx > -1) {
      list[foundIdx][`T${day}` as `T${number}`] = status;
      if (!list[foundIdx].Catatan_Presensi) list[foundIdx].Catatan_Presensi = {};
      if (hasKeterangan || hasMenit || !['H', 'L'].includes(status)) {
        list[foundIdx].Catatan_Presensi![day] = {
          status,
          keterangan: keterangan?.trim() || (status === 'T' && menitTelat ? `Terlambat ${menitTelat} menit` : ''),
          menitTelat: status === 'T' ? (Number(menitTelat) || 0) : undefined
        };
      } else if (['H', 'L'].includes(status)) {
        delete list[foundIdx].Catatan_Presensi![day];
      }
    } else {
      const newRec: AttendanceRecord = {
        ID_Presensi: `PRS-${empId}-${filterMonth}`,
        Bulan_Tahun: filterMonth,
        ID_Karyawan: empId,
        Nama_Karyawan: emp?.Nama_Karyawan || empId,
        [`T${day}` as `T${number}`]: status,
        Catatan_Presensi: (hasKeterangan || hasMenit || !['H', 'L'].includes(status)) ? {
          [day]: {
            status,
            keterangan: keterangan?.trim() || (status === 'T' && menitTelat ? `Terlambat ${menitTelat} menit` : ''),
            menitTelat: status === 'T' ? (Number(menitTelat) || 0) : undefined
          }
        } : {}
      };
      list.push(newRec);
    }
    setTableData('Data_Presensi', list);
    onRefresh();
  };

  const handleSaveAttendanceNoteModal = () => {
    if (!attendanceNoteModal) return;
    saveAttendanceValue(
      attendanceNoteModal.empId,
      attendanceNoteModal.day,
      attendanceNoteModal.status,
      attendanceNoteModal.keterangan,
      attendanceNoteModal.menitTelat
    );
    const detailMsg = attendanceNoteModal.status === 'T' && attendanceNoteModal.menitTelat
      ? `Terlambat ${attendanceNoteModal.menitTelat} menit tersimpan.`
      : `Status ${attendanceNoteModal.status} & catatan tanggal ${attendanceNoteModal.day} tersimpan.`;
    setAttendanceNoteModal(null);
    showToast('Presensi Disimpan', detailMsg, 'success');
  };

  const handleQuickFillAllHadir = async () => {
    const ok = await confirmAction({
      title: 'Generate Presensi Otomatis',
      message: `Isi presensi (Hadir) secara otomatis untuk seluruh karyawan pada hari kerja di periode ${filterMonth}?`,
      confirmText: 'Ya, Isi Otomatis',
      cancelText: 'Batal',
      type: 'info',
      itemDetails: {
        'Periode': filterMonth,
        'Jumlah Karyawan': `${employees.length} Orang`,
        'Format Jam Kerja': 'Hadir Normal (Senin - Sabtu)'
      }
    });
    if (!ok) return;

    const list = getTableData<AttendanceRecord>('Data_Presensi', []);
    const updated = employees.map(emp => {
      const existing = list.find(a => a.ID_Karyawan === emp.ID_Karyawan && a.Bulan_Tahun === filterMonth);
      const rec: AttendanceRecord = {
        ID_Presensi: `PRS-${emp.ID_Karyawan}-${filterMonth}`,
        Bulan_Tahun: filterMonth,
        ID_Karyawan: emp.ID_Karyawan,
        Nama_Karyawan: emp.Nama_Karyawan,
        Catatan_Presensi: existing?.Catatan_Presensi || {}
      };
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month - 1, d);
        rec[`T${d}` as `T${number}`] = dt.getDay() === 0 ? 'L' : 'H';
      }
      return rec;
    });

    // Merge
    const filtered = list.filter(a => a.Bulan_Tahun !== filterMonth);
    setTableData('Data_Presensi', [...filtered, ...updated]);
    onRefresh();
    showToast('Presensi Diisi', 'Seluruh kehadiran berhasil diatur ke Hadir.', 'success');
  };

  // ==============================================================
  // 2. LEMBUR KARYAWAN TABLE KE SAMPING (T1 - T31 ANGKA JAM)
  // ==============================================================
  const currentOvertimes = getTableData<OvertimeRecord>('Data_Lembur', []);

  const overtimeRows = employees.map(emp => {
    let rec = currentOvertimes.find(o => o.ID_Karyawan === emp.ID_Karyawan && o.Bulan_Tahun === filterMonth);
    if (!rec) {
      rec = {
        ID_Lembur: `OT-${emp.ID_Karyawan}-${filterMonth}`,
        Bulan_Tahun: filterMonth,
        ID_Karyawan: emp.ID_Karyawan,
        Nama_Karyawan: emp.Nama_Karyawan
      };
      for (let d = 1; d <= daysInMonth; d++) {
        rec[`T${d}` as `T${number}`] = 0;
      }
    }

    let totalJam = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const val = parseFloat(String(rec[`T${d}` as `T${number}`] || 0));
      if (!isNaN(val)) totalJam += val;
    }

    return {
      ...rec,
      Total_Jam_Lembur: Math.round(totalJam * 10) / 10
    };
  });

  const handleUpdateOvertimeCell = (empId: string, day: number, value: string) => {
    const list = getTableData<OvertimeRecord>('Data_Lembur', []);
    let foundIdx = list.findIndex(o => o.ID_Karyawan === empId && o.Bulan_Tahun === filterMonth);
    const numVal = parseFloat(value) || 0;

    if (foundIdx > -1) {
      list[foundIdx][`T${day}` as `T${number}`] = numVal;
    } else {
      const emp = employees.find(e => e.ID_Karyawan === empId);
      const newRec: OvertimeRecord = {
        ID_Lembur: `OT-${empId}-${filterMonth}`,
        Bulan_Tahun: filterMonth,
        ID_Karyawan: empId,
        Nama_Karyawan: emp?.Nama_Karyawan || empId,
        [`T${day}` as `T${number}`]: numVal
      };
      list.push(newRec);
    }
    setTableData('Data_Lembur', list);
    onRefresh();
  };

  // ==============================================================
  // 3. INTEGRASI GAJI DENGAN INPUT LEMBUR & KASBON OTOMATIS
  // Ketentuan & Bonus diatur via payrollSettings
  // ==============================================================
  const calculatePayrollSummary = () => {
    return employees.map(emp => {
      const gapok = emp.Gaji_Pokok || 1500000;
      const tunjangan = emp.Tunjangan || 0;

      // Lembur
      const otRec = overtimeRows.find(o => o.ID_Karyawan === emp.ID_Karyawan);
      const jamLembur = otRec?.Total_Jam_Lembur || 0;

      // Perhitungan Upah Lembur (Depnaker vs Flat Tarif)
      let upahLembur = 0;
      if (payrollSettings.useDepnakerFormula) {
        const hourlyRate = gapok / 173;
        upahLembur = hourlyRate * jamLembur * 1.5;
      } else {
        upahLembur = (payrollSettings.tarifLemburPerJam || 15000) * jamLembur;
      }

      // Attendance Summary
      const attRec = attendanceRows.find(a => a.ID_Karyawan === emp.ID_Karyawan);
      const hadirDays = attRec?.Total_H || 0;
      const telatCount = attRec?.Total_T || 0;
      const izinDays = attRec?.Total_I || 0;
      const sakitDays = attRec?.Total_S || 0;
      const alpaDays = attRec?.Total_A || 0;
      const pulangAwalCount = attRec?.Total_PA || 0;

      // Bonus Kehadiran: diberikan jika 0 alpa, 0 izin, 0 pulang awal
      const bonusHadir = (alpaDays === 0 && izinDays === 0 && pulangAwalCount === 0 && hadirDays >= 18)
        ? (payrollSettings.bonusHadirFull || 75000)
        : 0;

      const bonusTarget = payrollSettings.bonusTargetDefault || 0;

      // Potongan-potongan
      const potongAlpa = alpaDays * (payrollSettings.potonganAlpaPerHari || 50000);
      const potongTelat = telatCount * (payrollSettings.potonganTelatPerKejadian || 10000);
      const potongPA = pulangAwalCount * (payrollSettings.potonganPulangAwalPerKejadian || 10000);
      const potongIzin = izinDays * (payrollSettings.potonganIzinPerHari || 25000);
      const potongSakit = sakitDays * (payrollSettings.potonganSakitPerHari || 0);
      const potongAbsen = potongAlpa + potongTelat + potongPA + potongIzin + potongSakit;

      const pph21 = payrollSettings.pph21Nominal || 0;
      const bpjsKetenagakerjaan = payrollSettings.bpjsKetenagakerjaanNominal || 40000;
      const bpjsKesehatan = payrollSettings.bpjsKesehatanNominal || 0;
      const bpjsTotal = bpjsKetenagakerjaan + bpjsKesehatan;

      // Kasbon active installment
      const activeKasbon = kasbons.find(k => k.ID_Karyawan === emp.ID_Karyawan);
      const cicilanKasbon = activeKasbon ? activeKasbon.Cicilan_Per_Bulan : 0;

      const totalPendapatan = gapok + tunjangan + bonusHadir + bonusTarget + upahLembur;
      const totalPotongan = pph21 + bpjsTotal + cicilanKasbon + potongAbsen;
      const gajiBersih = totalPendapatan - totalPotongan;

      return {
        id: emp.ID_Karyawan,
        nama: emp.Nama_Karyawan,
        jabatan: emp.Jabatan,
        gapok,
        tunjangan,
        bonusHadir,
        bonusTarget,
        jamLembur,
        jamLembur15: jamLembur,
        jamLembur20: 0,
        upahLembur,
        pph21,
        bpjs: bpjsTotal,
        bpjsKetenagakerjaan,
        bpjsKesehatan,
        kasbon: cicilanKasbon,
        potongAbsen,
        totalPendapatan,
        totalPotongan,
        gajiBersih
      };
    });
  };

  const payrollData = calculatePayrollSummary();

  // Save Settings
  const handleSavePayrollSettings = () => {
    setTableData('HRD_Payroll_Settings', [payrollSettings]);
    setShowSettingsModal(false);
    showToast('Pengaturan Disimpan', 'Ketentuan potongan, bonus, dan slip gaji berhasil diperbarui.', 'success');
  };

  // Open Add Kasbon
  const handleOpenAddKasbon = () => {
    setEditingKasbon(null);
    setKasbonForm({
      Tanggal: new Date().toISOString().slice(0, 10),
      ID_Karyawan: employees[0]?.ID_Karyawan || '',
      Nominal: '' as any,
      Tenor: 1
    });
    setShowKasbonModal(true);
  };

  const handleOpenEditKasbon = (k: KasbonRecord) => {
    setEditingKasbon(k);
    setKasbonForm({
      Tanggal: k.Tanggal,
      ID_Karyawan: k.ID_Karyawan,
      Nominal: k.Nominal,
      Tenor: k.Tenor
    });
    setShowKasbonModal(true);
  };

  const handleSaveKasbon = () => {
    const currentKasbons = getTableData<KasbonRecord>('Data_Kasbon', []);
    const emp = employees.find(e => e.ID_Karyawan === kasbonForm.ID_Karyawan);
    const nominal = Number(kasbonForm.Nominal) || 0;
    const tenor = Number(kasbonForm.Tenor) || 1;
    const cicilan = Math.round(nominal / tenor);

    if (editingKasbon) {
      const updated = currentKasbons.map(k => k.ID_Kasbon === editingKasbon.ID_Kasbon ? {
        ...k,
        Tanggal: kasbonForm.Tanggal,
        ID_Karyawan: kasbonForm.ID_Karyawan,
        Nama_Karyawan: emp?.Nama_Karyawan || k.Nama_Karyawan,
        Nominal: nominal,
        Tenor: tenor,
        Cicilan_Per_Bulan: cicilan
      } : k);
      setTableData('Data_Kasbon', updated);
      showToast('Kasbon Diperbarui', `Data kasbon ${editingKasbon.ID_Kasbon} berhasil diperbarui.`, 'success');
    } else {
      const newKasbon: KasbonRecord = {
        ID_Kasbon: `KSB-${Date.now().toString().slice(-4)}`,
        Tanggal: kasbonForm.Tanggal,
        ID_Karyawan: kasbonForm.ID_Karyawan,
        Nama_Karyawan: emp?.Nama_Karyawan || kasbonForm.ID_Karyawan,
        Nominal: nominal,
        Tenor: tenor,
        Cicilan_Per_Bulan: cicilan
      };
      setTableData('Data_Kasbon', [...currentKasbons, newKasbon]);
      showToast('Kasbon Ditambahkan', `Catatan kasbon baru berhasil disimpan.`, 'success');
    }
    setShowKasbonModal(false);
    onRefresh();
  };

  const handleDeleteKasbon = async (id: string) => {
    const kasbon = kasbons.find(k => k.ID_Kasbon === id);
    const ok = await confirmAction({
      title: 'Hapus Catatan Kasbon',
      message: `Hapus catatan pinjaman / kasbon "${id}" atas nama ${kasbon?.Nama_Karyawan || 'karyawan'}?`,
      confirmText: 'Ya, Hapus Kasbon',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Kasbon': id,
        'Karyawan': kasbon?.Nama_Karyawan || '-',
        'Nominal': `Rp ${(kasbon?.Nominal || 0).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const currentKasbons = getTableData<KasbonRecord>('Data_Kasbon', []);
    const updated = currentKasbons.filter(k => k.ID_Kasbon !== id);
    setTableData('Data_Kasbon', updated);
    onRefresh();
    showToast('Kasbon Dihapus', `Catatan kasbon ${id} berhasil dihapus.`, 'success');
  };

  // ==============================================================
  // 4. CAIRKAN GAJI BULAN INI DALAM 1 PAKET (BATCH)
  // Data disimpan & dihapus per paket batch
  // ==============================================================
  const handleDisbursePayrollBatch = async () => {
    let totalGajiBersih = 0;
    payrollData.forEach(p => { totalGajiBersih += p.gajiBersih; });
    const batchId = `BATCH-${filterMonth}`;

    const ok = await confirmAction({
      title: 'Cairkan 1 Paket Penggajian Bulan Ini',
      message: `Cairkan penggajian periode ${formatBulanIndo(filterMonth)} untuk ${payrollData.length} karyawan sekaligus dalam 1 paket? Transaksi otomatis diteruskan ke Keuangan sebagai draf jurnal beban gaji.`,
      confirmText: 'Ya, Cairkan 1 Paket Sekarang',
      cancelText: 'Batal',
      type: 'success',
      itemDetails: {
        'ID Paket': batchId,
        'Periode': formatBulanIndo(filterMonth),
        'Total Penerima': `${payrollData.length} Karyawan`,
        'Total Payroll Bersih': `Rp ${Math.round(totalGajiBersih).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    const tglPencairan = new Date().toISOString().slice(0, 10);
    const waktuPencairan = new Date().toISOString();

    const historyEntries: PayrollHistoryItem[] = payrollData.map(p => {
      return {
        ID_Batch: batchId,
        Tanggal_Pencairan: tglPencairan,
        Waktu_Pencairan: waktuPencairan,
        Bulan_Tahun: filterMonth,
        ID_Karyawan: p.id,
        Nama_Karyawan: p.nama,
        Gaji_Pokok: p.gapok,
        Tunjangan: p.tunjangan,
        Bonus_Hadir: p.bonusHadir,
        Bonus_Target: p.bonusTarget,
        Jam_Lembur: p.jamLembur,
        Jam_Lembur_15: p.jamLembur15,
        Jam_Lembur_20: p.jamLembur20,
        Upah_Lembur: p.upahLembur,
        PPh21: p.pph21,
        BPJS: p.bpjs,
        BPJS_Ketenagakerjaan: p.bpjsKetenagakerjaan,
        BPJS_Kesehatan: p.bpjsKesehatan,
        Kasbon: p.kasbon,
        Potongan_Absen: p.potongAbsen,
        Total_Pendapatan: p.totalPendapatan,
        Total_Potongan: p.totalPotongan,
        Gaji_Bersih: p.gajiBersih
      };
    });

    // Save atomic batch: remove any existing records for this month/batch, then append
    const currentHist = getTableData<PayrollHistoryItem>('Histori_Penggajian', []);
    const filteredHist = currentHist.filter(h => h.Bulan_Tahun !== filterMonth && h.ID_Batch !== batchId);
    setTableData('Histori_Penggajian', [...filteredHist, ...historyEntries]);

    // Update draft journal in Keuangan
    const currentDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
    const filteredDrafts = currentDrafts.filter(d => d.Referensi !== `PAYROLL-${filterMonth}`);
    const newDraft: DraftJournalItem = {
      ID_Draf: `DRF-PAYROLL-${filterMonth.replace('-', '')}`,
      Tanggal: tglPencairan,
      Sumber: 'Penggajian',
      Referensi: `PAYROLL-${filterMonth}`,
      Keterangan: `Penggajian Karyawan & Staf Pabrik Periode ${formatBulanIndo(filterMonth)} (${payrollData.length} Karyawan)`,
      Kode_Debit: '611-10', // Beban Gaji Staf
      Kode_Kredit: '111-20', // Kas Bank BSI
      Nominal: totalGajiBersih,
      Status: 'Menunggu Verifikasi',
      Waktu_Dibuat: waktuPencairan
    };
    setTableData('Draf_Jurnal', [...filteredDrafts, newDraft]);

    showToast(
      'Gaji 1 Paket Berhasil Dicairkan',
      `Paket penggajian ${formatBulanIndo(filterMonth)} senilai Rp ${Math.round(totalGajiBersih).toLocaleString('id-ID')} telah disimpan ke histori dan diteruskan ke Keuangan.`,
      'success'
    );
    setActiveTab('histori');
    onRefresh();
  };

  // Hapus 1 Paket Penggajian Sekaligus
  const handleDeleteBatch = async (batchId: string, periode: string) => {
    const currentHist = getTableData<PayrollHistoryItem>('Histori_Penggajian', []);
    const batchItems = currentHist.filter(h => (h.ID_Batch === batchId) || (h.Bulan_Tahun === periode));
    const totalGaji = batchItems.reduce((acc, it) => acc + (it.Gaji_Bersih || 0), 0);

    const ok = await confirmAction({
      title: 'Hapus 1 Paket Penggajian',
      message: `Hapus seluruh 1 paket penggajian periode "${formatBulanIndo(periode)}" (${batchItems.length} karyawan) secara permanen dari histori dan batalkan draf jurnal keuangannya?`,
      confirmText: 'Ya, Hapus 1 Paket',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'ID Paket': batchId || `BATCH-${periode}`,
        'Periode': formatBulanIndo(periode),
        'Jumlah Karyawan': `${batchItems.length} Orang`,
        'Total Gaji': `Rp ${Math.round(totalGaji).toLocaleString('id-ID')}`
      }
    });
    if (!ok) return;

    // Delete all records of this batch
    const updatedHist = currentHist.filter(h => (h.ID_Batch !== batchId) && (h.Bulan_Tahun !== periode));
    setTableData('Histori_Penggajian', updatedHist);

    // Also remove draft journal from Keuangan
    const currentDrafts = getTableData<DraftJournalItem>('Draf_Jurnal', []);
    const updatedDrafts = currentDrafts.filter(d => d.Referensi !== `PAYROLL-${periode}`);
    setTableData('Draf_Jurnal', updatedDrafts);

    onRefresh();
    showToast('1 Paket Penggajian Dihapus', `Seluruh riwayat penggajian paket periode ${formatBulanIndo(periode)} telah dihapus.`, 'success');
  };

  // Group payroll history into batches by Bulan_Tahun
  const groupedBatches = React.useMemo(() => {
    const groups = new Map<string, {
      batchId: string;
      periode: string;
      tanggalPencairan: string;
      items: PayrollHistoryItem[];
      totalGaji: number;
    }>();

    payrollHistory.forEach(h => {
      const periode = h.Bulan_Tahun || '2026-10';
      const batchId = h.ID_Batch || `BATCH-${periode}`;
      const existing = groups.get(periode);
      if (existing) {
        existing.items.push(h);
        existing.totalGaji += (h.Gaji_Bersih || 0);
        if (h.Tanggal_Pencairan && !existing.tanggalPencairan) {
          existing.tanggalPencairan = h.Tanggal_Pencairan;
        }
      } else {
        groups.set(periode, {
          batchId,
          periode,
          tanggalPencairan: h.Tanggal_Pencairan || h.Bulan_Tahun,
          items: [h],
          totalGaji: h.Gaji_Bersih || 0
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => b.periode.localeCompare(a.periode));
  }, [payrollHistory]);

  const toggleBatchExpand = (periode: string) => {
    setExpandedBatches(prev => ({
      ...prev,
      [periode]: !prev[periode]
    }));
  };

  // Identify employees who have special attendance notes this month
  const employeesWithNotes = React.useMemo(() => {
    return attendanceRows.filter(row => {
      const hasNotes = row.Catatan_Presensi && Object.keys(row.Catatan_Presensi).length > 0;
      const hasNonHadir = (row.Total_T || 0) > 0 || (row.Total_I || 0) > 0 || (row.Total_S || 0) > 0 || 
                          (row.Total_C || 0) > 0 || (row.Total_A || 0) > 0 || (row.Total_PA || 0) > 0;
      return hasNotes || hasNonHadir;
    });
  }, [attendanceRows]);

  const isSlipModalPrinting = Boolean(viewSlipModal);

  return (
    <div>
      {/* Background Main Dashboard Content (Hidden when modal document is printed) */}
      <div className={`space-y-6 ${isSlipModalPrinting ? 'print:hidden' : ''}`}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Users className="text-blue-600" size={24} />
              SDM, Presensi Harian &amp; Penggajian
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manajemen presensi harian, lembur karyawan, pinjaman kasbon, dan slip gaji resmi PT Anugerah Illahi Rabbi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-white text-slate-900 shadow-xs"
            />

            {/* Tombol Cetak Landscape/Portrait */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => handlePrintDocument('landscape')}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 cursor-pointer"
                title="Cetak Halaman (Format Landscape / Horisontal)"
              >
                <Printer size={13} className="text-blue-600" />
                <span>Cetak Horisontal</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrintDocument('portrait')}
                className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded flex items-center gap-1 cursor-pointer border-l border-slate-200"
                title="Cetak Halaman (Format Portrait / Vertikal)"
              >
                <Printer size={13} />
                <span>Vertikal</span>
              </button>
            </div>

            {/* Tombol Pengaturan Ketentuan Potongan & Bonus */}
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Atur ketentuan potongan, bonus kehadiran, dan format slip gaji"
            >
              <Settings size={14} className="text-slate-600" />
              <span className="hidden sm:inline">Ketentuan Gaji &amp; Slip</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-px text-xs font-medium no-print">
          <button
            onClick={() => setActiveTab('presensi')}
            className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'presensi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Calendar size={14} />
            <span>1. Presensi Karyawan ({employees.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('lembur')}
            className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lembur' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock size={14} />
            <span>2. Lembur Karyawan (Input Jam)</span>
          </button>
          <button
            onClick={() => setActiveTab('gaji')}
            className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'gaji' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <DollarSign size={14} />
            <span>3. Perhitungan Gaji &amp; Slip</span>
          </button>
          <button
            onClick={() => setActiveTab('kasbon')}
            className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'kasbon' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>4. Pinjaman Kasbon ({kasbons.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('histori')}
            className={`px-4 py-2 border-b-2 font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'histori' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>5. Histori Paket Penggajian ({groupedBatches.length} Paket)</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* 1. TAB PRESENSI KARYAWAN (H, T, I, S, C, A, PA, L)             */}
        {/* ============================================================== */}
        {activeTab === 'presensi' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rekap Presensi Harian Karyawan (Model Tabel ke Samping)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periode: <strong>{formatBulanIndo(filterMonth)}</strong> ({daysInMonth} Hari). Status: 
                  <span className="font-semibold text-slate-700 ml-1">
                    H (Hadir), T (Telat), I (Izin), S (Sakit), C (Cuti), A (Alpa), PA (Pulang Awal), L (Libur).
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickFillAllHadir}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Isi otomatis kehadiran hari kerja"
                >
                  <CheckCheck size={14} />
                  <span>Isi Semua Hadir</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportDataToExcel(attendanceRows, 'Presensi', `AIRIS_Presensi_${filterMonth}`)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Tabel Presensi Ke Samping */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="p-2.5 sticky left-0 bg-slate-100 z-10 min-w-[150px] border-r">Nama Karyawan</th>
                      <th className="p-2.5 min-w-[90px] border-r">Jabatan</th>
                      {dayNumbers.map(d => {
                        const dt = new Date(year, month - 1, d);
                        const isSun = dt.getDay() === 0;
                        return (
                          <th key={d} className={`p-1.5 text-center w-8 border-r text-[10px] ${isSun ? 'bg-rose-50 text-rose-600 font-bold' : ''}`}>
                            {d}
                          </th>
                        );
                      })}
                      <th className="p-2 text-center bg-emerald-50 text-emerald-800 font-bold border-l" title="Hadir">H</th>
                      <th className="p-2 text-center bg-amber-50 text-amber-800 font-bold" title="Telat">T</th>
                      <th className="p-2 text-center bg-blue-50 text-blue-800 font-bold" title="Izin">I</th>
                      <th className="p-2 text-center bg-purple-50 text-purple-800 font-bold" title="Sakit">S</th>
                      <th className="p-2 text-center bg-cyan-50 text-cyan-800 font-bold" title="Cuti">C</th>
                      <th className="p-2 text-center bg-rose-50 text-rose-800 font-bold" title="Alpa">A</th>
                      <th className="p-2 text-center bg-orange-50 text-orange-800 font-bold" title="Pulang Awal">PA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {attendanceRows.map(row => {
                      const emp = employees.find(e => e.ID_Karyawan === row.ID_Karyawan);
                      return (
                        <tr key={row.ID_Karyawan} className="hover:bg-slate-50/80">
                          <td className="p-2.5 font-sans font-semibold text-slate-900 sticky left-0 bg-white z-10 border-r whitespace-nowrap">
                            {row.Nama_Karyawan}
                          </td>
                          <td className="p-2.5 font-sans text-slate-500 whitespace-nowrap border-r">{emp?.Jabatan}</td>
                          {dayNumbers.map(d => {
                            const val = ((row as any)[`T${d}`] || 'H') as string;
                            const dt = new Date(year, month - 1, d);
                            const isSun = dt.getDay() === 0;
                            const noteObj = row.Catatan_Presensi?.[d];
                            const hasNote = Boolean(noteObj?.keterangan || (noteObj?.menitTelat && noteObj.menitTelat > 0));
                            const noteTooltip = val === 'T' && noteObj?.menitTelat 
                              ? `Telat ${noteObj.menitTelat} menit${noteObj.keterangan ? `: ${noteObj.keterangan}` : ''}`
                              : (noteObj?.keterangan || `Ubah status presensi tgl ${d}`);

                            return (
                              <td key={d} className={`p-1 text-center border-r relative ${isSun ? 'bg-rose-50/40' : ''}`}>
                                <div className="relative inline-block">
                                  <select
                                    value={val}
                                    onChange={e => handleUpdateAttendanceCell(row.ID_Karyawan, d, e.target.value)}
                                    title={noteTooltip}
                                    className={`w-8 h-6 text-center text-[10px] font-bold rounded border outline-none cursor-pointer transition ${
                                      val === 'H' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                                      val === 'T' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                      val === 'A' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                                      val === 'PA' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                      val === 'I' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                      val === 'S' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                      val === 'C' ? 'bg-cyan-100 text-cyan-800 border-cyan-300' :
                                      'bg-slate-100 text-slate-400 border-slate-200'
                                    }`}
                                  >
                                    <option value="H">H</option>
                                    <option value="T">T</option>
                                    <option value="I">I</option>
                                    <option value="S">S</option>
                                    <option value="C">C</option>
                                    <option value="A">A</option>
                                    <option value="PA">PA</option>
                                    <option value="L">L</option>
                                  </select>
                                  {hasNote && (
                                    <span 
                                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600 ring-1 ring-white"
                                      title={noteTooltip}
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 text-center font-bold text-emerald-700 border-l bg-emerald-50/30">{row.Total_H}</td>
                          <td className="p-2 text-center font-bold text-amber-700 bg-amber-50/30">
                            <div>{row.Total_T}</div>
                            {(row.Total_Menit_Telat || 0) > 0 && (
                              <div className="text-[9px] font-sans font-medium text-amber-600">({row.Total_Menit_Telat}m)</div>
                            )}
                          </td>
                          <td className="p-2 text-center font-bold text-blue-700 bg-blue-50/30">{row.Total_I}</td>
                          <td className="p-2 text-center font-bold text-purple-700 bg-purple-50/30">{row.Total_S}</td>
                          <td className="p-2 text-center font-bold text-cyan-700 bg-cyan-50/30">{row.Total_C}</td>
                          <td className="p-2 text-center font-bold text-rose-600 bg-rose-50/30">{row.Total_A}</td>
                          <td className="p-2 text-center font-bold text-orange-600 bg-orange-50/30">{row.Total_PA}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Catatan / Keterangan Karyawan di Bawah Tabel Presensi (Per Karyawan) */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Catatan &amp; Keterangan Presensi Karyawan — Periode: {formatBulanIndo(filterMonth)}
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Daftar keterangan khusus untuk status Izin, Sakit, Cuti, Alpa, Telat &amp; Pulang Awal
                </span>
              </div>

              {employeesWithNotes.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 fst-italic bg-slate-50 rounded-xl border border-slate-100">
                  Seluruh karyawan tercatat Hadir/Libur normal tanpa catatan ketidakhadiran pada periode {formatBulanIndo(filterMonth)}.
                </div>
              ) : (
                <div className="space-y-4">
                  {employeesWithNotes.map(row => {
                    const emp = employees.find(e => e.ID_Karyawan === row.ID_Karyawan);
                    const noteEntries = Object.entries(row.Catatan_Presensi || {})
                      .map(([d, note]) => ({ day: parseInt(d, 10), ...note }))
                      .sort((a, b) => a.day - b.day);

                    return (
                      <div key={row.ID_Karyawan} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{row.Nama_Karyawan}</span>
                            <span className="text-[11px] text-slate-500 font-sans">({emp?.Jabatan || 'Staff'})</span>
                          </div>

                          {/* Attendance Count Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">H: {row.Total_H}</span>
                            {row.Total_T! > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">T: {row.Total_T}</span>}
                            {row.Total_I! > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">I: {row.Total_I}</span>}
                            {row.Total_S! > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">S: {row.Total_S}</span>}
                            {row.Total_C! > 0 && <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-bold">C: {row.Total_C}</span>}
                            {row.Total_A! > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">A: {row.Total_A}</span>}
                            {row.Total_PA! > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">PA: {row.Total_PA}</span>}

                            {/* Akumulasi Total Telat */}
                            {(row.Total_Menit_Telat || 0) > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold flex items-center gap-1 shadow-xs ml-1 font-sans">
                                <Clock size={11} />
                                <span>Akumulasi Telat: {row.Total_Menit_Telat} Menit</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* List of Dated Notes */}
                        {noteEntries.length === 0 ? (
                          <p className="text-[11px] text-slate-400 fst-italic">
                            Terdapat rekap non-hadir namun belum ada teks keterangan rinci yang disimpan.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {noteEntries.map(entry => (
                              <div key={entry.day} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs shadow-xs flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono font-bold text-slate-700 text-[11px]">Tgl {String(entry.day).padStart(2, '0')}:</span>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      entry.status === 'I' ? 'bg-blue-100 text-blue-800' :
                                      entry.status === 'S' ? 'bg-purple-100 text-purple-800' :
                                      entry.status === 'C' ? 'bg-cyan-100 text-cyan-800' :
                                      entry.status === 'A' ? 'bg-rose-100 text-rose-800' :
                                      entry.status === 'PA' ? 'bg-orange-100 text-orange-800' :
                                      'bg-amber-100 text-amber-800'
                                    }`}>
                                      {entry.status === 'I' ? 'Izin' :
                                       entry.status === 'S' ? 'Sakit' :
                                       entry.status === 'C' ? 'Cuti' :
                                       entry.status === 'A' ? 'Alpa' :
                                       entry.status === 'PA' ? 'Pulang Awal' : 'Telat'}
                                    </span>
                                    {entry.status === 'T' && (entry.menitTelat || 0) > 0 && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900 font-mono flex items-center gap-0.5">
                                        <Clock size={10} />
                                        <span>+{entry.menitTelat} Menit</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-600 text-[11px] leading-relaxed">
                                    "{entry.keterangan}"
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAttendanceCell(row.ID_Karyawan, entry.day, entry.status)}
                                  className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-50 cursor-pointer"
                                  title="Edit keterangan ini"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. TAB LEMBUR KARYAWAN MODEL TABLE KE SAMPING (INPUT ANGKA)    */}
        {/* ============================================================== */}
        {activeTab === 'lembur' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Input Jam Lembur Karyawan (Model Tabel ke Samping)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input angka jam lembur harian per karyawan (contoh: 2, 3.5, 4 jam). Total jam otomatis diintegrasikan ke perhitungan slip gaji!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportDataToExcel(overtimeRows, 'Lembur', `AIRIS_Lembur_${filterMonth}`)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="p-2.5 sticky left-0 bg-slate-100 z-10 min-w-[150px] border-r">Nama Karyawan</th>
                      <th className="p-2.5 min-w-[90px] border-r">Jabatan</th>
                      {dayNumbers.map(d => {
                        const dt = new Date(year, month - 1, d);
                        const isSun = dt.getDay() === 0;
                        return (
                          <th key={d} className={`p-1.5 text-center w-8 border-r text-[10px] ${isSun ? 'bg-rose-50 text-rose-600 font-bold' : ''}`}>
                            {d}
                          </th>
                        );
                      })}
                      <th className="p-2 text-center bg-blue-50 text-blue-800 font-bold border-l min-w-[70px]">Total Jam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {overtimeRows.map(row => {
                      const emp = employees.find(e => e.ID_Karyawan === row.ID_Karyawan);
                      return (
                        <tr key={row.ID_Karyawan} className="hover:bg-slate-50">
                          <td className="p-2.5 font-sans font-semibold text-slate-900 sticky left-0 bg-white z-10 border-r whitespace-nowrap">
                            {row.Nama_Karyawan}
                          </td>
                          <td className="p-2.5 font-sans text-slate-500 whitespace-nowrap border-r">{emp?.Jabatan}</td>
                          {dayNumbers.map(d => {
                            const val = (row as any)[`T${d}`] ?? 0;
                            const dt = new Date(year, month - 1, d);
                            const isSun = dt.getDay() === 0;
                            return (
                              <td key={d} className={`p-1 text-center border-r ${isSun ? 'bg-rose-50/40' : ''}`}>
                                <input
                                  type="number"
                                  min={0}
                                  max={24}
                                  step={0.5}
                                  value={val === 0 ? '' : val}
                                  placeholder="0"
                                  onChange={e => handleUpdateOvertimeCell(row.ID_Karyawan, d, e.target.value)}
                                  className={`w-8 h-6 text-center text-[10px] font-bold rounded border outline-none ${
                                    val > 0 ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold' : 'border-slate-200 text-slate-400'
                                  }`}
                                />
                              </td>
                            );
                          })}
                          <td className="p-2 text-center font-bold text-blue-800 border-l bg-blue-50/40">
                            {row.Total_Jam_Lembur} Jam
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. TAB: PERHITUNGAN GAJI & SLIP GAJI                          */}
        {/* ============================================================== */}
        {activeTab === 'gaji' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rekapitulasi Penggajian Karyawan — Periode: {formatBulanIndo(filterMonth)}
                </h3>
                <p className="text-xs text-slate-500">
                  Ketentuan potongan dan bonus dikalkulasikan otomatis. Klik tombol "Cairkan 1 Paket" untuk mengunci dan mengirim ke Keuangan.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Settings size={13} className="text-slate-600" />
                  <span>Setting Potongan &amp; Bonus</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportDataToExcel(payrollData, 'Rekap_Gaji', `AIRIS_Payroll_${filterMonth}`)}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisbursePayrollBatch}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Layers size={14} />
                  <span>Cairkan Gaji Bulan Ini (1 Paket)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Nama Karyawan</th>
                    <th className="p-3">Jabatan</th>
                    <th className="p-3 text-right">Gaji Pokok</th>
                    <th className="p-3 text-right">Tunjangan</th>
                    <th className="p-3 text-right">Bonus Hadir</th>
                    <th className="p-3 text-right text-blue-800">Lembur (Jam / Upah)</th>
                    <th className="p-3 text-right text-rose-600">BPJS &amp; PPh</th>
                    <th className="p-3 text-right text-rose-600">Pot. Absensi</th>
                    <th className="p-3 text-right text-rose-600">Pot. Kasbon</th>
                    <th className="p-3 text-right font-bold text-slate-900">Gaji Bersih (THP)</th>
                    <th className="p-3 text-center">Slip Gaji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {payrollData.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-sans font-semibold text-slate-900">{p.nama}</td>
                      <td className="p-3 font-sans text-slate-500">{p.jabatan}</td>
                      <td className="p-3 text-right tabular-nums">Rp {p.gapok.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right tabular-nums">Rp {p.tunjangan.toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-700 font-semibold">
                        {p.bonusHadir > 0 ? `Rp ${p.bonusHadir.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right tabular-nums text-blue-800 font-semibold">
                        {p.jamLembur} Jam • Rp {Math.round(p.upahLembur).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-right tabular-nums text-rose-600">-Rp {Math.round(p.pph21 + p.bpjs).toLocaleString('id-ID')}</td>
                      <td className="p-3 text-right tabular-nums text-rose-600">
                        {p.potongAbsen > 0 ? `-Rp ${Math.round(p.potongAbsen).toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right tabular-nums text-rose-600 font-semibold">
                        {p.kasbon > 0 ? `-Rp ${p.kasbon.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-sm text-emerald-800 tabular-nums">
                        Rp {Math.round(p.gajiBersih).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => setViewSlipModal(p)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Receipt size={12} className="text-blue-600" />
                          <span>Lihat Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. TAB: DAFTAR KASBON DENGAN TAMBAH, EDIT & HAPUS             */}
        {/* ============================================================== */}
        {activeTab === 'kasbon' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Daftar Pinjaman Kasbon Karyawan &amp; Status Angsuran</h3>
                <p className="text-xs text-slate-500">Seluruh data pinjaman kasbon dapat diedit atau dihapus secara langsung.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddKasbon}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Input Kasbon Baru</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">ID Kasbon</th>
                    <th className="p-3">Tanggal Pinjam</th>
                    <th className="p-3">Nama Karyawan</th>
                    <th className="p-3 text-right">Total Pinjaman</th>
                    <th className="p-3 text-center">Tenor Angsuran</th>
                    <th className="p-3 text-right">Cicilan / Bulan</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {kasbons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 fst-italic font-sans">
                        Tidak ada catatan kasbon karyawan aktif.
                      </td>
                    </tr>
                  ) : (
                    kasbons.map(k => (
                      <tr key={k.ID_Kasbon} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-blue-700">{k.ID_Kasbon}</td>
                        <td className="p-3 text-slate-600 font-mono">{formatDateDDMMYYYY(k.Tanggal)}</td>
                        <td className="p-3 font-sans font-semibold text-slate-900">{k.Nama_Karyawan}</td>
                        <td className="p-3 text-right font-bold tabular-nums">Rp {k.Nominal.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center font-sans">{k.Tenor} Bulan</td>
                        <td className="p-3 text-right text-rose-700 font-bold tabular-nums">Rp {k.Cicilan_Per_Bulan.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditKasbon(k)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              title="Edit Pinjaman"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKasbon(k.ID_Kasbon)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Hapus Pinjaman"
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
        {/* 5. TAB: HISTORI PENGGAJIAN DALAM 1 PAKET (BATCH)               */}
        {/* Dihapus dan Disimpan dalam 1 Paket                             */}
        {/* ============================================================== */}
        {activeTab === 'histori' && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Histori Paket Penggajian yang Telah Dicairkan</h3>
                <p className="text-xs text-slate-500">
                  Data penggajian dikelola dalam 1 paket per periode. Hapus atau cetak seluruh paket secara utuh.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportDataToExcel(payrollHistory, 'Histori_Gaji', 'AIRIS_Histori_Penggajian')}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {groupedBatches.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 fst-italic bg-white rounded-xl border border-slate-200">
                Belum ada histori paket pencairan gaji. Klik tombol "Cairkan Gaji Bulan Ini (1 Paket)" pada Tab 3 untuk menyimpan paket penggajian baru.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedBatches.map(batch => {
                  const isExpanded = expandedBatches[batch.periode] ?? true;

                  return (
                    <div key={batch.periode} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      {/* Batch Header Bar */}
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                            <Layers size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">
                                Paket Penggajian: {formatBulanIndo(batch.periode)}
                              </h4>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                {batch.batchId}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Pencairan: {formatDateDDMMYYYY(batch.tanggalPencairan) || batch.periode} &bull; {batch.items.length} Karyawan
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Pengeluaran Gaji</span>
                            <span className="font-mono font-bold text-sm text-emerald-800">
                              Rp {Math.round(batch.totalGaji).toLocaleString('id-ID')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleBatchExpand(batch.periode)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                              title="Buka / Tutup Rincian Paket Ini"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              <span>{isExpanded ? 'Tutup' : 'Rincian'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(batch.batchId, batch.periode)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
                              title="Hapus 1 Paket Penggajian Ini Sekaligus"
                            >
                              <Trash2 size={13} />
                              <span>Hapus 1 Paket</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Batch Employee List (Expandable) */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-white text-slate-600 font-semibold border-b border-slate-100">
                              <tr>
                                <th className="p-2.5 pl-4">Karyawan</th>
                                <th className="p-2.5 text-right">Gaji Pokok</th>
                                <th className="p-2.5 text-right">Tunjangan</th>
                                <th className="p-2.5 text-right">Bonus</th>
                                <th className="p-2.5 text-right">Lembur</th>
                                <th className="p-2.5 text-right text-rose-600">Total Potongan</th>
                                <th className="p-2.5 text-right font-bold text-slate-900">Gaji Bersih</th>
                                <th className="p-2.5 text-center pr-4">Slip</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                              {batch.items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60">
                                  <td className="p-2.5 pl-4 font-sans font-semibold text-slate-900">
                                    {it.Nama_Karyawan}
                                  </td>
                                  <td className="p-2.5 text-right tabular-nums">Rp {it.Gaji_Pokok.toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 text-right tabular-nums">Rp {it.Tunjangan.toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 text-right tabular-nums text-emerald-700">Rp {(it.Bonus_Hadir + it.Bonus_Target).toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 text-right tabular-nums text-blue-700">Rp {Math.round(it.Upah_Lembur).toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 text-right tabular-nums text-rose-600">-Rp {Math.round(it.Total_Potongan).toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 text-right font-bold text-emerald-800 tabular-nums">Rp {Math.round(it.Gaji_Bersih).toLocaleString('id-ID')}</td>
                                  <td className="p-2.5 text-center pr-4 font-sans">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const emp = employees.find(e => e.ID_Karyawan === it.ID_Karyawan);
                                        setViewSlipModal({
                                          id: it.ID_Karyawan,
                                          nama: it.Nama_Karyawan,
                                          jabatan: emp?.Jabatan || 'Staff',
                                          gapok: it.Gaji_Pokok,
                                          tunjangan: it.Tunjangan,
                                          bonusHadir: it.Bonus_Hadir,
                                          bonusTarget: it.Bonus_Target,
                                          jamLembur: it.Jam_Lembur || 0,
                                          jamLembur15: it.Jam_Lembur_15 || it.Jam_Lembur || 0,
                                          jamLembur20: it.Jam_Lembur_20 || 0,
                                          upahLembur: it.Upah_Lembur,
                                          pph21: it.PPh21,
                                          bpjs: it.BPJS,
                                          bpjsKetenagakerjaan: it.BPJS_Ketenagakerjaan || it.BPJS,
                                          bpjsKesehatan: it.BPJS_Kesehatan || 0,
                                          kasbon: it.Kasbon,
                                          potongAbsen: it.Potongan_Absen,
                                          totalPendapatan: it.Total_Pendapatan,
                                          totalPotongan: it.Total_Potongan,
                                          gajiBersih: it.Gaji_Bersih
                                        });
                                      }}
                                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold cursor-pointer"
                                      title="Cetak Slip Gaji Karyawan Ini"
                                    >
                                      Slip
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: INPUT ALASAN / KETERANGAN PRESENSI                       */}
      {/* Muncul jika memilih I, S, C, A, PA                             */}
      {/* ============================================================== */}
      {attendanceNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Keterangan Presensi ({attendanceNoteModal.empName})
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setAttendanceNoteModal(null)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Tanggal Presensi</span>
                  <span className="font-bold text-slate-800">
                    Tanggal {attendanceNoteModal.day} {formatBulanIndo(filterMonth)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status Dipilih</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold inline-block mt-0.5 ${
                    attendanceNoteModal.status === 'I' ? 'bg-blue-100 text-blue-800' :
                    attendanceNoteModal.status === 'S' ? 'bg-purple-100 text-purple-800' :
                    attendanceNoteModal.status === 'C' ? 'bg-cyan-100 text-cyan-800' :
                    attendanceNoteModal.status === 'A' ? 'bg-rose-100 text-rose-800' :
                    attendanceNoteModal.status === 'PA' ? 'bg-orange-100 text-orange-800' :
                    attendanceNoteModal.status === 'T' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {attendanceNoteModal.status === 'I' ? 'Izin' :
                     attendanceNoteModal.status === 'S' ? 'Sakit' :
                     attendanceNoteModal.status === 'C' ? 'Cuti' :
                     attendanceNoteModal.status === 'A' ? 'Alpa' :
                     attendanceNoteModal.status === 'PA' ? 'Pulang Awal' :
                     attendanceNoteModal.status === 'T' ? 'Telat (Terlambat)' : attendanceNoteModal.status}
                  </span>
                </div>
              </div>

              {/* Special Input for Status 'T' (Telat): Berapa Menit Terlambat */}
              {attendanceNoteModal.status === 'T' && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                      <Clock size={15} className="text-amber-600" />
                      <span>Berapa Menit Terlambat?</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      {attendanceNoteModal.menitTelat || 0} Menit
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={attendanceNoteModal.menitTelat ?? ''}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setAttendanceNoteModal(prev => prev ? ({
                          ...prev,
                          menitTelat: val,
                          keterangan: prev.keterangan && !prev.keterangan.startsWith('Terlambat ')
                            ? prev.keterangan
                            : (val > 0 ? `Terlambat ${val} menit` : '')
                        }) : null);
                      }}
                      placeholder="Contoh: 15"
                      className="w-32 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-slate-600 font-medium">Menit</span>
                  </div>

                  {/* Preset Quick Chips for Late Minutes */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-200/60">
                    <span className="text-[10px] text-amber-800 font-semibold">Preset Menit:</span>
                    {[5, 10, 15, 20, 30, 45, 60, 90].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setAttendanceNoteModal(prev => prev ? ({
                            ...prev,
                            menitTelat: m,
                            keterangan: prev.keterangan && !prev.keterangan.startsWith('Terlambat ')
                              ? prev.keterangan
                              : `Terlambat ${m} menit`
                          }) : null);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                          attendanceNoteModal.menitTelat === m
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Fill Chips */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 text-[11px]">Pilihan Alasan Cepat:</label>
                <div className="flex flex-wrap gap-1.5">
                  {(attendanceNoteModal.status === 'T'
                    ? ['Macet di Perjalanan', 'Kendala Kendaraan / Ban Bocor', 'Hujan Lebat / Cuaca Buruk', 'Keperluan Mendadak Keluarga', 'Antrean BBM']
                    : attendanceNoteModal.status === 'I'
                    ? ['Urusan Keluarga', 'Perpanjang SIM/KTP', 'Acara Sekolah Anak', 'Keperluan Mendesak']
                    : attendanceNoteModal.status === 'S'
                    ? ['Demam / Flu (Bedrest)', 'Surat Dokter Terlampir', 'Rawat Jalan Klinik', 'Sakit Gigi']
                    : attendanceNoteModal.status === 'C'
                    ? ['Cuti Tahunan', 'Cuti Menikah', 'Cuti Khusus', 'Cuti Melahirkan']
                    : attendanceNoteModal.status === 'PA'
                    ? ['Pulang Cepat (Kondisi Drop)', 'Urusan Bank', 'Keperluan Mendesak Keluarga', 'Pulang Jam 14:00']
                    : ['Tanpa Keterangan', 'Tidak Masuk Tanpa Izin']
                  ).map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAttendanceNoteModal(prev => prev ? ({
                        ...prev,
                        keterangan: prev.status === 'T' && prev.menitTelat
                          ? `Terlambat ${prev.menitTelat} menit (${chip})`
                          : chip
                      }) : null)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-[11px] text-slate-600 transition cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Alasan Rinci:
                </label>
                <textarea
                  rows={3}
                  value={attendanceNoteModal.keterangan}
                  onChange={e => setAttendanceNoteModal({ ...attendanceNoteModal, keterangan: e.target.value })}
                  placeholder={attendanceNoteModal.status === 'T' ? "Contoh: Terlambat 15 menit karena macet di jalan..." : "Tuliskan keterangan detail atau alasan ketidakhadiran di sini..."}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  autoFocus={attendanceNoteModal.status !== 'T'}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAttendanceNoteModal(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAttendanceNoteModal}
                className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>Simpan Keterangan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SETTING KETENTUAN POTONGAN, BONUS & FORMAT SLIP GAJI    */}
      {/* ============================================================== */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Pengaturan Ketentuan Potongan, Bonus &amp; Format Slip Gaji
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs max-h-[75vh] overflow-y-auto">
              {/* Bagian 1: Ketentuan Bonus */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-200 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-600" />
                  1. Ketentuan Bonus &amp; Upah Lembur
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Bonus Kehadiran Penuh (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.bonusHadirFull}
                      onChange={e => setPayrollSettings({ ...payrollSettings, bonusHadirFull: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Diberikan jika tidak ada Alpa/Izin/Pulang Awal</span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Bonus Target Default (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.bonusTargetDefault}
                      onChange={e => setPayrollSettings({ ...payrollSettings, bonusTargetDefault: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Rumus Perhitungan Upah Lembur</label>
                    <select
                      value={payrollSettings.useDepnakerFormula ? 'depnaker' : 'flat'}
                      onChange={e => setPayrollSettings({ ...payrollSettings, useDepnakerFormula: e.target.value === 'depnaker' })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value="depnaker">Standar Depnaker (Gapok / 173 × 1.5)</option>
                      <option value="flat">Tarif Flat per Jam</option>
                    </select>
                  </div>

                  {!payrollSettings.useDepnakerFormula && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Tarif Lembur per Jam Flat (Rp)</label>
                      <input
                        type="number"
                        value={payrollSettings.tarifLemburPerJam}
                        onChange={e => setPayrollSettings({ ...payrollSettings, tarifLemburPerJam: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bagian 2: Ketentuan Potongan Absensi */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-200 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-rose-600" />
                  2. Ketentuan Denda / Potongan Absensi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Potongan per Hari Alpa (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.potonganAlpaPerHari}
                      onChange={e => setPayrollSettings({ ...payrollSettings, potonganAlpaPerHari: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-rose-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Potongan per Hari Izin (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.potonganIzinPerHari}
                      onChange={e => setPayrollSettings({ ...payrollSettings, potonganIzinPerHari: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-rose-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Denda per Kejadian Telat (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.potonganTelatPerKejadian}
                      onChange={e => setPayrollSettings({ ...payrollSettings, potonganTelatPerKejadian: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-rose-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Denda per Kejadian Pulang Awal (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.potonganPulangAwalPerKejadian}
                      onChange={e => setPayrollSettings({ ...payrollSettings, potonganPulangAwalPerKejadian: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-rose-700"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 3: BPJS & Pajak PPh */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-200 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-blue-600" />
                  3. Potongan Tetap BPJS &amp; PPh 21
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">BPJS Ketenagakerjaan (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.bpjsKetenagakerjaanNominal}
                      onChange={e => setPayrollSettings({ ...payrollSettings, bpjsKetenagakerjaanNominal: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">BPJS Kesehatan (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.bpjsKesehatanNominal}
                      onChange={e => setPayrollSettings({ ...payrollSettings, bpjsKesehatanNominal: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">PPh 21 Default (Rp)</label>
                    <input
                      type="number"
                      value={payrollSettings.pph21Nominal}
                      onChange={e => setPayrollSettings({ ...payrollSettings, pph21Nominal: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 4: Format Kop & Penandatangan Slip Gaji */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-200 flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-600" />
                  4. Kop Surat &amp; Penandatangan Slip Gaji Resmi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Perusahaan (Kop Atas)</label>
                    <input
                      type="text"
                      value={payrollSettings.namaPerusahaan}
                      onChange={e => setPayrollSettings({ ...payrollSettings, namaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Alamat / Tagline Sub-Kop</label>
                    <input
                      type="text"
                      value={payrollSettings.subNamaPerusahaan}
                      onChange={e => setPayrollSettings({ ...payrollSettings, subNamaPerusahaan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Nama Penandatangan HRD</label>
                    <input
                      type="text"
                      value={payrollSettings.penandatanganNama}
                      onChange={e => setPayrollSettings({ ...payrollSettings, penandatanganNama: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Jabatan Penandatangan HRD</label>
                    <input
                      type="text"
                      value={payrollSettings.penandatanganJabatan}
                      onChange={e => setPayrollSettings({ ...payrollSettings, penandatanganJabatan: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-1.5 text-xs text-slate-600 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePayrollSettings}
                className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>Simpan Pengaturan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: FORM KASBON BARU / EDIT                                 */}
      {/* ============================================================== */}
      {showKasbonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingKasbon ? `Edit Pinjaman Kasbon (${editingKasbon.ID_Kasbon})` : 'Input Pinjaman Kasbon Baru'}
              </h3>
              <button onClick={() => setShowKasbonModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Karyawan Peminjam</label>
                <select
                  value={kasbonForm.ID_Karyawan}
                  onChange={e => setKasbonForm({ ...kasbonForm, ID_Karyawan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                >
                  {employees.map(e => (
                    <option key={e.ID_Karyawan} value={e.ID_Karyawan}>{e.Nama_Karyawan} ({e.Jabatan})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Pinjam</label>
                  <input
                    type="date"
                    value={kasbonForm.Tanggal}
                    onChange={e => setKasbonForm({ ...kasbonForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tenor Angsuran</label>
                  <select
                    value={kasbonForm.Tenor}
                    onChange={e => setKasbonForm({ ...kasbonForm, Tenor: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value={1}>1 Bulan (Lunas Sekaligus)</option>
                    <option value={2}>2 Bulan</option>
                    <option value={3}>3 Bulan</option>
                    <option value={4}>4 Bulan</option>
                    <option value={6}>6 Bulan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Pinjaman (Rp)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={kasbonForm.Nominal ?? ''}
                  onChange={e => setKasbonForm({ ...kasbonForm, Nominal: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Estimasi Pemotongan Gaji:</span>
                <span className="text-sm font-bold font-mono text-blue-700">
                  Rp {Math.round((Number(kasbonForm.Nominal) || 0) / (Number(kasbonForm.Tenor) || 1)).toLocaleString('id-ID')} / bulan
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowKasbonModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveKasbon} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>{editingKasbon ? 'Perbarui Kasbon' : 'Simpan Kasbon'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PRATINJAU SLIP GAJI KARYAWAN RESMI                      */}
      {/* Persis Sesuai Contoh Gambar Media Uploaded                      */}
      {/* ============================================================== */}
      {viewSlipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto printable-modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 printable-modal-card">
            {/* Header Dialog (no-print) */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  Pratinjau Slip Gaji: {viewSlipModal.nama} ({filterMonth})
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintDocument('portrait')}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Cetak Slip dalam format Portrait (Standar)"
                >
                  <Printer size={13} />
                  <span>Cetak Slip (Portrait)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintDocument('landscape')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Cetak Slip dalam format Landscape"
                >
                  <Printer size={13} />
                  <span>Landscape</span>
                </button>

                <button 
                  onClick={() => setViewSlipModal(null)} 
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Konten Kertas Slip Gaji: Model Persis Seperti Gambar */}
            <div className="p-6 sm:p-10 font-sans text-slate-900 printable-content">
              {/* Outer Border Box matching sample image */}
              <div className="border-2 border-slate-900 p-6 sm:p-8 bg-white">
                {/* Header Kop */}
                <div className="text-center pb-2">
                  <h2 className="text-xl sm:text-2xl font-black text-blue-800 tracking-wide uppercase">
                    {payrollSettings.namaPerusahaan}
                  </h2>
                  <p className="text-xs text-slate-700 font-semibold mt-1">
                    {payrollSettings.subNamaPerusahaan}
                  </p>
                  <div className="mt-4">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wider underline underline-offset-4 decoration-2">
                      SLIP GAJI KARYAWAN
                    </h3>
                    <p className="text-xs text-slate-700 font-bold mt-1">
                      Periode: {filterMonth}
                    </p>
                  </div>
                </div>

                <div className="border-t-2 border-slate-900 my-4"></div>

                {/* Metadata Karyawan */}
                <div className="space-y-1 text-xs mb-5">
                  <div className="flex items-center">
                    <span className="w-28 font-bold text-slate-900">Nama Lengkap</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="font-extrabold text-slate-900 uppercase">{viewSlipModal.nama}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 font-bold text-slate-900">Jabatan</span>
                    <span className="mr-2 font-bold">:</span>
                    <span className="text-slate-800 font-semibold">{viewSlipModal.jabatan}</span>
                  </div>
                </div>

                {/* Two-Column Bordered Table: PENERIMAAN vs POTONGAN */}
                <div className="border-2 border-slate-900 overflow-hidden mb-5">
                  {/* Table Header Row */}
                  <div className="grid grid-cols-2 bg-slate-100/90 border-b-2 border-slate-900 font-bold text-xs">
                    <div className="p-2.5 px-3 border-r-2 border-slate-900 text-slate-900 uppercase tracking-wide">
                      PENERIMAAN
                    </div>
                    <div className="p-2.5 px-3 text-slate-900 uppercase tracking-wide">
                      POTONGAN
                    </div>
                  </div>

                  {/* Table Body Content Row */}
                  <div className="grid grid-cols-2 text-xs">
                    {/* Kolom Kiri: Penerimaan */}
                    <div className="p-3 border-r-2 border-slate-900 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">Gaji Pokok</span>
                          <span className="font-mono font-medium">Rp {viewSlipModal.gapok.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">Tunjangan</span>
                          <span className="font-mono font-medium">Rp {viewSlipModal.tunjangan.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">Bonus Kehadiran</span>
                          <span className="font-mono font-medium">Rp {viewSlipModal.bonusHadir.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">Bonus Target</span>
                          <span className="font-mono font-medium">Rp {viewSlipModal.bonusTarget.toLocaleString('id-ID')}</span>
                        </div>
                        <div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-slate-900">Upah Lembur ({viewSlipModal.jamLembur} Jam)</span>
                            <span className="font-mono">Rp {Math.round(viewSlipModal.upahLembur).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="pl-3 text-[11px] text-slate-500 font-sans mt-0.5 space-y-0.5">
                            <div>• Skema 1.5x : {viewSlipModal.jamLembur15 ?? viewSlipModal.jamLembur} Jam</div>
                            <div>• Skema 2.0x : {viewSlipModal.jamLembur20 ?? 0} Jam</div>
                          </div>
                        </div>
                      </div>

                      {/* Total Pendapatan Subtotal Bar */}
                      <div className="pt-2 border-t border-slate-300 font-extrabold flex justify-between bg-slate-50 -mx-3 -mb-3 p-3">
                        <span className="text-slate-900">Total Pendapatan:</span>
                        <span className="font-mono">Rp {Math.round(viewSlipModal.totalPendapatan).toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    {/* Kolom Kanan: Potongan */}
                    <div className="p-3 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">PPh 21</span>
                          <span className="font-mono font-medium">Rp {Math.round(viewSlipModal.pph21).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">BPJS Ketenagakerjaan</span>
                          <span className="font-mono font-medium">Rp {Math.round(viewSlipModal.bpjsKetenagakerjaan || viewSlipModal.bpjs).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">BPJS Kesehatan</span>
                          <span className="font-mono font-medium">Rp {Math.round(viewSlipModal.bpjsKesehatan || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">Kasbon / Pinjaman</span>
                          <span className="font-mono font-medium">Rp {viewSlipModal.kasbon.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">Potongan Absensi</span>
                          <span className="font-mono font-medium">Rp {Math.round(viewSlipModal.potongAbsen).toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      {/* Total Potongan Subtotal Bar */}
                      <div className="pt-2 border-t border-slate-300 font-extrabold flex justify-between bg-slate-50 -mx-3 -mb-3 p-3">
                        <span className="text-slate-900">Total Potongan:</span>
                        <span className="font-mono">Rp {Math.round(viewSlipModal.totalPotongan).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Take Home Pay Box */}
                <div className="border-2 border-slate-900 p-3.5 flex justify-between items-center font-extrabold text-sm mb-12 bg-white">
                  <span className="tracking-wide uppercase text-slate-900">GAJI BERSIH (TAKE HOME PAY):</span>
                  <span className="font-mono text-base text-slate-900">
                    Rp {Math.round(viewSlipModal.gajiBersih).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Tanda Tangan: Diterima Oleh vs Manajer HRD */}
                <div className="grid grid-cols-2 text-center text-xs pt-2">
                  <div>
                    <p className="text-slate-700 mb-16">Diterima Oleh,</p>
                    <p className="font-bold text-slate-900 uppercase">
                      ({viewSlipModal.nama})
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-700 mb-16">{payrollSettings.penandatanganJabatan},</p>
                    <p className="font-bold text-slate-900">
                      ({payrollSettings.penandatanganNama || '.......................'})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Dialog (no-print) */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintDocument('portrait')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13} />
                  <span>Cetak Vertikal (Portrait)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintDocument('landscape')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13} />
                  <span>Horisontal (Landscape)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewSlipModal(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer shadow-xs"
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
