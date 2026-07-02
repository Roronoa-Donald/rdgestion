import { env } from './env';

export const jwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  algorithm: 'HS256' as const,
};

// Structure du payload JWT (conforme à la spec 10_Authentification_Securite.md)
export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'SELLER';
  username: string;
  iat?: number;
  exp?: number;
}
