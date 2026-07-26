import { FastifySchema } from 'fastify';

// Regex : au moins 1 majuscule, 1 chiffre, 8 caractères minimum
const passwordRegex = '^(?=.*[A-Z])(?=.*\\d).{8,}$';

/**
 * Schéma de validation pour le changement de mot de passe par l'utilisateur lui-même.
 * PUT /api/settings/password
 */
export const passwordChangeSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['old_password', 'new_password', 'new_password_confirm'],
    properties: {
      old_password: { type: 'string', minLength: 1 },
      new_password: {
        type: 'string',
        pattern: passwordRegex
      },
      new_password_confirm: { type: 'string' }
    },
    additionalProperties: false
  }
};

/**
 * Schéma de validation pour la réinitialisation du mot de passe d'un vendeur par un ADMIN.
 * POST /api/settings/vendors/:id/reset-password
 */
export const vendorResetPasswordSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    },
    additionalProperties: false
  },
  body: {
    type: 'object',
    required: ['new_password', 'new_password_confirm'],
    properties: {
      new_password: {
        type: 'string',
        pattern: passwordRegex
      },
      new_password_confirm: { type: 'string' }
    },
    additionalProperties: false
  }
};

/**
 * Schéma de validation pour la modification du display_name d'un vendeur.
 * PUT /api/settings/vendors/:id
 */
export const vendorUpdateSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    },
    additionalProperties: false
  },
  body: {
    type: 'object',
    required: ['display_name'],
    properties: {
      display_name: { type: 'string', minLength: 2, maxLength: 80 }
    },
    additionalProperties: false
  }
};

/**
 * Schéma de validation pour la mise à jour du profil de la boutique (tenant).
 * PUT /api/settings/profile
 */
export const updateProfileSchema: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      owner_name: { type: 'string', maxLength: 255 },
      email: { type: 'string', format: 'email' },
      address: { type: 'string', maxLength: 500 },
      city: { type: 'string', maxLength: 255 },
      country: { type: 'string', maxLength: 100 },
      currency: { type: 'string', maxLength: 10 },
      slogan: { type: 'string', maxLength: 255 },
      tax_number: { type: 'string', maxLength: 100 }
    }
  }
};
