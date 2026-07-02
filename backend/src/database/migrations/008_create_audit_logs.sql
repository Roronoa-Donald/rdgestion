CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL pour les actions SUPERADMIN
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(80), -- Snapshot du username au moment de l'action
    user_role VARCHAR(15), -- Snapshot du rôle
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(30), -- 'PRODUCT', 'SALE', 'USER', 'TENANT', 'SETTINGS', etc.
    entity_id UUID, -- ID de l'entité concernée
    details JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
