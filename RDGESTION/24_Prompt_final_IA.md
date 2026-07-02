# 24 — Prompt Final pour IA de Développement

> Ce fichier est le **prompt complet** à fournir à une IA de développement (Gemini, Claude, GPT, Codex) pour générer le code de RDGESTION. Il synthétise l'intégralité des spécifications contenues dans ce dossier.

---

## INSTRUCTIONS POUR L'IA DE DÉVELOPPEMENT

Tu es un développeur full-stack senior expert en architecture modulaire Node.js, Fastify, TypeScript et Vanilla HTML/CSS/JS. Tu dois générer l'intégralité du code fonctionnel de l'application SaaS **RDGESTION** — un logiciel de gestion de stock et point de vente (POS) multi-tenant.

### CONTRAINTES ABSOLUES (NON NÉGOCIABLES)

1. **Stack technique exacte** :
   - Backend : Node.js + Fastify v4 + TypeScript strict (`"strict": true`, aucun `any`)
   - Base de données : PostgreSQL v15+ (connexion via variable `.env` `DATABASE_URL`)
   - Frontend : HTML5 + CSS3 vanilla + JavaScript ES Modules. **AUCUN** Bootstrap, Tailwind, React, Vue ou autre framework.
   - Auth : JWT (durée 24h, HS256) + Argon2id pour le hachage des mots de passe
   - Sécurité : @fastify/helmet, @fastify/cors, @fastify/rate-limit, requêtes SQL paramétrées

2. **Architecture modulaire** :
   - Chaque module (auth, products, sales, logs, notifications, etc.) dans son propre dossier avec controller, service, schema, routes.
   - Les controllers gèrent uniquement HTTP. La logique métier est dans les services.
   - Respecter les principes SOLID.

3. **Multi-tenant** :
   - Chaque table métier a un champ `tenant_id` UUID.
   - Le `tenant_id` est **toujours** extrait du JWT côté serveur, jamais du body client.
   - Chaque requête SQL filtre par `tenant_id`.

4. **Trois rôles** :
   - `SUPERADMIN` : Gère les boutiques et abonnements.
   - `ADMIN` (Gérant) : Gère sa boutique (produits, stocks, ventes, vendeurs, logs, paramètres).
   - `SELLER` (Vendeur) : Accès uniquement au POS et à l'historique en lecture seule.
   - Le vendeur arrive **directement** sur le POS après connexion, sans dashboard.
   - Format d'identifiant vendeur : `vendeur.[nom_boutique]-[3_chiffres_aléatoires]`. Mot de passe créé par le gérant.

5. **Traçabilité totale** :
   - **Chaque** action (connexion, vente, annulation, modification, suppression, changement de paramètre) crée un log d'audit avec : user, role, action, anciennes/nouvelles valeurs (JSONB), IP, User-Agent, timestamp.

6. **Gestion des stocks** :
   - Vente **interdite** si stock = 0.
   - Seuil d'alerte global (défaut 20) modifiable globalement dans les paramètres et individuellement par produit.
   - Pas de variantes (un produit = une fiche).

7. **Ventes & POS** :
   - 2 modes de paiement : Espèces et Mobile Money.
   - Si Mobile Money : référence de transaction **obligatoire** (bouton de validation grisé sinon).
   - Remises possibles (montant fixe ou pourcentage) par gérant et vendeur (max configurable pour le vendeur).
   - Impression de ticket optionnelle (skip possible).
   - Annulation de vente possible (recrédite le stock, tracée dans les logs).
   - Transactions SQL atomiques avec verrouillage pessimiste (SELECT ... FOR UPDATE).

8. **Abonnements** :
   - FREE : 30 ventes/jour max. Pas de personnalisation tickets, pas d'exports, pas de catégories custom.
   - PRO : 5 000 FCFA/mois ou 50 000 FCFA lifetime. Tout débloqué.
   - Activation manuelle par le Super Admin (architecture prête pour FedaPay).

9. **Parrainage** : Code unique par boutique. 2 filleuls ayant souscrit PRO = 1 mois gratuit au parrain.

10. **Inscription** : 3 champs obligatoires (nom boutique, nom propriétaire, téléphone). Sélection du type de commerce via cases à cocher → catégories prédéfinies. Catégorie "Autres" toujours créée.

11. **Produits** : Nom, SKU (auto si vide), catégorie, prix achat, prix vente (≥ prix achat), quantité, photo (facultative), description (facultative), case "Produit périssable" → section date de péremption **grisée** si décochée, active si cochée. Suppression logique (corbeille + restauration).

12. **Dashboard gérant** : CA du jour, ventes du jour, bénéfice du jour, alertes stock, graphiques (jour/semaine/mois/année).

13. **Notifications** : Centre de notifications (icône cloche + badge). Stock faible, abonnement expirant, parrainage, sécurité.

14. **Exports** (PRO) : PDF et Excel (.xlsx). Produits, ventes par période, rapport de fin de journée.

15. **Design** :
    - Thème sombre par défaut + thème clair. Toggle instantané, préférence sauvegardée.
    - **AUCUNE** apparence "générée par IA". Design premium inspiré Stripe/Linear/Notion.
    - Animations fluides mais discrètes (max 300ms).
    - Skeleton loaders pendant les chargements.
    - Responsive parfait (mobile-first).
    - Accessibilité : contrastes WCAG AA, navigation clavier, labels ARIA, `prefers-reduced-motion`.

16. **PWA** : manifest.json + Service Worker avec stratégie Cache-First pour les assets.

17. **Docker** : docker-compose.yml avec services postgres et backend.

18. **Migrations** : Fichiers SQL numérotés, script de migration, table `migrations` en base.

19. **Swagger/OpenAPI** : Documentation auto-générée des endpoints API.

20. **Variables `.env`** : `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `HOST`, `NODE_ENV`, `CORS_ORIGIN`, `RATE_LIMIT_MAX`, `SUPERADMIN_PHONE`, `SUPERADMIN_PASSWORD`.

### STRUCTURE DES FICHIERS À GÉNÉRER

Voir le fichier `07_Architecture.md` pour l'arborescence complète du projet.

### ORDRE DE GÉNÉRATION RECOMMANDÉ

1. Configuration (env, database, JWT)
2. Migrations SQL
3. Middlewares (auth, RBAC, tenant, audit)
4. Module Auth (register, login, vendors)
5. Module Products (CRUD + corbeille)
6. Module Categories
7. Module Sales (POS + tickets)
8. Module Dashboard (stats)
9. Module Logs
10. Module Notifications
11. Module Exports
12. Module Subscriptions
13. Module Referrals
14. Module Settings
15. Module Admin (Super Admin)
16. Frontend complet (HTML + CSS + JS)
17. PWA (manifest + service worker)
18. Docker + docker-compose
19. Tests
20. Swagger

---

**RAPPEL FINAL** : Le code généré doit être de qualité production. Pas de raccourcis, pas de TODO, pas de placeholder. Chaque fonctionnalité décrite dans les spécifications doit être implémentée. Le design doit être premium et ne doit absolument pas ressembler à du code généré par IA.
