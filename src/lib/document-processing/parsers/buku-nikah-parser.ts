import { ExtractedBukuNikahData, FieldSource, FieldConfidence } from '@/types/document.types';
import { normalizeIndonesianDate, cleanOcrText, normalizeDigits } from '../normalizers';
import { validateNik, isGarbageValue } from '../validators';

export function parseBukuNikah(rawText: string): ExtractedBukuNikahData {
  const result: ExtractedBukuNikahData = {};
  const fieldSources: Record<string, FieldSource> = {};
  const fieldConfidences: Record<string, FieldConfidence> = {};
  const conflicts: string[] = [];

  const text = cleanOcrText(rawText || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isHeaderLabel = (str: string) => {
    const u = str.toUpperCase();
    return u.includes('BUKU NIKAH') || u.includes('KUTIPAN AKTA NIKAH') ||
      u.includes('KEMENTERIAN AGAMA') || u.includes('REPUBLIK INDONESIA') ||
      u.includes('KANTOR URUSAN AGAMA') || u.includes('AKTA NIKAH');
  };

  let isInsideHusbandSection = false;
  let isInsideWifeSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    // Detect section headers
    if (upper.includes('SUAMI') && !upper.includes('ISTRI')) {
      isInsideHusbandSection = true;
      isInsideWifeSection = false;
    } else if (upper.includes('ISTRI')) {
      isInsideWifeSection = true;
      isInsideHusbandSection = false;
    }

    // 1. Nomor Akta / Pendaftaran Nikah
    if (!result.marriage_number) {
      if (upper.includes('NOMOR AKTA') || upper.includes('NO. AKTA') || upper.includes('NOMOR:') || upper.includes('NO. DAFTAR')) {
        const numMatch = line.match(/(?:NOMOR\s*AKTA\s*NIKAH|NOMOR\s*AKTA|NO\.?\s*AKTA\s*NIKAH|NO\.?\s*AKTA|NO\.?\s*DAFTAR|NOMOR)\s*[:=]?\s*([0-9\/\-\.A-Za-z]+)/i);
        if (numMatch && numMatch[1].trim().length >= 3) {
          result.marriage_number = numMatch[1].trim();
          fieldSources.marriage_number = 'OCR_VISUAL';
          fieldConfidences.marriage_number = 'HIGH';
        }
      }
    }

    // 2. Tanggal Akad / Pernikahan
    if (!result.marriage_date) {
      if (upper.includes('TANGGAL AKAD') || upper.includes('TANGGAL NIKAH') || upper.includes('PADA HARI') || upper.includes('TANGGAL:')) {
        const dateMatch = line.match(/(?:TANGGAL\s*AKAD\s*NIKAH|TANGGAL\s*AKAD|TANGGAL\s*NIKAH|TANGGAL)\s*[:=]?\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/i);
        if (dateMatch) {
          const parsed = normalizeIndonesianDate(dateMatch[1]);
          if (parsed) {
            result.marriage_date = parsed;
            fieldSources.marriage_date = 'OCR_VISUAL';
            fieldConfidences.marriage_date = 'HIGH';
          }
        } else if (nextLine && /[0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4}/.test(nextLine)) {
          const nextMatch = nextLine.match(/([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
          if (nextMatch) {
            const parsed = normalizeIndonesianDate(nextMatch[1]);
            if (parsed) {
              result.marriage_date = parsed;
              fieldSources.marriage_date = 'OCR_VISUAL';
              fieldConfidences.marriage_date = 'HIGH';
            }
          }
        }
      }
    }

    // 3. Husband Name (Nama Suami)
    if (!result.husband_name && (upper.includes('NAMA SUAMI') || (isInsideHusbandSection && upper.includes('NAMA')))) {
      const withoutLabel = line.replace(/(?:NAMA\s*SUAMI|NAMA\s*LENGKAP|NAMA)\s*[:=]?\s*/i, '').trim();
      if (withoutLabel.length >= 3 && !isHeaderLabel(withoutLabel) && !isGarbageValue(withoutLabel, 'NAME')) {
        result.husband_name = withoutLabel.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        fieldSources.husband_name = 'OCR_VISUAL';
        fieldConfidences.husband_name = 'HIGH';
      } else if (nextLine && nextLine.length >= 3 && !isHeaderLabel(nextLine) && !isGarbageValue(nextLine, 'NAME')) {
        result.husband_name = nextLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        fieldSources.husband_name = 'OCR_VISUAL';
        fieldConfidences.husband_name = 'HIGH';
      }
    }

    // 4. Wife Name (Nama Istri)
    if (!result.wife_name && (upper.includes('NAMA ISTRI') || (isInsideWifeSection && upper.includes('NAMA')))) {
      const withoutLabel = line.replace(/(?:NAMA\s*ISTRI|NAMA\s*LENGKAP|NAMA)\s*[:=]?\s*/i, '').trim();
      if (withoutLabel.length >= 3 && !isHeaderLabel(withoutLabel) && !isGarbageValue(withoutLabel, 'NAME')) {
        result.wife_name = withoutLabel.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        fieldSources.wife_name = 'OCR_VISUAL';
        fieldConfidences.wife_name = 'HIGH';
      } else if (nextLine && nextLine.length >= 3 && !isHeaderLabel(nextLine) && !isGarbageValue(nextLine, 'NAME')) {
        result.wife_name = nextLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        fieldSources.wife_name = 'OCR_VISUAL';
        fieldConfidences.wife_name = 'HIGH';
      }
    }

    // 5. NIK Suami / NIK Istri
    const nikMatch = line.match(/(?:NIK)?\s*[:=]?\s*([0-9A-Za-z-]{12,20})/i) || line.match(/\b([0-9]{14,18})\b/);
    if (nikMatch) {
      const cleaned = normalizeDigits(nikMatch[1]);
      if (cleaned.length >= 10) {
        if ((isInsideHusbandSection || upper.includes('SUAMI')) && !result.husband_nik) {
          result.husband_nik = cleaned;
          fieldSources.husband_nik = 'OCR_VISUAL';
          fieldConfidences.husband_nik = cleaned.length === 16 ? 'HIGH' : 'MEDIUM';
        } else if ((isInsideWifeSection || upper.includes('ISTRI')) && !result.wife_nik) {
          result.wife_nik = cleaned;
          fieldSources.wife_nik = 'OCR_VISUAL';
          fieldConfidences.wife_nik = cleaned.length === 16 ? 'HIGH' : 'MEDIUM';
        } else if (!result.husband_nik) {
          result.husband_nik = cleaned;
          fieldSources.husband_nik = 'OCR_VISUAL';
          fieldConfidences.husband_nik = cleaned.length === 16 ? 'HIGH' : 'MEDIUM';
        } else if (!result.wife_nik && result.husband_nik !== cleaned) {
          result.wife_nik = cleaned;
          fieldSources.wife_nik = 'OCR_VISUAL';
          fieldConfidences.wife_nik = cleaned.length === 16 ? 'HIGH' : 'MEDIUM';
        }
      }
    }

    // 6. KUA / Kantor Urusan Agama
    if (!result.kua_name) {
      if (upper.includes('KANTOR URUSAN AGAMA') || upper.includes('KUA KECAMATAN') || upper.includes('KUA :') || upper.includes('KUA:')) {
        const kuaMatch = line.match(/(?:KANTOR\s*URUSAN\s*AGAMA|KUA\s*KECAMATAN|KUA)\s*[:=]?\s*([A-Za-z0-9\s,.-]+)/i);
        if (kuaMatch && kuaMatch[1].trim().length >= 3) {
          const cleanKua = kuaMatch[1].trim().replace(/^KUA\s+/i, '');
          result.kua_name = `KUA ${cleanKua}`;
          fieldSources.kua_name = 'OCR_VISUAL';
          fieldConfidences.kua_name = 'HIGH';
        }
      }
    }
  }

  result.notes = result.husband_name && result.wife_name 
    ? `Pernikahan ${result.husband_name} & ${result.wife_name}`
    : 'Kutipan Akta Nikah';

  result.field_sources = fieldSources;
  result.field_confidences = fieldConfidences;
  result.conflicts = conflicts.length > 0 ? conflicts : undefined;

  return result;
}
