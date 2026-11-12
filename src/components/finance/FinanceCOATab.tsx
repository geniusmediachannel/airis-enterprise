import React from 'react';
import { 
  FolderOpen, Plus, Download, Search, Edit2, Trash2, X, Save, Sparkles, Building2 
} from 'lucide-react';
import { COAItem } from '../../types';

interface FinanceCOATabProps {
  filteredCoas: COAItem[];
  searchCoa: string;
  setSearchCoa: (val: string) => void;
  onOpenAddCoa: () => void;
  onEditCoa: (item: COAItem) => void;
  onDeleteCoa: (kode: string) => void;
  handleExportCoaExcel: () => void;
  handleUpgradeCOA: () => void;
  showCoaModal: boolean;
  setShowCoaModal: (val: boolean) => void;
  editingCoa: COAItem | null;
  coaForm: any;
  setCoaForm: React.Dispatch<React.SetStateAction<any>>;
  handleSaveCoa: () => void;
}

export const FinanceCOATab: React.FC<FinanceCOATabProps> = ({
  filteredCoas,
  searchCoa,
  setSearchCoa,
  onOpenAddCoa,
  onEditCoa,
  onDeleteCoa,
  handleExportCoaExcel,
  handleUpgradeCOA,
  showCoaModal,
  setShowCoaModal,
  editingCoa,
  coaForm,
  setCoaForm,
  handleSaveCoa
}) => {
  return (
    <>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bagan Akun Standar Manufaktur (Master COA)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Seluruh akun dapat diedit, dihapus, atau ditambah akun baru sesuai kebutuhan.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cari kode / nama akun..."
                value={searchCoa}
                onChange={e => setSearchCoa(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none w-52"
              />
              <button
                onClick={handleResetFactoryCoa}
                className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                title="Terapkan Seluruh Bagan Akun Standar Akuntansi Pabrik & Manufaktur"
              >
                <RefreshCw size={14} className="text-emerald-600" />
                <span>Terapkan Standar Pabrik</span>
              </button>
              <button
                onClick={handleOpenAddCoa}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus size={14} />
                <span>Tambah Akun COA</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Kode Akun</th>
                    <th className="p-3">Nama Akun</th>
                    <th className="p-3">Kategori Laporan</th>
                    <th className="p-3">Saldo Normal</th>
                    <th className="p-3 text-right">Saldo Terkini</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {coas
                    .filter(c => 
                      c.KODE_AKUN.toLowerCase().includes(searchCoa.toLowerCase()) ||
                      c.NAMA_AKUN.toLowerCase().includes(searchCoa.toLowerCase())
                    )
                    .map(c => {
                      const bal = getBalance(c.KODE_AKUN);
                      return (
                        <tr key={c.KODE_AKUN} className="hover:bg-slate-50/70">
                          <td className="p-3 font-bold text-blue-800">{c.KODE_AKUN}</td>
                          <td className="p-3 font-sans font-medium text-slate-900">{c.NAMA_AKUN}</td>
                          <td className="p-3 font-sans text-slate-600">{c.KATEGORI}</td>
                          <td className="p-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              c.SALDO_NORMAL === 'Debit' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {c.SALDO_NORMAL}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                            Rp {bal.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center font-sans">
                            <span className="text-emerald-700 font-medium text-[11px]">{c.STATUS}</span>
                          </td>
                          <td className="p-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditCoa(c)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                title="Edit Akun"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCoa(c.KODE_AKUN)}
                                className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus Akun"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB: ASET TETAP & PENYUSUTAN                           */}
      {/* ========================================================= */}
      {activeTab === 'aset' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingCoa ? `Edit Akun (${editingCoa.KODE_AKUN})` : 'Tambah Akun Baru (COA)'}
              </h3>
              <button onClick={() => setShowCoaModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Akun</label>
                <input
                  type="text"
                  value={coaForm.KODE_AKUN}
                  readOnly={Boolean(editingCoa)}
                  placeholder="Contoh: 111-99"
                  onChange={e => setCoaForm({ ...coaForm, KODE_AKUN: e.target.value })}
                  className={`w-full px-3 py-1.5 border rounded-lg font-mono font-bold ${
                    editingCoa ? 'bg-slate-100 text-slate-500' : 'bg-white border-slate-300'
                  }`}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Akun</label>
                <input
                  type="text"
                  value={coaForm.NAMA_AKUN}
                  onChange={e => setCoaForm({ ...coaForm, NAMA_AKUN: e.target.value })}
                  placeholder="Nama Akun Standar..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Akun</label>
                <select
                  value={coaForm.KATEGORI}
                  onChange={e => setCoaForm({ ...coaForm, KATEGORI: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-medium text-slate-800"
                >
                  <option value="Aset Lancar">Aset Lancar</option>
                  <option value="Aset Tetap">Aset Tetap</option>
                  <option value="Kontra Aset">Kontra Aset (Penyusutan)</option>
                  <option value="Liabilitas Pendek">Liabilitas Jangka Pendek</option>
                  <option value="Liabilitas Panjang">Liabilitas Jangka Panjang</option>
                  <option value="Ekuitas">Ekuitas / Modal</option>
                  <option value="Pendapatan">Pendapatan Operasional</option>
                  <option value="Harga Pokok">Harga Pokok Penjualan (HPP)</option>
                  <option value="Beban">Beban Operasional & Umum</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Saldo Normal</label>
                  <select
                    value={coaForm.SALDO_NORMAL}
                    onChange={e => setCoaForm({ ...coaForm, SALDO_NORMAL: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  >
                    <option value="Debit">Debit</option>
                    <option value="Kredit">Kredit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={coaForm.STATUS}
                    onChange={e => setCoaForm({ ...coaForm, STATUS: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Non-Aktif">Non-Aktif</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowCoaModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveCoa} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Draf Jurnal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                Edit Draf Jurnal ({editingDraft?.ID_Draf})
              </h3>
              <button onClick={() => setShowDraftModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan Transaksi</label>
                <input
                  type="text"
                  value={draftForm.Keterangan}
                  onChange={e => setDraftForm({ ...draftForm, Keterangan: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Akun Debit</label>
                  <select
                    value={draftForm.Kode_Debit}
                    onChange={e => setDraftForm({ ...draftForm, Kode_Debit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold"
                  >
                    {coas.map(c => (
                      <option key={c.KODE_AKUN} value={c.KODE_AKUN}>{c.KODE_AKUN} - {c.NAMA_AKUN}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Akun Kredit</label>
                  <select
                    value={draftForm.Kode_Kredit}
                    onChange={e => setDraftForm({ ...draftForm, Kode_Kredit: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold"
                  >
                    {coas.map(c => (
                      <option key={c.KODE_AKUN} value={c.KODE_AKUN}>{c.KODE_AKUN} - {c.NAMA_AKUN}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Transaksi (Rp)</label>
                <input
                  type="number"
                  value={draftForm.Nominal}
                  onChange={e => setDraftForm({ ...draftForm, Nominal: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowDraftModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveDraft} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Aset Tetap */}
      {showAssetModal && (
    </>
  );
};