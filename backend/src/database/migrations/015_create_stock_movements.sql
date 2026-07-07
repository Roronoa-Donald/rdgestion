-- 015 — Table des mouvements de stock (entrées / sorties / ajustements)
-- Permet de tracer chaque variation de stock avec l'ancienne et la nouvelle quantité.

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- 'IN' (entrée/réappro), 'OUT' (sortie manuelle), 'ADJUSTMENT' (inventaire)
    quantity INTEGER NOT NULL,          -- positif pour IN, négatif pour OUT/ADJUSTMENT (delta appliqué)
    old_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason VARCHAR(255),               -- motif (ex: "Réapprovisionnement fournisseur", "Inventaire", "Perte/Casse")
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL, -- NULL si pas lié à une vente
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    CHECK (new_stock >= 0)              -- Le stock ne peut jamais devenir négatif
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_product ON stock_movements(tenant_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_date ON stock_movements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale ON stock_movements(sale_id) WHERE sale_id IS NOT NULL;

-- Colonne pour marquer les notifications d'alerte de stock comme résolues automatiquement
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notifications_unresolved
    ON notifications(tenant_id, type, is_resolved)
    WHERE is_resolved = FALSE AND type IN ('STOCK_LOW', 'STOCK_OUT');
