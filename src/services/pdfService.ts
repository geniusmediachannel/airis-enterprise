/**
 * AIRIS Enterprise - Client-Side PDF Generation & Print Service
 * Generates official PDF files with company header, signatures, and custom file names
 */

import { jsPDF } from 'jspdf';
import { getKopSuratPng, getCapStampPng, getTtdMarkoPng } from '../assets/invoiceAssets';

// Helper to sanitize filename (replace invalid path chars)
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, '-').trim();
}

/**
 * Terbilang number to Indonesian words converter
 */
export function angkaKeTerbilang(nilai: number): string {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const n = Math.floor(Math.abs(nilai));
  if (n < 12) return bilangan[n];
  if (n < 20) return `${angkaKeTerbilang(n - 10)} Belas`;
  if (n < 100) return `${angkaKeTerbilang(Math.floor(n / 10))} Puluh ${angkaKeTerbilang(n % 10)}`.trim();
  if (n < 200) return `Seratus ${angkaKeTerbilang(n - 100)}`.trim();
  if (n < 1000) return `${angkaKeTerbilang(Math.floor(n / 100))} Ratus ${angkaKeTerbilang(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${angkaKeTerbilang(n - 1000)}`.trim();
  if (n < 1000000) return `${angkaKeTerbilang(Math.floor(n / 1000))} Ribu ${angkaKeTerbilang(n % 1000)}`.trim();
  if (n < 1000000000) return `${angkaKeTerbilang(Math.floor(n / 1000000))} Juta ${angkaKeTerbilang(n % 1000000)}`.trim();
  return `${angkaKeTerbilang(Math.floor(n / 1000000000))} Miliar ${angkaKeTerbilang(n % 1000000000)}`.trim();
}

/**
 * Draws an authentic official Indonesian corporate seal/stamp for PT. ANUGERAH ILLAHI RABBI
 * with double concentric rings, stars, official text, and digital signature
 */
export function drawOfficialCompanyStamp(
  doc: jsPDF, 
  x: number, 
  y: number, 
  radius = 15
) {
  doc.saveGraphicsState();

  // Vibrant official stamp ink color (blue-violet)
  const r = 30, g = 64, b = 175;
  doc.setDrawColor(r, g, b);
  doc.setTextColor(r, g, b);

  // Outer circle
  doc.setLineWidth(0.7);
  doc.circle(x, y, radius, 'S');

  // Inner concentric ring
  doc.setLineWidth(0.35);
  doc.circle(x, y, radius - 1.6, 'S');

  // Center horizontal divider bars
  doc.setLineWidth(0.25);
  doc.line(x - radius + 2.5, y - 3.5, x + radius - 2.5, y - 3.5);
  doc.line(x - radius + 2.5, y + 3.5, x + radius - 2.5, y + 3.5);

  // Top curved simulated text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.text('PT. ANUGERAH ILLAHI RABBI', x, y - 6.5, { align: 'center' });

  // Center text (brand name)
  doc.setFontSize(6.8);
  doc.text('AMDK AS-SHOFAA', x, y + 1.2, { align: 'center' });

  // Bottom text
  doc.setFontSize(5.2);
  doc.text('* KLATEN - JAWA TENGAH *', x, y + 8.5, { align: 'center' });

  // Authentic cursive signature overlay
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.lines([
    [2, -3], [3, 4], [4, -5], [3, 4], [5, -1], [6, 2]
  ], x - 10, y + 1.5, [1, 1]);

  doc.restoreGraphicsState();
}

// Helper to format currency with ,00 like the official template (e.g. 16.500,00)
export function formatRupiahSen(num: number): string {
  const rounded = Math.round(Math.abs(num));
  return `${rounded.toLocaleString('id-ID')},00`;
}

// Helper to format display date (e.g. 01-Okt-2026)
export function formatPdfDisplayDate(dateStr?: string): string {
  if (!dateStr) return '-';
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parts[2].padStart(2, '0');
    if (m >= 0 && m < 12) {
      return `${d}-${months[m]}-${y}`;
    }
  }
  return dateStr;
}

// Helper to format date in full Indonesian format (e.g. 16 September 2026)
export function formatIndonesianFullDate(dateStr?: string): string {
  if (!dateStr) return '-';
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (m >= 0 && m < 12) {
      return `${d} ${months[m]} ${y}`;
    }
  }
  return dateStr;
}

/**
 * Draws the official A1R signature block with authentic cap (cap.png) and Marko signature (ttd marko.png)
 */
export function drawInvoiceOfficialStampAndSig(doc: jsPDF, x: number, y: number) {
  doc.saveGraphicsState();

  // ==========================================================
  // 1. AUTHENTIC CAP / STEMPEL (cap.png)
  // Wave Crest + A 1 R + ANUGERAH ILLAHI RABBI
  // ==========================================================
  const capX = x - 2;
  const capY = y + 2;

  // Wave Plumes in Deep Ocean Blue
  doc.setFillColor(12, 74, 110); // Deep ocean blue
  doc.setDrawColor(14, 165, 233); // Cyan border
  doc.setLineWidth(0.3);

  // Plume 1 (left)
  doc.lines([[2, -4], [4, -5], [3, 4], [-2, 7], [-4, 0]], capX + 2, capY + 11, [0.8, 0.8]);
  // Plume 2 (center)
  doc.setFillColor(3, 105, 161);
  doc.lines([[3, -7], [5, -6], [2, 6], [-3, 8], [-4, 0]], capX + 5, capY + 11, [0.8, 0.8]);
  // Plume 3 (giant curling crest on right)
  doc.setFillColor(7, 89, 133);
  doc.lines([[5, -9], [8, -4], [3, 3], [-2, 3], [-5, -1]], capX + 9, capY + 11, [0.8, 0.8]);
  // Crest tip curl
  doc.setFillColor(56, 189, 248);
  doc.circle(capX + 18, capY + 4, 1.2, 'F');

  // "A  1  R" Block Text with cyan/blue contour
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 52, 96);
  doc.text('A   1   R', capX + 10.5, capY + 16, { align: 'center' });

  // "ANUGERAH ILLAHI RABBI" text
  doc.setFontSize(4.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 43, 72);
  doc.text('ANUGERAH ILLAHI RABBI', capX + 10.5, capY + 19.5, { align: 'center' });

  // ==========================================================
  // 2. AUTHENTIC HANDWRITTEN SIGNATURE (ttd marko.png)
  // Marko Dwi Nugroho pen strokes in black ink
  // ==========================================================
  const ttdX = x + 4;
  const ttdY = y;

  doc.setDrawColor(10, 10, 10);
  doc.setFillColor(10, 10, 10);
  doc.setLineWidth(0.65);

  // Big initial oval loop on left
  doc.lines([
    [-4, 3], [-3, 6], [2, 7], [6, 2], [5, -4], [2, -7], [-2, -8], [-5, 1]
  ], ttdX + 4, ttdY + 5, [0.8, 0.8]);

  // Sharp ascending line straight to high needle peak
  doc.setLineWidth(0.7);
  doc.line(ttdX + 7, ttdY + 17, ttdX + 13, ttdY + 2);
  doc.line(ttdX + 13, ttdY + 2, ttdX + 14, ttdY + 15);

  // Second smaller needle peak
  doc.setLineWidth(0.6);
  doc.line(ttdX + 14, ttdY + 14, ttdX + 16.5, ttdY + 5);
  doc.line(ttdX + 16.5, ttdY + 5, ttdX + 17.5, ttdY + 13);

  // Cursive text ripples ('marko')
  doc.lines([[2, -4], [1.5, 4], [2, -3], [1.5, 3]], ttdX + 17.5, ttdY + 13, [1, 1]);

  // Right vertical descender stroke plunging down
  doc.setLineWidth(0.65);
  doc.line(ttdX + 24, ttdY + 4, ttdX + 22, ttdY + 21);

  // Accent dot/flick
  doc.circle(ttdX + 23.5, ttdY + 8, 0.35, 'F');

  // Long dynamic diagonal slash across the signature
  doc.setLineWidth(0.75);
  doc.line(ttdX + 1, ttdY + 20, ttdX + 32, ttdY + 7.5);

  doc.restoreGraphicsState();
}

/**
 * Downloads an official formatted invoice PDF
 * EXACT REPLICA of the uploaded As-Shofaa AIR invoice template
 */
