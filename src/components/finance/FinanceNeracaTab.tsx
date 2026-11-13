import React from 'react';
import { 
  Scale, Download, FileDown, Printer, CheckCircle2, AlertTriangle 
} from 'lucide-react';
import { COAItem, FixedAssetItem } from '../../types';
import { exportDataToExcel } from '../../services/excelService';

interface FinanceNeracaTabProps {
  filterPeriod: string;
  setFilterPeriod: (val: string) => void;
  kasKecil: number;
  kasBankBSI: number;
  kasBankBRI?: number;
  piutangUsaha: number;
  piutangKasbon?: number;
  persediaanBahan: number;
  persediaanBarangJadi: number;
  totalAktivaLancar: number;
  totalAktivaTetap: number;
  tanahBangunan?: number;
  mesinProduksi?: number;
  kendaraanArmada?: number;
  totalAkumulasiPenyusutan?: number;
  totalAktivaTetapNetto?: number;
  akumulasiPenyusutan: number;
  nilaiBukuAset: number;
  totalAktiva: number;
  utangUsaha: number;
  utangUsahaSupplier?: number;
  utangGaji: number;
  utangBPJSPajak?: number;
  totalKewajibanPendek?: number;
  totalKewajibanLancar: number;
  utangBank?: number;
  totalKewajiban: number;
  modalDisetor: number;
  labaDitahan: number;
  labaTahunBerjalan: number;
  totalEkuitas: number;
  totalPasiva: number;
  isBalance: boolean;
  selisihBalance: number;
  handleExportNeracaPDF: () => void;
  assets: FixedAssetItem[];
  coas: COAItem[];
}

