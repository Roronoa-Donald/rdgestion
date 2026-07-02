# 12 — Module Stocks — Spécifications Complètes

## 12.1 Règles des seuils d'alerte

### Hiérarchie des seuils
1. **Seuil individuel du produit** (`products.stock_threshold`) : S'il est renseigné (non NULL), il a la priorité absolue.
2. **Seuil global de la boutique** (`settings.global_stock_threshold`) : Utilisé si le seuil individuel est NULL.
3. **Valeur par défaut système** : 20 (utilisée si le seuil global n'est pas configuré).

### Formule d'alerte
```
seuil_effectif = product.stock_threshold ?? settings.global_stock_threshold ?? 20
alerte = product.stock_quantity <= seuil_effectif
```

### Affichage des alertes
| Endroit | Affichage |
|:--------|:----------|
| Dashboard (gérant) | Carte "Alertes de stock" avec le nombre de produits en alerte et la liste |
| Liste des produits | Badge orange "Stock faible : X restants" à côté du nom du produit |
| Fiche produit | Bandeau d'avertissement en haut de la fiche |
| POS | Badge orange discret sur la carte du produit |
| Notifications | Notification `STOCK_LOW` créée automatiquement |

## 12.2 Mouvements de stock tracés

Chaque variation de stock génère un log d'audit :

| Événement | Action du log | Détails enregistrés |
|:----------|:--------------|:--------------------|
| Vente | `STOCK_DECREMENT` | product_id, quantity_sold, old_stock, new_stock, sale_id |
| Annulation de vente | `STOCK_INCREMENT` | product_id, quantity_restored, old_stock, new_stock, sale_id |
| Modification manuelle | `STOCK_ADJUSTMENT` | product_id, old_stock, new_stock, reason |
| Ajout de produit | `PRODUCT_ADD` | Inclut le stock initial |

## 12.3 Entrées de stock (Réapprovisionnement)

Le gérant peut modifier la quantité en stock d'un produit via la modification de la fiche produit.
- L'ancienne et la nouvelle quantité sont loggées.
- Si le stock remonte au-dessus du seuil d'alerte, l'alerte est automatiquement désactivée.
