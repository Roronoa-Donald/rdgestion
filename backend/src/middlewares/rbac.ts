import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../types/models';

/**
 * Middleware RBAC (factory pour preHandler hook).
 * Vérifie si le rôle de l'utilisateur authentifié figure parmi les rôles autorisés.
 * 
 * @param allowedRoles Liste des rôles autorisés
 */
export function authorize(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.currentUser;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentification requise avant le contrôle d\'accès.',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'FORBIDDEN',
        message: 'Accès interdit. Vous ne disposez pas des privilèges requis pour cette action.',
      });
    }
  };
}
