import { ExtractedKtpData, FieldSource, FieldConfidence } from '@/types/document.types';
import { normalizeIndonesianDate, normalizeGender, cleanOcrText, normalizeDigits } from '../normalizers';
import { validateNik, isGarbageValue } from '../validators';
import { composeKtpAddress } from '@/lib/address-helpers';
import { decodeNikRegion, KABUPATEN_MAP } from '../nik-regions';

const KNOWN_CITIES = [
  'BANDUNG', 'TASIKMALAYA', 'GARUT', 'CIAMIS', 'SUMEDANG', 'CIANJUR', 'SUKABUMI', 'BOGOR',
  'BEKASI', 'DEPOK', 'CIMAHI', 'BANJAR', 'PANGANDARAN', 'PURWAKARTA', 'SUBANG', 'KARAWANG',
  'CIREBON', 'MAJALENGKA', 'KUNINGAN', 'INDRAMAYU', 'JAKARTA', 'TANGERANG', 'SERANG',
  'CILEGON', 'PANDEGLANG', 'LEBAK', 'SEMARANG', 'SURAKARTA', 'SOLO', 'YOGYAKARTA', 'SURABAYA',
  'MALANG', 'KEDIRI', 'MEDAN', 'PADANG', 'PALEMBANG', 'LAMPUNG', 'MAKASSAR', 'BANJARMASIN'
];

