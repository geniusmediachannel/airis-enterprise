import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Lock, User, Eye, EyeOff, LogIn, 
  Droplets, CheckCircle2, AlertTriangle, KeyRound, 
  History, Clock, Sparkles, Building2, ChevronRight,
  Database, RefreshCw, UserPlus, ArrowLeft, Check, Layers,
  Info, XCircle, Search, BadgeCheck, Mail, ShoppingBag, 
  Truck, ArrowRight, Store, Send, HelpCircle
} from 'lucide-react';
import { UserAccount, UserRole, EmployeeItem, CustomerItem } from '../types';
import { 
  signIn, registerAccount, 
  signInCustomerWithCredentials, signInCustomerWithGoogle, 
  signInAsCustomerDirect, registerNewCustomerMitra 
} from '../services/supabaseAuth';
import { AVAILABLE_DIVISIONS, ROLE_INFO } from '../services/permissionService';
import { getTableData } from '../services/dbAdapter';
import { showToast } from './ToastContainer';

interface LoginPageProps {
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Cek apakah halaman dibuka khusus sebagai Portal Pelanggan Mandiri
  const isStandalonePortal = useMemo(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      return hash.includes('portal') || hash.includes('pelanggan') || hash.includes('mitra') ||
             search.includes('portal') || search.includes('pelanggan') || search.includes('mitra') ||
             path.includes('portal');
    }
    return false;
  }, []);

  // Mode Utama: 'staff' (Manajemen & Pabrik) vs 'pelanggan' (Mitra / Pelanggan)
  const [portalType, setPortalType] = useState<'staff' | 'pelanggan'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (hash.includes('portal') || hash.includes('pelanggan') || hash.includes('mitra') ||
          search.includes('portal') || search.includes('pelanggan') || search.includes('mitra') ||
          path.includes('portal')) {
        return 'pelanggan';
      }
    }
    return 'staff';
  });

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login Form States (Staff Pabrik)
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

  // Register Form States (Karyawan Pabrik)
  const [regNama, setRegNama] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regRoles, setRegRoles] = useState<UserRole[]>(['Admin Produksi']);
  const [regAlasan, setRegAlasan] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // States Khusus Portal Pelanggan
  const [customerSubTab, setCustomerSubTab] = useState<'credentials' | 'google' | 'demo' | 'register'>('credentials');
  const [custUsernameOrEmail, setCustUsernameOrEmail] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [showCustPassword, setShowCustPassword] = useState(false);
  const [custGoogleEmail, setCustGoogleEmail] = useState('');
  const [custLoading, setCustLoading] = useState(false);

  // States Pendaftaran Mitra Baru
  const [newMitraNama, setNewMitraNama] = useState('');
  const [newMitraTelp, setNewMitraTelp] = useState('');
  const [newMitraAlamat, setNewMitraAlamat] = useState('');
  const [newMitraLevel, setNewMitraLevel] = useState('Agen');
  const [newMitraEmail, setNewMitraEmail] = useState('');
  const [newMitraUsername, setNewMitraUsername] = useState('');
  const [newMitraPassword, setNewMitraPassword] = useState('');

  // Data Karyawan & Pelanggan terdaftar
  const employees = getTableData<EmployeeItem>('MD_Karyawan', []);
  const customers = getTableData<CustomerItem>('MD_Pelanggan', []);

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

  // -------------------------------------------------------------
  // SUBMIT LOGIN STAFF PABRIK
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // SUBMIT DAFTAR AKUN KARYAWAN PABRIK
  // -------------------------------------------------------------
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
        if (prev.length === 1) return prev;
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  // -------------------------------------------------------------
  // HANDLERS PORTAL PELANGGAN / MITRA
  // -------------------------------------------------------------

  // 1. Login Pelanggan dengan Username / Email & Password
  const handleCustomerCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custUsernameOrEmail.trim() || !custPassword) {
      setErrorMsg('Harap masukkan Username/Email dan Kata Sandi Anda.');
      return;
    }

    setCustLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await signInCustomerWithCredentials(custUsernameOrEmail.trim(), custPassword);
      setCustLoading(false);

      if (res.success && res.session?.user) {
        setSuccessMsg(res.message);
        showToast('Login Berhasil!', res.message, 'success');
        setTimeout(() => {
          onLoginSuccess(res.session!.user!);
        }, 700);
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setCustLoading(false);
      setErrorMsg('Gagal memproses login pelanggan. Coba lagi.');
    }
  };

  // 2. Login Google Pelanggan
  const handleGoogleLogin = async (overrideEmail?: string) => {
    const targetEmail = overrideEmail || custGoogleEmail.trim();
    if (!targetEmail) {
      setErrorMsg('Harap masukkan alamat email Google Anda.');
      return;
    }

    setCustLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await signInCustomerWithGoogle(targetEmail);
      setCustLoading(false);

      if (res.success && res.session?.user) {
        setSuccessMsg(res.message);
        showToast('Login Google Berhasil!', res.message, 'success');
        setTimeout(() => {
          onLoginSuccess(res.session!.user!);
        }, 800);
      } else {
        setErrorMsg(res.message);
        if (res.notRegistered) {
          setNewMitraEmail(targetEmail);
          setCustomerSubTab('register');
        }
      }
    } catch {
      setCustLoading(false);
      setErrorMsg('Gagal memproses otorisasi Google. Coba lagi.');
    }
  };

  // 3. Login Langsung Cepat Mitra (1-Click Test Selector)
  const handleDirectCustomerLogin = async (customerId: string) => {
    setCustLoading(true);
    setErrorMsg(null);
    try {
      const res = await signInAsCustomerDirect(customerId);
      setCustLoading(false);
      if (res.success && res.session?.user) {
        showToast('Login Mitra Berhasil', res.message, 'success');
        onLoginSuccess(res.session.user);
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setCustLoading(false);
      setErrorMsg('Gagal memproses login cepat mitra.');
    }
  };

  // 4. Pendaftaran Mitra Baru
  const handleRegisterNewMitra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMitraNama.trim()) {
      setErrorMsg('Nama toko/mitra/lembaga wajib diisi.');
      return;
    }
    if (!newMitraTelp.trim()) {
      setErrorMsg('Nomor WhatsApp wajib diisi.');
      return;
    }
    if (!newMitraAlamat.trim()) {
      setErrorMsg('Alamat pengiriman wajib diisi.');
      return;
    }
    if (!newMitraEmail.trim()) {
      setErrorMsg('Alamat email wajib diisi.');
      return;
    }

    setCustLoading(true);
    setErrorMsg(null);

    try {
      const res = await registerNewCustomerMitra({
        nama: newMitraNama,
        noTelp: newMitraTelp,
        alamat: newMitraAlamat,
        level: newMitraLevel,
        email: newMitraEmail
      });
      setCustLoading(false);

      if (res.success && res.session?.user) {
        setSuccessMsg(res.message);
        showToast('Pendaftaran Berhasil!', res.message, 'success');
        setTimeout(() => {
          onLoginSuccess(res.session!.user!);
        }, 900);
      } else {
        setErrorMsg(res.message);
      }
    } catch {
      setCustLoading(false);
      setErrorMsg('Gagal memproses pendaftaran mitra baru.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Droplets className="text-white" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-white">
                {isStandalonePortal || portalType === 'pelanggan' 
                  ? 'Portal Pelanggan Pemesanan As-Shofaa' 
                  : 'AIRIS AMDK ENTERPRISE'}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
                {isStandalonePortal || portalType === 'pelanggan' ? 'As-Shofaa AMDK' : 'v3.5'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">PT. ANUGERAH ILLAHI RABBI</p>
          </div>
        </div>

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
                <span>
                  {portalType === 'pelanggan' ? 'Portal Pelanggan Pemesanan As-Shofaa' : 'Enterprise Manufacturing Portal'}
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {portalType === 'pelanggan' 
                    ? 'Pemesanan & Tagihan Mandiri Mitra AMDK As-Shofaa' 
                    : 'Pusat Kendali Pabrik & Distribusi AMDK'}
                </h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  {portalType === 'pelanggan'
                    ? 'Layanan pemesanan mandiri untuk Distributor, Agen, dan Sekolah Mitra As-Shofaa. Pesan produk dengan harga kontrak resmi, pantau status pengiriman armada, unduh invoice, dan pantau saldo galon 19L.'
                    : 'Sistem operasional terpadu PT. Anugerah Illahi Rabbi untuk pengawasan mutu SNI 3553:2023, manajemen SPK mesin produksi, pergudangan, logistik armada, dan pembukuan keuangan.'}
                </p>
              </div>

              {/* Highlight Features */}
              <div className="space-y-3 pt-2">
                {portalType === 'pelanggan' ? (
                  <>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/60">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                        <ShoppingBag size={16} />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-white">Self-Service Order 24 Jam</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Katalog resmi produk As-Shofaa dengan harga otomatis sesuai kontrak kemitraan Anda.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/60">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                        <Truck size={16} />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-white">Real-Time Order & Driver Tracking</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Pantau antrean pesanan, konfirmasi pabrik, hingga nama sopir yang bertugas mengantar.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800/60">
                      <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold text-white">Login Aman Username, Password & Google</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Gunakan Username & Kata Sandi resmi atau masuk langsung dengan Akun Google terdaftar.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Bottom Note */}
            <div className="pt-6 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Keamanan Standar Industri AMDK</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Server Online
              </span>
            </div>
          </div>

          {/* Right Column: Interactive Login & Auth Container */}
          <div className="lg:col-span-6 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800/80 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative">
            <div>
              
              {/* SAKLAR UTAMA: HANYA DITAMPILKAN JIKA BUKAN DIBUKA DARI LINK KHUSUS PORTAL */}
              {!isStandalonePortal && (
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('staff');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      portalType === 'staff'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Staff Pabrik</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('pelanggan');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      portalType === 'pelanggan'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles size={14} className="text-cyan-300" />
                    <span>Portal Pelanggan As-Shofaa</span>
                  </button>
                </div>
              )}

              {/* =========================================================
                  JIKA MODE: PORTAL PELANGGAN PEMESANAN AS-SHOFAA
              ========================================================= */}
              {portalType === 'pelanggan' ? (
                <div className="space-y-4">
                  {/* Header Portal Pelanggan */}
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <ShoppingBag size={20} className="text-cyan-400" />
                      <span>Portal Pelanggan Pemesanan As-Shofaa</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Silakan masuk dengan Username & Kata Sandi, atau menggunakan Akun Google terdaftar.
                    </p>
                  </div>

                  {/* Sub-Tabs Metode Login Pelanggan */}
                  <div className="flex items-center gap-1 border-b border-slate-800 pb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => { setCustomerSubTab('credentials'); setErrorMsg(null); }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        customerSubTab === 'credentials' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Username & Sandi
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCustomerSubTab('google'); setErrorMsg(null); }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        customerSubTab === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Akun Google
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCustomerSubTab('demo'); setErrorMsg(null); }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        customerSubTab === 'demo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Pilih Mitra Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCustomerSubTab('register'); setErrorMsg(null); }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        customerSubTab === 'register' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Daftar Baru
                    </button>
                  </div>

                  {/* Alert Error / Success */}
                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
                      <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1 font-medium">{errorMsg}</div>
                    </div>
                  )}

                  {successMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 font-medium">{successMsg}</div>
                    </div>
                  )}

                  {/* 1. SUB-TAB USERNAME / EMAIL & PASSWORD (UTAMA) */}
                  {customerSubTab === 'credentials' && (
                    <form onSubmit={handleCustomerCredentialLogin} className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <User size={13} className="text-cyan-400" />
                          <span>Username atau Email Pelanggan</span>
                        </label>
                        <input
                          type="text"
                          value={custUsernameOrEmail}
                          onChange={e => setCustUsernameOrEmail(e.target.value)}
                          placeholder="Ketik username atau email terdaftar"
                          disabled={custLoading}
                          className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Lock size={13} className="text-cyan-400" />
                          <span>Kata Sandi (Password)</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showCustPassword ? 'text' : 'password'}
                            value={custPassword}
                            onChange={e => setCustPassword(e.target.value)}
                            placeholder="Masukkan kata sandi portal Anda..."
                            disabled={custLoading}
                            className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-mono pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCustPassword(!showCustPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                          >
                            {showCustPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={custLoading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        {custLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Mengautentikasi Pelanggan...</span>
                          </>
                        ) : (
                          <>
                            <LogIn size={15} />
                            <span>Masuk ke Portal Pemesanan</span>
                          </>
                        )}
                      </button>

                      <div className="pt-2 text-center text-[11px] text-slate-400">
                        Belum punya kata sandi? Hubungi admin pabrik atau gunakan{' '}
                        <button
                          type="button"
                          onClick={() => setCustomerSubTab('google')}
                          className="text-cyan-400 hover:underline font-bold"
                        >
                          Login Akun Google
                        </button>
                      </div>
                    </form>
                  )}

                  {/* 2. SUB-TAB GOOGLE SIGN-IN */}
                  {customerSubTab === 'google' && (
                    <div className="space-y-4 pt-1">
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300 space-y-1">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-400" />
                          <span>Login dengan Akun Google Resmi</span>
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Sistem akan memverifikasi alamat email akun Google Anda secara langsung terhadap data kemitraan As-Shofaa.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Masukkan Email Akun Google Anda:
                        </label>
                        <input
                          type="email"
                          value={custGoogleEmail}
                          onChange={e => setCustGoogleEmail(e.target.value)}
                          placeholder="contoh: mambaulhikam@gmail.com"
                          className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                      </div>

                      {/* Tombol Resmi Masuk dengan Google */}
                      <button
                        type="button"
                        onClick={() => handleGoogleLogin()}
                        disabled={custLoading}
                        className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-3 transition shadow-lg active:scale-[0.99] cursor-pointer"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>{custLoading ? 'Memverifikasi Google...' : 'Lanjutkan dengan Akun Google'}</span>
                      </button>
                    </div>
                  )}

                  {/* 3. SUB-TAB 1-CLICK MITRA DEMO (PILIH LANGSUNG) */}
                  {customerSubTab === 'demo' && (
                    <div className="space-y-3 pt-1">
                      <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200">
                        <p className="font-bold flex items-center gap-1.5 text-blue-300">
                          <Store size={14} />
                          <span>Akses Cepat Pengujian Mitra</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Klik langsung nama mitra di bawah untuk menguji tampilan portal pelanggan:
                        </p>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {customers.map(c => (
                          <div
                            key={c.ID_Pelanggan}
                            onClick={() => handleDirectCustomerLogin(c.ID_Pelanggan)}
                            className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500 cursor-pointer transition flex items-center justify-between text-xs group"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white group-hover:text-cyan-300 transition">
                                  {c.Nama_Pelanggan}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">
                                  {c.Level_Pelanggan}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {c.Email || `${c.ID_Pelanggan.toLowerCase()}@mitra-airis.id`}
                              </p>
                            </div>
                            <ChevronRight size={16} className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. SUB-TAB PENDAFTARAN MITRA BARU */}
                  {customerSubTab === 'register' && (
                    <form onSubmit={handleRegisterNewMitra} className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200">
                        <strong>Daftarkan Toko / Pesantren / Lembaga Baru</strong>
                        <p className="text-slate-400 mt-0.5">Setelah mendaftar, Anda langsung terhubung ke sistem pabrik.</p>
                      </div>

                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Nama Toko / Mitra / Pesantren *</label>
                        <input
                          type="text"
                          required
                          value={newMitraNama}
                          onChange={e => setNewMitraNama(e.target.value)}
                          placeholder="Contoh: PP. Al-Barokah Klaten"
                          className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-300 font-semibold block mb-1">No. WhatsApp *</label>
                          <input
                            type="text"
                            required
                            value={newMitraTelp}
                            onChange={e => setNewMitraTelp(e.target.value)}
                            placeholder="08123456789"
                            className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-slate-300 font-semibold block mb-1">Level Kemitraan</label>
                          <select
                            value={newMitraLevel}
                            onChange={e => setNewMitraLevel(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                          >
                            <option value="Distributor">Distributor</option>
                            <option value="Agen">Agen</option>
                            <option value="Reseller">Reseller</option>
                            <option value="Sekolah Mitra">Sekolah Mitra</option>
                            <option value="Konsumen Biasa">Konsumen Biasa</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Email Akun Google (Login) *</label>
                        <input
                          type="email"
                          required
                          value={newMitraEmail}
                          onChange={e => setNewMitraEmail(e.target.value)}
                          placeholder="mitra@gmail.com"
                          className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-slate-300 font-semibold block mb-1">Alamat Pengiriman Lengkap *</label>
                        <textarea
                          rows={2}
                          required
                          value={newMitraAlamat}
                          onChange={e => setNewMitraAlamat(e.target.value)}
                          placeholder="Jalan, RT/RW, Desa, Kecamatan, Klaten..."
                          className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={custLoading}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg mt-2"
                      >
                        <UserPlus size={14} />
                        <span>{custLoading ? 'Mendaftarkan...' : 'Daftar & Masuk ke Portal'}</span>
                      </button>
                    </form>
                  )}

                  {/* Navigasi darurat jika staff buka link portal */}
                  {isStandalonePortal && (
                    <div className="pt-3 text-center border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPortalType('staff')}
                        className="text-[11px] text-slate-500 hover:text-slate-300 transition"
                      >
                        Login sebagai Staff Internal Pabrik →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* =========================================================
                    JIKA MODE: STAFF PABRIK (INTERNAL)
                ========================================================= */
                <>
                  {/* Tab Selector: Masuk vs Daftar Karyawan */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-5">
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

                  {/* TAMPILAN FORM LOGIN STAFF */}
                  {authMode === 'login' && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Username or Email Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <User size={13} className="text-blue-400" />
                          <span>Username atau Email Terdaftar</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Ketik username (misal: admin, hyperadmin)"
                            disabled={loading || lockoutTimer > 0}
                            autoComplete="username"
                            className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-medium"
                          />
                        </div>
                      </div>

                      {/* Password Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Lock size={13} className="text-blue-400" />
                          <span>Kata Sandi (Password)</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Masukkan kata sandi..."
                            disabled={loading || lockoutTimer > 0}
                            autoComplete="current-password"
                            className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                            title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Remember Me & Help */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500/30"
                          />
                          <span>Ingat saya di perangkat ini</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Lisensi Enterprise v3.5</span>
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={loading || lockoutTimer > 0}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        {loading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Mengautentikasi...</span>
                          </>
                        ) : lockoutTimer > 0 ? (
                          <span>Terkunci ({lockoutTimer}s)</span>
                        ) : (
                          <>
                            <LogIn size={15} />
                            <span>Masuk ke Dashboard Sistem</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* TAMPILAN FORM PENDAFTARAN AKUN KARYAWAN */}
                  {authMode === 'register' && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
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

                        <input
                          type="text"
                          value={regNama}
                          onChange={e => setRegNama(e.target.value)}
                          placeholder="Ketik nama lengkap sesuai data HRD (contoh: Budi Santoso)"
                          disabled={regLoading}
                          className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                      </div>

                      {/* Username Login Baru */}
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">Username Login Baru *</label>
                        <input
                          type="text"
                          value={regUsername}
                          onChange={e => setRegUsername(e.target.value)}
                          placeholder="Ketik username baru (huruf kecil & angka)"
                          className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white font-mono outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>

                      {/* Password Baru & Konfirmasi */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1">Kata Sandi *</label>
                          <input
                            type="password"
                            value={regPassword}
                            onChange={e => setRegPassword(e.target.value)}
                            placeholder="Minimal 4 karakter"
                            className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white font-mono outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1">Konfirmasi Sandi *</label>
                          <input
                            type="password"
                            value={regConfirmPassword}
                            onChange={e => setRegConfirmPassword(e.target.value)}
                            placeholder="Ulangi kata sandi"
                            className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white font-mono outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                        </div>
                      </div>

                      {/* Pilihan Divisi Rangkap */}
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Pilih Divisi Penugasan (Bisa Rangkap) *
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                          {AVAILABLE_DIVISIONS.map(div => {
                            const isSelected = regRoles.includes(div.role);
                            return (
                              <button
                                key={div.role}
                                type="button"
                                onClick={() => toggleRoleSelection(div.role)}
                                className={`p-2 rounded-xl border text-left text-xs transition flex items-start gap-2 ${
                                  isSelected
                                    ? 'bg-blue-600/20 border-cyan-500/80 text-white'
                                    : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                                  isSelected ? 'bg-cyan-500 text-slate-950 font-bold' : 'border-slate-600 bg-slate-900'
                                }`}>
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span className="font-bold text-[11px] leading-tight">{div.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={regLoading || !verifiedEmployee}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg mt-2 disabled:opacity-50"
                      >
                        {regLoading ? 'Mengajukan...' : 'Ajukan Pendaftaran Akun Karyawan'}
                      </button>
                    </form>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Pop-up Overlay Visual Notifikasi Login Berhasil */}
      {successMsg && authMode === 'login' && portalType === 'staff' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl shadow-emerald-950/60 animate-scaleIn">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={36} className="text-emerald-400 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">Login Berhasil!</h3>
              <p className="text-xs text-slate-300">{successMsg}</p>
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
          <span>Portal Pelanggan As-Shofaa AMDK</span>
          <span>•</span>
          <span>ISO 9001 & SNI 3553:2023 Compliant</span>
        </div>
      </footer>
    </div>
  );
};
