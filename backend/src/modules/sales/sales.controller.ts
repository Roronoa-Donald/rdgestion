import { FastifyRequest, FastifyReply } from 'fastify';
import { salesService, CreateSaleInput, SalesQueryFilters } from './sales.service';
import { query } from '../../config/database';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class SalesController {
  /**
   * Enregistre une vente (POST /api/sales)
   */
  async create(request: FastifyRequest<{ Body: CreateSaleInput }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const sellerId = request.currentUser!.userId;
    const sellerRole = request.currentUser!.role;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const sale = await salesService.createSale(
      tenantId,
      sellerId,
      sellerRole,
      request.body,
      userIp,
      userAgent
    );

    return reply.status(201).send({
      success: true,
      data: { sale }
    });
  }

  /**
   * Annule une vente (POST /api/sales/:id/cancel)
   */
  async cancel(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const userId = request.currentUser!.userId;
    const userIp = request.ip;
    const userAgent = request.headers['user-agent'] || 'Unknown';
    const id = request.params.id;

    await salesService.cancelSale(tenantId, id, userId, userIp, userAgent);

    return reply.send({
      success: true,
      message: 'Vente annulée avec succès. Le stock de produits a été ré-crédité.'
    });
  }

  /**
   * Récupère les détails d'une vente (GET /api/sales/:id)
   */
  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const sale = await salesService.getSaleById(tenantId, request.params.id);
    return reply.send({ success: true, data: sale });
  }

  /**
   * Liste l'historique des ventes (GET /api/sales)
   */
  async list(request: FastifyRequest<{ Querystring: SalesQueryFilters }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const result = await salesService.listSales(tenantId, request.query);
    return reply.send({
      success: true,
      data: {
        sales: result.sales,
        pagination: result.pagination
      }
    });
  }

  /**
   * Génère le ticket de caisse au format HTML pour impression (GET /api/sales/:id/ticket)
   */
  async getTicketHtml(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const tenantId = request.currentUser!.tenantId;
    const id = request.params.id;

    // Récupérer les détails de la vente
    const sale = await salesService.getSaleById(tenantId, id);

    // Récupérer les informations de la boutique (tenant)
    const tenantRes = await query<{
      name: string;
      owner_name: string;
      phone: string;
      address: string | null;
      city: string | null;
      country: string | null;
      currency: string;
      logo_url: string | null;
      slogan: string | null;
    }>(
      `SELECT name, owner_name, phone, address, city, country, currency, logo_url, slogan 
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    const tenant = tenantRes.rows[0]!;

    // Récupérer les configurations d'impression ticket
    const settingsRes = await query<{
      ticket_show_logo: boolean;
      ticket_show_slogan: boolean;
      ticket_footer_message: string;
      ticket_width: string;
      ticket_show_qr: boolean;
    }>(
      `SELECT ticket_show_logo, ticket_show_slogan, ticket_footer_message, ticket_width, ticket_show_qr 
       FROM settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const settings = settingsRes.rows[0] || {
      ticket_show_logo: false,
      ticket_show_slogan: false,
      ticket_footer_message: 'Merci pour votre achat !',
      ticket_width: '80mm',
      ticket_show_qr: false
    };

    // Formater la date
    const dateFormatted = new Date(sale.created_at).toLocaleString('fr-FR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Générer le code HTML du ticket de caisse
    const currency = escapeHtml(tenant.currency);
    let itemsRows = '';
    for (const item of sale.items) {
      itemsRows += `
        <tr>
          <td>${escapeHtml(item.product_name)}<br><small>${item.quantity} x ${Number(item.unit_sell_price).toLocaleString()} ${currency}</small></td>
          <td style="text-align: right; vertical-align: bottom;">${Number(item.total_price).toLocaleString()} ${currency}</td>
        </tr>
      `;
    }

    const discountRow = Number(sale.discount_amount) > 0
      ? `<tr>
          <td style="font-weight: bold;">Remise :</td>
          <td style="text-align: right; font-weight: bold;">-${Number(sale.discount_amount).toLocaleString()} ${currency}</td>
         </tr>`
      : '';

    const momoRow = sale.payment_method === 'MOBILE_MONEY'
      ? `<div class="payment-details">
          <strong>Mode :</strong> Mobile Money<br>
          <strong>Réf :</strong> ${escapeHtml(sale.momo_reference || '')}
         </div>`
      : `<div class="payment-details">
          <strong>Mode :</strong> Espèces<br>
          ${sale.amount_received ? `<strong>Reçu :</strong> ${Number(sale.amount_received).toLocaleString()} ${currency}<br>` : ''}
          ${sale.change_given ? `<strong>Rendu :</strong> ${Number(sale.change_given).toLocaleString()} ${currency}` : ''}
         </div>`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket ${sale.transaction_number}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            @page { margin: 0; }
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            width: ${settings.ticket_width};
            margin: 0 auto;
            padding: 10px;
            box-sizing: border-box;
            background: #fff;
          }
          .text-center { text-align: center; }
          .header { margin-bottom: 15px; }
          .logo { max-width: 80px; max-height: 80px; margin-bottom: 5px; }
          .shop-name { font-size: 16px; font-weight: bold; margin: 2px 0; }
          .shop-slogan { font-style: italic; margin-bottom: 5px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 3px 0; }
          .totals { font-size: 14px; font-weight: bold; }
          .payment-details { margin-top: 10px; font-size: 11px; }
          .footer { margin-top: 20px; font-size: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header text-center">
          ${settings.ticket_show_logo && tenant.logo_url ? `<img class="logo" src="${escapeHtml(tenant.logo_url)}" alt="logo">` : ''}
          <div class="shop-name">${escapeHtml(tenant.name)}</div>
          ${settings.ticket_show_slogan && tenant.slogan ? `<div class="shop-slogan">${escapeHtml(tenant.slogan)}</div>` : ''}
          <div>${escapeHtml(tenant.address || '')} ${escapeHtml(tenant.city || '')}</div>
          <div>Tél : ${escapeHtml(tenant.phone)}</div>
        </div>

        <div class="divider"></div>

        <div>
          <strong>N° :</strong> ${escapeHtml(sale.transaction_number)}<br>
          <strong>Date :</strong> ${dateFormatted}<br>
          <strong>Vendeur :</strong> ${escapeHtml(sale.seller_name || '')}
        </div>

        <div class="divider"></div>

        <table>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="divider"></div>

        <table>
          <tbody>
            <tr>
              <td>Sous-total :</td>
              <td style="text-align: right;">${Number(sale.subtotal).toLocaleString()} ${currency}</td>
            </tr>
            ${discountRow}
            <tr class="totals">
              <td>TOTAL :</td>
              <td style="text-align: right;">${Number(sale.total_amount).toLocaleString()} ${currency}</td>
            </tr>
          </tbody>
        </table>

        <div class="divider"></div>

        ${momoRow}

        <div class="divider"></div>

        <div class="footer">
          ${escapeHtml(settings.ticket_footer_message)}<br>
          <br>
          RDGESTION — Merci de votre fidélité
        </div>

        <script>
          // Lancer l'impression automatique du navigateur
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    return reply.type('text/html').send(html);
  }
}

export const salesController = new SalesController();
