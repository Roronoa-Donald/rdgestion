import { FastifyRequest, FastifyReply } from 'fastify';
import { exportsService } from './exports.service';

export const exportsController = {
  async exportProducts(request: FastifyRequest<any>, reply: FastifyReply) {
    try {
      const tenantId = (request as any).currentUser.tenant_id;
      const query = request.query as { format: 'xlsx' | 'pdf' };
      const format = query.format || 'xlsx';

      const buffer = await exportsService.exportProducts(tenantId, format);
      const filename = `products-${new Date().toISOString().split('T')[0]}.${format}`;
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(buffer);
    } catch (error) {
      throw error;
    }
  },

  async exportSales(request: FastifyRequest<any>, reply: FastifyReply) {
    try {
      const tenantId = (request as any).currentUser.tenant_id;
      const query = request.query as { format: 'xlsx' | 'pdf'; from?: string; to?: string };
      const format = query.format || 'xlsx';
      const from = query.from;
      const to = query.to;

      const buffer = await exportsService.exportSales(tenantId, format, from, to);
      const filename = `sales-${new Date().toISOString().split('T')[0]}.${format}`;
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(buffer);
    } catch (error) {
      throw error;
    }
  },

  async exportDailyReport(request: FastifyRequest<any>, reply: FastifyReply) {
    try {
      const tenantId = (request as any).currentUser.tenant_id;
      const query = request.query as { format: 'xlsx' | 'pdf'; date?: string };
      const format = query.format || 'pdf';
      const date = query.date || new Date().toISOString().split('T')[0];

      const buffer = await exportsService.exportDailyReport(tenantId, format as 'xlsx' | 'pdf', date as string);
      const filename = `daily-report-${date}.${format}`;
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(buffer);
    } catch (error) {
      throw error;
    }
  }
};