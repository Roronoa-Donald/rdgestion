import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';
import { RegisterInput, LoginInput, CreateVendorInput } from '../../types/models';

/**
 * Gestionnaires HTTP pour le module d'authentification.
 */
export class AuthController {
  /**
   * Inscription d'une nouvelle boutique.
   */
  async register(request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const result = await authService.register(request.body, userIp, userAgent);
    return reply.status(201).send(result);
  }

  /**
   * Connexion utilisateur.
   */
  async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const result = await authService.login(request.body, userIp, userAgent);
    return reply.send(result);
  }

  /**
   * Création d'un compte vendeur (par un ADMIN).
   */
  async createVendor(request: FastifyRequest<{ Body: CreateVendorInput }>, reply: FastifyReply) {
    const currentUser = request.currentUser;
    if (!currentUser) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Utilisateur non authentifié.'
      });
    }

    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const vendor = await authService.createVendor(
      currentUser.tenantId,
      request.body,
      currentUser.userId,
      userIp,
      userAgent
    );

    return reply.status(201).send({
      success: true,
      data: { vendor },
    });
  }

  /**
   * Déconnexion de l'utilisateur courant.
   */
  async logout(request: FastifyRequest, reply: FastifyReply) {
    const currentUser = request.currentUser;
    if (!currentUser) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Utilisateur non authentifié.'
      });
    }

    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    await authService.logout(currentUser.userId, userIp, userAgent);

    return reply.send({
      success: true,
      message: 'Déconnexion réussie'
    });
  }
}

export const authController = new AuthController();
