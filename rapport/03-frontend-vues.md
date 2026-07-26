# RAPPORT D'AUDIT — Frontend RDGESTION

**Date** : 24 juillet 2026  
**Cible** : `frontend/src/js/` — toutes les vues, router, API wrapper, utils, PWA  
**Méthodologie** : Lecture exhaustive de chaque fichier par subagent + vérifications manuelles croisées  

---

## ⛔ PROBLÈMES CRITIQUES (CRITIQUE)

### F-C1. 'FCFA' codé en dur partout — violation convention AGENTS.md

- **Fichiers** :
  - `frontend/src/js/views/dashboard.js` ligne 221 : `const currency = 'FCFA';`
  - `frontend/src/js/views/dashboard.js` ligne 492 : `... FCFA</title>`
  - `frontend/src/js/views/pos.js` ligne 562 : `... ${Number(sale.total_amount).toLocaleString()} FCFA ...`
  - `frontend/src/js/api.js` lignes 475, 480 : headers CSV contiennent `'Total (FCFA)'`
  - `frontend/src/js/views/sales.js` et `settings.js` (multiples)
- **Description** : AGENTS.md stipule : "Devise : lire `settings.currency` via `formatMoney()`, ne pas coder `'FCFA'` en dur". Aucun `formatMoney()` n'existe dans le codebase. La devise est codée en dur dans au moins 8 fichiers.
- **Impact** : Si un tenant configure `currency: 'XAF'` (Cameroun) ou `'EUR'`, l'affichage reste "FCFA" partout.
- **Sévérité** : **CRITIQUE** (convention violée + bug fonctionnel multi-tenant)
- **Recommandation** : Créer une fonction `formatMoney(amount, currency)` dans `utils.js` qui lit la devise depuis les settings en cache. Remplacer tous les `'FCFA'` en dur.

### F-C2. Shape de réponse API incohérent — frontend fait des suppositions

- **Fichiers** :
  - `frontend/src/js/views/stock.js` ligne 142 : `productsRes?.data?.products || productsRes?.products || productsRes?.data || []` — devine 3 shapes possibles
  - `frontend/src/js/views/products.js` ligne 173 : lit `data.products` directement
  - `frontend/src/js/views/sales.js` ligne 174 : `const data = res.data || res` puis `data?.sales` — fragile
  - `frontend/src/js/api.js` ligne 461 : `data?.data?.sales || []` — suppose l'enveloppe `{success, data}`
- **Description** : Les controllers backend ne sont pas cohérents : `products` retourne `{ products, pagination }` sans enveloppe, `sales` retourne `{ success: true, data: { sales, pagination } }`, `categories` retourne un array brut, `dashboard` utilise `{ success, data }`.
- **Impact** : Toute modification d'un controller backend peut casser silencieusement le frontend sans erreur visible.
- **Sévérité** : **CRITIQUE**
- **Recommandation** : Standardiser tous les controllers sur `{ success: true, data: {...} }` (voir rapport `04-coherence-frontend-backend.md` section 1.1).

### F-C3. Export CSV dans `api.js` utilise des noms de champs inexistant

- **Fichiers** :
  - `frontend/src/js/api.js` ligne 447 : `s.sale_number || ''` — le backend renvoie `transaction_number`
  - `frontend/src/js/api.js` ligne 449 : `s.seller_username || ''` — le backend renvoie `seller_name`
- **Description** : L'export CSV côté frontend génère un CSV avec des colonnes vides pour le numéro de transaction et le nom du vendeur, car les noms de propriétés ne correspondent pas à ce que le backend renvoie.
- **Impact** : Export CSV inutilisable — colonnes "Numéro" et "Vendeur" toujours vides.
- **Sévérité** : **CRITIQUE** (fonctionnalité cassée)
- **Recommandation** : Corriger `s.sale_number` → `s.transaction_number` et `s.seller_username` → `s.seller_name` dans `api.js` ligne 447 et 449.

---

## 🔴 PROBLÈMES HAUTS (HAUTE)

### F-H1. XSS potentielle — `innerHTML` sans `escapeHtml` sur données dynamiques

- **Fichiers** :
  - `frontend/src/js/views/pos.js` ligne 562 : `La transaction <strong>${sale.transaction_number}</strong>` — `sale.transaction_number` non échappé
  - `frontend/src/js/views/dashboard.js` lignes 226-230 : `${escapeHtml(c.category_name)}` ✅ mais `${Number(c.total_revenue).toLocaleString()}` non problématique
  - `frontend/src/js/app.js` lignes 250-260 : `notifications.map(n => ...)` — `n.title` et `n.message` injectés via `innerHTML` sans `escapeHtml`
