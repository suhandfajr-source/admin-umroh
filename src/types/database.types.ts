export type DocumentType = 'PASSPORT' | 'KTP' | 'KK' | 'VAKSIN' | 'BUKU_NIKAH' | 'OTHER';

export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'CONFIRMED' | 'FAILED' | 'ARCHIVED';

export type PackageStatus = 'DRAFT' | 'OPEN' | 'FULL' | 'DEPARTED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export type ParticipantStatus = 'REGISTERED' | 'CONFIRMED' | 'CANCELLED' | 'ARCHIVED';

export type ReviewStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export type AdminRole = 'ADMIN';

export interface AdminUser {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Jamaah {
  id: string;
  identity_name: string; // Neutral master person name
  passport_name: string | null;
  passport_number: string | null;
  birth_place: string | null;
  birth_date: string | null; // ISO YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | null;
  passport_issue_place: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  ktp_name: string | null;
  nik: string | null;
  kk_number: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  
  // Relations / Computed
  member_id?: string | null;
  latest_departure?: string | null;
  documents?: DocumentRecord[];
  active_package?: Package | null;
  trips_count?: number;
  passport_warning?: 'EXPIRED' | 'EXPIRING_SOON' | 'MISSING' | 'INCOMPLETE' | 'VALID' | null;
}

export interface DocumentRecord {
  id: string;
  jamaah_id: string | null;
  document_type: DocumentType;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  status: DocumentStatus;
  is_current: boolean;
  uploaded_at: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined relation
  extraction?: DocumentExtraction | null;
  jamaah?: Jamaah | null;
  signed_url?: string | null;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  raw_extraction: string | null;
  extracted_fields: Record<string, any>;
  classification_result: DocumentType | null;
  confidence_score: number;
  mrz_data: Record<string, any> | null;
  review_status: ReviewStatus;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  package_name: string;
  departure_date: string; // ISO YYYY-MM-DD
  return_date: string; // ISO YYYY-MM-DD
  b2b_price: number; // BigInt represented as number in Rupiah
  reference_price: number;
  airline: string | null;
  makkah_hotel: string | null;
  madinah_hotel: string | null;
  schedule: string | null;
  quota: number;
  status: PackageStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  
  // Computed
  participants_count?: number;
}

export interface PIC {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  
  // Computed
  jamaah_count?: number;
}

export interface PackageParticipant {
  id: string;
  package_id: string;
  jamaah_id: string;
  pic_id: string | null;
  b2b_price: number; // Whole Rupiah
  selling_price: number; // Whole Rupiah
  participant_status: ParticipantStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  
  // Relations
  jamaah?: Jamaah;
  package?: Package;
  pic?: PIC | null;
  invoice?: Invoice | null;
}

// ==========================================
// STAGE 2: FINANCE JAMAAH TYPES
// ==========================================

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
export type InvoiceItemType = 'CHARGE' | 'DISCOUNT' | 'ADJUSTMENT';
export type PaymentAllocationStatus = 'UNALLOCATED' | 'PARTIALLY_ALLOCATED' | 'ALLOCATED' | 'CANCELLED';
export type PaymentStatus = 'COMPLETED' | 'CANCELLED';
export type AllocationStatus = 'ACTIVE' | 'REVERSED';

export interface Invoice {
  id: string;
  package_participant_id: string;
  base_amount: number; // Raw BIGINT Rupiah (snapshot of selling_price)
  status: InvoiceStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  
  // Relations & Computed Fields
  items?: InvoiceItem[];
  allocations?: PaymentAllocation[];
  total_amount: number; // base_amount + charges - discounts + adjustments
  total_paid: number; // SUM(active non-cancelled allocations)
  outstanding: number; // Math.max(0, total_amount - total_paid)
  overpayment: number; // Math.max(0, total_paid - total_amount)
  participant?: PackageParticipant;
}

export type InvoiceDiscountCategory = 
  | 'TL_DISCOUNT'
  | 'PROMO_DISCOUNT'
  | 'OWNER_DISCOUNT'
  | 'SPECIAL_DISCOUNT'
  | 'OTHER_DISCOUNT'
  | 'CHARGE_ITEM'
  | 'ADJUSTMENT_ITEM';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  type: InvoiceItemType;
  category?: InvoiceDiscountCategory | string;
  description: string;
  amount: number; // Raw BIGINT Rupiah (positive or negative for ADJUSTMENT)
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaxFinanceDetail {
  no: number;
  participant_id: string;
  jamaah_id: string;
  jamaah_name: string;
  passport_number?: string | null;
  pic_id?: string | null;
  pic_name: string;
  b2b_price: number; // Raw numeric BIGINT
  selling_price: number; // Raw numeric BIGINT
  discount: number; // Raw numeric BIGINT (SUM other discounts)
  tl_discount: number; // Raw numeric BIGINT (SUM TL_DISCOUNT)
  charge: number; // Raw numeric BIGINT (SUM charges)
  adjustment: number; // Raw numeric BIGINT (SUM adjustments)
  net_invoice: number; // Raw numeric BIGINT (final total_amount)
  total_paid: number; // Raw numeric BIGINT
  outstanding: number; // Raw numeric BIGINT
  overpayment: number; // Raw numeric BIGINT
  status: InvoiceStatus;
}

export interface PicFinanceBreakdown {
  pic_id?: string | null;
  pic_name: string;
  pax_count: number;
  total_b2b: number; // Raw numeric BIGINT
  total_selling: number; // Raw numeric BIGINT
  total_tl_discount: number; // Raw numeric BIGINT
  total_invoice: number; // Raw numeric BIGINT
  total_paid: number; // Raw numeric BIGINT
  total_outstanding: number; // Raw numeric BIGINT
  total_overpayment: number; // Raw numeric BIGINT
}

export interface PackageFinanceReport {
  package_id: string;
  package_name: string;
  departure_date: string;
  return_date: string;
  
