/**
 * Authentic Invoice Assets matching official PT. ANUGERAH ILLAHI RABBI documents:
 * 1. KOP SURAT A4 F4 BARU (KOP SURAT A4 F4  BARU.png)
 * 2. CAP (cap.png - Blue Wave + A 1 R + ANUGERAH ILLAHI RABBI)
 * 3. TTD MARKO (ttd marko.png - Marko Dwi Nugroho handwriting signature)
 */

/**
 * 1. Exact SVG matching "KOP SURAT A4 F4  BARU.png"
 * - 4 cresting ocean wave plumes in cyan/blue gradient
 * - "A   1   R" outlined block athletic letters
 * - Contact info: Phone & Email with cyan circular icons to the left of the bottom bar
 * - Company Name: PT. ANUGERAH ILLAHI RABBI (bold black)
 * - Factory Address in Klaten (right-aligned)
 * - Bottom two-tone separator bar (Cyan ~78%, Navy Blue ~22%)
 */
export const KOP_SURAT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 155" width="1000" height="155">
  <defs>
    <!-- Wave Gradient from deep ocean navy to bright cyan -->
    <linearGradient id="kopWaveGrad" x1="0%" y1="100%" x2="75%" y2="0%">
      <stop offset="0%" stop-color="#023047" />
      <stop offset="35%" stop-color="#0353a4" />
      <stop offset="70%" stop-color="#0096c7" />
      <stop offset="100%" stop-color="#00b4d8" />
    </linearGradient>

    <!-- Outlined Letters Gradient for A 1 R -->
    <linearGradient id="kopLetterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00b4d8" />
      <stop offset="100%" stop-color="#0077b6" />
    </linearGradient>
  </defs>

  <!-- ============================================================ -->
  <!-- LEFT: 4 CRESTING OCEAN WAVE PLUMES                           -->
  <!-- ============================================================ -->
  <g transform="translate(10, 6)">
    <!-- 1st wave plume (leftmost small plume) -->
    <path d="M 5,100 C 14,80 20,55 32,38 C 28,54 26,76 30,100 C 22,100 12,100 5,100 Z" 
          fill="url(#kopWaveGrad)" />

    <!-- 2nd wave plume (medium plume) -->
    <path d="M 28,100 C 36,65 52,32 70,18 C 62,38 56,70 60,100 C 48,100 38,100 28,100 Z" 
          fill="url(#kopWaveGrad)" />

    <!-- 3rd wave plume (tall rising crest) -->
    <path d="M 56,100 C 64,52 88,20 118,6 C 104,26 94,58 98,100 C 84,100 70,100 56,100 Z" 
          fill="url(#kopWaveGrad)" />

    <!-- 4th wave plume: Main giant curling ocean wave barrel -->
    <path d="M 85,100 C 92,50 124,14 165,18 C 182,21 195,35 190,56 C 185,72 170,80 156,72 C 144,64 146,45 158,36 C 132,38 120,58 116,100 C 106,100 95,100 85,100 Z" 
          fill="url(#kopWaveGrad)" />

    <!-- Inner curling wave tip highlight -->
    <path d="M 135,42 C 150,30 178,34 175,54 C 172,66 160,70 152,65 C 142,58 144,45 152,40 Z" 
          fill="#00b4d8" />

    <!-- ============================================================ -->
    <!-- "A   1   R" OUTLINED ATHLETIC BLOCK LETTERING                -->
    <!-- ============================================================ -->
    <g transform="translate(6, 108)">
      <!-- Letter 'A' -->
      <path d="M 22,38 L 12,38 L 4,38 L 18,0 L 32,0 L 46,38 L 38,38 L 34,26 L 16,26 Z M 20,18 L 30,18 L 25,6 Z" 
            fill="url(#kopLetterGrad)" stroke="#032b56" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M 20,18 L 30,18 L 25,6 Z" fill="#ffffff" />

      <!-- Number '1' -->
      <path d="M 64,38 L 84,38 L 84,28 L 78,28 L 78,8 L 68,14 L 64,8 L 80,0 L 88,0 L 88,28 L 94,28 L 94,38 Z" 
            fill="url(#kopLetterGrad)" stroke="#032b56" stroke-width="2.6" stroke-linejoin="round" />

      <!-- Letter 'R' -->
      <path d="M 112,38 L 122,38 L 122,24 L 134,24 L 144,38 L 156,38 L 144,22 C 152,20 156,15 156,8 C 156,0 146,0 132,0 L 112,0 Z M 122,8 L 132,8 C 138,8 142,10 142,14 C 142,18 138,20 132,20 L 122,20 Z" 
            fill="url(#kopLetterGrad)" stroke="#032b56" stroke-width="2.6" stroke-linejoin="round" />
      <path d="M 122,8 L 132,8 C 138,8 142,10 142,14 C 142,18 138,20 132,20 L 122,20 Z" fill="#ffffff" />
    </g>
  </g>

  <!-- ============================================================ -->
  <!-- CENTER/BOTTOM: PHONE & EMAIL CONTACTS                        -->
  <!-- ============================================================ -->
  <g transform="translate(505, 108)" text-anchor="end" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
    <!-- Phone -->
    <text x="-24" y="2" font-size="15" font-weight="600" fill="#222222">0856 4000 1926</text>
    <circle cx="-10" cy="-3" r="8.5" fill="#00b4d8" />
    <!-- White phone handset icon -->
    <path d="M -13,-6 C -13,-7 -11,-8 -9,-6 L -8,-5 C -7,-4 -7,-3 -8,-2 C -7,0 -6,1 -4,2 C -3,1 -2,1 -1,0 L 0,1 C 2,3 1,4 0,5 C -3,5 -6,2 -9,-1 C -12,-4 -13,-6 -13,-6 Z" 
          fill="#ffffff" transform="scale(0.85) translate(-3, -2)" />

    <!-- Email -->
    <text x="-24" y="26" font-size="14.5" font-weight="500" fill="#222222">anugerahillahirabbi@gmail.com</text>
    <circle cx="-10" cy="21" r="8.5" fill="#00b4d8" />
    <!-- White envelope icon -->
    <rect x="-14" y="16.5" width="8" height="6.5" rx="1" fill="none" stroke="#ffffff" stroke-width="1.2" />
    <path d="M -14,17.5 L -10,21 L -6,17.5" fill="none" stroke="#ffffff" stroke-width="1.2" />
  </g>

  <!-- ============================================================ -->
  <!-- RIGHT: COMPANY NAME & FACTORY ADDRESS (RIGHT-ALIGNED)        -->
  <!-- ============================================================ -->
  <g transform="translate(985, 34)" text-anchor="end">
    <!-- PT. ANUGERAH ILLAHI RABBI (Heavy bold sans-serif) -->
    <text x="0" y="0" font-family="'Arial Black', Impact, Arial, sans-serif" font-size="34" font-weight="900" fill="#202020" letter-spacing="-0.5">
      PT. ANUGERAH ILLAHI RABBI
    </text>
    <!-- Address Line 1 -->
    <text x="0" y="32" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18.5" font-weight="600" fill="#2a2a2a">
      Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan,
    </text>
    <!-- Address Line 2 -->
    <text x="0" y="58" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18.5" font-weight="600" fill="#2a2a2a">
      Kec. Klaten Utara, Kab. Klaten, 57438
    </text>
  </g>

  <!-- ============================================================ -->
  <!-- BOTTOM TWO-TONE SEPARATOR BAR (CYAN ~78%, NAVY BLUE ~22%)    -->
  <!-- ============================================================ -->
  <g transform="translate(535, 143)">
    <!-- Cyan Left Segment (~78%) -->
    <rect x="0" y="0" width="355" height="11" fill="#00b4d8" />
    <!-- Navy Blue Right Segment (~22%) -->
    <rect x="355" y="0" width="95" height="11" fill="#1e3a8a" />
  </g>
