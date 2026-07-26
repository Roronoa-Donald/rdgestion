`productBodySchema` n'a pas de `additionalProperties: false` (alors que les autres schémas Ajv l'ont). Confirme un autre finding. J'ai maintenant tous les éléments nécessaires pour le rapport exhaustif.

# RAPPORT D'AUDIT EXHAUSTIF — Backend RDGESTION

## Méthodologie

J'ai lu intégralement (en mode read_file ligne par ligne) **tous les fichiers** des 11 modules backend + middlewares + config + utils + migrations SQL pertinentes. Ci-dessous, chaque problème est identifié par module, fichier/ligne, description, sévérité, et recommandation.

---

## ⛔ PROBLÈMES CRITIQUES (CRITIQUE)

### C1. `is_resolved` / `resolved_at` — colonnes inexistantes → runtime error

- **Fichiers** : 
  - `backend/src/modules/products/stock.service.ts` lignes 229-237
  - `backend/src/modules/sales/sales.service.ts` lignes 515-525
- **Description** : Le code exécute `UPDATE notifications SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP, ... WHERE ... AND is_resolved = FALSE`. La migration `010_create_notifications.sql` ne définit **pas** les colonnes `is_resolved` et `resolved_at`. Ces UPDATE échouent systématiquement avec `column "is_resolved" does not exist`.
- **Impact** : Toute opération qui remonte le stock au-dessus du seuil (annulation de vente, entrée de stock manuelle) jette une exception SQL qui **fait échouer toute la transaction** (ROLLBACK). Concrètement: annuler une vente conserve le stock débité (transaction rollback), et un mouvement de stock IN/ADJUSTMENT qui franchit le seuil n'est jamais committé.
- **Sévérité** : **CRITIQUE** — casse fonctionnellement l'annulation de vente dès qu'un produit remonte au-dessus du seuil.
- **Recommandation** : Soit créer une migration `019_alter_notifications_add_resolved.sql` (`ALTER TABLE notifications ADD COLUMN is_resolved BOOLEAN DEFAULT FALSE, ADD COLUMN resolved_at TIMESTAMPTZ`), soit retirer ces UPDATE et baser la résolution d'alerte sur logique applicative (e.g. `is_read = TRUE`). Il faut aussi traiter le warning `ON CONFLICT DO NOTHING` sur `notifications` (pas de contrainte unique) qui ne fait jamais rien (voir C2).

### C2. `ON CONFLICT DO NOTHING` sur `notifications` sans contrainte unique

- **Fichiers** :
  - `backend/src/modules/products/products.service.ts` ligne 442
  - `backend/src/modules/products/stock.service.ts` ligne 218
  - `backend/src/modules/sales/sales.service.ts` ligne 341
- **Description** : `INSERT INTO notifications (...) VALUES (...) ON CONFLICT DO NOTHING` est utilisé pour éviter l'explosion d'alertes. Or la table `notifications` (migration 010) n'a **aucune contrainte UNIQUE** — seul `id` (PK auto-gen) l'est. `ON CONFLICT DO NOTHING` sans préciser l'index ne déclenche jamais l'arbitrage et chaque insertion produit une notification.
- **Impact** : Pollution massive de `notifications` (des dizaines de doublons `STOCK_LOW` pour un même produit), dossier "badge" sans cesse incrémenté, fuite de ressources (table croît indéfiniment).
- **Sévérité** : **CRITIQUE**
- **Recommandation** : Ajouter un index functional unique sur `(tenant_id, type, (data->>'product_id'))` pour `STOCK_LOW`/`STOCK_OUT`, ou supprimer le `ON CONFLICT` et faire un SELECT d'existence explicite dans la même transaction avant INSERT.

### C3. `productBodySchema` sans `additionalProperties: false` → mass assignment

- **Fichier** : `backend/src/modules/products/products.schema.ts` lignes 38-53
- **Description** : Le schema Ajv `productBodySchema` (utilisé line 12 du controller pour valider multipart + JSON) n'a pas `additionalProperties: false`. Tous les autres schemas Ajv du projet l'ont (cf. `registerSchema`, `loginSchema`, `getProductsSchema`, `createSaleSchema`, etc.).
- **Impact** : Un attaquant peut poster un body JSON contenant `{ "name":"X","purchase_price":1,"sell_price":2,"stock_quantity":5, "tenant_id":"<uuid autre tenant>", "is_deleted":true }` etc. Le controller passe `fields` tel quel à `productsService.createProduct(tenantId, fields, ...)` qui ne sélectionne que les champs valides en SQL, donc pas d'IDOR direct via INSERT TC… mais le `updateProduct` construit la clause SET dynamiquement en itérant `data[field]` sur des champs explicitement listés — donc atténuation partielle. Risque réel sur `updateTenantProfile` (voir H5).
- **Sévérité** : **CRITIQUE** (principe de defense-in-depth, mass assignment possible)
- **Recommandation** : Ajouter `additionalProperties: false` à `productBodySchema`. Idem pour le body `createProductSchema` (vide) — valider explicitement.

### C4. SQL injection potentielle via `sort` ORDER BY dans un module imbriqué

