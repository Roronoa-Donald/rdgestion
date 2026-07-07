import { query } from '../../config/database';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

export const exportsService = {
  async exportProducts(tenantId: string, format: 'xlsx' | 'pdf') {
    const productsRes = await query(
      `SELECT p.id, p.name, p.sku, c.name AS category, p.purchase_price, p.sell_price, 
              p.stock_quantity, p.stock_threshold, p.expiry_date, p.is_deleted
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = $1
       ORDER BY p.name`,
      [tenantId]
    );

    if (format === 'xlsx') {
      return this.generateProductsXLSX(productsRes.rows);
    } else {
      return this.generateProductsPDF(productsRes.rows);
    }
  },

  async exportSales(tenantId: string, format: 'xlsx' | 'pdf', from?: string, to?: string) {
    const params: any[] = [tenantId];
    let dateFilter = '';
    let paramIdx = 1;

    if (from) {
      dateFilter += ` AND s.created_at >= $${paramIdx++}`;
      params.push(from);
    }
    if (to) {
      dateFilter += ` AND s.created_at <= $${paramIdx++}`;
      params.push(to);
    }

    const salesRes = await query(
      `SELECT s.id, s.transaction_number, s.created_at, s.total_amount, s.payment_method, s.is_cancelled,
              u.username AS seller_name
       FROM sales s
       LEFT JOIN users u ON s.seller_id = u.id
       WHERE s.tenant_id = $1${dateFilter}
       ORDER BY s.created_at DESC`,
      params
    );

    if (format === 'xlsx') {
      return this.generateSalesXLSX(salesRes.rows, tenantId);
    } else {
      return this.generateSalesPDF(salesRes.rows, tenantId);
    }
  },

  async exportDailyReport(tenantId: string, format: 'xlsx' | 'pdf', date: string) {
    const statsRes = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE NOT is_cancelled) AS sales_count,
         COALESCE(SUM(total_amount) FILTER (WHERE NOT is_cancelled), 0) AS revenue,
         COALESCE(SUM(profit_estimate) FILTER (WHERE NOT is_cancelled), 0) AS profit,
         COUNT(*) FILTER (WHERE is_cancelled) AS cancelled_count,
         COUNT(*) FILTER (WHERE payment_method = 'CASH' AND NOT is_cancelled) AS cash_count,
         COUNT(*) FILTER (WHERE payment_method = 'MOBILE_MONEY' AND NOT is_cancelled) AS momo_count
       FROM sales
       WHERE tenant_id = $1 AND DATE(created_at) = $2`,
      [tenantId, date]
    );

    const topProductsRes = await query(
      `SELECT p.name, SUM(si.quantity) AS qty_sold, SUM(si.total_price) AS revenue
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       JOIN sales s ON si.sale_id = s.id
       WHERE s.tenant_id = $1 AND DATE(s.created_at) = $2 AND NOT s.is_cancelled
       GROUP BY p.name
       ORDER BY qty_sold DESC
       LIMIT 5`,
      [tenantId, date]
    );

    const stats = statsRes.rows[0];

    if (format === 'xlsx') {
      return this.generateDailyReportXLSX(stats, topProductsRes.rows, date);
    } else {
      return this.generateDailyReportPDF(stats, topProductsRes.rows, date);
    }
  },

  async generateProductsXLSX(rows: any[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Produits');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Nom', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Catégorie', key: 'category', width: 20 },
      { header: 'Prix achat', key: 'purchase_price', width: 12 },
      { header: 'Prix vente', key: 'sell_price', width: 12 },
      { header: 'Stock', key: 'stock_quantity', width: 10 },
      { header: 'Seuil', key: 'stock_threshold', width: 10 },
      { header: 'Péremption', key: 'expiry_date', width: 15 },
      { header: 'Supprimé', key: 'is_deleted', width: 10 }
    ];

    worksheet.addRows(rows);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  },

  async generateProductsPDF(rows: any[]) {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', chunk => chunks.push(chunk));
    doc.pipe(stream);

    doc.fontSize(18).text('Catalogue Produits', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10).text(
      `Exporté le ${new Date().toLocaleDateString('fr-FR')}`,
      { align: 'right' }
    );
    doc.moveDown();

    const tableTop = doc.y;
    doc.fontSize(9);
    
    const headers = ['Nom', 'SKU', 'Catégorie', 'Stock', 'P. Vente'];
    let x = 40;
    headers.forEach(h => {
      doc.text(h, x, tableTop);
      x += 150;
    });

    let y = tableTop + 20;
    rows.forEach(row => {
      if (y > 750) { doc.addPage(); y = 40; }
      x = 40;
      doc.text(row.name.substring(0, 25), x, y); x += 150;
      doc.text(row.sku || '-', x, y); x += 150;
      doc.text(row.category || '-', x, y); x += 150;
      doc.text(String(row.stock_quantity), x, y); x += 150;
      doc.text(String(row.sell_price), x, y);
      y += 15;
    });

    doc.end();
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  },

  async generateSalesXLSX(rows: any[], tenantId: string) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ventes');

    worksheet.columns = [
      { header: 'Transaction', key: 'transaction_number', width: 20 },
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Vendeur', key: 'seller_name', width: 20 },
      { header: 'Total', key: 'total_amount', width: 12 },
      { header: 'Paiement', key: 'payment_method', width: 15 },
      { header: 'Annulée', key: 'is_cancelled', width: 10 }
    ];

    worksheet.addRows(rows.map(r => ({
      ...r,
      created_at: new Date(r.created_at).toLocaleString('fr-FR'),
      is_cancelled: r.is_cancelled ? 'Oui' : 'Non'
    })));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  },

  async generateSalesPDF(rows: any[], _tenantId: string) {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', chunk => chunks.push(chunk));
    doc.pipe(stream);

    doc.fontSize(16).text('Historique des Ventes', { align: 'center' });
    doc.moveDown();

    let y = doc.y;
    rows.forEach((row, i) => {
      if (y > 750) { doc.addPage(); y = 40; }
      const status = row.is_cancelled ? '[Annulée] ' : '';
      doc.fontSize(9).text(
        `${status}${row.transaction_number} - ${new Date(row.created_at).toLocaleDateString('fr-FR')} - ${row.seller_name || 'Inconnu'} - ${row.total_amount} FCFA`,
        40, y
      );
      y += 15;
    });

    doc.end();
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  },

  async generateDailyReportXLSX(stats: any, topProducts: any[], date: string) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rapport Journalier');

    worksheet.getCell('A1').value = `Rapport du ${date}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    
    worksheet.getCell('A3').value = 'Chiffre d\'affaires';
    worksheet.getCell('B3').value = Number(stats.revenue);
    worksheet.getCell('A4').value = 'Ventes';
    worksheet.getCell('B4').value = Number(stats.sales_count);
    worksheet.getCell('A5').value = 'Bénéfice estimé';
    worksheet.getCell('B5').value = Number(stats.profit);
    worksheet.getCell('A6').value = 'Annulées';
    worksheet.getCell('B6').value = Number(stats.cancelled_count);
    worksheet.getCell('A7').value = 'Espèces';
    worksheet.getCell('B7').value = Number(stats.cash_count);
    worksheet.getCell('A8').value = 'Mobile Money';
    worksheet.getCell('B8').value = Number(stats.momo_count);

    worksheet.getCell('A10').value = 'Top 5 Produits';
    worksheet.getCell('A10').font = { bold: true };
    
    worksheet.columns = [
      { header: 'Produit', key: 'name', width: 30 },
      { header: 'Qté vendue', key: 'qty_sold', width: 15 },
      { header: 'CA', key: 'revenue', width: 15 }
    ];
    worksheet.addRows(topProducts);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  },

  async generateDailyReportPDF(stats: any, topProducts: any[], date: string) {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', chunk => chunks.push(chunk));
    doc.pipe(stream);

    doc.fontSize(16).text(`Rapport journalier — ${date}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(11).text(`Chiffre d'affaires : ${Number(stats.revenue).toLocaleString('fr-FR')} FCFA`);
    doc.text(`Ventes : ${stats.sales_count}`);
    doc.text(`Bénéfice estimé : ${Number(stats.profit).toLocaleString('fr-FR')} FCFA`);
    doc.text(`Annulées : ${stats.cancelled_count}`);
    doc.text(`Espèces : ${stats.cash_count} | Mobile Money : ${stats.momo_count}`);
    doc.moveDown(2);

    doc.fontSize(12).text('Top 5 Produits', { underline: true });
    doc.moveDown();
    doc.fontSize(10);
    
    topProducts.forEach((p, i) => {
      doc.text(`${i + 1}. ${p.name} — ${p.qty_sold} unités — ${Number(p.revenue).toLocaleString('fr-FR')} FCFA`);
    });

    doc.end();
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
};