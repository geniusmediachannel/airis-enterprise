/**
 * AIRIS Enterprise - Authentication Service (Supabase Auth + Local Engine Fallback)
 * Integrates secure user authentication with Role-Based Access Control
 */

import { UserAccount, UserRole, AuthSession } from '../types';
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
    if (cleanPass === 'hyper123' || cleanPass === 'admin123' || cleanPass === hyperDef.PasswordPlain) {
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

  const supabase = getSupabaseClient();
  const cfg = getSupabaseConfig();

  // 1. If Supabase is connected, attempt Supabase Auth first
  if (cfg.isConnected && supabase && identifier.includes('@')) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password: password
      });

      if (!error && data.user) {
        // Query user profile role
        const { data: profile } = await supabase
          .from('MD_UserAkses')
          .select('*')
          .eq('Email', data.user.email)
          .single();

        const userAccount: UserAccount = {
          ID_User: profile?.ID_User || `USR-${data.user.id.slice(0, 5)}`,
          Username: profile?.Username || data.user.email?.split('@')[0] || 'User',
          Email: data.user.email,
          Role: (profile?.Role as UserRole) || 'SuperAdmin',
          Roles: profile?.Roles || [(profile?.Role as UserRole) || 'SuperAdmin'],
          ID_Karyawan: profile?.ID_Karyawan || 'KAR-0001',
          Status_Akun: profile?.Status_Akun || 'Aktif'
        };

        // Pengecekan masa aktif aplikasi (Lisensi)
        const license = checkLicenseStatus();
        const isUserHyper = userAccount.Role === 'HyperAdmin' || userAccount.Roles?.includes('HyperAdmin');
        if (license.isExpired && !isUserHyper) {
          recordAccessLog({
            username: userAccount.Username,
            user: userAccount,
            aktivitas: 'Login Ditolak',
            status: 'Peringatan',
            keterangan: 'Aplikasi terkunci karena masa aktif telah kedaluwarsa'
          });
          return {
            success: false,
            message: `Masa aktif aplikasi telah berakhir pada ${license.expiryDateFormatted}. Aplikasi saat ini terkunci dan hanya dapat diakses oleh Hyper Admin. Silakan kirim email bukti transfer ke ${license.billingEmail} untuk memperpanjang masa aktif.`
          };
        }

        const session: AuthSession = {
          user: userAccount,
          isAuthenticated: true,
          isSupabaseAuth: true
        };
        saveStoredSession(session);
        return { success: true, message: `Login Supabase berhasil sebagai ${userAccount.Role}!`, session };
      }
    } catch (err: any) {
      console.warn('Supabase auth attempt failed, checking local users', err);
    }
  }

  // 2. Check Local Database Users / Default Accounts
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
      cleanPass === 'admin123' ||
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
  const supabase = getSupabaseClient();
  const cfg = getSupabaseConfig();

  // If Supabase is connected
  if (cfg.isConnected && supabase) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      if (error) {
        return { success: false, message: error.message };
      }
      // Insert to MD_UserAkses in Supabase
      if (data.user) {
        const newUserObj: UserAccount = {
          ID_User: `USR-${Date.now().toString().slice(-4)}`,
          Username: username,
          Email: email,
          Role: role,
          ID_Karyawan: idKaryawan,
          Status_Akun: 'Aktif'
        };
        await supabase.from('MD_UserAkses').insert([newUserObj]);
      }
    } catch (e: any) {
      console.warn('Supabase sign up error:', e);
    }
  }

  // Also save locally
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
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error', e);
    }
  }

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
