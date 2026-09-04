import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { 
  PassportRecommendationLetterData, 
  formatIndonesianDate, 
  getStoredLetterSettings 
} from './recommendation-letter';

/**
 * Native helper to download a Blob as a file in the browser
 */
function saveBlobAsFile(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

/**
 * Creates a clean default DOCX document XML structure
 * Contains standard Kop Surat, Official Letter Layout, and Placeholders.
 */
function createDefaultDocxZip(): PizZip {
  const zip = new PizZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  // _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // word/styles.xml
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="id-ID"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`);

  // word/document.xml (Official Standard Passport Letter with tags)
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- KOP SURAT RESMI -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="60" w:line="240" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="32"/>
        </w:rPr>
        <w:t>{nama_travel}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="40" w:line="220" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>PENYELENGGARA PERJALANAN IBADAH UMRAH (PPIU)</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="40" w:line="200" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
        </w:rPr>
        <w:t>{izin_kemenag}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="160" w:line="200" w:lineRule="auto"/>
        <w:pBdr>
          <w:bottom w:val="double" w:sz="12" w:space="4" w:color="000000"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
        </w:rPr>
        <w:t>{alamat_travel} | Telp: {telepon_travel} | Email: {email_travel}</w:t>
      </w:r>
    </w:p>

    <!-- NOMOR SURAT & TANGGAL -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="3000" w:type="pct"/></w:tcPr>
          <w:p><w:r><w:t>Nomor : {nomor_surat}</w:t></w:r></w:p>
          <w:p><w:r><w:t>Lamp. : -</w:t></w:r></w:p>
          <w:p><w:r><w:t>Hal : Permohonan Rekomendasi Pembuatan Paspor</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="pct"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>{kota_surat}, {tanggal_surat}</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- TUJUAN SURAT -->
    <w:p><w:pPr><w:spacing w:before="240" w:after="40"/></w:pPr>
      <w:r><w:t>Kepada Yth.</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{kantor_imigrasi}</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="200"/></w:pPr>
      <w:r><w:t>di Tempat</w:t></w:r>
    </w:p>

    <!-- SALAM & PEMBUKA -->
    <w:p><w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Assalamu'alaikum Warahmatullahi Wabarakatuh,</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="160"/><w:jc w:val="both"/></w:pPr>
      <w:r><w:t>Yang bertanda tangan di bawah ini pimpinan Penyelenggara Perjalanan Ibadah Umrah (PPIU) </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{nama_travel}</w:t></w:r>
      <w:r><w:t>, dengan ini menerangkan dengan sebenarnya bahwa:</w:t></w:r>
    </w:p>

    <!-- TABEL BIODATA JAMAAH -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblInd w:w="300" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="pct"/></w:tcPr><w:p><w:r><w:t>Nama Lengkap</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>:</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3200" w:type="pct"/></w:tcPr><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{nama_jamaah}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="pct"/></w:tcPr><w:p><w:r><w:t>NIK (KTP)</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>:</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>{nik}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="pct"/></w:tcPr><w:p><w:r><w:t>Tempat, Tgl Lahir</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>:</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>{tempat_lahir}, {tanggal_lahir}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="pct"/></w:tcPr><w:p><w:r><w:t>Jenis Kelamin</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>:</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>{jenis_kelamin}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1600" w:type="pct"/></w:tcPr><w:p><w:r><w:t>Alamat (KTP)</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>:</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="3200" w:type="pct"/></w:tcPr><w:p><w:r><w:t>{alamat}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <!-- PENJELASAN KEBERANGKATAN -->
    <w:p><w:pPr><w:spacing w:before="160" w:after="140"/><w:jc w:val="both"/></w:pPr>
      <w:r><w:t>Adalah benar calon jamaah program perjalanan Ibadah Umrah kami dan direncanakan akan diberangkatkan ke Tanah Suci pada tanggal:</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>{tanggal_keberangkatan}</w:t></w:r>
    </w:p>

    <!-- PERMOHONAN -->
    <w:p><w:pPr><w:spacing w:after="140"/><w:jc w:val="both"/></w:pPr>
      <w:r><w:t>Sehubungan dengan hal tersebut di atas, kami memohon bantuan Bapak/Ibu Kepala Kantor Imigrasi agar dapat menerbitkan / memproses </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>{keperluan}</w:t></w:r>
      <w:r><w:t> atas nama yang bersangkutan sebagai dokumen kelengkapan perjalanan Ibadah Umrah ke Tanah Suci Arab Saudi.</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:spacing w:after="240"/><w:jc w:val="both"/></w:pPr>
      <w:r><w:t>Demikian surat rekomendasi ini kami buat dengan sebenarnya dan penuh tanggung jawab untuk dapat dipergunakan sebagaimana mestinya.</w:t></w:r>
    </w:p>

    <!-- PENUTUP & TANDA TANGAN -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="2600" w:type="pct"/></w:tcPr><w:p/></w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2400" w:type="pct"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>{kota_surat}, {tanggal_surat}</w:t></w:r></w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>{nama_travel}</w:t></w:r></w:p>
          <w:p><w:pPr><w:spacing w:before="600" w:after="40"/><w:jc w:val="center"/></w:pPr>
            <w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>{nama_pimpinan}</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r><w:t>{jabatan_pimpinan}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

  </w:body>
</w:document>`);

  return zip;
}

