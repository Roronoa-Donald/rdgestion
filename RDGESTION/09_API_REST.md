# 09 — Documentation Exhaustive de l'API REST

Toutes les routes (sauf celles marquées `[PUBLIC]`) requièrent un header `Authorization: Bearer <JWT>`.
Toutes les réponses sont au format JSON. Toutes les entrées sont validées par des schémas Ajv.

---

## 9.1 Module Authentification

### `POST /api/auth/register` [PUBLIC]
**Description** : Inscription d'une nouvelle boutique.

**Body** :
```json
{
  "shop_name": "Pharmacie du Marché",
  "owner_name": "Kofi Mensah",
  "phone": "+22890123456",
  "password": "MonMotDePasse1",
  "password_confirm": "MonMotDePasse1",
  "referral_code": "RD-PHARMA-482"  // optionnel
}
```

**Réponse 201** :
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "username": "+22890123456",
      "role": "ADMIN",
      "tenant_id": "uuid",
      "shop_name": "Pharmacie du Marché"
    }
  }
}
```

**Erreurs possibles** :
| Code | Message | Cause |
|:-----|:--------|:------|
| 400 | `VALIDATION_ERROR` | Champ manquant ou format invalide |
| 409 | `PHONE_ALREADY_EXISTS` | Numéro de téléphone déjà enregistré |

---

### `POST /api/auth/login` [PUBLIC]
**Description** : Connexion d'un utilisateur (gérant, vendeur ou super admin).

**Body** :
```json
{
  "identifier": "+22890123456",
  "password": "MonMotDePasse1"
}
```

**Réponse 200** :
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "username": "+22890123456",
      "role": "ADMIN",
      "tenant_id": "uuid",
      "shop_name": "Pharmacie du Marché"
    }
  }
}
```

**Erreurs** :
| Code | Message | Cause |
|:-----|:--------|:------|
| 401 | `INVALID_CREDENTIALS` | Identifiant ou mot de passe incorrect |
| 403 | `ACCOUNT_DISABLED` | Compte désactivé par le gérant |

**Rate Limiting** : 10 tentatives par minute par IP.

---

### `POST /api/auth/vendors` [ADMIN]
**Description** : Création d'un compte vendeur.

**Body** :
```json
{
  "password": "VendeurPass1",
  "password_confirm": "VendeurPass1"
}
```
**Note** : L'identifiant (`vendeur.[nom_boutique]-[3_chiffres]`) est généré automatiquement par le serveur. Le client ne peut pas le choisir.

**Réponse 201** :
```json
{
  "success": true,
  "data": {
    "vendor": {
      "id": "uuid",
      "username": "vendeur.pharmacie-482",
      "role": "SELLER"
    }
  }
}
```

---

## 9.2 Module Produits

### `GET /api/products` [ADMIN]
**Description** : Liste des produits de la boutique (exclut les produits supprimés logiquement).
**Query Params** : `?page=1&limit=20&category_id=uuid&search=doliprane&sort=name&order=asc`
**Réponse 200** : Tableau paginé de produits.

