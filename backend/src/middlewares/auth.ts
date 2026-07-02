import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/token';

/**
 * Middleware Fastify (preHandler hook) pour authentifier l'utilisateur via JWT.
 * Injecte le payload décodé dans request.currentUser.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Jeton d\'authentification manquant ou invalide dans les en-têtes (Bearer attendu).',
      });
    }

    const token = authHeader.substring(7); // Extraire après "Bearer "
    const decoded = verifyToken(token);
    
    // Injecter dans la requête
    request.currentUser = decoded;
  } catch (error) {
    return reply.status(401).send({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Jeton d\'authentification expiré, corrompu ou invalide.',
    });
  }
}
