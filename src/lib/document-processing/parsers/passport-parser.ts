import { ExtractedPassportData, FieldSource, FieldConfidence } from '@/types/document.types';
import { parsePassportMrz } from '../mrz-parser';
import { normalizeIndonesianDate, normalizeGender, cleanOcrText } from '../normalizers';
import { validatePassportNumber, validatePassportDates, isGarbageValue } from '../validators';

export function parsePassport(rawText: string, filename?: string): ExtractedPassportData {
  const result: ExtractedPassportData = {};
  const fieldSources: Record<string, FieldSource> = {};
  const fieldConfidences: Record<string, FieldConfidence> = {};
  const conflicts: string[] = [];

  const text = cleanOcrText(rawText || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Dual-Source Step 1: MRZ Parsing (Primary Source for ICAO Fields)
  const mrzResult = parsePassportMrz(rawText);
  if (mrzResult) {
    if (mrzResult.fullName && !isGarbageValue(mrzResult.fullName, 'NAME')) {
      result.passport_name = mrzResult.fullName;
      fieldSources.passport_name = 'MRZ';
      fieldConfidences.passport_name = mrzResult.valid ? 'HIGH' : 'MEDIUM';
    }

    if (mrzResult.passportNumber) {
      const pNumValid = validatePassportNumber(mrzResult.passportNumber);
      if (pNumValid.valid && pNumValid.normalized) {
        result.passport_number = pNumValid.normalized;
        fieldSources.passport_number = 'MRZ';
        fieldConfidences.passport_number = mrzResult.valid ? 'HIGH' : 'MEDIUM';
      }
    }

    if (mrzResult.birthDate && !isGarbageValue(mrzResult.birthDate, 'DATE')) {
      result.birth_date = mrzResult.birthDate;
      fieldSources.birth_date = 'MRZ';
      fieldConfidences.birth_date = mrzResult.valid ? 'HIGH' : 'MEDIUM';
    }

    if (mrzResult.sex && mrzResult.sex !== 'OTHER') {
      result.gender = mrzResult.sex;
      fieldSources.gender = 'MRZ';
      fieldConfidences.gender = 'HIGH';
    }

    if (mrzResult.expiryDate && !isGarbageValue(mrzResult.expiryDate, 'DATE')) {
      result.passport_expiry_date = mrzResult.expiryDate;
      fieldSources.passport_expiry_date = 'MRZ';
      fieldConfidences.passport_expiry_date = mrzResult.valid ? 'HIGH' : 'MEDIUM';
    }

    result.nationality = mrzResult.nationality || 'INDONESIA';
    fieldSources.nationality = 'MRZ';
    fieldConfidences.nationality = 'HIGH';

    result.mrz_lines = mrzResult.rawLines;
    result.mrz_parsed = {
      valid: mrzResult.valid,
      document_code: mrzResult.documentType,
      issuing_state: mrzResult.countryCode,
      passport_number: mrzResult.passportNumber,
      nationality: mrzResult.nationality,
      birth_date: mrzResult.birthDate,
      sex: mrzResult.sex,
      expiry_date: mrzResult.expiryDate,
      personal_number: mrzResult.personalNumber,
    };
  }

  // 2. Dual-Source Step 2: Multi-line Visual OCR Parser (Visual Fields + Cross-Check)
  let visualName: string | undefined;
  let visualPassportNum: string | undefined;
  let visualBirthDate: string | undefined;
  let visualGender: 'MALE' | 'FEMALE' | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
    const nextUpper = nextLine.toUpperCase();

    const isLabelOrHeader = (str: string) => {
      const u = str.toUpperCase();
      return u.includes('REPUBLIK') || u.includes('PASPOR') || u.includes('PASSPORT') ||
        u.includes('KANTOR') || u.includes('IMIGRASI') || u.includes('TYPE') ||
        u.includes('COUNTRY') || u.includes('CODE') ||
        u.includes('BIRTH') || u.includes('EXPIRY') || u.includes('ISSUE') ||
        u.includes('P<') || u.includes('<<');
    };

    // A. Full Name
    if (upper.includes('FULL NAME') || upper.includes('NAMA LENGKAP') || upper.includes('NAMA PEMEGANG') || upper.startsWith('NAMA /') || upper.startsWith('NAMA:') || upper.includes('NAMA:')) {
      const withoutLabel = line
        .replace(/(?:NAMA\s*LENGKAP\s*[\/]\s*FULL\s*NAME|NAMA\s*[\/]\s*FULL\s*NAME|NAMA\s*[\/]\s*NAME|NAMA\s*LENGKAP|FULL\s*NAME|NAMA\s*PEMEGANG|NAMA|NAME)\s*[:=]?\s*/i, '')
        .trim();

      if (withoutLabel.length >= 3 && !isLabelOrHeader(withoutLabel) && !isGarbageValue(withoutLabel, 'NAME')) {
        visualName = withoutLabel.replace(/[^A-Za-z\s,.'-]/g, '').trim();
      } else if (nextLine && nextLine.length >= 3 && !isLabelOrHeader(nextLine) && !isGarbageValue(nextLine, 'NAME')) {
        visualName = nextLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
      }
    }

    // B. Passport Number
    if (upper.includes('PASSPORT NO') || upper.includes('NO. PASPOR') || upper.includes('NOMOR PASPOR') || upper.includes('PASPOR NO')) {
      const sameLineMatch = upper.match(/(?:PASPOR\s*NO|PASSPORT\s*NO|NOMOR\s*PASPOR|NO\.?\s*PASPOR)\s*[:=.]?\s*([A-Z][0-9]{7,8}|[A-Z]\s*[0-9]{7,8})/i);
      if (sameLineMatch) {
        visualPassportNum = sameLineMatch[1].replace(/\s+/g, '');
      } else if (nextLine && /[A-Z][0-9]{7,8}/i.test(nextUpper)) {
        const nextMatch = nextUpper.match(/([A-Z][0-9]{7,8})/);
        if (nextMatch) visualPassportNum = nextMatch[1];
      }
    }

    // C. Date of Birth
    if (upper.includes('DATE OF BIRTH') || upper.includes('TANGGAL LAHIR') || upper.includes('TGL LAHIR')) {
      const sameMatch = line.match(/(?:DATE\s*OF\s*BIRTH|TANGGAL\s*LAHIR|TGL\s*LAHIR)\s*[:=]?\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/i);
      if (sameMatch) {
        visualBirthDate = normalizeIndonesianDate(sameMatch[1]);
      } else if (nextLine && /[0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4}/.test(nextLine)) {
        const dateMatch = nextLine.match(/([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
        if (dateMatch) visualBirthDate = normalizeIndonesianDate(dateMatch[1]);
      }
    }

    // D. Place of Birth (Visual-Only Field)
    if (!result.birth_place) {
      if (upper.includes('PLACE OF BIRTH') || upper.includes('TEMPAT LAHIR')) {
        const sameMatch = line.match(/(?:TEMPAT\s*LAHIR\s*[\/]?\s*PLACE\s*OF\s*BIRTH|PLACE\s*OF\s*BIRTH|TEMPAT\s*LAHIR)\s*[:=]?\s*([A-Za-z\s-]+)/i);
        if (sameMatch && sameMatch[1].trim().length > 1 && !isLabelOrHeader(sameMatch[1]) && !isGarbageValue(sameMatch[1], 'PLACE')) {
          result.birth_place = sameMatch[1].trim();
          fieldSources.birth_place = 'OCR_VISUAL';
          fieldConfidences.birth_place = 'HIGH';
        } else if (nextLine && nextLine.length >= 2 && !isLabelOrHeader(nextLine) && !isGarbageValue(nextLine, 'PLACE')) {
          result.birth_place = nextLine.replace(/[^A-Za-z\s-]/g, '').trim();
          fieldSources.birth_place = 'OCR_VISUAL';
          fieldConfidences.birth_place = 'HIGH';
        }
      }
    }

    // E. Sex / Gender
    if (upper.includes('SEX') || upper.includes('JENIS KELAMIN')) {
      const detected = normalizeGender(line) || normalizeGender(nextLine);
      if (detected) visualGender = detected;
    }

    // F. Date of Issue (Visual-Only Field)
    if (!result.passport_issue_date) {
      if (upper.includes('DATE OF ISSUE') || upper.includes('TANGGAL PENGELUARAN') || upper.includes('TGL PENGELUARAN') || upper.includes('TANGGAL DITERBITKAN')) {
        const sameMatch = line.match(/(?:TANGGAL\s*PENGELUARAN\s*[\/]?\s*DATE\s*OF\s*ISSUE|DATE\s*OF\s*ISSUE|TANGGAL\s*PENGELUARAN|TGL\s*PENGELUARAN|TANGGAL\s*DITERBITKAN)\s*[:=]?\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/i);
        if (sameMatch) {
          const parsed = normalizeIndonesianDate(sameMatch[1]);
          if (parsed) {
            result.passport_issue_date = parsed;
            fieldSources.passport_issue_date = 'OCR_VISUAL';
            fieldConfidences.passport_issue_date = 'HIGH';
          }
        } else if (nextLine && /[0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4}/.test(nextLine)) {
          const dateMatch = nextLine.match(/([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
          if (dateMatch) {
            const parsed = normalizeIndonesianDate(dateMatch[1]);
            if (parsed) {
              result.passport_issue_date = parsed;
              fieldSources.passport_issue_date = 'OCR_VISUAL';
              fieldConfidences.passport_issue_date = 'HIGH';
            }
          }
        }
      }
    }

    // G. Date of Expiry
    if (!result.passport_expiry_date) {
      if (upper.includes('DATE OF EXPIRY') || upper.includes('TANGGAL HABIS BERLAKU') || upper.includes('TGL HABIS BERLAKU') || upper.includes('TANGGAL KADALUARSA') || upper.includes('BERLAKU HINGGA')) {
        const sameMatch = line.match(/(?:TANGGAL\s*HABIS\s*BERLAKU\s*[\/]?\s*DATE\s*OF\s*EXPIRY|DATE\s*OF\s*EXPIRY|TANGGAL\s*HABIS\s*BERLAKU|TGL\s*HABIS\s*BERLAKU|TANGGAL\s*KADALUARSA|BERLAKU\s*HINGGA)\s*[:=]?\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/i);
        if (sameMatch) {
          const parsed = normalizeIndonesianDate(sameMatch[1]);
          if (parsed) {
            result.passport_expiry_date = parsed;
            fieldSources.passport_expiry_date = 'OCR_VISUAL';
            fieldConfidences.passport_expiry_date = 'HIGH';
          }
        } else if (nextLine && /[0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4}/.test(nextLine)) {
          const dateMatch = nextLine.match(/([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
          if (dateMatch) {
            const parsed = normalizeIndonesianDate(dateMatch[1]);
            if (parsed) {
              result.passport_expiry_date = parsed;
              fieldSources.passport_expiry_date = 'OCR_VISUAL';
              fieldConfidences.passport_expiry_date = 'HIGH';
            }
          }
        }
      }
    }

    // H. Place of Issue / Issuing Authority (Visual-Only Field)
    if (!result.passport_issue_place) {
      if (upper.includes('ISSUING AUTHORITY') || upper.includes('KANTOR PENERBIT') || upper.includes('KANTOR IMIGRASI') || upper.includes('PLACE OF ISSUE') || upper.includes('KANMIG')) {
        const sameMatch = line.match(/(?:KANTOR\s*PENERBIT\s*[\/]?\s*ISSUING\s*AUTHORITY|ISSUING\s*AUTHORITY|KANTOR\s*PENERBIT|KANTOR\s*IMIGRASI|PLACE\s*OF\s*ISSUE|KANMIG)\s*[:=]?\s*([A-Za-z0-9\s-]+)/i);
        if (sameMatch && sameMatch[1].trim().length > 2 && !isGarbageValue(sameMatch[1], 'PLACE')) {
          result.passport_issue_place = sameMatch[1].trim();
          fieldSources.passport_issue_place = 'OCR_VISUAL';
          fieldConfidences.passport_issue_place = 'HIGH';
        } else if (nextLine && nextLine.length >= 3 && !isLabelOrHeader(nextLine) && !isGarbageValue(nextLine, 'PLACE')) {
          result.passport_issue_place = nextLine.trim();
          fieldSources.passport_issue_place = 'OCR_VISUAL';
          fieldConfidences.passport_issue_place = 'HIGH';
        }
      }
    }
  }

  // 3. Cross-Source Validation & Conflict Resolution
  // Name
  if (result.passport_name && visualName) {
    if (result.passport_name.toUpperCase() === visualName.toUpperCase()) {
      fieldConfidences.passport_name = 'HIGH';
    } else {
      // Small difference in visual vs MRZ: keep MRZ but reduce confidence to MEDIUM
      fieldConfidences.passport_name = 'MEDIUM';
    }
  } else if (!result.passport_name && visualName) {
    result.passport_name = visualName;
    fieldSources.passport_name = 'OCR_VISUAL';
    fieldConfidences.passport_name = 'MEDIUM';
  } else if (!result.passport_name && filename) {
    const cleanedBase = filename.replace(/\.[^/.]+$/, '').replace(/^[0-9_\-\s]+/, '');
    const parts = cleanedBase.split(/[-_]/).map(p => p.trim());
    const nameCandidate = parts.find(p => p.length >= 3 && !/^(PASPOR|PASSPORT|KTP|KK|VAKSIN|BUKU|NIKAH|SCAN|IMG|DOC|PHOTO)$/i.test(p) && !isGarbageValue(p, 'NAME'));
    if (nameCandidate) {
      result.passport_name = nameCandidate.replace(/[^A-Za-z\s,.'-]/g, '').trim();
      fieldSources.passport_name = 'OCR_VISUAL';
      fieldConfidences.passport_name = 'LOW';
    }
  }

  // Passport Number
  if (result.passport_number && visualPassportNum) {
    if (result.passport_number === visualPassportNum) {
      fieldConfidences.passport_number = 'HIGH';
    } else {
      conflicts.push(`Nomor paspor visual (${visualPassportNum}) berbeda dengan MRZ (${result.passport_number})`);
      fieldConfidences.passport_number = 'LOW';
    }
  } else if (!result.passport_number && visualPassportNum) {
    const valid = validatePassportNumber(visualPassportNum);
    if (valid.valid && valid.normalized) {
      result.passport_number = valid.normalized;
      fieldSources.passport_number = 'OCR_VISUAL';
      fieldConfidences.passport_number = 'MEDIUM';
    }
  }

  // DOB
  if (result.birth_date && visualBirthDate) {
    if (result.birth_date === visualBirthDate) {
      fieldConfidences.birth_date = 'HIGH';
    } else {
      conflicts.push(`Tanggal lahir visual (${visualBirthDate}) berbeda dengan MRZ (${result.birth_date})`);
      fieldConfidences.birth_date = 'LOW';
    }
  } else if (!result.birth_date && visualBirthDate) {
    result.birth_date = visualBirthDate;
    fieldSources.birth_date = 'OCR_VISUAL';
    fieldConfidences.birth_date = 'MEDIUM';
  }

  // Gender
  if (!result.gender && visualGender) {
    result.gender = visualGender;
    fieldSources.gender = 'OCR_VISUAL';
    fieldConfidences.gender = 'HIGH';
  }

  // Validate date chronology
  const dateValidation = validatePassportDates(result.birth_date, result.passport_issue_date, result.passport_expiry_date);
  if (!dateValidation.valid) {
    conflicts.push(...dateValidation.warnings);
  }

  // Standalone regex search fallback for passport number if still missing
  if (!result.passport_number) {
    const standaloneMatch = rawText.match(/\b([A-Z][0-9]{7,8})\b/);
    if (standaloneMatch && !standaloneMatch[1].startsWith('IDN')) {
      const valid = validatePassportNumber(standaloneMatch[1]);
      if (valid.valid && valid.normalized) {
        result.passport_number = valid.normalized;
        fieldSources.passport_number = 'OCR_VISUAL';
        fieldConfidences.passport_number = 'MEDIUM';
      }
    }
  }

  // Place of Issue default fallback if missing
  if (!result.passport_issue_place && result.passport_number) {
    result.passport_issue_place = 'KANTOR IMIGRASI';
    fieldSources.passport_issue_place = 'OCR_VISUAL';
    fieldConfidences.passport_issue_place = 'LOW';
  }

  if (!result.nationality) {
    result.nationality = 'INDONESIA';
    fieldSources.nationality = 'OCR_VISUAL';
    fieldConfidences.nationality = 'HIGH';
  }

  result.field_sources = fieldSources;
  result.field_confidences = fieldConfidences;
  result.conflicts = conflicts.length > 0 ? conflicts : undefined;

  return result;
}

export { normalizeIndonesianDate as parseFlexibleDate };
