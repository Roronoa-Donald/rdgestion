import { query, transaction } from '../../config/database';
import { Settings } from '../../types/models';
import { hashPassword, verifyPassword } from '../../utils/password';

export class SettingsService {
  /**
   * Récupère les paramètres d'une boutique.
   * Crée les paramètres par défaut si inexistants.
   */
  async getSettings(tenantId: string): Promise<Settings> {
    const res = await query<Settings>('SELECT * FROM settings WHERE tenant_id = $1', [tenantId]);
    if (res.rows.length > 0) return res.rows[0]!;

    // Créer les paramètres par défaut si manquants
    const insert = await query<Settings>(
      `INSERT INTO settings (tenant_id) VALUES ($1) RETURNING *`,
      [tenantId]
    );
    return insert.rows[0]!;
  }

  /**
   * Met à jour les paramètres de la boutique.
   */
  async updateSettings(tenantId: string, data: Partial<Settings>, userId: string, clientIp: string, userAgent: string): Promise<Settings> {
    // Récupérer les valeurs actuelles
    const current = await this.getSettings(tenantId);

    // Champs modifiables — split entre PRO_ONLY (ticket_*) et ALL.
    const proOnly: (keyof Settings)[] = [
      'ticket_show_logo',
      'ticket_show_slogan',
      'ticket_footer_message',
      'ticket_width',
      'ticket_show_qr',
      'theme'
    ];
    const allFields: (keyof Settings)[] = [
      'global_stock_threshold',
      'max_seller_discount_percentage'
    ];

    // Vérifier si des champs PRO_ONLY sont demandés et exiger l'abonnement PRO.
    const requestedProFields = proOnly.filter(f => data[f] !== undefined);
    if (requestedProFields.length > 0) {
      const subRes = await query<{ tier: string }>(
        "SELECT tier FROM subscriptions WHERE tenant_id = $1 AND status = 'ACTIVE'",
        [tenantId]
      );
      if (subRes.rows[0]?.tier !== 'PRO') {
        const err = new Error('Les fonctionnalités de personnalisation du ticket nécessitent un abonnement PRO.');
        (err as any).statusCode = 403;
        (err as any).code = 'PRO_REQUIRED';
        throw err;
      }
    }

    const allowed = [...allFields, ...proOnly];

    // Construire la clause SET dynamiquement
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        values.push(data[field]);
      }
    }

    if (setClauses.length === 0) {
      return current; // Rien à modifier
    }

    values.push(tenantId);
    const updateRes = await query<Settings>(
      `UPDATE settings SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE tenant_id = $${idx} RETURNING *`,
      values
    );
    const updated = updateRes.rows[0]!;

    // Calculer le différentiel pour les logs
    const changes: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined && data[field] !== current[field]) {
        changes[field] = { old: current[field], new: data[field] };
      }
    }

    if (Object.keys(changes).length > 0) {
      const userRes = await query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
      const user = userRes.rows[0];

      // Log générique SETTINGS_UPDATE
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'SETTINGS_UPDATE', 'SETTINGS', $5, $6, $7, $8)`,
        [tenantId, userId, user?.username || null, user?.role || null, current.id, JSON.stringify({ changes }), clientIp, userAgent]
      );

      // Log spécifique TICKET_SETTINGS_UPDATE si des champs ticket_* ont été modifiés
      const ticketChanges: Record<string, any> = {};
      for (const field of proOnly) {
        if (changes[field] !== undefined) {
          ticketChanges[field] = changes[field];
        }
      }
      if (Object.keys(ticketChanges).length > 0) {
        await query(
          `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, 'TICKET_SETTINGS_UPDATE', 'SETTINGS', $5, $6, $7, $8)`,
          [tenantId, userId, user?.username || null, user?.role || null, current.id, JSON.stringify({ changes: ticketChanges }), clientIp, userAgent]
        );
      }
    }

    return updated;
  }

  /**
   * Récupère le profil public de la boutique (tenant).
   */
  async getTenantProfile(tenantId: string) {
    const res = await query<{
      name: string; owner_name: string; phone: string; email: string | null;
      address: string | null; city: string | null; country: string | null;
      currency: string; logo_url: string | null; slogan: string | null;
      tax_number: string | null; referral_code: string;
    }>(
      `SELECT name, owner_name, phone, email, address, city, country, currency, logo_url, slogan, tax_number, referral_code
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    return res.rows[0] || null;
  }

  /**
   * Met à jour le profil de la boutique.
   */
  async updateTenantProfile(tenantId: string, data: any, userId: string, clientIp: string, userAgent: string) {
    const allowed = ['name', 'owner_name', 'email', 'address', 'city', 'country', 'currency', 'slogan', 'tax_number'];
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (data[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        values.push(data[field]);
      }
    }

    if (setClauses.length === 0) {
      return this.getTenantProfile(tenantId);
    }

    values.push(tenantId);
    const res = await query(
      `UPDATE tenants SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${idx} RETURNING *`,
      values
    );

    const userRes = await query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'SETTINGS_UPDATE', 'TENANT', $1, $5, $6, $7)`,
      [tenantId, userId, user?.username || null, user?.role || null, JSON.stringify(data), clientIp, userAgent]
    );

    return this.getTenantProfile(tenantId);
  }

  /**
   * Liste les vendeurs d'une boutique.
   */
  async listVendors(tenantId: string) {
    const res = await query<{
      id: string; username: string; display_name: string | null;
      is_active: boolean; last_login_at: Date | null; created_at: Date;
    }>(
      `SELECT id, username, display_name, is_active, last_login_at, created_at
       FROM users WHERE tenant_id = $1 AND role = 'SELLER'
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  /**
   * Active ou désactive un vendeur.
   */
  async toggleVendorStatus(tenantId: string, vendorId: string, isActive: boolean, userId: string, clientIp: string, userAgent: string) {
    const res = await query<{ id: string; username: string }>(
      `UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3 AND role = 'SELLER'
       RETURNING id, username`,
      [isActive, vendorId, tenantId]
    );
    const vendor = res.rows[0];
    if (!vendor) {
      const err = new Error('Vendeur introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }

    const action = isActive ? 'USER_ENABLED' : 'USER_DISABLED';
    const userRes = await query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, 'USER', $6, $7, $8, $9)`,
      [tenantId, userId, user?.username || null, user?.role || null, action, vendorId, JSON.stringify({ vendor_username: vendor.username, is_active: isActive }), clientIp, userAgent]
    );

    return vendor;
  }

  /**
   * Change le mot de passe de l'utilisateur courant (vérifie l'ancien mot de passe).
   */
  async changePassword(tenantId: string, userId: string, oldPassword: string, newPassword: string, clientIp: string, userAgent: string): Promise<void> {
    // 1. Sélectionner l'utilisateur
    const userRes = await query<{ id: string; username: string; password_hash: string; role: string }>(
      'SELECT id, username, password_hash, role FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    const user = userRes.rows[0];
    if (!user) {
      const err = new Error('Utilisateur introuvable.');
      (err as any).statusCode = 404;
      (err as any).code = 'USER_NOT_FOUND';
      throw err;
    }

    // 2. Vérifier l'ancien mot de passe
    const isOldValid = await verifyPassword(oldPassword, user.password_hash);
    if (!isOldValid) {
      const err = new Error('L\'ancien mot de passe est incorrect.');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_PASSWORD';
      throw err;
    }

    // 3. Hacher le nouveau mot de passe
    const newHash = await hashPassword(newPassword);

    // 4. Mettre à jour le mot de passe
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, userId]
    );

    // 5. Journal d'audit PASSWORD_CHANGE
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'PASSWORD_CHANGE', 'USER', $2, $5, $6, $7)`,
      [tenantId, userId, user.username, user.role, JSON.stringify({ username: user.username }), clientIp, userAgent]
    );
  }

  /**
   * Réinitialise le mot de passe d'un vendeur (SELLER) par un ADMIN.
   */
  async resetVendorPassword(tenantId: string, vendorId: string, newPassword: string, adminUserId: string, clientIp: string, userAgent: string): Promise<void> {
    // 1. Sélectionner le vendeur
    const vendorRes = await query<{ id: string; username: string; role: string }>(
      'SELECT id, username, role FROM users WHERE id = $1 AND tenant_id = $2',
      [vendorId, tenantId]
    );
    const vendor = vendorRes.rows[0];
    if (!vendor) {
      const err = new Error('Utilisateur introuvable.');
      (err as any).statusCode = 404;
      (err as any).code = 'USER_NOT_FOUND';
      throw err;
    }
    if (vendor.role !== 'SELLER') {
      const err = new Error('Cette action ne peut être effectuée que sur un compte vendeur.');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    // 2. Hacher le nouveau mot de passe
    const newHash = await hashPassword(newPassword);

    // 3. Mettre à jour le mot de passe
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, vendorId]
    );

    // 4. Récupérer l'ADMIN (pour les métadonnées du log)
    const adminRes = await query<{ username: string; role: string }>(
      'SELECT username, role FROM users WHERE id = $1',
      [adminUserId]
    );
    const admin = adminRes.rows[0];

    // 5. Journal d'audit USER_PASSWORD_RESET
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'USER_PASSWORD_RESET', 'USER', $5, $6, $7, $8)`,
      [
        tenantId,
        adminUserId,
        admin?.username || null,
        admin?.role || null,
        vendorId,
        JSON.stringify({ vendor_username: vendor.username }),
        clientIp,
        userAgent
      ]
    );
  }

  /**
   * Met à jour le display_name d'un vendeur (SELLER).
   */
  async updateVendor(tenantId: string, vendorId: string, displayName: string, adminUserId: string, clientIp: string, userAgent: string): Promise<{ id: string; username: string; display_name: string }> {
    // 1. Sélectionner le vendeur (pour récupérer l'ancien display_name et vérifier le rôle)
    const vendorRes = await query<{ id: string; username: string; display_name: string | null; role: string }>(
      'SELECT id, username, display_name, role FROM users WHERE id = $1 AND tenant_id = $2',
      [vendorId, tenantId]
    );
    const vendor = vendorRes.rows[0];
    if (!vendor) {
      const err = new Error('Vendeur introuvable.');
      (err as any).statusCode = 404;
      (err as any).code = 'USER_NOT_FOUND';
      throw err;
    }
    if (vendor.role !== 'SELLER') {
      const err = new Error('Cette action ne peut être effectuée que sur un compte vendeur.');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const oldDisplayName = vendor.display_name;

    // 2. Mettre à jour le display_name
    const updateRes = await query<{ id: string; username: string; display_name: string | null }>(
      'UPDATE users SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, username, display_name',
      [displayName, vendorId, tenantId]
    );
    const updated = updateRes.rows[0]!;

    // 3. Récupérer l'ADMIN (pour les métadonnées du log)
    const adminRes = await query<{ username: string; role: string }>(
      'SELECT username, role FROM users WHERE id = $1',
      [adminUserId]
    );
    const admin = adminRes.rows[0];

    // 4. Journal d'audit USER_UPDATE
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'USER_UPDATE', 'USER', $5, $6, $7, $8)`,
      [
        tenantId,
        adminUserId,
        admin?.username || null,
        admin?.role || null,
        vendorId,
        JSON.stringify({ old: { display_name: oldDisplayName }, new: { display_name: displayName } }),
        clientIp,
        userAgent
      ]
    );

    return { id: updated.id, username: updated.username, display_name: updated.display_name || '' };
  }
}

export const settingsService = new SettingsService();
