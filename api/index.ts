import { FastifyInstance } from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';

export default async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
  try {
    const app = await import('../backend/src/app').then(m => m.default as FastifyInstance<Server, IncomingMessage, ServerResponse>);
    
    await app.ready();
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