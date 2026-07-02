# 07 — Architecture Technique Complète

## 7.1 Arborescence du projet

```
RDGESTION/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          # Configuration connexion PostgreSQL (pg-pool)
│   │   │   ├── env.ts               # Chargement et validation des variables .env
│   │   │   └── jwt.ts               # Configuration JWT (secret, durée, algorithme)
│   │   │
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   │   ├── 001_create_tenants.sql
│   │   │   │   ├── 002_create_subscriptions.sql
│   │   │   │   ├── 003_create_users.sql
│   │   │   │   ├── 004_create_categories.sql
│   │   │   │   ├── 005_create_products.sql
│   │   │   │   ├── 006_create_sales.sql
│   │   │   │   ├── 007_create_sale_items.sql
│   │   │   │   ├── 008_create_audit_logs.sql
│   │   │   │   ├── 009_create_referrals.sql
│   │   │   │   ├── 010_create_notifications.sql
│   │   │   │   └── 011_create_settings.sql
│   │   │   ├── seed/
│   │   │   │   └── categories.ts     # Catégories prédéfinies par type de commerce
│   │   │   └── migrate.ts            # Script d'exécution des migrations
│   │   │
│   │   ├── middlewares/
│   │   │   ├── auth.ts               # Vérification JWT
│   │   │   ├── rbac.ts               # Contrôle de rôle (RBAC)
│   │   │   ├── tenant.ts             # Injection du tenant_id depuis le JWT
│   │   │   ├── rate-limit.ts         # Configuration rate limiting
│   │   │   └── audit.ts              # Middleware de logging automatique
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.schema.ts    # Schémas Ajv de validation
│   │   │   │   └── auth.routes.ts
│   │   │   │
│   │   │   ├── products/
│   │   │   │   ├── products.controller.ts
│   │   │   │   ├── products.service.ts
│   │   │   │   ├── products.schema.ts
│   │   │   │   └── products.routes.ts
│   │   │   │
│   │   │   ├── categories/
│   │   │   │   ├── categories.controller.ts
│   │   │   │   ├── categories.service.ts
│   │   │   │   └── categories.routes.ts
│   │   │   │
│   │   │   ├── sales/
│   │   │   │   ├── sales.controller.ts
│   │   │   │   ├── sales.service.ts
│   │   │   │   ├── sales.schema.ts
│   │   │   │   └── sales.routes.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.controller.ts
│   │   │   │   ├── dashboard.service.ts
│   │   │   │   └── dashboard.routes.ts
│   │   │   │
│   │   │   ├── logs/
│   │   │   │   ├── logs.controller.ts
│   │   │   │   ├── logs.service.ts
│   │   │   │   └── logs.routes.ts
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   ├── notifications.controller.ts
│   │   │   │   ├── notifications.service.ts
│   │   │   │   └── notifications.routes.ts
│   │   │   │
│   │   │   ├── subscriptions/
│   │   │   │   ├── subscriptions.controller.ts
│   │   │   │   ├── subscriptions.service.ts
│   │   │   │   └── subscriptions.routes.ts
│   │   │   │
│   │   │   ├── referrals/
│   │   │   │   ├── referrals.controller.ts
│   │   │   │   ├── referrals.service.ts
│   │   │   │   └── referrals.routes.ts
│   │   │   │
│   │   │   ├── exports/
│   │   │   │   ├── exports.controller.ts
│   │   │   │   ├── exports.service.ts
│   │   │   │   └── exports.routes.ts
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── settings.controller.ts
│   │   │   │   ├── settings.service.ts
│   │   │   │   └── settings.routes.ts
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── admin.controller.ts
│   │   │       ├── admin.service.ts
│   │   │       └── admin.routes.ts
│   │   │
│   │   ├── plugins/
│   │   │   ├── swagger.ts            # Configuration Swagger/OpenAPI
│   │   │   └── cors.ts               # Configuration CORS
│   │   │
│   │   ├── utils/
│   │   │   ├── password.ts           # Fonctions Argon2id (hash, verify)
│   │   │   ├── token.ts              # Fonctions JWT (sign, verify)
│   │   │   ├── sku-generator.ts      # Générateur de SKU automatique
│   │   │   ├── referral-code.ts      # Générateur de code de parrainage
│   │   │   └── date.ts               # Utilitaires de date/heure
│   │   │
│   │   ├── types/
│   │   │   ├── fastify.d.ts          # Augmentation des types Fastify
│   │   │   └── models.ts             # Types TypeScript des modèles
│   │   │
│   │   └── app.ts                    # Point d'entrée Fastify
│   │
│   ├── tests/
│   │   ├── auth.test.ts
│   │   ├── products.test.ts
│   │   ├── sales.test.ts
│   │   └── ...
│   │
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/
│   ├── css/
│   │   ├── variables.css             # Variables CSS (couleurs, spacing, fonts, thèmes)
│   │   ├── reset.css                 # Reset CSS moderne
│   │   ├── base.css                  # Styles de base (body, typography)
│   │   ├── components.css            # Boutons, cartes, formulaires, modales, badges
│   │   ├── layout.css                # Grille, sidebar, header, responsive
│   │   ├── pos.css                   # Styles spécifiques au POS
│   │   ├── dashboard.css             # Styles spécifiques au dashboard
│   │   ├── animations.css            # Micro-animations, transitions, skeleton loaders
│   │   ├── print.css                 # Styles d'impression pour les tickets
│   │   └── themes.css                # Thème sombre / clair
│   │
│   ├── js/
│   │   ├── app.js                    # Point d'entrée JS, router côté client
│   │   ├── api.js                    # Client HTTP (fetch wrapper avec token JWT)
│   │   ├── auth.js                   # Logique d'authentification
│   │   ├── dashboard.js              # Logique du dashboard + graphiques
│   │   ├── products.js               # CRUD produits côté client
│   │   ├── pos.js                    # Logique complète du POS
│   │   ├── sales.js                  # Historique des ventes
│   │   ├── logs.js                   # Consultation des logs
│   │   ├── notifications.js          # Centre de notifications
│   │   ├── settings.js               # Paramètres
│   │   ├── theme.js                  # Basculement thème sombre/clair
│   │   └── utils.js                  # Utilitaires (formatage monnaie, dates)
│   │
│   ├── assets/
│   │   ├── icons/                    # Icônes SVG
│   │   └── images/                   # Images statiques
│   │
│   ├── index.html                    # Page d'accueil / landing page
│   ├── register.html                 # Inscription
│   ├── login.html                    # Connexion
│   ├── onboarding.html               # Sélection type de commerce
│   ├── dashboard.html                # Dashboard gérant
│   ├── products.html                 # Liste des produits
│   ├── product-form.html             # Formulaire ajout/modification produit
│   ├── product-trash.html            # Corbeille
│   ├── pos.html                      # Interface de vente (POS)
│   ├── sales.html                    # Historique des ventes
│   ├── logs.html                     # Journal d'activité
│   ├── notifications.html            # Centre de notifications
│   ├── settings.html                 # Paramètres
│   ├── admin-dashboard.html          # Dashboard Super Admin
│   ├── manifest.json                 # Web App Manifest (PWA)
│   └── service-worker.js             # Service Worker (PWA)
│
├── docker-compose.yml                # Docker Compose (backend + PostgreSQL)
├── .env.example                      # Variables d'environnement
└── README.md                         # Documentation du projet
```

