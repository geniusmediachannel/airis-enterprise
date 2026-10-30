/**
 * Formatters Utility - Standardisasi format tampilan angka, tanggal, dan mata uang AIRIS
 */

/**
 * Mengubah string tanggal, Date object, atau Excel serial number menjadi format baku: DD-MM-YYYY
 * Contoh hasil:
 * - "2026-10-15" -> "15-10-2026"
 * - "15-Okt-2026" -> "15-10-2026"
 * - "15-Sep-2026" -> "15-09-2026"
 * - "2026/10/01" -> "01-10-2026"
 * - 45590 (Excel) -> "15-10-2026"
 */
export function formatDateDDMMYYYY(dateVal?: string | number | Date | null): string {
  if (!dateVal && dateVal !== 0) return '-';

  // Jika sudah berformat DD-MM-YYYY
  if (typeof dateVal === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateVal.trim())) {
    return dateVal.trim();
  }

  // Jika berupa Date object
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '-';
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Jika nomor serial Excel (misal 45590)
  if (typeof dateVal === 'number' || (!isNaN(Number(dateVal)) && Number(dateVal) > 30000 && Number(dateVal) < 60000)) {
    const serial = Number(dateVal);
    const d = new Date((serial - 25569) * 86400 * 1000);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const str = String(dateVal).trim();
  if (!str || str === '-') return '-';

  // 1. Pola ISO / Database: YYYY-MM-DD atau YYYY/MM/DD atau YYYY.MM.DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // 2. Pola Nama Bulan (ID / EN): 15-Okt-2026, 16-Sep-2026, 01-Oct-26, dll
  const monthsIndo = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
  const monthsEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const lower = str.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (lower.includes(monthsIndo[i]) || lower.includes(monthsEn[i])) {
      const yrMatch = str.match(/(20\d{2}|\d{2})/);
      const dayMatch = str.match(/^(\d{1,2})/);
      if (dayMatch) {
        const d = dayMatch[1].padStart(2, '0');
        const m = String(i + 1).padStart(2, '0');
        let y = yrMatch ? yrMatch[1] : '2026';
        if (y.length === 2) y = `20${y}`;
        return `${d}-${m}-${y}`;
      }
    }
  }

  // 3. Pola DD/MM/YYYY atau DD-MM-YYYY (4-digit year)
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${d}-${m}-${y}`;
  }

  // 4. Pola DD/MM/YY atau DD-MM-YY (2-digit year)
  const dmyShort = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShort) {
    const d = dmyShort[1].padStart(2, '0');
    const m = dmyShort[2].padStart(2, '0');
    const y = `20${dmyShort[3]}`;
    return `${d}-${m}-${y}`;
  }

  // 5. Fallback native Date parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return str;
}
