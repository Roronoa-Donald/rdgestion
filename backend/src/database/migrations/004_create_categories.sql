CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    icon VARCHAR(50), -- Nom de l'icône (optionnel)
    is_default BOOLEAN NOT NULL DEFAULT FALSE, -- Catégorie prédéfinie vs personnalisée
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, name) -- Pas de doublon de catégorie dans la même boutique
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
