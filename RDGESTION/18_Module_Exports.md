# 18 — Module Exports — Spécifications Complètes

Les exports sont **réservés aux utilisateurs PRO**. Si un utilisateur FREE tente d'accéder à un export, un message l'invite à passer au plan PRO.

## 18.1 Exports disponibles

### 18.1.1 Export de la liste des produits

**Format** : Excel (.xlsx) ou PDF
**Contenu** :
- Tableau avec colonnes : Nom, SKU, Catégorie, Prix d'achat, Prix de vente, Marge, Stock, Seuil d'alerte, Statut (Actif/Alerte/Rupture), Périssable (Oui/Non), Date de péremption.
- En-tête avec le nom de la boutique, la date d'export.
- Pied de page avec le total d'articles et la valeur totale du stock (Σ prix_achat × quantité).

### 18.1.2 Export du rapport des ventes

**Format** : Excel (.xlsx) ou PDF
**Paramètres** : Date de début, Date de fin
**Contenu** :
- Tableau avec colonnes : N° Transaction, Date/Heure, Vendeur, Articles (liste), Sous-total, Remise, Total, Mode de paiement, Référence MoMo, Statut, Bénéfice estimé.
- Résumé en bas : Total CA, Total bénéfice, Nombre de ventes, Nombre d'annulations, Répartition Espèces/MoMo.

### 18.1.3 Export du rapport de fin de journée

**Format** : PDF (optimisé pour impression A4)
**Contenu** :
- En-tête : Nom de la boutique, Date, Nom du gérant.
- Résumé financier :
  - Chiffre d'affaires total
  - Dont espèces
  - Dont Mobile Money
  - Remises accordées
  - Bénéfice net estimé
- Nombre total de ventes
- Nombre de ventes annulées
- Top 5 des produits les plus vendus
- Produits en alerte de stock
- Pied de page : "Généré par RDGESTION le [date] à [heure]"
