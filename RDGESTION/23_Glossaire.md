# 23 — Glossaire

| Terme | Définition |
|:------|:-----------|
| **Tenant** | Une boutique/commerce inscrit sur RDGESTION. Chaque tenant a ses propres données isolées. |
| **Multi-tenant** | Architecture où une seule instance de l'application sert plusieurs boutiques, avec isolation des données par `tenant_id`. |
| **Gérant (ADMIN)** | Le propriétaire/administrateur d'une boutique. Il a accès à toutes les fonctionnalités de sa boutique. |
| **Vendeur (SELLER)** | Un employé de la boutique. N'a accès qu'au POS et à l'historique en lecture seule. |
| **Super Administrateur (SUPERADMIN)** | Le propriétaire de la plateforme RDGESTION. Gère les boutiques et les abonnements. |
| **POS** | Point of Sale (Point de Vente). Interface d'encaissement des ventes. |
| **SKU** | Stock Keeping Unit. Code interne unique identifiant un produit dans une boutique. |
| **Ticket de caisse** | Reçu imprimé (ou affichable) généré après chaque vente. |
| **MoMo** | Mobile Money. Paiement mobile via des opérateurs comme MTN, Orange, Flooz, Wave. |
| **Référence MoMo** | Code de transaction fourni par l'opérateur Mobile Money lors d'un paiement. |
| **Soft Delete** | Suppression logique. Le produit n'est pas effacé de la base mais marqué comme supprimé (corbeille). |
| **Corbeille** | Section où sont conservés les produits supprimés logiquement, avec possibilité de restauration. |
| **Seuil d'alerte** | Quantité minimale en dessous de laquelle une alerte de stock est déclenchée. |
| **Parrainage** | Système par lequel un utilisateur existant invite un nouveau commerce. 2 filleuls payants = 1 mois PRO offert. |
| **Filleul** | Nouveau commerce inscrit via un code de parrainage. |
| **Parrain** | Commerce existant dont le code de parrainage a été utilisé par un filleul. |
| **FedaPay** | Passerelle de paiement africaine prévue pour l'automatisation future des abonnements PRO. |
| **JWT** | JSON Web Token. Mécanisme d'authentification stateless utilisé par RDGESTION. |
| **Argon2id** | Algorithme de hachage de mot de passe recommandé par l'OWASP, résistant aux attaques GPU. |
| **PWA** | Progressive Web App. Permet d'installer l'application comme une app native depuis le navigateur. |
| **Skeleton Loader** | Placeholder animé gris affiché pendant le chargement des données. |
| **RBAC** | Role-Based Access Control. Contrôle d'accès basé sur les rôles (SUPERADMIN, ADMIN, SELLER). |
| **SOLID** | Ensemble de 5 principes de conception orientée objet pour un code maintenable. |
| **Rate Limiting** | Limitation du nombre de requêtes par minute pour protéger l'API contre les abus. |
| **Ajv** | Bibliothèque de validation de schémas JSON utilisée par Fastify. |
| **Lifetime** | Abonnement à vie (paiement unique de 50 000 FCFA). |