/**
 * Converts Base64 data string to ArrayBuffer / PizZip
 */
function base64ToZip(base64: string): PizZip {
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = window.atob(pureBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new PizZip(bytes.buffer);
}

/**
 * Generate DOCX Blob with injected variables
 */
export async function generatePassportDocxBlob(
  data: PassportRecommendationLetterData,
  customTemplateBase64?: string
): Promise<Blob> {
  const settings = getStoredLetterSettings();

  const getPurposeText = (p: string) => {
    switch (p) {
      case 'PEMBUATAN_BARU':
        return 'Pembuatan Paspor Baru (Umrah)';
      case 'PERPANJANGAN_PENGGANTIAN':
        return 'Penggantian / Perpanjangan Paspor (Habis Masa Berlaku)';
      case 'HALAMAN_PENUH':
        return 'Penggantian Paspor (Halaman Penuh)';
      case 'RUSAK_HILANG':
        return 'Penggantian Paspor (Rusak / Hilang)';
      default:
        return 'Pembuatan / Penggantian Paspor';
    }
  };

  const getGenderText = (g?: string | null) => {
    if (!g) return '-';
    if (g === 'MALE' || g === 'L' || g.toLowerCase() === 'laki-laki') return 'Laki-Laki';
    if (g === 'FEMALE' || g === 'P' || g.toLowerCase() === 'perempuan') return 'Perempuan';
    return g;
  };

  // Variable payload for docxtemplater tags
  const tagsData = {
    nomor_surat: data.letterNumber || '001/REK-PASPOR/PPIU/IX/2026',
    tanggal_surat: formatIndonesianDate(data.letterDate),
    kantor_imigrasi: data.immigrationOffice || 'Kepala Kantor Imigrasi di Tempat',
    nama_jamaah: data.jamaahName || '-',
    nik: data.nik || '-',
    no_kk: data.kkNumber || '-',
    tempat_lahir: data.birthPlace || '-',
    tanggal_lahir: formatIndonesianDate(data.birthDate),
    jenis_kelamin: getGenderText(data.gender),
    alamat: data.address || '-',
    telepon_jamaah: data.phone || '-',
    keperluan: getPurposeText(data.purpose),
    tanggal_keberangkatan: formatIndonesianDate(data.departureDate),
    nama_paket: data.packageName || 'Paket Umrah Reguler',

    // Company & Signatory
    nama_travel: data.companyName || settings.companyName || 'PT. TRAVEL UMROH INDONESIA',
    izin_kemenag: data.companyLegalNumber || settings.companyLegalNumber || 'Izin Kemenag RI No. PPIU Terdaftar',
    alamat_travel: data.companyAddress || settings.companyAddress || 'Alamat Kantor Travel Umroh',
    telepon_travel: data.companyPhone || settings.companyPhone || '-',
    email_travel: data.companyEmail || settings.companyEmail || '-',
    kota_surat: data.city || settings.city || 'Bogor',
    nama_pimpinan: data.signatoryName || settings.signatoryName || 'Direktur Utama',
    jabatan_pimpinan: data.signatoryRole || settings.signatoryRole || 'Direktur Utama',
  };

  let zip: PizZip;

  if (customTemplateBase64) {
    try {
      zip = base64ToZip(customTemplateBase64);
    } catch (e) {
      console.warn('Custom DOCX template failed to load, falling back to default template', e);
      zip = createDefaultDocxZip();
    }
  } else {
    zip = createDefaultDocxZip();
  }

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  // Render document with data
  doc.render(tagsData);

  const out = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return out;
}

/**
 * Downloads the populated DOCX directly to the user's computer
 */
export async function downloadPassportDocx(
  data: PassportRecommendationLetterData,
  customTemplateBase64?: string
): Promise<void> {
  const blob = await generatePassportDocxBlob(data, customTemplateBase64);
  const cleanName = (data.jamaahName || 'Jamaah').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Surat_Rekomendasi_Paspor_${cleanName}.docx`;
  saveBlobAsFile(blob, filename);
}

/**
 * Downloads a sample template with ready-to-use tags for the Admin
 */
export async function downloadSamplePassportDocxTemplate(): Promise<void> {
  const zip = createDefaultDocxZip();
  const blob = zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveBlobAsFile(blob, 'Template_Surat_Rekomendasi_Paspor.docx');
}
