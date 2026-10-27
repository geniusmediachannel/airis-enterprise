import { AppLicenseSettings, LicenseStatusResult } from '../types';
import { getSupabaseClient } from './dbAdapter';

const LICENSE_STORAGE_KEY = 'AIRIS_APP_LICENSE_V1';
const DEFAULT_BILLING_EMAIL = 'gemiusmediachannel@gmail.com';

/**
 * Pengaturan Lisensi Default Awal Sistem
 */
export const DEFAULT_LICENSE_SETTINGS: AppLicenseSettings = {
  isActive: true,
  expiryDate: '2026-11-30', // Default aktif sampai 30 November 2026
  billingEmail: DEFAULT_BILLING_EMAIL,
  packageType: 'Lisensi Enterprise PT. Anugerah Illahi Rabbi (As-Shofaa AMDK)',
  lockedMessage: 'Masa aktif aplikasi AIRIS Enterprise telah berakhir. Silakan lakukan pembayaran perpanjangan lisensi agar sistem dapat digunakan kembali.',
  lastUpdatedBy: 'System Engine',
  lastUpdatedAt: new Date().toISOString()
};

/**
 * Mengambil pengaturan lisensi dari localStorage
 */
export function getLicenseSettings(): AppLicenseSettings {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_LICENSE_SETTINGS,
        ...parsed,
        billingEmail: parsed.billingEmail || DEFAULT_BILLING_EMAIL
      };
    }
  } catch (err) {
    console.warn('[licenseService] Gagal membaca lisensi lokal:', err);
  }
  return { ...DEFAULT_LICENSE_SETTINGS };
}

/**
 * Menyimpan pengaturan lisensi oleh Hyper Admin
 */
export function saveLicenseSettings(
  updated: Partial<AppLicenseSettings>,
  updaterUsername: string = 'hyperadmin'
): AppLicenseSettings {
  const current = getLicenseSettings();
  const next: AppLicenseSettings = {
    ...current,
    ...updated,
    billingEmail: updated.billingEmail?.trim() || current.billingEmail || DEFAULT_BILLING_EMAIL,
    lastUpdatedBy: updaterUsername,
    lastUpdatedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('airis_license_updated', { detail: next }));

    // Sinkronkan juga ke Supabase Cloud jika terhubung agar device lain langsung terupdate
    const client = getSupabaseClient();
    if (client) {
      client
        .from('MD_UserAkses')
        .update({ Alasan_Daftar: JSON.stringify(next) })
        .eq('Username', 'hyperadmin')
        .then(() => {})
        .catch(() => {});
    }
  } catch (err) {
    console.error('[licenseService] Gagal menyimpan lisensi:', err);
  }

  return next;
}

/**
 * Memeriksa status masa aktif lisensi aplikasi
 */
