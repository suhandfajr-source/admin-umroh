/**
 * Document Processing Validators & Garbage Rejection
 * Enforces structural integrity and prevents incorrect confident auto-fill
 */

import { normalizeDigits } from './normalizers';

/**
 * Validates Indonesian / International Passport Number
 * Format: 1-2 letters + 7-8 digits (e.g. C7263541, A1234567, X1234567)
 */
export function validatePassportNumber(num: string): { valid: boolean; normalized?: string; reason?: string } {
  if (!num) return { valid: false, reason: 'Nomor paspor kosong' };
  const cleaned = num.trim().toUpperCase().replace(/\s+/g, '');

  if (cleaned.length < 7 || cleaned.length > 9) {
    return { valid: false, reason: 'Panjang nomor paspor tidak standar (7-9 karakter)' };
  }

  // First character must be a letter
  const firstChar = cleaned[0];
  if (!/[A-Z]/.test(firstChar)) {
    return { valid: false, reason: 'Nomor paspor harus diawali huruf' };
  }

  // Rest should be digits (with OCR digit correction)
  const restRaw = cleaned.substring(1);
  const restDigits = normalizeDigits(restRaw);
  if (restDigits.length < 6 || restDigits.length > 8) {
    return { valid: false, reason: 'Karakter nomor paspor setelah huruf harus berupa angka' };
  }

  return { valid: true, normalized: `${firstChar}${restDigits}` };
}

/**
 * Validates Indonesian NIK (Nomor Induk Kependudukan)
 * Format: 16 digits
 * Embedded DOB:
 * - Chars 6-7: Tanggal lahir (Pria: 01-31, Wanita: 41-71)
 * - Chars 8-9: Bulan lahir (01-12)
 * - Chars 10-11: Tahun lahir (YY)
 */
