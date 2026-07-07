import { query, transaction, pool } from '../../config/database';
import { Sale, SaleItem, UserRole, DiscountType, PaymentMethod } from '../../types/models';

export interface CreateSaleInput {
  items: {
    product_id: string;
    quantity: number;
  }[];
  payment_method: PaymentMethod;
  momo_reference?: string;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  amount_received?: number | null;
}

export interface SalesQueryFilters {
  page?: number;
  limit?: number;
  from?: string; // YYYY-MM-DD
  to?: string;
  seller_id?: string;
  status?: 'active' | 'cancelled';
  payment_method?: PaymentMethod;
}

export class SalesService {
  /**
   * Enregistre une nouvelle vente dans une transaction SQL atomique et isolée.
   */
  async createSale(tenantId: string, sellerId: string, sellerRole: UserRole, input: CreateSaleInput, clientIp: string, userAgent: string): Promise<Sale & { items: any[] }> {
    // 1. Vérifier si l'abonnement du tenant est actif
    const subRes = await query<{ status: string; tier: string }>(
      `SELECT status, tier FROM subscriptions 
       WHERE tenant_id = $1 
       ORDER BY start_date DESC LIMIT 1`,
      [tenantId]
    );
    const subscription = subRes.rows[0];

    if (!subscription || subscription.status !== 'ACTIVE') {
      const err = new Error('Votre abonnement est inactif ou expiré.');
      (err as any).statusCode = 403;
      (err as any).code = 'SUBSCRIPTION_EXPIRED';
      throw err;
    }

    const isFreePlan = subscription.tier === 'FREE';

    // 2. Valider la référence Mobile Money
    if (input.payment_method === 'MOBILE_MONEY' && !input.momo_reference) {
      const err = new Error('La référence de transaction est obligatoire pour les paiements Mobile Money.');
      (err as any).statusCode = 400;
      (err as any).code = 'MOMO_REFERENCE_REQUIRED';
      throw err;
    }

    // Commencer la transaction SQL
    return transaction(async (client) => {
      // 2b. Vérifier la limite journalière de 30 ventes (Plan FREE) — à l'intérieur de la transaction avec verrouillage
      // Récupérer le username/role du vendeur pour les logs d'audit (réutilisé plus bas)
      const sellerUserRes = await client.query<{ username: string; role: string }>(
        'SELECT username, role FROM users WHERE id = $1',
        [sellerId]
      );
      const sellerUser = sellerUserRes.rows[0];
      const sellerUsername = sellerUser?.username || null;

      if (isFreePlan) {
        await client.query(
          `INSERT INTO daily_sale_counts (tenant_id, sale_date, count)
           VALUES ($1, CURRENT_DATE, 0)
           ON CONFLICT (tenant_id, sale_date) DO NOTHING`,
          [tenantId]
        );

        const todayCountRes = await client.query<{ count: number }>(
          `SELECT count FROM daily_sale_counts 
           WHERE tenant_id = $1 AND sale_date = CURRENT_DATE
           FOR UPDATE`,
          [tenantId]
        );
        const currentCount = todayCountRes.rows[0]?.count ?? 0;
        if (currentCount >= 30) {
          const err = new Error('Limite journalière de 30 ventes atteinte (Plan Gratuit). Veuillez passer au plan PRO.');
          (err as any).statusCode = 403;
          (err as any).code = 'DAILY_LIMIT_REACHED';
          throw err;
        }
      }
      // 4. Verrouiller et récupérer les données des produits du panier (Verrouillage pessimiste)
      const productIds = input.items.map(item => item.product_id);
      const productsRes = await client.query<{
        id: string;
        name: string;
        purchase_price: number;
        sell_price: number;
        stock_quantity: number;
        stock_threshold: number | null;
      }>(
        `SELECT id, name, purchase_price, sell_price, stock_quantity, stock_threshold 
         FROM products 
         WHERE id = ANY($1) AND tenant_id = $2 AND is_deleted = FALSE 
         FOR UPDATE`,
        [productIds, tenantId]
      );

      const dbProductsMap = new Map(productsRes.rows.map(p => [p.id, p]));

      // Valider que tous les produits existent
      for (const item of input.items) {
        if (!dbProductsMap.has(item.product_id)) {
          const err = new Error(`Produit ID "${item.product_id}" introuvable.`);
          (err as any).statusCode = 400;
          (err as any).code = 'PRODUCT_NOT_FOUND';
          throw err;
        }
      }

      // Valider les stocks disponibles
      for (const item of input.items) {
        const p = dbProductsMap.get(item.product_id)!;
        if (p.stock_quantity < item.quantity) {
          const err = new Error(`Stock insuffisant pour le produit "${p.name}". Demandé: ${item.quantity}, disponible: ${p.stock_quantity}.`);
          (err as any).statusCode = 400;
          (err as any).code = 'STOCK_INSUFFICIENT';
          (err as any).details = {
            product_id: p.id,
            product_name: p.name,
            requested_quantity: item.quantity,
            available_quantity: p.stock_quantity
          };
          throw err;
        }
      }

      // 5. Calculer le sous-total de la vente
      let subtotal = 0;
      for (const item of input.items) {
        const p = dbProductsMap.get(item.product_id)!;
        subtotal += Number(p.sell_price) * item.quantity;
      }

      // 6. Gérer la remise (discount)
      let discountAmount = 0;
      let discountPercentage: number | null = null;

      if (input.discount_type && input.discount_value && input.discount_value > 0) {
        // Validation spécifique au rôle SELLER (limite dans settings)
        if (sellerRole === 'SELLER') {
          const settingsRes = await client.query<{ max_seller_discount_percentage: number }>(
            'SELECT max_seller_discount_percentage FROM settings WHERE tenant_id = $1',
            [tenantId]
          );
          const maxSellerDiscount = Number(settingsRes.rows[0]?.max_seller_discount_percentage ?? 20);
          
          let requestedPercentage = 0;
          if (input.discount_type === 'PERCENTAGE') {
            requestedPercentage = input.discount_value;
          } else {
            requestedPercentage = (input.discount_value / subtotal) * 100;
          }

          if (requestedPercentage > maxSellerDiscount) {
            const err = new Error(`La remise ne peut pas dépasser la limite vendeur de ${maxSellerDiscount}%.`);
            (err as any).statusCode = 400;
            (err as any).code = 'DISCOUNT_EXCEEDS_MAX';
            throw err;
          }
        }

        if (input.discount_type === 'PERCENTAGE') {
          discountPercentage = input.discount_value;
          discountAmount = (subtotal * discountPercentage) / 100;
        } else if (input.discount_type === 'FIXED') {
          discountAmount = input.discount_value;
        }

        // Sécurité: la remise ne peut excéder le total
        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }
      }

      const totalAmount = subtotal - discountAmount;

      // Calculer la monnaie rendue pour le paiement en CASH
      let changeGiven = 0;
      if (input.payment_method === 'CASH' && input.amount_received !== undefined && input.amount_received !== null) {
        if (input.amount_received < totalAmount) {
          const err = new Error('Le montant reçu en espèces est insuffisant.');
          (err as any).statusCode = 400;
          throw err;
        }
        changeGiven = input.amount_received - totalAmount;
      }

      // 7. Générer un numéro de transaction unique et incrémental pour le tenant
      const year = new Date().getFullYear();
      const seqRes = await client.query<{ next_val: string }>(
        `SELECT COALESCE(MAX(SUBSTRING(transaction_number FROM 12)::integer), 0) + 1 as next_val 
         FROM sales 
         WHERE tenant_id = $1 AND transaction_number LIKE $2`,
        [tenantId, `VENTE-${year}-%`]
      );
      const nextSequence = String(seqRes.rows[0]?.next_val ?? 1).padStart(7, '0');
      const transactionNumber = `VENTE-${year}-${nextSequence}`;

      // 8. Calculer le bénéfice estimé global
      let profitEstimate = 0;
      for (const item of input.items) {
        const p = dbProductsMap.get(item.product_id)!;
        const purchaseCost = Number(p.purchase_price) * item.quantity;
        const sellValue = Number(p.sell_price) * item.quantity;
        profitEstimate += (sellValue - purchaseCost);
      }
      // Réduire du montant de la remise globale appliquée
      profitEstimate = Math.max(0, profitEstimate - discountAmount);

      // 9. Créer la Vente
      const saleInsertQuery = `
        INSERT INTO sales (
          tenant_id, seller_id, transaction_number, payment_method, momo_reference,
          subtotal, discount_amount, discount_type, discount_percentage, total_amount,
          profit_estimate, amount_received, change_given
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const saleRes = await client.query<Sale>(saleInsertQuery, [
        tenantId,
        sellerId,
        transactionNumber,
        input.payment_method,
        input.momo_reference || null,
        subtotal,
        discountAmount,
        input.discount_type || null,
        discountPercentage,
        totalAmount,
        profitEstimate,
        input.amount_received || null,
        changeGiven
      ]);
      const sale = saleRes.rows[0]!;

      // 10. Insérer les lignes d'articles vendus (sale_items) + Mettre à jour les stocks
      const saleItems: any[] = [];
      const globalSettingsRes = await client.query<{ global_stock_threshold: number }>(
        'SELECT global_stock_threshold FROM settings WHERE tenant_id = $1',
        [tenantId]
      );
      const globalThreshold = globalSettingsRes.rows[0]?.global_stock_threshold ?? 20;

      for (const item of input.items) {
        const p = dbProductsMap.get(item.product_id)!;
        const itemTotalPrice = Number(p.sell_price) * item.quantity;
        
        // Calcul du profit sur cette ligne
        const itemProfit = (Number(p.sell_price) - Number(p.purchase_price)) * item.quantity;

        // Insérer dans sale_items
        const itemRes = await client.query<SaleItem>(
          `INSERT INTO sale_items (
            sale_id, product_id, product_name, quantity, 
            unit_purchase_price, unit_sell_price, total_price, profit
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [
            sale.id,
            p.id,
            p.name,
            item.quantity,
            p.purchase_price,
            p.sell_price,
            itemTotalPrice,
            itemProfit
          ]
        );
        saleItems.push(itemRes.rows[0]!);

        // Décrémenter le stock du produit
        const newStock = Number(p.stock_quantity) - item.quantity;
        await client.query(
          'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStock, p.id]
        );

        // Tracer le mouvement de stock (sortie liée à une vente)
        await client.query(
          `INSERT INTO stock_movements (tenant_id, product_id, movement_type, quantity, old_stock, new_stock, reason, sale_id, user_id)
           VALUES ($1, $2, 'OUT', $3, $4, $5, $6, $7, $8)`,
          [
            tenantId,
            p.id,
            item.quantity,
            Number(p.stock_quantity),
            newStock,
            `Vente ${sale.transaction_number}`,
            sale.id,
            sellerId
          ]
        );

        // Log d'audit STOCK_DECREMENT par produit
        await client.query(
          `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, 'STOCK_DECREMENT', 'PRODUCT', $5, $6, $7, $8)`,
          [
            tenantId,
            sellerId,
            sellerUsername,
            sellerRole,
            p.id,
            JSON.stringify({
              product_name: p.name,
              quantity_sold: item.quantity,
              old_stock: Number(p.stock_quantity),
              new_stock: newStock,
              sale_id: sale.id,
              transaction_number: sale.transaction_number
            }),
            clientIp,
            userAgent
          ]
        );

        // Envoyer une notification de stock si nécessaire
        const effectiveThreshold = p.stock_threshold !== null ? Number(p.stock_threshold) : globalThreshold;
        if (newStock <= effectiveThreshold) {
          const alertType = newStock === 0 ? 'STOCK_OUT' : 'STOCK_LOW';
          const alertTitle = alertType === 'STOCK_OUT' ? 'Rupture de stock' : 'Stock faible';
          const alertMessage = alertType === 'STOCK_OUT'
            ? `Le produit "${p.name}" est en rupture de stock.`
            : `Le produit "${p.name}" est sous le seuil d'alerte. Il ne reste plus que ${newStock} unités.`;

          await client.query(
            `INSERT INTO notifications (tenant_id, type, title, message, data)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [
              tenantId,
              alertType,
              alertTitle,
              alertMessage,
              JSON.stringify({ product_id: p.id, stock_quantity: newStock, threshold: effectiveThreshold })
            ]
          );
        }
      }

      // 11. Incrémenter le compteur journalier des ventes
      const dateRes = await client.query<{ today_count: number }>(
        `INSERT INTO daily_sale_counts (tenant_id, sale_date, count)
         VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (tenant_id, sale_date)
         DO UPDATE SET count = daily_sale_counts.count + 1
         RETURNING count as today_count`,
        [tenantId]
      );
      const newTodayCount = dateRes.rows[0]!.today_count;

      // Alerte de limite journalière à 25/30 ventes (Plan gratuit uniquement)
      if (isFreePlan && newTodayCount === 25) {
        await client.query(
          `INSERT INTO notifications (tenant_id, type, title, message)
           VALUES ($1, 'DAILY_LIMIT_WARNING', 'Limite bientôt atteinte', $2)`,
          [
            tenantId,
            `Vous avez effectué 25 ventes sur un maximum de 30 aujourd'hui. Pensez à passer au plan PRO.`
          ]
        );
      }

      // 12. Enregistrer le log d'audit
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'SALE_CREATE', 'SALE', $5, $6, $7, $8)`,
        [
          tenantId,
          sellerId,
          sellerUsername,
          sellerRole,
          sale.id,
          JSON.stringify({
            transaction_number: sale.transaction_number,
            total_amount: sale.total_amount,
            payment_method: sale.payment_method,
            items: input.items
          }),
          clientIp,
          userAgent
        ]
      );

      return {
        ...sale,
        items: saleItems
      };
    });
  }

  /**
   * Annule une vente existante (recrédite les stocks).
   */
  async cancelSale(tenantId: string, saleId: string, userId: string, clientIp: string, userAgent: string): Promise<void> {
    const saleRes = await query<Sale>('SELECT * FROM sales WHERE tenant_id = $1 AND id = $2', [tenantId, saleId]);
    const sale = saleRes.rows[0];

    if (!sale) {
      const err = new Error('Vente introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (sale.is_cancelled) {
      const err = new Error('Cette vente a déjà été annulée.');
      (err as any).statusCode = 400;
      throw err;
    }

    // Récupérer les articles vendus
    const itemsRes = await query<SaleItem>('SELECT * FROM sale_items WHERE sale_id = $1', [saleId]);
    const saleItems = itemsRes.rows;

    await transaction(async (client) => {
      // Récupérer l'utilisateur qui annule (pour les logs d'audit)
      const cancelUserRes = await client.query<{ username: string; role: string }>(
        'SELECT username, role FROM users WHERE id = $1',
        [userId]
      );
      const user = cancelUserRes.rows[0];

      // 1. Marquer la vente comme annulée
      await client.query(
        `UPDATE sales 
         SET is_cancelled = TRUE, cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $1 
         WHERE tenant_id = $2 AND id = $3`,
        [userId, tenantId, saleId]
      );

      // 2. Recréditer les stocks pour chaque produit
      for (const item of saleItems) {
        if (item.product_id) {
          // Récupérer l'ancien stock pour le tracer
          const prodRes = await client.query<{ stock_quantity: number; name: string }>(
            'SELECT stock_quantity, name FROM products WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [item.product_id, tenantId]
          );
          const product = prodRes.rows[0];
          if (product) {
            const oldStock = Number(product.stock_quantity);
            const newStock = oldStock + item.quantity;
            await client.query(
              `UPDATE products
               SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2 AND tenant_id = $3`,
              [newStock, item.product_id, tenantId]
            );

            // Tracer le mouvement de stock (entrée liée à une annulation de vente)
            await client.query(
              `INSERT INTO stock_movements (tenant_id, product_id, movement_type, quantity, old_stock, new_stock, reason, sale_id, user_id)
               VALUES ($1, $2, 'IN', $3, $4, $5, $6, $7, $8)`,
              [
                tenantId,
                item.product_id,
                item.quantity,
                oldStock,
                newStock,
                `Annulation vente ${sale.transaction_number}`,
                saleId,
                userId
              ]
            );

            // Log d'audit STOCK_INCREMENT par produit
            await client.query(
              `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
               VALUES ($1, $2, $3, $4, 'STOCK_INCREMENT', 'PRODUCT', $5, $6, $7, $8)`,
              [
                tenantId,
                userId,
                user?.username || null,
                user?.role || null,
                item.product_id,
                JSON.stringify({
                  product_name: product.name,
                  quantity_restored: item.quantity,
                  old_stock: oldStock,
                  new_stock: newStock,
                  sale_id: saleId,
                  transaction_number: sale.transaction_number
                }),
                clientIp,
                userAgent
              ]
            );

            // Ré-évaluer l'alerte de stock (peut la résoudre si stock remonte au-dessus du seuil)
            const settingsRes = await client.query<{ global_stock_threshold: number }>(
              'SELECT global_stock_threshold FROM settings WHERE tenant_id = $1',
              [tenantId]
            );
            const globalThreshold = settingsRes.rows[0]?.global_stock_threshold ?? 20;

            const prodThresholdRes = await client.query<{ stock_threshold: number | null }>(
              'SELECT stock_threshold FROM products WHERE id = $1',
              [item.product_id]
            );
            const productThreshold = prodThresholdRes.rows[0]?.stock_threshold ?? null;

            const effectiveThreshold = productThreshold !== null ? Number(productThreshold) : globalThreshold;
            if (newStock > effectiveThreshold) {
              await client.query(
                `UPDATE notifications
                 SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP, is_read = TRUE, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
                 WHERE tenant_id = $1
                   AND type IN ('STOCK_LOW', 'STOCK_OUT')
                   AND is_resolved = FALSE
                   AND (data->>'product_id') = $2`,
                [tenantId, item.product_id]
              );
            }
          }
        }
      }

      // 3. Décrémenter le compteur journalier s'il s'agit d'une vente du jour même
      const isToday = new Date(sale.created_at).toDateString() === new Date().toDateString();
      if (isToday) {
        await client.query(
          `UPDATE daily_sale_counts 
           SET count = GREATEST(0, count - 1) 
           WHERE tenant_id = $1 AND sale_date = CURRENT_DATE`,
          [tenantId]
        );
      }

      // 4. Logger l'action d'annulation
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'SALE_CANCEL', 'SALE', $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          user?.username || null,
          user?.role || null,
          saleId,
          JSON.stringify({ transaction_number: sale.transaction_number, total_amount: sale.total_amount }),
          clientIp,
          userAgent
        ]
      );
    });
  }

  /**
   * Récupère le détail d'une vente par son ID.
   */
  async getSaleById(tenantId: string, id: string): Promise<Sale & { seller_name: string | null; items: SaleItem[] }> {
    const saleRes = await query<Sale & { seller_name: string | null }>(
      `SELECT s.*, COALESCE(u.display_name, u.username) as seller_name 
       FROM sales s
       LEFT JOIN users u ON s.seller_id = u.id
       WHERE s.tenant_id = $1 AND s.id = $2`,
      [tenantId, id]
    );
    const sale = saleRes.rows[0];

    if (!sale) {
      const err = new Error('Vente introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }

    const itemsRes = await query<SaleItem>('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
    
    return {
      ...sale,
      items: itemsRes.rows
    };
  }

  /**
   * Historique des ventes filtrable et paginé.
   */
  async listSales(tenantId: string, filters: SalesQueryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const { from, to, seller_id, status, payment_method } = filters;

    const params: any[] = [tenantId, limit, offset];
    let queryText = `
      SELECT s.*, COALESCE(u.display_name, u.username) as seller_name 
      FROM sales s
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE s.tenant_id = $1
    `;

    let paramIndex = 4;

    if (from) {
      queryText += ` AND s.created_at >= $${paramIndex++}`;
      params.push(`${from} 00:00:00+00`);
    }

    if (to) {
      queryText += ` AND s.created_at <= $${paramIndex++}`;
      params.push(`${to} 23:59:59+00`);
    }

    if (seller_id) {
      queryText += ` AND s.seller_id = $${paramIndex++}`;
      params.push(seller_id);
    }

    if (status) {
      queryText += ` AND s.is_cancelled = $${paramIndex++}`;
      params.push(status === 'cancelled');
    }

    if (payment_method) {
      queryText += ` AND s.payment_method = $${paramIndex++}`;
      params.push(payment_method);
    }

    queryText += ` ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`;

    const res = await query<Sale & { seller_name: string }>(queryText, params);

    // Compter le nombre total de ventes correspondantes
    const countParams: any[] = [tenantId];
    let countQueryText = 'SELECT COUNT(id) FROM sales WHERE tenant_id = $1';
    let countParamIndex = 2;

    if (from) {
      countQueryText += ` AND created_at >= $${countParamIndex++}`;
      countParams.push(`${from} 00:00:00+00`);
    }
    if (to) {
      countQueryText += ` AND created_at <= $${countParamIndex++}`;
      countParams.push(`${to} 23:59:59+00`);
    }
    if (seller_id) {
      countQueryText += ` AND seller_id = $${countParamIndex++}`;
      countParams.push(seller_id);
    }
    if (status) {
      countQueryText += ` AND is_cancelled = $${countParamIndex++}`;
      countParams.push(status === 'cancelled');
    }
    if (payment_method) {
      countQueryText += ` AND payment_method = $${countParamIndex++}`;
      countParams.push(payment_method);
    }

    const countRes = await query<{ count: string }>(countQueryText, countParams);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    return {
      sales: res.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export const salesService = new SalesService();
