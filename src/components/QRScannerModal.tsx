import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, AlertCircle, Search, CheckCircle2, 
  Upload, FileText, PenTool, RefreshCw, Smartphone
} from 'lucide-react';
import { DistributionItem } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  distributions: DistributionItem[];
  onSelectDistribution: (dist: DistributionItem, action?: 'view' | 'sign') => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  distributions,
  onSelectDistribution
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [matchedDist, setMatchedDist] = useState<DistributionItem | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Mempersiapkan kamera...');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Normalize scanned code (handles prefixes like "AIRIS:SJ:707/X/26", "SJ-123", or JSON)
  const parseScannedCode = (raw: string): string => {
    let clean = raw.trim();
    if (clean.startsWith('AIRIS:SJ:')) {
      clean = clean.replace('AIRIS:SJ:', '');
    } else if (clean.startsWith('SJ:')) {
      clean = clean.replace('SJ:', '');
    }
    return clean.trim();
  };

  // Find distribution matching scanned string
  const findShipment = (code: string): DistributionItem | null => {
    const parsed = parseScannedCode(code).toLowerCase();
    if (!parsed) return null;

    return distributions.find(d => {
      const sj = (d.No_Surat_Jalan || '').toLowerCase().trim();
      const id = (d.ID_Distribusi || '').toLowerCase().trim();
      const cust = (d.Nama_Pelanggan || '').toLowerCase().trim();
      return (
        sj === parsed ||
        id === parsed ||
        (sj && sj.includes(parsed)) ||
        (cust && cust.includes(parsed))
      );
    }) || null;
  };

  // Start camera
  const startCamera = async () => {
    setCameraError(null);
    setScanStatus('Membuka kamera...');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Fitur kamera tidak didukung di peramban ini. Silakan gunakan pencarian manual atau unggah foto.');
      }

      // Request back camera first (environment)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanStatus('Arahkan kamera ke QR Code Surat Jalan');
        startDetectionLoop();
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraActive(false);
      setCameraError(err.message || 'Gagal mengakses kamera perangkat.');
      setScanStatus('Kamera tidak aktif. Gunakan pencarian manual di bawah.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Barcode / QR detection loop
  const startDetectionLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const hasBarcodeDetector = 'BarcodeDetector' in window;

    if (!hasBarcodeDetector) {
      setScanStatus('Deteksi visual otomatis tidak didukung peramban. Anda dapat memasukkan No Surat Jalan di bawah.');
      return;
    }

    try {
      const detector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
      });

      scanIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            if (rawVal) {
              const matched = findShipment(rawVal);
              if (matched) {
                setMatchedDist(matched);
                setScanStatus(`QR Terdeteksi: ${matched.No_Surat_Jalan || matched.ID_Distribusi}`);
                // Stop camera on match
                stopCamera();
              }
            }
          }
        } catch (e) {
          // ignore frame detection glitches
        }
      }, 350);
    } catch (e) {
      console.warn('BarcodeDetector initialization error:', e);
    }
  };

  // Handle file photo scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ('BarcodeDetector' in window) {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          const matched = findShipment(raw);
          if (matched) {
            setMatchedDist(matched);
            setScanStatus(`QR Berhasil dibaca: ${matched.No_Surat_Jalan || matched.ID_Distribusi}`);
            return;
          }
        }
      } catch (err) {
        console.warn('File decode error:', err);
      }
    }

    // Fallback: search by filename or prompt
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const matched = findShipment(nameWithoutExt);
    if (matched) {
      setMatchedDist(matched);
    } else {
      setCameraError('QR Code tidak dapat terbaca dari gambar yang dipilih. Silakan ketik No. Surat Jalan pada kotak pencarian.');
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setMatchedDist(null);
      setManualQuery('');
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Live filtered distributions for manual search
  const filteredList = distributions.filter(d => {
    if (!manualQuery.trim()) return false;
    const q = manualQuery.toLowerCase();
    return (
      (d.No_Surat_Jalan && d.No_Surat_Jalan.toLowerCase().includes(q)) ||
      (d.Nama_Pelanggan && d.Nama_Pelanggan.toLowerCase().includes(q)) ||
      (d.ID_Distribusi && d.ID_Distribusi.toLowerCase().includes(q)) ||
      (d.Pengirim && d.Pengirim.toLowerCase().includes(q))
    );
  }).slice(0, 5);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider">
                Scanner QR Surat Jalan
              </h3>
              <p className="text-[11px] text-blue-200">
                Pindai Surat Jalan untuk verifikasi & tanda tangan digital
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* CAMERA VIEWPORT */}
          <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Target overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-56 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] animate-pulse">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-lg" />
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399]" />
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                  <Smartphone size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    {cameraError ? 'Kamera Tidak Tersedia' : 'Kamera Nonaktif'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    {cameraError || 'Anda dapat mengaktifkan kamera atau memilih opsi alternatif di bawah.'}
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <RefreshCw size={13} />
                  <span>Coba Buka Kamera Lagi</span>
                </button>
              </div>
            )}

            {/* Status pill on camera */}
            <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
              <span className="px-2.5 py-1 bg-black/60 backdrop-blur-xs text-white text-[11px] rounded-full border border-white/10 font-medium inline-block">
                {scanStatus}
              </span>
            </div>
          </div>

          {/* ACTION ALTERNATIVES: UPLOAD FILE & SEARCH MANUAL */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors text-slate-700 font-medium">
              <Upload size={14} className="text-blue-600" />
              <span>Unggah Foto QR</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => {
                const el = document.getElementById('manual-search-sj-input');
                el?.focus();
              }}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors text-slate-700 font-medium"
            >
              <Search size={14} className="text-indigo-600" />
              <span>Cari Nomor SJ</span>
            </button>
          </div>

          {/* MANUAL SEARCH INPUT */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Pencarian Cepat Surat Jalan
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                id="manual-search-sj-input"
                type="text"
                placeholder="Ketik No Surat Jalan (misal: 707/X/26) atau Nama Toko..."
                value={manualQuery}
                onChange={e => {
                  setManualQuery(e.target.value);
                  const exact = findShipment(e.target.value);
                  if (exact) setMatchedDist(exact);
                }}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            {/* Quick autocomplete dropdown */}
            {manualQuery.trim() && !matchedDist && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white max-h-40 overflow-y-auto shadow-md text-xs">
                {filteredList.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px]">
                    Tidak ditemukan pengiriman dengan kata kunci tersebut
                  </div>
                ) : (
                  filteredList.map(dist => (
                    <button
                      key={dist.ID_Distribusi}
                      onClick={() => {
                        setMatchedDist(dist);
                        setManualQuery('');
                      }}
                      className="w-full text-left p-2.5 hover:bg-blue-50 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{dist.No_Surat_Jalan || dist.ID_Distribusi}</span>
                        <span className="text-slate-500 ml-2">• {dist.Nama_Pelanggan}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{dist.Tanggal}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* MATCHED SHIPMENT RESULT CARD */}
          {matchedDist && (
            <div className="p-4 bg-emerald-50/80 border-2 border-emerald-500/60 rounded-xl space-y-3 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">
                      Surat Jalan Terverifikasi!
                    </h4>
                    <p className="font-mono text-emerald-800 font-bold text-sm">
                      {matchedDist.No_Surat_Jalan || matchedDist.ID_Distribusi}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMatchedDist(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs underline cursor-pointer"
                >
                  Pindai Ulang
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs p-2.5 bg-white/80 rounded-lg border border-emerald-200/60">
                <div>
                  <span className="text-slate-500 text-[10.5px]">Pelanggan / Toko:</span>
                  <p className="font-bold text-slate-800 truncate">{matchedDist.Nama_Pelanggan}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10.5px]">Tanggal Kirim:</span>
                  <p className="font-semibold text-slate-700">{matchedDist.Tanggal}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10.5px]">Pengemudi / Sopir:</span>
                  <p className="font-semibold text-slate-700">{matchedDist.Pengirim || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10.5px]">Status Tanda Tangan:</span>
                  <p className={`font-bold ${matchedDist.Tanda_Tangan_Penerima || matchedDist.Tanda_Tangan_Sopir ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {matchedDist.Tanda_Tangan_Penerima && matchedDist.Tanda_Tangan_Sopir
                      ? '✓ Lengkap (Sopir & Penerima)'
                      : matchedDist.Tanda_Tangan_Penerima
                      ? '✓ Ditandatangani Penerima'
                      : matchedDist.Tanda_Tangan_Sopir
                      ? '✓ Ditandatangani Sopir'
                      : '⏳ Belum Ditandatangani'}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    onSelectDistribution(matchedDist, 'sign');
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <PenTool size={13} />
                  <span>Tanda Tangan Digital</span>
                </button>
                <button
                  onClick={() => {
                    onSelectDistribution(matchedDist, 'view');
                    onClose();
                  }}
                  className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <FileText size={13} />
                  <span>Lihat Surat Jalan</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
