import { FastifySchema } from 'fastify';

/**
 * Schéma de validation pour l'inscription d'une boutique (tenant)
 */
export const registerSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['shop_name', 'owner_name', 'phone', 'password', 'password_confirm'],
    properties: {
      shop_name: { 
        type: 'string', 
        minLength: 2, 
        maxLength: 100,
        pattern: '^[a-zA-Z0-9\\s\\-\'éèàùçâêîôûëïüÄÖÜßáíóúñÑíóúáéíóúÁÉÍÓÚ]+$' // Alphanumérique, espaces, tirets, accents
      },
      owner_name: { 
        type: 'string', 
        minLength: 2, 
        maxLength: 80 
      },
      phone: { 
        type: 'string', 
        minLength: 4, 
        maxLength: 20 
      },
      password: { 
        type: 'string', 
        minLength: 8,
        pattern: '^(?=.*[A-Z])(?=.*\\d).+$' // Au moins 1 majuscule, 1 chiffre
      },
      password_confirm: { 
        type: 'string' 
      },
      referral_code: { 
        type: 'string',
        pattern: '^RD-[A-Z0-9]+-[0-9]{3}$' // Ex: RD-PHARMA-482
      }
    },
    additionalProperties: false
  }
};

/**
 * Schéma de validation pour la connexion (gérant, vendeur, superadmin)
 */
export const loginSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['identifier', 'password'],
    properties: {
      identifier: { 
        type: 'string',
        minLength: 1
      },
      password: { 
        type: 'string',
        minLength: 1
      }
    },
    additionalProperties: false
  }
};

/**
 * Schéma de validation pour la création d'un vendeur par l'admin
 */
export const createVendorSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['password', 'password_confirm'],
    properties: {
      password: {
        type: 'string',
        minLength: 8,
        pattern: '^(?=.*[A-Z])(?=.*\\d).+$'
      },
      password_confirm: {
        type: 'string'
      }
    },
    additionalProperties: false
  }
};
