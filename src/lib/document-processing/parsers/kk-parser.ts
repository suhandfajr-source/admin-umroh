import { ExtractedKkData, KkFamilyMember, FieldSource, FieldConfidence } from '@/types/document.types';
import { normalizeIndonesianDate, normalizeGender, cleanOcrText, normalizeDigits } from '../normalizers';
import { validateKkNumber, validateNik, isGarbageValue } from '../validators';

export function parseKk(rawText: string): ExtractedKkData {
  const result: ExtractedKkData = {
    members: [],
  };
  const fieldSources: Record<string, FieldSource> = {};
  const fieldConfidences: Record<string, FieldConfidence> = {};
  const conflicts: string[] = [];

  const text = cleanOcrText(rawText || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isHeaderLabel = (str: string) => {
    const u = str.toUpperCase();
    return u.includes('KARTU KELUARGA') || u.includes('REPUBLIK INDONESIA') ||
      u.includes('PROVINSI') || u.includes('KABUPATEN') || u.includes('KOTA') ||
      u.includes('KECAMATAN') || u.includes('DESA') || u.includes('KELURAHAN') ||
      u.includes('NO. KK') || u.includes('NOMOR KK') || u.includes('NAMA KEPALA KELUARGA') ||
      u.includes('ALAMAT') || u.includes('RT/RW') || u.includes('KODE POS');
  };

  // 1. Extract Header Metadata (No. KK, Kepala Keluarga, Alamat, Wilayah)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    // No. KK (Header-specific 16 digits or near label)
    if (!result.kk_number) {
      if (
        upper.includes('NO. KK') || 
        upper.includes('NOMOR KK') || 
        upper.startsWith('NO.KK') || 
        upper.startsWith('NO :') || 
        upper.startsWith('NO:') || 
        upper.startsWith('NO.') || 
        upper.startsWith('NO ') ||
        upper.includes('NOMOR')
      ) {
        const rawMatch = line.match(/(?:NO\.?\s*KK|NOMOR\s*KK|NO\.?|NOMOR)\s*[:=]?\s*([0-9A-Za-z\s-]{12,25})/i) || line.match(/\b([0-9]{14,18})\b/);
        if (rawMatch) {
          const cleanedDigits = normalizeDigits(rawMatch[1]);
          if (cleanedDigits.length >= 10) {
            result.kk_number = cleanedDigits;
            fieldSources.kk_number = 'OCR_VISUAL';
            fieldConfidences.kk_number = cleanedDigits.length === 16 ? 'HIGH' : 'MEDIUM';
          }
        } else if (nextLine) {
          const cleanedDigits = normalizeDigits(nextLine);
          if (cleanedDigits.length >= 10) {
            result.kk_number = cleanedDigits;
            fieldSources.kk_number = 'OCR_VISUAL';
            fieldConfidences.kk_number = cleanedDigits.length === 16 ? 'HIGH' : 'MEDIUM';
          }
        }
      }
    }

    // Nama Kepala Keluarga
    if (!result.head_of_family) {
      if (upper.includes('NAMA KEPALA KELUARGA') || upper.includes('KEPALA KELUARGA')) {
        const withoutLabel = line.replace(/(?:NAMA\s*KEPALA\s*KELUARGA|KEPALA\s*KELUARGA)\s*[:=]?\s*/i, '').trim();
        const candidate = withoutLabel.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        if (candidate.length >= 2 && !isHeaderLabel(candidate)) {
          result.head_of_family = candidate;
          fieldSources.head_of_family = 'OCR_VISUAL';
          fieldConfidences.head_of_family = 'HIGH';
        } else if (nextLine) {
          const nextCandidate = nextLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
          if (nextCandidate.length >= 2 && !isHeaderLabel(nextCandidate)) {
            result.head_of_family = nextCandidate;
            fieldSources.head_of_family = 'OCR_VISUAL';
            fieldConfidences.head_of_family = 'HIGH';
          }
        }
      }
    }

    // Alamat
    if (!result.address) {
      if (upper.includes('ALAMAT') && !upper.includes('EMAIL') && !upper.includes('SURAT')) {
        const withoutLabel = line.replace(/(?:ALAMAT)\s*[:=]?\s*/i, '').trim();
        if (withoutLabel.length >= 2 && !isHeaderLabel(withoutLabel)) {
          result.address = withoutLabel;
          fieldSources.address = 'OCR_VISUAL';
          fieldConfidences.address = 'HIGH';
        } else if (nextLine && nextLine.length >= 2 && !isHeaderLabel(nextLine)) {
          result.address = nextLine;
          fieldSources.address = 'OCR_VISUAL';
          fieldConfidences.address = 'HIGH';
        }
      }
    }

    // RT/RW
    if (!result.rt_rw && upper.includes('RT/RW')) {
      const match = line.match(/(?:RT[\/\s]*RW)\s*[:=]?\s*([0-9\/\s-]+)/i);
      if (match && match[1].trim().length >= 2) {
        result.rt_rw = match[1].trim();
        fieldSources.rt_rw = 'OCR_VISUAL';
        fieldConfidences.rt_rw = 'HIGH';
      }
    }

    // Kelurahan / Desa
    if (!result.kelurahan && (upper.includes('DESA/KELURAHAN') || upper.includes('KELURAHAN') || upper.includes('DESA'))) {
      const match = line.match(/(?:DESA[\/\s]*KELURAHAN|KELURAHAN|DESA)\s*[:=]?\s*([A-Za-z0-9\s-]+)/i);
      if (match && match[1].trim().length >= 2 && !isHeaderLabel(match[1])) {
        result.kelurahan = match[1].trim();
        fieldSources.kelurahan = 'OCR_VISUAL';
        fieldConfidences.kelurahan = 'HIGH';
      }
    }

    // Kecamatan
    if (!result.kecamatan && (upper.includes('KECAMATAN') || upper.includes('KEC.'))) {
      const match = line.match(/(?:KECAMATAN|KEC\.?)\s*[:=]?\s*([A-Za-z0-9\s-]+)/i);
      if (match && match[1].trim().length >= 2 && !isHeaderLabel(match[1])) {
        result.kecamatan = match[1].trim();
        fieldSources.kecamatan = 'OCR_VISUAL';
        fieldConfidences.kecamatan = 'HIGH';
      }
    }

    // Kabupaten / Kota
    if (!result.kabupaten_kota && (upper.includes('KABUPATEN') || upper.includes('KAB.') || upper.includes('KOTA'))) {
      const match = line.match(/(?:KABUPATEN[\/\s]*KOTA|KABUPATEN|KAB\.?|KOTA)\s*[:=]?\s*([A-Za-z0-9\s-]+)/i);
      if (match && match[1].trim().length >= 2 && !isHeaderLabel(match[1])) {
        result.kabupaten_kota = match[1].trim();
        fieldSources.kabupaten_kota = 'OCR_VISUAL';
        fieldConfidences.kabupaten_kota = 'HIGH';
      }
    }

    // Provinsi
    if (!result.province && upper.includes('PROVINSI')) {
      const match = line.match(/(?:PROVINSI)\s*[:=]?\s*([A-Za-z\s-]+)/i);
      if (match && match[1].trim().length >= 2 && !isHeaderLabel(match[1])) {
        result.province = match[1].trim();
        fieldSources.province = 'OCR_VISUAL';
        fieldConfidences.province = 'HIGH';
      }
    }

    // Kode Pos
    if (!result.postal_code && upper.includes('KODE POS')) {
      const match = line.match(/(?:KODE\s*POS)\s*[:=]?\s*([0-9]{5})/i);
      if (match) {
        result.postal_code = match[1];
        fieldSources.postal_code = 'OCR_VISUAL';
        fieldConfidences.postal_code = 'HIGH';
      }
    }
  }

  // Fallback if standalone 16 digits found near top but not labeled
  if (!result.kk_number && lines.length > 0) {
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const cleaned = normalizeDigits(lines[i]);
      if (cleaned.length >= 14 && cleaned.length <= 18) {
        result.kk_number = cleaned;
        fieldSources.kk_number = 'OCR_ZONE';
        fieldConfidences.kk_number = cleaned.length === 16 ? 'HIGH' : 'MEDIUM';
        break;
      }
    }
  }

  // 2. Extract Family Members Table (High Recall & Lenient Candidate Extraction)
  const members: KkFamilyMember[] = [];
  const seenNiks = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();

    // Skip top header lines or column header rows
    if (
      upperLine.includes('KARTU KELUARGA') ||
      upperLine.includes('NOMOR KK') ||
      upperLine.includes('NAMA KEPALA KELUARGA') ||
      upperLine.includes('DAFTAR ANGGOTA') ||
      upperLine.includes('STATUS HUBUNGAN DALAM KELUARGA') ||
      upperLine.includes('DOKUMEN INI TELAH DITANDATANGANI')
    ) {
      continue;
    }

    // Search for 14-18 digit NIK sequence anywhere in the row
    const rawDigitMatch = line.match(/(?:^|\s|[:|])([0-9OoIL|]{14,18})(?:$|\s|[:|])/);
    const nikDigits = rawDigitMatch ? normalizeDigits(rawDigitMatch[1]) : '';

    if (nikDigits && nikDigits.length >= 14 && nikDigits.length <= 18) {
      // Do not reuse the KK Number as a member NIK
      if (result.kk_number && nikDigits === result.kk_number) {
        continue;
      }

      if (seenNiks.has(nikDigits)) {
        continue;
      }
      seenNiks.add(nikDigits);

      const nikValidation = validateNik(nikDigits);
      const validNik = nikValidation.normalized || nikDigits;

      // Extract Name strictly from the same row (before NIK)
      const nikIndex = line.indexOf(rawDigitMatch ? rawDigitMatch[1] : nikDigits);
      let nameCandidate = nikIndex > 0 ? line.substring(0, nikIndex).replace(/^[0-9.\s\-|]+/, '').trim() : '';

      // Clean name candidate
      nameCandidate = nameCandidate.replace(/[^A-Za-z\s,.'-]/g, '').trim();

      if (!nameCandidate || nameCandidate.length < 2) {
        // Check previous line if name was on preceding line
        const prevLine = i > 0 ? lines[i - 1].replace(/^[0-9.\s\-|]+/, '').trim() : '';
        const prevClean = prevLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        if (prevClean.length >= 2 && !isHeaderLabel(prevClean)) {
          nameCandidate = prevClean;
        } else {
          nameCandidate = `ANGGOTA ${members.length + 1}`;
        }
      }

      // Extract Gender
      let gender: 'MALE' | 'FEMALE' | undefined = normalizeGender(line);
      if (!gender && nikValidation.genderHint) {
        gender = nikValidation.genderHint;
      }

      // Extract Date of Birth
      let birthDate: string | undefined;
      const dateMatch = line.match(/([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
      if (dateMatch) {
        birthDate = normalizeIndonesianDate(dateMatch[1]);
      }
      if (!birthDate && nikValidation.embeddedDob) {
        birthDate = nikValidation.embeddedDob;
      }

      // Extract Relationship
      let relationship = 'Anggota Keluarga';
      if (upperLine.includes('KEPALA KELUARGA')) relationship = 'Kepala Keluarga';
      else if (upperLine.includes('ISTRI')) relationship = 'Istri';
      else if (upperLine.includes('ANAK')) relationship = 'Anak';
      else if (upperLine.includes('MERTUA')) relationship = 'Mertua';
      else if (upperLine.includes('ORANG TUA') || upperLine.includes('ORANGTUA') || upperLine.includes('AYAH') || upperLine.includes('IBU')) relationship = 'Orang Tua';
      else if (upperLine.includes('FAMILI')) relationship = 'Famili Lain';

      // Extract Birth Place
      let birthPlace: string | undefined;
      const placeMatch = line.match(/([A-Za-z\s-]+),\s*[0-9]{1,2}/);
      if (placeMatch && placeMatch[1].trim().length >= 3) {
        birthPlace = placeMatch[1].trim().replace(/[^A-Za-z\s-]/g, '');
      }

      members.push({
        id: `kk_m_${members.length + 1}_${Date.now()}`,
        nik: validNik,
        name: nameCandidate,
        gender: gender || 'MALE',
        birth_place: birthPlace,
        birth_date: birthDate,
        relationship: relationship,
        selected: members.length === 0, // First member selected by default for review flow
        confidence: nikValidation.valid ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // If head_of_family is found but not in members list, ensure member 1 exists
  if (members.length === 0 && result.head_of_family) {
    members.push({
      id: `kk_m_1_${Date.now()}`,
      nik: '',
      name: result.head_of_family,
      gender: 'MALE',
      relationship: 'Kepala Keluarga',
      selected: true,
      confidence: 'MEDIUM',
    });
  }

  result.members = members;
  result.field_sources = fieldSources;
  result.field_confidences = fieldConfidences;
  result.conflicts = conflicts.length > 0 ? conflicts : undefined;

  return result;
}
