import { 
  PackageReadiness, 
  ParticipantReadiness, 
  DimensionReadiness, 
  ReadinessDimensionStatus,
  Package,
  PackageParticipant,
  Jamaah,
  Invoice
} from '@/types/database.types';
import { DbRepository } from '@/lib/repository/db';
import { 
  calculateDaysToDeparture, 
  evaluatePassportValidityAgainstDeparture,
  OperationalThresholds 
} from './thresholds';

export class ReadinessService {
  /**
   * Calculate transparent, explainable operational readiness for a single Package.
   */
  public static async getPackageReadiness(packageId: string): Promise<PackageReadiness> {

    const pkg = await DbRepository.getPackageById(packageId);
    if (!pkg) throw new Error('Paket tidak ditemukan.');

    const daysToDeparture = calculateDaysToDeparture(pkg.departure_date);
    const isPast = daysToDeparture < 0;

    // Load active participants (excluding cancelled, archived, deleted)
    const allParticipants = await DbRepository.getParticipants({ packageId });
    const activeParticipants = allParticipants.filter(
      p => !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED'
    );
    const totalPax = activeParticipants.length;

    const criticalBlockers: string[] = [];
    const warningIssues: string[] = [];

    if (totalPax === 0) {
      return {
        package_id: pkg.id,
        package_name: pkg.package_name,
        departure_date: pkg.departure_date,
        days_to_departure: daysToDeparture,
        is_past_departure: isPast,
        total_active_participants: 0,
        overall_readiness_percentage: 100,
        overall_status: 'READY',
        critical_blockers_count: 0,
        warning_issues_count: 0,
        dimensions: {
          document: { dimension: 'DOCUMENT', status: 'READY', percentage: 100, total_pax: 0, ready_pax: 0, is_applicable: true, blockers_count: 0, warnings_count: 0 },
          finance: { dimension: 'FINANCE', status: 'READY', percentage: 100, total_pax: 0, ready_pax: 0, is_applicable: true, blockers_count: 0, warnings_count: 0 },
          manifest: { dimension: 'MANIFEST', status: 'READY', percentage: 100, total_pax: 0, ready_pax: 0, is_applicable: true, blockers_count: 0, warnings_count: 0 },
          equipment: { dimension: 'EQUIPMENT', status: 'NOT_APPLICABLE', percentage: 100, total_pax: 0, ready_pax: 0, is_applicable: false, blockers_count: 0, warnings_count: 0 },
        },
        critical_blockers_summary: [],
        warning_issues_summary: [],
      };
    }

    const allJamaah = await DbRepository.getJamaahList();
    const allInvoices = await DbRepository.getInvoices();
    const templates = await DbRepository.getManifestTemplates();
    const pkgEquipment = await DbRepository.getPackageEquipment(packageId);

    // -------------------------------------------------------------------------
    // 1. DOCUMENT READINESS
    // -------------------------------------------------------------------------
    let docReadyCount = 0;
    let docBlockers = 0;
    let docWarnings = 0;

    for (const part of activeParticipants) {
      const jamaah = allJamaah.find(j => j.id === part.jamaah_id);
      const jName = jamaah?.passport_name || jamaah?.identity_name || 'Jamaah';

      if (!jamaah?.passport_number || !jamaah?.passport_name) {
        docBlockers++;
        criticalBlockers.push(`Paspor ${jName} belum lengkap.`);
      } else {
        const validity = evaluatePassportValidityAgainstDeparture(
          jamaah.passport_expiry_date,
          pkg.departure_date,
          OperationalThresholds.PASSPORT_EXPIRY_THRESHOLD_MONTHS
        );

        if (validity.isExpired) {
          docBlockers++;
          criticalBlockers.push(`Paspor ${jName} expired (${jamaah.passport_expiry_date}).`);
        } else if (validity.isExpiringSoon) {
          docWarnings++;
          warningIssues.push(`Paspor ${jName} berlaku <6 bulan (${validity.remainingMonths} bln).`);
          docReadyCount++; // Count as usable but warned
        } else {
          docReadyCount++;
        }
      }
    }

    const docPercentage = Math.round((docReadyCount / totalPax) * 100);
    const docStatus: ReadinessDimensionStatus = docBlockers > 0 ? 'ERROR' : (docWarnings > 0 ? 'WARNING' : 'READY');

    // -------------------------------------------------------------------------
    // 2. FINANCE READINESS (Paid + Overpaid = Complete, Partial + Unpaid = Incomplete)
    // -------------------------------------------------------------------------
    let finReadyCount = 0;
    let finBlockers = 0;
    let finWarnings = 0;

    for (const part of activeParticipants) {
      const jamaah = allJamaah.find(j => j.id === part.jamaah_id);
      const jName = jamaah?.passport_name || jamaah?.identity_name || 'Jamaah';
      const inv = allInvoices.find(i => i.package_participant_id === part.id);

      if (inv && (inv.status === 'PAID' || inv.status === 'OVERPAID')) {
        finReadyCount++;
      } else {
        const outAmt = inv ? inv.outstanding : 0;
        if (daysToDeparture <= OperationalThresholds.FINANCE_OUTSTANDING_CRITICAL_DAYS) {
          finBlockers++;
          criticalBlockers.push(`Pembayaran ${jName} belum lunas (sisa Rp ${outAmt.toLocaleString('id-ID')}).`);
        } else {
          finWarnings++;
          warningIssues.push(`Pembayaran ${jName} belum lunas (sisa Rp ${outAmt.toLocaleString('id-ID')}).`);
        }
      }
    }

    const finPercentage = Math.round((finReadyCount / totalPax) * 100);
    const finStatus: ReadinessDimensionStatus = finBlockers > 0 ? 'ERROR' : (finWarnings > 0 ? 'WARNING' : 'READY');

    // -------------------------------------------------------------------------
    // 3. MANIFEST READINESS
    // -------------------------------------------------------------------------
    let manifestPercentage = 100;
    let manifestReadyCount = totalPax;
    let manifestStatus: ReadinessDimensionStatus = 'READY';
    let manifestBlockers = 0;
    let manifestWarnings = 0;
    const isManifestApplicable = templates.length > 0;

    if (!isManifestApplicable) {
      manifestStatus = 'NOT_CONFIGURED';
      manifestPercentage = 0;
      warningIssues.push('Template manifest belum dikonfigurasi.');
    } else {
      try {
        const manifestValidation = await DbRepository.validateManifest(packageId);
        manifestReadyCount = manifestValidation.ready_count;
        manifestBlockers = manifestValidation.error_count;
        manifestWarnings = manifestValidation.warning_count;
        manifestPercentage = Math.round((manifestReadyCount / totalPax) * 100);

        if (manifestBlockers > 0) {
          manifestStatus = 'ERROR';
          criticalBlockers.push(`${manifestBlockers} jamaah memiliki error pada data manifest.`);
        } else if (manifestWarnings > 0) {
          manifestStatus = 'WARNING';
          warningIssues.push(`${manifestWarnings} jamaah memiliki peringatan manifest.`);
        }
      } catch (err) {
        manifestStatus = 'WARNING';
      }
    }

    // -------------------------------------------------------------------------
    // 4. EQUIPMENT READINESS
    // -------------------------------------------------------------------------
    const isEquipmentApplicable = pkgEquipment.length > 0;
    let equipPercentage = 100;
    let equipReadyCount = totalPax;
    let equipStatus: ReadinessDimensionStatus = 'NOT_APPLICABLE';
    let equipBlockers = 0;
    let equipWarnings = 0;

    if (!isEquipmentApplicable) {
      equipStatus = 'NOT_APPLICABLE';
      equipPercentage = 100;
    } else {
      const paxEquipList = await DbRepository.getParticipantEquipmentList(packageId);
      const completePaxCount = paxEquipList.filter(
        p => p.overall_status === 'READY' || p.overall_status === 'COLLECTED'
      ).length;

      equipReadyCount = completePaxCount;
      equipPercentage = Math.round((completePaxCount / totalPax) * 100);

      const missingVariants = paxEquipList.filter(p => p.has_missing_variant).length;
      const missingGender = paxEquipList.filter(p => p.has_gender_warning).length;

      if (missingVariants > 0) {
        equipWarnings += missingVariants;
        warningIssues.push(`${missingVariants} jamaah belum memilih ukuran perlengkapan.`);
      }
      if (missingGender > 0) {
        equipWarnings += missingGender;
        warningIssues.push(`${missingGender} jamaah belum melengkapi data jenis kelamin.`);
      }

      if (daysToDeparture <= OperationalThresholds.EQUIPMENT_NOT_HANDED_OVER_CRITICAL_DAYS && completePaxCount < totalPax) {
        equipBlockers++;
        criticalBlockers.push(`Perlengkapan belum selesai diserahkan mendekati keberangkatan.`);
      }

      equipStatus = equipBlockers > 0 ? 'ERROR' : (equipWarnings > 0 || completePaxCount < totalPax ? 'WARNING' : 'READY');
    }

    // -------------------------------------------------------------------------
    // 5. DYNAMIC OVERALL READINESS CALCULATION (N/A Handling)
    // -------------------------------------------------------------------------
    const applicableDimensions: number[] = [docPercentage, finPercentage];
    if (isManifestApplicable) applicableDimensions.push(manifestPercentage);
    if (isEquipmentApplicable) applicableDimensions.push(equipPercentage);

    const overallPercentage = Math.round(
      applicableDimensions.reduce((sum, val) => sum + val, 0) / applicableDimensions.length
    );

    let overallStatus: 'READY' | 'WARNING' | 'CRITICAL' | 'NOT_CONFIGURED' = 'READY';
    if (criticalBlockers.length > 0) {
      overallStatus = 'CRITICAL';
    } else if (warningIssues.length > 0 || overallPercentage < 100) {
      overallStatus = 'WARNING';
    }

    return {
      package_id: pkg.id,
      package_name: pkg.package_name,
      departure_date: pkg.departure_date,
      days_to_departure: daysToDeparture,
      is_past_departure: isPast,
      total_active_participants: totalPax,
      overall_readiness_percentage: overallPercentage,
      overall_status: overallStatus,
      critical_blockers_count: criticalBlockers.length,
      warning_issues_count: warningIssues.length,
      dimensions: {
        document: {
          dimension: 'DOCUMENT',
          status: docStatus,
          percentage: docPercentage,
          total_pax: totalPax,
          ready_pax: docReadyCount,
          is_applicable: true,
          blockers_count: docBlockers,
          warnings_count: docWarnings,
        },
        finance: {
          dimension: 'FINANCE',
          status: finStatus,
          percentage: finPercentage,
          total_pax: totalPax,
          ready_pax: finReadyCount,
          is_applicable: true,
          blockers_count: finBlockers,
          warnings_count: finWarnings,
        },
        manifest: {
          dimension: 'MANIFEST',
          status: manifestStatus,
          percentage: isManifestApplicable ? manifestPercentage : 0,
          total_pax: totalPax,
          ready_pax: manifestReadyCount,
          is_applicable: isManifestApplicable,
          blockers_count: manifestBlockers,
          warnings_count: manifestWarnings,
          notes: !isManifestApplicable ? 'Template belum diatur' : undefined,
        },
        equipment: {
          dimension: 'EQUIPMENT',
          status: equipStatus,
          percentage: isEquipmentApplicable ? equipPercentage : 0,
          total_pax: totalPax,
          ready_pax: equipReadyCount,
          is_applicable: isEquipmentApplicable,
          blockers_count: equipBlockers,
          warnings_count: equipWarnings,
          notes: !isEquipmentApplicable ? 'Tidak ada konfigurasi paket' : undefined,
        },
      },
      critical_blockers_summary: criticalBlockers,
      warning_issues_summary: warningIssues,
    };
  }

