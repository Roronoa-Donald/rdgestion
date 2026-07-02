CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier VARCHAR(10) NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'PRO')),
    billing_type VARCHAR(15) CHECK (billing_type IN ('MONTHLY', 'LIFETIME', NULL)),
    status VARCHAR(15) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE, -- NULL = illimité (FREE ou LIFETIME)
    activated_by UUID, -- La contrainte FOREIGN KEY sera ajoutée après la création de la table users
    activation_method VARCHAR(15) DEFAULT 'AUTO' CHECK (activation_method IN ('AUTO', 'MANUAL', 'FEDAPAY', 'REFERRAL')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
