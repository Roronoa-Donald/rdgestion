import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { env } from './config/env';
import { checkDatabaseConnection, query, pool } from './config/database';
import { hashPassword } from './utils/password';
import { runMigrations } from './database/migrate';
import { registerCors } from './plugins/cors';
import { registerSwagger } from './plugins/swagger';
import { authRoutes } from './modules/auth/auth.routes';
import { productsRoutes } from './modules/products/products.routes';
import { categoriesRoutes } from './modules/categories/categories.routes';
import { salesRoutes } from './modules/sales/sales.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { logsRoutes } from './modules/logs/logs.routes';
import { notificationsRoutes } from './modules/notifications/notifications.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { rateLimitConfig } from './middlewares/rate-limit';

const fastify = Fastify({
  logger: env.NODE_ENV === 'development' ? {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  } : true,
});

/**
 * Initialise le Super Administrateur en base de données s'il n'existe pas.
 * Crée également une boutique système par défaut pour respecter la contrainte NOT NULL de tenant_id.
 */
async function bootstrapSuperAdmin() {
  const superadminPhone = env.SUPERADMIN_PHONE;
  
  try {
    // 1. Vérifier si le superadmin existe déjà dans les utilisateurs
    const superadminCheck = await query('SELECT id FROM users WHERE role = \'SUPERADMIN\'');
    
    if (superadminCheck.rows.length > 0) {
      console.log('ℹ️ Super Administrateur déjà configuré en base.');
      return;
    }

    console.log('🚧 Initialisation du Super Administrateur...');

    // Utiliser un UUID statique/système ou en générer un nouveau pour la boutique plateforme
    const systemTenantId = '00000000-0000-0000-0000-000000000000';
    
    // Insérer le tenant plateforme s'il n'existe pas
    await query(
      `INSERT INTO tenants (id, name, owner_name, phone, referral_code, is_active)
       VALUES ($1, 'RDGESTION Plateforme', 'SuperAdmin', $2, 'RD-SYSTEM-000', TRUE)
       ON CONFLICT (phone) DO NOTHING`,
      [systemTenantId, superadminPhone]
    );

    // Hacher le mot de passe du superadmin
    const passwordHash = await hashPassword(env.SUPERADMIN_PASSWORD);

    // Insérer l'utilisateur Super Administrateur
    await query(
      `INSERT INTO users (tenant_id, username, password_hash, role, display_name)
       VALUES ($1, $2, $3, 'SUPERADMIN', 'Super Administrateur')
       ON CONFLICT (username) DO NOTHING`,
      [systemTenantId, superadminPhone, passwordHash]
    );

    console.log('✅ Super Administrateur créé avec succès.');
  } catch (error) {
    console.error('❌ Échec de l\'initialisation du Super Administrateur :', error);
  }
}

/**
 * Configure et démarre l'application Fastify.
 */
async function startServer() {
  try {
    // 1. Valider la connexion à la base de données
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      process.exit(1);
    }

    // 2. Exécuter les migrations de base de données
    await runMigrations();

    // 3. Initialiser le Super Admin
    await bootstrapSuperAdmin();

    // 4. Enregistrer les plugins de sécurité et utilitaires généraux
    await fastify.register(fastifyHelmet);
    await registerCors(fastify);
    
    // Rate Limiting global
    await fastify.register(fastifyRateLimit, rateLimitConfig);

    // Support Multi-part pour l'upload des images de produits
    await fastify.register(fastifyMultipart, {
      limits: {
        fileSize: env.UPLOAD_MAX_SIZE, // Max 2Mo par défaut
        files: 1,
      },
    });

    // 5. Enregistrer la documentation Swagger
    await registerSwagger(fastify);

    // 6. Enregistrer les routes applicatives
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(productsRoutes, { prefix: '/api/products' });
    await fastify.register(categoriesRoutes, { prefix: '/api/categories' });
    await fastify.register(salesRoutes, { prefix: '/api/sales' });
    await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await fastify.register(logsRoutes, { prefix: '/api/logs' });
    await fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
    await fastify.register(settingsRoutes, { prefix: '/api/settings' });
    await fastify.register(adminRoutes, { prefix: '/api/admin' });

    // Servir les fichiers statiques du dossier frontend au chemin racine
    await fastify.register(fastifyStatic, {
      root: path.resolve(__dirname, '../../frontend'),
      prefix: '/',
    });

    // Route de santé simple
    fastify.get('/health', async () => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    });

    // 7. Configurer le gestionnaire d'erreurs global
    fastify.setErrorHandler((error, request, reply) => {
      // Gérer les erreurs de validation Ajv de Fastify
      if (error.validation) {
        return reply.status(400).send({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Données d\'entrée non valides.',
          details: error.validation,
        });
      }

      // Gérer le code d'erreur de dépassement de limite de débit (Rate Limit)
      if (error.statusCode === 429) {
        return reply.status(429).send(error);
      }

      // Gérer les erreurs personnalisées avec code HTTP spécifique
      const statusCode = (error as any).statusCode || 500;
      const errorCode = (error as any).code || 'SERVER_ERROR';

      // Masquer les détails de l'erreur interne en production
      const message = env.NODE_ENV === 'production' && statusCode === 500
        ? 'Une erreur interne est survenue sur le serveur.'
        : error.message;

      if (statusCode === 500) {
        request.log.error(error);
      }

      return reply.status(statusCode).send({
        success: false,
        error: errorCode,
        message,
      });
    });

    // 8. Démarrer l'écoute réseau (seulement hors Vercel Serverless)
    if (!process.env.VERCEL) {
      await fastify.listen({ port: env.PORT, host: env.HOST });
      console.log(`🚀 Serveur démarré sur http://${env.HOST}:${env.PORT}`);
      console.log(`📖 Documentation Swagger disponible sur http://${env.HOST}:${env.PORT}/documentation`);
    } else {
      await fastify.ready();
    }
  } catch (err) {
    fastify.log.error(err);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
}

startServer();
export default fastify;
