import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Lock, User, Eye, EyeOff, LogIn, 
  Droplets, CheckCircle2, AlertTriangle, KeyRound, 
  History, Clock, Sparkles, Building2, ChevronRight,
  Database, RefreshCw, UserPlus, ArrowLeft, Check, Layers,
  Info, XCircle, Search, BadgeCheck
} from 'lucide-react';
import { UserAccount, UserRole, EmployeeItem } from '../types';
import { signIn, registerAccount } from '../services/supabaseAuth';
import { AVAILABLE_DIVISIONS, ROLE_INFO } from '../services/permissionService';
import { getTableData } from '../services/dbAdapter';
import { showToast } from './ToastContainer';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('id-ID'));

  // Register Form States (Mendukung Multi-Divisi Rangkap)
  const [regNama, setRegNama] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regRoles, setRegRoles] = useState<UserRole[]>(['Admin Produksi']);
  const [regAlasan, setRegAlasan] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Daftar Karyawan terdaftar untuk verifikasi otomatis
  const employees = getTableData<EmployeeItem>('MD_Karyawan', []);

  // Verifikasi real-time nama karyawan terhadap database MD_Karyawan
  const verifiedEmployee = useMemo(() => {
    const q = regNama.trim().toLowerCase();
    if (!q) return null;
    return employees.find(
      emp => emp.Nama_Karyawan.trim().toLowerCase() === q
    ) || null;
  }, [regNama, employees]);

  // Saran nama karyawan jika belum cocok persis tetapi mengandung kata kunci
  const suggestedEmployees = useMemo(() => {
    const q = regNama.trim().toLowerCase();
    if (!q || q.length < 2 || verifiedEmployee) return [];
    return employees
      .filter(emp => emp.Nama_Karyawan.toLowerCase().includes(q))
      .slice(0, 4);
  }, [regNama, employees, verifiedEmployee]);

  // Live real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer for brute-force defense lockout
  useEffect(() => {
    if (lockoutTimer > 0) {
      const interval = setInterval(() => {
        setLockoutTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutTimer > 0) {
      setErrorMsg(`Sistem sementara terkunci demi keamanan. Silakan tunggu ${lockoutTimer} detik.`);
      return;
    }

    if (!username.trim() || !password) {
      setErrorMsg('Harap masukkan username/email dan kata sandi Anda.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await signIn(username.trim(), password);
      setLoading(false);

      if (res.success && res.session?.user) {
        setSuccessMsg(res.message);
        setFailedAttempts(0);
        const loggedUser = res.session.user;
        showToast(
          'Login Berhasil!',
          `Selamat datang, ${loggedUser.Nama || loggedUser.Username}! Akses modul sebagai ${loggedUser.Role} aktif.`,
          'success',
          5000
        );
        setTimeout(() => {
          onLoginSuccess(loggedUser);
        }, 800);
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        setErrorMsg(res.message || 'Login gagal.');

        if (nextAttempts >= 5) {
          setLockoutTimer(30);
          setErrorMsg('Terlalu banyak percobaan gagal. Akses dibekukan sementara selama 30 detik.');
        }
      }
    } catch {
      setLoading(false);
      setErrorMsg('Terjadi kendala saat memproses login. Coba lagi.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regNama.trim()) {
      setErrorMsg('Nama lengkap karyawan wajib diisi sesuai database.');
      return;
    }
    if (!verifiedEmployee) {
      setErrorMsg('Nama karyawan belum terverifikasi di database. Pastikan nama lengkap Anda telah terdaftar di Master Karyawan.');
      return;
    }
    if (verifiedEmployee.Status && verifiedEmployee.Status !== 'Aktif') {
      setErrorMsg(`Status karyawan ini adalah "${verifiedEmployee.Status}". Hanya karyawan aktif yang dapat mendaftarkan akun.`);
      return;
    }
    if (!regUsername.trim()) {
      setErrorMsg('Username login wajib diisi.');
      return;
    }
    if (regPassword.length < 4) {
      setErrorMsg('Kata sandi minimal 4 karakter demi keamanan.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok. Harap periksa kembali.');
      return;
    }
    if (regRoles.length === 0) {
      setErrorMsg('Pilih minimal satu divisi wewenang pengerjaan.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await registerAccount({
        username: regUsername.trim(),
        nama: verifiedEmployee.Nama_Karyawan,
        email: regEmail.trim(),
        password: regPassword,
        idKaryawan: verifiedEmployee.ID_Karyawan,
        roles: regRoles,
        alasan: regAlasan.trim()
      });
      setRegLoading(false);

      if (res.success) {
        setSuccessMsg(res.message);
        setUsername(regUsername.trim());
        setPassword('');
        setRegNama('');
        setRegUsername('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
        setRegAlasan('');
        // Alihkan kembali ke form login
        setTimeout(() => {
          setAuthMode('login');
        }, 2200);
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setRegLoading(false);
      setErrorMsg('Gagal memproses pendaftaran akun. Silakan coba kembali.');
    }
  };

  const toggleRoleSelection = (role: UserRole) => {
    setRegRoles(prev => {
      if (prev.includes(role)) {
        if (prev.length === 1) return prev; // Pertahankan minimal 1 role
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 font-black text-xl">
            <Droplets size={22} className="text-white drop-shadow" />
          </div>
          <div>
            <div className="font-extrabold text-white text-base tracking-tight flex items-center gap-1.5">
              AIRIS ENTERPRISE
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-cyan-400 border border-cyan-500/30">
                AMDK As-Shofaa
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium">PT. Anugerah Illahi Rabbi • Klaten</div>
          </div>
        </div>

        {/* Security & Live Clock Badge */}
        <div className="hidden sm:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="font-mono text-emerald-400 font-bold">TLS 256-Bit Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 font-mono bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock size={14} className="text-blue-400" />
            <span>{currentTime} WIB</span>
          </div>
        </div>
      </header>

      {/* Center Main Login Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: Factory Information & Security Features */}
          <div className="lg:col-span-6 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-blue-950/40 backdrop-blur-xl rounded-2xl border border-slate-800/80 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                <Sparkles size={13} className="text-cyan-400" />
                <span>Enterprise Manufacturing Portal</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  Pusat Kendali Pabrik & Distribusi AMDK
                </h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  Sistem operasional terpadu PT. Anugerah Illahi Rabbi untuk pengawasan mutu SNI 3553:2023, 
                  manajemen SPK mesin produksi, pergudangan, logistik armada, dan pembukuan keuangan.
                </p>
              </div>

              {/* Highlight Features */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/60">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">Multi-Tier Role-Based Security</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Setiap pengguna hanya dapat membuka menu dan fitur yang telah diotorisasi sesuai divisi tugasnya.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/60">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                    <History size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">Audit Trail & Histori Akses 90 Hari</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Pencatatan aktivitas login, logout, dan otorisasi dengan kebijakan auto-reset setiap 3 bulan.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/60">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                    <Database size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">Dual Storage Engine</h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Sinkronisasi otomatis basis data Cloud Supabase dan Indexed Persistence lokal offline.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Note */}
            <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Keamanan Standar Industri AMDK</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Server Normal
              </span>
            </div>
          </div>

          {/* Right Column: Form Login & Pendaftaran Akun Baru */}
          <div className="lg:col-span-6 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              {/* Tab Switcher: Masuk vs Daftar Akun */}
              <div className="flex p-1 bg-slate-950/60 rounded-xl border border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn size={14} />
                  <span>Masuk Akun</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus size={14} />
                  <span>Daftar Akun Baru</span>
                </button>
              </div>

              {/* Header Title Sesuai Tab */}
              <div className="mb-5">
                {authMode === 'login' ? (
                  <>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <LogIn size={20} className="text-blue-400" />
                      Masuk ke Akun Anda
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Gunakan kredensial akun terdaftar untuk mengakses modul kerja Anda.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <UserPlus size={20} className="text-cyan-400" />
                      Pendaftaran Akun Karyawan
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Daftarkan akun dan tentukan divisi wewenang tugas (dapat merangkap beberapa divisi).
                    </p>
                  </>
                )}
              </div>

              {/* Alert Feedback Messages */}
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in duration-200">
                  <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMsg}</div>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300 animate-in fade-in duration-200">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{successMsg}</div>
                </div>
              )}

              {/* TAMPILAN FORM LOGIN */}
              {authMode === 'login' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Username / Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Username atau Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <User size={15} />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Contoh: admin atau nama@airis-amdk.com"
                        disabled={loading || lockoutTimer > 0}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Kata Sandi
                      </label>
                      <span className="text-[10px] text-slate-400 hover:text-slate-300 cursor-pointer">
                        Lupa sandi? Hubungi SuperAdmin
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Lock size={15} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi akun"
                        disabled={loading || lockoutTimer > 0}
                        className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Ingat sesi di perangkat ini</span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || lockoutTimer > 0}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Memverifikasi Kredensial...</span>
                      </>
                    ) : lockoutTimer > 0 ? (
                      <span>Terkunci ({lockoutTimer}s)</span>
                    ) : (
                      <>
                        <LogIn size={15} />
                        <span>Masuk ke Sistem AIRIS</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-slate-400 hover:text-cyan-400 font-medium transition-colors cursor-pointer"
                    >
                      Belum memiliki akun? <span className="text-cyan-400 font-bold underline">Daftarkan Akun Karyawan</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAMPILAN FORM PENDAFTARAN AKUN BARU */}
              {authMode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
                  {/* Nama Lengkap & Verifikasi Database Real-Time (Tanpa Tab Dropdown ID Karyawan) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <User size={13} className="text-cyan-400" />
                        <span>Nama Lengkap Karyawan *</span>
                      </label>
                      {verifiedEmployee ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          Terverifikasi di Database
                        </span>
                      ) : regNama.trim().length >= 3 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                          <XCircle size={12} className="text-rose-400" />
                          Nama Belum Terdaftar
                        </span>
                      ) : null}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={regNama}
                        onChange={e => setRegNama(e.target.value)}
                        placeholder="Ketik nama lengkap sesuai data HRD (contoh: Budi Santoso)"
                        disabled={regLoading}
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all font-medium ${
                          verifiedEmployee
                            ? 'bg-emerald-950/20 border border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/50'
                            : regNama.trim().length >= 3
                            ? 'bg-rose-950/20 border border-rose-500/70 focus:ring-2 focus:ring-rose-500/50'
                            : 'bg-slate-800/80 border border-slate-700/80 focus:ring-2 focus:ring-cyan-500'
                        }`}
                      />
                    </div>

                    {/* Kartu Status Verifikasi Sukses */}
                    {verifiedEmployee && (
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-200 animate-fadeIn">
                        <BadgeCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        <div className="flex-1 text-[11px] space-y-0.5">
                          <div className="font-bold text-white text-xs flex items-center justify-between">
                            <span>{verifiedEmployee.Nama_Karyawan}</span>
                            <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                              {verifiedEmployee.ID_Karyawan}
                            </span>
                          </div>
                          <div className="text-slate-300">
                            Departemen: <strong className="text-emerald-300">{verifiedEmployee.Departemen || '-'}</strong> • Jabatan: <strong className="text-emerald-300">{verifiedEmployee.Jabatan || '-'}</strong>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Status Karyawan: <span className="text-emerald-400 font-bold">{verifiedEmployee.Status || 'Aktif'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Informasi jika nama belum ditemukan di database */}
                    {!verifiedEmployee && regNama.trim().length >= 3 && (
                      <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-[11px] space-y-1.5 animate-fadeIn">
                        <div className="flex items-center gap-1.5 font-bold text-rose-300">
                          <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                          <span>Nama tidak ditemukan di Master Karyawan</span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-relaxed">
                          Sistem memverifikasi nama Anda ke database secara langsung. Pastikan ejaan nama lengkap Anda sudah sesuai dengan yang didaftarkan oleh Divisi HRD.
                        </p>
                        {suggestedEmployees.length > 0 && (
                          <div className="pt-1 border-t border-rose-500/20">
                            <span className="text-[10px] text-slate-400 block mb-1">Mungkin maksud Anda:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestedEmployees.map(s => (
                                <button
                                  key={s.ID_Karyawan}
                                  type="button"
                                  onClick={() => setRegNama(s.Nama_Karyawan)}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-colors cursor-pointer"
                                >
                                  {s.Nama_Karyawan} ({s.Departemen})
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!verifiedEmployee && regNama.trim().length < 3 && (
                      <p className="text-[10px] text-slate-500 italic">
                        Ketik nama lengkap sesuai data karyawan yang terdaftar di PT. Anugerah Illahi Rabbi untuk verifikasi otomatis.
                      </p>
                    )}
                  </div>

                  {/* Username Login & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Username Login *
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        placeholder="hurufkecil/angka, contoh: budi"
                        disabled={regLoading}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Email atau WhatsApp (Opsional)
                      </label>
                      <input
                        type="text"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="budi@gmail.com / 08123xxx"
                        disabled={regLoading}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Kata Sandi & Konfirmasi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Kata Sandi *
                      </label>
                      <div className="relative">
                        <input
                          type={regShowPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Minimal 4 karakter"
                          disabled={regLoading}
                          className="w-full px-3 pr-8 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setRegShowPassword(!regShowPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                        >
                          {regShowPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Ulangi Kata Sandi *
                      </label>
                      <input
                        type={regShowPassword ? 'text' : 'password'}
                        value={regConfirmPassword}
                        onChange={e => setRegConfirmPassword(e.target.value)}
                        placeholder="Ketik ulang kata sandi"
                        disabled={regLoading}
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Pilihan Multi-Divisi (Merangkap Beberapa Divisi) */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Layers size={14} className="text-cyan-400" />
                        <span>Divisi Tugas (Bisa Merangkap Beberapa Divisi) *</span>
                      </label>
                      <span className="text-[10px] font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
                        {regRoles.length} Divisi Terpilih
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Centang satu atau beberapa divisi yang menjadi tanggung jawab Anda:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_DIVISIONS.map(div => {
                        const isSelected = regRoles.includes(div.role);
                        return (
                          <div
                            key={div.role}
                            onClick={() => toggleRoleSelection(div.role)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                              isSelected
                                ? 'bg-blue-600/20 border-cyan-500/80 text-white shadow-xs'
                                : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-all ${
                              isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold' : 'border-slate-600 bg-slate-900'
                            }`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold leading-tight">{div.label}</div>
                              <div className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-1">{div.description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Alasan / Catatan Penugasan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Catatan Penugasan / Alasan Pendaftaran (Opsional)
                    </label>
                    <input
                      type="text"
                      value={regAlasan}
                      onChange={e => setRegAlasan(e.target.value)}
                      placeholder="Contoh: Operator produksi merangkap staf HRD presensi"
                      disabled={regLoading}
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                    />
                  </div>

                  {/* Banner Informasi Persetujuan SuperAdmin */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-200">
                    <Info size={15} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Wajib Persetujuan SuperAdmin:</strong> Akun baru yang didaftarkan akan berstatus <em>Menunggu Persetujuan</em> dan baru dapat digunakan untuk login setelah disetujui oleh SuperAdmin.
                    </p>
                  </div>

                  {/* Submit Button Registrasi */}
                  <button
                    type="submit"
                    disabled={regLoading || !verifiedEmployee}
                    className={`w-full py-2.5 px-4 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2 ${
                      verifiedEmployee
                        ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-[0.99] shadow-cyan-600/30 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {regLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Mengirimkan Permohonan Akun...</span>
                      </>
                    ) : !verifiedEmployee ? (
                      <>
                        <XCircle size={15} />
                        <span>Karyawan Belum Terverifikasi</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={15} />
                        <span>Ajukan Pendaftaran Akun ({verifiedEmployee.Nama_Karyawan})</span>
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white font-medium flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={13} />
                      <span>Sudah punya akun? Kembali ke halaman masuk</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Pop-up Overlay Visual Notifikasi Login Berhasil */}
      {successMsg && authMode === 'login' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl shadow-emerald-950/60 animate-scaleIn">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={36} className="text-emerald-400 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">Login Berhasil!</h3>
              <p className="text-xs text-slate-300">
                {successMsg}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-400 font-semibold pt-1">
              <RefreshCw size={13} className="animate-spin text-emerald-400" />
              <span>Mengalihkan ke sistem AIRIS...</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 px-6 py-3 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <div>
          © {new Date().getFullYear()} PT. Anugerah Illahi Rabbi • Hak Cipta Dilindungi Undang-Undang.
        </div>
        <div className="flex items-center gap-4">
          <span>AIRIS AMDK Enterprise v3.5</span>
          <span>•</span>
          <span>ISO 9001 & SNI 3553:2023 Compliant</span>
        </div>
      </footer>
    </div>
  );
};
