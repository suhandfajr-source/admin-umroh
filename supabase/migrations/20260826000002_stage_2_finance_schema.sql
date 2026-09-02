-- ====================================================================
-- STAGE 2: FINANCE JAMAAH DATABASE SCHEMA & CONSTRAINTS
-- Travel Operations Receivables, Payments, and Allocations
-- ====================================================================

-- 1. INVOICES TABLE
-- One invoice per package_participant
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_participant_id UUID UNIQUE NOT NULL REFERENCES public.package_participants(id) ON DELETE RESTRICT,
    base_amount BIGINT NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'OVERPAID')),
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INVOICE ITEMS TABLE (Charges, Discounts, Adjustments)
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('CHARGE', 'DISCOUNT', 'ADJUSTMENT')),
    category VARCHAR(50) DEFAULT 'OTHER_DISCOUNT' CHECK (
        category IS NULL OR 
        category IN ('TL_DISCOUNT', 'PROMO_DISCOUNT', 'OWNER_DISCOUNT', 'SPECIAL_DISCOUNT', 'OTHER_DISCOUNT', 'CHARGE_ITEM', 'ADJUSTMENT_ITEM')
    ),
    description TEXT NOT NULL,
    amount BIGINT NOT NULL CHECK (
        (type = 'CHARGE' AND amount > 0) OR
        (type = 'DISCOUNT' AND amount > 0) OR
        (type = 'ADJUSTMENT' AND amount <> 0)
    ),
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PAYMENTS TABLE (Bank Transfers & Money Receipts)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_date DATE NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    sender_name TEXT NOT NULL,
    sender_bank TEXT,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    pic_id UUID REFERENCES public.pics(id) ON DELETE SET NULL,
    storage_path TEXT, -- Stored privately in 'travel-documents' (payments/<payment_id>/proof.<ext>)
    notes TEXT,
    allocation_status VARCHAR(30) NOT NULL DEFAULT 'UNALLOCATED' CHECK (allocation_status IN ('UNALLOCATED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'CANCELLED')),
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.admin_users(id),
    cancellation_reason TEXT
);

-- 4. PAYMENT ALLOCATIONS TABLE (Distribution of payment to specific participant invoices)
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVERSED')),
    created_by UUID REFERENCES public.admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.admin_users(id),
    reversal_reason TEXT
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_invoices_participant_id ON public.invoices(package_participant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_package_id ON public.payments(package_id);
CREATE INDEX IF NOT EXISTS idx_payments_pic_id ON public.payments(pic_id);
CREATE INDEX IF NOT EXISTS idx_payments_allocation_status ON public.payments(allocation_status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON public.payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_status ON public.payment_allocations(status);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict non-destructive audit: No hard DELETE for authenticated admins on financial tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- INVOICES RLS
CREATE POLICY "Admins select invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- INVOICE ITEMS RLS
CREATE POLICY "Admins select invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- PAYMENTS RLS
CREATE POLICY "Admins select payments" ON public.payments FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update payments" ON public.payments FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- PAYMENT ALLOCATIONS RLS
CREATE POLICY "Admins select payment_allocations" ON public.payment_allocations FOR SELECT TO authenticated USING (public.is_active_admin());
CREATE POLICY "Admins insert payment_allocations" ON public.payment_allocations FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
CREATE POLICY "Admins update payment_allocations" ON public.payment_allocations FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

-- 7. IDEMPOTENT BACKFILL FOR EXISTING ACTIVE PARTICIPANTS
-- Creates base invoice for participants created during Stage 1
INSERT INTO public.invoices (package_participant_id, base_amount, status, created_at, updated_at)
SELECT 
    pp.id,
    COALESCE(pp.selling_price, 0),
    'UNPAID',
    NOW(),
    NOW()
FROM public.package_participants pp
LEFT JOIN public.invoices inv ON inv.package_participant_id = pp.id
WHERE inv.id IS NULL AND pp.deleted_at IS NULL
ON CONFLICT (package_participant_id) DO NOTHING;
