import jwt from 'jsonwebtoken';
import { jwtConfig, JwtPayload } from '../config/jwt';

/**
 * Signe un token JWT à partir d'un payload utilisateur.
 */
export function signToken(payload: JwtPayload): string {
  // On retire les champs iat et exp éventuellement présents pour éviter les conflits
  const { iat, exp, ...cleanPayload } = payload;
  return jwt.sign(cleanPayload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn as string | number,
    algorithm: jwtConfig.algorithm,
  } as jwt.SignOptions);
}

/**
 * Vérifie et décode un token JWT.
 * Retourne le payload décodé si valide, ou lève une erreur.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, jwtConfig.secret, {
    algorithms: [jwtConfig.algorithm],
  }) as JwtPayload;
}
