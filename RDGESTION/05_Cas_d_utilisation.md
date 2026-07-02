# 05 — Cas d'Utilisation Détaillés

Chaque cas d'utilisation suit la structure : Acteur, Préconditions, Déclencheur, Scénario principal, Scénario alternatif, Scénario d'erreur, Résultat attendu, Logs créés, Notifications, Permissions nécessaires, Validations, Messages affichés.

---

## CU-01 : Inscription d'une nouvelle boutique

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Visiteur (futur gérant) |
| **Préconditions** | Aucun compte existant avec ce numéro de téléphone |
| **Déclencheur** | Clic sur "Créer ma boutique" depuis la page d'accueil |

### Scénario principal
1. Le visiteur accède à la page d'inscription.
2. Il remplit : nom de la boutique, nom du propriétaire, téléphone, mot de passe, confirmation du mot de passe.
3. Il peut optionnellement saisir un code de parrainage.
4. Il clique sur "Créer ma boutique".
5. Le système valide les données (format téléphone, unicité, force du mot de passe).
6. Le système crée le tenant, l'abonnement FREE, l'utilisateur ADMIN.
7. Si un code de parrainage valide est fourni, un enregistrement de parrainage est créé.
8. Le système génère un token JWT.
9. L'utilisateur est redirigé vers la page de sélection du type de commerce.
10. Il sélectionne son type via des cases à cocher.
11. Les catégories prédéfinies sont créées automatiquement.
12. L'utilisateur est redirigé vers son dashboard.

### Scénario alternatif
- **3a.** Le visiteur saisit un code de parrainage invalide → message d'erreur "Code de parrainage non reconnu" mais l'inscription peut continuer sans code.
- **10a.** L'utilisateur ne coche rien → seule la catégorie "Autres" est créée.

### Scénario d'erreur
- **5a.** Le téléphone existe déjà → erreur "Ce numéro de téléphone est déjà associé à un compte".
- **5b.** Le mot de passe ne respecte pas les critères → erreur "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre".
- **5c.** Les mots de passe ne correspondent pas → erreur "Les mots de passe ne correspondent pas".

### Résultat attendu
- Tenant créé en base.
- Abonnement FREE actif.
- Utilisateur ADMIN créé avec mot de passe haché en Argon2id.
- Catégories prédéfinies créées.
- Token JWT renvoyé au client.

### Logs créés
- `TENANT_CREATED` : avec les données du tenant (nom, propriétaire, téléphone).
- `USER_CREATED` : avec le rôle ADMIN.
- `SUBSCRIPTION_CREATED` : tier FREE.

### Notifications
- Aucune notification côté app (l'utilisateur est déjà en cours d'utilisation).

### Permissions nécessaires
- Aucune (endpoint public).

---

## CU-02 : Connexion d'un utilisateur

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant ou Vendeur |
| **Préconditions** | Compte existant et actif |
| **Déclencheur** | Soumission du formulaire de connexion |

### Scénario principal
1. L'utilisateur saisit son identifiant (téléphone ou `vendeur.xxx-nnn`) et son mot de passe.
2. Le système vérifie l'identifiant en base.
3. Le système compare le mot de passe avec le hash Argon2id.
4. Un token JWT est généré avec le payload : `{ userId, tenantId, role, username }`.
5. L'utilisateur est redirigé selon son rôle :
   - ADMIN → `/dashboard`
   - SELLER → `/pos`
   - SUPERADMIN → `/admin/dashboard`

### Scénario d'erreur
- **2a / 3a.** Identifiant ou mot de passe incorrect → erreur 401 "Identifiant ou mot de passe incorrect" (message volontairement générique pour ne pas révéler si c'est l'identifiant ou le mot de passe qui est faux).
- **2b.** Compte désactivé → erreur 403 "Votre compte a été désactivé. Contactez votre administrateur."

### Logs créés
- `LOGIN_SUCCESS` ou `LOGIN_FAILED` : avec IP, User-Agent, identifiant tenté, date/heure.

---

## CU-03 : Ajouter un produit

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant (ADMIN) |
| **Préconditions** | Connecté, au moins une catégorie existante |
| **Déclencheur** | Clic sur "Ajouter un produit" |

