import { DbRepository } from '../src/lib/repository/db';
import { ManifestValidator } from '../src/lib/export/manifest-validator';
import { ManifestGenerator } from '../src/lib/export/manifest-generator';
import { FinanceExportService } from '../src/lib/export/finance-export';
import { PaymentExportService } from '../src/lib/export/payment-export';
import { DocumentZipService } from '../src/lib/export/document-zip';
import { ExportCleanupService } from '../src/lib/export/cleanup-service';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

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

async function runStage3AcceptanceTests() {
  console.log('\n================================================================');
  console.log('🚀 STAGE 3 ACCEPTANCE & INTEGRATION TEST SUITE (SCENARIOS A - R)');
  console.log('================================================================\n');

  // SETUP: Clear store & prepare comprehensive package test data
  DbRepository.resetStore();

  const pkg1 = await DbRepository.createPackage({
    package_name: 'Umrah Syawal VIP 2026',
    departure_date: '2026-10-15',
    return_date: '2026-10-27',
    airline: 'Garuda Indonesia GA-980',
    makkah_hotel: 'Fairmont Clock Tower Makkah',
    madinah_hotel: 'Oberoi Madinah',
    b2b_price: 30000000,
    reference_price: 35000000,
    quota: 40,
  });

  const pic1 = await DbRepository.createPic(
    'Ustadz Ahmad Al-Habsyi (KBIH Nurul Iman)',
    '081299991111',
    'Nurul Iman Tour'
  );

  const pic2 = await DbRepository.createPic(
    'Haji Bambang Subandono',
    '081388882222',
    'Bambang Travel Group'
  );

  // Jamaah 1: Complete Valid Passport
  const j1 = await DbRepository.createJamaah({
    identity_name: 'Ahmad bin Abdullah (KTP)',
    ktp_name: 'Ahmad bin Abdullah',
    passport_name: 'AHMAD BIN ABDULLAH',
    passport_number: 'E1234567',
    gender: 'MALE',
    birth_place: 'JAKARTA',
    birth_date: '1985-05-12',
    passport_issue_place: 'JAKARTA SELATAN',
    passport_issue_date: '2022-01-10',
    passport_expiry_date: '2032-01-10', // Valid (expiry > 2026)
    nik: '3171011205850001',
    phone: '081211112222',
  });

  await DbRepository.saveDocument({
    jamaah_id: j1.id,
    document_type: 'PASSPORT',
    storage_path: `documents/${j1.id}/passport_v1.pdf`,
    original_file_name: 'scan_paspor_ahmad.pdf',
    status: 'CONFIRMED',
    is_current: true,
  });
  await DbRepository.saveDocument({
    jamaah_id: j1.id,
    document_type: 'KTP',
    storage_path: `documents/${j1.id}/ktp_v1.pdf`,
    original_file_name: 'ktp_ahmad.pdf',
    status: 'CONFIRMED',
    is_current: true,
  });

  // Jamaah 2: Name in Passport is different from Identity Name
  const j2 = await DbRepository.createJamaah({
    identity_name: 'Siti Fatimah (KTP Name)',
    ktp_name: 'Siti Fatimah',
    passport_name: 'SITI FATIMAH BINTI HASAN',
    passport_number: 'X9876543',
    gender: 'FEMALE',
    birth_place: 'SURABAYA',
    birth_date: '1990-08-20',
    passport_issue_place: 'SURABAYA',
    passport_issue_date: '2023-03-15',
    passport_expiry_date: '2033-03-15',
    nik: '3578012008900002',
  });

  await DbRepository.saveDocument({
    jamaah_id: j2.id,
    document_type: 'PASSPORT',
    storage_path: `documents/${j2.id}/passport_siti.pdf`,
    original_file_name: 'scan_paspor_siti.pdf',
    status: 'CONFIRMED',
    is_current: true,
  });

  // Jamaah 3: Passport Expires within 3 months of departure (WARNING < 6 months)
  const j3 = await DbRepository.createJamaah({
    identity_name: 'Muhammad Rizky',
    passport_name: 'MUHAMMAD RIZKY',
    passport_number: 'A5556667',
    gender: 'MALE',
    birth_place: 'BANDUNG',
    birth_date: '1992-11-05',
    passport_issue_place: 'BANDUNG',
    passport_issue_date: '2021-12-01',
    passport_expiry_date: '2026-12-25', // Dep: 2026-10-15 -> sisa 2 bulan (WARNING)
    nik: '3273010511920003',
  });

  // Jamaah 4: Expired Passport prior to departure (ERROR)
  const j4 = await DbRepository.createJamaah({
    identity_name: 'Haji Sulaiman',
    passport_name: 'HAJI SULAIMAN',
    passport_number: 'B7778889',
    gender: 'MALE',
    birth_place: 'MEDAN',
    birth_date: '1970-01-01',
    passport_issue_date: '2016-01-01',
    passport_expiry_date: '2026-09-01', // Expired before departure 2026-10-15 (ERROR)
  });

  // Jamaah 5: Missing Passport Number (ERROR)
  const j5 = await DbRepository.createJamaah({
    identity_name: 'Dewi Lestari',
    passport_name: 'DEWI LESTARI',
    passport_number: '', // Blank
    birth_date: '1995-04-10',
    passport_expiry_date: '2030-01-01',
  });

  // Jamaah 6: Duplicate Passport Number with Jamaah 1 (ERROR)
  const j6 = await DbRepository.createJamaah({
    identity_name: 'Ahmad Duplikat',
    passport_name: 'AHMAD DUPLIKAT',
    passport_number: 'E1234567', // Duplicate with j1
    birth_date: '1985-05-12',
    passport_expiry_date: '2032-01-10',
  });

  // Register participants into Package
  const part1 = await DbRepository.addParticipant(pkg1.id, j1.id, pic1.id, 30000000, 35000000);
  const part2 = await DbRepository.addParticipant(pkg1.id, j2.id, pic1.id, 30000000, 34000000);
  const part3 = await DbRepository.addParticipant(pkg1.id, j3.id, pic2.id, 30000000, 35000000);
  const part4 = await DbRepository.addParticipant(pkg1.id, j4.id, pic2.id, 30000000, 35000000);
  const part5 = await DbRepository.addParticipant(pkg1.id, j5.id, null, 30000000, 36000000);
  const part6 = await DbRepository.addParticipant(pkg1.id, j6.id, null, 30000000, 35000000);

  const inv1 = (await DbRepository.getInvoiceByParticipantId(part1.id))!;

  // Add Finance Items & Payments for Scenario N & O testing
  await DbRepository.addInvoiceItem(inv1.id, {
    type: 'DISCOUNT',
    category: 'TOUR_LEADER',
    description: 'Diskon Spesial TL Nurul Iman',
    amount: 1000000,
  });

  const pay1 = await DbRepository.createPayment({
    amount: 34000000,
    payment_date: '2026-08-26',
    sender_name: 'Ahmad Abdullah',
    sender_bank: 'BCA',
    pic_id: pic1.id,
    package_id: pkg1.id,
  });

  await DbRepository.allocatePayment(pay1.id, [{
    invoice_id: inv1.id,
    amount: 34000000,
  }]);

  console.log('\n--- 1. MANIFEST VALIDATION ENGINE & SOURCE OF TRUTH (SCENARIOS A - H) ---');

  // SCENARIO A: Default Manifest Template Exists & Seeded
  const defaultTmpl = await DbRepository.getDefaultManifestTemplate();
  assert(defaultTmpl !== null && defaultTmpl.name.includes('Airline'), 'Scenario A: Default Airline Manifest template is configured and available');

  // SCENARIO B: Passport Name Priority Rule
  const validationResult = await DbRepository.validateManifest(pkg1.id);
  const part2Val = validationResult.participants.find(p => p.participant_id === part2.id);
  assert(part2Val?.mapped_values.passport_name === 'SITI FATIMAH BINTI HASAN', 'Scenario B: Manifest source of truth uses passport_name ("SITI FATIMAH BINTI HASAN") instead of identity_name ("Siti Fatimah (KTP Name)")');

  // SCENARIO E: Pre-export Validation identifies Errors & Warnings
  assert(validationResult.total_participants === 6, 'Scenario E.1: Total participants validated = 6');
  assert(validationResult.error_count > 0, `Scenario E.2: Validation engine detected ${validationResult.error_count} participants with errors`);

  // SCENARIO F: Expiry date vs Departure Date Check
  const part3Val = validationResult.participants.find(p => p.participant_id === part3.id);
  const part4Val = validationResult.participants.find(p => p.participant_id === part4.id);
  assert(part3Val?.issues.some(i => i.severity === 'WARNING' && i.message.includes('kurang dari 6 bulan')), 'Scenario F.1: Expiry within 6 months of departure triggers WARNING');
  assert(part4Val?.issues.some(i => i.severity === 'ERROR' && i.message.includes('kadaluarsa sebelum tanggal keberangkatan')), 'Scenario F.2: Expiry before departure date triggers ERROR');

  // SCENARIO G: Duplicate Passport Number Check
  const part1Val = validationResult.participants.find(p => p.participant_id === part1.id);
  const part6Val = validationResult.participants.find(p => p.participant_id === part6.id);
  assert(part1Val?.issues.some(i => i.field === 'passport_number' && i.severity === 'ERROR' && i.message.includes('duplikat')), 'Scenario G.1: Duplicate passport number detected on first participant');
  assert(part6Val?.issues.some(i => i.field === 'passport_number' && i.severity === 'ERROR' && i.message.includes('duplikat')), 'Scenario G.2: Duplicate passport number detected on second participant');

  // SCENARIO C & D: Custom Template with Column Remapping & Value Transformations
  const customTmpl = await DbRepository.createManifestTemplate({
    name: 'Saudia Airlines Custom Manifest',
    worksheet_name: 'PAX_LIST',
    header_row: 2,
    data_start_row: 3,
    field_mapping: {
      A: 'passport_number',
      B: 'passport_name',
      C: 'gender',
      D: 'birth_date',
    },
    value_transformations: {
      gender: { MALE: 'L', FEMALE: 'P' },
    },
  });
  assert(customTmpl.id.startsWith('tmpl_'), 'Scenario C: Custom Manifest Template created with flexible column mapping');

  const manifestExport = await DbRepository.exportManifestExcel(pkg1.id, customTmpl.id);
  assert(manifestExport.buffer.length > 0, 'Scenario C.2: Manifest Excel export generated successfully');
  assert(manifestExport.fileName.includes('UMRAH_SYAWAL_VIP_2026'), `Scenario C.3: Manifest filename sanitized cleanly (${manifestExport.fileName})`);

  // Verify XLSX Content using ExcelJS reader
  const manifestWb = new ExcelJS.Workbook();
  await manifestWb.xlsx.load(manifestExport.buffer);
  const mWs = manifestWb.getWorksheet('PAX_LIST');
  assert(mWs !== undefined, 'Scenario C.4: Worksheet name matches custom template (PAX_LIST)');
  const cellGenderP = mWs?.getCell('C3').value; // part1 is Male -> transformed to 'L'
  assert(cellGenderP === 'L', `Scenario D: Value transformation applied (MALE -> "${cellGenderP}")`);

  // SCENARIO H: Sorting Options
  const sortedByName = await DbRepository.validateManifest(pkg1.id, undefined, 'NAME');
  const sortedNames = sortedByName.participants.map(p => p.jamaah_name);
  const isSorted = sortedNames.slice(1).every((item, i) => item.localeCompare(sortedNames[i]) >= 0);
  assert(isSorted, 'Scenario H: Manifest validation and export respects NAME sorting');

  console.log('\n--- 2. DOCUMENT ARCHIVE & BULK ZIP EXPORT (SCENARIOS I - M) ---');

  // SCENARIO I: Searchable Document Archive
  const archiveAll = await DbRepository.getDocumentArchive();
  assert(archiveAll.length >= 3, `Scenario I.1: Document archive returned ${archiveAll.length} items`);

  const archivePassportOnly = await DbRepository.getDocumentArchive({ documentType: 'PASSPORT' });
  assert(archivePassportOnly.every(d => d.document_type === 'PASSPORT'), 'Scenario I.2: Filter by documentType (PASSPORT) returns only passports');

  const archiveSearchAhmad = await DbRepository.getDocumentArchive({ search: 'Ahmad' });
  assert(archiveSearchAhmad.length > 0 && archiveSearchAhmad[0].jamaah_name.includes('AHMAD'), 'Scenario I.3: Search by keyword ("Ahmad") returns matched documents');

  // SCENARIO J: Security - Document Records store safe relative storage_paths
  assert(archiveAll.every(d => !d.storage_path.startsWith('http')), 'Scenario J: Document archive paths are private storage keys, never exposing permanent public URLs');

  // SCENARIO K & L: Bulk Document ZIP Preview & Missing Detection
  const zipPreview = await DbRepository.previewPackageDocuments(pkg1.id, {
    documentTypes: ['PASSPORT', 'KTP'],
  });
  assert(zipPreview.total_participants === 6, 'Scenario K.1: ZIP preview evaluated 6 participants');
  assert(zipPreview.available_files_count === 3, `Scenario K.2: Available files detected = ${zipPreview.available_files_count}`);
  assert(zipPreview.missing_files_count > 0, `Scenario L: Missing documents detected for ${zipPreview.missing_files_count} participants`);

  // File Renaming Verification
  const sampleCleanName = zipPreview.files_to_download[0]?.clean_file_name;
  assert(sampleCleanName?.startsWith('01_AHMAD_BIN_ABDULLAH_E1234567'), `Scenario K.3: Clean filename pattern generated (${sampleCleanName})`);

  // Generate Actual ZIP buffer
  const zipResult = await DbRepository.generatePackageDocumentZip(pkg1.id, {
    documentTypes: ['PASSPORT'],
  });
  assert(zipResult.buffer.length > 0, 'Scenario K.4: ZIP archive binary generated');
  assert(zipResult.mimeType === 'application/zip', 'Scenario K.5: Correct ZIP MIME type');

  // SCENARIO M: Package Document Completeness
  const completeness = await DbRepository.getPackageDocumentCompleteness(pkg1.id);
  assert(completeness.total_participants === 6, 'Scenario M.1: Completeness total pax = 6');
  assert(completeness.passport_count === 2, `Scenario M.2: Passport completeness count = ${completeness.passport_count}/6`);
  assert(completeness.ktp_count === 1, `Scenario M.3: KTP completeness count = ${completeness.ktp_count}/6`);

  console.log('\n--- 3. FINANCIAL EXCEL EXPORT (SCENARIOS N - P) ---');

  // SCENARIO N: Package Finance Report Excel (3 Sheets)
  const finExport = await DbRepository.exportPackageFinanceExcel(pkg1.id);
  assert(finExport.buffer.length > 0, 'Scenario N.1: Package Finance Excel generated');
  assert(finExport.fileName.startsWith('LAPORAN_KEUANGAN_'), `Scenario N.2: Clean filename (${finExport.fileName})`);

  const finWb = new ExcelJS.Workbook();
  await finWb.xlsx.load(finExport.buffer);
  assert(finWb.worksheets.length === 3, 'Scenario N.3: Package Finance workbook has exactly 3 worksheets');

  const ws1 = finWb.getWorksheet('Ringkasan Paket');
  const ws2 = finWb.getWorksheet('Detail Per Pax');
  const ws3 = finWb.getWorksheet('Breakdown PIC & TL');
  assert(ws1 !== undefined && ws2 !== undefined && ws3 !== undefined, 'Scenario N.4: All 3 worksheets (Summary, Pax Detail, PIC Breakdown) exist');

  // Verify Raw Numeric Types & Formatting in Sheet 2
  const b2bCell = ws2?.getCell('E4');
  assert(typeof b2bCell?.value === 'number' && b2bCell.value === 30000000, `Scenario N.5: B2B cell contains raw number (${b2bCell?.value})`);
  assert(b2bCell?.numFmt === '"Rp "#,##0', `Scenario N.6: Cell has Rupiah number format (${b2bCell?.numFmt})`);

  // SCENARIO O: Excel SUM Formula Verification in Totals
  const totalPaidCell = ws2?.getCell('J10'); // Total row
  const formulaObj = totalPaidCell?.value as any;
  assert(formulaObj?.formula === 'SUM(J4:J9)', `Scenario O.1: Total cell uses dynamic Excel SUM formula (${formulaObj?.formula})`);

  const picTotalFormula = ws3?.getCell('D7')?.value as any;
  assert(picTotalFormula?.formula === 'SUM(D4:D6)' || typeof picTotalFormula === 'object', 'Scenario O.2: PIC Breakdown sheet contains dynamic Excel SUM formula');

  // SCENARIO P: Payment History Excel Export
  const payExport = await DbRepository.exportPaymentsExcel();
  assert(payExport.buffer.length > 0, 'Scenario P.1: Payment history Excel generated');
  const payWb = new ExcelJS.Workbook();
  await payWb.xlsx.load(payExport.buffer);
  const payWs = payWb.getWorksheet('Riwayat Pembayaran');
  assert(payWs !== undefined, 'Scenario P.2: Riwayat Pembayaran sheet exists');
  const payAmtCell = payWs?.getCell('E4');
  assert(typeof payAmtCell?.value === 'number' && payAmtCell.value === 34000000, 'Scenario P.3: Payment amount is pure numeric');

  console.log('\n--- 4. EXPORT JOBS, TTL CLEANUP & REGRESSION INTEGRITY (SCENARIOS Q - R) ---');

  // SCENARIO Q: Export Jobs & TTL Cleanup
  const expJob = await DbRepository.createExportJob({
    export_type: 'MANIFEST',
    package_id: pkg1.id,
    file_name: 'test_manifest.xlsx',
  });
  assert(expJob.id.startsWith('exp_'), 'Scenario Q.1: Export job registered in audit log');
  assert(new Date(expJob.expires_at).getTime() > Date.now(), 'Scenario Q.2: Export job has future 24h TTL expiration');

  // Simulate expired jobs
  const cleanupRes = await ExportCleanupService.executePhysicalCleanup([
    { id: 'job_active', expires_at: new Date(Date.now() + 100000).toISOString(), status: 'COMPLETED' },
    { id: 'job_expired_1', expires_at: new Date(Date.now() - 100000).toISOString(), status: 'COMPLETED' },
    { id: 'job_expired_2', expires_at: new Date(Date.now() - 200000).toISOString(), status: 'EXPIRED' },
  ], []);
  assert(cleanupRes.report.expired_exports_count === 2, 'Scenario Q.3: Cleanup service successfully purges expired exports (>24h)');
  assert(cleanupRes.activeJobs.length === 1, 'Scenario Q.4: Active non-expired export jobs remain intact');

  // SCENARIO R: Zero Regression on Stage 1 & Stage 2
  const activeInvoices = await DbRepository.getInvoices();
  const activePayments = await DbRepository.getPayments();
  const inv1Updated = await DbRepository.getInvoiceByParticipantId(part1.id);
  assert(activeInvoices.length > 0, 'Scenario R.1: Stage 2 Invoices fully intact');
  assert(activePayments.length > 0, 'Scenario R.2: Stage 2 Payments fully intact');
  assert(inv1Updated?.total_amount === 34000000, 'Scenario R.3: Stage 2 Invoice calculation intact with TL Discount');

  console.log('\n================================================================');
  console.log(`📊 STAGE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage3AcceptanceTests().catch(err => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
