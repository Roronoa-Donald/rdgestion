# 22 — Plan de Développement par Phases et Sprints

## Phase 1 : Fondations (Sprints 1-3)

### Sprint 1 — Initialisation (1 semaine)
- [ ] Initialiser le projet (package.json, tsconfig.json, Dockerfile)
- [ ] Configurer Fastify (app.ts, plugins Helmet/CORS/Rate-Limit)
- [ ] Configurer la connexion PostgreSQL
- [ ] Créer le système de migrations
- [ ] Exécuter les migrations 001 à 011
- [ ] Configurer les variables .env
- [ ] Créer le middleware d'authentification JWT
- [ ] Créer les utilitaires Argon2 (hash/verify)

### Sprint 2 — Auth & Inscription (1 semaine)
- [ ] Implémenter `POST /api/auth/register` (inscription boutique)
- [ ] Implémenter `POST /api/auth/login` (connexion)
- [ ] Implémenter `POST /api/auth/vendors` (création vendeur)
- [ ] Créer le seed des catégories par défaut
- [ ] Créer la page d'inscription frontend (HTML/CSS/JS)
- [ ] Créer la page de connexion frontend
- [ ] Créer la page d'onboarding (sélection type de commerce)
- [ ] Implémenter le stockage du token JWT côté client

### Sprint 3 — Design System (1 semaine)
- [ ] Créer `variables.css` (couleurs, typographie, spacing)
- [ ] Créer `reset.css` et `base.css`
- [ ] Créer `components.css` (boutons, cartes, formulaires, modales, badges)
- [ ] Créer `layout.css` (sidebar, header, grille responsive)
- [ ] Créer `animations.css` (skeleton loaders, transitions)
- [ ] Créer `themes.css` (thème sombre + clair)
- [ ] Implémenter le toggle de thème (theme.js)

---

## Phase 2 : Module Produits (Sprints 4-5)

### Sprint 4 — Backend Produits (1 semaine)
- [ ] Implémenter le CRUD complet des produits (controller, service, schema, routes)
- [ ] Implémenter la suppression logique (corbeille)
- [ ] Implémenter la restauration depuis la corbeille
- [ ] Implémenter l'upload de photo produit
- [ ] Implémenter la génération automatique de SKU
- [ ] Implémenter le CRUD des catégories
- [ ] Ajouter les logs d'audit pour chaque action produit

### Sprint 5 — Frontend Produits (1 semaine)
- [ ] Créer la page liste des produits (avec recherche, filtres, pagination)
- [ ] Créer le formulaire d'ajout de produit (avec la section date de péremption grisée)
- [ ] Créer le formulaire de modification de produit
- [ ] Créer la page corbeille
- [ ] Skeleton loaders sur toutes les pages produits

---

## Phase 3 : Module POS & Ventes (Sprints 6-8)

### Sprint 6 — Backend Ventes (1 semaine)
- [ ] Implémenter `POST /api/sales` avec transaction SQL atomique
- [ ] Implémenter la vérification de stock avec verrouillage pessimiste
- [ ] Implémenter le compteur de ventes journalières (FREE)
- [ ] Implémenter `POST /api/sales/:id/cancel`
- [ ] Implémenter `GET /api/sales` avec filtres et pagination
- [ ] Implémenter la génération de numéros de transaction séquentiels

### Sprint 7 — Frontend POS (1 semaine)
- [ ] Créer l'interface POS complète (layout 2 colonnes)
- [ ] Implémenter la recherche instantanée de produits
- [ ] Implémenter le panier avec ajustement de quantité
- [ ] Implémenter les modes de paiement (Espèces / Mobile Money)
- [ ] Implémenter la saisie obligatoire de la référence MoMo
- [ ] Implémenter la remise (montant fixe / pourcentage)
- [ ] Raccourcis clavier

### Sprint 8 — Tickets & Historique (1 semaine)
- [ ] Implémenter la modale d'impression du ticket de caisse
- [ ] Implémenter les styles d'impression (`print.css`)
- [ ] Créer la page historique des ventes (gérant + vendeur lecture seule)
- [ ] Implémenter l'annulation de vente avec modale de confirmation
- [ ] Implémenter la réimpression de ticket

---

## Phase 4 : Dashboard & Statistiques (Sprint 9)

### Sprint 9 — Dashboard (1 semaine)
- [ ] Implémenter `GET /api/dashboard/stats`
- [ ] Créer le dashboard gérant (cartes de stats + graphiques)
- [ ] Implémenter les graphiques interactifs (Chart.js ou similaire)
- [ ] Filtres temporels (jour/semaine/mois/année)
- [ ] Alertes de stock sur le dashboard

---

## Phase 5 : Logs, Notifications, Exports (Sprints 10-11)

### Sprint 10 — Logs & Notifications (1 semaine)
- [ ] Implémenter `GET /api/logs` avec filtres
- [ ] Créer la page journal d'activité frontend
- [ ] Implémenter le système de notifications backend
- [ ] Créer le centre de notifications frontend (drawer)
- [ ] Implémenter "Tout marquer comme lu"

### Sprint 11 — Exports & Settings (1 semaine)
- [ ] Implémenter les exports Excel (.xlsx) avec une lib comme ExcelJS
- [ ] Implémenter les exports PDF avec une lib comme pdfkit ou puppeteer
- [ ] Créer la page paramètres complète
- [ ] Créer la gestion des vendeurs (créer, désactiver, reset password)
- [ ] Créer la personnalisation des tickets (PRO)

---

## Phase 6 : Abonnements, Parrainage, PWA, Admin (Sprints 12-14)

### Sprint 12 — Abonnements & Parrainage (1 semaine)
- [ ] Implémenter la logique d'abonnement (activation/expiration)
- [ ] Implémenter le système de parrainage complet
- [ ] Créer la page abonnement frontend
- [ ] Implémenter les notifications d'expiration

### Sprint 13 — Panel Super Admin (1 semaine)
- [ ] Créer le dashboard Super Admin
- [ ] Implémenter la gestion des boutiques (liste, détail, activation/désactivation)
- [ ] Implémenter la gestion des abonnements

### Sprint 14 — PWA & Polish (1 semaine)
- [ ] Créer le manifest.json
- [ ] Implémenter le Service Worker
- [ ] Tester l'installation sur mobile et desktop
- [ ] Polish final : animations, transitions, responsive
- [ ] Tests complets de l'application
- [ ] Documentation API Swagger
