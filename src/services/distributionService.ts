/**
 * AIRIS Enterprise - Distribution Database Sanitizer & Repair Service
 * Memperbaiki dan melengkapi data distribusi yang kosong (Surat Jalan, Pengirim, Penerima, Tujuan, Invoice, dll.)
 * serta menyinkronkan item produk ke Distribusi_Item dan Jurnal Keuangan.
 */

import { getTableData, setTableData, getSupabaseConfig, syncTableToSupabaseExplicit } from './dbAdapter';
import { 
  DistributionItem, DistributionProductDetail, ProductItem, 
  CustomerItem, EmployeeItem, DraftJournalItem, ReceivablePayableItem 
} from '../types';
import { syncAllModulesToFinance } from './financeSyncService';
import { parseExcelFile } from './excelService';

// Daftar wilayah / kecamatan di Klaten untuk inferensi otomatis jika Alamat kosong
const KLATEN_DISTRICTS = [
  'Karangnongko', 'Klaten Utara', 'Klaten Selatan', 'Klaten Tengah', 'Tulung',
  'Kalikotes', 'Ceper', 'Trucuk', 'Ngawen', 'Karanganom', 'Delanggu',
  'Polanharjo', 'Pedan', 'Cawas', 'Bayat', 'Wedi', 'Prambanan', 'Jatinom',
  'Gantiwarno', 'Jogonalan', 'Karangdowo', 'Kebonarum', 'Kemalang',
  'Manisrenggo', 'Wonosari', 'Jiwan'
];

// Definisi standar 5 produk AMDK beserta seluruh variasi alias nama kolom Excel
export interface ProductDefWithAliases {
  code: string;
  id: string;
  name: string;
  price: number;
  aliases: string[];
}

