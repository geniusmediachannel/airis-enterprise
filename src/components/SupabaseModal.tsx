import React, { useState } from 'react';
import { 
  Database, ShieldCheck, CheckCircle2, AlertCircle, 
  X, RefreshCw, Key, Globe, ExternalLink, HardDrive, 
  Sparkles, Lock
} from 'lucide-react';
import { SupabaseConfig } from '../types';
import { isSupabaseConfigured, testSupabaseConnection } from '../services/dbAdapter';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupabaseConfig;
  onSaveConfig?: (cfg: SupabaseConfig) => void;
  onConfigSaved?: (cfg: SupabaseConfig) => void;
  onSyncDatabase?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onConfigSaved,
  onSyncDatabase,
}) => {
  const saveFn = onConfigSaved || onSaveConfig || (() => {});
  const [url, setUrl] = useState(config.url || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(url.trim(), anonKey.trim());
    setTesting(false);

    if (res.success) {
      setTestResult({
        success: true,
        message: res.message || 'Koneksi ke Supabase Database & Auth berhasil terhubung!',
      });
      saveFn({
        url: url.trim(),
        anonKey: anonKey.trim(),
        isConnected: true,
        autoSync: true,
      });
      setTimeout(() => {
        if (onSyncDatabase) onSyncDatabase();
      }, 500);
    } else {
      setTestResult({
        success: false,
        message: res.message || 'Koneksi gagal! Mohon periksa kembali Project URL dan Anon Key Anda.',
      });
    }
  };

  const handleUseDemo = () => {
    // Allows clearing or running local engine
    setUrl('');
    setAnonKey('');
    saveFn({
      url: '',
      anonKey: '',
      isConnected: false,
      autoSync: false,
    });
    setTestResult({
      success: true,
      message: 'Mode Local Hybrid Active. Menggunakan data tersimpan di browser & local engine terisolasi.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-emerald-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Koneksi Database Supabase</h2>
              <p className="text-xs text-emerald-100">Integrasi PostgreSQL Real-Time & Secure Auth</p>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Status Saat Ini:</span>
            {isSupabaseConfigured() ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Supabase Cloud Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                <HardDrive className="w-3.5 h-3.5" />
                Local Isolated Storage (Aktif)
              </span>
            )}
          </div>
          <button
            onClick={onSyncDatabase}
            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sinkronkan
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleTestAndSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Ditemukan di Supabase Dashboard &gt; Project Settings &gt; API
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-600" />
              Supabase Anon / Public Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Kunci publik aman untuk otentikasi browser (anon public)
            </p>
          </div>

          {/* Test Status feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <div className="flex-1 font-medium">{testResult.message}</div>
            </div>
          )}

          {/* Features note */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Keamanan Data & Role-Based Access:
            </div>
            <p className="text-[11px] leading-relaxed">
              Jika konfigurasi Supabase aktif, data Master, SPK, QC, Distribusi, dan Keuangan akan tersimpan langsung di tabel cloud. Jika kosong, sistem tetap berjalan normal dengan penyimpanan otomatis browser yang persisten.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleUseDemo}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Reset ke Mode Offline
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={testing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menghubungkan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan & Hubungkan
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
