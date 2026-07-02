# 03 — Cahier des Charges Fonctionnel Exhaustif

Ce document décrit **chaque fonctionnalité** de RDGESTION avec son objectif, son comportement attendu, ses règles métier, ses exceptions et ses contraintes.

---

## 3.1 Inscription et création de boutique

### 3.1.1 Objectif
Permettre à n'importe quel commerçant de créer sa boutique sur RDGESTION en moins de 30 secondes, avec le minimum d'informations requis.

### 3.1.2 Champs du formulaire d'inscription

| Champ | Type | Obligatoire | Validation | Exemple |
|:------|:-----|:------------|:-----------|:--------|
| Nom de la boutique | Texte | ✅ Oui | 2–100 caractères, alphanumérique + espaces + tirets | "Pharmacie du Marché" |
| Nom du propriétaire | Texte | ✅ Oui | 2–80 caractères | "Kofi Mensah" |
| Téléphone | Texte | ✅ Oui | Format international ou local, unique en base | "+228 90 12 34 56" |
| Mot de passe | Texte | ✅ Oui | Minimum 8 caractères, au moins 1 majuscule, 1 chiffre | "MonMotDePasse1" |
| Confirmation mot de passe | Texte | ✅ Oui | Doit correspondre exactement au mot de passe | — |
| Code de parrainage | Texte | ❌ Non | Format `RD-XXXXX-NNN` si renseigné | "RD-PHARMA-482" |

### 3.1.3 Processus à l'inscription

1. L'utilisateur remplit le formulaire et clique sur "Créer ma boutique".
2. Le serveur valide les données (unicité du téléphone, format du mot de passe).
3. Le serveur crée dans cet ordre :
   - Un enregistrement dans la table `tenants` (la boutique).
   - Un enregistrement dans la table `subscriptions` avec le tier `FREE`.
   - Un enregistrement dans la table `users` avec le rôle `ADMIN`.
   - Les catégories par défaut selon le type de commerce choisi.
4. Si un code de parrainage valide est fourni, un enregistrement est créé dans `referrals`.
5. Un token JWT est généré et renvoyé au client.
6. L'utilisateur est redirigé vers la page de sélection du type de commerce.
7. Un log d'audit `TENANT_CREATED` est enregistré.

### 3.1.4 Sélection du type de commerce (Onboarding)

Après la première connexion, l'utilisateur voit une page d'onboarding avec des **cases à cocher** représentant les domaines d'activité :

- ☐ Alimentation générale
- ☐ Pharmacie / Parapharmacie
- ☐ Quincaillerie / Bricolage
- ☐ Vêtements / Accessoires / Mode
- ☐ Informatique / Téléphonie
- ☐ Cosmétiques / Beauté
- ☐ Restaurant / Snack / Buvette
- ☐ Librairie / Papeterie
- ☐ Électroménager
- ☐ Autres (toujours disponible)

**Comportement** : En fonction des cases cochées, le système crée automatiquement des catégories de produits adaptées. Par exemple :
- "Pharmacie" → Analgésiques, Antibiotiques, Vitamines, Soins corporels, Premiers secours, Accessoires médicaux
- "Alimentation" → Boissons, Conserves, Épicerie, Produits laitiers, Produits frais, Surgelés
- "Vêtements" → Homme, Femme, Enfant, Chaussures, Accessoires

La catégorie "**Autres**" est **toujours créée automatiquement** quel que soit le choix.

### 3.1.5 Règles métier

- Un numéro de téléphone ne peut être associé qu'à **un seul tenant** (une seule boutique).
- Le mot de passe est haché avec **Argon2id** avant stockage. Le mot de passe en clair ne doit **jamais** être stocké ni loggé.
- L'inscription crée automatiquement un abonnement `FREE` avec une date de début à l'instant de l'inscription et **aucune date de fin** (illimité tant que l'utilisateur reste en FREE).
- Les utilisateurs **Pro** pourront créer des catégories personnalisées supplémentaires. Les utilisateurs FREE ne peuvent utiliser que les catégories prédéfinies et "Autres".

