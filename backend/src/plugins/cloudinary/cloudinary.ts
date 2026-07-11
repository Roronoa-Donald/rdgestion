/**
 * Plugin Cloudinary — Configure et exporte l'instance Cloudinary v2.
 *
 * Les credentials sont lus depuis les variables d'environnement :
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * Usage dans les services :
 *   import { cloudinary } from '../plugins/cloudinary/cloudinary.js';
 *   const result = await cloudinary.uploader.upload(buffer, { ... });
 */

import { v2 as cloudinary } from 'cloudinary';
import type { FastifyInstance } from 'fastify';

export { cloudinary };

export async function configureCloudinary(_app: FastifyInstance) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      '⚠️  Cloudinary non configuré — les variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET sont manquantes.'
    );
    return;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  console.log('☁️  Cloudinary configuré (cloud:', cloudName + ')');
}

/**
 * Upload un buffer d'image vers Cloudinary.
 * Retourne l'URL sécurisée et le public_id.
 *
 * @param buffer - Buffer de l'image (JPEG, PNG, WebP)
 * @param folder - Dossier Cloudinary (ex: 'rdgestion/products')
 * @param publicId - ID public optionnel (sinon auto-généré)
 * @returns {{ secure_url: string; public_id: string }}
 */
export async function uploadImage(
  buffer: Buffer,
  folder: string = 'rdgestion/products',
  publicId?: string
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        // Transformation par défaut : limiter à 1200px max, qualité auto, format auto
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { fetch_format: 'auto', quality: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Upload Cloudinary : aucun résultat.'));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Supprime une image de Cloudinary par son public_id.
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err: any) {
    // Ne pas bloquer si la suppression échoue (image déjà supprimée, etc.)
    console.warn('⚠️  Cloudinary deleteImage échec (non bloquant):', err.message);
  }
}

/**
 * Extrait le public_id d'une URL Cloudinary.
 * Ex: https://res.cloudinary.com/vkgsv718/image/upload/v123/rdgestion/products/abc123.jpg
 *     → 'rdgestion/products/abc123'
 */
export function extractPublicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  return match?.[1] ?? null;
}