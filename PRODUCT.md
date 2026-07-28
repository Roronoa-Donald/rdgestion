# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

[INFERRED from md/style.md + AGENTS.md] Primary users: commercant·e·s de détail en Afrique de l'Ouest (Togo, Bénin, Côte d'Ivoire, etc.) — pharmaciens, boutiquiers, épicistes. Leur job : tenir une boutique physique réelle (ventes journalières, stock, paiements Mobile Money) sans recourir à un cahier manuel. Secondaires : leurs vendeurs (rôle SELLER) qui utilisent le POS en boutique, et les SuperAdmins qui gèrent la plateforme multi-tenant.

Situation : boutique en zone urbaine ou péri-urbaine ouest-africaine, connexion mobile instable (hors Pass Réseaux Sociaux), donc PWA offline-first et CSS min essential.

## Product Purpose

RDGESTION est un SaaS multi-tenant de gestion de stock et point de vente (POS) pour commerces de détail. Il remplace le cahier de comptes manuel par une application web/mobile qui tient : les ventes transactionnelles, le stock en temps réel, les paiements (Mobile Money via FedaPay), l'historique, les tickets, et un dashboard d'analyse. Le produit existe pour professionnaliser sans infantiliser — l'utilisateur tient déjà sa boutique, on ne lui apprend pas son métier.

Le succès = un commerçant qui bascule du papier au numérique sans se sentir dépossédé, sans perdre de ventes à cause d'une panne réseau, et sans payer une licence européenne.

## Positioning

[INFERRED] Mécanisme différenciateur : un POS cloud multi-tenant pensé pour le contexte mobile-first ouest-africain — PWA offline-first, intégration Mobile Money native (FedaPay), et facturation à l'usage (FREE 30 ventes/jour, PRO mensuel/à vie) alignée au pouvoir d'achat local. Un produit européen (Lightspeed, Shopify POS) ne pourrait pas : ni le pricing, ni le mode offline, ni le multi-tenant tel quel, ni la sensibilité culturelle (Togo, FCFA, boutiques de quartier).

## Operating Context

[Confirmed from AGENTS.md] Stack : Fastify+TypeScript backend, vanilla JS PWA frontend, PostgreSQL (Aiven), Vercel serverless. FedaPay sandbox pour Mobile Money. Cloudinary pour les images produit. URL : rdgestion.app.

Workflows: un commerçant s'inscrit → crée ses produits/catégories → son équipe (vendeurs) enregistre des ventes au POS (mode tactile mobile) → le stock se met à jour en transactionnel → les tickets s'impriment/re-partagent en WhatsApp → le dashboard donne les indicateurs journaliers/mensuels.

## Capabilities and Constraints

[Confidentiel/INFERRED]
- 11 modules : auth, products, categories, sales, dashboard, logs, notifications, settings, admin, payments, exports.
- Transactions atomiques avec SAVEPOINT sur PostgreSQL.
- Quota FREE 30 ventes/jour ; PRO mensuel/à vie.
- Multi-tenant via `tenant_id` injecté depuis JWT.
- Pas d'emoji en logo (interdit dans l'AGENTS.md du repo — ne pas modifier l'identité visuelle), pas de modification de couleurs stylistiques sans autorisation.
- Commande `npm run typecheck` + `npx vitest run` pour validation.

## Brand Commitments

[INFERRED from md/style.md — DOCUMENT DE RÉFÉRENCE OFFICIEL pour le design] Identité visuelle :
- Inspiration : Stripe, Linear, Notion (Flat Design, UI UX Pro Max).
- Couleur maîtresse : `#047857` (vert émeraude, accent clair) ; dark `#10b981`.
- Typographie : Rubik (display) + Nunito Sans (body). Logo mark = Rubik 800.
- Radius : `6px`. Pas d'ombre décorative. Pas de dégradé. Pas de skeuomorphisme.
- Le `md/style.md` actuel contient le brief complet du logo (variantes exigées, livrables, anti-patterns).
- Lettres "RD" doivent rester reconnaissables (logotype existant).

Le logo actuel (`frontend/src/assets/icon.svg`) est un placeholder à remplacer.

## Evidence on Hand

- Démo en production sur www.rdgestion.app.
- Repo source à `C:\Users\LENOVO LOQ\rdgestion\rdgestion`.
- `md/style.md` (15k chars) : brief logo exhaustif extrait du design system.
- `AGENTS.md` (11k) : conventions dev.
- Tests backend 64/64 pass.
- Surfaces visées par le logo : sidebar (32x32), favicon (16x16, 32x32), app-icon PWA (192/512, maskable), apple-touch (180), tickets de caisse (imprimés), écrans login/register.

[NOT YET COLLECTED - ne pas fabriquer]
- Témoignages clients réels, benchmarks de ventes, captures d'écran de boutiques réelles.

## Product Principles

[INFERRED from AGENTS.md + style.md]
1. Serious sans condescendance — l'utilisateur tient déjà sa boutique, on sert son métier.
2. Mobile-first ouest-africain — offline-first, PWA, paiement Mobile Money natif.
3. Précision transactionnelle — integrité de la DB avant tout (hêtérogénéité PostgreSQL, no data loss).
4. Sobriété visuelle — flat design, couleurs limitées, pas de chrome décoratif. Confiance > tape-à-l'œil.
5. Identité préservée — pas de modification de l'ADN stylistique sans validation explicite.

## Accessibility & Inclusion

- PWA installable sur Android/iOS (manifest + service worker).
- Thème clair + thème sombre — le logo doit fonctionner sur les deux.
- Polices Rubik/Nunito Sans (Réseau globales/Google Fonts).
- WCAG AA pour les contrastes du produit (cible du logo: 16x16 lisible).
