/**
 * AIRIS Enterprise - Smart Real-Time Notification & Alert Engine
 * PT. Anugerah Illahi Rabbi (Integrated AMDK Management System)
 * 
 * Monitors:
 * 1. Raw Materials below minimum threshold (Bahan Penolong Kritis)
 * 2. Finished Goods inventory (Stok Produk Jadi Kritis/Menipis)
 * 3. Pending SPK orders needing execution
 * 4. Unfulfilled distribution deliveries (Pesanan Rencana Distribusi)
 * 5. Overdue receivables (Piutang Jatuh Tempo)
 * 6. Pending Finance Draft Journals (Draf Jurnal Belum Diverifikasi)
 * 7. Quality Control evaluations needing inspection/release
 */

import { 
  NotificationItem, ProductItem, RawMaterialItem, SPKItem, 
  ReceivablePayableItem, ProductionItem, DistributionProductDetail,
  RawMaterialPurchase, RawMaterialMutation, DeliveryPlanItem,
  DraftJournalItem, QCHeader
} from '../types';
import { getTableData } from './dbAdapter';

const READ_NOTIFS_KEY = 'AIRIS_READ_NOTIFICATIONS';

export function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIFS_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (e) {
    console.error('Error reading read notifications', e);
  }
  return new Set();
}

export function markNotificationAsRead(id: string): void {
  const readSet = getReadNotificationIds();
  readSet.add(id);
  localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(readSet)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('airis_notifications_updated'));
  }
}

export function markAllNotificationsAsRead(notifications: NotificationItem[]): void {
  const readSet = getReadNotificationIds();
  notifications.forEach(n => readSet.add(n.id));
  localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(readSet)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('airis_notifications_updated'));
  }
}

export function clearReadNotificationsHistory(): void {
  localStorage.removeItem(READ_NOTIFS_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('airis_notifications_updated'));
  }
}

/**
 * Check if audio notification chime is globally enabled
 */
export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('airis_sound_enabled') !== 'false';
}

/**
 * Set sound alert status globally and dispatch update event
 */
export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('airis_sound_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('airis_sound_changed', { detail: { enabled } }));
}

/**
 * Web Audio API synthesizer for clean notification chimes without external mp3 files
 * Respects global mute configuration (airis_sound_enabled) unless force=true
 */
export function playNotificationChime(type: 'alert' | 'success' | 'info' = 'alert', force: boolean = false): void {
  try {
    if (typeof window === 'undefined') return;
    
    // Check if audio is muted in application settings
    if (!force && !isNotificationSoundEnabled()) {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      // Pleasant rising chord
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'alert') {
      // Urgent soft alert chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(587.33, now + 0.08); // D5
      osc.frequency.setValueAtTime(783.99, now + 0.18); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Gentle info bell
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Gracefully ignore audio errors (e.g. autoplay policy)
  }
}

export function getWebPushPermission(): NotificationPermission {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission;
  }
  return 'default';
}

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  }
  return 'denied';
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): void {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
      if (isNotificationSoundEnabled()) {
        playNotificationChime('alert');
      }
    } catch (e) {
      console.warn('Browser notification error:', e);
    }
  }
}

/**
 * Accurately calculate real-time notifications by reconciling all operational tables
 */
