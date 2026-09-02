import { DbRepository } from '../src/lib/repository/db';
import { ManifestValidator } from '../src/lib/export/manifest-validator';
import { ManifestGenerator } from '../src/lib/export/manifest-generator';
import { FinanceExportService } from '../src/lib/export/finance-export';
import { PaymentExportService } from '../src/lib/export/payment-export';
import { ExportCleanupService } from '../src/lib/export/cleanup-service';
import { CleanupScheduler } from '../src/lib/export/cleanup-scheduler';
import { verifyAdminAuth } from '../src/lib/auth/guard';
import ExcelJS from 'exceljs';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runFinalStage3Validation() {
  console.log('\n========================================================================');
  console.log('🔬 EXECUTING FINAL STAGE 3 VALIDATION TESTS');
  console.log('========================================================================\n');

  DbRepository.resetStore();

  // ---------------------------------------------------------------------------
  // 1. MANIFEST PASSPORT NAME STRICTNESS & NO-FALLBACK TEST
  // ---------------------------------------------------------------------------
  console.log('--- 1. MANIFEST PASSPORT NAME STRICTNESS (NO FALLBACK TO IDENTITY_NAME) ---');

  const pkgStrict = await DbRepository.createPackage({
    package_name: 'Paket Umrah Strict Test',
    departure_date: '2026-11-20',
    return_date: '2026-12-02',
    quota: 20,
  });

  // Jamaah without passport_name (only identity_name)
  const jNoPassportName = await DbRepository.createJamaah({
    identity_name: 'BAMBANG HERMANTO (KTP)',
    ktp_name: 'Bambang Hermanto',
    passport_name: null, // NULL
    passport_number: 'B1122334',
    gender: 'MALE',
    birth_date: '1980-05-15',
    passport_expiry_date: '2030-05-15',
  });

  // Jamaah with valid passport_name
  const jValidPassport = await DbRepository.createJamaah({
    identity_name: 'Ahmad Abdullah (KTP)',
    passport_name: 'AHMAD ABDULLAH',
    passport_number: 'A9988776',
    gender: 'MALE',
    birth_place: 'JAKARTA',
    birth_date: '1985-02-10',
    passport_issue_place: 'JAKARTA',
    passport_issue_date: '2022-01-15',
    passport_expiry_date: '2032-01-15',
  });

  await DbRepository.saveDocument({
    jamaah_id: jValidPassport.id,
    document_type: 'PASSPORT',
    storage_path: `documents/${jValidPassport.id}/passport.pdf`,
    original_file_name: 'scan_paspor_ahmad.pdf',
    status: 'CONFIRMED',
    is_current: true,
  });

  const partNoName = await DbRepository.addParticipant(pkgStrict.id, jNoPassportName.id, null, 25000000, 30000000);
  const partValid = await DbRepository.addParticipant(pkgStrict.id, jValidPassport.id, null, 25000000, 30000000);

  // Validate Manifest
  const valResult = await DbRepository.validateManifest(pkgStrict.id);
  const partNoNameVal = valResult.participants.find(p => p.participant_id === partNoName.id);
  const partValidVal = valResult.participants.find(p => p.participant_id === partValid.id);

  assert(
    partNoNameVal?.status === 'ERROR' &&
    partNoNameVal.issues.some(i => i.field === 'passport_name' && i.severity === 'ERROR'),
    '1.1: Manifest validation returns ERROR when passport_name is NULL'
  );

  assert(
    partNoNameVal?.mapped_values.passport_name === '',
    '1.2: Mapped values for missing passport_name is empty (does NOT fallback to identity_name)'
  );

  assert(
    partValidVal?.status === 'READY' &&
    partValidVal.mapped_values.passport_name === 'AHMAD ABDULLAH',
    '1.3: Valid participant with passport_name passes validation as READY'
  );

  // Export Manifest and verify XLSX content cell does not contain KTP name
  const manifestOut = await DbRepository.exportManifestExcel(pkgStrict.id);
  const wbManifest = new ExcelJS.Workbook();
  await wbManifest.xlsx.load(manifestOut.buffer as any);
  const wsManifest = wbManifest.worksheets[0];

  const cellPart1Name = wsManifest.getCell('B5').value;
  const cellPart2Name = wsManifest.getCell('B6').value;

  assert(
    cellPart1Name !== 'BAMBANG HERMANTO (KTP)' && cellPart1Name === '',
    '1.4: Manifest XLSX cell B5 does NOT substitute identity_name ("BAMBANG HERMANTO (KTP)")'
  );
  assert(
    cellPart2Name === 'AHMAD ABDULLAH',
    '1.5: Manifest XLSX cell B6 contains exact passport_name'
  );

  // ---------------------------------------------------------------------------
  // 2. EXCEL DATE COMPATIBLE CELL TYPE VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. EXCEL REAL DATE CELL VALIDATION ---');

  // Check Birth Date, Issue Date, Expiry Date in Manifest Sheet
  const cellBirthDate = wsManifest.getCell('F6'); // Ahmad birth_date: 1985-02-10
  const cellExpiryDate = wsManifest.getCell('I6'); // Ahmad expiry: 2032-01-15

  assert(
    cellBirthDate.value instanceof Date,
    `2.1: Manifest Birth Date cell value is an authentic JS Date object (${cellBirthDate.value?.toString()})`
  );
  assert(
    cellBirthDate.numFmt === 'yyyy-mm-dd',
    `2.2: Manifest Birth Date cell has Excel date format "yyyy-mm-dd"`
  );
  assert(
    cellExpiryDate.value instanceof Date && cellExpiryDate.numFmt === 'yyyy-mm-dd',
    '2.3: Manifest Passport Expiry Date cell is an authentic Excel Date object'
  );

  // Check Package Finance Excel Dates (Departure Date & Return Date)
  const finOut = await DbRepository.exportPackageFinanceExcel(pkgStrict.id);
  const wbFin = new ExcelJS.Workbook();
  await wbFin.xlsx.load(finOut.buffer as any);
  const wsFinSummary = wbFin.getWorksheet('Ringkasan Paket');

  const cellDepDate = wsFinSummary?.getCell('B4'); // Departure date: 2026-11-20
  const cellRetDate = wsFinSummary?.getCell('B5'); // Return date: 2026-12-02

  assert(
    cellDepDate?.value instanceof Date && cellDepDate.numFmt === 'yyyy-mm-dd',
    '2.4: Finance Report Departure Date cell is an authentic Excel Date object'
  );
  assert(
    cellRetDate?.value instanceof Date && cellRetDate.numFmt === 'yyyy-mm-dd',
    '2.5: Finance Report Return Date cell is an authentic Excel Date object'
  );

  // Check Payment History Excel Date (Payment Date)
  const pay1 = await DbRepository.createPayment({
    amount: 15000000,
    payment_date: '2026-08-26',
    sender_name: 'Ahmad Abdullah',
    sender_bank: 'BSI',
  });

  const payOut = await DbRepository.exportPaymentsExcel();
  const wbPay = new ExcelJS.Workbook();
  await wbPay.xlsx.load(payOut.buffer as any);
  const wsPay = wbPay.getWorksheet('Riwayat Pembayaran');
  const cellPayDate = wsPay?.getCell('B4'); // Payment date: 2026-08-26

  assert(
    cellPayDate?.value instanceof Date && cellPayDate.numFmt === 'yyyy-mm-dd',
    '2.6: Payment Report Payment Date cell is an authentic Excel Date object'
  );

  // ---------------------------------------------------------------------------
  // 3. EXPORT TTL CLEANUP & PHYSICAL STORAGE REMOVAL
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. EXPORT TTL CLEANUP & PHYSICAL STORAGE DELETION ---');

  const mockStorage = new Set<string>([
    'exports/active_report.xlsx',
    'exports/expired_manifest_1.xlsx',
    'exports/expired_zip_2.zip',
    'staging/doc_rejected_old.pdf',
    'staging/doc_abandoned_48h.jpg',
    'jamaah/confirmed_passport.pdf',
  ]);

  const testJobs = [
    { id: 'exp_active', storage_path: 'exports/active_report.xlsx', expires_at: new Date(Date.now() + 86400000).toISOString(), status: 'COMPLETED' },
    { id: 'exp_expired_1', storage_path: 'exports/expired_manifest_1.xlsx', expires_at: new Date(Date.now() - 3600000).toISOString(), status: 'COMPLETED' },
    { id: 'exp_expired_2', storage_path: 'exports/expired_zip_2.zip', expires_at: new Date(Date.now() - 7200000).toISOString(), status: 'EXPIRED' },
  ];

  const testDocs = [
    // Stale rejected upload (> 24h old)
    { id: 'doc_rej', storage_path: 'staging/doc_rejected_old.pdf', uploaded_at: new Date(Date.now() - 90000000).toISOString(), status: 'REJECTED', jamaah_id: null },
    // Stale abandoned staging upload (> 24h old)
    { id: 'doc_abandon', storage_path: 'staging/doc_abandoned_48h.jpg', uploaded_at: new Date(Date.now() - 172800000).toISOString(), status: 'UPLOADED', jamaah_id: null },
    // Active Confirmed Document
    { id: 'doc_conf', storage_path: 'jamaah/confirmed_passport.pdf', uploaded_at: new Date(Date.now() - 200000000).toISOString(), status: 'CONFIRMED', confirmed_at: new Date().toISOString() },
  ];

  const cleanupRes = await ExportCleanupService.executePhysicalCleanup(testJobs, testDocs, mockStorage);

  assert(
    cleanupRes.report.expired_exports_count === 2,
    `3.1: Expired export metadata count = 2 (Found: ${cleanupRes.report.expired_exports_count})`
  );
  assert(
    !mockStorage.has('exports/expired_manifest_1.xlsx') && !mockStorage.has('exports/expired_zip_2.zip'),
    '3.2: Expired export physical files physically deleted from storage'
  );
  assert(
    mockStorage.has('exports/active_report.xlsx'),
    '3.3: Active non-expired export physical file is preserved in storage'
  );

  // Test Cleanup Scheduler
  CleanupScheduler.startSchedule(60000);
  const schedStatus = CleanupScheduler.getStatus();
  assert(
    schedStatus.active === true,
    '3.4: Cleanup Scheduler background periodic timer successfully activated'
  );
  CleanupScheduler.stopSchedule();

  // ---------------------------------------------------------------------------
  // 4. STAGE 1 STAGING CLEANUP VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. STAGE 1 STAGING CLEANUP VERIFICATION ---');

  assert(
    !mockStorage.has('staging/doc_rejected_old.pdf'),
    '4.1: Stale rejected staging upload physically deleted from storage'
  );
  assert(
    !mockStorage.has('staging/doc_abandoned_48h.jpg'),
    '4.2: Stale abandoned staging upload (>24h) physically deleted from storage'
  );
  assert(
    mockStorage.has('jamaah/confirmed_passport.pdf'),
    '4.3: Confirmed master Jamaah document preserved and untouched'
  );

  // ---------------------------------------------------------------------------
  // 5. GENERATED EXPORT SECURITY & AUTH GUARD VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. GENERATED EXPORT SECURITY VERIFICATION ---');

  // Test unauthenticated request
  const unauthReq = {
    headers: {
      get: (key: string) => key.toLowerCase() === 'authorization' ? 'Bearer unauthenticated' : null,
    }
  } as any;
  const unauthRes = await verifyAdminAuth(unauthReq);
  assert(
    unauthRes.authorized === false && unauthRes.response?.status === 401,
    '5.1: Unauthenticated export access is strictly DENIED (401 Unauthorized)'
  );

  // Test invalid role / inactive admin
  const inactiveReq = {
    headers: {
      get: (key: string) => key.toLowerCase() === 'authorization' ? 'Bearer mock_inactive_token' : null,
    }
  } as any;
  const inactiveRes = await verifyAdminAuth(inactiveReq);
  assert(
    inactiveRes.authorized === false && (inactiveRes.response?.status === 401 || inactiveRes.response?.status === 403),
    '5.2: Inactive / nonexistent admin account is strictly DENIED (401/403)'
  );

  // Test authorized admin access
  const authReq = {
    headers: {
      get: (key: string) => key.toLowerCase() === 'authorization' ? 'Bearer valid_admin_token' : null,
    }
  } as any;
  const authRes = await verifyAdminAuth(authReq);
  assert(
    authRes.authorized === true && authRes.session?.userId === 'auth-admin-1',
    '5.3: Authorized active admin granted export access'
  );

  console.log('\n========================================================================');
  console.log(`📊 FINAL STAGE 3 VALIDATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalStage3Validation().catch(err => {
  console.error('Final validation test failed with error:', err);
  process.exit(1);
});
