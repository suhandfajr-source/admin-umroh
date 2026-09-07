import { 
  Package, 
  PackageParticipant, 
  Jamaah, 
  ManifestTemplate, 
  ManifestValidationSummary, 
  ManifestParticipantValidation, 
  ManifestParticipantIssue,
  ManifestValidationStatus 
} from '@/types/database.types';

export class ManifestValidator {
  /**
   * Validates participants of a package for manifest export readiness
   */
  public static validatePackageManifest(
    pkg: Package,
    participants: (PackageParticipant & { jamaah?: Jamaah; pic?: any })[],
    template?: ManifestTemplate | null,
    sorting?: 'DEFAULT' | 'NAME' | 'PASSPORT_NAME' | 'PIC'
  ): ManifestValidationSummary {
    const activeParticipants = participants.filter(p => !p.deleted_at);

    // Apply Sorting
    const sortedParticipants = [...activeParticipants];
    if (sorting === 'NAME') {
      sortedParticipants.sort((a, b) => 
        (a.jamaah?.identity_name || '').localeCompare(b.jamaah?.identity_name || '')
      );
    } else if (sorting === 'PASSPORT_NAME') {
      sortedParticipants.sort((a, b) => 
        (a.jamaah?.passport_name || a.jamaah?.identity_name || '').localeCompare(
          b.jamaah?.passport_name || b.jamaah?.identity_name || ''
        )
      );
    } else if (sorting === 'PIC') {
      sortedParticipants.sort((a, b) => 
        (a.pic?.name || 'Direct').localeCompare(b.pic?.name || 'Direct')
      );
    }

    const validatedParticipants: ManifestParticipantValidation[] = [];
    const passportNumberMap = new Map<string, string[]>(); // passportNo -> participantIds[]

    // Check duplicate passport numbers in package
    for (const part of sortedParticipants) {
      const pNo = part.jamaah?.passport_number?.trim().toUpperCase();
      if (pNo) {
        const existing = passportNumberMap.get(pNo) || [];
        existing.push(part.id);
        passportNumberMap.set(pNo, existing);
      }
    }

    let readyCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    let index = 1;
    for (const part of sortedParticipants) {
      const j = part.jamaah;
      const issues: ManifestParticipantIssue[] = [];

      if (!j) {
        issues.push({
          field: 'jamaah',
          severity: 'ERROR',
          message: 'Data master jamaah tidak ditemukan atau terhapus.',
        });
      } else {
        // 1. Passport Name Check (Strict Rule: MUST have passport_name; NO fallback to identity_name)
        if (!j.passport_name || !j.passport_name.trim()) {
          issues.push({
            field: 'passport_name',
            severity: 'ERROR',
            message: 'Nama paspor belum diisi / diverifikasi. Nama identitas KTP tidak boleh digunakan sebagai pengganti paspor pada manifest resmi.',
          });
        }

        // 2. Passport Number Check
        if (!j.passport_number || !j.passport_number.trim()) {
          issues.push({
            field: 'passport_number',
            severity: 'ERROR',
            message: 'Nomor paspor belum diisi.',
          });
        } else {
          const pNo = j.passport_number.trim().toUpperCase();
          const dupes = passportNumberMap.get(pNo);
          if (dupes && dupes.length > 1) {
            issues.push({
              field: 'passport_number',
              severity: 'ERROR',
              message: `Nomor paspor ${pNo} duplikat dengan ${dupes.length - 1} peserta lain di paket ini.`,
            });
          }
        }

        // 3. Birth Date & Place Check
        if (!j.birth_date) {
          issues.push({
            field: 'birth_date',
            severity: 'ERROR',
            message: 'Tanggal lahir belum diisi.',
          });
        }
        if (!j.birth_place) {
          issues.push({
            field: 'birth_place',
            severity: 'WARNING',
            message: 'Tempat lahir belum diisi.',
          });
        }

        // 4. Gender Check
        if (!j.gender) {
          issues.push({
            field: 'gender',
            severity: 'WARNING',
            message: 'Jenis kelamin (Gender) belum ditentukan.',
          });
        }

        // 5. Passport Issue Details Check
        if (!j.passport_issue_date) {
          issues.push({
            field: 'passport_issue_date',
            severity: 'WARNING',
            message: 'Tanggal penerbitan paspor belum diisi.',
          });
        }
        if (!j.passport_issue_place) {
          issues.push({
            field: 'passport_issue_place',
            severity: 'WARNING',
            message: 'Kantor imigrasi / tempat penerbitan paspor belum diisi.',
          });
        }

        // 6. Passport Validity relative to Package Departure Date
        if (!j.passport_expiry_date) {
          issues.push({
            field: 'passport_expiry_date',
            severity: 'ERROR',
            message: 'Tanggal kadaluarsa paspor (expiry date) belum diisi.',
          });
        } else {
          const expiry = new Date(j.passport_expiry_date);
          const now = new Date();

          if (expiry < now) {
            issues.push({
              field: 'passport_expiry_date',
              severity: 'ERROR',
              message: `Paspor telah kadaluarsa (${j.passport_expiry_date}).`,
            });
          } else if (pkg.departure_date) {
            const departure = new Date(pkg.departure_date);
            const diffMonths = (expiry.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);

            if (expiry < departure) {
              issues.push({
                field: 'passport_expiry_date',
                severity: 'ERROR',
                message: `Paspor kadaluarsa sebelum tanggal keberangkatan paket (${pkg.departure_date}).`,
              });
            } else if (diffMonths < 6) {
              issues.push({
                field: 'passport_expiry_date',
                severity: 'WARNING',
                message: `Masa berlaku paspor sisa ${Math.round(diffMonths)} bulan dari tanggal keberangkatan (kurang dari 6 bulan).`,
              });
            }
          }
        }

        // 7. Passport Document Confirmation Check
        const hasCurrentPassportDoc = j.documents?.some(d => d.document_type === 'PASSPORT' && d.is_current);
        if (!hasCurrentPassportDoc) {
          issues.push({
            field: 'passport_document',
            severity: 'WARNING',
            message: 'File scan paspor asli (current) belum terunggah di sistem.',
          });
        }
      }

      // Determine Overall Status for Participant
      let status: ManifestValidationStatus = 'READY';
      if (issues.some(i => i.severity === 'ERROR')) {
        status = 'ERROR';
        errorCount++;
      } else if (issues.some(i => i.severity === 'WARNING')) {
        status = 'WARNING';
        warningCount++;
      } else {
        readyCount++;
      }

      // Build Mapped Values for preview table
      const mappedValues: Record<string, any> = {
        no: index++,
        passport_name: j?.passport_name || '',
        passport_number: j?.passport_number || '-',
        birth_place: j?.birth_place || '-',
        birth_date: j?.birth_date || '-',
        gender: j?.gender || '-',
        passport_issue_place: j?.passport_issue_place || '-',
        passport_issue_date: j?.passport_issue_date || '-',
        passport_expiry_date: j?.passport_expiry_date || '-',
        ktp_name: j?.ktp_name || '-',
        identity_name: j?.identity_name || '-',
        nik: j?.nik || '-',
        kk_number: j?.kk_number || '-',
        phone: j?.phone || '-',
        address: j?.address || '-',
        relationship: (part as any).relationship || j?.relationship || (j?.notes?.match(/Hubungan:\s*([^,\n]+)/i)?.[1]?.trim()) || '-',
        marital_status: (part as any).marital_status || j?.marital_status || (j?.notes?.match(/Status Pernikahan:\s*([^,\n]+)/i)?.[1]?.trim()) || '-',
        package_name: pkg.package_name,
        departure_date: pkg.departure_date,
        return_date: pkg.return_date,
        airline: pkg.airline || '-',
        makkah_hotel: pkg.makkah_hotel || '-',
        madinah_hotel: pkg.madinah_hotel || '-',
        pic_name: part.pic?.name || 'Direct',
        selling_price: part.selling_price || 0,
        b2b_price: part.b2b_price || 0,
        participant_status: part.participant_status,
      };

      validatedParticipants.push({
        participant_id: part.id,
        jamaah_id: part.jamaah_id,
        jamaah_name: j?.identity_name || j?.passport_name || 'Jamaah',
        passport_name: j?.passport_name || null,
        passport_number: j?.passport_number || null,
        status,
        issues,
        mapped_values: mappedValues,
      });
    }

    return {
      package_id: pkg.id,
      package_name: pkg.package_name,
      template_id: template?.id,
      template_name: template?.name || 'Default Manifest Template',
      total_participants: activeParticipants.length,
      ready_count: readyCount,
      warning_count: warningCount,
      error_count: errorCount,
      participants: validatedParticipants,
    };
  }
}
