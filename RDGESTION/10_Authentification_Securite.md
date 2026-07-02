# 10 — Authentification & Sécurité

## 10.1 Hachage des mots de passe — Argon2id

| Paramètre | Valeur |
|:-----------|:-------|
| Algorithme | Argon2id (résistant aux attaques GPU et side-channel) |
| Mémoire | 65 536 Ko (64 Mo) |
| Itérations | 3 |
| Parallélisme | 4 |
| Longueur du hash | 32 octets |
| Longueur du sel | 16 octets (généré aléatoirement) |

**Règle absolue** : Le mot de passe en clair ne doit **JAMAIS** être stocké, loggé, renvoyé dans une réponse API, ou visible dans les logs du serveur.

## 10.2 JWT (JSON Web Token)

| Paramètre | Valeur |
|:-----------|:-------|
| Algorithme de signature | HS256 |
| Durée de validité | 24 heures |
| Secret | Variable d'environnement `JWT_SECRET` (min 256 bits) |

**Payload** :
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "role": "ADMIN",
  "username": "+22890123456",
  "iat": 1719878400,
  "exp": 1719964800
}
```

**Règles** :
- Le token est envoyé dans le header `Authorization: Bearer <token>`.
- Le token est stocké dans `localStorage` côté client.
- À chaque requête protégée, le middleware `auth.ts` vérifie la validité et l'expiration du token.
- Si le token est invalide ou expiré → `401 Unauthorized`.

## 10.3 Protection CSRF
- L'API est stateless (JWT), donc les attaques CSRF classiques (basées sur les cookies de session) ne s'appliquent pas directement.
- Le header `Origin` est vérifié par le middleware CORS pour n'accepter que les origines autorisées.

## 10.4 Protection XSS
- Toutes les entrées utilisateur sont **échappées** avant insertion dans le DOM côté frontend.
- Le backend utilise `@fastify/helmet` qui définit automatiquement les headers de sécurité :
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`

## 10.5 Protection SQL Injection
- Toutes les requêtes SQL utilisent des **requêtes paramétrées** (parameterized queries / prepared statements).
- **AUCUNE** concaténation de chaînes dans les requêtes SQL.
- Exemple correct : `SELECT * FROM products WHERE tenant_id = $1 AND id = $2`
- Exemple INTERDIT : `SELECT * FROM products WHERE id = '${id}'`

## 10.6 Rate Limiting
- API globale : **100 requêtes par minute par IP**.
- Routes d'authentification (`/api/auth/login`, `/api/auth/register`) : **10 requêtes par minute par IP**.
- En cas de dépassement : `429 Too Many Requests`.

## 10.7 CORS
- Origines autorisées définies dans la variable d'environnement `CORS_ORIGIN`.
- En développement : `http://localhost:8080`.
- En production : `https://rdgestion.com` (ou le domaine de production).

## 10.8 Validation des entrées (Ajv)
- Chaque route Fastify définit un schéma JSON pour le body, les query params et les params d'URL.
- Fastify utilise Ajv pour valider automatiquement les entrées avant d'exécuter le handler.
- En cas de validation échouée : `400 Bad Request` avec les détails des erreurs.

## 10.9 Isolation Multi-tenant
- **Le `tenant_id` est TOUJOURS extrait du JWT côté serveur**, jamais du body ou des query params.
- Chaque requête SQL vers les tables métier DOIT inclure `WHERE tenant_id = $tenantId`.
- Si un utilisateur tente d'accéder à une ressource d'un autre tenant → `404 Not Found` (pas 403, pour ne pas révéler l'existence de la ressource).