- **Fichier** : `backend/src/modules/products/products.service.ts` lignes 49-53
- **Description** : La whitelist `allowedSortFields` protège bien le `sort` du module products lui-même. Mais `settings.service.ts` (lignes 62-72), `categories.service.ts` et `admin.service.ts` construisent des clauses `SET ${field} = $${idx++}` à partir de tableaux `proOnly`/`allFields`/`allowed` hardcodés — donc sécurisés. En revanche, **`updateTenantProfile`** (settings.service.ts ligne 145) itère sur `allowed` (tableau hardcodé) — OK. Le module `logs` (`logs.service.ts` lignes 28-50) utilise `filters.action`, `filters.entity_type`, etc. en paramètres bindés `$N` — OK. **Aucune injection confirmée**, mais l'absence de validation sur `filters.action` (route logs ligne 15: `action: { type: 'string' }` sans enum) permet de faire transiter n'importe quelle chaîne qui est ensuite bindée — pas dangereux mais incohérent avec le type `AuditAction`.
- **Sévérité** : **FAIBLE** (le sorting est sécurisé ; juste un manque d'enum).
- **Recommandation** : Borner `action` à l'enum `AuditAction` dans `logs.routes.ts` (utilisez `d/custom-enum` ou une directive `enum`).

### C5. Absence de `checkTenantActive` sur certaines routes SUPERADMIN + `verify` de payments

- **Fichiers** : 
  - `backend/src/modules/payments/payments.routes.ts` ligne 185 (route `/verify`)
  - `backend/src/modules/admin/admin.routes.ts` lignes 35, 60, 79, 84, 96 (routes SUPERADMIN sans `checkTenantActive`)
- **Description** : La route `POST /api/payments/verify` n'a que `[authenticate, authorize(['ADMIN'])]` — pas de `checkTenantActive`. Un tenant désactivé peut donc déclencher une activation PRO via FedaPay en utilisant une transaction_id. Les routes SUPERADMIN (`/admin/subscriptions/:tenantId/activate`, `/admin/tenants`, `/admin/tenants/:id`, `/admin/stats`, `/admin/tenants/:id`) n'ont pas non plus `checkTenantActive` — mais c'est cohérent car `checkTenantActive` bypass SUPERADMIN (middleware tenant.ts ligne 18). En revanche pour `/verify` c'est **une incohérence**: si admin d'un tenant désactivé, il peut quand même vérifier une transaction FedaPay et activer son PRO.
- **Sévérité** : **CRITIQUE** sur `/verify` (contournement de désactivation tenant), **MOYENNE** sur admin (cohérence).
- **Recommandation** : Ajouter `checkTenantActive` à `preHandler` de `/verify`.

---

## 🔴 PROBLÈMES HAUTS (HAUTE)

### H1. Fuite de `password_hash` dans audit logs lors de `PRODUCT_DELETE`

- **Fichier** : `backend/src/modules/products/products.service.ts` lignes 357-369 (et `204`, `366` pour `PRODUCT_ADD`/`PRODUCT_UPDATE`)
- **Description** : `JSON.stringify(product)` est inséré dans `audit_logs.details`. Le type `Product` ne contient pas `password_hash`, donc sur ce cas précis c'est OK. **En revanche** dans `auth.service.ts` lignes 186-198 et `settings.service.ts` ligne 173 (`JSON.stringify(data)`) et ligne 263 (`JSON.stringify({ username: user.username })`), les `data` proviennent du body et peuvent contenir des champs additionnels (par ex. un `password` si l'admin envoie un body non validé). Pour `updateTenantProfile`, `data` est passé tel quel sans filtrage → si le frontend envoie `password` par erreur dans le body du profil, il se retrouve loggé en clair.
- **Sévérité** : **HAUTE**
- **Recommandation** : Ne jamais logger `JSON.stringify(data)` ou `JSON.stringify(body)` ; logger uniquement les champs whitelistés effectivement modifiés (pattern déjà appliqué dans `products.service` updateProduct via `changes`).

### H2. Race condition sur numéro de transaction `VENTE-YYYY-NNNNNNN`

- **Fichier** : `backend/src/modules/sales/sales.service.ts` lignes 198-206
- **Description** : Le numéro de séquence est calculé via `SELECT COALESCE(MAX(SUBSTRING(transaction_number FROM 12)::integer), 0) + 1 ...` puis un INSERT avec ce numéro. Bien que la transaction soit sous `BEGIN/COMMIT`, le `SELECT MAX(...)` n'utilise **pas** `FOR UPDATE`. Deux ventes concurrentes peuvent calculer le même `nextSequence`, et la contrainte `UNIQUE(tenant_id, transaction_number)` (migration 006 ligne 18) fera échouer la seconde avec `duplicate key value` — pas de retry, c'est une erreur 500 brute côté client. Acceptable mais fragile.
- **Sévérité** : **HAUTE** (fiabilité)
- **Recommandation** : Soit créer une `SEQUENCE` PostgreSQL par année (ou par tenant+année), soit faire `ON CONFLICT (tenant_id, transaction_number) DO UPDATE` retry, soit utiliser `FOR UPDATE` sur un `tenant_sales_seq` lock.

### H3. Rate limit non appliqué aux routes `verify` et `webhook/fedapay`

- **Fichiers** :
  - `backend/src/modules/payments/payments.routes.ts` lignes 85, 174
- **Description** : `/webhook/fedapay` n'a pas de rate limit (acceptable car protégé par signature HMAC). `/verify` n'a pas non plus de rate limit et n'est protégé que par JWT — un attaquant authentifié peut spammer `transaction_id` arbitraires et forcer des dizaines d'appels vers l'API FedaPay par minute, ce qui peut coûter de l'argent ou déclencher des rate-limit FedaPay côté compte marchand.
- **Sévérité** : **HAUTE**
- **Recommandation** : Ajouter `config: { rateLimit: { max: 20, timeWindow: '1 minute' } }` sur `/verify`.

### H4. `token.url` de FedaPay non validé comme URL HTTPS — SSRF/redirection potentielle

