import fs from 'fs';
import path from 'path';
import { query, pool } from '../config/database';

/**
 * Script d'exécution des migrations de base de données de manière séquentielle.
 */
export async function runMigrations() {
  console.log('🔄 Démarrage des migrations de base de données...');

  try {
    // 1. Créer la table de suivi des migrations si elle n'existe pas
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Déterminer le dossier contenant les fichiers SQL
    // Gère le cas d'exécution via tsx (src/) et production (dist/)
    const possiblePaths = [
      path.resolve(__dirname, 'migrations'),
      path.resolve(__dirname, '../../src/database/migrations'),
      path.resolve(__dirname, '../database/migrations'),
    ];

    let migrationDir = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        migrationDir = p;
        break;
      }
    }

    if (!migrationDir) {
      throw new Error(`Dossier des migrations introuvable dans les chemins : ${possiblePaths.join(', ')}`);
    }

    console.log(`📂 Dossier des migrations identifié : ${migrationDir}`);

    // 3. Lire et trier les fichiers SQL
    const files = fs.readdirSync(migrationDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Tri alphabétique / numérique séquentiel

    console.log(`📄 Fichiers de migration trouvés (${files.length}) :`, files);

    // 4. Récupérer les migrations déjà exécutées
    const dbMigrated = await query<{ name: string }>('SELECT name FROM migrations');
    const migratedSet = new Set(dbMigrated.rows.map(row => row.name));

    // 5. Exécuter les nouvelles migrations
    for (const file of files) {
      if (migratedSet.has(file)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`ℹ️ Migration déjà appliquée : ${file}`);
        }
        continue;
      }

      console.log(`🚀 Application de la migration : ${file}`);
      const filePath = path.join(migrationDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Exécuter la migration dans une transaction SQL
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Exécuter les commandes SQL du fichier
        await client.query(sqlContent);
        
        // Enregistrer la migration comme exécutée
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        
        await client.query('COMMIT');
        console.log(`✅ Migration réussie : ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Échec de la migration ${file} :`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('🎉 Toutes les migrations de base de données ont été appliquées avec succès.');
  } catch (error) {
    console.error('❌ Erreur critique lors de l\'exécution des migrations :', error);
    throw error;
  }
}

// Exécuter directement si le fichier est appelé directement par Node/tsx
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('👋 Fin du script de migration.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
