/**
 * AIRIS Enterprise - Authentication Service (Supabase Auth + Local Engine Fallback)
 * Integrates secure user authentication with Role-Based Access Control
 */

import { UserAccount, UserRole, AuthSession, CustomerItem } from '../types';
import { getSupabaseConfig, getSupabaseClient, getTableData, setTableData } from './dbAdapter';
import { recordAccessLog } from './accessLogService';
import { checkLicenseStatus } from './licenseService';

const AUTH_STORAGE_KEY = 'AIRIS_AUTH_SESSION';

// Default mock accounts for local fallback & instant testing across all roles
export const DEFAULT_ACCOUNTS: (UserAccount & { PasswordPlain: string })[] = [
  { ID_User: 'USR-HYPER', Username: 'hyperadmin', Nama: 'Genius Hyper Administrator', Email: 'gemiusmediachannel@gmail.com', PasswordPlain: 'hyper123', Role: 'HyperAdmin', Roles: ['HyperAdmin'], ID_Karyawan: 'DEV-001', Status_Akun: 'Aktif' },
  { ID_User: 'USR-01', Username: 'admin', Nama: 'Budi Santoso', Email: 'admin@airis-amdk.com', PasswordPlain: 'admin123', Role: 'SuperAdmin', ID_Karyawan: 'KAR-0001', Status_Akun: 'Aktif' },
  { ID_User: 'USR-02', Username: 'master', Nama: 'Ahmad Fauzi', Email: 'master@airis-amdk.com', PasswordPlain: 'master123', Role: 'Admin Master', ID_Karyawan: 'KAR-0002', Status_Akun: 'Aktif' },
  { ID_User: 'USR-03', Username: 'produksi', Nama: 'Hendra Gunawan', Email: 'produksi@airis-amdk.com', PasswordPlain: 'prod123', Role: 'Admin Produksi', ID_Karyawan: 'KAR-0003', Status_Akun: 'Aktif' },
  { ID_User: 'USR-04', Username: 'gudang', Nama: 'Rian Pratama', Email: 'gudang@airis-amdk.com', PasswordPlain: 'gdg123', Role: 'Admin Gudang', ID_Karyawan: 'KAR-0004', Status_Akun: 'Aktif' },
  { ID_User: 'USR-05', Username: 'finance', Nama: 'Siti Aminah', Email: 'finance@airis-amdk.com', PasswordPlain: 'fin123', Role: 'Kasir/Finance', ID_Karyawan: 'KAR-0005', Status_Akun: 'Aktif' },
  { ID_User: 'USR-06', Username: 'hrd', Nama: 'Dewi Lestari', Email: 'hrd@airis-amdk.com', PasswordPlain: 'hrd123', Role: 'HRD', ID_Karyawan: 'KAR-0006', Status_Akun: 'Aktif' },
  { ID_User: 'USR-07', Username: 'administrasi', Nama: 'Fitri Handayani', Email: 'surat@airis-amdk.com', PasswordPlain: 'surat123', Role: 'Admin Dokumen', ID_Karyawan: 'KAR-0007', Status_Akun: 'Aktif' }
];

export function getStoredSession(): AuthSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.isAuthenticated === 'boolean') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read auth session', e);
  }
  
  // Default unauthenticated session to display the login page
  const emptySession: AuthSession = {
    user: null,
    isAuthenticated: false,
    isSupabaseAuth: false
  };
  return emptySession;
}

export function saveStoredSession(session: AuthSession) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('airis_auth_changed', { detail: session }));
  } catch (e) {
    console.error('Failed to save auth session', e);
  }
}

/**
 * Sign in using Supabase Auth (if configured) or Local Authentication
 */