export function parseKtp(rawText: string): ExtractedKtpData {
  const result: ExtractedKtpData = {};
  const fieldSources: Record<string, FieldSource> = {};
  const fieldConfidences: Record<string, FieldConfidence> = {};
  const conflicts: string[] = [];

  const text = cleanOcrText(rawText || '');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isLabelOrHeader = (str: string) => {
    const u = str.toUpperCase();
    return u.includes('PROVINSI') || u.includes('KOTA') || u.includes('KABUPATEN') ||
      u.includes('KARTU TANDA PENDUDUK') || u.includes('NIK') || u.includes('NAMA') ||
      u.includes('TEMPAT') || u.includes('TGL LAHIR') || u.includes('JENIS KELAMIN') ||
      u.includes('ALAMAT') || u.includes('RT/RW') || u.includes('KEL/DESA') ||
      u.includes('KECAMATAN') || u.includes('AGAMA') || u.includes('STATUS PERKAWINAN') ||
      u.includes('PEKERJAAN') || u.includes('KEWARGANEGARAAN') || u.includes('BERLAKU HINGGA');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';

    // 1. NIK (16 Digits or Raw Candidate)
    if (!result.nik) {
      const match = line.match(/(?:NIK|NOMOR\s*INDUK)\s*[:=]?\s*([0-9A-Za-z\s-]{12,22})/i) || line.match(/\b([0-9A-Za-z]{14,18})\b/);
      if (match) {
        const cleanedDigits = normalizeDigits(match[1]);
        if (cleanedDigits.length >= 10) {
          result.nik = cleanedDigits;
          fieldSources.nik = 'OCR_VISUAL';
          fieldConfidences.nik = cleanedDigits.length === 16 ? 'HIGH' : 'MEDIUM';
        }
      } else if (upper.startsWith('NIK') && nextLine) {
        const cleanedDigits = normalizeDigits(nextLine);
        if (cleanedDigits.length >= 10) {
          result.nik = cleanedDigits;
          fieldSources.nik = 'OCR_VISUAL';
          fieldConfidences.nik = cleanedDigits.length === 16 ? 'HIGH' : 'MEDIUM';
        }
      }
    }

    // 2. Nama
    if (!result.ktp_name) {
      if (upper.includes('NAMA') || upper.startsWith('NAMA:')) {
        const withoutLabel = line
          .replace(/(?:NAMA\s*LENGKAP|NAMA)\s*[:=]?\s*/i, '')
          .trim();

        const candidate = withoutLabel.replace(/[^A-Za-z\s,.'-]/g, '').trim();
        if (candidate.length >= 2 && !isLabelOrHeader(candidate)) {
          result.ktp_name = candidate;
          fieldSources.ktp_name = 'OCR_VISUAL';
          fieldConfidences.ktp_name = 'HIGH';
        } else if (nextLine) {
          const nextCandidate = nextLine.replace(/[^A-Za-z\s,.'-]/g, '').trim();
          if (nextCandidate.length >= 2 && !isLabelOrHeader(nextCandidate)) {
            result.ktp_name = nextCandidate;
            fieldSources.ktp_name = 'OCR_VISUAL';
            fieldConfidences.ktp_name = 'HIGH';
          }
        }
      }
    }

    // 3. Tempat / Tanggal Lahir
    if (!result.birth_place || !result.birth_date) {
      if (upper.includes('TEMPAT/TGL LAHIR') || upper.includes('TEMPAT / TGL LAHIR') || upper.includes('TEMPAT, TGL LAHIR') || upper.includes('TEMPAT LAHIR') || upper.includes('LAHIR')) {
        const ttlMatch = line.match(/(?:TEMPAT[\/\s,]*TGL\s*LAHIR|TEMPAT\s*LAHIR|LAHIR)\s*[:=]?\s*([A-Za-z\s-]+)[,\/]\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/i);
        if (ttlMatch) {
          if (!isGarbageValue(ttlMatch[1], 'PLACE')) {
            result.birth_place = ttlMatch[1].trim();
            fieldSources.birth_place = 'OCR_VISUAL';
            fieldConfidences.birth_place = 'HIGH';
          }
          const parsedDob = normalizeIndonesianDate(ttlMatch[2].trim());
          if (parsedDob) {
            result.birth_date = parsedDob;
            fieldSources.birth_date = 'OCR_VISUAL';
            fieldConfidences.birth_date = 'HIGH';
          }
        } else if (nextLine && /[0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4}/.test(nextLine)) {
          const nextMatch = nextLine.match(/([A-Za-z\s-]+)[,\/]\s*([0-9]{1,2}[\s\/\-.][A-Za-z0-9]+[\s\/\-.][0-9]{4})/);
          if (nextMatch) {
            if (!isGarbageValue(nextMatch[1], 'PLACE')) {
              result.birth_place = nextMatch[1].trim();
              fieldSources.birth_place = 'OCR_VISUAL';
              fieldConfidences.birth_place = 'HIGH';
            }
            const parsedDob = normalizeIndonesianDate(nextMatch[2].trim());
            if (parsedDob) {
              result.birth_date = parsedDob;
              fieldSources.birth_date = 'OCR_VISUAL';
              fieldConfidences.birth_date = 'HIGH';
            }
          }
        }
      }
    }

    // 4. Jenis Kelamin
    if (!result.gender) {
      if (upper.includes('JENIS KELAMIN') || upper.includes('KELAMIN')) {
        const detected = normalizeGender(line) || normalizeGender(nextLine);
        if (detected) {
          result.gender = detected;
          fieldSources.gender = 'OCR_VISUAL';
          fieldConfidences.gender = 'HIGH';
        }
      }
    }

    // 5. Alamat
    if (!result.address) {
      if (upper.includes('ALAMAT') || upper.startsWith('ALAMAT:')) {
        const withoutLabel = line.replace(/(?:ALAMAT)\s*[:=]?\s*/i, '').trim();
        if (withoutLabel.length >= 2 && !isLabelOrHeader(withoutLabel)) {
          result.address = withoutLabel;
          fieldSources.address = 'OCR_VISUAL';
          fieldConfidences.address = 'HIGH';
        } else if (nextLine && nextLine.length >= 2 && !isLabelOrHeader(nextLine)) {
          result.address = nextLine;
          fieldSources.address = 'OCR_VISUAL';
          fieldConfidences.address = 'HIGH';
        }
      }
    }

    // 6. RT/RW
    if (!result.rt_rw) {
      if (upper.includes('RT/RW') || upper.includes('RT / RW') || upper.includes('RT:')) {
        const rtrwMatch = line.match(/(?:RT[\/\s]*RW|RT)\s*[:=]?\s*([0-9\/\s-]+)/i);
        if (rtrwMatch && rtrwMatch[1].trim().length >= 2) {
          result.rt_rw = rtrwMatch[1].trim();
          fieldSources.rt_rw = 'OCR_VISUAL';
          fieldConfidences.rt_rw = 'HIGH';
        }
      }
    }

    // 7. Kelurahan / Desa
    if (!result.kelurahan) {
      if (upper.includes('KEL/DESA') || upper.includes('KELURAHAN') || upper.includes('DESA')) {
        const kelMatch = line.match(/(?:KEL[\/\s]*DESA|KELURAHAN|DESA)\s*[:=]?\s*([A-Za-z0-9\s-]+)/i);
        if (kelMatch && kelMatch[1].trim().length >= 2 && !isLabelOrHeader(kelMatch[1])) {
          result.kelurahan = kelMatch[1].trim();
          fieldSources.kelurahan = 'OCR_VISUAL';
          fieldConfidences.kelurahan = 'HIGH';
        }
      }
    }

    // 8. Kecamatan
    if (!result.kecamatan) {
      if (upper.includes('KECAMATAN') || upper.includes('KEC.')) {
        const kecMatch = line.match(/(?:KECAMATAN|KEC\.?)\s*[:=]?\s*([A-Za-z0-9\s-]+)/i);
        if (kecMatch && kecMatch[1].trim().length >= 2 && !isLabelOrHeader(kecMatch[1])) {
          result.kecamatan = kecMatch[1].trim();
          fieldSources.kecamatan = 'OCR_VISUAL';
          fieldConfidences.kecamatan = 'HIGH';
        }
      }
    }

    // 9. Agama
    if (!result.religion) {
      if (upper.includes('AGAMA')) {
        const relMatch = line.match(/(?:AGAMA)\s*[:=]?\s*([A-Z\s]+)/i);
        if (relMatch && relMatch[1].trim().length >= 3) {
          result.religion = relMatch[1].trim();
          fieldSources.religion = 'OCR_VISUAL';
          fieldConfidences.religion = 'HIGH';
        }
      }
    }

    // 10. Status Perkawinan
    if (!result.marital_status) {
      if (upper.includes('STATUS PERKAWINAN') || upper.includes('STATUS') || upper.includes('KAWIN')) {
        const msMatch = line.match(/(?:STATUS\s*PERKAWINAN|STATUS)\s*[:=]?\s*([A-Z\s]+)/i);
        if (msMatch && msMatch[1].trim().length >= 3) {
          result.marital_status = msMatch[1].trim();
          fieldSources.marital_status = 'OCR_VISUAL';
          fieldConfidences.marital_status = 'HIGH';
        } else if (upper.includes('BELUM KAWIN')) {
          result.marital_status = 'BELUM KAWIN';
          fieldSources.marital_status = 'OCR_VISUAL';
          fieldConfidences.marital_status = 'HIGH';
        } else if (upper.includes('KAWIN')) {
          result.marital_status = 'KAWIN';
          fieldSources.marital_status = 'OCR_VISUAL';
          fieldConfidences.marital_status = 'HIGH';
        }
      }
    }

    // 11. Pekerjaan
    if (!result.occupation) {
      if (upper.includes('PEKERJAAN') || upper.includes('BURUH') || upper.includes('WIRASWASTA') || upper.includes('PNS') || upper.includes('SWASTA')) {
        const occMatch = line.match(/(?:PEKERJAAN)\s*[:=]?\s*([A-Za-z0-9\s\/]+)/i);
        if (occMatch && occMatch[1].trim().length >= 3 && !isLabelOrHeader(occMatch[1])) {
          result.occupation = occMatch[1].trim();
          fieldSources.occupation = 'OCR_VISUAL';
          fieldConfidences.occupation = 'HIGH';
        } else if (upper.includes('BURUH HARIAN LEPAS')) {
          result.occupation = 'BURUH HARIAN LEPAS';
          fieldSources.occupation = 'OCR_VISUAL';
          fieldConfidences.occupation = 'HIGH';
        }
      }
    }
  }

  // Cross-check NIK with embedded birthdate and gender and Region Decoder
  if (result.nik) {
    const nikCheck = validateNik(result.nik);
    if (nikCheck.valid && nikCheck.embeddedDob) {
      if (result.birth_date && result.birth_date !== nikCheck.embeddedDob) {
        conflicts.push(`Tanggal lahir OCR (${result.birth_date}) berbeda dengan struktur NIK (${nikCheck.embeddedDob})`);
        fieldConfidences.birth_date = 'MEDIUM';
      }
      if (!result.birth_date) {
        result.birth_date = nikCheck.embeddedDob;
        fieldSources.birth_date = 'OCR_ZONE';
        fieldConfidences.birth_date = 'MEDIUM';
      }
      if (!result.gender && nikCheck.genderHint) {
        result.gender = nikCheck.genderHint;
        fieldSources.gender = 'OCR_ZONE';
        fieldConfidences.gender = 'MEDIUM';
      }
    }

    // Decode Province & Kota/Kabupaten from NIK prefix
    const region = decodeNikRegion(result.nik);
    if (!result.province && region.province) {
      result.province = region.province;
      fieldSources.province = 'OCR_ZONE';
      fieldConfidences.province = 'HIGH';
    }
    if (!result.city && region.city) {
      result.city = region.city;
      fieldSources.city = 'OCR_ZONE';
      fieldConfidences.city = 'HIGH';
    }
  }

  // Detect Kota / Kabupaten and Provinsi from KTP Header/Lines
  for (const l of lines) {
    const u = l.toUpperCase();
    if (!result.province && u.includes('PROVINSI')) {
      const prov = l.replace(/PROVINSI\s*/i, '').trim();
      if (prov && prov.length >= 3 && !isLabelOrHeader(prov)) {
        result.province = prov;
      }
    }
    if (!result.city && (u.includes('KOTA') || u.includes('KABUPATEN') || u.includes('KAB.'))) {
      const cityMatch = l.match(/(?:KOTA|KABUPATEN|KAB\.?)\s*([A-Za-z\s-]+)/i);
      if (cityMatch && cityMatch[1].trim().length >= 3 && !isLabelOrHeader(cityMatch[1])) {
        result.city = cityMatch[0].trim();
      }
    }
  }

  // Scan for known Indonesian cities in all text lines for birth place or city
  for (const cityName of KNOWN_CITIES) {
    if (text.toUpperCase().includes(cityName)) {
      if (!result.birth_place) {
        result.birth_place = cityName;
        fieldSources.birth_place = 'OCR_VISUAL';
        fieldConfidences.birth_place = 'MEDIUM';
      } else if (!result.city) {
        result.city = cityName;
        fieldSources.city = 'OCR_VISUAL';
        fieldConfidences.city = 'MEDIUM';
      }
    }
  }

  // If city is still not set but birth_place is known, city can default or vice versa
  if (!result.city && result.birth_place) {
    result.city = result.birth_place;
  }

  // Compose clean full address string
  if (result.address || result.rt_rw || result.kelurahan || result.kecamatan || result.city || result.province) {
    const composed = composeKtpAddress({
      street: result.address,
      rt_rw: result.rt_rw,
      kelurahan: result.kelurahan,
      kecamatan: result.kecamatan,
      city: result.city,
      province: result.province,
    });
    if (composed) {
      result.address = composed;
    }
  }

  result.field_sources = fieldSources;
  result.field_confidences = fieldConfidences;
  result.conflicts = conflicts.length > 0 ? conflicts : undefined;

  return result;
}
