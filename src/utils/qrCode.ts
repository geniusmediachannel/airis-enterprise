/**
 * AIRIS Enterprise - Standalone Pure TypeScript QR Code Generator
 * Zero external dependencies. Generates valid QR Code module matrix for Version 1 to 6 (EC Level M/L).
 */

// Galois Field GF(256) tables
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let val = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = val;
  EXP[i + 255] = val;
  LOG[val] = i;
  val = (val << 1) ^ (val & 128 ? 0x11d : 0);
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCalculateRemainder(data: number[], ecCount: number): number[] {
  const poly = rsGeneratorPoly(ecCount);
  const buf = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) buf[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coef = buf[i];
    if (coef !== 0) {
      for (let j = 0; j < poly.length; j++) {
        buf[i + j] ^= gfMul(poly[j], coef);
      }
    }
  }
  return buf.slice(data.length);
}

// Version table configurations (EC Level M: medium recovery ~15%)
interface QRVersionConfig {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  blocks: { count: number; dataCodewords: number }[];
  alignmentPositions: number[];
}

const VERSION_CONFIGS: QRVersionConfig[] = [
  {
    version: 1,
    totalCodewords: 26,
    ecCodewordsPerBlock: 10,
    blocks: [{ count: 1, dataCodewords: 16 }],
    alignmentPositions: []
  },
  {
    version: 2,
    totalCodewords: 44,
    ecCodewordsPerBlock: 16,
    blocks: [{ count: 1, dataCodewords: 28 }],
    alignmentPositions: [6, 18]
  },
  {
    version: 3,
    totalCodewords: 70,
    ecCodewordsPerBlock: 26,
    blocks: [{ count: 1, dataCodewords: 44 }],
    alignmentPositions: [6, 22]
  },
  {
    version: 4,
    totalCodewords: 100,
    ecCodewordsPerBlock: 18,
    blocks: [{ count: 2, dataCodewords: 32 }],
    alignmentPositions: [6, 26]
  },
  {
    version: 5,
    totalCodewords: 134,
    ecCodewordsPerBlock: 24,
    blocks: [{ count: 2, dataCodewords: 43 }],
    alignmentPositions: [6, 30]
  },
  {
    version: 6,
    totalCodewords: 172,
    ecCodewordsPerBlock: 16,
    blocks: [{ count: 4, dataCodewords: 27 }],
    alignmentPositions: [6, 34]
  }
];

// BCH format error correction: 15 bits for EC level M (00) and Mask 000
// EC M (00) | Mask 000 -> 00 000 = 00000 -> Format info with mask XOR 0x5412 = 0x5412
// If Mask 000: format bits 101010000010010
const FORMAT_INFO_M_MASK0 = [true, false, true, false, true, false, false, false, false, false, true, false, false, true, false];

export function generateQRMatrix(text: string): boolean[][] {
  // 1. Encode text to UTF-8 bytes
  const utf8Bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      utf8Bytes.push(code);
    } else if (code < 0x800) {
      utf8Bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      utf8Bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  // 2. Choose version
  let config = VERSION_CONFIGS[0];
  for (const cfg of VERSION_CONFIGS) {
    const totalData = cfg.blocks.reduce((sum, b) => sum + b.count * b.dataCodewords, 0);
    // Header: 4 bits mode + 8 bits char count = 12 bits -> 1.5 bytes + data length <= totalData
    if (utf8Bytes.length + 2 <= totalData) {
      config = cfg;
      break;
    }
    config = cfg; // fallback to largest supported
  }

  const totalDataCodewords = config.blocks.reduce((sum, b) => sum + b.count * b.dataCodewords, 0);

  // 3. Bit stream
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator: 0100
  pushBits(0b0100, 4);
  // Character count (8 bits for V1-6 byte mode)
  pushBits(utf8Bytes.length, 8);
  // Data bytes
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }

  // Terminator (up to 4 zero bits)
  const remainingBits = totalDataCodewords * 8 - bits.length;
  const termLen = Math.min(4, Math.max(0, remainingBits));
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Convert to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    dataBytes.push(byte);
  }

  // Pad bytes (0xEC, 0x11)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < totalDataCodewords) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // 4. Split data into blocks & calculate Reed-Solomon EC
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let byteOffset = 0;

  for (const blockGroup of config.blocks) {
    for (let b = 0; b < blockGroup.count; b++) {
      const blockData = dataBytes.slice(byteOffset, byteOffset + blockGroup.dataCodewords);
      byteOffset += blockGroup.dataCodewords;
      dataBlocks.push(blockData);
      ecBlocks.push(rsCalculateRemainder(blockData, config.ecCodewordsPerBlock));
    }
  }

  // Interleave data codewords
  const interleaved: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  // Interleave EC codewords
  for (let i = 0; i < config.ecCodewordsPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }

  // 5. Build QR Matrix
  const size = 17 + 4 * config.version;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean, isFunc = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (isFunc) isFunction[r][c] = true;
    }
  };

  // Finder pattern at (r, c)
  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          const isBlack = dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
          setModule(nr, nc, isBlack);
        } else {
          setModule(nr, nc, false); // Separator
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  if (config.alignmentPositions.length > 0) {
    const pos = config.alignmentPositions;
    for (const r of pos) {
      for (const c of pos) {
        // Skip if overlaps with finders
        if ((r === 6 && c === 6) || (r === 6 && c === pos[pos.length - 1]) || (r === pos[pos.length - 1] && c === 6)) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setModule(r + dr, c + dc, isBlack);
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const isBlack = i % 2 === 0;
    if (matrix[6][i] === null) setModule(6, i, isBlack);
    if (matrix[i][6] === null) setModule(i, 6, isBlack);
  }

  // Dark module
  setModule(size - 8, 8, true);

  // Reserve Format Info areas
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8][i] = true;
  }
  for (let i = size - 7; i < size; i++) {
    isFunction[i][8] = true;
  }

  // Convert interleaved data to flat bit array
  const allBits: boolean[] = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) {
      allBits.push(((b >> i) & 1) === 1);
    }
  }

  // Place data bits in zig-zag pattern
  let bitIdx = 0;
  let upwards = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing pattern
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const col of [right, right - 1]) {
        if (!isFunction[r][col]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : false;
          // Apply mask 000: (row + col) % 2 == 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // Write format info (Format: EC M, Mask 0)
  for (let i = 0; i < 15; i++) {
    const bit = FORMAT_INFO_M_MASK0[i];
    // Around top-left
    if (i <= 5) setModule(8, i, bit);
    else if (i === 6) setModule(8, 7, bit);
    else if (i === 7) setModule(8, 8, bit);
    else if (i === 8) setModule(7, 8, bit);
    else setModule(14 - i, 8, bit);

    // Around other finders
    if (i < 8) {
      setModule(size - 1 - i, 8, bit);
    } else {
      setModule(8, size - 15 + i, bit);
    }
  }

  // Return clean boolean matrix
  return matrix.map(row => row.map(cell => cell === true));
}
