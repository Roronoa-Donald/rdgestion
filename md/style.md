# RDGESTION — Signature stylistique & brief logo

> Source de vérité unique pour l'identité visuelle de **RDGESTION**, SaaS multi-tenant de gestion de stock & point de vente (POS) destiné aux commerces de détail en Afrique de l'Ouest.
>
> Document de référence pour toute création visuelle (logo, variations, illustrations, поддержures marketing, écrans d'onboarding, favicon, icônes PWA).
>
> Extraire du design system en production (`frontend/src/css/style.css`) et de l'icône SVG (`frontend/src/assets/icon.svg`).

---

## 1. Positionnement & ADN visuel

| Axe | Valeur |
|-----|--------|
| **Inspirations** | Stripe, Linear, Notion |
| **Design system** | Flat Design (UI UX Pro Max) — minimaliste, sans skeuomorphisme, sans dégradés décoratifs |
| **Ton** | Sérieux, professionnel, sobre. Pas enfantin, pas tape-à-l'œil. Cible = commerçants Afrique de l'Ouest qui tiennent une boutique réelle et ont besoin d'un outil qui inspire confiance. |
| **Terrains d'usage** | Dashboard SaaS, POS tactile en boutique, mobile PWA, pages marketing |
| **À éviter** | Emoji colorés en surcharge, néon, dégradés saturés, skeuomorphisme, icônes illustratives rigolo |

---

## 2. Palette de couleurs — thème clair (référence)

Couleurs extraites de `:root` dans `style.css`.

### Couleur d'accent — **l'identité forte**

| Token | Hex | Rôle |
|-------|-----|------|
| `--accent-color` | **`#047857`** | 🟢 **La couleur de RDGESTION.** Boutons primaires, logo, liens actifs, soulignements. Vert émeraude profond, sobre et professionnel. |
| `--accent-hover` | `#036949` | Variante plus sombre au survol. |
| `--accent-contrast` | `#ffffff` | Texte sur accent (blanc pur). |
| `--accent-light` | `rgba(4, 120, 87, 0.08)` | Backgrounds subtils (pills, badges, état actif de menu). |

### Couleur primaire — neutre structurelle

| Token | Hex | Rôle |
|-------|-----|------|
| `--primary-color` | `#334155` | Slate-700. Titres de cards, boutons secondaires, header. |
| `--primary-hover` | `#1e293b` | Slate-800 au survol. |
| `--primary-contrast` | `#ffffff` | Texte sur primary. |

### Couleurs sémantiques

| Token | Hex clair | Rôle |
|-------|-----------|------|
| `--success` | `#0f766e` | Validation, états verts (ex : vente validée). |
| `--error` | `#b42318` | Erreurs, annulation, danger. |
| `--warning` | `#9a6700` | Avertissements (stock bas, abonnement expirant). |
| `--info` | `#1d4ed8` | Informations neutres. |

### Neutres & fonds

| Token | Hex clair | Rôle |
|-------|-----------|------|
| `--bg-primary` | `#f7f7f5` | Fond global (canvas soft, presque blanc-gris). |
| `--bg-secondary` | `#ffffff` | Cards, surfaces. |
| `--bg-tertiary` | `#f1f1ef` | Hover, zones secondaires. |
| `--border-color` | `#e4e4df` | Bordures subtiles. |
| `--border-strong` | `#d6d6d0` | Bordures au hover. |
| `--text-primary` | `#1f2328` | Texte principal. |
| `--text-secondary` | `#5f6368` | Texte secondaire. |
| `--text-muted` | `#686b70` | Texte estompé (placeholder). |
| `--text-tertiary` | `#8c9196` | Texte désactivé. |

---

## 3. Palette — thème sombre (`[data-theme="dark"]`)

Couleurs extraites du bloc `[data-theme="dark"]` dans `style.css`. Versions plus contrastées et légèrement décalées vers des teintes plus saturées.

### Accent (plus verdoyant en dark)

| Token | Hex dark |
|-------|----------|
| `--accent-color` | **`#10b981`** |
| `--accent-hover` | `#059669` |
| `--accent-contrast` | `#0c0c0d` |
| `--accent-light` | `rgba(16, 185, 129, 0.12)` |

> ⚠️ **Le logo principal doit être pensé en priorité pour le thème clair** (`#047857`), mais doit fonctionner aussi avec la version dark (`#10b981`). Voir §7 pour les variantes exigées.

### Sémantiques (dark)

| Token | Hex dark |
|-------|----------|
| `--success` | `#2dd4bf` |
| `--error` | `#f87171` |
| `--warning` | `#fbbf24` |
| `--info` | `#60a5fa` |

### Neutres (dark)

| Token | Hex dark |
|-------|----------|
| `--bg-primary` | `#0c0c0d` |
| `--bg-secondary` | `#151517` |
| `--bg-tertiary` | `#202124` |
| `--border-color` | `#2b2c30` |
| `--border-strong` | `#3a3b40` |
| `--text-primary` | `#f4f4f5` |

---

## 4. Typographie

### Paire typographique

| Token | Stack | Rôle |
|-------|-------|------|
| `--font-display` | **`"Rubik"`** + fallbacks system | Titres (h1-h6), logo, en-têtes. |
| `--font-body` | **`"Nunito Sans"`** + fallbacks system | Texte courant, formulaires, boutons, tableaux. |

### Références de font-weight

| Usage | Font-weight |
|-------|-------------|
| Logo `.logo-container` | `700` |
| Lettre du logo `.logo-icon` | **`800`** (extra-bold — lettres "RD" bien grasses) |
| Titres h1-h6 | par défaut Rubik + `letter-spacing: -0.01em` |
| Boutons `.btn` | `500` |
| Badges, labels | `600` |
| Avatar/notification | `700` |

### Hiérarchie typographique observée

```
H1/H2/H3     → Rubik 700, letter-spacing -0.01em
Logo text    → Rubik 700, font-size 18px
Logo icon    → Rubik 800, lettres "RD" centrées sur 32×32
Body         → Nunito Sans 400
Boutons      → Nunito Sans 500, 14px
Labels       → Nunito Sans 600
```

---

## 5. Géométrie, ombres, mouvements

### Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius` | **`6px`** | Standard pour tous les éléments (cards, boutons, inputs, logo icon). |
| (sans token) | `50%` | Avatars, badges ronds |
| (sans token) | `999px` | Pills, multi-select chips |

### Ombres — thème clair

| Token | Valeur | Usage |
|-------|--------|-------|
| `--shadow-sm` | `0 1px 2px rgba(31, 35, 40, 0.04)` | Cards au repos |
| `--shadow-md` | `0 8px 22px rgba(31, 35, 40, 0.08)` | Bouton primary:hover, dropdowns |
| `--shadow-lg` | `0 20px 42px rgba(31, 35, 40, 0.12)` | Modals |

> **Principe pour le logo : pas d'ombre.** Le design system flat refuse les ombres décoratives — les ombres ne sont que pour exprimer la hiérarchie interactive (hover). Le logo doit rester strictement 2D.

### Easings / mouvements

| Token | Valeur | Caractère |
|-------|--------|-----------|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Reese-out expressif, signature Linear-style |
| `--ease-snap` | `cubic-bezier(0.25, 0.46, 0.4545, 0.9)` | Snappy |

> Pour le logo : le **mouvement n'est pas obligatoire**. Une éventuelle animation d'apparition devrait utiliser `var(--ease-out)` sur ~300ms.

---

## 6. Composition du logo actuel (référence — référence, pas canon)

### Logo typography alone (sidebar)

```html
<div class="logo-container">
  <div class="logo-icon">RD</div>
  <span>RDGESTION</span>
</div>
```

- Icône : carré 32×32 (desktop) / 44×44 (sur la page auth) avec `border-radius: 6px`
- Background : `var(--accent-color)` = `#047857`
- Lettres "RD" : `font-weight: 800`, color `#ffffff`, centrées horizontalement et verticalement
- Inset shadow : `inset 0 0 0 1px color-mix(in srgb, var(--accent-contrast) 14%, transparent)` — un liseré blanc 14% d'opacité pour un fini "edge" discret
- Texte "RDGESTION" : `Rubik 700, 18px, letter-spacing: 0` collé à droite de l'icône (gap 10px)

### Logo SVG (favicon / PWA icon)

`frontend/src/assets/icon.svg` :

```svg
<svg viewBox="0 0 512 512">
  <!-- Fond arrondi façon app icon -->
  <rect width="512" height="512" rx="112" fill="#09090b"/>

  <!-- Cadre interne plus clair (zoomick) -->
  <rect x="40" y="40" width="432" height="432" rx="88"
        fill="#18181b" stroke="#27272a" stroke-width="8"/>

  <!-- Lettre R + D stylisés : double-glyph monochrome -->
  <!-- R : blanc -->
  <path d="M144 342V160h84c44 0 74 25 74 64 0 25-13 45-35 56l48 62h-53l-42-55h-30v55h-46Zm46-92h35c19 0 31-10 31-26s-12-26-31-26h-35v52Z"
        fill="#f4f4f5"/>
  <!-- D : gris -->
  <path d="M323 342V160h69c57 0 96 36 96 91s-39 91-96 91h-69Zm46-40h21c31 0 51-20 51-51s-20-51-51-51h-21v102Z"
        fill="#a3a3a3"/>

  <!-- Soulignage : trait vert success -->
  <path d="M111 390h290" stroke="#0f766e" stroke-width="18" stroke-linecap="round"/>
</svg>
```

**Analyse critique de l'icône actuelle** :
- Utilise `#09090b` (proche du `--bg-primary` dark `#0c0c0d`) comme fond → **orientée dark mode par défaut**
- Le `#0f766e` du souligné est la couleur **success** (légèrement différente de l'accent `#047857`Until, adopter par cohérence l'accent `#047857` ou `#10b981` dark)
- Lettres "RD" mais **le R et le D se superposent par transparence** (un seul glyphe fusionné) — pas idéal pour un logo distinctif

---

## 7. Brief logo — ce qui doit être produit

### 🎯 Objectif

Créer un logo **potable et distinctif** pour RDGESTION, remplaçant le placeholder actuel, fidèle à la signature stylistique documentée ci-dessus.

### Contraintes de couleur

- **Couleur maîtresse** : `#047857` (vert émeraude, accent clair)
- **Couleurs admises en accompagnement** :
  - `#ffffff` (contraste sur accent)
  - `#0c0c0d` / `#09090b` (fond si app-icon)
  - Neutres du design system (`#1f2328`, `#334155`, `#5f6368`) pour le texte secondaire
- **Interdits** : rouge, jaune saturé, bleu, violet, dégradés arc-en-ciel, plus de 3 couleurs simultanées
- Le logo doit **rester lisible en monochrome** (noir sur blanc et blanc sur noir) pour les cas d'usage N&B (factures PDF, fax).

### Composition

- **Ratio** : carré `1:1` (logo principal / app-icon) + ratio large `~3:1` (banner, header)
- **Élément central** : les lettres **"RD"** doivent rester reconnaissables — c'est l'identité. Police `Rubik 800` ou tracé vectoriel qui conserve ce caractère extra-bold.
- **Style** : flat, sans dégradé, sans skeuomorphisme, sans ombre décorative. Liseré `1px` autorisé uniquement pour distinguer l'accent de son fond.
- **Forme du conteneur** : `border-radius: 6px` (cohérent avec `--radius`). Pour l'app-icon PWA (512×512), on peut monter à `rx="112"` comme l'icône actuelle, mais **le ratio doit rester identique**.
- **Harmonie** : le logo doit fonctionner avec un fond `#f7f7f5` (clair), un fond `#ffffff` (card), un fond `#0c0c0d` (dark), et le fond clair de la barre latérale.

### Variantes exigées

| Variante | Usage | Spec |
|----------|-------|------|
| **Logo principal complet** | Sidebar, header, page de login, marketing | Carré `RD` accent + texte "RDGESTION" à droite (Rubik 700) |
| **Logo mark seul** (juste l'icône) | Favicon, app-icon 192×192 / 512×512 (PNG),<br>pépin desktop | Carré `RD` accent + `border-radius: 6px` |
| **Logo horizontal compact** | Header mobile, header sticky | Icône + nom, ratio `~3:1` |
| **Logo monochrome noir** | Factures PDF, fax | Tout en `#1f2328` |
| **Logo monochrome blanc** | Hero sur dark, favicon adaptatif | Tout en `#ffffff` (le liseré accent devient uni) |
| **Logo mark — variante accent light** | Fond très chargé / state-disabled | Carré dans `rgba(4, 120, 87, 0.08)` + "RD" en `#047857` |

### Inspiration & direction créative suggérée

Pour éviter de tomber dans un simple carré centré, des axes créatifs pertinents pour le "RD" sans s'éloigner de la signature stylistique :

1. **Negative space** : le R et le D entrelacés en négatif dans le carré accent — évocation d'une "porte" (POS = ouverture, transaction), suggestion d'un flux (gestion).
2. **Lettres comme tableau de bord** : le R devient une grille 2×2 avec une cellule d'accent (clin d'œil au dashboard), le D reste conteneur。
3. **Magic marker** : les lettres "RD" tracées en une seule marque / one-stroke — signature main, NCReferenceinez Linear / Stripe qui valorisent la simplification maximale.
4. **Lettrage monospace synthétique** : une approche type "matrix" / "punch card" — clin d'œil à la notion de stock/POS (codes-barres, tickets).

**Toutes ces directions doivent rester flat, 2 couleurs max (accent + contrast), sans dessin figuratif. L'objectif n'est pas l'illustration, c'est l'identité.**

### Liseré & finition

- Si le logo a besoin d'un bord : `inset 1px color-mix(in srgb, var(--accent-contrast) 14%, transparent)` — liseré blanc 14% opacité (cohérent avec `.logo-icon` actuel).
- Pas de glow, pas de outer-shadow, pas de gradient sheen.

### Fournissables (deliverables)

- `logo-mark.svg` — iCloudMark seul, carré, vectoriel
- `logo-full.svg` — Mark + texte "RDGESTION" (variante horizontal)
- `logo-dark.svg` — Variante pour fond sombre (texte en `#f4f4f5`, mark en `#10b981`)
- `logo-mono-black.svg` — Monochrome `#1f2328`

- PNGulations rasterisées (pour PWA, favicons) :
  - `favicon-32.png` (32×32, transparent, mark seul)
  - `icon-192.png` (192×192, fond `#047857`, mark texte en blanc)
  - `icon-512.png` (512×512, idem)
  - `apple-touch-icon.png` (180×180, fond `#047857`, mark + "RDGESTION" ou mark seul)
  - `maskable-192.png` et `maskable-512.png` — voir spec Android maskable (padding-safe-zone de 10%)

- Optionnel si le designer propose : un favicon animé (SVG animé simple, ~300ms fade-in via `var(--ease-out)`).

### Accessibilité & test de lisibilité

- Le logo doit être reconnaissable même à **16×16 px** (favicon réel)
- Le tracé des lettres "RD" doit conserver une épaisseur minimum de **~12% de l'icône** (`32×32` → trait `>= 4px`)
- Contraste WCAG AA respecté contre les fonds `#f7f7f5`, `#ffffff`, `#0c0c0d`

---

## 8. Anti-patterns — ce qui ne ressemble pas à RDGESTION

Pour aider le designer à viser juste :

- ❌ Logo en 3D, extruded, avec ombrage directionnel
- ❌ Dégradé multi-couleurs (surtout arc-en-ciel)
- ❌ Emoji en logo (🛒 💰 📊 …)
- ❌ Icône de caddie / panier / étiquette de prix évidente — trop littérale, déjà-vu, et ne dénote pas le multi-tenant SaaS
- ❌ Typographie décorative (script, calligraphique, serif classique)
- ❌ Ombre portée decorative
- ❌ Stroke outlines colorés sur les bords des lettres
- ❌ Logo qui ne fonctionne que sur fond clair (ou que sur fond sombre)
- ❌ Avec plus de 3 couleurs
- ❌ Reproduction d'un autre logo (Stripe, Linear, Notion — ils inspirent l'ADN, pas le logo)

