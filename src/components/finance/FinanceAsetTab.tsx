import React, { useState, useMemo } from 'react';
import { 
  Building2, Plus, Download, Edit2, Trash2, X, Save,
  Package, CheckCircle2, RotateCcw, AlertCircle, Sparkles, ArrowRight
} from 'lucide-react';
import { FixedAssetItem, GeneralJournalItem, DistributionItem } from '../../types';
import { 
  getTableData, 
  getGallonDepreciationRate, 
  setGallonDepreciationRate, 
  DEFAULT_GALLON_DEPRECIATION_RATE 
} from '../../services/dbAdapter';

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
  const [depRate, setDepRate] = useState<number>(getGallonDepreciationRate());
  const [rateSavedToast, setRateSavedToast] = useState<boolean>(false);

  // Perhitungan statistik penyusutan galon dari Jurnal Umum & Distribusi
  const { totalDepJurnal, totalGalonMitra, totalTransaksiMitra } = useMemo(() => {
    const journals = getTableData<GeneralJournalItem>('Jurnal_Umum', []);
    const distributions = getTableData<DistributionItem>('Distribusi', []);

    // Total debit beban penyusutan galon 514-70
    const depJournals = journals.filter(j => j.KODE_AKUN === '514-70');
    const totalDep = depJournals.reduce((sum, j) => sum + (Number(j.DEBIT) || 0), 0);

    // Distribusi ke Sekolah Mitra / Pinjam Galon
    const mitraDists = distributions.filter(d => d.Level_Pelanggan === 'Sekolah Mitra' || d.Tipe_Transaksi_Galon === 'Pinjam Galon');
    const galonCount = mitraDists.reduce((sum, d) => sum + (Number(d.G19 || (d as any)['ASH-GLN19L'] || 0)), 0);

    return {
      totalDepJurnal: totalDep,
      totalGalonMitra: galonCount,
      totalTransaksiMitra: mitraDists.length
    };
  }, []);

  const handleSaveRate = () => {
    const val = Math.max(0, Number(depRate) || 0);
    setGallonDepreciationRate(val);
    setRateSavedToast(true);
    setTimeout(() => setRateSavedToast(false), 3000);
  };

  const handleResetRate = () => {
    setDepRate(DEFAULT_GALLON_DEPRECIATION_RATE);
    setGallonDepreciationRate(DEFAULT_GALLON_DEPRECIATION_RATE);
    setRateSavedToast(true);
    setTimeout(() => setRateSavedToast(false), 3000);
  };

  return (
    <>
        <div className="space-y-4">
          {/* Card Skema Penyusutan Galon Investasi Pabrik (Sekolah Mitra) */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-700/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/80 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/80 text-white rounded-xl shadow-md border border-indigo-400/30">
                  <Package size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">Penyusutan Galon Pabrik (Sekolah Mitra)</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      HPP Refill Otomatis
                    </span>
                  </div>
                  <p className="text-xs text-indigo-300/90 mt-0.5">
                    Metode Unit Produksi / Putaran: Galon investasi pabrik disusutkan 40x isi ulang (refill cycle) per pengiriman ke mitra sekolah.
                  </p>
                </div>
              </div>

              {/* Form Input Custom Tarif Penyusutan */}
              <div className="flex items-center gap-2 bg-indigo-950/70 p-1.5 rounded-xl border border-indigo-700/60 self-start sm:self-auto">
                <div className="flex items-center pl-2">
                  <span className="text-xs text-indigo-300 font-semibold mr-1.5">Tarif / Galon:</span>
                  <span className="text-xs text-indigo-400 font-mono">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={depRate}
                    onChange={e => setDepRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-24 px-2 py-1 ml-1 text-xs font-mono font-bold bg-white text-indigo-950 rounded-lg outline-none border border-indigo-300 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <button
                  onClick={handleSaveRate}
                  className="px-3 py-1 text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                  title="Simpan tarif penyusutan aktif"
                >
                  <Save size={13} />
                  <span>Simpan</span>
                </button>
                <button
                  onClick={handleResetRate}
                  className="p-1.5 text-indigo-300 hover:text-white hover:bg-indigo-800 rounded-lg transition-colors cursor-pointer"
                  title="Kembalikan ke tarif default (Rp 1.250)"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {rateSavedToast && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs animate-in fade-in">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Tarif penyusutan berhasil diperbarui menjadi <strong>Rp {depRate.toLocaleString('id-ID')} / galon</strong>.</span>
              </div>
            )}

            {/* Statistik & Pemetaan Akun Jurnal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-800/60">
                <span className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold block">Total Beban Terjurnal</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-mono font-bold text-white">Rp {totalDepJurnal.toLocaleString('id-ID')}</span>
                </div>
                <span className="text-[10px] text-indigo-400 mt-0.5 block">Akun Debet: 514-70 (HPP Refill Mitra)</span>
              </div>

              <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-800/60">
                <span className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold block">Galon Terkirim ke Mitra</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-mono font-bold text-emerald-400">{totalGalonMitra.toLocaleString('id-ID')}</span>
                  <span className="text-xs text-indigo-300">Galon ({totalTransaksiMitra} Pengiriman)</span>
                </div>
                <span className="text-[10px] text-indigo-400 mt-0.5 block">Level: Sekolah Mitra / Pinjam Galon</span>
              </div>

              <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-800/60">
                <span className="text-[11px] text-indigo-300 uppercase tracking-wider font-semibold block">Akun Kontra Aset</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-mono font-bold text-sky-400">122-70</span>
                  <span className="text-xs text-indigo-300 ml-1">Akum. Penyusutan Galon</span>
                </div>
                <span className="text-[10px] text-indigo-400 mt-0.5 block">Aset Induk: 121-70 (Aset Galon Pabrik)</span>
              </div>
            </div>

            <div className="text-[11px] text-indigo-300/80 bg-indigo-950/30 px-3 py-2 rounded-lg border border-indigo-800/40 flex items-center justify-between">
              <span>Jurnal Otomatis Tiap Distribusi: <strong>Debet [514-70] Beban Penyusutan</strong> vs <strong>Kredit [122-70] Akumulasi Penyusutan Galon</strong>.</span>
              <span className="font-mono text-indigo-200">Default: Rp 50.000 / 40x = Rp 1.250</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Aktiva Tetap & Jadwal Penyusutan</h3>
              <p className="text-xs text-slate-500 mt-0.5">Pencatatan aset mesin, armada, dan fasilitas pabrik AMDK.</p>
            </div>
            <button
              onClick={onOpenAddAsset}
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
                            <button onClick={() => onEditAsset(a)} className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer" title="Edit Aset">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => onDeleteAsset(a.ID_ASET)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Hapus Aset">
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

      {/* Modal Add/Edit Asset */}
      {showAssetModal && (
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
    </>
  );
};