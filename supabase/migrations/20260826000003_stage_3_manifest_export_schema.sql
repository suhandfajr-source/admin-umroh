-- ====================================================================
-- STAGE 3: MANIFEST, DOCUMENT EXPORT & OPERATIONAL REPORTS SCHEMA
-- Reusable Outputs: Manifest Templates, Export Auditing, RLS & Indexes
-- ====================================================================

-- 1. MANIFEST TEMPLATES TABLE
-- Stores reusable Excel templates and column-to-field mapping configurations
CREATE TABLE IF NOT EXISTS public.manifest_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    storage_path TEXT, -- Private storage path if company uploaded custom .xlsx template
    worksheet_name TEXT NOT NULL DEFAULT 'Manifest',
    header_row INTEGER NOT NULL DEFAULT 1,
    data_start_row INTEGER NOT NULL DEFAULT 2,
    field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    date_formats JSONB DEFAULT '{"birth_date": "YYYY-MM-DD", "passport_expiry_date": "YYYY-MM-DD", "passport_issue_date": "YYYY-MM-DD"}'::jsonb,
    value_transformations JSONB DEFAULT '{"gender": {"MALE": "M", "FEMALE": "F"}}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- 2. EXPORT JOBS AUDIT TABLE
-- Temporary audit log & metadata for generated downloads (Manifest, ZIP, Finance Reports)
CREATE TABLE IF NOT EXISTS public.export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_type VARCHAR(50) NOT NULL CHECK (export_type IN ('MANIFEST', 'DOCUMENT_ZIP', 'PACKAGE_FINANCE', 'PAYMENT_REPORT')),
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT,
    storage_path TEXT, -- Private ephemeral storage in 'travel-documents' (exports/<id>/<filename>)
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED')),
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_manifest_templates_active ON public.manifest_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_manifest_templates_default ON public.manifest_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_export_jobs_type ON public.export_jobs(export_type);
CREATE INDEX IF NOT EXISTS idx_export_jobs_package_id ON public.export_jobs(package_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON public.export_jobs(expires_at);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.manifest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- Manifest Templates RLS
CREATE POLICY "Admins select manifest_templates" ON public.manifest_templates FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert manifest_templates" ON public.manifest_templates FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update manifest_templates" ON public.manifest_templates FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- Export Jobs RLS
CREATE POLICY "Admins select export_jobs" ON public.export_jobs FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert export_jobs" ON public.export_jobs FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update export_jobs" ON public.export_jobs FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- 5. DEFAULT STANDARD MANIFEST TEMPLATE SEED
INSERT INTO public.manifest_templates (name, worksheet_name, header_row, data_start_row, field_mapping, is_default, is_active)
VALUES (
    'Standard Umrah Airline Manifest',
    'Manifest',
    1,
    2,
    '{
      "A": "no",
      "B": "passport_name",
      "C": "passport_number",
      "D": "gender",
      "E": "birth_place",
      "F": "birth_date",
      "G": "passport_issue_place",
      "H": "passport_issue_date",
      "I": "passport_expiry_date",
      "J": "nik",
      "K": "phone",
      "L": "pic_name"
    }'::jsonb,
    true,
    true
)
ON CONFLICT DO NOTHING;
