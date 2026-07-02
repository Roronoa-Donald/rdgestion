CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = notification pour tous les ADMIN du tenant
    type VARCHAR(30) NOT NULL, -- 'STOCK_LOW', 'SUBSCRIPTION_EXPIRING', 'REFERRAL_COMPLETED', 'SECURITY_ALERT'
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Données supplémentaires (ex: product_id pour STOCK_LOW)
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(tenant_id, is_read) WHERE is_read = FALSE;
