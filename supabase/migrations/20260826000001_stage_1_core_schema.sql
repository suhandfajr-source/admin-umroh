-- ==============================================================================
-- MIGRATION: 20260826000001_stage_1_core_schema.sql
-- DESCRIPTION: Stage 1 Core Database Schema for Admin Umroh Travel Management
-- ==============================================================================

-- 1. APPLICATION ADMIN PROFILES
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. MASTER JAMAAH TABLE
-- Note: identity_name is the neutral person name. Passport fields are NULLABLE 
-- since Jamaah can be created from KK, KTP, or manual input first.
CREATE TABLE IF NOT EXISTS public.jamaah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_name TEXT NOT NULL,
    -- Travel Identity (Passport)
    passport_name TEXT,
    passport_number VARCHAR(20),
    birth_place TEXT,
    birth_date DATE,
    gender VARCHAR(10), -- 'MALE' | 'FEMALE'
    passport_issue_place TEXT,
    passport_issue_date DATE,
    passport_expiry_date DATE,
    -- Supporting Identity (KTP / KK)
    ktp_name TEXT,
    nik VARCHAR(20),
    kk_number VARCHAR(20),
    phone VARCHAR(25),
    address TEXT,
    notes TEXT,
    -- Timestamps & Soft Delete
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Partial Unique Indexes for Identity Protection (only when not null/empty and not deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jamaah_passport_number_unique 
    ON public.jamaah (passport_number) 
    WHERE passport_number IS NOT NULL AND passport_number <> '' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jamaah_nik_unique 
    ON public.jamaah (nik) 
    WHERE nik IS NOT NULL AND nik <> '' AND deleted_at IS NULL;

-- 3. DOCUMENTS METADATA TABLE (Private Object Storage reference)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jamaah_id UUID REFERENCES public.jamaah(id) ON DELETE SET NULL,
    document_type VARCHAR(30) NOT NULL, -- 'PASSPORT' | 'KTP' | 'KK' | 'VAKSIN' | 'BUKU_NIKAH' | 'OTHER'
    storage_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED', -- 'UPLOADED' | 'PROCESSING' | 'NEEDS_REVIEW' | 'CONFIRMED' | 'FAILED' | 'ARCHIVED'
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index ensuring at most ONE CURRENT document of a given type per Jamaah
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_single_current_per_type 
    ON public.documents (jamaah_id, document_type) 
    WHERE is_current = TRUE AND jamaah_id IS NOT NULL;

-- 4. DOCUMENT EXTRACTIONS & OCR RESULTS
CREATE TABLE IF NOT EXISTS public.document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    raw_extraction TEXT,
    extracted_fields JSONB DEFAULT '{}'::jsonb,
    classification_result VARCHAR(30),
    confidence_score REAL DEFAULT 0.0,
    mrz_data JSONB,
    review_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'CONFIRMED' | 'REJECTED'
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PACKAGES (Umrah Departure Packages)
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_name TEXT NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    b2b_price BIGINT NOT NULL DEFAULT 0, -- Stored as whole Rupiah (integer)
    reference_price BIGINT NOT NULL DEFAULT 0, -- Stored as whole Rupiah (integer)
    airline TEXT,
    makkah_hotel TEXT,
    madinah_hotel TEXT,
    schedule TEXT,
    quota INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'OPEN' | 'FULL' | 'DEPARTED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. MASTER PIC (Person In Charge)
CREATE TABLE IF NOT EXISTS public.pics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone VARCHAR(25),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. PACKAGE PARTICIPANTS (Relation: Jamaah <-> Package <-> PIC)
CREATE TABLE IF NOT EXISTS public.package_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
    jamaah_id UUID NOT NULL REFERENCES public.jamaah(id) ON DELETE RESTRICT,
    pic_id UUID REFERENCES public.pics(id) ON DELETE SET NULL,
    b2b_price BIGINT NOT NULL DEFAULT 0,
    selling_price BIGINT NOT NULL DEFAULT 0, -- Custom selling price for this specific participant
    participant_status VARCHAR(30) NOT NULL DEFAULT 'REGISTERED', -- 'REGISTERED' | 'CONFIRMED' | 'CANCELLED' | 'ARCHIVED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Partial Unique Index for Active Participant per Package
CREATE UNIQUE INDEX IF NOT EXISTS idx_package_participants_unique_active 
    ON public.package_participants (package_id, jamaah_id) 
    WHERE deleted_at IS NULL;

-- ==============================================================================
-- 8. TRANSACTIONAL STORED PROCEDURE / FUNCTION FOR PASSPORT REPLACEMENT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.confirm_passport_replacement(
    p_jamaah_id UUID,
    p_new_document_id UUID,
    p_passport_name TEXT,
    p_passport_number TEXT,
    p_birth_place TEXT,
    p_birth_date DATE,
    p_gender VARCHAR,
    p_issue_place TEXT,
    p_issue_date DATE,
    p_expiry_date DATE
) RETURNS VOID AS $$
BEGIN
    -- 1. Archive any existing current passport document for this jamaah
    UPDATE public.documents 
    SET is_current = FALSE, 
        status = 'ARCHIVED',
        updated_at = NOW()
    WHERE jamaah_id = p_jamaah_id 
      AND document_type = 'PASSPORT' 
      AND is_current = TRUE 
      AND id <> p_new_document_id;

    -- 2. Mark the new document as current and confirmed
    UPDATE public.documents
    SET is_current = TRUE,
        status = 'CONFIRMED',
        jamaah_id = p_jamaah_id,
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_new_document_id;

    -- 3. Update Master Jamaah current travel identity fields
    UPDATE public.jamaah
    SET passport_name = p_passport_name,
        passport_number = p_passport_number,
        birth_place = COALESCE(p_birth_place, birth_place),
        birth_date = COALESCE(p_birth_date, birth_date),
        gender = COALESCE(p_gender, gender),
        passport_issue_place = p_issue_place,
        passport_issue_date = p_issue_date,
        passport_expiry_date = p_expiry_date,
        updated_at = NOW()
    WHERE id = p_jamaah_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jamaah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_participants ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user is an active admin
CREATE OR REPLACE FUNCTION public.is_active_admin() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE auth_user_id = auth.uid() 
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for operational tables
CREATE POLICY "Admins full access to admin_users" ON public.admin_users
    FOR ALL TO authenticated USING (public.is_active_admin() OR auth_user_id = auth.uid());

CREATE POLICY "Admins full access to jamaah" ON public.jamaah
    FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins full access to documents" ON public.documents
    FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins full access to document_extractions" ON public.document_extractions
    FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins full access to packages" ON public.packages
    FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins full access to pics" ON public.pics
    FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins full access to package_participants" ON public.package_participants
    FOR ALL TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- ==============================================================================
-- 10. STORAGE BUCKET & POLICIES SETUP
-- ==============================================================================
-- Ensure private storage bucket 'travel-documents' exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'travel-documents',
    'travel-documents',
    FALSE, -- Strictly private
    20971520, -- 20MB limit
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET public = FALSE;

-- Storage RLS: only active admins can read/upload/manage
CREATE POLICY "Admin read travel-documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'travel-documents' AND public.is_active_admin());

CREATE POLICY "Admin insert travel-documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'travel-documents' AND public.is_active_admin());

CREATE POLICY "Admin update travel-documents" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'travel-documents' AND public.is_active_admin());

CREATE POLICY "Admin delete travel-documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'travel-documents' AND public.is_active_admin());
