// @ts-ignore
import jsQR from './jsqr.js';

export interface QRCodeResult {
  data: string;
  binaryData?: number[];
}

/**
 * Robust pure JavaScript QR Code decoder
 * Decodes raw RGBA ImageData with optional inversion attempts for high contrast / dark mode.
 */
export function decodeQRFromImageData(
  imageData: ImageData,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
): string | null {
  try {
    const fn = (typeof jsQR === 'function' ? jsQR : (typeof window !== 'undefined' ? (window as any).jsQR : null));
    if (fn) {
      const result = fn(imageData.data, imageData.width, imageData.height, options || { inversionAttempts: 'attemptBoth' });
      if (result && result.data && result.data.trim()) {
        return result.data.trim();
      }
    }
  } catch (err) {
    console.warn('QR decode error:', err);
  }
  return null;
}

/**
 * Scan a canvas element for QR code:
 * 1. Scans the center crop region (high-accuracy viewfinder mode).
 * 2. If not found, scans the full canvas.
 */
export function scanCanvasForQR(
  canvas: HTMLCanvasElement,
  cropCenter: boolean = true
): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return null;

  // 1. Center crop pass (corresponds to user's viewfinder on mobile screens)
  if (cropCenter && canvas.width >= 200 && canvas.height >= 200) {
    const cropSize = Math.round(Math.min(canvas.width, canvas.height) * 0.7);
    const cropX = Math.round((canvas.width - cropSize) / 2);
    const cropY = Math.round((canvas.height - cropSize) / 2);

    try {
      const centerImageData = ctx.getImageData(cropX, cropY, cropSize, cropSize);
      const centerResult = decodeQRFromImageData(centerImageData);
      if (centerResult) return centerResult;
    } catch (_) {}
  }

  // 2. Full frame pass
  try {
    const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const fullResult = decodeQRFromImageData(fullImageData);
    if (fullResult) return fullResult;
  } catch (_) {}

  return null;
}