</svg>
`;

/**
 * 2. Exact SVG matching "cap.png"
 * - Blue wave crest logo
 * - "A   1   R" outlined athletic block lettering
 * - "ANUGERAH ILLAHI RABBI" text in navy blue
 * - Tilted ~ -6 degrees
 */
export const CAP_STAMP_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260">
  <defs>
    <linearGradient id="capWaveGrad" x1="0%" y1="100%" x2="80%" y2="0%">
      <stop offset="0%" stop-color="#082d56" />
      <stop offset="55%" stop-color="#0f4c81" />
      <stop offset="100%" stop-color="#196cb0" />
    </linearGradient>
  </defs>

  <g transform="rotate(-6 130 130)">
    <!-- Wave Crest Plumes -->
    <g transform="translate(25, 20)">
      <!-- Left Plume -->
      <path d="M 12,120 C 18,85 34,48 50,22 C 42,48 38,80 44,120 C 32,120 20,120 12,120 Z" fill="url(#capWaveGrad)" />
      <!-- Middle Plume -->
      <path d="M 42,120 C 50,68 74,28 100,8 C 88,30 80,72 84,120 C 70,120 56,120 42,120 Z" fill="url(#capWaveGrad)" />
      <!-- Giant Breaker Curling Over -->
      <path d="M 78,120 C 86,58 120,16 160,20 C 182,24 195,42 190,64 C 185,80 170,88 158,78 C 146,70 148,50 160,44 C 135,46 122,68 118,120 C 104,120 90,120 78,120 Z" fill="url(#capWaveGrad)" />
      <!-- Inner curl shadow -->
      <path d="M 140,48 C 155,38 175,42 172,60 C 170,72 160,76 152,72 C 144,64 144,52 152,48 Z" fill="#0d416f" />
    </g>

    <!-- Athletic A 1 R with white contour inline -->
    <g transform="translate(20, 152)">
      <!-- A -->
      <g transform="translate(10, 0)">
        <path d="M 22,46 L 11,46 L 2,46 L 17,0 L 31,0 L 46,46 L 37,46 L 33,32 L 15,32 Z M 19,22 L 29,22 L 24,7 Z" 
              fill="#0b3154" stroke="#051c33" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 19,22 L 29,22 L 24,7 Z" fill="#ffffff" />
        <path d="M 20,43 L 13,43 L 24,5 L 34,5 L 43,43 L 36,43 L 33,30 L 17,30 Z" fill="none" stroke="#90e0ef" stroke-width="1.4" />
      </g>

      <!-- 1 -->
      <g transform="translate(85, 0)">
        <path d="M 10,46 L 30,46 L 30,36 L 24,36 L 24,10 L 14,16 L 10,9 L 26,0 L 34,0 L 34,36 L 40,36 L 40,46 Z" 
              fill="#0b3154" stroke="#051c33" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 12,44 L 28,44 L 28,34 L 22,34 L 22,8 L 15,13 L 24,2 L 32,2 L 32,34 L 38,34 L 38,44 Z" fill="none" stroke="#90e0ef" stroke-width="1.4" />
      </g>

      <!-- R -->
      <g transform="translate(150, 0)">
        <path d="M 4,46 L 16,46 L 16,30 L 29,30 L 40,46 L 54,46 L 42,27 C 50,24 55,19 55,10 C 55,0 44,0 29,0 L 4,0 Z M 16,10 L 29,10 C 36,10 40,12 40,18 C 40,24 36,26 29,26 L 16,26 Z" 
              fill="#0b3154" stroke="#051c33" stroke-width="2.5" stroke-linejoin="round" />
        <path d="M 16,10 L 29,10 C 36,10 40,12 40,18 C 40,24 36,26 29,26 L 16,26 Z" fill="#ffffff" />
        <path d="M 6,44 L 14,44 L 14,28 L 29,28 L 40,44 L 50,44 L 39,26 C 47,23 52,18 52,10 C 52,2 42,2 29,2 L 6,2 Z" fill="none" stroke="#90e0ef" stroke-width="1.4" />
      </g>
    </g>

    <!-- ANUGERAH ILLAHI RABBI text -->
    <text x="130" y="226" text-anchor="middle" font-family="'Arial Black', Arial, sans-serif" 
          font-size="15" font-weight="900" fill="#0b3154" letter-spacing="1.4">
      ANUGERAH ILLAHI RABBI
    </text>
  </g>
</svg>
`;

