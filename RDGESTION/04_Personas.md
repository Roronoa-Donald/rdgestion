# 04 — Personas Détaillées

## 4.1 Persona 1 : Super Administrateur (Propriétaire de la plateforme)

| Attribut | Détail |
|:---------|:-------|
| **Nom** | Toi (le créateur de RDGESTION) |
| **Rôle** | `SUPERADMIN` |
| **Responsabilités** | Gestion globale de la plateforme, activation/désactivation des abonnements, supervision de toutes les boutiques, configuration du programme de parrainage |
| **Objectif principal** | Faire croître le nombre de boutiques inscrites et maximiser les conversions FREE → PRO |
| **Pages accessibles** | `/admin/dashboard`, `/admin/tenants`, `/admin/subscriptions`, `/admin/referrals`, `/admin/settings` |
| **Actions autorisées** | Voir toutes les boutiques, activer/désactiver un abonnement PRO, modifier la durée du programme de parrainage, voir les statistiques globales |
| **Actions interdites** | Accéder aux données internes d'une boutique (produits, ventes, logs de la boutique), modifier les paramètres d'une boutique |
| **Besoins** | Dashboard clair avec vue d'ensemble, gestion rapide des abonnements, statistiques de croissance |
| **Frustrations potentielles** | Ne pas pouvoir identifier rapidement les boutiques inactives, processus d'activation manuelle fastidieux |
| **Flux de navigation** | Connexion → Dashboard admin → Liste des boutiques → Détail boutique → Activer/Désactiver abonnement |

---

## 4.2 Persona 2 : Administrateur de boutique (Gérant)

| Attribut | Détail |
|:---------|:-------|
| **Nom** | Kofi (exemple) |
| **Rôle** | `ADMIN` |
| **Responsabilités** | Gestion complète de sa boutique : produits, stocks, ventes, vendeurs, paramètres, logs |
| **Objectif principal** | Avoir une vision claire de son activité, détecter les anomalies (vols, erreurs), et gagner du temps |
| **Pages accessibles** | `/dashboard`, `/products`, `/products/new`, `/products/:id/edit`, `/products/trash`, `/pos`, `/sales`, `/sales/:id`, `/logs`, `/notifications`, `/settings`, `/settings/vendors`, `/settings/ticket`, `/settings/subscription` |
| **Actions autorisées** | Toutes les actions de gestion de sa propre boutique : CRUD produits, ventes, gestion vendeurs, consultation logs, exports, personnalisation tickets |
| **Actions interdites** | Accéder aux données d'une autre boutique, accéder au panel Super Admin, supprimer définitivement un produit de la base |
| **Besoins** | Voir rapidement le CA, les bénéfices et les alertes de stock. Tracer chaque action de ses vendeurs. Exporter ses données. |
| **Frustrations potentielles** | Interface de vente trop lente, graphiques peu lisibles, impossibilité d'identifier qui a modifié un prix |
| **Actions quotidiennes** | Consulter le dashboard, vérifier les ventes du jour, consulter les logs si anomalie, ajuster les stocks après livraison, créer de nouveaux produits |
| **Interactions avec les autres rôles** | Crée et gère les comptes vendeurs. Peut voir les logs de leurs actions. Ne voit jamais les autres boutiques. |
| **Flux de navigation typique** | Connexion → Dashboard → Vérifier alertes → Consulter ventes du jour → Vérifier logs → Ajuster stocks si besoin |

---

## 4.3 Persona 3 : Vendeur (Employé)

| Attribut | Détail |
|:---------|:-------|
| **Nom** | Ama (exemple) |
| **Rôle** | `SELLER` |
| **Identifiant** | Format obligatoire : `vendeur.[nom_boutique]-[3_chiffres_aléatoires]` (ex: `vendeur.pharmacie-482`) |
| **Mot de passe** | Créé par le gérant de la boutique lors de la création du compte vendeur |
| **Responsabilités** | Encaisser les ventes des clients, assurer un service rapide et professionnel |
| **Objectif principal** | Enregistrer les ventes le plus rapidement possible sans commettre d'erreur |
| **Pages accessibles** | `/pos` (directement après connexion), `/sales` (historique en lecture seule) |
| **Actions autorisées** | Vendre, rechercher un produit, consulter le stock restant, appliquer une remise (dans la limite autorisée), annuler une vente, réimprimer un ticket, voir l'historique des ventes et factures **sans pouvoir modifier quoi que ce soit** |
| **Actions interdites** | Accéder au dashboard, modifier un produit, ajouter/supprimer un produit, modifier les paramètres de la boutique, consulter les logs, exporter des données, créer d'autres comptes, modifier son propre identifiant |
| **Besoins** | Interface POS ultra-rapide, recherche instantanée, ajout au panier en 1 clic |
| **Frustrations potentielles** | Interface lente, processus de vente avec trop d'étapes, impossibilité de corriger une erreur de saisie |
| **Actions quotidiennes** | Se connecter → arriver directement sur le POS → encaisser les clients → fin de journée |
| **Traçabilité** | **Absolument chaque action** du vendeur est tracée : chaque vente, chaque annulation, chaque remise, chaque réimpression de ticket, chaque connexion, chaque déconnexion |
| **Restrictions de sécurité** | Le vendeur ne peut pas changer son identifiant (format imposé). Le mot de passe est défini par le gérant. Le vendeur peut être désactivé à tout moment par le gérant. |
