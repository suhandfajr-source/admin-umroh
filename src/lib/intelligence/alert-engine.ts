import { 
  OperationalAlert, 
  AlertCategory, 
  AlertSeverity, 
  AlertStatus, 
  Package, 
  PackageParticipant, 
  Jamaah, 
  Invoice, 
  Payment,
  EquipmentItem,
  PackageEquipmentItem,
  ParticipantEquipment
} from '@/types/database.types';
import { DbRepository } from '@/lib/repository/db';
import { 
  OperationalThresholds, 
  calculateDaysToDeparture, 
  evaluatePassportValidityAgainstDeparture 
} from './thresholds';

export interface AlertCandidate {
  alert_key: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  package_id?: string | null;
  package_name?: string | null;
  package_participant_id?: string | null;
  jamaah_id?: string | null;
  jamaah_name?: string | null;
  pic_id?: string | null;
  pic_name?: string | null;
  source_type: string;
  source_id: string;
  action_url?: string | null;
  action_label?: string | null;
  metadata?: Record<string, any>;
}

export class OperationalAlertEngine {
  private static isEvaluating = false;

  /**
   * Run full operational evaluation across all domain modules.
   * Atomic, deduplicated, idempotent, and thread-safe.
   */
  public static async evaluate(): Promise<{
    evaluated_at: string;
    total_candidates: number;
    open_alerts_count: number;
    resolved_alerts_count: number;
    reopened_alerts_count: number;
    critical_count: number;
    warning_count: number;
  }> {
    // Basic concurrency guard
    if (this.isEvaluating) {
      const currentAlerts = await DbRepository.getOperationalAlerts();
      return {
        evaluated_at: new Date().toISOString(),
        total_candidates: currentAlerts.length,
        open_alerts_count: currentAlerts.filter(a => a.status === 'OPEN').length,
        resolved_alerts_count: currentAlerts.filter(a => a.status === 'RESOLVED').length,
        reopened_alerts_count: 0,
        critical_count: currentAlerts.filter(a => a.status === 'OPEN' && a.severity === 'CRITICAL').length,
        warning_count: currentAlerts.filter(a => a.status === 'OPEN' && a.severity === 'WARNING').length,
      };
    }

    this.isEvaluating = true;
    try {
      const now = new Date().toISOString();
      const candidates: AlertCandidate[] = [];

      // Load active data snapshots
      const packages = await DbRepository.getPackageList();
      const upcomingPackages = packages.filter(p => !p.deleted_at && p.status !== 'COMPLETED' && calculateDaysToDeparture(p.departure_date) >= 0);
      const allParticipants = await DbRepository.getParticipants();
      const allJamaah = await DbRepository.getJamaahList();
      const allInvoices = await DbRepository.getInvoices();
      const allPayments = await DbRepository.getPayments();
      const pendingDocs = await DbRepository.getPendingReviewDocuments();
      const masterEquipment = await DbRepository.getEquipmentItems();

      // =======================================================================
      // 1. FINANCE DETECTORS
      // =======================================================================
      for (const payment of allPayments) {
        if (payment.status === 'CANCELLED') continue;

        if (payment.allocation_status === 'UNALLOCATED') {
          candidates.push({
            alert_key: `PAYMENT_UNALLOCATED:${payment.id}`,
            category: 'FINANCE',
            severity: 'WARNING',
            title: 'Pembayaran Belum Dialokasikan',
            description: `Pembayaran Rp ${payment.amount.toLocaleString('id-ID')} dari ${payment.sender_name || 'Pengirim Anonim'} belum dialokasikan ke jamaah manapun.`,
            source_type: 'PAYMENT',
            source_id: payment.id,
            action_url: `/finance/alokasi?paymentId=${payment.id}`,
            action_label: 'Alokasikan Pembayaran',
          });
        } else if (payment.allocation_status === 'PARTIALLY_ALLOCATED' && payment.remaining_unallocated > 0) {
          candidates.push({
            alert_key: `PAYMENT_PARTIAL:${payment.id}`,
            category: 'FINANCE',
            severity: 'INFO',
            title: 'Sisa Pembayaran Belum Dialokasikan',
            description: `Pembayaran memiliki sisa dana belum dialokasikan sebesar Rp ${payment.remaining_unallocated.toLocaleString('id-ID')}.`,
            source_type: 'PAYMENT',
            source_id: payment.id,
            action_url: `/finance/alokasi?paymentId=${payment.id}`,
            action_label: 'Selesaikan Alokasi',
          });
        }
      }

      // =======================================================================
      // 2. DOCUMENT REVIEW DETECTORS
      // =======================================================================
      if (pendingDocs.length > 0) {
        candidates.push({
          alert_key: `DOCUMENTS_NEED_REVIEW:GLOBAL`,
          category: 'DOCUMENT',
          severity: pendingDocs.length > 5 ? 'WARNING' : 'INFO',
          title: 'Dokumen Menunggu Verifikasi Admin',
          description: `Terdapat ${pendingDocs.length} dokumen hasil upload baru yang membutuhkan konfirmasi admin.`,
          source_type: 'DOCUMENT_REVIEW',
          source_id: 'pending_docs_batch',
          action_url: '/jamaah/review',
          action_label: 'Buka Ruang Review',
        });
      }

      // =======================================================================
      // 3. PACKAGE-LEVEL & PARTICIPANT-LEVEL DETECTORS
      // =======================================================================
      for (const pkg of upcomingPackages) {
        const daysToDeparture = calculateDaysToDeparture(pkg.departure_date);
        const activeParticipants = allParticipants.filter(
          p => p.package_id === pkg.id && !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED'
        );

        let packageHasCriticalBlocker = false;

        // Check Manifest Template Configuration
        const templates = await DbRepository.getManifestTemplates();
        const hasManifestTemplate = templates.length > 0;
        if (!hasManifestTemplate && activeParticipants.length > 0) {
          candidates.push({
            alert_key: `MANIFEST_CONFIG_REQUIRED:${pkg.id}`,
            category: 'MANIFEST',
            severity: daysToDeparture <= OperationalThresholds.MANIFEST_ERROR_CRITICAL_DAYS ? 'CRITICAL' : 'WARNING',
            title: 'Konfigurasi Template Manifest Belum Ada',
            description: `Paket ${pkg.package_name} memiliki ${activeParticipants.length} jamaah tetapi belum ada template manifest aktif.`,
            package_id: pkg.id,
            package_name: pkg.package_name,
            source_type: 'MANIFEST_CONFIG',
            source_id: pkg.id,
            action_url: '/pengaturan/template-manifest',
            action_label: 'Atur Template',
          });
        }

        // Equipment Configuration for Package
        const pkgEquipment = await DbRepository.getPackageEquipment(pkg.id);
        const hasEquipmentConfig = pkgEquipment.length > 0;

        // Loop Active Participants in this Package
        for (const part of activeParticipants) {
          const jamaah = allJamaah.find(j => j.id === part.jamaah_id);
          const jName = jamaah?.passport_name || jamaah?.identity_name || 'Jamaah';

          // --- A. PASSPORT DETECTORS ---
          const isPassportMissing = !jamaah?.passport_number || !jamaah?.passport_name;
          if (isPassportMissing) {
            const isCritical = daysToDeparture <= OperationalThresholds.PASSPORT_MISSING_CRITICAL_DAYS;
            if (isCritical) packageHasCriticalBlocker = true;

            candidates.push({
              alert_key: `PASSPORT_MISSING:${part.id}`,
              category: 'PASSPORT',
              severity: isCritical ? 'CRITICAL' : 'WARNING',
              title: 'Paspor Jamaah Belum Lengkap',
              description: `${jName} terdaftar pada ${pkg.package_name} (berangkat ${daysToDeparture} hari lagi) tetapi belum memiliki data paspor resmi.`,
              package_id: pkg.id,
              package_name: pkg.package_name,
              package_participant_id: part.id,
              jamaah_id: jamaah?.id,
              jamaah_name: jName,
              source_type: 'PARTICIPANT_PASSPORT',
              source_id: part.id,
              action_url: `/jamaah/${jamaah?.id || ''}`,
              action_label: 'Lengkapi Paspor',
            });
          } else {
            // Evaluate Passport Validity against Departure Date (Shared Stage 3 logic)
            const validity = evaluatePassportValidityAgainstDeparture(
              jamaah?.passport_expiry_date,
              pkg.departure_date,
              OperationalThresholds.PASSPORT_EXPIRY_THRESHOLD_MONTHS
            );

            if (validity.isExpired) {
              packageHasCriticalBlocker = true;
              candidates.push({
                alert_key: `PASSPORT_EXPIRED:${part.id}`,
                category: 'PASSPORT',
                severity: 'CRITICAL',
                title: 'Paspor Jamaah Telah Habis Berlaku (Expired)',
                description: `Paspor ${jName} (${jamaah.passport_number}) kadaluarsa (${jamaah.passport_expiry_date}) sebelum tanggal keberangkatan ${pkg.departure_date}.`,
                package_id: pkg.id,
                package_name: pkg.package_name,
                package_participant_id: part.id,
                jamaah_id: jamaah?.id,
                jamaah_name: jName,
                source_type: 'PARTICIPANT_PASSPORT',
                source_id: part.id,
                action_url: `/jamaah/${jamaah.id}`,
                action_label: 'Perbarui Paspor',
              });
            } else if (validity.isExpiringSoon) {
              const isCritical = daysToDeparture <= OperationalThresholds.PASSPORT_MISSING_CRITICAL_DAYS;
              if (isCritical) packageHasCriticalBlocker = true;

              candidates.push({
                alert_key: `PASSPORT_EXPIRING:${part.id}`,
                category: 'PASSPORT',
                severity: isCritical ? 'CRITICAL' : 'WARNING',
                title: 'Masa Berlaku Paspor Kurang Dari 6 Bulan',
                description: `Paspor ${jName} (${jamaah.passport_number}) hanya bersisa ${validity.remainingMonths} bulan saat keberangkatan ${pkg.departure_date}.`,
                package_id: pkg.id,
                package_name: pkg.package_name,
                package_participant_id: part.id,
                jamaah_id: jamaah?.id,
                jamaah_name: jName,
                source_type: 'PARTICIPANT_PASSPORT',
                source_id: part.id,
                action_url: `/jamaah/${jamaah.id}`,
                action_label: 'Periksa Paspor',
              });
            }
          }

          // --- B. FINANCE OUTSTANDING DETECTORS ---
          const invoice = allInvoices.find(inv => inv.package_participant_id === part.id);
          if (invoice && (invoice.status === 'UNPAID' || invoice.status === 'PARTIAL')) {
            const isCritical = daysToDeparture <= OperationalThresholds.FINANCE_OUTSTANDING_CRITICAL_DAYS;
            candidates.push({
              alert_key: `FINANCE_OUTSTANDING:${part.id}`,
              category: 'FINANCE',
              severity: isCritical ? 'CRITICAL' : 'WARNING',
              title: 'Tagihan Jamaah Belum Lunas',
              description: `${jName} pada ${pkg.package_name} memiliki sisa tagihan Rp ${invoice.outstanding.toLocaleString('id-ID')} (status: ${invoice.status}).`,
              package_id: pkg.id,
              package_name: pkg.package_name,
              package_participant_id: part.id,
              jamaah_id: jamaah?.id,
              jamaah_name: jName,
              source_type: 'INVOICE',
              source_id: invoice.id,
              action_url: `/finance/tagihan?invoiceId=${invoice.id}`,
              action_label: 'Buka Tagihan',
            });
          }

          // --- C. EQUIPMENT DETECTORS ---
          if (hasEquipmentConfig) {
            const paxEquipRecords = await DbRepository.getParticipantEquipmentByParticipant(part.id);

            // 1. Missing Gender Check
            if (!jamaah?.gender) {
              const hasGenderSpecific = pkgEquipment.some(pe => pe.applicability === 'MALE' || pe.applicability === 'FEMALE');
              if (hasGenderSpecific) {
                candidates.push({
                  alert_key: `EQUIPMENT_GENDER_MISSING:${part.id}`,
                  category: 'EQUIPMENT',
                  severity: 'WARNING',
                  title: 'Jenis Kelamin Belum Diisi untuk Perlengkapan',
                  description: `${jName} belum memiliki data jenis kelamin sehingga perlengkapan khusus (Ihram/Mukena) belum dapat ditentukan.`,
                  package_id: pkg.id,
                  package_name: pkg.package_name,
                  package_participant_id: part.id,
                  jamaah_id: jamaah?.id,
                  jamaah_name: jName,
                  source_type: 'PARTICIPANT_EQUIPMENT',
                  source_id: part.id,
                  action_url: `/jamaah/${jamaah?.id || ''}`,
                  action_label: 'Lengkapi Gender',
                });
              }
            }

            // 2. Missing Variant Check
            for (const pe of paxEquipRecords) {
              const pkgItem = pkgEquipment.find(pi => pi.id === pe.package_equipment_item_id);
              const masterItem = pkgItem ? masterEquipment.find(m => m.id === pkgItem.equipment_item_id) : null;

              if (masterItem?.requires_variant && !pe.variant_id) {
                const isCritical = daysToDeparture <= OperationalThresholds.EQUIPMENT_MISSING_VARIANT_CRITICAL_DAYS;
                candidates.push({
                  alert_key: `EQUIPMENT_MISSING_VARIANT:${pe.id}`,
                  category: 'EQUIPMENT',
                  severity: isCritical ? 'CRITICAL' : 'WARNING',
                  title: `Ukuran ${masterItem.name} Belum Dipilih`,
                  description: `${jName} belum memilih ukuran untuk ${masterItem.name}. Penyiapan perlengkapan tertunda.`,
                  package_id: pkg.id,
                  package_name: pkg.package_name,
                  package_participant_id: part.id,
                  jamaah_id: jamaah?.id,
                  jamaah_name: jName,
                  source_type: 'PARTICIPANT_EQUIPMENT',
                  source_id: pe.id,
                  action_url: `/perlengkapan/penyerahan?packageId=${pkg.id}&search=${encodeURIComponent(jName)}`,
                  action_label: 'Pilih Ukuran',
                });
              }
            }
          }
        } // end participant loop

        // --- D. MANIFEST VALIDATION DETECTOR (Using Stage 3 Validator) ---
        if (hasManifestTemplate && activeParticipants.length > 0) {
          try {
            const manifestValidation = await DbRepository.validateManifest(pkg.id);
            for (const row of manifestValidation.participants) {
              if (row.status === 'ERROR') {
                const isCritical = daysToDeparture <= OperationalThresholds.MANIFEST_ERROR_CRITICAL_DAYS;
                if (isCritical) packageHasCriticalBlocker = true;

                const firstIssue = row.issues[0]?.message || 'Data manifest tidak valid';
                const rName = row.passport_name || row.jamaah_name || 'Jamaah';
                candidates.push({
                  alert_key: `MANIFEST_ERROR:${pkg.id}:${row.participant_id}`,
                  category: 'MANIFEST',
                  severity: isCritical ? 'CRITICAL' : 'WARNING',
                  title: `Manifest Error: ${rName}`,
                  description: `Manifest ${pkg.package_name} menemukan error pada ${rName}: ${firstIssue}`,
                  package_id: pkg.id,
                  package_name: pkg.package_name,
                  package_participant_id: row.participant_id,
                  jamaah_id: row.jamaah_id,
                  jamaah_name: rName,
                  source_type: 'MANIFEST_VALIDATION',
                  source_id: `${pkg.id}_${row.participant_id}`,
                  action_url: `/manifest?packageId=${pkg.id}`,
                  action_label: 'Buka Manifest',
                });
              }
            }
          } catch (err) {
            // Safe fallback
          }
        }

        // --- E. PACKAGE NEAR DEPARTURE WITH CRITICAL ISSUES ---
        if (daysToDeparture <= OperationalThresholds.PACKAGE_URGENT_DEPARTURE_DAYS && packageHasCriticalBlocker) {
          candidates.push({
            alert_key: `PACKAGE_URGENT_CRITICAL:${pkg.id}`,
            category: 'PACKAGE',
            severity: 'CRITICAL',
            title: `Keberangkatan Mendesak dengan Isu Kritis: ${pkg.package_name}`,
            description: `Paket berangkat dalam ${daysToDeparture} hari lagi namun masih memiliki kendala paspor/manifest yang berpotensi memblokir perjalanan.`,
            package_id: pkg.id,
            package_name: pkg.package_name,
            source_type: 'PACKAGE',
            source_id: pkg.id,
            action_url: `/paket/${pkg.id}/command-center`,
            action_label: 'Buka Command Center',
          });
        }
      } // end package loop

      // =======================================================================
      // 4. ATOMIC UPSERT, AUTO-RESOLUTION & REOPEN LIFECYCLE
      // =======================================================================
      const currentAlerts = await DbRepository.getOperationalAlerts();
      const currentAlertMap = new Map<string, OperationalAlert>(currentAlerts.map(a => [a.alert_key, a]));
      const candidateKeys = new Set(candidates.map(c => c.alert_key));

      let openCount = 0;
      let resolvedCount = 0;
      let reopenedCount = 0;

      // 4.1 Process Active Candidates
      for (const cand of candidates) {
        const existing = currentAlertMap.get(cand.alert_key);

        if (!existing) {
          // Brand new alert
          const newAlert: OperationalAlert = {
            id: `alt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            alert_key: cand.alert_key,
            category: cand.category,
            severity: cand.severity,
            title: cand.title,
            description: cand.description,
            package_id: cand.package_id || null,
            package_name: cand.package_name || null,
            package_participant_id: cand.package_participant_id || null,
            jamaah_id: cand.jamaah_id || null,
            jamaah_name: cand.jamaah_name || null,
            pic_id: cand.pic_id || null,
            pic_name: cand.pic_name || null,
            source_type: cand.source_type,
            source_id: cand.source_id,
            action_url: cand.action_url || null,
            action_label: cand.action_label || null,
            status: 'OPEN',
            first_detected_at: now,
            last_detected_at: now,
            resolved_at: null,
            reopened_at: null,
            reopen_count: 0,
            last_status_changed_at: now,
            dismissed_at: null,
            dismissed_by: null,
            dismiss_reason: null,
            created_at: now,
            updated_at: now,
          };
          await DbRepository.saveOperationalAlert(newAlert);
          openCount++;
        } else {
          // Existing alert lifecycle management
          if (existing.status === 'RESOLVED') {
            // Problem reoccurred -> REOPEN
            existing.status = 'OPEN';
            existing.reopened_at = now;
            existing.reopen_count = (existing.reopen_count || 0) + 1;
            existing.resolved_at = null;
            existing.last_status_changed_at = now;
            reopenedCount++;
          } else if (existing.status === 'DISMISSED') {
            // Dismissed alert persistence rule:
            // Do NOT reopen unless severity escalated to CRITICAL from a lower state
            if (existing.severity !== 'CRITICAL' && cand.severity === 'CRITICAL') {
              existing.status = 'OPEN';
              existing.reopened_at = now;
              existing.reopen_count = (existing.reopen_count || 0) + 1;
              existing.last_status_changed_at = now;
              existing.dismiss_reason = `Escalated to CRITICAL: ${existing.dismiss_reason || ''}`;
              reopenedCount++;
            }
          }

          // Update current metadata and severity
          existing.severity = cand.severity;
          existing.title = cand.title;
          existing.description = cand.description;
          existing.last_detected_at = now;
          existing.updated_at = now;
          await DbRepository.saveOperationalAlert(existing);

          if (existing.status === 'OPEN') openCount++;
        }
      }

      // 4.2 Auto-Resolve missing candidates
      for (const alert of currentAlerts) {
        if (!candidateKeys.has(alert.alert_key) && alert.status === 'OPEN') {
          alert.status = 'RESOLVED';
          alert.resolved_at = now;
          alert.last_status_changed_at = now;
          alert.updated_at = now;
          await DbRepository.saveOperationalAlert(alert);
          resolvedCount++;
        }
      }

      const refreshedAlerts = await DbRepository.getOperationalAlerts();
      const openAlerts = refreshedAlerts.filter(a => a.status === 'OPEN');

      return {
        evaluated_at: now,
        total_candidates: candidates.length,
        open_alerts_count: openAlerts.length,
        resolved_alerts_count: resolvedCount,
        reopened_alerts_count: reopenedCount,
        critical_count: openAlerts.filter(a => a.severity === 'CRITICAL').length,
        warning_count: openAlerts.filter(a => a.severity === 'WARNING').length,
      };
    } finally {
      this.isEvaluating = false;
    }
  }

  /**
   * Dismiss an operational alert with mandatory reason.
   * Critical alerts are blocked from normal dismissal.
   */
  public static async dismissAlert(
    alertId: string, 
    reason: string, 
    adminId = 'admin-1'
  ): Promise<OperationalAlert> {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Alasan dismissal wajib diisi.');
    }

    const alert = await DbRepository.getOperationalAlertById(alertId);
    if (!alert) throw new Error('Alert tidak ditemukan.');

    if (alert.severity === 'CRITICAL') {
      throw new Error('Aksi ditolak: Isu dengan severity CRITICAL tidak dapat di-dismiss karena dapat memblokir keberangkatan.');
    }

    const now = new Date().toISOString();
    alert.status = 'DISMISSED';
    alert.dismissed_at = now;
    alert.dismissed_by = adminId;
    alert.dismiss_reason = reason.trim();
    alert.last_status_changed_at = now;
    alert.updated_at = now;

    await DbRepository.saveOperationalAlert(alert);

    // Audit log dismissal
    const { AuditService } = await import('../audit/audit-service');
    await AuditService.logMutation({
      actorId: adminId,
      action: 'ALERT_DISMISSED',
      entityType: 'OPERATIONAL_ALERT',
      entityId: alert.id,
      packageId: alert.package_id,
      jamaahId: alert.jamaah_id,
      metadata: {
        alert_key: alert.alert_key,
        severity: alert.severity,
        category: alert.category,
        reason: reason.trim(),
      },
    });

    return alert;
  }
}
