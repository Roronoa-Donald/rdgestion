CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id),
    transaction_number VARCHAR(30) NOT NULL, -- Format: VENTE-YYYY-NNNNNNN
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('CASH', 'MOBILE_MONEY')),
    momo_reference VARCHAR(100), -- Obligatoire si payment_method = 'MOBILE_MONEY'
    subtotal DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount_type VARCHAR(10) CHECK (discount_type IN ('FIXED', 'PERCENTAGE', NULL)),
    discount_percentage DECIMAL(5, 2), -- Pourcentage de remise si applicable
    total_amount DECIMAL(12, 2) NOT NULL,
    profit_estimate DECIMAL(12, 2), -- Bénéfice estimé sur la vente
    amount_received DECIMAL(12, 2), -- Montant reçu (pour calcul de monnaie, espèces)
    change_given DECIMAL(12, 2), -- Monnaie rendue
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, transaction_number),
    CHECK (payment_method != 'MOBILE_MONEY' OR momo_reference IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_cancelled ON sales(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_sales_daily_count ON sales(tenant_id, created_at)
    WHERE is_cancelled = FALSE;