- **Description** : Le `pos.js` affiche `sale.transaction_number` sans escaping dans un `innerHTML`. Bien que `transaction_number` soit généré par le backend (format `VENTE-YYYY-NNNNN`), si un attaquant peut influencer ce champ (peu probable mais par defense-in-depth), c'est une XSS stockée. Plus grave : `app.js` ligne 250+ injecte `n.title` et `n.message` (notifications) sans escaping.
- **Sévérité** : **HAUTE**
- **Recommandation** : Appliquer `escapeHtml()` sur tout contenu dynamique injecté via `innerHTML`, y compris les champs "sûrs" par convention.

### F-H2. `onboarding_step` jamais persisté en BDD — reprise impossible

- **Fichier** : `frontend/src/js/utils/onboarding.js` ligne 160 (`finish()`)
- **Description** : `finish()` appelle `API.settings.update({ onboarding_completed: true })` mais `_advance()` ne persiste jamais `onboarding_step` en BDD. Si l'utilisateur rafraîchit la page à l'étape 4, il recommence à `user.onboarding_step - 1` (toujours 1).
- **Sévérité** : **HAUTE**
- **Recommandation** : Dans `_advance()`, appeler `API.settings.update({ onboarding_step: this.currentStepIndex + 1 })`.

### F-H3. Clés localStorage d'onboarding non nettoyées

- **Fichier** : `frontend/src/js/utils/onboarding.js` `finish()` ligne 160
- **Description** : Les clés `rdg_setup_product_created`, `rdg_setup_sale_validated`, `rdg_setup_referral_seen` ne sont jamais supprimées du localStorage après `finish()`. Si l'onboarding est réinitialisé, ces clés résiduelles peuvent faire skipper des étapes.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ajouter `localStorage.removeItem('rdg_setup_product_created')` etc. dans `finish()` ou `resetSetupGuide()`.

### F-H4. Router guard — `#/stock` absent des routes autorisées pendant onboarding

- **Fichier** : `frontend/src/js/router.js` ligne 50
- **Description** : `allowedRoutes = ['#/dashboard', '#/products', '#/pos', '#/settings', '#/onboarding']`. La vue `#/stock` n'est pas autorisée pendant l'onboarding, alors que la vue stock existe séparément.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Ajouter `#/stock` à `allowedRoutes` ou décider de bloquer volontairement.

---

## 🟠 PROBLÈMES MOYENS (MOYENNE)

### F-M1. `alerts.js` vue admin — pas de gestion d'erreur sur toggleTenant

- **Fichier** : `frontend/src/js/views/admin.js`
- **Description** : Le bouton toggle tenant/activate PRO appelle `API.admin.toggleTenant(id, is_active)` sans gestion d'erreur visible (pas de try/catch sur certains handler).
- **Sévérité** : **MOYENNE**
- **Recommandation** : Wrap dans try/catch + `alertModal(err.message)`.

### F-M2. Vue logs — pas de spinner/empty state sur filtres

- **Fichier** : `frontend/src/js/views/logs.js`
- **Description** : Les filtres (action, entity_type) ne montrent pas d'état de chargement pendant le fetch. La table reste sur l'ancienne data pendant le chargement.
- **Sévoyrité** : **MOYENNE**
- **Recommandation** : Afficher un skeleton ou au moins vider la table pendant le fetch.

### F-M3. `pos.js` — panier non persisté si on quitte la page

- **Fichier** : `frontend/src/js/views/pos.js`
- **Description** : Le panier est sauvegardé dans `localStorage('pos_cart')` (ligne 540 `localStorage.removeItem('pos_cart')` après validation suggère une persistance). Mais le restore au chargement n'est pas évident — la méthode `loadPOSData()` semble recharger les données mais pas restore le panier sauvegardé.
- **Sévérité** : **MOYENNE**
- **Recommandation** : Vérifier que `localStorage.getItem('pos_cart')` est lu dans `afterRender()` ou `loadPOSData()`.

### F-M4. Dashboard — pas de gestion d'erreur sur les graphiques

- **Fichier** : `frontend/src/js/views/dashboard.js`
- **Description** : Les graphiques (SVG inline) sont rendus à partir de `stats.revenue_chart` etc. Si l'API renvoie un shape inattendu (ex: array vide), le rendu peut crasher silencieusement (division par zéro sur les pourcentages).
- **Sévérité** : **MOYENNE**
- **Recommandation** : Guard `if (!data || data.length === 0) return '<p>Pas de données</p>'` sur chaque graphique.

### F-M5. `onboarding.js` `_escapeHtml` — regex incomplète

