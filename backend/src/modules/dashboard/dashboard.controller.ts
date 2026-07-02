import { FastifyRequest, FastifyReply } from 'fastify';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const stats = await dashboardService.getStats(tenantId);
    return reply.send({ success: true, data: stats });
  }
}

export const dashboardController = new DashboardController();