---

## 9. Récap express pour le designer

```
COULEUR MAÎTRESSE  : #047857 (vert émeraude)
POLICE             : Rubik (display), weight 800 pour le mark, 700 pour le texte
RAYON              : 6px
STYLE              : Flat, 2D, sans ombre décorative, sans dégradé
LETTERS            : "RD" — reconnaissance à 16×16 px obligatoire
NOM                : "RDGESTION" en Rubik 700 (sans interlignage décoratif)
INSPIRATION        : Linear / Stripe / Notion (sobre, monochrome-friendly, minimaliste)
À ÉVITER           : caddie, emoji, dégradés, dégradés arc-en-ciel, 3D, ombres décoratives
OBLIGATIONS        : fonctionner sur fond clair (#f7f7f5) et dark (#0c0c0d) + monochrome noir et blanc
```

---

## 10. Sources & liés

| Fichier | Rôle |
|---------|------|
| `frontend/src/css/style.css` | Source des couleurs, typo, ombres, radius — variables `:root` et `[data-theme="dark"]`. |
| `frontend/src/assets/icon.svg` | Icône SVG actuelle (placeholder à remplacer). |
| `frontend/index.html` | Page d'entrée (CSP, meta, PWA). |
| `frontend/manifest.json` | Favicons / app-icons déclarés pour la PWA. |
| `AGENTS.md` (racine repo) | Conventions générales du projet (notamment : ne pas modifier l'identité visuelle sauf demande explicite — ce qui est le cas ici). |
