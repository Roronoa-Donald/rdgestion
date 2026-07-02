import { FastifyRequest } from 'fastify';
import { query } from '../config/database';
import { AuditAction, EntityType } from '../types/models';

// Augmenter le type FastifyRequest pour inclure logAudit
declare module 'fastify' {
  interface FastifyRequest {
    logAudit(
      action: AuditAction,
      entityType: EntityType | null,
      entityId: string | null,
      details: Record<string, unknown>
    ): Promise<void>;
  }
}

/**
 * Middleware Fastify (onRequest ou preHandler hook) qui décore la requête avec logAudit.
 * Permet d'écrire facilement dans le journal d'activité depuis n'importe quel controller.
 */
export async function auditDecorator(request: FastifyRequest) {
  request.logAudit = async (
    action: AuditAction,
    entityType: EntityType | null,
    entityId: string | null,
    details: Record<string, unknown>
  ) => {
    const user = request.currentUser;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'] || null;

    try {
      // Insertion directe en base de données
      await query(
        `INSERT INTO audit_logs 
         (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user?.tenantId || null,
          user?.userId || null,
          user?.username || null,
          user?.role || null,
          action,
          entityType,
          entityId,
          JSON.stringify(details),
          ip,
          userAgent,
        ]
      );
    } catch (error) {
      const err = error as Error;
      request.log.error(`Échec d'écriture du journal d'activité [${action}] : ${err.message}`);
    }
  };
}
