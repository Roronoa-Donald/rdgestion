import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../config/database';

/**
 * Middleware Fastify (preHandler hook) pour l'isolation multi-tenant.
 * Vérifie si la boutique (tenant) associée à l'utilisateur est active.
 * Bypassé pour le rôle SUPERADMIN.
 */
export async function checkTenantActive(request: FastifyRequest, reply: FastifyReply) {
  const user = request.currentUser;
  
  // Si pas d'utilisateur (route publique), on continue
  if (!user) {
    return;
  }

  // Le SUPERADMIN n'appartient pas à un tenant de boutique standard
  if (user.role === 'SUPERADMIN') {
    return;
  }

  try {
    const res = await query<{ is_active: boolean }>('SELECT is_active FROM tenants WHERE id = $1', [user.tenantId]);
    
    if (res.rowCount === 0) {
      return reply.status(404).send({
        success: false,
        error: 'TENANT_NOT_FOUND',
        message: 'Cette boutique n\'existe pas.',
      });
    }

    if (!res.rows[0]?.is_active) {
      return reply.status(403).send({
        success: false,
        error: 'TENANT_INACTIVE',
        message: 'Votre boutique a été désactivée. Veuillez contacter le support technique.',
      });
    }
  } catch (error) {
    const err = error as Error;
    request.log.error(`Erreur vérification tenant : ${err.message}`);
    return reply.status(500).send({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur interne du serveur lors de la validation de la boutique.',
    });
  }
}
