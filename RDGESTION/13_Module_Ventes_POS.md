# 13 — Module Ventes & POS — Spécifications Complètes

Ce fichier détaille l'intégralité du fonctionnement de l'interface POS et du tunnel de vente.

## 13.1 Layout du POS

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER : Nom de la boutique | Nom du vendeur | Notifications   │
├────────────────────────────────────┬────────────────────────────┤
│                                    │                            │
│  🔍 Recherche instantanée          │   🛒 PANIER                │
│  [Filtre par catégorie ▾]          │                            │
│                                    │   ┌──────────────────────┐ │
│  ┌───────┐ ┌───────┐ ┌───────┐    │   │ Doliprane 500mg  x2  │ │
│  │ Prod1 │ │ Prod2 │ │ Prod3 │    │   │ 1500 × 2 = 3000     │ │
│  │ 1500F │ │ 2000F │ │  800F │    │   ├──────────────────────┤ │
│  │ St:45 │ │ St:12 │ │ St:0  │    │   │ Amoxicilline    x1   │ │
│  └───────┘ └───────┘ └───────┘    │   │ 2500 × 1 = 2500     │ │
│  ┌───────┐ ┌───────┐ ┌───────┐    │   └──────────────────────┘ │
│  │ Prod4 │ │ Prod5 │ │ Prod6 │    │                            │
│  │  500F │ │ 3500F │ │ 1200F │    │   Sous-total : 5500 FCFA  │
│  │ St:88 │ │ St:3⚠ │ │ St:30 │    │   Remise : -10%           │
│  └───────┘ └───────┘ └───────┘    │   ─────────────────────── │
│                                    │   TOTAL : 4950 FCFA       │
│                                    │                            │
│                                    │   [💵 Espèces] [📱 MoMo]  │
│                                    │   [  ✅ CONFIRMER LA VENTE] │
│                                    │                            │
├────────────────────────────────────┴────────────────────────────┤
│ Barre de statut : Ventes du jour: 23/30 | Plan: FREE           │
└─────────────────────────────────────────────────────────────────┘
```

## 13.2 Raccourcis clavier (Accessibilité)

| Touche | Action |
|:-------|:-------|
| `/` ou `Ctrl+K` | Focus sur la barre de recherche |
| `Entrée` (dans la recherche) | Ajouter le 1er résultat au panier |
| `Échap` | Vider la recherche |
| `F2` | Passer au mode "Espèces" |
| `F3` | Passer au mode "Mobile Money" |
| `F12` | Confirmer la vente |

## 13.3 Gestion de la limite FREE (30 ventes/jour)

- En bas du POS, une barre de statut affiche : `Ventes du jour : 23/30 | Plan : FREE`.
- Quand le compteur atteint 25 : le compteur passe en orange.
- Quand le compteur atteint 29 : le compteur passe en rouge avec un avertissement.
- Quand le compteur atteint 30 : le bouton "Confirmer la vente" est désactivé, un bandeau s'affiche : "Limite quotidienne atteinte. Passez au plan PRO pour des ventes illimitées."
- Pour les utilisateurs PRO : la barre de statut affiche `Plan : PRO ✨` sans compteur.

## 13.4 Validation côté serveur (Transaction SQL)

La validation d'une vente doit être **atomique** (tout réussit ou tout échoue) :

```sql
BEGIN;

-- 1. Vérifier la limite journalière (FREE)
SELECT count FROM daily_sale_counts
WHERE tenant_id = $1 AND sale_date = CURRENT_DATE;
-- Si count >= 30 ET tier = 'FREE' → ROLLBACK + erreur DAILY_LIMIT_REACHED

-- 2. Vérifier le stock de chaque produit (avec verrouillage)
SELECT id, stock_quantity FROM products
WHERE id = ANY($product_ids) AND tenant_id = $tenant_id
FOR UPDATE; -- Verrouillage pessimiste pour éviter les race conditions
-- Si stock < quantité demandée → ROLLBACK + erreur STOCK_INSUFFICIENT

-- 3. Créer la vente
INSERT INTO sales (...) VALUES (...) RETURNING id;

-- 4. Créer les lignes de vente
INSERT INTO sale_items (...) VALUES (...);

-- 5. Décrémenter les stocks
UPDATE products SET stock_quantity = stock_quantity - $qty WHERE id = $product_id;

-- 6. Incrémenter le compteur journalier
INSERT INTO daily_sale_counts (tenant_id, sale_date, count)
VALUES ($tenant_id, CURRENT_DATE, 1)
ON CONFLICT (tenant_id, sale_date) DO UPDATE SET count = daily_sale_counts.count + 1;

-- 7. Logger l'action
INSERT INTO audit_logs (...) VALUES (...);

COMMIT;
```

## 13.5 Numéro de transaction

Format : `VENTE-[ANNÉE]-[NUMÉRO_SÉQUENTIEL_7_CHIFFRES]`
Exemple : `VENTE-2026-0001523`

Le numéro est incrémenté automatiquement par tenant (chaque boutique a sa propre séquence).