---

## 3.2 Connexion et authentification

### 3.2.1 Formulaire de connexion

| Champ | Type | Validation |
|:------|:-----|:-----------|
| Identifiant | Texte | Téléphone (pour gérant) ou `vendeur.xxxxx-nnn` (pour vendeur) |
| Mot de passe | Texte | Non vide |

### 3.2.2 Processus de connexion

1. Le serveur vérifie l'identifiant dans la table `users`.
2. Le serveur compare le mot de passe avec le hash Argon2id stocké.
3. Si la connexion échoue, le serveur retourne une erreur générique `401 Unauthorized` avec le message "Identifiant ou mot de passe incorrect" (ne pas préciser lequel est faux pour des raisons de sécurité).
4. Si la connexion réussit :
   - Un token JWT est généré (durée : 24h).
   - Un log `LOGIN_SUCCESS` est enregistré avec IP, User-Agent, date/heure.
5. Si la connexion échoue, un log `LOGIN_FAILED` est enregistré avec les mêmes métadonnées.

### 3.2.3 Redirection après connexion selon le rôle

| Rôle | Page d'accueil |
|:-----|:---------------|
| SUPERADMIN | `/admin/dashboard` — Vue globale de la plateforme (gestion des tenants et abonnements) |
| ADMIN (Gérant) | `/dashboard` — Tableau de bord de la boutique (CA, ventes, bénéfices, alertes, graphiques) |
| SELLER (Vendeur) | `/pos` — **Directement** l'interface de vente (POS), sans dashboard intermédiaire |

---

## 3.3 Gestion des produits

### 3.3.1 Données d'une fiche produit

| Champ | Type | Obligatoire | Validation | Notes |
|:------|:-----|:------------|:-----------|:------|
| Nom | Texte | ✅ Oui | 1–150 caractères | Nom affiché sur l'interface POS |
| SKU (code interne) | Texte | ❌ Non | Si vide, auto-généré (format : `SKU-XXXXXX`) | Identifiant interne du produit |
| Catégorie | Sélection | ✅ Oui | Doit correspondre à une catégorie existante du tenant | Menu déroulant |
| Prix d'achat | Nombre décimal | ✅ Oui | > 0, max 2 décimales | Coût d'acquisition |
| Prix de vente | Nombre décimal | ✅ Oui | ≥ prix d'achat, max 2 décimales | Prix de vente au client |
| Quantité en stock | Entier | ✅ Oui | ≥ 0 | Stock initial |
| Seuil d'alerte | Entier | ❌ Non | ≥ 0, défaut = valeur globale (20 par défaut) | Si non renseigné, utilise le seuil global |
| Photo | Fichier image | ❌ Non | JPG, PNG, WebP, max 2 Mo | Affichée sur la fiche et sur le POS |
| Description | Texte long | ❌ Non | Max 1000 caractères | Description interne du produit |
| Produit périssable | Case à cocher | ❌ Non | Booléen | Active/désactive la section date de péremption |
| Date de péremption | Date | Conditionnel | Obligatoire si "Produit périssable" est coché, doit être dans le futur | **Section grisée et non interactive** tant que la case "Produit périssable" n'est pas cochée |

### 3.3.2 Pas de variantes

Un produit = une fiche. Il n'y a **pas** de système de variantes (taille, couleur, capacité). Si le commerçant vend un tee-shirt en 3 tailles, il doit créer 3 fiches produit distinctes.

### 3.3.3 Suppression logique (Corbeille)

