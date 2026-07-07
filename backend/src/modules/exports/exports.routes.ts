import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exportsController } from './exports.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';

export async function exportsRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, authorize(['ADMIN']), checkTenantActive];

  fastify.addHook('preHandler', (request, reply, done) => {
    (request as any).logAudit = (action: string, entityType: string, entityId: string | null, details: Record<string, unknown>) => {
      (request as any)._audit = { action, entityType, entityId, details };
      done();
    };
  });

  fastify.get('/products', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['xlsx', 'pdf'] }
        },
        required: ['format'],
        additionalProperties: false
      }
    },
    preHandler
  }, (request: FastifyRequest<any>, reply: FastifyReply) => exportsController.exportProducts(request, reply));

  fastify.get('/sales', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['xlsx', 'pdf'] },
          from: { type: 'string' },
          to: { type: 'string' }
        },
        required: ['format'],
        additionalProperties: false
      }
    },
    preHandler
  }, (request: FastifyRequest<any>, reply: FastifyReply) => exportsController.exportSales(request, reply));

  fastify.get('/daily-report', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['xlsx', 'pdf'] },
          date: { type: 'string' }
        },
        required: ['format'],
        additionalProperties: false
      }
    },
    preHandler
  }, (request: FastifyRequest<any>, reply: FastifyReply) => exportsController.exportDailyReport(request, reply));
}