### `POST /api/products` [ADMIN]
**Description** : Ajout d'un nouveau produit.
**Content-Type** : `multipart/form-data` (pour supporter l'upload de photo).
**Champs** : Voir 03_Cahier_des_charges.md §3.3.1.
**Réponse 201** : Le produit créé.

### `PUT /api/products/:id` [ADMIN]
**Description** : Modification d'un produit existant. Seuls les champs envoyés sont modifiés.
**Réponse 200** : Le produit modifié.
**Log** : `PRODUCT_UPDATE` avec anciennes et nouvelles valeurs.

### `DELETE /api/products/:id` [ADMIN]
**Description** : Suppression logique (envoi en corbeille).
**Réponse 200** : `{ "success": true, "message": "Produit mis en corbeille" }`
**Log** : `PRODUCT_DELETE`.

### `POST /api/products/:id/restore` [ADMIN]
**Description** : Restauration d'un produit de la corbeille.
**Réponse 200** : Le produit restauré.
**Log** : `PRODUCT_RESTORE`.

### `GET /api/products/trash` [ADMIN]
**Description** : Liste des produits en corbeille.

---

## 9.3 Module Catégories

### `GET /api/categories` [ADMIN, SELLER]
**Description** : Liste des catégories de la boutique.

### `POST /api/categories` [ADMIN, PRO ONLY]
**Description** : Création d'une catégorie personnalisée.
**Body** : `{ "name": "Compléments alimentaires" }`
**Erreur** : Si l'utilisateur est en FREE → `403 PRO_REQUIRED`.

---

## 9.4 Module Ventes

### `POST /api/sales` [ADMIN, SELLER]
**Description** : Enregistrement d'une vente.

**Body** :
```json
{
  "items": [
    { "product_id": "uuid", "quantity": 2 },
    { "product_id": "uuid", "quantity": 1 }
  ],
  "payment_method": "MOBILE_MONEY",
  "momo_reference": "TXN-MTN-20260701-123456789",
  "discount_type": "PERCENTAGE",
  "discount_value": 10,
  "amount_received": null
}
```

**Réponse 201** :
```json
{
  "success": true,
  "data": {
    "sale": {
      "id": "uuid",
      "transaction_number": "VENTE-2026-0001523",
      "total_amount": 13500,
      "change_given": 0,
      "items": [...],
      "created_at": "..."
    }
  }
}
```

**Erreurs** :
| Code | Message | Cause |
|:-----|:--------|:------|
| 400 | `STOCK_INSUFFICIENT` | Un ou plusieurs produits en rupture |
| 400 | `MOMO_REFERENCE_REQUIRED` | Paiement MoMo sans référence |
| 403 | `DAILY_LIMIT_REACHED` | 30 ventes/jour atteintes (FREE) |
| 403 | `SUBSCRIPTION_EXPIRED` | Abonnement expiré |
| 400 | `DISCOUNT_EXCEEDS_MAX` | Remise vendeur > max autorisé |

### `GET /api/sales` [ADMIN, SELLER]
**Query Params** : `?page=1&limit=20&from=2026-07-01&to=2026-07-31&seller_id=uuid&status=active|cancelled&payment_method=CASH|MOBILE_MONEY`

### `GET /api/sales/:id` [ADMIN, SELLER]
**Description** : Détail d'une vente avec tous ses articles.

### `POST /api/sales/:id/cancel` [ADMIN, SELLER]
**Description** : Annulation d'une vente (recrédite le stock).
**Réponse 200** : `{ "success": true, "message": "Vente annulée avec succès" }`

### `GET /api/sales/:id/ticket` [ADMIN, SELLER]
**Description** : Génération du ticket de caisse au format HTML (pour impression).

---

## 9.5 Module Dashboard

### `GET /api/dashboard/stats` [ADMIN]
**Description** : Statistiques du jour pour le dashboard du gérant.
**Réponse** :
```json
{
  "today": {
    "revenue": 125000,
    "sales_count": 23,
    "profit": 45000,
    "cancelled_count": 1
  },
  "stock_alerts": [
    { "product_id": "uuid", "name": "Doliprane 500mg", "stock": 3, "threshold": 20 }
  ],
  "top_products": [...],
  "chart_data": {
    "daily": [...],
    "weekly": [...],
    "monthly": [...],
    "yearly": [...]
  }
}
```

---

## 9.6 Module Logs

### `GET /api/logs` [ADMIN]
**Query Params** : `?page=1&limit=50&action=SALE_CREATE&user_id=uuid&from=2026-07-01&to=2026-07-31`

---

## 9.7 Module Notifications

### `GET /api/notifications` [ADMIN]
**Query Params** : `?unread_only=true`

### `PATCH /api/notifications/:id/read` [ADMIN]
**Description** : Marquer une notification comme lue.

### `PATCH /api/notifications/read-all` [ADMIN]
**Description** : Marquer toutes les notifications comme lues.

---

## 9.8 Module Exports [ADMIN, PRO ONLY]

### `GET /api/exports/products?format=xlsx|pdf` [ADMIN, PRO]
### `GET /api/exports/sales?format=xlsx|pdf&from=...&to=...` [ADMIN, PRO]
### `GET /api/exports/daily-report?format=pdf&date=2026-07-01` [ADMIN, PRO]

---

## 9.9 Module Admin (Super Admin)

### `GET /api/admin/tenants` [SUPERADMIN]
### `GET /api/admin/tenants/:id` [SUPERADMIN]
### `PATCH /api/admin/subscriptions/:id` [SUPERADMIN]
**Body** : `{ "tier": "PRO", "billing_type": "MONTHLY", "status": "ACTIVE" }`
### `GET /api/admin/stats` [SUPERADMIN]
