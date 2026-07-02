# 20 — Progressive Web App (PWA) — Spécifications Complètes

## 20.1 Web App Manifest (`manifest.json`)

```json
{
  "name": "RDGESTION — Gestion de Stock & POS",
  "short_name": "RDGESTION",
  "description": "Application SaaS de gestion de stock et point de vente",
  "start_url": "/login.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0A0A0F",
  "theme_color": "#6366F1",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/assets/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## 20.2 Service Worker — Stratégie de cache

**Stratégie** : Cache-First pour les assets statiques, Network-First pour les données API.

```javascript
// Fichiers à pré-cacher lors de l'installation du Service Worker
const STATIC_CACHE = 'rdgestion-static-v1';
const PRECACHE_URLS = [
  '/', '/login.html', '/dashboard.html', '/pos.html', '/products.html', '/sales.html',
  '/css/variables.css', '/css/reset.css', '/css/base.css', '/css/components.css',
  '/css/layout.css', '/css/pos.css', '/css/dashboard.css', '/css/animations.css',
  '/css/themes.css', '/css/print.css',
  '/js/app.js', '/js/api.js', '/js/auth.js', '/js/pos.js', '/js/dashboard.js',
  '/js/theme.js', '/js/utils.js',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'
];
```

## 20.3 Comportement hors ligne

- Si la connexion réseau est perdue, l'interface reste accessible (pages servies depuis le cache).
- Un bandeau discret (non intrusif) apparaît en haut de la page : "Vous êtes hors ligne. Certaines fonctionnalités sont limitées."
- Les actions d'écriture (ventes, modifications) sont **bloquées** hors ligne avec un message explicatif.
- Les données affichées (liste de produits, etc.) peuvent être obsolètes et sont marquées comme telles.

## 20.4 Installation

- Un bouton "Installer l'application" apparaît dans le footer ou dans les paramètres.
- Sur mobile Chrome/Edge : le prompt d'installation natif apparaît automatiquement après 2 visites.
