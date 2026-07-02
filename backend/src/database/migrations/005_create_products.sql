CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(50),
    purchase_price DECIMAL(12, 2) NOT NULL CHECK (purchase_price > 0),
    sell_price DECIMAL(12, 2) NOT NULL CHECK (sell_price > 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    stock_threshold INTEGER, -- NULL = utiliser le seuil global
    image_url VARCHAR(255),
    description TEXT,
    has_expiry BOOLEAN NOT NULL DEFAULT FALSE,
    expiry_date DATE, -- Requis si has_expiry = true
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, sku), -- SKU unique par boutique
    CHECK (sell_price >= purchase_price),
    CHECK (NOT has_expiry OR expiry_date IS NOT NULL) -- Si périssable, date obligatoire
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_stock_alert ON products(tenant_id, stock_quantity, stock_threshold)
    WHERE is_deleted = FALSE;
