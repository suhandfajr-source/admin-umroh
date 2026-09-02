import { 
  AdminUser, 
  Jamaah, 
  DocumentRecord, 
  DocumentExtraction, 
  Package, 
  PIC, 
  PackageParticipant, 
  DocumentType, 
  DocumentStatus, 
  Invoice, 
  InvoiceItem, 
  Payment, 
  PaymentAllocation, 
  InvoiceStatus, 
  InvoiceItemType, 
  InvoiceDiscountCategory, 
  PaymentAllocationStatus, 
  PaymentStatus, 
  AllocationStatus, 
  FinanceOverviewMetrics, 
  PackageFinanceReport, 
  PaxFinanceDetail, 
  PicFinanceBreakdown, 
  ManifestTemplate, 
  ManifestSystemField, 
  ManifestValidationSummary, 
  ExportJob, 
  ExportType, 
  PackageDocumentCompleteness, 
  DocumentArchiveItem, 
  EquipmentCategory, 
  EquipmentApplicability, 
  EquipmentFulfillmentStatus, 
  EquipmentEventType, 
  EquipmentItem, 
  EquipmentVariant, 
  PackageEquipmentItem, 
  ParticipantEquipment, 
  EquipmentEvent, 
  PackageEquipmentRecap, 
  PackageEquipmentSummaryItem, 
  VariantBreakdownItem, 
  ParticipantEquipmentItemDetail, 
  ParticipantEquipmentRow,
  OperationalAlert,
  AuditLog
} from '@/types/database.types';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectDuplicate } from '@/lib/duplicate-detector';
import { evaluatePassportHealth } from '@/lib/passport-health';
import { ManifestValidator } from '@/lib/export/manifest-validator';
import { ManifestGenerator, ManifestExportOptions } from '@/lib/export/manifest-generator';
import { FinanceExportService, FinanceExportFilterOptions } from '@/lib/export/finance-export';
import { PaymentExportService } from '@/lib/export/payment-export';
import { DocumentZipService, DocumentZipFilterOptions, DocumentZipPreviewResult } from '@/lib/export/document-zip';
import { ExportCleanupService } from '@/lib/export/cleanup-service';
import { AuditService } from '@/lib/audit/audit-service';
import fs from 'fs';
import path from 'path';
import { queryTiDB } from '@/lib/db/tidb';

