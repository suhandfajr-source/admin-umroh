-- ============================================================================
-- STAGE 5: DASHBOARD INTELLIGENCE, OPERATIONAL ALERTS & CENTRAL AUDIT LOGS
-- ============================================================================

-- 1. OPERATIONAL ALERTS TABLE
CREATE TABLE IF NOT EXISTS operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_key VARCHAR(150) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('FINANCE', 'DOCUMENT', 'PASSPORT', 'MANIFEST', 'EQUIPMENT', 'PACKAGE', 'SYSTEM')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    package_participant_id UUID REFERENCES package_participants(id) ON DELETE SET NULL,
    jamaah_id UUID REFERENCES jamaah(id) ON DELETE SET NULL,
    pic_id UUID REFERENCES pics(id) ON DELETE SET NULL,
    
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100) NOT NULL,
    
    action_url VARCHAR(255),
    action_label VARCHAR(100),
    
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
    
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    reopened_at TIMESTAMPTZ,
    reopen_count INT NOT NULL DEFAULT 0,
    last_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES admin_users(id),
    dismiss_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_operational_alerts_status_severity ON operational_alerts (status, severity);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_package ON operational_alerts (package_id);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_category ON operational_alerts (category);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_participant ON operational_alerts (package_participant_id);
CREATE INDEX IF NOT EXISTS idx_operational_alerts_last_detected ON operational_alerts (last_detected_at DESC);

-- 2. CENTRAL AUDIT LOGS TABLE (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    
    package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    jamaah_id UUID REFERENCES jamaah(id) ON DELETE SET NULL,
    
    before_data JSONB,
    after_data JSONB,
    metadata JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_package ON audit_logs (package_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);

-- Enable RLS
ALTER TABLE operational_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Operational Alerts Policies
CREATE POLICY "Active Admin can read operational alerts"
    ON operational_alerts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.auth_user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

CREATE POLICY "Active Admin or Service Role can manage alerts"
    ON operational_alerts FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.auth_user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

-- Audit Logs Policies (Append-Only for Active Admin, Disallow Hard DELETE/UPDATE)
CREATE POLICY "Active Admin can read audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.auth_user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );

CREATE POLICY "Active Admin can insert audit logs"
    ON audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.auth_user_id = auth.uid()
            AND admin_users.is_active = true
        )
    );
