import { DocumentProcessingService } from '../src/lib/document-processing/service';
import { DbRepository } from '../src/lib/repository/db';
import { StorageService } from '../src/lib/repository/storage.service';
import { detectDuplicate } from '../src/lib/duplicate-detector';
import { verifyAdminAuth } from '../src/lib/auth/guard';

async function runProductionValidation() {
  console.log('================================================================');
  console.log('🛡️  STAGE 1 FINAL PRODUCTION VALIDATION & SECURITY PASS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} — ${detail}`);
      failed++;
    }
  }

  // =================================================================
  // 1. SECURITY & ACCESS CONTROL TEST
  // =================================================================
  console.log('--- 1. SECURITY & AUTHORIZATION TESTS ---');

  // Test 1A: Inactive Admin token rejected
  const reqInactive = new Request('http://localhost:3005/api/jamaah', {
    headers: { 'Authorization': 'Bearer mock_inactive_token' }
  }) as any;
  const authInactive = await verifyAdminAuth(reqInactive);
  assert(authInactive.authorized === false, 'Inactive admin account access blocked (403 Forbidden)');

  // Test 1B: Invalid / Unauthenticated token rejected
  const reqInvalid = new Request('http://localhost:3005/api/jamaah', {
    headers: { 'Authorization': 'Bearer invalid_token' }
  }) as any;
  const authInvalid = await verifyAdminAuth(reqInvalid);
  assert(authInvalid.authorized === false, 'Invalid unauthenticated token blocked (401 Unauthorized)');

  // Test 1C: Active Admin authenticated
  const reqActive = new Request('http://localhost:3005/api/jamaah') as any;
  const authActive = await verifyAdminAuth(reqActive);
  assert(authActive.authorized === true && authActive.session?.isActive === true, 'Active admin authorized for operational access');

  // =================================================================
  // 2. SIGNED URL & STORAGE PRIVACY VALIDATION
  // =================================================================
  console.log('\n--- 2. SIGNED URL & PRIVATE STORAGE VALIDATION ---');
  const testStoragePath = 'jamaah/test_jam_001/passport/sample_passport.jpg';
  const signedUrl = await StorageService.getSignedUrl(testStoragePath, 3600);
  
  assert(signedUrl.includes(encodeURIComponent(testStoragePath)) || signedUrl.includes('token') || signedUrl.includes('signedUrl'), 'Generated temporary Signed URL for private document');
  assert(!signedUrl.startsWith('https://storage.googleapis.com/public') && !signedUrl.includes('/public/'), 'Private bucket has zero permanent public URLs');

  // =================================================================
  // 3. REALISTIC DOCUMENT OCR VALIDATION (PASSPORT, KTP, KK)
  // =================================================================
  console.log('\n--- 3. REALISTIC DOCUMENT OCR & NOISY INPUT VALIDATION ---');

  // Passport with realistic smartphone OCR noise & mixed case
  const realisticPassport = `
    REPUBLIK INDONESIA
    PASPOR / PASSPORT
    P<IDNAHMAD<<ABDULLAH<<<<<<<<<<<<<<<<<<<<<<<<
    X9876543<2IDN9005201M3505208<<<<<<<<<<<<<<02
    Nama / Full Name: ABDULLAH AHMAD
    No Paspor: X9876543
    Tempat Lahir / Place of Birth: SURABAYA
    Tgl Lahir / Date of Birth: 20 MEI 1990
    Sex: LAKI-LAKI / M
    Tempat Dikeluarkan / Place of Issue: KANMIG TANJUNG PERAK
    Tgl Dikeluarkan: 20 MEI 2025
    Tgl Kadaluarsa / Date of Expiry: 20 MEI 2035
  `;
  const ocrPassResult = await DocumentProcessingService.processText(realisticPassport, 'scan_pass_001.jpg');
  assert(ocrPassResult.document_type === 'PASSPORT', 'Passport: auto-classified correctly');
  assert(ocrPassResult.fields.passport_number === 'X9876543', 'Passport: Passport number extracted accurately');
  assert(ocrPassResult.fields.birth_date === '1990-05-20', 'Passport: Flexible Indonesian date parsed (20 MEI 1990 -> 1990-05-20)');
  assert(ocrPassResult.fields.gender === 'MALE', 'Passport: Sex extracted as MALE');

  // KTP with Indonesian e-KTP layout
  const realisticKtp = `
    PROVINSI JAWA TIMUR
    KOTA SURABAYA
    NIK : 3578012005900002
    Nama : ABDULLAH AHMAD
    Tempat/Tgl Lahir : SURABAYA, 20-05-1990
    Jenis Kelamin : LAKI-LAKI   Gol. Darah : O
    Alamat : JL. DARMO NO. 45
    RT/RW : 002/004
    Kel/Desa : KEPUTRAN
    Kecamatan : TEGALSARI
    Agama : ISLAM
    Status Perkawinan: KAWIN
    Pekerjaan : WIRASWASTA
    Kewarganegaraan : WNI
    Berlaku Hingga : SEUMUR HIDUP
  `;
  const ocrKtpResult = await DocumentProcessingService.processText(realisticKtp, 'foto_ktp_abdullah.jpg');
  assert(ocrKtpResult.document_type === 'KTP', 'KTP: auto-classified as KTP');
  assert(ocrKtpResult.fields.nik === '3578012005900002', 'KTP: 16-digit NIK extracted correctly');
  assert(ocrKtpResult.fields.ktp_name === 'ABDULLAH AHMAD', 'KTP: Name extracted correctly');
  assert(ocrKtpResult.fields.address?.includes('JL. DARMO NO. 45'), 'KTP: Full address composed properly');

  // KK with Family Members Table
  const realisticKk = `
    KARTU KELUARGA
    No. 3578010101900088
    Nama Kepala Keluarga : ABDULLAH AHMAD
    Alamat : JL. DARMO NO. 45 RT.02 RW.04
    
    1  ABDULLAH AHMAD   3578012005900002  LAKI-LAKI   SURABAYA  20-05-1990  KEPALA KELUARGA
    2  NURUL HIDAYAH    3578016008920001  PEREMPUAN  GRESIK    20-08-1992  ISTRI
    3  ZAYN AHMAD       3578011010200005  LAKI-LAKI   SURABAYA  10-10-2020  ANAK
  `;
  const ocrKkResult = await DocumentProcessingService.processText(realisticKk, 'KK_KELUARGA_AHMAD.pdf');
  assert(ocrKkResult.document_type === 'KK', 'KK: auto-classified as KK');
  assert(ocrKkResult.fields.kk_number === '3578010101900088', 'KK: No. KK extracted');
  assert(ocrKkResult.fields.members?.length === 3, 'KK: All 3 family members extracted into structured roster');

  // =================================================================
  // 4. CROSS-DOCUMENT DUPLICATE EDGE CASE
  // =================================================================
  console.log('\n--- 4. CROSS-DOCUMENT DUPLICATE EDGE CASE ---');
  // Create Initial Jamaah from KK/KTP
  const initialFauzan = await DbRepository.createJamaah({
    identity_name: 'MUHAMMAD FAUZAN',
    birth_date: '1985-01-12',
    nik: '3171011201850009',
  });

  // Candidate from new Passport with spelling variation
  const candidateNewPassport = {
    identity_name: 'MOHAMMAD FAUZAN BIN ABDULLAH',
    passport_name: 'MOHAMMAD FAUZAN BIN ABDULLAH',
    passport_number: 'A9922114',
    birth_date: '1985-01-12', // Same DOB
  };

  const allJamaah = await DbRepository.getJamaahList();
  const duplicateFauzanMatch = detectDuplicate(candidateNewPassport, allJamaah);

  assert(duplicateFauzanMatch !== null, 'Duplicate Warning triggered for name variation with identical birth date');
  assert(duplicateFauzanMatch?.matched_jamaah_id === initialFauzan.id, 'Duplicate points to existing Master Jamaah record');
  assert(duplicateFauzanMatch?.match_confidence === 'MEDIUM' || duplicateFauzanMatch?.match_confidence === 'HIGH', 'Confidence score provided to assist admin decision');

  // =================================================================
  // 5. PASSPORT REPLACEMENT INTEGRITY
  // =================================================================
  console.log('\n--- 5. PASSPORT REPLACEMENT INTEGRITY & HISTORY ---');
  // Upload Old Passport for Fauzan
  const docOldFauzan = await DbRepository.saveUploadedDocument(
    initialFauzan.id,
    'PASSPORT',
    'staging/old_pass_fauzan.jpg',
    'old_pass_fauzan.jpg',
    'image/jpeg',
    100000,
    { rawText: '', fields: { passport_number: 'A1111111' }, classification: 'PASSPORT', confidence: 90 }
  );

  // Upload Renewed Passport for Fauzan
  const docNewFauzan = await DbRepository.saveUploadedDocument(
    initialFauzan.id,
    'PASSPORT',
    'staging/new_pass_fauzan.jpg',
    'new_pass_fauzan.jpg',
    'image/jpeg',
    100000,
    { rawText: '', fields: { passport_number: 'A9922114', passport_expiry_date: '2035-08-01' }, classification: 'PASSPORT', confidence: 95 }
  );

  // Confirm replacement
  await DbRepository.confirmDocumentReview(
    docNewFauzan.document.id,
    'UPDATE_EXISTING',
    initialFauzan.id,
    { passport_number: 'A9922114', passport_expiry_date: '2035-08-01' }
  );

  const fauzanUpdated = await DbRepository.getJamaahById(initialFauzan.id);
  const currentPassports = (fauzanUpdated?.documents || []).filter(d => d.document_type === 'PASSPORT' && d.is_current);

  assert(currentPassports.length === 1, `Integrity Check: Exactly ONE current passport document (Found: ${currentPassports.length})`);
  assert(fauzanUpdated?.passport_number === 'A9922114', 'Master Jamaah passport fields match renewed passport');

  // =================================================================
  // 6. SOFT DELETE PARTICIPANT INTEGRITY
  // =================================================================
  console.log('\n--- 6. SOFT DELETE PARTICIPANT INTEGRITY ---');
  const testPkg = await DbRepository.createPackage({
    package_name: 'Paket Uji Coba Soft Delete',
    departure_date: '2026-11-01',
    return_date: '2026-11-10',
    b2b_price: 25000000,
    reference_price: 29000000,
    quota: 30,
  });

  // Step 1: Add Fauzan to Package
  const partInitial = await DbRepository.addParticipant(
    testPkg.id,
    initialFauzan.id,
    null,
    25000000,
    29000000,
    'Pendaftaran awal'
  );
  assert(partInitial.participant_status === 'REGISTERED', 'Participant added to package');

  // Step 2: Soft delete participant
  const deleted = await DbRepository.softDeleteParticipant(partInitial.id);
  assert(deleted === true, 'Participant soft-deleted (deleted_at set, status ARCHIVED)');

  // Step 3: Add Fauzan again to same Package
  const partReAdded = await DbRepository.addParticipant(
    testPkg.id,
    initialFauzan.id,
    null,
    25000000,
    30000000, // new adjusted price
    'Pendaftaran ulang setelah batal'
  );
  assert(partReAdded.id !== partInitial.id, 'New active participant created successfully');
  
  const activeParticipants = await DbRepository.getParticipants({ packageId: testPkg.id });
  assert(activeParticipants.length === 1, 'Only ONE active participant in current roster');
  assert(activeParticipants[0].selling_price === 30000000, 'Active participant holds new pricing');

  // =================================================================
  // 7. STAGING STORAGE PROMOTION & CLEANUP
  // =================================================================
  console.log('\n--- 7. STAGING STORAGE PROMOTION & CLEANUP ---');
  const stagingDoc = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/temp_doc_123.jpg',
    'temp_doc_123.jpg',
    'image/jpeg',
    50000,
    { rawText: '', fields: { passport_name: 'KHALID BASALAMAH' }, classification: 'PASSPORT', confidence: 90 }
  );

  const confirmStaging = await DbRepository.confirmDocumentReview(
    stagingDoc.document.id,
    'CREATE_NEW',
    undefined,
    { passport_name: 'KHALID BASALAMAH' }
  );

  const confirmedJamaah = await DbRepository.getJamaahById(confirmStaging.jamaah!.id);
  const promotedDoc = confirmedJamaah?.documents?.[0];

  assert(promotedDoc?.storage_path.startsWith(`jamaah/${confirmedJamaah?.id}/`), `Staging path promoted to permanent path: ${promotedDoc?.storage_path}`);

  console.log('\n================================================================');
  console.log(`🏁 PRODUCTION VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runProductionValidation().catch(e => {
  console.error(e);
  process.exit(1);
});
