# Guide d'installation de RDGESTION en application (PWA)

RDGESTION est une **PWA** (Progressive Web App) : elle s'installe comme une vraie application native, avec son icône sur l'écran d'accueil, un démarrage en plein écran (sans la barre du navigateur), et un fonctionnement hors-ligne. La procédure d'installation dépend de votre appareil et de votre navigateur.

---

## 🪟 Windows (Chrome / Edge)

1. Ouvrez **`https://rdgestion.app`** dans Chrome ou Edge (Firefox ne supporte pas l'installation PWA).
2. Connectez-vous ; l'icône **" Installer"** dans la barre d'adresse (Chrome) ou le menu `⋮ → Applications → Installer ce site comme application` (Edge) devient disponible après quelques secondes.
3. Cliquez dessus, validez la fenêtre d'installation.
4. RDGESTION s'ouvre dès lors dans sa propre fenêtre (sans onglets), et un raccourci est placé dans le **menu Démarrer** et sur le **bureau**. Vous pouvez l'épingler à la barre des tâches comme n'importe quelle app native.

**Alternative** : un bouton **"Installer"** peut aussi apparaître en bas de l'écran dans l'app elle-même (si vous ne l'avez jamais refusé) — cliquez dessus pour le même effet.

---

## 🤖 Android (Chrome / Edge / Samsung Internet)

1. Ouvrez **`https://rdgestion.app`** dans Chrome (ou Edge / Samsung Internet Browser).
2. Connectez-vous. Au bout de quelques secondes, une bannière **"Installer RDGESTION ?"** apparaît en haut ou en bas — appuyez sur **Installer**.
   - Sinon, ouvrez le menu `⋮ → Installer l'application` (ou "Ajouter à l'écran d'accueil").
3. L'application est installée avec son icône **RD** et se lance en plein écran.
4. Vous la retrouvez dans le **tiroir d'applications** Android comme une app native ; elle reçoit le fond noir et le trait teal de la marque.

---

## 🍎 iOS / iPadOS (Safari) — procédure manuelle

iOS ne supporte pas (encore) l'événement `beforeinstallprompt` — il n'existe pas de bouton "Installer" automatique. L'utilisateur doit effectuer **manuellement** l'installation via Safari. RDGESTION détecte iOS et affiche un toast rappelant les étapes la 1re fois de chaque session.

### Procédure détaillée iPhone / iPad

1. Ouvrez **`https://rdgestion.app`** dans **Safari** (obligatoire — Chrome/Firefox sur iOS ne peuvent pas installer de PWA, ils utilisent le moteur WebKit mais sans accès à la fonction "Écran d'accueil").
2. Connectez-vous à votre compte RDGESTION.
3. Appuyez sur le bouton **Partager** en bas de l'écran :
   - **iPhone** : icône carrée avec une flèche pointant vers le haut, à côté de la barre d'adresse, **ou** au centre/bas de la barre d'outils.
   - **iPad** : touchez `⋮` à droite de la barre d'adresse, puis **Partager**.
4. Dans la feuille de partage qui s'ouvre, faites défiler vers le bas et touchez **"Sur l'écran d'accueil"** (icône "+" noire).
5. Choisissez un nom (RDGESTION par défaut) puis touchez **Ajouter** en haut à droite.
6. L'icône **RD** (fond noir + trait teal) apparaît sur votre écran d'accueil. Appuyez dessus : RDGESTION se lance en **plein écran sans la barre Safari**, avec le fond noir, exactement comme une app native.

### Caractéristiques après installation sur iOS

- **Fonctionnement hors-ligne** : le service worker met en cache les pages principales, le CSS, le JS et les icônes. Une fois installée, vous pouvez ouvrir l'app sans connexion et consulter les pages déjà visitées.
- **Réouverture auto** : iOS restaure la dernière vue si vous quittez et revenez (tant que Safari ne purge pas la mémoire).
- **Mises à jour** : quand une nouvelle version est déployée, le service worker se met à jour en arrière-plan. Vous verez la nouvelle version au prochain lancement de l'app (il n'y a pas de "store" pour les PWA — le SW est le canal de mise à jour).
- **Ne pas nettoyer** : si vous faites "Effacer données Safari" dans Réglages, l'app et le cache disparaîsseront — il faudra recommencer l'installation.

### Limitations connues sur iOS

- **Pas de notifications push** (iOS ne supporte pas push pour PWA — uniquement pour apps App Store).
- **Pas de `beforeinstallprompt`** : l'app ne peut pas proposer une UI "Installer" native ; d'où le guide manuel ci-dessus.
- **Pas de partage de la liste des apps installées** (Web Bundle non supporté).
- **Accès au fichier cache** : iOS peut nettoyer ce cache sous forte pression de stockage. L'app relancera ses requêtes si besoin.

> Pour une roadmap complète des support iOS, suivre le [WebKit Feature Status: `beforeinstallprompt`](https://webkit.org/status/#feature-beforeinstallprompt) — Apple a indiqué qu'ils travaillent dessus.

---

## 🔧 Vérifier que l'installation a réussi

Après installation, ouvrez l'app et regardez la barre du navigateur :
- **Elle doit être invisible** (pas d'URL affichée, pas de boutons précédent/suivant).
- L'app doit s'ouvrir en **plein écran** (avec éventuellement une barre d'état en haut pour iOS).
- L'icône doit avoir le **fond noir + RD blanc + trait teal**.

Si vous voyez encore la barre d'URL, l'installation n'a pas abouti — réessayez en vous assurant que le navigateur est récent (Chrome ≥ 90, Edge ≥ 90, Safari ≥ 17).

---

## 🧪 Désinstaller

- **Windows** : Démarrer → clic droit sur "RDGESTION" → **Désinstaller**.
- **Android** : tiroir d'applications → appui long sur icône → **Désinstaller**.
- **iOS** : appui long sur l'icône → **Supprimer l'app** (comme pour une app native).
