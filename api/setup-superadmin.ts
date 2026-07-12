/**
 * Endpoint temporaire pour initialiser le SuperAdmin sur Vercel.
 * À SUPPRIMER après utilisation.
 */
import { query } from '../backend/src/config/database';
import { hashPassword } from '../backend/src/utils/password';

export default async (req: any, res: any) => {
  // Sécurité : nécessite le SUPERADMIN_PASSWORD en query param
  const url = new URL(req.url || '', 'http://localhost');
  const secret = url.searchParams.get('secret');
  const expectedSecret = process.env.SUPERADMIN_PASSWORD || 'ChangeMe123!';
  if (secret !== expectedSecret) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'FORBIDDEN' }));
    return;
  }

  try {
    const superadminPhone = process.env.SUPERADMIN_PHONE || '+22890000000';
    const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'ChangeMe123!';

    // 1. Supprimer l'ancien SuperAdmin s'il existe (force recreate)
    await query("DELETE FROM users WHERE role = 'SUPERADMIN'");

    const systemTenantId = '00000000-0000-0000-0000-000000000000';

    // 2. Insérer le tenant plateforme
    await query(
      `INSERT INTO tenants (id, name, owner_name, phone, referral_code, is_active)
       VALUES ($1, 'RDGESTION Plateforme', 'SuperAdmin', $2, 'RD-SYSTEM-000', TRUE)
       ON CONFLICT (phone) DO UPDATE SET phone = $2`,
      [systemTenantId, superadminPhone]
    );

    // 3. Hasher le mot de passe
    const passwordHash = await hashPassword(superadminPassword);

    // 4. Insérer l'utilisateur SuperAdmin
    await query(
      `INSERT INTO users (tenant_id, username, password_hash, role, display_name)
       VALUES ($1, $2, $3, 'SUPERADMIN', 'Super Administrateur')`,
      [systemTenantId, superadminPhone, passwordHash]
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      message: 'SuperAdmin created successfully',
      phone: superadminPhone,
    }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: (error as Error).message }));
  }
};
