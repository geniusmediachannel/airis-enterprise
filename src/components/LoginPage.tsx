import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, User, Eye, EyeOff, LogIn, 
  Droplets, CheckCircle2, AlertTriangle, KeyRound, 
  History, Clock, Sparkles, Building2, ChevronRight,
  Database, RefreshCw
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { signIn, DEFAULT_ACCOUNTS } from '../services/supabaseAuth';
import { ROLE_INFO } from '../services/permissionService';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
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
        setTimeout(() => {
          onLoginSuccess(res.session!.user!);
        }, 500);
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

  const handleQuickSelect = (acc: typeof DEFAULT_ACCOUNTS[0]) => {
    setUsername(acc.Username);
    setPassword(acc.PasswordPlain);
    setErrorMsg(null);
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

          {/* Right Column: Form Login & Quick Roles */}
          <div className="lg:col-span-6 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <LogIn size={20} className="text-blue-400" />
                  Masuk ke Akun Anda
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Gunakan kredensial akun terdaftar untuk mengakses modul kerja Anda.
                </p>
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

              {/* Login Form */}
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
              </form>
            </div>

            {/* Quick Demo Role Selector Pills */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <KeyRound size={12} className="text-cyan-400" />
                  Akses Cepat Pengujian Hak Akses:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">1-Klik Isi Form</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_ACCOUNTS.map(acc => {
                  const isCurrent = username.toLowerCase() === acc.Username.toLowerCase();
                  return (
                    <button
                      key={acc.ID_User}
                      type="button"
                      onClick={() => handleQuickSelect(acc)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                        isCurrent
                          ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80 hover:text-white'
                      }`}
                      title={`${acc.Role} - User: ${acc.Username} / Pass: ${acc.PasswordPlain}`}
                    >
                      <span>{acc.Username}</span>
                      <span className="text-[9px] opacity-75">({acc.Role})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

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
