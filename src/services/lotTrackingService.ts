/**
 * Lot Tracking & Kode Produksi FIFO Service
 * PT. Anugerah Illahi Rabbi (AIRIS Enterprise)
 * 
 * Aturan Kode Produksi:
 * Format: "P" + DDMMYY (contoh: 20 Januari 2026 -> "P200126")
 * Alokasi:
 * - Menggunakan metode FIFO (First-In First-Out) dari batch hasil produksi (tabel 'Produksi').
 * - Jika suatu pengiriman mengambil barang dari 2 batch berbeda, kode produksi yang dipilih 
 *   adalah batch dengan porsi pengambilan terbesar (majority rule).
 * - Kode produksi dapat diisi otomatis dan dapat diedit manual oleh pengguna.
 */

import { getTableData } from './dbAdapter';
import { ProductionItem, DistributionItem, DistributionProductDetail } from '../types';

/**
 * Format string tanggal (YYYY-MM-DD atau ISO atau DD/MM/YYYY) menjadi format "PDDMMYY"
 */
export function formatProductionCode(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (!clean) return '';

  let day = '';
  let month = '';
  let year = '';

  if (clean.includes('-')) {
    const parts = clean.split('T')[0].split('-');
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        // Format YYYY-MM-DD
        year = parts[0].slice(-2);
        month = parts[1].padStart(2, '0');
        day = parts[2].padStart(2, '0');
      } else {
        // Format DD-MM-YYYY
        day = parts[0].padStart(2, '0');
        month = parts[1].padStart(2, '0');
        year = parts[2].slice(-2);
      }
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        day = parts[0].padStart(2, '0');
        month = parts[1].padStart(2, '0');
        year = parts[2].slice(-2);
      } else if (parts[0].length === 4) {
        year = parts[0].slice(-2);
        month = parts[1].padStart(2, '0');
        day = parts[2].padStart(2, '0');
      }
    }
  }

  if (!day || !month || !year) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      day = String(d.getDate()).padStart(2, '0');
      month = String(d.getMonth() + 1).padStart(2, '0');
      year = String(d.getFullYear()).slice(-2);
    }
  }

  if (day && month && year) {
    return `P${day}${month}${year}`;
  }

  return '';
}

export interface CalculateLotParams {
  productId: string;
  productName?: string;
  qty: number;
  deliveryDate?: string;
  currentDistId?: string;
  productions?: ProductionItem[];
  distributions?: DistributionItem[];
  distItems?: DistributionProductDetail[];
}

/**
 * Menghitung Kode Produksi otomatis berdasarkan FIFO dari batch Produksi harian.
 * Jika mencakup beberapa batch, menggunakan batch dengan jumlah karton terbanyak (majority).
 */