### Scénario principal
1. Le gérant accède au formulaire d'ajout de produit.
2. Il remplit les champs obligatoires : nom, catégorie, prix d'achat, prix de vente, quantité.
3. Il peut optionnellement : ajouter un SKU, une photo, une description, cocher "Produit périssable" et renseigner la date de péremption.
4. **Comportement UX de la date de péremption** : tant que la case "Produit périssable" n'est pas cochée, la section de date de péremption est **complètement grisée** (opacity réduite, champs désactivés, non cliquable). Quand la case est cochée, la section se dégrise avec une animation fluide et le champ date devient obligatoire.
5. Il clique sur "Enregistrer".
6. Le système valide les données (prix de vente ≥ prix d'achat, quantité ≥ 0, date de péremption dans le futur si applicable).
7. Si aucun SKU n'est fourni, le système en génère un automatiquement (`SKU-XXXXXX`).
8. Le produit est créé en base.
9. Si le stock initial est ≤ au seuil d'alerte, une notification est créée.
10. Un log `PRODUCT_ADD` est enregistré avec toutes les données du produit.
11. L'utilisateur est redirigé vers la liste des produits avec un message de succès.

### Scénario d'erreur
- **6a.** Prix de vente < prix d'achat → erreur "Le prix de vente doit être supérieur ou égal au prix d'achat".
- **6b.** Date de péremption dans le passé → erreur "La date de péremption doit être dans le futur".
- **6c.** Photo trop lourde → erreur "La taille de l'image ne doit pas dépasser 2 Mo".

### Logs créés
- `PRODUCT_ADD` : avec toutes les données saisies.

---

## CU-04 : Effectuer une vente (POS)

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant (ADMIN) ou Vendeur (SELLER) |
| **Préconditions** | Connecté, au moins 1 produit en stock, limite de ventes journalières non atteinte |
| **Déclencheur** | Ajout d'un produit au panier puis clic sur "Confirmer la vente" |

### Scénario principal
1. L'utilisateur accède à l'interface POS.
2. Il recherche un produit via la barre de recherche instantanée (par nom ou SKU).
3. Il clique sur le produit → ajouté au panier (quantité = 1).
4. Il peut ajuster la quantité avec les boutons +/-.
5. Il peut ajouter d'autres produits.
6. Il peut appliquer une remise (montant fixe ou pourcentage).
7. Le total est calculé et affiché en temps réel.
8. Il choisit le mode de paiement :
   - **Espèces** : optionnellement saisir le montant reçu pour calculer la monnaie.
   - **Mobile Money** : saisir obligatoirement la référence de transaction complète.
9. Il clique sur "Confirmer la vente".
10. Le système vérifie les stocks, la limite journalière, et procède à la vente dans une transaction SQL.
11. Les stocks sont décrémentés.
12. Un ticket de caisse s'affiche dans une modale → l'utilisateur peut imprimer ou ignorer.
13. Le panier est vidé et le POS est prêt pour la prochaine vente.

### Scénario alternatif
- **8a.** Si Mobile Money et la référence est vide → le bouton "Confirmer" reste grisé et désactivé.
- **6a.** Si le vendeur tente une remise supérieure au maximum autorisé → erreur "La remise ne peut pas dépasser X%".

### Scénario d'erreur
- **10a.** Stock insuffisant → erreur `STOCK_INSUFFICIENT` avec le détail du produit concerné.
- **10b.** Limite de 30 ventes atteinte (FREE) → erreur "Vous avez atteint votre limite quotidienne de 30 ventes. Passez au plan PRO pour des ventes illimitées."
- **10c.** Abonnement expiré → erreur "Votre abonnement a expiré."

### Logs créés
- `SALE_CREATE` : avec le détail complet du panier (articles, quantités, prix, remise, mode de paiement, référence MoMo, vendeur, total, bénéfice estimé).

### Notifications
- Si un produit passe sous son seuil d'alerte après la vente → notification `STOCK_LOW`.

---

## CU-05 : Annuler une vente

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant (ADMIN) ou Vendeur (SELLER) |
| **Préconditions** | Vente existante, non déjà annulée |
| **Déclencheur** | Clic sur "Annuler" dans l'historique des ventes |

### Scénario principal
1. L'utilisateur consulte l'historique des ventes.
2. Il clique sur "Annuler" à côté d'une vente.
3. Une modale de confirmation s'affiche avec le récapitulatif de la vente (articles, montants, vendeur, date).
4. L'utilisateur confirme l'annulation.
5. Le backend marque la vente comme annulée (`is_cancelled = true`).
6. Le stock de chaque produit concerné est **re-crédité**.
7. La vente reste visible dans l'historique avec un badge rouge "Annulée".
8. La vente n'est plus comptabilisée dans les statistiques (CA, bénéfice, graphiques).

### Logs créés
- `SALE_CANCEL` : avec le détail complet de la vente annulée et l'identité de l'utilisateur qui a annulé.

---

## CU-06 : Créer un compte vendeur

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant (ADMIN) |
| **Préconditions** | Connecté en tant qu'ADMIN |
| **Déclencheur** | Clic sur "Ajouter un vendeur" dans les paramètres |

### Scénario principal
1. Le gérant accède à "Paramètres > Gestion des vendeurs".
2. Il clique sur "Ajouter un vendeur".
3. Le système affiche le formulaire avec :
   - **Identifiant** : champ pré-rempli et non modifiable avec le format `vendeur.[nom_boutique]-` suivi de 3 chiffres aléatoires auto-générés. Le gérant peut régénérer les 3 chiffres en cliquant sur un bouton de régénération.
   - **Mot de passe** : champ libre que le gérant remplit lui-même.
   - **Confirmation du mot de passe** : doit correspondre.
4. Le gérant valide le formulaire.
5. Le compte vendeur est créé avec le rôle `SELLER`.
6. Un log `USER_CREATED` est enregistré.

### Règle de sécurité importante
- Le vendeur ne peut **jamais** modifier son identifiant.
- Le gérant crée le mot de passe pour le vendeur (pour plus de sécurité, le vendeur ne choisit pas son propre mot de passe).
- Le gérant peut à tout moment désactiver un vendeur (son compte est désactivé mais conservé en base pour les logs).
- Le gérant peut réinitialiser le mot de passe d'un vendeur.

### Logs créés
- `USER_CREATED` : avec le rôle SELLER, l'identifiant généré, le tenant_id.

---

## CU-07 : Consulter les logs d'audit

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant (ADMIN) uniquement |
| **Préconditions** | Connecté en tant qu'ADMIN |

### Scénario principal
1. Le gérant accède à "Journal d'activité" (Logs).
2. Le système affiche la liste chronologique de toutes les actions enregistrées.
3. Chaque entrée de log affiche : date/heure, utilisateur (nom + rôle), action effectuée, résumé des détails.
4. Le gérant peut filtrer par :
   - Type d'action (connexion, vente, modification, suppression, etc.)
   - Utilisateur (gérant ou un vendeur spécifique)
   - Période (du/au)
5. Le gérant peut cliquer sur une entrée pour voir les détails complets (anciennes/nouvelles valeurs, IP, navigateur, appareil).

### Permissions
- **Seul le gérant** peut accéder aux logs. Le vendeur n'a aucun accès à cette page.

---

## CU-08 : Exporter des données

| Attribut | Détail |
|:---------|:-------|
| **Acteur** | Gérant (ADMIN), abonnement PRO requis |
| **Préconditions** | Abonnement PRO actif |

### Scénario principal
1. Le gérant accède à "Exports" (ou depuis une section de la page correspondante).
2. Il choisit le type de données à exporter :
   - **Produits** : liste complète avec stocks, catégories, prix.
   - **Ventes** : rapport sur une période définie (du/au).
   - **Rapport de fin de journée** : synthèse de la journée.
3. Il choisit le format : **PDF** ou **Excel (.xlsx)**.
4. Le fichier est généré côté serveur et téléchargé par le navigateur.

### Scénario d'erreur
- Abonnement FREE → message "Cette fonctionnalité est réservée aux utilisateurs PRO. Passez au plan PRO pour débloquer les exports."