export function calculateRealtimeNotifications(): NotificationItem[] {
  const notifications: NotificationItem[] = [];
  const readSet = getReadNotificationIds();

  // Load real operational data from store
  const products = getTableData<ProductItem>('MD_Produk', []);
  const materials = getTableData<RawMaterialItem>('MD_BahanPenolong', []);
  const purchases = getTableData<RawMaterialPurchase>('Pembelian_Bahan', []);
  const mutations = getTableData<RawMaterialMutation>('Mutasi_Bahan', []);
  const productions = getTableData<ProductionItem>('Produksi', []);
  const distItems = getTableData<DistributionProductDetail>('Distribusi_Item', []);
  const spkList = getTableData<SPKItem>('SPK', []);
  const deliveryPlans = getTableData<DeliveryPlanItem>('Rencana_Distribusi', []);
  const receivables = getTableData<ReceivablePayableItem>('Data_Piutang_Utang', []);
  const draftJournals = getTableData<DraftJournalItem>('Draf_Jurnal', []);
  const qcList = getTableData<QCHeader>('Data_QC', []);

  // 1. REKAP STOK BAHAN PENOLONG (Bahan Baku Menipis / Kritis)
  const matStockMap: Record<string, number> = {};
  materials.forEach(m => { matStockMap[m.ID_Bahan] = 0; });
  purchases.forEach(p => {
    if (matStockMap[p.ID_Bahan] !== undefined) {
      matStockMap[p.ID_Bahan] += (Number(p.Qty) || 0);
    }
  });
  mutations.forEach(mu => {
    if (matStockMap[mu.ID_Bahan] !== undefined) {
      if (mu.Jenis_Mutasi === 'Masuk') {
        matStockMap[mu.ID_Bahan] += (Number(mu.Qty) || 0);
      } else {
        matStockMap[mu.ID_Bahan] -= (Number(mu.Qty) || 0);
      }
    }
  });

  materials.forEach(m => {
    const stock = matStockMap[m.ID_Bahan] ?? 0;
    const minStock = m.Minimum_Stock ?? 1000;
    if (stock <= minStock) {
      const isDepleted = stock <= 0;
      const notifId = `mat-${m.ID_Bahan}-${stock <= 0 ? 'empty' : 'low'}`;
      notifications.push({
        id: notifId,
        type: isDepleted ? 'kritis' : 'warning',
        priority: isDepleted ? 'tinggi' : 'sedang',
        category: 'material',
        title: isDepleted ? `Bahan Baku Habis: ${m.Nama_Bahan}` : `Stok Bahan Menipis: ${m.Nama_Bahan}`,
        message: `Sisa persediaan saat ini ${stock.toLocaleString('id-ID')} ${m.Satuan} (Batas minimum: ${minStock.toLocaleString('id-ID')} ${m.Satuan}). Segera terbitkan Purchase Order (PO) ke pemasok.`,
        timestamp: 'Realtime',
        date: new Date().toISOString().slice(0, 10),
        read: readSet.has(notifId),
        actionView: 'stock',
        targetView: 'stock'
      });
    }
  });

  // 2. REKAP STOK PRODUK JADI (Sisa Stok Kurang / Habis)
  const prodStockMap: Record<string, number> = {};
  products.forEach(p => { prodStockMap[p.ID_Produk] = 0; });
  productions.forEach(pr => {
    if (prodStockMap[pr.ID_Produk] !== undefined && pr.Jumlah > 0) {
      prodStockMap[pr.ID_Produk] += Number(pr.Jumlah);
    }
  });
  distItems.forEach(di => {
    if (prodStockMap[di.ID_Produk] !== undefined && di.Qty > 0) {
      prodStockMap[di.ID_Produk] -= Number(di.Qty);
    }
  });

  products.forEach(p => {
    const stock = prodStockMap[p.ID_Produk] ?? 0;
    const criticalThreshold = 100;
    if (stock <= criticalThreshold) {
      const isDepleted = stock <= 0;
      const notifId = `stock-prod-${p.ID_Produk}-${stock <= 0 ? 'empty' : 'low'}`;
      notifications.push({
        id: notifId,
        type: isDepleted ? 'kritis' : 'warning',
        priority: isDepleted ? 'tinggi' : 'sedang',
        category: 'stock',
        title: isDepleted ? `Stok Habis: ${p.Nama_Produk}` : `Stok Kritis: ${p.Nama_Produk}`,
        message: `Sisa stok produk siap kirim tersisa ${stock.toLocaleString('id-ID')} ${p.Satuan}. Perlu diterbitkan Surat Perintah Kerja (SPK) produksi baru.`,
        timestamp: 'Realtime',
        date: new Date().toISOString().slice(0, 10),
        read: readSet.has(notifId),
        actionView: 'production',
        targetView: 'production'
      });
    }
  });

  // 3. SPK MENUNGGU PENGERJAAN
  spkList.forEach(s => {
    if (s.Status === 'Aktif') {
      const notifId = `spk-${s.ID_SPK}`;
      const prod = products.find(p => p.ID_Produk === s.ID_Produk);
      notifications.push({
        id: notifId,
        type: 'spk',
        priority: 'sedang',
        category: 'spk',
        title: `SPK Siap Dikerjakan: ${s.ID_SPK}`,
        message: `Rencana produksi ${s.Target_Produksi} unit ${prod?.Nama_Produk || s.ID_Produk} (${s.Shift}) menunggu dieksekusi di lini produksi.`,
        timestamp: s.Tanggal,
        date: s.Tanggal,
        read: readSet.has(notifId),
        actionView: 'production',
        targetView: 'production'
      });
    }
  });

  // 4. PESANAN DISTRIBUSI BELUM DIKIRIM (Rencana_Distribusi Menunggu / Disetujui)
  const pendingPlans = deliveryPlans.filter(dp => dp && (dp.Status === 'Menunggu' || dp.Status === 'Disetujui'));
  if (pendingPlans.length > 5) {
    const totalUnits = pendingPlans.reduce((acc, dp) => acc + (dp.Items ? dp.Items.reduce((s, it) => s + (Number(it.Qty) || 0), 0) : 0), 0);
    const summaryId = `orders-summary-${pendingPlans.length}`;
    notifications.push({
      id: summaryId,
      type: 'distribusi',
      priority: 'tinggi',
      category: 'distribusi',
      title: `${pendingPlans.length} Pesanan Menunggu Realisasi Kirim`,
      message: `Terdapat ${pendingPlans.length} pesanan dengan total ${totalUnits} unit barang yang menunggu diproses ke pengiriman armada.`,
      timestamp: 'Hari ini',
      date: new Date().toISOString().slice(0, 10),
      read: readSet.has(summaryId),
      actionView: 'distribution',
      targetView: 'distribution'
    });
    pendingPlans.slice(0, 3).forEach(dp => {
      const notifId = `order-${dp.ID_Rencana}`;
      const itemCount = dp.Items ? dp.Items.length : 0;
      const totalUnits = dp.Items ? dp.Items.reduce((acc, it) => acc + (Number(it.Qty) || 0), 0) : 0;
      notifications.push({
        id: notifId,
        type: 'distribusi',
        priority: dp.Status === 'Disetujui' ? 'tinggi' : 'sedang',
        category: 'distribusi',
        title: `Pesanan: ${dp.Nama_Pelanggan}`,
        message: `No. Rencana ${dp.ID_Rencana} (${dp.Metode_Kirim}) berisi ${totalUnits} unit (${itemCount} item).`,
        timestamp: dp.Tanggal_Rencana,
        date: dp.Tanggal_Rencana,
        read: readSet.has(notifId),
        actionView: 'distribution',
        targetView: 'distribution'
      });
    });
  } else {
    pendingPlans.forEach(dp => {
      const notifId = `order-${dp.ID_Rencana}`;
      const itemCount = dp.Items ? dp.Items.length : 0;
      const totalUnits = dp.Items ? dp.Items.reduce((acc, it) => acc + (Number(it.Qty) || 0), 0) : 0;
      notifications.push({
        id: notifId,
        type: 'distribusi',
        priority: dp.Status === 'Disetujui' ? 'tinggi' : 'sedang',
        category: 'distribusi',
        title: `Pesanan Menunggu Pengiriman: ${dp.Nama_Pelanggan}`,
        message: `No. Rencana ${dp.ID_Rencana} (${dp.Metode_Kirim}) berisi ${totalUnits} unit (${itemCount} item). Tujuan: ${dp.Alamat_Tujuan || '-'}.`,
        timestamp: dp.Tanggal_Rencana,
        date: dp.Tanggal_Rencana,
        read: readSet.has(notifId),
        actionView: 'distribution',
        targetView: 'distribution'
      });
    });
  }

  // 5. PIUTANG JATUH TEMPO (Ringkasan & Top Prioritas Anti-Lag)
  const today = new Date().toISOString().slice(0, 10);
  const overdueList: {
    idTransaksi: string;
    namaEntitas: string;
    saldo: number;
    jatuhTempo: string;
  }[] = [];

  for (let i = 0; i < receivables.length; i++) {
    const r = receivables[i];
    if (!r) continue;
    const tipe = r.TIPE || r.Jenis || (r as any).Tipe;
    const saldo = Number(r.SISA_SALDO ?? r.Sisa ?? (r as any).Sisa_Saldo ?? 0);
    const jatuhTempo = r.JATUH_TEMPO || r.Tgl_Jatuh_Tempo || (r as any).Jatuh_Tempo || '';
    const namaEntitas = r.NAMA_ENTITAS || r.Entitas || (r as any).Nama_Entitas || 'Konsumen';
    const idTransaksi = r.ID_Transaksi || r.ID_DOKUMEN || `trx-${i}`;

    if (tipe === 'Piutang' && saldo > 0 && jatuhTempo && jatuhTempo < today) {
      overdueList.push({ idTransaksi, namaEntitas, saldo, jatuhTempo });
    }
  }

  if (overdueList.length > 0) {
    const totalOverdueSaldo = overdueList.reduce((s, p) => s + p.saldo, 0);
    const summaryNotifId = `piutang-rekap-${overdueList.length}`;
    notifications.push({
      id: summaryNotifId,
      type: 'warning',
      priority: 'tinggi',
      category: 'finance',
      title: `${overdueList.length} Tagihan Piutang Melewati Jatuh Tempo`,
      message: `Total ${overdueList.length} faktur penagihan senilai Rp ${totalOverdueSaldo.toLocaleString('id-ID')} telah melewati tanggal jatuh tempo. Segera koordinasikan dengan tim penagihan.`,
      timestamp: 'Hari ini',
      date: today,
      read: readSet.has(summaryNotifId),
      actionView: 'finance',
      targetView: 'finance'
    });

    // Urutkan berdasarkan saldo terbesar dan sertakan maksimal 3 faktur terbesar agar tidak membebani browser
    const topOverdue = [...overdueList]
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 3);

    topOverdue.forEach(p => {
      const notifId = `piutang-${p.idTransaksi}`;
      notifications.push({
        id: notifId,
        type: 'warning',
        priority: 'tinggi',
        category: 'finance',
        title: `Piutang Jatuh Tempo: ${p.namaEntitas}`,
        message: `Tagihan No. ${p.idTransaksi} senilai Rp ${p.saldo.toLocaleString('id-ID')} telah jatuh tempo sejak ${p.jatuhTempo}.`,
        timestamp: p.jatuhTempo,
        date: p.jatuhTempo,
        read: readSet.has(notifId),
        actionView: 'finance',
        targetView: 'finance'
      });
    });
  }

  // 6. DRAF JURNAL MENUNGGU VERIFIKASI MANAJER KEUANGAN
  const pendingDrafts = draftJournals.filter(d => d.Status === 'Menunggu Verifikasi');
  if (pendingDrafts.length > 0) {
    const notifId = `draft-journals-${pendingDrafts.length}`;
    const totalNominal = pendingDrafts.reduce((sum, d) => sum + (Number(d.Nominal) || 0), 0);
    notifications.push({
      id: notifId,
      type: 'keuangan',
      priority: 'sedang',
      category: 'finance',
      title: `${pendingDrafts.length} Draf Jurnal Menunggu Verifikasi`,
      message: `Total nilai draf transaksi Rp ${totalNominal.toLocaleString('id-ID')} menunggu verifikasi & pembukuan resmi ke Jurnal Umum.`,
      timestamp: 'Hari ini',
      date: today,
      read: readSet.has(notifId),
      actionView: 'finance',
      targetView: 'finance'
    });
  }

  // 7. HASIL PEMERIKSAAN QC (Data Belum Lengkap / Tidak Memenuhi Standar)
  qcList.forEach(q => {
    if (q.Status_Data === 'Belum Lengkap') {
      const notifId = `qc-incomplete-${q.ID_QC}`;
      notifications.push({
        id: notifId,
        type: 'qc',
        priority: 'sedang',
        category: 'qc',
        title: `Data QC Belum Lengkap: ${q.ID_QC}`,
        message: `Hasil uji parameter mutu produk ${q.Produk} (${q.Tanggal}) oleh ${q.Petugas_QC} belum diselesaikan 3 siklus.`,
        timestamp: q.Tanggal,
        date: q.Tanggal,
        read: readSet.has(notifId),
        actionView: 'qc',
        targetView: 'qc'
      });
    } else if (q.Kesimpulan && (q.Kesimpulan.toLowerCase().includes('tidak') || q.Kesimpulan.toLowerCase().includes('tolak'))) {
      const notifId = `qc-failed-${q.ID_QC}`;
      notifications.push({
        id: notifId,
        type: 'kritis',
        priority: 'tinggi',
        category: 'qc',
        title: `QC Tidak Lolos Uji SNI: ${q.Produk}`,
        message: `No. Uji ${q.ID_QC}: Kesimpulan menunjukkan parameter tidak sesuai standar SNI 3553:2023. Tahan pelepasan produk!`,
        timestamp: q.Tanggal,
        date: q.Tanggal,
        read: readSet.has(notifId),
        actionView: 'qc',
        targetView: 'qc'
      });
    }
  });

  return notifications;
}
