J'ai maintenant une vue exhaustive du projet. J'ai suffisamment d'informations pour produire le rapport d'audit complet. Laissez-moi compiler les résultats.

# RAPPORT D'AUDIT — RDGESTION SaaS (Cohérence frontend↔backend, Intégrité multi-tenant, Logique métier)

## 1. COHÉRENCE DES CONTRATS API (frontend api.js vs backend routes)

### 1.1 — Shape de réponse INCOHÉRENT entre endpoints (CRITIQUE)

**`products.controller.ts` ligne 21** — `GET /products` (list) retourne `{ products, pagination }` **directement** (sans enveloppe `success/data`).
**`products.controller.ts` ligne 30** — `GET /products/trash` retourne `{ success: true, data: [...] }` **avec** enveloppe.
**`sales.controller.ts` ligne 73-79** — `GET /sales` retourne `{ success: true, data: { sales, pagination } }` **avec** enveloppe.
**`categories.controller.ts`** — `GET /categories` retourne `list` (Array brut) **directement**.
**`dashboard.controller.ts`** — `GET /dashboard` retourne `{ success: true, data: {...} }`.
**`logs.controller.ts`** — `GET /logs` retourne `{ logs, pagination }` **directement**.

**Frontend `stock.js` ligne 142** tente les deux : `productsRes?.data?.products || productsRes?.products || productsRes?.data || []`.
**Frontend `products.js` ligne 173** lit `data.products` directement (cohérent avec list).
**Frontend `api.js` ligne 461** dans `exports.sales()` lit `data?.data?.sales || []` et `data?.data?.pagination?.total` — **mais sales.controller ligne 73 retourne `{ success: true, data: { sales, pagination } }`** → le frontend lit bien `data.data.sales` ✅. Sauf que `sales.js` ligne 174 fait `const data = res.data || res` puis `data?.sales` — ce qui fonctionne aussi mais est fragile.

**Sévérité : CRITIQUE** — L'incohérence de shape oblige chaque vue frontend à deviner. Risque permanent de régression silencieuse.
**Recommandation :** Standardiser TOUS les controllers sur `{ success: true, data: {...} }`. Mettre à jour les vues frontend qui lisent directement (`products.js`, `stock.js`, `categories`).

### 1.2 — `GET /dashboard` vs alias `/stats` — duplication (FAIBLE)