const DEFAULT_EQUIPMENT_ITEMS: EquipmentItem[] = [
  { id: 'eq_koper', name: 'Koper Bagasi', category: 'BAG', description: 'Koper bagasi 24 inch standar jamaah', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_kabin', name: 'Tas Kabin', category: 'BAG', description: 'Tas jinjing / ransel kabin pesawat', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_paspor', name: 'Tas Paspor', category: 'BAG', description: 'Tas selempang kecil tempat paspor & dokumen', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_batik', name: 'Baju Batik Seragam', category: 'APPAREL', description: 'Baju seragam batik resmi travel', requires_variant: true, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_ihram', name: 'Kain Ihram', category: 'IBADAH', description: '2 lembar kain ihram khusus jamaah pria', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_mukena', name: 'Mukena & Bergo', category: 'IBADAH', description: 'Set mukena seragam khusus jamaah wanita', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_syal', name: 'Syal Jamaah', category: 'ACCESSORY', description: 'Syal identitas rombongan travel', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_idcard', name: 'ID Card & Tali', category: 'IDENTITY', description: 'Kartu identitas gantung jamaah', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_buku', name: 'Buku Panduan Doa', category: 'DOCUMENT', description: 'Buku saku kumpulan doa dan manasik umrah', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'eq_botol', name: 'Botol Minum Zamzam', category: 'ACCESSORY', description: 'Tumbler minum untuk tawaf & ziarah', requires_variant: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const DEFAULT_EQUIPMENT_VARIANTS: EquipmentVariant[] = [
  { id: 'var_batik_s', equipment_item_id: 'eq_batik', label: 'S', sort_order: 1, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'var_batik_m', equipment_item_id: 'eq_batik', label: 'M', sort_order: 2, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'var_batik_l', equipment_item_id: 'eq_batik', label: 'L', sort_order: 3, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'var_batik_xl', equipment_item_id: 'eq_batik', label: 'XL', sort_order: 4, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'var_batik_xxl', equipment_item_id: 'eq_batik', label: 'XXL', sort_order: 5, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'var_batik_3xl', equipment_item_id: 'eq_batik', label: '3XL', sort_order: 6, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// In-memory runtime cache/store for zero-lag dev, unit testing, and offline fallback
interface StoreState {
  admin_users: AdminUser[];
  jamaah: Jamaah[];
  documents: DocumentRecord[];
  document_extractions: DocumentExtraction[];
  packages: Package[];
  pics: PIC[];
  package_participants: PackageParticipant[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
  payments: Payment[];
  payment_allocations: PaymentAllocation[];
  manifest_templates: ManifestTemplate[];
  export_jobs: ExportJob[];
  equipment_items: EquipmentItem[];
  equipment_item_variants: EquipmentVariant[];
  package_equipment_items: PackageEquipmentItem[];
  participant_equipment: ParticipantEquipment[];
  equipment_events: EquipmentEvent[];
  operational_alerts: OperationalAlert[];
  audit_logs: AuditLog[];
}

const globalForStore = globalThis as unknown as { __DB_STORE__?: StoreState };
const initialStoreTemplate: StoreState = {
  admin_users: [
    {
      id: 'admin-1',
      auth_user_id: 'auth-admin-1',
      email: 'admin@travelumroh.com',
      name: 'Super Admin Umroh',
      role: 'ADMIN',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  // Production initial state has ZERO dummy business records
  jamaah: [],
  documents: [],
  document_extractions: [],
  packages: [],
  pics: [],
  package_participants: [],
  invoices: [],
  invoice_items: [],
  payments: [],
  payment_allocations: [],
  manifest_templates: [
    {
      id: 'tmpl_std_airline',
      name: 'Standard Umrah Airline Manifest',
      worksheet_name: 'Manifest',
      header_row: 4,
      data_start_row: 5,
      field_mapping: {
        A: 'no',
        B: 'passport_name',
        C: 'passport_number',
        D: 'gender',
        E: 'birth_place',
        F: 'birth_date',
        G: 'passport_issue_place',
        H: 'passport_issue_date',
        I: 'passport_expiry_date',
        J: 'nik',
        K: 'phone',
        L: 'pic_name',
      },
      date_formats: {
        birth_date: 'YYYY-MM-DD',
        passport_issue_date: 'YYYY-MM-DD',
        passport_expiry_date: 'YYYY-MM-DD',
      },
      value_transformations: {
        gender: { MALE: 'M', FEMALE: 'F' },
      },
      is_active: true,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  export_jobs: [],
  equipment_items: JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT_ITEMS)),
  equipment_item_variants: JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT_VARIANTS)),
  package_equipment_items: [],
  participant_equipment: [],
  equipment_events: [],
  operational_alerts: [],
  audit_logs: [],
};

const globalStore: StoreState = globalForStore.__DB_STORE__ || initialStoreTemplate;
globalForStore.__DB_STORE__ = globalStore;

const DB_FILE_PATH = path.resolve(process.cwd(), '.data', 'db_store.json');

function syncStoreFromDisk() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(globalStore, parsed);
      }
    }
  } catch (e) {
    console.warn('[DB_LOAD_ERROR]', e);
  }
}

function syncStoreToDisk() {
  try {
    fs.mkdirSync(path.dirname(DB_FILE_PATH), { recursive: true });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(globalStore, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[DB_SAVE_ERROR]', e);
  }
}

// Initial sync on startup
syncStoreFromDisk();

export class DbRepository {
  public static resetStore(): void {
    globalStore.jamaah = [];
    globalStore.documents = [];
    globalStore.document_extractions = [];
    globalStore.packages = [];
    globalStore.pics = [];
    globalStore.package_participants = [];
    globalStore.invoices = [];
    globalStore.invoice_items = [];
    globalStore.payments = [];
    globalStore.payment_allocations = [];
    globalStore.export_jobs = [];
    globalStore.manifest_templates = [
      {
        id: 'tmpl_std_airline',
        name: 'Standard Umrah Airline Manifest',
        worksheet_name: 'Manifest',
        header_row: 4,
        data_start_row: 5,
        field_mapping: {
          A: 'no',
          B: 'passport_name',
          C: 'passport_number',
          D: 'gender',
          E: 'birth_place',
          F: 'birth_date',
          G: 'passport_issue_place',
          H: 'passport_issue_date',
          I: 'passport_expiry_date',
          J: 'nik',
          K: 'phone',
          L: 'pic_name',
        },
        date_formats: {
          birth_date: 'YYYY-MM-DD',
          passport_issue_date: 'YYYY-MM-DD',
          passport_expiry_date: 'YYYY-MM-DD',
        },
        value_transformations: {
          gender: { MALE: 'M', FEMALE: 'F' },
        },
        is_active: true,
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];
    globalStore.equipment_items = JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT_ITEMS));
    globalStore.equipment_item_variants = JSON.parse(JSON.stringify(DEFAULT_EQUIPMENT_VARIANTS));
    globalStore.package_equipment_items = [];
    globalStore.participant_equipment = [];
    globalStore.equipment_events = [];
    globalStore.operational_alerts = [];
    globalStore.audit_logs = [];
    syncStoreToDisk();
  }

  public static getStoreState(): StoreState {
    return globalStore;
  }

  private static isSupabaseLive(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!(url && !url.includes('dummy-umroh.supabase.co'));
  }

  private static isTiDBLive(): boolean {
    return true; // TiDB Cloud is always active via pool configuration with fallback
  }

  // ==========================================
  // JAMAAH
  // ==========================================
  public static async getJamaahList(filters?: {
    search?: string;
    packageId?: string;
    picId?: string;
    docStatus?: string;
    passportHealth?: string;
  }): Promise<Jamaah[]> {
    if (this.isSupabaseLive()) {
      const supabase = createAdminClient();
      let query = supabase.from('jamaah').select('*').is('deleted_at', null);
      
      if (filters?.search) {
        const s = filters.search;
        query = query.or(`identity_name.ilike.%${s}%,passport_name.ilike.%${s}%,passport_number.ilike.%${s}%,nik.ilike.%${s}%,phone.ilike.%${s}%`);
      }
      
      const { data, error } = await query;
      if (!error && data) return data as Jamaah[];
    }

    if (this.isTiDBLive()) {
      try {
        let sql = 'SELECT * FROM jamaah WHERE deleted_at IS NULL';
        const params: any[] = [];
        if (filters?.search) {
          const s = `%${filters.search}%`;
          sql += ' AND (identity_name LIKE ? OR passport_name LIKE ? OR ktp_name LIKE ? OR passport_number LIKE ? OR nik LIKE ? OR phone LIKE ?)';
          params.push(s, s, s, s, s, s);
        }
        sql += ' ORDER BY created_at DESC';
        const rows = await queryTiDB<any>(sql, params);
        if (rows) {
          let allDocs: DocumentRecord[] = [];
          try {
            allDocs = await queryTiDB<DocumentRecord>('SELECT * FROM documents');
          } catch {}

          return rows.map(j => {
            const jDocs = (allDocs || []).filter(d => d.jamaah_id === j.id);
            const birth = j.birth_date ? new Date(j.birth_date).toISOString().split('T')[0] : null;
            const issue = j.passport_issue_date ? new Date(j.passport_issue_date).toISOString().split('T')[0] : null;
            const expiry = j.passport_expiry_date ? new Date(j.passport_expiry_date).toISOString().split('T')[0] : null;
            const health = evaluatePassportHealth({ ...j, passport_expiry_date: expiry });

            return {
              ...j,
              birth_date: birth,
              passport_issue_date: issue,
              passport_expiry_date: expiry,
              documents: jDocs,
              active_package: null,
              latest_departure: '-',
              trips_count: 0,
              passport_warning: health.status,
            };
          });
        }
      } catch (err) {
        console.warn('[TIDB_GET_JAMAAH_LIST_ERROR]', err);
      }
    }

    // In-memory query with full filter capabilities
    let list = globalStore.jamaah.filter(j => !j.deleted_at);

    if (filters?.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(j => 
        (j.identity_name && j.identity_name.toLowerCase().includes(s)) ||
        (j.passport_name && j.passport_name.toLowerCase().includes(s)) ||
        (j.ktp_name && j.ktp_name.toLowerCase().includes(s)) ||
        (j.id && j.id.toLowerCase().includes(s)) ||
        ((j as any).member_id && (j as any).member_id.toLowerCase().includes(s)) ||
        (j.passport_number && j.passport_number.toLowerCase().includes(s)) ||
        (j.nik && j.nik.toLowerCase().includes(s)) ||
        (j.kk_number && j.kk_number.toLowerCase().includes(s)) ||
        (j.phone && j.phone.toLowerCase().includes(s))
      );
    }

    if (filters?.packageId) {
      const participantJamaahIds = globalStore.package_participants
        .filter(p => p.package_id === filters.packageId && !p.deleted_at)
        .map(p => p.jamaah_id);
      list = list.filter(j => participantJamaahIds.includes(j.id));
    }

    if (filters?.picId) {
      const participantJamaahIds = globalStore.package_participants
        .filter(p => p.pic_id === filters.picId && !p.deleted_at)
        .map(p => p.jamaah_id);
      list = list.filter(j => participantJamaahIds.includes(j.id));
    }

    // Augment with computed relations
    return list.map(j => {
      const participants = globalStore.package_participants.filter(p => p.jamaah_id === j.id && !p.deleted_at);
      const activeParticipant = participants[participants.length - 1];
      const activePackage = activeParticipant ? globalStore.packages.find(pkg => pkg.id === activeParticipant.package_id) : null;
      const docs = globalStore.documents.filter(d => d.jamaah_id === j.id);
      const health = evaluatePassportHealth(j, activePackage?.departure_date);
      const latestDeparture = activePackage ? `${activePackage.package_name || (activePackage as any).name || 'Paket'} (${activePackage.departure_date || '-'})` : '-';

      return {
        ...j,
        documents: docs,
        active_package: activePackage,
        latest_departure: latestDeparture,
        trips_count: participants.length,
        passport_warning: health.status,
      };
    });
  }

  public static async getJamaahById(id: string): Promise<Jamaah | null> {
    if (this.isTiDBLive()) {
      try {
        const rows = await queryTiDB<Jamaah>('SELECT * FROM jamaah WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          const j = rows[0];
          return {
            ...j,
            birth_date: j.birth_date ? new Date(j.birth_date).toISOString().split('T')[0] : null,
            passport_issue_date: j.passport_issue_date ? new Date(j.passport_issue_date).toISOString().split('T')[0] : null,
            passport_expiry_date: j.passport_expiry_date ? new Date(j.passport_expiry_date).toISOString().split('T')[0] : null,
          };
        }
      } catch (err) {
        console.warn('[TIDB_GET_JAMAAH_BY_ID_ERROR]', err);
      }
    }

    const list = await this.getJamaahList();
    const found = list.find(j => j.id === id);
    if (!found) return null;

    const docs = globalStore.documents.filter(d => d.jamaah_id === id);
    return {
      ...found,
      documents: docs,
    };
  }

  public static async createJamaah(data: Partial<Jamaah>): Promise<Jamaah> {
    const now = new Date().toISOString();
    const newJamaah: Jamaah = {
      id: data.id || `jam_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      member_id: data.member_id || (data as any).member_id || `WKU-${String(globalStore.jamaah.length + 1).padStart(4, '0')}`,
      identity_name: data.identity_name || data.passport_name || data.ktp_name || 'Jamaah Baru',
      passport_name: data.passport_name || null,
      passport_number: data.passport_number || null,
      birth_place: data.birth_place || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      passport_issue_place: data.passport_issue_place || null,
      passport_issue_date: data.passport_issue_date || null,
      passport_expiry_date: data.passport_expiry_date || null,
      ktp_name: data.ktp_name || null,
      nik: data.nik || null,
      kk_number: data.kk_number || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    globalStore.jamaah.push(newJamaah);
    syncStoreToDisk();

    if (this.isTiDBLive()) {
      try {
        const cleanBirthDate = data.birth_date ? (new Date(data.birth_date).toISOString().split('T')[0] || null) : null;
        const cleanIssueDate = data.passport_issue_date ? (new Date(data.passport_issue_date).toISOString().split('T')[0] || null) : null;
        const cleanExpiryDate = data.passport_expiry_date ? (new Date(data.passport_expiry_date).toISOString().split('T')[0] || null) : null;
        let cleanGender = data.gender || null;
        if (cleanGender) {
          const gStr = String(cleanGender).toUpperCase();
          cleanGender = gStr.includes('LAKI') || gStr === 'L' || gStr === 'M' || gStr === 'PRIA' || gStr === 'MALE' ? 'MALE' : (gStr.includes('PEREMPUAN') || gStr === 'P' || gStr === 'F' || gStr === 'WANITA' || gStr === 'FEMALE' ? 'FEMALE' : 'MALE');
        }

        await queryTiDB(
          `INSERT INTO jamaah (id, member_id, identity_name, passport_name, passport_number, birth_place, birth_date, gender, passport_issue_place, passport_issue_date, passport_expiry_date, ktp_name, nik, kk_number, phone, address, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             member_id = VALUES(member_id),
             identity_name = VALUES(identity_name),
             passport_name = VALUES(passport_name),
             passport_number = VALUES(passport_number),
             birth_place = VALUES(birth_place),
             birth_date = VALUES(birth_date),
             gender = VALUES(gender),
             passport_issue_place = VALUES(passport_issue_place),
             passport_issue_date = VALUES(passport_issue_date),
             passport_expiry_date = VALUES(passport_expiry_date),
             ktp_name = VALUES(ktp_name),
             nik = VALUES(nik),
             kk_number = VALUES(kk_number),
             phone = VALUES(phone),
             address = VALUES(address),
             notes = VALUES(notes),
             updated_at = NOW()`,
          [
            newJamaah.id,
            newJamaah.member_id || null,
            newJamaah.identity_name,
            newJamaah.passport_name || null,
            newJamaah.passport_number || null,
            newJamaah.birth_place || null,
            cleanBirthDate,
            cleanGender,
            newJamaah.passport_issue_place || null,
            cleanIssueDate,
            cleanExpiryDate,
            newJamaah.ktp_name || null,
            newJamaah.nik || null,
            newJamaah.kk_number || null,
            newJamaah.phone || null,
            newJamaah.address || null,
            newJamaah.notes || null,
          ]
        );
      } catch (tidbErr) {
        console.warn('[TIDB_CREATE_JAMAAH_ERROR]', tidbErr);
      }
    }

    if (this.isSupabaseLive()) {
      const supabase = createAdminClient();
      await supabase.from('jamaah').insert(newJamaah);
    }

    return newJamaah;
  }

  public static async updateJamaah(id: string, data: Partial<Jamaah>): Promise<Jamaah | null> {
    const idx = globalStore.jamaah.findIndex(j => j.id === id);
    if (idx === -1) return null;

    const existing = globalStore.jamaah[idx];
    const updated: Jamaah = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    globalStore.jamaah[idx] = updated;
    syncStoreToDisk();

    if (this.isSupabaseLive()) {
      const supabase = createAdminClient();
      await supabase.from('jamaah').update(data).eq('id', id);
    }

    return updated;
  }

  public static async deleteJamaah(id: string): Promise<boolean> {
    const idx = globalStore.jamaah.findIndex(j => j.id === id);
    if (idx === -1) return false;

    const now = new Date().toISOString();
    globalStore.jamaah[idx].deleted_at = now;
    globalStore.jamaah[idx].updated_at = now;
    syncStoreToDisk();

    if (this.isSupabaseLive()) {
      const supabase = createAdminClient();
      await supabase.from('jamaah').update({ deleted_at: now }).eq('id', id);
    }

    return true;
  }

  // ==========================================
  // DOCUMENTS & EXTRACTIONS
  // ==========================================
  // DOCUMENTS & OCR
  // ==========================================
  public static async saveUploadedDocument(
    jamaahId: string | null,
    documentType: DocumentType,
    storagePath: string,
    originalFileName: string,
    mimeType: string,
    fileSize: number,
    extractionResult: {
      rawText: string;
      fields: Record<string, any>;
      classification: DocumentType;
      confidence: number;
      mrzData?: Record<string, any>;
    },
    existingDocumentId?: string
  ): Promise<{ document: DocumentRecord; extraction: DocumentExtraction }> {
    const now = new Date().toISOString();

    if (existingDocumentId) {
      const existingDocIdx = globalStore.documents.findIndex(d => d.id === existingDocumentId);
      if (existingDocIdx !== -1) {
        const existingDoc = globalStore.documents[existingDocIdx];
        const updatedDoc: DocumentRecord = {
          ...existingDoc,
          jamaah_id: jamaahId || existingDoc.jamaah_id,
          document_type: documentType,
          storage_path: storagePath || existingDoc.storage_path,
          original_file_name: originalFileName || existingDoc.original_file_name,
          mime_type: mimeType || existingDoc.mime_type,
          file_size: fileSize || existingDoc.file_size,
          status: 'NEEDS_REVIEW',
          updated_at: now,
        };
        globalStore.documents[existingDocIdx] = updatedDoc;

        const extIdx = globalStore.document_extractions.findIndex(e => e.document_id === existingDocumentId);
        let updatedExtraction: DocumentExtraction;
        if (extIdx !== -1) {
          updatedExtraction = {
            ...globalStore.document_extractions[extIdx],
            raw_extraction: extractionResult.rawText,
            extracted_fields: extractionResult.fields,
            classification_result: extractionResult.classification,
            confidence_score: extractionResult.confidence,
            mrz_data: extractionResult.mrzData || null,
            review_status: 'PENDING',
            updated_at: now,
          };
          globalStore.document_extractions[extIdx] = updatedExtraction;
        } else {
          updatedExtraction = {
            id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            document_id: existingDocumentId,
            raw_extraction: extractionResult.rawText,
            extracted_fields: extractionResult.fields,
            classification_result: extractionResult.classification,
            confidence_score: extractionResult.confidence,
            mrz_data: extractionResult.mrzData || null,
            review_status: 'PENDING',
            review_notes: null,
            created_at: now,
            updated_at: now,
          };
          globalStore.document_extractions.push(updatedExtraction);
        }

        if (this.isSupabaseLive()) {
          const supabase = createAdminClient();
          await supabase.from('documents').update(updatedDoc).eq('id', existingDocumentId);
          if (extIdx !== -1) {
            await supabase.from('document_extractions').update(updatedExtraction).eq('id', updatedExtraction.id);
          } else {
            await supabase.from('document_extractions').insert(updatedExtraction);
          }
        }

        return { document: updatedDoc, extraction: updatedExtraction };
      }
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const extractionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const newDoc: DocumentRecord = {
      id: docId,
      jamaah_id: jamaahId,
      document_type: documentType,
      storage_path: storagePath,
      original_file_name: originalFileName,
      mime_type: mimeType,
      file_size: fileSize,
      status: 'NEEDS_REVIEW',
      is_current: true,
      uploaded_at: now,
      confirmed_at: null,
      created_at: now,
      updated_at: now,
    };

    const newExtraction: DocumentExtraction = {
      id: extractionId,
      document_id: docId,
      raw_extraction: extractionResult.rawText,
      extracted_fields: extractionResult.fields,
      classification_result: extractionResult.classification,
      confidence_score: extractionResult.confidence,
      mrz_data: extractionResult.mrzData || null,
      review_status: 'PENDING',
      review_notes: null,
      created_at: now,
      updated_at: now,
    };

    globalStore.documents.push(newDoc);
    globalStore.document_extractions.push(newExtraction);
    syncStoreToDisk();

    if (this.isTiDBLive()) {
      try {
        await queryTiDB(
          `INSERT INTO documents (id, jamaah_id, document_type, storage_path, original_file_name, mime_type, file_size, status, is_current, uploaded_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             jamaah_id = VALUES(jamaah_id),
             document_type = VALUES(document_type),
             storage_path = VALUES(storage_path),
             original_file_name = VALUES(original_file_name),
             mime_type = VALUES(mime_type),
             file_size = VALUES(file_size),
             status = VALUES(status),
             updated_at = NOW()`,
          [
            newDoc.id,
            newDoc.jamaah_id,
            newDoc.document_type,
            newDoc.storage_path,
            newDoc.original_file_name,
            newDoc.mime_type,
            newDoc.file_size,
            newDoc.status,
            newDoc.is_current ? 1 : 0,
          ]
        );

        await queryTiDB(
          `INSERT INTO document_extractions (id, document_id, raw_extraction, extracted_fields, classification_result, confidence_score, mrz_data, review_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             raw_extraction = VALUES(raw_extraction),
             extracted_fields = VALUES(extracted_fields),
             classification_result = VALUES(classification_result),
             confidence_score = VALUES(confidence_score),
             mrz_data = VALUES(mrz_data),
             review_status = VALUES(review_status),
             updated_at = NOW()`,
          [
            newExtraction.id,
            newExtraction.document_id,
            newExtraction.raw_extraction,
            JSON.stringify(newExtraction.extracted_fields || {}),
            newExtraction.classification_result,
            newExtraction.confidence_score,
            newExtraction.mrz_data ? JSON.stringify(newExtraction.mrz_data) : null,
            newExtraction.review_status,
          ]
        );
      } catch (tidbErr) {
        console.warn('[TIDB_SAVE_DOC_ERROR]', tidbErr);
      }
    }

    if (this.isSupabaseLive()) {
      const supabase = createAdminClient();
      await supabase.from('documents').insert(newDoc);
      await supabase.from('document_extractions').insert(newExtraction);
    }

    return { document: newDoc, extraction: newExtraction };
  }

  public static async saveDocument(data: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    const newDoc: DocumentRecord = {
      id: data.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      jamaah_id: data.jamaah_id || null,
      document_type: data.document_type || 'PASSPORT',
      storage_path: data.storage_path || '',
      original_file_name: data.original_file_name || 'document.pdf',
      mime_type: data.mime_type || 'application/pdf',
      file_size: data.file_size || 1024,
      status: data.status || 'CONFIRMED',
      is_current: data.is_current !== undefined ? data.is_current : true,
      uploaded_at: data.uploaded_at || now,
      confirmed_at: data.confirmed_at || now,
      created_at: now,
      updated_at: now,
    };

    globalStore.documents.push(newDoc);
    syncStoreToDisk();
    return newDoc;
  }

  public static async getDocumentWithExtraction(docId: string): Promise<(DocumentRecord & { extraction?: DocumentExtraction | null }) | null> {
    syncStoreFromDisk();

    if (this.isTiDBLive()) {
      try {
        const rows: any[] = await queryTiDB(
          `SELECT d.*, e.id as ext_id, e.raw_extraction, e.extracted_fields, e.classification_result, e.confidence_score, e.mrz_data, e.review_status, e.review_notes
           FROM documents d
           LEFT JOIN document_extractions e ON d.id = e.document_id
           WHERE d.id = ? LIMIT 1`,
          [docId]
        );
        if (rows && rows.length > 0) {
          const row = rows[0];
          let fields = row.extracted_fields;
          if (typeof fields === 'string') {
            try { fields = JSON.parse(fields); } catch {}
          }
          let mrz = row.mrz_data;
          if (typeof mrz === 'string') {
            try { mrz = JSON.parse(mrz); } catch {}
          }

          const doc: DocumentRecord = {
            id: row.id,
            jamaah_id: row.jamaah_id,
            document_type: row.document_type,
            storage_path: row.storage_path,
            original_file_name: row.original_file_name,
            mime_type: row.mime_type,
            file_size: Number(row.file_size || 0),
            status: row.status,
            is_current: !!row.is_current,
            uploaded_at: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
            confirmed_at: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
          };

          const extraction: DocumentExtraction | null = row.ext_id ? {
            id: row.ext_id,
            document_id: row.id,
            raw_extraction: row.raw_extraction,
            extracted_fields: fields || {},
            classification_result: row.classification_result,
            confidence_score: Number(row.confidence_score || 0),
            mrz_data: mrz,
            review_status: row.review_status,
            review_notes: row.review_notes,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
          } : null;

          return { ...doc, extraction };
        }
      } catch (err) {
        console.warn('[TIDB_GET_DOC_ERROR]', err);
      }
    }

    const doc = globalStore.documents.find(d => d.id === docId);
    if (!doc) return null;
    const extraction = globalStore.document_extractions.find(e => e.document_id === docId);
    return {
      ...doc,
      extraction: extraction || null,
    };
  }

  public static async getPendingReviewDocuments(): Promise<(DocumentRecord & { extraction?: DocumentExtraction | null })[]> {
    syncStoreFromDisk();

    if (this.isTiDBLive()) {
      try {
        const rows: any[] = await queryTiDB(
          `SELECT d.*, e.id as ext_id, e.raw_extraction, e.extracted_fields, e.classification_result, e.confidence_score, e.mrz_data, e.review_status, e.review_notes
           FROM documents d
           LEFT JOIN document_extractions e ON d.id = e.document_id
           WHERE d.status = 'NEEDS_REVIEW'
           ORDER BY d.created_at DESC`
        );
        if (rows && rows.length > 0) {
          return rows.map(row => {
            let fields = row.extracted_fields;
            if (typeof fields === 'string') {
              try { fields = JSON.parse(fields); } catch {}
            }
            let mrz = row.mrz_data;
            if (typeof mrz === 'string') {
              try { mrz = JSON.parse(mrz); } catch {}
            }

            const doc: DocumentRecord = {
              id: row.id,
              jamaah_id: row.jamaah_id,
              document_type: row.document_type,
              storage_path: row.storage_path,
              original_file_name: row.original_file_name,
              mime_type: row.mime_type,
              file_size: Number(row.file_size || 0),
              status: row.status,
              is_current: !!row.is_current,
              uploaded_at: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : new Date().toISOString(),
              confirmed_at: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
              created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
              updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
            };

            const extraction: DocumentExtraction | null = row.ext_id ? {
              id: row.ext_id,
              document_id: row.id,
              raw_extraction: row.raw_extraction,
              extracted_fields: fields || {},
              classification_result: row.classification_result,
              confidence_score: Number(row.confidence_score || 0),
              mrz_data: mrz,
              review_status: row.review_status,
              review_notes: row.review_notes,
              created_at: doc.created_at,
              updated_at: doc.updated_at,
            } : null;

            return { ...doc, extraction };
          });
        }
      } catch (err) {
        console.warn('[TIDB_GET_PENDING_DOCS_ERROR]', err);
      }
    }

    const docs = globalStore.documents.filter(d => d.status === 'NEEDS_REVIEW');
    return docs.map(d => ({
      ...d,
      extraction: globalStore.document_extractions.find(e => e.document_id === d.id) || null,
    }));
  }

  /**
   * Transactional Review Confirmation
   * Supports:
   * 1. Creating a new Jamaah from Passport / KTP / KK
   * 2. Updating existing Jamaah (with Passport Replacement Transaction & History)
   * 3. KK multi-member selective creation
   */
  public static async confirmDocumentReview(
    docId: string,
    action: 'CREATE_NEW' | 'UPDATE_EXISTING' | 'REJECT',
    targetJamaahId?: string,
    reviewedFields?: Record<string, any>
  ): Promise<{ success: boolean; jamaah?: Jamaah; error?: string }> {
    syncStoreFromDisk();
    let docIdx = globalStore.documents.findIndex(d => d.id === docId);
    const now = new Date().toISOString();

    // Fallback: If document was not found in memory/disk, synthesize document record from reviewed fields
    if (docIdx === -1) {
      if (action === 'CREATE_NEW' && reviewedFields) {
        const fallbackDoc: DocumentRecord = {
          id: docId,
          jamaah_id: null,
          document_type: (reviewedFields.passport_number ? 'PASSPORT' : reviewedFields.nik ? 'KTP' : reviewedFields.kk_number ? 'KK' : 'OTHER'),
          storage_path: `staging/${docId}.png`,
          original_file_name: 'paspor_terunggah.png',
          mime_type: 'image/png',
          file_size: 2048,
          status: 'NEEDS_REVIEW',
          is_current: true,
          uploaded_at: now,
          confirmed_at: null,
          created_at: now,
          updated_at: now,
        };
        globalStore.documents.push(fallbackDoc);
        docIdx = globalStore.documents.length - 1;
      } else {
        return { success: false, error: 'Document not found' };
      }
    }

    const doc = globalStore.documents[docIdx];
    const extIdx = globalStore.document_extractions.findIndex(e => e.document_id === docId);

    if (action === 'REJECT') {
      globalStore.documents[docIdx] = { ...doc, status: 'FAILED', updated_at: now };
      if (extIdx !== -1) {
        globalStore.document_extractions[extIdx].review_status = 'REJECTED';
      }
      syncStoreToDisk();

      if (this.isTiDBLive()) {
        try {
          await queryTiDB(`UPDATE documents SET status = 'FAILED', updated_at = NOW() WHERE id = ?`, [docId]);
          await queryTiDB(`UPDATE document_extractions SET review_status = 'REJECTED', updated_at = NOW() WHERE document_id = ?`, [docId]);
        } catch (tidbErr) {
          console.warn('[TIDB_REJECT_DOC_ERROR]', tidbErr);
        }
      }

      return { success: true };
    }

    const fields = reviewedFields || (extIdx !== -1 ? globalStore.document_extractions[extIdx].extracted_fields : {});

    if (action === 'CREATE_NEW') {
      const identityName = fields.passport_name || fields.ktp_name || fields.identity_name || 'Jamaah Baru';
      const created = await this.createJamaah({
        identity_name: identityName,
        passport_name: fields.passport_name || null,
        passport_number: fields.passport_number || null,
        birth_place: fields.birth_place || null,
        birth_date: fields.birth_date || null,
        gender: fields.gender || null,
        passport_issue_place: fields.passport_issue_place || null,
        passport_issue_date: fields.passport_issue_date || null,
        passport_expiry_date: fields.passport_expiry_date || null,
        ktp_name: fields.ktp_name || null,
        nik: fields.nik || null,
        kk_number: fields.kk_number || null,
        phone: fields.phone || null,
        address: fields.address || null,
      });

      // Promote storage path from staging to permanent Jamaah path
      let finalStoragePath = doc.storage_path;
      if (finalStoragePath.startsWith('staging/')) {
        const ext = doc.original_file_name.split('.').pop() || 'jpg';
        finalStoragePath = `jamaah/${created.id}/${doc.document_type.toLowerCase()}/${doc.id}.${ext}`;
      }

      // Link document to newly created Jamaah
      globalStore.documents[docIdx] = {
        ...doc,
        jamaah_id: created.id,
        storage_path: finalStoragePath,
        status: 'CONFIRMED',
        is_current: true,
        confirmed_at: now,
        updated_at: now,
      };

      if (extIdx !== -1) {
        globalStore.document_extractions[extIdx].review_status = 'CONFIRMED';
      }

      syncStoreToDisk();

      await AuditService.logMutation({
        action: 'DOCUMENT_CONFIRMED',
        entityType: 'JAMAAH',
        entityId: created.id,
        jamaahId: created.id,
        jamaahName: created.passport_name || created.identity_name,
        afterData: { ...fields, document_id: doc.id, document_type: doc.document_type },
      });

      if (this.isTiDBLive()) {
        try {
          await queryTiDB(
            `UPDATE documents SET jamaah_id = ?, storage_path = ?, status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [created.id, finalStoragePath, docId]
          );
          await queryTiDB(
            `UPDATE document_extractions SET review_status = 'CONFIRMED', updated_at = NOW() WHERE document_id = ?`,
            [docId]
          );
        } catch (tidbErr) {
          console.warn('[TIDB_CONFIRM_CREATE_DOC_ERROR]', tidbErr);
        }
      }

      return { success: true, jamaah: created };
    }

    if (action === 'UPDATE_EXISTING' && targetJamaahId) {
      const existingJamaah = await this.getJamaahById(targetJamaahId);
      if (!existingJamaah) return { success: false, error: 'Target Jamaah not found' };

      // PASSPORT REPLACEMENT TRANSACTION:
      // Archive old current passport of this jamaah
      if (doc.document_type === 'PASSPORT') {
        globalStore.documents.forEach((d, idx) => {
          if (d.jamaah_id === targetJamaahId && d.document_type === 'PASSPORT' && d.id !== docId && d.is_current) {
            globalStore.documents[idx] = {
              ...d,
              is_current: false,
              status: 'ARCHIVED',
              updated_at: now,
            };
          }
        });
      }

      // Promote storage path from staging to permanent Jamaah path
      let finalStoragePath = doc.storage_path;
      if (finalStoragePath.startsWith('staging/')) {
        const ext = doc.original_file_name.split('.').pop() || 'jpg';
        finalStoragePath = `jamaah/${targetJamaahId}/${doc.document_type.toLowerCase()}/${doc.id}.${ext}`;
      }

      // Mark new document as confirmed & current
      globalStore.documents[docIdx] = {
        ...doc,
        jamaah_id: targetJamaahId,
        storage_path: finalStoragePath,
        status: 'CONFIRMED',
        is_current: true,
        confirmed_at: now,
        updated_at: now,
      };

      if (extIdx !== -1) {
        globalStore.document_extractions[extIdx].review_status = 'CONFIRMED';
      }

      // Update Jamaah profile with non-destructive preservation
      const updatedFields: Partial<Jamaah> = {};
      if (fields.passport_name) updatedFields.passport_name = fields.passport_name;
      if (fields.passport_number) updatedFields.passport_number = fields.passport_number;
      if (fields.birth_place && !existingJamaah.birth_place) updatedFields.birth_place = fields.birth_place;
      if (fields.birth_date && !existingJamaah.birth_date) updatedFields.birth_date = fields.birth_date;
      if (fields.gender && !existingJamaah.gender) updatedFields.gender = fields.gender;
      if (fields.passport_issue_place) updatedFields.passport_issue_place = fields.passport_issue_place;
      if (fields.passport_issue_date) updatedFields.passport_issue_date = fields.passport_issue_date;
      if (fields.passport_expiry_date) updatedFields.passport_expiry_date = fields.passport_expiry_date;
      if (fields.ktp_name) updatedFields.ktp_name = fields.ktp_name;
      if (fields.nik) updatedFields.nik = fields.nik;
      if (fields.kk_number) updatedFields.kk_number = fields.kk_number;
      if (fields.phone && !existingJamaah.phone) updatedFields.phone = fields.phone;
      if (fields.address && !existingJamaah.address) updatedFields.address = fields.address;

      const updated = await this.updateJamaah(targetJamaahId, updatedFields);

      if (this.isTiDBLive()) {
        try {
          await queryTiDB(
            `UPDATE documents SET jamaah_id = ?, storage_path = ?, status = 'CONFIRMED', is_current = 1, confirmed_at = NOW(), updated_at = NOW() WHERE id = ?`,
            [targetJamaahId, finalStoragePath, docId]
          );
          await queryTiDB(
            `UPDATE document_extractions SET review_status = 'CONFIRMED', updated_at = NOW() WHERE document_id = ?`,
            [docId]
          );
        } catch (tidbErr) {
          console.warn('[TIDB_CONFIRM_UPDATE_DOC_ERROR]', tidbErr);
        }
      }

      await AuditService.logMutation({
        action: doc.document_type === 'PASSPORT' ? 'PASSPORT_REPLACED' : 'DOCUMENT_CONFIRMED',
        entityType: 'JAMAAH',
        entityId: targetJamaahId,
        jamaahId: targetJamaahId,
        jamaahName: existingJamaah.passport_name || existingJamaah.identity_name,
        beforeData: existingJamaah,
        afterData: updated || existingJamaah,
        metadata: { document_id: doc.id, document_type: doc.document_type },
      });

      return { success: true, jamaah: updated || existingJamaah };
    }

    return { success: false, error: 'Invalid action or missing target' };
  }

  // ==========================================
  // PACKAGES
  // ==========================================
  public static async getPackageList(): Promise<Package[]> {
    if (this.isSupabaseLive()) {
      const supabase = createAdminClient();
      const { data } = await supabase.from('packages').select('*').is('deleted_at', null).order('departure_date', { ascending: true });
      if (data) return data as Package[];
    }

    return globalStore.packages.filter(p => !p.deleted_at).map(p => {
      const count = globalStore.package_participants.filter(part => part.package_id === p.id && !part.deleted_at).length;
      return {
        ...p,
        participants_count: count,
      };
    });
  }

  public static async getPackages(): Promise<Package[]> {
    return this.getPackageList();
  }

  public static async getPackageById(id: string): Promise<Package | null> {
    const list = await this.getPackageList();
    return list.find(p => p.id === id) || null;
  }

  public static async createPackage(data: Partial<Package>): Promise<Package> {
    const now = new Date().toISOString();
    const pkgName = data.package_name || (data as any).name || 'Paket Umrah';
    const newPackage: any = {
      id: data.id || `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      package_name: pkgName,
      name: pkgName,
      departure_date: data.departure_date || now.split('T')[0],
      return_date: data.return_date || now.split('T')[0],
      b2b_price: Number(data.b2b_price) || 0,
      reference_price: Number(data.reference_price) || (data as any).price_quad || 0,
      price_quad: (data as any).price_quad || Number(data.reference_price) || 0,
      airline: data.airline || null,
      makkah_hotel: data.makkah_hotel || null,
      madinah_hotel: data.madinah_hotel || null,
      schedule: data.schedule || null,
      quota: Number(data.quota) || (data as any).capacity || 45,
      capacity: (data as any).capacity || Number(data.quota) || 45,
      status: data.status || 'OPEN',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    globalStore.packages.push(newPackage);
    syncStoreToDisk();
    return newPackage;
  }

  public static async updatePackage(id: string, data: Partial<Package> & Record<string, any>): Promise<Package | null> {
    const idx = globalStore.packages.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const existing = globalStore.packages[idx];
    const updated: any = {
      ...existing,
      ...data,
      package_name: data.package_name || data.name || existing.package_name,
      name: data.package_name || data.name || (existing as any).name || existing.package_name,
      updated_at: new Date().toISOString(),
    };

    globalStore.packages[idx] = updated;
    syncStoreToDisk();
    return updated;
  }

  // ==========================================
  // PICS (Master Person in Charge)
  // ==========================================
  public static async getPicList(): Promise<PIC[]> {
    return globalStore.pics.filter(pic => !pic.deleted_at).map(pic => {
      const count = globalStore.package_participants.filter(part => part.pic_id === pic.id && !part.deleted_at).length;
      return {
        ...pic,
        jamaah_count: count,
      };
    });
  }

  public static async getPics(): Promise<PIC[]> {
    return this.getPicList();
  }

  public static async createPic(name: string, phone?: string, notes?: string): Promise<PIC> {
    const now = new Date().toISOString();
    const newPic: PIC = {
      id: `pic_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      phone: phone || null,
      notes: notes || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    globalStore.pics.push(newPic);
    syncStoreToDisk();
    return newPic;
  }

  public static async getPicById(id: string): Promise<PIC | null> {
    const pic = globalStore.pics.find(p => p.id === id && !p.deleted_at);
    return pic || null;
  }

  // ==========================================
  // PACKAGE PARTICIPANTS
  // ==========================================
  public static async addParticipant(
    packageId: string,
    jamaahId: string,
    picId?: string,
    customB2bPrice?: number,
    customSellingPrice?: number,
    notes?: string
  ): Promise<PackageParticipant> {
    const pkg = await this.getPackageById(packageId);
    const existing = globalStore.package_participants.find(
      p => p.package_id === packageId && p.jamaah_id === jamaahId && !p.deleted_at
    );

    if (existing) {
      throw new Error('Jamaah sudah terdaftar pada paket ini.');
    }

    const now = new Date().toISOString();
    const newPart: PackageParticipant = {
      id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      package_id: packageId,
      jamaah_id: jamaahId,
      pic_id: picId || null,
      b2b_price: customB2bPrice !== undefined ? Number(customB2bPrice) : (pkg?.b2b_price || 0),
      selling_price: customSellingPrice !== undefined ? Number(customSellingPrice) : (pkg?.reference_price || 0),
      participant_status: 'REGISTERED',
      notes: notes || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    globalStore.package_participants.push(newPart);

    // Stage 2: Automatically create financial invoice for active participant
    const newInvoice: Invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      package_participant_id: newPart.id,
      base_amount: newPart.selling_price,
      status: 'UNPAID',
      created_at: now,
      updated_at: now,
      items: [],
      allocations: [],
      total_amount: newPart.selling_price,
      total_paid: 0,
      outstanding: newPart.selling_price,
      overpayment: 0,
    };
    globalStore.invoices.push(newInvoice);

    // Stage 4: Automatically synchronize equipment requirements for new participant
    await this.syncParticipantEquipmentForSinglePax(newPart.id);
    syncStoreToDisk();

    return newPart;
  }

  public static async updateParticipantStatus(participantId: string, status: any): Promise<boolean> {
    const idx = globalStore.package_participants.findIndex(p => p.id === participantId);
    if (idx === -1) return false;
    globalStore.package_participants[idx] = {
      ...globalStore.package_participants[idx],
      participant_status: status,
      updated_at: new Date().toISOString(),
    };
    return true;
  }

  public static async softDeleteParticipant(participantId: string): Promise<boolean> {
    const idx = globalStore.package_participants.findIndex(p => p.id === participantId);
    if (idx === -1) return false;
    globalStore.package_participants[idx] = {
      ...globalStore.package_participants[idx],
      deleted_at: new Date().toISOString(),
      participant_status: 'ARCHIVED',
    };
    return true;
  }

  public static async getParticipants(filters?: { packageId?: string; picId?: string }): Promise<PackageParticipant[]> {
    let list = globalStore.package_participants.filter(p => !p.deleted_at);

    if (filters?.packageId) {
      list = list.filter(p => p.package_id === filters.packageId);
    }
    if (filters?.picId) {
      list = list.filter(p => p.pic_id === filters.picId);
    }

    return list.map(part => {
      const jRaw = globalStore.jamaah.find(jm => jm.id === part.jamaah_id);
      const docs = jRaw ? globalStore.documents.filter(d => d.jamaah_id === jRaw.id) : [];
      const j = jRaw ? { ...jRaw, documents: docs } : undefined;
      const pkg = globalStore.packages.find(pk => pk.id === part.package_id);
      const pic = part.pic_id ? globalStore.pics.find(pc => pc.id === part.pic_id) : null;
      const inv = this.computeInvoiceForParticipant(part.id);
      return {
        ...part,
        jamaah: j,
        package: pkg,
        pic,
        invoice: inv,
      };
    });
  }

  public static async getJamaahTrips(jamaahId: string): Promise<PackageParticipant[]> {
    return this.getParticipants().then(parts => parts.filter(p => p.jamaah_id === jamaahId));
  }

  // ==========================================
  // STAGE 2: FINANCE JAMAAH REPOSITORY
  // ==========================================

  /**
   * Idempotent backfill ensuring all active participants have an invoice
   * Returns the count of newly created invoices (0 if already backfilled)
   */
  public static ensureInvoiceBackfill(): number {
    let createdCount = 0;
    for (const part of globalStore.package_participants) {
      if (part.deleted_at) continue;
      const existing = globalStore.invoices.find(inv => inv.package_participant_id === part.id);
      if (!existing) {
        const now = new Date().toISOString();
        globalStore.invoices.push({
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          package_participant_id: part.id,
          base_amount: part.selling_price || 0,
          status: 'UNPAID',
          created_at: now,
          updated_at: now,
          items: [],
          allocations: [],
          total_amount: part.selling_price || 0,
          total_paid: 0,
          outstanding: part.selling_price || 0,
          overpayment: 0,
        });
        createdCount++;
      }
    }
    return createdCount;
  }

  /**
   * Computes derived totals and status for an invoice in real-time
   */
  private static computeInvoice(inv: Invoice): Invoice {
    const items = globalStore.invoice_items.filter(item => item.invoice_id === inv.id);
    
    // Formula: Base + Charges - Discounts + Adjustments
    let totalAmount = Number(inv.base_amount) || 0;
    for (const item of items) {
      const amt = Number(item.amount) || 0;
      if (item.type === 'CHARGE') totalAmount += amt;
      else if (item.type === 'DISCOUNT') totalAmount -= amt;
      else if (item.type === 'ADJUSTMENT') totalAmount += amt; // Can be positive or negative
    }

    // Active allocations from non-cancelled payments
    const allocations = globalStore.payment_allocations
      .filter(alloc => alloc.invoice_id === inv.id && alloc.status === 'ACTIVE')
      .filter(alloc => {
        const payment = globalStore.payments.find(p => p.id === alloc.payment_id);
        return payment && payment.status !== 'CANCELLED';
      });

    const totalPaid = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const outstanding = Math.max(0, totalAmount - totalPaid);
    const overpayment = Math.max(0, totalPaid - totalAmount);

    let status: InvoiceStatus = 'UNPAID';
    if (totalPaid === 0) {
      status = 'UNPAID';
    } else if (totalPaid < totalAmount) {
      status = 'PARTIAL';
    } else if (totalPaid === totalAmount) {
      status = 'PAID';
    } else {
      status = 'OVERPAID';
    }

    const participant = globalStore.package_participants.find(p => p.id === inv.package_participant_id);
    let participantWithMeta: PackageParticipant | undefined;
    if (participant) {
      const j = globalStore.jamaah.find(jm => jm.id === participant.jamaah_id);
      const pkg = globalStore.packages.find(pk => pk.id === participant.package_id);
      const pic = participant.pic_id ? globalStore.pics.find(pc => pc.id === participant.pic_id) : null;
      participantWithMeta = { ...participant, jamaah: j, package: pkg, pic };
    }

    return {
      ...inv,
      items,
      allocations,
      total_amount: totalAmount,
      total_paid: totalPaid,
      outstanding,
      overpayment,
      status,
      participant: participantWithMeta,
    };
  }

  private static computeInvoiceForParticipant(participantId: string): Invoice | null {
    this.ensureInvoiceBackfill();
    const inv = globalStore.invoices.find(i => i.package_participant_id === participantId);
    if (!inv) return null;
    return this.computeInvoice(inv);
  }

  /**
   * Computes derived allocation status and remaining balance for a payment
   */
  private static computePayment(p: Payment): Payment {
    const allocations = globalStore.payment_allocations.filter(
      a => a.payment_id === p.id && a.status === 'ACTIVE'
    );
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const remainingUnallocated = Math.max(0, Number(p.amount) - totalAllocated);

    let allocStatus: PaymentAllocationStatus = 'UNALLOCATED';
    if (p.status === 'CANCELLED') {
      allocStatus = 'CANCELLED';
    } else if (totalAllocated === 0) {
      allocStatus = 'UNALLOCATED';
    } else if (totalAllocated < Number(p.amount)) {
      allocStatus = 'PARTIALLY_ALLOCATED';
    } else {
      allocStatus = 'ALLOCATED';
    }

    const pkg = p.package_id ? globalStore.packages.find(pk => pk.id === p.package_id) : null;
    const pic = p.pic_id ? globalStore.pics.find(pc => pc.id === p.pic_id) : null;

    let jamaahName = 'Belum Terhubung';
    let jamaahId: string | null = null;
    let rawJamaahId: string | null = null;
    let packageName = pkg?.package_name || (pkg as any)?.name || (p.package_id ? 'Paket Terpilih' : 'Deposit Umum');
    let paymentType = 'Deposit';

    if (allocations.length > 0) {
      const firstAlloc = allocations[0];
      const inv = globalStore.invoices.find(i => i.id === firstAlloc.invoice_id);
      if (inv) {
        const part = globalStore.package_participants.find(pt => pt.id === inv.package_participant_id);
        if (part) {
          const jm = globalStore.jamaah.find(j => j.id === part.jamaah_id);
          if (jm) {
            jamaahName = jm.identity_name || jm.passport_name || jm.ktp_name || 'Jamaah';
            jamaahId = (jm as any).member_id || (jm.id?.startsWith('WKU-') ? jm.id : (jm.id?.startsWith('jam_') ? `WKU-${jm.id.slice(-4)}` : jm.id));
            rawJamaahId = jm.id;
          }
          if (!p.package_id && part.package_id) {
            const pPkg = globalStore.packages.find(pk => pk.id === part.package_id);
            if (pPkg) packageName = pPkg.package_name || (pPkg as any).name || packageName;
          }
        }
        if (inv.status === 'PARTIAL') {
          paymentType = Number(p.amount) < 15000000 ? 'DP (Uang Muka)' : 'Cicilan';
        } else if (inv.status === 'PAID') {
          paymentType = 'Pelunasan';
        } else {
          paymentType = 'Cicilan';
        }
      }
    } else {
      jamaahName = 'Belum Terhubung';
      jamaahId = null;
      paymentType = 'Deposit';
    }

    return {
      ...p,
      allocations,
      total_allocated: totalAllocated,
      remaining_unallocated: remainingUnallocated,
      allocation_status: allocStatus,
      package: pkg,
      pic,
      jamaah_name: jamaahName,
      jamaah_id: jamaahId,
      raw_jamaah_id: rawJamaahId,
      payment_type: paymentType,
      package_name: packageName,
    };
  }

  // --- INVOICES API METHODS ---
  public static async getInvoices(filters?: {
    packageId?: string;
    picId?: string;
    status?: InvoiceStatus;
    search?: string;
  }): Promise<Invoice[]> {
    this.ensureInvoiceBackfill();
    let list = globalStore.invoices.map(inv => this.computeInvoice(inv));

    if (filters?.packageId) {
      list = list.filter(inv => inv.participant?.package_id === filters.packageId);
    }
    if (filters?.picId) {
      list = list.filter(inv => inv.participant?.pic_id === filters.picId);
    }
    if (filters?.status) {
      list = list.filter(inv => inv.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(inv => {
        const jName = inv.participant?.jamaah?.identity_name || inv.participant?.jamaah?.passport_name || '';
        const pkgName = inv.participant?.package?.package_name || '';
        const picName = inv.participant?.pic?.name || '';
        return jName.toLowerCase().includes(q) || pkgName.toLowerCase().includes(q) || picName.toLowerCase().includes(q);
      });
    }

    return list;
  }

  public static async getInvoiceById(id: string): Promise<Invoice | null> {
    this.ensureInvoiceBackfill();
    const inv = globalStore.invoices.find(i => i.id === id);
    if (!inv) return null;
    return this.computeInvoice(inv);
  }

  public static async getInvoiceByParticipantId(participantId: string): Promise<Invoice | null> {
    return this.computeInvoiceForParticipant(participantId);
  }

  public static async addInvoiceItem(
    invoiceId: string,
    item: { 
      type: InvoiceItemType; 
      category?: InvoiceDiscountCategory | string; 
      description: string; 
      amount: number; 
      created_by?: string 
    }
  ): Promise<Invoice> {
    const inv = await this.getInvoiceById(invoiceId);
    if (!inv) throw new Error('Invoice tidak ditemukan.');

    const amt = Number(item.amount);
    if (isNaN(amt)) throw new Error('Nominal tidak valid.');
    
    // Business rules:
    // CHARGE: amt > 0
    // DISCOUNT: amt > 0 (subtracted in computation)
    // ADJUSTMENT: amt !== 0 (can be positive or negative)
    if (item.type === 'CHARGE' && amt <= 0) {
      throw new Error('Nominal Biaya Tambahan (CHARGE) harus lebih dari 0.');
    }
    if (item.type === 'DISCOUNT' && amt <= 0) {
      throw new Error('Nominal Diskon (DISCOUNT) harus lebih dari 0.');
    }
    if (item.type === 'ADJUSTMENT' && amt === 0) {
      throw new Error('Nominal Penyesuaian (ADJUSTMENT) tidak boleh 0.');
    }

    let normalizedAmount = amt;
    if (item.type === 'CHARGE' || item.type === 'DISCOUNT') {
      normalizedAmount = Math.abs(amt);
    }

    let itemCategory = item.category;
    if (!itemCategory) {
      if (item.type === 'DISCOUNT') itemCategory = 'OTHER_DISCOUNT';
      else if (item.type === 'CHARGE') itemCategory = 'CHARGE_ITEM';
      else itemCategory = 'ADJUSTMENT_ITEM';
    }

    const now = new Date().toISOString();
    const newItem: InvoiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      invoice_id: invoiceId,
      type: item.type,
      category: itemCategory,
      description: item.description,
      amount: normalizedAmount,
      created_by: item.created_by || null,
      created_at: now,
      updated_at: now,
    };

    globalStore.invoice_items.push(newItem);
    return (await this.getInvoiceById(invoiceId))!;
  }

  public static async updateInvoiceBaseAmount(
    invoiceId: string,
    newBaseAmount: number,
    reason?: string
  ): Promise<Invoice> {
    const invIdx = globalStore.invoices.findIndex(i => i.id === invoiceId);
    if (invIdx === -1) throw new Error('Invoice tidak ditemukan.');

    const inv = globalStore.invoices[invIdx];
    const computed = this.computeInvoice(inv);

    // Rule: If financial activity (paid > 0) already exists, record as adjustment
    if (computed.total_paid > 0) {
      const diff = Number(newBaseAmount) - Number(inv.base_amount);
      if (diff !== 0) {
        await this.addInvoiceItem(invoiceId, {
          type: 'ADJUSTMENT',
          category: 'ADJUSTMENT_ITEM',
          description: reason || `Penyesuaian Harga Paket (Rp ${inv.base_amount.toLocaleString('id-ID')} -> Rp ${newBaseAmount.toLocaleString('id-ID')})`,
          amount: diff,
        });
      }
    } else {
      globalStore.invoices[invIdx] = {
        ...inv,
        base_amount: Number(newBaseAmount),
        updated_at: new Date().toISOString(),
      };
    }

    return (await this.getInvoiceById(invoiceId))!;
  }

  // Strict Hard Delete Protection (Immutable Financial Audit Trail)
  public static async deletePayment(_id: string): Promise<never> {
    throw new Error('HARD_DELETE_DENIED: Financial records are immutable and non-destructive. Use cancelPayment instead.');
  }

  public static async deleteInvoice(_id: string): Promise<never> {
    throw new Error('HARD_DELETE_DENIED: Financial records are immutable and non-destructive. Invoices cannot be hard deleted.');
  }

  public static async deletePaymentAllocation(_id: string): Promise<never> {
    throw new Error('HARD_DELETE_DENIED: Financial records are immutable and non-destructive. Use reverseAllocation instead.');
  }

  /**
   * Centralized Package Financial Report Engine
   * Level 1: Summary Metrics
   * Level 2: Detail Per Pax
   * Level 3: Breakdown Per PIC / TL
   */
  public static async getPackageFinanceReport(packageId: string): Promise<PackageFinanceReport> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Paket umrah tidak ditemukan.');

    const participants = await this.getParticipants({ packageId });
    const activeParticipants = participants.filter(p => !p.deleted_at);

    let totalB2B = 0;
    let totalSelling = 0;
    let totalDiscount = 0;
    let totalTLDiscount = 0;
    let totalCharge = 0;
    let totalAdjustment = 0;
    let totalNetInvoice = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalOverpayment = 0;
    let paidPaxCount = 0;
    let unpaidPaxCount = 0;

    const paxDetails: PaxFinanceDetail[] = [];
    const picMap = new Map<string, PicFinanceBreakdown>();

    let counter = 1;
    for (const part of activeParticipants) {
      const inv = part.invoice || (await this.getInvoiceByParticipantId(part.id));
      const j = part.jamaah;
      const pic = part.pic;

      const sellingPrice = inv ? inv.base_amount : (part.selling_price || 0);
      const b2bPrice = part.b2b_price || pkg.b2b_price || 0;

      let paxDiscount = 0;
      let paxTLDiscount = 0;
      let paxCharge = 0;
      let paxAdjustment = 0;

      if (inv?.items) {
        for (const item of inv.items) {
          const amt = Number(item.amount) || 0;
          if (item.type === 'CHARGE') {
            paxCharge += amt;
          } else if (item.type === 'DISCOUNT') {
            if (item.category === 'TL_DISCOUNT') {
              paxTLDiscount += amt;
            } else {
              paxDiscount += amt;
            }
          } else if (item.type === 'ADJUSTMENT') {
            paxAdjustment += amt;
          }
        }
      }

      const netInvoice = inv ? inv.total_amount : sellingPrice;
      const paid = inv ? inv.total_paid : 0;
      const outstanding = inv ? inv.outstanding : Math.max(0, netInvoice - paid);
      const overpayment = inv ? inv.overpayment : Math.max(0, paid - netInvoice);
      const status: InvoiceStatus = inv ? inv.status : (paid === 0 ? 'UNPAID' : paid < netInvoice ? 'PARTIAL' : paid === netInvoice ? 'PAID' : 'OVERPAID');

      if (status === 'PAID' || status === 'OVERPAID') {
        paidPaxCount++;
      } else {
        unpaidPaxCount++;
      }

      totalB2B += b2bPrice;
      totalSelling += sellingPrice;
      totalDiscount += paxDiscount;
      totalTLDiscount += paxTLDiscount;
      totalCharge += paxCharge;
      totalAdjustment += paxAdjustment;
      totalNetInvoice += netInvoice;
      totalPaid += paid;
      totalOutstanding += outstanding;
      totalOverpayment += overpayment;

      paxDetails.push({
        no: counter++,
        participant_id: part.id,
        jamaah_id: part.jamaah_id,
        jamaah_name: j?.identity_name || j?.passport_name || 'Jamaah',
        passport_number: j?.passport_number || null,
        pic_id: part.pic_id || null,
        pic_name: pic?.name || 'Direct',
        b2b_price: b2bPrice,
        selling_price: sellingPrice,
        discount: paxDiscount,
        tl_discount: paxTLDiscount,
        charge: paxCharge,
        adjustment: paxAdjustment,
        net_invoice: netInvoice,
        total_paid: paid,
        outstanding,
        overpayment,
        status,
      });

      // Grouping by PIC
      const picKey = part.pic_id || 'DIRECT';
      const picDisplayName = pic?.name || 'Direct';

      const existingPic = picMap.get(picKey) || {
        pic_id: part.pic_id || null,
        pic_name: picDisplayName,
        pax_count: 0,
        total_b2b: 0,
        total_selling: 0,
        total_tl_discount: 0,
        total_invoice: 0,
        total_paid: 0,
        total_outstanding: 0,
        total_overpayment: 0,
      };

      existingPic.pax_count += 1;
      existingPic.total_b2b += b2bPrice;
      existingPic.total_selling += sellingPrice;
      existingPic.total_tl_discount += paxTLDiscount;
      existingPic.total_invoice += netInvoice;
      existingPic.total_paid += paid;
      existingPic.total_outstanding += outstanding;
      existingPic.total_overpayment += overpayment;

      picMap.set(picKey, existingPic);
    }

    const picBreakdowns = Array.from(picMap.values()).sort((a, b) => b.pax_count - a.pax_count);

    return {
      package_id: pkg.id,
      package_name: pkg.package_name,
      departure_date: pkg.departure_date,
      return_date: pkg.return_date,
      registered_pax: activeParticipants.length,
      b2b_price_per_pax: pkg.b2b_price || 0,
      total_b2b: totalB2B,
      total_selling_price: totalSelling,
      total_discount: totalDiscount,
      total_tl_discount: totalTLDiscount,
      total_charge: totalCharge,
      total_adjustment: totalAdjustment,
      total_net_invoice: totalNetInvoice,
      total_paid: totalPaid,
      total_outstanding: totalOutstanding,
      total_overpayment: totalOverpayment,
      paid_pax_count: paidPaxCount,
      unpaid_pax_count: unpaidPaxCount,
      pax_details: paxDetails,
      pic_breakdowns: picBreakdowns,
    };
  }

  // --- PAYMENTS API METHODS ---
  public static async getPayments(filters?: {
    packageId?: string;
    picId?: string;
    allocationStatus?: PaymentAllocationStatus;
    status?: PaymentStatus;
    search?: string;
  }): Promise<Payment[]> {
    let list = globalStore.payments.map(p => this.computePayment(p));

    if (filters?.packageId) {
      list = list.filter(p => p.package_id === filters.packageId);
    }
    if (filters?.picId) {
      list = list.filter(p => p.pic_id === filters.picId);
    }
    if (filters?.allocationStatus) {
      list = list.filter(p => p.allocation_status === filters.allocationStatus);
    }
    if (filters?.status) {
      list = list.filter(p => p.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(p => 
        p.sender_name.toLowerCase().includes(q) ||
        (p.sender_bank && p.sender_bank.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }

  public static async getPaymentById(id: string): Promise<Payment | null> {
    const p = globalStore.payments.find(pm => pm.id === id);
    if (!p) return null;
    return this.computePayment(p);
  }

  public static async createPayment(data: {
    payment_date: string;
    amount: number;
    sender_name: string;
    sender_bank?: string;
    package_id?: string;
    pic_id?: string;
    storage_path?: string;
    notes?: string;
    created_by?: string;
  }): Promise<Payment> {
    if (!data.amount || Number(data.amount) <= 0) {
      throw new Error('Nominal pembayaran harus lebih besar dari 0.');
    }
    if (!data.sender_name || !data.sender_name.trim()) {
      throw new Error('Nama pengirim wajib diisi.');
    }

    const now = new Date().toISOString();
    const newPayment: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      payment_date: data.payment_date || now.split('T')[0],
      amount: Number(data.amount),
      sender_name: data.sender_name.trim(),
      sender_bank: data.sender_bank || null,
      package_id: data.package_id || null,
      pic_id: data.pic_id || null,
      storage_path: data.storage_path || null,
      notes: data.notes || null,
      allocation_status: 'UNALLOCATED',
      status: 'COMPLETED',
      created_by: data.created_by || null,
      created_at: now,
      updated_at: now,
      total_allocated: 0,
      remaining_unallocated: Number(data.amount),
    };

    globalStore.payments.push(newPayment);
    syncStoreToDisk();

    await AuditService.logMutation({
      action: 'PAYMENT_CREATED',
      entityType: 'PAYMENT',
      entityId: newPayment.id,
      packageId: newPayment.package_id,
      metadata: { amount: newPayment.amount, sender_name: newPayment.sender_name },
    });

    return newPayment;
  }

  /**
   * Concurrency-safe, transactional allocation of one payment to multiple invoices
   */
  public static async allocatePayment(
    paymentId: string,
    allocations: { invoiceId: string; amount: number }[],
    created_by?: string
  ): Promise<{ success: boolean; payment: Payment; error?: string }> {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) return { success: false, payment: null as any, error: 'Payment tidak ditemukan.' };
    if (payment.status === 'CANCELLED') return { success: false, payment, error: 'Pembayaran sudah dibatalkan.' };

    const totalToAllocate = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    if (totalToAllocate <= 0) {
      return { success: false, payment, error: 'Nominal alokasi harus lebih dari 0.' };
    }

    // Protection against over-allocation of the payment
    if (totalToAllocate > payment.remaining_unallocated) {
      return {
        success: false,
        payment,
        error: `Total alokasi (Rp ${totalToAllocate.toLocaleString('id-ID')}) melebihi sisa dana pembayaran yang belum dialokasikan (Rp ${payment.remaining_unallocated.toLocaleString('id-ID')}).`,
      };
    }

    const now = new Date().toISOString();
    const newAllocations: PaymentAllocation[] = [];

    // Transactional creation
    for (const item of allocations) {
      if (Number(item.amount) <= 0) continue;
      const inv = await this.getInvoiceById(item.invoiceId);
      if (!inv) {
        return { success: false, payment, error: `Invoice ${item.invoiceId} tidak valid.` };
      }

      // Cross-package validation if payment is scoped to a specific package
      if (payment.package_id && inv.participant?.package_id && payment.package_id !== inv.participant.package_id) {
        return {
          success: false,
          payment,
          error: `Pembayaran terikat ke paket ${payment.package?.package_name}, tidak dapat dialokasikan ke paket lain.`,
        };
      }

      newAllocations.push({
        id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        payment_id: paymentId,
        invoice_id: item.invoiceId,
        amount: Number(item.amount),
        status: 'ACTIVE',
        created_by: created_by || null,
        created_at: now,
        updated_at: now,
      });
    }

    // Commit allocations
    globalStore.payment_allocations.push(...newAllocations);

    // Audit logging for allocations
    for (const alloc of newAllocations) {
      const inv = await this.getInvoiceById(alloc.invoice_id);
      await AuditService.logMutation({
        action: 'PAYMENT_ALLOCATED',
        entityType: 'PAYMENT_ALLOCATION',
        entityId: alloc.id,
        packageId: inv?.participant?.package_id,
        jamaahId: inv?.participant?.jamaah_id,
        jamaahName: inv?.participant?.jamaah?.passport_name || inv?.participant?.jamaah?.identity_name,
        metadata: { payment_id: paymentId, amount: alloc.amount, invoice_id: alloc.invoice_id },
      });
    }

    syncStoreToDisk();
    const updatedPayment = (await this.getPaymentById(paymentId))!;
    return { success: true, payment: updatedPayment };
  }

  /**
   * Reverses an allocation (retains historical audit trail)
   */
  public static async reverseAllocation(
    allocationId: string,
    reversalReason: string,
    reversedBy?: string
  ): Promise<boolean> {
    const allocIdx = globalStore.payment_allocations.findIndex(a => a.id === allocationId);
    if (allocIdx === -1) return false;

    const alloc = globalStore.payment_allocations[allocIdx];
    if (alloc.status === 'REVERSED') return true;

    const now = new Date().toISOString();
    globalStore.payment_allocations[allocIdx] = {
      ...alloc,
      status: 'REVERSED',
      reversed_at: now,
      reversed_by: reversedBy || null,
      reversal_reason: reversalReason || 'Alokasi dibatalkan/dikoreksi oleh admin',
      updated_at: now,
    };

    await AuditService.logMutation({
      action: 'ALLOCATION_REVERSED',
      entityType: 'PAYMENT_ALLOCATION',
      entityId: allocationId,
      metadata: { payment_id: alloc.payment_id, invoice_id: alloc.invoice_id, reason: reversalReason },
    });

    return true;
  }

  /**
   * Non-destructive payment cancellation (deactivates contributions to invoices)
   */
  public static async cancelPayment(
    paymentId: string,
    cancellationReason: string,
    cancelledBy?: string
  ): Promise<Payment> {
    const pIdx = globalStore.payments.findIndex(p => p.id === paymentId);
    if (pIdx === -1) throw new Error('Payment tidak ditemukan.');

    const now = new Date().toISOString();
    globalStore.payments[pIdx] = {
      ...globalStore.payments[pIdx],
      status: 'CANCELLED',
      allocation_status: 'CANCELLED',
      cancelled_at: now,
      cancelled_by: cancelledBy || null,
      cancellation_reason: cancellationReason || 'Dibatalkan oleh admin',
      updated_at: now,
    };

    await AuditService.logMutation({
      action: 'PAYMENT_CANCELLED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      packageId: globalStore.payments[pIdx].package_id,
      metadata: { amount: globalStore.payments[pIdx].amount, reason: cancellationReason },
    });

    return (await this.getPaymentById(paymentId))!;
  }

  /**
   * Auto-distributes payment sequentially across outstanding balances (Preview only)
   */
  public static async autoDistributePayment(
    paymentId: string,
    targetInvoiceIds?: string[]
  ): Promise<{ invoiceId: string; jamaahName: string; outstanding: number; suggestedAmount: number }[]> {
    const payment = await this.getPaymentById(paymentId);
    if (!payment) throw new Error('Payment tidak ditemukan.');

    let invoices = await this.getInvoices();
    if (targetInvoiceIds && targetInvoiceIds.length > 0) {
      invoices = invoices.filter(i => targetInvoiceIds.includes(i.id));
    } else if (payment.package_id) {
      invoices = invoices.filter(i => i.participant?.package_id === payment.package_id);
    } else if (payment.pic_id) {
      invoices = invoices.filter(i => i.participant?.pic_id === payment.pic_id);
    }

    invoices = invoices.filter(i => i.outstanding > 0);

    let remainingFund = payment.remaining_unallocated;
    const preview: { invoiceId: string; jamaahName: string; outstanding: number; suggestedAmount: number }[] = [];

    for (const inv of invoices) {
      if (remainingFund <= 0) break;
      const allocAmt = Math.min(remainingFund, inv.outstanding);
      preview.push({
        invoiceId: inv.id,
        jamaahName: inv.participant?.jamaah?.identity_name || inv.participant?.jamaah?.passport_name || 'Jamaah',
        outstanding: inv.outstanding,
        suggestedAmount: allocAmt,
      });
      remainingFund -= allocAmt;
    }

    return preview;
  }

  /**
   * Returns Payment Inbox (Unallocated payments awaiting assignment)
   */
  public static async getPaymentInbox(): Promise<Payment[]> {
    const list = await this.getPayments();
    return list.filter(p => p.allocation_status === 'UNALLOCATED' && p.status !== 'CANCELLED');
  }

  /**
   * Aggregates high-level KPI metrics for Finance Overview
   */
  public static async getFinanceOverview(): Promise<FinanceOverviewMetrics> {
    const invoices = await this.getInvoices();
    const payments = await this.getPayments();

    const totalInvoices = invoices.reduce((sum, i) => sum + i.total_amount, 0);
    const totalPaid = invoices.reduce((sum, i) => sum + i.total_paid, 0);
    const totalOutstanding = invoices.reduce((sum, i) => sum + i.outstanding, 0);

    const activePayments = payments.filter(p => p.status !== 'CANCELLED');
    const totalUnallocated = activePayments.reduce((sum, p) => sum + p.remaining_unallocated, 0);

    const unallocatedCount = activePayments.filter(p => p.allocation_status === 'UNALLOCATED').length;
    const partiallyAllocatedCount = activePayments.filter(p => p.allocation_status === 'PARTIALLY_ALLOCATED').length;
    const unpaidJamaahCount = invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL').length;
    const overpaidJamaahCount = invoices.filter(i => i.status === 'OVERPAID').length;

    return {
      total_invoices_amount: totalInvoices,
      total_paid_amount: totalPaid,
      total_outstanding_amount: totalOutstanding,
      total_unallocated_amount: totalUnallocated,
      unallocated_payments_count: unallocatedCount,
      unpaid_jamaah_count: unpaidJamaahCount,
      overpaid_jamaah_count: overpaidJamaahCount,
      partially_allocated_payments_count: partiallyAllocatedCount,
    };
  }

  // ==========================================
  // STAGE 3: MANIFEST TEMPLATES & EXPORT REPOSITORY
  // ==========================================

  public static async getManifestTemplates(): Promise<ManifestTemplate[]> {
    return globalStore.manifest_templates.filter(t => !t.archived_at);
  }

  public static async getManifestTemplateById(id: string): Promise<ManifestTemplate | null> {
    return globalStore.manifest_templates.find(t => t.id === id && !t.archived_at) || null;
  }

  public static async getDefaultManifestTemplate(): Promise<ManifestTemplate> {
    const found = globalStore.manifest_templates.find(t => t.is_default && !t.archived_at && t.is_active);
    if (found) return found;
    return globalStore.manifest_templates[0];
  }

  public static async createManifestTemplate(data: Partial<ManifestTemplate>): Promise<ManifestTemplate> {
    const now = new Date().toISOString();
    const newTmpl: ManifestTemplate = {
      id: data.id || `tmpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: data.name || 'Custom Manifest Template',
      storage_path: data.storage_path || null,
      worksheet_name: data.worksheet_name || 'Manifest',
      header_row: data.header_row || 1,
      data_start_row: data.data_start_row || 2,
      field_mapping: data.field_mapping || {
        A: 'no',
        B: 'passport_name',
        C: 'passport_number',
        D: 'gender',
        E: 'birth_place',
        F: 'birth_date',
        G: 'passport_issue_place',
        H: 'passport_issue_date',
        I: 'passport_expiry_date',
        J: 'nik',
        K: 'phone',
        L: 'pic_name',
      },
      date_formats: data.date_formats || { birth_date: 'YYYY-MM-DD', passport_expiry_date: 'YYYY-MM-DD' },
      value_transformations: data.value_transformations || { gender: { MALE: 'M', FEMALE: 'F' } },
      is_active: data.is_active !== undefined ? data.is_active : true,
      is_default: data.is_default || false,
      created_by: data.created_by || null,
      created_at: now,
      updated_at: now,
    };

    if (newTmpl.is_default) {
      globalStore.manifest_templates.forEach(t => { t.is_default = false; });
    }

    globalStore.manifest_templates.push(newTmpl);
    return newTmpl;
  }

  public static async updateManifestTemplate(id: string, data: Partial<ManifestTemplate>): Promise<ManifestTemplate | null> {
    const idx = globalStore.manifest_templates.findIndex(t => t.id === id);
    if (idx === -1) return null;

    if (data.is_default) {
      globalStore.manifest_templates.forEach(t => { t.is_default = false; });
    }

    const updated: ManifestTemplate = {
      ...globalStore.manifest_templates[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    globalStore.manifest_templates[idx] = updated;
    return updated;
  }

  public static async deleteManifestTemplate(id: string): Promise<boolean> {
    const idx = globalStore.manifest_templates.findIndex(t => t.id === id);
    if (idx === -1) return false;
    globalStore.manifest_templates[idx].archived_at = new Date().toISOString();
    globalStore.manifest_templates[idx].is_active = false;
    return true;
  }

  // --- MANIFEST VALIDATION & EXPORT ---
  public static async validateManifest(
    packageId: string,
    templateId?: string,
    sorting?: 'DEFAULT' | 'NAME' | 'PASSPORT_NAME' | 'PIC'
  ): Promise<ManifestValidationSummary> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Paket tidak ditemukan.');

    const allParts = await this.getParticipants({ packageId });
    const participants = allParts.filter(p => !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED');
    const template = templateId ? await this.getManifestTemplateById(templateId) : await this.getDefaultManifestTemplate();

    return ManifestValidator.validatePackageManifest(pkg, participants, template, sorting);
  }

  public static async validatePackageManifest(
    packageId: string,
    templateId?: string,
    sorting?: 'DEFAULT' | 'NAME' | 'PASSPORT_NAME' | 'PIC'
  ): Promise<ManifestValidationSummary> {
    return this.validateManifest(packageId, templateId, sorting);
  }

  public static async exportManifestExcel(
    packageId: string,
    templateId?: string,
    templateBuffer?: Buffer | null,
    options?: ManifestExportOptions
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Paket tidak ditemukan.');

    const participants = await this.getParticipants({ packageId });
    const template = templateId ? await this.getManifestTemplateById(templateId) : await this.getDefaultManifestTemplate();

    return ManifestGenerator.generateManifestExcel(pkg, participants, template, templateBuffer, options);
  }

  // --- FINANCE EXPORTS ---
  public static async exportPackageFinanceExcel(
    packageId: string,
    filters?: FinanceExportFilterOptions
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const report = await this.getPackageFinanceReport(packageId);
    return FinanceExportService.generatePackageFinanceExcel(report, filters);
  }

  public static async exportPaymentsExcel(
    filters?: { packageId?: string; picId?: string; status?: any }
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const payments = await this.getPayments(filters);
    return PaymentExportService.generatePaymentsExcel(payments);
  }

  // --- DOCUMENT ARCHIVE & SEARCH ---
  public static async getDocumentArchive(filters?: {
    search?: string;
    documentType?: DocumentType;
    status?: DocumentStatus;
    isCurrent?: boolean;
    packageId?: string;
    picId?: string;
  }): Promise<DocumentArchiveItem[]> {
    let jamaahList = await this.getJamaahList();

    if (filters?.packageId) {
      const partJamaahIds = globalStore.package_participants
        .filter(p => p.package_id === filters.packageId && !p.deleted_at)
        .map(p => p.jamaah_id);
      jamaahList = jamaahList.filter(j => partJamaahIds.includes(j.id));
    }

    if (filters?.picId) {
      const partJamaahIds = globalStore.package_participants
        .filter(p => p.pic_id === filters.picId && !p.deleted_at)
        .map(p => p.jamaah_id);
      jamaahList = jamaahList.filter(j => partJamaahIds.includes(j.id));
    }

    const results: DocumentArchiveItem[] = [];

    for (const j of jamaahList) {
      const docs = j.documents || globalStore.documents.filter(d => d.jamaah_id === j.id);

      for (const doc of docs) {
        if (filters?.documentType && doc.document_type !== filters.documentType) continue;
        if (filters?.status && doc.status !== filters.status) continue;
        if (filters?.isCurrent !== undefined && doc.is_current !== filters.isCurrent) continue;

        if (filters?.search) {
          const q = filters.search.toLowerCase().trim();
          const match = 
            j.identity_name.toLowerCase().includes(q) ||
            (j.passport_name && j.passport_name.toLowerCase().includes(q)) ||
            (j.passport_number && j.passport_number.toLowerCase().includes(q)) ||
            (j.nik && j.nik.toLowerCase().includes(q)) ||
            (j.kk_number && j.kk_number.toLowerCase().includes(q));
          if (!match) continue;
        }

        const participant = globalStore.package_participants
          .filter(p => p.jamaah_id === j.id && !p.deleted_at)
          .pop();
        const pkg = participant ? globalStore.packages.find(pk => pk.id === participant.package_id) : null;
        const pic = participant?.pic_id ? globalStore.pics.find(pc => pc.id === participant.pic_id) : null;

        results.push({
          id: doc.id,
          jamaah_id: j.id,
          jamaah_name: j.passport_name || j.identity_name,
          passport_name: j.passport_name,
          passport_number: j.passport_number,
          nik: j.nik,
          document_type: doc.document_type,
          storage_path: doc.storage_path,
          original_file_name: doc.original_file_name,
          mime_type: doc.mime_type,
          file_size: doc.file_size,
          status: doc.status,
          is_current: doc.is_current,
          uploaded_at: doc.uploaded_at,
          package_name: pkg?.package_name || null,
          pic_name: pic?.name || null,
        });
      }
    }

    return results.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }

  // --- BULK DOCUMENT PACKAGING & COMPLETENESS ---
  public static async previewPackageDocuments(
    packageId: string,
    options: DocumentZipFilterOptions
  ): Promise<DocumentZipPreviewResult> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Paket tidak ditemukan.');

    const participants = await this.getParticipants({ packageId });
    return DocumentZipService.previewPackageDocuments(pkg, participants, options);
  }

  public static async generatePackageDocumentZip(
    packageId: string,
    options: DocumentZipFilterOptions,
    mockBuffers?: Map<string, Buffer>
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Paket tidak ditemukan.');

    const participants = await this.getParticipants({ packageId });
    const preview = DocumentZipService.previewPackageDocuments(pkg, participants, options);

    const filesWithBuffers: { cleanFileName: string; buffer: Buffer }[] = [];
    for (const f of preview.files_to_download) {
      const buf = mockBuffers?.get(f.storage_path) || Buffer.from(`MOCK DOCUMENT FILE CONTENT: ${f.clean_file_name}`);
      filesWithBuffers.push({ cleanFileName: f.clean_file_name, buffer: buf });
    }

    return DocumentZipService.generateZipArchive(pkg, filesWithBuffers, options);
  }

  public static async getPackageDocumentCompleteness(packageId: string): Promise<PackageDocumentCompleteness> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Paket tidak ditemukan.');

    const participants = await this.getParticipants({ packageId });
    const active = participants.filter(p => !p.deleted_at);

    let passportCount = 0;
    let ktpCount = 0;
    let kkCount = 0;
    let vaksinCount = 0;
    let bukuNikahCount = 0;
    const missingPassport: { jamaah_id: string; name: string; phone?: string | null }[] = [];

    for (const part of active) {
      const j = part.jamaah;
      const docs = j?.documents || globalStore.documents.filter(d => d.jamaah_id === part.jamaah_id);

      const hasPassport = docs.some(d => d.document_type === 'PASSPORT' && d.is_current);
      const hasKtp = docs.some(d => d.document_type === 'KTP' && d.is_current);
      const hasKk = docs.some(d => d.document_type === 'KK' && d.is_current);
      const hasVaksin = docs.some(d => d.document_type === 'VAKSIN' && d.is_current);
      const hasBukuNikah = docs.some(d => d.document_type === 'BUKU_NIKAH' && d.is_current);

      if (hasPassport) passportCount++;
      else missingPassport.push({ jamaah_id: part.jamaah_id, name: j?.passport_name || j?.identity_name || 'Jamaah', phone: j?.phone });

      if (hasKtp) ktpCount++;
      if (hasKk) kkCount++;
      if (hasVaksin) vaksinCount++;
      if (hasBukuNikah) bukuNikahCount++;
    }

    return {
      package_id: pkg.id,
      package_name: pkg.package_name,
      total_participants: active.length,
      passport_count: passportCount,
      ktp_count: ktpCount,
      kk_count: kkCount,
      vaksin_count: vaksinCount,
      buku_nikah_count: bukuNikahCount,
      missing_passport_jamaah: missingPassport,
    };
  }

  // --- EXPORT JOBS & CLEANUP ---
  public static async createExportJob(data: Partial<ExportJob>): Promise<ExportJob> {
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h TTL
    const newJob: ExportJob = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      export_type: data.export_type || 'MANIFEST',
      package_id: data.package_id || null,
      filters: data.filters || {},
      file_name: data.file_name || 'export.xlsx',
      mime_type: data.mime_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      file_size: data.file_size || null,
      storage_path: data.storage_path || null,
      status: 'COMPLETED',
      created_by: data.created_by || null,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    };

    globalStore.export_jobs.push(newJob);
    return newJob;
  }

  public static async getExportJobs(): Promise<ExportJob[]> {
    return globalStore.export_jobs;
  }

  public static async cleanupExpiredExports(): Promise<any> {
    const result = await ExportCleanupService.executePhysicalCleanup(
      globalStore.export_jobs,
      globalStore.documents
    );
    globalStore.export_jobs = result.activeJobs as ExportJob[];
    globalStore.documents = result.remainingDocs as DocumentRecord[];
    return result.report;
  }

  // ==========================================
  // STAGE 4: HELPER - DERIVE EQUIPMENT STATUS
  // ==========================================
  public static deriveEquipmentStatus(
    expected: number,
    prepared: number,
    handedOver: number
  ): EquipmentFulfillmentStatus {
    if (handedOver >= expected && expected > 0) {
      return 'SUDAH_DISERAHKAN';
    }
    if (handedOver > 0) {
      return 'SEBAGIAN_DISERAHKAN';
    }
    if (prepared >= expected && expected > 0) {
      return 'SIAP';
    }
    if (prepared > 0) {
      return 'SEBAGIAN_DISIAPKAN';
    }
    return 'BELUM_DISIAPKAN';
  }

  // ==========================================
  // STAGE 4: MASTER EQUIPMENT ITEMS
  // ==========================================
  public static async getEquipmentItems(includeArchived = false): Promise<EquipmentItem[]> {
    return globalStore.equipment_items
      .filter(item => includeArchived || (!item.archived_at && item.is_active))
      .map(item => {
        const variants = globalStore.equipment_item_variants
          .filter(v => v.equipment_item_id === item.id && !v.archived_at && v.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
        return { ...item, variants };
      });
  }

  public static async getEquipmentItemById(id: string): Promise<EquipmentItem | null> {
    const item = globalStore.equipment_items.find(i => i.id === id);
    if (!item) return null;
    const variants = globalStore.equipment_item_variants
      .filter(v => v.equipment_item_id === item.id && !v.archived_at && v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
    return { ...item, variants };
  }

  public static async createEquipmentItem(data: Partial<EquipmentItem>): Promise<EquipmentItem> {
    const now = new Date().toISOString();
    const newItem: EquipmentItem = {
      id: data.id || `eq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: data.name || 'Item Perlengkapan',
      category: data.category || 'OTHER',
      description: data.description || null,
      requires_variant: !!data.requires_variant,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_by: data.created_by || 'admin-1',
      created_at: now,
      updated_at: now,
      archived_at: null,
    };
    globalStore.equipment_items.push(newItem);
    return newItem;
  }

  public static async updateEquipmentItem(id: string, data: Partial<EquipmentItem>): Promise<EquipmentItem> {
    const idx = globalStore.equipment_items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Item perlengkapan tidak ditemukan.');
    const now = new Date().toISOString();
    globalStore.equipment_items[idx] = {
      ...globalStore.equipment_items[idx],
      ...data,
      updated_at: now,
    };
    return globalStore.equipment_items[idx];
  }

  public static async archiveEquipmentItem(id: string): Promise<EquipmentItem> {
    const idx = globalStore.equipment_items.findIndex(i => i.id === id);
    if (idx === -1) throw new Error('Item perlengkapan tidak ditemukan.');
    const now = new Date().toISOString();
    globalStore.equipment_items[idx] = {
      ...globalStore.equipment_items[idx],
      is_active: false,
      archived_at: now,
      updated_at: now,
    };
    return globalStore.equipment_items[idx];
  }

  public static async deleteEquipmentItem(id: string): Promise<boolean> {
    // Hard delete protection: if item has operational history or package attachments, deny hard delete
    const hasPackageUsage = globalStore.package_equipment_items.some(p => p.equipment_item_id === id && !p.archived_at);
    const hasFulfillment = globalStore.participant_equipment.some(pe => {
      const peItem = globalStore.package_equipment_items.find(pkg => pkg.id === pe.package_equipment_item_id);
      return peItem?.equipment_item_id === id && (pe.quantity_prepared > 0 || pe.quantity_handed_over > 0);
    });

    if (hasPackageUsage || hasFulfillment) {
      throw new Error('Hard delete dilarang: Item perlengkapan memiliki riwayat operasional atau terikat pada paket aktif. Gunakan fungsi arsip.');
    }

    const idx = globalStore.equipment_items.findIndex(i => i.id === id);
    if (idx !== -1) {
      globalStore.equipment_items.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ==========================================
  // STAGE 4: EQUIPMENT VARIANTS
  // ==========================================
  public static async getEquipmentVariants(equipmentItemId: string): Promise<EquipmentVariant[]> {
    return globalStore.equipment_item_variants
      .filter(v => v.equipment_item_id === equipmentItemId && !v.archived_at && v.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  public static async createEquipmentVariant(data: Partial<EquipmentVariant>): Promise<EquipmentVariant> {
    if (!data.equipment_item_id) throw new Error('equipment_item_id wajib diisi.');
    const now = new Date().toISOString();
    const newVariant: EquipmentVariant = {
      id: data.id || `var_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      equipment_item_id: data.equipment_item_id,
      label: data.label || 'Varian',
      sort_order: data.sort_order || 0,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_at: now,
      updated_at: now,
      archived_at: null,
    };
    globalStore.equipment_item_variants.push(newVariant);
    return newVariant;
  }

  public static async updateEquipmentVariant(id: string, data: Partial<EquipmentVariant>): Promise<EquipmentVariant> {
    const idx = globalStore.equipment_item_variants.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Varian tidak ditemukan.');
    const now = new Date().toISOString();
    globalStore.equipment_item_variants[idx] = {
      ...globalStore.equipment_item_variants[idx],
      ...data,
      updated_at: now,
    };
    return globalStore.equipment_item_variants[idx];
  }

  public static async archiveEquipmentVariant(id: string): Promise<EquipmentVariant> {
    const idx = globalStore.equipment_item_variants.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Varian tidak ditemukan.');
    const now = new Date().toISOString();
    globalStore.equipment_item_variants[idx] = {
      ...globalStore.equipment_item_variants[idx],
      is_active: false,
      archived_at: now,
      updated_at: now,
    };
    return globalStore.equipment_item_variants[idx];
  }

  // ==========================================
  // STAGE 4: PACKAGE EQUIPMENT ITEMS
  // ==========================================
  public static async getPackageEquipment(packageId: string, includeArchived = false): Promise<PackageEquipmentItem[]> {
    return globalStore.package_equipment_items
      .filter(p => p.package_id === packageId && (includeArchived || !p.archived_at))
      .map(p => {
        const item = globalStore.equipment_items.find(i => i.id === p.equipment_item_id) || null;
        return {
          ...p,
          equipment_item: item,
        };
      });
  }

  public static async addPackageEquipmentItem(
    packageId: string,
    data: {
      equipment_item_id: string;
      quantity_per_pax?: number;
      applicability?: EquipmentApplicability;
      is_required?: boolean;
      notes?: string;
    }
  ): Promise<PackageEquipmentItem> {
    const qty = data.quantity_per_pax ? Math.max(1, Number(data.quantity_per_pax)) : 1;
    const now = new Date().toISOString();
    
    // Check if already configured and active
    const existing = globalStore.package_equipment_items.find(
      p => p.package_id === packageId && p.equipment_item_id === data.equipment_item_id && !p.archived_at
    );
    if (existing) {
      existing.quantity_per_pax = qty;
      existing.applicability = data.applicability || existing.applicability || 'ALL';
      existing.is_required = data.is_required !== undefined ? data.is_required : existing.is_required;
      existing.notes = data.notes !== undefined ? data.notes : existing.notes;
      existing.updated_at = now;
      await this.syncPackageParticipantEquipment(packageId);
      return existing;
    }

    const newPkgItem: PackageEquipmentItem = {
      id: `pkg_eq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      package_id: packageId,
      equipment_item_id: data.equipment_item_id,
      quantity_per_pax: qty,
      applicability: data.applicability || 'ALL',
      is_required: data.is_required !== undefined ? data.is_required : true,
      notes: data.notes || null,
      created_by: 'admin-1',
      created_at: now,
      updated_at: now,
      archived_at: null,
    };
    globalStore.package_equipment_items.push(newPkgItem);

    // Auto-generate requirements for active participants in package
    await this.syncPackageParticipantEquipment(packageId);

    const masterItem = globalStore.equipment_items.find(i => i.id === data.equipment_item_id);
    return { ...newPkgItem, equipment_item: masterItem || null };
  }

  public static async setPackageEquipment(
    packageId: string,
    items: {
      equipment_item_id: string;
      quantity_per_pax?: number;
      quantity?: number;
      applicability?: EquipmentApplicability;
      is_required?: boolean;
      is_mandatory?: boolean;
      notes?: string;
    }[]
  ): Promise<PackageEquipmentItem[]> {
    const now = new Date().toISOString();
    const existingItems = globalStore.package_equipment_items.filter(p => p.package_id === packageId && !p.archived_at);
    const activeItemIds = new Set(items.map(i => i.equipment_item_id));

    // Archive removed package items (preserving historical participant records)
    for (const existing of existingItems) {
      if (!activeItemIds.has(existing.equipment_item_id)) {
        existing.archived_at = now;
        existing.updated_at = now;
      }
    }

    // Add or update items
    for (const item of items) {
      const match = globalStore.package_equipment_items.find(
        p => p.package_id === packageId && p.equipment_item_id === item.equipment_item_id && !p.archived_at
      );
      const qty = Math.max(1, Number(item.quantity_per_pax || item.quantity || 1));
      const required = item.is_required !== undefined ? item.is_required : (item.is_mandatory !== undefined ? item.is_mandatory : true);
      if (match) {
        match.quantity_per_pax = qty;
        match.applicability = item.applicability || 'ALL';
        match.is_required = required;
        match.notes = item.notes || null;
        match.updated_at = now;
      } else {
        globalStore.package_equipment_items.push({
          id: `pkg_eq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          package_id: packageId,
          equipment_item_id: item.equipment_item_id,
          quantity_per_pax: qty,
          applicability: item.applicability || 'ALL',
          is_required: required,
          notes: item.notes || null,
          created_by: 'admin-1',
          created_at: now,
          updated_at: now,
          archived_at: null,
        });
      }
    }

    // Synchronize participant equipment requirements
    await this.syncPackageParticipantEquipment(packageId);
    return this.getPackageEquipment(packageId);
  }

  public static async updatePackageEquipmentItem(
    id: string,
    data: Partial<PackageEquipmentItem>
  ): Promise<PackageEquipmentItem> {
    const idx = globalStore.package_equipment_items.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Package equipment item tidak ditemukan.');
    const now = new Date().toISOString();
    const updated = {
      ...globalStore.package_equipment_items[idx],
      ...data,
      updated_at: now,
    };
    if (data.quantity_per_pax !== undefined) {
      updated.quantity_per_pax = Math.max(1, Number(data.quantity_per_pax));
    }
    globalStore.package_equipment_items[idx] = updated;

    // Reconcile quantity_expected without erasing prepared or handover history
    await this.syncPackageParticipantEquipment(updated.package_id);
    return updated;
  }

  public static async archivePackageEquipmentItem(id: string): Promise<boolean> {
    const idx = globalStore.package_equipment_items.findIndex(p => p.id === id);
    if (idx === -1) return false;
    const now = new Date().toISOString();
    globalStore.package_equipment_items[idx].archived_at = now;
    globalStore.package_equipment_items[idx].updated_at = now;
    return true;
  }

  // ==========================================
  // STAGE 4: SYNCHRONIZATION & BACKFILL
  // ==========================================
  public static async syncPackageParticipantEquipment(packageId: string): Promise<{
    created_count: number;
    updated_count: number;
    total_active_requirements: number;
  }> {
    const now = new Date().toISOString();
    const pkgEquipment = globalStore.package_equipment_items.filter(
      p => p.package_id === packageId && !p.archived_at
    );
    const participants = globalStore.package_participants.filter(
      p => p.package_id === packageId && !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED'
    );

    let createdCount = 0;
    let updatedCount = 0;
    let totalActive = 0;

    for (const part of participants) {
      const jamaah = globalStore.jamaah.find(j => j.id === part.jamaah_id);
      const gender = jamaah?.gender || null;

      for (const eq of pkgEquipment) {
        // Gender applicability check
        let isApplicable = false;
        if (eq.applicability === 'ALL') {
          isApplicable = true;
        } else if (eq.applicability === 'MALE' && gender === 'MALE') {
          isApplicable = true;
        } else if (eq.applicability === 'FEMALE' && gender === 'FEMALE') {
          isApplicable = true;
        }

        // Check if fulfillment record already exists
        const existing = globalStore.participant_equipment.find(
          pe => pe.package_participant_id === part.id && pe.package_equipment_item_id === eq.id && !pe.archived_at
        );

        if (isApplicable) {
          totalActive++;
          if (existing) {
            // Reconcile quantity_expected if package quantity changed
            if (existing.quantity_expected !== eq.quantity_per_pax) {
              existing.quantity_expected = eq.quantity_per_pax;
              existing.updated_at = now;
              updatedCount++;
            }
          } else {
            // Create new fulfillment record
            const newFulfillment: ParticipantEquipment = {
              id: `pe_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              package_participant_id: part.id,
              package_equipment_item_id: eq.id,
              variant_id: null,
              variant_label_snapshot: null,
              quantity_expected: eq.quantity_per_pax,
              quantity_prepared: 0,
              quantity_handed_over: 0,
              notes: null,
              prepared_at: null,
              prepared_by: null,
              handed_over_at: null,
              handed_over_by: null,
              created_at: now,
              updated_at: now,
              archived_at: null,
            };
            globalStore.participant_equipment.push(newFulfillment);
            createdCount++;
          }
        }
      }
    }

    return {
      created_count: createdCount,
      updated_count: updatedCount,
      total_active_requirements: totalActive,
    };
  }

  public static async syncParticipantEquipmentForSinglePax(participantId: string): Promise<void> {
    const part = globalStore.package_participants.find(p => p.id === participantId && !p.deleted_at);
    if (!part || part.participant_status === 'CANCELLED' || part.participant_status === 'ARCHIVED') return;

    await this.syncPackageParticipantEquipment(part.package_id);
  }

  // ==========================================
  // STAGE 4: PARTICIPANT EQUIPMENT FULFILLMENT
  // ==========================================
  public static async getParticipantEquipmentById(id: string): Promise<ParticipantEquipment | null> {
    const pe = globalStore.participant_equipment.find(p => p.id === id && !p.archived_at);
    if (!pe) return null;

    const pkgItem = globalStore.package_equipment_items.find(p => p.id === pe.package_equipment_item_id);
    const masterItem = pkgItem ? globalStore.equipment_items.find(i => i.id === pkgItem.equipment_item_id) : null;
    const variant = pe.variant_id ? globalStore.equipment_item_variants.find(v => v.id === pe.variant_id) : null;

    return {
      ...pe,
      status: this.deriveEquipmentStatus(pe.quantity_expected, pe.quantity_prepared, pe.quantity_handed_over),
      package_equipment_item: pkgItem ? { ...pkgItem, equipment_item: masterItem || null } : null,
      variant: variant || null,
    };
  }

  public static async getParticipantEquipmentByParticipant(participantId: string): Promise<ParticipantEquipment[]> {
    const list = globalStore.participant_equipment.filter(p => p.package_participant_id === participantId && !p.archived_at);
    return list.map(pe => {
      const pkgItem = globalStore.package_equipment_items.find(p => p.id === pe.package_equipment_item_id);
      const masterItem = pkgItem ? globalStore.equipment_items.find(i => i.id === pkgItem.equipment_item_id) : null;
      const variant = pe.variant_id ? globalStore.equipment_item_variants.find(v => v.id === pe.variant_id) : null;
      return {
        ...pe,
        status: this.deriveEquipmentStatus(pe.quantity_expected, pe.quantity_prepared, pe.quantity_handed_over),
        package_equipment_item: pkgItem ? { ...pkgItem, equipment_item: masterItem || null } : null,
        variant: variant || null,
      };
    });
  }

  public static async updateParticipantEquipmentVariant(
    id: string,
    variantId: string | null,
    adminId = 'admin-1'
  ): Promise<ParticipantEquipment> {
    const pe = globalStore.participant_equipment.find(p => p.id === id && !p.archived_at);
    if (!pe) throw new Error('Participant equipment record tidak ditemukan.');

    const pkgItem = globalStore.package_equipment_items.find(p => p.id === pe.package_equipment_item_id);
    if (!pkgItem) throw new Error('Package equipment item tidak valid.');

    const now = new Date().toISOString();
    let variantLabelSnapshot: string | null = null;

    if (variantId) {
      const variant = globalStore.equipment_item_variants.find(v => v.id === variantId && !v.archived_at);
      if (!variant) throw new Error('Varian tidak ditemukan.');

      // Variant Referential Integrity Check: variant must belong to item's equipment_item_id!
      if (variant.equipment_item_id !== pkgItem.equipment_item_id) {
        throw new Error('Varian referential integrity error: Varian tidak sesuai dengan master perlengkapan yang dipilih.');
      }
      variantLabelSnapshot = variant.label;
    }

    const previousVariant = pe.variant_label_snapshot || 'None';
    pe.variant_id = variantId || null;
    pe.variant_label_snapshot = variantLabelSnapshot;
    pe.updated_at = now;

    // Log VARIANT_CHANGED event
    globalStore.equipment_events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      participant_equipment_id: pe.id,
      event_type: 'VARIANT_CHANGED',
      from_value: previousVariant,
      to_value: variantLabelSnapshot || 'None',
      reason: 'Pembaruan ukuran/varian jamaah',
      created_by: adminId,
      created_at: now,
    });

    syncStoreToDisk();
    return pe;
  }

  public static async prepareParticipantEquipment(params: {
    id: string;
    quantity?: number;
    adminId?: string;
  }): Promise<ParticipantEquipment> {
    const pe = globalStore.participant_equipment.find(p => p.id === params.id && !p.archived_at);
    if (!pe) throw new Error('Participant equipment record tidak ditemukan.');

    const pkgItem = globalStore.package_equipment_items.find(p => p.id === pe.package_equipment_item_id);
    const masterItem = pkgItem ? globalStore.equipment_items.find(i => i.id === pkgItem.equipment_item_id) : null;

    // Required Variant Rule: if item requires variant, variant_id must be selected!
    if (masterItem?.requires_variant && !pe.variant_id) {
      throw new Error('NEEDS_VARIANT: Ukuran/varian belum diisi untuk item ini. Harap pilih varian terlebih dahulu.');
    }

    const targetQty = params.quantity !== undefined ? Number(params.quantity) : pe.quantity_expected;
    if (targetQty > pe.quantity_expected) {
      throw new Error(`Jumlah disiapkan (${targetQty}) melebihi kebutuhan yang diharapkan (${pe.quantity_expected}).`);
    }

    const now = new Date().toISOString();
    pe.quantity_prepared = targetQty;
    pe.prepared_at = now;
    pe.prepared_by = params.adminId || 'admin-1';
    pe.updated_at = now;

    globalStore.equipment_events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      participant_equipment_id: pe.id,
      event_type: 'PREPARED',
      quantity: targetQty,
      to_value: `Prepared ${targetQty}`,
      created_by: params.adminId || 'admin-1',
      created_at: now,
    });

    const part = globalStore.package_participants.find(p => p.id === pe.package_participant_id);
    const jam = part ? globalStore.jamaah.find(j => j.id === part.jamaah_id) : null;

    await AuditService.logMutation({
      actorId: params.adminId || 'admin-1',
      action: 'EQUIPMENT_PREPARED',
      entityType: 'PARTICIPANT_EQUIPMENT',
      entityId: pe.id,
      packageId: part?.package_id,
      jamaahId: part?.jamaah_id,
      jamaahName: jam?.passport_name || jam?.identity_name,
      metadata: { quantity: targetQty, item_name: masterItem?.name },
    });

    return {
      ...pe,
      status: this.deriveEquipmentStatus(pe.quantity_expected, pe.quantity_prepared, pe.quantity_handed_over),
    };
  }

  public static async handoverParticipantEquipment(params: {
    id: string;
    quantity?: number;
    adminId?: string;
    notes?: string;
  }): Promise<ParticipantEquipment> {
    const pe = globalStore.participant_equipment.find(p => p.id === params.id && !p.archived_at);
    if (!pe) throw new Error('Participant equipment record tidak ditemukan.');

    const pkgItem = globalStore.package_equipment_items.find(p => p.id === pe.package_equipment_item_id);
    const masterItem = pkgItem ? globalStore.equipment_items.find(i => i.id === pkgItem.equipment_item_id) : null;

    // Required Variant Rule
    if (masterItem?.requires_variant && !pe.variant_id) {
      throw new Error('NEEDS_VARIANT: Ukuran/varian belum diisi untuk item ini. Harap pilih varian sebelum penyerahan.');
    }

    // Must be prepared first
    if (pe.quantity_prepared === 0) {
      throw new Error('Penyerahan ditolak: Perlengkapan belum disiapkan (quantity_prepared = 0).');
    }

    const targetQty = params.quantity !== undefined ? Number(params.quantity) : pe.quantity_prepared;
    if (targetQty > pe.quantity_prepared) {
      throw new Error(`Jumlah diserahkan (${targetQty}) tidak boleh melebihi jumlah yang sudah disiapkan (${pe.quantity_prepared}).`);
    }

    const now = new Date().toISOString();
    pe.quantity_handed_over = targetQty;
    pe.handed_over_at = now;
    pe.handed_over_by = params.adminId || 'admin-1';
    if (params.notes !== undefined) pe.notes = params.notes;
    pe.updated_at = now;

    globalStore.equipment_events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      participant_equipment_id: pe.id,
      event_type: 'HANDOVER',
      quantity: targetQty,
      to_value: `Handed over ${targetQty}`,
      reason: params.notes || 'Serah terima perlengkapan jamaah',
      created_by: params.adminId || 'admin-1',
      created_at: now,
    });

    const partH = globalStore.package_participants.find(p => p.id === pe.package_participant_id);
    const jamH = partH ? globalStore.jamaah.find(j => j.id === partH.jamaah_id) : null;

    await AuditService.logMutation({
      actorId: params.adminId || 'admin-1',
      action: 'EQUIPMENT_HANDED_OVER',
      entityType: 'PARTICIPANT_EQUIPMENT',
      entityId: pe.id,
      packageId: partH?.package_id,
      jamaahId: partH?.jamaah_id,
      jamaahName: jamH?.passport_name || jamH?.identity_name,
      metadata: { quantity: targetQty, item_name: masterItem?.name },
    });

    return {
      ...pe,
      status: this.deriveEquipmentStatus(pe.quantity_expected, pe.quantity_prepared, pe.quantity_handed_over),
    };
  }

  // ==========================================
  // STAGE 4: BULK OPERATIONS (TRANSACTIONAL)
  // ==========================================
  public static async bulkPrepareEquipment(params: {
    participant_ids?: string[];
    participant_equipment_ids?: string[];
    package_id?: string;
    equipment_item_id?: string;
    adminId?: string;
  }): Promise<{ updated_count: number }> {
    let targetRecords: ParticipantEquipment[] = [];

    if (params.participant_equipment_ids && params.participant_equipment_ids.length > 0) {
      targetRecords = globalStore.participant_equipment.filter(
        pe => params.participant_equipment_ids!.includes(pe.id) && !pe.archived_at
      );
    } else if (params.package_id) {
      const activeParts = globalStore.package_participants
        .filter(p => p.package_id === params.package_id && !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED')
        .map(p => p.id);

      const partFilter = params.participant_ids ? activeParts.filter(id => params.participant_ids!.includes(id)) : activeParts;

      targetRecords = globalStore.participant_equipment.filter(pe => {
        if (pe.archived_at || !partFilter.includes(pe.package_participant_id)) return false;
        if (params.equipment_item_id) {
          const pkgItem = globalStore.package_equipment_items.find(pi => pi.id === pe.package_equipment_item_id);
          return pkgItem?.equipment_item_id === params.equipment_item_id;
        }
        return true;
      });
    }

    if (targetRecords.length === 0) return { updated_count: 0 };

    // Transaction Safety: Pre-validate ALL candidate records before modifying state!
    for (const pe of targetRecords) {
      const pkgItem = globalStore.package_equipment_items.find(pi => pi.id === pe.package_equipment_item_id);
      const masterItem = pkgItem ? globalStore.equipment_items.find(i => i.id === pkgItem.equipment_item_id) : null;
      if (masterItem?.requires_variant && !pe.variant_id) {
        throw new Error(`NEEDS_VARIANT: Gagal bulk preparation. Terdapat item (${masterItem.name}) yang varian/ukurannya belum dipilih.`);
      }
    }

    // Atomic execution
    const now = new Date().toISOString();
    for (const pe of targetRecords) {
      pe.quantity_prepared = pe.quantity_expected;
      pe.prepared_at = now;
      pe.prepared_by = params.adminId || 'admin-1';
      pe.updated_at = now;

      globalStore.equipment_events.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        participant_equipment_id: pe.id,
        event_type: 'PREPARED',
        quantity: pe.quantity_prepared,
        to_value: `Bulk Prepared ${pe.quantity_prepared}`,
        created_by: params.adminId || 'admin-1',
        created_at: now,
      });
    }

    return { updated_count: targetRecords.length };
  }

  public static async bulkHandoverEquipment(params: {
    participant_ids?: string[];
    participant_equipment_ids?: string[];
    package_id?: string;
    equipment_item_id?: string;
    adminId?: string;
    notes?: string;
  }): Promise<{ updated_count: number }> {
    let targetRecords: ParticipantEquipment[] = [];

    if (params.participant_equipment_ids && params.participant_equipment_ids.length > 0) {
      targetRecords = globalStore.participant_equipment.filter(
        pe => params.participant_equipment_ids!.includes(pe.id) && !pe.archived_at
      );
    } else if (params.package_id) {
      const activeParts = globalStore.package_participants
        .filter(p => p.package_id === params.package_id && !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED')
        .map(p => p.id);

      const partFilter = params.participant_ids ? activeParts.filter(id => params.participant_ids!.includes(id)) : activeParts;

      targetRecords = globalStore.participant_equipment.filter(pe => {
        if (pe.archived_at || !partFilter.includes(pe.package_participant_id)) return false;
        if (params.equipment_item_id) {
          const pkgItem = globalStore.package_equipment_items.find(pi => pi.id === pe.package_equipment_item_id);
          return pkgItem?.equipment_item_id === params.equipment_item_id;
        }
        return true;
      });
    }

    if (targetRecords.length === 0) return { updated_count: 0 };

    // Transaction Safety: Pre-validate ALL records
    for (const pe of targetRecords) {
      const pkgItem = globalStore.package_equipment_items.find(pi => pi.id === pe.package_equipment_item_id);
      const masterItem = pkgItem ? globalStore.equipment_items.find(i => i.id === pkgItem.equipment_item_id) : null;
      
      if (masterItem?.requires_variant && !pe.variant_id) {
        throw new Error(`NEEDS_VARIANT: Gagal bulk handover. Terdapat item (${masterItem.name}) yang varian/ukurannya belum dipilih.`);
      }
      if (pe.quantity_prepared === 0) {
        throw new Error('Gagal bulk handover: Terdapat perlengkapan yang belum disiapkan (prepared = 0).');
      }
    }

    // Atomic execution
    const now = new Date().toISOString();
    for (const pe of targetRecords) {
      pe.quantity_handed_over = pe.quantity_prepared;
      pe.handed_over_at = now;
      pe.handed_over_by = params.adminId || 'admin-1';
      if (params.notes) pe.notes = params.notes;
      pe.updated_at = now;

      globalStore.equipment_events.push({
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        participant_equipment_id: pe.id,
        event_type: 'HANDOVER',
        quantity: pe.quantity_handed_over,
        to_value: `Bulk Handover ${pe.quantity_handed_over}`,
        reason: params.notes || 'Bulk serah terima perlengkapan',
        created_by: params.adminId || 'admin-1',
        created_at: now,
      });
    }

    return { updated_count: targetRecords.length };
  }

  // ==========================================
  // STAGE 4: CORRECTION WORKFLOW (WITH AUDIT REASON)
  // ==========================================
  public static async correctParticipantEquipment(params: {
    id: string;
    target_prepared?: number;
    target_handed_over?: number;
    reason: string;
    adminId?: string;
  }): Promise<ParticipantEquipment> {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('Koreksi ditolak: Alasan koreksi wajib diisi (audit requirement).');
    }

    const pe = globalStore.participant_equipment.find(p => p.id === params.id && !p.archived_at);
    if (!pe) throw new Error('Participant equipment record tidak ditemukan.');

    const newPrepared = params.target_prepared !== undefined ? Math.max(0, Number(params.target_prepared)) : pe.quantity_prepared;
    const newHanded = params.target_handed_over !== undefined ? Math.max(0, Number(params.target_handed_over)) : pe.quantity_handed_over;

    if (newPrepared > pe.quantity_expected) {
      throw new Error(`Koreksi invalid: Jumlah disiapkan (${newPrepared}) melebihi kebutuhan (${pe.quantity_expected}).`);
    }
    if (newHanded > newPrepared) {
      throw new Error(`Koreksi invalid: Jumlah diserahkan (${newHanded}) melebihi jumlah disiapkan (${newPrepared}).`);
    }

    const fromVal = `Prepared:${pe.quantity_prepared},Handed:${pe.quantity_handed_over}`;
    const toVal = `Prepared:${newPrepared},Handed:${newHanded}`;

    const now = new Date().toISOString();
    pe.quantity_prepared = newPrepared;
    pe.quantity_handed_over = newHanded;
    if (newHanded === 0) {
      pe.handed_over_at = null;
      pe.handed_over_by = null;
    }
    if (newPrepared === 0) {
      pe.prepared_at = null;
      pe.prepared_by = null;
    }
    pe.updated_at = now;

    globalStore.equipment_events.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      participant_equipment_id: pe.id,
      event_type: 'CORRECTION',
      from_value: fromVal,
      to_value: toVal,
      reason: params.reason,
      created_by: params.adminId || 'admin-1',
      created_at: now,
    });

    return {
      ...pe,
      status: this.deriveEquipmentStatus(pe.quantity_expected, pe.quantity_prepared, pe.quantity_handed_over),
    };
  }

  // ==========================================
  // STAGE 4: PARTICIPANT EQUIPMENT LIST & VIEWS
  // ==========================================
  public static async getParticipantEquipmentList(
    packageId: string,
    options?: { picId?: string; status?: string; search?: string; missingVariant?: boolean }
  ): Promise<ParticipantEquipmentRow[]> {
    // Sync first to ensure all participants have rows
    await this.syncPackageParticipantEquipment(packageId);

    const pkg = globalStore.packages.find(p => p.id === packageId);
    const participants = globalStore.package_participants.filter(
      p => p.package_id === packageId && !p.deleted_at && p.participant_status !== 'CANCELLED' && p.participant_status !== 'ARCHIVED'
    );
    const pkgEquipment = globalStore.package_equipment_items.filter(
      pe => pe.package_id === packageId && !pe.archived_at
    );

    const rows: ParticipantEquipmentRow[] = [];

    for (const part of participants) {
      if (options?.picId && part.pic_id !== options.picId) continue;

      const jamaah = globalStore.jamaah.find(j => j.id === part.jamaah_id);
      if (!jamaah || jamaah.deleted_at) continue;

      if (options?.search) {
        const s = options.search.toLowerCase();
        const matches = 
          (jamaah.identity_name && jamaah.identity_name.toLowerCase().includes(s)) ||
          (jamaah.passport_name && jamaah.passport_name.toLowerCase().includes(s)) ||
          (jamaah.passport_number && jamaah.passport_number.toLowerCase().includes(s)) ||
          (jamaah.nik && jamaah.nik.toLowerCase().includes(s));
        if (!matches) continue;
      }

      const pic = globalStore.pics.find(pc => pc.id === part.pic_id);
      const gender = jamaah.gender || null;

      // Find participant equipment items
      const itemFulfillments = globalStore.participant_equipment.filter(
        pe => pe.package_participant_id === part.id && !pe.archived_at
      );

      const itemDetails: ParticipantEquipmentItemDetail[] = [];
      let hasMissingVariant = false;
      let hasGenderWarning = false;
      let totalReady = 0;
      let totalHanded = 0;

      for (const eq of pkgEquipment) {
        const masterItem = globalStore.equipment_items.find(i => i.id === eq.equipment_item_id);
        if (!masterItem || !masterItem.is_active || masterItem.archived_at) continue;

        // Gender check
        let isApplicable = false;
        if (eq.applicability === 'ALL') {
          isApplicable = true;
        } else if (eq.applicability === 'MALE') {
          if (gender === 'MALE') isApplicable = true;
          else if (gender === null) hasGenderWarning = true;
        } else if (eq.applicability === 'FEMALE') {
          if (gender === 'FEMALE') isApplicable = true;
          else if (gender === null) hasGenderWarning = true;
        }

        if (!isApplicable) continue;

        const fulfillment = itemFulfillments.find(pe => pe.package_equipment_item_id === eq.id);
        const exp = fulfillment ? fulfillment.quantity_expected : eq.quantity_per_pax;
        const prep = fulfillment ? fulfillment.quantity_prepared : 0;
        const hand = fulfillment ? fulfillment.quantity_handed_over : 0;
        const status = this.deriveEquipmentStatus(exp, prep, hand);

        if (status === 'SIAP' || status === 'SUDAH_DISERAHKAN') totalReady++;
        if (status === 'SUDAH_DISERAHKAN') totalHanded++;

        let variantLabel = fulfillment?.variant_label_snapshot || null;
        if (fulfillment?.variant_id) {
          const v = globalStore.equipment_item_variants.find(va => va.id === fulfillment.variant_id);
          if (v) variantLabel = v.label;
        }

        if (masterItem.requires_variant && !fulfillment?.variant_id) {
          hasMissingVariant = true;
        }

        itemDetails.push({
          id: fulfillment ? fulfillment.id : `pending_${part.id}_${eq.id}`,
          package_equipment_item_id: eq.id,
          equipment_item_id: masterItem.id,
          item_name: masterItem.name,
          category: masterItem.category,
          requires_variant: masterItem.requires_variant,
          applicability: eq.applicability,
          variant_id: fulfillment?.variant_id || null,
          variant_label: variantLabel,
          quantity_expected: exp,
          quantity_prepared: prep,
          quantity_handed_over: hand,
          status,
          prepared_at: fulfillment?.prepared_at || null,
          handed_over_at: fulfillment?.handed_over_at || null,
          notes: fulfillment?.notes || null,
        });
      }

      if (options?.missingVariant && !hasMissingVariant) continue;

      // Calculate overall status for the participant
      let overallStatus: 'NOT_STARTED' | 'PREPARING' | 'READY' | 'COLLECTED' | 'NEEDS_REVIEW' = 'NOT_STARTED';
      if (hasGenderWarning) {
        overallStatus = 'NEEDS_REVIEW';
      } else if (itemDetails.length > 0) {
        if (totalHanded === itemDetails.length) {
          overallStatus = 'COLLECTED';
        } else if (totalReady === itemDetails.length) {
          overallStatus = 'READY';
        } else if (totalReady > 0 || totalHanded > 0) {
          overallStatus = 'PREPARING';
        } else {
          overallStatus = 'NOT_STARTED';
        }
      }

      if (options?.status && options.status !== 'ALL' && overallStatus !== options.status) {
        continue;
      }

      rows.push({
        participant_id: part.id,
        jamaah_id: jamaah.id,
        jamaah_name: jamaah.identity_name,
        passport_name: jamaah.passport_name || null,
        passport_number: jamaah.passport_number || null,
        gender: jamaah.gender || null,
        pic_id: part.pic_id || null,
        pic_name: pic ? pic.name : 'Direct (Tanpa PIC)',
        package_id: packageId,
        package_name: pkg?.package_name || null,
        items: itemDetails,
        total_items: itemDetails.length,
        ready_items: totalReady,
        handed_over_items: totalHanded,
        has_missing_variant: hasMissingVariant,
        has_gender_warning: hasGenderWarning,
        overall_status: overallStatus,
      });
    }

    return rows;
  }

  // ==========================================
  // STAGE 4: PACKAGE EQUIPMENT RECAP
  // ==========================================
  public static async getPackageEquipmentRecap(packageId: string): Promise<PackageEquipmentRecap> {
    const list = await this.getParticipantEquipmentList(packageId);
    const pkg = globalStore.packages.find(p => p.id === packageId);
    const pkgEquipment = globalStore.package_equipment_items.filter(
      pe => pe.package_id === packageId && !pe.archived_at
    );

    let maleCount = 0;
    let femaleCount = 0;
    let unknownGenderCount = 0;

    for (const row of list) {
      if (row.gender === 'MALE') maleCount++;
      else if (row.gender === 'FEMALE') femaleCount++;
      else unknownGenderCount++;
    }

    let totalNeeded = 0;
    let totalReady = 0;
    let totalHanded = 0;

    let fullyReadyCount = 0;
    let fullyHandedCount = 0;
    let missingVariantPaxCount = 0;

    const missingGenderParticipants: { participant_id: string; name: string; missing_items: string[] }[] = [];
    const missingVariantParticipants: { participant_id: string; name: string; item_name: string }[] = [];

    for (const row of list) {
      if (row.has_missing_variant) missingVariantPaxCount++;
      if (row.overall_status === 'READY' || row.overall_status === 'COLLECTED') fullyReadyCount++;
      if (row.overall_status === 'COLLECTED') fullyHandedCount++;

      if (row.has_gender_warning) {
        const missingItems = pkgEquipment
          .filter(e => e.applicability !== 'ALL')
          .map(e => {
            const m = globalStore.equipment_items.find(i => i.id === e.equipment_item_id);
            return m?.name || 'Item Khusus Gender';
          });
        missingGenderParticipants.push({
          participant_id: row.participant_id,
          name: row.jamaah_name,
          missing_items: missingItems,
        });
      }

      for (const item of row.items) {
        totalNeeded += item.quantity_expected;
        totalReady += item.quantity_prepared;
        totalHanded += item.quantity_handed_over;

        if (item.requires_variant && !item.variant_id) {
          missingVariantParticipants.push({
            participant_id: row.participant_id,
            name: row.jamaah_name,
            item_name: item.item_name,
          });
        }
      }
    }

    // Build item_summaries
    const itemSummaries: PackageEquipmentSummaryItem[] = [];

    for (const eq of pkgEquipment) {
      const masterItem = globalStore.equipment_items.find(i => i.id === eq.equipment_item_id);
      if (!masterItem || masterItem.archived_at || !masterItem.is_active) continue;

      let itemNeeded = 0;
      let itemPrepared = 0;
      let itemHanded = 0;
      let varComplete = 0;
      let varMissing = 0;

      const variants = globalStore.equipment_item_variants
        .filter(v => v.equipment_item_id === masterItem.id && !v.archived_at && v.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);

      const variantMap = new Map<string | null, { label: string; needed: number; prepared: number; handed: number }>();
      
      for (const v of variants) {
        variantMap.set(v.id, { label: v.label, needed: 0, prepared: 0, handed: 0 });
      }
      variantMap.set(null, { label: 'Belum Diisi', needed: 0, prepared: 0, handed: 0 });

      for (const row of list) {
        const matchingItem = row.items.find(it => it.package_equipment_item_id === eq.id);
        if (matchingItem) {
          itemNeeded += matchingItem.quantity_expected;
          itemPrepared += matchingItem.quantity_prepared;
          itemHanded += matchingItem.quantity_handed_over;

          const vKey = matchingItem.variant_id || null;
          if (masterItem.requires_variant) {
            if (matchingItem.variant_id) varComplete++;
            else varMissing++;
          }

          const existingVar = variantMap.get(vKey);
          if (existingVar) {
            existingVar.needed += matchingItem.quantity_expected;
            existingVar.prepared += matchingItem.quantity_prepared;
            existingVar.handed += matchingItem.quantity_handed_over;
          } else {
            variantMap.set(vKey, {
              label: matchingItem.variant_label || 'Varian Lain',
              needed: matchingItem.quantity_expected,
              prepared: matchingItem.quantity_prepared,
              handed: matchingItem.quantity_handed_over,
            });
          }
        }
      }

      const variantBreakdown: VariantBreakdownItem[] = [];
      for (const [vId, vData] of variantMap.entries()) {
        if (masterItem.requires_variant || vData.needed > 0) {
          variantBreakdown.push({
            variant_id: vId,
            label: vData.label,
            qty_needed: vData.needed,
            qty_prepared: vData.prepared,
            qty_handed_over: vData.handed,
          });
        }
      }

      itemSummaries.push({
        package_equipment_item_id: eq.id,
        equipment_item_id: masterItem.id,
        item_name: masterItem.name,
        category: masterItem.category,
        requires_variant: masterItem.requires_variant,
        applicability: eq.applicability,
        quantity_per_pax: eq.quantity_per_pax,
        total_needed: itemNeeded,
        total_prepared: itemPrepared,
        total_handed_over: itemHanded,
        total_remaining: Math.max(0, itemNeeded - itemHanded),
        variant_complete_count: varComplete,
        variant_missing_count: varMissing,
        variant_breakdown: variantBreakdown,
      });
    }

    return {
      package_id: packageId,
      package_name: pkg?.package_name || 'Paket Umrah',
      total_active_participants: list.length,
      male_count: maleCount,
      female_count: femaleCount,
      unknown_gender_count: unknownGenderCount,
      total_items_needed: totalNeeded,
      total_items_ready: totalReady,
      total_items_handed_over: totalHanded,
      pax_fully_ready_count: fullyReadyCount,
      pax_fully_handed_over_count: fullyHandedCount,
      missing_variants_pax_count: missingVariantPaxCount,
      action_required: {
        missing_gender_participants: missingGenderParticipants,
        missing_variant_participants: missingVariantParticipants,
        incomplete_preparation_pax_count: Math.max(0, list.length - fullyReadyCount),
        pending_handover_pax_count: Math.max(0, list.length - fullyHandedCount),
      },
      item_summaries: itemSummaries,
    };
  }

  // ==========================================
  // STAGE 4: PER-JAMAAH EQUIPMENT HISTORY (PER TRIP)
  // ==========================================
  public static async getJamaahEquipmentHistory(jamaahId: string): Promise<{
    package_id: string;
    package_name: string;
    departure_date: string;
    participant_status: string;
    items: ParticipantEquipmentItemDetail[];
    overall_status: string;
  }[]> {
    const parts = globalStore.package_participants.filter(
      p => p.jamaah_id === jamaahId && !p.deleted_at
    );

    const history = [];

    for (const part of parts) {
      const list = await this.getParticipantEquipmentList(part.package_id);
      const row = list.find(r => r.participant_id === part.id);
      const pkg = globalStore.packages.find(p => p.id === part.package_id);

      if (row) {
        history.push({
          package_id: part.package_id,
          package_name: pkg?.package_name || 'Paket Umrah',
          departure_date: pkg?.departure_date || '-',
          participant_status: part.participant_status,
          items: row.items,
          overall_status: row.overall_status,
        });
      }
    }

    return history;
  }

  public static async getParticipantEquipmentEvents(participantEquipmentId: string): Promise<EquipmentEvent[]> {
    return globalStore.equipment_events.filter(e => e.participant_equipment_id === participantEquipmentId);
  }

  // ==========================================
  // STAGE 4: HARD DELETE PROTECTION
  // ==========================================
  public static async deleteParticipantEquipment(id: string): Promise<boolean> {
    const pe = globalStore.participant_equipment.find(p => p.id === id);
    if (pe && (pe.quantity_prepared > 0 || pe.quantity_handed_over > 0)) {
      throw new Error('Hard delete dilarang: Record fulfillment memiliki riwayat penyiapan/penyerahan. Gunakan koreksi atau arsip.');
    }
    const idx = globalStore.participant_equipment.findIndex(p => p.id === id);
    if (idx !== -1) {
      globalStore.participant_equipment.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ==========================================
  // GLOBAL SEARCH
  // ==========================================
  public static async globalSearch(query: string) {
    if (!query || query.trim().length === 0) return { jamaah: [], packages: [], pics: [], payments: [] };
    const q = query.toLowerCase().trim();

    const jamaah = globalStore.jamaah
      .filter(j => !j.deleted_at && (
        (j.identity_name && j.identity_name.toLowerCase().includes(q)) ||
        (j.passport_name && j.passport_name.toLowerCase().includes(q)) ||
        (j.passport_number && j.passport_number.toLowerCase().includes(q)) ||
        (j.nik && j.nik.toLowerCase().includes(q)) ||
        (j.phone && j.phone.toLowerCase().includes(q))
      ))
      .slice(0, 5);

    const packages = globalStore.packages
      .filter(p => !p.deleted_at && p.package_name.toLowerCase().includes(q))
      .slice(0, 5);

    const pics = globalStore.pics
      .filter(pic => !pic.deleted_at && pic.name.toLowerCase().includes(q))
      .slice(0, 5);

    const payments = globalStore.payments
      .filter(p => p.sender_name.toLowerCase().includes(q) || (p.notes && p.notes.toLowerCase().includes(q)))
      .slice(0, 5);

    return { jamaah, packages, pics, payments };
  }

  // ==========================================
  // STAGE 5: OPERATIONAL ALERTS REPOSITORY
  // ==========================================
  public static async getOperationalAlerts(filters?: {
    status?: 'OPEN' | 'RESOLVED' | 'DISMISSED';
    category?: string;
    severity?: string;
    packageId?: string;
  }): Promise<OperationalAlert[]> {
    let list = [...globalStore.operational_alerts];

    if (filters?.status) {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters?.category) {
      list = list.filter(a => a.category === filters.category);
    }
    if (filters?.severity) {
      list = list.filter(a => a.severity === filters.severity);
    }
    if (filters?.packageId) {
      list = list.filter(a => a.package_id === filters.packageId);
    }

    // Sort by severity (CRITICAL -> WARNING -> INFO), then nearest last_detected
    const severityOrder = { CRITICAL: 1, WARNING: 2, INFO: 3 };
    return list.sort((a, b) => {
      const diff = (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9);
      if (diff !== 0) return diff;
      return new Date(b.last_detected_at).getTime() - new Date(a.last_detected_at).getTime();
    });
  }

  public static async getOperationalAlertById(id: string): Promise<OperationalAlert | null> {
    return globalStore.operational_alerts.find(a => a.id === id) || null;
  }

  public static async getOperationalAlertByKey(key: string): Promise<OperationalAlert | null> {
    return globalStore.operational_alerts.find(a => a.alert_key === key) || null;
  }

  public static async saveOperationalAlert(alert: OperationalAlert): Promise<OperationalAlert> {
    const existingIdx = globalStore.operational_alerts.findIndex(
      a => a.id === alert.id || a.alert_key === alert.alert_key
    );

    if (existingIdx !== -1) {
      globalStore.operational_alerts[existingIdx] = {
        ...globalStore.operational_alerts[existingIdx],
        ...alert,
        updated_at: new Date().toISOString(),
      };
      syncStoreToDisk();
      return globalStore.operational_alerts[existingIdx];
    }

    globalStore.operational_alerts.push(alert);
    syncStoreToDisk();
    return alert;
  }

  public static async deleteOperationalAlert(id: string): Promise<boolean> {
    throw new Error('Hard delete dilarang: Operational alerts bersifat non-destruktif. Gunakan dismiss atau biarkan auto-resolve.');
  }

  // ==========================================
  // STAGE 5: CENTRAL AUDIT LOG REPOSITORY
  // ==========================================
  public static async createAuditLog(entry: AuditLog): Promise<AuditLog> {
    globalStore.audit_logs.push(entry);
    syncStoreToDisk();
    return entry;
  }

  public static async getAuditLogs(filters?: {
    packageId?: string;
    jamaahId?: string;
    entityType?: string;
    action?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let list = [...globalStore.audit_logs];

    if (filters?.packageId) {
      list = list.filter(l => l.package_id === filters.packageId);
    }
    if (filters?.jamaahId) {
      list = list.filter(l => l.jamaah_id === filters.jamaahId);
    }
    if (filters?.entityType) {
      list = list.filter(l => l.entity_type === filters.entityType);
    }
    if (filters?.action) {
      list = list.filter(l => l.action === filters.action);
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filters?.limit) {
      list = list.slice(0, filters.limit);
    }
    return list;
  }

  public static async deleteAuditLog(id: string): Promise<boolean> {
    throw new Error('Hard delete dilarang: Audit logs bersifat append-only dan tidak dapat dihapus.');
  }

  public static async getParticipantById(id: string): Promise<PackageParticipant | null> {
    return globalStore.package_participants.find(p => p.id === id) || null;
  }
}



