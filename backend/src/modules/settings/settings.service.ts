import { query, transaction } from '../../config/database';
import { Settings } from '../../types/models';

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

    // Champs modifiables
    const allowed: (keyof Settings)[] = [
      'global_stock_threshold',
      'max_seller_discount_percentage',
      'ticket_show_logo',
      'ticket_show_slogan',
      'ticket_footer_message',
      'ticket_width',
      'ticket_show_qr',
      'theme'
    ];

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
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'SETTINGS_UPDATE', 'SETTINGS', $5, $6, $7, $8)`,
        [tenantId, userId, user?.username || null, user?.role || null, current.id, JSON.stringify({ changes }), clientIp, userAgent]
      );
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
}

export const settingsService = new SettingsService();
