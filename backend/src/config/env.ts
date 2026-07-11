import dotenv from 'dotenv';
import path from 'path';

// Charger le fichier .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  // Base de données
  DATABASE_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;

  // Serveur
  PORT: number;
  HOST: string;
  NODE_ENV: 'development' | 'production' | 'test';

  // CORS
  CORS_ORIGIN: string;

  // Rate Limiting
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_AUTH_MAX: number;

  // Uploads (Cloudinary)
  UPLOAD_MAX_SIZE: number;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;

  // Super Admin
  SUPERADMIN_PHONE: string;
  SUPERADMIN_PASSWORD: string;

  // CRON (secret partagé pour les endpoints cron HTTP)
  CRON_SECRET: string;

  // Paiements (FedaPay)
  PAYMENT_PROVIDER: 'manual' | 'fedapay';
  FEDAPAY_ENVIRONMENT: 'sandbox' | 'live';
  FEDAPAY_API_KEY: string;        // Clé secrète (Secret Key)
  FEDAPAY_PUBLIC_KEY: string;     // Clé publique (Public Key) pour checkout frontend
  FEDAPAY_API_SECRET: string;     // Ancien nom, gardé pour rétrocompatibilité
  FEDAPAY_WEBHOOK_SECRET: string; // Secret du endpoint webhook (wh_sandbox_...)
}

function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const raw = process.env[key];
  if (raw === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Variable d'environnement invalide (nombre attendu) : ${key}=${raw}`);
  }
  return parsed;
}

function validateNodeEnv(value: string): 'development' | 'production' | 'test' {
  if (value === 'development' || value === 'production' || value === 'test') {
    return value;
  }
  throw new Error(`NODE_ENV invalide : ${value}. Valeurs acceptées : development, production, test`);
}

export const env: EnvConfig = {
  DATABASE_URL: getEnvString('DATABASE_URL'),
  JWT_SECRET: (() => {
    const secret = getEnvString('JWT_SECRET');
    if (secret.includes('change_moi') || secret.includes('change_me') || secret.length < 32) {
      const msg = `JWT_SECRET trop faible ou valeur placeholder détectée. Utilisez une clé secrète d'au moins 32 caractères (256 bits).`;
      if (process.env.NODE_ENV === 'production') {
        throw new Error(msg);
      }
      console.warn(`⚠️  WARNING: ${msg}`);
    }
    return secret;
  })(),
  JWT_EXPIRES_IN: getEnvString('JWT_EXPIRES_IN', '24h'),
  PORT: getEnvNumber('PORT', 3000),
  HOST: getEnvString('HOST', '0.0.0.0'),
  NODE_ENV: validateNodeEnv(getEnvString('NODE_ENV', 'development')),
  CORS_ORIGIN: getEnvString('CORS_ORIGIN', 'http://localhost:8080'),
  RATE_LIMIT_MAX: getEnvNumber('RATE_LIMIT_MAX', 100),
  RATE_LIMIT_AUTH_MAX: getEnvNumber('RATE_LIMIT_AUTH_MAX', 10),
  UPLOAD_MAX_SIZE: getEnvNumber('UPLOAD_MAX_SIZE', 2097152),
  CLOUDINARY_CLOUD_NAME: getEnvString('CLOUDINARY_CLOUD_NAME', ''),
  CLOUDINARY_API_KEY: getEnvString('CLOUDINARY_API_KEY', ''),
  CLOUDINARY_API_SECRET: getEnvString('CLOUDINARY_API_SECRET', ''),
  SUPERADMIN_PHONE: getEnvString('SUPERADMIN_PHONE'),
  SUPERADMIN_PASSWORD: getEnvString('SUPERADMIN_PASSWORD'),
  CRON_SECRET: getEnvString('CRON_SECRET', ''),
  PAYMENT_PROVIDER: getEnvString('PAYMENT_PROVIDER', 'manual') as 'manual' | 'fedapay',
  FEDAPAY_ENVIRONMENT: getEnvString('FEDAPAY_ENVIRONMENT', 'sandbox') as 'sandbox' | 'live',
  FEDAPAY_API_KEY: getEnvString('FEDAPAY_API_KEY', ''),
  FEDAPAY_PUBLIC_KEY: getEnvString('FEDAPAY_PUBLIC_KEY', ''),
  FEDAPAY_API_SECRET: getEnvString('FEDAPAY_API_SECRET', ''),
  FEDAPAY_WEBHOOK_SECRET: getEnvString('FEDAPAY_WEBHOOK_SECRET', ''),
};
