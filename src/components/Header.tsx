import React, { useState } from 'react';
import { 
  Bell, Database, Upload, 
  Menu, User, Droplets, ChevronDown, ShieldCheck, X, FileSpreadsheet,
  LogIn, LogOut, KeyRound, Settings, History, Eye, Lock,
  AlertTriangle, Clock, ShieldAlert, Mail, ExternalLink,
  Check, Minus
} from 'lucide-react';
import { SupabaseConfig, UserAccount } from '../types';
import { canEditModule, getAuthorizedRolesForModule, isHyperAdmin } from '../services/permissionService';
import { checkLicenseStatus, generateBillingMailto } from '../services/licenseService';

interface HeaderProps {
  currentView: string;
  supabaseConfig: SupabaseConfig;
  onOpenSupabaseModal: () => void;
  onOpenExcelModal?: () => void;
  onOpenAuthModal: () => void;
  onToggleNotificationDrawer: () => void;
  unreadCount: number;
  pushPermission: NotificationPermission;
  onRequestPush: () => void;
  currentUser: UserAccount;
  onToggleMobileSidebar: () => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  onNavigateToAccessLog?: () => void;
  onOpenHyperAdminModal?: () => void;
  onOpenTransferModal?: () => void;
}

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Monitoring Eksekutif & Diagram Garis' },
  master_data: { title: 'Master Data', subtitle: 'Katalog Produk, Mitra, BOM & Karyawan' },
  master: { title: 'Master Data', subtitle: 'Katalog Produk, Mitra, BOM & Karyawan' },
  produksi: { title: 'Produksi & SPK', subtitle: 'Surat Perintah Kerja, Realisasi & Laporan' },
  production: { title: 'Produksi & SPK', subtitle: 'Surat Perintah Kerja, Realisasi & Laporan' },
  distribusi: { title: 'Distribusi & Logistik', subtitle: 'List Pesanan, Surat Jalan & Invoice' },
  distribution: { title: 'Distribusi & Logistik', subtitle: 'List Pesanan, Surat Jalan & Invoice' },
  stock: { title: 'Stok & Gudang', subtitle: 'Bahan Baku, Produk Jadi & Rekapitulasi' },
  stok: { title: 'Stok & Gudang', subtitle: 'Bahan Baku, Produk Jadi & Rekapitulasi' },
  qc: { title: 'Quality Control', subtitle: 'Uji Mutu 3 Siklus Standar SNI 3553:2023' },
  keuangan: { title: 'Keuangan & Neraca', subtitle: 'Jurnal Umum, Laba Rugi & Neraca Saldo' },
  finance: { title: 'Keuangan & Neraca', subtitle: 'Jurnal Umum, Laba Rugi & Neraca Saldo' },
  hrd: { title: 'HRD & Penggajian', subtitle: 'Tabel Presensi, Jam Lembur & Slip Payroll' },
  administrasi: { title: 'Administrasi & Persuratan', subtitle: 'Surat Eksternal, Internal & Purchase Order' },
  admin: { title: 'Administrasi & Persuratan', subtitle: 'Surat Eksternal, Internal & Purchase Order' },
  log_akses: { title: 'Histori Akses Pengguna', subtitle: 'Audit Trail Login, Keamanan & Retensi 90 Hari' },
  access_log: { title: 'Histori Akses Pengguna', subtitle: 'Audit Trail Login, Keamanan & Retensi 90 Hari' }
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  supabaseConfig,
  onOpenSupabaseModal,
  onOpenExcelModal,
  onOpenAuthModal,
  onToggleNotificationDrawer,
  unreadCount,
  pushPermission,
  onRequestPush,
  currentUser,
  onToggleMobileSidebar,
  onLogout,
  onOpenSettings,
  onNavigateToAccessLog,
  onOpenHyperAdminModal,
  onOpenTransferModal
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const viewInfo = VIEW_TITLES[currentView] || { title: 'Enterprise', subtitle: 'PT. Anugerah Illahi Rabbi' };
  const isWritable = canEditModule(currentUser, currentView);
  const authorizedRole = getAuthorizedRolesForModule(currentView);
  const license = checkLicenseStatus();
  const isUserHyper = isHyperAdmin(currentUser);

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-xs flex items-center justify-between gap-2 sm:gap-4 transition-all">
      {/* Sisi Kiri: Tombol Hamburger Mobile + Brand & Active View Title */}
      <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors shrink-0 cursor-pointer"
          title="Buka Menu Navigasi"
          aria-label="Buka Menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-cyan-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0 ring-1 ring-blue-600/20">
            <Droplets size={19} className="text-cyan-100" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 leading-tight flex-wrap">
              <span className="font-extrabold text-blue-900 text-xs sm:text-sm tracking-tight">AIRIS</span>
              <span className="text-slate-300 font-light">/</span>
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {viewInfo.title}
              </h1>

              {/* Indikator Kecil Wewenang Pengerjaan (Centang Hijau) vs Mode Lihat (Strip Abu-Abu) */}
              {currentView !== 'dashboard' && (
                isWritable ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs shrink-0"
                    title={`Wewenang Pengerjaan Aktif (${currentUser?.Role}): Anda dapat menambah, mengubah, dan mengelola data modul ini.`}
                  >
                    <Check size={11} strokeWidth={3} className="text-emerald-600" />
                    <span>Wewenang</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300/80 shadow-2xs shrink-0"
                    title={`Mode Lihat Saja: Anda hanya dapat memantau data. Input & edit dikhususkan untuk ${authorizedRole}.`}
                  >
                    <Minus size={11} strokeWidth={2.5} className="text-slate-400" />
                    <span>Lihat</span>
                  </span>
                )
              )}
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 font-medium truncate leading-none mt-0.5">
              {viewInfo.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Sisi Kanan: Penanda Masa Aktif, Hyper Admin Pill, Notifikasi & Profil */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Penanda Masa Aktif Aplikasi (Sisa <= 7 Hari / Warning) */}
        {license.isWarning && !license.isExpired && (
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs shadow-2xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-semibold text-[11px]">
              Masa aktif aplikasi <strong className="text-amber-800 font-extrabold underline">sisa {license.daysRemaining} hari lagi</strong> ({license.expiryDateFormatted}).
            </span>
            <button
              type="button"
              onClick={onOpenTransferModal}
              className="ml-0.5 px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] inline-flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
              title={`Kirim bukti transfer pembayaran lisensi ke ${license.billingEmail}`}
            >
              <Mail size={11} />
              <span>Kirim Bukti Transfer</span>
            </button>
          </div>
        )}

        {/* Tombol Panel Hyper Admin (Khusus Pengguna HyperAdmin) */}
        {isUserHyper && onOpenHyperAdminModal && (
          <button
            type="button"
            onClick={onOpenHyperAdminModal}
            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-slate-900 to-cyan-950 text-cyan-300 border border-cyan-500/40 text-xs font-bold shadow-xs hover:border-cyan-400 flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            title="Kelola Masa Aktif & Lisensi Aplikasi (Hyper Admin)"
          >
            <ShieldAlert size={14} className="text-cyan-400" />
            <span className="hidden sm:inline">Masa Aktif Aplikasi</span>
            <span className="text-[10px] bg-cyan-500/20 px-1 rounded text-cyan-200 font-mono">
              {license.daysRemaining}h
            </span>
          </button>
        )}

        {/* Tombol Status Sinkronisasi Supabase Cloud */}
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
            supabaseConfig.isConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 animate-pulse'
          }`}
          title={supabaseConfig.isConnected ? 'Supabase Cloud Terhubung (Klik untuk melihat status & sinkronisasi multi-device)' : 'Supabase Cloud Belum Terhubung (Klik untuk konfigurasi)'}
        >
          <Database size={14} className={supabaseConfig.isConnected ? 'text-emerald-600' : 'text-amber-600'} />
          <span className="hidden md:inline">
            {supabaseConfig.isConnected ? 'Cloud Aktif' : 'Cloud Offline'}
          </span>
          <span className={`w-2 h-2 rounded-full ${supabaseConfig.isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        </button>

        {/* Notification Bell dengan Badge Counter & Pulse */}
        <button
          onClick={onToggleNotificationDrawer}
          className={`relative p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
            unreadCount > 0
              ? 'text-blue-700 bg-blue-50/80 hover:bg-blue-100 ring-1 ring-blue-300/60 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title={unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca (Klik untuk buka)` : 'Pusat Notifikasi & Log Aktivitas'}
          aria-label="Pusat Notifikasi"
        >
          <Bell size={19} className={unreadCount > 0 ? 'animate-bounce-subtle' : ''} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black text-white bg-rose-600 rounded-full ring-2 ring-white shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Separator */}
        <div className="h-5 w-px bg-slate-200 hidden xs:block" />

        {/* Profil Pengguna & Dropdown Autentikasi */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-100 transition-colors text-left cursor-pointer"
            title="Menu Akun & Autentikasi"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-blue-200">
              <User size={15} />
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">{currentUser.Nama || currentUser.Username}</div>
              <div className="text-[10px] text-blue-600 font-semibold leading-tight truncate max-w-[120px]">
                {currentUser.Roles && currentUser.Roles.length > 1 ? currentUser.Roles.join(' & ') : currentUser.Role}
              </div>
            </div>
            <ChevronDown size={12} className="text-slate-400 hidden lg:block" />
          </button>

          {/* User Profile Popover Modal */}
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs animation-fade-in">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
                  <div className="font-bold text-slate-900 text-sm">{currentUser.Nama || currentUser.Username}</div>
                  <div className="text-[11px] text-blue-600 font-semibold">
                    {currentUser.Roles && currentUser.Roles.length > 1 ? currentUser.Roles.join(' & ') : currentUser.Role}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">PT. Anugerah Illahi Rabbi • ID: {currentUser.ID_User}</div>
                </div>

                <div className="px-4 py-2 text-[11px] text-slate-600 flex items-center gap-1.5 border-b border-slate-100">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                  <span>Status: Terautentikasi Aktif</span>
                </div>

                <div className="pt-1">
                  {isUserHyper && onOpenHyperAdminModal && (
                    <button
                      onClick={() => {
                        onOpenHyperAdminModal();
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-cyan-50 text-cyan-800 font-bold flex items-center gap-2 cursor-pointer border-b border-slate-100"
                    >
                      <ShieldAlert size={14} className="text-cyan-600" />
                      <span>Panel Hyper Admin (Masa Aktif)</span>
                    </button>
                  )}

                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        onOpenSettings();
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <Settings size={14} className="text-blue-600" />
                      <span>Pengaturan &amp; Konfigurasi Aplikasi</span>
                    </button>
                  )}

                  {onNavigateToAccessLog && (
                    <button
                      onClick={() => {
                        onNavigateToAccessLog();
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-indigo-700 font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <History size={14} className="text-indigo-600" />
                      <span>Histori Akses Pengguna (90 Hari)</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onOpenAuthModal();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <KeyRound size={14} className="text-blue-600" />
                    <span>Ganti Akun / Login Pengguna</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenSupabaseModal();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <Database size={14} className="text-slate-500" />
                    <span>Koneksi Supabase Cloud</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenExcelModal();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <Upload size={14} className="text-slate-500" />
                    <span>Pusat Migrasi Data Excel</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      onLogout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Keluar Akun (Logout)</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
