# 19 — Interface UI/UX — Design System Complet

## 19.1 Principes fondamentaux

1. **AUCUNE apparence "générée par IA"** : Le design doit être indiscernable d'une application conçue par un designer professionnel.
2. **Inspirations** : Stripe Dashboard, Linear, Notion, Vercel.
3. **Technologie** : HTML5 + CSS3 vanilla (variables CSS, Flexbox, Grid) + JavaScript ES Modules. **AUCUN Bootstrap, Tailwind ou framework CSS**.
4. **Responsive** : Mobile-first. Fonctionne parfaitement sur mobile (320px), tablette (768px) et desktop (1280px+).

## 19.2 Palette de couleurs

### Thème sombre (par défaut)
```css
:root[data-theme="dark"] {
  --bg-primary: #0A0A0F;
  --bg-secondary: #111118;
  --bg-card: #16161D;
  --bg-card-hover: #1C1C25;
  --bg-input: #1A1A23;
  --bg-modal-overlay: rgba(0, 0, 0, 0.7);

  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.1);
  --border-focus: #6366F1;

  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;
  --text-inverse: #0A0A0F;

  --accent-primary: #6366F1;       /* Indigo — couleur principale */
  --accent-primary-hover: #818CF8;
  --accent-primary-subtle: rgba(99, 102, 241, 0.1);

  --success: #22C55E;
  --success-subtle: rgba(34, 197, 94, 0.1);
  --warning: #F59E0B;
  --warning-subtle: rgba(245, 158, 11, 0.1);
  --danger: #EF4444;
  --danger-subtle: rgba(239, 68, 68, 0.1);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
}
```

### Thème clair
```css
:root[data-theme="light"] {
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F5F5F5;
  --bg-input: #F3F4F6;
  --bg-modal-overlay: rgba(0, 0, 0, 0.4);

  --border-subtle: rgba(0, 0, 0, 0.04);
  --border-default: rgba(0, 0, 0, 0.08);
  --border-focus: #6366F1;

  --text-primary: #111827;
  --text-secondary: #4B5563;
  --text-muted: #9CA3AF;

  /* Accent et états identiques au thème sombre */
}
```

### Changement de thème
- Un toggle (icône soleil/lune) dans le header permet de basculer instantanément entre les thèmes.
- La préférence est sauvegardée dans `localStorage` ET synchronisée avec la table `settings` en base.
- Au chargement de la page, le thème est appliqué **avant** le premier rendu pour éviter le flash blanc.

## 19.3 Typographie

```css
:root {
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 1.875rem; /* 30px */
  --font-size-4xl: 2.25rem;  /* 36px */
  
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;
}
```

Charger la police Inter depuis Google Fonts : `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`

## 19.4 Animations & Transitions

### Principes
- **Fluides mais discrètes** : les animations ne doivent jamais gêner ou ralentir l'utilisateur.
- **Durée** : entre 150ms et 300ms maximum.
- **Easing** : `cubic-bezier(0.4, 0, 0.2, 1)` pour les transitions standard.

### Animations globales
```css
/* Transition standard pour les éléments interactifs */
.interactive {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover sur les cartes */
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-focus);
}

/* Apparition d'un élément */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Skeleton loader */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 8px;
}
```

### Skeleton Loaders
Utilisés systématiquement pendant le chargement :
- Dashboard : cartes de statistiques en skeleton.
- Liste de produits : grille de cartes en skeleton.
- POS : grille de produits en skeleton.
- Graphiques : zone de graphique en skeleton.

### Micro-animations
- **Ajout au panier** : Le produit ajouté pulse brièvement (`scale(1.05)` puis retour).
- **Badge de notification** : Animation de rebond (`bounce`) quand une nouvelle notification arrive.
- **Toggle thème** : Rotation de l'icône (soleil ↔ lune) avec `rotate(180deg)`.
- **Validation de vente** : Coche verte animée avec un léger rebond.

## 19.5 Composants UI

### Boutons
```css
.btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 500;
  font-size: var(--font-size-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--accent-primary);
  color: white;
}
.btn-primary:hover {
  background: var(--accent-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.btn-ghost:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}
```

### Accessibilité
- Tous les éléments interactifs ont un `focus-visible` outline clairement visible.
- Navigation complète au clavier (Tab, Entrée, Échap).
- Labels ARIA sur tous les boutons d'icône.
- Contrastes texte/fond conformes WCAG AA minimum.
- Les animations respectent `prefers-reduced-motion`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
