import React, { useState } from 'react';
import { 
  Lock, AlertOctagon, Mail, Copy, Check, LogIn, 
  ShieldAlert, RefreshCw, KeyRound, Sparkles, ChevronRight, ExternalLink,
  Eye, EyeOff
} from 'lucide-react';
import { LicenseStatusResult, UserAccount } from '../types';
import { generateBillingMailto } from '../services/licenseService';
import { signIn } from '../services/supabaseAuth';
import { showToast } from './ToastContainer';

interface LicenseLockScreenProps {
  licenseStatus: LicenseStatusResult;
  onHyperAdminUnlock: (user: UserAccount) => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  licenseStatus,
  onHyperAdminUnlock
}) => {
  const [copied, setCopied] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showUsernameMask, setShowUsernameMask] = useState(false);
  const [showPasswordMask, setShowPasswordMask] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const mailtoLink = generateBillingMailto(
    'PT. Anugerah Illahi Rabbi (AIRIS AMDK)',
    '1 Bulan / 1 Tahun'
  );

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(licenseStatus.billingEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHyperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword) {
      setLoginError('Harap masukkan username dan kata sandi Hyper Admin.');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await signIn(adminUsername.trim(), adminPassword);
      setLoginLoading(false);

      if (res.success && res.session?.user) {
        const u = res.session.user;
        const isHyper = u.Role === 'HyperAdmin' || u.Roles?.includes('HyperAdmin');
        if (isHyper) {
          showToast(
            'Otorisasi Hyper Admin Berhasil!',
            'Kunci sistem telah dibuka. Selamat datang Hyper Admin.',
            'success',
            5000
          );
          onHyperAdminUnlock(u);
        } else {
          setLoginError('Akun ini bukan Hyper Admin. Hanya Hyper Admin yang dapat membuka sistem yang terkunci.');
        }
      } else {
        setLoginError(res.message || 'Kredensial Hyper Admin tidak valid.');
      }
    } catch {
      setLoginLoading(false);
      setLoginError('Terjadi kesalahan saat otentikasi Hyper Admin.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl text-slate-100 flex flex-col justify-between items-center p-4 sm:p-8 select-none font-sans overflow-y-auto">
      {/* Decorative Red/Orange Emergency Ambient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-rose-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <header className="relative z-10 w-full max-w-2xl flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <Lock size={18} />
          </div>
          <div>
            <div className="font-extrabold text-sm text-white tracking-wide">AIRIS ENTERPRISE • AMDK</div>
            <div className="text-[10px] text-slate-400">Sistem Lisensi & Proteksi Akses Operasional</div>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-bold flex items-center gap-1.5">
          <AlertOctagon size={13} />
          <span>Status: Terkunci</span>
        </div>
      </header>

      {/* Main Lock Card */}
      <main className="relative z-10 w-full max-w-xl my-auto py-8">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/30 text-center space-y-6">
          {/* Big Lock Icon with Pulsing Effect */}
          <div className="relative mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 p-0.5 shadow-xl shadow-rose-600/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-rose-400">
              <Lock size={36} className="text-rose-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Masa Aktif Aplikasi Telah Berakhir
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Masa aktif operasional aplikasi ini telah berakhir pada{' '}
              <span className="font-bold text-rose-400 underline decoration-rose-500/50">
                {licenseStatus.expiryDateFormatted}
              </span>
              . Seluruh akses pengguna ditangguhkan sementara demi keamanan integritas data.
            </p>
          </div>

          {/* Action Billing Guidance Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 text-left space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Mail size={15} className="text-amber-400" />
              <span>Instruksi Pembayaran & Perpanjangan Masa Aktif:</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Lakukan pembayaran perpanjangan sewa/lisensi aplikasi, kemudian kirimkan <strong>bukti transfer</strong> ke alamat email resmi pengembang aplikasi di bawah ini:
            </p>

            <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400 font-medium">Email Pengembang (Hyper Admin):</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-cyan-300 truncate">
                  {licenseStatus.billingEmail}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 font-medium"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2">
              <a
                href={mailtoLink}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Mail size={15} />
                <span>Kirim Email Bukti Transfer Sekarang</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-slate-500 py-2">
        © {new Date().getFullYear()} AIRIS AMDK Enterprise • PT. Anugerah Illahi Rabbi • Hak Cipta Dilindungi
      </footer>

      {/* Akses Khusus Hyper Admin (Tersembunyi di Bawah Pojok Kanan) */}
      <div className="fixed bottom-3 right-3 z-50">
        {!showAdminLogin ? (
          <button
            type="button"
            onClick={() => setShowAdminLogin(true)}
            className="p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/40 hover:border-cyan-500/40 text-slate-600 hover:text-cyan-400 opacity-30 hover:opacity-100 transition-all duration-300 cursor-pointer flex items-center gap-1.5 shadow-lg backdrop-blur-xs text-[11px] font-mono group"
            title="Akses Otorisasi Hyper Admin"
          >
            <KeyRound size={13} className="text-slate-500 group-hover:text-cyan-400" />
            <span className="hidden group-hover:inline text-[10px] text-slate-400">Hyper Admin</span>
          </button>
        ) : (
          <div className="w-80 sm:w-96 p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl shadow-cyan-950/80 backdrop-blur-md animate-scaleIn text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-cyan-400" />
                <span>Otorisasi Hyper Admin (Master)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminLogin(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {loginError && (
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
                {loginError}
              </div>
            )}

            <form onSubmit={handleHyperAdminLogin} className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Username / ID Otorisasi</label>
                <div className="relative">
                  <input
                    type={showUsernameMask ? 'text' : 'password'}
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-2.5 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-cyan-500 font-mono tracking-widest placeholder:tracking-normal placeholder-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUsernameMask(!showUsernameMask)}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showUsernameMask ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showUsernameMask ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Kata Sandi (Master Key)</label>
                <div className="relative">
                  <input
                    type={showPasswordMask ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-2.5 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-cyan-500 font-mono tracking-widest placeholder:tracking-normal placeholder-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordMask(!showPasswordMask)}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showPasswordMask ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPasswordMask ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loginLoading ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Memverifikasi...</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={12} />
                      <span>Buka Sistem</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
