import { ExtractedVaksinData, FieldSource, FieldConfidence } from '@/types/document.types';
import { normalizeIndonesianDate, cleanOcrText } from '../normalizers';
import { validateNik, validatePassportNumber, isGarbageValue } from '../validators';

export function parseVaksin(rawText: string): ExtractedVaksinData {
  const result: ExtractedVaksinData = {};
  const fieldSources: Record<string, FieldSource> = {};
  const fieldConfidences: Record<string, FieldConfidence> = {};
  const conflicts: string[] = [];

  const text = cleanOcrText(rawText || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isHeaderLabel = (str: string) => {
    const u = str.toUpperCase();
    return u.includes('SERTIFIKAT VAKSINASI') || u.includes('CERTIFICATE OF VACCINATION') ||
      u.includes('KEMENTERIAN KESEHATAN') || u.includes('REPUBLIK INDONESIA') ||
      u.includes('PEDULILINDUNGI') || u.includes('SATUSEHAT');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    // 1. Recipient Name
    if (!result.recipient_name) {
      if (upper.includes('NAMA PENERIMA') || upper.includes('NAMA') || upper.includes('NAME') || upper.startsWith('NAMA:')) {
        const withoutLabel = line.replace(/(?:NAMA\s*PENERIMA|NAMA\s*LENGKAP|NAMA|NAME)\s*[:=]?\s*/i, '').trim();
        if (withoutLabel.length >= 3 && !isHeaderLabel(withoutLabel) && !isGarbageValue(withoutLabel, 'NAME')) {
          result.recipient_name = withoutLabel.replace(/[^A-Za-z\s,.'-]/g, '').trim();
          fieldSources.recipient_name = 'OCR_VISUAL';
          fieldConfidences.recipient_name = 'HIGH';
        } else if (nextLine && nextLine.length >= 3 && !isHeaderLabel(nextLine) && !isGarbageValue(nextLine, 'NAME')) {
          result.recipient_name = nextLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
          fieldSources.recipient_name = 'OCR_VISUAL';
          fieldConfidences.recipient_name = 'HIGH';
        }
      }
    }

    // 2. NIK
    if (!result.nik) {
      const nikMatch = line.match(/(?:NIK|ID\s*NUMBER)\s*[:=]?\s*([0-9A-Za-z\s-]{12,22})/i) || line.match(/\b([0-9A-Za-z]{14,18})\b/);
      if (nikMatch) {
        const cleaned = nikMatch[1].replace(/[^0-9]/g, '');
        if (cleaned.length >= 10) {
          result.nik = cleaned;
          fieldSources.nik = 'OCR_VISUAL';
          fieldConfidences.nik = cleaned.length === 16 ? 'HIGH' : 'MEDIUM';
        }
      }
    }

    // 3. Passport Number (if vaccine certificate contains passport no)
    if (!result.passport_number) {
      if (upper.includes('PASPOR') || upper.includes('PASSPORT')) {
        const pMatch = line.match(/(?:PASPOR|PASSPORT\s*NO|NO\.?\s*PASPOR|PASSPORT)\s*[:=]?\s*([A-Z][0-9]{7,8})/i);
        if (pMatch) {
          const pVal = validatePassportNumber(pMatch[1]);
          if (pVal.valid && pVal.normalized) {
            result.passport_number = pVal.normalized;
            fieldSources.passport_number = 'OCR_VISUAL';
            fieldConfidences.passport_number = 'HIGH';
          }
        }
      }
    }

    // 4. Vaccine Name (Explicit label matching)
    if (!result.vaccine_name) {
      if (upper.includes('JENIS VAKSIN') || upper.includes('VACCINE TYPE') || upper.includes('NAMA VAKSIN') || upper.startsWith('VACCINE:')) {
        const withoutLabel = line.replace(/(?:JENIS\s*VAKSIN|VACCINE\s*TYPE|NAMA\s*VAKSIN|VACCINE)\s*[:=]?\s*/i, '').trim();
        if (withoutLabel.length >= 3 && !isHeaderLabel(withoutLabel)) {
          result.vaccine_name = withoutLabel;
          fieldSources.vaccine_name = 'OCR_VISUAL';
          fieldConfidences.vaccine_name = 'HIGH';
        } else if (nextLine && nextLine.length >= 3 && !isHeaderLabel(nextLine)) {
          result.vaccine_name = nextLine;
          fieldSources.vaccine_name = 'OCR_VISUAL';
          fieldConfidences.vaccine_name = 'HIGH';
        }
      }
    }

    // 5. Dose (e.g. Dosis 1, Dosis 2, Booster 1, Third Dose)
    if (!result.dose) {
      if (upper.includes('DOSIS') || upper.includes('DOSE')) {
        const doseMatch = line.match(/(?:DOSIS|DOSE)\s*[:=]?\s*([A-Za-z0-9\s]+)/i);
        if (doseMatch && doseMatch[1].trim().length >= 1) {
          result.dose = doseMatch[1].trim();
          fieldSources.dose = 'OCR_VISUAL';
          fieldConfidences.dose = 'HIGH';
        }
      }
    }

    // 6. Vaccination Date
    if (!result.vaccination_date) {
      if (upper.includes('TANGGAL VAKSINASI') || upper.includes('TANGGAL') || upper.includes('DATE OF VACCINATION') || upper.includes('VACCINATION DATE') || upper.includes('DATE:')) {
        const dateMatch = line.match(/(?:TANGGAL\s*VAKSINASI|DATE\s*OF\s*VACCINATION|VACCINATION\s*DATE|TANGGAL|DATE)\s*[:=]?\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/i);
        if (dateMatch) {
          const parsed = normalizeIndonesianDate(dateMatch[1]);
          if (parsed) {
            result.vaccination_date = parsed;
            fieldSources.vaccination_date = 'OCR_VISUAL';
            fieldConfidences.vaccination_date = 'HIGH';
          }
        } else if (nextLine && /[0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4}/.test(nextLine)) {
          const nextMatch = nextLine.match(/([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
          if (nextMatch) {
            const parsed = normalizeIndonesianDate(nextMatch[1]);
            if (parsed) {
              result.vaccination_date = parsed;
              fieldSources.vaccination_date = 'OCR_VISUAL';
              fieldConfidences.vaccination_date = 'HIGH';
            }
          }
        }
      }
    }

    // 7. Certificate Number / ID
    if (!result.certificate_number) {
      if (upper.includes('NO. SERTIFIKAT') || upper.includes('CERTIFICATE NO') || upper.includes('NO SERTIFIKAT') || upper.includes('ID SERTIFIKAT')) {
        const certMatch = line.match(/(?:NO\.?\s*SERTIFIKAT|CERTIFICATE\s*NO|ID\s*SERTIFIKAT)\s*[:=]?\s*([A-Za-z0-9\-\/]+)/i);
        if (certMatch && certMatch[1].trim().length >= 4) {
          result.certificate_number = certMatch[1].trim();
          fieldSources.certificate_number = 'OCR_VISUAL';
          fieldConfidences.certificate_number = 'HIGH';
        }
      }
    }

    // 8. Health Facility / Issuer
    if (!result.facility_name) {
      if (upper.includes('FASILITAS KESEHATAN') || upper.includes('LOKASI VAKSINASI') || upper.includes('HEALTH FACILITY') || upper.includes('KLINIK') || upper.includes('PUSKESMAS') || upper.includes('RS ')) {
        const facMatch = line.match(/(?:FASILITAS\s*KESEHATAN|LOKASI\s*VAKSINASI|HEALTH\s*FACILITY)\s*[:=]?\s*([A-Za-z0-9\s,.-]+)/i);
        if (facMatch && facMatch[1].trim().length >= 3 && !isHeaderLabel(facMatch[1])) {
          result.facility_name = facMatch[1].trim();
          fieldSources.facility_name = 'OCR_VISUAL';
          fieldConfidences.facility_name = 'HIGH';
        }
      }
    }
  }

  // Fallback: If explicit label not found, look for known vaccine brands
  if (!result.vaccine_name) {
    const knownVaccines = ['MENINGITIS', 'COVID-19', 'SINOVAC', 'ASTRAZENECA', 'PFIZER', 'MODERNA', 'SINOPHARM', 'INAVAC', 'INDOVAC'];
    for (const v of knownVaccines) {
      if (text.toUpperCase().includes(v)) {
        result.vaccine_name = v;
        fieldSources.vaccine_name = 'OCR_ZONE';
        fieldConfidences.vaccine_name = 'MEDIUM';
        break;
      }
    }
  }

  result.notes = result.vaccine_name ? `Vaksin ${result.vaccine_name} ${result.dose || ''}`.trim() : 'Sertifikat Vaksinasi';
  result.field_sources = fieldSources;
  result.field_confidences = fieldConfidences;
  result.conflicts = conflicts.length > 0 ? conflicts : undefined;

  return result;
}