Lorsqu'un administrateur "supprime" un produit :
- Le champ `is_deleted` passe à `true`.
- Le champ `deleted_at` est renseigné avec la date/heure actuelle.
- Le produit **disparaît** de toutes les listes et du POS.
- Le produit **reste accessible** dans la section "Corbeille" accessible depuis les paramètres.
- L'administrateur peut **restaurer** un produit de la corbeille (le champ `is_deleted` repasse à `false`).
- Un log `PRODUCT_DELETE` est enregistré avec toutes les données du produit au moment de la suppression.
- Un log `PRODUCT_RESTORE` est enregistré en cas de restauration.
- **Aucune suppression définitive n'est possible** via l'interface. Les données sont conservées indéfiniment.

### 3.3.4 Modification d'un produit

Lorsqu'un champ est modifié :
- L'ancienne valeur et la nouvelle valeur sont enregistrées dans le log d'audit.
- Exemple de log pour un changement de prix :
```json
{
  "action": "PRODUCT_UPDATE",
  "user_id": "uuid",
  "product_id": "uuid",
  "changes": {
    "sell_price": { "old": 1500, "new": 2000 },
    "purchase_price": { "old": 800, "new": 900 }
  },
  "ip": "192.168.1.10",
  "user_agent": "Mozilla/5.0 ...",
  "timestamp": "2026-07-01T14:30:00Z"
}
```

---

## 3.4 Gestion des stocks

### 3.4.1 Règle de blocage à zéro

**Règle absolue** : il est **strictement interdit** de vendre un produit dont le stock est à 0 (zéro).

**Comportement frontend** :
- Sur le POS, les produits en rupture sont affichés en grisé avec un badge "Rupture" et leur bouton d'ajout au panier est désactivé.
- Si un produit tombe à 0 pendant qu'il est dans le panier d'un autre utilisateur, la tentative de validation de la vente est rejetée.

**Comportement backend** :
- L'endpoint `POST /api/sales` vérifie le stock de **chaque produit** du panier **dans une transaction SQL** avant de valider la vente.
- En cas de stock insuffisant, l'API retourne `400 Bad Request` avec le corps :
```json
{
  "error": "STOCK_INSUFFICIENT",
  "product_id": "uuid-du-produit",
  "product_name": "Doliprane 500mg",
  "requested_quantity": 3,
  "available_quantity": 0
}
```

### 3.4.2 Seuils d'alerte

- **Seuil global par défaut** : 20 unités. Configurable dans `Paramètres > Général`.
- **Seuil individuel par produit** : Si renseigné, il prend la priorité sur le seuil global.
- **Déclenchement de l'alerte** : Quand `stock_quantity ≤ stock_threshold`.
- **Affichage** :
  - Badge orange sur la carte du produit (POS et liste de produits).
  - Indicateur numérique sur le dashboard du gérant : "X produits en alerte".
  - Notification dans le centre de notifications.

### 3.4.3 Entrées et sorties de stock

Les mouvements de stock sont tracés :
- **Entrée** : Ajout de stock via la modification de la quantité d'un produit.
- **Sortie** : Vente (décrémentation automatique) ou ajustement manuel (inventaire).
- Chaque mouvement génère un log avec l'ancienne et la nouvelle quantité.

---

## 3.5 Ventes et Point de Vente (POS)

### 3.5.1 Interface POS — Spécifications détaillées

L'interface POS est le **cœur de l'application**. Elle doit être extrêmement fluide et responsive.

**Layout** :
- **Colonne gauche (60–70% de la largeur)** : Grille de produits avec barre de recherche instantanée.
- **Colonne droite (30–40% de la largeur)** : Panier de vente avec résumé et boutons d'action.

**Barre de recherche** :
- Recherche instantanée (dès le 1er caractère tapé) par nom de produit ou SKU.
- Filtre optionnel par catégorie.
- Résultats affichés sous forme de cartes produit cliquables (avec photo si disponible, nom, prix de vente, stock restant).

