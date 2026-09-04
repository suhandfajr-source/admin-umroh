/**
 * Helper & Types for Surat Rekomendasi Pembuatan / Penggantian Paspor Umrah
 */

export interface LetterSettings {
  // Uploaded Assets
  letterheadImageUrl: string; // Base64 or URL
  hasLetterheadImage: boolean;
  signatureImageUrl: string; // Base64 or URL
  hasSignatureImage: boolean;
  useDigitalSignature: boolean;

  // Custom Word .docx Template
  customDocxTemplateBase64?: string;
  customDocxTemplateName?: string;
  hasCustomDocxTemplate?: boolean;

  // Format & Information
  letterNumberFormat: string; // e.g. "{NO}/REK-PASPOR/PPIU/{ROMAN_MONTH}/{YEAR}"
  lastNumberSequence: number;
  city: string;
  signatoryName: string;
  signatoryRole: string;

  // Company Profile (Fallback when text letterhead is used)
  companyName: string;
  companyLegalNumber: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  useDigitalLetterhead: boolean;
}

export interface PassportRecommendationLetterData {
  letterNumber: string;
  letterDate: string; // e.g. "2026-09-02"
  departureDate: string; // e.g. "2026-11-15"
  immigrationOffice: string; // e.g. "Kepala Kantor Imigrasi Kelas I Khusus Non TPI Jakarta Selatan"
  purpose: 'PEMBUATAN_BARU' | 'PERPANJANGAN_PENGGANTIAN' | 'HALAMAN_PENUH' | 'RUSAK_HILANG';
  packageName?: string;
  
  // Data Jamaah from KTP/KK/Master
  jamaahName: string;
  nik?: string;
  kkNumber?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE' | string;
  address?: string;
  phone?: string;
  
  // Letterhead & Signature Assets
  letterheadImageUrl?: string;
  useUploadedLetterhead: boolean;
  signatureImageUrl?: string;
  useDigitalSignature: boolean;

  // Signatory & Profile
  companyName: string;
  companyLegalNumber: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  city: string;
  signatoryName: string;
  signatoryRole: string;
}

export const DEFAULT_LETTER_SETTINGS: LetterSettings = {
  letterheadImageUrl: '',
  hasLetterheadImage: false,
  signatureImageUrl: '',
  hasSignatureImage: false,
  useDigitalSignature: true,
  customDocxTemplateBase64: '',
  customDocxTemplateName: '',
  hasCustomDocxTemplate: false,
  letterNumberFormat: '{NO}/REK-PASPOR/PPIU/{ROMAN_MONTH}/{YEAR}',
  lastNumberSequence: 1,
  city: 'Bogor',
  signatoryName: 'H. Muhammad Abdullah, S.E.',
  signatoryRole: 'Direktur Utama',
  companyName: 'PT. TRAVEL UMROH INDONESIA',
  companyLegalNumber: 'Izin Kemenag RI No. PPIU Terdaftar',
  companyAddress: 'Cibubur Country RBOD, Bogor, Jawa Barat 16966',
  companyPhone: '+62 899-9586-999',
  companyEmail: 'info@travelumroh.co.id',
  useDigitalLetterhead: true,
};

const STORAGE_KEY = 'admin_umroh_letter_settings';

export function getStoredLetterSettings(): LetterSettings {
  if (typeof window === 'undefined') return DEFAULT_LETTER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LETTER_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LETTER_SETTINGS,
      ...parsed,
      hasLetterheadImage: !!parsed.letterheadImageUrl,
      hasSignatureImage: !!parsed.signatureImageUrl,
      hasCustomDocxTemplate: !!parsed.customDocxTemplateBase64,
    };
  } catch {
    return DEFAULT_LETTER_SETTINGS;
  }
}

/**
 * Utility to compress and resize image before storing in Base64 / LocalStorage.
 * Ensures the image stays crisp for A4 print while keeping file size under 350KB.
 */
export async function compressImageFile(file: File, maxDimension = 1800, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File yang dipilih bukan gambar (gunakan PNG, JPG, atau WEBP).'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('File gambar rusak atau tidak valid'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Use high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP or JPEG for optimal compression
        const mimeType = file.type === 'image/png' && file.size < 800000 ? 'image/png' : 'image/jpeg';
        const compressedBase64 = canvas.toDataURL(mimeType, quality);
        resolve(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function saveStoredLetterSettings(settings: Partial<LetterSettings>): LetterSettings {
  if (typeof window === 'undefined') return DEFAULT_LETTER_SETTINGS;
  try {
    const current = getStoredLetterSettings();
    const updated: LetterSettings = {
      ...current,
      ...settings,
      hasLetterheadImage: settings.letterheadImageUrl !== undefined ? !!settings.letterheadImageUrl : current.hasLetterheadImage,
      hasSignatureImage: settings.signatureImageUrl !== undefined ? !!settings.signatureImageUrl : current.hasSignatureImage,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
    return DEFAULT_LETTER_SETTINGS;
  }
}

export function toRomanMonth(monthIndexOneBased: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[monthIndexOneBased - 1] || 'I';
}

export function formatLetterNumber(
  formatTemplate: string,
  sequenceNumber: number,
  date: Date = new Date()
): string {
  const year = date.getFullYear().toString();
  const monthNumber = date.getMonth() + 1;
  const monthTwoDigits = monthNumber.toString().padStart(2, '0');
  const romanMonth = toRomanMonth(monthNumber);
  const sequenceStr = sequenceNumber.toString().padStart(3, '0');

  return formatTemplate
    .replace(/{NO}/g, sequenceStr)
    .replace(/{ROMAN_MONTH}/g, romanMonth)
    .replace(/{MONTH}/g, monthTwoDigits)
    .replace(/{YEAR}/g, year);
}

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatIndonesianDate(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = d.getDate();
    const month = INDONESIAN_MONTHS[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
}
