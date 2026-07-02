CREATE TABLE IF NOT EXISTS daily_sale_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INTEGER NOT NULL DEFAULT 0,

    UNIQUE(tenant_id, sale_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_tenant_date ON daily_sale_counts(tenant_id, sale_date);