export function checkLicenseStatus(customSettings?: AppLicenseSettings): LicenseStatusResult {
  const settings = customSettings || getLicenseSettings();
  const billingEmail = settings.billingEmail || DEFAULT_BILLING_EMAIL;

  // Tanggal saat ini (hanya YYYY-MM-DD jam 00:00:00 untuk perbandingan hari presisi)
  const now = new Date();
  const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const today = new Date(todayDateStr);
  const expiry = new Date(settings.expiryDate);

  // Selisih hari
  const diffMs = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Format tanggal ramah pengguna (contoh: 30 Oktober 2026)
  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const expiryDateFormatted = expiry.toLocaleDateString('id-ID', dateOptions);

  // 1. Jika dikunci manual oleh HyperAdmin
  if (!settings.isActive) {
    return {
      isExpired: true,
      isLockedManual: true,
      daysRemaining: 0,
      status: 'expired',
      expiryDateFormatted,
      message: settings.lockedMessage || 'Aplikasi sementara terkunci oleh Hyper Admin.',
      billingEmail
    };
  }

  // 2. Jika masa aktif sudah habis (daysRemaining < 0)
  if (daysRemaining < 0) {
    return {
      isExpired: true,
      isLockedManual: false,
      daysRemaining: 0,
      status: 'expired',
      expiryDateFormatted,
      message: `Masa aktif aplikasi telah berakhir pada ${expiryDateFormatted}. Lakukan pembayaran agar aplikasi dapat digunakan kembali.`,
      billingEmail
    };
  }

  // 3. Jika masa aktif hampir habis (<= 7 hari)
  if (daysRemaining <= 7) {
    return {
      isExpired: false,
      isLockedManual: false,
      daysRemaining,
      status: 'warning',
      expiryDateFormatted,
      message: `Masa aktif aplikasi sisa ${daysRemaining === 0 ? 'hari ini' : `${daysRemaining} hari lagi`} (hingga ${expiryDateFormatted}). Lakukan pembayaran agar aplikasi tetap dapat digunakan.`,
      billingEmail
    };
  }

  // 4. Lisensi normal aktif
  return {
    isExpired: false,
    isLockedManual: false,
    daysRemaining,
    status: 'active',
    expiryDateFormatted,
    message: `Aplikasi aktif hingga ${expiryDateFormatted} (${daysRemaining} hari tersisa).`,
    billingEmail
  };
}

/**
 * Generate tautan mailto resmi untuk kirim bukti transfer
 */
export function generateBillingMailto(
  companyOrParams?: string | { companyName?: string; senderName?: string; notes?: string; },
  notesStr?: string
): string {
  const settings = getLicenseSettings();
  const email = settings.billingEmail || DEFAULT_BILLING_EMAIL;

  let company = 'PT. Anugerah Illahi Rabbi (As-Shofaa AMDK)';
  let sender = 'Pimpinan / Manajemen';
  let notes = 'Perpanjangan Lisensi Operasional Pabrik AMDK';

  if (typeof companyOrParams === 'string') {
    company = companyOrParams;
    if (notesStr) notes = notesStr;
  } else if (companyOrParams && typeof companyOrParams === 'object') {
    if (companyOrParams.companyName) company = companyOrParams.companyName;
    if (companyOrParams.senderName) sender = companyOrParams.senderName;
    if (companyOrParams.notes) notes = companyOrParams.notes;
  }

  const subject = encodeURIComponent(`Bukti Transfer Perpanjangan Lisensi AIRIS Enterprise - ${company}`);
  const body = encodeURIComponent(
    `Kepada Tim Genius Media Channel / Hyper Admin,\n\n` +
    `Bersama email ini kami melampirkan bukti transfer perpanjangan masa aktif aplikasi sistem AIRIS Enterprise:\n\n` +
    `• Perusahaan: ${company}\n` +
    `• Pengirim: ${sender}\n` +
    `• Tanggal Transfer: ${new Date().toLocaleDateString('id-ID')}\n` +
    `• Catatan: ${notes}\n\n` +
    `Mohon untuk dapat disetting ulang tanggal masa aktif aplikasi di panel Hyper Admin.\n\n` +
    `Terima kasih.`
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/**
 * Tambah masa aktif instan (misal +30 hari, +90 hari, +365 hari)
 */
export function quickExtendLicense(days: number, updaterUsername: string = 'hyperadmin'): AppLicenseSettings {
  const current = getLicenseSettings();
  const baseDate = new Date(current.expiryDate);
  const now = new Date();

  // Jika tanggal sebelumnya sudah lewat, mulai dari hari ini
  const start = baseDate < now ? now : baseDate;
  start.setDate(start.getDate() + days);

  const newExpiryStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

  return saveLicenseSettings(
    {
      isActive: true,
      expiryDate: newExpiryStr
    },
    updaterUsername
  );
}

// Alias fungsi untuk fleksibilitas import
export const getAppLicenseSettings = getLicenseSettings;
export const saveAppLicenseSettings = saveLicenseSettings;
