import { DocumentProcessingService } from '../src/lib/document-processing/service';
import { DbRepository } from '../src/lib/repository/db';
import { detectDuplicate } from '../src/lib/duplicate-detector';
import { evaluatePassportHealth } from '../src/lib/passport-health';

async function runAcceptanceTests() {
  console.log('=====================================================');
  console.log('🚀 RUNNING STAGE 1 ACCEPTANCE TESTS');
  console.log('=====================================================\n');

  DbRepository.resetStore();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} - ${details}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // SCENARIO A: New Jamaah from Passport OCR & MRZ
  // -----------------------------------------------------------------
  console.log('--- SCENARIO A: New Jamaah from Passport ---');
  const samplePassportText = `
    REPUBLIK INDONESIA / REPUBLIC OF INDONESIA
    PASPOR / PASSPORT
    Type/Jenis: P  Country Code: IDN  Passport No: C1234567
    Nama Lengkap / Full Name:
    MUHAMMAD AHMAD
    Jenis Kelamin / Sex: L / M
    Tempat Lahir / Place of birth: JAKARTA
    Tanggal Lahir / Date of birth: 15 OCT 1988
    Tanggal Pengeluaran / Date of issue: 10 JAN 2024
    Tanggal Habis Berlaku / Date of expiry: 10 JAN 2034
    Kantor Penerbit / Issuing Office: KANMIG JAKARTA SELATAN
    P<IDNAHMAD<<MUHAMMAD<<<<<<<<<<<<<<<<<<<<<<<<
    C1234567<0IDN8810159M3401103<<<<<<<<<<<<<<04
  `;

  const extractionPassport = await DocumentProcessingService.processText(samplePassportText, 'passport_ahmad.jpg');
  const pFields: any = extractionPassport.fields;
  assert(extractionPassport.document_type === 'PASSPORT', 'Auto-classification detects PASSPORT');
  assert(pFields.passport_number === 'C1234567', 'Extracts Passport Number C1234567');
  assert(pFields.passport_name?.includes('MUHAMMAD'), 'Extracts Passport Full Name');
  assert(pFields.birth_date === '1988-10-15', 'Extracts Date of Birth 1988-10-15');
  assert(extractionPassport.mrz_data?.valid === true, 'MRZ Checksum and structure valid');

  const savedDocA = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/passport_ahmad.jpg',
    'passport_ahmad.jpg',
    'image/jpeg',
    102400,
    {
      rawText: extractionPassport.raw_text,
      fields: extractionPassport.fields,
      classification: 'PASSPORT',
      confidence: extractionPassport.confidence,
      mrzData: extractionPassport.mrz_data,
    }
  );

  const confirmResultA = await DbRepository.confirmDocumentReview(
    savedDocA.document.id,
    'CREATE_NEW',
    undefined,
    extractionPassport.fields
  );
  assert(confirmResultA.success === true && !!confirmResultA.jamaah, 'Admin review confirm creates Master Jamaah');
  const ahmadJamaahId = confirmResultA.jamaah?.id!;

  // -----------------------------------------------------------------
  // SCENARIO B: Jamaah from KK Without Passport
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO B: Jamaah from KK Without Passport ---');
  const sampleKkText = `
    KARTU KELUARGA
    No. 3171010101880099
    Nama Kepala Keluarga : HASAN BASRI
    Alamat : JL. CEMPAKA PUTIH NO. 12
    RT/RW : 005/002
    Kelurahan/Desa : RAWASARI
    Kecamatan : CEMPAKA PUTIH
    Kabupaten/Kota : JAKARTA PUSAT
    
    1  HASAN BASRI       3171010101700001  LAKI-LAKI   JAKARTA  10-05-1970  KEPALA KELUARGA
    2  SITI AISYAH       3171010101750002  PEREMPUAN  BANDUNG  12-08-1975  ISTRI
    3  FATIMAH AZZAHRA   3171010101000003  PEREMPUAN  JAKARTA  20-01-2000  ANAK
  `;

  const extractionKk = await DocumentProcessingService.processText(sampleKkText, 'KK_HASAN.pdf');
  assert(extractionKk.document_type === 'KK', 'Auto-classification detects KARTU KELUARGA (KK)');
  assert(extractionKk.fields.kk_number === '3171010101880099', 'Extracts KK Number');
  assert(extractionKk.fields.members?.length >= 2, `Extracts multiple family members (Found: ${extractionKk.fields.members?.length})`);

  // Admin selects member Fatimah Azzahra
  const selectedMember = extractionKk.fields.members.find((m: any) => m.name.includes('FATIMAH')) || extractionKk.fields.members[1];
  const fatimahJamaah = await DbRepository.createJamaah({
    identity_name: selectedMember.name,
    gender: selectedMember.gender || 'FEMALE',
    birth_date: selectedMember.birth_date,
    nik: selectedMember.nik,
    kk_number: extractionKk.fields.kk_number,
    notes: 'Didaftarkan dari Kartu Keluarga (Belum ada paspor)',
  });

  assert(fatimahJamaah.identity_name === selectedMember.name, 'Master Jamaah created with neutral identity_name');
  assert(fatimahJamaah.passport_number === null, 'Passport fields are nullable for KK members');
  const fatimahHealth = evaluatePassportHealth(fatimahJamaah);
  assert(fatimahHealth.status === 'MISSING', 'Passport health correctly reports MISSING passport');

  // -----------------------------------------------------------------
  // SCENARIO C: Passport Added Later to Existing Jamaah
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO C: Passport Added Later to Existing Jamaah ---');
  const candidateFatimahPassport = {
    identity_name: 'FATIMAH AZZAHRA',
    passport_name: 'FATIMAH AZZAHRA',
    passport_number: 'E7766554',
    birth_date: selectedMember.birth_date,
    nik: selectedMember.nik,
  };

  const allJamaahList = await DbRepository.getJamaahList();
  const duplicateMatchFatimah = detectDuplicate(candidateFatimahPassport, allJamaahList);
  assert(duplicateMatchFatimah !== null && duplicateMatchFatimah.matched_jamaah_id === fatimahJamaah.id, 'Duplicate detector links new passport to existing Jamaah via NIK/Name');

  const updatedFatimah = await DbRepository.updateJamaah(fatimahJamaah.id, {
    passport_name: 'FATIMAH AZZAHRA',
    passport_number: 'E7766554',
    passport_issue_place: 'KANMIG JAKARTA TIMUR',
    passport_issue_date: '2025-01-10',
    passport_expiry_date: '2035-01-10',
  });
  assert(updatedFatimah?.passport_number === 'E7766554', 'Existing Master Jamaah updated with travel passport identity');
  const fatimahUpdatedHealth = evaluatePassportHealth(updatedFatimah!);
  assert(fatimahUpdatedHealth.status === 'VALID', 'Passport health turns VALID after passport confirmation');

  // -----------------------------------------------------------------
  // SCENARIO D: Passport Renewal (Document Archival Transaction)
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO D: Passport Renewal ---');
  const savedDocOld = await DbRepository.saveUploadedDocument(
    ahmadJamaahId,
    'PASSPORT',
    'staging/old_passport.jpg',
    'old_passport.jpg',
    'image/jpeg',
    102400,
    { rawText: '', fields: { passport_number: 'C1234567' }, classification: 'PASSPORT', confidence: 90 }
  );

  const savedDocNew = await DbRepository.saveUploadedDocument(
    ahmadJamaahId,
    'PASSPORT',
    'staging/new_passport_renewed.jpg',
    'new_passport_renewed.jpg',
    'image/jpeg',
    102400,
    { rawText: '', fields: { passport_number: 'E9998887', passport_expiry_date: '2036-08-01' }, classification: 'PASSPORT', confidence: 95 }
  );

  const renewResult = await DbRepository.confirmDocumentReview(
    savedDocNew.document.id,
    'UPDATE_EXISTING',
    ahmadJamaahId,
    {
      passport_number: 'E9998887',
      passport_expiry_date: '2036-08-01',
    }
  );
  assert(renewResult.success === true, 'Passport renewal confirmed');
  const ahmadProfileAfterRenew = await DbRepository.getJamaahById(ahmadJamaahId);
  assert(ahmadProfileAfterRenew?.passport_number === 'E9998887', 'Master profile updated to renewed passport number E9998887');

  // Verify old passport is archived in document history
  const ahmadDocs = ahmadProfileAfterRenew?.documents || [];
  const oldDocRecord = ahmadDocs.find(d => d.id === savedDocOld.document.id);
  const newDocRecord = ahmadDocs.find(d => d.id === savedDocNew.document.id);
  assert(oldDocRecord?.is_current === false && oldDocRecord?.status === 'ARCHIVED', 'Old passport archived in document history');
  assert(newDocRecord?.is_current === true && newDocRecord?.status === 'CONFIRMED', 'New passport marked current in document history');

  // -----------------------------------------------------------------
  // SCENARIO E: Package Creation & Custom Pricing
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO E: Package Creation & Custom Pricing ---');
  const pkg1 = await DbRepository.createPackage({
    package_name: 'Umroh Syawal 1448 H',
    departure_date: '2026-10-15',
    return_date: '2026-10-24',
    b2b_price: 27500000,
    reference_price: 30000000,
    quota: 45,
    status: 'OPEN',
  });
  assert(pkg1.b2b_price === 27500000, 'B2B price stored as integer Rupiah (27500000)');

  const pic1 = await DbRepository.createPic('Ustadz Fauzi Rabbani', '08123456789', 'Mitra Surabaya');
  assert(pic1.name === 'Ustadz Fauzi Rabbani', 'PIC Master created');

  const part1 = await DbRepository.addParticipant(
    pkg1.id,
    ahmadJamaahId,
    pic1.id,
    27500000,
    31500000, // Custom Selling Price
    'Peserta request kamar double'
  );
  assert(part1.selling_price === 31500000, 'Participant saved with custom selling price Rp31.500.000');
  assert(part1.pic_id === pic1.id, 'Participant attached to PIC');

  // -----------------------------------------------------------------
  // SCENARIO F: Repeat Traveler (Input Once, Use Everywhere)
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO F: Repeat Traveler ---');
  const pkg2 = await DbRepository.createPackage({
    package_name: 'Umroh Akhir Tahun 2026',
    departure_date: '2026-12-20',
    return_date: '2026-12-30',
    b2b_price: 32000000,
    reference_price: 36000000,
    quota: 45,
    status: 'OPEN',
  });

  const part2 = await DbRepository.addParticipant(
    pkg2.id,
    ahmadJamaahId,
    null,
    32000000,
    35000000,
    'Perjalanan kedua Ahmad'
  );
  assert(part2.package_id === pkg2.id, 'Existing Jamaah registered to 2nd package');

  const allJamaahAfterRepeat = await DbRepository.getJamaahList();
  const ahmadCount = allJamaahAfterRepeat.filter(j => j.id === ahmadJamaahId).length;
  assert(ahmadCount === 1, 'Master Jamaah remains exactly 1 single record (No duplicate profile)');

  const ahmadTrips = await DbRepository.getJamaahTrips(ahmadJamaahId);
  assert(ahmadTrips.length === 2, `Trips history contains all 2 trips (Found: ${ahmadTrips.length})`);

  // -----------------------------------------------------------------
  // SCENARIO G: Global Search
  // -----------------------------------------------------------------
  console.log('\n--- SCENARIO G: Global Search ---');
  const searchAhmad = await DbRepository.globalSearch('Ahmad');
  assert(searchAhmad.jamaah.length >= 1, 'Search finds Jamaah by Name "Ahmad"');

  const searchPassport = await DbRepository.globalSearch('E9998887');
  assert(searchPassport.jamaah.length >= 1, 'Search finds Jamaah by renewed Passport Number');

  const searchPkg = await DbRepository.globalSearch('Syawal');
  assert(searchPkg.packages.length >= 1, 'Search finds Package by Keyword');

  console.log('\n=====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
