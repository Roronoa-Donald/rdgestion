import { FastifyRequest, FastifyReply } from 'fastify';
import { categoriesService } from './categories.service';
import { seedCategoriesForTenant } from '../../database/seed/categories';

export class CategoriesController {
  /**
   * Liste les catégories du tenant.
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const list = await categoriesService.listCategories(tenantId);
    return reply.send(list);
  }

  /**
   * Crée une catégorie personnalisée.
   */
  async create(request: FastifyRequest<{ Body: { name: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const { name } = request.body;

    if (!name) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Le champ "name" est obligatoire.'
      });
    }

    const category = await categoriesService.createCategory(tenantId, name, userId, userIp, userAgent);
    return reply.status(201).send({ success: true, data: category });
  }

  /**
   * Supprime une catégorie personnalisée.
   */
  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const id = request.params.id;

    await categoriesService.deleteCategory(tenantId, id, userId, userIp, userAgent);
    return reply.send({
      success: true,
      message: 'Catégorie supprimée avec succès. Ses produits associés ont été déplacés dans la catégorie "Autres".'
    });
  }

  async seed(request: FastifyRequest<{ Body: { sectors: string[] } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const { sectors } = request.body;
    await seedCategoriesForTenant(tenantId, sectors || []);
    return reply.status(201).send({ success: true, message: 'Catégories de départ générées avec succès.' });
  }
}

export const categoriesController = new CategoriesController();