## 7.2 Fichier `.env.example`

```env
# =========================
# RDGESTION — Configuration
# =========================

# Base de données PostgreSQL
DATABASE_URL=postgresql://rdgestion_user:mot_de_passe@localhost:5432/rdgestion_db

# JWT
JWT_SECRET=votre_cle_secrete_256_bits_minimum
JWT_EXPIRES_IN=24h

# Serveur
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# CORS
CORS_ORIGIN=http://localhost:8080

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=10

# Uploads
UPLOAD_MAX_SIZE=2097152
UPLOAD_DIR=./uploads

# Super Admin (créé au premier lancement)
SUPERADMIN_PHONE=+22890000000
SUPERADMIN_PASSWORD=SuperAdmin123!
```

## 7.3 Principes d'architecture

### Séparation des responsabilités (SOLID)
- **Controller** : Reçoit la requête HTTP, valide les entrées via le schéma Ajv, appelle le service, renvoie la réponse HTTP.
- **Service** : Contient toute la logique métier. Interagit avec la base de données. Ne connaît pas HTTP.
- **Schema** : Définit les schémas de validation des entrées et des sorties (utilisés par Fastify/Ajv).
- **Routes** : Enregistre les routes Fastify avec les middlewares d'authentification et de contrôle de rôle.

### Convention de nommage
- Fichiers : `kebab-case` (ex: `auth.controller.ts`)
- Variables/fonctions : `camelCase`
- Types/Interfaces : `PascalCase`
- Constantes : `UPPER_SNAKE_CASE`
- Tables SQL : `snake_case`
- Colonnes SQL : `snake_case`
