import React, { useMemo } from 'react';
import { generateQRMatrix } from '../utils/qrCode';

interface QRCodeDisplayProps {
  value: string;
  size?: number; // pixel size or CSS width
  className?: string;
  showLabel?: boolean;
  label?: string;
  fgColor?: string;
  bgColor?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 128,
  className = '',
  showLabel = false,
  label,
  fgColor = '#0f172a', // slate-900
  bgColor = '#ffffff'
}) => {
  const matrix = useMemo(() => {
    if (!value) return [];
    try {
      return generateQRMatrix(value);
    } catch (e) {
      console.error('Failed to generate QR Matrix:', e);
      return [];
    }
  }, [value]);

  if (!matrix || matrix.length === 0) {
    return (
      <div 
        style={{ width: size, height: size }} 
        className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs border border-dashed border-slate-300 rounded ${className}`}
      >
        QR Error
      </div>
    );
  }

  const moduleCount = matrix.length;
  const quietZone = 2; // Margin in modules
  const totalModules = moduleCount + quietZone * 2;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalModules} ${totalModules}`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="block bg-white rounded shadow-2xs"
        shapeRendering="crispEdges"
      >
        <rect width={totalModules} height={totalModules} fill={bgColor} />
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c + quietZone}
                y={r + quietZone}
                width={1}
                height={1}
                fill={fgColor}
              />
            );
          })
        )}
      </svg>
      {showLabel && (
        <span className="mt-1 text-[10px] font-mono font-medium text-slate-600 text-center max-w-[140px] truncate">
          {label || value}
        </span>
      )}
    </div>
  );
};
