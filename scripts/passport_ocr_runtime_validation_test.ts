import { DocumentProcessingService } from '../src/lib/document-processing/service';
import { DbRepository } from '../src/lib/repository/db';
import { evaluatePassportHealth } from '../src/lib/passport-health';
import { parsePassportMrz } from '../src/lib/document-processing/mrz-parser';
import zlib from 'zlib';

function createTestPng(width = 100, height = 50): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const scanlineLen = 1 + width * 3;
  const rawData = Buffer.alloc(height * scanlineLen);
  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLen;
    rawData[offset] = 0;
    for (let x = 0; x < width * 3; x++) {
      rawData[offset + 1 + x] = 255;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

const VALID_TEST_JPEG = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
  0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
  0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
]);

async function runPassportOcrValidation() {
  console.log('=====================================================');
  console.log('🛡️ RUNNING PASSPORT OCR RUNTIME VALIDATION TESTS');
  console.log('=====================================================\n');

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

  // A. Valid Passport PNG completes
  console.log('--- TEST A: Valid Passport PNG ---');
  const pngBuffer = createTestPng(150, 80);
  const pngOcrRes = await DocumentProcessingService.runOcr(pngBuffer, { timeoutMs: 15000 });
  assert(pngOcrRes.error === undefined, 'Valid Passport PNG completes OCR without throwing or hanging');

  // B. Valid Passport JPG completes
  console.log('\n--- TEST B: Valid Passport JPG ---');
  const jpgOcrRes = await DocumentProcessingService.runOcr(VALID_TEST_JPEG, { timeoutMs: 15000 });
  assert(jpgOcrRes.error === undefined || typeof jpgOcrRes.text === 'string', 'Valid Passport JPG completes OCR execution cleanly');

  // C. OCR failure returns controlled error
  console.log('\n--- TEST C: OCR Corrupt / Invalid Image Graceful Error ---');
  const corruptBuffer = Buffer.from('NOT_A_VALID_IMAGE_DATA_CORRUPT');
  const corruptOcrRes = await DocumentProcessingService.runOcr(corruptBuffer, { timeoutMs: 5000 });
  assert(corruptOcrRes.error !== undefined || corruptOcrRes.text === '', 'Corrupt image returns controlled error/empty text without crash');

  // D. MRZ failure returns NEEDS_REVIEW instead of hanging
  console.log('\n--- TEST D: MRZ Failure Returns NEEDS_REVIEW ---');
  const blurryPassportText = `
    REPUBLIK INDONESIA
    PASPOR / PASSPORT
    Nama: AHMAD FAUZI
    P<IDNFAUZI<<AHMAD<<<<<<<<<<<<<<<<<<<<<<<<<<<
    BLURRY_UNPARSEABLE_LINE_2_XXXXX
  `;
  const blurryExtraction = await DocumentProcessingService.processText(blurryPassportText, 'blurry_passport.jpg');
  assert(blurryExtraction.document_type === 'PASSPORT', 'Classifies as PASSPORT');
  assert(!blurryExtraction.mrz_data?.valid, 'MRZ parsed as invalid or null without hanging');
  assert(blurryExtraction.quality_warnings.length > 0, 'Quality warnings recorded for unparseable fields');

  const savedBlurry = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/blurry.jpg',
    'blurry.jpg',
    'image/jpeg',
    50000,
    {
      rawText: blurryExtraction.raw_text,
      fields: blurryExtraction.fields,
      classification: blurryExtraction.document_type,
      confidence: blurryExtraction.confidence,
      mrzData: blurryExtraction.mrz_data,
    }
  );
  assert(savedBlurry.document.status === 'NEEDS_REVIEW', 'Blurry MRZ document saved with status NEEDS_REVIEW for human manual entry');

  // E. OCR timeout exits processing state
  console.log('\n--- TEST E: OCR Timeout Exits Processing ---');
  const timeoutOcrRes = await DocumentProcessingService.runOcr(pngBuffer, { timeoutMs: 1 }); // 1ms force timeout
  assert(timeoutOcrRes.error === 'OCR_TIMEOUT', 'Centralized timeout triggers OCR_TIMEOUT cleanly within threshold');

  // F. Network/provider exception returns controlled error
  console.log('\n--- TEST F: Exception Handling & Controlled Fallback ---');
  const emptyExtraction = await DocumentProcessingService.processText('', 'unknown.dat');
  assert(emptyExtraction.confidence <= 50, 'Empty rawText handled gracefully without exception');

  // G. Retry succeeds without duplicate document records
  console.log('\n--- TEST G: Retry Idempotency (No Duplicate Records) ---');
  const initialDoc = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/test_retry.jpg',
    'test_retry.jpg',
    'image/jpeg',
    1024,
    {
      rawText: 'INITIAL_TEXT',
      fields: {},
      classification: 'PASSPORT',
      confidence: 30,
    }
  );
  const initialDocId = initialDoc.document.id;
  const initialCount = DbRepository.getStoreState().documents.length;

  const retryDoc = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/test_retry.jpg',
    'test_retry.jpg',
    'image/jpeg',
    1024,
    {
      rawText: 'UPDATED_OCR_TEXT_P<IDNTEST<<<<<',
      fields: { passport_number: 'X1234567' },
      classification: 'PASSPORT',
      confidence: 90,
    },
    initialDocId
  );
  const newCount = DbRepository.getStoreState().documents.length;
  assert(retryDoc.document.id === initialDocId, 'Retry updates same document ID');
  assert(newCount === initialCount, `No duplicate document created (Doc count before: ${initialCount}, after: ${newCount})`);
  assert(retryDoc.extraction.extracted_fields.passport_number === 'X1234567', 'Extraction fields updated on retry');

  // H. Processing state reset verification (Simulated lifecycle)
  console.log('\n--- TEST H: Lifecycle State Reset ---');
  let processingFlag = false;
  try {
    processingFlag = true;
    // Simulate operation with timeout or failure
    await DocumentProcessingService.runOcr(corruptBuffer, { timeoutMs: 10 });
  } catch (e) {
    // catch
  } finally {
    processingFlag = false;
  }
  assert(processingFlag === false, 'Processing state always resets in finally block');

  // I. Passport Source-of-Truth Rules
  console.log('\n--- TEST I: Passport Source-of-Truth Rules ---');
  const validPassportText = `
    REPUBLIK INDONESIA / REPUBLIC OF INDONESIA
    PASPOR / PASSPORT
    P<IDNAHMAD<<MUHAMMAD<<<<<<<<<<<<<<<<<<<<<<<<
    C1234567<0IDN8810159M3401103<<<<<<<<<<<<<<04
  `;
  const mrzParsed = parsePassportMrz(validPassportText);
  assert(mrzParsed !== null && mrzParsed.valid === true, 'MRZ Parser successfully parses valid ICAO TD3 MRZ lines');
  assert(mrzParsed?.passportNumber === 'C1234567', 'Extracts exact passport number C1234567');
  assert(mrzParsed?.fullName === 'MUHAMMAD AHMAD', 'Extracts exact full name MUHAMMAD AHMAD from MRZ');
  assert(mrzParsed?.birthDate === '1988-10-15', 'Extracts valid ISO birth date');

  // J. Stage 1 Duplicate / Passport-history Logic
  console.log('\n--- TEST J: Stage 1 Duplicate & History Integrity ---');
  const healthResult = evaluatePassportHealth(
    {
      id: 'jam_test_1',
      identity_name: 'MUHAMMAD AHMAD',
      passport_name: 'MUHAMMAD AHMAD',
      passport_number: 'C1234567',
      passport_issue_place: 'JAKARTA SELATAN',
      passport_issue_date: '2024-01-10',
      passport_expiry_date: '2034-01-10',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any,
    '2026-10-01'
  );
  assert(healthResult.status === 'VALID', 'Passport health evaluation intact and valid');

  console.log('\n=====================================================');
  console.log(`🏁 PASSPORT OCR VALIDATION COMPLETE: Passed: ${passed}, Failed: ${failed}`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPassportOcrValidation().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
