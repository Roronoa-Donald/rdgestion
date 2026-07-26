Audit terminé. Tests (63/63 passent) et typecheck OK. Voici le rapport exhaustif.

---

# RAPPORT D'AUDIT — Infrastructure & Sécurité RDGESTION

**Date** : 24 juillet 2026 · **Cible** : `C:\Users\LENOVO LOQ\rdgestion\rdgestion` · **Stack** : Fastify 4.28 + TypeScript + PostgreSQL (Aiven) + Vercel serverless
**État global** : Typecheck ✅ · Tests 63/63 ✅ · mais **9 problèmes de sécurité/config significatifs**

---

## 🔴 PROBLÈMES CRITIQUES

### C-1 · Migration 017 — Trigger `payments` JAMAIS créé (nom de fonction incorrect)
- **Fichier** : `backend/src/database/migrations/017_create_payments.sql`, lignes 29-38
- **Description** : La migration cherche `update_updated_at_column()` (avec le suffixe `_column`) via `pg_proc`, mais la migration 013 a créé la fonction `update_updated_at()` (sans suffixe). La condition `IF EXISTS` est donc toujours **fausse** → **le trigger `trg_payments_updated_at` n'est jamais créé**. La colonne `updated_at` de la table `payments` n'est jamais mise à jour automatiquement comme pour les autres tables.
- **Sévérité** : **CRITIQUE**
- **Recommandation** : Corriger la ligne 32 — remplacer `'update_updated_at_column'` par `'update_updated_at'`.

### C-2 · CRON_SECRET vide autorisé en production (route admin non protégée)
- **Fichier** : `backend/src/modules/admin/admin.routes.ts`, lignes 102-115
- **Description** : La route `POST /api/admin/cron/expire-subscriptions` n'utilise pas le middleware `authenticate`. L'authentification repose sur un header `x-cron-secret` comparé à `env.CRON_SECRET`. Si `CRON_SECRET` est vide (par défaut : `getEnvString('CRON_SECRET', '')` → `''`), le code n'agit qu'en dev (lignes 107-108). **Mais en production, si `CRON_SECRET` n'est pas configuré, `expected` vaut `''` et `provided` peut valoir `''`** — la comparaison `provided !== expected` devient `'' !== ''` → `false` → la route est **ouverte à quiconque**. De plus, il n'y a **pas de rate-limit** sur cette endpoint et pas de validation que `CRON_SECRET` est non-vide en production au boot.
- **Sévérité** : **CRITIQUE**
- **Recommandation** :
  1. Ajouter dans `env.ts` : si `NODE_ENV === 'production'` et `CRON_SECRET.length < 16` → `throw`.
  2. Ajouter un `rateLimit` spécifique sur cette route (ex. 5/minute).
  3. Comparer en constant-time : `crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))` pour éviter les attaques timing.

