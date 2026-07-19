# AGENTS.md — Guide pour les agents IA travaillant sur RDGESTION

> Ce fichier centralise les conventions, commandes, architecture et pièges à éviter pour tout agent IA (Claude, Copilot, etc.) intervenant sur le codebase RDGESTION.

## 📋 Vue d'ensemble du projet

**RDGESTION** est une application SaaS multi-tenant de gestion de stock et point de vente (POS) destinée aux commerces de détail (pharmacies, boutiques, etc.) en Afrique de l'Ouest. Le projet vise une complétude d'environ 85% du cahier des charges.

- **Stack** : Node.js + TypeScript + Fastify (backend), Vanilla JS PWA (frontend), PostgreSQL (Aiven)
- **Déploiement** : Vercel (serverless) + frontend statique
- **Multi-tenant** : Isolation via `tenant_id` injecté depuis le JWT
- **Auth** : Argon2id + JWT HS256 (24h), 3 rôles : `SUPERADMIN`, `ADMIN`, `SELLER`
- **Abonnements** : `FREE` (30 ventes/jour), `PRO_MONTHLY`, `PRO_LIFETIME`

## 🏗️ Architecture

### Structure du monorepo
```
rdgestion/
├── backend/          # API Fastify + TypeScript (SOLID)
│   └── src/
│       ├── app.ts                 # Point d'entrée + bootstrap SuperAdmin
│       ├── config/                # env.ts, database.ts
│       ├── database/              # migrations SQL + seed
│       ├── middlewares/           # authenticate, authorize, rate-limit
│       ├── modules/               # 11 modules métier (SOLID)
│       ├── plugins/               # cors, swagger, cloudinary
│       ├── scheduler/             # expiration abonnements (CRON)
│       ├── types/                 # models.ts (enums, interfaces)
│       └── utils/                 # password, validators, etc.
├── frontend/         # PWA vanilla HTML/CSS/JS (pas de build)
│   └── src/
│       ├── js/
│       │   ├── api.js             # Wrapper fetch + loading global
│       │   ├── app.js             # Bootstrap + routing
│       │   ├── router.js          # Hash-based routing
│       │   ├── init-theme.js      # Prévention FOUC (chargé en blocking)
│       │   ├── utils/ui.js        # Toast, withLoading, Skeletons
│       │   └── views/             # Une vue par page (auth, dashboard, pos, etc.)
│       └── css/                   # style.css, components.css, pos.css, layout.css
├── api/              # Point d'entrée Vercel serverless (api/index.ts)
├── e2e/              # Tests Playwright
├── RDGESTION/        # Documentation originale du cahier des charges (00-24)
└── md/               # Suivi projet (avance.md, planing.md, conv.md, etc.)
```

### Backend — Architecture SOLID par module
Chaque module dans `backend/src/modules/<module>/` suit la séparation :
- **`*.routes.ts`** : Définit les endpoints + attache les middlewares (auth, RBAC, checkTenantActive)
- **`*.controller.ts`** : Valide l'input via Ajv, appelle le service, formate la réponse
- **`*.service.ts`** : Toute la logique métier + accès PostgreSQL via `query()`
- **`*.schema.ts`** : Schémas de validation Ajv (request/response)

### Frontend — Vanilla JS sans build
- **Routing** : Hash-based (`#/login`, `#/dashboard`, etc.) dans `router.js`
- **API** : `api.js` expose un objet `API` namespace par module ; tout appel déclenche la barre de chargement globale
- **Feedback UX** : `utils/ui.js` fournit `Toast`, `withLoading()`, `Skeletons` — **zéro `alert()`/`confirm()`**
- **Thème** : `init-theme.js` chargé en blocking pour éviter le FOUC ; persistance `localStorage.theme`
- **PWA** : `manifest.json` + `sw.js` (Stale-While-Revalidate)

## 🛠️ Commandes de développement

