# Tests GUI — RDGESTION

**Date :** 2026-07-07  
**URL testée :** https://rdgestion.vercel.app  
**Navigateur :** Chromium (intégré VS Code)  
**Viewport desktop :** 1280×720  
**Viewport mobile :** 393×851 (Pixel 5)

---

## Parcours de test

### 1. Chargement de la page d'accueil
- **Statut :** ✅ Réussi
- La page se charge rapidement (~20ms après cache, première charge ~1-2s)
- Titre de la page : "RDGESTION — Gestion de Stock & POS SaaS"
- Redirige automatiquement vers `/#/login` sans token
- 17 ressources chargées (15 JS, 1 CSS), transfert total ~68 KB
- Aucune erreur de console au chargement

### 2. Page de connexion (Login)
- **Statut :** ✅ Réussi
- Titre H2 : "Bon retour sur RDGESTION"
- Sous-titre : "Connectez-vous pour reprendre la gestion de votre boutique."
- Champ Identifiant (placeholder : `+22890123456 ou vendeur.boutique-123`)
- Champ Mot de passe (placeholder : `********`)
- Bouton "Se connecter" de type `submit`
- Lien "Inscrire votre boutique" vers `#/register`
- Logo "RD" visible
- 2 inputs accessibles avec labels

### 3. Login avec identifiants invalides
- **Statut :** ❌ Échec (bug critique côté serveur)
- **Détail :** Le formulaire soumet correctement, le toast d'erreur s'affiche
- **MAIS** l'API renvoie une erreur 500 au lieu d'un 401 "Identifiant ou mot de passe incorrect"
- **Cause :** `Cannot find module 'exceljs'` — le module `exceljs` est importé dans `exports.service.ts` qui est chargé au démarrage de l'app, mais n'est pas installé dans l'environnement Vercel
- **Impact :** Toutes les routes API sont cassées (login, register, etc.)
- **Correction :** Ajouté `exceljs` et `pdfkit` dans le `package.json` racine

### 4. Accessibilité (ARIA)
- **Statut :** ✅ Réussi
- ✅ Skip-link "Aller au contenu principal" présent et focusable
- ✅ Main landmark `<main id="content-area">` présent
- ✅ `role="navigation"` présent (1 élément)
- ✅ Conteneur de toasts avec `aria-live="polite"`
- ✅ 2 inputs avec labels accessibles
- ✅ Bouton de soumission est un `<button type="submit">`

### 5. Thème clair/sombre
- **Statut :** ✅ Réussi
- ✅ `init-theme.js` chargé (prévention FOUC)
- ✅ Attribut `data-theme` sur `<html>` (valeur initiale : `light`)
- ✅ Bouton thème présent (`#theme-btn`, `aria-label="Changer de thème"`)
- ⚠️ Bouton thème caché avant login (comportement attendu)
- ✅ Basculement `light` → `dark` fonctionnel via JavaScript
- ✅ Persistance dans `localStorage` (`theme` key)
- ✅ Thème sombre visuellement correct (couleurs inversées, fond sombre)

### 6. Navigation et routing
- **Statut :** ✅ Réussi
- ✅ Navigation vers `#/register` fonctionne
- ✅ Page d'inscription affiche le formulaire complet (15 inputs)
- ✅ Toutes les routes protégées redirigent vers `#/login` sans auth :
  - `#/dashboard` → ✅ redirect login
  - `#/products` → ✅ redirect login
  - `#/pos` → ✅ redirect login
  - `#/sales` → ✅ redirect login
  - `#/settings` → ✅ redirect login
  - `#/logs` → ✅ redirect login
  - `#/admin` → ✅ redirect login
- ✅ Lien "Se connecter" sur la page register redirige vers `#/login`

### 7. Page d'inscription (Register)
- **Statut :** ✅ Réussi (côté UI)
- Titre H2 : "Créer votre espace boutique"
- Sous-titre : "Quelques informations suffisent pour ouvrir votre espace de gestion."
- Champs présents :
  - Nom du commerce (placeholder : "Pharmacie du Point G")
  - Nom du propriétaire / gérant (placeholder : "Fatou Diop")
  - Numéro de téléphone portable (placeholder : "+22890123456")
  - Mot de passe (placeholder : "8 caractères min, 1 majuscule, 1 chiffre")
  - Confirmer le mot de passe (placeholder : "Répéter le mot de passe")
  - Code parrainage optionnel (placeholder : "RD-BOUTIQUE-123")
