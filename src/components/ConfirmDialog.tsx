import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, AlertCircle, CheckCircle2, HelpCircle, 
  X, Send, Trash2, Check, ArrowRight, ShieldAlert, Sparkles,
  Info
} from 'lucide-react';
import { playNotificationChime } from '../services/notificationService';

export type ConfirmType = 'danger' | 'warning' | 'success' | 'info';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  itemDetails?: Record<string, string | number>;
  alertOnly?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ActiveDialogState extends ConfirmDialogOptions {
  id: string;
  resolve: (value: boolean) => void;
}

/**
 * Global promise-based confirmation dialog.
 * Replaces ugly browser native confirm() and alert() with a modern enterprise-grade dialog.
 */
export function confirmAction(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('airis_open_confirm', {
          detail: {
            ...options,
            id: `confirm-${Date.now()}`,
            resolve,
          },
        })
      );
    } else {
      resolve(false);
    }
  });
}

/**
 * Modern modal alert replacement for window.alert()
 */
export function alertModal(
  message: string,
  title: string = 'Pemberitahuan Sistem',
  type: ConfirmType = 'info',
  confirmText: string = 'Mengerti'
): Promise<boolean> {
  return confirmAction({
    title,
    message,
    type,
    confirmText,
    alertOnly: true
  });
}

export const ConfirmDialog: React.FC = () => {
  const [activeDialog, setActiveDialog] = useState<ActiveDialogState | null>(null);

  useEffect(() => {
    const handleOpenConfirm = (e: any) => {
      if (e.detail) {
        setActiveDialog(e.detail);
        // Play acoustic chime
        if (e.detail.type === 'danger') {
          playNotificationChime('alert');
        } else if (e.detail.type === 'success') {
          playNotificationChime('success');
        } else {
          playNotificationChime('info');
        }
      }
    };

    window.addEventListener('airis_open_confirm', handleOpenConfirm);
    return () => window.removeEventListener('airis_open_confirm', handleOpenConfirm);
  }, []);

  if (!activeDialog) return null;

  const handleConfirm = () => {
    activeDialog.resolve(true);
    if (activeDialog.onConfirm) activeDialog.onConfirm();
    setActiveDialog(null);
  };

  const handleCancel = () => {
    activeDialog.resolve(false);
    if (activeDialog.onCancel) activeDialog.onCancel();
    setActiveDialog(null);
  };

  // Keyboard navigation (Enter to confirm, Esc to cancel)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  const type = activeDialog.type || 'info';
  const isDanger = type === 'danger';
  const isWarning = type === 'warning';
  const isSuccess = type === 'success';

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      autoFocus
    >
      <div 
        className={`bg-white rounded-3xl max-w-md w-full overflow-hidden border border-slate-200/90 animate-in zoom-in-95 duration-200 text-left relative ${
          isDanger
            ? 'shadow-[0_20px_60px_-15px_rgba(225,29,72,0.35)]'
            : isWarning
            ? 'shadow-[0_20px_60px_-15px_rgba(245,158,11,0.35)]'
            : isSuccess
            ? 'shadow-[0_20px_60px_-15px_rgba(16,185,129,0.35)]'
            : 'shadow-[0_20px_60px_-15px_rgba(59,130,246,0.35)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Gradient Strip */}
        <div className={`h-2 w-full ${
          isDanger
            ? 'bg-gradient-to-r from-rose-500 via-red-500 to-amber-500'
            : isWarning
            ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600'
            : isSuccess
            ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500'
            : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500'
        }`} />

        <div className="p-6 sm:p-7">
          {/* Header Bar: Status Badge + Close Button */}
          <div className="flex items-center justify-between mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
              isDanger
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : isWarning
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : isSuccess
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-ping ${
                isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : isSuccess ? 'bg-emerald-500' : 'bg-blue-500'
              }`} />
              {isDanger ? 'Tindakan Permanen' : isWarning ? 'Perlu Perhatian' : isSuccess ? 'Konfirmasi Eksekusi' : 'Pemberitahuan Sistem'}
            </span>

            {!activeDialog.alertOnly && (
              <button
                type="button"
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                title="Tutup (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex items-start gap-4">
            {/* Glowing Icon Badge */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              isDanger
                ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-500/30 ring-4 ring-rose-100'
                : isWarning
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30 ring-4 ring-amber-100'
                : isSuccess
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 ring-4 ring-emerald-100'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30 ring-4 ring-blue-100'
            }`}>
              {isDanger ? (
                <Trash2 className="w-6 h-6" />
              ) : isWarning ? (
                <AlertTriangle className="w-6 h-6" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Info className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                {activeDialog.title || (isDanger ? 'Konfirmasi Penghapusan' : isSuccess ? 'Konfirmasi Eksekusi' : 'Konfirmasi Tindakan')}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
                {activeDialog.message}
              </p>
            </div>
          </div>

          {/* Item Details Card (if provided) */}
          {activeDialog.itemDetails && Object.keys(activeDialog.itemDetails).length > 0 && (
            <div className="mt-4 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs space-y-2">
              {Object.entries(activeDialog.itemDetails).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-slate-600">
                  <span className="text-[11px] font-medium text-slate-500">{key}:</span>
                  <span className="font-bold text-slate-900 font-mono text-right truncate bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Danger Warning Note */}
          {isDanger && (
            <div className="mt-4 p-2.5 bg-rose-50 border border-rose-200/80 rounded-xl flex items-center gap-2 text-[11px] text-rose-800 font-medium">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>Data yang telah dihapus tidak dapat dipulihkan kembali.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-2.5">
            {!activeDialog.alertOnly && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>{activeDialog.cancelText || 'Batal'}</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-slate-200/80 rounded text-[10px] text-slate-500 font-mono">Esc</kbd>
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              autoFocus
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg flex items-center gap-2 cursor-pointer ${
                isDanger
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:from-rose-800 active:to-red-800 shadow-rose-600/30'
                  : isWarning
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:from-amber-800 active:to-orange-800 shadow-amber-600/30'
                  : isSuccess
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 shadow-blue-600/30'
              }`}
            >
              {isDanger ? (
                <Trash2 className="w-3.5 h-3.5" />
              ) : isSuccess ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
              <span>{activeDialog.confirmText || (isDanger ? 'Ya, Hapus Data' : isSuccess ? 'Ya, Eksekusi' : 'Ya, Lanjutkan')}</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-white/20 rounded text-[10px] text-white/90 font-mono">↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