### Depuis la racine du monorepo
| Commande | Description |
|---|---|
| `npm run dev` | Démarre le backend avec `tsx watch` (port 8080) |
| `npm run build:backend` | Compile le backend TypeScript (`tsc`) |
| `npm run start` | Lance le backend compilé |
| `npm run typecheck` | Vérification des types (`tsc --noEmit`) |
| `npm run test:backend` | Lance les tests Vitest |
| `npm run test:e2e` | Lance les tests Playwright |

### Depuis `backend/`
| Commande | Description |
|---|---|
| `npm run dev` | `tsx watch src/app.ts` |
| `npm run build` | `tsc` → `dist/` |
| `npm run migrate` | Exécute les migrations SQL |
| `npm run seed` | Seed les catégories initiales |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` (watch mode) |

### Frontend
Le frontend n'a **pas de build**. Il est servi en fichiers statiques. Pour tester localement, démarrer le backend qui sert le frontend via `@fastify/static`.

## 🎨 Conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichiers | `kebab-case` | `auth.controller.ts` |
| Variables/Fonctions | `camelCase` | `getUserById` |
| Types/Interfaces | `PascalCase` | `SaleItem`, `TenantProfile` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_DAILY_SALES_FREE` |
| Tables/Colonnes SQL | `snake_case` | `tenant_id`, `created_at` |
| Modules backend | Un dossier par domaine | `modules/sales/` |

## 📡 Conventions API

### Enveloppe de réponse standard
```json
{ "success": true, "data": { ... } }
```
> ⚠️ **Toute modification de shape** doit synchroniser frontend + backend + bump `CACHE_NAME` dans `sw.js`.

### Codes d'erreur métier (avec statut HTTP approprié)
`STOCK_INSUFFICIENT`, `MOMO_REFERENCE_REQUIRED`, `DAILY_LIMIT_REACHED`, `SUBSCRIPTION_EXPIRED`, `DISCOUNT_EXCEEDS_MAX`, `PRO_REQUIRED`, `INVALID_CREDENTIALS`

### Middlewares standards sur routes protégées
```typescript
{ preHandler: [authenticate, authorize(['ADMIN']), checkTenantActive] }
```

## 🔐 Sécurité — Règles critiques

1. **`escapeHtml`/`escapeAttr`** systématique pour tout contenu dynamique injecté via `innerHTML`
2. **JWT_SECRET** : refuser le boot en production si < 32 octets ou si placeholder `change_me...`
3. **SSL PostgreSQL** : `rejectUnauthorized: false` documenté pour Aiven ; log warning en prod
4. **`referral_code`** : vérifier l'unicité en base avant insert (boucle retry sur collision)
5. **Masquer `error.stack`** en production (ne renvoyer que `message`)
6. **Exclusion tenant plateforme** (`00000000-...`) côté backend, pas frontend
7. **Argon2id** pour le hash des mots de passe (jamais MD5/SHA simple)

## 🗄️ Base de données

- **SGBD** : PostgreSQL (Aiven cloud)
- **Multi-tenant** : `tenant_id` sur toutes les tables métier
- **15 migrations** dans `backend/src/database/migrations/`
- **Triggers SQL** : migration 013 (timestamps automatiques, etc.)
- **Table manquante connue** : `payments` (historique transactions — à implémenter)
- **Pool** : `pg-pool` via `config/database.ts`

## 📦 Modules backend (11)

| Module | Rôle | Gate PRO |
|---|---|---|
| `auth` | Register, login, logout, vendors, password | — |
| `products` | CRUD + corbeille + restauration + stock | — |
| `categories` | CRUD + réassignation « Autres » | PRO pour custom |
| `sales` | Vente transactionnelle + annulation + ticket | Quota FREE 30/j |
| `dashboard` | Stats + graphiques 4 périodes + alertes | — |
| `logs` | Audit 20+ types d'actions + filtres | — |
| `notifications` | Centre + badge + polling 30s | — |
| `settings` | Profil + ticket + vendeurs + parrainage | PRO pour ticket |
| `admin` | SuperAdmin : tenants, stats, activate PRO | SUPERADMIN |
| `payments` | PaymentService abstrait + FedaPay stub | — |
| `exports` | PDF/Excel (products, sales, daily-report) | PRO uniquement |