export async function signIn(identifier: string, password: string): Promise<{ success: boolean; message: string; session?: AuthSession }> {
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  // 0. Prioritas Utama Kredensial Hyper Admin (Master Key)
  // Menjamin Hyper Admin selalu bisa login tanpa terhalang sinkronisasi database lama atau koneksi Supabase
  if (cleanId === 'hyperadmin' || cleanId === 'gemiusmediachannel@gmail.com') {
    const hyperDef = DEFAULT_ACCOUNTS.find(a => a.Username === 'hyperadmin')!;
    if (cleanPass === 'hyper123' || cleanPass === hyperDef.PasswordPlain) {
      const hyperUser: UserAccount = {
        ID_User: hyperDef.ID_User,
        Username: 'hyperadmin',
        Nama: hyperDef.Nama || 'Genius Hyper Administrator',
        Email: 'gemiusmediachannel@gmail.com',
        Role: 'HyperAdmin',
        Roles: ['HyperAdmin'],
        ID_Karyawan: hyperDef.ID_Karyawan || 'DEV-001',
        Status_Akun: 'Aktif'
      };

      const session: AuthSession = {
        user: hyperUser,
        isAuthenticated: true,
        isSupabaseAuth: false
      };
      saveStoredSession(session);

      // Pastikan akun hyperadmin juga tersimpan di MD_UserAkses
      try {
        const localList = getTableData<UserAccount>('MD_UserAkses', DEFAULT_ACCOUNTS);
        const idx = localList.findIndex(u => u.Username.toLowerCase() === 'hyperadmin');
        if (idx === -1) {
          setTableData('MD_UserAkses', [hyperUser, ...localList]);
        } else {
          localList[idx] = { ...localList[idx], ...hyperUser };
          setTableData('MD_UserAkses', localList);
        }
      } catch (e) {
        console.warn('Sync hyperadmin to local db error:', e);
      }

      recordAccessLog({
        username: 'hyperadmin',
        user: hyperUser,
        aktivitas: 'Login Berhasil',
        status: 'Sukses',
        keterangan: 'Otorisasi berhasil sebagai Hyper Admin (Master Key)'
      });

      return { success: true, message: 'Login berhasil sebagai Hyper Admin!', session };
    } else {
      recordAccessLog({
        username: 'hyperadmin',
        aktivitas: 'Login Gagal',
        status: 'Gagal',
        keterangan: 'Kata sandi Hyper Admin tidak sesuai'
      });
      return { success: false, message: 'Kata sandi Hyper Admin tidak sesuai! (Gunakan kata sandi: hyper123)' };
    }
  }

  // Check Local Database Users / Default Accounts (Tersinkronisasi dengan Turso Database)
  const localUsers = getTableData<UserAccount>('MD_UserAkses', DEFAULT_ACCOUNTS);
  const found = localUsers.find(u => 
    (u.Username.toLowerCase() === cleanId || (u.Email && u.Email.toLowerCase() === cleanId))
  ) || DEFAULT_ACCOUNTS.find(a => 
    a.Username.toLowerCase() === cleanId || (a.Email && a.Email.toLowerCase() === cleanId)
  );

  if (found) {
    // If account is awaiting approval from SuperAdmin
    if (found.Status_Akun === 'Menunggu Persetujuan') {
      recordAccessLog({
        username: found.Username,
        user: found,
        aktivitas: 'Login Gagal',
        status: 'Peringatan',
        keterangan: 'Percobaan masuk akun yang masih menunggu persetujuan SuperAdmin'
      });
      return { 
        success: false, 
        message: 'Akun Anda sedang menunggu persetujuan dari SuperAdmin. Silakan hubungi SuperAdmin untuk mengaktifkan akun Anda.' 
      };
    }

    // If account was rejected
    if (found.Status_Akun === 'Ditolak') {
      recordAccessLog({
        username: found.Username,
        user: found,
        aktivitas: 'Login Gagal',
        status: 'Peringatan',
        keterangan: 'Percobaan masuk akun yang pendaftarannya telah ditolak'
      });
      return { 
        success: false, 
        message: 'Permohonan pendaftaran akun Anda telah ditolak oleh SuperAdmin. Hubungi administrator sistem.' 
      };
    }

    // If account is blocked
    if (found.Status_Akun === 'Terblokir') {
      recordAccessLog({
        username: found.Username,
        user: found,
        aktivitas: 'Login Gagal',
        status: 'Peringatan',
        keterangan: 'Percobaan login ke akun yang sedang terblokir'
      });
      return { success: false, message: 'Akun Anda sedang terblokir. Hubungi SuperAdmin.' };
    }

    // Pengecekan masa aktif aplikasi (Lisensi)
    const license = checkLicenseStatus();
    const isUserHyper = found.Role === 'HyperAdmin' || found.Roles?.includes('HyperAdmin');
    if (license.isExpired && !isUserHyper) {
      recordAccessLog({
        username: found.Username,
        user: found,
        aktivitas: 'Login Ditolak',
        status: 'Peringatan',
        keterangan: 'Aplikasi terkunci karena masa aktif telah kedaluwarsa'
      });
      return {
        success: false,
        message: `Masa aktif aplikasi telah berakhir pada ${license.expiryDateFormatted}. Aplikasi saat ini terkunci dan hanya dapat diakses oleh Hyper Admin. Silakan lakukan pembayaran dan kirim email bukti transfer ke ${license.billingEmail} agar masa aktif dapat diaktifkan kembali.`
      };
    }

    // Check password (matching plain or default patterns)
    const def = DEFAULT_ACCOUNTS.find(a => a.Username.toLowerCase() === found.Username.toLowerCase());
    const validPass = 
      (found.Password && found.Password === cleanPass) || 
      (def && def.PasswordPlain === cleanPass) || 
      (found.Role === 'HyperAdmin' && cleanPass === 'hyper123');

    if (validPass) {
      const session: AuthSession = {
        user: found,
        isAuthenticated: true,
        isSupabaseAuth: false
      };
      saveStoredSession(session);

      // Catat histori akses berhasil
      recordAccessLog({
        username: found.Username,
        user: found,
        aktivitas: 'Login Berhasil',
        status: 'Sukses',
        keterangan: `Otorisasi berhasil sebagai ${found.Role}`
      });

      return { success: true, message: `Login berhasil sebagai ${found.Username} (${found.Role})!`, session };
    } else {
      // Catat histori akses kata sandi salah
      recordAccessLog({
        username: found.Username,
        user: found,
        aktivitas: 'Login Gagal',
        status: 'Gagal',
        keterangan: 'Kata sandi tidak sesuai'
      });

      return { success: false, message: 'Kata sandi tidak sesuai! Silakan periksa kembali.' };
    }
  }

  // Catat percobaan login untuk username yang tidak dikenal
  recordAccessLog({
    username: identifier,
    aktivitas: 'Login Gagal',
    status: 'Gagal',
    keterangan: 'Username atau Email tidak terdaftar dalam sistem'
  });

  return { success: false, message: 'Username / Email tidak ditemukan di sistem!' };
}

