import { query } from '../../config/database';
import { AuditLog } from '../../types/models';

export interface LogsQueryFilters {
  page?: number;
  limit?: number;
  action?: string;
  entity_type?: string;
  user_id?: string;
  from?: string;
  to?: string;
}

export class LogsService {
  async getLogs(tenantId: string, filters: LogsQueryFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const params: any[] = [tenantId, limit, offset];
    let queryText = `
      SELECT * FROM audit_logs
      WHERE tenant_id = $1
    `;

    let paramIndex = 4;

    if (filters.action) {
      queryText += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters.entity_type) {
      queryText += ` AND entity_type = $${paramIndex++}`;
      params.push(filters.entity_type);
    }

    if (filters.user_id) {
      queryText += ` AND user_id = $${paramIndex++}`;
      params.push(filters.user_id);
    }

    if (filters.from) {
      queryText += ` AND created_at >= $${paramIndex++}`;
      params.push(`${filters.from} 00:00:00+00`);
    }

    if (filters.to) {
      queryText += ` AND created_at <= $${paramIndex++}`;
      params.push(`${filters.to} 23:59:59+00`);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;

    const res = await query<AuditLog>(queryText, params);

    const countParams: any[] = [tenantId];
    let countText = 'SELECT COUNT(id) FROM audit_logs WHERE tenant_id = $1';
    let ci = 2;

    if (filters.action) { countText += ` AND action = $${ci++}`; countParams.push(filters.action); }
    if (filters.entity_type) { countText += ` AND entity_type = $${ci++}`; countParams.push(filters.entity_type); }
    if (filters.user_id) { countText += ` AND user_id = $${ci++}`; countParams.push(filters.user_id); }
    if (filters.from) { countText += ` AND created_at >= $${ci++}`; countParams.push(`${filters.from} 00:00:00+00`); }
    if (filters.to) { countText += ` AND created_at <= $${ci++}`; countParams.push(`${filters.to} 23:59:59+00`); }

    const countRes = await query<{ count: string }>(countText, countParams);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    return {
      logs: res.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }
}

export const logsService = new LogsService();
