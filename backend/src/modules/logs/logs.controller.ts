import { FastifyRequest, FastifyReply } from 'fastify';
import { logsService, LogsQueryFilters } from './logs.service';

export class LogsController {
  async list(request: FastifyRequest<{ Querystring: LogsQueryFilters }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const result = await logsService.getLogs(tenantId, request.query);
    return reply.send(result);
  }
}

export const logsController = new LogsController();
