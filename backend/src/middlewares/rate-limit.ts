import { RateLimitOptions } from '@fastify/rate-limit';
import { env } from '../config/env';

/**
 * Configuration globale du Rate Limiting pour Fastify.
 * Limite par défaut : env.RATE_LIMIT_MAX requêtes par minute par IP.
 */
export const rateLimitConfig: RateLimitOptions = {
  max: env.RATE_LIMIT_MAX,
  timeWindow: 60000, // 1 minute
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: (_request, context) => {
    return {
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: `Trop de requêtes effectuées depuis votre adresse IP. Veuillez patienter avant de réessayer.`,
      limit: context.max,
      ttl: context.ttl,
    };
  },
};

/**
 * Configuration spécifique pour les routes d'authentification.
 * Limite : env.RATE_LIMIT_AUTH_MAX (10 par défaut) requêtes par minute par IP.
 */
export const authRateLimitConfig = {
  max: env.RATE_LIMIT_AUTH_MAX,
  timeWindow: 60000, // 1 minute
};
