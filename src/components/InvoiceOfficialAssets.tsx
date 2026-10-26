import React from 'react';
import { KOP_SURAT_SVG, CAP_STAMP_SVG, TTD_MARKO_SVG } from '../assets/invoiceAssets';

/**
 * Official Kop Surat Banner matching "KOP SURAT A4 F4  BARU.png"
 */
export const KopSuratBanner: React.FC<{ className?: string }> = ({ className = 'w-full' }) => {
  return (
    <div 
      className={`relative w-full ${className} select-none`}
      dangerouslySetInnerHTML={{ __html: KOP_SURAT_SVG }}
    />
  );
};

/**
 * Official Corporate Seal / Stamp matching "cap.png"
 */
export const OfficialCapStamp: React.FC<{ className?: string; size?: number }> = ({ 
  className = '', 
  size = 110 
}) => {
  return (
    <div 
      className={`select-none inline-block ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      dangerouslySetInnerHTML={{ __html: CAP_STAMP_SVG }}
    />
  );
};

/**
 * Authentic Handwriting Signature matching "ttd marko.png"
 */
export const OfficialTtdMarko: React.FC<{ className?: string; width?: number; height?: number }> = ({ 
  className = '',
  width = 160,
  height = 105
}) => {
  return (
    <div 
      className={`select-none pointer-events-none inline-block ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      dangerouslySetInnerHTML={{ __html: TTD_MARKO_SVG }}
    />
  );
};

/**
 * Combined Official Stamp & Signature Overlay matching page 1 invoice document
 */
export const OfficialStampWithSignature: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative inline-block select-none pointer-events-none ${className}`} style={{ minHeight: '105px', width: '210px' }}>
      {/* Cap/Stempel with authentic tilt placed on left */}
      <div className="absolute left-0 top-0">
        <OfficialCapStamp size={105} />
      </div>

      {/* Signature overlaid directly over the right half of the stamp and extending to the right */}
      <div className="absolute -top-3 left-10 z-10">
        <OfficialTtdMarko width={165} height={105} />
      </div>
    </div>
  );
};