  // Package Summary Metrics (Pure Numeric)
  registered_pax: number;
  b2b_price_per_pax: number;
  total_b2b: number;
  total_selling_price: number;
  total_discount: number;
  total_tl_discount: number;
  total_charge: number;
  total_adjustment: number;
  total_net_invoice: number;
  total_paid: number;
  total_outstanding: number;
  total_overpayment: number;
  paid_pax_count: number;
  unpaid_pax_count: number;

  // Granular Levels
  pax_details: PaxFinanceDetail[];
  pic_breakdowns: PicFinanceBreakdown[];
}

export interface Payment {
  id: string;
  payment_date: string; // ISO YYYY-MM-DD
  amount: number; // Raw BIGINT Rupiah received
  sender_name: string;
  sender_bank?: string | null;
  package_id?: string | null;
  pic_id?: string | null;
  storage_path?: string | null;
  notes?: string | null;
  allocation_status: PaymentAllocationStatus;
  status: PaymentStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;

  // Relations & Computed Fields
  allocations?: PaymentAllocation[];
  total_allocated: number; // SUM(active allocations)
  remaining_unallocated: number; // Math.max(0, amount - total_allocated)
  package?: Package | null;
  pic?: PIC | null;
  signed_proof_url?: string | null;
  jamaah_name?: string | null;
  jamaah_id?: string | null;
  raw_jamaah_id?: string | null;
  payment_type?: string | null;
  package_name?: string | null;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount: number; // Raw BIGINT Rupiah allocated
  status: AllocationStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;

