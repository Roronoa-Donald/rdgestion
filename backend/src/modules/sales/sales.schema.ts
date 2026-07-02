import { FastifySchema } from 'fastify';

/**
 * Schéma pour enregistrer une vente (POST /api/sales)
 */
export const createSaleSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['items', 'payment_method'],
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['product_id', 'quantity'],
          properties: {
            product_id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
            quantity: { type: 'integer', minimum: 1 }
          },
          additionalProperties: false
        }
      },
      payment_method: { type: 'string', enum: ['CASH', 'MOBILE_MONEY'] },
      momo_reference: { type: 'string', minLength: 1, maxLength: 100 },
      discount_type: { type: ['string', 'null'], enum: ['FIXED', 'PERCENTAGE', null] },
      discount_value: { type: ['number', 'null'], minimum: 0 },
      amount_received: { type: ['number', 'null'], minimum: 0 }
    },
    additionalProperties: false
  }
};

/**
 * Schéma pour l'historique des ventes (GET /api/sales)
 */
export const getSalesSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      from: { type: 'string', format: 'date' }, // YYYY-MM-DD
      to: { type: 'string', format: 'date' },
      seller_id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
      status: { type: 'string', enum: ['active', 'cancelled'] },
      payment_method: { type: 'string', enum: ['CASH', 'MOBILE_MONEY'] }
    },
    additionalProperties: false
  }
};

/**
 * Schéma pour valider l'ID d'une vente dans les paramètres d'URL
 */
export const saleIdParamSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }
    },
    additionalProperties: false
  }
};
