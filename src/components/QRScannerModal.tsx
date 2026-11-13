import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, AlertCircle, Search, CheckCircle2, 
  Upload, FileText, PenTool, RefreshCw, Smartphone, SwitchCamera,
  AlertTriangle, Volume2
} from 'lucide-react';
import { DistributionItem } from '../types';
import { scanCanvasForQR, decodeQRFromImageData } from '../utils/qrReader';

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
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [matchedDist, setMatchedDist] = useState<DistributionItem | null>(null);
  const [unmatchedCode, setUnmatchedCode] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('Mempersiapkan sensor kamera...');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Play pleasant acoustic feedback beep on successful QR scan
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (_) {}

    try {
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (_) {}
  };

  // Normalize scanned code (handles prefixes like "AIRIS:SJ:707/X/26", "SJ:...", or plain ID/No_SJ)
  const parseScannedCode = (raw: string): string => {
    let clean = (raw || '').trim();
    if (clean.startsWith('AIRIS:SJ:')) {
      clean = clean.replace('AIRIS:SJ:', '');
    } else if (clean.startsWith('SJ:')) {
      clean = clean.replace('SJ:', '');
    }
    // Check if JSON formatted
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        return String(parsed.sj || parsed.no_sj || parsed.id || clean).trim();
      } catch (_) {}
    }
    return clean.trim();
  };

  // Find distribution matching scanned string
  const findShipment = (code: string): DistributionItem | null => {
    const rawClean = parseScannedCode(code);
    const parsed = rawClean.toLowerCase();
    if (!parsed) return null;

    // Alphanumeric normalized for fuzzy comparison (e.g. 001/SJ/AIRIS/XI/2026 -> 001sjairisxi2026)
    const alphaNumericOnly = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const parsedAlpha = alphaNumericOnly(parsed);

    return distributions.find(d => {
      const sj = (d.No_Surat_Jalan || '').toLowerCase().trim();
      const id = (d.ID_Distribusi || '').toLowerCase().trim();
      const cust = (d.Nama_Pelanggan || '').toLowerCase().trim();

      if (sj === parsed || id === parsed) return true;
      if (sj && sj.includes(parsed)) return true;
      if (id && id.includes(parsed)) return true;
      if (cust && cust.includes(parsed)) return true;

      // Alphanumeric comparison if formatting slashes differ
      if (parsedAlpha && parsedAlpha.length >= 4) {
        if (alphaNumericOnly(sj) === parsedAlpha) return true;
        if (alphaNumericOnly(id) === parsedAlpha) return true;
      }

      return false;
    }) || null;
  };

  // Check if multiple camera devices exist
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      }).catch(() => {});
    }
  }, []);

  // Stop camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraLoading(false);
  };

  // Start camera with dual-fallback constraints
  const startCamera = async (overrideFacingMode?: 'environment' | 'user') => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);
    setScanStatus('Menghubungkan ke sensor kamera...');

    const targetMode = overrideFacingMode || facingMode;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Peramban atau protokol web ini tidak mengizinkan akses kamera (perlu HTTPS). Silakan gunakan pencarian manual atau unggah foto.');
      }

      let stream: MediaStream | null = null;

      // Attempt 1: with ideal facingMode & resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        console.warn('Initial camera constraints failed, attempting generic video fallback...', err1);
        // Attempt 2: generic video constraints (works for laptops, desktops, webcams)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (!stream) {
        throw new Error('Tidak dapat memperoleh stream video dari kamera.');
      }

      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play triggered exception, waiting for metadata:', playErr);
        }
        setCameraActive(true);
        setCameraLoading(false);
        setScanStatus('Arahkan kamera ke QR Code Surat Jalan');
        startDetectionLoop();
      } else {
        setTimeout(async () => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            try { await videoRef.current.play(); } catch (_) {}
            setCameraActive(true);
            setCameraLoading(false);
            setScanStatus('Arahkan kamera ke QR Code Surat Jalan');
            startDetectionLoop();
          }
        }, 100);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraActive(false);
      setCameraLoading(false);

      let msg = 'Gagal mengakses kamera perangkat.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera diblokir oleh browser. Klik ikon gembok / kamera di sebelah alamat URL browser Anda, pilih Izinkan (Allow), lalu klik "Coba Buka Kamera Lagi".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kamera tidak ditemukan pada perangkat Anda. Silakan gunakan opsi Unggah Foto QR atau Cari Nomor SJ di bawah.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi yang menggunakan webcam lalu coba lagi.';
      } else if (err.message) {
        msg = err.message;
      }

      setCameraError(msg);
      setScanStatus('Kamera tidak aktif. Gunakan pencarian manual di bawah.');
    }
  };

  // Switch camera front/back
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Barcode / QR detection loop (Dual-Engine: Native BarcodeDetector + Embedded jsQR Reader)
  const startDetectionLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    // Initialize native detector safely with qr_code only
    let nativeDetector: any = null;
    if ('BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        try {
          nativeDetector = new (window as any).BarcodeDetector();
        } catch (_) {
          nativeDetector = null;
        }
      }
    }

    scanIntervalRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      try {
        let rawCode: string | null = null;

        // Ensure canvas matches video resolution
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        const canvas = canvasRef.current;
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Engine 1: Embedded pure JS decoder (Viewfinder center crop + full frame)
          rawCode = scanCanvasForQR(canvas, true);

          // Engine 2: Native BarcodeDetector fallback/reinforcement
          if (!rawCode && nativeDetector) {
            try {
              const barcodes = await nativeDetector.detect(canvas);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                rawCode = barcodes[0].rawValue;
              }
            } catch (_) {}
          }
        }

        // Process detected QR code
        if (rawCode && rawCode.trim()) {
          const cleanCode = rawCode.trim();
          playBeep();

          const matched = findShipment(cleanCode);
          if (matched) {
            setMatchedDist(matched);
            setUnmatchedCode(null);
            setScanStatus(`QR Terverifikasi: ${matched.No_Surat_Jalan || matched.ID_Distribusi}`);
            stopCamera();
          } else {
            // QR was successfully read, but not found in active dataset -> NEVER FAIL SILENTLY!
            setUnmatchedCode(cleanCode);
            setScanStatus(`QR Terbaca: ${cleanCode}`);
            stopCamera();
          }
        }
      } catch (e) {
        // Ignore single frame parsing errors
      }
    }, 180);
  };

  // Handle file photo scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatus('Menganalisis foto QR Code...');

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);

        // Decode with embedded pure JS QR decoder
        let detected = scanCanvasForQR(canvas, false);

        // Fallback to BarcodeDetector if needed
        if (!detected && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              detected = barcodes[0].rawValue;
            }
          } catch (_) {}
        }

        if (detected) {
          playBeep();
          const matched = findShipment(detected);
          if (matched) {
            setMatchedDist(matched);
            setUnmatchedCode(null);
            setScanStatus(`QR Berhasil dibaca: ${matched.No_Surat_Jalan || matched.ID_Distribusi}`);
            return;
          } else {
            setUnmatchedCode(detected);
            setScanStatus(`QR Terbaca: ${detected}`);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('File decode error:', err);
    }

    // Fallback: search by filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const matched = findShipment(nameWithoutExt);
    if (matched) {
      setMatchedDist(matched);
      setUnmatchedCode(null);
    } else {
      setCameraError('QR Code tidak dapat terbaca dari gambar yang dipilih. Silakan ketik No. Surat Jalan pada kotak pencarian cepat di bawah.');
      setScanStatus('Foto tidak terdeteksi. Gunakan pencarian nomor SJ di bawah.');
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setMatchedDist(null);
      setUnmatchedCode(null);
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
          <div className="flex items-center gap-1.5">
            {hasMultipleCameras && (
              <button
                type="button"
                onClick={handleToggleCamera}
                className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Ganti Kamera Depan / Belakang"
              >
                <SwitchCamera size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* CAMERA VIEWPORT - VIDEO ALWAYS MOUNTED IN DOM */}
          <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {/* The video element remains continuously mounted so videoRef.current is always accessible */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover transition-opacity duration-300 ${cameraActive ? 'opacity-100' : 'opacity-0 absolute'}`}
            />

            {/* Target overlay active when camera is streaming */}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br-lg" />
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-pulse" />
                </div>
              </div>
            )}

            {/* Placeholder / Error / Loading view when camera is not actively streaming */}
            {!cameraActive && (
              <div className="p-6 text-center space-y-3 z-10 max-w-sm">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                  {cameraLoading ? (
                    <RefreshCw size={22} className="animate-spin text-blue-400" />
                  ) : (
                    <Smartphone size={24} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {cameraLoading 
                      ? 'Menghubungkan Kamera...' 
                      : cameraError 
                      ? 'Kendala Akses Kamera' 
                      : 'Kamera Nonaktif'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    {cameraLoading
                      ? 'Mohon tunggu sebentar, sedang meminta izin ke perangkat...'
                      : cameraError || 'Klik tombol di bawah untuk mengaktifkan scanner atau gunakan opsi alternatif di bawah.'}
                  </p>
                </div>
                {!cameraLoading && (
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                  >
                    <RefreshCw size={13} />
                    <span>Coba Buka Kamera Lagi</span>
                  </button>
                )}
              </div>
            )}

            {/* Status pill on camera */}
            <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none z-20">
              <span className="px-3 py-1 bg-black/75 backdrop-blur-xs text-white text-[11px] rounded-full border border-white/10 font-medium inline-block shadow-sm">
                {scanStatus}
              </span>
            </div>
          </div>

          {/* ACTION ALTERNATIVES: UPLOAD FILE & SEARCH MANUAL */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors text-slate-700 font-medium shadow-2xs">
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
              type="button"
              onClick={() => {
                const el = document.getElementById('manual-search-sj-input');
                el?.focus();
              }}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors text-slate-700 font-medium shadow-2xs"
            >
              <Search size={14} className="text-indigo-600" />
              <span>Cari Nomor SJ</span>
            </button>
          </div>

          {/* UNMATCHED QR CODE BANNER (SHOWS SCANNED CODE WHEN NOT IN CURRENT LIST) */}
          {unmatchedCode && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-900">
                    QR Berhasil Terbaca!
                  </p>
                  <p className="font-mono text-amber-800 font-bold bg-white/70 px-2 py-0.5 rounded border border-amber-200 inline-block text-[11px]">
                    {unmatchedCode}
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Nomor Surat Jalan ini tidak ditemukan pada database pengiriman bulan ini. Silakan cari di semua periode atau buat pengiriman baru.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setManualQuery(parseScannedCode(unmatchedCode));
                    setUnmatchedCode(null);
                  }}
                  className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer text-center"
                >
                  Cari Nomor Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnmatchedCode(null);
                    startCamera();
                  }}
                  className="py-1.5 px-3 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Pindai Ulang
                </button>
              </div>
            </div>
          )}

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
                  type="button"
                  onClick={() => {
                    setMatchedDist(null);
                    startCamera();
                  }}
                  className="text-slate-500 hover:text-slate-700 text-xs underline cursor-pointer"
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
                  type="button"
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
                  type="button"
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
            type="button"
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
