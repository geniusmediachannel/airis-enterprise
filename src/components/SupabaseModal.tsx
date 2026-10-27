import React, { useState, useEffect } from 'react';
import { 
  Database, ShieldCheck, CheckCircle2, AlertCircle, 
  X, RefreshCw, Key, Globe, ExternalLink, HardDrive, 
  Sparkles, Lock, ArrowDownCircle, ArrowUpCircle, Check
} from 'lucide-react';
import { SupabaseConfig } from '../types';
import { 
  isSupabaseConfigured, testSupabaseConnection, 
  syncAllTablesFromSupabase, pushAllTablesToSupabase,
  getSupabaseConfig 
} from '../services/dbAdapter';

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
  const activeCfg = getSupabaseConfig();
  const [url, setUrl] = useState(config.url || activeCfg.url || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || activeCfg.anonKey || '');
  const [testing, setTesting] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cur = getSupabaseConfig();
      if (!url && cur.url) setUrl(cur.url);
      if (!anonKey && cur.anonKey) setAnonKey(cur.anonKey);
    }
  }, [isOpen]);

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
        message: 'Koneksi ke Supabase berhasil! Menyelaraskan seluruh data multi-device...',
      });
      saveFn({
        url: url.trim(),
        anonKey: anonKey.trim(),
        isConnected: true,
        autoSync: true,
      });

      // Tarik dan samakan data langsung dari Supabase Cloud
      syncAllTablesFromSupabase().then(syncRes => {
        if (syncRes.success) {
          setTestResult({
            success: true,
            message: `Koneksi Berhasil! Seluruh data (${syncRes.tablesCount} tabel) telah tersinkronisasi otomatis dengan Cloud.`
          });
        }
        if (onSyncDatabase) onSyncDatabase();
      });
    } else {
      setTestResult({
        success: false,
        message: res.message || 'Koneksi gagal! Mohon periksa kembali Project URL dan Anon Key Anda.',
      });
    }
  };

  const handlePullCloud = async () => {
    setSyncingCloud(true);
    setTestResult(null);
    const res = await syncAllTablesFromSupabase();
    setSyncingCloud(false);
    setTestResult({
      success: res.success,
      message: res.message
    });
    if (res.success && onSyncDatabase) {
      onSyncDatabase();
    }
  };

  const handlePushCloud = async () => {
    setSyncingCloud(true);
    setTestResult(null);
    const res = await pushAllTablesToSupabase();
    setSyncingCloud(false);
    setTestResult({
      success: res.success,
      message: res.message
    });
    if (res.success && onSyncDatabase) {
      onSyncDatabase();
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

        {/* Status Indicator & Cloud Actions */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Status:</span>
            {isSupabaseConfigured() ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Supabase Cloud Connected (Auto-Sync)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                <HardDrive className="w-3.5 h-3.5" />
                Local Isolated Storage
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePullCloud}
              disabled={syncingCloud}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              title="Tarik seluruh data terbaru dari Supabase ke browser ini"
            >
              <ArrowDownCircle className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin' : ''}`} />
              <span>Tarik Data (Pull)</span>
            </button>
            <button
              type="button"
              onClick={handlePushCloud}
              disabled={syncingCloud}
              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              title="Unggah seluruh data lokal di browser ini ke Supabase Cloud"
            >
              <ArrowUpCircle className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin' : ''}`} />
              <span>Unggah ke Cloud (Push)</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleTestAndSave} className="p-6 space-y-4">
          {/* Action Box Sinkronisasi Cepat */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl space-y-2.5">
            <div className="font-bold text-xs text-emerald-950 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                Penyelarasan Data Seluruh Perangkat:
              </span>
              <span className="text-[10px] bg-emerald-200/70 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                Multi-Device Realtime
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Gunakan browser yang datanya paling lengkap (contoh: <strong>Produksi 2.130</strong>), lalu klik tombol <strong>Unggah ke Cloud</strong> di bawah agar seluruh browser &amp; HP otomatis membaca data yang sama.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handlePushCloud}
                disabled={syncingCloud}
                className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <ArrowUpCircle className={`w-4 h-4 ${syncingCloud ? 'animate-spin' : ''}`} />
                <span>Unggah (Push) ke Cloud</span>
              </button>
              <button
                type="button"
                onClick={handlePullCloud}
                disabled={syncingCloud}
                className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <ArrowDownCircle className={`w-4 h-4 ${syncingCloud ? 'animate-spin' : ''}`} />
                <span>Tarik (Pull) dari Cloud</span>
              </button>
            </div>
          </div>
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
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              Sinkronisasi Otomatis Multi-Device (Real-Time):
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Dengan menghubungkan Supabase Cloud, seluruh data (Produksi, SPK, Stok, Keuangan, dan Masa Aktif Aplikasi) akan <strong>otomatis tersinkronisasi secara real-time</strong>. Data yang diinput dari laptop ini akan langsung sama persis saat dibuka dari komputer kasir, tablet, maupun smartphone lain.
            </p>
            <div className="pt-1 border-t border-slate-200 text-[10px] text-slate-500">
              <strong>Tips Deploy Vercel:</strong> Pasang Environment Variables <code className="bg-slate-200 px-1 rounded text-slate-800">VITE_SUPABASE_URL</code> dan <code className="bg-slate-200 px-1 rounded text-slate-800">VITE_SUPABASE_ANON_KEY</code> di Vercel agar seluruh device langsung terhubung otomatis tanpa konfigurasi ulang!
            </div>
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
