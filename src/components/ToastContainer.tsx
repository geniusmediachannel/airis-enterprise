import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, AlertCircle, Info, X, Sparkles, Bell
} from 'lucide-react';
import { playNotificationChime } from '../services/notificationService';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: number;
  duration?: number;
  icon?: string; // optional custom icon name
}

export function showToast(
  title: string,
  message: string,
  type: 'success' | 'warning' | 'error' | 'info' = 'info',
  duration: number = 4000,
  icon?: string
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('airis_show_toast', {
      detail: {
        id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title,
        message,
        type,
        duration,
        timestamp: Date.now(),
        icon
      }
    }));
  }
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const iconMap: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4" />, // fallback for type
    error: <AlertCircle className="w-4 h-4" />,    // fallback for type
    warning: <AlertTriangle className="w-4 h-4" />, // fallback for type
    info: <Bell className="w-4 h-4" />,            // fallback for type
    // custom icons can be added here
    sparkles: <Sparkles className="w-4 h-4" />
  };

  useEffect(() => {
    const handleToastEvent = (e: any) => {
      if (e.detail) {
        const newToast: ToastItem = e.detail;
        setToasts(prev => [newToast, ...prev.slice(0, 4)]); // keep max 5

        // Play acoustic chime based on type
        if (newToast.type === 'success') {
          playNotificationChime('success');
        } else if (newToast.type === 'error' || newToast.type === 'warning') {
          playNotificationChime('alert');
        } else {
          playNotificationChime('info');
        }

        // Auto‑remove after duration
        const timer = setTimeout(() => {
          removeToast(newToast.id);
        }, newToast.duration || 4000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('airis_show_toast', handleToastEvent);
    return () => window.removeEventListener('airis_show_toast', handleToastEvent);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';
        const customIcon = toast.icon && iconMap[toast.icon];
        const renderedIcon = customIcon || (
          isSuccess ? <CheckCircle2 className="w-4 h-4" /> :
          isError ? <AlertCircle className="w-4 h-4" /> :
          isWarning ? <AlertTriangle className="w-4 h-4" /> :
          <Bell className="w-4 h-4" />
        );
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in slide-in-from-top-3 flex items-start gap-3 relative overflow-hidden ${
              isSuccess ? 'bg-emerald-950/90 text-white border-emerald-500/40 shadow-emerald-900/20' :
              isError ? 'bg-rose-950/90 text-white border-rose-500/40 shadow-rose-900/20' :
              isWarning ? 'bg-amber-950/90 text-white border-amber-500/40 shadow-amber-900/20' :
              'bg-slate-900/90 text-white border-blue-500/40 shadow-blue-900/20'
            }`}
          >
            {/* Left Status Icon */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              isError ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              isWarning ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
            >
              {renderedIcon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-bold leading-snug">{toast.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition shrink-0 cursor-pointer"
              title="Tutup Notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Animated Progress Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 h-0.5 animate-[toast-progress_4s_linear_forwards] ${
                isSuccess ? 'bg-emerald-400' :
                isError ? 'bg-rose-400' :
                isWarning ? 'bg-amber-400' :
                'bg-blue-400'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};
