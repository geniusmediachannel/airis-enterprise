import { AccessLogItem, UserAccount } from '../types';
import { getTableData, setTableData, notifyDbChange } from './dbAdapter';

const LOG_TABLE_NAME = 'Log_Akses_Pengguna';
const RETENTION_DAYS = 90; // Kebijakan retensi 3 bulan (90 hari)

/**
 * Mendapatkan detail platform / browser dari User Agent
 */
function getClientBrowserInfo(): string {
  try {
    const ua = navigator.userAgent;
    let browser = 'Browser Standar';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
    else if (ua.includes('Edg')) browser = 'Microsoft Edge';
    else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';

    let os = 'Desktop';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} (${os})`;
  } catch {
    return 'Desktop Web Browser';
  }
}

/**
 * Membersihkan log akses yang sudah berusia lebih dari 90 hari (3 bulan).
 * Menjamin histori akses otomatis ter-reset setiap 3 bulan sesuai kebijakan privasi & audit.
 */
export function cleanExpiredAccessLogs(retentionDays = RETENTION_DAYS): { removedCount: number; remainingCount: number } {
  try {
    const logs = getTableData<AccessLogItem>(LOG_TABLE_NAME, []);
    if (logs.length === 0) return { removedCount: 0, remainingCount: 0 };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString().slice(0, 10);

    const validLogs = logs.filter(log => {
      const logDate = log.Tanggal || (log.Waktu ? log.Waktu.slice(0, 10) : '');
      return logDate >= cutoffISO;
    });

    const removedCount = logs.length - validLogs.length;
    if (removedCount > 0) {
      setTableData(LOG_TABLE_NAME, validLogs);
      notifyDbChange();
    }
    return { removedCount, remainingCount: validLogs.length };
  } catch (err) {
    console.warn('Gagal membersihkan log akses kedaluwarsa:', err);
    return { removedCount: 0, remainingCount: 0 };
  }
}

/**
 * Mengambil semua log akses pengguna.
 * Otomatis menjalankan pembersihan log > 3 bulan saat dibaca.
 */
export function getAllAccessLogs(): AccessLogItem[] {
  // 1. Bersihkan log lampau > 3 bulan
  cleanExpiredAccessLogs();
  
  // 2. Ambil data log
  const logs = getTableData<AccessLogItem>(LOG_TABLE_NAME, []);
  
  // 3. Jika masih kosong, sediakan beberapa data awal demonstrasi
  if (logs.length === 0) {
    const seedLogs = generateSeedAccessLogs();
    setTableData(LOG_TABLE_NAME, seedLogs);
    return seedLogs;
  }
  
  // Urutkan dari yang paling baru
  return [...logs].sort((a, b) => (b.Waktu || '').localeCompare(a.Waktu || ''));
}

/**
 * Mencatat log aktivitas akses pengguna (Login, Logout, Gagal, Ditolak).
 */
export function recordAccessLog(params: {
  username: string;
  user?: UserAccount | null;
  aktivitas: 'Login Berhasil' | 'Login Gagal' | 'Logout' | 'Akses Ditolak';
  status: 'Sukses' | 'Gagal' | 'Peringatan';
  keterangan: string;
  ipAddress?: string;
}): AccessLogItem {
  const now = new Date();
  const isoTime = now.toISOString();
  const dateStr = isoTime.slice(0, 10);
  const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });

  const newLog: AccessLogItem = {
    ID_Log: `LOG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
    Waktu: isoTime,
    Tanggal: dateStr,
    Jam: timeStr,
    ID_User: params.user?.ID_User,
    Username: params.username || params.user?.Username || 'Anonym',
    Nama_Karyawan: params.user?.Nama || (params.user?.ID_Karyawan ? `Karyawan (${params.user.ID_Karyawan})` : '-'),
    Role: params.user?.Role || '-',
    Aktivitas: params.aktivitas,
    Status: params.status,
    IP_Address: params.ipAddress || '127.0.0.1 (Lokal/Intranet)',
    Browser_Device: getClientBrowserInfo(),
    Keterangan: params.keterangan
  };

  try {
    const currentLogs = getTableData<AccessLogItem>(LOG_TABLE_NAME, []);
    const updated = [newLog, ...currentLogs];
    setTableData(LOG_TABLE_NAME, updated);
    notifyDbChange();

    // Jalankan auto-purge retensi 3 bulan
    cleanExpiredAccessLogs();
  } catch (err) {
    console.error('Gagal mencatat log akses:', err);
  }

  return newLog;
}

/**
 * Reset total semua log akses (Khusus SuperAdmin)
 */
