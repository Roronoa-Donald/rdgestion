import { FastifyInstance } from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';

// Cache the Fastify instance at module level to avoid re-initializing on every invocation.
// This dramatically reduces cold-start time for subsequent requests within the same lambda.
let appInstance: FastifyInstance<Server, IncomingMessage, ServerResponse> | null = null;
let initPromise: Promise<FastifyInstance<Server, IncomingMessage, ServerResponse>> | null = null;

async function getApp(): Promise<FastifyInstance<Server, IncomingMessage, ServerResponse>> {
  if (appInstance) return appInstance;
  if (!initPromise) {
    initPromise = import('../backend/src/app').then(m => m.default as FastifyInstance<Server, IncomingMessage, ServerResponse>);
  }
  appInstance = await initPromise;
  await appInstance.ready();
  return appInstance;
}

export default async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (error) {
    const err = error as Error;
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: 'FUNCTION_INVOCATION_FAILED',
      message: err.message || 'Une erreur interne est survenue lors de l\'initialisation du serveur.',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }));
  }
};