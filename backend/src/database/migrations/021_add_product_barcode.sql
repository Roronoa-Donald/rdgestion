-- Migration 021: Ajouter le code-barres (barcode) produit pour le scan POS
--
-- Le POS scanne des étiquettes fabricant existantes (EAN-13, UPC-A, QR, etc.).
-- On stocke le barcode sur le produit pour permettre la recherche rapide.
--
-- Contraintes:
--  - barcode est NULLABLE (un produit sans barcode reste valide).
--  - Unicité par tenant: un barcode ne peut être associé qu'à un seul produit
--    ACTIF (is_deleted = FALSE) par tenant. Les produits supprimés (corbeille)
--    sont exclus de l'unicité pour permettre la réaffectation.
--  - Pas de pattern strict: les barcodes varient (EAN-13 = 13 chiffres,
--    UPC-A = 12, QR = texte arbitraire).
--
-- L'index partiel (WHERE clause) est supporté en PostgreSQL 13+ (Aiven tourne
-- sur une version récente). On n'utilise pas ADD COLUMN IF NOT EXISTS sur
-- l'ALTER TABLE car le ADD COLUMN simple est idempotent-safe à condition de
-- ne pas ré-exécuter la migration (le runner de migrations suit un registre).

ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_tenant
  ON products(tenant_id, barcode)
  WHERE barcode IS NOT NULL AND is_deleted = FALSE;
