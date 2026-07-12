import { FastifyRequest, FastifyReply } from 'fastify';
import { exportsService } from './exports.service';
import { query } from '../../config/database';

export const exportsController = {
  async exportProducts(request: FastifyRequest<any>, reply: FastifyReply) {
    try {
      const tenantId = request.currentUser!.tenantId;
      const query_ = request.query as { format: 'xlsx' | 'pdf' };
      const format = query_.format || 'xlsx';

      const buffer = await exportsService.exportProducts(tenantId, format);
      const filename = `products-${new Date().toISOString().split('T')[0]}.${format}`;
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      // Audit log
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address, user_agent)
         VALUES ($1, $2, 'EXPORT_PRODUCTS', 'PRODUCT', $3, $4)`,
        [tenantId, request.currentUser!.userId, request.ip, request.headers['user-agent'] || '']
      );

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
      const tenantId = request.currentUser!.tenantId;
      const query_ = request.query as { format: 'xlsx' | 'pdf'; from?: string; to?: string };
      const format = query_.format || 'xlsx';
      const from = query_.from;
      const to = query_.to;

      const buffer = await exportsService.exportSales(tenantId, format, from, to);
      const filename = `sales-${new Date().toISOString().split('T')[0]}.${format}`;
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      // Audit log
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address, user_agent)
         VALUES ($1, $2, 'EXPORT_SALES', 'SALE', $3, $4)`,
        [tenantId, request.currentUser!.userId, request.ip, request.headers['user-agent'] || '']
      );

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
      const tenantId = request.currentUser!.tenantId;
      const query_ = request.query as { format: 'xlsx' | 'pdf'; date?: string };
      const format = query_.format || 'pdf';
      const date = query_.date || new Date().toISOString().split('T')[0];

      const buffer = await exportsService.exportDailyReport(tenantId, format as 'xlsx' | 'pdf', date as string);
      const filename = `daily-report-${date}.${format}`;
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

      // Audit log
      await query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address, user_agent)
         VALUES ($1, $2, 'EXPORT_DAILY_REPORT', 'SALE', $3, $4)`,
        [tenantId, request.currentUser!.userId, request.ip, request.headers['user-agent'] || '']
      );

      reply
        .header('Content-Type', mimeType)
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(buffer);
    } catch (error) {
      throw error;
    }
  }
};