**Ajout au panier** :
- Clic simple ou touche Entrée sur un produit → ajouté au panier avec quantité 1.
- Si le produit est déjà dans le panier → la quantité s'incrémente de 1.
- Boutons + / - pour ajuster la quantité dans le panier.
- Bouton de suppression (icône poubelle) pour retirer un article du panier.
- Animation fluide lors de l'ajout au panier (micro-animation de confirmation).

**Résumé du panier** :
- Liste des articles avec : nom, quantité, prix unitaire, sous-total.
- Ligne de remise (montant fixe ou pourcentage, saisissable par le vendeur ET le gérant).
- **Total final** affiché en gros caractères, mis à jour en temps réel.

### 3.5.2 Modes de paiement

Deux modes exclusifs (pas de paiement mixte) :

#### Espèces
1. Le vendeur clique sur "Payer en espèces".
2. Un champ optionnel "Montant reçu" permet de calculer la monnaie à rendre.
3. Le vendeur confirme la vente.

#### Mobile Money
1. Le vendeur clique sur "Payer par Mobile Money".
2. Un champ **obligatoire** "Référence de la transaction" apparaît.
3. Le vendeur saisit la **référence complète** de la transaction de l'opérateur (MTN MoMo, Orange Money, Flooz, Wave, etc.).
4. Le bouton "Confirmer la vente" reste **grisé et non cliquable** tant que la référence n'est pas renseignée.
5. La référence est stockée dans la table `sales` (champ `momo_reference`).

### 3.5.3 Processus de validation d'une vente

1. Le vendeur clique sur "Confirmer la vente".
2. Le frontend envoie `POST /api/sales` avec le panier, le mode de paiement, la référence MoMo (si applicable), et la remise.
3. Le backend ouvre une **transaction SQL** :
   a. Vérifie que l'abonnement est actif et que la limite de ventes journalières n'est pas atteinte (30 pour FREE).
   b. Vérifie le stock de chaque produit.
   c. Crée l'enregistrement `sales`.
   d. Crée les enregistrements `sale_items`.
   e. Décrémente le stock de chaque produit.
   f. Vérifie si un produit passe sous son seuil d'alerte → crée une notification.
   g. Crée un log d'audit `SALE_CREATE` avec le détail complet du panier.
   h. **Commit** la transaction.
4. Le frontend reçoit la réponse avec l'ID de la vente.
5. Une modale d'impression du ticket de caisse s'affiche.

### 3.5.4 Impression du ticket de caisse

Après chaque vente, une modale propose :
- **"Imprimer le ticket"** : Ouvre la fenêtre d'impression du navigateur avec un ticket formaté.
- **"Ignorer"** (Skip) : Ferme la modale sans imprimer.

**Contenu du ticket de caisse** :
- En-tête : nom de la boutique, adresse (si renseignée), téléphone (si renseigné).
- Logo de la boutique (si renseigné, **PRO uniquement**).
- Slogan (si renseigné, **PRO uniquement**).
- Date et heure de la vente.
- Numéro de transaction (ID lisible, ex: `VENTE-2026-0001523`).
- Nom du vendeur.
- Liste des articles : nom, quantité, prix unitaire, sous-total.
- Remise appliquée (si applicable).
- **Total**.
- Mode de paiement (Espèces ou Mobile Money).
- Référence de transaction Mobile Money (si applicable).
- Pied de page : "Merci pour votre achat !" (personnalisable **PRO uniquement**).

**Personnalisation (PRO uniquement)** :
- Logo
- Slogan
- Message de pied de page
- Largeur du ticket (58mm ou 80mm)
- Affichage ou non du QR Code

### 3.5.5 Annulation d'une vente

Le gérant ET le vendeur peuvent annuler une vente :
1. L'utilisateur clique sur "Annuler" dans l'historique des ventes.
2. Une modale de confirmation s'affiche avec le détail de la vente.
3. L'utilisateur confirme l'annulation.
4. Le backend ouvre une **transaction SQL** :
   a. Marque la vente comme `is_cancelled = true`.
   b. **Re-crédite** le stock de chaque produit concerné.
   c. Crée un log d'audit `SALE_CANCEL` avec le détail complet de la vente annulée.
