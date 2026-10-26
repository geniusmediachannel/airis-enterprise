import React from 'react';
import { 
  LayoutDashboard, Database, Factory, Truck, 
  Boxes, FlaskConical, Scale, Users, FileSpreadsheet, 
  ChevronRight, Shield, X, Settings, Sliders, History,
  Eye, Edit3
} from 'lucide-react';
import { UserAccount } from '../types';
import { canAccessMenu, canEditModule } from '../services/permissionService';

interface SidebarProps {
  currentView: string;
  onNavigate?: (view: string) => void;
  onSelectView?: (view: string) => void;
  currentUser?: UserAccount;
  isOpen?: boolean;
  isOpenMobile?: boolean;
  onClose?: () => void;
  onCloseMobile?: () => void;
  badgeCounts?: Record<string, number>;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onSelectView,
  currentUser,
  isOpen = false,
  isOpenMobile = false,
  onClose,
  onCloseMobile,
  badgeCounts,
  onOpenSettings,
}) => {
  const navigateFn = onSelectView || onNavigate || (() => {});
  const closeFn = onCloseMobile || onClose;
  const isDrawerOpen = isOpenMobile || isOpen;
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Utama',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      description: 'Ringkasan KPI & Analisis',
    },
    {
      id: 'master_data',
      label: 'Master Data',
      icon: Database,
      description: 'Produk, BOM, Karyawan, dsb',
    },
    {
      id: 'produksi',
      label: 'Manajemen Produksi & SPK',
      icon: Factory,
      badge: 'Inti',
      badgeColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      description: 'Perintah Kerja, Output & Laporan',
    },
    {
      id: 'distribusi',
      label: 'Distribusi & Pengiriman',
      icon: Truck,
      description: 'Rencana, DO, Invoice & Laporan',
    },
    {
      id: 'stock',
      label: 'Stock & Bahan Baku',
      icon: Boxes,
      description: 'Sisa Stock, Mutasi & Gudang',
    },
    {
      id: 'qc',
      label: 'Quality Control (QC SNI)',
      icon: FlaskConical,
      badge: 'SNI',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      description: 'Uji Air Baku, Proses & Jadi',
    },
    {
      id: 'keuangan',
      label: 'Keuangan & Akuntansi',
      icon: Scale,
      description: 'Jurnal, Kas, Piutang & Laba Rugi',
    },
    {
      id: 'hrd',
      label: 'SDM, Presensi & Payroll',
      icon: Users,
      description: 'Tabel Presensi, Lembur & Gaji',
    },
    {
      id: 'administrasi',
      label: 'Administrasi & Surat',
      icon: FileSpreadsheet,
      description: 'Surat Eksternal, Internal & PO',
    },
    {
      id: 'log_akses',
      label: 'Histori Akses Pengguna',
      icon: History,
      badge: '90h',
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      description: 'Audit Trail Login & Keamanan',
    },
  ];

  const isItemActive = (itemId: string) => {
    if (currentView === itemId) return true;
    if (itemId === 'master_data' && (currentView === 'master' || currentView === 'master_data')) return true;
    if (itemId === 'produksi' && (currentView === 'production' || currentView === 'produksi')) return true;
    if (itemId === 'distribusi' && (currentView === 'distribution' || currentView === 'distribusi')) return true;
    if (itemId === 'stock' && (currentView === 'stok' || currentView === 'stock')) return true;
    if (itemId === 'keuangan' && (currentView === 'finance' || currentView === 'keuangan')) return true;
    if (itemId === 'administrasi' && (currentView === 'admin' || currentView === 'administrasi')) return true;
    if (itemId === 'log_akses' && (currentView === 'log_akses' || currentView === 'access_log' || currentView === 'log')) return true;
    return false;
  };

  const handleSelect = (id: string) => {
    navigateFn(id);
    if (closeFn) closeFn();
  };

  const content = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 text-slate-300 w-64 select-none">
      {/* Brand & Factory Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-black text-lg">
            A
          </div>
          <div>
            <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
              AIRIS ENTERPRISE
            </div>
            <div className="text-[10px] text-slate-400 font-medium">PT. Anugerah Illahi Rabbi</div>
          </div>
        </div>
        {closeFn && (
          <button 
            onClick={closeFn}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Badge / Active Role */}
      {currentUser && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold text-xs flex-shrink-0">
              {(currentUser.Nama || currentUser.Username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{currentUser.Nama || currentUser.Username}</p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-blue-400 inline" />
                {currentUser.Role}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
          <span>Semua Menu</span>
          <span className="text-[9px] lowercase text-slate-500 font-normal">akses monitor</span>
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.id);
          const isWritable = canEditModule(currentUser?.Role, item.id);
          const isSuper = currentUser?.Role === 'SuperAdmin';
          
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-medium'
                  : 'hover:bg-slate-800/80 hover:text-slate-100 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <div className="truncate">
                  <span className="text-xs block leading-tight">{item.label}</span>
                </div>
              </div>

              {/* Status Badge: Wewenang Pengerjaan vs Mode Lihat */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.badge ? (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : isWritable && !isSuper && item.id !== 'dashboard' ? (
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    }`}
                    title="Wewenang Pengerjaan Anda (Input & Edit)"
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    Wewenang
                  </span>
                ) : !isWritable && item.id !== 'dashboard' ? (
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                    }`}
                    title="Hanya Dapat Melihat Data (Read-Only)"
                  >
                    <Eye className="w-2.5 h-2.5" />
                    Lihat
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tombol Konfigurasi & Pengaturan Aplikasi */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-900/40">
        <button
          type="button"
          onClick={() => {
            if (onOpenSettings) onOpenSettings();
            if (closeFn) closeFn();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 hover:border-blue-500/60 text-slate-200 hover:text-white border border-slate-700/70 shadow-xs transition-all duration-150 group cursor-pointer"
          title="Buka Pengaturan & Konfigurasi Aplikasi (Database, Notifikasi, Excel, Tema)"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-blue-600/25 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <Settings size={15} />
            </div>
            <div className="truncate text-left">
              <span className="text-xs font-semibold block leading-tight text-slate-200 group-hover:text-white">
                Pengaturan Sistem
              </span>
              <span className="text-[10px] text-slate-400 block leading-tight truncate">
                DB, Notif, Excel &amp; Tema
              </span>
            </div>
          </div>
          <Sliders size={13} className="text-slate-500 group-hover:text-blue-400 shrink-0 ml-1" />
        </button>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span>Sistem Pabrik AMDK v3.5</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Ready
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 z-30 shrink-0">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
            onClick={closeFn}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200 h-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
