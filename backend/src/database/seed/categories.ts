import { query } from '../../config/database';

/**
 * Catégories par défaut par secteur d'activité, conformément à 03_Cahier_des_charges.md §3.1.4
 */
export const CATEGORIES_BY_SECTOR: Record<string, string[]> = {
  'Alimentation générale': [
    'Boissons', 'Conserves', 'Épicerie', 'Produits laitiers', 'Produits frais', 'Surgelés'
  ],
  'Pharmacie / Parapharmacie': [
    'Analgésiques', 'Antibiotiques', 'Vitamines', 'Soins corporels', 'Premiers secours', 'Accessoires médicaux'
  ],
  'Quincaillerie / Bricolage': [
    'Outillage', 'Électricité', 'Plomberie', 'Peinture', 'Visserie', 'Matériaux'
  ],
  'Vêtements / Accessoires / Mode': [
    'Homme', 'Femme', 'Enfant', 'Chaussures', 'Accessoires'
  ],
  'Informatique / Téléphonie': [
    'Ordinateurs', 'Smartphones', 'Accessoires', 'Périphériques', 'Réseau', 'Composants'
  ],
  'Cosmétiques / Beauté': [
    'Parfums', 'Maquillage', 'Soins visage', 'Soins cheveux', 'Hygiène'
  ],
  'Restaurant / Snack / Buvette': [
    'Entrées', 'Plats', 'Desserts', 'Boissons Chaudes', 'Boissons Froides', 'Snacks'
  ],
  'Librairie / Papeterie': [
    'Livres', 'Cahiers', 'Stylos', 'Cartables', 'Dessin', 'Bureau'
  ],
  'Électroménager': [
    'Cuisine', 'Entretien', 'Beauté/Santé', 'Climatisation', 'Image/Son'
  ]
};

/**
 * Initialise les catégories par défaut pour un tenant spécifique en fonction de ses secteurs choisis.
 * La catégorie "Autres" est toujours ajoutée par défaut.
 * 
 * @param tenantId ID du tenant
 * @param sectors Liste des secteurs cochés (onboarding)
 */
export async function seedCategoriesForTenant(tenantId: string, sectors: string[]): Promise<void> {
  const categoriesToInsert = new Set<string>();
  
  // Toujours ajouter la catégorie par défaut "Autres"
  categoriesToInsert.add('Autres');

  // Ajouter les catégories spécifiques aux secteurs choisis
  for (const sector of sectors) {
    const list = CATEGORIES_BY_SECTOR[sector];
    if (list) {
      list.forEach(cat => categoriesToInsert.add(cat));
    }
  }

  // Insérer en base de données de façon sécurisée (avec ON CONFLICT DO NOTHING)
  let sortOrder = 0;
  for (const categoryName of categoriesToInsert) {
    const isDefault = true; // Catégorie système prédéfinie
    await query(
      `INSERT INTO categories (tenant_id, name, is_default, sort_order) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, name) DO NOTHING`,
      [tenantId, categoryName, isDefault, sortOrder++]
    );
  }
}
