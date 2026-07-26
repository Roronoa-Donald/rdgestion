-- 019 — Ajout des colonnes is_resolved et resolved_at sur notifications
-- + index unique fonctionnel pour éviter les doublons d'alertes de stock

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_notifications_unresolved
    ON notifications(tenant_id, type, is_resolved)
    WHERE is_resolved = FALSE AND type IN ('STOCK_LOW', 'STOCK_OUT');

-- Index unique fonctionnel pour éviter les doublons d'alertes (un seul STOCK_LOW/STOCK_OUT actif par produit)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_stock_alert
    ON notifications(tenant_id, type, (data->>'product_id'))
    WHERE type IN ('STOCK_LOW', 'STOCK_OUT') AND is_resolved = FALSE;