export function validateNik(nikRaw: string): { 
  valid: boolean; 
  normalized?: string; 
  embeddedDob?: string; 
  genderHint?: 'MALE' | 'FEMALE';
  reason?: string 
} {
  if (!nikRaw) return { valid: false, reason: 'NIK kosong' };
  const cleaned = normalizeDigits(nikRaw);

  if (cleaned.length < 10) {
    return { valid: false, reason: `Panjang NIK (${cleaned.length} digit) terlalu pendek` };
  }

  // Cannot be all identical digits (e.g. 0000000000000000 or 1111111111111111)
  if (/^(\d)\1{15,}$/.test(cleaned)) {
    return { valid: false, normalized: cleaned, reason: 'NIK tidak boleh terdiri dari angka berulang' };
  }

  if (cleaned.length !== 16) {
    return { 
      valid: false, 
      normalized: cleaned, 
      reason: `Panjang NIK (${cleaned.length} digit) tidak 16 digit, periksa kembali` 
    };
  }

  const rawDay = parseInt(cleaned.substring(6, 8), 10);
  const rawMonth = parseInt(cleaned.substring(8, 10), 10);
  const rawYear = parseInt(cleaned.substring(10, 12), 10);

  let isFemale = false;
  let day = rawDay;
  if (day > 40) {
    isFemale = true;
    day -= 40;
  }

  // Month check (01 - 12)
  if (rawMonth < 1 || rawMonth > 12) {
    return { valid: false, normalized: cleaned, reason: 'Struktur bulan pada NIK tidak valid' };
  }

  // Day check (01 - 31)
  if (day < 1 || day > 31) {
    return { valid: false, normalized: cleaned, reason: 'Struktur tanggal pada NIK tidak valid' };
  }

  const currentYY = new Date().getFullYear() % 100;
  const fullYear = rawYear <= currentYY ? 2000 + rawYear : 1900 + rawYear;
  const embeddedDob = `${fullYear}-${String(rawMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    valid: true,
    normalized: cleaned,
    embeddedDob,
    genderHint: isFemale ? 'FEMALE' : 'MALE',
  };
}

/**
 * Validates Kartu Keluarga (KK) Number
 * Format: 16 digits
 */
export function validateKkNumber(kkRaw: string): { valid: boolean; normalized?: string; reason?: string } {
  if (!kkRaw) return { valid: false, reason: 'Nomor KK kosong' };
  const cleaned = normalizeDigits(kkRaw);

  if (cleaned.length < 8) {
    return { valid: false, reason: `Panjang Nomor KK (${cleaned.length} digit) terlalu pendek` };
  }

  if (/^(\d)\1{15,}$/.test(cleaned)) {
    return { valid: false, normalized: cleaned, reason: 'Nomor KK tidak boleh terdiri dari angka berulang' };
  }

  if (cleaned.length !== 16) {
    return { 
      valid: false, 
      normalized: cleaned, 
      reason: `Panjang Nomor KK (${cleaned.length} digit) tidak 16 digit, periksa kembali` 
    };
  }

  return { valid: true, normalized: cleaned };
}

/**
 * Validates chronological integrity of Passport dates
 * birth_date < issue_date < expiry_date
 */
export function validatePassportDates(
  birthDate?: string,
  issueDate?: string,
  expiryDate?: string
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (birthDate && issueDate) {
    if (new Date(birthDate) >= new Date(issueDate)) {
      warnings.push('Tanggal lahir harus lebih awal dari tanggal penerbitan paspor.');
    }
  }

  if (issueDate && expiryDate) {
    if (new Date(issueDate) >= new Date(expiryDate)) {
      warnings.push('Tanggal penerbitan paspor harus lebih awal dari tanggal habis berlaku.');
    }
  }

  if (birthDate && expiryDate) {
    if (new Date(birthDate) >= new Date(expiryDate)) {
      warnings.push('Tanggal lahir harus lebih awal dari tanggal habis berlaku.');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Context-aware garbage value detection
 * Rejects obvious OCR noise and uninformative generic labels
 */
export function isGarbageValue(
  val: string | undefined | null,
  context: 'NAME' | 'NUMBER' | 'PLACE' | 'DATE' | 'GENERIC'
): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  const upper = trimmed.toUpperCase();

  // Rule 1: Very short non-informative text
  if (trimmed.length < 2) return true;

  // Rule 2: Excessive filler/MRZ delimiter characters (e.g. <<<<<<< or «««««««)
  if (/^[<«\-_|=]{2,}$/.test(trimmed) || (trimmed.match(/</g) || []).length > 4) {
    return true;
  }

  // Rule 3: Repeated single character runs (e.g. CCCCCCC, LLLLLLL, IIIIII, AAAAAAA)
  if (/(.)\1{4,}/.test(upper)) {
    return true;
  }

  // Rule 4: Context: NAME
  if (context === 'NAME') {
    // Cannot contain digits
    if (/[0-9]/.test(trimmed)) return true;
    
    // Cannot be header labels or country keywords
    const invalidNameKeywords = [
      'REPUBLIK INDONESIA', 'REPUBLIC OF INDONESIA', 'PASPOR', 'PASSPORT',
      'KARTU TANDA PENDUDUK', 'KARTU KELUARGA', 'PROVINSI', 'KABUPATEN',
      'FULL NAME', 'NAMA LENGKAP', 'NAMA PEMEGANG', 'SURNAME', 'GIVEN NAMES',
      'KANTOR IMIGRASI', 'DIRECTORATE GENERAL', 'INDONESIA'
    ];
    if (invalidNameKeywords.some(k => upper === k || upper === `NAMA : ${k}`)) {
      return true;
    }

    // Must contain letters and valid length
    if (trimmed.replace(/[^A-Za-z]/g, '').length < 3) {
      return true;
    }
  }

  // Rule 5: Context: PLACE (Birth Place or Issue Place)
  if (context === 'PLACE') {
    // Generic immigration label with no branch specified (e.g. only "KANTOR IMIGRASI" or "PLACE OF ISSUE")
    if (upper === 'KANTOR IMIGRASI' || upper === 'PLACE OF ISSUE' || upper === 'TEMPAT LAHIR' || upper === 'TEMPAT DITERBITKAN') {
      return true;
    }
    if (upper === 'REPUBLIK INDONESIA' || upper === 'INDONESIA') {
      return true;
    }
    if (/[0-9]{4,}/.test(trimmed)) {
      return true;
    }
  }

  // Rule 6: Context: NUMBER
  if (context === 'NUMBER') {
    if (/^[0-9]+$/.test(trimmed) && trimmed.length < 6) return true;
    if (/[^A-Za-z0-9\/\-]/.test(trimmed)) return true;
  }

  return false;
}