export const FinanceNeracaTab: React.FC<FinanceNeracaTabProps> = ({
  filterPeriod,
  setFilterPeriod,
  kasKecil = 0,
  kasBankBSI = 0,
  kasBankBRI = 0,
  piutangUsaha = 0,
  piutangKasbon = 0,
  persediaanBahan = 0,
  persediaanBarangJadi = 0,
  totalAktivaLancar = 0,
  totalAktivaTetap = 0,
  tanahBangunan = 0,
  mesinProduksi = 0,
  kendaraanArmada = 0,
  totalAkumulasiPenyusutan = 0,
  totalAktivaTetapNetto = 0,
  akumulasiPenyusutan = 0,
  nilaiBukuAset = 0,
  totalAktiva = 0,
  utangUsaha = 0,
  utangUsahaSupplier = 0,
  utangGaji = 0,
  utangBPJSPajak = 0,
  totalKewajibanPendek = 0,
  totalKewajibanLancar = 0,
  utangBank = 0,
  totalKewajiban = 0,
  modalDisetor = 0,
  labaDitahan = 0,
  labaTahunBerjalan = 0,
  totalEkuitas = 0,
  totalPasiva = 0,
  isBalance = false,
  selisihBalance = 0,
  handleExportNeracaPDF,
  assets = [],
  coas = []
}) => {
  const finalAkumulasiPenyusutan = totalAkumulasiPenyusutan || akumulasiPenyusutan || 0;
  const finalAktivaTetapNetto = totalAktivaTetapNetto || totalAktivaTetap || nilaiBukuAset || 0;
  const finalUtangUsaha = utangUsahaSupplier || utangUsaha || 0;
  const finalKewajibanPendek = totalKewajibanPendek || totalKewajibanLancar || 0;
  return (
        <div className="space-y-5 w-full min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs no-print w-full min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Periode Neraca:</label>
              <input
                type="month"
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  const dataRows = [
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Kas Kecil', Saldo: kasKecil },
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Kas Bank BSI', Saldo: kasBankBSI },
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Piutang Usaha', Saldo: piutangUsaha },
                    { Kategori: 'AKTIVA LANCAR', Akun: 'Persediaan', Saldo: persediaanBahan + persediaanBarangJadi },
                    { Kategori: 'TOTAL AKTIVA', Akun: 'Total Aktiva', Saldo: totalAktiva },
                    { Kategori: 'TOTAL PASIVA', Akun: 'Total Kewajiban & Modal', Saldo: totalPasiva }
                  ];
                  exportDataToExcel(dataRows, 'Laporan_Neraca', `AIRIS_Neraca_${filterPeriod}`);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportNeracaPDF}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileDown size={14} />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Cetak Neraca</span>
              </button>
            </div>
          </div>

          {/* Balance Indicator Status */}
          <div className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print w-full min-w-0 ${
            isBalance 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
              {isBalance ? (
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div className="min-w-0">
                <span className="font-bold text-xs uppercase tracking-wide block truncate">
                  Status Keseimbangan Neraca (Balance Verification)
                </span>
                <span className="text-xs text-slate-700 block break-words mt-0.5">
                  {isBalance 
                    ? 'NERACA SEIMBANG (BALANCED): Total Aktiva sama persis dengan Total Pasiva.' 
                    : `PERINGATAN SELISIH: Terdapat perbedaan Rp ${(selisihBalance || 0).toLocaleString('id-ID')} antara Aktiva dan Pasiva.`}
                </span>
              </div>
            </div>
            <div className="sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-200/60 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Nilai Neraca</span>
              <span className="text-sm font-mono font-black text-slate-900">Rp {totalAktiva.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* T-Account Balance Sheet Paper Display */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm text-slate-900 print:border-none print:shadow-none print:p-0 printable-content">
            <div className="text-center pb-6 border-b-2 border-slate-900">
              <h2 className="text-lg font-black text-blue-900 uppercase tracking-wide">PT. ANUGERAH ILLAHI RABBI</h2>
              <h3 className="text-sm font-bold text-slate-800 uppercase mt-1">LAPORAN POSISI KEUANGAN (NERACA)</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Per {filterPeriod}-30 (Berdasarkan Standar SAK EMKM)</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-6">
              {/* SISI KIRI: AKTIVA */}
              <div className="space-y-6">
                <div className="border-b border-slate-300 pb-1.5">
                  <h3 className="text-sm font-bold text-blue-900 tracking-tight uppercase">AKTIVA (ASET PERUSAHAAN)</h3>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Aset Lancar</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kas Kecil (Petty Cash Pabrik)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kasKecil.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kas Bank BSI 1607134444</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kasBankBSI.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kas Bank BRI Operasional</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kasBankBRI.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Piutang Usaha (Toko & Mitra)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {piutangUsaha.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Piutang Kasbon Karyawan</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {piutangKasbon.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Persediaan Bahan Baku & Penolong</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {persediaanBahan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Persediaan Barang Jadi (Air Minum)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {persediaanBarangJadi.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Aset Lancar</span>
                      <span className="font-mono tabular-nums">Rp {totalAktivaLancar.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Aset Tetap</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Tanah & Bangunan Pabrik</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {tanahBangunan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Mesin Produksi & Water Treatment</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {mesinProduksi.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Kendaraan Armada Distribusi</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {kendaraanArmada.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                      <span>Akumulasi Penyusutan Mesin & Armada</span>
                      <span className="font-mono tabular-nums font-semibold">(Rp {finalAkumulasiPenyusutan.toLocaleString('id-ID')})</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Nilai Buku Aset Tetap</span>
                      <span className="font-mono tabular-nums">Rp {finalAktivaTetapNetto.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center text-sm font-black text-blue-950">
                  <span>TOTAL AKTIVA</span>
                  <span className="font-mono tabular-nums text-base">Rp {totalAktiva.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* SISI KANAN: PASIVA */}
              <div className="space-y-6">
                <div className="border-b border-slate-300 pb-1.5">
                  <h3 className="text-sm font-bold text-blue-900 tracking-tight uppercase">PASIVA (KEWAJIBAN & EKUITAS)</h3>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Liabilitas Jangka Pendek</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang Usaha (Supplier Bahan)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {finalUtangUsaha.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang Gaji & Upah Karyawan</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangGaji.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang BPJS & Pajak PPh 21</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangBPJSPajak.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Liabilitas Pendek</span>
                      <span className="font-mono tabular-nums">Rp {finalKewajibanPendek.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Liabilitas Jangka Panjang</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Utang Bank Jangka Panjang</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {utangBank.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Kewajiban</span>
                      <span className="font-mono tabular-nums">Rp {totalKewajiban.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Ekuitas</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Modal Disetor Pemilik</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {modalDisetor.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Laba Ditahan (Retained Earnings)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {labaDitahan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 text-indigo-700">
                      <span>Laba Tahun Berjalan (Laba Rugi)</span>
                      <span className="font-mono tabular-nums font-semibold">Rp {labaTahunBerjalan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between pt-2 font-bold text-slate-800 bg-slate-50 px-2 py-1 rounded">
                      <span>Total Ekuitas</span>
                      <span className="font-mono tabular-nums">Rp {totalEkuitas.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center text-sm font-black text-blue-950">
                  <span>TOTAL PASIVA</span>
                  <span className="font-mono tabular-nums text-base">Rp {totalPasiva.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
  );
};