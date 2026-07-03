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

// 1. Enregistrer le plugin d'initialisation asynchrone (Base de données, migrations, Super Admin)
fastify.register(async () => {
  console.log('[Boot Plugin] Starting database connection check...');
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('❌ [Boot Plugin] Impossible de se connecter à PostgreSQL.');
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    return;
  }
  console.log('✅ [Boot Plugin] Database connection verified.');

  // Les migrations ne doivent pas être exécutées au runtime sur Vercel (fichiers SQL non packagés, performance/timeouts)
  if (!process.env.VERCEL) {
    console.log('[Boot Plugin] Environment is not Vercel. Running database migrations...');
    await runMigrations();
    console.log('✅ [Boot Plugin] Database migrations completed.');
  } else {
    console.log('ℹ️ [Boot Plugin] Vercel environment detected: skipping runtime database migrations.');
  }

  console.log('[Boot Plugin] Running SuperAdmin bootstrap...');
  await bootstrapSuperAdmin();
  console.log('🎉 [Boot Plugin] SuperAdmin bootstrap finished.');
});

// 2. Enregistrer les plugins de sécurité et utilitaires généraux
fastify.register(fastifyHelmet);
fastify.register(registerCors);

// Rate Limiting global
fastify.register(fastifyRateLimit, rateLimitConfig);

// Support Multi-part pour l'upload des images de produits
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE, // Max 2Mo par défaut
    files: 1,
  },
});

// 3. Enregistrer la documentation Swagger
fastify.register(registerSwagger);

// 4. Enregistrer les routes applicatives
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(productsRoutes, { prefix: '/api/products' });
fastify.register(categoriesRoutes, { prefix: '/api/categories' });
fastify.register(salesRoutes, { prefix: '/api/sales' });
fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
fastify.register(logsRoutes, { prefix: '/api/logs' });
fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
fastify.register(settingsRoutes, { prefix: '/api/settings' });
fastify.register(adminRoutes, { prefix: '/api/admin' });

// 5. Servir les fichiers statiques du dossier frontend au chemin racine
fastify.register(fastifyStatic, {
  root: path.resolve(__dirname, '../../frontend'),
  prefix: '/',
});

// 6. Route de santé simple
fastify.get('/health', async () => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});

// 7. Configurer le gestionnaire d'erreurs global
fastify.setErrorHandler((error, request, reply) => {
  // Gérer les erreurs de validation Ajv de Fastify
  if (error.validation || error.statusCode === 400) {
    let customMessage = 'Données d\'entrée non valides.';
    const valErrors = error.validation || [];

    for (const err of valErrors) {
      if (err.instancePath === '/password' && err.keyword === 'pattern') {
        customMessage = 'Le mot de passe doit contenir au moins une lettre majuscule et un chiffre.';
        break;
      }
      if (err.instancePath === '/password' && err.keyword === 'minLength') {
        customMessage = 'Le mot de passe doit contenir au moins 8 caractères.';
        break;
      }
      if (err.instancePath === '/shop_name' && err.keyword === 'pattern') {
        customMessage = 'Le nom du commerce contient des caractères spéciaux non autorisés.';
        break;
      }
      if (err.instancePath === '/phone' && err.keyword === 'minLength') {
        customMessage = 'Le numéro de téléphone est trop court.';
        break;
      }
      if (err.instancePath === '/referral_code' && err.keyword === 'pattern') {
        customMessage = 'Le code de parrainage est invalide (ex: RD-BOUTIQUE-123).';
        break;
      }
    }

    // Si pas d'erreurs détaillées mais un message AJV brut dans error.message
    if (customMessage === 'Données d\'entrée non valides.' && error.message) {
      if (error.message.includes('body/password') && error.message.includes('pattern')) {
        customMessage = 'Le mot de passe doit contenir au moins une lettre majuscule et un chiffre.';
      } else if (error.message.includes('body/password') && error.message.includes('minLength')) {
        customMessage = 'Le mot de passe doit contenir au moins 8 caractères.';
      } else if (error.message.includes('body/shop_name')) {
        customMessage = 'Le nom du commerce contient des caractères spéciaux non autorisés ou est invalide.';
      } else if (error.message.includes('body/phone')) {
        customMessage = 'Le numéro de téléphone est invalide.';
      } else if (error.message.includes('body/referral_code')) {
        customMessage = 'Le code de parrainage est invalide.';
      } else {
        customMessage = error.message.replace(/^body\//, 'Le champ ').replace(/must match pattern ".+"/, 'est invalide ou ne respecte pas le format requis.');
      }
    }

    return reply.status(400).send({
      success: false,
      error: 'VALIDATION_ERROR',
      message: customMessage,
      details: error.validation || [{ message: error.message }],
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

async function startServer() {
  try {
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
