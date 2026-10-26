import { ProductItem, RawMaterialItem, PriceHistoryItem } from '../types';
import { getTableData, setTableData, notifyDbChange } from './dbAdapter';

/**
 * Service to manage price changes and historical price logs for
 * Raw Materials (Bahan Penolong) and Finished Products (Produk Jadi).
 */

const getTodayISO = (): string => new Date().toISOString().slice(0, 10);

export function getAllPriceHistories(): PriceHistoryItem[] {
  return getTableData<PriceHistoryItem>('Histori_Perubahan_Harga', []);
}

/**
 * Mencari harga acuan terakhir yang berlaku SEBELUM tanggal target (tanggal sebelumnya).
 * Jika ada perubahan harga pada tanggal < targetDate, harga baru dari tanggal tersebut
 * akan menjadi harga lama (acuan) untuk targetDate.
 */
export function getPrecedingReferencePrice(
  idItem: string,
  targetDate: string,
  itemType: 'Bahan Penolong' | 'Produk'
): {
  tanggalAcuan?: string;
  hargaLamaBahan: number;
  hargaLamaDistributor: number;
  hargaLamaAgen: number;
  hargaLamaReseller: number;
  hargaLamaKonsumen: number;
} {
  const histories = getAllPriceHistories().filter(
    h => h.ID_Item === idItem && h.Tipe_Item === itemType && h.Tanggal_Berlaku < targetDate
  );

  // Urutkan dari tanggal paling dekat sebelum targetDate (DESC)
  histories.sort((a, b) => {
    const d = b.Tanggal_Berlaku.localeCompare(a.Tanggal_Berlaku);
    if (d !== 0) return d;
    return (b.Tanggal_Diubah || '').localeCompare(a.Tanggal_Diubah || '');
  });

  if (histories.length > 0) {
    const prev = histories[0];
    return {
      tanggalAcuan: prev.Tanggal_Berlaku,
      hargaLamaBahan: Number(prev.Harga_Baru) || 0,
      hargaLamaDistributor: Number(prev.Harga_Baru_Distributor ?? prev.Harga_Distributor_Baru ?? prev.Harga_Baru) || 0,
      hargaLamaAgen: Number(prev.Harga_Baru_Agen ?? prev.Harga_Agen_Baru) || 0,
      hargaLamaReseller: Number(prev.Harga_Baru_Reseller ?? prev.Harga_Reseller_Baru) || 0,
      hargaLamaKonsumen: Number(prev.Harga_Baru_Konsumen ?? prev.Harga_Konsumen_Baru) || 0,
    };
  }

  // Jika belum ada histori sebelum targetDate, periksa apakah ada histori >= targetDate yang menyimpan Harga_Lama awal
  const futureHistories = getAllPriceHistories().filter(
    h => h.ID_Item === idItem && h.Tipe_Item === itemType && h.Tanggal_Berlaku >= targetDate
  );
  futureHistories.sort((a, b) => a.Tanggal_Berlaku.localeCompare(b.Tanggal_Berlaku));
  if (futureHistories.length > 0) {
    const earliest = futureHistories[0];
    const oldDist = Number(earliest.Harga_Lama_Distributor ?? earliest.Harga_Distributor_Lama ?? earliest.Harga_Lama) || 0;
    const oldBhn = Number(earliest.Harga_Lama) || 0;
    if (oldDist > 0 || oldBhn > 0) {
      return {
        tanggalAcuan: undefined,
        hargaLamaBahan: oldBhn,
        hargaLamaDistributor: oldDist,
        hargaLamaAgen: Number(earliest.Harga_Lama_Agen ?? earliest.Harga_Agen_Lama) || 0,
        hargaLamaReseller: Number(earliest.Harga_Lama_Reseller ?? earliest.Harga_Reseller_Lama) || 0,
        hargaLamaKonsumen: Number(earliest.Harga_Lama_Konsumen ?? earliest.Harga_Konsumen_Lama) || 0,
      };
    }
  }

  // Fallback ke master data saat ini
  if (itemType === 'Bahan Penolong') {
    const rawMaterials = getTableData<RawMaterialItem>('MD_BahanPenolong', []);
    const mat = rawMaterials.find(m => m.ID_Bahan === idItem);
    return {
      tanggalAcuan: undefined,
      hargaLamaBahan: Number(mat?.Harga_Satuan) || 0,
      hargaLamaDistributor: 0,
      hargaLamaAgen: 0,
      hargaLamaReseller: 0,
      hargaKonsumen: 0,
    };
  } else {
    const products = getTableData<ProductItem>('MD_Produk', []);
    const prod = products.find(p => p.ID_Produk === idItem);
    return {
      tanggalAcuan: undefined,
      hargaLamaBahan: 0,
      hargaLamaDistributor: Number(prod?.Harga_Distributor) || 0,
      hargaLamaAgen: Number(prod?.Harga_Agen) || 0,
      hargaLamaReseller: Number(prod?.Harga_Reseller) || 0,
      hargaLamaKonsumen: Number(prod?.Harga_Konsumen) || 0,
    };
  }
}

