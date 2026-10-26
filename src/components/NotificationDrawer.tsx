import React, { useState, useMemo } from 'react';
import { 
  Bell, X, CheckCheck, AlertTriangle, AlertCircle, 
  Info, ArrowRight, ShieldAlert, Sparkles, Volume2, 
  Search, Filter, Check, Clock, Eye, Layers, Package,
  Factory, Truck, DollarSign, Microscope, Trash2
} from 'lucide-react';
import { NotificationItem } from '../types';
import { 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  clearReadNotificationsHistory,
  playNotificationChime 
} from '../services/notificationService';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onClearAll?: () => void;
  onNavigate?: (view: string) => void;
  onNavigateTo?: (view: string) => void;
  pushPermission?: NotificationPermission;
  onRequestPushPermission?: () => void;
}

type CategoryFilter = 'all' | 'kritis' | 'stock' | 'spk' | 'distribusi' | 'finance' | 'qc';

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onNavigate,
  onNavigateTo,
  pushPermission = 'default',
  onRequestPushPermission,
}) => {
  const navigateFn = onNavigateTo || onNavigate || (() => {});
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(25);

  // Group counters
  const counts = useMemo(() => {
    return {
      all: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      kritis: notifications.filter(n => n.type === 'kritis' || n.priority === 'tinggi').length,
      stock: notifications.filter(n => n.category === 'stock' || n.category === 'material').length,
      spk: notifications.filter(n => n.category === 'spk').length,
      distribusi: notifications.filter(n => n.category === 'distribusi').length,
      finance: notifications.filter(n => n.category === 'finance').length,
      qc: notifications.filter(n => n.category === 'qc').length,
    };
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      // Category filter
      if (activeFilter === 'kritis') {
        if (item.type !== 'kritis' && item.priority !== 'tinggi') return false;
      } else if (activeFilter === 'stock') {
        if (item.category !== 'stock' && item.category !== 'material') return false;
      } else if (activeFilter === 'spk') {
        if (item.category !== 'spk') return false;
      } else if (activeFilter === 'distribusi') {
        if (item.category !== 'distribusi') return false;
      } else if (activeFilter === 'finance') {
        if (item.category !== 'finance') return false;
      } else if (activeFilter === 'qc') {
        if (item.category !== 'qc') return false;
      }

      // Read filter
      if (showOnlyUnread && item.read) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchMsg = item.message.toLowerCase().includes(query);
        return matchTitle || matchMsg;
      }

      return true;
    });
  }, [notifications, activeFilter, showOnlyUnread, searchQuery]);

  // Slice for instant DOM rendering anti-lag
  const visibleNotifications = useMemo(() => {
    return filteredNotifications.slice(0, displayLimit);
  }, [filteredNotifications, displayLimit]);

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(notifications);
    playNotificationChime('success');
  };

  const handleItemRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markNotificationAsRead(id);
  };

  const handleItemNavigate = (item: NotificationItem) => {
    markNotificationAsRead(item.id);
    const target = item.actionView || item.targetView;
    if (target) {
      navigateFn(target);
      onClose();
    }
  };

  const handleTestSound = () => {
    playNotificationChime('alert', true);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300" 
        onClick={onClose} 
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20">
              <Bell className="w-5 h-5 animate-wiggle" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">Pusat Notifikasi</h3>
                {counts.unread > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white ring-1 ring-rose-400">
                    {counts.unread} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">Monitoring Operasional Terintegrasi AIRIS</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTestSound}
              className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Uji Suara Notifikasi (Audio Chime)"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Tutup Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Web Push Banner (If Not Granted) */}
        {pushPermission !== 'granted' && onRequestPushPermission && (
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-blue-900 font-medium">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                <Volume2 className="w-4 h-4" />
              </div>
              <span className="text-[11px] leading-snug">
                Aktifkan <b>Web Push</b> agar workstation menerima peringatan stok kritis secara instan.
              </span>
            </div>
            <button
              onClick={onRequestPushPermission}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] font-bold transition shrink-0 shadow-xs cursor-pointer"
            >
              Aktifkan
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari notifikasi (produk, pelanggan, SPK...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills Bar */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 overflow-x-auto no-scrollbar flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('kritis')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'kritis'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Kritis
            {counts.kritis > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'kritis' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'}`}>
                {counts.kritis}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('stock')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'stock'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Stok
            {counts.stock > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'stock' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {counts.stock}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('spk')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'spk'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            SPK
            {counts.spk > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'spk' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {counts.spk}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('distribusi')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'distribusi'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Distribusi
            {counts.distribusi > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'distribusi' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {counts.distribusi}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('finance')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'finance'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Keuangan
            {counts.finance > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'finance' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {counts.finance}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('qc')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFilter === 'qc'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Microscope className="w-3.5 h-3.5" />
            QC
            {counts.qc > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeFilter === 'qc' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {counts.qc}
              </span>
            )}
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyUnread}
                onChange={(e) => setShowOnlyUnread(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[11px] font-medium text-slate-700">Hanya yang belum dibaca</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {counts.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer text-[11px]"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tandai Semua Dibaca
              </button>
            )}
          </div>
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Sparkles className="w-7 h-7 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Tidak ada notifikasi aktif</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                {searchQuery
                  ? `Tidak ada notifikasi yang cocok dengan kata kunci "${searchQuery}"`
                  : 'Semua parameter stok, SPK, distribusi, keuangan, dan QC beroperasi dengan aman.'}
              </p>
            </div>
          ) : (
            <>
              {visibleNotifications.map((item) => {
              const isError = item.type === 'kritis' || item.type === 'error';
              const isWarning = item.type === 'warning';
              const isSPK = item.type === 'spk';
              const isDist = item.type === 'distribusi';
              const isFinance = item.type === 'keuangan';
              const isQC = item.type === 'qc';
              const isUnread = !item.read;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemNavigate(item)}
                  className={`group p-3.5 rounded-2xl border transition-all duration-200 text-left relative cursor-pointer shadow-xs hover:shadow-md ${
                    isUnread
                      ? isError
                        ? 'bg-rose-50/80 border-rose-200/90 ring-1 ring-rose-300/40 hover:bg-rose-50'
                        : isWarning
                        ? 'bg-amber-50/80 border-amber-200/90 ring-1 ring-amber-300/40 hover:bg-amber-50'
                        : isDist
                        ? 'bg-purple-50/80 border-purple-200/90 ring-1 ring-purple-300/40 hover:bg-purple-50'
                        : isFinance
                        ? 'bg-emerald-50/80 border-emerald-200/90 ring-1 ring-emerald-300/40 hover:bg-emerald-50'
                        : 'bg-blue-50/80 border-blue-200/90 ring-1 ring-blue-300/40 hover:bg-blue-50'
                      : 'bg-white border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Unread indicator pulse */}
                  {isUnread && (
                    <span className="absolute top-3 right-3 flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isError ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        isError ? 'bg-rose-600' : isWarning ? 'bg-amber-600' : 'bg-blue-600'
                      }`} />
                    </span>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                      isError
                        ? 'bg-rose-600 text-white'
                        : isWarning
                        ? 'bg-amber-500 text-white'
                        : isDist
                        ? 'bg-purple-600 text-white'
                        : isFinance
                        ? 'bg-emerald-600 text-white'
                        : isQC
                        ? 'bg-teal-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}>
                      {isError ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : isDist ? (
                        <Truck className="w-5 h-5" />
                      ) : isFinance ? (
                        <DollarSign className="w-5 h-5" />
                      ) : isQC ? (
                        <Microscope className="w-5 h-5" />
                      ) : isSPK ? (
                        <Factory className="w-5 h-5" />
                      ) : (
                        <Info className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 pr-4">
                      {/* Category Badge & Priority */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/5 text-slate-700">
                          {item.category?.toUpperCase() || 'SISTEM'}
                        </span>
                        {item.priority === 'tinggi' && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                            PRIORITAS TINGGI
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.timestamp || 'Realtime'}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h4>

                      {/* Body Message */}
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {item.message}
                      </p>

                      {/* Bottom Action Footer */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-600 group-hover:text-blue-800 flex items-center gap-1 transition">
                          Lihat Detail Modul
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>

                        {isUnread && (
                          <button
                            onClick={(e) => handleItemRead(e, item.id)}
                            className="text-[10px] text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md hover:bg-black/5 transition flex items-center gap-1"
                            title="Tandai notifikasi ini sudah dibaca"
                          >
                            <Check className="w-3 h-3" />
                            Selesai
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredNotifications.length > displayLimit && (
              <div className="pt-2 pb-4 text-center">
                <button
                  type="button"
                  onClick={() => setDisplayLimit((p) => p + 25)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs hover:shadow-sm"
                >
                  Muat Notifikasi Lainnya (+{filteredNotifications.length - displayLimit})
                </button>
              </div>
            )}
          </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">AIRIS Automated Sentinel</span>
          <button
            onClick={clearReadNotificationsHistory}
            className="text-slate-400 hover:text-rose-600 transition flex items-center gap-1 text-[10px] cursor-pointer"
            title="Bersihkan memori riwayat dibaca"
          >
            <Trash2 className="w-3 h-3" />
            Reset Riwayat
          </button>
        </div>

      </div>
    </div>
  );
};
