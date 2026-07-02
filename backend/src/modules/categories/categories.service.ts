import { query, transaction } from '../../config/database';
import { Category } from '../../types/models';

export class CategoriesService {
  /**
   * Récupère la liste des catégories associées à un tenant.
   */
  async listCategories(tenantId: string): Promise<Category[]> {
    const res = await query<Category>(
      `SELECT * FROM categories 
       WHERE tenant_id = $1 
       ORDER BY sort_order ASC, name ASC`,
      [tenantId]
    );
    return res.rows;
  }

  /**
   * Crée une catégorie personnalisée (PRO uniquement).
   */
  async createCategory(tenantId: string, name: string, userId: string, clientIp: string, userAgent: string): Promise<Category> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      const err = new Error('Le nom de la catégorie ne peut pas être vide.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 1. Vérifier si le tenant est abonné au plan PRO
    const subRes = await query<{ tier: string }>(
      `SELECT tier FROM subscriptions 
       WHERE tenant_id = $1 AND status = 'ACTIVE' 
       ORDER BY start_date DESC LIMIT 1`,
      [tenantId]
    );
    const subscription = subRes.rows[0];
    if (!subscription || subscription.tier !== 'PRO') {
      const err = new Error('La création de catégories personnalisées est réservée aux abonnés PRO.');
      (err as any).statusCode = 403;
      (err as any).code = 'PRO_REQUIRED';
      throw err;
    }

    // 2. Vérifier si une catégorie avec ce nom existe déjà
    const checkRes = await query(
      'SELECT id FROM categories WHERE tenant_id = $1 AND name = $2',
      [tenantId, trimmedName]
    );
    if (checkRes.rows.length > 0) {
      const err = new Error(`La catégorie "${trimmedName}" existe déjà.`);
      (err as any).statusCode = 409;
      throw err;
    }

    return transaction(async (client) => {
      // Récupérer le sort_order maximum actuel
      const orderRes = await client.query<{ max_order: number }>(
        'SELECT MAX(sort_order) as max_order FROM categories WHERE tenant_id = $1',
        [tenantId]
      );
      const nextOrder = (orderRes.rows[0]?.max_order ?? 0) + 1;

      // Insérer la catégorie
      const insertRes = await client.query<Category>(
        `INSERT INTO categories (tenant_id, name, is_default, sort_order)
         VALUES ($1, $2, FALSE, $3)
         RETURNING *`,
        [tenantId, trimmedName, nextOrder]
      );
      const category = insertRes.rows[0]!;

      // Enregistrer le log d'audit
      const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'CATEGORY_CREATED', 'CATEGORY', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          category.id,
          JSON.stringify({ category_name: category.name }),
          clientIp,
          userAgent
        ]
      );

      return category;
    });
  }

  /**
   * Supprime une catégorie personnalisée.
   * Déplace automatiquement tous ses produits associés dans la catégorie prédéfinie "Autres".
   */
  async deleteCategory(tenantId: string, categoryId: string, userId: string, clientIp: string, userAgent: string): Promise<void> {
    // 1. S'assurer que la catégorie à supprimer existe et n'est pas une catégorie par défaut (système)
    const catRes = await query<Category>(
      'SELECT * FROM categories WHERE tenant_id = $1 AND id = $2',
      [tenantId, categoryId]
    );
    const category = catRes.rows[0];
    if (!category) {
      const err = new Error('Catégorie introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }
    if (category.is_default || category.name === 'Autres') {
      const err = new Error('Les catégories par défaut du système ne peuvent pas être supprimées.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 2. Trouver la catégorie "Autres" du tenant (toujours présente via onboarding)
    const autresRes = await query<{ id: string }>(
      "SELECT id FROM categories WHERE tenant_id = $1 AND name = 'Autres'",
      [tenantId]
    );
    const autresCategory = autresRes.rows[0];
    if (!autresCategory) {
      const err = new Error('La catégorie par défaut "Autres" est introuvable. Action interrompue.');
      (err as any).statusCode = 500;
      throw err;
    }

    await transaction(async (client) => {
      // 3. Déplacer tous les produits vers "Autres"
      await client.query(
        'UPDATE products SET category_id = $1 WHERE tenant_id = $2 AND category_id = $3',
        [autresCategory.id, tenantId, categoryId]
      );

      // 4. Supprimer la catégorie
      await client.query(
        'DELETE FROM categories WHERE tenant_id = $1 AND id = $2',
        [tenantId, categoryId]
      );

      // 5. Enregistrer le log d'audit
      const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'CATEGORY_DELETED', 'CATEGORY', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          categoryId,
          JSON.stringify({ deleted_category_name: category.name, fallback_category_id: autresCategory.id }),
          clientIp,
          userAgent
        ]
      );
    });
  }
}

export const categoriesService = new CategoriesService();