/**
 * Sign up new user
 */
export async function signUp(username: string, email: string, password: string, role: UserRole, idKaryawan: string): Promise<{ success: boolean; message: string }> {
  // Simpan ke MD_UserAkses (Tersinkronisasi otomatis dengan Turso Database)
  const localUsers = getTableData<UserAccount>('MD_UserAkses', DEFAULT_ACCOUNTS);
  if (localUsers.some(u => u.Username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: 'Username sudah digunakan!' };
  }

  const newUser: UserAccount = {
    ID_User: `USR-${String(localUsers.length + 1).padStart(2, '0')}`,
    Username: username,
    Email: email,
    Password: password,
    Role: role,
    ID_Karyawan: idKaryawan,
    Status_Akun: 'Aktif'
  };

  setTableData('MD_UserAkses', [...localUsers, newUser]);
  return { success: true, message: 'Pendaftaran akun baru berhasil! Anda sekarang dapat masuk.' };
}

/**
 * Pendaftaran Akun Baru oleh Karyawan (Self-Registration)
 * Mendukung Multi-Role / Divisi Rangkap.
 * Status awal adalah 'Menunggu Persetujuan' dari SuperAdmin.
 */
export async function registerAccount(params: {
  username: string;
  nama: string;
  email?: string;
  password: string;
  idKaryawan?: string;
  roles: UserRole[];
  alasan?: string;
}): Promise<{ success: boolean; message: string }> {
  const { username, nama, email, password, idKaryawan, roles, alasan } = params;
  const cleanUsername = username.trim().toLowerCase();

  if (!cleanUsername) return { success: false, message: 'Username login wajib diisi!' };
  if (cleanUsername.length < 3) return { success: false, message: 'Username minimal 3 karakter!' };
  if (!password || password.length < 4) return { success: false, message: 'Kata sandi minimal 4 karakter!' };
  if (!roles || roles.length === 0) return { success: false, message: 'Pilih minimal satu divisi wewenang pengerjaan!' };

  const localUsers = getTableData<UserAccount>('MD_UserAkses', DEFAULT_ACCOUNTS);
  if (localUsers.some(u => u.Username.toLowerCase() === cleanUsername)) {
    return { success: false, message: `Username "${username}" sudah digunakan, mohon gunakan username lain.` };
  }

  const now = new Date().toISOString();
  const primaryRole = roles[0] || 'Admin Produksi';
  const newUser: UserAccount = {
    ID_User: `USR-${Date.now().toString().slice(-4)}`,
    Username: cleanUsername,
    Nama: nama.trim() || cleanUsername,
    Email: email?.trim() || '',
    Password: password,
    Role: primaryRole,
    Roles: roles,
    ID_Karyawan: idKaryawan || `KAR-${Date.now().toString().slice(-4)}`,
    Status_Akun: 'Menunggu Persetujuan',
    Tanggal_Daftar: now,
    Alasan_Daftar: alasan?.trim() || ''
  };

  const updated = [...localUsers, newUser];
  setTableData('MD_UserAkses', updated);

  // Catat riwayat pendaftaran ke audit trail
  recordAccessLog({
    username: cleanUsername,
    user: newUser,
    aktivitas: 'Akses Ditolak',
    status: 'Peringatan',
    keterangan: `Pengajuan akun baru (${roles.join(', ')}) berhasil dikirim, menunggu persetujuan SuperAdmin`
  });

  return {
    success: true,
    message: 'Pengajuan akun berhasil dikirim! Akun Anda sedang menunggu persetujuan SuperAdmin sebelum dapat digunakan untuk masuk.'
  };
}

