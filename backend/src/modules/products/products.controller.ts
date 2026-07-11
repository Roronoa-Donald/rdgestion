import { FastifyRequest, FastifyReply } from 'fastify';
import { productsService } from './products.service';
import { env } from '../../config/env';
import { ProductQueryFilters } from './products.service';
import { productBodySchema } from './products.schema';
import { uploadImage, deleteImage, extractPublicIdFromUrl } from '../../plugins/cloudinary/cloudinary';

// Utilitaire de validation manuelle pour les requêtes multipart/form-data
import Ajv from 'ajv';
const ajv = new Ajv({ coerceTypes: true, useDefaults: true });
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
const validateProductBody = ajv.compile(productBodySchema);

export class ProductsController {
  /**
   * Liste les produits (GET /api/products)
   */
  async list(request: FastifyRequest<{ Querystring: ProductQueryFilters }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const result = await productsService.listProducts(tenantId, request.query);
    return reply.send(result);
  }

  /**
   * Liste les produits supprimés (GET /api/products/trash)
   */
  async listTrash(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const result = await productsService.listTrashProducts(tenantId);
    return reply.send({ success: true, data: result });
  }

  /**
   * Récupère un produit par son ID (GET /api/products/:id)
   */
  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const product = await productsService.getProductById(tenantId, request.params.id);
    return reply.send({ success: true, data: product });
  }

  /**
   * Crée un produit (POST /api/products)
   * Upload de la photo vers Cloudinary (URL stockée en BDD).
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    let fields: Record<string, any> = {};
    let fileBuffer: Buffer | null = null;
    let fileMimetype = '';

    // 1. Gérer le cas de l'upload multipart/form-data
    if (request.isMultipart()) {
      const parts = request.parts();
      
      for await (const part of parts) {
        if (part.type === 'file') {
          // Valider le format de l'image
          const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
          if (!allowedMimes.includes(part.mimetype)) {
            return reply.status(400).send({
              success: false,
              error: 'INVALID_IMAGE_TYPE',
              message: 'Format d\'image non accepté (JPEG, PNG, WebP uniquement).'
            });
          }

          fileMimetype = part.mimetype;
          fileBuffer = await part.toBuffer();

          // Valider la taille maximale (2 Mo)
          if (fileBuffer.length > env.UPLOAD_MAX_SIZE) {
            return reply.status(400).send({
              success: false,
              error: 'IMAGE_TOO_LARGE',
              message: 'La taille de l\'image ne doit pas dépasser 2 Mo.'
            });
          }
        } else {
          // Champs textuels du formulaire
          let val: any = part.value;
          if (part.fieldname === 'purchase_price' || part.fieldname === 'sell_price') {
            val = Number(part.value);
          } else if (part.fieldname === 'stock_quantity' || part.fieldname === 'stock_threshold') {
            val = part.value !== '' ? parseInt(part.value as string, 10) : null;
          } else if (part.fieldname === 'has_expiry') {
            val = part.value === 'true' || part.value === '1';
          }
          fields[part.fieldname] = val;
        }
      }
    } else {
      // Cas JSON standard
      fields = request.body as Record<string, any>;
    }

    // 2. Valider manuellement le body compilé
    const isValid = validateProductBody(fields);
    if (!isValid) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Données du produit invalides.',
        details: validateProductBody.errors
      });
    }

    // 3. Créer d'abord le produit en BDD sans l'URL de photo
    const product = await productsService.createProduct(tenantId, fields, userId, userIp, userAgent);

    // 4. Si une photo a été uploadée, l'envoyer vers Cloudinary et mettre à jour le produit
    if (fileBuffer) {
      try {
        const uploadResult = await uploadImage(fileBuffer, `rdgestion/${tenantId}/products`);
        const updatedProduct = await productsService.updateProduct(
          tenantId,
          product.id,
          { image_url: uploadResult.secure_url },
          userId,
          userIp,
          userAgent
        );
        return reply.status(201).send({ success: true, data: updatedProduct });
      } catch (uploadErr: any) {
        // Le produit est créé mais l'image a échoué — on le signale
        console.error('❌ Cloudinary upload failed for product', product.id, ':', uploadErr.message);
        return reply.status(201).send({
          success: true,
          data: product,
          warning: 'Produit créé mais l\'upload de la photo a échoué. Vous pourrez réessayer via la modification.'
        });
      }
    }

    return reply.status(201).send({ success: true, data: product });
  }

  /**
   * Modifie un produit (PUT /api/products/:id)
   * Si une nouvelle photo est envoyée, l'ancienne est supprimée de Cloudinary.
   */
  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const id = request.params.id;

    let fields: Record<string, any> = {};
    let fileBuffer: Buffer | null = null;
    let fileMimetype = '';

    if (request.isMultipart()) {
      const parts = request.parts();
      
      for await (const part of parts) {
        if (part.type === 'file') {
          const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
          if (!allowedMimes.includes(part.mimetype)) {
            return reply.status(400).send({
              success: false,
              error: 'INVALID_IMAGE_TYPE',
              message: 'Format d\'image non accepté (JPEG, PNG, WebP uniquement).'
            });
          }

          fileMimetype = part.mimetype;
          fileBuffer = await part.toBuffer();

          if (fileBuffer.length > env.UPLOAD_MAX_SIZE) {
            return reply.status(400).send({
              success: false,
              error: 'IMAGE_TOO_LARGE',
              message: 'La taille de l\'image ne doit pas dépasser 2 Mo.'
            });
          }
        } else {
          let val: any = part.value;
          if (part.fieldname === 'purchase_price' || part.fieldname === 'sell_price') {
            val = Number(part.value);
          } else if (part.fieldname === 'stock_quantity' || part.fieldname === 'stock_threshold') {
            val = part.value !== '' ? parseInt(part.value as string, 10) : null;
          } else if (part.fieldname === 'has_expiry') {
            val = part.value === 'true' || part.value === '1';
          }
          fields[part.fieldname] = val;
        }
      }
    } else {
      fields = request.body as Record<string, any>;
    }

    // Si une nouvelle photo est envoyée :
    // 1. Récupérer l'ancienne URL pour supprimer l'image Cloudinary correspondante
    // 2. Uploader la nouvelle vers Cloudinary
    if (fileBuffer) {
      try {
        // Récupérer l'ancien produit pour avoir son image_url actuelle
        const oldProduct = await productsService.getProductById(tenantId, id);
        const oldPublicId = extractPublicIdFromUrl(oldProduct.image_url || '');
        
        // Uploader la nouvelle image
        const uploadResult = await uploadImage(fileBuffer, `rdgestion/${tenantId}/products`);
        fields.image_url = uploadResult.secure_url;

        // Supprimer l'ancienne image de Cloudinary (non bloquant)
        if (oldPublicId) {
          deleteImage(oldPublicId).catch(err =>
            console.warn('⚠️  Échec suppression ancienne image Cloudinary:', err.message)
          );
        }
      } catch (uploadErr: any) {
        console.error('❌ Cloudinary upload failed for product update', id, ':', uploadErr.message);
        // On continue sans image — le produit sera mis à jour sans changer la photo
      }
    }

    const updatedProduct = await productsService.updateProduct(
      tenantId,
      id,
      fields,
      userId,
      userIp,
      userAgent
    );

    return reply.send({ success: true, data: updatedProduct });
  }

  /**
   * Envoie un produit en corbeille (DELETE /api/products/:id)
   */
  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    await productsService.deleteProduct(tenantId, request.params.id, userId, userIp, userAgent);
    
    return reply.send({
      success: true,
      message: 'Produit déplacé dans la corbeille avec succès.'
    });
  }

  /**
   * Restaure un produit de la corbeille (POST /api/products/:id/restore)
   */
  async restore(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const restored = await productsService.restoreProduct(tenantId, request.params.id, userId, userIp, userAgent);
    
    return reply.send({
      success: true,
      message: 'Produit restauré avec succès.',
      data: restored
    });
  }
}

export const productsController = new ProductsController();