5. La vente annulée reste visible dans l'historique avec un badge "Annulée" en rouge, mais n'est plus comptabilisée dans les statistiques.

### 3.5.6 Remises

- Le gérant ET le vendeur peuvent appliquer une remise.
- Deux types de remise : montant fixe (ex: -500 FCFA) ou pourcentage (ex: -10%).
- La remise est enregistrée dans `sales.discount_applied` et `sales.discount_type`.
- La remise est tracée dans le log d'audit.
- Le vendeur ne peut **pas** accorder une remise supérieure à un pourcentage maximum défini dans les paramètres (par défaut : 20%).

### 3.5.7 Historique des ventes

- Accessible au gérant et au vendeur.
- Le vendeur peut uniquement **consulter** l'historique, **sans pouvoir modifier** une vente passée.
- Le vendeur peut annuler une vente et réimprimer un ticket.
- Filtres : par date, par vendeur, par mode de paiement, par statut (validée/annulée).
- Chaque ligne d'historique affiche : date/heure, vendeur, total, mode de paiement, statut.

---

## 3.6 Abonnements et limites

### 3.6.1 Plan FREE

| Fonctionnalité | Limite |
|:---------------|:-------|
| Ventes par jour | **30 maximum** (compteur réinitialisé à 00:00 heure locale) |
| Produits | Illimité |
| Vendeurs | Illimité |
| Personnalisation tickets | ❌ Ticket standard uniquement |
| Exports PDF/Excel | ❌ Verrouillé |
| Création de catégories | ❌ Catégories prédéfinies uniquement |

Lorsque la 30ème vente du jour est validée :
- Un bandeau d'avertissement s'affiche en haut du POS : "Vous avez atteint votre limite quotidienne de 30 ventes. Passez au plan PRO pour des ventes illimitées."
- Le bouton "Confirmer la vente" est **désactivé** jusqu'au lendemain.
- Le compteur est réinitialisé chaque jour à 00:00 (fuseau horaire de la boutique, configuré dans les paramètres ou auto-détecté).

### 3.6.2 Plan PRO

- **5 000 FCFA/mois** ou **50 000 FCFA à vie** (Lifetime).
- Ventes illimitées.
- Accès complet à la personnalisation des tickets.
- Accès complet aux exports PDF et Excel.
- Possibilité de créer des catégories personnalisées.

### 3.6.3 Activation de l'abonnement PRO

**Phase initiale : Activation manuelle**
1. L'utilisateur contacte le Super Administrateur via les coordonnées affichées dans l'application.
2. Le paiement est effectué hors plateforme (Mobile Money, virement, espèces).
3. Le Super Administrateur se connecte au panel d'administration et active l'abonnement.

**Phase future : Activation automatique via FedaPay**
- L'architecture est conçue dès le départ pour intégrer l'API FedaPay.
- L'interface de paiement sera ajoutée dans une mise à jour future.
- Un module `payments` est prévu dans l'architecture avec un service abstrait `PaymentService` qui pourra être implémenté avec FedaPay.

---

## 3.7 Système de parrainage

### 3.7.1 Code de parrainage

- Chaque boutique reçoit un code de parrainage unique lors de l'inscription.
- Format : `RD-[NOM_BOUTIQUE_NORMALISÉ]-[3_CHIFFRES]` (ex: `RD-PHARMA-482`).
- Le code est affiché dans les paramètres de la boutique et peut être partagé librement.

### 3.7.2 Utilisation du code

- Lors de l'inscription, le nouveau commerçant peut saisir un code de parrainage.
- Si le code est valide, un enregistrement `referral` est créé avec le statut `PENDING`.

### 3.7.3 Conditions de récompense

