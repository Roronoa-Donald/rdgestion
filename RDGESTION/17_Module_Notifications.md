# 17 — Module Notifications — Spécifications Complètes

## 17.1 Centre de notifications

- Accessible depuis une **icône cloche** dans la barre supérieure de l'application.
- Un **badge rouge** affiche le nombre de notifications non lues.
- Au clic, un panneau latéral (drawer) s'ouvre avec la liste des notifications.
- Chaque notification affiche : icône, titre, message résumé, horodatage ("il y a 5 min", "hier", etc.).
- Actions possibles :
  - Cliquer sur une notification → marquer comme lue + redirection vers la page concernée.
  - "Tout marquer comme lu" → marque toutes les notifications non lues comme lues.

## 17.2 Types de notifications et déclencheurs

| Type | Destinataire | Déclencheur | Titre | Message |
|:-----|:-------------|:------------|:------|:--------|
| `STOCK_LOW` | ADMIN | Produit ≤ seuil après une vente | "Stock faible" | "[Nom du produit] : il ne reste plus que X unités" |
| `STOCK_OUT` | ADMIN | Produit = 0 après une vente | "Rupture de stock" | "[Nom du produit] est en rupture de stock" |
| `SUBSCRIPTION_EXPIRING` | ADMIN | J-7, J-3, J-1 avant expiration | "Abonnement bientôt expiré" | "Votre abonnement PRO expire dans X jours" |
| `SUBSCRIPTION_EXPIRED` | ADMIN | Jour d'expiration | "Abonnement expiré" | "Votre abonnement PRO a expiré. Vous êtes repassé au plan gratuit." |
| `SUBSCRIPTION_ACTIVATED` | ADMIN | Activation PRO par le Super Admin | "Abonnement PRO activé" | "Votre abonnement PRO a été activé avec succès !" |
| `REFERRAL_PENDING` | ADMIN | Un filleul s'inscrit avec le code | "Nouveau parrainage" | "[Nom de la boutique filleule] s'est inscrit avec votre code" |
| `REFERRAL_COMPLETED` | ADMIN | Un filleul passe PRO | "Parrainage validé" | "[Nom de la boutique filleule] est passé PRO ! Encore X parrainage(s) pour obtenir 1 mois gratuit." |
| `REFERRAL_REWARD` | ADMIN | 2 parrainages complétés | "1 mois PRO offert !" | "Félicitations ! Vos parrainages vous ont offert 1 mois d'abonnement PRO gratuit." |
| `DAILY_LIMIT_WARNING` | ADMIN, SELLER | 25ème vente du jour (FREE) | "Limite bientôt atteinte" | "Vous avez effectué 25 ventes sur 30 aujourd'hui." |
| `SECURITY_NEW_DEVICE` | ADMIN | Connexion depuis un nouvel appareil/IP | "Nouvelle connexion" | "Connexion détectée depuis un nouvel appareil : [User-Agent]" |
| `PRODUCT_EXPIRING` | ADMIN | Produit périssable expirant dans 7 jours | "Produit bientôt périmé" | "[Nom du produit] expire le [date]" |
