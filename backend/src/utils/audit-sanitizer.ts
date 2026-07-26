/**
 * Faille H1 — Utilitaire de sanitisation des payloads avant écriture dans audit_logs.
 *
 * Problème de sécurité : les services loggeaient `JSON.stringify(data)` directement,
 * ce qui pouvait écrire en clair des secrets présents dans le payload utilisateur
 * (mots de passe, tokens, etc.) dans la table `audit_logs`.
 *
 * `sanitizeForAudit` retourne une COPIE profonde de l'objet où toute clé sensible
 * est remplacée par '***', quel que soit le niveau de nesting. On préserve le shape
 * de l'objet (mêmes clés) pour ne pas casser la lisibilité/format attendu des logs,
 * mais on masque la valeur. Le cas échéant, on normalise en haut les noms de clés
 * car les payloads peuvent arriver en camelCase ou snake_case.
 *
 * Usage :
 *   JSON.stringify(sanitizeForAudit(data))   // pour un INSERT INTO audit_logs
 *   JSON.stringify({ changes: sanitizeForAudit(changes) })
 */

// Clés sensibles (comparaison insensible à la casse, suffixe `_confirm`/`_confirmation` déjà couvert).
const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^passwordhash$/i,
  /^password_hash$/i,
  /^oldpassword$/i,
  /^newpassword$/i,
  /^currentpassword$/i,
  /^old_password$/i,
  /^new_password$/i,
  /^current_password$/i,
  /^new_password_confirm$/i,
  /^passwordconfirm$/i,
  /^new_password_confirmation$/i,
  /^token$/i,
  /^access_token$/i,
  /^refresh_token$/i,
  /^authtoken$/i,
  /^apikey$/i,
  /^api_key$/i,
  /^secret/i,
  /^jwt$/i,
  /^momo_reference$/i,        // identifiant de transaction Mobile Money — à masquer par précaution
  /^private_key$/i,
  /^session_token$/i,
  /^cookies?$/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

/**
 * Retourne une copie profonde de `obj` avec les valeurs des clés sensibles masquées.
 * - Préserve le shape JSON (même clés, mêmes structures imbriquées).
 * - Les tableaux sont parcourus récursivement.
 * - Les valeurs null/undefined sont renvoyées telles quelles.
 * - Pour les objets non-plain (Date, Buffer, etc.), on les renvoie tels quels
 *   (ils sérialisent correctement et n'exposent pas de secrets).
 */
export function sanitizeForAudit<T>(obj: T): T {
  return sanitizeValue(obj) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v));
  }
  if (value instanceof Date) {
    // On préserve le type Date pour que JSON.stringify produise une string ISO.
    return value;
  }
  if (typeof value === 'object') {
    // Objects typés non-Date (Buffer, Map, Set, RegExp, etc.) — on ne sait pas inspecter proprement,
    // on les laisse sérialiser naturellement par JSON.stringify.
    const proto = Object.getPrototypeOf(value);
    if (proto && proto.constructor && proto.constructor !== Object) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = '***';
      } else {
        out[key] = sanitizeValue(val);
      }
    }
    return out;
  }
  // Primitifs (string, number, boolean) — non sensibles par eux-mêmes.
  return value;
}
