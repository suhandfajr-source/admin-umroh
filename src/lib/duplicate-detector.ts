import { Jamaah } from '@/types/database.types';
import { DuplicateMatchDetail } from '@/types/document.types';

export interface CandidateIdentity {
  identity_name?: string;
  passport_name?: string;
  passport_number?: string;
  ktp_name?: string;
  nik?: string;
  kk_number?: string;
  birth_date?: string;
}

export function detectDuplicate(
  candidate: CandidateIdentity,
  existingJamaahList: Jamaah[]
): DuplicateMatchDetail | null {
  const norm = (s?: string | null) => (s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const candidateName = norm(candidate.passport_name || candidate.ktp_name || candidate.identity_name);
  const candidatePassport = norm(candidate.passport_number);
  const candidateNik = norm(candidate.nik);
  const candidateKk = norm(candidate.kk_number);
  const candidateDob = (candidate.birth_date || '').trim();

  for (const j of existingJamaahList) {
    if (j.deleted_at) continue;

    const jPassport = norm(j.passport_number);
    const jNik = norm(j.nik);
    const jKk = norm(j.kk_number);
    const jDob = (j.birth_date || '').trim();
    const rawNames = [j.passport_name, j.ktp_name, j.identity_name].filter(Boolean) as string[];
    const jNames = rawNames.map(n => norm(n));

    // Rule 1: Exact Passport Number
    if (candidatePassport && jPassport && candidatePassport === jPassport) {
      return {
        matched_jamaah_id: j.id,
        matched_jamaah_name: j.identity_name || j.passport_name || 'Jamaah',
        matched_field: 'PASSPORT_NUMBER',
        match_confidence: 'HIGH',
        reason: `Nomor Paspor sama (${candidate.passport_number}) dengan data master jamaah ${j.identity_name}.`,
        existing_record: j,
      };
    }

    // Rule 2: Exact NIK
    if (candidateNik && jNik && candidateNik === jNik) {
      return {
        matched_jamaah_id: j.id,
        matched_jamaah_name: j.identity_name || j.ktp_name || 'Jamaah',
        matched_field: 'NIK',
        match_confidence: 'HIGH',
        reason: `Nomor NIK sama (${candidate.nik}) dengan data master jamaah ${j.identity_name}.`,
        existing_record: j,
      };
    }

    // Rule 3: Name + Date of Birth (Exact inclusion OR word token intersection)
    if (candidateDob && jDob && candidateDob === jDob) {
      const candidateTokens = (candidate.passport_name || candidate.ktp_name || candidate.identity_name || '')
        .toUpperCase()
        .replace(/[^A-Z\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !['BIN', 'BINTI', 'DAN', 'AL'].includes(t));

      const existingTokens = rawNames
        .join(' ')
        .toUpperCase()
        .replace(/[^A-Z\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !['BIN', 'BINTI', 'DAN', 'AL'].includes(t));

      const hasDirectInclusion = candidateName && jNames.some(jn => jn.includes(candidateName) || candidateName.includes(jn));
      const hasTokenMatch = candidateTokens.some(ct => existingTokens.includes(ct));

      if (hasDirectInclusion || hasTokenMatch) {
        return {
          matched_jamaah_id: j.id,
          matched_jamaah_name: j.identity_name || j.passport_name || 'Jamaah',
          matched_field: 'NAME_AND_DOB',
          match_confidence: hasDirectInclusion ? 'HIGH' : 'MEDIUM',
          reason: `Kombinasi Nama mirip & Tanggal Lahir sama (${candidateDob}) cocok dengan data master ${j.identity_name}.`,
          existing_record: j,
        };
      }
    }

    // Rule 3.5: Exact Full Name Match (>= 5 chars)
    if (candidateName && candidateName.length >= 5 && jNames.includes(candidateName)) {
      return {
        matched_jamaah_id: j.id,
        matched_jamaah_name: j.identity_name || j.passport_name || 'Jamaah',
        matched_field: 'NAME_AND_DOB',
        match_confidence: 'MEDIUM',
        reason: `Nama lengkap sama persis (${candidate.identity_name || candidate.passport_name}) dengan data master jamaah ${j.identity_name}.`,
        existing_record: j,
      };
    }

    // Rule 4: KK Number + Name
    if (candidateKk && jKk && candidateKk === jKk && candidateName) {
      const nameMatches = jNames.some(jn => jn.includes(candidateName) || candidateName.includes(jn));
      if (nameMatches) {
        return {
          matched_jamaah_id: j.id,
          matched_jamaah_name: j.identity_name,
          matched_field: 'KK_AND_NAME',
          match_confidence: 'MEDIUM',
          reason: `Nomor KK (${candidate.kk_number}) dan Nama cocok dengan jamaah ${j.identity_name}.`,
          existing_record: j,
        };
      }
    }
  }

  return null;
}
