import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtPayload } from '../config/jwt';

// Augmentation du type FastifyRequest pour inclure l'utilisateur authentifié
declare module 'fastify' {
  interface FastifyRequest {
    /** Utilisateur authentifié extrait du JWT */
    currentUser?: JwtPayload;
  }
}