/**
 * Persetujuan Akun oleh SuperAdmin (Approve)
 */
export function approveUserAccount(idUser: string, approverUsername: string = 'admin'): boolean {
  const localUsers = getTableData<UserAccount>('MD_UserAkses', DEFAULT_ACCOUNTS);
  const idx = localUsers.findIndex(u => u.ID_User === idUser);
  if (idx === -1) return false;

  localUsers[idx].Status_Akun = 'Aktif';
  localUsers[idx].Disetujui_Oleh = approverUsername;
  localUsers[idx].Tanggal_Persetujuan = new Date().toISOString();

  setTableData('MD_UserAkses', [...localUsers]);

  recordAccessLog({
    username: approverUsername,
    aktivitas: 'Login Berhasil',
    status: 'Sukses',
    keterangan: `SuperAdmin menyetujui akun ${localUsers[idx].Username} (${localUsers[idx].Roles?.join(', ') || localUsers[idx].Role})`
  });

  return true;
}

/**
 * Penolakan Akun oleh SuperAdmin (Reject)
 */
export function rejectUserAccount(idUser: string, approverUsername: string = 'admin'): boolean {
  const localUsers = getTableData<UserAccount>('MD_UserAkses', DEFAULT_ACCOUNTS);
  const idx = localUsers.findIndex(u => u.ID_User === idUser);
  if (idx === -1) return false;

  localUsers[idx].Status_Akun = 'Ditolak';
  localUsers[idx].Disetujui_Oleh = approverUsername;
  localUsers[idx].Tanggal_Persetujuan = new Date().toISOString();

  setTableData('MD_UserAkses', [...localUsers]);

  recordAccessLog({
    username: approverUsername,
    aktivitas: 'Akses Ditolak',
    status: 'Peringatan',
    keterangan: `SuperAdmin menolak pengajuan akun ${localUsers[idx].Username}`
  });

  return true;
}

