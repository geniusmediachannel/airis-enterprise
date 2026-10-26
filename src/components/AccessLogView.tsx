import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, ShieldCheck, Search, Download, Printer, 
  Trash2, Filter, AlertTriangle, CheckCircle2, User, 
  Calendar, Clock, Laptop, RefreshCw, FileDown, ShieldAlert,
  ArrowRight, Sparkles, AlertCircle
} from 'lucide-react';
import { AccessLogItem, UserRole } from '../types';
import { 
  getAllAccessLogs, cleanExpiredAccessLogs, 
  clearAllAccessLogs, deleteSingleAccessLog 
} from '../services/accessLogService';
import { exportDataToExcel } from '../services/excelService';
import { generateTableReportPDF } from '../services/pdfService';
import { confirmAction } from './ConfirmDialog';
import { showToast } from './ToastContainer';
import { ROLE_INFO } from '../services/permissionService';

interface AccessLogViewProps {
  currentRole?: UserRole;
  onRefresh?: () => void;
}

export const AccessLogView: React.FC<AccessLogViewProps> = ({ currentRole = 'SuperAdmin' }) => {
  const [logs, setLogs] = useState<AccessLogItem[]>(() => getAllAccessLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  const reloadLogs = () => {
    setLogs(getAllAccessLogs());
  };

  useEffect(() => {
    reloadLogs();
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (filterRole !== 'all') {
      result = result.filter(l => l.Role === filterRole);
    }

    if (filterActivity !== 'all') {
      result = result.filter(l => l.Aktivitas === filterActivity);
    }

    if (filterStatus !== 'all') {
      result = result.filter(l => l.Status === filterStatus);
    }

    if (filterPeriod !== 'all') {
      const todayISO = new Date().toISOString().slice(0, 10);
      if (filterPeriod === 'today') {
        result = result.filter(l => l.Tanggal === todayISO);
      } else if (filterPeriod === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const limitISO = d.toISOString().slice(0, 10);
        result = result.filter(l => l.Tanggal >= limitISO);
      } else if (filterPeriod === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        const limitISO = d.toISOString().slice(0, 10);
        result = result.filter(l => l.Tanggal >= limitISO);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.Username?.toLowerCase().includes(q) ||
        l.Nama_Karyawan?.toLowerCase().includes(q) ||
        l.Role?.toLowerCase().includes(q) ||
        l.IP_Address?.toLowerCase().includes(q) ||
        l.Keterangan?.toLowerCase().includes(q) ||
        l.ID_Log?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [logs, filterRole, filterActivity, filterStatus, filterPeriod, searchQuery]);

  // Statistics
  const totalLogs = logs.length;
  const successLogins = logs.filter(l => l.Aktivitas === 'Login Berhasil').length;
  const failedLogins = logs.filter(l => l.Aktivitas === 'Login Gagal').length;
  const totalLogouts = logs.filter(l => l.Aktivitas === 'Logout').length;

  // Manual Trigger: Bersihkan Log > 3 Bulan
  const handleCleanExpired = () => {
    const { removedCount, remainingCount } = cleanExpiredAccessLogs(90);
    reloadLogs();
    if (removedCount > 0) {
      showToast('Pembersihan Berhasil', `${removedCount} catatan log akses yang berusia lebih dari 90 hari telah dibersihkan.`, 'success');
    } else {
      showToast('Data Masih Baru', 'Tidak ada catatan log akses yang berusia lebih dari 90 hari (3 bulan).', 'info');
    }
  };

  // Reset Semua Log Akses (SuperAdmin Only)
  const handleClearAll = async () => {
    if (currentRole !== 'SuperAdmin') {
      showToast('Akses Terbatas', 'Hanya SuperAdmin yang diizinkan mereset riwayat log akses.', 'warning');
      return;
    }

    const ok = await confirmAction({
      title: 'Reset Seluruh Histori Akses',
      message: 'Apakah Anda yakin ingin menghapus seluruh log aktivitas akses pengguna? Tindakan ini akan menghapus semua riwayat login/logout.',
      confirmText: 'Ya, Reset Semua',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;

    clearAllAccessLogs();
    reloadLogs();
    showToast('Histori Direset', 'Seluruh catatan riwayat akses pengguna telah dibersihkan.', 'success');
  };

  // Hapus 1 Log
  const handleDeleteSingle = async (idLog: string) => {
    const ok = await confirmAction({
      title: 'Hapus Catatan Log',
      message: `Hapus catatan log "${idLog}"?`,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      type: 'danger'
    });
    if (!ok) return;

    deleteSingleAccessLog(idLog);
    reloadLogs();
    showToast('Catatan Dihapus', `Log ${idLog} telah dihapus.`, 'success');
  };

  // Export Excel
  const handleExportExcel = () => {
    const exportData = filteredLogs.map(l => ({
      'ID Log': l.ID_Log,
      'Waktu': l.Waktu ? new Date(l.Waktu).toLocaleString('id-ID') : `${l.Tanggal} ${l.Jam}`,
      'Username': l.Username,
      'Nama Karyawan': l.Nama_Karyawan || '-',
      'Role Akses': l.Role || '-',
      'Aktivitas': l.Aktivitas,
      'Status': l.Status,
      'IP Address': l.IP_Address,
      'Perangkat & Browser': l.Browser_Device,
      'Keterangan': l.Keterangan
    }));
    exportDataToExcel(exportData, 'log_akses', `AIRIS_Histori_Akses_${new Date().toISOString().slice(0, 10)}`);
  };

  // Export PDF
  const handleExportPDF = () => {
    const headers = ['Waktu', 'Username', 'Role', 'Aktivitas', 'Status', 'IP Address', 'Keterangan'];
    const rows = filteredLogs.map(l => [
      l.Waktu ? new Date(l.Waktu).toLocaleDateString('id-ID') + ' ' + l.Jam : `${l.Tanggal} ${l.Jam}`,
      `${l.Username} (${l.Nama_Karyawan || '-'})`,
      l.Role || '-',
      l.Aktivitas,
      l.Status,
      l.IP_Address,
      l.Keterangan
    ]);

    generateTableReportPDF({
      title: 'HISTORI & AUDIT LOG AKSES PENGGUNA',
      subtitle: 'PT. Anugerah Illahi Rabbi - Retensi Otomatis 90 Hari (3 Bulan)',
      headers,
      rows,
      filename: `Audit_Log_Akses_${new Date().toISOString().slice(0, 10)}.pdf`
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={24} />
            Histori & Audit Log Akses Pengguna
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan aktivitas login, logout, dan otorisasi pengguna. Otomatis dibersihkan setiap 3 bulan (90 hari).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="p-2 text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Cetak Halaman"
          >
            <Printer size={16} />
          </button>

          <button
            onClick={handleExportPDF}
            className="p-2 text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Export PDF Resmi"
          >
            <FileDown size={16} />
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            title="Export Excel"
          >
            <Download size={14} />
            <span>Excel</span>
          </button>

          <button
            onClick={handleCleanExpired}
            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            title="Jalankan Pembersihan Otomatis Data > 3 Bulan"
          >
            <RefreshCw size={14} />
            <span>Pembersihan 3 Bulan</span>
          </button>

          {currentRole === 'SuperAdmin' && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Reset Semua Log Akses"
            >
              <Trash2 size={14} />
              <span>Reset Semua</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Catatan Log</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{totalLogs}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Semua aktivitas terekam</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <History size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Login Berhasil</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{successLogins}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Otorisasi sukses</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Percobaan Gagal</p>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{failedLogins}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sandi salah / ditolak</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Kebijakan Retensi</p>
            <p className="text-base font-bold text-indigo-700 mt-0.5">90 Hari (3 Bulan)</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Otomatis ter-reset sistem</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Role */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User size={14} className="text-slate-400" />
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Semua Role</option>
                <option value="SuperAdmin">SuperAdmin</option>
                <option value="Admin Master">Admin Master</option>
                <option value="Admin Produksi">Admin Produksi</option>
                <option value="Admin Gudang">Admin Gudang</option>
                <option value="Kasir/Finance">Kasir/Finance</option>
                <option value="HRD">HRD</option>
                <option value="Admin Dokumen">Admin Dokumen</option>
              </select>
            </div>

            {/* Filter Aktivitas */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter size={14} className="text-slate-400" />
              <select
                value={filterActivity}
                onChange={e => setFilterActivity(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Semua Aktivitas</option>
                <option value="Login Berhasil">Login Berhasil</option>
                <option value="Login Gagal">Login Gagal</option>
                <option value="Logout">Logout</option>
                <option value="Akses Ditolak">Akses Ditolak</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Semua Status</option>
                <option value="Sukses">Sukses</option>
                <option value="Gagal">Gagal</option>
                <option value="Peringatan">Peringatan</option>
              </select>
            </div>

            {/* Filter Rentang Tanggal */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar size={14} className="text-slate-400" />
              <select
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Semua Periode (Maks 90 Hari)</option>
                <option value="today">Hari Ini</option>
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Cari user, IP, aktivitas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Informational Banner */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span>
              Menampilkan <strong>{filteredLogs.length}</strong> dari <strong>{totalLogs}</strong> riwayat akses. 
              Sistem secara otomatis menghapus log yang berumur lebih dari 3 bulan demi efisiensi dan kepatuhan audit.
            </span>
          </div>
          <span className="font-mono text-slate-400 hidden sm:inline">Tabel: Log_Akses_Pengguna</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Waktu & Jam</th>
                <th className="p-3">Pengguna</th>
                <th className="p-3">Role Akses</th>
                <th className="p-3">Aktivitas</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Alamat IP & Perangkat</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <History size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600 text-sm">Tidak Ada Catatan Log Akses</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tidak ada riwayat aktivitas yang cocok dengan filter pencarian saat ini.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const roleMeta = log.Role ? ROLE_INFO[log.Role as UserRole] : null;

                  return (
                    <tr key={log.ID_Log} className="hover:bg-slate-50 transition-colors">
                      {/* Waktu & Jam */}
                      <td className="p-3 whitespace-nowrap align-top">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Calendar size={13} className="text-blue-600 shrink-0" />
                          <span>{log.Tanggal || (log.Waktu ? log.Waktu.slice(0, 10) : '-')}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="shrink-0" />
                          <span>{log.Jam || (log.Waktu ? log.Waktu.slice(11, 19) : '-')} WIB</span>
                        </div>
                        <div className="text-[9px] text-slate-300 font-mono mt-0.5">{log.ID_Log}</div>
                      </td>

                      {/* Pengguna */}
                      <td className="p-3 align-top whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.Username}</div>
                        <div className="text-[11px] text-slate-500">
                          {log.Nama_Karyawan || '-'}
                        </div>
                        {log.ID_User && (
                          <div className="text-[10px] text-blue-600 font-mono">{log.ID_User}</div>
                        )}
                      </td>

                      {/* Role Akses */}
                      <td className="p-3 align-top whitespace-nowrap">
                        {log.Role && log.Role !== '-' ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            roleMeta?.badgeColor || 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.Role}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Aktivitas */}
                      <td className="p-3 align-top whitespace-nowrap">
                        <span className={`font-semibold ${
                          log.Aktivitas === 'Login Berhasil' ? 'text-emerald-700' :
                          log.Aktivitas === 'Login Gagal' ? 'text-rose-700' :
                          log.Aktivitas === 'Logout' ? 'text-blue-700' : 'text-amber-700'
                        }`}>
                          {log.Aktivitas}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="p-3 align-top text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          log.Status === 'Sukses'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.Status === 'Gagal'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {log.Status === 'Sukses' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                          <span>{log.Status}</span>
                        </span>
                      </td>

                      {/* IP Address & Perangkat */}
                      <td className="p-3 align-top text-xs">
                        <div className="font-mono text-slate-700">{log.IP_Address || '127.0.0.1'}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Laptop size={11} className="shrink-0" />
                          <span>{log.Browser_Device || 'Web Browser'}</span>
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="p-3 align-top text-xs text-slate-600 max-w-xs">
                        <p className="italic">{log.Keterangan || '-'}</p>
                      </td>

                      {/* Aksi */}
                      <td className="p-3 align-top text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteSingle(log.ID_Log)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Hapus Catatan Log Ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