/**
 * Menghitung ulang seluruh rantai acuan histori harga berdasarkan urutan tanggal (chronological chain).
 * Memastikan bahwa setiap perubahan harga mengacu pada harga dari tanggal sebelumnya secara konsisten.
 */
export function recalculateChainedPriceHistories(idItem?: string): void {
  try {
    const allHistories = getAllPriceHistories();
    if (allHistories.length === 0) return;

    // Kumpulkan ID item yang perlu dihitung ulang
    const itemsToProcess = idItem 
      ? [idItem]
      : Array.from(new Set(allHistories.map(h => h.ID_Item)));

    const products = getTableData<ProductItem>('MD_Produk', []);
    const materials = getTableData<RawMaterialItem>('MD_BahanPenolong', []);

    const beforeJson = JSON.stringify(allHistories);

    itemsToProcess.forEach(itemId => {
      // Ambil histori untuk item ini
      const itemHistories = allHistories.filter(h => h.ID_Item === itemId);
      if (itemHistories.length === 0) return;

      // Urutkan secara kronologis (tanggal terlama ke terbaru)
      itemHistories.sort((a, b) => {
        const d = a.Tanggal_Berlaku.localeCompare(b.Tanggal_Berlaku);
        if (d !== 0) return d;
        return (a.Tanggal_Diubah || '').localeCompare(b.Tanggal_Diubah || '');
      });

      const isBahan = itemHistories[0].Tipe_Item === 'Bahan Penolong';

      // Tentukan baseline harga awal (sebelum histori pertama)
      const mat = materials.find(m => m.ID_Bahan === itemId);
      const prod = products.find(p => p.ID_Produk === itemId);

      for (let i = 0; i < itemHistories.length; i++) {
        const curr = itemHistories[i];

        if (i === 0) {
          // Entri pertama: acuan dari baseline awal atau Harga_Lama yang sudah ada
          if (isBahan) {
            let basePrice = Number(curr.Harga_Lama) || 0;
            if (basePrice <= 0) {
              basePrice = Number(mat?.Harga_Satuan) || Number(curr.Harga_Baru) || 0;
            }
            curr.Harga_Lama = basePrice;
            curr.Selisih = Number(curr.Harga_Baru || 0) - basePrice;
            curr.Persentase_Perubahan = basePrice > 0 ? Number(((curr.Selisih / basePrice) * 100).toFixed(2)) : 0;
          } else {
            let baseDist = Number(curr.Harga_Lama_Distributor ?? curr.Harga_Distributor_Lama ?? curr.Harga_Lama) || 0;
            let baseAgen = Number(curr.Harga_Lama_Agen ?? curr.Harga_Agen_Lama) || 0;
            let baseRes = Number(curr.Harga_Lama_Reseller ?? curr.Harga_Reseller_Lama) || 0;
            let baseKons = Number(curr.Harga_Lama_Konsumen ?? curr.Harga_Konsumen_Lama) || 0;

            if (baseDist <= 0) {
              baseDist = Number(prod?.Harga_Distributor) || Number(curr.Harga_Baru_Distributor ?? curr.Harga_Baru) || 0;
            }
            if (baseAgen <= 0) {
              baseAgen = Number(prod?.Harga_Agen) || Number(curr.Harga_Baru_Agen) || 0;
            }
            if (baseRes <= 0) {
              baseRes = Number(prod?.Harga_Reseller) || Number(curr.Harga_Baru_Reseller) || 0;
            }
            if (baseKons <= 0) {
              baseKons = Number(prod?.Harga_Konsumen) || Number(curr.Harga_Baru_Konsumen) || 0;
            }

            curr.Harga_Lama = baseDist;
            curr.Harga_Lama_Distributor = baseDist;
            curr.Harga_Distributor_Lama = baseDist;
            curr.Harga_Lama_Agen = baseAgen;
            curr.Harga_Agen_Lama = baseAgen;
            curr.Harga_Lama_Reseller = baseRes;
            curr.Harga_Reseller_Lama = baseRes;
            curr.Harga_Lama_Konsumen = baseKons;
            curr.Harga_Konsumen_Lama = baseKons;

            const newDist = Number(curr.Harga_Baru_Distributor ?? curr.Harga_Distributor_Baru ?? curr.Harga_Baru) || 0;
            curr.Harga_Baru = newDist;
            curr.Harga_Baru_Distributor = newDist;
            curr.Harga_Distributor_Baru = newDist;
            curr.Selisih = newDist - baseDist;
            curr.Persentase_Perubahan = baseDist > 0 ? Number(((curr.Selisih / baseDist) * 100).toFixed(2)) : 0;
          }
        } else {
          // Entri berikutnya: ACUAN DIAMBIL DARI TANGGAL SEBELUMNYA (itemHistories[i - 1])!
          const prev = itemHistories[i - 1];
          curr.Tanggal_Acuan_Sebelumnya = prev.Tanggal_Berlaku;

          if (isBahan) {
            const refPrice = Number(prev.Harga_Baru) || 0;
            curr.Harga_Lama = refPrice;
            const newPrice = Number(curr.Harga_Baru) || 0;
            curr.Selisih = newPrice - refPrice;
            curr.Persentase_Perubahan = refPrice > 0 ? Number(((curr.Selisih / refPrice) * 100).toFixed(2)) : 0;
          } else {
            const refDist = Number(prev.Harga_Baru_Distributor ?? prev.Harga_Distributor_Baru ?? prev.Harga_Baru) || 0;
            const refAgen = Number(prev.Harga_Baru_Agen ?? prev.Harga_Agen_Baru) || 0;
            const refRes = Number(prev.Harga_Baru_Reseller ?? prev.Harga_Reseller_Baru) || 0;
            const refKons = Number(prev.Harga_Baru_Konsumen ?? prev.Harga_Konsumen_Baru) || 0;

            curr.Harga_Lama = refDist;
            curr.Harga_Lama_Distributor = refDist;
            curr.Harga_Distributor_Lama = refDist;
            curr.Harga_Lama_Agen = refAgen;
            curr.Harga_Agen_Lama = refAgen;
            curr.Harga_Lama_Reseller = refRes;
            curr.Harga_Reseller_Lama = refRes;
            curr.Harga_Lama_Konsumen = refKons;
            curr.Harga_Konsumen_Lama = refKons;

            const newDist = Number(curr.Harga_Baru_Distributor ?? curr.Harga_Distributor_Baru ?? curr.Harga_Baru) || 0;
            curr.Harga_Baru = newDist;
            curr.Harga_Baru_Distributor = newDist;
            curr.Harga_Distributor_Baru = newDist;

            curr.Selisih = newDist - refDist;
            curr.Persentase_Perubahan = refDist > 0 ? Number(((curr.Selisih / refDist) * 100).toFixed(2)) : 0;
          }
        }

        // Pastikan alias nama properti juga diisi lengkap
        if (!isBahan) {
          curr.Harga_Baru_Agen = Number(curr.Harga_Baru_Agen ?? curr.Harga_Agen_Baru) || 0;
          curr.Harga_Agen_Baru = curr.Harga_Baru_Agen;
          curr.Harga_Baru_Reseller = Number(curr.Harga_Baru_Reseller ?? curr.Harga_Reseller_Baru) || 0;
          curr.Harga_Reseller_Baru = curr.Harga_Baru_Reseller;
          curr.Harga_Baru_Konsumen = Number(curr.Harga_Baru_Konsumen ?? curr.Harga_Konsumen_Baru) || 0;
          curr.Harga_Konsumen_Baru = curr.Harga_Baru_Konsumen;
        }
      }
    });

    const afterJson = JSON.stringify(allHistories);
    if (beforeJson !== afterJson) {
      setTableData('Histori_Perubahan_Harga', allHistories);
    }
  } catch (err) {
    console.warn('Gagal menghitung ulang rantai acuan histori:', err);
  }
}

