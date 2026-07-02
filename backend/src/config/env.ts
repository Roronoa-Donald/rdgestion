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

  // Uploads
  UPLOAD_MAX_SIZE: number;
  UPLOAD_DIR: string;

  // Super Admin
  SUPERADMIN_PHONE: string;
  SUPERADMIN_PASSWORD: string;
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
  JWT_SECRET: getEnvString('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvString('JWT_EXPIRES_IN', '24h'),
  PORT: getEnvNumber('PORT', 3000),
  HOST: getEnvString('HOST', '0.0.0.0'),
  NODE_ENV: validateNodeEnv(getEnvString('NODE_ENV', 'development')),
  CORS_ORIGIN: getEnvString('CORS_ORIGIN', 'http://localhost:8080'),
  RATE_LIMIT_MAX: getEnvNumber('RATE_LIMIT_MAX', 100),
  RATE_LIMIT_AUTH_MAX: getEnvNumber('RATE_LIMIT_AUTH_MAX', 10),
  UPLOAD_MAX_SIZE: getEnvNumber('UPLOAD_MAX_SIZE', 2097152),
  UPLOAD_DIR: getEnvString('UPLOAD_DIR', './uploads'),
  SUPERADMIN_PHONE: getEnvString('SUPERADMIN_PHONE'),
  SUPERADMIN_PASSWORD: getEnvString('SUPERADMIN_PASSWORD'),
};