## ⚠️ Pièges et points d'attention

### Vercel serverless
- **`setInterval` ne fonctionne pas** en serverless → utiliser `/api/cron/*` protégé par `CRON_SECRET` ou un cron externe
- **`pdfkit`** peut nécessiter des binaires de polices → alternative `pdf-lib` pur JS ou génération côté frontend (`jsPDF`)
- **Cold starts** : skip DB init sur Vercel (optimisation déjà en place)

### Frontend
- **`init-theme.js`** doit rester chargé en blocking dans `index.html` (avant `app.js`) pour éviter le FOUC
- **Ne pas utiliser `window.location.reload()`** après update profil → mettre à jour réactivement
- **Devise** : lire `settings.currency` via `formatMoney()`, ne pas coder `'FCFA'` en dur
- **Placeholder image** : utiliser un SVG inline data-URI, pas `placehold.co` (dépendance réseau)
- **`sw.js`** : bump `CACHE_NAME` à chaque changement de shape API

### Tests
- **Vitest** : config CJS/ESM — vérifier `"type": "module"` ou `vitest.config.ts`
- **Couverture cible** : ≥ 70% sur `src/modules/`
- **Playwright** : validation obligatoire après chaque étape UI (desktop 1280×800 + mobile 375×800 + dark/light theme)

### Dette technique connue (voir `md/planing.md` pour le détail)
- Tests backend : 2 fichiers / 11 modules (couverture faible)
- Tests E2E : config Playwright présente mais specs incomplets
- CI/CD GitHub Actions : absent
- `any` explicite omniprésent (~110 occurrences) — `tsconfig` strict mais `any` autorisé
- Fichiers résiduels à nettoyer à la racine

## 📚 Documentation de référence

| Fichier | Contenu |
|---|---|
| `RDGESTION/00-24_*.md` | Cahier des charges original complet |
| `md/CLAUDE.md` | Guide Claude Code (commandes, architecture) |
| `md/planing.md` | Audit écarts spec vs code + plan d'implémentation 9 étapes |
| `md/avance.md` | Rapport d'avancement par module (scores %) |
| `md/PRODUCT.md` | Description produit, personas, principes de design |
| `md/conv.md` | Notes de conversation et objectifs UX |
| `md/test_gui.md` | Rapports de tests GUI (parcours, bugs corrigés) |

## ✅ Checklist avant de déclarer une tâche terminée

1. [ ] `npm run typecheck` vert
2. [ ] `npm run lint` vert (si configuré)
3. [ ] Tests Vitest pertinents passants
4. [ ] Validation Playwright (si UI) : desktop + mobile + dark/light + console sans erreur
5. [ ] `escapeHtml`/`escapeAttr` appliqué sur tout `innerHTML` dynamique
6. [ ] Enveloppe API `{ success, data }` préservée
7. [ ] `CACHE_NAME` bumpé dans `sw.js` si shape API modifiée
8. [ ] Audit logs ajoutés pour toute nouvelle action métier
9. [ ] Gate PRO vérifié pour les features premium
10. [ ] Ne commit que sur demande explicite de l'utilisateur

## 🚀 Démarrage rapide pour un nouvel agent

```bash
# 1. Installer les dépendances
cd backend && npm install && cd .. && npm install

# 2. Configurer les variables d'env (voir .env.example)
#    DATABASE_URL, JWT_SECRET, SUPERADMIN_PHONE, SUPERADMIN_PASSWORD, etc.

# 3. Lancer les migrations + seed
cd backend && npm run migrate && npm run seed

# 4. Démarrer le backend (sert aussi le frontend en statique)
npm run dev  # → http://localhost:8080

# 5. Vérifier
npm run typecheck
npm run test:backend
```

**Compte SuperAdmin de test** : voir `SUPERADMIN_PHONE` / `SUPERADMIN_PASSWORD` dans `.env`
**Compte boutique de test** : `+22890765432` / `pharmacietestgui-374` (voir `md/test_gui.md`)
