import path from 'path';
import fs from 'fs';
import { DocumentProcessingService } from '../src/lib/document-processing/service';
import { parsePassportMrz } from '../src/lib/document-processing/mrz-parser';
import { parsePassport } from '../src/lib/document-processing/parsers/passport-parser';
import { DbRepository } from '../src/lib/repository/db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name} -> ${detail || ''}`);
    failed++;
  }
}

async function runValidation() {
  console.log('========================================================================');
  console.log('🚀 RUNNING PASSPORT OCR ENGINE VALIDATION SUITE');
  console.log('========================================================================\n');

  // Test 1: OCR Provider Initialization & Runtime Check
  console.log('--- TEST 1: OCR PROVIDER INITIALIZATION & RUNTIME ---');
  const valid1x1Png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  
  const ocrPngRes = await DocumentProcessingService.runOcr(valid1x1Png, { timeoutMs: 15000 });
  assert(!ocrPngRes.error, '1. OCR Provider initializes and processes PNG buffer cleanly');

  // Test 2: Realistic Passport OCR Text with TD3 MRZ
  console.log('\n--- TEST 2: TD3 MRZ PARSER & FIELD EXTRACTION ---');
  const samplePassportText = `
REPUBLIK INDONESIA / REPUBLIC OF INDONESIA
PASPOR / PASSPORT
Jenis / Type   Kode Negara / Country Code   Nomor Paspor / Passport No.
P              IDN                          C7263541
Nama Lengkap / Full Name
AEP SAEPULOH
Jenis Kelamin / Sex   Kewarganegaraan / Nationality
L / M                 INDONESIA
Tanggal Lahir / Date of birth
14 AUG 1975
Tempat Lahir / Place of birth
BANDUNG
Tanggal Pengeluaran / Date of issue
20 JAN 2023
Tanggal Habis Berlaku / Date of expiry
20 JAN 2033
Kantor Penerbit / Issuing Authority
KANMIG KELAPA GADING
P<IDNSAEPULOH<<AEP<<<<<<<<<<<<<<<<<<<<<<<<<<
C7263541<8IDN7508144M3301202<<<<<<<<<<<<<<06
`;

  const mrzParsed = parsePassportMrz(samplePassportText);
  assert(mrzParsed !== null, '2. TD3 MRZ Candidate Detected');
  assert(mrzParsed?.fullName === 'AEP SAEPULOH', '3. Passport Name extracted via MRZ', mrzParsed?.fullName);
  assert(mrzParsed?.passportNumber === 'C7263541', '4. Passport Number extracted via MRZ', mrzParsed?.passportNumber);
  assert(mrzParsed?.birthDate === '1975-08-14', '5. DOB extracted via MRZ (YYYY-MM-DD)', mrzParsed?.birthDate);
  assert(mrzParsed?.expiryDate === '2033-01-20', '6. Expiry Date extracted via MRZ', mrzParsed?.expiryDate);
  assert(mrzParsed?.sex === 'MALE', '7. Sex extracted via MRZ (MALE)', mrzParsed?.sex);
  assert(mrzParsed?.nationality === 'IDN', '8. Nationality extracted via MRZ (IDN)', mrzParsed?.nationality);
  assert(mrzParsed?.rawLines.length === 2, '9. MRZ raw lines extracted (2 lines of 44 chars)');

  // Test 3: MRZ with OCR Bracket / Symbol Noise
  console.log('\n--- TEST 3: MRZ OCR SYMBOL NOISE RECOVERY ---');
  const noisyMrzText = `
P<IDNSAEPULOH««AEP««««««««««««««««««««««««««
C7263541«8IDN7508144M3301202««««««««««««««06
`;
  const noisyParsed = parsePassportMrz(noisyMrzText);
  assert(noisyParsed !== null, '10. Noisy MRZ with brackets and symbols recovered');
  assert(noisyParsed?.passportNumber === 'C7263541', '11. Passport number normalized from noisy MRZ');
  assert(noisyParsed?.fullName === 'AEP SAEPULOH', '12. Name extracted from noisy MRZ');

  // Test 4: Visual OCR Multi-Line Fallback (MRZ absent/unreadable)
  console.log('\n--- TEST 4: MULTI-LINE VISUAL OCR EXTRACTION ---');
  const visualOnlyPassportText = `
REPUBLIK INDONESIA
PASPOR / PASSPORT
Nomor Paspor / Passport No.
A9876543
Nama Lengkap / Full Name
ADE PUTRI SRIMULYATI
Jenis Kelamin / Sex
P / F
Tempat Lahir / Place of Birth
CIAMIS
Tanggal Lahir / Date of Birth
05 OKTOBER 1992
Tanggal Pengeluaran / Date of Issue
10 MEI 2022
Tanggal Habis Berlaku / Date of Expiry
10 MEI 2032
Kantor Penerbit / Issuing Authority
KANTOR IMIGRASI TASIKMALAYA
`;

  const visualExtracted = parsePassport(visualOnlyPassportText);
  assert(visualExtracted.passport_name === 'ADE PUTRI SRIMULYATI', '13. Visual OCR Multi-line Name extracted', visualExtracted.passport_name);
  assert(visualExtracted.passport_number === 'A9876543', '14. Visual OCR Multi-line Passport Number extracted', visualExtracted.passport_number);
  assert(visualExtracted.birth_date === '1992-10-05', '15. Visual OCR Multi-line DOB parsed', visualExtracted.birth_date);
  assert(visualExtracted.passport_expiry_date === '2032-05-10', '16. Visual OCR Multi-line Expiry parsed', visualExtracted.passport_expiry_date);
  assert(visualExtracted.gender === 'FEMALE', '17. Visual OCR Gender detected (FEMALE)', visualExtracted.gender);
  assert(visualExtracted.birth_place === 'CIAMIS', '18. Visual OCR Place of Birth extracted', visualExtracted.birth_place);
  assert(visualExtracted.field_sources?.passport_name === 'OCR_VISUAL', '19. Field source metadata correctly recorded as OCR_VISUAL');

  // Test 5: Document Processing Service Pipeline Result
  console.log('\n--- TEST 5: FULL SERVICE PIPELINE PROCESS TEXT ---');
  const fullServiceRes = await DocumentProcessingService.processText(samplePassportText, 'passport.png', 'PASSPORT');
  assert(fullServiceRes.document_type === 'PASSPORT', '20. Classified as PASSPORT');
  assert(fullServiceRes.confidence >= 80, '21. Confidence score >= 80% on clear passport');
  assert((fullServiceRes.fields as any).passport_name === 'AEP SAEPULOH', '22. Service returned extracted name');
  assert((fullServiceRes.fields as any).passport_number === 'C7263541', '23. Service returned extracted passport number');

  // Test 6: Timeout and Lifecycle Cleanup
  console.log('\n--- TEST 6: TIMEOUT & RESOURCE CLEANUP ---');
  const timeoutRes = await DocumentProcessingService.runOcr(valid1x1Png, { timeoutMs: 1 });
  assert(timeoutRes.error === 'OCR_TIMEOUT', '24. Hard timeout triggers and returns OCR_TIMEOUT cleanly');

  // Test 7: Idempotent Database Save on Retry
  console.log('\n--- TEST 7: IDEMPOTENT DB RETRY ---');
  const doc1 = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/test_retry.png',
    'test_retry.png',
    'image/png',
    1024,
    {
      rawText: samplePassportText,
      fields: fullServiceRes.fields,
      classification: 'PASSPORT',
      confidence: 90,
      mrzData: fullServiceRes.mrz_data,
    }
  );

  const docCountBefore = (await DbRepository.getPendingReviewDocuments()).length;

  const doc2 = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/test_retry.png',
    'test_retry.png',
    'image/png',
    1024,
    {
      rawText: samplePassportText,
      fields: { ...fullServiceRes.fields, passport_name: 'AEP SAEPULOH UPDATED' },
      classification: 'PASSPORT',
      confidence: 95,
      mrzData: fullServiceRes.mrz_data,
    },
    doc1.document.id
  );

  const docCountAfter = (await DbRepository.getPendingReviewDocuments()).length;
  assert(doc1.document.id === doc2.document.id, '25. Retry preserved exact document.id');
  assert(docCountBefore === docCountAfter, '26. Zero duplicate database records created on retry');
  assert((doc2.extraction.extracted_fields as any).passport_name === 'AEP SAEPULOH UPDATED', '27. Staged extraction updated in-place');

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