  /**
   * Calculate Trip-Specific Participant Readiness Matrix.
   * Repeat travelers maintain strictly isolated readiness per trip.
   */
  public static async getParticipantReadiness(participantId: string): Promise<ParticipantReadiness> {
    const participant = await DbRepository.getParticipantById(participantId);
    if (!participant) throw new Error('Peserta paket tidak ditemukan.');

    const pkg = await DbRepository.getPackageById(participant.package_id);
    const jamaah = await DbRepository.getJamaahById(participant.jamaah_id);
    const invoice = await DbRepository.getInvoiceByParticipantId(participant.id);
    const pic = participant.pic_id ? await DbRepository.getPicById(participant.pic_id) : null;
    const pkgEquipment = await DbRepository.getPackageEquipment(participant.package_id);

    const issues: string[] = [];

    // 1. Document Status
    let docStatus: ReadinessDimensionStatus = 'READY';
    if (!jamaah?.passport_number || !jamaah?.passport_name) {
      docStatus = 'ERROR';
      issues.push('Paspor belum lengkap');
    } else {
      const validity = evaluatePassportValidityAgainstDeparture(
        jamaah.passport_expiry_date,
        pkg?.departure_date
      );
      if (validity.isExpired) {
        docStatus = 'ERROR';
        issues.push('Paspor expired');
      } else if (validity.isExpiringSoon) {
        docStatus = 'WARNING';
        issues.push(`Paspor sisa ${validity.remainingMonths} bln`);
      }
    }

    // 2. Finance Status
    let finStatus: ReadinessDimensionStatus = 'READY';
    if (invoice && (invoice.status === 'PAID' || invoice.status === 'OVERPAID')) {
      finStatus = 'READY';
    } else {
      finStatus = 'WARNING';
      issues.push(`Tagihan ${invoice?.status || 'UNPAID'} (Sisa: Rp ${(invoice?.outstanding || 0).toLocaleString('id-ID')})`);
    }

    // 3. Manifest Status
    let manifestStatus: ReadinessDimensionStatus = 'READY';
    try {
      const manifestVal = await DbRepository.validatePackageManifest(participant.package_id);
      const row = manifestVal.participants.find(r => r.participant_id === participant.id);
      if (row?.status === 'ERROR') {
        manifestStatus = 'ERROR';
        issues.push(row.issues[0]?.message || 'Data manifest tidak valid');
      } else if (row?.status === 'WARNING') {
        manifestStatus = 'WARNING';
        issues.push(row.issues[0]?.message || 'Peringatan manifest');
      }
    } catch {
      manifestStatus = 'READY';
    }

    // 4. Equipment Status
    let equipStatus: ReadinessDimensionStatus = 'NOT_APPLICABLE';
    if (pkgEquipment.length > 0) {
      const equipRows = await DbRepository.getParticipantEquipmentByParticipant(participant.id);
      const hasMissingVar = equipRows.some(e => !e.variant_id && e.package_equipment_item?.equipment_item?.requires_variant);
      const isComplete = equipRows.every(e => e.quantity_handed_over >= e.quantity_expected && e.quantity_expected > 0);

      if (hasMissingVar) {
        equipStatus = 'WARNING';
        issues.push('Ukuran perlengkapan belum dipilih');
      } else if (isComplete) {
        equipStatus = 'READY';
      } else {
        equipStatus = 'WARNING';
        issues.push('Perlengkapan belum selesai diserahkan');
      }
    }

    let overall: 'READY' | 'ACTION_REQUIRED' | 'NEEDS_REVIEW' = 'READY';
    if (docStatus === 'ERROR' || manifestStatus === 'ERROR') {
      overall = 'ACTION_REQUIRED';
    } else if (docStatus === 'WARNING' || finStatus === 'WARNING' || equipStatus === 'WARNING') {
      overall = 'NEEDS_REVIEW';
    }

    return {
      participant_id: participant.id,
      jamaah_id: jamaah?.id || '',
      jamaah_name: jamaah?.passport_name || jamaah?.identity_name || 'Jamaah',
      passport_name: jamaah?.passport_name || null,
      package_id: participant.package_id,
      package_name: pkg?.package_name || '',
      pic_name: pic?.name || null,
      document_status: docStatus,
      finance_status: finStatus,
      manifest_status: manifestStatus,
      equipment_status: equipStatus,
      overall_status: overall,
      issues,
    };
  }
}
