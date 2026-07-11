-- Migration 016 : Revenir de TEXT à VARCHAR(500) pour image_url
-- Les images sont maintenant stockées sur Cloudinary, donc on ne garde que l'URL.
-- Les anciennes données Base64 seront perdues (les produits concernés auront image_url = NULL).

-- 1. Mettre à NULL toutes les valeurs qui ne sont pas des URLs http/https
UPDATE products
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url NOT LIKE 'http%';

-- 2. Tronquer les URLs trop longues (sécurité)
UPDATE products
SET image_url = LEFT(image_url, 500)
WHERE image_url IS NOT NULL
  AND LENGTH(image_url) > 500;

-- 3. Changer le type de colonne
ALTER TABLE products
ALTER COLUMN image_url TYPE VARCHAR(500);