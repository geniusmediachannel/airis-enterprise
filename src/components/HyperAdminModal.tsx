import React, { useState } from 'react';
import { 
  X, ShieldAlert, Calendar, Clock, AlertTriangle, 
  CheckCircle2, Lock, Unlock, Mail, Save, RefreshCw, 
  Sparkles, ShieldCheck, ArrowRight, Check
} from 'lucide-react';
import { LicenseStatusResult, AppLicenseSettings } from '../types';
import { 
  getAppLicenseSettings, 
  saveAppLicenseSettings, 
  quickExtendLicense, 
  checkLicenseStatus 
} from '../services/licenseService';

interface HyperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseUpdated: (newStatus: LicenseStatusResult) => void;
}

export const HyperAdminModal: React.FC<HyperAdminModalProps> = ({
  isOpen,
  onClose,
  onLicenseUpdated
}) => {
  const currentSettings = getAppLicenseSettings();
  const [expiryDate, setExpiryDate] = useState(currentSettings.expiryDate);
  const [isLockedManually, setIsLockedManually] = useState(!currentSettings.isActive);
  const [billingEmail, setBillingEmail] = useState(currentSettings.billingEmail || 'gemiusmediachannel@gmail.com');
  const [packageType, setPackageType] = useState(currentSettings.packageType || 'Lisensi Enterprise PT. Anugerah Illahi Rabbi (As-Shofaa AMDK)');
  const [lockedMessage, setLockedMessage] = useState(currentSettings.lockedMessage || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentStatus = checkLicenseStatus();

  const handleSave = () => {
    const updated: Partial<AppLicenseSettings> = {
      expiryDate,
      isActive: !isLockedManually,
      billingEmail: billingEmail.trim() || 'gemiusmediachannel@gmail.com',
      packageType: packageType.trim(),
      lockedMessage: lockedMessage.trim() || undefined
    };

    saveAppLicenseSettings(updated, 'hyperadmin');
    const newStatus = checkLicenseStatus();
    onLicenseUpdated(newStatus);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);
  };

  const handleQuickAdd = (days: number) => {
    quickExtendLicense(days);
    const fresh = getAppLicenseSettings();
    setExpiryDate(fresh.expiryDate);
    const newStatus = checkLicenseStatus();
    onLicenseUpdated(newStatus);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2000);
  };

  // Setel tanggal ke 30 Oktober 2026 (sesuai skenario contoh user)
  const handleSetSample30Oct = () => {
    const today = new Date();
    // Buat tanggal 3 hari dari sekarang untuk mendemokan sisa 3 hari secara akurat
    const demoDate = new Date();
    demoDate.setDate(today.getDate() + 3);
    const isoDate = demoDate.toISOString().split('T')[0];
    setExpiryDate(isoDate);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/50 flex flex-col max-h-[90vh] overflow-hidden animate-scaleIn font-sans">
        
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Panel Kendali Hyper Admin
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Level Tertinggi
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manajemen Masa Aktif & Kontrol Penguncian Lisensi Aplikasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status Masa Aktif Sekarang Card */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            currentStatus.isExpired 
              ? 'bg-rose-950/30 border-rose-500/40' 
              : currentStatus.isWarning 
              ? 'bg-amber-950/30 border-amber-500/40' 
              : 'bg-emerald-950/30 border-emerald-500/40'
          }`}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                Status Masa Aktif Saat Ini
              </div>
              <div className="text-base font-black text-white flex items-center gap-2">
                {currentStatus.isExpired ? (
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <Lock size={16} /> APLIKASI TERKUNCI (KEDALUWARSA)
                  </span>
                ) : currentStatus.isWarning ? (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> PERINGATAN (SISA {currentStatus.daysRemaining} HARI LAGI)
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> AKTIF & OPERASIONAL
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Berlaku hingga: <strong className="text-white">{currentStatus.expiryDateFormatted}</strong>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-800 sm:pl-4">
              <div className="text-2xl font-black font-mono text-cyan-400">
                {currentStatus.isExpired ? '0' : currentStatus.daysRemaining}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Hari Tersisa</div>
            </div>
          </div>

          {/* Form Pengaturan Masa Aktif */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-2">
                <Calendar size={14} className="text-cyan-400" />
                <span>Tanggal Masa Aktif Berakhir (Batas Aplikasi Terkunci)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="sm:col-span-8 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleSetSample30Oct}
                  className="sm:col-span-4 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 rounded-xl border border-slate-700 font-medium transition-colors cursor-pointer"
                  title="Set sisa 3 hari lagi untuk pengujian peringatan penanda masa aktif"
                >
                  ⚡ Simulasi Sisa 3 Hari
                </button>
              </div>
            </div>

            {/* Quick Add Buttons */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Pintasan Tambah Masa Aktif Instan:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(30)}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-600/20 border border-slate-700 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-300 font-bold transition-all text-center cursor-pointer"
                >
                  +30 Hari (1 Bulan)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(90)}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-600/20 border border-slate-700 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-300 font-bold transition-all text-center cursor-pointer"
                >
                  +90 Hari (3 Bulan)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(180)}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-600/20 border border-slate-700 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-300 font-bold transition-all text-center cursor-pointer"
                >
                  +180 Hari (6 Bulan)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(365)}
                  className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-600/20 border border-slate-700 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-300 font-bold transition-all text-center cursor-pointer"
                >
                  +365 Hari (1 Tahun)
                </button>
              </div>
            </div>

            {/* Saklar Kunci Manual Darurat */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  {isLockedManually ? (
                    <Lock size={14} className="text-rose-400" />
                  ) : (
                    <Unlock size={14} className="text-emerald-400" />
                  )}
                  <span>Kunci Total Akses Aplikasi Secara Manual</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Jika diaktifkan, aplikasi akan langsung terkunci seketika untuk semua pengguna kecuali Hyper Admin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLockedManually(!isLockedManually)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isLockedManually ? 'bg-rose-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isLockedManually ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Email Penagihan & Bukti Transfer */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1.5">
                <Mail size={13} className="text-cyan-400" />
                <span>Email Tujuan Pengiriman Bukti Transfer</span>
              </label>
              <input
                type="email"
                value={billingEmail}
                onChange={e => setBillingEmail(e.target.value)}
                placeholder="gemiusmediachannel@gmail.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                User yang mendapati aplikasi terkunci akan diarahkan mengirim email bukti transfer ke alamat ini.
              </p>
            </div>

            {/* Nama Paket Lisensi */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                Nama Klien &amp; Paket Lisensi
              </label>
              <input
                type="text"
                value={packageType}
                onChange={e => setPackageType(e.target.value)}
                placeholder="Contoh: Lisensi Enterprise PT. Anugerah Illahi Rabbi"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>

            {/* Pesan Kunci Kustom */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                Pesan Khusus Saat Terkunci (Opsional)
              </label>
              <input
                type="text"
                value={lockedMessage}
                onChange={e => setLockedMessage(e.target.value)}
                placeholder="Masa aktif aplikasi AIRIS Enterprise telah berakhir..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {savedSuccess && (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                <Check size={14} /> Perubahan masa aktif berhasil disimpan!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Save size={14} />
              <span>Simpan Konfigurasi Masa Aktif</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
