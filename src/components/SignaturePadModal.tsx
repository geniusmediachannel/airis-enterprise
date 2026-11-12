import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool, User, ShieldCheck } from 'lucide-react';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string, signerName: string) => void;
  title?: string;
  defaultSignerName?: string;
  roleLabel?: string; // misal "Penerima / Toko" atau "Sopir / Pengirim"
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title = 'Tanda Tangan Digital',
  defaultSignerName = '',
  roleLabel = 'Nama Penandatangan'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState(defaultSignerName);

  useEffect(() => {
    if (isOpen) {
      setSignerName(defaultSignerName);
      setHasDrawn(false);
      // Tunggu DOM render canvas lalu set resolusi
      setTimeout(() => {
        initCanvas();
      }, 50);
    }
  }, [isOpen, defaultSignerName]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set resolusi fisik canvas sesuai ukuran tampilan CSS
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    // Background putih bersih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Garis panduan tanda tangan
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Konfigurasi pena
    ctx.strokeStyle = '#1e3a8a'; // Tinta biru pena resmi
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    initCanvas();
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl, signerName.trim() || 'Penerima');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-scaleIn">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <PenTool size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">{title}</h3>
              <p className="text-[11px] text-blue-100">Gunakan jari di HP atau mouse di PC</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Input Nama Penandatangan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <User size={13} className="text-blue-600" />
              <span>{roleLabel}</span>
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Masukkan nama jelas penerima / supir..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Area Kanvas Tanda Tangan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-600">Goreskan Tanda Tangan:</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Bersihkan</span>
              </button>
            </div>
            <div className="border-2 border-dashed border-blue-300 rounded-xl overflow-hidden bg-slate-50 relative touch-none">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-48 cursor-crosshair block"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs gap-1.5">
                  <PenTool size={14} />
                  <span>Tanda tangan di sini</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
            <ShieldCheck size={16} className="text-blue-600 shrink-0" />
            <span>Tanda tangan digital ini akan disematkan secara resmi pada lembar cetak Surat Jalan & arsip invoice.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasDrawn}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
              hasDrawn
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check size={14} />
            <span>Simpan Tanda Tangan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
