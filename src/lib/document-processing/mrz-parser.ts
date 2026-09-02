/**
 * ICAO Document 9303 TD3 (Passport) MRZ Parser & Validator
 * Enhanced with resilient OCR character normalization and multi-pass candidate detection
 */

export interface ParsedMrz {
  valid: boolean;
  documentType: string;
  countryCode: string;
  surname: string;
  givenNames: string;
  fullName: string;
  passportNumber: string;
  nationality: string;
  birthDate: string; // ISO YYYY-MM-DD
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  expiryDate: string; // ISO YYYY-MM-DD
  personalNumber?: string;
  rawLines: string[];
}

export function calculateIcaoCheckDigit(str: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    let val = 0;
    if (char >= '0' && char <= '9') {
      val = parseInt(char, 10);
    } else if (char >= 'A' && char <= 'Z') {
      val = char.charCodeAt(0) - 55;
    } else if (char === '<') {
      val = 0;
    }
    sum += val * weights[i % 3];
  }
  return sum % 10;
}

export function parseIcaoDate(dateStr: string, isExpiry = false): string {
  if (!dateStr || dateStr.length < 6) return '';
  // Normalize common OCR character confusion (O->0, I->1, L->1, B->8, S->5, Z->2)
  const normalized = dateStr
    .replace(/[Oo]/g, '0')
    .replace(/[IiLl|]/g, '1')
    .replace(/[Bb]/g, '8')
    .replace(/[Ss]/g, '5')
    .replace(/[Zz]/g, '2');

  const yy = parseInt(normalized.substring(0, 2), 10);
  const mm = normalized.substring(2, 4);
  const dd = normalized.substring(4, 6);

  if (isNaN(yy)) return '';
  const monthNum = parseInt(mm, 10);
  const dayNum = parseInt(dd, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return '';
  if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) return '';

  const currentYear = new Date().getFullYear() % 100;
  let fullYear: number;

  if (isExpiry) {
    // Passports expire in future (or recent past)
    fullYear = yy < 70 ? 2000 + yy : 1900 + yy;
  } else {
    // Birth dates
    fullYear = yy <= currentYear ? 2000 + yy : 1900 + yy;
  }

  return `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function cleanMrzCandidateLine(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[«\(\)\[\]\{\}\|\_\\\/\:\-\;\.\,\'\"]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

export function parsePassportMrz(text: string): ParsedMrz | null {
  if (!text) return null;

  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const cleanedLines = rawLines.map(cleanMrzCandidateLine).filter(l => l.length >= 20);

  let line1 = '';
  let line2 = '';

  // Helper to check if a line looks like TD3 Line 2 (Passport number, check digit, nationality, DOB, sex, expiry)
  const isLine2Candidate = (str: string) => {
    return /[A-Z0-9]{8,9}[0-9<]/.test(str) && (str.includes('IDN') || str.includes('1DN') || str.includes('LDN') || /[0-9]{6}[0-9<][MF][0-9]{6}/.test(str));
  };

  // Helper to check if a line looks like TD3 Line 1 (P<...)
  const isLine1Candidate = (str: string) => {
    if (str.includes('REPUBLIK') || str.includes('PASPOR') || str.includes('INDONESIA') && !str.includes('P<IDN')) return false;
    return (str.startsWith('P<') || str.startsWith('IP<') || str.startsWith('1P<') || str.startsWith('P0') || str.startsWith('P(') || (str.startsWith('P') && (str.includes('IDN') || str.includes('<<')))) &&
      (str.includes('IDN') || str.includes('1DN') || str.includes('LDN') || str.includes('IND') || str.includes('<<'));
  };

  // Pass 1: Look for Line 1 followed by Line 2
  for (let i = 0; i < cleanedLines.length; i++) {
    const cur = cleanedLines[i];
    if (isLine1Candidate(cur)) {
      let l1 = cur.replace(/^[0-9I|]+P</, 'P<').replace(/^[0-9I|]+P/, 'P<').replace(/^P[0\(]/, 'P<');
      if (!l1.startsWith('P<') && l1.startsWith('P')) {
        l1 = 'P<' + l1.substring(1);
      }

      for (let j = i + 1; j <= Math.min(i + 2, cleanedLines.length - 1); j++) {
        const next = cleanedLines[j];
        if (next.length >= 25 && isLine2Candidate(next)) {
          line1 = l1.padEnd(44, '<').substring(0, 44);
          line2 = next.padEnd(44, '<').substring(0, 44);
          break;
        }
      }
      if (line1 && line2) break;
    }
  }

  // Pass 2: Reverse check - Look for Line 2 and find Line 1 right before it
  if (!line1 || !line2) {
    for (let i = 1; i < cleanedLines.length; i++) {
      const cur = cleanedLines[i];
      if (isLine2Candidate(cur) && cur.length >= 25) {
        const prev = cleanedLines[i - 1];
        if (prev && (isLine1Candidate(prev) || prev.startsWith('P<') || prev.includes('<<'))) {
          let l1 = prev.replace(/^[0-9I|]+P</, 'P<').replace(/^[0-9I|]+P/, 'P<').replace(/^P[0\(]/, 'P<');
          if (!l1.startsWith('P<') && (l1.startsWith('P') || l1.includes('IDN') || l1.includes('<<'))) {
            l1 = l1.startsWith('P') ? 'P<' + l1.substring(1) : 'P<IDN' + l1;
          }
          line1 = l1.padEnd(44, '<').substring(0, 44);
          line2 = cur.padEnd(44, '<').substring(0, 44);
          break;
        }
      }
    }
  }

  // Pass 3: General pattern match across all lines
  if (!line1 || !line2) {
    for (let i = 0; i < cleanedLines.length - 1; i++) {
      if ((cleanedLines[i].includes('<<') || cleanedLines[i].includes('IDN')) && cleanedLines[i].length >= 25) {
        line1 = cleanedLines[i].padEnd(44, '<').substring(0, 44);
        line2 = cleanedLines[i + 1].padEnd(44, '<').substring(0, 44);
        break;
      }
    }
  }

  if (!line1 || !line2) {
    return null;
  }

  try {
    // Line 1: P<IDNSURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<<<<
    let documentType = line1.substring(0, 2).replace(/</g, '') || 'P';
    let countryCode = line1.substring(2, 5).replace(/</g, '');
    if (countryCode === '1DN' || countryCode === 'LDN' || countryCode === 'IND') countryCode = 'IDN';
    if (!countryCode) countryCode = 'IDN';

    // Robust name extraction
    let nameSection = line1.substring(5);
    // If countryCode was shifted or missing prefix
    if (nameSection.startsWith('DN<') || nameSection.startsWith('DN')) {
      nameSection = nameSection.replace(/^DN<?/, '');
    }

    let surname = '';
    let givenNames = '';
    let fullName = '';

    if (nameSection.includes('<<')) {
      const nameParts = nameSection.split('<<');
      surname = (nameParts[0] || '').replace(/</g, ' ').trim();
      givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
      fullName = `${givenNames} ${surname}`.trim() || surname || givenNames;
    } else {
      // Single delimiter or space separation
      fullName = nameSection.replace(/<+/g, ' ').replace(/[^A-Za-z\s]/g, '').trim();
      surname = fullName;
    }

    // Line 2: PASSPORT_NO + CHECK + NAT + DOB + CHECK + SEX + EXP + CHECK + PERSONAL + CHECK
    let rawPassportNo = line2.substring(0, 9).replace(/</g, '');
    let passportNumber = rawPassportNo;
    if (passportNumber.length >= 7) {
      const firstLetter = passportNumber[0];
      const rest = passportNumber.substring(1)
        .replace(/[Oo]/g, '0')
        .replace(/[IiLl|]/g, '1')
        .replace(/[Ss]/g, '5')
        .replace(/[Bb]/g, '8')
        .replace(/[Zz]/g, '2');
      passportNumber = `${firstLetter}${rest}`;
    }

    const passportCheck = line2.substring(9, 10);
    let nationality = line2.substring(10, 13).replace(/</g, '');
    if (nationality === '1DN' || nationality === 'LDN' || nationality === 'IND' || !nationality) nationality = 'IDN';

    const dobRaw = line2.substring(13, 19);
    const dobCheck = line2.substring(19, 20);
    const sexRaw = line2.substring(20, 21);
    const expRaw = line2.substring(21, 27);
    const expCheck = line2.substring(27, 28);
    const personalNumber = line2.substring(28, 42).replace(/</g, '');

    const birthDate = parseIcaoDate(dobRaw, false);
    const expiryDate = parseIcaoDate(expRaw, true);

    let sex: 'MALE' | 'FEMALE' | 'OTHER' = 'OTHER';
    if (sexRaw === 'M' || sexRaw === 'L') sex = 'MALE';
    if (sexRaw === 'F' || sexRaw === 'P') sex = 'FEMALE';

    const passportNumberValid = calculateIcaoCheckDigit(line2.substring(0, 9)).toString() === passportCheck;
    const dobValid = calculateIcaoCheckDigit(dobRaw).toString() === dobCheck;
    const expValid = calculateIcaoCheckDigit(expRaw).toString() === expCheck;

    return {
      valid: passportNumberValid && dobValid && expValid,
      documentType,
      countryCode,
      surname,
      givenNames,
      fullName,
      passportNumber,
      nationality,
      birthDate,
      sex,
      expiryDate,
      personalNumber: personalNumber || undefined,
      rawLines: [line1, line2],
    };
  } catch (err) {
    console.warn('[MRZ_PARSE_WARN]', err);
    return null;
  }
}