export function clearAllAccessLogs(): boolean {
  try {
    setTableData(LOG_TABLE_NAME, []);
    notifyDbChange();
    return true;
  } catch {
    return false;
  }
}

/**
 * Hapus 1 baris log akses tertentu
 */
export function deleteSingleAccessLog(idLog: string): boolean {
  try {
    const logs = getTableData<AccessLogItem>(LOG_TABLE_NAME, []);
    const filtered = logs.filter(l => l.ID_Log !== idLog);
    setTableData(LOG_TABLE_NAME, filtered);
    notifyDbChange();
    return true;
  } catch {
    return false;
  }
}

/**
 * Data awal (seed) histori akses agar tabel tidak kosong saat pertama kali dibuka
 */
function generateSeedAccessLogs(): AccessLogItem[] {
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);

  const d1 = new Date(now);
  d1.setHours(d1.getHours() - 1);
  const d2 = new Date(now);
  d2.setDate(d2.getDate() - 1);
  const d3 = new Date(now);
  d3.setDate(d3.getDate() - 5);
  const d4 = new Date(now);
  d4.setDate(d4.getDate() - 15);

  return [
    {
      ID_Log: `LOG-${Date.now().toString().slice(-6)}-101`,
      Waktu: now.toISOString(),
      Tanggal: todayISO,
      Jam: now.toLocaleTimeString('id-ID', { hour12: false }),
      ID_User: 'USR-01',
      Username: 'admin',
      Nama_Karyawan: 'Budi Santoso',
      Role: 'SuperAdmin',
      Aktivitas: 'Login Berhasil',
      Status: 'Sukses',
      IP_Address: '192.168.1.10 (Pabrik)',
      Browser_Device: 'Google Chrome (Windows)',
      Keterangan: 'Autentikasi sesi aktif SuperAdmin'
    },
    {
      ID_Log: `LOG-${Date.now().toString().slice(-6)}-102`,
      Waktu: d1.toISOString(),
      Tanggal: todayISO,
      Jam: d1.toLocaleTimeString('id-ID', { hour12: false }),
      ID_User: 'USR-03',
      Username: 'produksi',
      Nama_Karyawan: 'Hendra Gunawan',
      Role: 'Admin Produksi',
      Aktivitas: 'Login Berhasil',
      Status: 'Sukses',
      IP_Address: '192.168.1.15 (Terminal Line Produksi)',
      Browser_Device: 'Microsoft Edge (Windows)',
      Keterangan: 'Masuk modul SPK & input hasil produksi'
    },
    {
      ID_Log: `LOG-${Date.now().toString().slice(-6)}-103`,
      Waktu: d2.toISOString(),
      Tanggal: d2.toISOString().slice(0, 10),
      Jam: d2.toLocaleTimeString('id-ID', { hour12: false }),
      ID_User: 'USR-05',
      Username: 'finance',
      Nama_Karyawan: 'Siti Aminah',
      Role: 'Kasir/Finance',
      Aktivitas: 'Login Berhasil',
      Status: 'Sukses',
      IP_Address: '192.168.1.20 (Ruang Kasir)',
      Browser_Device: 'Google Chrome (Windows)',
      Keterangan: 'Verifikasi jurnal dan cetak kwitansi kas'
    },
    {
      ID_Log: `LOG-${Date.now().toString().slice(-6)}-104`,
      Waktu: d3.toISOString(),
      Tanggal: d3.toISOString().slice(0, 10),
      Jam: d3.toLocaleTimeString('id-ID', { hour12: false }),
      Username: 'operator_tamu',
      Role: '-',
      Aktivitas: 'Login Gagal',
      Status: 'Gagal',
      IP_Address: '192.168.1.45 (WiFi Kantor)',
      Browser_Device: 'Safari (iPhone iOS)',
      Keterangan: 'Username tidak terdaftar di sistem'
    },
    {
      ID_Log: `LOG-${Date.now().toString().slice(-6)}-105`,
      Waktu: d4.toISOString(),
      Tanggal: d4.toISOString().slice(0, 10),
      Jam: d4.toLocaleTimeString('id-ID', { hour12: false }),
      ID_User: 'USR-04',
      Username: 'gudang',
      Nama_Karyawan: 'Rian Pratama',
      Role: 'Admin Gudang',
      Aktivitas: 'Logout',
      Status: 'Sukses',
      IP_Address: '192.168.1.12 (Terminal Gudang Jadi)',
      Browser_Device: 'Google Chrome (Windows)',
      Keterangan: 'Pengguna keluar dari aplikasi'
    }
  ];
}
