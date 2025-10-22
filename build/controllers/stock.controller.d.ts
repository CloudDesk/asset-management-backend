import { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from '../services/stock.service.js';
export declare class StockController {
    stockService: StockService;
    private excelService;
    private stockImportService;
    getStocks: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createBulkStocks: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateQuantities: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateStockByRfid: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    bulkUpdateStockByRfid: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Export stocks to Excel file
     */
    exportStocks: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Generate preview for stock import file
     */
    /**
     * Commit validated stock import rows
     */
    importPreview: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    importCommit: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=stock.controller.d.ts.map