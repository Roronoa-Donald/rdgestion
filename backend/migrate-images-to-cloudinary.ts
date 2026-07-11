/**
 * Script de migration : convertit les images Base64 existantes en uploads Cloudinary.
 *
 * Usage : npx ts-node --transpile-only migrate-images-to-cloudinary.ts
 *
 * Pour chaque produit ayant une image Base64 :
 * 1. Décode le Base64 en Buffer
 * 2. Upload vers Cloudinary
 * 3. Remplace image_url par l'URL Cloudinary
 */

import { pool } from './src/config/database';
import { v2 as cloudinary } from 'cloudinary';

// === CONFIGURATION CLOUDINARY ===
cloudinary.config({
  cloud_name: 'vkgsv718',
  api_key: '778411243818215',
  api_secret: 'nSmyG13lfExMAx5oWHafdsuQcTw',
  secure: true,
});

interface ProductRow {
  id: string;
  name: string;
  tenant_id: string;
  image_url: string;
}

async function uploadBuffer(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { fetch_format: 'auto', quality: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

async function main() {
  console.log('🔍 Recherche des produits avec images Base64...\n');

  // Trouver tous les produits avec une image Base64 (data:...)
  const { rows } = await pool.query<ProductRow>(
    `SELECT id, name, tenant_id, image_url
     FROM products
     WHERE image_url LIKE 'data:%'
       AND is_deleted = false`
  );

  console.log(`📸 ${rows.length} produit(s) avec image Base64 trouvé(s).\n`);

  if (rows.length === 0) {
    console.log('✅ Rien à migrer.');
    await pool.end();
    return;
  }

  let success = 0;
  let failed = 0;

  for (const product of rows) {
    const prefix = `[${product.name}] (${product.id.substring(0, 8)}...)`;
    try {
      // Extraire le mimetype et les données Base64
      const match = product.image_url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        console.log(`⚠️  ${prefix} : format Data URI non reconnu, skip.`);
        failed++;
        continue;
      }

      const mimeType = match[1]; // ex: image/jpeg
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      console.log(`📤 ${prefix} : upload ${mimeType}, ${(buffer.length / 1024).toFixed(1)} KB...`);

      // Upload vers Cloudinary
      const secureUrl = await uploadBuffer(buffer, `rdgestion/${product.tenant_id}/products`);

      // Mettre à jour la BDD
      await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [secureUrl, product.id]);

      console.log(`   ✅ → ${secureUrl}`);
      success++;
    } catch (err: any) {
      console.error(`   ❌ Échec : ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Résultat : ${success} succès, ${failed} échec(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err.message);
  process.exit(1);
});