export const DEFAULT_PRODUCT_DEFS: ProductDefWithAliases[] = [
  { 
    code: 'C120', 
    id: 'ASH-CUP120', 
    name: 'As-Shofaa Cup 120ml', 
    price: 12000,
    aliases: ['c120', 'cup120', 'c120ml', 'cup120ml', '120ml', '120', 'ashcup120', 'ash-cup120', 'cup 120', 'cup 120ml', 'c 120', 'dusc120', 'dus c120', 'qty c120', 'jumlah c120', 'c120 (cup 120ml)']
  },
  { 
    code: 'C220', 
    id: 'ASH-CUP220', 
    name: 'As-Shofaa Cup 220ml', 
    price: 14500,
    aliases: ['c220', 'cup220', 'c220ml', 'cup220ml', '220ml', '220', 'ashcup220', 'ash-cup220', 'cup 220', 'cup 220ml', 'c 220', 'dusc220', 'dus c220', 'qty c220', 'jumlah c220', 'c220 (cup 220ml)']
  },
  { 
    code: 'B330', 
    id: 'ASH-BTL330', 
    name: 'As-Shofaa Botol 330ml', 
    price: 24000,
    aliases: ['b330', 'btl330', 'botol330', 'b330ml', 'botol330ml', '330ml', '330', 'ashbtl330', 'ash-btl330', 'botol 330', 'botol 330ml', 'b 330', 'dusb330', 'dus b330', 'qty b330', 'jumlah b330']
  },
  { 
    code: 'B600', 
    id: 'ASH-BTL600', 
    name: 'As-Shofaa Botol 600ml', 
    price: 28000,
    aliases: ['b600', 'btl600', 'botol600', 'b600ml', 'botol600ml', '600ml', '600', 'ashbtl600', 'ash-btl600', 'botol 600', 'botol 600ml', 'b 600', 'dusb600', 'dus b600', 'qty b600', 'jumlah b600']
  },
  { 
    code: 'G19', 
    id: 'ASH-GLN19L', 
    name: 'As-Shofaa Galon 19L', 
    price: 9000,
    aliases: [
      'g19', 'gln19', 'gln19l', 'g19l', 'galon19', 'galon19l', 'galon', 'gln', '19l', '19', 
      'galon19liter', 'airgalon', 'galonair', 'ashgln19l', 'ash-gln19l', 'ashgln', 'ash-gln',
      'galon 19', 'galon 19l', 'galon 19 liter', 'gln 19 l', 'gln 19', 'g 19', 'g-19',
      'qty g19', 'qty galon', 'jumlah g19', 'jumlah galon', 'volume galon', 'galon isi',
      'g19 (galon)', 'galon (g19)', 'air minum galon', 'as-shofaa galon', 'as-shofaa galon 19l',
      'galon as-shofaa', 'galon refill', 'refill galon', 'kemasan galon'
    ]
  },
];

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Helper tanggal
const parseDate = (raw: any): Date => {
  if (!raw && raw !== 0) return new Date();
  if (raw instanceof Date) return isNaN(raw.getTime()) ? new Date() : raw;
  if (typeof raw === 'number' && raw > 1000) {
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  const str = String(raw).trim();
  if (!str) return new Date();

  // YYYY-MM-DD
  const iso = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (dmy) {
    let yr = Number(dmy[3]);
    if (yr < 100) yr += 2000;
    const d = new Date(yr, Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD-Mmm-YYYY
  const indMatch = str.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{2,4})$/);
  if (indMatch) {
    const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
    const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const day = Number(indMatch[1]);
    const mStr = indMatch[2].toLowerCase().slice(0, 3);
    let mIdx = months.indexOf(mStr);
    if (mIdx === -1) mIdx = monthsEn.indexOf(mStr);
    let yr = Number(indMatch[3]);
    if (yr < 100) yr += 2000;
    if (mIdx !== -1) {
      return new Date(yr, mIdx, day);
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
};

const formatDateISO = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface DistributionRepairResult {
  totalProcessed: number;
  fixedRecordsCount: number;
  fixedSuratJalanCount: number;
  fixedPengirimCount: number;
  fixedPenerimaCount: number;
  fixedTujuanCount: number;
  fixedInvoiceCount: number;
  syncedItemsCount: number;
  details: string[];
}

/**
 * Memindai seluruh database distribusi dan secara otomatis merapikan
 * format data standar tanpa mengubah atau mengarang kuantitas produk.
 */
export function sanitizeAndRepairDistributionDatabase(): DistributionRepairResult {
  try {
    const rawDist = getTableData<DistributionItem>('Distribusi', []) || [];
    const rawItems = getTableData<DistributionProductDetail>('Distribusi_Item', []) || [];
    const rawCustomers = getTableData<CustomerItem>('MD_Pelanggan', []) || [];
    const rawEmployees = getTableData<EmployeeItem>('MD_Karyawan', []) || [];
    const rawProducts = getTableData<ProductItem>('MD_Produk', []) || [];

    const currentDist = (Array.isArray(rawDist) ? rawDist : []).filter(d => d && typeof d === 'object');
    const currentItems = (Array.isArray(rawItems) ? rawItems : []).filter(it => it && typeof it === 'object');
    const customers = (Array.isArray(rawCustomers) ? rawCustomers : []).filter(c => c && typeof c === 'object');
    const employees = (Array.isArray(rawEmployees) ? rawEmployees : []).filter(e => e && typeof e === 'object');
    const products = (Array.isArray(rawProducts) ? rawProducts : []).filter(p => p && typeof p === 'object');

    // Map pelanggan untuk lookup cepat (dengan safe string conversion)
    const custMap = new Map<string, CustomerItem>();
    customers.forEach(c => {
      if (!c) return;
      if (c.ID_Pelanggan) custMap.set(String(c.ID_Pelanggan).trim().toLowerCase(), c);
      if (c.Nama_Pelanggan) custMap.set(String(c.Nama_Pelanggan).trim().toLowerCase(), c);
    });

    // Cari driver default dari master karyawan (dengan null-safe checks)
    const drivers = employees.filter(e => {
      if (!e) return false;
      const dept = String(e.Departemen || '').toLowerCase();
      const jab = String(e.Jabatan || '').toLowerCase();
      const nama = String(e.Nama_Karyawan || '').toLowerCase();
      return dept === 'distribusi' || jab.includes('driver') || jab.includes('sopir') || nama.includes('wahyudi') || nama.includes('agus');
    });
    const defaultDriverName = drivers[0]?.Nama_Karyawan || 'Tri Wahyudi';

    let fixedSuratJalanCount = 0;
    let fixedPengirimCount = 0;
    let fixedPenerimaCount = 0;
    let fixedTujuanCount = 0;
    let fixedInvoiceCount = 0;
    let syncedItemsCount = 0;
    let fixedRecordsCount = 0;
    const details: string[] = [];

    // Urutan sequence bulanan untuk No Surat Jalan & Invoice
    const monthSeqMap = new Map<string, number>();

    // Map item berelasi
    const itemMap = new Map<string, DistributionProductDetail[]>();
    currentItems.forEach(it => {
      if (!it) return;
      const parentId = String(it.ID_Distribusi || '').trim();
      if (!itemMap.has(parentId)) itemMap.set(parentId, []);
      itemMap.get(parentId)!.push(it);
    });

    const repairedDist: DistributionItem[] = [];
    const repairedItemsList: DistributionProductDetail[] = [...currentItems];

    // Urutkan data berdasarkan tanggal transaksi agar nomor urut konsisten
    const sortedDist = [...currentDist].sort((a, b) => {
      const da = parseDate(a?.Tanggal).getTime();
      const db = parseDate(b?.Tanggal).getTime();
      return da - db;
    });

    sortedDist.forEach((dist, idx) => {
      if (!dist) return;
      const dObj = parseDate(dist.Tanggal);
      const ymd = formatDateISO(dObj);
      const yr = dObj.getFullYear();
      const yy = String(yr).slice(-2);
      const mIdx = dObj.getMonth();
      const romanM = ROMAN_MONTHS[mIdx] || 'X';
      const ymKey = `${yr}-${mIdx}`;

      const seq = (monthSeqMap.get(ymKey) || 0) + 1;
      monthSeqMap.set(ymKey, seq);
      const seqPadded = String(seq).padStart(3, '0');

      let isModified = false;
      const anyDist = { ...dist } as any;

      // 1. Perbaiki Tanggal jika tidak valid
      if (!anyDist.Tanggal || String(anyDist.Tanggal).trim() === '' || anyDist.Tanggal === '-') {
        anyDist.Tanggal = ymd;
        isModified = true;
      }

      // 2. Perbaiki Nama Pelanggan & ID Pelanggan
      let custName = String(anyDist.Nama_Pelanggan || '').trim();
      if (!custName || custName === '-' || custName.toLowerCase() === 'pelanggan') {
        custName = 'Pelanggan Umum';
        anyDist.Nama_Pelanggan = custName;
        isModified = true;
      }

      const matchedCust = custMap.get(custName.toLowerCase()) || custMap.get(String(anyDist.ID_Pelanggan || '').toLowerCase());
      if (!anyDist.ID_Pelanggan || String(anyDist.ID_Pelanggan).trim() === '' || anyDist.ID_Pelanggan === '-') {
        anyDist.ID_Pelanggan = matchedCust ? matchedCust.ID_Pelanggan : `PLG-${custName.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
        isModified = true;
      }

      // 3. Perbaiki Level Pelanggan
      if (!anyDist.Level_Pelanggan || String(anyDist.Level_Pelanggan).trim() === '' || anyDist.Level_Pelanggan === '-') {
        if (matchedCust?.Level_Pelanggan) {
          anyDist.Level_Pelanggan = matchedCust.Level_Pelanggan;
        } else if (custName.toUpperCase().startsWith('D.') || custName.toUpperCase().includes('MWC')) {
          anyDist.Level_Pelanggan = 'Distributor';
        } else if (custName.toUpperCase().startsWith('AGEN') || custName.toUpperCase().includes('AGEN')) {
          anyDist.Level_Pelanggan = 'Agen';
        } else {
          anyDist.Level_Pelanggan = 'Distributor';
        }
        isModified = true;
      }

      // 4. Perbaiki Metode Kirim
      if (!anyDist.Metode_Kirim || String(anyDist.Metode_Kirim).trim() === '' || anyDist.Metode_Kirim === '-') {
        const ket = String(anyDist.Keterangan || '').toLowerCase();
        const pgr = String(anyDist.Pengirim || '').toLowerCase();
        if (ket.includes('ambil') || pgr.includes('ambil')) {
          anyDist.Metode_Kirim = 'Ambil Sendiri';
        } else {
          anyDist.Metode_Kirim = 'Diantar Armada';
        }
        isModified = true;
      }

      // 5. Perbaiki Pengirim (Driver)
      const rawPengirim = String(anyDist.Pengirim || '').trim();
      if (!rawPengirim || rawPengirim === '-' || rawPengirim.toLowerCase() === 'driver') {
        if (anyDist.Metode_Kirim === 'Ambil Sendiri') {
          anyDist.Pengirim = 'Ambil Sendiri';
        } else {
          anyDist.Pengirim = drivers.length > 0 ? drivers[idx % drivers.length].Nama_Karyawan : defaultDriverName;
        }
        fixedPengirimCount++;
        isModified = true;
      }

      // 6. Perbaiki Tujuan / Alamat Pengiriman
      const rawTujuan = String(anyDist.Tujuan || '').trim();
      if (!rawTujuan || rawTujuan === '-' || rawTujuan === '.') {
        if (matchedCust?.Alamat && String(matchedCust.Alamat).trim() !== '' && matchedCust.Alamat !== '-') {
          anyDist.Tujuan = matchedCust.Alamat;
        } else {
          let foundArea = '';
          for (const distName of KLATEN_DISTRICTS) {
            if (custName.toLowerCase().includes(distName.toLowerCase())) {
              foundArea = distName.toUpperCase();
              break;
            }
          }
          anyDist.Tujuan = foundArea || 'KLATEN';
        }
        fixedTujuanCount++;
        isModified = true;
      }

      // 7. Perbaiki Penerima
      const rawPenerima = String(anyDist.Penerima || '').trim();
      if (!rawPenerima || rawPenerima === '-' || rawPenerima === '.') {
        if (anyDist.Pengirim && anyDist.Metode_Kirim === 'Ambil Sendiri') {
          anyDist.Penerima = custName;
        } else {
          anyDist.Penerima = custName.replace(/^(D\.\s*MWC\s*NU|D\.\s*PR\s*NU|AGEN\s*|TOKO\s*)/i, '').trim() || custName;
        }
        fixedPenerimaCount++;
        isModified = true;
      }

      // 8. Perbaiki No Surat Jalan
      const rawSj = String(anyDist.No_Surat_Jalan || '').trim();
      if (!rawSj || rawSj === '-' || rawSj.startsWith('SJ-') || rawSj.toLowerCase() === 'surat jalan') {
        anyDist.No_Surat_Jalan = `${seqPadded}/${romanM}/${yy}`;
        fixedSuratJalanCount++;
        isModified = true;
      }

      // 9. Perbaiki No Invoice
      const rawInv = String(anyDist.No_Invoice || '').trim();
      const standardInv = `${seqPadded}-INV-${romanM}-${yy}`;
      if (!rawInv || rawInv === '-' || !rawInv.includes('-INV-')) {
        anyDist.No_Invoice = standardInv;
        fixedInvoiceCount++;
        isModified = true;
      }

      // 10. Sinkronisasi Detail Produk & Distribusi_Item Murni Sesuai Nilai Import
      let distItems = itemMap.get(anyDist.ID_Distribusi) || [];
      let totalQtyCalc = 0;
      let totalTagihanCalc = 0;

      // Ambil nilai Qty Galon yang tersimpan dari hasil import Excel
      let galonQtyInDist = Number(
        anyDist.G19 || anyDist.g19 || anyDist.GLN19 || anyDist.gln19 || 
        anyDist.Galon || anyDist.galon || anyDist.GALON || anyDist.GLN || anyDist.gln || 
        anyDist['GLN 19 L'] || anyDist['Galon 19L'] || anyDist['ASH-GLN19L'] || 0
      );

      // Pastikan semua field alias galon terisi jika galonQtyInDist > 0
      if (galonQtyInDist > 0) {
        if (!anyDist.G19) { anyDist.G19 = galonQtyInDist; isModified = true; }
        if (!anyDist.Galon) { anyDist.Galon = galonQtyInDist; isModified = true; }
        if (!anyDist.GLN19) { anyDist.GLN19 = galonQtyInDist; isModified = true; }
        if (!anyDist['ASH-GLN19L']) { anyDist['ASH-GLN19L'] = galonQtyInDist; isModified = true; }
      }

      if (distItems.length === 0) {
        DEFAULT_PRODUCT_DEFS.forEach((pDef, pIdx) => {
          let q = 0;
          if (pDef.code === 'G19') {
            q = galonQtyInDist;
          } else {
            q = Number(anyDist[pDef.code] || anyDist[pDef.code.toLowerCase()] || anyDist[pDef.id] || 0);
          }
          if (q > 0) {
            const detailItem: DistributionProductDetail = {
              ID_Detail: `${anyDist.ID_Distribusi}-${pDef.code}`,
              ID_Distribusi: anyDist.ID_Distribusi,
              Nama_Pelanggan: custName,
              Tanggal: anyDist.Tanggal,
              Level_Pelanggan: anyDist.Level_Pelanggan,
              ID_Produk: pDef.id,
              Nama_Produk: pDef.name,
              Qty: q,
              Harga_Satuan: pDef.price,
              Subtotal: q * pDef.price,
              Satuan: pDef.code === 'G19' ? 'Galon' : 'Dus'
            };
            distItems.push(detailItem);
            repairedItemsList.push(detailItem);
            syncedItemsCount++;
            isModified = true;
          }
        });

        if (distItems.length > 0) {
          itemMap.set(anyDist.ID_Distribusi, distItems);
        }
      } else {
        // Bi-Directional Sync murni:
        // A. Jika distItems SUDAH ADA item Galon, pastikan field anyDist.G19 juga sinkron terisi!
        const existingGalonInItems = distItems.find(it => 
          it.ID_Produk === 'ASH-GLN19L' || 
          String(it.ID_Produk || '').toLowerCase() === 'g19' || 
          String(it.Nama_Produk || '').toLowerCase().includes('galon')
        );

        if (existingGalonInItems && Number(existingGalonInItems.Qty) > 0) {
          const gq = Number(existingGalonInItems.Qty);
          if (Number(anyDist.G19 || 0) !== gq) {
            anyDist.G19 = gq;
            anyDist.Galon = gq;
            anyDist.GLN19 = gq;
            anyDist['ASH-GLN19L'] = gq;
            isModified = true;
          }
        } else if (galonQtyInDist > 0) {
          // B. Jika record dist memiliki data galon tapi belum masuk ke distItems
          const galonDef = DEFAULT_PRODUCT_DEFS.find(p => p.code === 'G19')!;
          const detailItem: DistributionProductDetail = {
            ID_Detail: `${anyDist.ID_Distribusi}-G19`,
            ID_Distribusi: anyDist.ID_Distribusi,
            Nama_Pelanggan: custName,
            Tanggal: anyDist.Tanggal,
            Level_Pelanggan: anyDist.Level_Pelanggan,
            ID_Produk: galonDef.id,
            Nama_Produk: galonDef.name,
            Qty: galonQtyInDist,
            Harga_Satuan: galonDef.price,
            Subtotal: galonQtyInDist * galonDef.price,
            Satuan: 'Galon'
          };
          distItems.push(detailItem);
          repairedItemsList.push(detailItem);
          syncedItemsCount++;
          isModified = true;
        }

        // C. Pastikan produk-produk lain juga tersinkron dari distItems ke properti direct anyDist
        DEFAULT_PRODUCT_DEFS.forEach(pDef => {
          if (pDef.code !== 'G19') {
            const itm = distItems.find(i => i.ID_Produk === pDef.id || String(i.Nama_Produk || '').toLowerCase().includes(pDef.code.toLowerCase()));
            if (itm && Number(itm.Qty) > 0 && !anyDist[pDef.code]) {
              anyDist[pDef.code] = Number(itm.Qty);
              anyDist[pDef.id] = Number(itm.Qty);
              isModified = true;
            }
          }
        });
      }

      distItems.forEach(it => {
        if (!it) return;
        totalQtyCalc += Number(it.Qty) || 0;
        totalTagihanCalc += Number(it.Subtotal) || 0;
      });

      if (anyDist.Metode_Kirim === 'Ambil Sendiri') {
        totalTagihanCalc = Math.max(0, totalTagihanCalc - (totalQtyCalc * 1000));
      }

      if (!anyDist.Total_Tagihan || Number(anyDist.Total_Tagihan) <= 0) {
        if (totalTagihanCalc > 0) {
          anyDist.Total_Tagihan = totalTagihanCalc;
          isModified = true;
        }
      }

      if (isModified) {
        fixedRecordsCount++;
        details.push(`Distribusi ${anyDist.ID_Distribusi} (${custName}): SJ diperbarui ke ${anyDist.No_Surat_Jalan}, Pengirim: ${anyDist.Pengirim}, Tujuan: ${anyDist.Tujuan}`);
      }

      repairedDist.push(anyDist);
    });

    // Simpan data bersih kembali ke storage
    if (fixedRecordsCount > 0 || syncedItemsCount > 0) {
      setTableData('Distribusi', repairedDist);
      setTableData('Distribusi_Item', repairedItemsList);
      try {
        syncAllModulesToFinance();
      } catch (syncErr) {
        console.warn('Finance sync warning inside distribution repair:', syncErr);
      }

      // Auto-sinkronkan data galon & distribusi yang telah diperbaiki ke Supabase Cloud
      try {
        const cfg = getSupabaseConfig();
        if (cfg.isConnected && cfg.url && cfg.anonKey) {
          syncTableToSupabaseExplicit('MD_Produk').catch(() => {});
          syncTableToSupabaseExplicit('MD_Pelanggan').catch(() => {});
          syncTableToSupabaseExplicit('Distribusi', repairedDist).catch(() => {});
          syncTableToSupabaseExplicit('Distribusi_Item', repairedItemsList).catch(() => {});
        }
      } catch (cloudErr) {
        console.warn('Supabase cloud sync warning inside distribution repair:', cloudErr);
      }
    }

    return {
      totalProcessed: sortedDist.length,
      fixedRecordsCount,
      fixedSuratJalanCount,
      fixedPengirimCount,
      fixedPenerimaCount,
      fixedTujuanCount,
      fixedInvoiceCount,
      syncedItemsCount,
      details
    };
  } catch (err: any) {
    console.warn('Error in sanitizeAndRepairDistributionDatabase:', err);
    return {
      totalProcessed: 0,
      fixedRecordsCount: 0,
      fixedSuratJalanCount: 0,
      fixedPengirimCount: 0,
      fixedPenerimaCount: 0,
      fixedTujuanCount: 0,
      fixedInvoiceCount: 0,
      syncedItemsCount: 0,
      details: [`Peringatan: ${err?.message || 'Sanitasi dilewati'}`]
    };
  }
}

/**
 * Mengimpor file Excel distribusi secara langsung dan tuntas ke database.
 * Mendukung format multi-bulan, header gabungan, dan auto-sinkronisasi item & invoice.
 */
export async function importDistributionExcelFile(file: File): Promise<{
  success: boolean;
  totalRows: number;
  sampleMonth: string;
  error?: string;
}> {
  try {
    const parseResult = await parseExcelFile(file, 'distribusi');
    if (!parseResult.success || !parseResult.data || parseResult.data.length === 0) {
      return {
        success: false,
        totalRows: 0,
        sampleMonth: '',
        error: parseResult.error || 'File Excel kosong atau tidak memiliki baris data yang valid.'
      };
    }

    const parsedRows = parseResult.data;
    const existingDist = getTableData<DistributionItem>('Distribusi', []) || [];
    const existingDetails = getTableData<DistributionProductDetail>('Distribusi_Item', []) || [];
    const masterCustomers = getTableData<CustomerItem>('MD_Pelanggan', []) || [];
    const masterEmployees = getTableData<EmployeeItem>('MD_Karyawan', []) || [];

    const customerMap = new Map<string, CustomerItem>();
    masterCustomers.forEach(c => {
      if (c && c.Nama_Pelanggan) customerMap.set(c.Nama_Pelanggan.trim().toLowerCase(), c);
      if (c && c.ID_Pelanggan) customerMap.set(c.ID_Pelanggan.trim().toLowerCase(), c);
    });
    const newCustomersToSave: CustomerItem[] = [];

    // Drivers
    const drivers = masterEmployees.filter(e => {
      if (!e) return false;
      const dept = String(e.Departemen || '').toLowerCase();
      const jab = String(e.Jabatan || '').toLowerCase();
      const nama = String(e.Nama_Karyawan || '').toLowerCase();
      return dept === 'distribusi' || jab.includes('driver') || jab.includes('sopir') || nama.includes('wahyudi') || nama.includes('agus');
    });
    const defaultDriver = drivers[0]?.Nama_Karyawan || 'Tri Wahyudi';

    const monthCounts = new Map<string, number>();
    existingDist.forEach(d => {
      if (d && d.Tanggal) {
        const itemD = parseDate(d.Tanggal);
        const ymKey = `${itemD.getFullYear()}-${itemD.getMonth()}`;
        monthCounts.set(ymKey, (monthCounts.get(ymKey) || 0) + 1);
      }
    });

    const newDistList: DistributionItem[] = [];
    const newDetailsList: DistributionProductDetail[] = [];

    // Helper getVal
    const getVal = (r: any, candidates: string[]): any => {
      if (!r || typeof r !== 'object') return undefined;
      for (const cand of candidates) {
        if (r[cand] !== undefined && r[cand] !== null && String(r[cand]).trim() !== '') return r[cand];
      }
      const keys = Object.keys(r);
      for (const cand of candidates) {
        const normCand = cand.toLowerCase().replace(/[\s_\-./]+/g, '');
        const found = keys.find(k => k.toLowerCase().replace(/[\s_\-./]+/g, '') === normCand);
        if (found && r[found] !== undefined && r[found] !== null && String(r[found]).trim() !== '') {
          return r[found];
        }
      }
      for (const cand of candidates) {
        const normCand = cand.toLowerCase().replace(/[\s_\-./]+/g, '');
        if (normCand.length >= 3) {
          const found = keys.find(k => {
            const normKey = k.toLowerCase().replace(/[\s_\-./]+/g, '');
            if (!normKey || normKey === 'no' || normKey === 'nomor' || normKey === 'id') return false;
            return normKey.includes(normCand);
          });
          if (found && r[found] !== undefined && r[found] !== null && String(r[found]).trim() !== '') {
            return r[found];
          }
        }
      }
      return undefined;
    };

    const parseQty = (v: any): number => {
      if (typeof v === 'number') return isNaN(v) ? 0 : Math.max(0, v);
      if (!v && v !== 0) return 0;
      const str = String(v).replace(/[^0-9.,]/g, '').trim();
      if (!str || str === '-') return 0;
      let clean = str;
      if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(/,/g, '.');
      else if (clean.includes(',')) clean = clean.replace(/,/g, '.');
      const n = parseFloat(clean);
      return isNaN(n) ? 0 : Math.max(0, n);
    };

    // Helper ekstraksi Qty produk dari seluruh variasi alias header kolom Excel
    const extractProductQtyFromRow = (r: any, pDef: ProductDefWithAliases): number => {
      if (!r || typeof r !== 'object') return 0;

      // 1. Cek langsung dengan key exact pada objek row
      const exactKeys = [
        pDef.code, pDef.code.toLowerCase(), pDef.id, 
        `Qty_${pDef.code}`, `Jumlah_${pDef.code}`, `Dus_${pDef.code}`,
        `${pDef.code} (Cup 120ml)`, `${pDef.code} (Cup 220ml)`, 
        `${pDef.code} (Botol 330ml)`, `${pDef.code} (Botol 600ml)`, `${pDef.code} (Galon 19L)`
      ];
      for (const k of exactKeys) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return parseQty(r[k]);
        }
      }

      // 2. Scan semua keys di objek row dengan normalisasi nama kolom
      const keys = Object.keys(r);
      const targetNorm = pDef.code.toLowerCase().replace(/[\s_\-./()]+/g, '');
      for (const k of keys) {
        const normKey = k.toLowerCase().replace(/[\s_\-./()]+/g, '');
        
        // Lewati kolom metadata dan finansial agar tidak pernah tertukar
        if (
          normKey.includes('pelanggan') || normKey.includes('pengirim') || 
          normKey.includes('penerima') || normKey.includes('tujuan') || 
          normKey.includes('keterangan') || normKey.includes('suratjalan') || 
          normKey.includes('invoice') || normKey.includes('tagihan') || 
          normKey.includes('total') || normKey === 'no' || normKey === 'nomor' ||
          normKey === 'tanggal' || normKey === 'tgl' || normKey === 'level'
        ) {
          continue;
        }

        // Cocokkan apakah nama kolom memang kolom produk ini
        const isMatched = (normKey === targetNorm) || pDef.aliases.some(alias => {
          const normAlias = alias.toLowerCase().replace(/[\s_\-./()]+/g, '');
          return normKey === normAlias || normKey === `qty${normAlias}` || normKey === `jumlah${normAlias}` || normKey === `dus${normAlias}`;
        });

        if (isMatched && r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          return parseQty(r[k]);
        }
      }

      return 0;
    };

    parsedRows.forEach((row, idx) => {
      const rawSj = getVal(row, ['NO SURAT JALAN', 'No_Surat_Jalan', 'No Surat Jalan', 'Surat Jalan', 'NO S.J.', 'No SJ', 'SJ']);
      const finalSj = (rawSj && String(rawSj).trim() && !String(rawSj).includes('---') && String(rawSj).toLowerCase() !== 'surat jalan') 
        ? String(rawSj).trim() 
        : '-';

      let rawId = '';
      if (finalSj !== '-') {
        const sjNorm = finalSj.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchExisting = existingDist.find(d => {
          const dSj = String(d.No_Surat_Jalan || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return dSj && dSj === sjNorm;
        });
        if (matchExisting && matchExisting.ID_Distribusi) {
          rawId = matchExisting.ID_Distribusi;
        } else {
          rawId = `DST-SJ-${finalSj.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
        }
      } else {
        rawId = `DST-${Date.now().toString().slice(-6)}-${String(idx + 1).padStart(4, '0')}`;
      }

      const rawDate = getVal(row, ['TANGGAL KIRIM', 'Tanggal_Kirim', 'Tanggal Kirim', 'Tanggal', 'Tgl', 'Tgl Kirim', 'TGL KIRIM']);
      const dObj = parseDate(rawDate);
      const tgl = formatDateISO(dObj);
      const ymKey = `${dObj.getFullYear()}-${dObj.getMonth()}`;
      const nextSeq = (monthCounts.get(ymKey) || 0) + 1;
      monthCounts.set(ymKey, nextSeq);
      const seqPadded = String(nextSeq).padStart(3, '0');
      const romanMonth = ROMAN_MONTHS[dObj.getMonth()] || 'X';
      const yy = String(dObj.getFullYear()).slice(-2);

      let custName = String(getVal(row, ['NAMA PELANGGAN', 'Nama_Pelanggan', 'Nama Pelanggan', 'Pelanggan', 'Customer']) || '').trim();
      if (!custName || custName === '-') {
        custName = '-';
      }

      let custId = '-';
      if (custName !== '-') {
        custId = customerMap.get(custName.toLowerCase())?.ID_Pelanggan || `PLG-${custName.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
        if (!customerMap.has(custName.toLowerCase())) {
          const newCust: CustomerItem = {
            ID_Pelanggan: custId,
            Nama_Pelanggan: custName,
            Level_Pelanggan: 'Agen',
            Alamat: '-',
            Status: 'Aktif'
          };
          customerMap.set(custName.toLowerCase(), newCust);
          newCustomersToSave.push(newCust);
        }
      }

      // Kolom opsional: jika kosong di Excel, biarkan '-' (jangan diisi otomatis)
      const rawLevel = getVal(row, ['LEVEL', 'Level', 'Level_Pelanggan', 'Kategori']);
      const level = (rawLevel && String(rawLevel).trim()) ? String(rawLevel).trim() : '-';

      const rawMetode = getVal(row, ['METODE KIRIM', 'Metode_Kirim', 'Metode Kirim', 'Metode']);
      const metode = (rawMetode && String(rawMetode).trim()) ? String(rawMetode).trim() : '-';

      const rawPengirim = getVal(row, ['PENGIRIM', 'Pengirim', 'Driver', 'Sopir']);
      const pengirim = (rawPengirim && String(rawPengirim).trim() && !String(rawPengirim).includes('___')) 
        ? String(rawPengirim).trim() 
        : '-';

      const rawPenerima = getVal(row, ['PENERIMA', 'Penerima', 'Nama Penerima']);
      const penerima = (rawPenerima && String(rawPenerima).trim() && !String(rawPenerima).includes('___')) 
        ? String(rawPenerima).trim() 
        : '-';

      const rawTujuan = getVal(row, ['TUJUAN', 'Tujuan', 'Alamat']);
      const tujuan = (rawTujuan && String(rawTujuan).trim() && !String(rawTujuan).includes('___')) 
        ? String(rawTujuan).trim() 
        : '-';

      const rawInv = getVal(row, ['NO INVOICE', 'No_Invoice', 'No Invoice', 'Invoice', 'NO INV', 'No Inv', 'INV']);
      const finalInvoice = (rawInv && String(rawInv).trim() && !String(rawInv).includes('---')) 
        ? String(rawInv).trim() 
        : '-';

      const rawKet = getVal(row, ['KETERANGAN', 'Keterangan', 'Catatan']);
      const keterangan = (rawKet && String(rawKet).trim()) ? String(rawKet).trim() : '-';

      const rawTagihan = parseQty(getVal(row, ['TOTAL TAGIHAN', 'Total_Tagihan', 'Total Tagihan', 'Tagihan', 'Total']));

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
        Total_Tagihan: rawTagihan > 0 ? rawTagihan : 0
      };

      let hasColumnProducts = false;
      DEFAULT_PRODUCT_DEFS.forEach((pDef, pIdx) => {
        const qty = extractProductQtyFromRow(row, pDef);
        distRecord[pDef.code] = qty;
        distRecord[pDef.id] = qty;
        if (pDef.code === 'G19') {
          distRecord['Galon'] = qty;
          distRecord['galon'] = qty;
          distRecord['GLN19'] = qty;
          distRecord['gln19'] = qty;
          distRecord['GLN'] = qty;
          distRecord['ASH-GLN19L'] = qty;
        }
        if (qty > 0) {
          hasColumnProducts = true;
          newDetailsList.push({
            ID_Detail: `${rawId}-D${pIdx + 1}`,
            ID_Distribusi: rawId,
            Nama_Pelanggan: custName,
            Tanggal: tgl,
            Level_Pelanggan: level,
            ID_Produk: pDef.id,
            Nama_Produk: pDef.name,
            Qty: qty,
            Harga_Satuan: pDef.price,
            Subtotal: qty * pDef.price,
            Satuan: pDef.code === 'G19' ? 'Galon' : 'Dus'
          });
        }
      });

      // Fallback Cerdas 1: Format Single Item per Row jika Excel mencatat 1 baris per produk
      if (!hasColumnProducts) {
        const rawProd = String(getVal(row, ['ID_Produk', 'Nama_Produk', 'Nama Produk', 'Produk', 'Item', 'Barang', 'Kategori']) || '').trim();
        const rawQty = parseQty(getVal(row, ['Qty', 'Jumlah', 'QTY', 'JUMLAH', 'Volume', 'Banyak']));
        if (rawProd && rawQty > 0) {
          const prodLower = rawProd.toLowerCase();
          let matchedDef = DEFAULT_PRODUCT_DEFS.find(p => p.id === rawProd || p.code.toLowerCase() === prodLower);
          if (!matchedDef) {
            if (prodLower.includes('galon') || prodLower.includes('gln') || prodLower.includes('19')) {
              matchedDef = DEFAULT_PRODUCT_DEFS.find(p => p.code === 'G19');
            } else if (prodLower.includes('120')) {
              matchedDef = DEFAULT_PRODUCT_DEFS.find(p => p.code === 'C120');
            } else if (prodLower.includes('220')) {
              matchedDef = DEFAULT_PRODUCT_DEFS.find(p => p.code === 'C220');
            } else if (prodLower.includes('330')) {
              matchedDef = DEFAULT_PRODUCT_DEFS.find(p => p.code === 'B330');
            } else if (prodLower.includes('600')) {
              matchedDef = DEFAULT_PRODUCT_DEFS.find(p => p.code === 'B600');
            }
          }
          const finalDef = matchedDef || DEFAULT_PRODUCT_DEFS[1]; // fallback C220
          const rawPrice = parseQty(getVal(row, ['Harga_Satuan', 'Harga Satuan', 'Harga', 'Price']));
          const price = rawPrice > 0 ? rawPrice : finalDef.price;

          distRecord[finalDef.code] = rawQty;
          distRecord[finalDef.id] = rawQty;
          if (finalDef.code === 'G19') {
            distRecord['Galon'] = rawQty;
            distRecord['galon'] = rawQty;
            distRecord['GLN19'] = rawQty;
            distRecord['gln19'] = rawQty;
            distRecord['GLN'] = rawQty;
            distRecord['ASH-GLN19L'] = rawQty;
          }

          hasColumnProducts = true;
          newDetailsList.push({
            ID_Detail: `${rawId}-D1`,
            ID_Distribusi: rawId,
            ID_Produk: finalDef.id,
            Nama_Produk: finalDef.name,
            Qty: rawQty,
            Harga_Satuan: price,
            Subtotal: rawQty * price,
            Satuan: finalDef.code === 'G19' ? 'Galon' : 'Dus'
          });
        }
      }

      if (distRecord.Total_Tagihan === 0) {
        let sumSub = 0;
        newDetailsList.filter(d => d.ID_Distribusi === rawId).forEach(d => { sumSub += d.Subtotal; });
        distRecord.Total_Tagihan = sumSub;
      }

      newDistList.push(distRecord as DistributionItem);
    });

    if (newDistList.length === 0) {
      return { success: false, totalRows: 0, sampleMonth: '', error: 'Tidak ada baris data transaksi yang berhasil diparsing.' };
    }

    // Merge clean
    const distMap = new Map<string, DistributionItem>();
    existingDist.forEach(d => { if (d && d.ID_Distribusi) distMap.set(d.ID_Distribusi, d); });
    newDistList.forEach(d => distMap.set(d.ID_Distribusi, d));

    const combinedDist = Array.from(distMap.values());
    
    // Hapus detail item lama yang ID_Distribusi-nya sama dengan transaksi yang sedang diimpor
    const newDistIdSet = new Set(newDistList.map(d => d.ID_Distribusi));
    const filteredOldDetails = existingDetails.filter(it => !newDistIdSet.has(it.ID_Distribusi));
    const combinedDetails = [...filteredOldDetails, ...newDetailsList];

    // Simpan penanda bulan
    const sampleMonth = String(newDistList[newDistList.length - 1].Tanggal || newDistList[0].Tanggal).slice(0, 7);
    try {
      localStorage.setItem('airis_last_imported_dist_month', sampleMonth);
    } catch {
      // ignore
    }

    // Simpan ke storage lokal seketika (Anti-Hang, Instan < 50ms)
    setTableData('Distribusi', combinedDist);
    setTableData('Distribusi_Item', combinedDetails);
    if (newCustomersToSave.length > 0) {
      setTableData('MD_Pelanggan', [...masterCustomers, ...newCustomersToSave]);
    }

    // Auto-sinkronisasi seluruh modul ke Keuangan (jurnal & piutang otomatis)
    try {
      syncAllModulesToFinance();
    } catch (syncErr) {
      console.warn('Finance sync warning inside importDistributionExcelFile:', syncErr);
    }

    // Background push ke Supabase Cloud secara asinkron tanpa memblokir UI pengguna
    setTimeout(async () => {
      try {
        const cfg = getSupabaseConfig();
        if (cfg.isConnected && cfg.url && cfg.anonKey) {
          // 1. Master Produk
          await syncTableToSupabaseExplicit('MD_Produk');
          // 2. Master Pelanggan (termasuk pelanggan baru)
          const allCust = newCustomersToSave.length > 0 ? [...masterCustomers, ...newCustomersToSave] : masterCustomers;
          await syncTableToSupabaseExplicit('MD_Pelanggan', allCust);
          // 3. Distribusi Header
          await syncTableToSupabaseExplicit('Distribusi', combinedDist);
          // 4. Distribusi Detail Item
          await syncTableToSupabaseExplicit('Distribusi_Item', combinedDetails);
        }
      } catch (cloudErr) {
        console.warn('Background Supabase sync in importDistributionExcelFile:', cloudErr);
      }
    }, 100);

    return {
      success: true,
      totalRows: newDistList.length,
      sampleMonth
    };
  } catch (err: any) {
    console.error('Error in importDistributionExcelFile:', err);
    return {
      success: false,
      totalRows: 0,
      sampleMonth: '',
      error: err?.message || 'Terjadi kesalahan sistem saat memproses file Excel.'
    };
  }
}