### C-3 · `process.exit(1)` sur erreur de pool PostgreSQL — crash en serverless
- **Fichier** : `backend/src/config/database.ts`, ligne 25
- **Description** : `pool.on('error', () => process.exit(1))` est dangereux en environnement Vercel serverless. Un `EPIPE` ou `ECONNRESET` transitoire d'Aiven (fréquent sur des connexions idle longues) provoque un **crash immédiat** de l'instance Lambda, sans tentative de reconnexion. Ce n'est pas un erreur "inattendue" pour Aiven — c'est attendu pour une connexion cloud idle.
- **Sévérité** : **HAUTE** (j'élargis à CRITIQUE pour Vercel)
- **Recommandation** : En serverless, logger l'erreur et laisser l'instance se terminer naturellement. En local/Docker, `process.exit(1)` est acceptable (restarted par le système). Ajouter : `if (!process.env.VERCEL) process.exit(1);` comme ailleurs dans le codebase.

---

## 🟠 PROBLÈMES HAUTS

### H-1 · CORS `credentials: true` + `origin: '*'` en développement
- **Fichier** : `backend/src/plugins/cors.ts`, lignes 10-14
- **Description** : En `NODE_ENV === 'development'`, `origin: '*'` est combiné avec `credentials: true`. Les navigateurs modernes **refusent** `credentials: true` avec `*` (le `Access-Control-Allow-Origin` doit être une origine explicite). Ce n'est pas une faille en production mais **en dev avec un frontend sur un autre port** (8080 vs 3000), les cookies cross-origin échouent silencieusement. En production, `origin: env.CORS_ORIGIN` est un singleton (une seule origine) — si plusieurs domaines sont nécessaires, il faut un tableau.
- **Sévérité** : **HAUTE** (dev) / **MOYENNE** (prod)
- **Recommandation** : En dev, utiliser `origin: ['http://localhost:3000', 'http://localhost:8080']` (tableau explicite). En prod, parser `CORS_ORIGIN` en tableau (`split(',')`) pour supporter plusieurs domaines.

### H-2 · Helmet `contentSecurityPolicy: false` — pas de CSP sur l'API
- **Fichier** : `backend/src/app.ts`, ligne 120-122
- **Description** : `contentSecurityPolicy: false` est documenté comme "déleguer au meta tag dans index.html". Mais l'API elle-même n'a **aucun header CSP**, ni `X-Frame-Options`, ni `Strict-Transport-Security` explicitement configuré. Helmet met des valeurs par défaut, mais la désactivation de CSP est large. De plus, pas de `hsts` visible et le fichier `vercel.json` ne définit pas de headers de sécurité.
- **Sévérité** : **HAUTE**
- **Recommandation** :
  1. Configurer Helmet avec `contentSecurityPolicy: { directives: { default-src: ["'self'"], script-src: ["'self'"], ... } }` adapté au PWA frontend.
  2. Ajouter `strictTransportSecurity: { maxAge: 31536000, includeSubdomains: true }`.
  3. Compléter `vercel.json` avec un bloc `"headers": [...]` pour `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`.

### H-3 · Webhook FedaPay sans rate-limit explicite
- **Fichier** : `backend/src/modules/payments/payments.routes.ts`, lignes 85-167
- **Description** : La route `POST /api/payments/webhook/fedapay` est **publique** (pas d'`authenticate`) et n'a pas de propre config de rate-limit ni de `schema` Ajv (le body n'est pas validé avant la vérification de signature). Un attaquant peut spammer cette route avec des payloads arbitraires → la vérification de signature HMAC échouera, mais elle consomme du CPU. Le rate-limit global (100 req/min) s'applique, mais c'est la réponse au rawBody parser → le `JSON.parse` est fait avant tout contrôle. Un body massif (`application/json` sans `bodyLimit` explicite dans le content-type parser) pourrait être utilisé pour DoS.
- **Sévérité** : **HAUTE**
- **Recommandation** :
  1. Ajouter `config: { rateLimit: { max: 30, timeWindow: '1 minute' } }` sur la route webhook.
  2. Limiter la taille du body dans le content-type parser (le global `fastifyMultipart` ne couvre pas `application/json`).
  3. Le `JSON.parse(body)` (ligne 33) doit capturer l'erreur et rejeter avec un 400, pas laisser les erreurs `SyntaxError` remonter.

### H-4 · Endpoint `/health` sans rate-limit → exploitation pour reconnaissance
- **Fichier** : `backend/src/app.ts`, lignes 169-171
- **Description** : La route `GET /health` est publique et retourne `{ status, timestamp }`. Le rate-limit global (100/min par IP) s'applique, mais cette route révèle que le serveur est vivant et l'heure UTC du serveur (leak d'info pour le fingerprinting). Pas de problème réel, mais en serverless cette route **ne vérifie pas la connexion DB** → elle peut renvoyer `healthy` alors que la DB est down.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Soit nommer `/healthz` (convention kubeless) sans DB, soit ajouter une *vérif DB légère* (`SELECT 1`) et renvoyer `{ db: "ok" | "down" }`.

---

## 🟡 PROBLÈMES MOYENS

### M-1 · Pas de validation UUID sur les paramètres `/api/admin/*` et `/api/settings/vendors/:id`
- **Fichiers** :
  - `backend/src/modules/admin/admin.routes.ts` lignes 22-27 (`tenantId`), lignes 67-69 (`id`), ligne 91-94 (`id`)
  - `backend/src/modules/settings/settings.routes.ts` lignes 24-27 (`id`)
- **Description** : Les schémas Ajv acceptent `{ type: 'string' }` sans contrainte `format: 'uuid'`. PostgreSQL lèvera une `invalid input syntax for type uuid: ...` qui remonte comme erreur 500 (non gérée par le setErrorHandler → erreur générique `SERVER_ERROR`). Un attaquant peut envoyer du SQL injectable dans le param, mais paramétré `$1` → safe côté injection, mais le plantage est une **fuite d'info** (le message d'erreur PostgreSQL dans la réponse en dev).
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ajouter `format: 'uuid'` (ou `{ type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' }`) sur tous les params d'ID. Plugins Ajv `ajv-formats` requis.

### M-2 · `.env.example` contient `JWT_SECRET=votre_secret_jwt_ultra_securise_ici` (30 caractères seulement)
- **Fichier** : `.env.example`, ligne 14
- **Description** : La valeur par défaut a 33 caractères et passe la validation `length < 32`, mais le pattern de validation dans `env.ts` (lignes 81) vérifie `secret.includes('change_moi') || secret.includes('change_me')` — **pas `votre_secret_jwt`**. Un développeur qui copie `.env.example` tel quel en production n'aura **aucun warning**, alors que le secret est trivialement devinable (publié dans le repo). 🚨
- **Sévérité** : **HAUTE** (si déployé tel quel)
- **Recommandation** :
  1. Ajouter `'votre_secret'` et `'ultra_securise'` aux patterns blacklistés dans `env.ts`.
  2. Renseigner `JWT_SECRET=` (vide) dans `.env.example` avec un commentaire explicite "⚠️ Remplacer par une clé de 64+ caractères en production".
  3. Exiger `length >= 64` en production (recommandation OWASP 2024).

### M-3 · 5 modules sans `auditDecorator` — traçabilité incomplète
- **Fichiers** :
  - `dashboard.routes.ts` (lecture de stats)
  - `exports.routes.ts` (export PDF/XLSX **sensible** !)
  - `logs.routes.ts` (lecture d'audit logs, paradoxalement non audité)
  - `notifications.routes.ts` (lecture/ack)
  - `payments.routes.ts` (create-intent, verify — **crucial pour la conformité PCI**)
- **Description** : `auditDecorator` n'est attaché que sur auth, sales, settings, admin. Les exports financiers et la vérification de paiement **ne sont pas tracés** dans `audit_logs`, ce qui est une lacune majeure pour le rapprochement comptable et la conformité.
- **Sévérité** : **HAUTE** pour `exports.routes.ts` et `payments.routes.ts` / **MOYENNE** pour les 3 autres
- **Recommandation** : Étendre `fastify.addHook('preHandler', auditDecorator)` aux 5 modules.

### M-4 · Fuite partielle de clé API FedaPay dans les logs
- **Fichier** : `backend/src/modules/payments/strategies/fedaPayPayment.service.ts`, ligne 32
- **Description** : `console.log('💳 FedaPay configuré :', ..., '(clé:', apiKey.substring(0, 8) + '...)')`. Les 8 premiers caractères de la clé secrète sont loggés. En serverless, ces logs vont vers Vercel Observability / Datadog → **fuite**. La clé secrète FedaPay doit être traitée comme un secret absolu.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ne logger que `env.FEDAPAY_ENVIRONMENT` et un booléen `configured: true`. Supprimer `apiKey.substring(0, 8)`.

### M-5 · `payments` table : `currency` non contraint + `billing_type` sans CHECK
- **Fichier** : `backend/src/database/migrations/017_create_payments.sql`, lignes 11-14
- **Description** :
  - `currency VARCHAR(10) NOT NULL DEFAULT 'XOF'` — pas de CHECK sur les devises acceptées (`XOF`, `XAF`, etc.). Un attaquant qui insère via un webhook falsifié peut insérer n'importe quoi.
  - `billing_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'` — pas de `CHECK (billing_type IN ('MONTHLY', 'LIFETIME'))`. Incohérent avec la table `subscriptions` (migration 002) qui utilise `CHECK (billing_type IN ('MONTHLY', 'LIFETIME', NULL))`.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ajouter `CHECK (currency IN ('XOF', 'XAF', 'EUR', 'USD'))` et `CHECK (billing_type IN ('MONTHLY', 'LIFETIME'))`.

### M-6 · `subscriptions.billing_type CHECK (billing_type IN ('MONTHLY', 'LIFETIME', NULL))` — syntaxe invalide
- **Fichier** : `backend/src/database/migrations/002_create_subscriptions.sql`, ligne 5
- **Description** : `billing_type VARCHAR(15) CHECK (billing_type IN ('MONTHLY', 'LIFETIME', NULL))`. La colonne est nullable (pas de `NOT NULL`) mais la contrainte `CHECK` inclut `NULL` dans la liste. **En PostgreSQL, `NULL IN (...)` retourne `NULL` (pas TRUE)**, donc la contrainte est déjà satisfaite pour NULL → ça marche, **mais la syntaxe est non idiomatique et trompeuse**. La bonne formulation : `CHECK (billing_type IS NULL OR billing_type IN ('MONTHLY', 'LIFETIME'))`.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Réécrire pour clarté. Pas urgent car ça fonctionne.

### M-7 · `mercredi_settings` trigger non créé — `settings.updated_at` non géré sur INSERT via trigger
- **Fichier** : `backend/src/database/migrations/013_create_triggers.sql`
- **Description** : Le trigger `trg_settings_updated_at` n'est créé que `BEFORE UPDATE`. Pour les INSERT (depuis `auth.service.ts:62`), `updated_at` dépend du `DEFAULT CURRENT_TIMESTAMP`. C'est OK. **Mais** migration 018 ajoute `onboarding_completed` et `onboarding_step` — toute UPDATE déclenche le trigger qui réécrit `updated_at`. Cohérent. ✅ Pas de problème, mention pour auditabilité.

---

## 🟢 POINTS POSITIFS (conformité et bonnes pratiques)

### Sécurité — ce qui est bien fait ✅

1. **`JWT_SECRET ≥ 32 octets en production** — validation au boot (`env.ts:81-88`) refuse le démarrage. ✅
2. **`rejectUnauthorized: false`** documenté et alerté en production (`database.ts:16-18`). ✅
3. **Argon2id** avec paramètres OWASP (`password.ts:4-11` — 64Mo, 3 itérations, 4 threads, 16-byte salt, 32-byte hash). ✅ Excellent.
4. **JWT** — `algorithms: ['HS256']` forcé lors de la vérification (`token.ts:22-23`) → pas de vuln de confusion algorithme. ✅
5. **Toutes les requêtes SQL utilisent des paramètres** ($1, $2, …) — aucun pattern d'injection détecté. ✅
6. **`ORDER BY` whitelisté** dans `products.service.ts:50-51` (`allowedSortFields`). ✅ Très bien.
7. **Toutes les routes métier protégées** par `[authenticate, authorize, checkTenantActive]`. ✅
8. **Isolation multi-tenant** — `tenant_id` injecté depuis le JWT, jamais depuis le body. ✅
9. **Idempotence webhook** via `event_id` unique + `ON CONFLICT DO NOTHING`. ✅
10. **Raw body capturé** pour vérification de signature HMAC (`payments.routes.ts:26-37`). ✅
11. **Rate-limit global** + auth sur routes sensibles. ✅
12. **Bootstrap SuperAdmin** skip sur Vercel ✅ (évite un cold-start lent).
13. **`error.stack` masqué en production** pour erreurs 500 (`app.ts:238-240`). ✅
14. **Referral code** — vérification d'unicité en base + retry 10 fois (`referral-code.ts:21-29`). ✅
15. **Migration runner** — transactionnelle, idempotente via table `migrations` (`migrate.ts:51-87`). ✅

### Scheduler serverless ✅
- `subscriptionScheduler.ts:33-36` — `setInterval`/`setTimeout` correctement skippés sur Vercel. ✅
- Endpoint cron HTTP dédié `/api/admin/cron/expire-subscriptions`. ✅ (mais voir C-2)

### Vitest ✅
- 10 fichiers, 63 tests, **tous passent en 2.7s**. Couverture ciblée sur les services. ✅
- Mocks systématiques de `database.query/transaction`, `password.utils`, `token.utils`. ✅

---

## 📋 RÉSUMÉ DES PROBLÈMES PAR SÉVÉRITÉ

| # | Sévérité | Fichier | Ligne | Problème |
|---|----------|---------|-------|----------|
| C-1 | **CRITIQUE** | `017_create_payments.sql` | 32 | Trigger `payments.updated_at` jamais créé — nom de fonction incorrect |
| C-2 | **CRITIQUE** | `admin.routes.ts` | 102-115 | Endpoint cron sans protection si `CRON_SECRET` vide en prod |
| C-3 | **HAUTE** | `database.ts` | 25 | `process.exit(1)` sur erreur de pool → crash serverless |
| H-1 | **HAUTE** | `cors.ts` | 10-14 | `credentials: true` + `origin: '*'` en dev — browsers rejettent |
| H-2 | **HAUTE** | `app.ts` | 120-122 | Helmet `CSP: false` — pas de headers de sécurité |
| H-3 | **HAUTE** | `payments.routes.ts` | 85 | Webhook public sans rate-limit ni validation de taille de body |
| H-4 | **MOYENNE** | `app.ts` | 169-171 | `/health` ne vérifie pas la DB → faux healthy |
| M-1 | **MOYENNE** | `admin.routes.ts`, `settings.routes.ts` | — | Pas de validation `format: 'uuid'` sur les params d'ID |
| M-2 | **HAUTE** | `.env.example` | 14 | `JWT_SECRET` placeholder passe la validation |
| M-3 | **HAUTE** | 5 routes | — | `auditDecorator` manquant — exports & payments non tracés |
| M-4 | **MOYENNE** | `fedaPayPayment.service.ts` | 32 | 8 premiers chars de la clé API loggés |
| M-5 | **MOYENNE** | `017_create_payments.sql` | 11-14 | `currency` / `billing_type` sans CHECK |
| M-6 | **FAIBLE** | `002_create_subscriptions.sql` | 5 | `CHECK (... NULL)` non idiomatique |

---

## 🧪 COUVERTURE DE TESTS — LACUNES

| Module | Tests | Statut |
|--------|-------|--------|
| `auth.service` | 224 lignes | ✅ |
| `products.service` + `stock.service` | 133+113 | ✅ |
| `sales.service` | 198 | ✅ |
| `admin.service` | 141 | ✅ |
| `categories.service` | 109 | ✅ |
| `dashboard.service` | 72 | ✅ |
| `exports.service` | 93 | ✅ |
| `notifications.service` | 57 | ✅ |
| `settings.service` | 123 | ✅ |
| **`logs.service`** | **0** | ❌ **manquant** |
| **`payments.routes`/payment.service** | **0** | ❌ **manquant** — critique pour la conformité |
| **Middlewares** (auth, rbac, tenant, audit) | **0** | ❌ **manquants** |
| **`scheduler`** | **0** | ❌ **manquant** |
| **`env.ts` validation** | **0** | ❌ **manquante** |
| **`migrate.ts`** | **0** | ❌ **manquant** |

---

## 🎯 RECOMMANDATIONS PRIORISÉES

1. **Immédiat (CRITIQUE)** : Corriger C-1 (un caractère à changer), forcer `CRON_SECRET` non vide en prod (C-2), retirer `process.exit(1)` en serverless (C-3).
2. **Court terme ( semaine)** : Helmet config complète (H-2), rate-limit webhook + limite body (H-3), ajout `auditDecorator` sur exports/payments (M-3), validation UUID (M-1).
3. **Tests** : Écrire des tests pour `logs.service`, `payments.routes` (mock FedaPay), middlewares `authenticate`/`authorize`/`checkTenantActive`, et `env.ts` (vérifier que la validation rejette les secrets faibles).
4. **Documentation** : Mettre à jour `AGENTS.md` qui mentionne "15 migrations" alors qu'il y en a **18**.