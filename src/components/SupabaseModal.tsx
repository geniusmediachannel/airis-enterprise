import React, { useState, useEffect } from 'react';
import { 
  Database, ShieldCheck, CheckCircle2, AlertCircle, 
  X, RefreshCw, Key, Globe, ExternalLink, HardDrive, 
  Sparkles, Lock, ArrowDownCircle, ArrowUpCircle, Check,
  Smartphone, QrCode, Copy, Share2, Layers
} from 'lucide-react';
import { SupabaseConfig, UserAccount } from '../types';
import { 
  isSupabaseConfigured, testSupabaseConnection, 
  syncAllTablesFromSupabase, pushAllTablesToSupabase,
  getSupabaseConfig, normalizeSupabaseUrl, saveSupabaseConfig,
  generateDeviceConnectUrl
} from '../services/dbAdapter';
import {
  getTursoConfig, saveTursoConfig, testTursoConnection,
  pushAllTablesToTurso, pullAllTablesFromTurso,
  generateTursoDeviceConnectUrl, DEFAULT_TURSO_URL, DEFAULT_TURSO_TOKEN
} from '../services/tursoAdapter';
import { isSuperAdmin } from '../services/permissionService';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupabaseConfig;
  onSaveConfig?: (cfg: SupabaseConfig) => void;
  onConfigSaved?: (cfg: SupabaseConfig) => void;
  onSyncDatabase?: () => void;
  currentUser?: UserAccount;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onConfigSaved,
  onSyncDatabase,
  currentUser,
}) => {
  const saveFn = onConfigSaved || onSaveConfig || (() => {});
  const activeCfg = getSupabaseConfig();
  const activeTursoCfg = getTursoConfig();

  // Active Tab: Turso (default rekomendasi) atau Supabase
  const [activeTab, setActiveTab] = useState<'turso' | 'supabase'>('turso');

  // Supabase State
  const [url, setUrl] = useState(config.url || activeCfg.url || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || activeCfg.anonKey || '');
  const [testing, setTesting] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Turso State
  const [tursoUrl, setTursoUrl] = useState(activeTursoCfg.url || DEFAULT_TURSO_URL);
  const [tursoToken, setTursoToken] = useState(activeTursoCfg.authToken || DEFAULT_TURSO_TOKEN);
  const [tursoTesting, setTursoTesting] = useState(false);
  const [tursoSyncing, setTursoSyncing] = useState(false);
  const [tursoTestResult, setTursoTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTursoQr, setShowTursoQr] = useState(false);
  const [copiedTursoLink, setCopiedTursoLink] = useState(false);

  const canManageDb = !currentUser || isSuperAdmin(currentUser);

  useEffect(() => {
    if (isOpen) {
      const cur = getSupabaseConfig();
      if (!url && cur.url) setUrl(cur.url);
      if (!anonKey && cur.anonKey) setAnonKey(cur.anonKey);

      const curT = getTursoConfig();
      if (!tursoUrl && curT.url) setTursoUrl(curT.url);
      if (!tursoToken && curT.authToken) setTursoToken(curT.authToken);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handler Supabase
  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const cleanUrl = normalizeSupabaseUrl(url);
    if (cleanUrl !== url) setUrl(cleanUrl);
    const cleanKey = anonKey.trim();

    const res = await testSupabaseConnection(cleanUrl, cleanKey);
    setTesting(false);

    if (res.success) {
      const newCfg: SupabaseConfig = {
        url: cleanUrl,
        anonKey: cleanKey,
        isConnected: true,
        autoSync: true,
      };
      saveSupabaseConfig(newCfg);
      saveFn(newCfg);

      setTestResult({
        success: true,
        message: 'Koneksi ke Supabase berhasil! Menyelaraskan seluruh data multi-device...',
      });

      syncAllTablesFromSupabase({ customConfig: newCfg }).then(syncRes => {
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
    setSyncStatusMsg('Menghubungkan & menarik data dari Cloud Supabase...');
    setTestResult(null);

    try {
      const cleanUrl = normalizeSupabaseUrl(url);
      const cleanKey = anonKey.trim();
      let cfgToUse: SupabaseConfig | undefined;
      if (cleanUrl && cleanKey) {
        cfgToUse = { url: cleanUrl, anonKey: cleanKey, isConnected: true, autoSync: true };
        saveSupabaseConfig(cfgToUse);
        saveFn(cfgToUse);
      }

      const res = await syncAllTablesFromSupabase({ customConfig: cfgToUse });
      setTestResult({
        success: res.success,
        message: res.message
      });
      if (res.success && onSyncDatabase) {
        onSyncDatabase();
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Gagal menarik data: ${e.message || 'Koneksi terputus'}`
      });
    } finally {
      setSyncingCloud(false);
      setSyncStatusMsg('');
    }
  };

  const handlePushCloud = async () => {
    setSyncingCloud(true);
    setSyncStatusMsg('Menyiapkan data lokal...');
    setTestResult(null);

    try {
      const cleanUrl = normalizeSupabaseUrl(url);
      const cleanKey = anonKey.trim();
      let cfgToUse: SupabaseConfig | undefined;
      if (cleanUrl && cleanKey) {
        cfgToUse = { url: cleanUrl, anonKey: cleanKey, isConnected: true, autoSync: true };
        saveSupabaseConfig(cfgToUse);
        saveFn(cfgToUse);
      }

      const res = await pushAllTablesToSupabase(cfgToUse, (msg) => {
        setSyncStatusMsg(msg);
      });
      setTestResult({
        success: res.success,
        message: res.message
      });
      if (res.success && onSyncDatabase) {
        onSyncDatabase();
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Gagal mengunggah data: ${e.message || 'Koneksi terputus'}`
      });
    } finally {
      setSyncingCloud(false);
      setSyncStatusMsg('');
    }
  };

  // Handler Turso
  const handleTestAndSaveTurso = async (e: React.FormEvent) => {
    e.preventDefault();
    setTursoTesting(true);
    setTursoTestResult(null);

    const res = await testTursoConnection(tursoUrl, tursoToken);
    setTursoTesting(false);

    if (res.success) {
      saveTursoConfig({
        url: tursoUrl,
        authToken: tursoToken,
        isConnected: true,
        autoSync: true
      });
      setTursoTestResult({
        success: true,
        message: res.message
      });
      if (onSyncDatabase) onSyncDatabase();
    } else {
      setTursoTestResult({
        success: false,
        message: res.message
      });
    }
  };

  const handlePushTurso = async () => {
    setTursoSyncing(true);
    setSyncStatusMsg('Mengunggah seluruh data lokal ke Turso Cloud...');
    setTursoTestResult(null);

    try {
      const res = await pushAllTablesToTurso({
        onProgress: (m) => setSyncStatusMsg(m),
        customConfig: { url: tursoUrl, authToken: tursoToken, isConnected: true, autoSync: true }
      });
      if (res.success) {
        saveTursoConfig({
          url: tursoUrl,
          authToken: tursoToken,
          isConnected: true,
          autoSync: true
        });
      }
      setTursoTestResult({
        success: res.success,
        message: res.message
      });
      if (onSyncDatabase) onSyncDatabase();
    } catch (e: any) {
      setTursoTestResult({
        success: false,
        message: `Gagal mengunggah ke Turso: ${e.message}`
      });
    } finally {
      setTursoSyncing(false);
      setSyncStatusMsg('');
    }
  };

  const handlePullTurso = async () => {
    setTursoSyncing(true);
    setSyncStatusMsg('Menarik seluruh data dari Turso Cloud...');
    setTursoTestResult(null);

    try {
      const res = await pullAllTablesFromTurso({
        onProgress: (m) => setSyncStatusMsg(m),
        customConfig: { url: tursoUrl, authToken: tursoToken, isConnected: true, autoSync: true }
      });
      setTursoTestResult({
        success: res.success,
        message: res.message
      });
      if (onSyncDatabase) onSyncDatabase();
    } catch (e: any) {
      setTursoTestResult({
        success: false,
        message: `Gagal menarik dari Turso: ${e.message}`
      });
    } finally {
      setTursoSyncing(false);
      setSyncStatusMsg('');
    }
  };

  if (!canManageDb) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
          <div className="shrink-0 p-5 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Akses Database Terbatas</h2>
                <p className="text-xs text-slate-300">Khusus SuperAdmin &amp; HyperAdmin</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1 font-bold">Pengaturan Kredensial Terlindungi:</strong>
                Konfigurasi database Cloud hanya dapat diubah oleh peran <strong>Super Administrator</strong> atau <strong>Hyper Administrator</strong>.
              </div>
            </div>
          </div>

          <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="shrink-0 p-5 sm:p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-teal-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 sm:top-5 right-4 sm:right-5 text-blue-100 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">Koneksi Database Cloud</h2>
              <p className="text-xs text-blue-100">Sinkronisasi Real-Time Multi-Device Antar Perangkat</p>
            </div>
          </div>

          {/* Database Provider Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/15">
            <button
              type="button"
              onClick={() => setActiveTab('turso')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'turso'
                  ? 'bg-white text-blue-900 shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Turso Database</span>
              <span className="text-[10px] bg-amber-400 text-amber-950 font-extrabold px-1.5 py-0.2 rounded-full ml-1">Rekomendasi</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('supabase')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'supabase'
                  ? 'bg-white text-emerald-900 shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Supabase Cloud</span>
            </button>
          </div>
        </div>

        {/* ===================== TAB TURSO ===================== */}
        {activeTab === 'turso' && (
          <form onSubmit={handleTestAndSaveTurso} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Status Bar */}
            <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Status:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  Turso Connected (1 Milyar Reads/Bulan)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePullTurso}
                  disabled={tursoSyncing}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Tarik data terbaru dari Turso ke browser ini"
                >
                  <ArrowDownCircle className={`w-3.5 h-3.5 ${tursoSyncing ? 'animate-spin' : ''}`} />
                  <span>Tarik Data</span>
                </button>
                <button
                  type="button"
                  onClick={handlePushTurso}
                  disabled={tursoSyncing}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Unggah seluruh data lokal di browser ini ke Turso Cloud"
                >
                  <ArrowUpCircle className={`w-3.5 h-3.5 ${tursoSyncing ? 'animate-spin' : ''}`} />
                  <span>Unggah Data</span>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Highlight Box Migrasi Sukses */}
              <div className="p-3.5 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-2">
                <div className="font-bold text-xs text-blue-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Bebas Limit Egress &amp; Kuota Sangat Longgar!
                  </span>
                  <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                    9 GB Storage
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700">
                  Klik tombol <strong>Unggah (Push) ke Turso</strong> di bawah untuk memindahkan seluruh data dari komputer ini ke Turso Cloud secara instan.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePushTurso}
                    disabled={tursoSyncing}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <ArrowUpCircle className={`w-4 h-4 ${tursoSyncing ? 'animate-spin' : ''}`} />
                    <span>Unggah (Push) ke Turso</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePullTurso}
                    disabled={tursoSyncing}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <ArrowDownCircle className={`w-4 h-4 ${tursoSyncing ? 'animate-spin' : ''}`} />
                    <span>Tarik (Pull) dari Turso</span>
                  </button>
                </div>
                {tursoSyncing && syncStatusMsg && (
                  <div className="flex items-center gap-2 pt-1.5 text-xs text-blue-700 font-medium animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{syncStatusMsg}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  Turso Database URL
                </label>
                <input
                  type="text"
                  placeholder="libsql://airis-db-username.turso.io"
                  value={tursoUrl}
                  onChange={(e) => setTursoUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-blue-600" />
                  Turso Auth Token (JWT)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
                  value={tursoToken}
                  onChange={(e) => setTursoToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Status Test Turso */}
              {tursoTestResult && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                    tursoTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {tursoTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 font-medium">{tursoTestResult.message}</div>
                </div>
              )}

              {/* Hubungkan HP / Perangkat Lain ke Turso */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-teal-50 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-700" />
                    <span className="font-bold text-xs text-slate-800">
                      Hubungkan ke HP / Perangkat Lain (Turso)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTursoQr(!showTursoQr)}
                    className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {showTursoQr ? 'Tutup QR' : 'Buka QR Code'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Agar di HP tidak perlu memasukkan token lagi: Cukup scan QR Code atau salin link instan di bawah ini.
                </p>

                {showTursoQr && (
                  <div className="p-4 bg-white rounded-xl border border-blue-200 flex flex-col items-center justify-center gap-3 animate-in fade-in">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(generateTursoDeviceConnectUrl({ url: tursoUrl, authToken: tursoToken, isConnected: true, autoSync: true }))}`}
                        alt="QR Code Koneksi Turso HP"
                        className="w-40 h-40"
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 text-center">
                      Arahkan kamera HP ke QR Code di atas untuk menyambungkan Turso otomatis di HP.
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const connectLink = generateTursoDeviceConnectUrl({ url: tursoUrl, authToken: tursoToken, isConnected: true, autoSync: true });
                    if (connectLink) {
                      navigator.clipboard.writeText(connectLink);
                      setCopiedTursoLink(true);
                      setTimeout(() => setCopiedTursoLink(false), 2500);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  {copiedTursoLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Link Instan Tersalin! Kirim ke WA / Buka di HP</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link Penghubung Instan Turso untuk HP</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={tursoTesting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {tursoTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menghubungkan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan &amp; Hubungkan Turso
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ===================== TAB SUPABASE ===================== */}
        {activeTab === 'supabase' && (
          <form onSubmit={handleTestAndSaveSupabase} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Status Bar */}
            <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Status:</span>
                {isSupabaseConfigured() ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Supabase Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-medium">
                    Offline
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
                  <span>Tarik Data</span>
                </button>
                <button
                  type="button"
                  onClick={handlePushCloud}
                  disabled={syncingCloud}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  title="Unggah seluruh data lokal di browser ini ke Supabase Cloud"
                >
                  <ArrowUpCircle className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin' : ''}`} />
                  <span>Unggah Data</span>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://jnjfuprwbxeeqlzgklfr.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
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
              </div>

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
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={testing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menghubungkan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Simpan &amp; Hubungkan Supabase
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