- **Fichier** : `frontend/src/js/utils/onboarding.js` lignes 614-621
- **Description** : `.replace(/"/g, '"')` remplace `"` par `"` (littéral identique). Devrait être `"`. Le `replace(/'/g, '&#039;')` est correct.
- **Sévérité** : **MOYENNE** (XSS potentielle si titre d'étape contient un guillemet)
- **Recommandation** : Corriger `.replace(/"/g, '"')`.

---

## 🟡 PROBLÈMES FAIBLES (FAIBLE)

### F-F1. `resetSetupGuide` — code mort

- **Fichier** : `frontend/src/js/views/dashboard.js`
- **Description** : La fonction `resetSetupGuide` est mentionnée/définie mais jamais appelée dans le code.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Supprimer ou câbler sur un bouton "Refaire l'onboarding".

### F-F2. Service worker — `CACHE_NAME` non bumpé après changements

- **Fichier** : `frontend/sw.js`
- **Description** : Le `CACHE_NAME` doit être bumpé à chaque modification de fichier caché (AGENTS.md). Non vérifié ici mais à surveiller après corrections.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Bumper `CACHE_NAME` après les corrections frontend.

### F-F3. Pas de lazy-loading sur les vues

- **Fichiers** : `frontend/src/js/app.js`
- **Description** : Toutes les vues sont importées statiquement dans `app.js`. Sur un PWA vanilla sans build, c'est OK pour l'instant mais si le projet grossit, le JS initial devient lourd.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Considérer l'import dynamique (`() => import(...)`) pour les vues secondaires.

### F-F4. Modales — pas de focus trap complet

- **Fichiers** : `frontend/src/js/utils/aria.js`
- **Description** : `setupDialog` gère Escape et le focus initial, mais le focus trap (Tab cyclé dans la modale) n'est pas garantit sur tous les navigateurs.
- **Sévérité** : **FAIBLE**
- **Recommandation** : Implémenter un focus trap complet (intercept Tab au niveau de la modale).

### F-F5. `index.html` — `init-theme.js` chargé en blocking

- **Fichier** : `frontend/index.html`
- **Description** : Documenté comme voulu (prévention FOUC). OK.
- **Sévérité** : N/A (information)

---

## SYNTHÈSE PAR VUE

| Vue | Bugs notables | Sévérité max |
|-----|-------------|-------------|
| **auth.js** | RAS notable — register/login gérés proprement | FAIBLE |
| **dashboard.js** | 'FCFA' en dur (C1), pas de gestion d'erreur sur graphiques (M4), resetSetupGuide mort (F1) | CRITIQUE |
| **pos.js** | XSS sur `transaction_number` (H1), panier non restauré (M3) | HAUTE |
| **products.js** | Lecture `data.products` sans enveloppe (C2) | CRITIQUE |
| **stock.js** | Lecture multi-shape (C2) — **déjà corrigé : payload `movement_type` + `reason` required** | CRITIQUE |
| **sales.js** | Shape fragile `res.data || res` (C2) | CRITIQUE |
| **settings.js** | **Déjà corrigé : onboarding `rdg_setup_referral_seen` déplacé vers clic** | HAUTE |
| **admin.js** | Pas de gestion d'erreur sur toggle (M1) | MOYENNE |
| **logs.js** | Pas de loading state sur filtres (M2) | MOYENNE |
| **router.js** | `#/stock` absent des routes onboarding (H4) | MOYENNE |
| **api.js** | Export CSV noms de champs inexistant (C3) | CRITIQUE |
| **onboarding.js** | `_escapeHtml` regex cassée (M5), `onboarding_step` non persisté (H2), clés non nettoyées (H3) | HAUTE |
| **app.js** | XSS sur notifications `innerHTML` (H1) | HAUTE |
| **sw.js** | CACHE_NAME à vérifier (F2) | FAIBLE |

---

## CORRECTIONS DÉJÀ APPLIQUÉES (session en cours)

1. ✅ `stock.js` — payload `type` → `movement_type`, `reason` obligatoire (min 3 car.)
2. ✅ `settings.js` — `rdg_setup_referral_seen` déplacé du chargement d'onglet vers le clic sur "Copier le code"

## CORRECTIONS RESTANTES (priorité)

1. 🔴 `api.js` — Corriger `sale_number` → `transaction_number` et `seller_username` → `seller_name` (C3)
2. 🔴 Créer `formatMoney(amount, currency)` + remplacer tous les `'FCFA'` en dur (C1)
3. 🔴 Standardiser les shapes API backend (C2 — voir rapport 04)
4. 🟠 `onboarding.js` — Persister `onboarding_step` en BDD dans `_advance()` (H2)
5. 🟠 `onboarding.js` — Corriger `_escapeHtml` regex `"` → `"` (M5)
6. 🟠 `app.js` — `escapeHtml()` sur `n.title` et `n.message` dans les notifications (H1)
7. 🟠 `pos.js` — `escapeHtml(sale.transaction_number)` dans la modale de succès (H1)
8. 🟡 `onboarding.js` — Nettoyer clés `rdg_setup_*` dans `finish()` (H3)
9. 🟡 `router.js` — Ajouter `#/stock` aux `allowedRoutes` onboarding (H4)