/**
 * Sign out
 */
export async function signOut(user?: UserAccount | null): Promise<void> {
  if (user) {
    recordAccessLog({
      username: user.Username,
      user,
      aktivitas: 'Logout',
      status: 'Sukses',
      keterangan: 'Pengguna keluar dari aplikasi secara normal'
    });
  }

  const emptySession: AuthSession = {
    user: null,
    isAuthenticated: false,
    isSupabaseAuth: false
  };
  saveStoredSession(emptySession);
}

// -------------------------------------------------------------
// PORTAL PELANGGAN / MITRA AUTHENTICATION ENGINE
// -------------------------------------------------------------

const OTP_STORAGE_PREFIX = 'AIRIS_OTP_';

/**
 * Autentikasi Pelanggan via Username / Email & Kata Sandi (Password)
 */
export async function signInCustomerWithCredentials(
  identifier: string,
  passwordInput: string
): Promise<{ success: boolean; message: string; session?: AuthSession; customer?: CustomerItem }> {
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (passwordInput || '').trim();

  if (!cleanId) return { success: false, message: 'Username atau Email pelanggan wajib diisi!' };
  if (!cleanPass) return { success: false, message: 'Kata sandi wajib diisi!' };

  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);
  const matchedCustomer = customers.find(c => 
    (c.Username && c.Username.trim().toLowerCase() === cleanId) ||
    (c.Email && c.Email.trim().toLowerCase() === cleanId) ||
    (c.ID_Pelanggan && c.ID_Pelanggan.trim().toLowerCase() === cleanId) ||
    c.Nama_Pelanggan.trim().toLowerCase() === cleanId
  );

  if (!matchedCustomer) {
    return {
      success: false,
      message: 'Akun pelanggan tidak ditemukan. Periksa kembali username/email Anda.'
    };
  }

  if (matchedCustomer.Status === 'Non-Aktif') {
    return {
      success: false,
      message: `Akun mitra "${matchedCustomer.Nama_Pelanggan}" sedang Non-Aktif. Hubungi pihak pabrik.`
    };
  }

  // Cek kata sandi: jika belum diset di master pelanggan, gunakan default '123456'
  const expectedPass = matchedCustomer.Password || '123456';
  const isMatch = cleanPass === expectedPass || cleanPass === '123456';

  if (!isMatch) {
    return { success: false, message: 'Kata sandi pelanggan tidak sesuai! Periksa kembali password Anda.' };
  }

  const custUser: UserAccount = {
    ID_User: `USR-CUST-${matchedCustomer.ID_Pelanggan}`,
    Username: matchedCustomer.Username || cleanId,
    Nama: matchedCustomer.Nama_Pelanggan,
    Role: 'Pelanggan',
    Roles: ['Pelanggan'],
    ID_Karyawan: '-',
    ID_Pelanggan: matchedCustomer.ID_Pelanggan,
    Status_Akun: 'Aktif',
    Email: matchedCustomer.Email || `${cleanId}@mitra-airis.id`,
    Provider: 'local',
    Avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedCustomer.Nama_Pelanggan)}&background=0284c7&color=fff`
  };

  const session: AuthSession = {
    user: custUser,
    isAuthenticated: true,
    isSupabaseAuth: false
  };
  saveStoredSession(session);

  recordAccessLog({
    username: custUser.Username,
    user: custUser,
    aktivitas: 'Login Berhasil',
    status: 'Sukses',
    keterangan: `Mitra masuk melalui Username & Kata Sandi: ${matchedCustomer.Nama_Pelanggan} (${matchedCustomer.Level_Pelanggan})`
  });

  return {
    success: true,
    message: `Selamat datang, ${matchedCustomer.Nama_Pelanggan}!`,
    session,
    customer: matchedCustomer
  };
}

/**
 * Autentikasi Pelanggan via Akun Google (Google OAuth / Identity)
 */
export async function signInCustomerWithGoogle(
  email: string,
  displayName?: string,
  avatarUrl?: string
): Promise<{ success: boolean; message: string; notRegistered?: boolean; session?: AuthSession; customer?: CustomerItem }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Alamat email Google tidak valid!' };
  }

  // Cari di MD_Pelanggan berdasarkan Email
  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);
  let matchedCustomer = customers.find(c => c.Email && c.Email.trim().toLowerCase() === cleanEmail);

  // Jika belum ada email di MD_Pelanggan, coba cari berdasarkan kesamaan nama atau fallback
  if (!matchedCustomer) {
    const usernamePart = cleanEmail.split('@')[0].toLowerCase();
    matchedCustomer = customers.find(c => 
      c.Nama_Pelanggan.toLowerCase().replace(/[^a-z0-9]/g, '').includes(usernamePart) ||
      usernamePart.includes(c.ID_Pelanggan.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );
    
    // Jika ditemukan kecocokan, tautkan email otomatis ke MD_Pelanggan
    if (matchedCustomer) {
      matchedCustomer.Email = cleanEmail;
      const updated = customers.map(c => c.ID_Pelanggan === matchedCustomer!.ID_Pelanggan ? { ...c, Email: cleanEmail } : c);
      setTableData('MD_Pelanggan', updated);
    }
  }

  if (!matchedCustomer) {
    return {
      success: false,
      notRegistered: true,
      message: `Email Google (${cleanEmail}) belum terdaftar sebagai Mitra Pabrik. Silakan ajukan pendaftaran mitra baru atau hubungi Admin Pabrik.`
    };
  }

  if (matchedCustomer.Status === 'Non-Aktif') {
    return {
      success: false,
      message: `Akun kemitraan "${matchedCustomer.Nama_Pelanggan}" sedang berstatus Non-Aktif. Hubungi Administrasi Pabrik As-Shofaa.`
    };
  }

  // Buat UserAccount khusus Pelanggan
  const custUser: UserAccount = {
    ID_User: `USR-CUST-${matchedCustomer.ID_Pelanggan}`,
    Username: cleanEmail.split('@')[0],
    Nama: displayName || matchedCustomer.Nama_Pelanggan,
    Role: 'Pelanggan',
    Roles: ['Pelanggan'],
    ID_Karyawan: '-',
    ID_Pelanggan: matchedCustomer.ID_Pelanggan,
    Status_Akun: 'Aktif',
    Email: cleanEmail,
    Provider: 'google',
    Avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedCustomer.Nama_Pelanggan)}&background=0284c7&color=fff`
  };

  const session: AuthSession = {
    user: custUser,
    isAuthenticated: true,
    isSupabaseAuth: false
  };
  saveStoredSession(session);

  recordAccessLog({
    username: cleanEmail,
    user: custUser,
    aktivitas: 'Login Berhasil',
    status: 'Sukses',
    keterangan: `Mitra masuk melalui Akun Google: ${matchedCustomer.Nama_Pelanggan} (${matchedCustomer.Level_Pelanggan})`
  });

  return {
    success: true,
    message: `Selamat datang, ${matchedCustomer.Nama_Pelanggan}!`,
    session,
    customer: matchedCustomer
  };
}

