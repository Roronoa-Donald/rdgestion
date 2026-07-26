import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { env } from '../config/env';

/**
 * Configure et enregistre le plugin CORS.
 *
 * - En développement : `origin: true` réfléchit l'Origin du client, ce qui
 *   est requis pour que `credentials: true` fonctionne (CORS spec interdit
 *   `'*'` combiné avec credentials).
 * - En production : `env.CORS_ORIGIN` peut contenir plusieurs domaines séparés
 *   par des virgules (ex: "https://app1.com,https://app2.com"). On les parse
 *   en tableau ; Fastify/Cors accepte un tableau d'origines autorisées.
 */
export async function registerCors(fastify: FastifyInstance) {
  const origin =
    env.NODE_ENV === 'development'
      ? true // réfléchit l'Origin du client (compatible credentials: true)
      : env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  await fastify.register(fastifyCors, {
    origin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    credentials: true,
  });
}
