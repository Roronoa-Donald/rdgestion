# 02 — Objectifs du Projet

## 2.1 Objectifs business

| Objectif | Indicateur de succès | Priorité |
|:---------|:---------------------|:---------|
| Acquisition rapide | Un commerçant peut s'inscrire et commencer à utiliser l'application en moins de 2 minutes | CRITIQUE |
| Rétention | Le taux de conversion FREE → PRO doit être maximisé grâce à la limite de 30 ventes/jour | HAUTE |
| Parrainage | Le système de parrainage doit générer une croissance organique (2 filleuls payants = 1 mois offert au parrain) | MOYENNE |
| Monétisation | Deux offres claires : 5 000 FCFA/mois ou 50 000 FCFA lifetime | HAUTE |
| Confiance | La traçabilité totale doit rassurer les propriétaires de boutiques sur l'honnêteté de leurs employés | CRITIQUE |

## 2.2 Objectifs techniques

| Objectif | Description | Priorité |
|:---------|:------------|:---------|
| Performance | Temps de réponse API < 200ms pour 95% des requêtes | HAUTE |
| Sécurité | Aucune faille connue (XSS, CSRF, SQL Injection, brute force) | CRITIQUE |
| Maintenabilité | Architecture modulaire permettant d'ajouter un nouveau module sans toucher au code existant | HAUTE |
| Scalabilité | L'architecture multi-tenant doit supporter des milliers de boutiques sur une seule instance | MOYENNE |
| Disponibilité | Le système doit fonctionner 24/7 avec des temps de maintenance minimaux grâce à Docker | HAUTE |

## 2.3 Objectifs UX/UI

| Objectif | Description | Priorité |
|:---------|:------------|:---------|
| Esthétique premium | Design inspiré de Stripe/Linear/Notion, absolument pas d'apparence "générée par IA" | CRITIQUE |
| Rapidité POS | Un vendeur doit pouvoir enregistrer une vente complète en moins de 15 secondes | CRITIQUE |
| Responsive | Fonctionnel sur mobile (PWA installable), tablette et PC sans perte de qualité | CRITIQUE |
| Accessibilité | Contrastes suffisants, navigation clavier complète, labels ARIA | HAUTE |
| Fluidité | Animations discrètes, skeleton loaders, transitions élégantes, pas de saccade | HAUTE |
