import QRCode from 'qrcode';

/**
 * AIRIS Enterprise - Certified ISO/IEC 18004 Standard QR Code Generator
 * Powered by verified qrcode engine with Error Correction Level M (~15% recovery).
 */
export function generateQRMatrix(text: string): boolean[][] {
  if (!text || !text.trim()) return [];
  try {
    const qr = QRCode.create(text.trim(), { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const dataArr = qr.modules.data;
    const matrix: boolean[][] = [];

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(dataArr[r * size + c] === 1);
      }
      matrix.push(row);
    }
    return matrix;
  } catch (err) {
    console.error('Failed to generate standard QR Matrix:', err);
    return [];
  }
}

/**
 * Generate standard SVG string directly
 */
export async function generateQRCodeSVG(text: string, size = 128): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M'
  });
}
