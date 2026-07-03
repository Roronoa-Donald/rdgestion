import { query, transaction } from '../../config/database';
import { hashPassword, verifyPassword } from '../../utils/password';
import { signToken } from '../../utils/token';
import { generateReferralCode } from '../../utils/referral-code';
import { RegisterInput, LoginInput, CreateVendorInput, AuthResponse, UserRole } from '../../types/models';
import { JwtPayload } from '../../config/jwt';
import { seedCategoriesForTenant } from '../../database/seed/categories';

export class AuthService {
  /**
   * Inscription d'une nouvelle boutique (tenant) et création de l'administrateur.
   */
  async register(input: RegisterInput, clientIp: string, userAgent: string): Promise<AuthResponse> {
    if (input.password !== input.password_confirm) {
      const err = new Error('Les mots de passe ne correspondent pas.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 1. Vérifier si le numéro de téléphone est déjà pris
    const phoneCheck = await query('SELECT id FROM tenants WHERE phone = $1', [input.phone]);
    if (phoneCheck.rows.length > 0) {
      const err = new Error('Ce numéro de téléphone est déjà associé à une boutique.');
      (err as any).statusCode = 409;
      (err as any).code = 'PHONE_ALREADY_EXISTS';
      throw err;
    }

    // Hacher le mot de passe
    const passwordHash = await hashPassword(input.password);
    
    // Générer le code de parrainage pour cette nouvelle boutique
    const myReferralCode = generateReferralCode(input.shop_name);

    const res = await transaction(async (client) => {
      // 2. Créer le Tenant
      const tenantRes = await client.query<{ id: string; name: string }>(
        `INSERT INTO tenants (name, owner_name, phone, referral_code)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name`,
        [input.shop_name, input.owner_name, input.phone, myReferralCode]
      );
      const tenant = tenantRes.rows[0]!;

      // 3. Créer l'abonnement par défaut (FREE)
      await client.query(
        `INSERT INTO subscriptions (tenant_id, tier, status)
         VALUES ($1, 'FREE', 'ACTIVE')`,
        [tenant.id]
      );

      // 4. Créer l'utilisateur Gérant (ADMIN)
      const userRes = await client.query<{ id: string; username: string; role: UserRole }>(
        `INSERT INTO users (tenant_id, username, password_hash, role, display_name)
         VALUES ($1, $2, $3, 'ADMIN', $4)
         RETURNING id, username, role`,
        [tenant.id, input.phone, passwordHash, input.owner_name]
      );
      const user = userRes.rows[0]!;

      // 5. Créer les paramètres par défaut
      await client.query(
        `INSERT INTO settings (tenant_id) VALUES ($1)`,
        [tenant.id]
      );

      // 6. Gérer le parrainage si un code valide a été fourni
      if (input.referral_code) {
        const referrerRes = await client.query<{ id: string }>(
          `SELECT id FROM tenants WHERE referral_code = $1 AND is_active = TRUE`,
          [input.referral_code]
        );
        if (referrerRes.rows.length > 0) {
          const referrerTenantId = referrerRes.rows[0]!.id;
          // Enregistrer la relation de parrainage en PENDING
          await client.query(
            `INSERT INTO referrals (referrer_tenant_id, referred_tenant_id, status)
             VALUES ($1, $2, 'PENDING')`,
            [referrerTenantId, tenant.id]
          );

          // Créer une notification pour le parrain
          await client.query(
            `INSERT INTO notifications (tenant_id, type, title, message)
             VALUES ($1, 'REFERRAL_PENDING', 'Nouveau parrainage', $2)`,
            [referrerTenantId, `La boutique "${tenant.name}" s'est inscrite avec votre code de parrainage.`]
          );
        }
      }

      // 7. Enregistrer les logs d'audit
      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, 'ADMIN', 'TENANT_CREATED', 'TENANT', $1, $4, $5, $6)`,
        [
          tenant.id,
          user.id,
          user.username,
          JSON.stringify({ shop_name: tenant.name, owner_name: input.owner_name, phone: input.phone }),
          clientIp,
          userAgent
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, 'ADMIN', 'USER_CREATED', 'USER', $2, $4, $5, $6)`,
        [
          tenant.id,
          user.id,
          user.username,
          JSON.stringify({ username: user.username, role: user.role }),
          clientIp,
          userAgent
        ]
      );

      // Générer le token JWT
      const jwtPayload: JwtPayload = {
        userId: user.id,
        tenantId: tenant.id,
        role: user.role,
        username: user.username
      };
      const token = signToken(jwtPayload);

      return {
        tenantId: tenant.id,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          tenant_id: tenant.id,
          shop_name: tenant.name
        }
      };
    });

    // Semer les catégories par défaut selon les secteurs choisis à l'inscription
    await seedCategoriesForTenant(res.tenantId, input.sectors || []);

