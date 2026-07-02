import { query, transaction } from '../../config/database';
import { Product } from '../../types/models';
import { generateSKU } from '../../utils/sku-generator';
import { isFutureDate } from '../../utils/date';

export interface ProductQueryFilters {
  page?: number;
  limit?: number;
  category_id?: string;
  search?: string;
  sort?: string;
  order?: string;
}

export class ProductsService {
  /**
   * Liste les produits actifs d'une boutique (non supprimés).
   */
  async listProducts(tenantId: string, filters: ProductQueryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const search = filters.search;
    const categoryId = filters.category_id;
    const sort = filters.sort || 'created_at';
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';

    const params: any[] = [tenantId, limit, offset];
    let queryText = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.tenant_id = $1 AND p.is_deleted = FALSE
    `;

    let paramIndex = 4;

    if (categoryId) {
      queryText += ` AND p.category_id = $${paramIndex++}`;
      params.push(categoryId);
    }

    if (search) {
      queryText += ` AND (p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sécuriser les tris autorisés pour éviter les injections SQL sur le champ ORDER BY
    const allowedSortFields = ['name', 'sell_price', 'stock_quantity', 'created_at'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';

    queryText += ` ORDER BY p.${sortField} ${order} LIMIT $2 OFFSET $3`;

    const res = await query<Product & { category_name: string | null }>(queryText, params);

    // Compter le nombre total pour la pagination
    const countParams: any[] = [tenantId];
    let countQueryText = 'SELECT COUNT(id) FROM products WHERE tenant_id = $1 AND is_deleted = FALSE';
    
    let countParamIndex = 2;
    if (categoryId) {
      countQueryText += ` AND category_id = $${countParamIndex++}`;
      countParams.push(categoryId);
    }
    if (search) {
      countQueryText += ` AND (name ILIKE $${countParamIndex} OR sku ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countRes = await query<{ count: string }>(countQueryText, countParams);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    return {
      products: res.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Liste les produits mis à la corbeille.
   */
  async listTrashProducts(tenantId: string) {
    const res = await query<Product & { category_name: string | null }>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = $1 AND p.is_deleted = TRUE
       ORDER BY p.deleted_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  /**
   * Récupère un produit par son ID (avec isolation de tenant).
   */
  async getProductById(tenantId: string, id: string): Promise<Product & { category_name: string | null }> {
    const res = await query<Product & { category_name: string | null }>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = $1 AND p.id = $2`,
      [tenantId, id]
    );

    const product = res.rows[0];
    if (!product) {
      const err = new Error('Produit introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }

    return product;
  }

  /**
   * Crée un nouveau produit.
   */
  async createProduct(tenantId: string, data: any, userId: string, clientIp: string, userAgent: string): Promise<Product> {
    // 1. Validation métier des prix
    if (Number(data.sell_price) < Number(data.purchase_price)) {
      const err = new Error('Le prix de vente doit être supérieur ou égal au prix d\'achat.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 2. Validation de la date de péremption
    if (data.has_expiry) {
      if (!data.expiry_date) {
        const err = new Error('La date de péremption est obligatoire pour les produits périssables.');
        (err as any).statusCode = 400;
        throw err;
      }
      if (!isFutureDate(data.expiry_date)) {
        const err = new Error('La date de péremption doit être dans le futur.');
        (err as any).statusCode = 400;
        throw err;
      }
    }

    // 3. Génération ou validation du SKU
    let sku = data.sku ? data.sku.trim().toUpperCase() : null;
    if (!sku) {
      sku = generateSKU();
    }

    // Vérifier l'unicité du SKU dans cette boutique (tenant)
    const skuCheck = await query('SELECT id FROM products WHERE tenant_id = $1 AND sku = $2 AND is_deleted = FALSE', [tenantId, sku]);
    if (skuCheck.rows.length > 0) {
      const err = new Error(`Le code SKU "${sku}" est déjà utilisé par un autre produit.`);
      (err as any).statusCode = 409;
      throw err;
    }

    return transaction(async (client) => {
      // 4. Insérer le produit en BDD
      const insertQuery = `
        INSERT INTO products (
          tenant_id, category_id, name, sku, purchase_price, sell_price, 
          stock_quantity, stock_threshold, image_url, description, has_expiry, expiry_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const expiryDateValue = data.has_expiry ? data.expiry_date : null;

      const res = await client.query<Product>(insertQuery, [
        tenantId,
        data.category_id || null,
        data.name.trim(),
        sku,
        data.purchase_price,
        data.sell_price,
        data.stock_quantity,
        data.stock_threshold !== undefined ? data.stock_threshold : null,
        data.image_url || null,
        data.description || null,
        !!data.has_expiry,
        expiryDateValue
      ]);

      const product = res.rows[0]!;

      // 5. Enregistrer le log d'audit
      const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'PRODUCT_ADD', 'PRODUCT', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          product.id,
          JSON.stringify(product),
          clientIp,
          userAgent
        ]
      );

      // 6. Vérifier si le stock initial est sous le seuil d'alerte
      await this.checkAndTriggerStockAlert(client, tenantId, product);

      return product;
    });
  }

  /**
   * Modifie un produit existant.
   */
  async updateProduct(tenantId: string, id: string, data: any, userId: string, clientIp: string, userAgent: string): Promise<Product> {
    const currentProduct = await this.getProductById(tenantId, id);

    // 1. Validation des prix
    const purchasePrice = data.purchase_price !== undefined ? Number(data.purchase_price) : Number(currentProduct.purchase_price);
    const sellPrice = data.sell_price !== undefined ? Number(data.sell_price) : Number(currentProduct.sell_price);
    
    if (sellPrice < purchasePrice) {
      const err = new Error('Le prix de vente doit être supérieur ou égal au prix d\'achat.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 2. Validation de la date de péremption
    const hasExpiry = data.has_expiry !== undefined ? !!data.has_expiry : currentProduct.has_expiry;
    const expiryDate = data.expiry_date !== undefined ? data.expiry_date : currentProduct.expiry_date;
    
    if (hasExpiry) {
      if (!expiryDate) {
        const err = new Error('La date de péremption est obligatoire pour les produits périssables.');
        (err as any).statusCode = 400;
        throw err;
      }
      if (data.expiry_date && !isFutureDate(data.expiry_date)) {
        const err = new Error('La date de péremption doit être dans le futur.');
        (err as any).statusCode = 400;
        throw err;
      }
    }

    // 3. Validation de l'unicité du SKU si modifié
    const sku = data.sku ? data.sku.trim().toUpperCase() : currentProduct.sku;
    if (sku && sku !== currentProduct.sku) {
      const skuCheck = await query('SELECT id FROM products WHERE tenant_id = $1 AND sku = $2 AND id != $3 AND is_deleted = FALSE', [tenantId, sku, id]);
      if (skuCheck.rows.length > 0) {
        const err = new Error(`Le code SKU "${sku}" est déjà utilisé par un autre produit.`);
        (err as any).statusCode = 409;
        throw err;
      }
    }

    return transaction(async (client) => {
      // 4. Mettre à jour le produit
      const updateQuery = `
        UPDATE products
        SET category_id = $1, name = $2, sku = $3, purchase_price = $4, sell_price = $5,
            stock_quantity = $6, stock_threshold = $7, image_url = $8, description = $9,
            has_expiry = $10, expiry_date = $11, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $12 AND id = $13
        RETURNING *
      `;

      const res = await client.query<Product>(updateQuery, [
        data.category_id !== undefined ? (data.category_id || null) : currentProduct.category_id,
        data.name !== undefined ? data.name.trim() : currentProduct.name,
        sku,
        purchasePrice,
        sellPrice,
        data.stock_quantity !== undefined ? data.stock_quantity : currentProduct.stock_quantity,
        data.stock_threshold !== undefined ? (data.stock_threshold || null) : currentProduct.stock_threshold,
        data.image_url !== undefined ? (data.image_url || null) : currentProduct.image_url,
        data.description !== undefined ? (data.description || null) : currentProduct.description,
        hasExpiry,
        hasExpiry ? expiryDate : null,
        tenantId,
        id
      ]);

      const updatedProduct = res.rows[0]!;

      // 5. Calculer le différentiel de modification pour le journal d'activité (Audit Log)
      const changes: Record<string, { old: any, new: any }> = {};
      const fields = [
        'category_id', 'name', 'sku', 'purchase_price', 'sell_price', 
        'stock_quantity', 'stock_threshold', 'image_url', 'description', 
        'has_expiry', 'expiry_date'
      ];
      
      for (const field of fields) {
        const oldVal = (currentProduct as any)[field];
        const newVal = (updatedProduct as any)[field];
        if (oldVal !== newVal) {
          // Gérer la comparaison des dates de péremption qui peuvent être de type Date ou string
          if (field === 'expiry_date' && oldVal instanceof Date && newVal instanceof Date) {
            if (oldVal.getTime() === newVal.getTime()) continue;
          }
          changes[field] = { old: oldVal, new: newVal };
        }
      }

      // Enregistrer le log s'il y a eu des modifications
      if (Object.keys(changes).length > 0) {
        const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        await client.query(
          `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, 'PRODUCT_UPDATE', 'PRODUCT', $5, $6, $7, $8)`,
          [
            tenantId,
            userId,
            user?.username || null,
            user?.role || null,
            id,
            JSON.stringify({ changes }),
            clientIp,
            userAgent
          ]
        );
      }

      // 6. Vérifier si le stock mis à jour nécessite une alerte
      await this.checkAndTriggerStockAlert(client, tenantId, updatedProduct);

      return updatedProduct;
    });
  }

  /**
   * Suppression logique d'un produit (envoi en corbeille).
   */
  async deleteProduct(tenantId: string, id: string, userId: string, clientIp: string, userAgent: string): Promise<void> {
    const product = await this.getProductById(tenantId, id);

    await transaction(async (client) => {
      // Marquer comme supprimé logiquement
      await client.query(
        `UPDATE products 
         SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP 
         WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id]
      );

      // Logger l'action de suppression
      const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'PRODUCT_DELETE', 'PRODUCT', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          id,
          JSON.stringify(product),
          clientIp,
          userAgent
        ]
      );
    });
  }

  /**
   * Restauration d'un produit depuis la corbeille.
   */
  async restoreProduct(tenantId: string, id: string, userId: string, clientIp: string, userAgent: string): Promise<Product> {
    // On s'assure d'abord que le produit existe
    const product = await this.getProductById(tenantId, id);

    return transaction(async (client) => {
      // Restaurer le produit
      const res = await client.query<Product>(
        `UPDATE products 
         SET is_deleted = FALSE, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE tenant_id = $1 AND id = $2
         RETURNING *`,
        [tenantId, id]
      );

      const restoredProduct = res.rows[0]!;

      // Logger la restauration
      const userRes = await client.query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'PRODUCT_RESTORE', 'PRODUCT', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          id,
          JSON.stringify({ restored: true }),
          clientIp,
          userAgent
        ]
      );

      return restoredProduct;
    });
  }

  /**
   * Helper interne pour vérifier les seuils d'alerte de stock et créer une notification le cas échéant.
   */
  private async checkAndTriggerStockAlert(client: import('pg').PoolClient, tenantId: string, product: Product) {
    // 1. Récupérer le seuil global de la boutique
    const settingsRes = await client.query<{ global_stock_threshold: number }>(
      'SELECT global_stock_threshold FROM settings WHERE tenant_id = $1',
      [tenantId]
    );
    const globalThreshold = settingsRes.rows[0]?.global_stock_threshold ?? 20;

    // 2. Déterminer le seuil effectif du produit (spécifique > global > 20)
    const effectiveThreshold = product.stock_threshold !== null ? product.stock_threshold : globalThreshold;

    // 3. Déclencher l'alerte si la quantité est inférieure ou égale au seuil
    if (product.stock_quantity <= effectiveThreshold) {
      const type = product.stock_quantity === 0 ? 'STOCK_OUT' : 'STOCK_LOW';
      const title = type === 'STOCK_OUT' ? 'Rupture de stock' : 'Stock faible';
      const message = type === 'STOCK_OUT'
        ? `Le produit "${product.name}" est en rupture de stock.`
        : `Le produit "${product.name}" est sous le seuil d'alerte. Il ne reste plus que ${product.stock_quantity} unités.`;

      // Insérer la notification (user_id est NULL pour notifier tous les ADMIN du tenant)
      await client.query(
        `INSERT INTO notifications (tenant_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`, // Éviter les alertes dupliquées si besoin
        [
          tenantId,
          type,
          title,
          message,
          JSON.stringify({ product_id: product.id, stock_quantity: product.stock_quantity, threshold: effectiveThreshold })
        ]
      );
    }
  }
}

export const productsService = new ProductsService();
