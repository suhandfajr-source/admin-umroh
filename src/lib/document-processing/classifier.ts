import { DocumentType } from '@/types/database.types';
import { DocumentClassificationResult } from '@/types/document.types';

export function classifyDocument(rawText: string, filename?: string): DocumentClassificationResult {
  const text = (rawText || '').toUpperCase();
  const lowerFile = (filename || '').toLowerCase();
  
  const signals: string[] = [];
  const scores: Record<DocumentType, number> = {
    PASSPORT: 0,
    KTP: 0,
    KK: 0,
    VAKSIN: 0,
    BUKU_NIKAH: 0,
    OTHER: 0,
  };

  // 1. PASSPORT Signals
  if (text.includes('PASPOR') || text.includes('PASSPORT')) {
    scores.PASSPORT += 35;
    signals.push('Keyword: PASPOR / PASSPORT');
  }
  if (text.includes('REPUBLIK INDONESIA') && (text.includes('KODE NEGARA') || text.includes('COUNTRY CODE') || text.includes('DIRECTORATE GENERAL OF IMMIGRATION'))) {
    scores.PASSPORT += 30;
    signals.push('Header: Imigrasi / Country Code');
  }
  if (text.match(/P<IDN[A-Z<]+/)) {
    scores.PASSPORT += 50;
    signals.push('MRZ Pattern: P<IDN');
  }
  if (text.includes('TANGGAL KADALUARSA') || text.includes('DATE OF EXPIRY') || text.includes('DATE OF ISSUE') || text.includes('TEMPAT DITERBITKAN')) {
    scores.PASSPORT += 25;
    signals.push('Passport metadata keywords');
  }

  // 2. KTP Signals
  if (text.includes('PROVINSI') || text.includes('KOTA') || text.includes('KABUPATEN')) {
    scores.KTP += 25;
    signals.push('Header: Provinsi / Kabupaten');
  }
  if (text.includes('NIK') || text.match(/NIK\s*[:=]?\s*[0-9]{16}/)) {
    scores.KTP += 35;
    signals.push('Pattern: NIK');
  }
  if (text.includes('GOL. DARAH') || text.includes('STATUS PERKAWINAN') || text.includes('BERLAKU HINGGA') || text.includes('KEWARGANEGARAAN')) {
    scores.KTP += 30;
    signals.push('KTP layout metadata');
  }
  if (text.includes('KARTU TANDA PENDUDUK')) {
    scores.KTP += 50;
    signals.push('Title: Kartu Tanda Penduduk');
  }

  // 3. KARTU KELUARGA (KK) Signals
  if (text.includes('KARTU KELUARGA')) {
    scores.KK += 50;
    signals.push('Title: KARTU KELUARGA');
  }
  if (text.includes('NO. KK') || text.includes('NOMOR KK') || text.match(/NO\.\s*[0-9]{16}/)) {
    scores.KK += 35;
    signals.push('Pattern: Nomor Kartu Keluarga');
  }
  if (text.includes('KEPALA KELUARGA') || text.includes('HUBUNGAN DALAM KELUARGA') || text.includes('NAMA LENGKAP') && text.includes('STATUS HUBUNGAN')) {
    scores.KK += 30;
    signals.push('KK table headers');
  }

  // 4. VAKSIN Signals
  if (text.includes('VAKSIN') || text.includes('VACCINE') || text.includes('COVID-19') || text.includes('MENINGITIS') || text.includes('PEDULILINDUNGI') || text.includes('SATUSEHAT')) {
    scores.VAKSIN += 45;
    signals.push('Keyword: Vaksin / SATUSEHAT');
  }
  if (text.includes('SERTIFIKAT VAKSINASI') || text.includes('DOSE') || text.includes('DOSIS')) {
    scores.VAKSIN += 35;
    signals.push('Vaksin dose info');
  }

  // 5. BUKU NIKAH Signals
  if (text.includes('BUKU NIKAH') || text.includes('KUTIPAN AKTA NIKAH') || text.includes('KANTOR URUSAN AGAMA') || text.includes('KEMENTERIAN AGAMA')) {
    scores.BUKU_NIKAH += 50;
    signals.push('Title: Buku Nikah / KUA');
  }
  if (text.includes('SUAMI') && text.includes('ISTRI') && text.includes('MAHAR')) {
    scores.BUKU_NIKAH += 35;
    signals.push('Buku Nikah relations');
  }

  // 6. Fallback Filename Hints (Secondary)
  if (lowerFile.includes('paspor') || lowerFile.includes('passport')) {
    scores.PASSPORT += 15;
    signals.push('Filename hint: passport');
  }
  if (lowerFile.includes('ktp')) {
    scores.KTP += 15;
    signals.push('Filename hint: ktp');
  }
  if (lowerFile.includes('kk') || lowerFile.includes('kartu_keluarga')) {
    scores.KK += 15;
    signals.push('Filename hint: kk');
  }
  if (lowerFile.includes('vaksin') || lowerFile.includes('vaccine') || lowerFile.includes('meningitis')) {
    scores.VAKSIN += 15;
    signals.push('Filename hint: vaksin');
  }
  if (lowerFile.includes('nikah')) {
    scores.BUKU_NIKAH += 15;
    signals.push('Filename hint: buku nikah');
  }

  // Find max scored document type
  let maxType: DocumentType = 'OTHER';
  let maxScore = 0;

  (Object.keys(scores) as DocumentType[]).forEach((type) => {
    if (scores[type] > maxScore) {
      maxScore = scores[type];
      maxType = type;
    }
  });

  const confidence = Math.min(100, Math.round(maxScore));
  
  return {
    detected_type: maxScore >= 20 ? maxType : 'OTHER',
    confidence: maxScore >= 20 ? confidence : 10,
    signals,
  };
}
