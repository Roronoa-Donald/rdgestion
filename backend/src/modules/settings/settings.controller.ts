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
}

export const settingsController = new SettingsController();
