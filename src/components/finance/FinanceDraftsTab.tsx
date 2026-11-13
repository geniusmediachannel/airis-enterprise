import React from 'react';
import { 
  FileCheck, RefreshCw, CheckSquare, Trash2, ArrowUpDown, Search, Calendar, Check, X 
} from 'lucide-react';
import { DraftJournalItem } from '../../types';

interface FinanceDraftsTabProps {
  draftJournals: DraftJournalItem[];
  filteredDrafts: DraftJournalItem[];
  draftFilterMonth: string;
  setDraftFilterMonth: (val: string) => void;
  draftSortOrder: 'asc' | 'desc';
  setDraftSortOrder: (val: 'asc' | 'desc') => void;
  draftSearchQuery: string;
  setDraftSearchQuery: (val: string) => void;
  selectedDraftIds: Set<string>;
  toggleSelectDraft: (id: string) => void;
  toggleSelectAllDrafts: () => void;
  handleVerifyAndPostDraft: (draft: DraftJournalItem) => Promise<void>;
  handleVerifyBatchDrafts: () => Promise<void>;
  handleDeleteDraft: (id: string) => Promise<void>;
  handleDeleteBatchDrafts: () => Promise<void>;
  handleSyncAllModules: () => Promise<void>;
  isSyncing: boolean;
}

export const FinanceDraftsTab: React.FC<FinanceDraftsTabProps> = ({
  draftJournals,
  filteredDrafts,
  draftFilterMonth,
  setDraftFilterMonth,
  draftSortOrder,
  setDraftSortOrder,
  draftSearchQuery,
  setDraftSearchQuery,
  selectedDraftIds,
  toggleSelectDraft,
  toggleSelectAllDrafts,
  handleVerifyAndPostDraft,
  handleVerifyBatchDrafts,
  handleDeleteDraft,
  handleDeleteBatchDrafts,
  handleSyncAllModules,
  isSyncing
}) => {
  return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Antrean Verifikasi Pembukuan (Staging)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 font-mono">
                  {filteredDraftJournals.length} Draf
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Setiap transaksi dapat diedit atau dihapus sebelum disetujui untuk dibukukan resmi ke Jurnal Umum.
              </p>
            </div>
            {draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length > 0 && (
              <button
                onClick={handleBulkVerifyDrafts}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check size={14} />
                <span>Setujui Semua Draf ({draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length})</span>
              </button>
            )}
          </div>

          {/* Search, Month Filter & Sort Bar untuk Draf Jurnal */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Referensi, Keterangan, Akun, Modul..."
                  value={draftSearchQuery}
                  onChange={e => setDraftSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
                />
                {draftSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDraftSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Bulan (Default Aktif ke Bulan Ini) */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px] hidden sm:inline">Periode:</span>
                <input
                  type="month"
                  value={draftFilterMonth === 'all' ? '' : draftFilterMonth}
                  onChange={e => setDraftFilterMonth(e.target.value || 'all')}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  title="Pilih Bulan Spesifik untuk Verifikasi Draf"
                />
                {draftFilterMonth !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setDraftFilterMonth('all')}
                    className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                    title="Tampilkan seluruh data tanpa batasan bulan"
                  >
                    Semua Periode
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDraftFilterMonth(defaultPeriod)}
                    className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                    title="Kembali ke filter bulan ini untuk performa lebih cepat"
                  >
                    Bulan Ini ({defaultPeriod})
                  </button>
                )}
                {draftFilterMonth !== 'all' && draftFilterMonth !== defaultPeriod && (
                  <button
                    type="button"
                    onClick={() => setDraftFilterMonth(defaultPeriod)}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                    title="Kembali ke bulan ini"
                  >
                    Bulan Ini
                  </button>
                )}
              </div>

              {/* Tombol Sort Tanggal */}
              <button
                type="button"
                onClick={() => setDraftSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                title={draftSortOrder === 'desc' ? 'Urutan saat ini: Terbaru ke Terlama. Klik untuk Terlama ke Terbaru' : 'Urutan saat ini: Terlama ke Terbaru. Klik untuk Terbaru ke Terlama'}
              >
                <ArrowUpDown size={13} className="text-blue-600" />
                <span className="hidden md:inline text-slate-500">Urut:</span>
                <span className="font-semibold text-slate-800">
                  {draftSortOrder === 'desc' ? 'Terbaru → Terlama' : 'Terlama → Terbaru'}
                </span>
              </button>
            </div>

            {(draftSearchQuery || draftFilterMonth !== defaultPeriod) && (
              <button
                type="button"
                onClick={() => {
                  setDraftSearchQuery('');
                  setDraftFilterMonth(defaultPeriod);
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <X size={12} />
                <span>Reset ke Bulan Ini ({filteredDraftJournals.length} Hasil)</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th 
                      className="p-3 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                      onClick={() => setDraftSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title="Klik untuk mengubah urutan tanggal transaksi (Terlama ↔ Terbaru)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Waktu / Tgl</span>
                        <span className="p-0.5 rounded text-blue-600 bg-blue-50">
                          {draftSortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        </span>
                      </div>
                    </th>
                    <th className="p-3">Sumber Modul</th>
                    <th className="p-3">Referensi</th>
                    <th className="p-3">Keterangan Transaksi</th>
                    <th className="p-3">Akun Debit</th>
                    <th className="p-3">Akun Kredit</th>
                    <th className="p-3 text-right">Nominal</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi Verifikasi & Modifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDraftJournals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-slate-500 italic">
                            {draftSearchQuery || draftFilterMonth !== 'all'
                              ? `Tidak ada draf jurnal yang sesuai dengan filter ${draftFilterMonth !== 'all' ? `periode (${draftFilterMonth})` : ''} ${draftSearchQuery ? `kata kunci "${draftSearchQuery}"` : ''}.`
                              : 'Belum ada draf jurnal transaksi. Transaksi operasional baru akan otomatis masuk ke antrean ini.'}
                          </p>
                          {draftFilterMonth !== 'all' && (
                            <button
                              type="button"
                              onClick={() => setDraftFilterMonth('all')}
                              className="px-3 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                            >
                              Tampilkan Semua Periode ({draftJournals.length} total draf)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDraftJournals.map((d, dIdx) => {
                      const coaDebit = coas.find(c => c.KODE_AKUN === d.Kode_Debit);
                      const coaKredit = coas.find(c => c.KODE_AKUN === d.Kode_Kredit);
                      return (
                        <tr key={`draft-row-${d.ID_Draf || 'item'}-${dIdx}`} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono">{formatDateDDMMYYYY(d.Tanggal)}</td>
                          <td className="p-3 font-medium">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                              {d.Sumber}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] font-semibold text-slate-700">{d.Referensi}</td>
                          <td className="p-3 max-w-xs">{d.Keterangan}</td>
                          <td className="p-3 font-mono text-[11px] text-emerald-700">
                            {d.Kode_Debit} ({coaDebit?.NAMA_AKUN || 'Debit'})
                          </td>
                          <td className="p-3 font-mono text-[11px] text-blue-700">
                            {d.Kode_Kredit} ({coaKredit?.NAMA_AKUN || 'Kredit'})
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            Rp {d.Nominal.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              d.Status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.Status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {d.Status === 'Menunggu Verifikasi' && (
                                <button
                                  onClick={() => handleVerifyDraft(d.ID_Draf)}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs cursor-pointer"
                                  title="Posting Jurnal Resmi"
                                >
                                  Posting
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditDraft(d)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Draf"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(d.ID_Draf)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Draf"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
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