- **Fichier** : `backend/src/modules/payments/strategies/fedaPayPayment.service.ts` lignes 88-98
- **Description** : `checkout_url: token.url` est renvoyé tel quel au client. Si FedaPay renvoie une URL malicieuse (compromission du SDK, MITM sur l'API), le client est redirigé Archie. Le control n'est pas critique car la source est l'API FedaPay officielle, mais il faut valider.
- **Sévérité** : **HAUTE** (par mesure de défense)
- **Recommandation** : Vérifier `token.url.startsWith('https://')` et le hostname dans une allowlist (`checkout.fedapay.com`, `*.fedapay.com`).

### H5. Mass assignment sur `updateTenantProfile` (body non validé par schema)

- **Fichiers** : 
  - `backend/src/modules/settings/settings.routes.ts` ligne 20 (`PUT /profile` — pas de `schema:`, body non validé par Fastify)
  - `backend/src/modules/settings/settings.service.ts` lignes 144-166
- **Description** : La route `PUT /api/settings/profile` n'a pas de schema Ajv. Le service itère sur `const allowed = ['name', 'owner_name', 'email', 'address', 'city', 'country', 'currency', 'slogan', 'tax_number']` et ne SET que les champs présents dans `allowed`, donc SQL-safe. **Mais** aucun contrôle de type/taille/format sur `email` (peut être n'importe quelle string), `currency` (pas d'enum ISO 4217), `phone` n'est pas dans la liste (donc impossible à modifier — mais OK), et `name` peut contenir des caractères spéciaux / XSS stocké. L'absence de validation schema signifie aussi que `additionalProperties` n'est pas refusé → un attaquant peut poster `is_active: false`, `referral_code: 'RD-HACK-001'`, `id: '<autre uuid>'` — ces champs ne sont pas SET car non dans `allowed`, mais le `JSON.stringify(data)` au moment du log magnifique va tout logguer en clair (voir H1).
- **Sévérité** : **HAUTE**
- **Recommandation** : Définir un `updateProfileSchema` Ajv avec `additionalProperties: false`, patterns pour email/phone/currency, maxLength. Logger `changes` calculé à partir de la whitelist, pas `data` brut.

### H6. `changePassword` ADMIN-only — un SELLER ne peut pas changer son propre mot de passe

- **Fichiers** :
  - `backend/src/modules/settings/settings.routes.ts` lignes 45-48 (`preHandler: adminOnly` sur `PUT /password`)
- **Description** : `passwordChangeSchema` et le service `changePassword` utilisent `userId` du JWT et `tenant_id` du JWT — implémentation neutre permettant à n'importe quel utilisateur de changer son propre mot de passe. Mais la route est restreinte à `['ADMIN']` via `adminOnly`. Les `SELLER` (vendeurs) sont donc **incapables de changer leur mot de passe eux-mêmes** — spécification probablement involontaire (un vendeur doit demander à l'admin de le reset).
- **Sévérité** : **HAUTE** (UX/sécurité — oblige l'admin à connaître le mot de passe du vendeur pour reset)
- **Recommandation** : Autoriser `['ADMIN', 'SELLER']` sur `PUT /password`. Le service vérifie déjà `tenant_id AND id = $1` donc pas d'IDOR.

### H7. CORS `origin: '*'` en development + `credentials: true` — configuration invalide/dangereuse

- **Fichier** : `backend/src/plugins/cors.ts` lignes 9-12
- **Description** : `origin: '*'` combiné avec `credentials: true` est **interdit par la spec CORS** — les navigateurs refusent les réponses avec `Access-Control-Allow-Origin: *` quand `credentials: true`. En dev, ça peut fonctionner de manière incohérente selon les navigateurs. En outre, en dev `origin: '*'` permet à n'importe quel site d'appeler l'API.
- **Sévérité** : **HAUTE** (en dev seulement, mais configuration trompeuse)
- **Recommandation** : En dev, mettre `origin: true` (refléter l'Origin du client) ou une liste d'origines. Garder `credentials: true` uniquement avec une origin explicite.

### H8. `start_date = new Date()` dans `activatePro` vs défaut SQL `CURRENT_TIMESTAMP`

- **Fichier** : `backend/src/modules/admin/admin.service.ts` lignes 36-52
- **Description** : `const startDate = new Date();` utilise l'horloge JS du serveur (UTC) puis l'insère dans `subscriptions.start_date` (type TIMESTAMPTZ). C'est correct, mais il y a un risque de désynchronisation si le serveur Node tourne sur un timezone mal configuré. Le reste du code SQL utilise `CURRENT_TIMESTAMP` (Postgres).
- **Sévérité** : **MOYENNE**
- **Recommandation** : Utiliser `CURRENT_TIMESTAMP` via le SQL ou `DEFAULT` (la colonne a `DEFAULT CURRENT_TIMESTAMP`).

---

## 🟠 PROBLÈMES MOYENS (MOYENNE)

### M1. `getStartOfToday` retourne une date en UTC (`Z`) alors que le label dit "locale"

- **Fichier** : `backend/src/utils/date.ts` lignes 27-36
- **Description** : La fonction construit `new Date(\`${year}-${month}-${day}T00:00:00.000Z\`)` — le suffixe `Z` force l'interprétation UTC. Le format `(year-month-day)T00:00:00Z` représente minuit **UTC**, pas minuit Africa/Lome (UTC+0). Au Togo/Ghana c'est neutre, mais la fonction est nommée générique et la doc dit "dans le fuseau horaire donné". Si un tenant configure `timezone: 'Africa/Abidjan'` vs `'Europe/Paris'`, ce `Z` est faux pour Paris.
- **Impact** : Le quota quotidien `daily_sale_counts` (sales.service.ts ligne 70) compare à `CURRENT_DATE` (Postgres serveur, généralement UTC pour Aiven) — donc OK en pratique pour Aiven. Mais l'algo `getStartOfToday` n'est pas cohérent et constitue un piège pour toute évolution.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Soit supprimer cette fonction (elle semble inutilisée dans les SQL directement), soit corriger : `new Date(year, monthIdx, day, 0,0,0)` qui crée la date en heure locale JS.

### M2. `discount_value` > subtotal peut générer `discountAmount` >= subtotal avant clamping

- **Fichier** : `backend/src/modules/sales/sales.service.ts` lignes 174-181
- **Description** : Pour `FIXED`, `discountAmount = input.discount_value` sans validation préalable. Le clamp à `subtotal` arrive ensuite (lignes 179-181), donc `totalAmount = subtotal - discountAmount ≥ 0`. Mais le `profit_estimate` ligne 217 est `Math.max(0, profitEstimate - discountAmount)`. Si `discountAmount > profitEstimate_initial`, le profit tombe à 0 (OK), mais la **ligne sale_items** est insérée avec le `unit_sell_price` original (sans remise appliquée par item). Cela fausse le total ligne par ligne : `SUM(sale_items.total_price) > sale.total_amount` dès qu'il y a une remise, ce qui casse les exports et rapports journaliers.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Soit répartir la remise proportionnellement sur les lignes, soit indiquer explicitement dans `sale_items` que la remise est au niveau de la vente (champ `is_global_discount`). Ajouter un test comptable `SUM(items) - discount = total`.

### M3. `checkTenantActive` sur SUPERADMIN bypass — mais les routes admin listent TOUS les tenants sans isolation

- **Fichiers** : `backend/src/middlewares/tenant.ts` lignes 18-20, `admin.service.ts` `listTenants`/`getTenantDetail`
- **Description** : `checkTenantActive` bypass explicitement le SUPERADMIN (OK). Le `AdminService.listTenants` et `getTenantDetail` n'isolent pas par `currentUser.tenantId` — **normal pour un super-admin**, mais il n'y a **aucune vérification** que l'utilisateur a vraiment `role === 'SUPERADMIN'` côté service. C'est uniquement le middleware `authorize(['SUPERADMIN'])` (rbac.ts) qui protège. Si une future route réutilise `AdminService.listTenants` sans le middleware RBAC, c'est une fuite totale de tous les tenants.
- **Sévérité** : **MOYENNE** (defense-in-depth)
- **Recommandation** : Ajouter une assertion `if (callerRole !== 'SUPERADMIN') throw 403` dans `AdminService`. Même chose pour `SubscriptionsService.activatePro`.

### M4. `bootstrapSuperAdmin` — `ON CONFLICT (phone) DO NOTHING` puis `ON CONFLICT (username) DO NOTHING` sont fragiles

- **Fichier** : `backend/src/app.ts` lignes 62-78
- **Description** : Le mécanisme suppose que `tenants.phone` est UNIQUE (sinon l'`ON CONFLICT (phone)` est invalide SQL). Vérifiez la migration `001_create_tenants.sql`. Le `ON CONFLICT (username)` assume que `users.username` est UNIQUE. Si ces contraintes n'existent pas en DB, le boot échoue silencieusement (catch ligne 81-83) et la console affiche une erreur — pas de plantage, mais le SUPERADMIN peut ne pas exister.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Vérifier le `001_create_tenants.sql` et `003_create_users.sql` (assumer UNIQUE(phone) et UNIQUE(username)). Confirmer via `npm run typecheck` + un test d'intégration du boot.

### M5. `toggleTenantStatus` utilise audit action `USER_ENABLED`/`USER_DISABLED` pour un TENANT

- **Fichier** : `backend/src/modules/admin/admin.service.ts` lignes 407-413
- **Description** : L'action `USER_ENABLED` est sémantiquement pour un USER, pas un TENANT. Or le `AuditAction` énumère `TENANT_CREATED` mais pas `TENANT_ENABLED`/`TENANT_DISABLED`. Cette incohérence fausse les filtres `logs?action=USER_ENABLED` ( retourne en réalité des activations de boutiques ), et les statistiques de audit dashboard.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ajouter `TENANT_ENABLED` / `TENANT_DISABLED` au type `AuditAction` (`types/models.ts`), les utiliser dans `toggleTenantStatus`, et prévoir une migration pour corriger les logs historiques.

### M6. `verifyTransaction` autorise n'importe quel `transaction_id` numérique sans contrôle tenant

- **Fichier** : `backend/src/modules/payments/strategies/fedaPayPayment.service.ts` lignes 153-177, et `payments.routes.ts` lignes 174-254
- **Description** : `paymentService.verifyTransaction(transaction_id)` appelle `Transaction.retrieve(Number(transaction_id))` FedaPay. Le `tenantId` n'est vérifié **qu'a posteriori** via le `custom_metadata` du résultat (dans la route, lignes 202-204), mais le code ne compare pas `metadata.tenant_id === currentUser.tenantId`. Un admin d'une boutique B peut donc vérifier une transaction FedaPay appartenant à la boutique A et **activer le PRO de A** si le `custom_metadata.tenant_id` n'est pas vérifié — la route appelle `subscriptionsService.activatePro(tenantId, ...)` avec `tenantId = currentUser.tenantId` (pas celui du metadata), donc en réalité elle active PRO pour SOI avec une transaction d'un autre tenant : détournement de paiement.
- **Sévérité** : **HAUTE** (potentiel de fraude — un tenant peut activer son PRO avec la transaction payée par un autre)
- **Recommandation** : Avant `activatePro`, vérifier `metadata.tenant_id === request.currentUser!.tenantId` ; sinon 403.

### M7. `verify` route — `amount` du `result` est pris au field `amount` sans validation d'integer FCFA

- **Fichiers** : `payments.service.strategies/fedaPayPayment.service.ts` ligne 140, `payments.routes.ts` ligne 226-231
- **Description** : `amount: Number(data.amount)` peut être n'importe quel nombre (entier ou float). La table `payments.amount` a `CHECK (amount > 0)` mais pas `INTEGER` (en migration 017 `amount INTEGER NOT NULL CHECK (amount > 0)`). Si FedaPay renvoie un float comme `5000.50`, l'insert échoue avec `invalid input syntax for type integer`. De plus `create-intent` valide `amount: { minimum: 1 }` mais pas `integer` — un admin peut envoyer `5000.99`.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Dans `payments.routes.ts` schema, utiliser `amount: { type: 'integer', minimum: 1 }`. Arrondir ou rejeter les floats côté `verifyTransaction`.

### M8. `updateSettings` autorise `onboarding_completed = true` sans transition contrôlée

- **Fichier** : `backend/src/modules/settings/settings.service.ts` lignes 38-43, 67-72
- **Description** : `allFields` inclut `onboarding_completed` et `onboarding_step`. Aucune validation qu'on ne saute pas d'étapes (1→5) ou ne dé-valide pas l'onboarding après completion. Un script peut ré-ouvrir l'onboarding indéfiniment.
- **Sévérité** : **FAIBLE/MOYENNE**
- **Recommandation** : Valider les transitions d'énumérations (1..6 max).

### M9. Pagination `limit` illimitée sur `/api/products` GET — count on lit LIMIT $2 OFFSET $3 mais le LIMIT provient du querystring

- **Fichier** : `products.service.ts` line 22, `products.schema.ts` ligne 11 (`maximum: 100`)
- **Description** : Le schema Ajv contraint `limit` à `[1, 100]` — OK. Non-bug. À noter que `logs.routes.ts` autorise `limit: 200` (cohérent),mais `sales.schema.ts` ligne 42 est à `100`. Consistency OK.
- **Sévérité** : N/A (information)

---

## 🟡 PROBLÈMES FAIBLES (FAIBLE)

### F1. `escapeHtml` survient après `toLocaleString()` dans le ticket → potentiel encodage incorrect des chiffres locaux

- **Fichiers** : `backend/src/modules/sales/sales.controller.ts` lignes 142-144, 151, 162-163, 231-236
- **Description** : `Number(item.total_price).toLocaleString()` est rendu tel quel sans `escapeHtml`. `toLocaleString` peut insérer des chiffres arabes (si `navigator.language` du serveur retourne autre chose que français), mais en pratique Node renverra ASCII. Le `escapeHtml` est appliqué ailleurs sur des champs venant de la base (`tenant.name`, `sale.transaction_number`, `sale.momo_reference`) — bonne pratique. RAS critique.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Définir `toLocaleString('fr-FR')` explicitement partout (c'est le cas à ligne 173 et 197 pour le footer, mais pas aux lignes 142-144). Standardiser.

### F2. `image_url` du ticket non validé comme URL HTTPS

- **Fichier** : `backend/src/modules/sales/sales.controller.ts` ligne 202
- **Description** : `src="${escapeHtml(tenant.logo_url)}"` est rendu comme attribut HTML. `escapeHtml` échappe `"` mais pas les URLs `javascript:`. Si l'admin a mis `logo_url = "javascript:alert(1)"` (le `updateTenantProfile` ne valide pas le format de `logo_url`), le ticket imprime `<img src="javascript:alert(1)">` qui ne s'exécute pas en HTML imprimé, mais en `text/html` dynamique peut référencer du contenu externe. Plus grave : `tenant.logo_url` vient en réalité de Cloudinary via `uploadImage` côté `products`, mais pour le profil tenant, `logo_url` peut être modifié via `updateTenantProfile` (champ non dans la whitelist `allowed` — voir H5), donc **non modifiable via cette route**. En revanche, le tenant `bootstrapSuperAdmin` n'a pas de `logo_url`, OK.
- **Sévérité** : **FAIBLE** (mitigé par Cloudinary)
- **Recommandation** : Ne pas ajouter `logo_url` à `allowed` dans `updateTenantProfile` sans valider `^https://`.

### F3. `seedCategoriesForTenant` en dehors de la transaction d'inscription → potentiel échec silencieux

- **Fichiers** : `backend/src/modules/auth/auth.service.ts` lignes 35-151 (transaction), ligne 151 (`seedCategoriesForTenant`)
- **Description** : La création du tenant + abonnement + user + settings + audit logs sont dans une transaction. Mais `seedCategoriesForTenant` est appelée **après** la transaction (ligne 151), hors atomicité. Si elle échoue (réseau DB), le tenant est créé sans catégories "Autres" — or `categories.service.deleteCategory` ligne 117-126 dépend de l'existence de "Autres" et throw 500 si absent. Inscript → sans "Autres" → future suppression de catégorie personnalisée casse.
- **Sévérité** : **FAIBLE** (rare) → borderline **MOYENNE**
- **Recommandation** : Déplacer `seedCategoriesForTenant` dans la transaction (passer `client`), ou au minimum logguer l'erreur et réessayer.

### F4. `logout` — pass-through sans invalidation de token côté serveur

- **Fichiers** : `backend/src/modules/auth/auth.controller.ts` lignes 64-83, `auth.service.ts` lignes 368-390
- **Description** : Le logout écrit un log d'audit mais le JWT reste valide jusqu'à expiration (24h). Vol de token → usage post-logout possible.
- **Sévérité** : **FAIBLE** (comportement attendu de JWT HS256 stateless), mais à connaître.
- **Recommandation** : Implémenter une `denylist` (table `revoked_tokens` ou Redis), ou réduire `JWT_EXPIRES_IN` à 1h avec refresh token.

### F5. `Math.random()` pour le SKU et le code de parrainage — faiblesse cryptographique

- **Fichiers** : `backend/src/utils/sku-generator.ts`, `backend/src/utils/referral-code.ts`
- **Description** : `Math.random()` n'est pas CSPRNG. Le SKU `SKU-XXXXXX` avec 36^6 ≈ 2.2 milliards de combinaisons n'est pas cryptographiquement sensible, mais un attaquant peut **prédire** les futurs SKU et faire des collisions raisonnées.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Utiliser `crypto.randomBytes` pour générer les SKU et codes de parrainage.

### F6. `bootstrapSuperAdmin` log l'erreur sans détailler la stack

- **Fichier** : `backend/src/app.ts` lignes 81-83
- **Description** : `console.error('❌ Échec de l\'initialisation du Super Administrateur :', error)` — `error` est un `unknown`, peut imprimer `[object Object]` en prod. Non bloquant mais peu utile en diagnostic.
- **Sévérité** : **FAIBLE**
- **Recommandation** : `(err as Error).message + (err as any).stack` pour faciliter le debug.

### F7. `listStockMovements` — pas de test d'existence du product_id

- **Fichier** : `backend/src/modules/products/stock.service.ts` lignes 136-186
- **Description** : On filtre par `sm.product_id = $2` sans vérifier que le produit existe et appartient au tenant. Résultat : si l'utilisateur passe un UUID aléatoire, il obtient une liste vide (200 OK) au lieu d'un 404. Coherent avec le fait que la route n'a pas de validation du productId (le schema `getStockMovementsSchema` n'a pas de validation de `id` format UUID dans les params).
- **Sévérité** : **FAIBLE**
- **Recommandation** : Le `getStockMovementsSchema` définit `params` mais pas le pattern UUID pour `id`. Ajouter `id: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' }`.

### F8. `notifications.markAsRead` — pas de vérification que la notif appartient au user

- **Fichiers** : `backend/src/modules/notifications/notifications.service.ts` lignes 41-48, `notifications.routes.ts` lignes 23-33
- **Description** : `markRead` filtre par `tenant_id = $1 AND id = $2` — pas par `user_id`. Un SELLER du tenant peut marquer comme lue une notification destinée à un autre user (tant que `user_id IS NULL` cela n'a pas de sens, mais si `user_id = '<admin>'` le SELLER l'a marque lue). Le controller `markRead` ne passe pas non plus `userId` au service.
- **Sévérité** : **FAIBLE** (les notifications tenant-wide sont partagées) → **MOYENNE** pour confidentialité inter-users d'un tenant.
- **Recommandation** : Ajouter `(user_id = $3 OR user_id IS NULL)` à la clause WHERE, et passer `currentUser.userId`.

### F9. `notifications.routes.ts` — le param `id` n'a pas de validation UUID

- **Fichier** : `backend/src/modules/notifications/notifications.routes.ts` lignes 26-30
- **Description** : `id: { type: 'string' }` sans pattern. Un attaquant peut poster `id = "'; DROP TABLE notifications; --"` qui sera bindé en paramètre $2 (sûr), mais induit des logs superflus et 404 incohérents.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Ajouter le pattern UUID standard.

### F10. `settings.routes.ts` — `vendors/:id` n'a pas de pattern UUID pour `id`

- **Fichiers** : `backend/src/modules/settings/settings.routes.ts` lignes 26, 33-36, 39-42
- **Description** : Le `id` est juste `{ type: 'string' }` partout pour les routes `vendors/:id`. Incohérent avec `products.routes.ts` qui valide `^[0-9a-fA-F]{8}-...`.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Standardiser le pattern UUID dans tous les schemas `params.id`.

### F11. `admin.routes.ts` — `tenantId` et `id` n'ont pas de pattern UUID

- **Fichiers** : `admin.routes.ts` lignes 23-27 (`tenantId`), 63-70 (`id`), 87-94 (`id`)
- **Description** : `tenantId: { type: 'string' }` sans pattern — le SUPERADMIN peut appeler n'importe quel UUID ou pas. Le service `toggleTenantStatus` ne trouve pas le tenant → 404 propre, mais ovffre la surface d'énumération.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Pattern UUID.

### F12. `query()` logge `text.substring(0, 80)` en dev — peut fuir des données sensibles

- **Fichier** : `backend/src/config/database.ts` ligne 38
- **Description** : `console.log('Requête SQL :', { text: text.substring(0, 80), ...})`. La requête `INSERT INTO audit_logs ... 'LOGIN_FAILED', ..., JSON.stringify({reason: 'Identifiant ou mot de passe incorrect'}), ...` contient le `input.identifier` dans la string SQL partial. En dev uniquement, OK.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Filtrer le logging en dev pour ne pas inclure les requêtes `audit_logs`/`payments`.

### F13. `exportSales` date filter non validé

- **Fichier** : `backend/src/modules/exports/exports.routes.ts` lignes 28-32
- **Description** : `from: { type: 'string' }` et `to: { type: 'string' }` sans `format: 'date'`. Incohérent avec `sales.schema.ts` getSalesSchema (lignes 43-44) qui utilise `format: 'date'`.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Ajouter `format: 'date'` pour cohérence.

### F14. `exports.service.ts` — dailyReport `DATE(created_at) = $2` perd l'index

- **Fichier** : `backend/src/modules/exports/exports.service.ts` lignes 66, 75
- **Description** : `WHERE DATE(created_at) = $2` applique une fonction sur la colonne indexée → seq scan. Le module sales et dashboard utilisent plutôt `created_at::date = ...` (qui est mieux mais encore seq scan partiel). Le pattern ideal est `created_at >= $2::date AND created_at < ($2::date + 1)`.
- **Sévérité** : **FAIBLE** (perf)
- **Recommandation** : Utiliser `created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 day')`.

### F15. `exports.service.ts` nom de fichier `${date}` et `${format}` non sanitizés

- **Fichiers** : `exports.controller.ts` lignes 13, 44, 74
- **Description** : `filename = \`products-${...}.${format}\`` — `format` est validé par enum (OK), mais la date est construite via `new Date().toISOString()` (sûre). OK en pratique.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Aucune.

### F16. `pool.on('error')` appelle `process.exit(1)` — pas ideal en serverless

- **Fichier** : `backend/src/config/database.ts` lignes 22-26
- **Description** : Une erreur de pool (rare) provoque exit(1). En Vercel serverless c'est inutile (pas de processus à killer), et sur un long-running server c'est OK mais brutal — préférer recréditer le pool.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Logger seulement et relancer en long-running.

### F17. `FedaPayPaymentService` loggue `apiKey.substring(0, 8)` — fuite partiale de clé en stdout

- **Fichier** : `backend/src/modules/payments/strategies/fedaPayPayment.service.ts` ligne 32
- **Description** : `console.log('💳 FedaPay configuré :', env.FEDAPAY_ENVIRONMENT, '(clé:', apiKey.substring(0, 8) + '...)')`. Log des 8 premiers caractères d'une clé secrète — acceptable en dev, mais en prod ces logs peuvent atterrir dans un aggregator (Vercel, Datadog).
- **Sévérité** : **FAIBLE**
- **Recommandation** : Logger uniquement en dev, ou ne pas afficher la clé du tout.

### F18. `superadminController.toggleTenantStatus` — pas de protection contre la désactivation du tenant système `00000000-...`

- **Fichiers** : `admin.service.ts` lignes 395-416
- **Description** : `toggleTenantStatus` ne filtre pas le tenant système `00000000-...`. Un SUPERADMIN pourrait désactiver la boutique plateforme — pas critique car `checkTenantActive` bypass SUPERADMIN, mais les `bootstrapSuperAdmin` futurs pourraient échouer.
- **Sévérité** : **FAIBLE/MOYENNE**
- **Recommandation** : `WHERE id = $2 AND id != '00000000-0000-0000-0000-000000000000'`.

### F19. `cancelSale` — un SELLER peut annuler une vente faite par un autre SELLER

- **Fichiers** : `sales.routes.ts` ligne 32 (`authorize(['ADMIN','SELLER'])`), `sales.service.ts` lignes 407-557
- **Description** : Aucune vérification que `sale.seller_id === currentUser.userId`. Un SELLER peut annuler une vente faite par un autre SELLER (ou par un ADMIN). Potentiel d'abus / fraude interne (le vendeur A annule une vente du vendeur B pour recréditer le stock et revendre).
- **Sévérité** : **HAUTE** selon le modèle de confiance — **MOYENNE** par prudence.
- **Recommandation** : Restreindre l'annulation par SELLER à ses propres ventes (`AND s.seller_id = $currentUser.userId` si SELLER), ou réserver l'annulation aux ADMIN.

### F20. Doublon: audit log `STOCK_ADJUSTMENT` au lieu de `STOCK_INCREMENT` / `STOCK_DECREMENT` pour les mouvements manuels OUT et IN

- **Fichier** : `backend/src/modules/products/stock.service.ts` ligne 106
- **Description** : Tout mouvement manuel (IN, OUT, ADJUSTMENT) logge `STOCK_ADJUSTMENT` sans distinction. Le type `AuditAction` prévoit `STOCK_DECREMENT`, `STOCK_INCREMENT`, `STOCK_ADJUSTMENT` séparément. Incohérence: une sortie manuelle de stock est logguée comme `STOCK_ADJUSTMENT` alors que dans le module sales une sortie liée à une vente est logguée `STOCK_DECREMENT`. Les filtres `logs?action=STOCK_INCREMENT` ne retourment pas les entrées manuelles.
- **Sévérité** : **FAIBLE/MOYENNE**
- **Recommandation** : Mapper `movement_type === 'IN' → STOCK_INCREMENT`, `'OUT' → STOCK_DECREMENT`, `'ADJUSTMENT' → STOCK_ADJUSTMENT`.

### F21. `sales.controller.ts` ligne 108 — `tenantRes.rows[0]!` sans garde si le tenant n'existe pas

- **Fichier** : `backend/src/modules/sales/sales.controller.ts` ligne 108
- **Description** : `const tenant = tenantRes.rows[0]!;` fait planter le process si le tenant (qui vient du JWT via `tenantId`) n'existe plus en DB (compte supprimé par un SUPERADMIN pendant que l'ADMIN a un token encore valide). Erreur 500 sans message utile. À fortiori `checkTenantActive` (ligne 25) lève 403 `TENANT_INACTIVE` mais seulement si `is_active = false`, pas si le tenant est supprimé en cascade.
- **Sévérité** : **FAIBLE/MOYENNE**
- **Recommandation** : Vérifier `if (!tenant) return reply.status(404)...` avant le deref.

### F22. `sales` `createSale` — pas de validation du nombre max d'items par vente

- **Fichiers** : `sales.schema.ts` ligne 12 (`items: { type: 'array', minItems: 1 }`) — pas de maxItems
- **Description** : Un panier de 10 000 items est accepté et génère 10 000 INSERTs + UPDATEs + audit dans une seule transaction. Risque de timeout / OOM.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ajouter `maxItems: 500` (ou moins).

### F23. `dispatcher auditDecorator` — exécuté sur les routes publiques d'auth (register/login)

- **Fichiers** : `backend/src/middlewares/audit.ts` (définition), `backend/src/modules/auth/auth.routes.ts` ligne 14
- **Description** : `auditDecorator` est attaché sur **toutes** les routes d'auth via `addHook('preHandler', auditDecorator)`. Sur `/register` et `/login`, `request.currentUser` est `undefined`, donc `logAudit` est appelé mais sans user. Le service `auth.service.ts` logue lui-même LOGIN_FAILED/LOGIN_SUCCESS et TENANT_CREATED/USER_CREATED directement via `query()`. Le `logAudit` décorateur n'est pas appelé automatiquement — il décore juste la requête. RAS côté fuite. En revanche, sur `/register`, le controller ne passe jamais par `request.logAudit(...)` — donc l'audit fait dans `authService.register` (lignes 92-117) bypass le `auditDecorator` et insère directement. Cohérent mais duplique la logique.
- **Sévérité** : **FAIBLE** (maintenabilité)
- **Recommandation** : Documenter le pattern ou unifier tout via `request.logAudit`.

### F24. `subscriptionsService.activatePro` accepte `activatedByUserId = undefined` sans validation

- **Fichier** : `admin.service.ts` lignes 30-33
- **Description** : `const effectiveUserId = (activatedByUserId && activatedByUserId !== SYSTEM_USER_ID) ? activatedByUserId : null;` — gère le sentinel. OK si le controller passe toujours `userId` non-null (superadmin). Pour le webhook FedaPay, on passe la constante `00000000-...` → converti en null. C'est intentionnel. Pas un bug.
- **Sévérité** : N/A (information)

### F25. `notifySubscriptionsExpiringSoon` — fenêtre ±12h peut dupliquer pour J-3 vs J-1

- **Fichier** : `admin.service.ts` lignes 237-273
- **Description** : Pour `daysBefore=3`, le filtre SQL sélectionne `end_date BETWEEN NOW + 3d - 12h AND NOW + 3d + 12h`. Les abonnements expirant exactement dans 2.5 jours ( à mi-chemin entre J-3 et J-2 ) sont inclus, mais leur notification est identifiée par `(data->>'days_before') = '3'` et empêche les doublons via le check d'existence sur 24h. OK. Cependant si le cron ne tourne pas pendant >24h une notification J-7 ratée ne sera jamais rattrapée.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Élargir la fenêtre de check idempotent à 36h.

---

## SYNTHÈSE PAR MODULE

| Module | Bugs notables | Sévérité max |
|---|---|---|
| **auth** | Mass assignment (H1/H5 pattern), seedcategories post-tx (F3), logout stateless (F4) | HAUTE |
| **products** | `productBodySchema` sans `additionalProperties:false` (C3), `JSON.stringify(product)` en audit log (H1), `getStartOfToday` UTC bug (M1) | CRITIQUE |
| **stock** | **`is_resolved`/`resolved_at` colonnes inexistantes (C1)** → fait rollback les transactions quand le stock remonte ! | CRITIQUE |
| **sales** | **`is_resolved`/`resolved_at` colonnes inexistantes (C1)** dans `cancelSale` aussi, race sur transaction_number (H2),SELLER peut annuler ventes d'autrui (F19), pas de `maxItems` (F22), ticket URL logo (F2) | CRITIQUE |
| **dashboard** | Doté de queries safe (paramètres bindés, pas de ORDER BY dynamique). Bon module. RAS notable. | — |
| **categories** | RAS, SQL sûre, transaction OK. | — |
| **logs** | Filtres action/entity_type pas enum (C4 weak) | FAIBLE |
| **notifications** | Pas de filtrage `user_id` dans `markAsRead` (F8), param id sans UUID pattern (F9), `ON CONFLICT DO NOTHING` inefficace (C2) | CRITIQUE (C2) |
| **settings** | Body non validé sur `PUT /profile` (H5), `JSON.stringify(data)` en log (H1), `onboarding` transitions non validées (M8), SELLER ne peut pas changer son mdp (H6) | HAUTE |
| **admin** | Action log incohérente `USER_ENABLED` pour tenant (M5), pas de `ON CONFLICT` check sur SUPERADMIN bypass (`AdminService` sans defense-in-depth M3), `start_date = new Date()` (H8), tenant système non protégé (F18) | MOYENNE |
| **payments** | **`/verify` sans `checkTenantActive` (C5)**, pas de rate limit (H3), tenant_id pas vérifié vs metadata FedaPay (M6 → potentiel détournement de paiement), `amount` flottant non validé (M7), `checkout_url` non validé (H4), Content-Type parser global (peut casser les autres routes JSON) | CRITIQUE/Haute |
| **exports** | `from`/`to` sans `format: date` (F13), `DATE(created_at)` seq scan (F14), `audit_logs` sans username/user_role | FAIBLE |

---

## PRIORITÉ DE CORRECTION (top 10)

1. **C1** — Ajouter une migration `019` pour `notifications.is_resolved`+`resolved_at` OU supprimer les UPDATE dans `stock.service.ts`/`sales.service.ts`. Sans ça, `cancelSale` est cassée.
2. **C2** — Ajouter une contrainte unique fonctionnelle sur `notifications` ou faire un SELECT d'existence avant INSERT.
3. **C3** — `additionalProperties: false` sur `productBodySchema`.
4. **M6/H6** — Vérifier `metadata.tenant_id === currentUser.tenantId` dans `/api/payments/verify`.
5. **C5** — `checkTenantActive` sur `/api/payments/verify`.
6. **F19** — Restreindre l'annulation de vente à `seller_id === currentUser.userId` (SELLER) ou ADMIN only.
7. **H2** — Utiliser une SEQUENCE PostgreSQL pour `transaction_number`.
8. **H1** — Ne jamais `JSON.stringify(data)` ; logger le diff whitelisté.
9. **H6** — Autoriser `SELLER` sur `PUT /api/settings/password`.
10. **H5** — Schema Ajv sur `PUT /api/settings/profile`.

---

## Ce que j'ai fait

- Lu **chaque fichier** des 11 modules backend (routes, controllers, services, schemas) + middlewares (auth, rbac, tenant, audit, rate-limit) + config (env, database, jwt) + utils (token, password, referral-code, sku-generator, date) + app.ts + scheduler + plugins (cors, cloudinary) + migrations SQL pertinentes (002, 005, 006, 010, 011, 017, 018).
- Vérifié les contraintes DB réelles contre le supposé code SQL (notamment colonnes `is_resolved`/`resolved_at` absentes).
- Confirmé les findings via `grep` croisé когда search_files échouait sur les chemins Windows à espaces.

## Ce que j'ai trouvé

- **38 problèmes** total : 5 CRITIQUE, 8 HAUTE, ~10 MOYENNE, ~15 FAIBLE.
- **Le plus grave** : les colonnes `is_resolved`/`resolved_at` inexistantes en DB → `cancelSale` et mouvements de stock entrants casca-dent en ROLLBACK silencieux mais bruyant (exception SQL).
- **Le plus subtil** : la route `/api/payments/verify` ne vérifie pas que le `tenant_id` du metadata FedaPay correspond au `tenant_id` du JWT — détournement de paiement possible.
- **Le plus gênant en prod** : `deleteImage(oldPublicId).catch(...)` non awaited (products.controller ligne 212) — fire-and-forget ok ; mais `api/index.ts` serverless content-type parser global (`addContentTypeParser('application/json', { parseAs: 'string' }, ...)`) sur tout le scope `paymentsRoutes` — à vérifier qu'il ne casse pas les autres routes.

## Fichiers créés/modifiés

- **Aucun fichier modifié** (audit read-only, conformément à la consigne "audit complet").

## Issues rencontrés

- `search_files` (ripgrep) échoue systématiquement sur ce chemin Windows avec espace (`C:\Users\LENOVO LOQ\...`), j'ai basculé sur `grep -rn` via le terminal `git-bash` qui fonctionne.
- `read_file` fonctionne parfaitement avec les paths natifs Windows, Lectures >500 lignes tronquées → continuation via `offset` (fait pour `sales.service.ts` et `admin.service.ts`).

Le rapport complet ci-dessus est le livrable. Je peux maintenant, sur demande explicite, produire les patches de correction pour n'importe quel item de la liste prioritaire.