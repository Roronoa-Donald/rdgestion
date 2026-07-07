import { FastifyRequest, FastifyReply } from 'fastify';
import { stockService } from './stock.service';
import { StockMovementType } from '../../types/models';

export class StockController {
  async createStockMovement(request: FastifyRequest<{
    Params: { id: string };
    Body: { movement_type: StockMovementType; quantity: number; reason: string };
  }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const { movement_type, quantity, reason } = request.body;
    const productId = request.params.id;

    const movement = await stockService.createStockMovement(
      tenantId,
      productId,
      { movement_type, quantity, reason },
      userId,
      userIp,
      userAgent
    );

    return reply.status(201).send({ success: true, data: movement });
  }

  async listStockMovements(request: FastifyRequest<{
    Params: { id: string };
    Querystring: { page?: number; limit?: number; movement_type?: StockMovementType; from?: string; to?: string };
  }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const result = await stockService.listStockMovements(tenantId, request.params.id, request.query);
    return reply.send({ success: true, data: result });
  }
}

export const stockController = new StockController();