/**
 * 3. Exact SVG matching "ttd marko.png"
 * - Hand-drawn black ink signature of Marko Dwi Nugroho
 * - Large initial oval loop on left
 * - High ascending needle peak
 * - Rhythmic cursive waves
 * - Plunging descender needle
 * - Dynamic diagonal slash slicing across the signature
 */
export const TTD_MARKO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" width="420" height="300">
  <g fill="none" stroke="#080808" stroke-linecap="round" stroke-linejoin="round">
    <!-- 1. Left sweeping oval loop (starting upper left, rounding bottom and up inside) -->
    <path d="M 130,55 C 95,40 38,70 18,125 C 2,185 30,245 78,255 C 118,260 135,210 130,135 C 126,90 120,65 125,58" 
          stroke-width="4.8" />

    <!-- 2. Tall needle spike shooting straight up from base to apex -->
    <path d="M 125,230 L 172,12 L 180,155" 
          stroke-width="5.0" />

    <!-- 3. Second needle peak -->
    <path d="M 180,145 L 196,42 L 202,135" 
          stroke-width="4.4" />

    <!-- 4. Cursive zigzag letterforms ('marko') -->
    <path d="M 202,130 C 210,110 220,150 230,120 C 236,135 246,110 255,140" 
          stroke-width="4.2" />

    <!-- 5. Vertical needle descender plunging deep below baseline -->
    <path d="M 255,38 L 235,285" 
          stroke-width="4.8" />

    <!-- 6. Accent dot / flick near vertical descender -->
    <path d="M 235,80 L 237,92" 
          stroke-width="4.5" />

    <!-- 7. Dynamic bold diagonal slash cutting across from bottom-left all the way up-right -->
    <path d="M 85,255 L 390,115" 
          stroke-width="5.2" />
  </g>
