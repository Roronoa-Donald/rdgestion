import { Pool, PoolConfig } from 'pg';
import { env } from './env';

const isLocalDb = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1');

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  max: 20,                    // Nombre max de connexions dans le pool
  idleTimeoutMillis: 30000,   // Fermer les connexions inactives après 30s
  connectionTimeoutMillis: 5000, // Timeout de connexion à 5s
  ssl: isLocalDb ? false : { rejectUnauthorized: false } // Requis pour Aiven, Neon, Supabase, Vercel...
};

export const pool = new Pool(poolConfig);

// Gestion des erreurs du pool
pool.on('error', (err: Error) => {
  console.error('Erreur inattendue du pool PostgreSQL :', err.message);
  process.exit(1);
});

// Fonction utilitaire pour exécuter une requête
export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<Omit<import('pg').QueryResult<any>, 'rows'> & { rows: T[] }> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (env.NODE_ENV === 'development') {
    console.log('Requête SQL :', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }

  return result;
}

// Fonction utilitaire pour les transactions
export async function transaction<T>(
  callback: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Vérification de la connexion à la base de données
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connexion PostgreSQL établie :', result.rows[0]?.now);
    return true;
  } catch (error) {
    const err = error as Error;
    console.error('❌ Impossible de se connecter à PostgreSQL :', err.message);
    return false;
  }
}
