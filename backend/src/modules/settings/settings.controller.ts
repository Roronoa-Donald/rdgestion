import { FastifyRequest, FastifyReply } from 'fastify';
import { settingsService } from './settings.service';

export class SettingsController {
  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const settings = await settingsService.getSettings(tenantId);
    return reply.send({ success: true, data: settings });
  }

  async updateSettings(request: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const updated = await settingsService.updateSettings(tenantId, request.body as any, userId, request.ip, request.headers['user-agent'] || '');
    return reply.send({ success: true, data: updated });
  }

  async getTenantProfile(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const profile = await settingsService.getTenantProfile(tenantId);
    return reply.send({ success: true, data: profile });
  }

  async updateTenantProfile(request: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const updated = await settingsService.updateTenantProfile(tenantId, request.body, userId, request.ip, request.headers['user-agent'] || '');
    return reply.send({ success: true, data: updated });
  }

  async listVendors(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const vendors = await settingsService.listVendors(tenantId);
    return reply.send({ success: true, data: vendors });
  }

  async toggleVendorStatus(request: FastifyRequest<{ Params: { id: string }; Body: { is_active: boolean } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const { id } = request.params;
    const { is_active } = request.body;
    const vendor = await settingsService.toggleVendorStatus(tenantId, id, is_active, userId, request.ip, request.headers['user-agent'] || '');
    return reply.send({ success: true, data: vendor, message: `Vendeur ${is_active ? 'activé' : 'désactivé'}.` });
  }

  async changePassword(request: FastifyRequest<{ Body: { old_password: string; new_password: string; new_password_confirm: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const { old_password, new_password, new_password_confirm } = request.body;

    if (new_password !== new_password_confirm) {
      const err = new Error('Les mots de passe ne correspondent pas.');
      (err as any).statusCode = 400;
      (err as any).code = 'PASSWORD_MISMATCH';
      throw err;
    }

    await settingsService.changePassword(tenantId, userId, old_password, new_password, request.ip, request.headers['user-agent'] || 'Unknown');
    return reply.send({ success: true, message: 'Mot de passe modifié avec succès.' });
  }

  async resetVendorPassword(request: FastifyRequest<{ Params: { id: string }; Body: { new_password: string; new_password_confirm: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const adminUserId = request.currentUser!.userId;
    const { id } = request.params;
    const { new_password, new_password_confirm } = request.body;

    if (new_password !== new_password_confirm) {
      const err = new Error('Les mots de passe ne correspondent pas.');
      (err as any).statusCode = 400;
      (err as any).code = 'PASSWORD_MISMATCH';
      throw err;
    }

    await settingsService.resetVendorPassword(tenantId, id, new_password, adminUserId, request.ip, request.headers['user-agent'] || 'Unknown');
    return reply.send({ success: true, message: 'Mot de passe du vendeur réinitialisé avec succès.' });
  }

  async updateVendor(request: FastifyRequest<{ Params: { id: string }; Body: { display_name: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const adminUserId = request.currentUser!.userId;
    const { id } = request.params;
    const { display_name } = request.body;
    const vendor = await settingsService.updateVendor(tenantId, id, display_name, adminUserId, request.ip, request.headers['user-agent'] || 'Unknown');
    return reply.send({ success: true, data: vendor });
  }
}

export const settingsController = new SettingsController();
