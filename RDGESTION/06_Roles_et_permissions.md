# 06 — Rôles, Permissions et Restrictions Détaillées

## 6.1 Matrice de permissions complète

### 6.1.1 Accès aux pages

| Page / Section | Super Admin | Gérant (ADMIN) | Vendeur (SELLER) |
|:---------------|:-----------:|:---------------:|:----------------:|
| `/admin/dashboard` | ✅ | ❌ | ❌ |
| `/admin/tenants` (liste boutiques) | ✅ | ❌ | ❌ |
| `/admin/subscriptions` | ✅ | ❌ | ❌ |
| `/admin/referrals` | ✅ | ❌ | ❌ |
| `/dashboard` (tableau de bord boutique) | ❌ | ✅ | ❌ |
| `/products` (liste produits) | ❌ | ✅ | ❌ |
| `/products/new` (ajouter produit) | ❌ | ✅ | ❌ |
| `/products/:id/edit` (modifier produit) | ❌ | ✅ | ❌ |
| `/products/trash` (corbeille) | ❌ | ✅ | ❌ |
| `/pos` (interface de vente) | ❌ | ✅ | ✅ |
| `/sales` (historique des ventes) | ❌ | ✅ | ✅ (lecture seule) |
| `/sales/:id` (détail d'une vente) | ❌ | ✅ | ✅ (lecture seule) |
| `/logs` (journal d'activité) | ❌ | ✅ | ❌ |
| `/notifications` | ❌ | ✅ | ❌ |
| `/settings` (paramètres) | ❌ | ✅ | ❌ |
| `/settings/vendors` (gestion vendeurs) | ❌ | ✅ | ❌ |
| `/settings/ticket` (personnalisation ticket) | ❌ | ✅ (PRO) | ❌ |
| `/settings/subscription` (abonnement) | ❌ | ✅ | ❌ |
| `/exports` | ❌ | ✅ (PRO) | ❌ |

### 6.1.2 Actions métier

| Action | Super Admin | Gérant (ADMIN) | Vendeur (SELLER) |
|:-------|:-----------:|:---------------:|:----------------:|
| Activer/Désactiver abonnement d'une boutique | ✅ | ❌ | ❌ |
| Créer un produit | ❌ | ✅ | ❌ |
| Modifier un produit | ❌ | ✅ | ❌ |
| Supprimer un produit (corbeille) | ❌ | ✅ | ❌ |
| Restaurer un produit | ❌ | ✅ | ❌ |
| Effectuer une vente | ❌ | ✅ | ✅ |
| Rechercher un produit (POS) | ❌ | ✅ | ✅ |
| Consulter le stock d'un produit | ❌ | ✅ | ✅ |
| Appliquer une remise | ❌ | ✅ | ✅ (max limité) |
| Annuler une vente | ❌ | ✅ | ✅ (tracé) |
| Réimprimer un ticket | ❌ | ✅ | ✅ |
| Voir l'historique des ventes | ❌ | ✅ | ✅ (lecture seule) |
| Voir l'historique des factures | ❌ | ✅ | ✅ (lecture seule) |
| Modifier une vente passée | ❌ | ❌ | ❌ |
| Consulter les logs | ❌ | ✅ | ❌ |
| Créer un vendeur | ❌ | ✅ | ❌ |
| Désactiver un vendeur | ❌ | ✅ | ❌ |
| Réinitialiser le mot de passe d'un vendeur | ❌ | ✅ | ❌ |
| Modifier les paramètres de la boutique | ❌ | ✅ | ❌ |
| Exporter des données | ❌ | ✅ (PRO) | ❌ |
| Créer des catégories personnalisées | ❌ | ✅ (PRO) | ❌ |
| Personnaliser le ticket de caisse | ❌ | ✅ (PRO) | ❌ |
| Voir le bénéfice d'une vente | ❌ | ✅ | ✅ |

## 6.2 Contrôle d'accès backend

Chaque route API Fastify doit être protégée par un middleware d'authentification et d'autorisation :

```
flowRequest → verifyJWT() → checkRole(allowedRoles) → checkTenantIsolation() → handler
```

1. **verifyJWT()** : Vérifie la validité et l'expiration du token JWT. Extrait `userId`, `tenantId`, `role`.
2. **checkRole(allowedRoles)** : Vérifie que le rôle de l'utilisateur est dans la liste des rôles autorisés. Retourne 403 si non autorisé.
3. **checkTenantIsolation()** : S'assure que CHAQUE requête SQL inclut un filtre `WHERE tenant_id = :tenantId`. Empêche un utilisateur d'accéder aux données d'une autre boutique.

## 6.3 Isolation des données (Multi-tenant)

**Règle critique** : Un utilisateur ne doit **JAMAIS** pouvoir accéder aux données d'un autre tenant, même en manipulant les paramètres de l'URL ou du body de la requête.

- Chaque requête SQL doit inclure `AND tenant_id = $tenantId` extrait du JWT.
- Le `tenant_id` ne doit **JAMAIS** être passé dans le body ou les query params par le client. Il est **toujours** extrait du token JWT côté serveur.
- Si un utilisateur tente d'accéder à un produit ou une vente d'un autre tenant (en devinant l'UUID), le serveur doit retourner 404 (et non 403, pour ne pas révéler l'existence de la ressource).
