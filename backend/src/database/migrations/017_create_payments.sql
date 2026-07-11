-- Migration 017 : Table payments — historique des transactions FedaPay
-- Traçabilité complète des paiements pour le rapprochement comptable.

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'fedapay',       -- 'fedapay', 'manual', etc.
  transaction_id VARCHAR(255) NOT NULL,                   -- ID transaction FedaPay
  event_id VARCHAR(255),                                  -- ID event webhook (idempotence)
  amount INTEGER NOT NULL CHECK (amount > 0),             -- Montant en FCFA (entier)
  currency VARCHAR(10) NOT NULL DEFAULT 'XOF',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- pending, approved, declined, canceled, refunded
  billing_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',    -- MONTHLY ou LIFETIME
  reference VARCHAR(255),                                 -- Référence marchand
  raw_payload JSONB,                                      -- Payload brut du webhook (debug)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour la recherche par tenant
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);

-- Index pour l'idempotence des webhooks (unicité event_id)
CREATE UNIQUE INDEX idx_payments_event_id ON payments(event_id) WHERE event_id IS NOT NULL;

-- Index pour la recherche par transaction FedaPay
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);

-- Trigger updated_at automatique (si la fonction existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER trg_payments_updated_at
      BEFORE UPDATE ON payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;