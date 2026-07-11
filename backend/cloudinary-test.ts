/**
 * Script de test d'intégration Cloudinary
 * Exécute : upload → détails → transformation
 *
 * Usage : npx ts-node cloudinary-test.ts
 * (ou node après compilation)
 */

import { v2 as cloudinary } from 'cloudinary';

// === CONFIGURATION CLOUDINARY ===
cloudinary.config({
  cloud_name: 'vkgsv718',
  api_key: '778411243818215',
  api_secret: 'nSmyG13lfExMAx5oWHafdsuQcTw',
});

async function main() {
  console.log('☁️  Cloudinary Integration Test\n');

  // ─── 1. UPLOAD ───────────────────────────────────────────
  console.log('📤 Uploading sample image...');
  const uploadResult = await cloudinary.uploader.upload(
    'https://res.cloudinary.com/demo/image/upload/v1/samples/animals/three-dogs.jpg',
    {
      public_id: 'rdgestion-test-' + Date.now(),
      folder: 'rdgestion-tests',
      resource_type: 'image',
    }
  );

  console.log('✅ Upload successful!');
  console.log('   Secure URL :', uploadResult.secure_url);
  console.log('   Public ID  :', uploadResult.public_id);
  console.log();

  // ─── 2. GET IMAGE DETAILS ────────────────────────────────
  console.log('🔍 Fetching image details...');
  const details = await cloudinary.api.resource(uploadResult.public_id);

  console.log('✅ Image metadata:');
  console.log('   Width     :', details.width, 'px');
  console.log('   Height    :', details.height, 'px');
  console.log('   Format    :', details.format);
  console.log('   File size :', details.bytes, 'bytes (', (details.bytes / 1024).toFixed(1), 'KB)');
  console.log();

  // ─── 3. TRANSFORM ────────────────────────────────────────
  // f_auto : sélectionne automatiquement le meilleur format (webp, avif, etc.)
  // q_auto : ajuste automatiquement la qualité pour un bon rapport taille/qualité
  const transformedUrl = cloudinary.url(uploadResult.public_id, {
    transformation: [
      { fetch_format: 'auto', quality: 'auto' },
    ],
  });

  console.log('✨ Transformed image URL (f_auto + q_auto):');
  console.log('   ', transformedUrl);
  console.log();
  console.log('🎉 Done! Click the link above to see the optimized version.');
  console.log('   Check the size and the format — it should be smaller and in a modern format like WebP or AVIF.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});