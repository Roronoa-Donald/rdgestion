import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { env } from '../config/env';

/**
 * Configure et enregistre le plugin CORS.
 */
export async function registerCors(fastify: FastifyInstance) {
  await fastify.register(fastifyCors, {
    origin: env.NODE_ENV === 'development' ? '*' : env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    credentials: true,
  });
}
