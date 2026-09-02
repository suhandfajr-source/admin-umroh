-- ====================================================================
-- STAGE 4: PERLENGKAPAN JAMAAH (EQUIPMENT FULFILLMENT & SIZING) SCHEMA
-- Operational tracking per trip, variants, gender rules, and event logs
-- ====================================================================

-- 1. MASTER EQUIPMENT ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.equipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('BAG', 'APPAREL', 'IBADAH', 'IDENTITY', 'DOCUMENT', 'ACCESSORY', 'OTHER')),
    description TEXT,
    requires_variant BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- 2. EQUIPMENT ITEM VARIANTS TABLE
CREATE TABLE IF NOT EXISTS public.equipment_item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_item_id UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- 3. PACKAGE EQUIPMENT CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.package_equipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
    equipment_item_id UUID NOT NULL REFERENCES public.equipment_items(id),
    quantity_per_pax INTEGER NOT NULL DEFAULT 1 CHECK (quantity_per_pax > 0),
    applicability VARCHAR(20) NOT NULL DEFAULT 'ALL' CHECK (applicability IN ('ALL', 'MALE', 'FEMALE')),
    is_required BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- 4. PARTICIPANT EQUIPMENT FULFILLMENT TABLE
CREATE TABLE IF NOT EXISTS public.participant_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_participant_id UUID NOT NULL REFERENCES public.package_participants(id) ON DELETE CASCADE,
    package_equipment_item_id UUID NOT NULL REFERENCES public.package_equipment_items(id),
    variant_id UUID REFERENCES public.equipment_item_variants(id),
    variant_label_snapshot TEXT,
    quantity_expected INTEGER NOT NULL DEFAULT 1 CHECK (quantity_expected > 0),
    quantity_prepared INTEGER NOT NULL DEFAULT 0 CHECK (quantity_prepared >= 0),
    quantity_handed_over INTEGER NOT NULL DEFAULT 0 CHECK (quantity_handed_over >= 0),
    notes TEXT,
    prepared_at TIMESTAMPTZ,
    prepared_by UUID REFERENCES public.admin_users(id),
    handed_over_at TIMESTAMPTZ,
    handed_over_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    CONSTRAINT chk_prepared_le_expected CHECK (quantity_prepared <= quantity_expected),
    CONSTRAINT chk_handed_le_prepared CHECK (quantity_handed_over <= quantity_prepared)
);

-- 5. EQUIPMENT EVENTS AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.equipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_equipment_id UUID NOT NULL REFERENCES public.participant_equipment(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('PREPARED', 'HANDOVER', 'CORRECTION', 'VARIANT_CHANGED', 'UNPREPARED', 'UNHANDOVER')),
    quantity INTEGER,
    from_value TEXT,
    to_value TEXT,
    reason TEXT,
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PERFORMANCE INDEXES & PARTIAL UNIQUE CONSTRAINTS
CREATE INDEX IF NOT EXISTS idx_equipment_items_active ON public.equipment_items(is_active);
CREATE INDEX IF NOT EXISTS idx_equipment_variants_item_id ON public.equipment_item_variants(equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_package_equipment_package_id ON public.package_equipment_items(package_id);
CREATE INDEX IF NOT EXISTS idx_participant_equipment_pax_id ON public.participant_equipment(package_participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_equipment_pkg_item ON public.participant_equipment(package_equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_events_pax_equip ON public.equipment_events(participant_equipment_id);

-- Partial unique constraint ensuring 1 active fulfillment record per participant per package equipment item
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_active_participant_equipment 
ON public.participant_equipment(package_participant_id, package_equipment_item_id) 
WHERE archived_at IS NULL;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_events ENABLE ROW LEVEL SECURITY;

-- Admins select/insert/update/delete policies
CREATE POLICY "Admins select equipment_items" ON public.equipment_items FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert equipment_items" ON public.equipment_items FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update equipment_items" ON public.equipment_items FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins select equipment_item_variants" ON public.equipment_item_variants FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert equipment_item_variants" ON public.equipment_item_variants FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update equipment_item_variants" ON public.equipment_item_variants FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins select package_equipment_items" ON public.package_equipment_items FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert package_equipment_items" ON public.package_equipment_items FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update package_equipment_items" ON public.package_equipment_items FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins select participant_equipment" ON public.participant_equipment FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert participant_equipment" ON public.participant_equipment FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update participant_equipment" ON public.participant_equipment FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "Admins select equipment_events" ON public.equipment_events FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert equipment_events" ON public.equipment_events FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());

-- 8. DEFAULT STANDARD UMRAH EQUIPMENT SEEDS (OPTIONAL STARTER DATA)
DO $$
DECLARE
    v_batik_id UUID := gen_random_uuid();
    v_koper_id UUID := gen_random_uuid();
    v_kabin_id UUID := gen_random_uuid();
    v_paspor_id UUID := gen_random_uuid();
    v_ihram_id UUID := gen_random_uuid();
    v_mukena_id UUID := gen_random_uuid();
    v_syal_id UUID := gen_random_uuid();
    v_idcard_id UUID := gen_random_uuid();
    v_buku_id UUID := gen_random_uuid();
    v_botol_id UUID := gen_random_uuid();
BEGIN
    -- Only insert if table is empty
    IF NOT EXISTS (SELECT 1 FROM public.equipment_items LIMIT 1) THEN
        INSERT INTO public.equipment_items (id, name, category, description, requires_variant, is_active) VALUES
        (v_koper_id, 'Koper Bagasi', 'BAG', 'Koper bagasi utama 24 inch standar jamaah', false, true),
        (v_kabin_id, 'Tas Kabin', 'BAG', 'Tas jinjing / ransel kabin pesawat', false, true),
        (v_paspor_id, 'Tas Paspor', 'BAG', 'Tas selempang kecil tempat paspor & dokumen', false, true),
        (v_batik_id, 'Baju Batik Seragam', 'APPAREL', 'Baju seragam batik resmi travel', true, true),
        (v_ihram_id, 'Kain Ihram', 'IBADAH', '2 lembar kain ihram khusus jamaah pria', false, true),
        (v_mukena_id, 'Mukena & Bergo', 'IBADAH', 'Set mukena seragam khusus jamaah wanita', false, true),
        (v_syal_id, 'Syal Jamaah', 'ACCESSORY', 'Syal identitas rombongan travel', false, true),
        (v_idcard_id, 'ID Card & Tali', 'IDENTITY', 'Kartu identitas gantung jamaah', false, true),
        (v_buku_id, 'Buku Panduan Doa', 'DOCUMENT', 'Buku saku kumpulan doa dan manasik umrah', false, true),
        (v_botol_id, 'Botol Minum Zamzam', 'ACCESSORY', 'Tumbler minum untuk tawaf & ziarah', false, true);

        -- Insert Variants for Baju Batik
        INSERT INTO public.equipment_item_variants (equipment_item_id, label, sort_order, is_active) VALUES
        (v_batik_id, 'S', 1, true),
        (v_batik_id, 'M', 2, true),
        (v_batik_id, 'L', 3, true),
        (v_batik_id, 'XL', 4, true),
        (v_batik_id, 'XXL', 5, true),
        (v_batik_id, '3XL', 6, true);
    END IF;
END;
$$;
