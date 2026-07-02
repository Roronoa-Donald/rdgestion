import { FastifySchema } from 'fastify';

/**
 * Schéma pour la liste des produits (requête GET)
 */
export const getProductsSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      category_id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
      search: { type: 'string', minLength: 1 },
      sort: { type: 'string', enum: ['name', 'sell_price', 'stock_quantity', 'created_at'], default: 'created_at' },
      order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
    },
    additionalProperties: false
  }
};

/**
 * Schéma pour valider l'ID du produit dans les paramètres de la route
 */
export const productIdParamSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }
    },
    additionalProperties: false
  }
};

/**
 * Définition du schéma de validation du corps d'un produit (utilisable en JSON ou programmatiquement)
 */
export const productBodySchema = {
  type: 'object',
  required: ['name', 'purchase_price', 'sell_price', 'stock_quantity'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 150 },
    category_id: { type: ['string', 'null'], pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
    sku: { type: ['string', 'null'], maxLength: 50 },
    purchase_price: { type: 'number', minimum: 0.01 },
    sell_price: { type: 'number', minimum: 0.01 },
    stock_quantity: { type: 'integer', minimum: 0 },
    stock_threshold: { type: ['integer', 'null'], minimum: 0 },
    description: { type: ['string', 'null'], maxLength: 1000 },
    has_expiry: { type: 'boolean' },
    expiry_date: { type: ['string', 'null'], format: 'date' } // YYYY-MM-DD
  }
};

export const createProductSchema: FastifySchema = {
  // Pour le support de multipart/form-data, la validation automatique du body par Fastify est bypassée 
  // car Fastify-multipart remplit les champs différemment. Nous ferons la validation manuelle dans le controller.
};

export const updateProductSchema: FastifySchema = {
  params: productIdParamSchema.params
};
