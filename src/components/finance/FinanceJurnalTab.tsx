import React from 'react';
import { 
  FileText, Plus, Download, Printer, Search, Edit2, Trash2, X, Save 
} from 'lucide-react';
import { GeneralJournalItem, COAItem } from '../../types';

interface FinanceJurnalTabProps {
  filteredJournals: GeneralJournalItem[];
  journalSearchQuery: string;
  setJournalSearchQuery: (val: string) => void;
  filterPeriod: string;
  setFilterPeriod: (val: string) => void;
  coas: COAItem[];
  onOpenAddJournal: () => void;
  onOpenDoubleEntry: () => void;
  onEditJournal: (item: GeneralJournalItem) => void;
  onDeleteJournal: (id: string) => void;
  handleExportJournalExcel: () => void;
  showJournalModal: boolean;
  setShowJournalModal: (val: boolean) => void;
  editingJournal: GeneralJournalItem | null;
  journalForm: any;
  setJournalForm: React.Dispatch<React.SetStateAction<any>>;
  handleSaveJournal: () => void;
}

export const FinanceJurnalTab: React.FC<FinanceJurnalTabProps> = ({
  filteredJournals,
  journalSearchQuery,
  setJournalSearchQuery,
  filterPeriod,
  setFilterPeriod,
  coas,
  onOpenAddJournal,
  onOpenDoubleEntry,
  onEditJournal,
  onDeleteJournal,
  handleExportJournalExcel,
  showJournalModal,
  setShowJournalModal,
  editingJournal,
  journalForm,
  setJournalForm,
  handleSaveJournal
}) => {
  return (
    <>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700">Filter Periode:</label>
                {filterPeriod === 'all' ? (
                  <span className="px-3 py-1.5 text-xs font-mono font-bold bg-blue-100 text-blue-800 rounded-lg border border-blue-300">
                    Semua Periode (All-Time)
                  </span>
                ) : (
                  <input
                    type="month"
                    value={filterPeriod}
                    onChange={e => setFilterPeriod(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {filterPeriod !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setFilterPeriod('all')}
                    className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                    title="Tampilkan seluruh data tanpa batasan bulan"
                  >
                    Semua Periode
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilterPeriod(defaultPeriod)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 cursor-pointer transition-colors"
                    title="Kembali ke filter bulan ini"
                  >
                    Bulan Ini
                  </button>
                )}
              </div>

              {/* Search Bar Jurnal Umum */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari ID Jurnal, Ref, Keterangan, Akun..."
                  value={journalSearchQuery}
                  onChange={e => setJournalSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
                {journalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setJournalSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {journalSearchQuery && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  {filteredJournals.length} baris cocok
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportDataToExcel(filteredJournals, 'Jurnal_Umum', `AIRIS_Jurnal_${filterPeriod}`, `JURNAL UMUM TRANSAKSI - PERIODE ${filterPeriod}`)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => {
                  const headers = ['Tanggal', 'ID Jurnal', 'Referensi', 'Keterangan', 'Akun', 'Debit', 'Kredit'];
                  const rows = filteredJournals.map(j => [j.TANGGAL, j.ID_JURNAL, j.REFERENSI, j.KETERANGAN, j.KODE_AKUN, j.DEBIT, j.KREDIT]);
                  generateTableReportPDF({
                    title: 'JURNAL UMUM TRANSAKSI',
                    subtitle: `Periode ${filterPeriod}`,
                    headers,
                    rows,
                    filename: `Jurnal_${filterPeriod}.pdf`
                  });
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileDown size={14} />
                <span>PDF</span>
              </button>
              <button
                onClick={handleOpenAddJournal}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Tambah Jurnal Manual</span>
              </button>
            </div>
          </div>

          {/* Card Ringkasan Keseimbangan Jurnal (Double-Entry Balance Indicator) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Debit ({filterPeriod === 'all' ? 'Semua' : filterPeriod})</span>
              <span className="text-lg font-black text-slate-900 font-mono">Rp {journalTotalDebit.toLocaleString('id-ID')}</span>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 block uppercase">Total Kredit ({filterPeriod === 'all' ? 'Semua' : filterPeriod})</span>
              <span className="text-lg font-black text-slate-900 font-mono">Rp {journalTotalKredit.toLocaleString('id-ID')}</span>
            </div>
            <div className={`p-3.5 rounded-lg border shadow-2xs flex flex-col justify-between ${
              isJournalBalanced 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                : 'bg-red-50/80 border-red-200 text-red-950'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">Status Pembukuan</span>
                {isJournalBalanced ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={13} /> SEIMBANG (BALANCED)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                    <AlertTriangle size={13} /> SELISIH Rp {journalDiff.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-600">
                  {isJournalBalanced 
                    ? 'Debit dan Kredit 100% cocok presisi.' 
                    : 'Terdapat selisih antara Debit dan Kredit.'}
                </span>
                {!isJournalBalanced && (
                  <button
                    onClick={handleReconcileJournals}
                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-2xs flex items-center gap-1 cursor-pointer"
                    title="Perbaiki dan seimbangkan transaksi jurnal secara otomatis"
                  >
                    <RefreshCw size={11} /> Seimbangkan
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">ID Jurnal</th>
                    <th className="p-3">No. Ref</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3">Kode Akun</th>
                    <th className="p-3 text-right">Debit (Rp)</th>
                    <th className="p-3 text-right">Kredit (Rp)</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic">
                        {journalSearchQuery 
                          ? `Tidak ada entri jurnal yang cocok dengan kata kunci "${journalSearchQuery}" pada periode ${filterPeriod}.`
                          : `Tidak ada entri jurnal pada periode ${filterPeriod}.`}
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map((j, i) => {
                      const coa = coas.find(c => c.KODE_AKUN === j.KODE_AKUN);
                      const isCredit = Number(j.KREDIT) > 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="p-3 text-slate-500 font-mono">{formatDateDDMMYYYY(j.TANGGAL)}</td>
                          <td className="p-3 font-semibold text-blue-700">{j.ID_JURNAL}</td>
                          <td className="p-3 text-slate-700">{j.REFERENSI}</td>
                          <td className={`p-3 font-sans ${isCredit ? 'pl-8 text-slate-600' : 'font-medium text-slate-900'}`}>
                            {j.KETERANGAN}
                          </td>
                          <td className="p-3 text-slate-700">
                            {j.KODE_AKUN} <span className="font-sans text-[11px] text-slate-400">({coa?.NAMA_AKUN})</span>
                          </td>
                          <td className="p-3 text-right tabular-nums font-semibold text-slate-900">
                            {Number(j.DEBIT) > 0 ? Number(j.DEBIT).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="p-3 text-right tabular-nums font-semibold text-slate-900">
                            {Number(j.KREDIT) > 0 ? Number(j.KREDIT).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="p-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditJournal(j)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Baris Jurnal"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteJournal(j)}
                                className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Baris Jurnal"
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
                <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={5} className="p-3 text-right font-sans font-bold text-slate-700 uppercase tracking-wider">
                      TOTAL ({filteredJournals.length} Baris):
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-950 text-sm font-black">
                      Rp {journalTotalDebit.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-950 text-sm font-black">
                      Rp {journalTotalKredit.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center font-sans">
                      {isJournalBalanced ? (
                        <span className="inline-flex items-center text-emerald-600 font-bold text-[11px]" title="Seimbang">
                          <CheckCircle2 size={15} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 font-bold text-[11px]" title="Selisih">
                          <AlertTriangle size={15} />
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

      {/* Modal Double Entry / Edit Journal */}
      {showJournalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className={`bg-white rounded-xl shadow-2xl w-full border border-slate-200 overflow-hidden my-6 ${editingJournal ? 'max-w-md' : 'max-w-xl'}`}>
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-blue-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingJournal ? 'Edit Baris Jurnal Umum' : 'Tambah Jurnal Manual (Double-Entry Seimbang)'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setShowJournalModal(false);
                  setEditingJournal(null);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {editingJournal ? (
              /* FORM MODE EDIT SATU BARIS */
              <div className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ID Jurnal</label>
                    <input
                      type="text"
                      value={journalForm.ID_JURNAL}
                      readOnly
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-slate-100 text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                    <input
                      type="date"
                      value={journalForm.TANGGAL}
                      onChange={e => {
                        const val = e.target.value;
                        setJournalForm({ ...journalForm, TANGGAL: val, PERIODE: val.slice(0, 7) });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Referensi</label>
                  <input
                    type="text"
                    value={journalForm.REFERENSI}
                    onChange={e => setJournalForm({ ...journalForm, REFERENSI: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi</label>
                  <input
                    type="text"
                    value={journalForm.KETERANGAN}
                    onChange={e => setJournalForm({ ...journalForm, KETERANGAN: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Akun (COA)</label>
                  <select
                    value={journalForm.KODE_AKUN}
                    onChange={e => setJournalForm({ ...journalForm, KODE_AKUN: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-slate-800 font-semibold"
                  >
                    {coas.map(c => (
                      <option key={c.KODE_AKUN} value={c.KODE_AKUN}>
                        {c.KODE_AKUN} - {c.NAMA_AKUN} ({c.KATEGORI})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nominal Debit (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={journalForm.DEBIT ?? ''}
                      onChange={e => setJournalForm({ ...journalForm, DEBIT: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0), KREDIT: 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nominal Kredit (Rp)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={journalForm.KREDIT ?? ''}
                      onChange={e => setJournalForm({ ...journalForm, KREDIT: e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0), DEBIT: 0 })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* FORM MODE TAMBAH BARU (DOUBLE-ENTRY BERPASANGAN) */
              <div className="p-5 space-y-4 text-xs">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900 flex items-start gap-2.5">
                  <Scale size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Prinsip Akuntansi Berpasangan (Double-Entry):</strong> Setiap transaksi jurnal manual akan secara otomatis membuat 2 baris seimbang berpasangan: satu di sisi <strong>Debit</strong> dan satu di sisi <strong>Kredit</strong> dengan nominal yang sama persis.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Jurnal (Otomatis)</label>
                    <input
                      type="text"
                      value={doubleEntryForm.ID_JURNAL}
                      readOnly
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-slate-100 text-slate-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Transaksi</label>
                    <input
                      type="date"
                      value={doubleEntryForm.TANGGAL}
                      onChange={e => {
                        const val = e.target.value;
                        setDoubleEntryForm({ ...doubleEntryForm, TANGGAL: val, PERIODE: val.slice(0, 7) });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No. Ref / Dokumen</label>
                    <input
                      type="text"
                      value={doubleEntryForm.REFERENSI}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, REFERENSI: e.target.value })}
                      placeholder="MANUAL / BKK-01"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={doubleEntryForm.KETERANGAN}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, KETERANGAN: e.target.value })}
                      placeholder="Contoh: Pengisian Kas Kecil dari Bank, Pembayaran Listrik, dll."
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>
                </div>

                {/* SISI DEBIT & KREDIT */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                        1. Akun Sisi DEBIT (Bertambah / Masuk)
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Aset bertambah, Beban bertambah</span>
                    </div>
                    <select
                      value={doubleEntryForm.KODE_DEBIT}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, KODE_DEBIT: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-slate-800 font-semibold bg-white"
                    >
                      {coas.map(c => (
                        <option key={c.KODE_AKUN} value={c.KODE_AKUN}>
                          {c.KODE_AKUN} - {c.NAMA_AKUN} ({c.KATEGORI})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
                        2. Akun Sisi KREDIT (Berkurang / Keluar)
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium">Kas/Bank berkurang, Pendapatan, Modal</span>
                    </div>
                    <select
                      value={doubleEntryForm.KODE_KREDIT}
                      onChange={e => setDoubleEntryForm({ ...doubleEntryForm, KODE_KREDIT: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono text-slate-800 font-semibold bg-white"
                    >
                      {coas.map(c => (
                        <option key={c.KODE_AKUN} value={c.KODE_AKUN}>
                          {c.KODE_AKUN} - {c.NAMA_AKUN} ({c.KATEGORI})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nominal Transaksi (Rp) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        min="1"
                        value={doubleEntryForm.NOMINAL ?? ''}
                        onChange={e => setDoubleEntryForm({ ...doubleEntryForm, NOMINAL: e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0 })}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {Number(doubleEntryForm.NOMINAL) > 0 && (
                      <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                        Terbilang nominal: Rp {Number(doubleEntryForm.NOMINAL).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button 
                onClick={() => {
                  setShowJournalModal(false);
                  setEditingJournal(null);
                }} 
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveJournal} 
                className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Save size={14} />
                <span>{editingJournal ? 'Perbarui Baris' : 'Bukukan Jurnal Berpasangan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};