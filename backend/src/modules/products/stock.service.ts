import { query, transaction } from '../../config/database';
import { StockMovement, StockMovementType } from '../../types/models';

export interface StockMovementFilters {
  page?: number;
  limit?: number;
  movement_type?: StockMovementType;
  from?: string;
  to?: string;
}

export class StockService {
  /**
   * Crée un mouvement de stock manuel (IN, OUT ou ADJUSTMENT) sur un produit.
   * Calcul atomique de l'ancien et du nouveau stock, mise à jour du produit,
   * insertion du mouvement, log d'audit, et ré-évaluation des alertes.
   */
  async createStockMovement(
    tenantId: string,
    productId: string,
    input: { movement_type: StockMovementType; quantity: number; reason: string },
    userId: string,
    clientIp: string,
    userAgent: string
  ): Promise<StockMovement> {
    const { movement_type, quantity, reason } = input;

    return transaction(async (client) => {
      // 1. Verrouiller le produit pour éviter les modifications concurrentes
      const productRes = await client.query<{ id: string; name: string; stock_quantity: number; stock_threshold: number | null }>(
        `SELECT id, name, stock_quantity, stock_threshold
         FROM products
         WHERE tenant_id = $1 AND id = $2 AND is_deleted = FALSE
         FOR UPDATE`,
        [tenantId, productId]
      );

      if (productRes.rows.length === 0) {
        const err = new Error('Produit introuvable ou supprimé.');
        (err as any).statusCode = 404;
        (err as any).code = 'PRODUCT_NOT_FOUND';
        throw err;
      }

      const product = productRes.rows[0]!;
      const oldStock = Number(product.stock_quantity);
      let newStock: number;

      if (movement_type === 'IN') {
        if (quantity <= 0) {
          const err = new Error('La quantité d\'entrée doit être un entier positif.');
          (err as any).statusCode = 400;
          (err as any).code = 'INVALID_QUANTITY';
          throw err;
        }
        newStock = oldStock + quantity;
      } else if (movement_type === 'OUT') {
        if (quantity <= 0) {
          const err = new Error('La quantité de sortie doit être un entier positif.');
          (err as any).statusCode = 400;
          (err as any).code = 'INVALID_QUANTITY';
          throw err;
        }
        newStock = oldStock - quantity;
        if (newStock < 0) {
          const err = new Error(`Stock insuffisant pour cette sortie. Stock actuel : ${oldStock}, sortie demandée : ${quantity}.`);
          (err as any).statusCode = 400;
          (err as any).code = 'STOCK_INSUFFICIENT';
          throw err;
        }
      } else {
        // ADJUSTMENT : quantity est le NOUVEAU stock absolu
        if (quantity < 0) {
          const err = new Error('Le stock ajusté ne peut pas être négatif.');
          (err as any).statusCode = 400;
          (err as any).code = 'INVALID_QUANTITY';
          throw err;
        }
        newStock = quantity;
      }

      // 2. Mettre à jour le stock du produit
      await client.query(
        'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStock, product.id]
      );

      // 3. Insérer le mouvement
      const movementRes = await client.query<StockMovement>(
        `INSERT INTO stock_movements (tenant_id, product_id, movement_type, quantity, old_stock, new_stock, reason, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [tenantId, product.id, movement_type, Math.abs(newStock - oldStock), oldStock, newStock, reason, userId]
      );
      const movement = movementRes.rows[0]!;

      // 4. Log d'audit STOCK_ADJUSTMENT (au sens large : tout mouvement manuel)
      const userRes = await client.query<{ username: string; role: string }>(
        'SELECT username, role FROM users WHERE id = $1',
        [userId]
      );
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'STOCK_ADJUSTMENT', 'PRODUCT', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          product.id,
          JSON.stringify({
            movement_type,
            product_name: product.name,
            old_stock: oldStock,
            new_stock: newStock,
            delta: newStock - oldStock,
            reason
          }),
          clientIp,
          userAgent
        ]
      );

      // 5. Ré-évaluer les alertes de stock
      await this.evaluateStockAlert(client, tenantId, product.id, product.name, newStock, product.stock_threshold);

      return movement;
    });
  }

  /**
   * List l'historique des mouvements d'un produit (paginé, filtrable).
   */
  async listStockMovements(tenantId: string, productId: string, filters: StockMovementFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const offset = (page - 1) * limit;

    const conditions = ['sm.tenant_id = $1', 'sm.product_id = $2'];
    const params: any[] = [tenantId, productId];
    let paramIdx = 3;

    if (filters.movement_type) {
      conditions.push(`sm.movement_type = $${paramIdx++}`);
      params.push(filters.movement_type);
    }
    if (filters.from) {
      conditions.push(`sm.created_at >= $${paramIdx++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`sm.created_at <= $${paramIdx++}`);
      params.push(filters.to);
    }

    const where = conditions.join(' AND ');

    const listRes = await query<StockMovement>(
      `SELECT sm.*, u.display_name AS user_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.user_id = u.id
       WHERE ${where}
       ORDER BY sm.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(sm.id) AS count FROM stock_movements sm WHERE ${where}`,
      params
    );

    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    return {
      movements: listRes.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Évalue l'état du stock et crée ou résout une alerte de stock.
   * - Si newStock <= threshold : crée une notif STOCK_LOW/STOCK_OUT (ON CONFLICT DO NOTHING).
   * - Si newStock > threshold : marque les notifs STOCK_LOW/STOCK_OUT précédentes comme résolues.
   */
  async evaluateStockAlert(
    client: import('pg').PoolClient,
    tenantId: string,
    productId: string,
    productName: string,
    newStock: number,
    productThreshold: number | null
  ) {
    const settingsRes = await client.query<{ global_stock_threshold: number }>(
      'SELECT global_stock_threshold FROM settings WHERE tenant_id = $1',
      [tenantId]
    );
    const globalThreshold = settingsRes.rows[0]?.global_stock_threshold ?? 20;
    const effectiveThreshold = productThreshold !== null ? productThreshold : globalThreshold;

    if (newStock <= effectiveThreshold) {
      const type = newStock === 0 ? 'STOCK_OUT' : 'STOCK_LOW';
      const title = type === 'STOCK_OUT' ? 'Rupture de stock' : 'Stock faible';
      const message = type === 'STOCK_OUT'
        ? `Le produit "${productName}" est en rupture de stock.`
        : `Le produit "${productName}" est sous le seuil d'alerte. Il ne reste plus que ${newStock} unités.`;

      await client.query(
        `INSERT INTO notifications (tenant_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          tenantId,
          type,
          title,
          message,
          JSON.stringify({ product_id: productId, stock_quantity: newStock, threshold: effectiveThreshold })
        ]
      );
    } else {
      // Stock remonté au-dessus du seuil : résoudre les alertes passées pour ce produit
      await client.query(
        `UPDATE notifications
         SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP, is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE tenant_id = $1
           AND type IN ('STOCK_LOW', 'STOCK_OUT')
           AND is_resolved = FALSE
           AND (data->>'product_id') = $2`,
        [tenantId, productId]
      );
    }
  }
}

export const stockService = new StockService();