  // Relations
  invoice?: Invoice;
  payment?: Payment;
}

export interface FinanceOverviewMetrics {
  total_invoices_amount: number;
  total_paid_amount: number;
  total_outstanding_amount: number;
  total_unallocated_amount: number;
  unallocated_payments_count: number;
  unpaid_jamaah_count: number;
  overpaid_jamaah_count: number;
  partially_allocated_payments_count: number;
}

// ==========================================
// STAGE 3: MANIFEST, EXPORT & DOCUMENTS
// ==========================================

export type ManifestSystemField = 
  | 'no'
  | 'passport_name'
  | 'passport_number'
  | 'birth_place'
  | 'birth_date'
  | 'gender'
  | 'passport_issue_place'
  | 'passport_issue_date'
  | 'passport_expiry_date'
  | 'ktp_name'
  | 'identity_name'
  | 'nik'
  | 'kk_number'
  | 'phone'
  | 'address'
  | 'package_name'
  | 'departure_date'
  | 'return_date'
  | 'airline'
  | 'makkah_hotel'
  | 'madinah_hotel'
  | 'pic_name'
  | 'selling_price'
  | 'b2b_price'
  | 'participant_status';

export interface ManifestTemplate {
  id: string;
  name: string;
  storage_path?: string | null;
  worksheet_name: string;
  header_row: number;
  data_start_row: number;
  field_mapping: Record<string, ManifestSystemField>; // e.g. { "A": "no", "B": "passport_name" }
  date_formats?: Record<string, string>; // e.g. { "birth_date": "YYYY-MM-DD" }
  value_transformations?: Record<string, Record<string, string>>; // e.g. { "gender": { "MALE": "M", "FEMALE": "F" } }
  is_active: boolean;
  is_default: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export type ManifestValidationStatus = 'READY' | 'WARNING' | 'ERROR';

export interface ManifestParticipantIssue {
  field: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ManifestParticipantValidation {
  participant_id: string;
  jamaah_id: string;
  jamaah_name: string;
  passport_name: string | null;
  passport_number: string | null;
  status: ManifestValidationStatus;
  issues: ManifestParticipantIssue[];
  mapped_values: Record<string, any>;
}

export interface ManifestValidationSummary {
  package_id: string;
  package_name: string;
  template_id?: string;
  template_name?: string;
  total_participants: number;
  ready_count: number;
  warning_count: number;
  error_count: number;
  participants: ManifestParticipantValidation[];
}

export type ExportType = 'MANIFEST' | 'DOCUMENT_ZIP' | 'PACKAGE_FINANCE' | 'PAYMENT_REPORT';
export type ExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface ExportJob {
  id: string;
  export_type: ExportType;
  package_id?: string | null;
  filters?: Record<string, any>;
  file_name: string;
  mime_type: string;
  file_size?: number | null;
  storage_path?: string | null;
  status: ExportStatus;
  created_by?: string | null;
  created_at: string;
  expires_at: string;
}

export interface PackageDocumentCompleteness {
  package_id: string;
  package_name: string;
  total_participants: number;
  passport_count: number;
  ktp_count: number;
  kk_count: number;
  vaksin_count: number;
  buku_nikah_count: number;
  missing_passport_jamaah: { jamaah_id: string; name: string; phone?: string | null }[];
}

export interface DocumentArchiveItem {
  id: string;
  jamaah_id: string;
  jamaah_name: string;
  passport_name?: string | null;
  passport_number?: string | null;
  nik?: string | null;
  document_type: DocumentType;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  status: DocumentStatus;
  is_current: boolean;
  uploaded_at: string;
  package_name?: string | null;
  pic_name?: string | null;
}

// ==========================================
// STAGE 4: PERLENGKAPAN JAMAAH TYPES
// ==========================================

export type EquipmentCategory = 'BAG' | 'APPAREL' | 'IBADAH' | 'IDENTITY' | 'DOCUMENT' | 'ACCESSORY' | 'OTHER';
export type EquipmentApplicability = 'ALL' | 'MALE' | 'FEMALE';
export type EquipmentFulfillmentStatus = 'BELUM_DISIAPKAN' | 'SEBAGIAN_DISIAPKAN' | 'SIAP' | 'SEBAGIAN_DISERAHKAN' | 'SUDAH_DISERAHKAN';
export type EquipmentEventType = 'PREPARED' | 'HANDOVER' | 'CORRECTION' | 'VARIANT_CHANGED' | 'UNPREPARED' | 'UNHANDOVER';

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  description?: string | null;
  requires_variant: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  variants?: EquipmentVariant[];
}

export interface EquipmentVariant {
  id: string;
  equipment_item_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface PackageEquipmentItem {
  id: string;
  package_id: string;
  equipment_item_id: string;
  quantity_per_pax: number;
  applicability: EquipmentApplicability;
  is_required: boolean;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  equipment_item?: EquipmentItem | null;
}

export interface ParticipantEquipment {
  id: string;
  package_participant_id: string;
  package_equipment_item_id: string;
  variant_id?: string | null;
  variant_label_snapshot?: string | null;
  quantity_expected: number;
  quantity_prepared: number;
  quantity_handed_over: number;
  notes?: string | null;
  prepared_at?: string | null;
  prepared_by?: string | null;
  handed_over_at?: string | null;
  handed_over_by?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;

