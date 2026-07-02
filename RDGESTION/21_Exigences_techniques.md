# 21 — Exigences Techniques & Qualité du Code

## 21.1 Architecture Fastify

- **Architecture modulaire** : Chaque module (auth, products, sales, etc.) est autonome avec son propre controller, service, schema et routes.
- **Plugins Fastify** :
  - `@fastify/helmet` : Headers de sécurité HTTP.
  - `@fastify/cors` : Configuration CORS.
  - `@fastify/rate-limit` : Limitation de débit.
  - `@fastify/multipart` : Upload de fichiers (photos produits).
  - `@fastify/swagger` + `@fastify/swagger-ui` : Documentation API OpenAPI.
  - `@fastify/static` : Servir les fichiers frontend en production.

## 21.2 Qualité de code

- **TypeScript strict** : `"strict": true` dans `tsconfig.json`. Aucune utilisation du type `any`.
- **Principes SOLID** :
  - **S** (Single Responsibility) : Un controller = gestion HTTP. Un service = logique métier.
  - **O** (Open/Closed) : Nouveaux modules ajoutables sans modifier le code existant.
  - **L** (Liskov Substitution) : Interfaces `PaymentService` permettant de remplacer ManualPayment par FedaPay.
  - **I** (Interface Segregation) : Interfaces ciblées, pas d'interfaces monolithiques.
  - **D** (Dependency Inversion) : Les services dépendent d'abstractions, pas d'implémentations concrètes.
- **DRY** : Pas de duplication de code. Utilitaires partagés dans `utils/`.
- **Commentaires** : Expliquent le "pourquoi", pas le "comment". Pas de commentaires inutiles.

## 21.3 Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: rdgestion_db
      POSTGRES_USER: rdgestion_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://rdgestion_user:${DB_PASSWORD}@postgres:5432/rdgestion_db
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres

volumes:
  pgdata:
```

## 21.4 Tests

- Tests unitaires pour les services métier (auth, products, sales).
- Tests d'intégration pour les routes API.
- Framework de test : Vitest ou Jest + Supertest.
- Couverture minimale visée : 80% sur les services.

## 21.5 Migrations de base de données

- Système de migrations séquentiel (fichiers numérotés : `001_create_tenants.sql`, `002_...`).
- Script `migrate.ts` qui exécute les migrations non encore appliquées.
- Table `migrations` en base qui enregistre les migrations déjà exécutées.
