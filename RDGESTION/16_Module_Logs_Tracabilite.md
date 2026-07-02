# 16 — Module Logs & Traçabilité — Spécifications Complètes

## 16.1 Principe fondamental

> **TOUT EST TRACÉ. ABSOLUMENT TOUT.**

C'est la promesse centrale de RDGESTION. Le gérant doit pouvoir reconstituer l'historique complet de chaque action effectuée dans sa boutique.

## 16.2 Liste exhaustive des événements audités

### Authentification
| Action | Déclencheur | Détails enregistrés |
|:-------|:------------|:--------------------|
| `LOGIN_SUCCESS` | Connexion réussie | username, role, IP, User-Agent |
| `LOGIN_FAILED` | Connexion échouée | username tenté, IP, User-Agent, raison |
| `LOGOUT` | Déconnexion | username, IP |
| `PASSWORD_CHANGE` | Changement de mot de passe | user_id (mot de passe JAMAIS loggé) |

### Gestion des utilisateurs
| Action | Déclencheur | Détails |
|:-------|:------------|:--------|
| `USER_CREATED` | Création d'un vendeur | username, role, créé par |
| `USER_DISABLED` | Désactivation d'un vendeur | username, désactivé par |
| `USER_ENABLED` | Réactivation d'un vendeur | username, réactivé par |
| `USER_PASSWORD_RESET` | Réinitialisation du mot de passe d'un vendeur | username, réinitialisé par |

### Produits
| Action | Déclencheur | Détails |
|:-------|:------------|:--------|
| `PRODUCT_ADD` | Ajout d'un produit | Toutes les données du produit |
| `PRODUCT_UPDATE` | Modification d'un produit | `changes: { "champ": { "old": ..., "new": ... } }` |
| `PRODUCT_DELETE` | Mise en corbeille | Données complètes du produit au moment de la suppression |
| `PRODUCT_RESTORE` | Restauration de la corbeille | product_id, restauré par |

### Stocks
| Action | Déclencheur | Détails |
|:-------|:------------|:--------|
| `STOCK_DECREMENT` | Vente validée | product_id, qty_sold, old_stock, new_stock, sale_id |
| `STOCK_INCREMENT` | Annulation de vente | product_id, qty_restored, old_stock, new_stock, sale_id |
| `STOCK_ADJUSTMENT` | Modification manuelle | product_id, old_stock, new_stock |

### Ventes
| Action | Déclencheur | Détails |
|:-------|:------------|:--------|
| `SALE_CREATE` | Vente validée | Panier complet, mode de paiement, référence MoMo, remise, total, vendeur |
| `SALE_CANCEL` | Annulation d'une vente | sale_id, annulé par, détails de la vente |
| `SALE_TICKET_PRINT` | Impression du ticket | sale_id, imprimé par |
| `SALE_TICKET_REPRINT` | Réimpression du ticket | sale_id, réimprimé par |

### Paramètres
| Action | Déclencheur | Détails |
|:-------|:------------|:--------|
| `SETTINGS_UPDATE` | Modification des paramètres | `changes: { "champ": { "old": ..., "new": ... } }` |
| `TICKET_SETTINGS_UPDATE` | Modification des paramètres ticket | idem |
| `CATEGORY_CREATED` | Création d'une catégorie | name, créé par |
| `CATEGORY_DELETED` | Suppression d'une catégorie | name, supprimé par |

### Abonnements & Parrainage
| Action | Déclencheur | Détails |
|:-------|:------------|:--------|
| `SUBSCRIPTION_ACTIVATED` | Activation PRO | tier, billing_type, activé par |
| `SUBSCRIPTION_EXPIRED` | Expiration automatique | tenant_id, old_tier |
| `REFERRAL_CREATED` | Nouveau parrainage | referrer_id, referred_id |
| `REFERRAL_COMPLETED` | Filleul passé PRO | referrer_id, referred_id |
| `REFERRAL_REWARD_GRANTED` | Récompense attribuée | referrer_id, mois offerts |

## 16.3 Structure du log

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "username": "vendeur.pharma-482",
  "user_role": "SELLER",
  "action": "SALE_CREATE",
  "entity_type": "SALE",
  "entity_id": "uuid-de-la-vente",
  "details": {
    "items": [
      { "product_name": "Doliprane 500mg", "quantity": 2, "unit_price": 1500, "total": 3000 }
    ],
    "payment_method": "MOBILE_MONEY",
    "momo_reference": "TXN-MTN-20260701-123456789",
    "discount": { "type": "PERCENTAGE", "value": 10, "amount": 300 },
    "total": 2700,
    "changes": null
  },
  "ip_address": "192.168.1.45",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "created_at": "2026-07-01T14:30:00.000Z"
}
```

## 16.4 Interface du journal d'activité

- **Accessible uniquement au gérant** (ADMIN).
- Affichage sous forme de tableau chronologique (du plus récent au plus ancien).
- **Filtres disponibles** :
  - Par type d'action (sélection multiple)
  - Par utilisateur (gérant ou un vendeur spécifique)
  - Par période (date de début / date de fin)
  - Par type d'entité (PRODUCT, SALE, USER, SETTINGS)
- **Clic sur une ligne** → Modale avec les détails complets (anciennes/nouvelles valeurs, IP, navigateur, appareil).
- **Pagination** : 50 entrées par page.
- **Les logs sont en lecture seule** : personne ne peut les modifier ou les supprimer.
