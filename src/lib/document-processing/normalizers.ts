/**
 * Document Processing Normalizers
 * Context-aware normalization for dates, gender, digits, and OCR text
 */

export const INDONESIAN_MONTH_MAP: Record<string, string> = {
  // Indonesian full & abbreviations
  JANUARI: '01', JAN: '01',
  FEBRUARI: '02', FEB: '02',
  MARET: '03', MAR: '03',
  APRIL: '04', APR: '04',
  MEI: '05', MAY: '05',
  JUNI: '06', JUN: '06',
  JULI: '07', JUL: '07',
  AGUSTUS: '08', AGU: '08', AGT: '08', AUG: '08', AUGUST: '08',
  SEPTEMBER: '09', SEP: '09', SEPT: '09',
  OKTOBER: '10', OKT: '10', OCT: '10', OCTOBER: '10',
  NOVEMBER: '11', NOV: '11', NOPEMBER: '11', NOP: '11',
  DESEMBER: '12', DES: '12', DEC: '12', DECEMBER: '12',
};

/**
 * Normalizes varied date strings into standard ISO YYYY-MM-DD format
 * Supports:
 * - 14-08-1975, 14/08/1975, 14.08.1975
 * - 14 AGUSTUS 1975, 14 AUG 1975, 14-OKT-1988
 * - 1975-08-14
 */
export function normalizeIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim().replace(/[,.:;]/g, ' ').replace(/\s+/g, ' ');

  // Format 1: YYYY-MM-DD
  const isoMatch = cleaned.match(/^([0-9]{4})[\/\-. ]([0-9]{1,2})[\/\-. ]([0-9]{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    const mNum = parseInt(m, 10);
    const dNum = parseInt(d, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // Format 2: DD-MM-YYYY or DD/MM/YYYY
  const numMatch = cleaned.match(/^([0-9]{1,2})[\/\-. ]([0-9]{1,2})[\/\-. ]([0-9]{4})$/);
  if (numMatch) {
    const d = numMatch[1].padStart(2, '0');
    const m = numMatch[2].padStart(2, '0');
    const y = numMatch[3];
    const mNum = parseInt(m, 10);
    const dNum = parseInt(d, 10);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      return `${y}-${m}-${d}`;
    }
  }

  // Format 3: 14 AGUSTUS 1975 or 14 AUG 1975 or 05 OKTOBER 1992
  const textMonthMatch = cleaned.match(/^([0-9]{1,2})\s+([A-Za-z]+)\s+([0-9]{4})$/);
  if (textMonthMatch) {
    const d = textMonthMatch[1].padStart(2, '0');
    const monthKey = textMonthMatch[2].toUpperCase();
    const m = INDONESIAN_MONTH_MAP[monthKey];
    const y = textMonthMatch[3];
    if (m) {
      const dNum = parseInt(d, 10);
      if (dNum >= 1 && dNum <= 31) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  return '';
}

/**
 * Normalizes Indonesian / English gender indicators into MALE or FEMALE
 */
export function normalizeGender(genderStr: string): 'MALE' | 'FEMALE' | undefined {
  if (!genderStr) return undefined;
  const upper = genderStr.trim().toUpperCase();

  if (
    upper === 'MALE' ||
    upper === 'M' ||
    upper === 'L' ||
    upper === 'LAKI-LAKI' ||
    upper === 'LAKI - LAKI' ||
    upper === 'LAKI' ||
    upper === 'PRIA' ||
    upper.includes('L / M') ||
    upper.includes('L/M') ||
    upper.includes(': M') ||
    upper.includes(': L')
  ) {
    return 'MALE';
  }

  if (
    upper === 'FEMALE' ||
    upper === 'F' ||
    upper === 'P' ||
    upper === 'PEREMPUAN' ||
    upper === 'WANITA' ||
    upper.includes('P / F') ||
    upper.includes('P/F') ||
    upper.includes(': F') ||
    upper.includes(': P')
  ) {
    return 'FEMALE';
  }

  return undefined;
}

/**
 * Normalizes numeric OCR character confusion in digit-only zones (NIK, dates, check digits)
 * O->0, I/L/|->1, B->8, S->5, Z->2
 */
export function normalizeDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[Oo]/g, '0')
    .replace(/[IiLl|]/g, '1')
    .replace(/[Bb]/g, '8')
    .replace(/[Ss]/g, '5')
    .replace(/[Zz]/g, '2')
    .replace(/[^0-9]/g, '');
}

/**
 * Cleans OCR punctuation noise while preserving valid newlines and name punctuation
 */
export function cleanOcrText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[«»~`^{}\[\]\\]/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

/**
 * Normalizes alphanumeric tokens (e.g. Passport numbers, Certificate numbers)
 */
export function normalizeAlphanumeric(str: string): string {
  if (!str) return '';
  return str
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}
