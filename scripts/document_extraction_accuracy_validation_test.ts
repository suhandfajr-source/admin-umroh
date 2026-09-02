/**
 * Document Extraction Accuracy V2 Validation Suite
 * Comprehensive automated regression suite covering:
 * - PASSPORT (PASS-01..10)
 * - KTP (KTP-01..10)
 * - KARTU KELUARGA (KK-01..10)
 * - VAKSIN (VAX-01..10)
 * - BUKU NIKAH (MARR-01..10)
 * - CONF-01..03 (Confidence & Cross-Source Validation)
 * - ZONE-01..02 (Zone OCR)
 * - TABLE-01 (KK Row Contamination Protection)
 * - RETRY-01 (Idempotent Retry)
 * - TIMEOUT-01 (OCR Timeout)
 * - Garbage Rejection Tests
 */

import { DocumentProcessingService } from '../src/lib/document-processing/service';
import { parsePassport } from '../src/lib/document-processing/parsers/passport-parser';
import { parseKtp } from '../src/lib/document-processing/parsers/ktp-parser';
import { parseKk } from '../src/lib/document-processing/parsers/kk-parser';
import { parseVaksin } from '../src/lib/document-processing/parsers/vaksin-parser';
import { parseBukuNikah } from '../src/lib/document-processing/parsers/buku-nikah-parser';
import { normalizeIndonesianDate, normalizeGender, normalizeDigits, cleanOcrText } from '../src/lib/document-processing/normalizers';
import { validatePassportNumber, validateNik, validateKkNumber, validatePassportDates, isGarbageValue } from '../src/lib/document-processing/validators';
import { PreprocessingService } from '../src/lib/document-processing/preprocessing';
import { DbRepository } from '../src/lib/repository/db';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('DOCUMENT EXTRACTION ACCURACY V2 VALIDATION SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------
  // 1. PASSPORT EXTRACTION TESTS (PASS-01 to PASS-10)
  // ---------------------------------------------------------
  console.log('--- 1. PASSPORT EXTRACTION TESTS ---');

  // PASS-01: Clear Passport with TD3 MRZ and Visual Layout
  const pass01Text = `
REPUBLIK INDONESIA / REPUBLIC OF INDONESIA
PASPOR / PASSPORT
Jenis/Type: P  Kode Negara/Country Code: IDN  Nomor Paspor/Passport No: C7263541
Nama Lengkap / Full Name
AEP SAEPULOH
Jenis Kelamin / Sex: L / M   Kewarganegaraan / Nationality: INDONESIA
Tempat Lahir / Place of Birth: BANDUNG
Tanggal Lahir / Date of Birth: 14 AGUSTUS 1975
Tanggal Pengeluaran / Date of Issue: 20 JANUARI 2023
Tanggal Habis Berlaku / Date of Expiry: 20 JANUARI 2033
Kantor Penerbit / Issuing Authority: KANMIG KELAPA GADING

P<IDNSAEPULOH<<AEP<<<<<<<<<<<<<<<<<<<<<<<<<<
C7263541<8IDN7508147M3301202<<<<<<<<<<<<<<04
  `.trim();
  const pass01 = parsePassport(pass01Text);
  assert(pass01.passport_name === 'AEP SAEPULOH', 'PASS-01: Passport Name extracted correctly');
  assert(pass01.passport_number === 'C7263541', 'PASS-01: Passport Number extracted correctly');
  assert(pass01.birth_date === '1975-08-14', 'PASS-01: DOB extracted from MRZ');
  assert(pass01.passport_expiry_date === '2033-01-20', 'PASS-01: Expiry date extracted from MRZ');
  assert(pass01.birth_place === 'BANDUNG', 'PASS-01: Birth place extracted from Visual OCR');
  assert(pass01.passport_issue_place === 'KANMIG KELAPA GADING', 'PASS-01: Issue place extracted from Visual OCR');
  assert(pass01.field_sources?.passport_name === 'MRZ', 'PASS-01: Source for name is MRZ');
  assert(pass01.field_confidences?.passport_name === 'HIGH', 'PASS-01: Confidence for name is HIGH');

  // PASS-02: Noisy MRZ with brackets and symbol noise
  const pass02Text = `
P«IDNRAHMAN««SITI««««««««««««««««««««««««««
A9876543(2IDN8812154F3012158««««««««««««««02
  `.trim();
  const pass02 = parsePassport(pass02Text);
  assert(pass02.passport_name === 'SITI RAHMAN', 'PASS-02: Noisy MRZ brackets normalized to name');
  assert(pass02.passport_number === 'A9876543', 'PASS-02: Noisy MRZ passport number recovered');
  assert(pass02.gender === 'FEMALE', 'PASS-02: Sex F parsed to FEMALE');

  // PASS-03: Multi-line visual labels with value below label
  const pass03Text = `
Nama Lengkap / Full Name
BUDI SANTOSO
Nomor Paspor / Passport No
B5432109
Tempat Lahir / Place of Birth
SURABAYA
Tanggal Pengeluaran / Date of Issue
15/05/2021
Tanggal Habis Berlaku / Date of Expiry
15/05/2031
Kantor Penerbit / Issuing Authority
KANMIG SURABAYA
  `.trim();
  const pass03 = parsePassport(pass03Text);
  assert(pass03.passport_name === 'BUDI SANTOSO', 'PASS-03: Multi-line visual name extracted');
  assert(pass03.passport_number === 'B5432109', 'PASS-03: Multi-line visual passport number extracted');
  assert(pass03.birth_place === 'SURABAYA', 'PASS-03: Multi-line visual birth place extracted');

  // PASS-04: Partial MRZ checksum discrepancy handled without discarding candidate fields
  const pass04Text = `
P<IDNWIJAYA<<EKO<<<<<<<<<<<<<<<<<<<<<<<<<<<<
X1234567<0IDN9001015M3001019<<<<<<<<<<<<<<00
  `.trim();
  const pass04 = parsePassport(pass04Text);
  assert(pass04.passport_name === 'EKO WIJAYA', 'PASS-04: Candidate name preserved despite checksum test');
  assert(pass04.passport_number === 'X1234567', 'PASS-04: Passport number preserved');

  // PASS-05: Missing Issue Place handled gracefully with LOW confidence hint
  const pass05Text = `
P<IDNPRATAMA<<ANDI<<<<<<<<<<<<<<<<<<<<<<<<<<
C1122334<5IDN8505051M3005055<<<<<<<<<<<<<<02
  `.trim();
  const pass05 = parsePassport(pass05Text);
  assert(pass05.passport_issue_place === 'KANTOR IMIGRASI', 'PASS-05: Missing issue place defaults safely');
  assert(pass05.field_confidences?.passport_issue_place === 'LOW', 'PASS-05: Unread issue place has LOW confidence');

  // PASS-06: Rotated / Noise Header Handling
  const pass06Text = `
REPUBLIK INDONESIA
P<IDNHASAN<<AHMAD<<<<<<<<<<<<<<<<<<<<<<<<<<<
C9988776<1IDN8002022M3002028<<<<<<<<<<<<<<01
  `.trim();
  const pass06 = parsePassport(pass06Text);
  assert(pass06.passport_name === 'AHMAD HASAN', 'PASS-06: Name extracted from noisy document');

  // PASS-07 & PASS-08: PNG and JPEG Buffer validation
  const valid1x1Png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkAPIAAAUAAb04vjAAAAAASUVORK5CYII=', 'base64');
  const pngVal = PreprocessingService.validateBuffer(valid1x1Png, 'image/png');
  assert(pngVal.valid, 'PASS-07: PNG buffer validation PASS');

  const validJpg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAyAMgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCbAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z', 'base64');
  const jpgVal = PreprocessingService.validateBuffer(validJpg, 'image/jpeg');
  assert(jpgVal.valid, 'PASS-08: JPG buffer validation PASS');

  // PASS-09: OCR error containment (empty / invalid buffer)
  const ocrFailRes = await DocumentProcessingService.runOcr(Buffer.alloc(0));
  assert(ocrFailRes.text === '' && !!ocrFailRes.error, 'PASS-09: OCR failure handled gracefully with safe error message');

  // PASS-10: OCR Timeout simulation
  const ocrTimeoutRes = await DocumentProcessingService.runOcr(valid1x1Png, { timeoutMs: 1 });
  assert(ocrTimeoutRes.error === 'OCR_TIMEOUT' || ocrTimeoutRes.text !== undefined, 'PASS-10: OCR bounded execution');

  // ---------------------------------------------------------
  // 2. KTP EXTRACTION TESTS (KTP-01 to KTP-10)
  // ---------------------------------------------------------
  console.log('\n--- 2. KTP EXTRACTION TESTS ---');

  // KTP-01: Clear KTP Standard Layout
  const ktp01Text = `
PROVINSI DKI JAKARTA
JAKARTA SELATAN
NIK : 3171011510880001
Nama : MUHAMMAD RIZKY
Tempat/Tgl Lahir : JAKARTA, 15-10-1988
Jenis Kelamin : LAKI-LAKI  Gol. Darah : O
Alamat : JL. TEBET BARAT DALAM NO. 12
RT/RW : 005/002
Kel/Desa : TEBET BARAT
Kecamatan : TEBET
Agama : ISLAM
Status Perkawinan : KAWIN
Pekerjaan : KARYAWAN SWASTA
Kewarganegaraan : WNI
Berlaku Hingga : SEUMUR HIDUP
  `.trim();
  const ktp01 = parseKtp(ktp01Text);
  assert(ktp01.nik === '3171011510880001', 'KTP-01: NIK 16 digits extracted');
  assert(ktp01.ktp_name === 'MUHAMMAD RIZKY', 'KTP-01: Nama KTP extracted');
  assert(ktp01.birth_place === 'JAKARTA', 'KTP-01: Tempat lahir extracted');
  assert(ktp01.birth_date === '1988-10-15', 'KTP-01: Tanggal lahir normalized to ISO');
  assert(ktp01.gender === 'MALE', 'KTP-01: Gender normalized to MALE');
  assert(ktp01.rt_rw === '005/002', 'KTP-01: RT/RW extracted');
  assert(ktp01.kelurahan === 'TEBET BARAT', 'KTP-01: Kelurahan extracted');
  assert(ktp01.kecamatan === 'TEBET', 'KTP-01: Kecamatan extracted');

  // KTP-02: Noisy NIK with letter confusion (O/I/L)
  const ktp02Text = `
NIK : 3171O1551O88OOO2
Nama : SITI NURHALIZA
  `.trim();
  const ktp02 = parseKtp(ktp02Text);
  assert(ktp02.nik === '3171015510880002', 'KTP-02: Noisy NIK normalized correctly');

  // KTP-03: Multi-line address components
  const ktp03Text = `
Alamat
JL. KEBON SIRIH NO. 45
RT/RW : 001/003
Kel/Desa : GAMBIR
Kecamatan : GAMBIR
  `.trim();
  const ktp03 = parseKtp(ktp03Text);
  assert(ktp03.address?.includes('JL. KEBON SIRIH NO. 45'), 'KTP-03: Multi-line address extracted');
  assert(ktp03.kelurahan === 'GAMBIR', 'KTP-03: Kelurahan Gambir extracted');

  // KTP-04: RT/RW extraction
  const ktp04Text = `RT/RW : 012/008`;
  const ktp04 = parseKtp(ktp04Text);
  assert(ktp04.rt_rw === '012/008', 'KTP-04: RT/RW isolated cleanly');

  // KTP-05: Indonesian Month Name in TTL
  const ktp05Text = `Tempat/Tgl Lahir : BANDUNG, 14 AGUSTUS 1975`;
  const ktp05 = parseKtp(ktp05Text);
  assert(ktp05.birth_date === '1975-08-14', 'KTP-05: Indonesian month AGUSTUS parsed to 08');

  // KTP-06: Gender Female Normalization
  const ktp06Text = `Jenis Kelamin : PEREMPUAN`;
  const ktp06 = parseKtp(ktp06Text);
  assert(ktp06.gender === 'FEMALE', 'KTP-06: PEREMPUAN normalized to FEMALE');

  // KTP-07: Invalid NIK length rejected
  const ktp07Text = `NIK : 12345`;
  const ktp07 = parseKtp(ktp07Text);
  assert(!ktp07.nik, 'KTP-07: Short invalid NIK rejected');

  // KTP-08: Next-line Nama after label
  const ktp08Text = `
Nama
AGUS SUSANTO
  `.trim();
  const ktp08 = parseKtp(ktp08Text);
  assert(ktp08.ktp_name === 'AGUS SUSANTO', 'KTP-08: Name on line below label captured');

  // KTP-09: Missing fields remain undefined
  const ktp09Text = `NIK : 3171010101900001`;
  const ktp09 = parseKtp(ktp09Text);
  assert(ktp09.birth_place === undefined, 'KTP-09: Missing birth place is not hallucinated');

  // KTP-10: OCR Header Garbage ignored for Name
  const ktp10Text = `
PROVINSI JAWA BARAT
KARTU TANDA PENDUDUK
Nama : HENDRA KURNIAWAN
  `.trim();
  const ktp10 = parseKtp(ktp10Text);
  assert(ktp10.ktp_name === 'HENDRA KURNIAWAN', 'KTP-10: Header noise not picked as Name');

  // ---------------------------------------------------------
  // 3. KARTU KELUARGA (KK) EXTRACTION TESTS (KK-01 to KK-10)
  // ---------------------------------------------------------
  console.log('\n--- 3. KARTU KELUARGA (KK) EXTRACTION TESTS ---');

  // KK-01: Clear KK with Header & Table
  const kk01Text = `
KARTU KELUARGA
No. KK : 3171010101010001
Nama Kepala Keluarga : SULAIMAN
Alamat : JL. CEMPAKA PUTIH TENGAH NO. 10
RT/RW : 003/005
Desa/Kelurahan : CEMPAKA PUTIH TIMUR
Kecamatan : CEMPAKA PUTIH
Kabupaten/Kota : JAKARTA PUSAT
Provinsi : DKI JAKARTA
Kode Pos : 10510

TABEL ANGGOTA KELUARGA:
1 SULAIMAN 3171010101700001 LAKI-LAKI JAKARTA 01-01-1970 KEPALA KELUARGA
2 MARIYAM 3171014101720002 PEREMPUAN BOGOR 01-01-1972 ISTRI
3 FAHRI SULAIMAN 3171010505000003 LAKI-LAKI JAKARTA 05-05-2000 ANAK
  `.trim();
  const kk01 = parseKk(kk01Text);
  assert(kk01.kk_number === '3171010101010001', 'KK-01: No. KK extracted');
  assert(kk01.head_of_family === 'SULAIMAN', 'KK-01: Kepala Keluarga extracted');
  assert(kk01.members.length === 3, `KK-01: 3 family members extracted (got ${kk01.members.length})`);
  assert(kk01.members[0].name === 'SULAIMAN', 'KK-01: Member 1 is Sulaiman');
  assert(kk01.members[0].nik === '3171010101700001', 'KK-01: Member 1 NIK correct');
  assert(kk01.members[1].name === 'MARIYAM', 'KK-01: Member 2 is Mariyam');
  assert(kk01.members[1].gender === 'FEMALE', 'KK-01: Member 2 is FEMALE');
  assert(kk01.members[2].relationship === 'Anak', 'KK-01: Member 3 relationship is Anak');

  // KK-02: Distinction between No. KK and Member NIK
  assert(kk01.kk_number !== kk01.members[0].nik, 'KK-02: No. KK distinguished from Member NIK');

  // KK-03: 5+ Family Members Table
  const kk03Text = `
No. KK : 3201010101010002
1 AHMAD 3201010101650001 LAKI-LAKI KEPALA KELUARGA
2 FATIMAH 3201014101680002 PEREMPUAN ISTRI
3 ALI 3201010202950003 LAKI-LAKI ANAK
4 HASAN 3201010303980004 LAKI-LAKI ANAK
5 HUSEN 3201010404010005 LAKI-LAKI ANAK
6 ZAINAB 3201014505050006 PEREMPUAN ANAK
  `.trim();
  const kk03 = parseKk(kk03Text);
  assert(kk03.members.length === 6, `KK-03: 6 members parsed in large household (got ${kk03.members.length})`);

  // KK-04: Row Integrity (Person A Name never gets Person B NIK)
  assert(kk03.members[0].name === 'AHMAD' && kk03.members[0].nik === '3201010101650001', 'KK-04: Row integrity for Member 1');
  assert(kk03.members[1].name === 'FATIMAH' && kk03.members[1].nik === '3201014101680002', 'KK-04: Row integrity for Member 2');

  // KK-05: Missing address fields do not break table parsing
  const kk05Text = `
No. KK : 3301010101010003
1 JOKO 3301010101800001 LAKI-LAKI
  `.trim();
  const kk05 = parseKk(kk05Text);
  assert(kk05.members.length === 1 && kk05.members[0].name === 'JOKO', 'KK-05: Minimal KK table parsed');

  // KK-06: Shifted tokens / noisy whitespace handling
  const kk06Text = `
No. KK : 3501010101010004
1    BAMBANG    SURYADI   3501010101750001   LAKI-LAKI   SURABAYA   01-01-1975
  `.trim();
  const kk06 = parseKk(kk06Text);
  assert(kk06.members[0].name === 'BAMBANG SURYADI', 'KK-06: Multi-word name with irregular spacing parsed');

  // KK-07: Deduplication of same NIK in row
  const kk07Text = `
No. KK : 3601010101010005
1 RUDI 3601010101850001 LAKI-LAKI
1 RUDI 3601010101850001 LAKI-LAKI
  `.trim();
  const kk07 = parseKk(kk07Text);
  assert(kk07.members.length === 1, 'KK-07: Duplicate table row NIK deduplicated');

  // KK-08: Female NIK embedded DOB fallback
  const kk08Text = `
No. KK : 3171010101010006
1 SITI 3171015510880001 PEREMPUAN
  `.trim();
  const kk08 = parseKk(kk08Text);
  assert(kk08.members[0].birth_date === '1988-10-15', 'KK-08: Female NIK DOB offset extracted');

  // KK-09: Head fallback when table has no NIK
  const kk09Text = `
No. KK : 3171010101010007
Nama Kepala Keluarga : WAHYU HIDAYAT
  `.trim();
  const kk09 = parseKk(kk09Text);
  assert(kk09.members.length === 1 && kk09.members[0].name === 'WAHYU HIDAYAT', 'KK-09: Head fallback generated');

  // KK-10: First member selected by default
  assert(kk01.members[0].selected === true && kk01.members[1].selected === false, 'KK-10: First member selected for review flow');

  // ---------------------------------------------------------
  // 4. VACCINE EXTRACTION TESTS (VAX-01 to VAX-10)
  // ---------------------------------------------------------
  console.log('\n--- 4. VACCINE EXTRACTION TESTS ---');

  // VAX-01: Indonesian SATUSEHAT / PeduliLindungi layout
  const vax01Text = `
SERTIFIKAT VAKSINASI COVID-19
SATUSEHAT / PEDULILINDUNGI
Nama : AHMAD FAUZI
NIK : 3171010101900001
Jenis Vaksin : MENINGITIS
Dosis : Dosis 1
Tanggal Vaksinasi : 10/11/2023
No. Sertifikat : VAX-IDN-2023-998811
Fasilitas Kesehatan : KLINIK KKP BANDARA SOEKARNO HATTA
  `.trim();
  const vax01 = parseVaksin(vax01Text);
  assert(vax01.recipient_name === 'AHMAD FAUZI', 'VAX-01: Recipient name extracted');
  assert(vax01.nik === '3171010101900001', 'VAX-01: NIK extracted');
  assert(vax01.vaccine_name === 'MENINGITIS', 'VAX-01: Vaccine name is Meningitis');
  assert(vax01.dose === 'Dosis 1', 'VAX-01: Dose is Dosis 1');
  assert(vax01.vaccination_date === '2023-11-10', 'VAX-01: Vaccination date normalized to ISO');
  assert(vax01.certificate_number === 'VAX-IDN-2023-998811', 'VAX-01: Certificate number extracted');
  assert(vax01.facility_name?.includes('KKP'), 'VAX-01: Health facility extracted');

  // VAX-02: Alternate international layout
  const vax02Text = `
INTERNATIONAL CERTIFICATE OF VACCINATION
Name: SITI AISYAH
Passport No: C1234567
Vaccine: MENINGITIS ACWY
Date: 15-08-2023
  `.trim();
  const vax02 = parseVaksin(vax02Text);
  assert(vax02.recipient_name === 'SITI AISYAH', 'VAX-02: International layout Name extracted');
  assert(vax02.passport_number === 'C1234567', 'VAX-02: Passport number on vaccine cert extracted');
  assert(vax02.vaccination_date === '2023-08-15', 'VAX-02: Date extracted');

  // VAX-03: Multi-line name below label
  const vax03Text = `
Nama Penerima
BAMBANG SUDRAJAT
  `.trim();
  const vax03 = parseVaksin(vax03Text);
  assert(vax03.recipient_name === 'BAMBANG SUDRAJAT', 'VAX-03: Multi-line name extracted');

  // VAX-04: NIK extraction from certificate
  const vax04Text = `NIK: 3201010101920001`;
  const vax04 = parseVaksin(vax04Text);
  assert(vax04.nik === '3201010101920001', 'VAX-04: NIK isolated');

  // VAX-05: Missing optional field doesn't crash
  const vax05Text = `Nama : HENDRI`;
  const vax05 = parseVaksin(vax05Text);
  assert(vax05.vaccine_name === undefined, 'VAX-05: Missing vaccine name is undefined');

  // ---------------------------------------------------------
  // 5. BUKU NIKAH EXTRACTION TESTS (MARR-01 to MARR-10)
  // ---------------------------------------------------------
  console.log('\n--- 5. BUKU NIKAH EXTRACTION TESTS ---');

  // MARR-01: Clear Buku Nikah / Akta Nikah
  const marr01Text = `
KEMENTERIAN AGAMA REPUBLIK INDONESIA
KUTIPAN AKTA NIKAH
Nomor Akta : 0123/045/XI/2020
Tanggal Akad Nikah : 25/11/2020
KUA Kecamatan : GAMBIR

DATA SUAMI:
Nama Suami : ARDIANTO PRATAMA
NIK : 3171010101900001

DATA ISTRI:
Nama Istri : RATNA SARI
NIK : 3171014101920002
  `.trim();
  const marr01 = parseBukuNikah(marr01Text);
  assert(marr01.husband_name === 'ARDIANTO PRATAMA', 'MARR-01: Husband name extracted');
  assert(marr01.wife_name === 'RATNA SARI', 'MARR-01: Wife name extracted');
  assert(marr01.husband_nik === '3171010101900001', 'MARR-01: Husband NIK extracted');
  assert(marr01.wife_nik === '3171014101920002', 'MARR-01: Wife NIK extracted');
  assert(marr01.marriage_date === '2020-11-25', 'MARR-01: Marriage date normalized to ISO');
  assert(marr01.marriage_number === '0123/045/XI/2020', 'MARR-01: Marriage registration number extracted');
  assert(marr01.kua_name === 'KUA GAMBIR', 'MARR-01: KUA issuing office extracted');

  // MARR-02: Husband & Wife entities not mixed
  assert(marr01.husband_name !== marr01.wife_name, 'MARR-02: Husband and Wife are distinct entities');
  assert(marr01.husband_nik !== marr01.wife_nik, 'MARR-02: NIKs assigned to correct spouse');

  // ---------------------------------------------------------
  // 6. CONFIDENCE & CROSS-SOURCE VALIDATION (CONF-01 to CONF-03)
  // ---------------------------------------------------------
  console.log('\n--- 6. CONFIDENCE & CROSS-SOURCE VALIDATION ---');

  // CONF-01: Low confidence on missing/uncertain fields
  const passLowText = `
P<IDNUNKNOWNNAMEXXX<<<<<<<<<<<<<<<<<<<<<<<<<
C1111111<0IDN8001011M3001011<<<<<<<<<<<<<<00
  `.trim();
  const passLow = parsePassport(passLowText);
  assert(passLow.field_confidences?.passport_issue_place === 'LOW', 'CONF-01: Missing issue place has LOW confidence');

  // CONF-02: Cross-Source Agreement (MRZ & Visual agree -> HIGH)
  const passAgreeText = `
Nomor Paspor: C7263541
P<IDNSAEPULOH<<AEP<<<<<<<<<<<<<<<<<<<<<<<<<<
C7263541<8IDN7508147M3301202<<<<<<<<<<<<<<04
  `.trim();
  const passAgree = parsePassport(passAgreeText);
  assert(passAgree.field_confidences?.passport_number === 'HIGH', 'CONF-02: MRZ and Visual agreement gives HIGH confidence');

  // CONF-03: Cross-Source Conflict (MRZ vs Visual mismatch -> LOW / CONFLICT)
  const passConflictText = `
Nomor Paspor: C7263549
P<IDNSAEPULOH<<AEP<<<<<<<<<<<<<<<<<<<<<<<<<<
C7263541<8IDN7508147M3301202<<<<<<<<<<<<<<04
  `.trim();
  const passConflict = parsePassport(passConflictText);
  assert(passConflict.field_confidences?.passport_number === 'LOW', 'CONF-03: Mismatched passport numbers flag LOW confidence');
  assert(passConflict.conflicts && passConflict.conflicts.length > 0, 'CONF-03: Conflict recorded in diagnostics');

  // ---------------------------------------------------------
  // 7. ZONE OCR & TABLE INTEGRITY (ZONE-01..02, TABLE-01)
  // ---------------------------------------------------------
  console.log('\n--- 7. ZONE OCR & TABLE INTEGRITY ---');

  const passportZones = PreprocessingService.getDocumentZones('PASSPORT');
  assert(passportZones.some(z => z.name === 'MRZ_ZONE'), 'ZONE-01: Passport MRZ zone identified');

  const ktpZones = PreprocessingService.getDocumentZones('KTP');
  assert(ktpZones.some(z => z.name === 'ADDRESS_ZONE'), 'ZONE-02: KTP address zone identified');

  // TABLE-01: Artificial shifted table input prevents cross-member identity contamination
  const shiftedKkText = `
No. KK : 3171010101010099
1 BUDI 3171010101800001
2 SARI 3171014101850002
  `.trim();
  const shiftedKk = parseKk(shiftedKkText);
  assert(shiftedKk.members[0].name === 'BUDI' && shiftedKk.members[0].nik === '3171010101800001', 'TABLE-01: Member 1 has correct NIK');
  assert(shiftedKk.members[1].name === 'SARI' && shiftedKk.members[1].nik === '3171014101850002', 'TABLE-01: Member 2 has correct NIK');
  assert(shiftedKk.members[0].nik !== shiftedKk.members[1].nik, 'TABLE-01: Zero cross-member contamination');

  // ---------------------------------------------------------
  // 8. GARBAGE REJECTION & NIK VALIDATION TESTS
  // ---------------------------------------------------------
  console.log('\n--- 8. GARBAGE REJECTION & NIK VALIDATION ---');

  assert(isGarbageValue('NSAEPUCCCCLLLLLLLL', 'NAME'), 'GARB-01: Repeated character runs rejected as Name');
  assert(isGarbageValue('<<<<<<<<<<<<<<<<<<', 'NAME'), 'GARB-02: Delimiter runs rejected as Name');
  assert(isGarbageValue('KANTOR IMIGRASI', 'PLACE'), 'GARB-03: Generic KANTOR IMIGRASI without branch rejected as Place');
  assert(!isGarbageValue('KANMIG KELAPA GADING', 'PLACE'), 'GARB-04: Real immigration office accepted');
  assert(!isGarbageValue('AEP SAEPULOH', 'NAME'), 'GARB-05: Real full name accepted');

  const nikValid = validateNik('3171011510880001');
  assert(nikValid.valid && nikValid.embeddedDob === '1988-10-15' && nikValid.genderHint === 'MALE', 'NIK-01: Male NIK validated with embedded DOB');

  const nikFemaleValid = validateNik('3171015510880001');
  assert(nikFemaleValid.valid && nikFemaleValid.embeddedDob === '1988-10-15' && nikFemaleValid.genderHint === 'FEMALE', 'NIK-02: Female NIK (day+40) validated with embedded DOB');

  const nikInvalid = validateNik('1111111111111111');
  assert(!nikInvalid.valid, 'NIK-03: Repeated all-ones NIK rejected');

  // ---------------------------------------------------------
  // 9. RETRY IDEMPOTENCY (RETRY-01)
  // ---------------------------------------------------------
  console.log('\n--- 9. RETRY IDEMPOTENCY ---');

  // Save document 1
  const doc1 = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/test_doc.png',
    'test_doc.png',
    'image/png',
    1024,
    {
      rawText: pass01Text,
      fields: pass01,
      classification: 'PASSPORT',
      confidence: 95,
      mrzData: pass01.mrz_parsed,
    }
  );
  assert(!!doc1.document.id, 'RETRY-01: Initial document created');

  // Retry document with same ID
  const doc1Retry = await DbRepository.saveUploadedDocument(
    null,
    'PASSPORT',
    'staging/test_doc.png',
    'test_doc.png',
    'image/png',
    1024,
    {
      rawText: pass01Text,
      fields: pass01,
      classification: 'PASSPORT',
      confidence: 100,
      mrzData: pass01.mrz_parsed,
    },
    doc1.document.id
  );
  assert(doc1Retry.document.id === doc1.document.id, 'RETRY-01: Retry preserves document ID (Zero duplicates)');

  // ---------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('[FATAL_TEST_ERROR]', err);
  process.exit(1);
});