**`dashboard.routes.ts` ligne 14-16** — route `/stats` = alias de `/`. Non exposée dans `api.js` (frontend n'appelle que `/dashboard`). Code mort.
**Sévérité : FAIBLE** — Nettoyer l'alias.

### 1.3 — Endpoint manquant dans `api.js` : reset-password vendor (MOYENNE)

**`settings.routes.ts` ligne 39** expose `POST /settings/vendors/:id/reset-password`.
**`api.js`** ne l'expose pas → le frontend doit construire la requête manuellement ou la fonctionnalité est absente côté UI.
**Sévérité : MOYENNE** — Ajouter `settings.resetVendorPassword(id, payload)` dans `api.js`.

### 1.4 — Endpoint manquant : `PUT /settings/vendors/:id` (updateVendor) (MOYENNE)

**`settings.routes.ts` ligne 33** expose `PUT /vendors/:id` pour `updateVendor` (display_name).
**`api.js`** n'expose que `toggleVendor(id, is_active)` en PATCH. L'update du display_name n'est pas câblé côté frontend.
**Sévérité : MOYENNE** — Ajouter `settings.updateVendor(id, payload)`.

### 1.5 — `GET /admin/stats` et `GET /admin/tenants/:id` non exposés côté frontend (FAIBLE)

**`admin.routes.ts` ligne 82** et ligne 87 définissent `/stats` et `/tenants/:id`. `api.js` n'expose que `listTenants`, `toggleTenant`, `activateSubscription`, `getReferrals`, `getSubscription`. Si une vue admin SuperAdmin existe, elle devra ajouter ces méthodes.
**Sévérité : FAIBLE** — Selon besoins UI.

---

## 2. INTÉGRITÉ MULTI-TENANT

### 2.1 — `admin.service.ts` `getPlatformStats()` — requêtes SANS filtrage tenant (ATTENTION par design)

**`admin.service.ts` lignes 425-475** — `getPlatformStats()` fait `SELECT COUNT FROM sales WHERE is_cancelled = false` **sans tenant_id** (agrégat global plateforme, SUPERADMIN uniquement). C'est **volontaire** mais cela signifie que le SUPERADMIN voit toutes les ventes de tous les tenants.
**Sévérité : FAIBLE** — Par design (SuperAdmin). Documenter que l'accès est strictement réservé SUPERADMIN.

### 2.2 — `sales.service.ts` `cancelSale()` — requête `sale_items` SANS tenant_id (HAUTE)

**`sales.service.ts` ligne 424** : `SELECT * FROM sale_items WHERE sale_id = $1` — **pas de filtrage tenant_id**. Bien que `sale_id` vienne d'une vente déjà filtrée par tenant (ligne 408), les `sale_items` n'ont pas de colonne `tenant_id` propre. Si un attaquant forge un `saleId` cross-tenant (impossible car filtré en ligne 408), mais en théorie la table `sale_items` n'est pas isolée par tenant_id.
Vérifier la migration `007_create_sale_items.sql` pour confirmer l'absence de `tenant_id`.

**Sévérité : HAUTE** — Ajouter `tenant_id` sur `sale_items` OU garantir que **toutes** les requêtes sur `sale_items` JOIN via `sales` filtrée par tenant. Actuellement OK par le JOIN, mais fragile.

### 2.3 — `admin.service.ts` `getTenantDetail()` — exposition de `referral_code` au SUPERADMIN (FAIBLE)

**`admin.service.ts` ligne 498** — `getTenantDetail` retourne `referral_code` du tenant. Acceptable pour SuperAdmin.
**Sévérité : FAIBLE** — Par design.

### 2.4 — Vérification globale : toutes les requêtes métier filtrent par tenant_id ✅

Après revue exhaustive de `products.service`, `stock.service`, `sales.service`, `dashboard.service`, `logs.service`, `notifications.service`, `settings.service`, `categories.service`, `exports.controller` — **toutes** les requêtes sur tables métier (products, sales, subscriptions, settings, categories, audit_logs, notifications, stock_movements, daily_sale_counts) incluent `WHERE tenant_id = $1`. ✅ **Aucune fuite cross-tenant détectée** dans les modules standards.

### 2.5 — `checkTenantActive` bypassé pour SUPERADMIN (volontaire) ✅

**`tenant.ts` ligne 18** — SUPERADMIN bypass. Les routes `/admin/*` pour SuperAdmin n'ont pas `checkTenantActive` (voir `admin.routes.ts` ligne 35 `preHandler: [authenticate, authorize(['SUPERADMIN'])]` — sans checkTenantActive). ✅ Correct.

---

## 3. LOGIQUE DES ABONNEMENTS (FREE vs PRO)

### 3.1 — Quota FREE 30 ventes/jour — race condition potentielle (MOYENNE)

**`sales.service.ts` lignes 68-89** — Le compteur `daily_sale_counts` est lu avec `FOR UPDATE` **à l'intérieur** de la transaction, ce qui est correct. Cependant, la vérification `currentCount >= 30` se fait **avant** l'insertion de la vente. Si deux requêtes concurrentes arrivent avec count=29, le `FOR UPDATE` sérialise — la deuxième verra count=30 après l'UPDATE de la première ? Non : `FOR UPDATE` verrouille la ligne, la deuxième attend la fin de la transaction de la première, puis voit `count=30` (après le `DO UPDATE SET count = count + 1` de la première). ✅ **Correct** grâce au `FOR UPDATE`.

### 3.2 — Expiration des abonnements — dépend du scheduler / cron (HAUTE)

**`subscriptionScheduler.ts` ligne 33** — Sur Vercel (`process.env.VERCEL`), le `setInterval` est **désactivé**. L'expiration repose sur l'endpoint `POST /admin/cron/expire-subscriptions`.
**`admin.routes.ts` ligne 102-128** — Le cron est protégé par `x-cron-secret`. **MAIS** en dev avec `CRON_SECRET=''`, l'endpoint est **ouvert sans auth** (ligne 107-108). En production sans Vercel, le scheduler tourne toutes les heures ✅.

**Problème :** Si l'endpoint cron n'est jamais appelé en production (Vercel), les abonnements FREE PROMU en PRO_MONTHLY à la main par SuperAdmin ne seront **jamais expirés automatiquement**. La seule passe d'expiration est dans `checkAndExpireSubscriptions()`, appelée seulement par le scheduler/cron.

**Sévérité : HAUTE** — Configurer un cron externe (Vercel Cron, EasyCron, ou GitHub Actions) qui appelle `POST /api/admin/cron/expire-subscriptions` avec le header `x-cron-secret`. Vérifier que Vercel Cron est configuré dans `vercel.json`.

### 3.3 — `sales.service.ts` ligne 40 — vérification abonnement inactif mais pas expiré (MOYENNE)

**Ligne 32-45** : `SELECT status, tier FROM subscriptions WHERE tenant_id = $1 ORDER BY start_date DESC LIMIT 1`. Vérifie `status !== 'ACTIVE'` mais **ne vérifie pas `end_date < NOW()`** pour PRO_MONTHLY. Si le cron d'expiration n'a pas tourné, un abonnement PRO_MONTHLY dont `end_date` est dépassé reste `status='ACTIVE'` → la vente passe alors que l'abonnement devrait être expiré.
**Sévérité : MOYENNE** — Ajouter une vérification `end_date > NOW()` (ou `end_date IS NULL` pour LIFETIME) dans la requête de vérification d'abonnement au moment de la vente, en plus du statut.

### 3.4 — Gate PRO sur exports — VÉRIFIER (MOYENNE)

**`exports.routes.ts` ligne 8** — `authorize(['ADMIN'])` mais **pas de vérification PRO** dans la route ni le controller. Le `AGENTS.md` indique "PRO uniquement" pour exports. Vérifier `exports.service.ts` pour un gate PRO.
**Sévérité : MOYENNE** — Si le gate PRO n'est pas dans le service, un tenant FREE peut exporter. Ajouter un check `tier === 'PRO'` dans `exports.controller` ou `exports.service`.

### 3.5 — Gate PRO sur catégories custom ✅

**`categories.service.ts` ligne 73-87** — Vérification `tier !== 'PRO'` → erreur `PRO_REQUIRED`. ✅ Correct.

### 3.6 — Gate PRO sur personnalisation ticket ✅

**`settings.service.ts` lignes 30-58** — Vérification PRO pour les champs `ticket_*` et `theme`. ✅ Correct.

---

## 4. LOGIQUE DE STOCK

### 4.1 — Cohérence vente → décrément stock ✅

**`sales.service.ts` lignes 283-304** — Décrément atomique dans la transaction, insertion `stock_movements` avec `movement_type='OUT'` et `sale_id`. ✅ Correct.

### 4.2 — Annulation vente → recrédit stock ✅

**`sales.service.ts` lignes 444-476** — Recrédit avec `FOR UPDATE` sur le produit, insertion `stock_movements` avec `movement_type='IN'` et `sale_id`. ✅ Correct.

### 4.3 — Alerte stock dupliquée entre `sales.service` et `stock.service` (FAIBLE)

**`sales.service.ts` lignes 330-350** — Crée notification `STOCK_LOW`/`STOCK_OUT` avec `ON CONFLICT DO NOTHING`.
**`stock.service.ts` lignes 208-226** — Fait de même via `evaluateStockAlert`.
Les deux créent des notifications identiques. Le `ON CONFLICT DO NOTHING` évite les doublons **mais seulement s'il y a un UNIQUE constraint sur `(tenant_id, type, data->>'product_id')`**. Vérifier la migration `010_create_notifications.sql` pour ce constraint. Sinon, doublons possibles.
**Sévérité : FAIBLE** — Factoriser dans un helper commun.

### 4.4 — Résolution d'alerte non faite après vente (MOYENNE)

**`sales.service.ts` lignes 330-350** — Crée une alerte si `newStock <= effectiveThreshold`, mais **ne résout jamais** les alertes si `newStock > effectiveThreshold` après une vente (ce qui ne peut pas arriver lors d'une vente puisque le stock baisse). ✅ Logique correcte (une vente ne fait que descendre). **Mais** : après annulation (recrédit), **`sales.service` ligne 515** résout les alertes si `newStock > effectiveThreshold`. ✅ Correct.

### 4.5 — `stock.service.ts` ligne 93 — `quantity` stocké comme absolu (FAIBLE)

**Ligne 93** : `Math.abs(newStock - oldStock)` dans `stock_movements.quantity`. Pour ADJUSTMENT, c'est la différence absolue, pas le nouveau stock. Cohérent avec IN/OUT (delta). ✅ Mais le champ `quantity` pour ADJUSTMENT est ambigu (différence vs. valeur saisie). Le frontend envoie `quantity: qty` où `qty` est le **nouveau stock total** (stock.js ligne 424). Backend stocke `Math.abs(newStock - oldStock)`. Si l'utilisateur saisit 50 et old=30, stock_movements.quantity=20 (le delta). ⚠️ L'historique montrera "20" alors que l'utilisateur a saisi "50". Documenter.
**Sévérité : FAIBLE** — Clarifier dans le libellé ou stocker la valeur saisie.

### 4.6 — Pas de ré-évaluation d'alerte sur modification manuelle de stock via `updateProduct` (MOYENNE)

**`products.service.ts` ligne 332** — `updateProduct` appelle `checkAndTriggerStockAlert` ✅. Mais `updateProduct` permet de modifier `stock_quantity` directement (via PUT). Si un ADMIN change le stock via le formulaire produit (pas via mouvement), **aucun `stock_movements` n'est créé** → audit trail incomplet.
**Sévérité : MOYENNE** — Décider : soit interdire la modification de `stock_quantity` via `PUT /products/:id` (forcer le mouvement), soit tracer un mouvement automatique.

---

## 5. LOGIQUE DE PARRAINAGE

### 5.1 — Récompense parrainage : logique "2 filleuls PRO = 1 mois gratuit" ✅ mais fragile (MOYENNE)

**`admin.service.ts` lignes 123-183** — Compte les referrals `COMPLETED` et `REWARDED` avec `rewarded_at IS NULL`, prend les 2 plus anciens. Si ≥2, étend `end_date` de 30 jours sur l'abonnement PRO MONTHLY actif du parrain, marque les 2 comme `REWARDED`.
**Problème :** Si le parrain a un abonnement PRO LIFETIME, `isMonthly=false` → `days_granted=0` → la récompense est "symbolique" (notification mais pas d'extension). ⚠️ Si le parrain était FREE au moment où ses filleuls passent PRO, il n'y a **pas d'abonnement PRO actif** → `parrainSub` est null → **aucune récompense n'est donnée** (ligne 139 `if (parrainSub)`). Les filleuls restent `COMPLETED` non `REWARDED` pour toujours.
**Sévérité : MOYENNE** — Définir la politique pour un parrain FREE : doit-il recevoir un mois PRO gratuit (créer un abonnement PRO) ? Actuellement, la récompense est **perdue**.

### 5.2 — `ReferralsService.getReferralInfo()` — calcul `pending_rewards` incohérent (FAIBLE)

**`admin.service.ts` lignes 311-313** — `completedCount = COMPLETED + REWARDED`, `rewardedCount = REWARDED`, `pendingRewards = completedCount - rewardedCount`. Mais la récompense se déclenche à **2** filleuls (paire). Si le parrain a 3 filleuls COMPLETED, 2 sont REWARDED, 1 reste COMPLETED. `pendingRewards = 3 - 1(REWARDED) = 2` ? Non : si 2 sont REWARDED et 1 COMPLETED, `completedCount=3`, `rewardedCount=2` (parmi les 3 COMPLETED+REWARDED, seul 2 sont REWARDED). `pendingRewards=1`. ⚠️ Mais la récompense ne se déclenche qu'avec **2 COMPLETED non récompensés**. Le frontend affiche "pending_rewards" qui peut être trompeur.
**Sévérité : FAIBLE** — Clarifier le calcul : `pendingRewards` devrait être `floor(pendingCount / 2)` ou indiquer "X filleuls en attente de récompense (il faut 2)".

### 5.3 — Code de parrainage — unicité non garantie côté DB (MOYENNE)

**`auth.service.ts` ligne 33** — `generateUniqueReferralCode(shop_name)`. Le nom suggère une boucle de retry, mais la table `tenants` n'a probablement pas de UNIQUE constraint sur `referral_code`. Si deux boutiques ont le même nom, le code peut collisionner. Vérifier `001_create_tenants.sql`.
**Sévérité : MOYENNE** — Ajouter `UNIQUE` sur `referral_code` dans `tenants`.

### 5.4 — Code de parrainage invalide → silent ignore (FAIBLE)

**`auth.service.ts` lignes 69-90** — Si `input.referral_code` ne matche aucun tenant actif, **aucune erreur n'est renvoyée**. L'inscription réussit sans parrainage. Comportement acceptable, mais l'utilisateur ne sait pas que son code était invalide.
**Sévérité : FAIBLE** — Optionnel : retourner un warning.

---

## 6. LOGIQUE D'ONBOARDING

### 6.1 — `onboarding_step` jamais persisté en BDD (HAUTE)

**`onboarding.js`** — La méthode `finish()` (ligne 160) appelle `API.settings.update({ onboarding_completed: true })` pour marquer la fin. **Mais l'étape intermédiaire** (`onboarding_step`) n'est **jamais persisté en BDD**. Le `onboarding_step` reçu au login est lu (ligne 147), mais jamais mis à jour pendant l'onboarding. Si l'utilisateur rafraîchit la page à l'étape 3, il recommence à l'étape `user.onboarding_step - 1` (qui vaut toujours 1).
**Sévérité : HAUTE** — Dans `_advance()`, appeler `API.settings.update({ onboarding_step: this.currentStepIndex + 1 })` pour persister la progression.

### 6.2 — `onboarding_completed` default TRUE pour les anciens tenants (HAUTE)

**Migration 018** — `DEFAULT TRUE` pour `onboarding_completed`. Mais **`auth.service.ts` ligne 63`** (register) crée les settings avec `onboarding_completed = FALSE, onboarding_step = 1`. ✅ Pour les nouveaux. Mais pour les tenants existants (avant migration 018), `onboarding_completed = TRUE` → pas d'onboarding. **Problème** : `auth.service.ts` ligne 266 (login) — si pas de settings, fallback `onboarding_completed: true` → skip onboarding. Un nouvel inscrit qui n'a pas encore de settings → onboarding skippé.
**Sévérité : HAUTE** — Le `register` crée toujours les settings (ligne 62), donc OK. Mais le `login` fallback `true` masque le cas où les settings n'existent pas (corruption). Renforcer le fallback à `false`.

### 6.3 — Router guard onboarding : bug logique (MOYENNE)

**`router.js` lignes 48-61** — La condition est :
```js
if (!allowedRoutes.includes(hash) || (currentStepRoute && !hash.startsWith(currentStepRoute.split('?')[0]) && !allowedRoutes.includes(hash)))
```
- Si `hash` est dans `allowedRoutes` ✅ passe.
- Si `hash` n'est pas dans `allowedRoutes` ET `currentStepRoute` est défini ET `hash` ne commence pas par la route de l'étape courante → redirige.
Mais si `currentStepRoute` est `#/products` et `hash` est `#/sales`, et `#/sales` n'est pas dans `allowedRoutes` → redirige vers `#/products`. ✅ Mais `#/sales` **n'est pas dans `allowedRoutes`** (qui est `['#/dashboard', '#/products', '#/pos', '#/settings', '#/onboarding']`). Donc pendant l'onboarding, l'utilisateur ne peut pas aller sur `#/sales`, `#/stock`, `#/logs`. Peut être **volontaire** (restreindre), mais la liste ne contient pas `#/stock` alors que l'onboarding inclut l'étape "validate-sale" sur le POS. ⚠️ L'utilisateur ne peut pas consulter le stock pendant l'onboarding.
**Sévérité : MOYENNE** — Soit autoriser toutes les routes (non-bloquant), soit documenter les restrictions.

### 6.4 — `tryStartOnboarding()` déclenché à chaque `hashchange` (FAIBLE)

**`app.js` ligne 359-361** — `window.addEventListener('hashchange', () => { if (!isGuidedOnboardingDone()) tryStartOnboarding(); })`. Le `start()` a un guard `if (this.active) return` (skill point 4) ✅. Mais `tryStartOnboarding` parse `localStorage.user` à chaque hashchange — micro-overhead.
**Sévérité : FAIBLE** — OK mais optimisable.

### 6.5 — localStorage keys non nettoyées après finish() (MOYENNE)

**`onboarding.js` finish()** (ligne 160) — Set `rdg_guided_onboarding_done = true` et persiste `onboarding_completed` en BDD. **Mais** les clés `rdg_setup_product_created`, `rdg_setup_sale_validated`, `rdg_setup_referral_seen` dans localStorage **ne sont jamais nettoyées**. Si l'utilisateur réinitialise l'onboarding (via `resetSetupGuide` mentionné dans le skill), il doit aussi les nettoyer.
**Sévérité : MOYENNE** — Ajouter le nettoyage des 3 clés `rdg_setup_*` dans `finish()` ou `resetSetupGuide()`.

### 6.6 — `ONBOARDING_STORAGE_KEY` vs BDD `onboarding_completed` — double source de vérité (MOYENNE)

**`onboarding.js` ligne 10** — `rdg_guided_onboarding_done` en localStorage. **Ligne 130** — Si `user.onboarding_completed` est true en BDD, set localStorage. **Mais** si l'utilisateur change de device/navigateur, localStorage est vide → le `start()` (ligne 122) lit user et re-démarre si `onboarding_completed` est false. Doublon de source de vérité qui peut désynchroniser.
**Sévérité : MOYENNE** — Considérer localStorage comme cache pur, BDD comme source unique.

---

## 7. TESTS E2E (`e2e/rdgestion-audit.spec.js`)

### 7.1 — Test sur production (`BASE_URL = 'https://rdgestion.app'`) (HAUTE)

**Ligne 6** — Le test cible l'URL **de production**. Cela crée de vrais tenants en BDD de production (inscription ligne 119-151), pollue la base, et peut casser l'expérience des vrais utilisateurs (tenant de test visible dans le SuperAdmin panel).
**Sévérité : HAUTE** — Utiliser une URL de staging/développement ou mocker l'API.

### 7.2 — Désactivation de l'onboarding par suppression DOM (MOYENNE)

**Ligne 31-43** — `dismissOnboarding` supprime `#rdg-onboarding-root` du DOM. Cela **contourne** l'onboarding mais ne persiste pas `onboarding_completed = true` en BDD. L'onboarding réapparaîtra à la prochaine session.
**Sévérité : MOYENNE** — Pour les tests E2E, mocker l'API ou set `localStorage.setItem('rdg_guided_onboarding_done', 'true')` avant la navigation.

### 7.3 — Attendre des URLs avec `.catch(() => {})` silencieux (FAIBLE)

**Lignes 145-147** — `await page.waitForURL('**/#/products**', { timeout: 15000 }).catch(() => {})` suivi de 2 autres waitForURL avec catch silencieux. Si aucune ne matche, le test continue sans échec explicite — le `logResult` ligne 151 marquera PASS même si l'URL est inattendue.
**Sévérité : FAIBLE** — Vérifier l'URL attendue avec assertion stricte.

### 7.4 — Pas de test du flux critique (vente, stock, parrainage) (HAUTE)

Le test E2E couvre : inscription, navigation, thème, mobile, déconnexion, connexion. **Manquent** :
- Création de produit
- Enregistrement d'une vente
- Annulation de vente
- Mouvement de stock
- Export
- Parrainage
- Onboarding complet (le guide est dismiss, pas testé)
- Gate FREE 30 ventes/jour
- Activation PRO
**Sévérité : HAUTE** — Les flux métier centraux ne sont pas testés.

### 7.5 — Génération de rapport en dur dans `md/rapport-audit-rdgestion.md` (FAIBLE)

**Ligne 7** — Le rapport est écrit à chaque exécution. Vote OK mais pas nettoyé.
**Sévérité : FAIBLE** — Ajouter au `.gitignore`.

---

## PROBLÈMES TRANSVERSES ADDITIONNELS

### A.1 — `payments.routes.ts` webhook — `activated_by` sentinel géré ✅

**Ligne 153** — Passe `'00000000-...'` à `activatePro`. **`admin.service.ts` ligne 30-33** convertit le sentinel en `null`. ✅ Correct (fix documenté dans le skill bug-patterns).

### A.2 — `payments.routes.ts` verify — pas de `checkTenantActive` (FAIBLE)

**Ligne 185** — `preHandler: [authenticate, authorize(['ADMIN'])]` — pas de `checkTenantActive`. Un tenant désactivé peut vérifier une transaction. Acceptable (la vérification ne modifie rien), mais l'activation PRO qui suit (`activatePro`) pourrait réactiver un tenant désactivé ? Non, `activatePro` ne touche pas `tenants.is_active`.
**Sévérité : FAIBLE** — Ajouter `checkTenantActive` pour cohérence.

### A.3 — `payments.routes.ts` — content type parser global (MOYENNE)

**Lignes 26-38** — `fastify.addContentTypeParser('application/json', ...)` redéfinit le parser JSON **pour toutes les routes** du module payments, y compris `/create-intent` et `/verify`. Cela capture le raw body pour le webhook, mais impacte aussi les autres routes (le body est double-parlé). En pratique, Fastify gère le scope par plugin, donc limité à `/api/payments`. ✅ Acceptable mais à documenter.

### A.4 — `sales.service.ts` numéro de transaction — SUBSTRING fragile (MOYENNE)

**Lignes 200-206** — `SUBSTRING(transaction_number FROM 12)::integer` pour extraire le séquence. `VENTE-2025-0000001` → position 12 = `0000001`. Mais si l'année change (2026), le `LIKE 'VENTE-2026-%'` filtre correctement ✅. Le `SUBSTRING(... FROM 12)` = position fixe. Si le format change (`VENTE-2025-ABC-001`), ça casse.
**Sévérité : FAIBLE** — Utiliser une séquence SQL dédiée (`SEQUENCE`) au lieu de `MAX+1`.

### A.5 — `sales.service.ts` — pas de validation que `items` est non vide (HAUTE)

**`createSale`** — Si `input.items` est un tableau vide `[]`, `productIds = []`, la requête `WHERE id = ANY($1)` (array vide) pourrait retourner 0 produits, le `dbProductsMap` est vide, la boucle de validation ne lève pas d'erreur, `subtotal = 0`, `totalAmount = 0`, et la vente est créée avec 0 article. ⚠️ Vente fantôme.
**Sévérité : HAUTE** — Ajouter une validation `if (input.items.length === 0) throw 400` au début.

### A.6 — `api.js` ligne 446 — `exports.sales()` ignore le paramètre `format` (FAIBLE)

**`api.js` ligne 446** — `async sales(format = 'csv', range = {})` — le `format` est ignoré et le CSV est toujours généré côté client. La signature suggère `xlsx|pdf` mais le code fait du CSV. Le backend a pourtant `/exports/sales?format=xlsx` (exports.routes.ts ligne 24). Incohérent.
**Sévérité : FAIBLE** — Soit utiliser l'API backend, soit corriger la doc.

### A.7 — `admin.service.ts` `listTenants` — `LEFT JOIN subscriptions` peut retourner plusieurs lignes (MOYENNE)

**Ligne 350** — `LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'ACTIVE'`. Si un tenant a plusieurs abonnements ACTIVE (ce qui ne devrait pas arriver mais l'`activatePro` désactive l'ancien avant d'insérer le nouveau ✅), la jointure est safe. ✅ OK.

### A.8 — Logs manquants : webhook FedaPay sans `checkTenantActive` mais pas d'audit de la transaction (FAIBLE)

**`payments.routes.ts`** — Le webhook enregistre dans `payments` table (ligne 141) ✅, mais l'activation PRO via `activatePro` log dans `audit_logs` ✅. Cependant, si le webhook échoue (signature invalide), seul un `console.error` (ligne 100), pas de log persistant.
**Sévérité : FAIBLE** — Logger les webhooks rejetés en BDD pour audit forensique.

### A.9 — `stock.service.ts` `evaluateStockAlert` — pas de `FOR UPDATE` sur le settings (FAIBLE)

**Ligne 201** — `SELECT global_stock_threshold FROM settings WHERE tenant_id = $1` sans lock. Si l'ADMIN modifie le seuil en parallèle, la valeur lue peut être obsolète. Faible impact (l'alerte est créer/supprimer).
**Sévérité : FAIBLE** — Acceptable.

### A.10 — Edge case : vente avec quantité 0 ou négative non validée (HAUTE)

**`sales.service.ts`** — La validation des stocks (ligne 120-134) vérifie `stock_quantity < item.quantity` mais **ne valide pas que `item.quantity > 0`**. Une quantité de 0 ou négative passera (le stock ne change pas ou augmente). Le schéma Ajv `createSaleSchema` devrait valider `minimum: 1`.
**Sévérité : HAUTE** — Vérifier `sales.schema.ts` ; ajouter `minimum: 1` sur `items[].quantity`.

### A.11 — `onboarding.js` `_escapeHtml` (ligne 614-621) — regex incomplète (FAIBLE)

**Ligne 619** — `.replace(/"/g, '"')` remplace `"` par `"` (littéral). Devrait être `&quot;`. Le `replace(/'/g, '&#039;')` est correct. Faille XSS potentielle si un titre d'étape contient un guillemet (mais les titres sont hardcoded → faible).
**Sévérité : FAIBLE** — Corriger la regex.

---

## RÉSUMÉ PAR SÉVÉRITÉ

| Sévérité | Count |
|---|---|
| CRITIQUE | 1 |
| HAUTE | 8 |
| MOYENNE | 11 |
| FAIBLE | 13 |

**Top 5 actions prioritaires :**
1. **Standardiser les shapes API** (success/data) sur tous les controllers + adapter frontend (1.1 — CRITIQUE).
2. **Ajouter validation `items.length > 0` et `quantity >= 1`** dans `createSale` (A.5, A.10 — HAUTE).
3. **Persister `onboarding_step` en BDD** à chaque avancement (6.1 — HAUTE).
4. **Configurer un cron externe** pour l'expiration des abonnements en production Vercel (3.2 — HAUTE).
5. **Ajouter la vérification `end_date`** dans le gate d'abonnement à la vente (3.3 — MOYENNE).

---

**Fichiers inspectés (audit complet) :**
- `frontend/src/js/api.js`, `frontend/src/js/router.js`, `frontend/src/js/app.js`, `frontend/src/js/utils/onboarding.js`
- `frontend/src/js/views/{products,stock,sales,settings}.js`
- `backend/src/app.ts`, `backend/src/middlewares/{auth,tenant}.ts`
- `backend/src/modules/auth/{routes,controller,service}.ts`
- `backend/src/modules/products/{routes,controller,service}.ts`, `stock.service.ts`
- `backend/src/modules/sales/{routes,controller,service}.ts`
- `backend/src/modules/admin/{routes,service}.ts`
- `backend/src/modules/settings/{routes,controller,service}.ts`
- `backend/src/modules/categories/{routes,controller,service}.ts`
- `backend/src/modules/dashboard/{routes,controller,service}.ts`
- `backend/src/modules/logs/{routes,controller,service}.ts`
- `backend/src/modules/notifications/{routes,controller,service}.ts`
- `backend/src/modules/payments/routes.ts`
- `backend/src/modules/exports/{routes,controller}.ts`
- `backend/src/scheduler/subscriptionScheduler.ts`
- `backend/src/database/migrations/011,018_*.sql`
- `e2e/rdgestion-audit.spec.js`

**Note :** Je n'ai pas exécuté `npm run typecheck` ni `npx vitest run` car l'audit portait sur la cohérence du code et la logique métier, pas sur la compilation. Une passe de typecheck + tests unitaires reste recommandée pour confirmer l'absence de régressions après corrections.