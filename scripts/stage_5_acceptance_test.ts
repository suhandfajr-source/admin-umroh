import { DbRepository } from '../src/lib/repository/db';
import { OperationalAlertEngine } from '../src/lib/intelligence/alert-engine';
import { ReadinessService } from '../src/lib/intelligence/readiness-service';
import { AuditService } from '../src/lib/audit/audit-service';
import { OperationalThresholds, calculateDaysToDeparture, evaluatePassportValidityAgainstDeparture } from '../src/lib/intelligence/thresholds';

async function runStage5AcceptanceSuite() {
  console.log('=== STARTING STAGE 5 INTELLIGENCE ACCEPTANCE TEST SUITE ===\n');
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
  // SETUP TEST DATA
  // ---------------------------------------------------------------------------
  DbRepository.resetStore();

  const now = new Date();
  const depDate40d = new Date(now.getTime() + 40 * 86400000).toISOString().split('T')[0];
  const depDate5d = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0]; // <=7 days -> CRITICAL for finance & passport

  const pkg1 = await DbRepository.createPackage({
    package_name: 'Paket Umroh Syawal 40D',
    departure_date: depDate40d,
    duration_days: 9,
    b2b_price: 25000000,
    selling_price: 30000000,
    quota: 40,
    status: 'OPEN',
  });

  const pkg2 = await DbRepository.createPackage({
    package_name: 'Paket Umroh Ramadhan 5D Urgent',
    departure_date: depDate5d,
    duration_days: 12,
    b2b_price: 35000000,
    selling_price: 40000000,
    quota: 30,
    status: 'OPEN',
  });

  // Setup equipment on pkg1
  await DbRepository.setPackageEquipment(pkg1.id, [
    { equipment_item_id: 'eq_koper', quantity: 1, is_mandatory: true },
    { equipment_item_id: 'eq_batik', quantity: 1, is_mandatory: true },
  ]);

  // Jamaah A (Passport Missing) in Pkg1 (40d -> WARNING)
  const jamA = await DbRepository.createJamaah({
    identity_name: 'Jamaah A Missing Passport',
    phone: '0811111111',
  });
  const partA = await DbRepository.addParticipant(pkg1.id, jamA.id, undefined, undefined, 30000000);

  // Jamaah B (Passport Missing) in Pkg2 (5d -> CRITICAL)
  const jamB = await DbRepository.createJamaah({
    identity_name: 'Jamaah B Urgent Missing Passport',
    phone: '0822222222',
  });
  const partB = await DbRepository.addParticipant(pkg2.id, jamB.id, undefined, undefined, 40000000);

  // Jamaah C (Passport Expired relative to departure) in Pkg1
  const jamC = await DbRepository.createJamaah({
    identity_name: 'Jamaah C Expired Passport',
    passport_name: 'JAMAAH C EXPIRED',
    passport_number: 'C9988776',
    passport_expiry_date: new Date(now.getTime() + 10 * 86400000).toISOString().split('T')[0], // expires before pkg1 departure
    gender: 'MALE',
    phone: '0833333333',
  });
  const partC = await DbRepository.addParticipant(pkg1.id, jamC.id, undefined, undefined, 30000000);

  // Jamaah D (Cancelled Pax) in Pkg1
  const jamD = await DbRepository.createJamaah({
    identity_name: 'Jamaah D Cancelled',
    phone: '0844444444',
  });
  const partD = await DbRepository.addParticipant(pkg1.id, jamD.id, undefined, undefined, 30000000);
  await DbRepository.updateParticipantStatus(partD.id, 'CANCELLED');

  // Unallocated Payment
  const unallocPay = await DbRepository.createPayment({
    payment_date: now.toISOString().split('T')[0],
    amount: 15000000,
    sender_name: 'Hamba Allah Transfer',
    notes: 'DP Umroh belum ada alokasi',
  });

  // ---------------------------------------------------------------------------
  // 1. SCENARIO A & B: EVALUATION & PASSPORT DETECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Evaluating Initial Operational Alerts ---');
  const evalResult1 = await OperationalAlertEngine.evaluate();
  assert(evalResult1.total_candidates > 0, 'Alert Engine evaluates and detects candidates');

  const alerts1 = await DbRepository.getOperationalAlerts({ status: 'OPEN' });
  const alertA = alerts1.find(a => a.alert_key === `PASSPORT_MISSING:${partA.id}`);
  const alertB = alerts1.find(a => a.alert_key === `PASSPORT_MISSING:${partB.id}`);
  const alertC = alerts1.find(a => a.alert_key === `PASSPORT_EXPIRED:${partC.id}`);
  const alertUnalloc = alerts1.find(a => a.alert_key === `PAYMENT_UNALLOCATED:${unallocPay.id}`);

  assert(!!alertA && alertA.severity === 'WARNING', 'Scenario A: Passport missing at 40d departure produces WARNING alert');
  assert(!!alertB && alertB.severity === 'CRITICAL', 'Scenario A2: Passport missing at 5d departure (<30d) produces CRITICAL blocker');
  assert(!!alertC && alertC.severity === 'CRITICAL', 'Scenario B: Passport expiring before departure produces CRITICAL alert');
  assert(!!alertUnalloc && alertUnalloc.severity === 'WARNING', 'Scenario E: Unallocated payment produces FINANCE alert');

  // Cancelled Participant D should NOT generate alerts
  const alertD = alerts1.find(a => a.alert_key.includes(partD.id));
  if (alertD) console.log('Unexpected alert for partD:', alertD.alert_key, alertD.title);
  assert(!alertD, 'Scenario M: Cancelled participant is excluded from operational alerts');

  // ---------------------------------------------------------------------------
  // 2. SCENARIO C: PASSPORT AUTO-RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Passport Auto-Resolution upon Confirmation ---');
  const savedDocA = await DbRepository.saveUploadedDocument(
    jamA.id,
    'PASSPORT',
    'staging/passport_a.jpg',
    'passport_a.jpg',
    'image/jpeg',
    1024,
    {
      fields: {
        passport_name: 'JAMAAH A CONFIRMED',
        passport_number: 'A1234567',
        passport_expiry_date: new Date(now.getTime() + 700 * 86400000).toISOString().split('T')[0],
        gender: 'MALE',
      }
    }
  );

  await DbRepository.confirmDocumentReview(
    savedDocA.document.id,
    'UPDATE_EXISTING',
    jamA.id,
    {
      passport_name: 'JAMAAH A CONFIRMED',
      passport_number: 'A1234567',
      passport_expiry_date: new Date(now.getTime() + 700 * 86400000).toISOString().split('T')[0],
      gender: 'MALE',
    }
  );

  await OperationalAlertEngine.evaluate();
  const alertAAfter = await DbRepository.getOperationalAlertByKey(`PASSPORT_MISSING:${partA.id}`);
  assert(alertAAfter?.status === 'RESOLVED', 'Scenario C: Alert for Jamaah A automatically resolved upon passport confirmation');
  assert(!!alertAAfter?.resolved_at, 'Scenario C2: Auto-resolved alert has resolved_at timestamp');

  // ---------------------------------------------------------------------------
  // 3. SCENARIO D & F: FINANCE ALERTS & AUTO-RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Finance Alerts & Payment Allocation Auto-Resolution ---');
  const invB = await DbRepository.getInvoiceByParticipantId(partB.id);
  const alertFinB = alerts1.find(a => a.alert_key === `FINANCE_OUTSTANDING:${partB.id}`);
  assert(!!alertFinB && alertFinB.severity === 'CRITICAL', 'Scenario D: Outstanding invoice at 5d departure (<=7d) triggers CRITICAL alert');

  // Allocate payment to invoice B
  const payB = await DbRepository.createPayment({
    payment_date: now.toISOString().split('T')[0],
    amount: 40000000,
    sender_name: 'Jamaah B Pelunasan',
  });
  await DbRepository.allocatePayment(payB.id, [{ invoiceId: invB!.id, amount: 40000000 }]);

  await OperationalAlertEngine.evaluate();
  const alertFinBAfter = await DbRepository.getOperationalAlertByKey(`FINANCE_OUTSTANDING:${partB.id}`);
  assert(alertFinBAfter?.status === 'RESOLVED', 'Scenario F: Finance alert automatically resolved after full payment allocation');

  // ---------------------------------------------------------------------------
  // 4. SCENARIO I: EQUIPMENT VARIANT WARNING & AUTO-RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Equipment Missing Variant Warning & Auto-Resolution ---');
  const peA = await DbRepository.getParticipantEquipmentByParticipant(partA.id);
  const peBatik = peA.find(p => p.package_equipment_item?.equipment_item_id === 'eq_batik');
  
  const alertEquipVarA = alerts1.find(a => a.alert_key === `EQUIPMENT_MISSING_VARIANT:${peBatik?.id}`);
  assert(!!alertEquipVarA && alertEquipVarA.severity === 'WARNING', 'Scenario I: Missing batik apparel variant triggers EQUIPMENT alert');

  // Set variant for Part A
  if (peBatik) {
    await DbRepository.updateParticipantEquipmentVariant(peBatik.id, 'var_batik_l');
  }

  await OperationalAlertEngine.evaluate();
  const alertEquipVarAAfter = await DbRepository.getOperationalAlertByKey(`EQUIPMENT_MISSING_VARIANT:${peBatik?.id}`);
  assert(alertEquipVarAAfter?.status === 'RESOLVED', 'Scenario I2: Equipment missing variant alert auto-resolves when variant is selected');

  // ---------------------------------------------------------------------------
  // 5. SCENARIO N, O, P: DISMISSAL RULES & CRITICAL PROTECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Dismissal Rules & Critical Protection ---');
  // Attempt to dismiss critical alert (alertC: PASSPORT_EXPIRED)
  let criticalDismissFailed = false;
  try {
    await OperationalAlertEngine.dismissAlert(alertC!.id, 'Biarin aja dulu', 'admin-1');
  } catch (err: any) {
    criticalDismissFailed = true;
    assert(err.message.includes('Aksi ditolak: Isu dengan severity CRITICAL tidak dapat di-dismiss'), 'Scenario O: Critical alert dismissal is strictly rejected');
  }
  assert(criticalDismissFailed, 'Scenario O2: Critical alert remains non-dismissible');

  // Dismiss non-critical alert (alertUnalloc: PAYMENT_UNALLOCATED)
  const dismissedAlert = await OperationalAlertEngine.dismissAlert(alertUnalloc!.id, 'Akan dialokasikan besok setelah konfirmasi PIC', 'admin-1');
  assert(dismissedAlert.status === 'DISMISSED', 'Scenario N: Non-critical alert successfully dismissed with reason');
  assert(dismissedAlert.dismiss_reason === 'Akan dialokasikan besok setelah konfirmasi PIC', 'Scenario N2: Dismiss reason is recorded in the alert');

  // Run evaluation again: Dismissed alert must NOT immediately reopen if condition is unchanged
  await OperationalAlertEngine.evaluate();
  const alertUnallocRecheck = await DbRepository.getOperationalAlertById(alertUnalloc!.id);
  assert(alertUnallocRecheck?.status === 'DISMISSED', 'Scenario P: Dismissed alert stays DISMISSED on next evaluation when condition is unchanged');

  // ---------------------------------------------------------------------------
  // 6. SCENARIO R: RE-EMERGENCE & REOPEN_COUNT
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Re-emergence Lifecycle & Reopen Count ---');
  // Unconfirm / Remove passport of Jamaah A
  await DbRepository.updateJamaah(jamA.id, { passport_name: null, passport_number: null });
  await OperationalAlertEngine.evaluate();

  const alertAReopened = await DbRepository.getOperationalAlertByKey(`PASSPORT_MISSING:${partA.id}`);
  assert(alertAReopened?.status === 'OPEN', 'Scenario R: Re-emergent issue reopens the existing alert record');
  assert(alertAReopened?.reopen_count === 1, 'Scenario R2: Reopen count is incremented to 1');
  assert(!!alertAReopened?.reopened_at, 'Scenario R3: reopened_at timestamp is recorded');

  // ---------------------------------------------------------------------------
  // 7. SCENARIO L & M: READINESS SERVICE DYNAMIC N/A FORMULA
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Dynamic Readiness Formula & N/A Dimension Handling ---');
  // Pkg2 has no equipment configured -> Equipment is NOT_APPLICABLE
  const pkg2Readiness = await ReadinessService.getPackageReadiness(pkg2.id);
  assert(pkg2Readiness.dimensions.equipment.is_applicable === false, 'Scenario L: Package 2 has equipment dimension marked NOT_APPLICABLE');
  assert(pkg2Readiness.dimensions.equipment.status === 'NOT_APPLICABLE', 'Scenario L2: Equipment status is NOT_APPLICABLE');
  
  // Overall percentage must only average applicable dimensions
  assert(typeof pkg2Readiness.overall_readiness_percentage === 'number' && pkg2Readiness.overall_readiness_percentage >= 0, 'Scenario L3: Overall percentage computed cleanly without NaN');
  assert(pkg2Readiness.total_active_participants === 1, 'Scenario M2: Active pax count accurately reflects 1 (excluding cancelled Pax D)');

  // ---------------------------------------------------------------------------
  // 8. SCENARIO S: PARTICIPANT READINESS TRIP ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Repeat Traveler Trip Isolation ---');
  // Add Jam A to Pkg2 (repeat traveler)
  const partA2 = await DbRepository.addParticipant(pkg2.id, jamA.id, undefined, undefined, 40000000);

  const readA1 = await ReadinessService.getParticipantReadiness(partA.id);
  const readA2 = await ReadinessService.getParticipantReadiness(partA2.id);

  assert(readA1.package_id === pkg1.id && readA2.package_id === pkg2.id, 'Scenario S: Repeat traveler has distinct trip readiness for each package');
  assert(readA1.participant_id !== readA2.participant_id, 'Scenario S2: Participant readiness is trip-isolated by package_participant_id');

  // ---------------------------------------------------------------------------
  // 9. SCENARIO U, V, W: AUDIT TRAIL, SANITIZATION, HARD DELETE PROTECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. Audit Trail, Sanitization & Non-Destructive Integrity ---');
  const auditLogs = await DbRepository.getAuditLogs();
  assert(auditLogs.length > 0, 'Audit logs recorded across mutations');

  // Test sanitization
  const testSanitized = await AuditService.logMutation({
    action: 'TEST_SECRET_ACTION',
    entityType: 'TEST',
    entityId: 'test-1',
    metadata: {
      password: 'SuperSecretPassword123',
      api_key: 'sk_live_1234567890',
      token: 'jwt.token.here',
      safe_field: 'safe_value',
    }
  });

  assert(testSanitized.metadata.password === '[REDACTED]', 'Scenario W: Password field is sanitized to [REDACTED]');
  assert(testSanitized.metadata.api_key === '[REDACTED]', 'Scenario W2: API key field is sanitized to [REDACTED]');
  assert(testSanitized.metadata.safe_field === 'safe_value', 'Scenario W3: Non-sensitive fields are preserved');

  // Test Hard Delete Protection on Audit Logs
  let auditDeleteBlocked = false;
  try {
    await DbRepository.deleteAuditLog(testSanitized.id);
  } catch (err: any) {
    auditDeleteBlocked = true;
    assert(err.message.includes('Hard delete dilarang: Audit logs bersifat append-only'), 'Scenario U: Direct hard delete of audit log is blocked');
  }
  assert(auditDeleteBlocked, 'Scenario U2: Audit log hard delete error thrown');

  // Test Hard Delete Protection on Operational Alerts
  let alertDeleteBlocked = false;
  try {
    await DbRepository.deleteOperationalAlert(alertA!.id);
  } catch (err: any) {
    alertDeleteBlocked = true;
    assert(err.message.includes('Hard delete dilarang: Operational alerts bersifat non-destruktif'), 'Scenario V: Direct hard delete of operational alert is blocked');
  }
  assert(alertDeleteBlocked, 'Scenario V2: Operational alert hard delete error thrown');

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(`STAGE 5 ACCEPTANCE TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage5AcceptanceSuite().catch(err => {
  console.error('Fatal error in acceptance suite:', err);
  process.exit(1);
});