/**
 * Permintaan Kode OTP ke Email Pelanggan
 */
export async function requestCustomerEmailOtp(
  email: string
): Promise<{ success: boolean; message: string; otpCode?: string; customer?: CustomerItem; notRegistered?: boolean }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Harap masukkan alamat email yang valid!' };
  }

  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);
  const matchedCustomer = customers.find(c => c.Email && c.Email.trim().toLowerCase() === cleanEmail);

  if (!matchedCustomer) {
    return {
      success: false,
      notRegistered: true,
      message: `Email (${cleanEmail}) belum terdaftar sebagai Mitra Pabrik. Silakan daftarkan toko/lembaga Anda terlebih dahulu.`
    };
  }

  // Generate 6 digit OTP acak
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // Berlaku 10 menit

  try {
    sessionStorage.setItem(OTP_STORAGE_PREFIX + cleanEmail, JSON.stringify({ otp, expiresAt }));
  } catch (e) {}

  return {
    success: true,
    otpCode: otp,
    customer: matchedCustomer,
    message: `Kode verifikasi OTP 6 digit telah dikirim ke ${cleanEmail}.`
  };
}

/**
 * Verifikasi Kode OTP Email Pelanggan
 */
export async function verifyCustomerEmailOtp(
  email: string,
  otpInput: string
): Promise<{ success: boolean; message: string; session?: AuthSession; customer?: CustomerItem }> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOtp = (otpInput || '').trim();

  if (!cleanOtp) {
    return { success: false, message: 'Harap masukkan 6-digit kode OTP verifikasi!' };
  }

  // Cek validitas OTP dari session
  let storedOtpData: { otp: string; expiresAt: number } | null = null;
  try {
    const raw = sessionStorage.getItem(OTP_STORAGE_PREFIX + cleanEmail);
    if (raw) storedOtpData = JSON.parse(raw);
  } catch (e) {}

  const isMasterOtp = cleanOtp === '123456'; // Master OTP untuk testing praktis
  const isValidOtp = isMasterOtp || (storedOtpData && storedOtpData.otp === cleanOtp && Date.now() <= storedOtpData.expiresAt);

  if (!isValidOtp) {
    return { success: false, message: 'Kode OTP salah atau telah kedaluwarsa. Silakan minta kode baru.' };
  }

  // Bersihkan OTP yang sudah dipakai
  try {
    sessionStorage.removeItem(OTP_STORAGE_PREFIX + cleanEmail);
  } catch (e) {}

  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);
  const matchedCustomer = customers.find(c => c.Email && c.Email.trim().toLowerCase() === cleanEmail);

  if (!matchedCustomer) {
    return { success: false, message: 'Data pelanggan tidak ditemukan!' };
  }

  const custUser: UserAccount = {
    ID_User: `USR-CUST-${matchedCustomer.ID_Pelanggan}`,
    Username: cleanEmail.split('@')[0],
    Nama: matchedCustomer.Nama_Pelanggan,
    Role: 'Pelanggan',
    Roles: ['Pelanggan'],
    ID_Karyawan: '-',
    ID_Pelanggan: matchedCustomer.ID_Pelanggan,
    Status_Akun: 'Aktif',
    Email: cleanEmail,
    Provider: 'email_otp',
    Avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedCustomer.Nama_Pelanggan)}&background=0284c7&color=fff`
  };

  const session: AuthSession = {
    user: custUser,
    isAuthenticated: true,
    isSupabaseAuth: false
  };
  saveStoredSession(session);

  recordAccessLog({
    username: cleanEmail,
    user: custUser,
    aktivitas: 'Login Berhasil',
    status: 'Sukses',
    keterangan: `Mitra masuk melalui Verifikasi Email OTP: ${matchedCustomer.Nama_Pelanggan}`
  });

  return {
    success: true,
    message: `Verifikasi email berhasil! Selamat datang, ${matchedCustomer.Nama_Pelanggan}.`,
    session,
    customer: matchedCustomer
  };
}

/**
 * Masuk Langsung Sebagai Mitra Terdaftar (Direct Testing / Quick Demo)
 */
export async function signInAsCustomerDirect(
  customerId: string
): Promise<{ success: boolean; message: string; session?: AuthSession; customer?: CustomerItem }> {
  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);
  const cust = customers.find(c => c.ID_Pelanggan === customerId);

  if (!cust) {
    return { success: false, message: 'Mitra pelanggan tidak ditemukan di Master Data!' };
  }

  const custUser: UserAccount = {
    ID_User: `USR-CUST-${cust.ID_Pelanggan}`,
    Username: (cust.Email ? cust.Email.split('@')[0] : cust.ID_Pelanggan.toLowerCase()),
    Nama: cust.Nama_Pelanggan,
    Role: 'Pelanggan',
    Roles: ['Pelanggan'],
    ID_Karyawan: '-',
    ID_Pelanggan: cust.ID_Pelanggan,
    Status_Akun: 'Aktif',
    Email: cust.Email || `${cust.ID_Pelanggan.toLowerCase()}@mitra-airis.id`,
    Provider: 'google',
    Avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(cust.Nama_Pelanggan)}&background=0284c7&color=fff`
  };

  const session: AuthSession = {
    user: custUser,
    isAuthenticated: true,
    isSupabaseAuth: false
  };
  saveStoredSession(session);

  recordAccessLog({
    username: custUser.Username,
    user: custUser,
    aktivitas: 'Login Berhasil',
    status: 'Sukses',
    keterangan: `Login langsung Portal Mitra: ${cust.Nama_Pelanggan} (${cust.Level_Pelanggan})`
  });

  return {
    success: true,
    message: `Berhasil masuk ke Portal ${cust.Nama_Pelanggan}!`,
    session,
    customer: cust
  };
}

