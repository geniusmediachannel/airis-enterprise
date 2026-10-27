import React, { useState } from 'react';
import { 
  X, Mail, Copy, Check, ExternalLink, AlertTriangle, 
  Calendar, ShieldAlert, Clock, Building2
} from 'lucide-react';
import { LicenseStatusResult } from '../types';
import { generateBillingMailto } from '../services/licenseService';

interface LicenseTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseStatus: LicenseStatusResult;
}

export const LicenseTransferModal: React.FC<LicenseTransferModalProps> = ({
  isOpen,
  onClose,
  licenseStatus
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const mailtoLink = generateBillingMailto(
    'PT. Anugerah Illahi Rabbi (AIRIS AMDK)',
    'Perpanjangan Masa Aktif Lisensi Sistem'
  );

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(licenseStatus.billingEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-950/40 overflow-hidden animate-scaleIn">
        
        {/* Header Modal */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-white tracking-tight">
                Masa Aktif Aplikasi
              </h3>
              <p className="text-[11px] text-amber-300 font-semibold">
                Sisa {licenseStatus.daysRemaining} hari lagi (hingga {licenseStatus.expiryDateFormatted})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Status Alert Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
            <div className="font-bold text-xs flex items-center gap-1.5 text-amber-300">
              <Clock size={14} className="text-amber-400" />
              <span>Segera Lakukan Pembayaran Perpanjangan</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Masa aktif aplikasi ini akan berakhir pada <strong>{licenseStatus.expiryDateFormatted}</strong>. Lakukan pembayaran agar sistem operasional AIRIS Enterprise tetap dapat digunakan oleh seluruh karyawan.
            </p>
          </div>

          {/* Email Information Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Tujuan Pengiriman Bukti Transfer:
            </span>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="min-w-0">
                <div className="text-[10px] text-slate-400">Email Hyper Admin / Pengembang:</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-cyan-300 truncate">
                  {licenseStatus.billingEmail}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Setelah pembayaran ditransfer, kirimkan bukti transfer ke alamat email di atas agar masa aktif aplikasi dapat diperbarui oleh Hyper Admin.
            </p>
          </div>

          {/* Tombol Utama Kirim Bukti Transfer */}
          <div className="pt-1">
            <a
              href={mailtoLink}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-cyan-600 hover:from-amber-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
            >
              <Mail size={15} />
              <span>Kirim Bukti Transfer Sekarang</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>PT. Anugerah Illahi Rabbi</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white font-medium cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
