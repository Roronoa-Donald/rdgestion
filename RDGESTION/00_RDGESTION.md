# RDGESTION — Software Requirements Specification (SRS)

> **Version** : 1.0.0
> **Nom du produit** : RDGESTION
> **Type** : Application SaaS multi-tenant de gestion de stock et point de vente (POS)
> **Date de rédaction** : Juillet 2026
> **Statut** : Spécification complète — prêt pour le développement

---

## Sommaire du dossier

| N° | Fichier | Contenu |
|:---|:--------|:--------|
| 00 | `00_RDGESTION.md` | Page de garde, sommaire, vue d'ensemble |
| 01 | `01_Vision.md` | Vision du produit, problématique, proposition de valeur, positionnement marché |
| 02 | `02_Objectifs.md` | Objectifs business, techniques et UX |
| 03 | `03_Cahier_des_charges.md` | Cahier des charges fonctionnel exhaustif |
| 04 | `04_Personas.md` | Personas détaillées (Super Admin, Gérant, Vendeur) |
| 05 | `05_Cas_d_utilisation.md` | Cas d'utilisation complets (préconditions, scénarios, erreurs, logs) |
| 06 | `06_Roles_et_permissions.md` | Matrice RBAC complète, restrictions, flux de navigation par rôle |
| 07 | `07_Architecture.md` | Architecture technique, arborescence, choix technologiques |
| 08 | `08_Base_de_donnees.md` | Schéma PostgreSQL complet (tables, relations, index, contraintes, triggers) |
| 09 | `09_API_REST.md` | Documentation exhaustive de chaque endpoint Fastify |
| 10 | `10_Authentification_Securite.md` | JWT, Argon2, CSRF, XSS, Rate Limiting, CORS, Helmet |
| 11 | `11_Module_Produits.md` | Spécifications complètes du module produits |
| 12 | `12_Module_Stocks.md` | Gestion des stocks, alertes, seuils, règles métier |
| 13 | `13_Module_Ventes_POS.md` | Interface POS, tunnel d'achat, impression tickets |
| 14 | `14_Module_Abonnements.md` | Plans FREE/PRO, limites, FedaPay, activation manuelle |
| 15 | `15_Module_Parrainage.md` | Système de parrainage, conditions, récompenses |
| 16 | `16_Module_Logs_Tracabilite.md` | Journal d'audit exhaustif, structure des logs |
| 17 | `17_Module_Notifications.md` | Centre de notifications, événements déclencheurs |
| 18 | `18_Module_Exports.md` | Exports PDF et Excel (.xlsx) |
| 19 | `19_Interface_UI_UX.md` | Design system complet, thèmes, animations, responsive, accessibilité |
| 20 | `20_Module_PWA.md` | Progressive Web App, manifest, service worker |
| 21 | `21_Exigences_techniques.md` | Qualité de code, SOLID, Docker, tests, conventions |
| 22 | `22_Plan_de_developpement.md` | Feuille de route par phases et sprints |
| 23 | `23_Glossaire.md` | Glossaire des termes métier et techniques |
| 24 | `24_Prompt_final_IA.md` | Prompt de développement complet pour IA |

---

## Vue d'ensemble du produit

**RDGESTION** est une application SaaS de gestion de stock et de point de vente (POS) destinée à **tout type de commerce** (boutiques de quartier, pharmacies, quincailleries, supermarchés, boutiques de vêtements, restaurants, magasins d'informatique, etc.).

### Principes fondamentaux

1. **Multi-tenant** : Une seule base PostgreSQL avec isolation par `tenant_id`. Chaque boutique voit exclusivement ses propres données.
2. **Trois rôles** : Super Administrateur (propriétaire de la plateforme), Administrateur de boutique (gérant), Vendeur (employé).
3. **Traçabilité totale** : Absolument chaque action est enregistrée dans un journal d'audit inaltérable.
4. **Monétisation** : Version gratuite (30 ventes/jour max) et version PRO (5 000 FCFA/mois ou 50 000 FCFA lifetime).
5. **Design premium** : Aucune apparence "générée par IA". Inspiré de Stripe, Linear, Notion. HTML/CSS/JS pur, sans framework CSS.

### Stack technique

| Couche | Technologie |
|:-------|:------------|
| Backend | Node.js + Fastify v4 + TypeScript |
| Base de données | PostgreSQL v15+ |
| Frontend | HTML5 + CSS3 (Vanilla) + JavaScript (ES Modules) |
| Auth | JWT (JSON Web Token) + Argon2id |
| Sécurité | Helmet, CORS, Rate Limiting, validation Ajv |
| API Doc | Swagger / OpenAPI |
| Déploiement | Docker + docker-compose |
| PWA | Service Worker + Web App Manifest |
