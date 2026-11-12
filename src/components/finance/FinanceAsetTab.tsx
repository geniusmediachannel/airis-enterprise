import React from 'react';
import { 
  Building2, Plus, Download, Edit2, Trash2, X, Save 
} from 'lucide-react';
import { FixedAssetItem } from '../../types';

interface FinanceAsetTabProps {
  assets: FixedAssetItem[];
  onOpenAddAsset: () => void;
  onEditAsset: (item: FixedAssetItem) => void;
  onDeleteAsset: (id: string) => void;
  handleExportAssetExcel: () => void;
  showAssetModal: boolean;
  setShowAssetModal: (val: boolean) => void;
  editingAsset: FixedAssetItem | null;
  assetForm: any;
  setAssetForm: React.Dispatch<React.SetStateAction<any>>;
  handleSaveAsset: () => void;
}

export const FinanceAsetTab: React.FC<FinanceAsetTabProps> = ({
  assets,
  onOpenAddAsset,
  onEditAsset,
  onDeleteAsset,
  handleExportAssetExcel,
  showAssetModal,
  setShowAssetModal,
  editingAsset,
  assetForm,
  setAssetForm,
  handleSaveAsset
}) => {
  return (
    <>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Aktiva Tetap & Jadwal Penyusutan</h3>
              <p className="text-xs text-slate-500 mt-0.5">Pencatatan aset mesin, armada, dan fasilitas pabrik AMDK.</p>
            </div>
            <button
              onClick={handleOpenAddAsset}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Tambah Aset Tetap</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">ID Aset</th>
                    <th className="p-3">Nama Aktiva</th>
                    <th className="p-3">Tgl Perolehan</th>
                    <th className="p-3 text-right">Nilai Perolehan</th>
                    <th className="p-3 text-right">Nilai Residu</th>
                    <th className="p-3 text-center">Umur (Bln)</th>
                    <th className="p-3 text-right">Susut / Bln</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {assets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic font-sans">
                        Belum ada aset tetap yang dicatat.
                      </td>
                    </tr>
                  ) : (
                    assets.map(a => (
                      <tr key={a.ID_ASET} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-blue-800">{a.ID_ASET}</td>
                        <td className="p-3 font-sans font-semibold text-slate-900">{a.NAMA_ASET}</td>
                        <td className="p-3 text-slate-500">{a.TGL_BELI}</td>
                        <td className="p-3 text-right font-bold text-slate-900 tabular-nums">Rp {a.NILAI_PEROLEHAN.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-right tabular-nums text-slate-600">Rp {a.NILAI_RESIDU.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center">{a.UMUR_EKONOMIS_BLN} Bln</td>
                        <td className="p-3 text-right font-bold text-red-600 tabular-nums">Rp {a.BEBAN_PENYUSUTAN_BLN.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-center font-sans">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleOpenEditAsset(a)} className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="Edit Aset">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDeleteAsset(a.ID_ASET)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Hapus Aset">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB: PIUTANG & UTANG REKAP - SINKRONISASI DISTRIBUSI & BUKU PELANGGAN */}
      {/* ========================================================= */}
      {activeTab === 'piutang' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingAsset ? `Edit Aset (${editingAsset.ID_ASET})` : 'Tambah Aset Tetap Baru'}
              </h3>
              <button onClick={() => setShowAssetModal(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Aset Tetap</label>
                <input
                  type="text"
                  value={assetForm.NAMA_ASET}
                  placeholder="Contoh: Mesin Water Treatment 8-Stage..."
                  onChange={e => setAssetForm({ ...assetForm, NAMA_ASET: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Perolehan</label>
                  <input
                    type="date"
                    value={assetForm.TGL_BELI}
                    onChange={e => setAssetForm({ ...assetForm, TGL_BELI: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Umur Ekonomis (Bulan)</label>
                  <input
                    type="number"
                    placeholder="Contoh: 48"
                    value={assetForm.UMUR_EKONOMIS_BLN ?? ''}
                    onChange={e => {
                      const m = parseInt(e.target.value, 10);
                      const np = Number(assetForm.NILAI_PEROLEHAN) || 0;
                      const nr = Number(assetForm.NILAI_RESIDU) || 0;
                      const susut = m > 0 ? Math.round((np - nr) / m) : 0;
                      setAssetForm({ ...assetForm, UMUR_EKONOMIS_BLN: e.target.value === '' ? ('' as any) : m, BEBAN_PENYUSUTAN_BLN: Math.max(0, susut) });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nilai Perolehan (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={assetForm.NILAI_PEROLEHAN ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0);
                      const m = Number(assetForm.UMUR_EKONOMIS_BLN) || 1;
                      const nr = Number(assetForm.NILAI_RESIDU) || 0;
                      const susut = Math.round(((Number(val) || 0) - nr) / m);
                      setAssetForm({ ...assetForm, NILAI_PEROLEHAN: val, BEBAN_PENYUSUTAN_BLN: Math.max(0, susut) });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nilai Residu (Rp)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={assetForm.NILAI_RESIDU ?? ''}
                    onChange={e => {
                      const res = e.target.value === '' ? ('' as any) : (parseFloat(e.target.value) || 0);
                      const m = Number(assetForm.UMUR_EKONOMIS_BLN) || 1;
                      const np = Number(assetForm.NILAI_PEROLEHAN) || 0;
                      const susut = Math.round((np - (Number(res) || 0)) / m);
                      setAssetForm({ ...assetForm, NILAI_RESIDU: res, BEBAN_PENYUSUTAN_BLN: Math.max(0, susut) });
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Beban Susut per Bulan (Rp)</label>
                <input
                  type="number"
                  value={assetForm.BEBAN_PENYUSUTAN_BLN}
                  readOnly
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-red-600 bg-slate-50"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button onClick={() => setShowAssetModal(false)} className="px-3.5 py-1.5 text-xs text-slate-600 font-medium cursor-pointer">Batal</button>
              <button onClick={handleSaveAsset} className="px-5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer">
                <Save size={14} />
                <span>Simpan Aset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit Piutang & Utang */}
      {showReceivableModal && (
    </>
  );
};