    return {
      token: res.token,
      user: res.user
    };
  }

  /**
   * Connexion d'un utilisateur (ADMIN, SELLER, SUPERADMIN).
   */
  async login(input: LoginInput, clientIp: string, userAgent: string): Promise<AuthResponse> {
    // 1. Rechercher l'utilisateur par son identifiant (username ou phone)
    const userRes = await query<{
      id: string;
      tenant_id: string;
      username: string;
      password_hash: string;
      role: UserRole;
      is_active: boolean;
      display_name: string | null;
    }>(
      `SELECT id, tenant_id, username, password_hash, role, is_active, display_name 
       FROM users WHERE username = $1`,
      [input.identifier]
    );

    const user = userRes.rows[0];

    // Sécurité: Si l'utilisateur n'existe pas, ou si le mot de passe est faux, on renvoie une erreur générique 401
    // (on exécute quand même la vérification pour éviter les attaques temporelles)
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$somefakesalt$somefakehash';
    const isPasswordValid = await verifyPassword(input.password, user ? user.password_hash : dummyHash);

    if (!user || !isPasswordValid) {
      // Logger l'échec de connexion
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'LOGIN_FAILED', $5, $6, $7)`,
        [
          user ? user.tenant_id : null,
          user ? user.id : null,
          input.identifier,
          user ? user.role : null,
          JSON.stringify({ reason: 'Identifiant ou mot de passe incorrect' }),
          clientIp,
          userAgent
        ]
      );

      const err = new Error('Identifiant ou mot de passe incorrect.');
      (err as any).statusCode = 401;
      (err as any).code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // 2. Vérifier si le compte est actif
    if (!user.is_active) {
      const err = new Error('Votre compte a été désactivé. Veuillez contacter votre administrateur.');
      (err as any).statusCode = 403;
      (err as any).code = 'ACCOUNT_DISABLED';
      throw err;
    }

    // 3. Récupérer le nom de la boutique (tenant) associé (sauf pour SUPERADMIN)
    let shopName = 'Plateforme SuperAdmin';
    if (user.role !== 'SUPERADMIN') {
      const tenantRes = await query<{ name: string; is_active: boolean }>(
        'SELECT name, is_active FROM tenants WHERE id = $1',
        [user.tenant_id]
      );
      const tenant = tenantRes.rows[0];
      if (!tenant) {
        const err = new Error('Boutique associée introuvable.');
        (err as any).statusCode = 404;
        throw err;
      }
      if (!tenant.is_active) {
        const err = new Error('Votre boutique a été désactivée. Veuillez contacter le support.');
        (err as any).statusCode = 403;
        (err as any).code = 'TENANT_DISABLED';
        throw err;
      }
      shopName = tenant.name;
    }

    // 4. Mettre à jour les infos de dernière connexion
    await query(
      `UPDATE users 
       SET last_login_at = CURRENT_TIMESTAMP, last_login_ip = $1
       WHERE id = $2`,
      [clientIp, user.id]
    );

    // 5. Logger la réussite de connexion
    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'LOGIN_SUCCESS', '{}', $5, $6)`,
      [user.tenant_id, user.id, user.username, user.role, clientIp, userAgent]
    );

    // 6. Signer le token JWT
    const jwtPayload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      username: user.username
    };
    const token = signToken(jwtPayload);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tenant_id: user.tenant_id,
        shop_name: shopName
      }
    };
  }

  /**
   * Création d'un compte vendeur par le gérant (ADMIN).
   */
  async createVendor(tenantId: string, input: CreateVendorInput, createdByUserId: string, clientIp: string, userAgent: string): Promise<{ id: string; username: string; role: string }> {
    if (input.password !== input.password_confirm) {
      const err = new Error('Les mots de passe ne correspondent pas.');
      (err as any).statusCode = 400;
      throw err;
    }

    // 1. Récupérer et normaliser le nom de la boutique pour composer l'identifiant
    const tenantRes = await query<{ name: string }>('SELECT name FROM tenants WHERE id = $1', [tenantId]);
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      const err = new Error('Boutique introuvable.');
      (err as any).statusCode = 404;
      throw err;
    }

    const shopBase = tenant.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    // Générer un identifiant vendeur unique de type : vendeur.pharmacie-482
    let username = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const randomDigits = Math.floor(Math.random() * 900) + 100;
      username = `vendeur.${shopBase || 'boutique'}-${randomDigits}`;
      
      const checkRes = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (checkRes.rows.length === 0) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      const err = new Error('Impossible de générer un identifiant vendeur unique. Veuillez réessayer.');
      (err as any).statusCode = 500;
      throw err;
    }

    // Hacher le mot de passe
    const passwordHash = await hashPassword(input.password);

    // 2. Insérer le vendeur en BDD
    const res = await query<{ id: string; username: string; role: UserRole }>(
      `INSERT INTO users (tenant_id, username, password_hash, role, display_name)
       VALUES ($1, $2, $3, 'SELLER', $4)
       RETURNING id, username, role`,
      [tenantId, username, passwordHash, `Vendeur ${username.split('-')[1] || ''}`]
    );

    const vendor = res.rows[0]!;

    // 3. Enregistrer dans le journal d'activité de la boutique
    const creatorRes = await query<{ username: string; role: string }>('SELECT username, role FROM users WHERE id = $1', [createdByUserId]);
    const creator = creatorRes.rows[0];

    await query(
      `INSERT INTO audit_logs (tenant_id, user_id, username, user_role, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'USER_CREATED', 'USER', $5, $6, $7, $8)`,
      [
        tenantId,
        createdByUserId,
        creator ? creator.username : null,
        creator ? creator.role : null,
        vendor.id,
        JSON.stringify({ username: vendor.username, role: vendor.role, created_by: createdByUserId }),
        clientIp,
        userAgent
      ]
    );

    return vendor;
  }
}
export const authService = new AuthService();
