import { DocumentType } from './database.types';

export type FieldSource = 'PDF_TEXT' | 'PDF_OCR' | 'MRZ' | 'OCR_VISUAL' | 'OCR_TABLE' | 'OCR_ZONE' | 'MANUAL';
export type FieldConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type PdfProcessingMode = 'PDF_TEXT_BASED' | 'PDF_IMAGE_BASED' | 'PDF_MIXED';

export interface ExtractedPassportData {
  passport_name?: string;
  passport_number?: string;
  birth_place?: string;
  birth_date?: string; // YYYY-MM-DD
  gender?: 'MALE' | 'FEMALE';
  passport_issue_place?: string;
  passport_issue_date?: string; // YYYY-MM-DD
  passport_expiry_date?: string; // YYYY-MM-DD
  nationality?: string;
  field_sources?: Record<string, FieldSource>;
  field_confidences?: Record<string, FieldConfidence>;
  conflicts?: string[];
  page_number?: number;
  mrz_lines?: string[];
  mrz_parsed?: {
    valid: boolean;
    raw_mrz?: string;
    document_code?: string;
    issuing_state?: string;
    passport_number?: string;
    nationality?: string;
    birth_date?: string;
    sex?: string;
    expiry_date?: string;
    personal_number?: string;
  };
}

export interface ExtractedKtpData {
  nik?: string;
  ktp_name?: string;
  birth_place?: string;
  birth_date?: string; // YYYY-MM-DD
  gender?: 'MALE' | 'FEMALE';
  address?: string;
  rt_rw?: string;
  kelurahan?: string;
  kecamatan?: string;
  city?: string;
  province?: string;
  religion?: string;
  marital_status?: string;
  occupation?: string;
  citizenship?: string;
  field_sources?: Record<string, FieldSource>;
  field_confidences?: Record<string, FieldConfidence>;
  conflicts?: string[];
  page_number?: number;
}

export interface KkFamilyMember {
  id: string; // generated temp id for selection
  nik?: string;
  name: string;
  gender?: 'MALE' | 'FEMALE';
  birth_place?: string;
  birth_date?: string; // YYYY-MM-DD
  relationship?: string; // Kepala Keluarga, Istri, Anak, etc.
  religion?: string;
  occupation?: string;
  marital_status?: string;
  selected?: boolean;
  confidence?: FieldConfidence;
}

export interface ExtractedKkData {
  kk_number?: string;
  head_of_family?: string;
  address?: string;
  rt_rw?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupaten_kota?: string;
  province?: string;
  postal_code?: string;
  members: KkFamilyMember[];
  field_sources?: Record<string, FieldSource>;
  field_confidences?: Record<string, FieldConfidence>;
  conflicts?: string[];
  page_number?: number;
}

export interface ExtractedVaksinData {
  recipient_name?: string;
  nik?: string;
  passport_number?: string;
  vaccine_name?: string;
  dose?: string; // Dosis 1, Dosis 2, Booster 1
  vaccination_date?: string; // YYYY-MM-DD
  certificate_number?: string;
  facility_name?: string;
  notes?: string;
  field_sources?: Record<string, FieldSource>;
  field_confidences?: Record<string, FieldConfidence>;
  conflicts?: string[];
  page_number?: number;
}

export interface ExtractedBukuNikahData {
  husband_name?: string;
  wife_name?: string;
  husband_nik?: string;
  wife_nik?: string;
  marriage_date?: string; // YYYY-MM-DD
  marriage_number?: string; // No. Akta / Pendaftaran Nikah
  kua_name?: string;
  marriage_place?: string;
  notes?: string;
  field_sources?: Record<string, FieldSource>;
  field_confidences?: Record<string, FieldConfidence>;
  conflicts?: string[];
  page_number?: number;
}

export interface DocumentClassificationResult {
  detected_type: DocumentType;
  confidence: number;
  signals: string[];
}

export interface DocumentExtractionResult {
  document_type: DocumentType;
  confidence: number;
  raw_text: string;
  fields: ExtractedPassportData | ExtractedKtpData | ExtractedKkData | ExtractedVaksinData | ExtractedBukuNikahData | Record<string, any>;
  mrz_data?: Record<string, any>;
  quality_warnings: string[];
  field_sources?: Record<string, FieldSource>;
  field_confidences?: Record<string, FieldConfidence>;
  conflicts?: string[];
  page_count?: number;
  page_number?: number;
  pdf_mode?: PdfProcessingMode;
}

export interface DuplicateMatchDetail {
  matched_jamaah_id: string;
  matched_jamaah_name: string;
  matched_field: 'PASSPORT_NUMBER' | 'NIK' | 'NAME_AND_DOB' | 'KK_AND_NAME';
  match_confidence: 'HIGH' | 'MEDIUM';
  reason: string;
  existing_record: any;
}
