import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Download, Upload, CheckCircle2, 
  AlertCircle, X, ArrowRight, Eye, RefreshCw 
} from 'lucide-react';
import { 
  EXCEL_TEMPLATES, ExcelTemplateType, downloadExcelTemplate, 
  parseExcelFile 
} from '../services/excelService';
import { 
  saveTableData, getTableData, normalizeTableRows, 
  syncTableToSupabaseExplicit, getSupabaseConfig, TABLE_PRIMARY_KEYS 
} from '../services/dbAdapter';
import { syncAllModulesToFinance } from '../services/financeSyncService';
import { sanitizeAndRepairDistributionDatabase, importDistributionExcelFile } from '../services/distributionService';
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
        if (file) {
          const distRes = await importDistributionExcelFile(file);
          if (!distRes.success) {
            throw new Error(distRes.error || 'Gagal memproses file distribusi.');
          }
          setImporting(false);
          showToast(
            'Import Distribusi Berhasil!',
            `Data Distribusi & Detail Item Galon/Karton (${distRes.totalRows} pengiriman) berhasil diimpor & disinkronkan ke Cloud Supabase.`,
            'success'
          );
          setStatusMessage({
            type: 'success',
            text: `Data Distribusi berhasil diimpor (${distRes.totalRows} pengiriman).`,
          });
          notifyImportDone();
          setTimeout(() => {
            onClose();
          }, 800);
          return;
        } else {
        const existingDist = getTableData<any>('Distribusi', []);
        const existingDetails = getTableData<any>('Distribusi_Item', []);
        const masterCustomers = getTableData<any>('MD_Pelanggan', []);
        const masterEmployees = getTableData<any>('MD_Karyawan', []);

        const newDistList: any[] = [];
        const newDetailsList: any[] = [];

        // Daftar kecamatan Klaten untuk auto-inferensi alamat/tujuan jika kosong
        const klatenAreas = [
          'Karangnongko', 'Klaten Utara', 'Klaten Selatan', 'Klaten Tengah', 'Tulung',
          'Kalikotes', 'Ceper', 'Trucuk', 'Ngawen', 'Karanganom', 'Delanggu',
          'Polanharjo', 'Pedan', 'Cawas', 'Bayat', 'Wedi', 'Prambanan', 'Jatinom',
          'Gantiwarno', 'Jogonalan', 'Karangdowo', 'Kebonarum', 'Kemalang',
          'Manisrenggo', 'Wonosari', 'Jiwan'
        ];

        // Cari driver default dari master karyawan (dengan proteksi null-safe)
        const drivers = (Array.isArray(masterEmployees) ? masterEmployees : []).filter((e: any) => {
          if (!e) return false;
          const dept = String(e.Departemen || '').toLowerCase();
          const jab = String(e.Jabatan || '').toLowerCase();
          const nama = String(e.Nama_Karyawan || '').toLowerCase();
          return dept === 'distribusi' || jab.includes('driver') || jab.includes('sopir') || nama.includes('wahyudi') || nama.includes('agus');
        });
        const defaultDriverName = drivers[0]?.Nama_Karyawan || 'Tri Wahyudi';

        // Product code definitions with ultra-rich alias matching
        const prodDefs = [
          {
            code: 'C120',
            id: 'ASH-CUP120',
            name: 'As-Shofaa Cup 120ml',
            defaultPrice: 12000,
            keywords: ['c120', 'cup120', 'c120ml', 'cup120ml', '120ml', '120', 'ashcup120', 'cup 120', 'cup 120ml', 'c 120', 'dusc120', 'dus c120']
          },
          {
            code: 'C220',
            id: 'ASH-CUP220',
            name: 'As-Shofaa Cup 220ml',
            defaultPrice: 14500,
            keywords: ['c220', 'cup220', 'c220ml', 'cup220ml', '220ml', '220', 'ashcup220', 'cup 220', 'cup 220ml', 'c 220', 'dusc220', 'dus c220']
          },
          {
            code: 'B330',
            id: 'ASH-BTL330',
            name: 'As-Shofaa Botol 330ml',
            defaultPrice: 24000,
            keywords: ['b330', 'btl330', 'botol330', 'b330ml', 'botol330ml', '330ml', '330', 'ashbtl330', 'botol 330', 'botol 330ml', 'b 330', 'dusb330', 'dus b330']
          },
          {
            code: 'B600',
            id: 'ASH-BTL600',
            name: 'As-Shofaa Botol 600ml',
            defaultPrice: 28000,
            keywords: ['b600', 'btl600', 'botol600', 'b600ml', 'botol600ml', '600ml', '600', 'ashbtl600', 'botol 600', 'botol 600ml', 'b 600', 'dusb600', 'dus b600']
          },
          {
            code: 'G19',
            id: 'ASH-GLN19L',
            name: 'As-Shofaa Galon 19L',
            defaultPrice: 9000,
            keywords: ['g19', 'gln19', 'gln19l', 'g19l', 'galon19', 'galon19l', 'galon', 'gln', '19l', '19', 'galon19liter', 'airgalon', 'galonair', 'ashgln19l', 'ashgln', 'galon 19', 'galon 19l', 'galon 19 liter', 'gln 19 l', 'gln 19']
          },
        ];

        // Quantity cleaner helper
        const parseCleanQty = (val: any): number => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
          const str = String(val).trim();
          if (!str || str === '-') return 0;
          let clean = str.replace(/[^0-9.,]/g, '');
          if (clean.includes('.') && clean.includes(',')) {
            clean = clean.replace(/\./g, '').replace(/,/g, '.');
          } else if (clean.includes(',')) {
            clean = clean.replace(/,/g, '.');
          }
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : Math.max(0, num);
        };

        // Helper to convert date strings or Excel serial numbers (mendukung Date object, serial, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, 2-digit years, Indonesian month names)
        const parseImportDate = (rawDate: any): string => {
          if (!rawDate && rawDate !== 0) return new Date().toISOString().slice(0, 10);
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            const yr = rawDate.getFullYear();
            const mo = String(rawDate.getMonth() + 1).padStart(2, '0');
            const da = String(rawDate.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
          }
          if (typeof rawDate === 'number' && rawDate > 1000) {
            const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          }
          const str = String(rawDate).trim();
          if (!str || str === '-') return new Date().toISOString().slice(0, 10);

          // Already ISO (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
          if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.slice(0, 10);
          }

          // Indonesian / English month name (e.g. 01-Okt-26, 01-Okt-2026, 1 Okt 26, 01/Oktober/2026, 01.Okt.26)
          const matchMonthText = str.match(/^(\d{1,2})[-\s/.]+([A-Za-z]{3,})[-\s/.]+(\d{2,4})/);
          if (matchMonthText) {
            const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
            const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const d = matchMonthText[1].padStart(2, '0');
            const mStr = matchMonthText[2].toLowerCase().slice(0, 3);
            let mIdx = months.indexOf(mStr);
            if (mIdx === -1) mIdx = monthsEn.indexOf(mStr);
            let yr = parseInt(matchMonthText[3], 10);
            if (yr < 100) yr += 2000;
            if (mIdx !== -1) {
              return `${yr}-${String(mIdx + 1).padStart(2, '0')}-${d}`;
            }
          }

          // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY with 2-digit or 4-digit years (01/10/26, 01/10/2026, 01-10-26, 01.10.26)
          const dmyMatch = str.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/);
          if (dmyMatch) {
            let yr = parseInt(dmyMatch[3], 10);
            if (yr < 100) yr += 2000;
            const mo = dmyMatch[2].padStart(2, '0');
            const da = dmyMatch[1].padStart(2, '0');
            return `${yr}-${mo}-${da}`;
          }

          // YYYY/MM/DD or YYYY.MM.DD
          const ymdMatch = str.match(/^(\d{4})[\/\-. ](\d{1,2})[\/\-. ](\d{1,2})/);
          if (ymdMatch) {
            return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
          }

          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) {
            const yr = parsed.getFullYear();
            const mo = String(parsed.getMonth() + 1).padStart(2, '0');
            const da = String(parsed.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${da}`;
          }
          return new Date().toISOString().slice(0, 10);
        };

        // Ultra-flexible row reader: exact, normalized, and keyword matching with collision guards
        const getRowVal = (r: any, candidates: string[]): any => {
          if (!r || typeof r !== 'object') return undefined;

          // 1. Exact candidate match
          for (const cand of candidates) {
            if (r[cand] !== undefined && r[cand] !== null && String(r[cand]).trim() !== '') return r[cand];
          }

          const keys = Object.keys(r);
          const normKeys = keys.map(k => ({
            raw: k,
            norm: k.toLowerCase().replace(/[\s_\-./]+/g, '')
          }));

          // 2. Normalized candidate match
          for (const cand of candidates) {
            const normCand = cand.toLowerCase().replace(/[\s_\-./]+/g, '');
            const found = normKeys.find(nk => nk.norm === normCand);
            if (found && r[found.raw] !== undefined && r[found.raw] !== null && String(r[found.raw]).trim() !== '') {
              return r[found.raw];
            }
          }

          // 3. Substring / contains keyword match (dengan guard: cegah kolom 'NO' atau 'ID' mencocokkan 'NO SURAT JALAN')
          for (const cand of candidates) {
            const normCand = cand.toLowerCase().replace(/[\s_\-./]+/g, '');
            if (normCand.length >= 3) {
              const found = normKeys.find(nk => {
                if (!nk.norm || nk.norm === 'no' || nk.norm === 'nomor' || nk.norm === 'nomo' || nk.norm === 'id') return false;
                if (nk.norm.includes(normCand)) return true;
                if (nk.norm.length >= 4 && normCand.includes(nk.norm)) return true;
                return false;
              });
              if (found && r[found.raw] !== undefined && r[found.raw] !== null && String(r[found.raw]).trim() !== '') {
                return r[found.raw];
              }
            }
          }

          return undefined;
        };

        // Extractor for product column values by codes and keyword aliases
        const getProductQtyFromRow = (r: any, pDef: typeof prodDefs[0]): number => {
          // 1. Direct exact or lowercase match
          if (r[pDef.code] !== undefined && r[pDef.code] !== null && String(r[pDef.code]).trim() !== '') {
            return parseCleanQty(r[pDef.code]);
          }
          const lowerCode = pDef.code.toLowerCase();
          if (r[lowerCode] !== undefined && r[lowerCode] !== null && String(r[lowerCode]).trim() !== '') {
            return parseCleanQty(r[lowerCode]);
          }
          const qtyCode = `Qty_${pDef.code}`;
          if (r[qtyCode] !== undefined && r[qtyCode] !== null && String(r[qtyCode]).trim() !== '') {
            return parseCleanQty(r[qtyCode]);
          }

          // 2. Scan all columns for keyword alias match
          const keys = Object.keys(r);
          for (const k of keys) {
            const norm = k.toLowerCase().replace(/[\s_\-./()]+/g, '');
            // Avoid false positives from metadata and financial columns
            if (norm.includes('pelanggan') || norm.includes('pengirim') || norm.includes('penerima') || norm.includes('tujuan') || norm.includes('keterangan') || norm.includes('suratjalan') || norm.includes('invoice') || norm.includes('tagihan') || norm.includes('total') || norm === 'no') {
              continue;
            }

            const matched = pDef.keywords.some(kw => {
              const normKw = kw.toLowerCase().replace(/[\s_\-./()]+/g, '');
              return norm === normKw || norm === `qty${normKw}` || norm === `jumlah${normKw}` || norm === `dus${normKw}` || (normKw.length >= 4 && norm.includes(normKw));
            });

            if (matched && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
              return parseCleanQty(r[k]);
            }
          }

          return 0;
        };

        const customerMap = new Map<string, any>();
        (Array.isArray(masterCustomers) ? masterCustomers : []).forEach((c: any) => {
          if (!c) return;
          if (c.Nama_Pelanggan) {
            customerMap.set(String(c.Nama_Pelanggan).trim().toLowerCase(), c);
          }
          if (c.ID_Pelanggan) {
            customerMap.set(String(c.ID_Pelanggan).trim().toLowerCase(), c);
          }
        });
        const newCustomersToSave: any[] = [];

        // Track distribution sequence per month/year for automatic invoice & SJ sequence
        const monthCounts = new Map<string, number>();
        (Array.isArray(existingDist) ? existingDist : []).forEach((d: any) => {
          if (d && d.Tanggal) {
            const itemD = new Date(d.Tanggal);
            if (!isNaN(itemD.getTime())) {
              const ymKey = `${itemD.getFullYear()}-${itemD.getMonth()}`;
              monthCounts.set(ymKey, (monthCounts.get(ymKey) || 0) + 1);
            }
          }
        });

        const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

        // Filter valid rows (skip completely blank trailing rows)
        const validRows = parsedRows.filter(r => {
          if (!r || typeof r !== 'object') return false;
          const vals = Object.values(r).map(v => String(v !== undefined && v !== null ? v : '').trim()).filter(v => v !== '' && v !== '-');
          return vals.length > 0;
        });

        if (validRows.length === 0) {
          throw new Error('Tidak ada baris data transaksi yang terdeteksi dari lembar kerja Excel.');
        }

        validRows.forEach((row, idx) => {
          const rawId = String(row.ID_Distribusi || `DST-${Date.now().toString().slice(-6)}-${String(idx + 1).padStart(3, '0')}`).trim();
          
          // Tanggal Kirim
          const tgl = parseImportDate(getRowVal(row, [
            'TANGGAL KIRIM', 'Tanggal_Kirim', 'Tanggal Kirim', 'Tanggal', 'Tgl_Kirim', 'Tgl',
            'Tgl Kirim', 'TGL KIRIM', 'Tanggal Pengiriman', 'Tgl Pengiriman', 'Tgl SJ', 'Tanggal SJ'
          ]));

          const dObj = new Date(tgl);
          const validD = isNaN(dObj.getTime()) ? new Date() : dObj;
          const ymKey = `${validD.getFullYear()}-${validD.getMonth()}`;
          const nextSeq = (monthCounts.get(ymKey) || 0) + 1;
          monthCounts.set(ymKey, nextSeq);

          const romanMonth = romanMonths[validD.getMonth()] || 'X';
          const yy = String(validD.getFullYear()).slice(-2);
          const seqPadded = String(nextSeq).padStart(3, '0');

          // Nama Pelanggan
          let custName = String(getRowVal(row, [
            'NAMA PELANGGAN', 'Nama_Pelanggan', 'Nama Pelanggan', 'Pelanggan', 'Customer',
            'Nama Customer', 'Mitra', 'Nama Mitra', 'Toko', 'Nama Toko', 'Pembeli', 'Agen', 'Distributor'
          ]) || '').trim();

          if (!custName || custName === '-' || custName.toLowerCase() === 'pelanggan') {
            custName = 'Pelanggan Umum';
          }

          const normCustName = custName.toLowerCase();
          const foundExistingCust = customerMap.get(normCustName);

          // Level Pelanggan
          let level = String(getRowVal(row, [
            'LEVEL', 'Level', 'Level_Pelanggan', 'Kategori', 'Tipe', 'Golongan', 'Tipe Pelanggan'
          ]) || '').trim();

          if (!level || level === '-') {
            if (foundExistingCust?.Level_Pelanggan) {
              level = foundExistingCust.Level_Pelanggan;
            } else if (custName.toUpperCase().startsWith('D.') || custName.toUpperCase().includes('MWC')) {
              level = 'Distributor';
            } else if (custName.toUpperCase().startsWith('AGEN') || custName.toUpperCase().includes('AGEN')) {
              level = 'Agen';
            } else {
              level = 'Distributor';
            }
          }

          // Metode Kirim
          let metode = String(getRowVal(row, [
            'METODE KIRIM', 'Metode_Kirim', 'Metode Kirim', 'Metode', 'Pengiriman', 'Cara Kirim', 'Via'
          ]) || '').trim();

          if (!metode || metode === '-') {
            metode = 'Diantar Armada';
          }

          // Tujuan / Alamat Pengiriman
          let tujuan = String(getRowVal(row, [
            'TUJUAN', 'Tujuan', 'Alamat', 'Alamat Tujuan', 'Alamat Pengiriman', 'Lokasi', 'Kota', 'Area', 'Rute'
          ]) || '').trim();

          if (!tujuan || tujuan === '-' || tujuan === '.') {
            if (foundExistingCust?.Alamat && foundExistingCust.Alamat.trim() !== '' && foundExistingCust.Alamat !== '-') {
              tujuan = foundExistingCust.Alamat;
            } else {
              // Deteksi otomatis kecamatan Klaten dari nama pelanggan
              let foundArea = '';
              for (const area of klatenAreas) {
                if (custName.toLowerCase().includes(area.toLowerCase())) {
                  foundArea = area.toUpperCase();
                  break;
                }
              }
              tujuan = foundArea || 'KLATEN';
            }
          }

          // ID Pelanggan
          let custId = row.ID_Pelanggan;
          if (foundExistingCust) {
            custId = foundExistingCust.ID_Pelanggan;
          } else {
            if (!custId) {
              custId = `PLG-${custName.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
            }
            const newCustObj = {
              ID_Pelanggan: custId,
              Nama_Pelanggan: custName,
              Level_Pelanggan: level,
              Alamat: tujuan !== '-' ? tujuan : 'Klaten',
              Kontak: '-',
              Status: 'Aktif'
            };
            customerMap.set(normCustName, newCustObj);
            newCustomersToSave.push(newCustObj);
          }

          // Pengirim (Driver)
          let pengirim = String(getRowVal(row, [
            'PENGIRIM', 'Pengirim', 'Driver', 'Sopir', 'Supir', 'Pengemudi', 'Kurir',
            'Nama Driver', 'Nama Sopir', 'Nama Pengirim', 'Armada', 'Ekspedisi'
          ]) || '').trim();

          if (!pengirim || pengirim === '-' || pengirim.toLowerCase() === 'driver') {
            if (metode === 'Ambil Sendiri') {
              pengirim = 'Ambil Sendiri';
            } else {
              pengirim = drivers.length > 0 ? drivers[idx % drivers.length].Nama_Karyawan : defaultDriverName;
            }
          }

          // Penerima
          let penerima = String(getRowVal(row, [
            'PENERIMA', 'Penerima', 'Nama Penerima', 'Diterima Oleh', 'Diterima', 'PIC Penerima'
          ]) || '').trim();

          if (!penerima || penerima === '-' || penerima === '.') {
            penerima = custName.replace(/^(D\.\s*MWC\s*NU|D\.\s*PR\s*NU|AGEN\s*|TOKO\s*)/i, '').trim() || custName;
          }

          // No Surat Jalan
          let rawSj = String(getRowVal(row, [
            'NO SURAT JALAN', 'No_Surat_Jalan', 'No Surat Jalan', 'No_SJ', 'No SJ', 'Surat_Jalan',
            'NO. SURAT JALAN', 'NOMOR SURAT JALAN', 'NO. SJ', 'NOMOR SJ', 'SURAT JALAN', 'SJ'
          ]) || '').trim();

          let finalSj = rawSj;
          if (!finalSj || finalSj === '-' || finalSj.startsWith('SJ-') || finalSj.toLowerCase() === 'surat jalan') {
            finalSj = `${seqPadded}/${romanMonth}/${yy}`;
          }

          // Keterangan
          const keterangan = String(getRowVal(row, ['KETERANGAN', 'Keterangan', 'Catatan', 'Note', 'Ket']) || '').trim();

          // Total Tagihan dari Excel
          const rawTagihan = getRowVal(row, ['TOTAL TAGIHAN', 'Total_Tagihan', 'Total Tagihan', 'Tagihan', 'Total', 'Grand Total', 'Subtotal', 'Nominal']);
          const tagihan = parseCleanQty(rawTagihan);

          // Invoice Number: 046-INV-X-26
          const autoInvoice = `${seqPadded}-INV-${romanMonth}-${yy}`;
          const rawInvoice = row.No_Invoice ? String(row.No_Invoice).trim() : '';
          const finalInvoice = (rawInvoice && !rawInvoice.startsWith('INV-') && rawInvoice !== '-') ? rawInvoice : autoInvoice;

          const distRecord: any = {
            ID_Distribusi: rawId,
            Tanggal: tgl,
            ID_Pelanggan: custId,
            Nama_Pelanggan: custName,
            Level_Pelanggan: level,
            Pengirim: pengirim,
            Penerima: penerima,
            Tujuan: tujuan,
            Metode_Kirim: metode,
            No_Surat_Jalan: finalSj,
            No_Invoice: finalInvoice,
            Keterangan: keterangan,
            Total_Tagihan: tagihan > 0 ? tagihan : undefined,
          };

          // 1. Check for product columns (C120, C220, B330, B600, G19/Galon)
          let hasColumnProducts = false;
          const thisRowQuantities: Record<string, number> = {};
          const thisRowDetails: any[] = [];

          prodDefs.forEach((pDef, pIdx) => {
            const qty = getProductQtyFromRow(row, pDef);
            thisRowQuantities[pDef.code] = qty;
            if (qty > 0) {
              hasColumnProducts = true;
              thisRowDetails.push({
                ID_Detail: `${rawId}-D${pIdx + 1}`,
                ID_Distribusi: rawId,
                ID_Produk: pDef.id,
                Nama_Produk: pDef.name,
                Qty: qty,
                Harga_Satuan: pDef.defaultPrice,
                Subtotal: qty * pDef.defaultPrice,
              });
            }
          });

          // Store direct product quantities on distRecord
          prodDefs.forEach(pDef => {
            const q = thisRowQuantities[pDef.code] || 0;
            distRecord[pDef.code] = q;
            distRecord[pDef.id] = q;
            if (pDef.code === 'G19') {
              distRecord['Galon'] = q;
              distRecord['galon'] = q;
              distRecord['GLN19'] = q;
              distRecord['gln19'] = q;
              distRecord['GLN'] = q;
            }
          });

          // 2. Fallback: single item per row format
          if (!hasColumnProducts) {
            const rawProd = String(getRowVal(row, ['ID_Produk', 'Nama_Produk', 'Produk', 'Item', 'Barang']) || '').trim();
            const rawQty = parseCleanQty(getRowVal(row, ['Qty', 'Jumlah', 'QTY', 'JUMLAH', 'Volume']));
            if (rawProd && rawQty > 0) {
              const prodLower = rawProd.toLowerCase();
              let matchedDef = prodDefs.find(p => p.id === rawProd || p.code.toLowerCase() === prodLower);
              if (!matchedDef) {
                if (prodLower.includes('galon') || prodLower.includes('gln') || prodLower.includes('19')) {
                  matchedDef = prodDefs.find(p => p.code === 'G19');
                } else if (prodLower.includes('120')) {
                  matchedDef = prodDefs.find(p => p.code === 'C120');
                } else if (prodLower.includes('220')) {
                  matchedDef = prodDefs.find(p => p.code === 'C220');
                } else if (prodLower.includes('330')) {
                  matchedDef = prodDefs.find(p => p.code === 'B330');
                } else if (prodLower.includes('600')) {
                  matchedDef = prodDefs.find(p => p.code === 'B600');
                }
              }
              const finalDef = matchedDef || prodDefs[1]; // fallback C220
              const price = parseCleanQty(getRowVal(row, ['Harga_Satuan', 'Harga Satuan', 'Harga', 'Price'])) || finalDef.defaultPrice;

              distRecord[finalDef.code] = rawQty;
              distRecord[finalDef.id] = rawQty;

              thisRowDetails.push({
                ID_Detail: `${rawId}-D1`,
                ID_Distribusi: rawId,
                ID_Produk: finalDef.id,
                Nama_Produk: finalDef.name,
                Qty: rawQty,
                Harga_Satuan: price,
                Subtotal: rawQty * price,
                Keterangan: keterangan,
              });
            }
          }

          // Calculate Total_Tagihan if not specified in Excel
          if (!distRecord.Total_Tagihan || distRecord.Total_Tagihan <= 0) {
            let totalSub = 0;
            let totalQty = 0;
            thisRowDetails.forEach(it => {
              totalSub += it.Subtotal;
              totalQty += it.Qty;
            });
            const potongan = metode === 'Ambil Sendiri' ? (totalQty * 1000) : 0;
            distRecord.Total_Tagihan = Math.max(0, totalSub - potongan);
          }

          thisRowDetails.forEach(d => newDetailsList.push(d));
          newDistList.push(distRecord);
        });

        // SAFE UPSERT & COMBINE: Memastikan TIDAK ADA baris data yang tertolak atau hilang!
        const distMap = new Map<string, any>();
        existingDist.forEach((item: any) => {
          if (item && item.ID_Distribusi) {
            distMap.set(item.ID_Distribusi, item);
          }
        });

        // Map Surat Jalan lama HANYA untuk Surat Jalan riil yang spesifik
        const sjToIdMap = new Map<string, string>();
        existingDist.forEach((item: any) => {
          if (item && item.No_Surat_Jalan) {
            const cleanSj = String(item.No_Surat_Jalan).trim().toLowerCase();
            // Abaikan surat jalan generic / dummy agar tidak terjadi tabrakan penimpaan
            if (cleanSj && cleanSj !== '-' && !cleanSj.startsWith('sj-') && cleanSj.length > 2) {
              const uniqueKey = `${cleanSj}___${String(item.Nama_Pelanggan || '').trim().toLowerCase()}`;
              sjToIdMap.set(uniqueKey, item.ID_Distribusi);
            }
          }
        });

        const replacedDistIds = new Set<string>();

        newDistList.forEach(newDist => {
          const normSj = String(newDist.No_Surat_Jalan || '').trim().toLowerCase();
          const normCust = String(newDist.Nama_Pelanggan || '').trim().toLowerCase();
          const uniqueKey = `${normSj}___${normCust}`;

          // Hanya lakukan replace jika:
          // 1. ID_Distribusi cocok dengan data lama, ATAU
          // 2. No Surat Jalan riil cocok DAN Nama Pelanggan SAMA!
          const matchedIdBySj = (normSj && normSj !== '-' && !normSj.startsWith('sj-')) ? sjToIdMap.get(uniqueKey) : undefined;

          if (matchedIdBySj && distMap.has(matchedIdBySj)) {
            const existingId = matchedIdBySj;
            newDetailsList.forEach(det => {
              if (det && det.ID_Distribusi === newDist.ID_Distribusi) {
                det.ID_Distribusi = existingId;
                if (det.ID_Detail) {
                  det.ID_Detail = String(det.ID_Detail).replace(newDist.ID_Distribusi, existingId);
                }
              }
            });
            newDist.ID_Distribusi = existingId;
            distMap.set(existingId, { ...distMap.get(existingId), ...newDist });
            replacedDistIds.add(existingId);
          } else if (distMap.has(newDist.ID_Distribusi)) {
            distMap.set(newDist.ID_Distribusi, { ...distMap.get(newDist.ID_Distribusi), ...newDist });
            replacedDistIds.add(newDist.ID_Distribusi);
          } else {
            // Data pengiriman baru yang independen
            distMap.set(newDist.ID_Distribusi, newDist);
            if (normSj && normSj !== '-' && !normSj.startsWith('sj-')) {
              sjToIdMap.set(uniqueKey, newDist.ID_Distribusi);
            }
          }
        });

        // Retain detail items for unreplaced records
        const retainedDetails = (Array.isArray(existingDetails) ? existingDetails : []).filter((d: any) => d && !replacedDistIds.has(d.ID_Distribusi));
        const combinedDist = Array.from(distMap.values()).filter((d: any) => d && typeof d === 'object');
        const combinedDetails = [...retainedDetails, ...newDetailsList].filter((d: any) => d && typeof d === 'object');

        // Simpan bulan data yang baru diimpor SEBELUM saveTableData agar event airis_db_updated langsung mengaktifkan bulannya
        if (newDistList.length > 0 && newDistList[0].Tanggal) {
          const sampleMonth = String(newDistList[0].Tanggal).slice(0, 7);
          try {
            localStorage.setItem('airis_last_imported_dist_month', sampleMonth);
          } catch {
            // ignore
          }
        }

        await saveTableData('Distribusi', combinedDist);
        await saveTableData('Distribusi_Item', combinedDetails);
        if (newCustomersToSave.length > 0) {
          await saveTableData('MD_Pelanggan', [...(Array.isArray(masterCustomers) ? masterCustomers : []), ...newCustomersToSave]);
        }
        }
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

        // Helper: resolve ID_Produk from name or code
        const resolveIDProduk = (rawId: any, rawName: any): string => {
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
          // Return as-is if we can't resolve — at least keep a string
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
        // ── UNIFIED QC IMPORT HANDLER ────────────────────────────────────
        // 1 file import parsed into both QC Headers (Data_QC) and Cycle Details (Data_QC_Detail)
        const existingHeaders = getTableData<any>('Data_QC', []);
        const existingDetails = getTableData<any>('Data_QC_Detail', []);

        // Helper to convert date strings or excel serials
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

        const newHeadersMap = new Map<string, any>();
        const newDetails: any[] = [];

        parsedRows.forEach((row, idx) => {
          const rawDate = row['Tanggal'] || row['Tgl Uji'] || row['Tgl_Uji'] || row['Tanggal_Uji'];
          const tgl = parseQcDate(rawDate);
          const produk = row['Produk'] || row['Nama_Produk'] || 'As-Shofaa Botol 600 ml';
          const petugas = row['Petugas_QC'] || row['Petugas'] || 'Nurul Hidayati';
          const idProd = row['ID_Produksi'] || row['ID Produksi'] || '';

          // Determine or generate ID_QC
          let idQc = row['ID_QC'] || row['ID QC'] || row['No Dokumen'] || row['No_Dokumen'];
          if (!idQc) {
            const d = new Date(tgl);
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            idQc = `QC-${yy}${mm}${dd}01`;
          }

          // Parse Siklus number (e.g., "Siklus 1" or 1)
          let siklusNum = 1;
          const rawSiklus = String(row['Siklus'] || row['Cycle'] || '1');
          const siklusMatch = rawSiklus.match(/\d+/);
          if (siklusMatch) {
            siklusNum = parseInt(siklusMatch[0], 10);
          } else {
            siklusNum = (idx % 3) + 1;
          }

          // Add / Update header in Map
          if (!newHeadersMap.has(idQc)) {
            newHeadersMap.set(idQc, {
              ID_QC: idQc,
              Tanggal: tgl,
              Bulan_Tahun: tgl.slice(0, 7),
              Produk: produk,
              Petugas_QC: petugas,
              Kesimpulan: row['Kesimpulan'] || 'LAYAK - Memenuhi Standar Mutu SNI 3553:2023',
              Status_Data: 'Lengkap',
              Waktu_Input: new Date().toISOString(),
              ID_Produksi: idProd || undefined
            });
          }

          // Parse detail row
          newDetails.push({
            ID_QC: idQc,
            Siklus: siklusNum,
            // Air Baku
            Baku_pH: String(row['Baku_pH'] ?? row['pH_Baku'] ?? row['pH'] ?? '7.5'),
            Baku_TDS: String(row['Baku_TDS'] ?? row['TDS_Baku'] ?? row['TDS'] ?? '121'),
            Baku_Kekeruhan: String(row['Baku_Kekeruhan'] ?? row['Keruh_Baku'] ?? row['Kekeruhan'] ?? '0.25'),
            Baku_Bau: String(row['Baku_Bau'] ?? row['Bau_Baku'] ?? row['Bau'] ?? 'TB'),
            Baku_Coliform: String(row['Baku_Coliform'] ?? row['Coli_Baku'] ?? row['Coliform'] ?? '0'),
            // Air Proses
            Proses_pH: String(row['Proses_pH'] ?? row['pH_Proses'] ?? row['pH'] ?? '7.4'),
            Proses_TDS: String(row['Proses_TDS'] ?? row['TDS_Proses'] ?? row['TDS'] ?? '115'),
            Proses_Kekeruhan: String(row['Proses_Kekeruhan'] ?? row['Keruh_Proses'] ?? row['Kekeruhan'] ?? '0.22'),
            Proses_Bau: String(row['Proses_Bau'] ?? row['Bau_Proses'] ?? row['Bau'] ?? 'TB'),
            Proses_Rasa: String(row['Proses_Rasa'] ?? row['Rasa_Proses'] ?? row['Rasa'] ?? 'Segar'),
            Proses_Ozon: String(row['Proses_Ozon'] ?? row['Ozon_Proses'] ?? row['Ozon'] ?? '0.12'),
            // Air Jadi
            Jadi_pH: String(row['Jadi_pH'] ?? row['pH_Jadi'] ?? row['pH'] ?? '7.5'),
            Jadi_TDS: String(row['Jadi_TDS'] ?? row['TDS_Jadi'] ?? row['TDS'] ?? '121'),
            Jadi_Kekeruhan: String(row['Jadi_Kekeruhan'] ?? row['Keruh_Jadi'] ?? row['Keruh'] ?? '0.25'),
            Jadi_Bau: String(row['Jadi_Bau'] ?? row['Bau_Jadi'] ?? row['Bau'] ?? 'TB'),
            Jadi_Rasa: String(row['Jadi_Rasa'] ?? row['Rasa_Jadi'] ?? row['Rasa'] ?? 'Segar'),
            Jadi_Ozon: String(row['Jadi_Ozon'] ?? row['Ozon_Jadi'] ?? row['Ozon'] ?? '0.08'),
            Jadi_ALT_Awal: String(row['Jadi_ALT_Awal'] ?? row['ALT_Awal'] ?? '10'),
            Jadi_ALT_Akhir: String(row['Jadi_ALT_Akhir'] ?? row['ALT_Akhir'] ?? '20'),
            Jadi_Coliform: String(row['Jadi_Coliform'] ?? row['Coli_Jadi'] ?? row['Coliform'] ?? '0')
          });
        });

        const newHeaders = Array.from(newHeadersMap.values());
        
        // Merge with existing avoiding duplicates
        const updatedHeaders = [
          ...existingHeaders.filter(h => !newHeadersMap.has(h.ID_QC)),
          ...newHeaders
        ];

        const importedQcIds = new Set(newHeaders.map(h => h.ID_QC));
        const updatedDetails = [
          ...existingDetails.filter(d => !importedQcIds.has(d.ID_QC)),
          ...newDetails
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
