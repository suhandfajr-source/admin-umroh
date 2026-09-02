/**
 * Image & PDF Preprocessing, Buffer Validation, and Limits
 * Safe memory-buffer inspection and zone calculation without altering the original file
 */

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_PDF_PAGES = 10;
export const OCR_DEFAULT_TIMEOUT_MS = 60000; // 60s
export const PDF_PROCESSING_TIMEOUT_MS = 90000; // 90s

export interface PreprocessingResult {
  valid: boolean;
  mimeType: string;
  sizeBytes: number;
  warnings: string[];
  errorCode?: 'FILE_TOO_LARGE' | 'PDF_TOO_MANY_PAGES' | 'PDF_CORRUPTED' | 'PDF_PASSWORD_PROTECTED' | 'UNSUPPORTED_FORMAT';
  errorMessage?: string;
}

export class PreprocessingService {
  /**
   * Validates file buffer integrity, MIME type, and size limits before OCR / PDF processing
   */
  public static validateBuffer(buffer: Buffer, mimeType: string): PreprocessingResult {
    const warnings: string[] = [];

    if (!buffer || buffer.length === 0) {
      return { 
        valid: false, 
        mimeType, 
        sizeBytes: 0, 
        warnings: ['Ukuran berkas kosong (0 byte)'],
        errorCode: 'UNSUPPORTED_FORMAT',
        errorMessage: 'Berkas kosong atau tidak dapat dibaca.'
      };
    }

    const sizeBytes = buffer.length;

    // 1. File Size Limit (15 MB)
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        mimeType,
        sizeBytes,
        warnings: ['Ukuran file melebihi batas maksimal 15 MB.'],
        errorCode: 'FILE_TOO_LARGE',
        errorMessage: 'Ukuran file terlalu besar. Maksimal 15 MB.'
      };
    }

    // 2. Minimum size check
    if (sizeBytes < 50) {
      warnings.push('Ukuran berkas sangat kecil, kemungkinan berkas rusak.');
    }

    const normalizedMime = mimeType.toLowerCase();

    // 3. Magic Bytes / Header Validation
    if (normalizedMime === 'application/pdf') {
      // PDF magic bytes: %PDF (0x25, 0x50, 0x44, 0x46)
      const isPdf = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
      if (!isPdf) {
        return {
          valid: false,
          mimeType,
          sizeBytes,
          warnings: ['Header berkas PDF tidak valid.'],
          errorCode: 'PDF_CORRUPTED',
          errorMessage: 'File PDF tidak dapat dibaca atau rusak. Silakan unggah ulang atau gunakan versi lain.'
        };
      }

      // Check for password protection indicator in PDF dictionary (/Encrypt)
      const headerSample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf-8');
      const trailerSample = buffer.subarray(Math.max(0, buffer.length - 4096)).toString('utf-8');
      if (headerSample.includes('/Encrypt') || trailerSample.includes('/Encrypt')) {
        return {
          valid: false,
          mimeType,
          sizeBytes,
          warnings: ['PDF terenkripsi atau dilindungi kata sandi.'],
          errorCode: 'PDF_PASSWORD_PROTECTED',
          errorMessage: 'PDF dilindungi kata sandi dan tidak dapat diproses. Silakan unggah PDF tanpa password atau gunakan gambar.'
        };
      }
    } else if (normalizedMime === 'image/png') {
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      if (!isPng) {
        warnings.push('Header PNG tidak standar.');
      }
    } else if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') {
      const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8;
      if (!isJpg) {
        warnings.push('Header JPEG tidak standar.');
      }
    } else {
      return {
        valid: false,
        mimeType,
        sizeBytes,
        warnings: [`Format ${mimeType} tidak didukung.`],
        errorCode: 'UNSUPPORTED_FORMAT',
        errorMessage: 'Format file tidak didukung. Gunakan PNG, JPG, JPEG, atau PDF.'
      };
    }

    return {
      valid: true,
      mimeType,
      sizeBytes,
      warnings,
    };
  }

  /**
   * Identifies candidate OCR zones for multi-pass OCR extraction
   */
  public static getDocumentZones(documentType: string): Array<{ name: string; description: string }> {
    switch (documentType) {
      case 'PASSPORT':
        return [
          { name: 'VISUAL_ZONE', description: 'Visual biographical page (top 75%)' },
          { name: 'MRZ_ZONE', description: 'ICAO TD3 Machine Readable Zone (bottom 25%)' },
        ];
      case 'KTP':
        return [
          { name: 'IDENTITY_ZONE', description: 'NIK, Nama, Tempat/Tgl Lahir (top & middle)' },
          { name: 'ADDRESS_ZONE', description: 'Alamat, RT/RW, Kel/Kec (middle)' },
          { name: 'OTHER_ZONE', description: 'Agama, Status, Pekerjaan (bottom)' },
        ];
      case 'KK':
        return [
          { name: 'HEADER_ZONE', description: 'No. KK, Kepala Keluarga, Alamat (top)' },
          { name: 'MEMBERS_TABLE_ZONE', description: 'Tabel Anggota Keluarga (middle/bottom)' },
        ];
      default:
        return [{ name: 'FULL_PAGE', description: 'Full Page' }];
    }
  }
}