- 9 checkboxes de secteurs d'activité : Alimentation générale, Pharmacie/Médical, Quincaillerie, Vêtements & Mode, Informatique & Mobile, Cosmétiques & Beauté, Restauration, Librairie & Papeterie, Électroménager
- Bouton "Créer mon espace"
- Lien "Déjà inscrit ? Se connecter"
- ✅ Validation côté client : "Les deux mots de passe ne correspondent pas." s'affiche quand les mots de passe diffèrent
- ❌ L'API register renvoie aussi 500 (même bug `exceljs`)

### 8. Dashboard, Produits, POS, Ventes, Paramètres, Logs, Admin
- **Statut :** ⚠️ Non testable (API cassée)
- Toutes ces pages nécessitent une authentification
- L'API étant cassée (erreur 500 sur login), impossible de tester ces pages
- Les routes redirigent correctement vers le login sans token

### 9. Responsive mobile
- **Statut :** ✅ Réussi
- ✅ Page de login s'affiche correctement en 393×851
- ✅ Tous les éléments visibles et utilisables (form, bouton, lien)
- ✅ Page d'inscription s'affiche correctement en mobile
- ✅ Les 9 checkboxes de secteurs sont visibles et cliquables
- ✅ Pas de débordement horizontal
- ✅ Le layout s'adapte au viewport mobile

### 10. PWA
- **Statut :** ✅ Réussi
- ✅ `manifest.json` lié dans le HTML
- ✅ Service Worker enregistré (scope : `https://rdgestion.vercel.app/`)
- ✅ `meta theme-color` présent
- ✅ Icône présente (`link rel="icon"`)
- ⚠️ `meta apple-mobile-web-app-capable` absente (mineur)

---

## Résumé global

| Test | Statut | Remarques |
|------|--------|-----------|
| Chargement page | ✅ | Rapide, 17 ressources, ~68 KB |
| Login UI | ✅ | Formulaire bien structuré, labels accessibles |
| Login invalide | ❌ | API 500 au lieu de 401 (bug `exceljs`) |
| Accessibilité | ✅ | Skip-link, landmarks, aria-live tous présents |
| Thème | ✅ | Light/dark fonctionnel, persistance localStorage |
| Navigation | ✅ | Toutes routes protégées redirigent vers login |
| Register UI | ✅ | Formulaire complet, validation côté client |
| Register API | ❌ | API 500 (même bug `exceljs`) |
| Dashboard | ⚠️ | Non testable (API cassée) |
| Produits | ⚠️ | Non testable (API cassée) |
| POS | ⚠️ | Non testable (API cassée) |
| Ventes | ⚠️ | Non testable (API cassée) |
| Paramètres | ⚠️ | Non testable (API cassée) |
| Responsive mobile | ✅ | Login et register s'adaptent correctement |
| PWA | ✅ | Manifest + Service Worker actifs |

---

## Bugs critiques trouvés

### 🔴 BUG #1 : Module `exceljs` manquant sur Vercel
- **Sévérité :** Critique (production down)
- **Description :** Le module `exceljs` (utilisé dans `exports.service.ts`) n'est pas listé dans le `package.json` racine que Vercel utilise pour installer les dépendances. L'import de `exceljs` au sommet de `exports.service.ts` fait crasher toute l'application au démarrage.
- **Impact :** Toutes les routes API renvoient 500 (login, register, et toutes les autres)
- **Cause racine :** `exceljs` et `pdfkit` sont dans `backend/package.json` mais pas dans le `package.json` racine
- **Correction appliquée :** Ajout de `exceljs` et `pdfkit` dans le `package.json` racine
- **Action requise :** Redéployer sur Vercel après `git push`

---

## Conclusion

Le frontend de RDGESTION est **bien construit** :
- ✅ UI soignée et professionnelle
- ✅ Accessibilité excellente (ARIA, skip-link, landmarks)
- ✅ Thème clair/sombre fonctionnel avec prévention FOUC
- ✅ Responsive mobile correct
- ✅ PWA configurée (manifest + service worker)
- ✅ Validation côté client opérationnelle
- ✅ Routing avec protection des routes

Cependant, l'application est **inutilisable en production** à cause d'un bug critique :
- 🔴 Le module `exceljs` manque sur Vercel, faisant crasher toute l'API
- Ce bug empêche login, register, et toutes les fonctionnalités backend

**Priorité absolue :** Pousser la correction (`exceljs` + `pdfkit` dans `package.json` racine) et redéployer sur Vercel. Une fois l'API fonctionnelle, il faudra refaire les tests des pages authentifiées (dashboard, produits, POS, ventes, paramètres).
