import argon2 from 'argon2';

// Paramètres Argon2id recommandés par l'OWASP et spécifiés dans 10_Authentification_Securite.md
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 Mo
  timeCost: 3,       // 3 itérations
  parallelism: 4,    // 4 threads
  saltLength: 16,    // Sel de 16 octets
  hashLength: 32,    // Longueur de hash de 32 octets
};

/**
 * Hache un mot de passe en clair à l'aide d'Argon2id.
 * Le mot de passe en clair ne doit jamais être stocké ou loggé.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Vérifie si un mot de passe en clair correspond au hash Argon2id stocké.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error('Erreur lors de la vérification du mot de passe avec Argon2:', error);
    return false;
  }
}
