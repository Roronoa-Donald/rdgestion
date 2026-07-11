# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend
- **Development**: `npm run dev` (from root) or `npm run dev` (inside `backend/`) — Starts the server with `tsx watch`.
- **Build**: `npm run build:backend` (from root) or `npm run build` (inside `backend/`) — Compiles TypeScript to JavaScript.
- **Start**: `npm run start` (from root or `backend/`) — Runs the compiled server.
- **Tests**: `npm run test:backend` (from root) or `npm run test` (inside `backend/`) — Runs tests using Vitest.
- **Test (Watch)**: `npm run test:watch` (inside `backend/`).
- **Database Migrations**: `npm run migrate` (inside `backend/`) — Executes SQL migrations.
- **Database Seeding**: `npm run seed` (inside `backend/`) — Seeds initial categories.

### Frontend
- The frontend consists of vanilla HTML/CSS/JS and does not have a build process. It is served as static files.

## Architecture Overview

### Project Structure
The project is a monorepo consisting of:
- `backend/`: A Node.js/TypeScript API using the Fastify framework.
- `frontend/`: A vanilla JavaScript PWA (Progressive Web App) with HTML, CSS, and client-side JS.
- `RDGESTION/`: Extensive project documentation and specifications.
- `api/`: API definitions/types.

### Backend Architecture (SOLID)
The backend follows a strict separation of concerns:
- **Routes**: Defines endpoints and attaches authentication/RBAC middlewares.
- **Controllers**: Handles HTTP requests, validates input via Ajv schemas, and calls services.
- **Services**: Contains all business logic and interacts with the PostgreSQL database.
- **Schemas**: Ajv validation schemas for request and response payloads.
- **Database**: PostgreSQL using `pg-pool`. Multi-tenancy is implemented via a `tenant_id` injected into the request context from the JWT.

### Frontend Architecture
- **Vanilla JS**: Client-side routing is handled in `frontend/js/app.js`.
- **PWA**: Includes a `manifest.json` and `sw.js` for offline capabilities.
- **Styles**: Modular CSS files (e.g., `components.css`, `layout.css`, `pos.css`).

## Naming Conventions
- **Files**: `kebab-case` (e.g., `auth.controller.ts`)
- **Variables/Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Database Tables/Columns**: `snake_case`