export async function generateInvoicePDF(params: {
  noInvoice: string;
  namaPelanggan: string;
  alamatPelanggan: string;
  levelPelanggan: string;
  tanggal: string;
  metodeKirim: string;
  noSuratJalan?: string;
  penerima?: string;
  items: { nama: string; qty: number; satuan: string; harga: number; subtotal: number; noSuratJalan?: string; tanggalKirim?: string; kirimKe?: string }[];
  shipmentGroups?: {
    kirimKe?: string;
    noSuratJalan: string;
    tanggalKirim: string;
    items: { nama: string; qty: number; satuan: string; harga: number; subtotal: number }[];
  }[];
  potonganEkspedisi: number;
  grandTotal: number;
  customSettings?: {
    namaPerusahaan?: string;
    subNamaPerusahaan?: string;
    alamatPerusahaan?: string;
    kontakPerusahaan?: string;
    customKopImage?: string;
    useCustomKopImage?: boolean;
    customCapImage?: string;
    useCustomCapImage?: boolean;
    showCap?: boolean;
    customTtdImage?: string;
    useCustomTtdImage?: boolean;
    showTtd?: boolean;
    namaPenandatangan?: string;
    jabatanPenandatangan?: string;
    infoPembayaranTeks?: string;
    bankRekening?: string;
  };
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;
  const contentWidth = pageWidth - (marginX * 2);

  // Pre-fetch authentic branding images (Kop, Cap, TTD)
  let kopPng = '';
  let capPng = '';
  let ttdPng = '';
  try {
    [kopPng, capPng, ttdPng] = await Promise.all([
      getKopSuratPng(),
      getCapStampPng(),
      getTtdMarkoPng()
    ]);
  } catch (e) {
    console.error('Error prefetching authentic branding images:', e);
  }

  // Override with custom settings if configured
  const cs = params.customSettings;
  if (cs?.useCustomKopImage && cs?.customKopImage) {
    kopPng = cs.customKopImage;
  }
  if (cs?.useCustomCapImage && cs?.customCapImage) {
    capPng = cs.customCapImage;
  }
  if (cs?.useCustomTtdImage && cs?.customTtdImage) {
    ttdPng = cs.customTtdImage;
  }

  // ==============================================================
  // 1. KOP SURAT / HEADER RESMI
  // ==============================================================
  const kopHeight = contentWidth * (155 / 1000); // 27.9 mm
  if (kopPng) {
    doc.addImage(kopPng, 'PNG', marginX, 8, contentWidth, kopHeight, undefined, 'FAST');
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(cs?.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(cs?.alamatPerusahaan || 'Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan, Kec. Klaten Utara, Kab. Klaten, 57438', pageWidth / 2, 19, { align: 'center' });
    doc.text(cs?.kontakPerusahaan || '0856 4000 1926 | anugerahillahirabbi@gmail.com', pageWidth / 2, 23, { align: 'center' });
  }

  // ==============================================================
  // 2. DOCUMENT TITLE: INVOICE (Clean centered, no blue underline)
  // ==============================================================
  const titleY = 39;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('INVOICE', pageWidth / 2, titleY, { align: 'center' });

  // ==============================================================
  // 3. METADATA SECTION (2 COLUMNS DENGAN TITIK DUA RATA)
  // ==============================================================
  const metaY = 46;
  const colLeftLabel = marginX;
  const colLeftColon = marginX + 22;
  const colLeftValue = marginX + 25;

  const colRightLabel = 115;
  const colRightColon = 144;
  const colRightValue = 147;
  const lineSpacing = 4.2;

  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  // Left column: Kepada & Alamat
  doc.setFont('helvetica', 'normal');
  doc.text('Kepada', colLeftLabel, metaY);
  doc.text(':', colLeftColon, metaY);
  doc.setFont('helvetica', 'bold');
  doc.text(params.namaPelanggan.toUpperCase(), colLeftValue, metaY);

  doc.setFont('helvetica', 'normal');
  doc.text('Alamat', colLeftLabel, metaY + lineSpacing);
  doc.text(':', colLeftColon, metaY + lineSpacing);
  doc.text((params.alamatPelanggan || '-').toUpperCase(), colLeftValue, metaY + lineSpacing);

  // Right column: Tanggal Invoice & No. Invoice
  doc.text('Tanggal Invoice', colRightLabel, metaY);
  doc.text(':', colRightColon, metaY);
  doc.text(formatIndonesianFullDate(params.tanggal), colRightValue, metaY);

  doc.text('No. Invoice', colRightLabel, metaY + lineSpacing);
  doc.text(':', colRightColon, metaY + lineSpacing);
  doc.setFont('helvetica', 'normal');
  doc.text(params.noInvoice, colRightValue, metaY + lineSpacing);

  // ==============================================================
  // 4. ITEMS TABLES (PER PENGIRIMAN DENGAN 'KIRIM KE', 'NO SURAT JALAN', 'TANGGAL KIRIM')
  // Columns: No (10) | Nama Produk (64) | Qty (14) | Satuan (18) | Harga/satuan (37) | Total (37)
  // ==============================================================
  let tableY = 57;
  const colWidths = [10, 64, 14, 18, 37, 37];
  const colX = [
    marginX,
    marginX + colWidths[0],
    marginX + colWidths[0] + colWidths[1],
    marginX + colWidths[0] + colWidths[1] + colWidths[2],
    marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
    marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]
  ];

  const groupsToRender = params.shipmentGroups && params.shipmentGroups.length > 0
    ? params.shipmentGroups
    : [{
        kirimKe: params.penerima || params.namaPelanggan,
        noSuratJalan: params.noSuratJalan || '-',
        tanggalKirim: params.tanggal,
        items: params.items
      }];

  const isMultiShipment = groupsToRender.length > 1;

  groupsToRender.forEach((group) => {
    // Check page overflow
    if (tableY > 250) {
      doc.addPage();
      tableY = 15;
    }

    // Centered: Kirim Ke : [Tujuan]
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    const destinationText = `Kirim Ke : ${group.kirimKe || params.penerima || params.namaPelanggan}`;
    doc.text(destinationText, pageWidth / 2, tableY, { align: 'center' });
    tableY += 3.5;

    // Subheader: No Surat Jalan (Left) & Tanggal Kirim (Right)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`No Surat Jalan  : ${group.noSuratJalan || '-'}`, marginX, tableY);
    const tglKirimStr = formatIndonesianFullDate(group.tanggalKirim);
    doc.text(`Tanggal Kirim       : ${tglKirimStr}`, 115, tableY);
    tableY += 1.8;

    // Table Header
    const headerH = 5.5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(marginX, tableY, contentWidth, headerH, 'S');
    for (let i = 1; i < colX.length; i++) {
      doc.line(colX[i], tableY, colX[i], tableY + headerH);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('No', colX[0] + (colWidths[0] / 2), tableY + 3.8, { align: 'center' });
    doc.text('Nama Produk', colX[1] + (colWidths[1] / 2), tableY + 3.8, { align: 'center' });
    doc.text('Qty', colX[2] + (colWidths[2] / 2), tableY + 3.8, { align: 'center' });
    doc.text('Satuan', colX[3] + (colWidths[3] / 2), tableY + 3.8, { align: 'center' });
    doc.text('Harga/satuan', colX[4] + (colWidths[4] / 2), tableY + 3.8, { align: 'center' });
    doc.text('Total', colX[5] + (colWidths[5] / 2), tableY + 3.8, { align: 'center' });

    tableY += headerH;
    doc.setFont('helvetica', 'normal');

    let groupSubtotal = 0;
    const rowH = 4.8;

    group.items.forEach((item, idx) => {
      groupSubtotal += item.subtotal;

      // Draw row box
      doc.rect(marginX, tableY, contentWidth, rowH, 'S');
      for (let i = 1; i < colX.length; i++) {
        doc.line(colX[i], tableY, colX[i], tableY + rowH);
      }

      // Col 1: No
      doc.text(String(idx + 1), colX[0] + (colWidths[0] / 2), tableY + 3.4, { align: 'center' });

      // Col 2: Nama Produk
      doc.text(item.nama, colX[1] + 2, tableY + 3.4);

      // Col 3: Qty
      doc.text(String(item.qty), colX[2] + (colWidths[2] / 2), tableY + 3.4, { align: 'center' });

      // Col 4: Satuan
      const satuanStr = item.satuan || 'Karton';
      doc.text(satuanStr, colX[3] + (colWidths[3] / 2), tableY + 3.4, { align: 'center' });

      // Col 5: Harga/satuan (Rp left, price right)
      doc.text('Rp', colX[4] + 2, tableY + 3.4);
      const hargaStr = item.harga ? formatRupiahSen(item.harga) : '-';
      doc.text(hargaStr, colX[4] + colWidths[4] - 2, tableY + 3.4, { align: 'right' });

      // Col 6: Total (Rp left, amount right, or '-' if 0)
      doc.text('Rp', colX[5] + 2, tableY + 3.4);
      const subtotalStr = item.subtotal ? formatRupiahSen(item.subtotal) : '-';
      doc.text(subtotalStr, colX[5] + colWidths[5] - 2, tableY + 3.4, { align: 'right' });

      tableY += rowH;
    });

    // Subtotal Row: Bordered box under Total column
    const subtotalRowH = 5;
    doc.rect(colX[5], tableY, colWidths[5], subtotalRowH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('Rp', colX[5] + 2, tableY + 3.6);
    doc.text(formatRupiahSen(groupSubtotal), colX[5] + colWidths[5] - 2, tableY + 3.6, { align: 'right' });
    tableY += subtotalRowH;

    // Terbilang Section per Pengiriman
    tableY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Terbilang :', marginX, tableY);
    tableY += 3.5;
    doc.setFont('helvetica', 'italic');
    doc.text(angkaKeTerbilang(groupSubtotal).toLowerCase(), marginX, tableY);
    tableY += 5;
  });

  // ==============================================================
  // 5. REKAPITULASI / TOTAL TABLE (When multi-shipment)
  // ==============================================================
  if (isMultiShipment) {
    if (tableY > 235) {
      doc.addPage();
      tableY = 15;
    }

    // Aggregate items across all shipment groups
    const aggregatedMap = new Map<string, { nama: string; qty: number; satuan: string; harga: number; subtotal: number }>();
    groupsToRender.forEach(g => {
      g.items.forEach(it => {
        const k = it.nama.trim().toLowerCase();
        if (aggregatedMap.has(k)) {
          const prev = aggregatedMap.get(k)!;
          prev.qty += it.qty;
          prev.subtotal += it.subtotal;
        } else {
          aggregatedMap.set(k, {
            nama: it.nama,
            qty: it.qty,
            satuan: it.satuan || 'Karton',
            harga: it.harga,
            subtotal: it.subtotal
          });
        }
      });
    });
    const aggItems = Array.from(aggregatedMap.values());

    // 2-Row Header for TOTAL Table
    // Row 1: No (h: 9), Nama Produk (h: 9), Qty (h: 9), TOTAL (h: 4.5, spans col 3-5)
    // Row 2: Satuan (h: 4.5), Harga/satuan (h: 4.5), Total (h: 4.5)
    const topH = 4.5;
    const botH = 4.5;
    const totalHeaderH = topH + botH;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);

    // Outer box
    doc.rect(marginX, tableY, contentWidth, totalHeaderH, 'S');

    // Divider for No
    doc.line(colX[1], tableY, colX[1], tableY + totalHeaderH);
    // Divider for Nama Produk
    doc.line(colX[2], tableY, colX[2], tableY + totalHeaderH);
    // Divider for Qty
    doc.line(colX[3], tableY, colX[3], tableY + totalHeaderH);

    // Horizontal line for TOTAL span (between colX[3] and marginX + contentWidth)
    doc.line(colX[3], tableY + topH, marginX + contentWidth, tableY + topH);

    // Vertical dividers in bottom half
    doc.line(colX[4], tableY + topH, colX[4], tableY + totalHeaderH);
    doc.line(colX[5], tableY + topH, colX[5], tableY + totalHeaderH);

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('No', colX[0] + (colWidths[0] / 2), tableY + 5.8, { align: 'center' });
    doc.text('Nama Produk', colX[1] + (colWidths[1] / 2), tableY + 5.8, { align: 'center' });
    doc.text('Qty', colX[2] + (colWidths[2] / 2), tableY + 5.8, { align: 'center' });

    // "TOTAL" in top right header
    const spanWidth = colWidths[3] + colWidths[4] + colWidths[5];
    doc.text('TOTAL', colX[3] + (spanWidth / 2), tableY + 3.2, { align: 'center' });

    // Sub-headers in bottom half
    doc.text('Satuan', colX[3] + (colWidths[3] / 2), tableY + topH + 3.2, { align: 'center' });
    doc.text('Harga/satuan', colX[4] + (colWidths[4] / 2), tableY + topH + 3.2, { align: 'center' });
    doc.text('Total', colX[5] + (colWidths[5] / 2), tableY + topH + 3.2, { align: 'center' });

    tableY += totalHeaderH;
    doc.setFont('helvetica', 'normal');

    const aggRowH = 4.8;
    aggItems.forEach((item, idx) => {
      doc.rect(marginX, tableY, contentWidth, aggRowH, 'S');
      for (let i = 1; i < colX.length; i++) {
        doc.line(colX[i], tableY, colX[i], tableY + aggRowH);
      }

      doc.text(String(idx + 1), colX[0] + (colWidths[0] / 2), tableY + 3.4, { align: 'center' });
      doc.text(item.nama, colX[1] + 2, tableY + 3.4);
      doc.text(String(item.qty), colX[2] + (colWidths[2] / 2), tableY + 3.4, { align: 'center' });
      doc.text(item.satuan, colX[3] + (colWidths[3] / 2), tableY + 3.4, { align: 'center' });

      doc.text('Rp', colX[4] + 2, tableY + 3.4);
      const hargaStr = item.harga ? formatRupiahSen(item.harga) : '-';
      doc.text(hargaStr, colX[4] + colWidths[4] - 2, tableY + 3.4, { align: 'right' });

      doc.text('Rp', colX[5] + 2, tableY + 3.4);
      const subStr = item.subtotal ? formatRupiahSen(item.subtotal) : '-';
      doc.text(subStr, colX[5] + colWidths[5] - 2, tableY + 3.4, { align: 'right' });

      tableY += aggRowH;
    });

    // Grand Total Box
    const grandRowH = 5;
    doc.rect(colX[5], tableY, colWidths[5], grandRowH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('Rp', colX[5] + 2, tableY + 3.6);
    doc.text(formatRupiahSen(params.grandTotal), colX[5] + colWidths[5] - 2, tableY + 3.6, { align: 'right' });
    tableY += grandRowH;

    // Terbilang for Grand Total
    tableY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Terbilang :', marginX, tableY);
    tableY += 3.5;
    doc.setFont('helvetica', 'italic');
    doc.text(angkaKeTerbilang(params.grandTotal).toLowerCase(), marginX, tableY);
    tableY += 5;
  }

  // ==============================================================
  // 6. FOOTER: PAYMENT INFO (LEFT) & SIGNATURE / STAMP (RIGHT)
  // ==============================================================
  if (tableY > 255) {
    doc.addPage();
    tableY = 20;
  }

  tableY += 2;
  const footerY = tableY;

  // Left: Payment Terms
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  doc.text(cs?.infoPembayaranTeks || 'Pembayaran dapat dilakukan transfer atau Cash / By Driver', marginX, footerY);

  doc.setFont('helvetica', 'bold');
  doc.text(cs?.bankRekening || 'BSI 1607134444 (KSPPS BMT SYECH HASYIM ASYARI)', marginX, footerY + 4);

  // Right: Signature & Stamp
  const sigX = 145;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Hormat Kami,', sigX, footerY);

  const shouldShowCap = cs?.showCap !== false;
  const shouldShowTtd = cs?.showTtd !== false;

  // Draw stamp & signature
  if (capPng && ttdPng && shouldShowCap && shouldShowTtd) {
    doc.addImage(capPng, 'PNG', sigX - 10, footerY + 1, 26, 26, undefined, 'FAST');
    doc.addImage(ttdPng, 'PNG', sigX + 1, footerY, 36, 26, undefined, 'FAST');
  } else if (capPng && shouldShowCap && !shouldShowTtd) {
    doc.addImage(capPng, 'PNG', sigX - 4, footerY + 1, 26, 26, undefined, 'FAST');
  } else if (ttdPng && shouldShowTtd && !shouldShowCap) {
    doc.addImage(ttdPng, 'PNG', sigX + 1, footerY, 36, 26, undefined, 'FAST');
  } else if (shouldShowCap || shouldShowTtd) {
    drawInvoiceOfficialStampAndSig(doc, sigX - 4, footerY + 1);
  }

  // Signer Name Underlined
  const nameY = footerY + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const signerName = cs?.namaPenandatangan || 'Marko Dwi Nugroho';
  doc.text(signerName, sigX, nameY);
  const nameWidth = doc.getTextWidth(signerName);
  doc.setLineWidth(0.25);
  doc.line(sigX, nameY + 0.6, sigX + nameWidth, nameY + 0.6);

  // Signer Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const jabatanRaw = cs?.jabatanPenandatangan || 'Admin';
  const jabatanFormatted = jabatanRaw.startsWith('(') ? jabatanRaw : `(${jabatanRaw})`;
  doc.text(jabatanFormatted, sigX, nameY + 4.5);

  // Save PDF file
  const filename = `${sanitizeFilename(params.noInvoice)} (${sanitizeFilename(params.namaPelanggan)}).pdf`;
  doc.save(filename);
}

/**
 * Downloads an official Surat Jalan PDF
 */
export function generateSuratJalanPDF(params: {
  noSuratJalan: string;
  namaPelanggan: string;
  alamatPelanggan: string;
  tanggal: string;
  sopir: string;
  metodeKirim: string;
  items: { nama: string; qty: number; satuan: string }[];
  catatan?: string;
  customSettings?: {
    namaPerusahaan?: string;
    subNamaPerusahaan?: string;
    alamatPerusahaan?: string;
    kontakPerusahaan?: string;
    namaPenandatangan?: string;
    jabatanPenandatangan?: string;
  };
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  const cs = params.customSettings;
  const companyName = cs?.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI';
  const subName = cs?.subNamaPerusahaan || 'Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa';
  const addressLine = cs?.alamatPerusahaan 
    ? `${cs.alamatPerusahaan} ${cs.kontakPerusahaan ? '| Telp: ' + cs.kontakPerusahaan : ''}`
    : 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara | Telp: (0272) 898123';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 138);
  doc.text(companyName, pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(subName, pageWidth / 2, 25, { align: 'center' });
  doc.text(addressLine, pageWidth / 2, 29, { align: 'center' });

  doc.setDrawColor(26, 54, 138);
  doc.setLineWidth(0.8);
  doc.line(15, 33, pageWidth - 15, 33);
  doc.setLineWidth(0.2);
  doc.line(15, 34.2, pageWidth - 15, 34.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('SURAT JALAN PENGIRIMAN', pageWidth / 2, 44, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`No. Surat Jalan: ${params.noSuratJalan}`, pageWidth / 2, 49, { align: 'center' });

  // Metadata
  doc.setDrawColor(200, 210, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 54, pageWidth - 30, 22, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(`Tanggal Kirim : ${params.tanggal}`, 20, 61);
  doc.text(`Pengemudi/PIC : ${params.sopir}`, 20, 67);
  doc.text(`Metode Kirim  : ${params.metodeKirim}`, 20, 72);

  doc.text(`Kepada Yth    : ${params.namaPelanggan}`, 110, 61);
  doc.text(`Alamat Tujuan : ${params.alamatPelanggan.slice(0, 35)}`, 110, 67);

  // Table
  let y = 82;
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, pageWidth - 30, 8, 'F');
  doc.rect(15, y, pageWidth - 30, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.text('No', 20, y + 5.5);
  doc.text('Nama Barang / Produk', 35, y + 5.5);
  doc.text('Jumlah Terkirim', 130, y + 5.5, { align: 'center' });
  doc.text('Satuan', 175, y + 5.5, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  params.items.forEach((it, idx) => {
    doc.rect(15, y, pageWidth - 30, 8, 'S');
    doc.text(String(idx + 1), 20, y + 5.5);
    doc.text(it.nama, 35, y + 5.5);
    doc.text(String(it.qty), 130, y + 5.5, { align: 'center' });
    doc.text(it.satuan, 175, y + 5.5, { align: 'center' });
    y += 8;
  });

  if (params.catatan) {
    y += 5;
    doc.setFontSize(8.5);
    doc.text(`Catatan: ${params.catatan}`, 15, y);
    y += 6;
  }

  // Signatures
  y += 10;
  doc.setFontSize(9);
  doc.text('Penerima Barang,', 25, y);
  doc.text('( ................................. )', 25, y + 22);

  doc.text('Pengirim (Driver),', 90, y);
  doc.text(`( ${params.sopir} )`, 90, y + 22);

  doc.text('Petugas Gudang,', 155, y);
  doc.text('( Admin Gudang AIRIS )', 155, y + 22);

  const filename = `SJ-${sanitizeFilename(params.noSuratJalan)} (${sanitizeFilename(params.namaPelanggan)}).pdf`;
  doc.save(filename);
}

/**
 * Downloads Surat Perintah Kerja (SPK) PDF
 * Format persis seperti dokumen resmi SPK standar AIRIS
 */
export function generateSPKPDF(params: {
  idSpk: string;
  tanggal: string;
  shift: string;
  namaProduk: string;
  targetProduksi: number;
  keterangan?: string;
  bomItems: { bahan: string; kebutuhan: number; satuan: string }[];
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Helper date formatter: DD-Mmm-YYYY (e.g. 20-Okt-2026)
  const formatTanggalSPK = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Juli', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const mon = monthNames[d.getMonth()] || 'Okt';
    return `${day}-${mon}-${d.getFullYear()}`;
  };

  const marginX = 16;
  const contentWidth = pageWidth - (marginX * 2); // 210 - 32 = 178mm

  // 1. HEADER (Left: Company Name & Subtitle, Right: SPK Title & ID)
  // Top Left: PT. ANUGERAH ILLAHI RABBI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175); // Blue-700 (#1e40af)
  doc.text('PT. ANUGERAH ILLAHI RABBI', marginX, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('Sistem Manajemen Produksi AIRIS', marginX, 25);

  // Top Right: SURAT PERINTAH KERJA (SPK)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text('SURAT PERINTAH KERJA (SPK)', pageWidth - marginX, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(`ID: ${params.idSpk}`, pageWidth - marginX, 25, { align: 'right' });

  // 2. BLUE DIVIDER LINE
  doc.setLineWidth(1.0);
  doc.setDrawColor(37, 99, 235); // Blue-600 (#2563eb)
  doc.line(marginX, 29, pageWidth - marginX, 29);

  // 3. METADATA SECTION (2 Columns with aligned colons)
  let y = 37;
  const col1LabelW = 32;
  const col2LabelW = 32;
  const col2StartX = 115;

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  // Row 1: Tanggal Rencana | Shift Pengerjaan
  doc.setFont('helvetica', 'bold');
  doc.text('Tanggal Rencana', marginX, y);
  doc.text(':', marginX + col1LabelW, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatTanggalSPK(params.tanggal), marginX + col1LabelW + 3, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Shift Pengerjaan', col2StartX, y);
  doc.text(':', col2StartX + col2LabelW, y);
  doc.setFont('helvetica', 'normal');
  doc.text(params.shift || '-', col2StartX + col2LabelW + 3, y);

  // Row 2: Produk Target | Jumlah Target
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Produk Target', marginX, y);
  doc.text(':', marginX + col1LabelW, y);
  doc.setFont('helvetica', 'normal');
  doc.text(params.namaProduk, marginX + col1LabelW + 3, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Jumlah Target', col2StartX, y);
  doc.text(':', col2StartX + col2LabelW, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${params.targetProduksi.toLocaleString('id-ID')} Unit`, col2StartX + col2LabelW + 3, y);

  // Row 3: Keterangan
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Keterangan', marginX, y);
  doc.text(':', marginX + col1LabelW, y);
  doc.setFont('helvetica', 'normal');
  doc.text(params.keterangan || '-', marginX + col1LabelW + 3, y);

  // 4. BOM SECTION TITLE
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Rincian Kebutuhan Bahan Penolong (BOM)', marginX, y);

  // 5. BOM TABLE (Matching sample image: No, Nama Bahan Penolong, Total Kebutuhan)
  y += 4;
  const colNoW = 12;
  const colTotalW = 56;
  const colNamaW = contentWidth - colNoW - colTotalW;

  const xNo = marginX;
  const xNama = xNo + colNoW;
  const xTotal = xNama + colNamaW;

  const rowHeight = 7.5;
  doc.setLineWidth(0.3);
  doc.setDrawColor(15, 23, 42);

  // Table Header
  doc.rect(xNo, y, contentWidth, rowHeight, 'S');
  doc.line(xNama, y, xNama, y + rowHeight);
  doc.line(xTotal, y, xTotal, y + rowHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('No', xNo + (colNoW / 2), y + 5, { align: 'center' });
  doc.text('Nama Bahan Penolong', xNama + 3, y + 5);
  doc.text('Total Kebutuhan', xTotal + 3, y + 5);

  y += rowHeight;

  // Table Rows
  if (params.bomItems.length === 0) {
    doc.rect(xNo, y, contentWidth, rowHeight, 'S');
    doc.setFont('helvetica', 'italic');
    doc.text('Tidak ada formula BOM terdaftar', marginX + (contentWidth / 2), y + 5, { align: 'center' });
    y += rowHeight;
  } else {
    params.bomItems.forEach((b, idx) => {
      doc.rect(xNo, y, contentWidth, rowHeight, 'S');
      doc.line(xNama, y, xNama, y + rowHeight);
      doc.line(xTotal, y, xTotal, y + rowHeight);

      // No
      doc.setFont('helvetica', 'normal');
      doc.text(String(idx + 1), xNo + (colNoW / 2), y + 5, { align: 'center' });

      // Nama Bahan Penolong (UPPERCASE)
      doc.setFont('helvetica', 'bold');
      doc.text(b.bahan.toUpperCase(), xNama + 3, y + 5);

      // Total Kebutuhan
      const qtyStr = `${b.kebutuhan.toLocaleString('id-ID')} ${(b.satuan || 'PCS').toUpperCase()}`;
      doc.text(qtyStr, xTotal + 3, y + 5);

      y += rowHeight;
    });
  }

  // 6. SIGNATURES
  y += 20;
  const sigCol1X = marginX + 35;
  const sigCol2X = pageWidth - marginX - 35;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Disetujui Oleh,', sigCol1X, y, { align: 'center' });
  doc.text('Diterima Oleh,', sigCol2X, y, { align: 'center' });

  y += 25;
  doc.setFont('helvetica', 'bold');
  doc.text('( Kepala Produksi )', sigCol1X, y, { align: 'center' });
  doc.text('( Operator / PIC )', sigCol2X, y, { align: 'center' });

  doc.save(`SPK-${sanitizeFilename(params.idSpk)}.pdf`);
}

/**
 * Downloads Official Letter PDF (Surat Eksternal / Internal / Keterangan)
 */
export function generateOfficialLetterPDF(params: {
  nomorSurat: string;
  tipeSurat: string;
  tanggal: string;
  perihal: string;
  lampiran?: string;
  kepada: string;
  alamatTujuan?: string;
  isiSurat: string;
  penandatanganNama: string;
  penandatanganJabatan: string;
  tembusan?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header / Kop
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 138);
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text('Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa', pageWidth / 2, 25, { align: 'center' });
  doc.text('Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara, Klaten, Jawa Tengah', pageWidth / 2, 29, { align: 'center' });
  doc.text('Telepon: (0272) 898123 | Email: official@airis-amdk.com', pageWidth / 2, 33, { align: 'center' });

  doc.setLineWidth(0.8);
  doc.setDrawColor(26, 54, 138);
  doc.line(15, 36, pageWidth - 15, 36);
  doc.setLineWidth(0.2);
  doc.line(15, 37.2, pageWidth - 15, 37.2);

  // Meta Surat
  let y = 47;
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  doc.text(`Nomor     : ${params.nomorSurat}`, 15, y);
  doc.text(`Klaten, ${params.tanggal}`, pageWidth - 15, y, { align: 'right' });
  y += 5.5;

  doc.text(`Lampiran  : ${params.lampiran || '-'}`, 15, y);
  y += 5.5;

  doc.text(`Perihal   : ${params.perihal}`, 15, y);
  y += 10;

  doc.text('Kepada Yth.', 15, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(params.kepada, 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  if (params.alamatTujuan) {
    doc.text(params.alamatTujuan, 15, y);
    y += 5;
  }
  doc.text('Di tempat', 15, y);
  y += 10;

  // Title if Surat Keterangan
  if (params.tipeSurat === 'Surat Keterangan') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SURAT KETERANGAN', pageWidth / 2, y, { align: 'center' });
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nomor: ${params.nomorSurat}`, pageWidth / 2, y + 5, { align: 'center' });
    y += 14;
  }

  // Isi Surat (Split text into lines)
  doc.setFontSize(10);
  const splitText = doc.splitTextToSize(params.isiSurat, pageWidth - 30);
  doc.text(splitText, 15, y);

  y += splitText.length * 5 + 15;

  // Tanda Tangan
  doc.setFontSize(9.5);
  doc.text('Hormat kami,', pageWidth - 65, y);
  doc.setFont('helvetica', 'bold');
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth - 65, y + 5);

  doc.text(params.penandatanganNama, pageWidth - 65, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(params.penandatanganJabatan, pageWidth - 65, y + 33);

  // Tembusan if any
  if (params.tembusan) {
    doc.setFontSize(8.5);
    doc.text(`Tembusan: ${params.tembusan}`, 15, y + 35);
  }

  doc.save(`${sanitizeFilename(params.nomorSurat)}.pdf`);
}

/**
 * Downloads Quality Control SNI 3553:2023 Certificate & Rincian PDF
 */
export function generateQCTestPDF(params: {
  idQc: string;
  tanggal: string;
  produk: string;
  petugas: string;
  kesimpulan: string;
  siklusDetails: any[];
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(26, 54, 138);
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text('Laboratorium Pengendalian Mutu & Kualitas Air Minum (SNI 3553:2023)', pageWidth / 2, 25, { align: 'center' });
  doc.text('Klaten, Jawa Tengah | Standar Permenkes & SNI', pageWidth / 2, 29, { align: 'center' });

  doc.setLineWidth(0.6);
  doc.line(15, 33, pageWidth - 15, 33);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('SERTIFIKAT & RINCIAN HASIL UJI MUTU', pageWidth / 2, 42, { align: 'center' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor Dokumen QC: ${params.idQc}`, pageWidth / 2, 47, { align: 'center' });

  // Summary Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(200, 215, 230);
  doc.roundedRect(15, 52, pageWidth - 30, 22, 2, 2, 'FD');

  doc.text(`Tanggal Uji  : ${params.tanggal}`, 20, 60);
  doc.text(`Produk Diuji : ${params.produk}`, 20, 66);
  doc.text(`Analis Lab   : ${params.petugas}`, 110, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Hasil Akhir  : ${params.kesimpulan}`, 110, 66);
  doc.setFont('helvetica', 'normal');

  // Matrix Table
  let y = 80;
  doc.setFont('helvetica', 'bold');
  doc.text('Hasil Uji 3 Siklus (Air Baku, Air Proses, & Air Jadi):', 15, y);
  y += 4;

  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, pageWidth - 30, 8, 'F');
  doc.rect(15, y, pageWidth - 30, 8, 'S');

  doc.setFontSize(8);
  doc.text('Siklus', 18, y + 5.5);
  doc.text('Air Baku (pH / TDS / Coli)', 38, y + 5.5);
  doc.text('Air Proses (pH / Ozon / Rasa)', 95, y + 5.5);
  doc.text('Air Jadi (pH / TDS / Keruh / Coli)', 145, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  [1, 2, 3].forEach(s => {
    const d = params.siklusDetails.find(item => item.Siklus === s) || {};
    doc.rect(15, y, pageWidth - 30, 8, 'S');
    doc.text(`Siklus ${s}`, 18, y + 5.5);
    doc.text(`pH: ${d.Baku_pH || '7.2'} | TDS: ${d.Baku_TDS || '140'} | Coli: ${d.Baku_Coliform || '0'}`, 38, y + 5.5);
    doc.text(`pH: ${d.Proses_pH || '7.1'} | O3: ${d.Proses_Ozon || '0.12'} | ${d.Proses_Rasa || 'Segar'}`, 95, y + 5.5);
    doc.text(`pH: ${d.Jadi_pH || '7.0'} | TDS: ${d.Jadi_TDS || '98'} | NTU: ${d.Jadi_Kekeruhan || '0.1'} | Coli: ${d.Jadi_Coliform || '0'}`, 145, y + 5.5);
    y += 8;
  });

  y += 20;
  doc.setFontSize(9);
  doc.text('Petugas Analis Laboratorium,', 30, y);
  doc.text(`( ${params.petugas} )`, 30, y + 22);

  doc.text('Kepala Bagian Quality Control,', 125, y);
  doc.text('( Nurul Hidayati, S.Si )', 125, y + 22);

  doc.save(`QC-${sanitizeFilename(params.idQc)}.pdf`);
}

/**
 * Downloads generic table report as PDF (e.g. Produksi, Distribusi, Stok, Neraca)
 */
export function generateTableReportPDF(params: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(26, 54, 138);
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 20, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text('Sistem Manajemen Terpadu Pabrik AMDK As-Shofaa', pageWidth / 2, 25, { align: 'center' });

  doc.setLineWidth(0.6);
  doc.line(15, 29, pageWidth - 15, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(params.title.toUpperCase(), pageWidth / 2, 38, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(params.subtitle, pageWidth / 2, 43, { align: 'center' });

  let y = 52;
  const colWidth = (pageWidth - 30) / params.headers.length;

  // Header row
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, pageWidth - 30, 7, 'F');
  doc.rect(15, y, pageWidth - 30, 7, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  params.headers.forEach((h, i) => {
    doc.text(h, 15 + i * colWidth + 2, y + 5);
  });

  y += 7;
  doc.setFont('helvetica', 'normal');
  params.rows.forEach(r => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.rect(15, y, pageWidth - 30, 6.5, 'S');
    r.forEach((cell, ci) => {
      doc.text(String(cell).slice(0, 25), 15 + ci * colWidth + 2, y + 4.5);
    });
    y += 6.5;
  });

  doc.save(params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`);
}

/**
 * Generates an official Production Results Report PDF matching the exact application appearance
 */
export function generateProductionReportPDF(params: {
  periode: string;
  totalOutput: number;
  totalBatch: number;
  rataRataBatch: number;
  productSummary: {
    id: string;
    nama: string;
    kategori: string;
    satuan: string;
    batchCount: number;
    totalQty: number;
    percentage: number;
  }[];
  batchLogs: {
    tanggal: string;
    idBatch: string;
    shift: string;
    namaProduk: string;
    jumlah: number;
    pic: string;
  }[];
  filename?: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const contentWidth = pageWidth - 30;

  // Header / Kop Perusahaan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 138); // Blue
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text('Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa', pageWidth / 2, 23, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara, Jawa Tengah | Telp: (0272) 898123', pageWidth / 2, 27, { align: 'center' });

  // Divider lines
  doc.setDrawColor(26, 54, 138);
  doc.setLineWidth(0.7);
  doc.line(marginLeft, 31, pageWidth - marginLeft, 31);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, 32.2, pageWidth - marginLeft, 32.2);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN HASIL PRODUKSI AMDK', pageWidth / 2, 40, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${params.periode}  •  Dicetak: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, 45, { align: 'center' });

  // 3 Metric Cards like in the App
  const cardY = 50;
  const cardW = (contentWidth - 6) / 3;
  const cardH = 16;

  // Card 1: Total Output (Blue)
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(marginLeft, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Output Produksi:', marginLeft + 4, cardY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text(`${params.totalOutput.toLocaleString('id-ID')} Unit`, marginLeft + 4, cardY + 12);

  // Card 2: Batch Selesai (Emerald)
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(marginLeft + cardW + 3, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Jumlah Batch Selesai:', marginLeft + cardW + 7, cardY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text(`${params.totalBatch} Batch`, marginLeft + cardW + 7, cardY + 12);

  // Card 3: Rata-rata per Batch (Indigo)
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(marginLeft + (cardW * 2) + 6, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Rata-rata per Batch:', marginLeft + (cardW * 2) + 10, cardY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(49, 46, 129);
  doc.text(`${params.rataRataBatch.toLocaleString('id-ID')} Unit`, marginLeft + (cardW * 2) + 10, cardY + 12);

  // SECTION 1: HASIL JUMLAH PRODUKSI MASING-MASING PRODUK
  let y = 72;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('HASIL JUMLAH PRODUKSI MASING-MASING PRODUK', marginLeft, y);

  // Subtitle & Total Output Badge (Matches in-app header)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Rekapitulasi total kuantitas per jenis produk periode ${params.periode}`, marginLeft, y + 4);

  // Badge on the right
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(pageWidth - marginLeft - 58, y - 4, 58, 8, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text(`Total Output: ${params.totalOutput.toLocaleString('id-ID')} Unit`, pageWidth - marginLeft - 29, y + 1.2, { align: 'center' });

  y += 7.5;
  // Table 1 Header
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('ID Produk', marginLeft + 3, y + 4.8);
  doc.text('Nama Produk', marginLeft + 28, y + 4.8);
  doc.text('Kategori', marginLeft + 82, y + 4.8);
  doc.text('Satuan', marginLeft + 120, y + 4.8);
  doc.text('Batch Selesai', marginLeft + 142, y + 4.8, { align: 'center' });
  doc.text('Hasil Produksi', marginLeft + 168, y + 4.8, { align: 'right' });
  doc.text('Porsi', marginLeft + 178, y + 4.8, { align: 'right' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  params.productSummary.forEach((ps, idx) => {
    const isEven = idx % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginLeft, y, contentWidth, 6.2, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, 6.2, 'S');

    doc.setTextColor(71, 85, 105);
    doc.text(ps.id, marginLeft + 3, y + 4.3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(ps.nama, marginLeft + 28, y + 4.3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(ps.kategori, marginLeft + 82, y + 4.3);
    doc.text(ps.satuan, marginLeft + 120, y + 4.3);
    doc.text(`${ps.batchCount} Batch`, marginLeft + 140, y + 4.3, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`${ps.totalQty.toLocaleString('id-ID')} ${ps.satuan}`, marginLeft + 165, y + 4.3, { align: 'right' });
    doc.setTextColor(71, 85, 105);
    doc.text(`${ps.percentage}%`, marginLeft + 178, y + 4.3, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 6.2;
  });

  // Table 1 Total Row
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(marginLeft, y, contentWidth, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('TOTAL SELURUH PRODUK', marginLeft + 3, y + 4.8);
  doc.text(`${params.totalBatch} Batch`, marginLeft + 140, y + 4.8, { align: 'center' });
  doc.text(`${params.totalOutput.toLocaleString('id-ID')} Unit`, marginLeft + 165, y + 4.8, { align: 'right' });
  doc.text('100%', marginLeft + 178, y + 4.8, { align: 'right' });

  // SECTION 2: RINCIAN LOG BATCH TRANSAKSI PRODUKSI
  y += 13;
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. RINCIAN LOG BATCH TRANSAKSI PRODUKSI (${params.batchLogs.length} Batch)`, marginLeft, y);

  y += 3.5;
  // Table 2 Header
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Tanggal', marginLeft + 3, y + 4.8);
  doc.text('ID Batch', marginLeft + 25, y + 4.8);
  doc.text('Shift', marginLeft + 55, y + 4.8);
  doc.text('Nama Produk', marginLeft + 85, y + 4.8);
  doc.text('Hasil (Unit)', marginLeft + 150, y + 4.8, { align: 'right' });
  doc.text('PIC Produksi', marginLeft + 155, y + 4.8);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (params.batchLogs.length === 0) {
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, 7, 'S');
    doc.setTextColor(148, 163, 184);
    doc.text('Tidak ada riwayat batch produksi pada periode ini.', pageWidth / 2, y + 4.8, { align: 'center' });
    y += 7;
  } else {
    params.batchLogs.forEach((b, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        // Repeat table 2 header on new page
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(marginLeft, y, contentWidth, 7, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Tanggal', marginLeft + 3, y + 4.8);
        doc.text('ID Batch', marginLeft + 25, y + 4.8);
        doc.text('Shift', marginLeft + 55, y + 4.8);
        doc.text('Nama Produk', marginLeft + 85, y + 4.8);
        doc.text('Hasil (Unit)', marginLeft + 150, y + 4.8, { align: 'right' });
        doc.text('PIC Produksi', marginLeft + 155, y + 4.8);
        y += 7;
        doc.setFont('helvetica', 'normal');
      }

      const isEven = idx % 2 === 1;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginLeft, y, contentWidth, 6, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginLeft, y, contentWidth, 6, 'S');

      doc.setTextColor(71, 85, 105);
      doc.text(b.tanggal, marginLeft + 3, y + 4.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 54, 138);
      doc.text(b.idBatch, marginLeft + 25, y + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(b.shift, marginLeft + 55, y + 4.2);
      doc.setTextColor(15, 23, 42);
      doc.text(b.namaProduk.slice(0, 28), marginLeft + 85, y + 4.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(b.jumlah.toLocaleString('id-ID'), marginLeft + 150, y + 4.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(b.pic, marginLeft + 155, y + 4.2);

      y += 6;
    });
  }

  // Signatures
  y += 12;
  if (y > 255) {
    doc.addPage();
    y = 25;
  }

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Klaten, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - marginLeft - 60, y);
  
  y += 5;
  doc.text('Dibuat Oleh (PIC Produksi),', marginLeft + 10, y);
  doc.text('Mengetahui (Supervisor Produksi & QC),', pageWidth - marginLeft - 60, y);

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('( Agus Setiawan )', marginLeft + 10, y);
  doc.text('( Nurul Hidayati, S.Si )', pageWidth - marginLeft - 60, y);

  const saveFilename = params.filename || `Laporan_Hasil_Produksi_${params.periode.replace('-', '_')}.pdf`;
  doc.save(saveFilename.endsWith('.pdf') ? saveFilename : `${saveFilename}.pdf`);
}

/**
 * Generates an official Annual Production Report PDF matching the exact application appearance
 */
export function generateAnnualProductionReportPDF(params: {
  tahun: string;
  totalAnnualOutput: number;
  monthNames: string[];
  productRows: {
    nama: string;
    monthly: number[];
    total: number;
  }[];
  monthlyTotals: number[];
  filename?: string;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const contentWidth = pageWidth - 30;

  // Header / Kop Perusahaan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 138);
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text('Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa - Rekapitulasi Tahunan', pageWidth / 2, 21, { align: 'center' });

  // Divider lines
  doc.setDrawColor(26, 54, 138);
  doc.setLineWidth(0.7);
  doc.line(marginLeft, 26, pageWidth - marginLeft, 26);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, 27.2, pageWidth - marginLeft, 27.2);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`LAPORAN TAHUNAN HASIL PRODUKSI AMDK - TAHUN ${params.tahun}`, pageWidth / 2, 34, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Akumulasi Produksi 12 Bulan: ${params.totalAnnualOutput.toLocaleString('id-ID')} Unit`, pageWidth / 2, 39, { align: 'center' });

  // Matrix Table Header
  let y = 46;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 8, 'FD');

  const nameColWidth = 55;
  const monthColWidth = (contentWidth - nameColWidth - 26) / 12;
  const totalColWidth = 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Varian Produk', marginLeft + 3, y + 5.5);

  params.monthNames.forEach((m, i) => {
    doc.text(m, marginLeft + nameColWidth + (i * monthColWidth) + (monthColWidth / 2), y + 5.5, { align: 'center' });
  });
  doc.text('TOTAL', marginLeft + contentWidth - 4, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  params.productRows.forEach((pRow, idx) => {
    const isEven = idx % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginLeft, y, contentWidth, 7, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, 7, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pRow.nama, marginLeft + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    pRow.monthly.forEach((val, mi) => {
      const txt = val > 0 ? val.toLocaleString('id-ID') : '-';
      doc.text(txt, marginLeft + nameColWidth + (mi * monthColWidth) + (monthColWidth / 2), y + 5, { align: 'center' });
    });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(pRow.total.toLocaleString('id-ID'), marginLeft + contentWidth - 4, y + 5, { align: 'right' });
    y += 7;
  });

  // Total Summary Row
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(marginLeft, y, contentWidth, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('TOTAL PRODUKSI SEMUA', marginLeft + 3, y + 5.5);

  params.monthlyTotals.forEach((tot, mi) => {
    const txt = tot > 0 ? tot.toLocaleString('id-ID') : '-';
    doc.text(txt, marginLeft + nameColWidth + (mi * monthColWidth) + (monthColWidth / 2), y + 5.5, { align: 'center' });
  });

  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text(params.totalAnnualOutput.toLocaleString('id-ID'), marginLeft + contentWidth - 4, y + 5.5, { align: 'right' });

  // Signatures
  y += 15;
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Klaten, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - marginLeft - 60, y);
  
  y += 5;
  doc.text('Dibuat Oleh (PIC Produksi),', marginLeft + 10, y);
  doc.text('Mengetahui (Supervisor Produksi & QC),', pageWidth - marginLeft - 60, y);

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('( Agus Setiawan )', marginLeft + 10, y);
  doc.text('( Nurul Hidayati, S.Si )', pageWidth - marginLeft - 60, y);

  const saveFilename = params.filename || `Laporan_Tahunan_Produksi_${params.tahun}.pdf`;
  doc.save(saveFilename.endsWith('.pdf') ? saveFilename : `${saveFilename}.pdf`);
}

/**
 * Generates an official Distribution Report PDF matching Gambar 1 & 2 and in-app display
 */
export function generateDistributionReportPDF(params: {
  periode: string;
  totalUnit: number;
  totalPengiriman: number;
  totalTagihan: number;
  products: { id: string; nama: string; shortCode: string; satuan: string }[];
  productSummary: {
    id: string;
    nama: string;
    kategori: string;
    satuan: string;
    totalQty: number;
    percentage: number;
    subtotal: number;
  }[];
  distributions: {
    no: number;
    namaPelanggan: string;
    levelPelanggan: string;
    tanggal: string;
    noSuratJalan: string;
    tujuan: string;
    productQtys: Record<string, number>;
    metodeKirim: string;
    totalTagihan: number;
  }[];
  filename?: string;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
  const marginLeft = 12;
  const contentWidth = pageWidth - (marginLeft * 2); // 273mm

  // Header / Kop Perusahaan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 54, 138);
  doc.text('PT. ANUGERAH ILLAHI RABBI', pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text('Pabrik Air Minum Dalam Kemasan (AMDK) As-Shofaa - Divisi Distribusi & Logistik', pageWidth / 2, 21, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara, Jawa Tengah | Telp: (0272) 898123', pageWidth / 2, 25, { align: 'center' });

  // Divider lines
  doc.setDrawColor(26, 54, 138);
  doc.setLineWidth(0.7);
  doc.line(marginLeft, 29, pageWidth - marginLeft, 29);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, 30.2, pageWidth - marginLeft, 30.2);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN DISTRIBUSI & LOGISTIK PENGIRIMAN AMDK', pageWidth / 2, 38, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Periode: ${params.periode}  •  Dicetak: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, 43, { align: 'center' });

  // 3 Metric Summary Boxes (Like in-app view)
  const cardY = 47;
  const cardW = (contentWidth - 6) / 3;
  const cardH = 14;

  // Box 1: Total Unit (Blue)
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(marginLeft, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Volume Terkirim:', marginLeft + 4, cardY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  doc.text(`${params.totalUnit.toLocaleString('id-ID')} Unit / Dus`, marginLeft + 4, cardY + 11);

  // Box 2: Total Pengiriman / Surat Jalan (Purple)
  doc.setFillColor(250, 245, 255);
  doc.setDrawColor(233, 213, 255);
  doc.roundedRect(marginLeft + cardW + 3, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Surat Jalan Resmi:', marginLeft + cardW + 7, cardY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(109, 40, 217);
  doc.text(`${params.totalPengiriman} Transaksi Pengiriman`, marginLeft + cardW + 7, cardY + 11);

  // Box 3: Total Nilai Tagihan (Emerald)
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(marginLeft + (cardW * 2) + 6, cardY, cardW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Omzet / Tagihan Distribusi:', marginLeft + (cardW * 2) + 10, cardY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 95, 70);
  doc.text(`Rp ${params.totalTagihan.toLocaleString('id-ID')}`, marginLeft + (cardW * 2) + 10, cardY + 11);

  // SECTION 1: REKAPITULASI DISTRIBUSI MASING-MASING PRODUK
  let y = 66;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('HASIL JUMLAH DISTRIBUSI MASING-MASING PRODUK', marginLeft, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Rekapitulasi total kuantitas dan nominal penjualan per varian produk periode ${params.periode}`, marginLeft, y + 3.8);

  y += 6.5;
  // Table 1 Header
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 6.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('ID Produk', marginLeft + 3, y + 4.5);
  doc.text('Nama Produk', marginLeft + 32, y + 4.5);
  doc.text('Kategori', marginLeft + 95, y + 4.5);
  doc.text('Satuan', marginLeft + 135, y + 4.5);
  doc.text('Total Terkirim (Unit)', marginLeft + 185, y + 4.5, { align: 'right' });
  doc.text('Porsi (%)', marginLeft + 215, y + 4.5, { align: 'right' });
  doc.text('Subtotal Tagihan (Rp)', marginLeft + contentWidth - 4, y + 4.5, { align: 'right' });

  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  params.productSummary.forEach((ps, idx) => {
    const isEven = idx % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginLeft, y, contentWidth, 6, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(ps.id, marginLeft + 3, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(ps.nama, marginLeft + 32, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(ps.kategori, marginLeft + 95, y + 4.2);
    doc.text(ps.satuan, marginLeft + 135, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(ps.totalQty.toLocaleString('id-ID'), marginLeft + 185, y + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${ps.percentage.toFixed(1)}%`, marginLeft + 215, y + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Rp ${ps.subtotal.toLocaleString('id-ID')}`, marginLeft + contentWidth - 4, y + 4.2, { align: 'right' });

    y += 6;
  });

  // Table 1 Total Row
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(marginLeft, y, contentWidth, 6.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 58, 138);
  doc.text('TOTAL SELURUH PRODUK', marginLeft + 3, y + 4.5);
  doc.text(`${params.totalUnit.toLocaleString('id-ID')} Unit`, marginLeft + 185, y + 4.5, { align: 'right' });
  doc.text('100.0%', marginLeft + 215, y + 4.5, { align: 'right' });
  doc.text(`Rp ${params.totalTagihan.toLocaleString('id-ID')}`, marginLeft + contentWidth - 4, y + 4.5, { align: 'right' });

  // SECTION 2: DATA DISTRIBUSI TERKIRIM (DYNAMIC COLUMNS ACCORDING TO MASTER PRODUK)
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('DATA DISTRIBUSI TERKIRIM (RINCIAN PENGIRIMAN RESMI)', marginLeft, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Rincian seluruh transaksi pengiriman, tujuan, armada, dan rincian produk periode ${params.periode}`, marginLeft, y + 3.8);

  y += 6.5;

  // Calculate dynamic product column widths
  const fixedColsWidth = 8 + 48 + 20 + 18 + 32 + 24 + 30; // 180mm fixed
  const productColsTotalWidth = contentWidth - fixedColsWidth; // ~93mm for products
  const numProducts = Math.max(1, params.products.length);
  const singleProdWidth = productColsTotalWidth / numProducts;

  // Header 2 - Row 1
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);

  let xPos = marginLeft;
  doc.text('No', xPos + 4, y + 4.2, { align: 'center' }); xPos += 8;
  doc.text('Nama & Tipe Mitra', xPos + 2, y + 4.2); xPos += 48;
  doc.text('Tanggal', xPos + 10, y + 4.2, { align: 'center' }); xPos += 20;
  doc.text('No S.J.', xPos + 9, y + 4.2, { align: 'center' }); xPos += 18;
  doc.text('Tujuan', xPos + 2, y + 4.2); xPos += 32;

  // Group Header: PRODUK / QTY
  doc.setFillColor(238, 242, 255);
  doc.rect(xPos, y, productColsTotalWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(49, 46, 129);
  doc.text('PRODUK / QTY', xPos + (productColsTotalWidth / 2), y + 2.2, { align: 'center' });

  // Subheaders for products
  params.products.forEach((prod, pIdx) => {
    const pX = xPos + (pIdx * singleProdWidth);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 58, 138);
    doc.text(prod.shortCode, pX + (singleProdWidth / 2), y + 5.2, { align: 'center' });
  });
  xPos += productColsTotalWidth;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('Metode', xPos + 12, y + 4.2, { align: 'center' }); xPos += 24;
  doc.text('Tagihan (Rp)', xPos + 28, y + 4.2, { align: 'right' });

  y += 6;

  // Data rows
  doc.setFont('helvetica', 'normal');
  params.distributions.forEach((dist, idx) => {
    // Check if new page needed
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 18;

      // Repeat table 2 header
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(marginLeft, y, contentWidth, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      let repX = marginLeft;
      doc.text('No', repX + 4, y + 4.2, { align: 'center' }); repX += 8;
      doc.text('Nama & Tipe Mitra', repX + 2, y + 4.2); repX += 48;
      doc.text('Tanggal', repX + 10, y + 4.2, { align: 'center' }); repX += 20;
      doc.text('No S.J.', repX + 9, y + 4.2, { align: 'center' }); repX += 18;
      doc.text('Tujuan', repX + 2, y + 4.2); repX += 32;

      doc.setFillColor(238, 242, 255);
      doc.rect(repX, y, productColsTotalWidth, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(49, 46, 129);
      doc.text('PRODUK / QTY', repX + (productColsTotalWidth / 2), y + 2.2, { align: 'center' });

      params.products.forEach((prod, pIdx) => {
        const pX = repX + (pIdx * singleProdWidth);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(30, 58, 138);
        doc.text(prod.shortCode, pX + (singleProdWidth / 2), y + 5.2, { align: 'center' });
      });
      repX += productColsTotalWidth;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text('Metode', repX + 12, y + 4.2, { align: 'center' }); repX += 24;
      doc.text('Tagihan (Rp)', repX + 28, y + 4.2, { align: 'right' });

      y += 6;
    }

    const isEven = idx % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginLeft, y, contentWidth, 5.8, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginLeft, y, contentWidth, 5.8, 'S');

    let rowX = marginLeft;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(String(dist.no), rowX + 4, y + 4, { align: 'center' }); rowX += 8;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const shortCust = dist.namaPelanggan.length > 25 ? dist.namaPelanggan.slice(0, 23) + '..' : dist.namaPelanggan;
    doc.text(shortCust, rowX + 2, y + 4); rowX += 48;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(dist.tanggal, rowX + 10, y + 4, { align: 'center' }); rowX += 20;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(dist.noSuratJalan, rowX + 9, y + 4, { align: 'center' }); rowX += 18;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const shortDest = dist.tujuan.length > 18 ? dist.tujuan.slice(0, 16) + '..' : dist.tujuan;
    doc.text(shortDest, rowX + 2, y + 4); rowX += 32;

    // Product dynamic cells
    params.products.forEach((prod, pIdx) => {
      const q = dist.productQtys[prod.id] || 0;
      const pX = rowX + (pIdx * singleProdWidth);
      if (q > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 78, 216);
        doc.text(String(q), pX + (singleProdWidth / 2), y + 4, { align: 'center' });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(156, 163, 175);
        doc.text('0', pX + (singleProdWidth / 2), y + 4, { align: 'center' });
      }
    });
    rowX += productColsTotalWidth;

    // Metode
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(dist.metodeKirim === 'Ambil Sendiri' ? 'Ambil Sendiri' : 'Diantar', rowX + 12, y + 4, { align: 'center' }); rowX += 24;

    // Tagihan
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Rp ${dist.totalTagihan.toLocaleString('id-ID')}`, rowX + 28, y + 4, { align: 'right' });

    y += 5.8;
  });

  // Table 2 Total Row
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginLeft, y, contentWidth, 6.5, 'FD');

  let totX = marginLeft;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL REKAP', totX + 12, y + 4.5);
  totX += 8 + 48 + 20 + 18 + 32;

  // Sum per product column
  params.products.forEach((prod, pIdx) => {
    const sumP = params.distributions.reduce((sum, d) => sum + (d.productQtys[prod.id] || 0), 0);
    const pX = totX + (pIdx * singleProdWidth);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(sumP > 0 ? String(sumP) : '0', pX + (singleProdWidth / 2), y + 4.5, { align: 'center' });
  });
  totX += productColsTotalWidth;

  doc.text('-', totX + 12, y + 4.5, { align: 'center' }); totX += 24;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`Rp ${params.totalTagihan.toLocaleString('id-ID')}`, totX + 28, y + 4.5, { align: 'right' });

  // Signatures
  y += 12;
  if (y > pageHeight - 32) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Klaten, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), pageWidth - marginLeft - 65, y);

  y += 4;
  doc.text('Petugas Logistik & Distribusi,', marginLeft + 15, y);
  doc.text('Kepala Operasional / Keuangan,', pageWidth - marginLeft - 65, y);

  // Draw company stamp on right signature
  drawOfficialCompanyStamp(doc, pageWidth - marginLeft - 45, y + 10, 13);

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('( Raditya / Tim Armada )', marginLeft + 15, y);
  doc.text('( H. Mujiburrahman, SIP )', pageWidth - marginLeft - 65, y);

  const saveFilename = params.filename || `Laporan_Distribusi_${params.periode}.pdf`;
  doc.save(saveFilename.endsWith('.pdf') ? saveFilename : `${saveFilename}.pdf`);
}

/**
 * GENERATE OFFICIAL PURCHASE ORDER (PO) PDF
 * Format 100% identik dengan format resmi PT. ANUGERAH ILLAHI RABBI
 */
export async function generatePurchaseOrderPDF(params: {
  noPO: string;
  tanggalPO: string;
  orderKe: string;
  alamatSupplier: string;
  syaratKetentuan?: string;
  grandTotal: number;
  items: {
    namaProduk: string;
    spesifikasi?: string;
    qty: number;
    hargaSatuan: number;
    totalHarga: number;
  }[];
  signatories?: {
    id: string;
    keterangan: string;
    nama: string;
    jabatan: string;
    customTtdImage?: string;
    useCustomTtdImage?: boolean;
  }[];
  customSettings?: {
    namaPerusahaan?: string;
    subNamaPerusahaan?: string;
    alamatPerusahaan?: string;
    kontakPerusahaan?: string;
    customKopImage?: string;
    useCustomKopImage?: boolean;
    kopWidth?: number;
    kopHeight?: number;
    customCapImage?: string;
    useCustomCapImage?: boolean;
    showCap?: boolean;
    capWidth?: number;
    capHeight?: number;
    customTtdImage?: string;
    useCustomTtdImage?: boolean;
    showTtd?: boolean;
    namaPenandatangan?: string;
    jabatanPenandatangan?: string;
  };
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentWidth = pageWidth - (marginX * 2);

  // Pre-fetch authentic branding images (Kop, Cap, TTD)
  let kopPng = '';
  let capPng = '';
  let ttdPng = '';
  try {
    [kopPng, capPng, ttdPng] = await Promise.all([
      getKopSuratPng(),
      getCapStampPng(),
      getTtdMarkoPng()
    ]);
  } catch (e) {
    console.error('Error prefetching authentic branding images for PO:', e);
  }

  const cs = params.customSettings;
  const useCustomKop = Boolean(cs?.useCustomKopImage && cs?.customKopImage);
  if (useCustomKop) {
    kopPng = cs!.customKopImage!;
  }
  const useCustomCap = Boolean(cs?.useCustomCapImage && cs?.customCapImage);
  if (useCustomCap) {
    capPng = cs!.customCapImage!;
  }

  // 1. KOP SURAT
  const customNama = cs?.namaPerusahaan?.trim();
  const isDefaultNama = !customNama || customNama.toUpperCase() === 'PT. ANUGERAH ILLAHI RABBI';

  if (useCustomKop) {
    // Gunakan custom image yang di-upload user
    const userKopW = Math.min(cs?.kopWidth ?? 100, 100);
    const userKopH = Math.min(Math.max((cs?.kopHeight ?? 90) * 0.264583, 15), 45); // px ke mm
    const finalW = (contentWidth * userKopW) / 100;
    const finalX = marginX + (contentWidth - finalW) / 2;
    doc.addImage(kopPng, 'PNG', finalX, 8, finalW, userKopH, undefined, 'FAST');
  } else if (isDefaultNama && kopPng) {
    // Gunakan Kop Resmi Banner AIR
    const kopHeight = contentWidth * (155 / 1000); // ~27.9 mm
    doc.addImage(kopPng, 'PNG', marginX, 8, contentWidth, kopHeight, undefined, 'FAST');
  } else {
    // Mode Kop Teks (sesuai input nama & alamat di setting PO)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(customNama || 'PT. ANUGERAH ILLAHI RABBI', marginX, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    if (cs?.subNamaPerusahaan) {
      doc.text(cs.subNamaPerusahaan, marginX, 19.5);
    }
    const alm = cs?.alamatPerusahaan || 'Dk. Gading Baru, RT.03, RW.08, Belangwetan, Klaten Utara, Klaten';
    const ktk = cs?.kontakPerusahaan || '0856 4000 1926 | anugerahillahirabbi@gmail.com';
    doc.text(`${alm} • Kontak: ${ktk}`, marginX, cs?.subNamaPerusahaan ? 24 : 20.5);

    // Garis pembatas bawah kop
    const lineY = cs?.subNamaPerusahaan ? 27 : 24;
    doc.setDrawColor(0, 150, 199);
    doc.setLineWidth(0.8);
    doc.line(marginX, lineY, marginX + contentWidth, lineY);
    doc.setDrawColor(2, 48, 71);
    doc.setLineWidth(0.3);
    doc.line(marginX, lineY + 1, marginX + contentWidth, lineY + 1);
  }

  // 2. PURCHASE ORDER TITLE & METADATA (Di sisi kanan)
  let currentY = 43;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 82, 204); // Vibrant Blue #0052cc persis gambar
  doc.text('Purchase Order', pageWidth - marginX, currentY, { align: 'right' });

  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`No : ${params.noPO}`, pageWidth - marginX, currentY, { align: 'right' });

  currentY += 5;
  let tglFormatted = params.tanggalPO;
  try {
    const rawTgl = params.tanggalPO;
    if (rawTgl.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = rawTgl.split('-').map(Number);
      const bulanNama = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      tglFormatted = `${d} ${bulanNama[m - 1]} ${y}`;
    }
  } catch (e) {}
  doc.text(`Tanggal : ${tglFormatted}`, pageWidth - marginX, currentY, { align: 'right' });

  // 3. INFO PEMESAN & ORDER KE (2 Columns Sejajar)
  currentY += 8;
  const colW = (contentWidth - 14) / 2;
  const colLeftX = marginX;
  const colRightX = marginX + colW + 14;

  // Header Info Pemesan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Info Pemesan', colLeftX, currentY);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.35);
  doc.line(colLeftX, currentY + 1.8, colLeftX + colW, currentY + 1.8);

  // Header Order Ke
  doc.text('Order Ke', colRightX, currentY);
  doc.line(colRightX, currentY + 1.8, colRightX + colW, currentY + 1.8);

  currentY += 6.5;
  // Detail Info Pemesan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(cs?.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI', colLeftX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const pemesanAlamatLines = doc.splitTextToSize(
    cs?.alamatPerusahaan || 'Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan,\nKec. Klaten Utara, Kab. Klaten, 57438',
    colW
  );
  doc.text(pemesanAlamatLines, colLeftX, currentY + 4);

  // Detail Order Ke (Vendor)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(params.orderKe.toUpperCase(), colRightX, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const vendorAlamatLines = doc.splitTextToSize(params.alamatSupplier || '-', colW);
  doc.text(vendorAlamatLines, colRightX, currentY + 4);

  const maxLines = Math.max(pemesanAlamatLines.length, vendorAlamatLines.length);
  currentY += 5 + (maxLines * 4) + 6;

  // 4. TABEL PRODUK
  // Background Header: Dark Navy #0b2546 persis mockup
  const tableHeaderY = currentY;
  const headerHeight = 8;
  doc.setFillColor(11, 37, 70); // RGB (11, 37, 70)
  doc.rect(marginX, tableHeaderY, contentWidth, headerHeight, 'F');

  // Header Columns Alignment
  const col1X = marginX + 3;
  const col2X = marginX + 88;
  const col3X = marginX + 122;
  const col4X = marginX + contentWidth - 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Produk', col1X, tableHeaderY + 5.2);
  doc.text('QTY', col2X, tableHeaderY + 5.2, { align: 'center' });
  doc.text('Harga', col3X, tableHeaderY + 5.2, { align: 'center' });
  doc.text('Total', col4X, tableHeaderY + 5.2, { align: 'right' });

  currentY = tableHeaderY + headerHeight + 5.5;

  // Baris Item Produk
  params.items.forEach((it) => {
    if (currentY > pageHeight - 65) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(it.namaProduk.toUpperCase(), col1X, currentY);

    // QTY
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(it.qty.toLocaleString('id-ID'), col2X, currentY, { align: 'center' });

    // Harga Satuan
    doc.text(`Rp${it.hargaSatuan.toLocaleString('id-ID')},00`, col3X + 4, currentY, { align: 'center' });

    // Total Harga
    doc.setFont('helvetica', 'bold');
    doc.text(`Rp${it.totalHarga.toLocaleString('id-ID')},00`, col4X, currentY, { align: 'right' });

    // Spesifikasi di bawah nama produk
    if (it.spesifikasi && it.spesifikasi.trim()) {
      currentY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const specLines = doc.splitTextToSize(it.spesifikasi, 75);
      doc.text(specLines, col1X, currentY);
      currentY += (specLines.length * 3.5);
    } else {
      currentY += 4.5;
    }

    currentY += 3;
  });

  // Garis Total (Border tebal hitam atas dan bawah)
  currentY += 2;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.7);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  currentY += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Total :', col2X + 15, currentY, { align: 'right' });
  doc.text(`Rp${params.grandTotal.toLocaleString('id-ID')},00`, col4X, currentY, { align: 'right' });

  currentY += 2.5;
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  // 5. SYARAT & KETENTUAN (Di sebelah kiri)
  currentY += 8;
  const termsY = currentY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Syarat & Ketentuan', marginX, termsY);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.35);
  doc.line(marginX, termsY + 1.8, marginX + 65, termsY + 1.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const termsLines = doc.splitTextToSize(
    params.syaratKetentuan || 'Kirim sesuai instruksi dan kesepakatan order.',
    75
  );
  doc.text(termsLines, marginX, termsY + 6);

  // 6. TANDA TANGAN (Mengikuti poSettings.signatories & showCap)
  const showCap = cs?.showCap ?? true;
  const userCapMm = Math.min(Math.max((cs?.capWidth ?? 80) * 0.264583, 16), 34); // px ke mm

  // Daftar penandatangan dari parameter atau fallback default
  const sigList = (params.signatories && params.signatories.length > 0)
    ? params.signatories
    : [{
        id: 'single',
        keterangan: `Klaten, ${tglFormatted}`,
        nama: cs?.namaPenandatangan || 'Marko Dwi Nugroho',
        jabatan: cs?.jabatanPenandatangan || 'Bag. Purcasing',
        customTtdImage: cs?.customTtdImage,
        useCustomTtdImage: cs?.useCustomTtdImage
      }];

  if (sigList.length === 1) {
    // Mode Single Penandatangan (Kanan Bawah Persis Format Upload)
    const sig = sigList[0];
    const sigX = pageWidth - marginX - 32;
    let sigY = termsY;

    // Tanggal / Keterangan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(sig.keterangan || `Klaten, ${tglFormatted}`, sigX, sigY, { align: 'center' });

    // Cap Stempel & TTD
    sigY += 2;
    if (showCap) {
      if (capPng) {
        doc.addImage(capPng, 'PNG', sigX - (userCapMm * 0.65), sigY, userCapMm, userCapMm, undefined, 'FAST');
      } else {
        drawOfficialCompanyStamp(doc, sigX, sigY + 12, 12);
      }
    }

    // Render TTD: custom jika ada, atau official Marko jika nama Marko, atau kosong jika tanda tangan basah
    const hasCustomTtd = Boolean(sig.customTtdImage && sig.customTtdImage.trim().length > 30);
    const isMarko = sig.nama.toLowerCase().includes('marko');
    if (hasCustomTtd && sig.customTtdImage) {
      const imgFormat = sig.customTtdImage.includes('image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(sig.customTtdImage, imgFormat, sigX - 16, sigY - 1, 32, 20, undefined, 'FAST');
    } else if (isMarko && sig.useCustomTtdImage !== false && ttdPng) {
      doc.addImage(ttdPng, 'PNG', sigX - 14, sigY - 2, 34, 21, undefined, 'FAST');
    }

    sigY += 23;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.nama, sigX, sigY, { align: 'center' });

    sigY += 3.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(sig.jabatan, sigX, sigY, { align: 'center' });
  } else {
    // Mode Multiple Penandatangan (Sejajar Rapi Horizontal)
    const numSigs = sigList.length;
    const sigColW = contentWidth / numSigs;
    const sigTopY = termsY + 2;

    sigList.forEach((sig, idx) => {
      const centerX = marginX + (idx * sigColW) + (sigColW / 2);
      let sY = sigTopY;

      // Baris Keterangan Pengesahan
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(sig.keterangan || (idx === 0 ? 'Diterima Vendor,' : 'Hormat Kami,'), centerX, sY, { align: 'center' });

      sY += 3;
      // Cap Stempel (muncul pada penandatangan internal kedua / terakhir jika showCap aktif)
      const isInternalSig = (idx === 1 || (idx === numSigs - 1 && numSigs > 1));
      if (showCap && isInternalSig) {
        if (capPng) {
          doc.addImage(capPng, 'PNG', centerX - (userCapMm * 0.65), sY, userCapMm, userCapMm, undefined, 'FAST');
        } else {
          drawOfficialCompanyStamp(doc, centerX, sY + 10, 10);
        }
      }

      // Tanda Tangan
      const hasCustomTtd = Boolean(sig.customTtdImage && sig.customTtdImage.trim().length > 30);
      const isMarko = sig.nama.toLowerCase().includes('marko');
      if (hasCustomTtd && sig.customTtdImage) {
        const imgFormat = sig.customTtdImage.includes('image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(sig.customTtdImage, imgFormat, centerX - 15, sY, 30, 18, undefined, 'FAST');
      } else if (isMarko && sig.useCustomTtdImage !== false && ttdPng) {
        doc.addImage(ttdPng, 'PNG', centerX - 14, sY - 1, 32, 19, undefined, 'FAST');
      }

      sY += 21;
      // Garis nama
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(centerX - (sigColW * 0.35), sY, centerX + (sigColW * 0.35), sY);

      sY += 3.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(sig.nama, centerX, sY, { align: 'center' });

      sY += 3.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(sig.jabatan, centerX, sY, { align: 'center' });
    });
  }

  // Unduh File PDF
  const sanitizedNo = sanitizeFilename(params.noPO || 'PO');
  const filename = `Purchase_Order_${sanitizedNo}.pdf`;
  doc.save(filename);
}