export function getAutoProductionCode(params: CalculateLotParams): string {
  const {
    productId,
    productName,
    qty,
    deliveryDate = new Date().toISOString().slice(0, 10),
    currentDistId,
  } = params;

  if (!productId && !productName) {
    return formatProductionCode(deliveryDate);
  }

  const allProductions = params.productions || getTableData<ProductionItem>('Produksi', []);
  const allDistributions = params.distributions || getTableData<DistributionItem>('Distribusi', []);
  const allDistItems = params.distItems || getTableData<DistributionProductDetail>('Distribusi_Item', []);

  // 1. Ambil seluruh riwayat produksi untuk produk ini, urutkan ASC berdasarkan tanggal & ID
  const prodBatches = allProductions
    .filter(p => {
      if (productId && p.ID_Produk === productId) return true;
      if (productName && p.ID_Produk && p.ID_Produk.toLowerCase() === productName.toLowerCase()) return true;
      return false;
    })
    .sort((a, b) => {
      const cmp = (a.Tanggal || '').localeCompare(b.Tanggal || '');
      if (cmp !== 0) return cmp;
      return (a.ID_Produksi || '').localeCompare(b.ID_Produksi || '');
    })
    .map(p => ({
      id: p.ID_Produksi,
      date: p.Tanggal,
      code: formatProductionCode(p.Tanggal),
      initial: Number(p.Jumlah) || 0,
      remaining: Number(p.Jumlah) || 0,
    }));

  // Jika tidak ada data produksi tercatat untuk produk ini, fallback ke format tanggal kirim
  if (prodBatches.length === 0) {
    return formatProductionCode(deliveryDate);
  }

  // 2. Ambil pengiriman sebelumnya (sebelum atau sama dengan tanggal pengiriman saat ini, selain pengiriman saat ini)
  const distMap = new Map<string, DistributionItem>();
  allDistributions.forEach(d => {
    if (d.ID_Distribusi) distMap.set(d.ID_Distribusi, d);
  });

  const priorDistItems = allDistItems
    .filter(it => {
      if (!it || !it.ID_Distribusi) return false;
      if (currentDistId && it.ID_Distribusi === currentDistId) return false;
      const dist = distMap.get(it.ID_Distribusi);
      if (!dist) return false;
      
      const isSameProduct = (productId && it.ID_Produk === productId) || 
                            (productName && it.Nama_Produk?.toLowerCase() === productName.toLowerCase());
      if (!isSameProduct) return false;

      // Hanya konsumsi pengiriman sebelum atau pada tanggal yang sama
      return (dist.Tanggal || '') <= deliveryDate;
    })
    .sort((a, b) => {
      const distA = distMap.get(a.ID_Distribusi);
      const distB = distMap.get(b.ID_Distribusi);
      const cmpDate = (distA?.Tanggal || '').localeCompare(distB?.Tanggal || '');
      if (cmpDate !== 0) return cmpDate;
      return (a.ID_Distribusi || '').localeCompare(b.ID_Distribusi || '');
    });

  // 3. Simulasikan konsumsi FIFO oleh pengiriman-pengiriman terdahulu
  for (const item of priorDistItems) {
    let itemQty = Number(item.Qty) || 0;
    for (const batch of prodBatches) {
      if (itemQty <= 0) break;
      if (batch.remaining <= 0) continue;
      const take = Math.min(itemQty, batch.remaining);
      batch.remaining -= take;
      itemQty -= take;
    }
  }

  // 4. Alokasikan untuk pengiriman saat ini
  let neededQty = Number(qty) || 0;
  if (neededQty <= 0) {
    // Jika qty belum diisi, kembalikan batch pertama yang masih tersedia
    const avail = prodBatches.find(b => b.remaining > 0);
    return avail?.code || prodBatches[prodBatches.length - 1]?.code || formatProductionCode(deliveryDate);
  }

  const batchAllocations: { code: string; date: string; taken: number }[] = [];
  for (const batch of prodBatches) {
    if (neededQty <= 0) break;
    if (batch.remaining <= 0) continue;

    const take = Math.min(neededQty, batch.remaining);
    batchAllocations.push({
      code: batch.code,
      date: batch.date,
      taken: take,
    });
    batch.remaining -= take;
    neededQty -= take;
  }

  // Jika semua batch sudah habis terpakai atau tidak cukup, 
  // jika ada alokasi parsial, kita tetap hitung dari alokasi yang ada
  if (batchAllocations.length === 0) {
    // Ambil batch produksi terakhir sebagai representasi batch terbaru
    const latestBatch = prodBatches[prodBatches.length - 1];
    return latestBatch ? latestBatch.code : formatProductionCode(deliveryDate);
  }

  // 5. Aturan Majority: Pilih batch dengan 'taken' terbesar.
  // Jika seimbang, pilih batch yang lebih awal (FIFO).
  batchAllocations.sort((a, b) => {
    if (b.taken !== a.taken) {
      return b.taken - a.taken; // Porsi terbesar menang
    }
    return a.date.localeCompare(b.date); // Lebih awal menang jika seri
  });

  return batchAllocations[0].code || formatProductionCode(deliveryDate);
}
