import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Download, Upload, CheckCircle2, 
  AlertCircle, X, ArrowRight, Eye, RefreshCw 
} from 'lucide-react';
import { 
  EXCEL_TEMPLATES, ExcelTemplateType, downloadExcelTemplate, 
  parseExcelFile, importUnifiedPORows 
} from '../services/excelService';
import { 
  saveTableData, getTableData, normalizeTableRows, 
  syncTableToSupabaseExplicit, getSupabaseConfig, TABLE_PRIMARY_KEYS,
  deduplicateMasterProductsAndFixRelations 
} from '../services/dbAdapter';
import { syncAllModulesToFinance } from '../services/financeSyncService';
import { sanitizeAndRepairDistributionDatabase, importDistributionExcelFile, importDistributionRows } from '../services/distributionService';
import { showToast } from './ToastContainer';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: ExcelTemplateType;
  onDataImported?: () => void;
  onImportCompleted?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  defaultModule = 'produk',
  onDataImported,
  onImportCompleted,
}) => {
  const notifyImportDone = () => {
    if (onImportCompleted) onImportCompleted();
    if (onDataImported) onDataImported();
  };
  const [selectedModule, setSelectedModule] = useState<ExcelTemplateType>(defaultModule);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Sync selectedModule whenever modal is opened with a specific defaultModule
  useEffect(() => {
    if (isOpen) {
      setSelectedModule(defaultModule);
      setParsedRows([]);
      setFile(null);
      setStatusMessage(null);
      setAvailableSheets([]);
      setSelectedSheet('');
    }
  }, [isOpen, defaultModule]);

  if (!isOpen) return null;

  const currentTemplate = EXCEL_TEMPLATES[selectedModule];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setParsing(true);
    setStatusMessage(null);

    const result = await parseExcelFile(uploadedFile, selectedModule);
    setParsing(false);

    if (result.success && result.data) {
      // Auto-detect modul jika file yang diunggah cocok dengan kolom pengiriman distribusi
      let activeMod = selectedModule;
      if (activeMod !== 'distribusi' && result.data.length > 0) {
        const firstRow = result.data[0];
        const keys = Object.keys(firstRow).map(k => k.toLowerCase().replace(/[\s_\-./]+/g, ''));
        const isDistFile = keys.some(k => k.includes('suratjalan') || k.includes('pengirim') || k.includes('c120') || k.includes('c220') || k.includes('b330') || k.includes('b600') || k.includes('g19') || k.includes('tanggalkirim'));
        const sheetIsDist = String(result.sheetName || '').toLowerCase().includes('dist');
        if (isDistFile || sheetIsDist) {
          activeMod = 'distribusi';
          setSelectedModule('distribusi');
        }
      }

      setParsedRows(result.data);
      setAvailableSheets(result.sheetNames || []);
      setSelectedSheet(result.sheetName || '');
      setStatusMessage({
        type: 'success',
        text: `Berhasil membaca ${result.data.length} baris data dari sheet "${result.sheetName || 'Data'}" (${uploadedFile.name}). Silakan klik "Import Data ke Sistem" di bawah untuk menyimpan ke aplikasi.`,
      });
    } else {
      setParsedRows([]);
      setAvailableSheets(result.sheetNames || []);
      setSelectedSheet('');
      setStatusMessage({
        type: 'error',
        text: result.error || 'Gagal membaca format file Excel.',
      });
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (!file) return;
    setSelectedSheet(sheetName);
    setParsing(true);
    setStatusMessage(null);
    const result = await parseExcelFile(file, selectedModule, sheetName);
    setParsing(false);
    if (result.success && result.data) {
      setParsedRows(result.data);
      setStatusMessage({
        type: 'success',
        text: `Berhasil beralih ke sheet "${sheetName}" (${result.data.length} baris terbaca).`,
      });
    } else {
      setParsedRows([]);
      setStatusMessage({
        type: 'error',
        text: result.error || `Gagal membaca sheet "${sheetName}".`,
      });
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);

    try {
      // Map module to table
      let tableName = '';
      switch (selectedModule) {
        case 'produk': tableName = 'MD_Produk'; break;
        case 'pelanggan': tableName = 'MD_Pelanggan'; break;
        case 'supplier': tableName = 'MD_Supplier'; break;
        case 'bahan': tableName = 'MD_BahanPenolong'; break;
        case 'bom': tableName = 'MD_BOM'; break;
        case 'karyawan': tableName = 'MD_Karyawan'; break;
        case 'spk': tableName = 'SPK'; break;
        case 'produksi': tableName = 'Produksi'; break;
        case 'distribusi': tableName = 'Distribusi'; break;
        case 'pembelian_bahan': tableName = 'Pembelian_Bahan'; break;
        case 'mutasi_bahan': tableName = 'Mutasi_Bahan'; break;
        case 'qc': tableName = 'Data_QC'; break;
        case 'coa_saldo': tableName = 'Master_COA'; break;
        case 'jurnal': tableName = 'Jurnal_Umum'; break;
        case 'kasbon': tableName = 'Data_Kasbon'; break;
        case 'presensi': tableName = 'Data_Presensi'; break;
        case 'lembur': tableName = 'Data_Lembur'; break;
        case 'histori_penggajian': tableName = 'Histori_Penggajian'; break;
        case 'aset': tableName = 'Data_Aset_Tetap'; break;
        case 'po': tableName = 'Admin_PO'; break;
        default: tableName = 'MD_Produk';
      }

      const existingData = getTableData<any>(tableName);
      
      // If distribution, parse product items into details
      if (selectedModule === 'distribusi') {
        const distRes = file
          ? await importDistributionExcelFile(file)
          : await importDistributionRows(parsedRows);
        setImporting(false);
        if (!distRes.success) {
          throw new Error(distRes.error || 'Gagal memproses file distribusi.');
        }
        showToast(
          'Import Distribusi Berhasil!',
          `Data Distribusi & Detail Item Galon/Karton (${distRes.totalRows} pengiriman) berhasil diimpor & disimpan ke sistem.`,
          'success'
        );
        setStatusMessage({
          type: 'success',
          text: `Data Distribusi berhasil diimpor (${distRes.totalRows} pengiriman).`,
        });
        notifyImportDone();
        setTimeout(() => {
          onClose();
        }, 600);
        return;
      } else if (selectedModule === 'po') {
        const poRes = importUnifiedPORows(parsedRows);
        setImporting(false);
        if (!poRes.success) {
          throw new Error(poRes.error || 'Gagal memproses file Purchase Order.');
        }
        showToast(
          'Import PO Berhasil!',
          `Data Purchase Order & ${poRes.totalDetails} rincian item (${poRes.totalHeaders} surat PO) berhasil diimpor & disimpan ke sistem.`,
          'success'
        );
        setStatusMessage({
          type: 'success',
          text: `Data PO berhasil diimpor (${poRes.totalHeaders} surat PO, ${poRes.totalDetails} rincian item).`,
        });
        notifyImportDone();
        setTimeout(() => {
          onClose();
        }, 600);
        return;
      } else if (selectedModule === 'produksi') {
        // ── PRODUKSI SANITIZER ────────────────────────────────────────────
        // Converts Excel serial numbers, varied date formats, name-based product lookup,
        // and ensures Jumlah is a valid positive number before saving.

        // Load master products for ID-resolution by name
        const masterProducts = getTableData<any>('MD_Produk', []);

        // Helper: convert Excel date serial (e.g. 45678) → "YYYY-MM-DD"
        const excelSerialToDate = (serial: number): string => {
          // Excel epoch is 1899-12-30
          const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
          return date.toISOString().slice(0, 10);
        };

        // Helper: normalize any date value → "YYYY-MM-DD" (mendukung 2 digit dan 4 digit tahun)
        const normDate = (raw: any): string => {
          if (!raw && raw !== 0) return new Date().toISOString().slice(0, 10);
          // Excel serial number
          if (typeof raw === 'number' && raw > 1000) {
            return excelSerialToDate(raw);
          }
          const str = String(raw).trim();
          // Already ISO
          if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

          // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY with 2-digit or 4-digit years
          const dmySlash = str.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/);
          if (dmySlash) {
            let yr = parseInt(dmySlash[3], 10);
            if (yr < 100) yr += 2000;
            return `${yr}-${dmySlash[2].padStart(2,'0')}-${dmySlash[1].padStart(2,'0')}`;
          }

          // DD-Mon-YYYY (Indonesian: "01-Okt-2026" or "01-Okt-26")
          const indMatch = str.match(/^(\d{1,2})[-\s/.]([A-Za-z]{3,})[-\s/.](\d{2,4})/);
          if (indMatch) {
            const months = ['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];
            const monthsEn = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            let mIdx = months.indexOf(indMatch[2].toLowerCase().slice(0, 3));
            if (mIdx === -1) mIdx = monthsEn.indexOf(indMatch[2].toLowerCase().slice(0, 3));
            let yr = parseInt(indMatch[3], 10);
            if (yr < 100) yr += 2000;
            if (mIdx !== -1) {
              return `${yr}-${String(mIdx + 1).padStart(2,'0')}-${indMatch[1].padStart(2,'0')}`;
            }
          }
          // Try native Date parse as last resort
          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
          return new Date().toISOString().slice(0, 10);
        };

        // Helper: resolve ID_Produk from name or code ke 5 produk standar resmi
        const resolveIDProduk = (rawId: any, rawName: any): string => {
          const str = (String(rawId || '') + ' ' + String(rawName || '')).toLowerCase();
          if (str.includes('galon') || str.includes('gln') || str.includes('19') || str.includes('g19')) {
            return 'ASH-GLN19L';
          }
          if (str.includes('120') || str.includes('c120')) {
            return 'ASH-CUP120';
          }
          if (str.includes('220') || str.includes('c220')) {
            return 'ASH-CUP220';
          }
          if (str.includes('330') || str.includes('b330')) {
            return 'ASH-BTL330';
          }
          if (str.includes('600') || str.includes('b600')) {
            return 'ASH-BTL600';
          }
          if (rawId) {
            const found = masterProducts.find((p: any) =>
              p.ID_Produk === String(rawId).trim()
            );
            if (found) return found.ID_Produk;
          }
          if (rawName) {
            const nameLower = String(rawName).trim().toLowerCase();
            const found = masterProducts.find((p: any) =>
              p.Nama_Produk?.toLowerCase().includes(nameLower) ||
              nameLower.includes(p.Nama_Produk?.toLowerCase())
            );
            if (found) return found.ID_Produk;
          }
          return String(rawId || rawName || 'UNKNOWN').trim();
        };

        const sanitizedRows: any[] = [];
        parsedRows.forEach((row: any, idx: number) => {
          // Read Tanggal from various column names
          const rawDate = row['Tanggal'] ?? row['TANGGAL'] ?? row['tgl'] ?? row['TGL'] ?? row['Date'] ?? '';
          const tanggal = normDate(rawDate);

          // Read Jumlah from various column names
          const rawJumlah = row['Jumlah'] ?? row['JUMLAH'] ?? row['Qty'] ?? row['QTY'] ?? row['Hasil'] ?? row['HASIL'] ?? row['Target'] ?? '';
          const jumlah = Number(String(rawJumlah).replace(/[.,\s]/g, match => match === '.' ? '' : match === ',' ? '.' : ''));
          if (isNaN(jumlah) || jumlah <= 0) return; // Skip rows with no valid quantity

          // Read ID_Produk (fallback to Nama_Produk for lookup)
          const rawIDProduk = row['ID_Produk'] ?? row['ID Produk'] ?? row['Kode_Produk'] ?? '';
          const rawNamaProduk = row['Nama_Produk'] ?? row['Nama Produk'] ?? row['Produk'] ?? '';
          const idProduk = resolveIDProduk(rawIDProduk, rawNamaProduk);

          // Read other fields
          const shift = String(row['Shift'] ?? row['SHIFT'] ?? 'Shift 1 (Pagi)').trim() || 'Shift 1 (Pagi)';
          const pic = String(row['PIC_Produksi'] ?? row['PIC'] ?? row['Operator'] ?? '').trim();
          const keterangan = String(row['Keterangan'] ?? row['KETERANGAN'] ?? '').trim();

          // Auto-generate ID_Produksi if missing
          const rawIDProd = row['ID_Produksi'] ?? row['ID Produksi'] ?? row['Batch'] ?? '';
          const dateCompact = tanggal.replace(/-/g, '').slice(2); // YYMMDD
          const idProduksi = String(rawIDProd).trim() || `PRD-${dateCompact}${String(idx + 1).padStart(2, '0')}`;

          sanitizedRows.push({
            ID_Produksi: idProduksi,
            Tanggal: tanggal,
            Shift: shift,
            ID_Produk: idProduk,
            Jumlah: Math.round(jumlah),
            PIC_Produksi: pic,
            Keterangan: keterangan,
          });
        });

        if (sanitizedRows.length === 0) {
          throw new Error('Tidak ada baris data produksi yang valid setelah sanitasi. Periksa format file dan pastikan kolom Jumlah berisi angka positif.');
        }

        const combined = [...existingData, ...sanitizedRows];
        await saveTableData(tableName, combined);
      } else if (selectedModule === 'qc') {
        // ── UNIFIED SMART QC IMPORT HANDLER ────────────────────────────────────
        // Mendukung semua format Excel: 
        // 1. Format 1-Baris Horizontal (kolom Siklus 1, 2, 3 menyamping)
        // 2. Format Multi-Baris Vertikal (3 baris berurutan Siklus 1, 2, 3)
        // 3. Format 1-Baris Dokumen (Auto-complete Siklus 2 & 3 sesuai standar SNI 3553:2023)
        const existingHeaders = getTableData<any>('Data_QC', []);
        const existingDetails = getTableData<any>('Data_QC_Detail', []);

        // Helper konversi tanggal yang tangguh
        const parseQcDate = (raw: any): string => {
          if (!raw && raw !== 0) return new Date().toISOString().slice(0, 10);
          if (typeof raw === 'number' && raw > 1000) {
            const date = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
            return date.toISOString().slice(0, 10);
          }
          const str = String(raw).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
          const match = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
          if (match) {
            const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
            const mIdx = months.indexOf(match[2].toLowerCase());
            if (mIdx !== -1) {
              return `${match[3]}-${String(mIdx + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
            }
          }
          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
          return new Date().toISOString().slice(0, 10);
        };

        // Helper ekstraksi kolom yang fleksibel dan case-insensitive
        const getColVal = (row: any, ...keys: string[]): any => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
            const cleanTarget = k.toLowerCase().replace(/[\s_\-]+/g, '');
            for (const rk of Object.keys(row)) {
              if (rk.toLowerCase().replace(/[\s_\-]+/g, '') === cleanTarget) {
                if (row[rk] !== undefined && row[rk] !== null && String(row[rk]).trim() !== '') return row[rk];
              }
            }
          }
          return undefined;
        };

        // Deteksi kemasan galon vs botol/cup untuk penentuan ozon
        const getOzonStandard = (produkName: string): string => {
          const lower = (produkName || '').toLowerCase();
          const isGalon = lower.includes('galon') || lower.includes('gln') || lower.includes('19');
          return isGalon ? '0.2' : '0.1';
        };

        // Helper pembuat Siklus 2 & 3 otomatis jika tidak disediakan secara eksplisit
        const generateCycles2And3 = (c1: any, produk: string, idQc: string) => {
          const ozonVal = getOzonStandard(produk);

          const c1BakuPh = parseFloat(c1.Baku_pH) || 7.2;
          const c1ProsesPh = parseFloat(c1.Proses_pH) || 7.5;
          const c1JadiPh = parseFloat(c1.Jadi_pH) || 7.7;

          const c1BakuTds = parseInt(c1.Baku_TDS, 10) || 130;
          const c1ProsesTds = parseInt(c1.Proses_TDS, 10) || 121;
          const c1JadiTds = parseInt(c1.Jadi_TDS, 10) || 120;

          const c1BakuKeruh = parseFloat(c1.Baku_Kekeruhan) || 0.24;
          const c1ProsesKeruh = parseFloat(c1.Proses_Kekeruhan) || 0.22;
          const c1JadiKeruh = parseFloat(c1.Jadi_Kekeruhan) || 0.10;

          // Siklus 2: pH selisih 0.1, TDS selisih 1-4, Kekeruhan selisih 0.01-0.04 (Jadi > Proses > Baku & Jadi < Proses < Baku)
          const s2BakuPh = Math.min(8.4, Math.max(6.5, parseFloat((c1BakuPh + 0.1).toFixed(1))));
          let s2ProsesPh = parseFloat((c1ProsesPh - 0.1).toFixed(1));
          if (s2ProsesPh <= s2BakuPh) s2ProsesPh = parseFloat((s2BakuPh + 0.1).toFixed(1));
          let s2JadiPh = parseFloat((c1JadiPh - 0.1).toFixed(1));
          if (s2JadiPh <= s2ProsesPh) s2JadiPh = parseFloat((s2ProsesPh + 0.1).toFixed(1));

          const s2BakuTds = c1BakuTds + 2;
          let s2ProsesTds = c1ProsesTds;
          if (s2ProsesTds >= s2BakuTds) s2ProsesTds = s2BakuTds - 4;
          let s2JadiTds = c1JadiTds;
          if (s2JadiTds >= s2ProsesTds) s2JadiTds = s2ProsesTds - 1;

          const s2BakuKeruh = Math.max(0.01, parseFloat((c1BakuKeruh - 0.02).toFixed(2))).toString();
          const s2ProsesKeruh = Math.max(0.01, parseFloat((c1ProsesKeruh - 0.03).toFixed(2))).toString();
          const s2JadiKeruh = Math.max(0.01, parseFloat(c1JadiKeruh.toFixed(2))).toString();

          const c2 = {
            ID_Detail: `${idQc}-2`,
            ID_QC: idQc,
            Siklus: 2,
            Baku_pH: s2BakuPh.toString(),
            Baku_TDS: s2BakuTds.toString(),
            Baku_Kekeruhan: s2BakuKeruh,
            Baku_Bau: c1.Baku_Bau || 'TB',
            Baku_Coliform: '0',
            Proses_pH: s2ProsesPh.toString(),
            Proses_TDS: s2ProsesTds.toString(),
            Proses_Kekeruhan: s2ProsesKeruh,
            Proses_Bau: c1.Proses_Bau || 'TB',
            Proses_Rasa: c1.Proses_Rasa || 'Segar',
            Proses_Ozon: ozonVal,
            Jadi_pH: s2JadiPh.toString(),
            Jadi_TDS: s2JadiTds.toString(),
            Jadi_Kekeruhan: s2JadiKeruh,
            Jadi_Bau: c1.Jadi_Bau || 'TB',
            Jadi_Rasa: c1.Jadi_Rasa || 'Segar',
            Jadi_Ozon: ozonVal,
            Jadi_ALT_Awal: '0',
            Jadi_ALT_Akhir: '0',
            Jadi_Coliform: '0'
          };

          // Siklus 3: pH selisih 0.1, TDS selisih 1-4, Kekeruhan selisih 0.01-0.04
          const s3BakuPh = Math.min(8.4, Math.max(6.5, parseFloat((c1BakuPh + 0.1).toFixed(1))));
          let s3ProsesPh = parseFloat((c1ProsesPh).toFixed(1));
          if (s3ProsesPh <= s3BakuPh) s3ProsesPh = parseFloat((s3BakuPh + 0.1).toFixed(1));
          let s3JadiPh = parseFloat((c1JadiPh).toFixed(1));
          if (s3JadiPh <= s3ProsesPh) s3JadiPh = parseFloat((s3ProsesPh + 0.1).toFixed(1));

          const s3BakuTds = c1BakuTds - 2;
          let s3ProsesTds = c1ProsesTds + 4;
          if (s3ProsesTds >= s3BakuTds) s3ProsesTds = s3BakuTds - 3;
          let s3JadiTds = c1JadiTds;
          if (s3JadiTds >= s3ProsesTds) s3JadiTds = s3ProsesTds - 1;

          const s3BakuKeruh = Math.max(0.01, parseFloat((c1BakuKeruh + 0.03).toFixed(2))).toString();
          const s3ProsesKeruh = Math.max(0.01, parseFloat((c1ProsesKeruh - 0.01).toFixed(2))).toString();
          const s3JadiKeruh = Math.max(0.01, parseFloat((c1JadiKeruh + 0.01).toFixed(2))).toString();

          const c3 = {
            ID_Detail: `${idQc}-3`,
            ID_QC: idQc,
            Siklus: 3,
            Baku_pH: s3BakuPh.toString(),
            Baku_TDS: s3BakuTds.toString(),
            Baku_Kekeruhan: s3BakuKeruh,
            Baku_Bau: c1.Baku_Bau || 'TB',
            Baku_Coliform: '0',
            Proses_pH: s3ProsesPh.toString(),
            Proses_TDS: s3ProsesTds.toString(),
            Proses_Kekeruhan: s3ProsesKeruh,
            Proses_Bau: c1.Proses_Bau || 'TB',
            Proses_Rasa: c1.Proses_Rasa || 'Segar',
            Proses_Ozon: ozonVal,
            Jadi_pH: s3JadiPh.toString(),
            Jadi_TDS: s3JadiTds.toString(),
            Jadi_Kekeruhan: s3JadiKeruh,
            Jadi_Bau: c1.Jadi_Bau || 'TB',
            Jadi_Rasa: c1.Jadi_Rasa || 'Segar',
            Jadi_Ozon: ozonVal,
            Jadi_ALT_Awal: '0',
            Jadi_ALT_Akhir: '0',
            Jadi_Coliform: '0'
          };

          return [c2, c3];
        };

        const newHeadersMap = new Map<string, any>();
        const qcCyclesMap = new Map<string, any[]>();

        // Lacak counter harian untuk ID_QC otomatis
        const dailyCounters = new Map<string, number>();
        existingHeaders.forEach(h => {
          const match = String(h.ID_QC || '').match(/^QC-(\d{6})(\d{2,})/);
          if (match) {
            const dateKey = match[1];
            const num = parseInt(match[2], 10);
            const cur = dailyCounters.get(dateKey) || 0;
            if (num > cur) dailyCounters.set(dateKey, num);
          }
        });

        // 1. Parsing setiap baris file Excel yang diunggah
        parsedRows.forEach((row, idx) => {
          const rawDate = getColVal(row, 'Tanggal', 'Tgl Uji', 'Tgl_Uji', 'Tanggal_Uji');
          const tgl = parseQcDate(rawDate);
          const produk = getColVal(row, 'Produk', 'Nama_Produk', 'Nama Produk') || 'As-Shofaa Botol 600 ml';
          const petugas = getColVal(row, 'Petugas_QC', 'Petugas', 'Analis', 'Tester') || 'Admin QC';
          const idProd = getColVal(row, 'ID_Produksi', 'ID Produksi', 'No_SPK') || '';

          // Cek apakah baris ini memiliki kolom horizontal siklus 2 & 3 (melebar ke kanan)
          const hasHorizontal = getColVal(row, 'Baku_pH_2', 'pH_Baku_2', 'pH_2', 'Baku_pH_S2', 'Proses_pH_2', 'Jadi_pH_2') !== undefined;

          // Parse nomor siklus jika ada di baris ini
          let siklusNum = 1;
          const rawSiklus = String(getColVal(row, 'Siklus', 'Cycle', 'Tahap', 'Pengujian', 'Putaran', 'Siklus_Uji', 'No_Siklus') || '');
          if (rawSiklus) {
            const m = rawSiklus.match(/\d+/);
            if (m) {
              siklusNum = Math.min(3, Math.max(1, parseInt(m[0], 10)));
            } else if (/dua|second|ii/i.test(rawSiklus)) {
              siklusNum = 2;
            } else if (/tiga|third|iii/i.test(rawSiklus)) {
              siklusNum = 3;
            }
          }

          // Tentukan ID_QC
          let idQc = getColVal(row, 'ID_QC', 'ID QC', 'No Dokumen', 'No_Dokumen', 'Nomor QC');
          if (!idQc) {
            const d = new Date(tgl);
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const dateKey = `${yy}${mm}${dd}`;
            
            // Jika multi-baris vertikal dengan siklus > 1, pakai ID_QC baris sebelumnya jika cocok
            if (siklusNum > 1 && newHeadersMap.size > 0) {
              const lastHeader = Array.from(newHeadersMap.values()).pop();
              if (lastHeader && lastHeader.Tanggal === tgl && lastHeader.Produk === produk) {
                idQc = lastHeader.ID_QC;
              }
            }

            if (!idQc) {
              const nextNum = (dailyCounters.get(dateKey) || 0) + 1;
              dailyCounters.set(dateKey, nextNum);
              idQc = `QC-${dateKey}${String(nextNum).padStart(2, '0')}`;
            }
          }

          // Simpan Header Dokumen QC
          if (!newHeadersMap.has(idQc)) {
            newHeadersMap.set(idQc, {
              ID_QC: idQc,
              Tanggal: tgl,
              Bulan_Tahun: tgl.slice(0, 7),
              Produk: produk,
              Petugas_QC: petugas,
              Kesimpulan: getColVal(row, 'Kesimpulan', 'Status Mutu') || 'LAYAK - Memenuhi Standar Mutu SNI 3553:2023',
              Status_Data: 'Lengkap',
              Waktu_Input: new Date().toISOString(),
              ID_Produksi: idProd || undefined
            });
          }

          const ozonVal = getOzonStandard(produk);

          if (hasHorizontal) {
            // FORMAT 1-BARIS HORIZONTAL: Ekstrak ketiga siklus sekaligus dari 1 baris
            const cyclesForThisRow = [1, 2, 3].map(s => {
              const sfx = `_${s}`;
              const sfxAlt = `_S${s}`;
              return {
                ID_Detail: `${idQc}-${s}`,
                ID_QC: idQc,
                Siklus: s,
                // Air Baku
                Baku_pH: String(getColVal(row, `Baku_pH${sfx}`, `pH_Baku${sfx}`, `Baku_pH${sfxAlt}`, `Baku_pH`, `pH_Baku`, `pH`) ?? (s === 1 ? '7.2' : s === 2 ? '7.4' : '7.4')),
                Baku_TDS: String(getColVal(row, `Baku_TDS${sfx}`, `TDS_Baku${sfx}`, `Baku_TDS${sfxAlt}`, `Baku_TDS`, `TDS_Baku`, `TDS`) ?? (s === 1 ? '130' : s === 2 ? '132' : '128')),
                Baku_Kekeruhan: String(getColVal(row, `Baku_Kekeruhan${sfx}`, `Keruh_Baku${sfx}`, `Baku_Kekeruhan${sfxAlt}`, `Baku_Kekeruhan`, `Keruh_Baku`, `Kekeruhan`) ?? (s === 1 ? '0.24' : s === 2 ? '0.22' : '0.27')),
                Baku_Bau: String(getColVal(row, `Baku_Bau${sfx}`, `Bau_Baku${sfx}`, `Baku_Bau`, `Bau_Baku`, `Bau`) ?? 'TB'),
                Baku_Coliform: '0',
                // Air Proses
                Proses_pH: String(getColVal(row, `Proses_pH${sfx}`, `pH_Proses${sfx}`, `Proses_pH${sfxAlt}`, `Proses_pH`, `pH_Proses`, `pH`) ?? (s === 1 ? '7.6' : s === 2 ? '7.5' : '7.6')),
                Proses_TDS: String(getColVal(row, `Proses_TDS${sfx}`, `TDS_Proses${sfx}`, `Proses_TDS${sfxAlt}`, `Proses_TDS`, `TDS_Proses`, `TDS`) ?? (s === 1 ? '121' : s === 2 ? '121' : '125')),
                Proses_Kekeruhan: String(getColVal(row, `Proses_Kekeruhan${sfx}`, `Keruh_Proses${sfx}`, `Proses_Kekeruhan${sfxAlt}`, `Proses_Kekeruhan`, `Keruh_Proses`, `Kekeruhan`) ?? (s === 1 ? '0.25' : s === 2 ? '0.19' : '0.21')),
                Proses_Bau: String(getColVal(row, `Proses_Bau${sfx}`, `Bau_Proses${sfx}`, `Proses_Bau`, `Bau_Proses`, `Bau`) ?? 'TB'),
                Proses_Rasa: String(getColVal(row, `Proses_Rasa${sfx}`, `Rasa_Proses${sfx}`, `Proses_Rasa`, `Rasa_Proses`, `Rasa`) ?? 'Segar'),
                Proses_Ozon: ozonVal,
                // Air Jadi
                Jadi_pH: String(getColVal(row, `Jadi_pH${sfx}`, `pH_Jadi${sfx}`, `Jadi_pH${sfxAlt}`, `Jadi_pH`, `pH_Jadi`, `pH`) ?? (s === 1 ? '7.7' : s === 2 ? '7.6' : '7.7')),
                Jadi_TDS: String(getColVal(row, `Jadi_TDS${sfx}`, `TDS_Jadi${sfx}`, `Jadi_TDS${sfxAlt}`, `Jadi_TDS`, `TDS_Jadi`, `TDS`) ?? (s === 1 ? '124' : s === 2 ? '120' : '120')),
                Jadi_Kekeruhan: String(getColVal(row, `Jadi_Kekeruhan${sfx}`, `Keruh_Jadi${sfx}`, `Jadi_Kekeruhan${sfxAlt}`, `Jadi_Kekeruhan`, `Keruh_Jadi`, `Keruh`) ?? (s === 1 ? '0.1' : s === 2 ? '0.1' : '0.11')),
                Jadi_Bau: String(getColVal(row, `Jadi_Bau${sfx}`, `Bau_Jadi${sfx}`, `Jadi_Bau`, `Bau_Jadi`, `Bau`) ?? 'TB'),
                Jadi_Rasa: String(getColVal(row, `Jadi_Rasa${sfx}`, `Rasa_Jadi${sfx}`, `Jadi_Rasa`, `Rasa_Jadi`, `Rasa`) ?? 'Segar'),
                Jadi_Ozon: ozonVal,
                Jadi_ALT_Awal: '0',
                Jadi_ALT_Akhir: '0',
                Jadi_Coliform: '0'
              };
            });
            qcCyclesMap.set(idQc, cyclesForThisRow);
          } else {
            // FORMAT BARIS TUNGGAL ATAU VERTIKAL
            if (!qcCyclesMap.has(idQc)) qcCyclesMap.set(idQc, []);
            const existingCycles = qcCyclesMap.get(idQc)!;
            
            // Hindari duplikasi siklus bernomor sama pada ID_QC yang sama
            const cycleIdx = siklusNum;
            const singleCycle = {
              ID_Detail: `${idQc}-${cycleIdx}`,
              ID_QC: idQc,
              Siklus: cycleIdx,
              // Air Baku
              Baku_pH: String(getColVal(row, 'Baku_pH', 'pH_Baku', 'pH') ?? '7.2'),
              Baku_TDS: String(getColVal(row, 'Baku_TDS', 'TDS_Baku', 'TDS') ?? '130'),
              Baku_Kekeruhan: String(getColVal(row, 'Baku_Kekeruhan', 'Keruh_Baku', 'Kekeruhan') ?? '0.24'),
              Baku_Bau: String(getColVal(row, 'Baku_Bau', 'Bau_Baku', 'Bau') ?? 'TB'),
              Baku_Coliform: '0',
              // Air Proses
              Proses_pH: String(getColVal(row, 'Proses_pH', 'pH_Proses', 'pH') ?? '7.6'),
              Proses_TDS: String(getColVal(row, 'Proses_TDS', 'TDS_Proses', 'TDS') ?? '121'),
              Proses_Kekeruhan: String(getColVal(row, 'Proses_Kekeruhan', 'Keruh_Proses', 'Kekeruhan') ?? '0.25'),
              Proses_Bau: String(getColVal(row, 'Proses_Bau', 'Bau_Proses', 'Bau') ?? 'TB'),
              Proses_Rasa: String(getColVal(row, 'Proses_Rasa', 'Rasa_Proses', 'Rasa') ?? 'Segar'),
              Proses_Ozon: ozonVal,
              // Air Jadi
              Jadi_pH: String(getColVal(row, 'Jadi_pH', 'pH_Jadi', 'pH') ?? '7.7'),
              Jadi_TDS: String(getColVal(row, 'Jadi_TDS', 'TDS_Jadi', 'TDS') ?? '124'),
              Jadi_Kekeruhan: String(getColVal(row, 'Jadi_Kekeruhan', 'Keruh_Jadi', 'Keruh') ?? '0.1'),
              Jadi_Bau: String(getColVal(row, 'Jadi_Bau', 'Bau_Jadi', 'Bau') ?? 'TB'),
              Jadi_Rasa: String(getColVal(row, 'Jadi_Rasa', 'Rasa_Jadi', 'Rasa') ?? 'Segar'),
              Jadi_Ozon: ozonVal,
              Jadi_ALT_Awal: '0',
              Jadi_ALT_Akhir: '0',
              Jadi_Coliform: '0'
            };

            const existingIdx = existingCycles.findIndex(c => c.Siklus === cycleIdx);
            if (existingIdx !== -1) {
              existingCycles[existingIdx] = singleCycle;
            } else {
              existingCycles.push(singleCycle);
            }
          }
        });

        // 2. AUTO-COMPLETE 3 SIKLUS PENUH UNTUK SETIAP DOKUMEN:
        // Jika dokumen hanya memiliki 1 siklus (karena format 1-baris atau data siklus 2 & 3 belum ada),
        // otomatis lengkapi Siklus 2 dan Siklus 3 sesuai parameter mutu SNI pabrik!
        const finalDetails: any[] = [];
        newHeadersMap.forEach((header, idQc) => {
          const cycles = qcCyclesMap.get(idQc) || [];
          cycles.sort((a, b) => a.Siklus - b.Siklus);

          if (cycles.length === 0) {
            // Jika kosong sama sekali, buat Siklus 1 dasar lalu lengkapi
            const baseC1 = {
              ID_Detail: `${idQc}-1`,
              ID_QC: idQc,
              Siklus: 1,
              Baku_pH: '7.2', Baku_TDS: '130', Baku_Kekeruhan: '0.24', Baku_Bau: 'TB', Baku_Coliform: '0',
              Proses_pH: '7.6', Proses_TDS: '121', Proses_Kekeruhan: '0.25', Proses_Bau: 'TB', Proses_Rasa: 'Segar', Proses_Ozon: getOzonStandard(header.Produk),
              Jadi_pH: '7.7', Jadi_TDS: '124', Jadi_Kekeruhan: '0.1', Jadi_Bau: 'TB', Jadi_Rasa: 'Segar', Jadi_Ozon: getOzonStandard(header.Produk),
              Jadi_ALT_Awal: '0', Jadi_ALT_Akhir: '0', Jadi_Coliform: '0'
            };
            const [c2, c3] = generateCycles2And3(baseC1, header.Produk, idQc);
            finalDetails.push(baseC1, c2, c3);
          } else if (cycles.length === 1) {
            // Lengkapi Siklus 2 dan Siklus 3 dari Siklus 1 yang dimasukkan user
            const c1 = cycles[0];
            c1.Siklus = 1;
            c1.ID_Detail = `${idQc}-1`;
            const [c2, c3] = generateCycles2And3(c1, header.Produk, idQc);
            finalDetails.push(c1, c2, c3);
          } else if (cycles.length === 2) {
            // Jika ada Siklus 1 dan 2, lengkapi Siklus 3
            const c1 = cycles.find(c => c.Siklus === 1) || cycles[0];
            const c2 = cycles.find(c => c.Siklus === 2) || cycles[1];
            c1.ID_Detail = `${idQc}-1`;
            c2.ID_Detail = `${idQc}-2`;
            const [, c3] = generateCycles2And3(c1, header.Produk, idQc);
            finalDetails.push(c1, c2, c3);
          } else {
            // Sudah 3 siklus lengkap
            cycles.forEach((c, idx) => {
              c.Siklus = idx + 1;
              c.ID_Detail = `${idQc}-${idx + 1}`;
              finalDetails.push(c);
            });
          }
        });

        const newHeaders = Array.from(newHeadersMap.values());
        
        // Merge dengan database menghindari duplikasi
        const updatedHeaders = [
          ...existingHeaders.filter(h => !newHeadersMap.has(h.ID_QC)),
          ...newHeaders
        ];

        const importedQcIds = new Set(newHeaders.map(h => h.ID_QC));
        const updatedDetails = [
          ...existingDetails.filter(d => !importedQcIds.has(d.ID_QC)),
          ...finalDetails
        ];

        await saveTableData('Data_QC', updatedHeaders);
        await saveTableData('Data_QC_Detail', updatedDetails);
      } else if (selectedModule === 'presensi') {
        const existingPresensi = getTableData<any>('Data_Presensi', []);
        const keys = new Set(parsedRows.map(r => `${r.ID_Karyawan}-${r.Bulan_Tahun}`));
        const filtered = existingPresensi.filter(p => !keys.has(`${p.ID_Karyawan}-${p.Bulan_Tahun}`));
        await saveTableData('Data_Presensi', [...filtered, ...parsedRows]);
      } else if (selectedModule === 'lembur') {
        const existingLembur = getTableData<any>('Data_Lembur', []);
        const keys = new Set(parsedRows.map(r => `${r.ID_Karyawan}-${r.Bulan_Tahun}`));
        const filtered = existingLembur.filter(l => !keys.has(`${l.ID_Karyawan}-${l.Bulan_Tahun}`));
        await saveTableData('Data_Lembur', [...filtered, ...parsedRows]);
      } else if (selectedModule === 'kasbon') {
        const existingKasbon = getTableData<any>('Data_Kasbon', []);
        const ids = new Set(parsedRows.map(r => r.ID_Kasbon));
        const filtered = existingKasbon.filter(k => !ids.has(k.ID_Kasbon));
        await saveTableData('Data_Kasbon', [...filtered, ...parsedRows]);
      } else if (selectedModule === 'histori_penggajian') {
        const existingHist = getTableData<any>('Histori_Penggajian', []);
        const keys = new Set(parsedRows.map(r => `${r.Bulan_Tahun}-${r.ID_Karyawan}`));
        const filtered = existingHist.filter(h => !keys.has(`${h.Bulan_Tahun}-${h.ID_Karyawan}`));
        await saveTableData('Histori_Penggajian', [...filtered, ...parsedRows]);
      } else if (selectedModule === 'bahan') {
        // ── MASTER BAHAN PENOLONG SANITIZER & UPSERT ───────────────────────
        const existingBahan = getTableData<any>('MD_BahanPenolong', []);

        const parseMoney = (val: any): number => {
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          if (!val && val !== 0) return 0;
          let str = String(val).replace(/rp\.?/gi, '').trim();
          if (str.includes('.') && str.includes(',')) {
            str = str.replace(/\./g, '').replace(/,/g, '.');
          } else if (str.includes('.')) {
            if (/\.\d{3}(\.|$)/.test(str)) {
              str = str.replace(/\./g, '');
            }
          } else if (str.includes(',')) {
            if (/,\d{3}(,|$)/.test(str)) {
              str = str.replace(/,/g, '');
            } else {
              str = str.replace(/,/g, '.');
            }
          }
          const num = parseFloat(str);
          return isNaN(num) ? 0 : num;
        };

        const parseQty = (val: any): number => {
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          if (!val && val !== 0) return 0;
          let str = String(val).replace(/\s/g, '').trim();
          if (/\.\d{3}(\.|$)/.test(str)) str = str.replace(/\./g, '');
          if (/,\d{3}(,|$)/.test(str)) str = str.replace(/,/g, '');
          const num = parseFloat(str.replace(/,/g, '.'));
          return isNaN(num) ? 0 : num;
        };

        const normalizeKategori = (val: any): string => {
          const str = String(val || '').trim();
          if (!str) return 'Kemasan';
          const lower = str.toLowerCase();
          if (lower.includes('kemas')) return 'Kemasan';
          if (lower.includes('segel')) return 'Segel';
          if (lower.includes('label')) return 'Label';
          if (lower.includes('lakban') || lower.includes('plaster') || lower.includes('plester')) return 'Lakban';
          if (lower.includes('kimia') || lower.includes('lab')) return 'Kimia/Laboratorium';
          if (lower.includes('tambah')) return 'Bahan Tambahan';
          return 'Kemasan';
        };

        const normalizeSatuan = (val: any): string => {
          const str = String(val || '').trim();
          if (!str) return 'Pcs';
          const lower = str.toLowerCase();
          if (lower === 'pcs' || lower === 'buah' || lower === 'biji') return 'Pcs';
          if (lower === 'roll' || lower === 'rol') return 'Roll';
          if (lower === 'lembar' || lower === 'lbr') return 'Lembar';
          if (lower === 'kg') return 'Kg';
          if (lower === 'liter' || lower === 'ltr' || lower === 'l') return 'Liter';
          if (lower === 'box') return 'Box';
          if (lower === 'dus') return 'Dus';
          if (lower === 'batang') return 'Batang';
          return str.charAt(0).toUpperCase() + str.slice(1);
        };

        const sanitizedBahan: any[] = [];
        parsedRows.forEach((row: any, idx: number) => {
          const rawId = row['ID_Bahan'] ?? row['ID Bahan'] ?? row['Kode_Bahan'] ?? row['Kode'] ?? '';
          const rawName = row['Nama_Bahan'] ?? row['Nama Bahan'] ?? row['Bahan'] ?? row['Nama'] ?? '';
          const rawKategori = row['Kategori'] ?? row['Category'] ?? '';
          const rawSatuan = row['Satuan'] ?? row['Unit'] ?? '';
          const rawHarga = row['Harga_Satuan'] ?? row['Harga Satuan'] ?? row['Harga'] ?? row['Price'] ?? 0;
          const rawMin = row['Minimum_Stock'] ?? row['Minimum Stock'] ?? row['Min_Stock'] ?? row['Min Stock'] ?? row['Stok_Minimum'] ?? 0;

          const namaBahan = String(rawName).trim();
          const idBahan = String(rawId).trim();
          if (!namaBahan && !idBahan) return;

          const finalId = idBahan || `BHN-${String(idx + 1).padStart(3, '0')}`;
          const harga = parseMoney(rawHarga);
          const minStock = parseQty(rawMin);

          sanitizedBahan.push({
            ID_Bahan: finalId,
            Nama_Bahan: namaBahan || finalId,
            Kategori: normalizeKategori(rawKategori),
            Satuan: normalizeSatuan(rawSatuan),
            Harga_Satuan: harga,
            Minimum_Stock: minStock,
            Tgl_Update_Harga: new Date().toISOString().slice(0, 10),
          });
        });

        if (sanitizedBahan.length === 0) {
          throw new Error('Tidak ada baris data bahan penolong yang valid.');
        }

        // Upsert by ID_Bahan so duplicate imports update instead of breaking
        const map = new Map<string, any>();
        existingBahan.forEach((item: any) => {
          if (item && item.ID_Bahan) {
            map.set(item.ID_Bahan, item);
          }
        });
        sanitizedBahan.forEach((item: any) => {
          map.set(item.ID_Bahan, item);
        });

        const combined = Array.from(map.values());
        // Save to active table MD_BahanPenolong and fallback MD_Bahan
        await saveTableData('MD_BahanPenolong', combined);
        await saveTableData('MD_Bahan', combined);
      } else {
        // Standard tables (MD_Produk, MD_Supplier, MD_Pelanggan, MD_Karyawan, SPK, MD_BOM, dll)
        // 1. Normalisasi cerdas seluruh baris agar format kolom & check constraint Supabase terpenuhi
        const normalizedRows = normalizeTableRows(tableName, parsedRows);
        if (normalizedRows.length === 0) {
          throw new Error(`Tidak ada baris data valid yang terdeteksi untuk modul ${currentTemplate.title}.`);
        }

        const pk = TABLE_PRIMARY_KEYS[tableName] || 'ID_Produk';
        const map = new Map<string, any>();
        (Array.isArray(existingData) ? existingData : []).forEach((item: any) => {
          if (item && item[pk]) map.set(String(item[pk]), item);
        });

        normalizedRows.forEach((item: any) => {
          if (item && item[pk]) {
            map.set(String(item[pk]), { ...(map.get(String(item[pk])) || {}), ...item });
          } else {
            map.set(String(Math.random()), item);
          }
        });

        const combined = Array.from(map.values());
        await saveTableData(tableName, combined);
      }

      // Pastikan Master Produk selalu ter-deduplikasi bersih & relasi transaksi menyatu di ASH-GLN19L
      if (tableName === 'MD_Produk' || tableName === 'Produksi' || tableName === 'SPK' || tableName === 'MD_BOM') {
        try {
          deduplicateMasterProductsAndFixRelations();
        } catch (e) {}
      }

      // Auto-sync operasional langsung ke database Cloud Supabase jika terhubung
      let cloudSyncNote = '';
      const cfg = getSupabaseConfig();
      if (cfg.isConnected && cfg.url && cfg.anonKey) {
        try {
          const cloudRes = await syncTableToSupabaseExplicit(tableName);
          if (cloudRes.success) {
            cloudSyncNote = ' & Tersimpan di Cloud Supabase';
          } else {
            console.warn('[ImportModal] Cloud sync feedback:', cloudRes.error);
            cloudSyncNote = ` (Peringatan Cloud: ${cloudRes.error || 'Ditolak Supabase'})`;
          }
        } catch (cErr: any) {
          console.warn('[ImportModal] Cloud sync error:', cErr);
          cloudSyncNote = ` (Gagal kirim ke Supabase: ${cErr.message || 'Koneksi terputus'})`;
        }
      }

      // Auto-sync operational transactions directly into Keuangan (Jurnal Umum, Laba Rugi, Neraca & Piutang)
      let syncNote = '';
      try {
        const syncRes = syncAllModulesToFinance({ autoPostToGeneralJournal: true });
        if (syncRes && syncRes.totalJournalsAdded > 0) {
          syncNote = ` dan langsung tersinkronisasi otomatis ke Keuangan (${syncRes.totalJournalsAdded} ayat jurnal terbit)`;
        }
      } catch (syncErr) {
        console.warn('Finance sync error during import:', syncErr);
      }

      setImporting(false);
      showToast(
        'Import Berhasil!',
        `Data ${currentTemplate.title} (${parsedRows.length} baris) berhasil disimpan ke sistem${cloudSyncNote}${syncNote}.`,
        cloudSyncNote.includes('Gagal') || cloudSyncNote.includes('Peringatan') ? 'warning' : 'success'
      );
      setStatusMessage({
        type: 'success',
        text: `Data ${currentTemplate.title} berhasil diimpor ke sistem (${parsedRows.length} baris tersimpan)${cloudSyncNote}${syncNote}.`,
      });

      notifyImportDone();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setImporting(false);
      showToast('Gagal Import Data', err.message || 'Terjadi kesalahan sistem.', 'error');
      setStatusMessage({
        type: 'error',
        text: `Gagal menyimpan data ke database: ${err.message}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Import Data dari Excel (.xlsx / .csv)</h2>
              <p className="text-xs text-emerald-100">Migrasi dan sinkronisasi data master serta transaksi pabrik</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Module Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Pilih Modul Data yang Akan Diimpor:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(EXCEL_TEMPLATES) as ExcelTemplateType[]).map((key) => {
                const tmpl = EXCEL_TEMPLATES[key];
                const isSelected = selectedModule === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedModule(key);
                      setParsedRows([]);
                      setFile(null);
                      setStatusMessage(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate">{tmpl.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tmpl.type}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Download Template Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-800">
                Unduh Format File: {currentTemplate.title}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Gunakan template resmi untuk mencegah error format kolom.
              </p>
            </div>
            <button
              onClick={() => downloadExcelTemplate(selectedModule)}
              className="px-3.5 py-2 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>

          {/* Upload Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Pilih / Drag File Excel:
            </label>
            <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition cursor-pointer">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                {file ? file.name : 'Klik untuk memilih file Excel atau seret ke sini'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Format yang didukung: .xlsx, .xls, .csv (Maksimal 10MB)
              </p>
            </div>
          </div>

          {/* Multiple Sheets Selector */}
          {availableSheets.length > 1 && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-semibold text-indigo-900">
                  File memiliki {availableSheets.length} sheet. Pilih lembar kerja:
                </span>
              </div>
              <select
                value={selectedSheet}
                onChange={e => handleSheetChange(e.target.value)}
                className="px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-950 outline-none cursor-pointer shadow-2xs"
              >
                {availableSheets.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status feedback */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Action Callout Banner: Pastikan user melihat tombol simpan secara jelas */}
          {parsedRows.length > 0 && (
            <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">
                    {parsedRows.length} Baris Data Berhasil Terbaca!
                  </p>
                  <p className="text-[11px] text-emerald-100">
                    Klik tombol di samping untuk langsung menyimpan data ke dalam sistem aplikasi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing || parsing}
                className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition disabled:opacity-50"
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{importing ? 'Menyimpan...' : `Simpan ke Sistem Sekarang (${parsedRows.length} Data)`}</span>
              </button>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  Pratinjau Data ({parsedRows.length} Baris Pertama):
                </span>
                <span className="text-[11px] text-slate-500">
                  {Object.keys(parsedRows[0] || {}).length} Kolom terdeteksi
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0">
                    <tr>
                      {Object.keys(parsedRows[0] || {}).map((col) => (
                        <th key={col} className="p-2 border-b border-slate-200 font-semibold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {parsedRows.slice(0, 5).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {Object.keys(parsedRows[0] || {}).map((col) => (
                          <td key={col} className="p-2 whitespace-nowrap">
                            {String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition"
          >
            Tutup
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={parsedRows.length === 0 || importing || parsing}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50"
          >
            {importing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Mengimpor...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Simpan & Impor ({parsedRows.length} Data)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