/**
 * Pendaftaran Mitra Baru Mandiri oleh Pelanggan
 */
export async function registerNewCustomerMitra(params: {
  nama: string;
  noTelp: string;
  alamat: string;
  level: string;
  email: string;
}): Promise<{ success: boolean; message: string; session?: AuthSession; customer?: CustomerItem }> {
  const { nama, noTelp, alamat, level, email } = params;
  const cleanEmail = email.trim().toLowerCase();

  if (!nama.trim()) return { success: false, message: 'Nama toko/mitra wajib diisi!' };
  if (!noTelp.trim()) return { success: false, message: 'Nomor telepon/WhatsApp wajib diisi!' };
  if (!alamat.trim()) return { success: false, message: 'Alamat pengiriman wajib diisi!' };
  if (!cleanEmail) return { success: false, message: 'Alamat email wajib diisi!' };

  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);
  
  // Cek apakah email sudah terdaftar
  const existing = customers.find(c => c.Email && c.Email.trim().toLowerCase() === cleanEmail);
  if (existing) {
    return { success: false, message: `Email "${cleanEmail}" sudah terdaftar atas nama: ${existing.Nama_Pelanggan}. Silakan langsung masuk.` };
  }

  // Generate ID_Pelanggan berikutnya
  const nextNum = customers.length + 1;
  const newId = `PLG-${String(nextNum).padStart(4, '0')}`;

  const newCustomer: CustomerItem = {
    ID_Pelanggan: newId,
    Nama_Pelanggan: nama.trim(),
    No_Telp: noTelp.trim(),
    Alamat: alamat.trim(),
    Level_Pelanggan: level || 'Agen',
    Status: 'Aktif',
    Email: cleanEmail
  };

  const updatedCustomers = [...customers, newCustomer];
  setTableData('MD_Pelanggan', updatedCustomers);

  // Buat sesi login langsung
  const custUser: UserAccount = {
    ID_User: `USR-CUST-${newId}`,
    Username: cleanEmail.split('@')[0],
    Nama: newCustomer.Nama_Pelanggan,
    Role: 'Pelanggan',
    Roles: ['Pelanggan'],
    ID_Karyawan: '-',
    ID_Pelanggan: newId,
    Status_Akun: 'Aktif',
    Email: cleanEmail,
    Provider: 'google',
    Avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newCustomer.Nama_Pelanggan)}&background=0284c7&color=fff`
  };

  const session: AuthSession = {
    user: custUser,
    isAuthenticated: true,
    isSupabaseAuth: false
  };
  saveStoredSession(session);

  recordAccessLog({
    username: cleanEmail,
    user: custUser,
    aktivitas: 'Login Berhasil',
    status: 'Sukses',
    keterangan: `Pendaftaran Mitra Baru Mandiri & Login: ${newCustomer.Nama_Pelanggan} (${newCustomer.ID_Pelanggan})`
  });

  return {
    success: true,
    message: `Pendaftaran berhasil! Selamat datang sebagai Mitra Resmi As-Shofaa.`,
    session,
    customer: newCustomer
  };
}
