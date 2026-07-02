import { FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionsService, referralsService, adminService } from './admin.service';

// =========== Subscriptions ===========

export class SubscriptionsController {
  async getCurrent(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const sub = await subscriptionsService.getCurrentSubscription(tenantId);
    return reply.send({ success: true, data: sub });
  }

  async activatePro(request: FastifyRequest<{ Params: { tenantId: string }; Body: { billing_type: 'MONTHLY' | 'LIFETIME' } }>, reply: FastifyReply) {
    const activatedBy = request.currentUser!.userId;
    const { tenantId } = request.params;
    const { billing_type } = request.body;
    const sub = await subscriptionsService.activatePro(tenantId, billing_type, activatedBy, request.ip, request.headers['user-agent'] || '');
    return reply.status(201).send({ success: true, data: sub });
  }
}
export const subscriptionsController = new SubscriptionsController();

// =========== Referrals ===========

export class ReferralsController {
  async getInfo(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const info = await referralsService.getReferralInfo(tenantId);
    return reply.send({ success: true, data: info });
  }
}
export const referralsController = new ReferralsController();

// =========== Admin (SuperAdmin) ===========

export class AdminController {
  async listTenants(request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) {
    const result = await adminService.listTenants(request.query as any);
    return reply.send(result);
  }

  async toggleTenantStatus(request: FastifyRequest<{ Params: { id: string }; Body: { is_active: boolean } }>, reply: FastifyReply) {
    const adminId = request.currentUser!.userId;
    const result = await adminService.toggleTenantStatus(
      request.params.id,
      request.body.is_active,
      adminId,
      request.ip,
      request.headers['user-agent'] || ''
    );
    return reply.send({ success: true, data: result });
  }
}
export const adminController = new AdminController();
