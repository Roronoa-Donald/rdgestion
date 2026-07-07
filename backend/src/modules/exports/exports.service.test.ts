import { vi, describe, it, expect, beforeEach } from 'vitest';
import { exportsService } from './exports.service';
import * as database from '../../config/database';

vi.mock('../../config/database', () => ({
  query: vi.fn(),
  pool: { end: vi.fn() }
}));

describe('exportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportProducts', () => {
    it('devrait appeler generateProductsXLSX pour format=xlsx', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 'p1', name: 'Doliprane', sku: 'SKU', category: 'Med', purchase_price: 100, sell_price: 200, stock_quantity: 10, stock_threshold: 5, expiry_date: null, is_deleted: false }]
      } as any);

      const generateSpy = vi.spyOn(exportsService, 'generateProductsXLSX').mockResolvedValueOnce(Buffer.from('xlsx-bytes'));

      const result = await exportsService.exportProducts('tenant-1', 'xlsx');
      expect(generateSpy).toHaveBeenCalledTimes(1);
      expect(result.toString()).toBe('xlsx-bytes');
    });

    it('devrait appeler generateProductsPDF pour format=pdf', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'Doliprane' }] } as any);
      const generateSpy = vi.spyOn(exportsService, 'generateProductsPDF').mockResolvedValueOnce(Buffer.from('pdf-bytes'));

      const result = await exportsService.exportProducts('tenant-1', 'pdf');
      expect(generateSpy).toHaveBeenCalledTimes(1);
      expect(result.toString()).toBe('pdf-bytes');
    });
  });

  describe('exportSales', () => {
    it('devrait appliquer les filtres de période et appeler le bon générateur', async () => {
      vi.spyOn(database, 'query').mockResolvedValueOnce({
        rows: [{ id: 's1', transaction_number: 'VENTE-2026-0000001', created_at: new Date(), total_amount: 1000, payment_method: 'CASH', is_cancelled: false, seller_name: 'Alice' }]
      } as any);

      const generateXlsx = vi.spyOn(exportsService, 'generateSalesXLSX').mockResolvedValueOnce(Buffer.from('xlsx'));

      await exportsService.exportSales('tenant-1', 'xlsx', '2026-07-01', '2026-07-31');
      expect(generateXlsx).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportDailyReport', () => {
    it('devrait générer un rapport quotidien PDF', async () => {
      vi.spyOn(database, 'query')
        .mockResolvedValueOnce({ rows: [{ sales_count: 10, revenue: 50000, profit: 20000, cancelled_count: 1, cash_count: 7, momo_count: 3 }] } as any)
        .mockResolvedValueOnce({ rows: [{ name: 'Doliprane', qty_sold: 5, revenue: 2500 }] } as any);

      const generatePdf = vi.spyOn(exportsService, 'generateDailyReportPDF').mockResolvedValueOnce(Buffer.from('pdf'));

      await exportsService.exportDailyReport('tenant-1', 'pdf', '2026-07-06');
      expect(generatePdf).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateProductsXLSX', () => {
    it('devrait produire un Buffer non vide', async () => {
      const buffer = await exportsService.generateProductsXLSX([{ id: 'p1', name: 'Test', sku: 'X', category: 'Cat', purchase_price: 100, sell_price: 200, stock_quantity: 10, stock_threshold: 5, expiry_date: null, is_deleted: false }]);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateProductsPDF', () => {
    it('devrait produire un Buffer non vide pour le PDF produits', async () => {
      const buffer = await exportsService.generateProductsPDF([{ id: 'p1', name: 'Test', sku: 'X', category: 'Cat', stock_quantity: 10, sell_price: 200 }]);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('latin1')).toContain('%PDF-');
    });
  });

  describe('generateDailyReportPDF', () => {
    it('devrait produire un Buffer non vide pour le PDF rapport journalier', async () => {
      const buffer = await exportsService.generateDailyReportPDF(
        { sales_count: 10, revenue: 50000, profit: 20000, cancelled_count: 1, cash_count: 7, momo_count: 3 },
        [{ name: 'Doliprane', qty_sold: 5, revenue: 2500 }],
        '2026-07-06'
      );
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('latin1')).toContain('%PDF-');
    });
  });
});
