import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { exportsController } from './exports.controller';
import { authenticate } from '../../middlewares/auth';
import { authorize } from '../../middlewares/rbac';
import { checkTenantActive } from '../../middlewares/tenant';
import { auditDecorator } from '../../middlewares/audit';

export async function exportsRoutes(fastify: FastifyInstance) {
  // Décorateur d'audit — expose request.logAudit() pour les logs d'activité
  fastify.addHook('preHandler', auditDecorator);

  const preHandler = [authenticate, authorize(['ADMIN']), checkTenantActive];

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