/**
 * Catat perubahan harga bahan penolong berdasarkan tanggal berlaku.
 * Acuan harga lama diambil dari tanggal sebelumnya.
 * Jika tanggal berlaku <= hari ini, harga aktif di Master Bahan langsung diperbarui.
 */
export function recordRawMaterialPriceChange(params: {
  idBahan: string;
  hargaBaru: number;
  tanggalBerlaku: string;
  keterangan?: string;
  diubahOleh?: string;
}): { success: boolean; message: string; historyItem?: PriceHistoryItem } {
  try {
    const rawMaterials = getTableData<RawMaterialItem>('MD_BahanPenolong', []);
    const material = rawMaterials.find(m => m.ID_Bahan === params.idBahan);

    if (!material) {
      return { success: false, message: `Bahan penolong dengan ID "${params.idBahan}" tidak ditemukan.` };
    }

    const today = getTodayISO();
    const effectiveDate = params.tanggalBerlaku || today;
    const isEffectiveNow = effectiveDate <= today;

    // Ambil acuan harga dari tanggal sebelumnya
    const ref = getPrecedingReferencePrice(params.idBahan, effectiveDate, 'Bahan Penolong');
    const hargaLama = ref.hargaLamaBahan;
    const hargaBaru = Math.max(0, Number(params.hargaBaru) || 0);
    const selisih = hargaBaru - hargaLama;
    const persentase = hargaLama > 0 ? Number(((selisih / hargaLama) * 100).toFixed(2)) : 0;

    const historyItem: PriceHistoryItem = {
      ID_Histori: `HPRC-BHN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
      Tipe_Item: 'Bahan Penolong',
      ID_Item: material.ID_Bahan,
      Nama_Item: material.Nama_Bahan,
      Kategori: material.Kategori,
      Satuan: material.Satuan,
      Tanggal_Berlaku: effectiveDate,
      Tanggal_Diubah: new Date().toISOString(),
      Tanggal_Acuan_Sebelumnya: ref.tanggalAcuan,
      Diubah_Oleh: params.diubahOleh || 'Admin',
      Keterangan: params.keterangan || (isEffectiveNow ? 'Penyesuaian harga satuan bahan penolong' : 'Jadwal penyesuaian harga mendatang'),
      Status_Penerapan: isEffectiveNow ? 'Aktif' : 'Terjadwal',
      Harga_Lama: hargaLama,
      Harga_Baru: hargaBaru,
      Selisih: selisih,
      Persentase_Perubahan: persentase
    };

    // 1. Simpan ke Histori_Perubahan_Harga
    const histories = getAllPriceHistories();
    setTableData('Histori_Perubahan_Harga', [historyItem, ...histories]);

    // 2. Hitung ulang rantai urutan tanggal agar konsisten jika disisipkan di tanggal lampau/mendatang
    recalculateChainedPriceHistories(params.idBahan);

    // 3. Jika berlaku sekarang / lampau, update harga aktif bahan penolong
    if (isEffectiveNow) {
      const updatedMaterials = rawMaterials.map(m => 
        m.ID_Bahan === params.idBahan
          ? { ...m, Harga_Satuan: hargaBaru, Tgl_Update_Harga: effectiveDate }
          : m
      );
      setTableData('MD_BahanPenolong', updatedMaterials);
      setTableData('MD_Bahan', updatedMaterials);
    }

    notifyDbChange();

    return {
      success: true,
      message: isEffectiveNow
        ? `Harga ${material.Nama_Bahan} berhasil diperbarui menjadi Rp ${hargaBaru.toLocaleString('id-ID')} (Berlaku sejak ${effectiveDate}).`
        : `Jadwal perubahan harga ${material.Nama_Bahan} ke Rp ${hargaBaru.toLocaleString('id-ID')} berhasil dicatat (Mulai berlaku ${effectiveDate}).`,
      historyItem
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menyimpan perubahan harga bahan.' };
  }
}

/**
 * Catat perubahan harga produk jadi (multi-tier: Distributor, Agen, Reseller, Konsumen).
 * Acuan harga lama diambil dari tanggal sebelumnya.
 * Jika tanggal berlaku <= hari ini, harga aktif di Master Produk langsung diperbarui.
 */
export function recordProductPriceChange(params: {
  idProduk: string;
  hargaDistributor: number;
  hargaAgen: number;
  hargaReseller: number;
  hargaKonsumen: number;
  tanggalBerlaku: string;
  keterangan?: string;
  diubahOleh?: string;
}): { success: boolean; message: string; historyItem?: PriceHistoryItem } {
  try {
    const products = getTableData<ProductItem>('MD_Produk', []);
    const product = products.find(p => p.ID_Produk === params.idProduk);

    if (!product) {
      return { success: false, message: `Produk dengan ID "${params.idProduk}" tidak ditemukan.` };
    }

    const today = getTodayISO();
    const effectiveDate = params.tanggalBerlaku || today;
    const isEffectiveNow = effectiveDate <= today;

    // Ambil acuan harga dari tanggal sebelumnya
    const ref = getPrecedingReferencePrice(params.idProduk, effectiveDate, 'Produk');
    const oldDist = ref.hargaLamaDistributor;
    const oldAgen = ref.hargaLamaAgen;
    const oldReseller = ref.hargaLamaReseller;
    const oldKonsumen = ref.hargaLamaKonsumen;

    const newDist = Math.max(0, Number(params.hargaDistributor) || 0);
    const newAgen = Math.max(0, Number(params.hargaAgen) || 0);
    const newReseller = Math.max(0, Number(params.hargaReseller) || 0);
    const newKonsumen = Math.max(0, Number(params.hargaKonsumen) || 0);

    const selisihDist = newDist - oldDist;
    const persentaseDist = oldDist > 0 ? Number(((selisihDist / oldDist) * 100).toFixed(2)) : 0;

    const historyItem: PriceHistoryItem = {
      ID_Histori: `HPRC-PRD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
      Tipe_Item: 'Produk',
      ID_Item: product.ID_Produk,
      Nama_Item: product.Nama_Produk,
      Kategori: product.Kategori,
      Satuan: product.Satuan,
      Tanggal_Berlaku: effectiveDate,
      Tanggal_Diubah: new Date().toISOString(),
      Tanggal_Acuan_Sebelumnya: ref.tanggalAcuan,
      Diubah_Oleh: params.diubahOleh || 'Admin',
      Keterangan: params.keterangan || (isEffectiveNow ? 'Penyesuaian tier harga jual produk' : 'Jadwal penyesuaian harga jual mendatang'),
      Status_Penerapan: isEffectiveNow ? 'Aktif' : 'Terjadwal',
      
      Harga_Lama: oldDist,
      Harga_Baru: newDist,
      Selisih: selisihDist,
      Persentase_Perubahan: persentaseDist,

      Harga_Lama_Distributor: oldDist,
      Harga_Baru_Distributor: newDist,
      Harga_Distributor_Lama: oldDist,
      Harga_Distributor_Baru: newDist,

      Harga_Lama_Agen: oldAgen,
      Harga_Baru_Agen: newAgen,
      Harga_Agen_Lama: oldAgen,
      Harga_Agen_Baru: newAgen,

      Harga_Lama_Reseller: oldReseller,
      Harga_Baru_Reseller: newReseller,
      Harga_Reseller_Lama: oldReseller,
      Harga_Reseller_Baru: newReseller,

      Harga_Lama_Konsumen: oldKonsumen,
      Harga_Baru_Konsumen: newKonsumen,
      Harga_Konsumen_Lama: oldKonsumen,
      Harga_Konsumen_Baru: newKonsumen
    };

    // 1. Simpan ke Histori_Perubahan_Harga
    const histories = getAllPriceHistories();
    setTableData('Histori_Perubahan_Harga', [historyItem, ...histories]);

    // 2. Hitung ulang rantai urutan tanggal agar acuan konsisten
    recalculateChainedPriceHistories(params.idProduk);

    // 3. Jika berlaku sekarang / lampau, update harga aktif produk
    if (isEffectiveNow) {
      const updatedProducts = products.map(p => 
        p.ID_Produk === params.idProduk
          ? {
              ...p,
              Harga_Distributor: newDist,
              Harga_Agen: newAgen,
              Harga_Reseller: newReseller,
              Harga_Konsumen: newKonsumen,
              Tgl_Update_Harga: effectiveDate
            }
          : p
      );
      setTableData('MD_Produk', updatedProducts);
    }

    notifyDbChange();

    return {
      success: true,
      message: isEffectiveNow
        ? `Harga ${product.Nama_Produk} berhasil diperbarui (Berlaku sejak ${effectiveDate}).`
        : `Jadwal perubahan harga ${product.Nama_Produk} berhasil dicatat (Mulai berlaku ${effectiveDate}).`,
      historyItem
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menyimpan perubahan harga produk.' };
  }
}

/**
 * Otomatis periksa dan terapkan jadwal perubahan harga yang sudah jatuh tempo (Tanggal_Berlaku <= hari ini).
 * Dapat dipanggil secara berkala atau saat inisialisasi aplikasi.
 */
export function checkAndApplyScheduledPriceChanges(): { appliedCount: number } {
  try {
    const today = getTodayISO();
    const histories = getAllPriceHistories();
    const scheduled = histories.filter(h => h.Status_Penerapan === 'Terjadwal' && h.Tanggal_Berlaku <= today);

    if (scheduled.length === 0) return { appliedCount: 0 };

    let appliedCount = 0;
    const rawMaterials = getTableData<RawMaterialItem>('MD_BahanPenolong', []);
    const products = getTableData<ProductItem>('MD_Produk', []);

    let materialsModified = false;
    let productsModified = false;

    // Urutkan jadwal yang jatuh tempo berdasarkan Tanggal_Berlaku ASC agar perubahan beruntun diterapkan berurutan
    const sortedScheduled = [...scheduled].sort((a, b) => a.Tanggal_Berlaku.localeCompare(b.Tanggal_Berlaku));

    sortedScheduled.forEach(sch => {
      if (sch.Tipe_Item === 'Bahan Penolong') {
        const matIdx = rawMaterials.findIndex(m => m.ID_Bahan === sch.ID_Item);
        if (matIdx !== -1 && sch.Harga_Baru !== undefined) {
          rawMaterials[matIdx].Harga_Satuan = sch.Harga_Baru;
          rawMaterials[matIdx].Tgl_Update_Harga = sch.Tanggal_Berlaku;
          materialsModified = true;
          sch.Status_Penerapan = 'Aktif';
          appliedCount++;
        }
      } else if (sch.Tipe_Item === 'Produk') {
        const prdIdx = products.findIndex(p => p.ID_Produk === sch.ID_Item);
        if (prdIdx !== -1) {
          if (sch.Harga_Baru_Distributor !== undefined) products[prdIdx].Harga_Distributor = sch.Harga_Baru_Distributor;
          if (sch.Harga_Baru_Agen !== undefined) products[prdIdx].Harga_Agen = sch.Harga_Baru_Agen;
          if (sch.Harga_Baru_Reseller !== undefined) products[prdIdx].Harga_Reseller = sch.Harga_Baru_Reseller;
          if (sch.Harga_Baru_Konsumen !== undefined) products[prdIdx].Harga_Konsumen = sch.Harga_Baru_Konsumen;
          products[prdIdx].Tgl_Update_Harga = sch.Tanggal_Berlaku;
          productsModified = true;
          sch.Status_Penerapan = 'Aktif';
          appliedCount++;
        }
      }
    });

    if (materialsModified) {
      setTableData('MD_BahanPenolong', rawMaterials);
      setTableData('MD_Bahan', rawMaterials);
    }
    if (productsModified) {
      setTableData('MD_Produk', products);
    }

    if (appliedCount > 0) {
      setTableData('Histori_Perubahan_Harga', histories);
      notifyDbChange();
    }

    return { appliedCount };
  } catch (err) {
    console.warn('Gagal memproses jadwal perubahan harga otomatis:', err);
    return { appliedCount: 0 };
  }
}

/**
 * Ambil harga historis suatu item pada tanggal transaksi tertentu.
 * Berguna saat menghitung HPP produksi atau pembelian bahan di tanggal lampau.
 */
export function getPriceAtDate(
  idItem: string,
  tanggalTransaksi: string,
  itemType: 'Bahan Penolong' | 'Produk',
  tier: 'Distributor' | 'Agen' | 'Reseller' | 'Konsumen' = 'Distributor'
): number {
  try {
    const tgl = tanggalTransaksi ? tanggalTransaksi.slice(0, 10) : getTodayISO();
    const histories = getAllPriceHistories().filter(
      h => h.ID_Item === idItem && h.Tipe_Item === itemType && h.Tanggal_Berlaku <= tgl
    );

    // Ambil histori paling mutakhir yang berlaku sebelum/pada tanggal transaksi
    if (histories.length > 0) {
      histories.sort((a, b) => b.Tanggal_Berlaku.localeCompare(a.Tanggal_Berlaku));
      const latestHist = histories[0];

      if (itemType === 'Bahan Penolong') {
        return latestHist.Harga_Baru ?? 0;
      } else {
        if (tier === 'Agen') return latestHist.Harga_Baru_Agen ?? latestHist.Harga_Baru ?? 0;
        if (tier === 'Reseller') return latestHist.Harga_Baru_Reseller ?? latestHist.Harga_Baru ?? 0;
        if (tier === 'Konsumen') return latestHist.Harga_Baru_Konsumen ?? latestHist.Harga_Baru ?? 0;
        return latestHist.Harga_Baru_Distributor ?? latestHist.Harga_Baru ?? 0;
      }
    }

    // Jika tidak ada catatan histori sebelum tanggal itu, gunakan harga master saat ini
    if (itemType === 'Bahan Penolong') {
      const mats = getTableData<RawMaterialItem>('MD_BahanPenolong', []);
      const m = mats.find(mat => mat.ID_Bahan === idItem);
      return m?.Harga_Satuan || 0;
    } else {
      const prods = getTableData<ProductItem>('MD_Produk', []);
      const p = prods.find(prd => prd.ID_Produk === idItem);
      if (!p) return 0;
      if (tier === 'Agen') return p.Harga_Agen || p.Harga_Distributor || 0;
      if (tier === 'Reseller') return p.Harga_Reseller || p.Harga_Distributor || 0;
      if (tier === 'Konsumen') return p.Harga_Konsumen || p.Harga_Distributor || 0;
      return p.Harga_Distributor || 0;
    }
  } catch {
    return 0;
  }
}

/**
 * Hapus catatan histori perubahan harga tertentu
 */
export function deletePriceHistory(idHistori: string): boolean {
  try {
    const histories = getAllPriceHistories();
    const filtered = histories.filter(h => h.ID_Histori !== idHistori);
    setTableData('Histori_Perubahan_Harga', filtered);
    notifyDbChange();
    return true;
  } catch {
    return false;
  }
}