  // Joined fields
  status?: EquipmentFulfillmentStatus;
  package_equipment_item?: PackageEquipmentItem | null;
  variant?: EquipmentVariant | null;
}

export interface EquipmentEvent {
  id: string;
  participant_equipment_id: string;
  event_type: EquipmentEventType;
  quantity?: number | null;
  from_value?: string | null;
  to_value?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface VariantBreakdownItem {
  variant_id: string | null;
  label: string;
  qty_needed: number;
  qty_prepared: number;
  qty_handed_over: number;
}

export interface PackageEquipmentSummaryItem {
  package_equipment_item_id: string;
  equipment_item_id: string;
  item_name: string;
  category: EquipmentCategory;
  requires_variant: boolean;
  applicability: EquipmentApplicability;
  quantity_per_pax: number;
  total_needed: number;
  total_expected?: number;
  total_prepared: number;
  total_handed_over: number;
  total_remaining: number;
  variant_complete_count: number;
  variant_missing_count: number;
  variant_breakdown: VariantBreakdownItem[];
  variants_breakdown?: VariantBreakdownItem[];
  unassigned_variant_count?: number;
  completion_percentage?: number;
}

export interface ParticipantEquipmentItemDetail {
  id: string;
  package_equipment_item_id: string;
  equipment_item_id: string;
  item_name: string;
  category: EquipmentCategory;
  requires_variant: boolean;
  applicability: EquipmentApplicability;
  variant_id?: string | null;
  variant_label?: string | null;
  quantity_expected: number;
  quantity_prepared: number;
  quantity_handed_over: number;
  status: EquipmentFulfillmentStatus;
  prepared_at?: string | null;
  handed_over_at?: string | null;
  notes?: string | null;
}

export interface ParticipantEquipmentRow {
  participant_id: string;
  jamaah_id: string;
  jamaah_name: string;
  passport_name?: string | null;
  passport_number?: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  pic_id?: string | null;
  pic_name?: string | null;
  package_id: string;
  package_name?: string | null;
  items: ParticipantEquipmentItemDetail[];
  total_items: number;
  ready_items: number;
  handed_over_items: number;
  has_missing_variant: boolean;
  has_gender_warning: boolean;
  overall_status: 'NOT_STARTED' | 'PREPARING' | 'READY' | 'COLLECTED' | 'NEEDS_REVIEW';
}

export interface PackageEquipmentRecap {
  package_id: string;
  package_name: string;
  total_active_participants: number;
  male_count: number;
  female_count: number;
  unknown_gender_count: number;
  total_items_needed: number;
  total_items_ready: number;
  total_items_handed_over: number;
  pax_fully_ready_count: number;
  pax_fully_handed_over_count: number;
  missing_variants_pax_count: number;
  action_required: {
    missing_gender_participants: { participant_id: string; name: string; missing_items: string[] }[];
    missing_variant_participants: { participant_id: string; name: string; item_name: string }[];
    incomplete_preparation_pax_count: number;
    pending_handover_pax_count: number;
  };
  item_summaries: PackageEquipmentSummaryItem[];
}

// ============================================================================
// STAGE 5: DASHBOARD INTELLIGENCE, ALERTS & AUDIT TYPES
// ============================================================================

export type AlertCategory = 'FINANCE' | 'DOCUMENT' | 'PASSPORT' | 'MANIFEST' | 'EQUIPMENT' | 'PACKAGE' | 'SYSTEM';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface OperationalAlert {
  id: string;
  alert_key: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  package_id?: string | null;
  package_name?: string | null;
  package_participant_id?: string | null;
  jamaah_id?: string | null;
  jamaah_name?: string | null;
  pic_id?: string | null;
  pic_name?: string | null;
  source_type: string;
  source_id: string;
  action_url?: string | null;
  action_label?: string | null;
  status: AlertStatus;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at?: string | null;
  reopened_at?: string | null;
  reopen_count: number;
  last_status_changed_at: string;
  dismissed_at?: string | null;
  dismissed_by?: string | null;
  dismiss_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  package_id?: string | null;
  package_name?: string | null;
  jamaah_id?: string | null;
  jamaah_name?: string | null;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface RecentActivityItem {
  id: string;
  timestamp: string;
  type: 'FINANCE' | 'DOCUMENT' | 'MANIFEST' | 'EQUIPMENT' | 'PACKAGE' | 'AUDIT';
  title: string;
  description: string;
  actor?: string;
  action_url?: string;
  badge_variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

export type ReadinessDimensionStatus = 'READY' | 'WARNING' | 'ERROR' | 'NOT_CONFIGURED' | 'NOT_APPLICABLE';

export interface DimensionReadiness {
  dimension: 'DOCUMENT' | 'FINANCE' | 'MANIFEST' | 'EQUIPMENT';
  status: ReadinessDimensionStatus;
  percentage: number;
  total_pax: number;
  ready_pax: number;
  is_applicable: boolean;
  blockers_count: number;
  warnings_count: number;
  notes?: string;
}

export interface PackageReadiness {
  package_id: string;
  package_name: string;
  departure_date: string;
  days_to_departure: number;
  is_past_departure: boolean;
  total_active_participants: number;
  overall_readiness_percentage: number;
  overall_status: 'READY' | 'WARNING' | 'CRITICAL' | 'NOT_CONFIGURED';
  critical_blockers_count: number;
  warning_issues_count: number;
  dimensions: {
    document: DimensionReadiness;
    finance: DimensionReadiness;
    manifest: DimensionReadiness;
    equipment: DimensionReadiness;
  };
  critical_blockers_summary: string[];
  warning_issues_summary: string[];
}

export interface ParticipantReadiness {
  participant_id: string;
  jamaah_id: string;
  jamaah_name: string;
  passport_name?: string | null;
  package_id: string;
  package_name: string;
  pic_name?: string | null;
  document_status: ReadinessDimensionStatus;
  finance_status: ReadinessDimensionStatus;
  manifest_status: ReadinessDimensionStatus;
  equipment_status: ReadinessDimensionStatus;
  overall_status: 'READY' | 'ACTION_REQUIRED' | 'NEEDS_REVIEW';
  issues: string[];
}

export interface DashboardIntelligenceSummary {
  kpis: {
    upcoming_packages_count: number;
    upcoming_active_pax_count: number;
    total_active_invoices_amount: number;
    total_collected_payments_amount: number;
    total_outstanding_amount: number;
    unallocated_payments_count: number;
    unallocated_payments_amount: number;
    critical_alerts_count: number;
    warning_alerts_count: number;
    open_alerts_count: number;
  };
  action_required: OperationalAlert[];
  upcoming_packages: {
    package: any;
    readiness: PackageReadiness;
  }[];
  recent_activities: RecentActivityItem[];
  evaluation_metadata: {
    last_evaluated_at: string;
    evaluator_source: string;
    total_open_alerts: number;
  };
}
