import React from 'react';
import { 
  TrendingUp, Download, FileDown, Printer 
} from 'lucide-react';
import { exportDataToExcel } from '../../services/excelService';

interface FinanceLabaRugiTabProps {
  filterPeriod: string;
  setFilterPeriod: (val: string) => void;
  pendapatanPenjualan: number;
  pendapatanLainnya: number;
  totalPendapatan: number;
  hppTotal: number;
  labaKotor: number;
  bebanOperasional: number;
  bebanPenyusutan: number;
  bebanGaji: number;
  totalBeban: number;
  labaBersih: number;
  handleExportLabaRugiPDF: () => void;
  revCup?: number;
  revBotol?: number;
  revGalon?: number;
  diskonPenjualan?: number;
  totalRevBersih?: number;
  hppBahan?: number;
  hppTenagaKerja?: number;
  hppListrikPabrik?: number;
  hppSusutMesin?: number;
  totalHPP?: number;
  bebanGajiStaff?: number;
  bebanPemasaran?: number;
  bebanDistribusiArmada?: number;
  bebanQCSNI?: number;
  bebanSusutKendaraan?: number;
  totalBebanOperasional?: number;
  labaBersihOperasional?: number;
  periodJournals?: any[];
}

export const FinanceLabaRugiTab: React.FC<FinanceLabaRugiTabProps> = ({
  filterPeriod,
  setFilterPeriod,
  pendapatanPenjualan,
  pendapatanLainnya,
  totalPendapatan,
  hppTotal,
  labaKotor,
  bebanOperasional,
  bebanPenyusutan,
  bebanGaji,
  totalBeban,
  labaBersih,
  handleExportLabaRugiPDF,
  revCup = 0,
  revBotol = 0,
  revGalon = 0,
  diskonPenjualan = 0,
  totalRevBersih = totalPendapatan,
  hppBahan = 0,
  hppTenagaKerja = 0,
  hppListrikPabrik = 0,
  hppSusutMesin = 0,
  totalHPP = hppTotal,
  bebanGajiStaff = bebanGaji,
  bebanPemasaran = 0,
  bebanDistribusiArmada = 0,
  bebanQCSNI = 0,
  bebanSusutKendaraan = bebanPenyusutan,
  totalBebanOperasional = totalBeban,
  labaBersihOperasional = labaBersih,
  periodJournals = []
}) => {
  return (
        <div className="space-y-5 w-full min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs no-print w-full min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Periode:</label>
              <input
                type="month"
                value={filterPeriod}
                onChange={e => setFilterPeriod(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono font-semibold border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => exportDataToExcel(periodJournals, 'Laba_Rugi', `AIRIS_LabaRugi_${filterPeriod}`)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportLabaRugiPDF}
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
                <span>Cetak Laporan</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto shadow-sm text-slate-900 print:border-none print:shadow-none printable-content">
            <div className="text-center pb-6 border-b-2 border-slate-900">
              <h2 className="text-lg font-black text-blue-900 uppercase">PT. ANUGERAH ILLAHI RABBI</h2>
              <h3 className="text-sm font-bold text-slate-800 uppercase mt-1">LAPORAN LABA RUGI OPERASIONAL</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Periode: {filterPeriod}</p>
            </div>

            <div className="py-6 space-y-6 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 border-b border-slate-200 pb-1">1. PENDAPATAN OPERASIONAL</h4>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penjualan Kemasan Cup (120ml / 220ml)</span>
                    <span className="font-mono font-semibold">Rp {revCup.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penjualan Kemasan Botol (330ml / 600ml)</span>
                    <span className="font-mono font-semibold">Rp {revBotol.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penjualan Galon 19L</span>
                    <span className="font-mono font-semibold">Rp {revGalon.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-red-600">
                    <span>Potongan / Diskon Ekspedisi</span>
                    <span className="font-mono font-semibold">(Rp {diskonPenjualan.toLocaleString('id-ID')})</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>TOTAL PENDAPATAN BERSIH</span>
                    <span className="font-mono tabular-nums">Rp {totalRevBersih.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 border-b border-slate-200 pb-1">2. HARGA POKOK PENJUALAN (HPP)</h4>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Beban Pemakaian Bahan Baku & Penolong (BOM)</span>
                    <span className="font-mono font-semibold">Rp {hppBahan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Biaya Tenaga Kerja Langsung Pabrik</span>
                    <span className="font-mono font-semibold">Rp {hppTenagaKerja.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Biaya Daya & Listrik Pabrik</span>
                    <span className="font-mono font-semibold">Rp {hppListrikPabrik.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Biaya Penyusutan Mesin Produksi</span>
                    <span className="font-mono font-semibold">Rp {hppSusutMesin.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>TOTAL BEBAN POKOK (HPP)</span>
                    <span className="font-mono tabular-nums">Rp {totalHPP.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl flex justify-between items-center text-xs font-bold text-slate-900">
                <span>LABA KOTOR (GROSS PROFIT)</span>
                <span className="font-mono tabular-nums text-sm">Rp {labaKotor.toLocaleString('id-ID')}</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 border-b border-slate-200 pb-1">3. BEBAN OPERASIONAL & UMUM</h4>
                <div className="space-y-1.5 pl-2">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Gaji Staf & Manajemen Kantor</span>
                    <span className="font-mono font-semibold">Rp {bebanGajiStaff.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Beban Pemasaran & Operasional</span>
                    <span className="font-mono font-semibold">Rp {bebanPemasaran.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Bahan Bakar & Distribusi Armada</span>
                    <span className="font-mono font-semibold">Rp {bebanDistribusiArmada.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Uji Laboratorium & Sertifikasi QC (SNI)</span>
                    <span className="font-mono font-semibold">Rp {bebanQCSNI.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Penyusutan Kendaraan & Inventaris</span>
                    <span className="font-mono font-semibold">Rp {bebanSusutKendaraan.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between pt-2 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>TOTAL BEBAN OPERASIONAL</span>
                    <span className="font-mono tabular-nums">Rp {totalBebanOperasional.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl flex justify-between items-center text-sm font-black border ${
                labaBersihOperasional >= 0 ? 'bg-emerald-50 text-emerald-950 border-emerald-200' : 'bg-red-50 text-red-950 border-red-200'
              }`}>
                <span>LABA BERSIH BERJALAN (NET PROFIT)</span>
                <span className="font-mono tabular-nums text-lg">Rp {labaBersihOperasional.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>
  );
};