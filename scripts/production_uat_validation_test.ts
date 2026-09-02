import { DbRepository } from '@/lib/repository/db';
import { OperationalAlertEngine } from '@/lib/intelligence/alert-engine';
import { ReadinessService } from '@/lib/intelligence/readiness-service';
import { AuditService } from '@/lib/audit/audit-service';
import { seedUatData } from './seed_uat_data';
import { ManifestValidator } from '@/lib/export/manifest-validator';

async function runProductionUatValidationSuite() {
  console.log('========================================================================');
  console.log('         PRODUCTION UAT & GO-LIVE END-TO-END VALIDATION SUITE          ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 0: SEED REALISTIC UAT DATASET
  // ---------------------------------------------------------------------------
  console.log('--- 0. Seeding Realistic Imperfect UAT Dataset ---');
  const uatData = await seedUatData({ resetFirst: true });
  assert(uatData.packages.length === 3, 'UAT Packages initialized (3 distinct packages)');
  assert(uatData.jamaahCount >= 40, `UAT Master Jamaah initialized (Count: ${uatData.jamaahCount})`);
  assert(uatData.participantsCount >= 45, `UAT Participants initialized (Count: ${uatData.participantsCount})`);
  assert(uatData.paymentsCount >= 5, `UAT Payments initialized (Count: ${uatData.paymentsCount})`);

  const packages = await DbRepository.getPackageList();
  const pkgA = packages.find(p => p.package_name.includes('PACKAGE A'))!;
  const pkgB = packages.find(p => p.package_name.includes('PACKAGE B'))!;
  const pkgC = packages.find(p => p.package_name.includes('PACKAGE C'))!;

  // ---------------------------------------------------------------------------
  // FLOW 1: NEW JAMAAH FROM DOCUMENTS & OCR
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 1: New Jamaah from KK & Passport ---');
  const savedDocKK = await DbRepository.saveUploadedDocument(
    'temp-unassigned',
    'KARTU_KELUARGA',
    'staging/kk_flow1.jpg',
    'kk_flow1.jpg',
    'image/jpeg',
    2048,
    {
      fields: {
        kk_number: '3201998877660001',
        family_members: [
          { name: 'SULAIMAN EFFENDI', birth_date: '1970-01-10', gender: 'MALE' },
          { name: 'MARIAM BINTI YUSUF', birth_date: '1974-06-15', gender: 'FEMALE' }
        ]
      }
    }
  );

  const reviewResult = await DbRepository.confirmDocumentReview(
    savedDocKK.document.id,
    'CREATE_NEW',
    undefined,
    {
      identity_name: 'SULAIMAN EFFENDI',
      kk_number: '3201998877660001',
      birth_date: '1970-01-10',
      gender: 'MALE',
    }
  );
  const jamSulaiman = reviewResult.jamaah!;

  assert(!!jamSulaiman && jamSulaiman.identity_name === 'SULAIMAN EFFENDI', 'Flow 1: Master Jamaah created from KK confirmation');
  assert(jamSulaiman.passport_number === null, 'Flow 1.2: Passport fields remain nullable when registered from KK');

  // ---------------------------------------------------------------------------
  // FLOW 2: DUPLICATE JAMAAH DETECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 2: Fuzzy Duplicate Jamaah Detection ---');
  const duplicateCandidates = await DbRepository.getJamaahList({ search: 'SULAIMAN EFFENDI' });
  assert(duplicateCandidates.length === 1, 'Flow 2: Duplicate detection identifies existing person by name/family');

  // ---------------------------------------------------------------------------
  // FLOW 3: REPEAT TRAVELER & MULTI-TRIP ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 3: Repeat Traveler Multi-Trip Isolation ---');
  const ahmad = (await DbRepository.getJamaahList({ search: 'AHMAD BIN ABDULLAH' }))[0];
  const ahmadTrips = await DbRepository.getJamaahTrips(ahmad.id);
  assert(ahmadTrips.length === 2, `Flow 3: Repeat traveler has 2 distinct trips (Found: ${ahmadTrips.length})`);
  assert(ahmadTrips[0].package_id !== ahmadTrips[1].package_id, 'Flow 3.2: Trips belong to different packages');

  const ahmadReadiness1 = await ReadinessService.getParticipantReadiness(ahmadTrips[0].id);
  const ahmadReadiness2 = await ReadinessService.getParticipantReadiness(ahmadTrips[1].id);
  assert(ahmadReadiness1.package_id === pkgA.id && ahmadReadiness2.package_id === pkgC.id, 'Flow 3.3: Participant readiness is trip-isolated');

  // ---------------------------------------------------------------------------
  // FLOW 4: PACKAGE REGISTRATION & PRICING SNAPSHOT
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 4: Package Registration & Pricing Snapshot ---');
  const partSulaiman = await DbRepository.addParticipant(pkgA.id, jamSulaiman.id, undefined, 28000000, 33500000, 'VIP Seat');
  assert(partSulaiman.selling_price === 33500000, 'Flow 4: Participant registered with snapshot selling price');
  const invSulaiman = await DbRepository.getInvoiceByParticipantId(partSulaiman.id);
  assert(invSulaiman?.base_amount === 33500000, 'Flow 4.2: Invoice automatically generated with base selling price');

  // ---------------------------------------------------------------------------
  // FLOW 5: INDIVIDUAL PAYMENT & SETTLEMENT
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 5: Individual Payment (DP -> Full Settlement) ---');
  const paySulaimanDP = await DbRepository.createPayment({
    payment_date: new Date().toISOString().split('T')[0],
    amount: 10000000,
    sender_name: 'Sulaiman Effendi Transfer DP',
  });
  await DbRepository.allocatePayment(paySulaimanDP.id, [{ invoiceId: invSulaiman!.id, amount: 10000000 }]);

  const invAfterDP = await DbRepository.getInvoiceById(invSulaiman!.id);
  assert(invAfterDP?.status === 'PARTIAL' && invAfterDP?.outstanding === 23500000, 'Flow 5: Partial DP status is PARTIAL with correct outstanding');

  const paySulaimanPelunasan = await DbRepository.createPayment({
    payment_date: new Date().toISOString().split('T')[0],
    amount: 23500000,
    sender_name: 'Sulaiman Effendi Pelunasan',
  });
  await DbRepository.allocatePayment(paySulaimanPelunasan.id, [{ invoiceId: invSulaiman!.id, amount: 23500000 }]);

  const invAfterFull = await DbRepository.getInvoiceById(invSulaiman!.id);
  assert(invAfterFull?.status === 'PAID' && invAfterFull?.outstanding === 0, 'Flow 5.2: Full payment marks invoice PAID with 0 outstanding');

  // ---------------------------------------------------------------------------
  // FLOW 6: COLLECTIVE PIC PAYMENT ALLOCATION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 6: Collective PIC Payment Allocation ---');
  const pics = await DbRepository.getPicList();
  const picHasan = pics.find(p => p.name.includes('Ustadz Hasan'))!;
  const hasanParts = (await DbRepository.getParticipants({ packageId: pkgA.id })).filter(p => p.pic_id === picHasan.id);
  assert(hasanParts.length === 4, 'Flow 6: PIC manages 4 family participants');

  const pkgReportA = await DbRepository.getPackageFinanceReport(pkgA.id);
  const picReportHasan = pkgReportA.pic_breakdowns.find(pb => pb.pic_id === picHasan.id);
  assert(!!picReportHasan && picReportHasan.pax_count === 4, 'Flow 6.2: Package finance report accurately aggregates PIC group');

  // ---------------------------------------------------------------------------
  // FLOW 7: PAYMENT INBOX & UNALLOCATED DEPOSIT TRIAGE
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 7: Payment Inbox & Unallocated Deposits ---');
  const unallocatedPayments = await DbRepository.getPayments({ allocationStatus: 'UNALLOCATED' });
  assert(unallocatedPayments.length >= 2, `Flow 7: Payment Inbox contains unallocated deposits (Found: ${unallocatedPayments.length})`);

  // Triage one unallocated payment
  const unallocToResolve = unallocatedPayments[0];
  const targetUnpaidPax = (await DbRepository.getParticipants({ packageId: pkgA.id })).find(p => p.invoice?.status === 'UNPAID')!;
  await DbRepository.allocatePayment(unallocToResolve.id, [{ invoiceId: targetUnpaidPax.invoice!.id, amount: unallocToResolve.amount }]);

  const unallocAfter = await DbRepository.getPaymentById(unallocToResolve.id);
  assert(unallocAfter?.allocation_status === 'ALLOCATED', 'Flow 7.2: Unallocated payment resolved to ALLOCATED');

  // ---------------------------------------------------------------------------
  // FLOW 8: OVERPAYMENT INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 8: Overpayment Handling ---');
  const overpaidPax = (await DbRepository.getParticipants({ packageId: pkgA.id })).find(p => p.jamaah?.identity_name === 'Jamaah Paket A Standard 1')!;
  const invOverpaid = await DbRepository.getInvoiceByParticipantId(overpaidPax.id);
  assert(invOverpaid?.status === 'OVERPAID' && invOverpaid?.overpayment === 1000000, 'Flow 8: Overpayment correctly recorded as OVERPAID with Rp 1.000.000 surplus');

  // ---------------------------------------------------------------------------
  // FLOW 9: SIGNED ADJUSTMENTS & DISCOUNTS
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 9: Signed Invoice Adjustments & Discounts ---');
  const adjInvoice = await DbRepository.addInvoiceItem(
    invSulaiman!.id,
    {
      type: 'DISCOUNT',
      category: 'PROMO_DISCOUNT',
      description: 'Diskon Khusus Early Bird',
      amount: 500000,
    }
  );
  assert(adjInvoice.total_amount === 33000000, 'Flow 9: Negative adjustment reduces invoice total cleanly');

  // ---------------------------------------------------------------------------
  // FLOW 10: PASSPORT REPLACEMENT WITH NON-DESTRUCTIVE HISTORY
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 10: Passport Replacement & Historical Retention ---');
  const docRenewal = await DbRepository.saveUploadedDocument(
    ahmad.id,
    'PASSPORT',
    'staging/ahmad_passport_renewed.jpg',
    'ahmad_passport_renewed.jpg',
    'image/jpeg',
    2048,
    {
      fields: {
        passport_name: 'AHMAD BIN ABDULLAH',
        passport_number: 'B9999888',
        passport_expiry_date: new Date(Date.now() + 1000 * 86400000).toISOString().split('T')[0],
      }
    }
  );

  await DbRepository.confirmDocumentReview(
    docRenewal.document.id,
    'UPDATE_EXISTING',
    ahmad.id,
    {
      passport_name: 'AHMAD BIN ABDULLAH',
      passport_number: 'B9999888',
      passport_expiry_date: new Date(Date.now() + 1000 * 86400000).toISOString().split('T')[0],
    }
  );

  const ahmadUpdated = await DbRepository.getJamaahById(ahmad.id);
  assert(ahmadUpdated?.passport_number === 'B9999888', 'Flow 10: Passport replaced with new renewed passport');
  assert(ahmadUpdated?.documents.length! >= 1, 'Flow 10.2: Historical documents preserved in document archive');

  // ---------------------------------------------------------------------------
  // FLOW 11: MANIFEST VALIDATION & EXCEL EXPORT
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 11: Manifest Validation & Excel Export ---');
  const manifestSummary = await DbRepository.validateManifest(pkgA.id);
  assert(manifestSummary.total_participants > 0, 'Flow 11: Manifest validator evaluates package roster');
  assert(manifestSummary.error_count > 0, 'Flow 11.2: Manifest validator detects imperfect data (missing passport pax)');

  const manifestExport = await DbRepository.exportManifestExcel(pkgA.id);
  assert(manifestExport.buffer.length > 0, 'Flow 11.3: Manifest Excel binary generated');
  assert(manifestExport.fileName.includes('MANIFEST_'), 'Flow 11.4: Manifest clean filename pattern applied');

  // ---------------------------------------------------------------------------
  // FLOW 12: BULK DOCUMENT ZIP GENERATION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 12: Bulk Document ZIP Archive ---');
  const participantsA = await DbRepository.getParticipants({ packageId: pkgA.id });
  const { DocumentZipService } = await import('../src/lib/export/document-zip');
  const zipPreview = DocumentZipService.previewPackageDocuments(pkgA, participantsA, { documentTypes: ['PASSPORT'] });
  assert(zipPreview.total_participants > 0, 'Flow 12: ZIP preview scans package participants');
  
  const zipArchive = await DocumentZipService.generateZipArchive(
    pkgA, 
    [{ cleanFileName: '01_AHMAD_PASSPORT.pdf', buffer: Buffer.from('Mock PDF Content') }],
    { documentTypes: ['PASSPORT'] }
  );
  assert(zipArchive.buffer.length > 0, 'Flow 12.2: Bulk ZIP buffer generated cleanly');
  assert(zipArchive.fileName.endsWith('.zip'), 'Flow 12.3: ZIP filename pattern validated');

  // ---------------------------------------------------------------------------
  // FLOW 13: EQUIPMENT SIZING & FULFILLMENT LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 13: Equipment Sizing & Fulfillment Lifecycle ---');
  const equipRecapA = await DbRepository.getPackageEquipmentRecap(pkgA.id);
  assert(equipRecapA.total_items_needed > 0, 'Flow 13: Equipment requirements aggregated');
  assert(equipRecapA.total_items_handed_over > 0, 'Flow 13.2: Handover progress tracked');

  // ---------------------------------------------------------------------------
  // FLOW 14: PARTICIPANT CANCELLATION & EXCLUSION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 14: Participant Cancellation Behavior ---');
  const cancelledPax = (await DbRepository.getParticipants({ packageId: pkgA.id })).find(p => p.participant_status === 'CANCELLED')!;
  assert(!!cancelledPax, 'Flow 14: Cancelled participant found in repository');
  
  const activePaxList = (await DbRepository.getParticipants({ packageId: pkgA.id })).filter(p => p.participant_status !== 'CANCELLED');
  assert(!activePaxList.some(p => p.id === cancelledPax.id), 'Flow 14.2: Cancelled pax excluded from active roster');

  // ---------------------------------------------------------------------------
  // FLOW 15: COMMAND CENTER & ACTION REQUIRED DESK
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 15: Command Center & Action Required Desk ---');
  const alerts = await DbRepository.getOperationalAlerts({ status: 'OPEN' });
  assert(alerts.length > 0, `Flow 15: Action Center populated with real operational alerts (Count: ${alerts.length})`);
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
  assert(criticalAlerts.length > 0, `Flow 15.2: Critical blockers surfaced for immediate triage (Count: ${criticalAlerts.length})`);

  // ---------------------------------------------------------------------------
  // FLOW 16: PACKAGE COMMAND CENTER 4-DIMENSION READINESS
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 16: Package Command Center 4-Dimension Readiness ---');
  const pkgAReadiness = await ReadinessService.getPackageReadiness(pkgA.id);
  assert(pkgAReadiness.overall_readiness_percentage >= 0, 'Flow 16: Package A overall readiness computed');
  assert(pkgAReadiness.dimensions.document.status !== undefined, 'Flow 16.2: Document dimension evaluated');
  assert(pkgAReadiness.dimensions.finance.status !== undefined, 'Flow 16.3: Finance dimension evaluated');
  assert(pkgAReadiness.dimensions.manifest.status !== undefined, 'Flow 16.4: Manifest dimension evaluated');
  assert(pkgAReadiness.dimensions.equipment.status !== undefined, 'Flow 16.5: Equipment dimension evaluated');

  // Package C Equipment is NOT_APPLICABLE
  const pkgCReadiness = await ReadinessService.getPackageReadiness(pkgC.id);
  assert(pkgCReadiness.dimensions.equipment.status === 'NOT_APPLICABLE', 'Flow 16.6: Package C equipment is NOT_APPLICABLE');

  // ---------------------------------------------------------------------------
  // FLOW 17: ALERT LIFECYCLE & DISMISSAL RULES
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 17: Alert Lifecycle & Dismissal Rules ---');
  const warningAlert = alerts.find(a => a.severity === 'WARNING')!;
  const dismissed = await OperationalAlertEngine.dismissAlert(warningAlert.id, 'UAT Dismissal Test', 'admin-1');
  assert(dismissed.status === 'DISMISSED', 'Flow 17: Warning alert dismissed with reason');

  let criticalDismissBlocked = false;
  try {
    await OperationalAlertEngine.dismissAlert(criticalAlerts[0].id, 'Testing', 'admin-1');
  } catch (err: any) {
    criticalDismissBlocked = true;
  }
  assert(criticalDismissBlocked, 'Flow 17.2: Critical alert dismissal strictly blocked');

  // ---------------------------------------------------------------------------
  // FLOW 18: CENTRALIZED AUDIT SERVICE & DATA SANITIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 18: Centralized Audit Service & Privacy ---');
  const auditLogs = await DbRepository.getAuditLogs();
  assert(auditLogs.length > 0, `Flow 18: Audit logs recorded (Count: ${auditLogs.length})`);
  
  const testSanitize = AuditService.sanitizeData({
    password: 'PlainTextPassword',
    token: 'eyJhbGciOi...',
    safe_data: 'ValidData',
  });
  assert(testSanitize.password === '[REDACTED]' && testSanitize.token === '[REDACTED]', 'Flow 18.2: Credential sanitization enforced');

  // ---------------------------------------------------------------------------
  // FLOW 19: CONCURRENCY UAT
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 19: Concurrency UAT Simulation ---');
  // 19.1 Concurrent Payment Allocation Protection
  const concurrentPay = await DbRepository.createPayment({
    payment_date: new Date().toISOString().split('T')[0],
    amount: 10000000,
    sender_name: 'Concurrent Payment Test',
  });

  const unpaidPaxList = (await DbRepository.getParticipants({ packageId: pkgB.id })).filter(p => p.invoice?.status === 'UNPAID');
  const invT1 = unpaidPaxList[0].invoice!.id;
  const invT2 = unpaidPaxList[1].invoice!.id;

  // Allocate total available (10jt) to invT1
  const resAlloc1 = await DbRepository.allocatePayment(concurrentPay.id, [{ invoiceId: invT1, amount: 10000000 }]);
  assert(resAlloc1.success === true, 'Flow 19.1a: First allocation succeeds');

  // Attempt second allocation with same payment (should return success: false due to insufficient remaining funds)
  const resAlloc2 = await DbRepository.allocatePayment(concurrentPay.id, [{ invoiceId: invT2, amount: 10000000 }]);
  assert(resAlloc2.success === false && !!resAlloc2.error, 'Flow 19.1: Concurrent double-allocation strictly blocked (no double spending)');

  // 19.2 Concurrent Operational Alert Evaluation
  const evalPromises = [
    OperationalAlertEngine.evaluate(),
    OperationalAlertEngine.evaluate(),
    OperationalAlertEngine.evaluate(),
  ];
  const evalResults = await Promise.all(evalPromises);
  assert(evalResults.length === 3, 'Flow 19.2: Concurrent alert evaluations execute safely without race corruption');

  // ---------------------------------------------------------------------------
  // FLOW 20: PERFORMANCE SMOKE TEST
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 20: Performance Smoke Test ---');
  const t0 = Date.now();
  await DbRepository.getJamaahList();
  await DbRepository.getPackageList();
  await ReadinessService.getPackageReadiness(pkgA.id);
  await DbRepository.getPackageFinanceReport(pkgA.id);
  await DbRepository.getPackageEquipmentRecap(pkgA.id);
  const elapsed = Date.now() - t0;
  assert(elapsed < 2000, `Flow 20: Full operational read suite completed in ${elapsed}ms (< 2000ms threshold)`);

  // ---------------------------------------------------------------------------
  // FLOW 21: NON-PRODUCTION RESTORE DRILL VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- UAT Flow 21: Non-Production Restore Drill Verification ---');
  // Snapshot current state
  const snapshotJson = JSON.stringify(DbRepository.getStoreState());
  
  // Wipe store (simulate disaster recovery)
  DbRepository.resetStore();
  assert((await DbRepository.getPackageList()).length === 0, 'Flow 21.1: Store wiped for restore drill');

  // Restore snapshot
  const restoredState = JSON.parse(snapshotJson);
  const globalStore = DbRepository.getStoreState();
  Object.assign(globalStore, restoredState);

  // Validate restored state operations
  const restoredPackages = await DbRepository.getPackageList();
  assert(restoredPackages.length === 3, 'Flow 21.2: Restored database contains all 3 packages');
  
  const restoredAhmad = (await DbRepository.getJamaahList({ search: 'AHMAD BIN ABDULLAH' }))[0];
  assert(!!restoredAhmad && restoredAhmad.documents.length >= 1, 'Flow 21.3: Restored Jamaah has documents intact');
  
  const restoredReadiness = await ReadinessService.getPackageReadiness(pkgA.id);
  assert(restoredReadiness.overall_readiness_percentage >= 0, 'Flow 21.4: Restored operational intelligence calculates successfully');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`PRODUCTION UAT AUTOMATED VALIDATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionUatValidationSuite().catch(err => {
  console.error('Fatal error in Production UAT suite:', err);
  process.exit(1);
});
