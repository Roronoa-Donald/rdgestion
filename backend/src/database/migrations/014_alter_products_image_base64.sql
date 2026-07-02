-- Migration : Convertir image_url de VARCHAR(255) vers TEXT
-- pour stocker les images en Base64 (Data URI) directement dans PostgreSQL.
-- Ceci élimine la dépendance au système de fichiers local,
-- rendant l'application compatible avec les déploiements serverless (Vercel).

ALTER TABLE products ALTER COLUMN image_url TYPE TEXT;