- Le parrainage est **effectif** uniquement si le filleul souscrit un abonnement **PRO payant** (pas si le Super Admin offre un accès gratuit).
- Quand un filleul passe PRO, le statut du `referral` passe à `COMPLETED`.
- **Règle d'or** : 2 filleuls COMPLETED déclenchent l'attribution de **1 mois PRO gratuit** au parrain.
- Le mois gratuit prolonge la date d'expiration de l'abonnement du parrain de 30 jours.
- Le système est **activable pour une durée limitée** que le Super Administrateur peut définir (date de début et de fin du programme de parrainage).

---

## 3.8 Tableau de bord (Dashboard)

### 3.8.1 Dashboard Gérant (Administrateur de boutique)

Le dashboard affiche :

**Cartes de statistiques (en haut)** :
- 💰 Chiffre d'affaires du jour (montant total des ventes non annulées)
- 🛒 Nombre de ventes du jour
- 📈 Bénéfice estimé du jour (somme des (prix_vente - prix_achat) * quantité pour chaque article vendu)
- ⚠️ Nombre de produits en alerte de stock

**Graphiques interactifs** :
- Courbe de l'évolution du CA : filtre par jour / semaine / mois / année.
- Histogramme des ventes par catégorie.
- Top 5 des produits les plus vendus.

**Alertes** :
- Liste des produits dont le stock est inférieur ou égal au seuil configuré.
- Notification si l'abonnement expire bientôt (7, 3, 1 jour avant).

**Raccourcis rapides** :
- Accéder au POS
- Ajouter un produit
- Voir l'historique des ventes
- Consulter les logs

### 3.8.2 Dashboard Super Administrateur

- Nombre total de boutiques inscrites (et évolution)
- Nombre de boutiques actives (ayant fait au moins 1 vente dans les 7 derniers jours)
- Répartition FREE / PRO
- Revenus des abonnements
- Liste des boutiques avec filtres (actif/inactif, FREE/PRO, date d'inscription)
- Actions : activer/désactiver un abonnement, voir les détails d'une boutique

---

## 3.9 Paramètres de la boutique

Accessibles uniquement au gérant (ADMIN) :

### 3.9.1 Informations de la boutique

| Paramètre | Modifiable | Notes |
|:-----------|:-----------|:------|
| Nom de la boutique | ✅ | |
| Nom du propriétaire | ✅ | |
| Téléphone | ✅ | Vérifié unique |
| Email | ✅ | Facultatif |
| Adresse | ✅ | Facultatif |
| Ville | ✅ | Facultatif |
| Pays | ✅ | Facultatif |
| Devise | ✅ | FCFA par défaut |
| Logo | ✅ | Upload d'image (PRO uniquement pour l'affichage sur ticket) |
| Slogan | ✅ | PRO uniquement |
| Numéro fiscal | ✅ | Facultatif |

### 3.9.2 Paramètres de stock

| Paramètre | Valeur par défaut | Notes |
|:-----------|:------------------|:------|
| Seuil d'alerte global | 20 | Modifiable, s'applique à tous les produits qui n'ont pas de seuil individuel |

### 3.9.3 Paramètres de sécurité

| Paramètre | Description |
|:-----------|:------------|
| Changer le mot de passe | Ancien + nouveau + confirmation |
| Gérer les vendeurs | Créer, désactiver, réinitialiser le mot de passe d'un vendeur |
| Remise maximum vendeur | Pourcentage maximal de remise autorisé pour les vendeurs (défaut : 20%) |

### 3.9.4 Paramètres du ticket (PRO uniquement)

| Paramètre | Type |
|:-----------|:-----|
| Afficher le logo | Case à cocher |
| Afficher le slogan | Case à cocher |
| Message de pied de page | Texte (ex: "Merci et à bientôt !") |
| Largeur du ticket | 58mm / 80mm |
| Afficher un QR Code | Case à cocher |
