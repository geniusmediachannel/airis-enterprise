import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Mail, User, Key, CheckCircle2, 
  AlertCircle, LogIn, UserPlus, X, RefreshCw, Database
} from 'lucide-react';
import { UserRole, UserAccount } from '../types';
import { signIn, signUp } from '../services/supabaseAuth';
import { getSupabaseConfig } from '../services/dbAdapter';
import { showToast } from './ToastContainer';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('SuperAdmin');
  const [idKaryawan, setIdKaryawan] = useState('KAR-0001');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabaseConfig = getSupabaseConfig();

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Harap isi username/email dan kata sandi.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await signIn(username, password);
    setLoading(false);

    if (res.success && res.session?.user) {
      setSuccessMsg(res.message);
      showToast(
        'Login Berhasil!',
        `Selamat datang, ${res.session.user.Nama || res.session.user.Username}! Anda login sebagai ${res.session.user.Role}.`,
        'success',
        4000
      );
      onLoginSuccess(res.session.user);
      setTimeout(() => {
        onClose();
      }, 800);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) {
      setErrorMsg('Semua kolom wajib diisi.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await signUp(username, email, password, role, idKaryawan);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(res.message);
      setIsRegisterMode(false);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-400" />
            <h3 className="font-bold text-sm tracking-wide">
              {isRegisterMode ? 'Daftar Akun Baru Sistem' : 'Autentikasi Pengguna AIRIS'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Supabase status pill */}
          <div className={`p-2.5 rounded-lg border flex items-center justify-between ${
            supabaseConfig.isConnected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              <Database size={14} className={supabaseConfig.isConnected ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="font-semibold">
                {supabaseConfig.isConnected ? 'Supabase Auth Aktif' : 'Engine Autentikasi Lokal Aktif'}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-white/70">
              {supabaseConfig.isConnected ? 'Cloud' : 'Offline Safe'}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={15} className="text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg flex items-center gap-2 font-medium">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {!isRegisterMode ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username atau Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <User size={14} />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Contoh: admin atau email"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Sandi (Password)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Kata sandi..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <LogIn size={14} />}
                <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem AIRIS'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Username pengguna"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@airis-amdk.com"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hak Akses (Role)</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="SuperAdmin">SuperAdmin</option>
                    <option value="Admin Master">Admin Master</option>
                    <option value="Admin Produksi">Admin Produksi</option>
                    <option value="Admin Gudang">Admin Gudang</option>
                    <option value="Kasir/Finance">Kasir/Finance</option>
                    <option value="HRD">HRD</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ID Karyawan</label>
                  <input
                    type="text"
                    value={idKaryawan}
                    onChange={e => setIdKaryawan(e.target.value)}
                    placeholder="KAR-0001"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                <span>Daftarkan Pengguna Baru</span>
              </button>
            </form>
          )}

          {/* Toggle Register / Login */}
          <div className="pt-2 text-center text-slate-500">
            {isRegisterMode ? (
              <button
                type="button"
                onClick={() => setIsRegisterMode(false)}
                className="text-blue-600 font-semibold hover:underline"
              >
                Sudah punya akun? Kembali ke form login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRegisterMode(true)}
                className="text-blue-600 font-semibold hover:underline"
              >
                Belum punya akun? Daftarkan pengguna baru di sini
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
