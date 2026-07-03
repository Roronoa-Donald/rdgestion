let app: any = null;

export default async (req: any, res: any) => {
  try {
    console.log(`[Vercel API] Incoming request: ${req.method} ${req.url}`);
    
    if (!app) {
      console.log('[Vercel API] Importing Fastify application...');
      const { default: fastifyInstance } = await import('../backend/src/app');
      app = fastifyInstance;
      console.log('[Vercel API] Fastify application imported successfully.');
    }
    
    console.log('[Vercel API] Waiting for Fastify ready...');
    await app.ready();
    console.log('[Vercel API] Fastify ready. Emitting request...');
    
    app.server.emit('request', req, res);
  } catch (error: any) {
    console.error('[Vercel API] CRITICAL ERROR during function execution:', error);
    if (error.stack) {
      console.error('[Vercel API] Error stack:', error.stack);
    }
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: 'FUNCTION_INVOCATION_FAILED',
      message: error.message || 'Une erreur interne est survenue lors de l\'initialisation du serveur.',
      details: error.stack
    }));
  }
};
