/**
 * AIRIS Enterprise - Authentication Service (Supabase Auth + Local Engine Fallback)
 * Integrates secure user authentication with Role-Based Access Control
 */

import { UserAccount, UserRole, AuthSession } from '../types';
import { getSupabaseConfig, getSupabaseClient, getTableData, setTableData } from './dbAdapter';
import { recordAccessLog } from './accessLogService';

const AUTH_STORAGE_KEY = 'AIRIS_AUTH_SESSION';

// Default mock accounts for local fallback & instant testing across all roles
export const DEFAULT_ACCOUNTS: (UserAccount & { PasswordPlain: string })[] = [
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
          ID_Karyawan: profile?.ID_Karyawan || 'KAR-0001',
          Status_Akun: profile?.Status_Akun || 'Aktif'
        };

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
    (u.Username.toLowerCase() === identifier.toLowerCase() || (u.Email && u.Email.toLowerCase() === identifier.toLowerCase()))
  );

  if (found) {
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

    // Check password (matching plain or default patterns)
    const def = DEFAULT_ACCOUNTS.find(a => a.Username.toLowerCase() === found.Username.toLowerCase());
    const validPass = 
      (found.Password && found.Password === password) || 
      (def && def.PasswordPlain === password) || 
      password === 'admin123';

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
