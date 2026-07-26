# SYNTHÈSE & PRIORITIES DE CORRECTION — RDGESTION

**Date** : 24 juillet 2026  
**Total problèmes identifiés** : ~92 (4 rapports d'audit)

---

## 📊 RÉPARTITION PAR SÉVÉRITÉ

| Sévérité | Backend (01) | Infra/Sécurité (02) | Frontend (03) | Cohérence (04) | **TOTAL** |
|----------|:-----------:|:------------------:|:------------:|:-------------:|:---------:|
| 🔴 CRITIQUE | 5 | 3 | 3 | 1 | **12** |
| 🟠 HAUTE | 8 | 4 | 4 | 8 | **24** |
| 🟡 MOYENNE | 10 | 3 | 5 | 11 | **29** |
| 🟢 FAIBLE | 15 | 3 | 5 | 13 | **36** |
| **TOTAL** | **38** | **13** | **17** | **33** | **~101** |

> Note : certains problèmes sont dupliqués entre rapports (ex: CORS noté dans backend ET infra). Le compte unique est d'environ 92.

---

## 🔴 PROBLÈMES CRITIQUES — Correction immédiate

### 1. `is_resolved`/`resolved_at` — colonnes inexistantes en DB
- **Rapport** : 01 (C1) + 04 (4.3)
- **Fichiers** : `stock.service.ts` lignes 229-237, `sales.service.ts` lignes 515-525
- **Impact** : Toute opération qui remonte le stock au-dessus du seuil → ROLLBACK → `cancelSale` cassée
- **Fix** : Migration `019_alter_notifications_add_resolved.sql` (`ALTER TABLE notifications ADD COLUMN is_resolved BOOLEAN DEFAULT FALSE, ADD COLUMN resolved_at TIMESTAMPTZ`)

### 2. `ON CONFLICT DO NOTHING` sur `notifications` sans contrainte unique
- **Rapport** : 01 (C2)
- **Fichiers** : `products.service.ts` ligne 442, `stock.service.ts` ligne 218, `sales.service.ts` ligne 341
- **Impact** : Doublons massifs de notifications `STOCK_LOW`/`STOCK_OUT`
- **Fix** : Ajouter un index unique fonctionnel sur `(tenant_id, type, data->>'product_id')` pour alertes de stock

### 3. Migration 017 — trigger `payments.updated_at` jamais créé
- **Rapport** : 02 (C-1)
- **Fichier** : `017_create_payments.sql` ligne 32
- **Impact** : `updated_at` de la table `payments` jamais mis à jour automatiquement
- **Fix** : Remplacer `'update_updated_at_column'` par `'update_updated_at'`

### 4. `CRON_SECRET` vide en production → route cron ouverte
- **Rapport** : 02 (C-2)
- **Fichier** : `admin.routes.ts` lignes 102-115
- **Impact** : Si `CRON_SECRET` n'est pas configuré, la route `/api/admin/cron/expire-subscriptions` est ouverte à tous
- **Fix** : Ajouter dans `env.ts` : `if (NODE_ENV === 'production' && CRON_SECRET.length < 16) throw`. Comparer en constant-time.

### 5. `/api/payments/verify` — détournement de paiement possible
- **Rapport** : 01 (M6) + 04 (A.2)
- **Fichiers** : `payments.routes.ts` lignes 174-254, `fedaPayPayment.service.ts` lignes 153-177
- **Impact** : Un admin peut activer son PRO avec une transaction payée par un autre tenant
- **Fix** : Vérifier `metadata.tenant_id === request.currentUser!.tenantId` avant `activatePro` + ajouter `checkTenantActive`

### 6. Shape de réponse API incohérente
- **Rapport** : 03 (C2) + 04 (1.1)
- **Fichiers** : `products.controller.ts`, `sales.controller.ts`, `categories.controller.ts`, `logs.controller.ts`
- **Impact** : Frontend fait des suppositions multi-shape → risque de régression silencieuse
- **Fix** : Standardiser tous les controllers sur `{ success: true, data: {...} }`

### 7. Export CSV — noms de champs inexistant
- **Rapport** : 03 (C3)
- **Fichier** : `api.js` lignes 447, 449
- **Impact** : Export CSV inutilisable (colonnes Numéro et Vendeur vides)
- **Fix** : `sale_number` → `transaction_number`, `seller_username` → `seller_name`

### 8. `productBodySchema` sans `additionalProperties: false`
- **Rapport** : 01 (C3)
- **Fichier** : `products.schema.ts` lignes 38-53
- **Impact** : Mass assignment potentiel
- **Fix** : Ajouter `additionalProperties: false`

### 9. `FCFA` codé en dur
- **Rapport** : 03 (C1)
- **Fichiers** : 8+ fichiers frontend
- **Impact** : Violation convention AGENTS.md + bug multi-tenant si devise différente
- **Fix** : Créer `formatMoney(amount, currency)` + remplacer

### 10. `process.exit(1)` sur erreur de pool → crash serverless
- **Rapport** : 02 (C-3)
- **Fichier** : `database.ts` ligne 25
- **Impact** : Crash des instances Vercel sur EPIPE/ECONNRESET transitoire Aiven
- **Fix** : `if (!process.env.VERCEL) process.exit(1);`

### 11. `createSale` — vente fantôme (items vides ou quantité 0)
- **Rapport** : 04 (A.5, A.10)
- **Fichier** : `sales.service.ts` + `sales.schema.ts`
- **Impact** : Vente de 0 FCFA avec 0 article créée en base
- **Fix** : Ajouter `minItems: 1` (déjà), `maxItems: 500`, et `minimum: 1` sur `items[].quantity`

### 12. `PUT /api/settings/profile` sans schema Ajv
- **Rapport** : 01 (H5)
- **Fichier** : `settings.routes.ts` ligne 20
- **Impact** : Mass assignment + log de `data` brut en clair
- **Fix** : Définir un `updateProfileSchema` avec `additionalProperties: false`

---

## 🟠 PROBLÈMES HAUTES — Correction court terme

| # | Problème | Fichier | Fix |
|---|----------|---------|-----|
| H1 | `JSON.stringify(data)` en audit logs → fuite password | `settings.service.ts` ligne 173 | Logger le diff whitelisté uniquement |
| H2 | Race condition sur `transaction_number` | `sales.service.ts` lignes 198-206 | Utiliser une `SEQUENCE` PostgreSQL |
| H3 | `/verify` sans rate limit | `payments.routes.ts` | `config: { rateLimit: { max: 20, timeWindow: '1 minute' } }` |
| H4 | `checkout_url` FedaPay non validé HTTPS | `fedaPayPayment.service.ts` lignes 88-98 | Vérifier `startsWith('https://')` |
| H5 | SELLER ne peut pas changer son mot de passe | `settings.routes.ts` lignes 45-48 | Autoriser `['ADMIN', 'SELLER']` |
| H6 | CORS `origin: '*'` + `credentials: true` en dev | `cors.ts` lignes 9-12 | Utiliser `origin: true` ou liste explicite |
| H7 | Helmet `CSP: false` | `app.ts` lignes 120-122 | Configurer CSP + HSTS |
| H8 | Webhook FedaPay sans rate limit ni body limit | `payments.routes.ts` lignes 85-167 | `rateLimit: { max: 30, timeWindow: '1 minute' }` |
| H9 | `onboarding_step` jamais persisté en BDD | `onboarding.js` ligne 160 | Persister dans `_advance()` |
| H10 | XSS sur `innerHTML` (notifications, `transaction_number`) | `app.js`, `pos.js` | `escapeHtml()` partout |
| H11 | `.env.example` JWT_SECRET placeholder passe validation | `.env.example` ligne 14 | Blacklister `'votre_secret'` dans `env.ts` |
| H12 | `auditDecorator` manquant sur exports & payments | 5 modules | Étendre `addHook('preHandler', auditDecorator)` |
| H13 | Tests E2E sur production | `e2e/rdgestion-audit.spec.js` ligne 6 | Utiliser staging |
| H14 | Cron d'expiration jamais appelé en prod Vercel | `subscriptionScheduler.ts` | Configurer un cron externe (Vercel Cron) |
| H15 | SELLER peut annuler ventes d'autres SELLER | `sales.service.ts` lignes 407-557 | Restreindre à `seller_id === currentUser.userId` |
| H16 | `sale_items` sans colonne `tenant_id` | migration 007 | Ajouter `tenant_id` ou garantir via JOIN |
| H17 | Vérif abonnement ne check pas `end_date` | `sales.service.ts` lignes 32-45 | Ajouter `AND (end_date IS NULL OR end_date > NOW())` |
| H18 | Gate PRO sur exports non vérifié | `exports.routes.ts` | Ajouter check `tier === 'PRO'` |

---

## 🟡 PROBLÈMES MOYENS — Correction moyen terme

| # | Problème | Fix |
|---|----------|-----|
| M1 | `start_date = new Date()` vs `CURRENT_TIMESTAMP` | Utiliser `DEFAULT CURRENT_TIMESTAMP` |
| M2 | `discount_value` > subtotal → incohérence sale_items vs total | Répartir remise sur les lignes |
| M3 | `AdminService` pas de defense-in-depth (assert role) | Assert `callerRole === 'SUPERADMIN'` dans le service |
| M4 | `toggleTenantStatus` log `USER_ENABLED` au lieu de `TENANT_ENABLED` | Ajouter au type `AuditAction` |
| M5 | `amount` FedaPay float non validé | `amount: { type: 'integer', minimum: 1 }` |
| M6 | `getStartOfToday` utilise `Z` (UTC) au lieu de locale | Corriger ou supprimer si inutilisée |
| M7 | `updateProduct` modifie `stock_quantity` sans tracer mouvement | Interdire ou tracer automatiquement |
| M8 | `format: 'date'` manquant sur exports | Ajouter `format: 'date'` sur `from`/`to` |
| M9 | `DATE(created_at)` seq scan dans exports | Utiliser range `>= ... AND < ... + INTERVAL` |
| M10 | Referral récompense perdue si parrain FREE | Créer abonnement PRO pour parrain FREE |
| M11 | `referral_code` sans UNIQUE en DB | `ALTER TABLE tenants ADD UNIQUE (referral_code)` |
| M12 | `onboarding_completed` default TRUE pour anciens tenants | Cohérent, documenter |
| M13 | `pending_rewards` calcul incohérent | Clarifier `floor(pendingCount / 2)` |
| M14 | Validation UUID manquante sur params `/admin/*` et `/settings/vendors/*` | Ajouter `format: 'uuid'` |
| M15 | `currency`/`billing_type` sans CHECK sur `payments` | Ajouter `CHECK (billing_type IN ('MONTHLY', 'LIFETIME'))` |
| M16 | `_escapeHtml` regex `"` incorrecte dans onboarding.js | Corriger `.replace(/"/g, '"')` |
| M17 | Clés `rdg_setup_*` localStorage non nettoyées | `removeItem()` dans `finish()` |

---

## 🟢 POINTS FORTS — Ce qui est bien fait

- ✅ **Argon2id** avec paramètres OWASP (64Mo, 3 itérations, 16-byte salt, 32-byte hash)
- ✅ **JWT HS256** avec `algorithms` forcé lors de la vérification (pas de confusion algorithme)
- ✅ **Isolation multi-tenant** — `tenant_id` injecté depuis le JWT, jamais depuis le body
- ✅ **Toutes les requêtes SQL utilisent des paramètres bindés** ($1, $2, …) — aucun pattern d'injection
- ✅ **`ORDER BY` whitelisté** dans `products.service.ts`
- ✅ **Raw body capturé** pour vérification de signature HMAC FedaPay
- ✅ **Migration runner** transactionnel et idempotent
- ✅ **Referral code** — vérification d'unicité en base + retry 10 fois
- ✅ **60+ tests Vitest** passent (2.7s)
- ✅ **`error.stack` masqué en production**
- ✅ **Bootstrap SuperAdmin** skip sur Vercel

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Sprint 1 — Immédiat (CRITIQUES)
1. Migration `019` : colonnes `is_resolved` + `resolved_at` sur `notifications` + index unique
2. Corriger migration 017 (1 caractère à changer)
3. `env.ts` : valider `CRON_SECRET` non vide en prod + blacklister placeholder JWT_SECRET
4. `database.ts` : `if (!process.env.VERCEL) process.exit(1);`
5. `payments.routes.ts` : vérifier `metadata.tenant_id` + `checkTenantActive` + rate limit sur `/verify`
6. `products.schema.ts` : `additionalProperties: false`
7. `sales.schema.ts` : `maxItems: 500`, `minimum: 1` sur `items[].quantity`
8. `api.js` : corriger `sale_number` → `transaction_number`, `seller_username` → `seller_name`
9. Créer `formatMoney()` + remplacer `'FCFA'` en dur

### Sprint 2 — Court terme (HAUTES)
10. Standardiser tous les controllers sur `{ success: true, data: {...} }`
11. `settings.routes.ts` : schema Ajv sur `PUT /profile` + autoriser SELLER sur `PUT /password`
12. `onboarding.js` : persister `onboarding_step` + corriger `_escapeHtml` + nettoyer clés
13. XSS : `escapeHtml()` sur `app.js` (notifications) et `pos.js` (transaction_number)
14. `auditDecorator` sur exports + payments + logs + notifications + dashboard
15. Configurer Vercel Cron pour expiration des abonnements
16. Vérif `end_date` dans le gate d'abonnement à la vente
17. Gate PRO sur exports

### Sprint 3 — Moyen terme (MOYENNES)
18. `SEQUENCE` PostgreSQL pour `transaction_number`
19. Validation UUID sur tous les params d'ID
20. Helmet config complète (CSP + HSTS)
21. HTTP headers de sécurité dans `vercel.json`
22. Tests E2E sur staging (pas production)
23. Tests manquants : `logs.service`, `payments.routes`, middlewares
24. Répartition de remise sur `sale_items`
25. Logique parrainage FREE → créer abonnement PRO
