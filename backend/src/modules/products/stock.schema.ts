import { FastifySchema } from 'fastify';

export const stockMovementParamSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }
    },
    additionalProperties: false
  }
};

export const createStockMovementSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['movement_type', 'quantity', 'reason'],
    properties: {
      movement_type: { type: 'string', enum: ['IN', 'OUT', 'ADJUSTMENT'] },
      // Pour IN : quantité positive ajoutée. Pour OUT : quantité positive retirée.
      // Pour ADJUSTMENT : on accepte soit (a) quantity positive = nouveau stock absolu, soit (b) delta signé.
      quantity: { type: 'integer' },
      reason: { type: 'string', minLength: 3, maxLength: 255 }
    },
    additionalProperties: false
  },
  params: stockMovementParamSchema.params
};

export const getStockMovementsSchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      movement_type: { type: 'string', enum: ['IN', 'OUT', 'ADJUSTMENT'] },
      from: { type: 'string', format: 'date' },
      to: { type: 'string', format: 'date' }
    },
    additionalProperties: false
  },
  params: stockMovementParamSchema.params
};