</svg>
`;

/**
 * Cache for rasterized PNG data URLs
 */
const pngCache: Record<string, string> = {};

/**
 * Converts an SVG string into an optimized PNG Data URL via HTML5 Canvas
 */
export async function rasterizeSvgToPng(svgString: string, width: number, height: number): Promise<string> {
  const cacheKey = `${width}x${height}_${svgString.length}`;
  if (pngCache[cacheKey]) {
    return pngCache[cacheKey];
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        URL.revokeObjectURL(url);
        const pngDataUrl = canvas.toDataURL('image/png');
        pngCache[cacheKey] = pngDataUrl;
        resolve(pngDataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback to inline SVG data URL
        const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
        resolve(fallback);
      };

      img.src = url;
    } catch {
      const fallback = `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
      resolve(fallback);
    }
  });
}

/**
 * Helper getters for crystal-clear yet ultra-lightweight PNG data URLs (<100 KB total)
 */
export async function getKopSuratPng(): Promise<string> {
  return rasterizeSvgToPng(KOP_SURAT_SVG, 1000, 155);
}

export async function getCapStampPng(): Promise<string> {
  return rasterizeSvgToPng(CAP_STAMP_SVG, 250, 250);
}

export async function getTtdMarkoPng(): Promise<string> {
  return rasterizeSvgToPng(TTD_MARKO_SVG, 350, 250);
}
