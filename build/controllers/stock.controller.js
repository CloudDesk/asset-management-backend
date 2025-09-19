import { StockService } from '../services/stock.service.js';
import { ExcelService } from '../services/excel.service.js';
import { createStockSchema, updateStockSchema, upsertStockSchema, stockParamsSchema, rfidUpdateStockSchema, bulkRfidUpdateStockSchema } from '../schemas/stock.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatStockForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class StockController {
    stockService = new StockService();
    excelService = new ExcelService();
    getStocks = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.stockService.findMany(filters, page, limit);
        // Format all stocks in the result
        const formattedData = formatEntitiesForAPI(result.data, 'stock');
        const response = createSuccessResponse('Stocks retrieved successfully', formattedData);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0
            }
        });
    });
    getStock = asyncHandler(async (request, reply) => {
        const { id } = stockParamsSchema.parse(request.params);
        const stock = await this.stockService.findById(id);
        const response = createSuccessResponse('Stock retrieved successfully', formatStockForAPI(stock));
        return reply.code(200).send(response);
    });
    createStock = asyncHandler(async (request, reply) => {
        const data = createStockSchema.parse(request.body);
        const stock = await this.stockService.create(data);
        const response = createSuccessResponse('Stock created successfully', formatStockForAPI(stock));
        return reply.code(201).send(response);
    });
    updateStock = asyncHandler(async (request, reply) => {
        const { id } = stockParamsSchema.parse(request.params);
        const data = updateStockSchema.parse(request.body);
        const stock = await this.stockService.update(id, data);
        const response = createSuccessResponse('Stock updated successfully', formatStockForAPI(stock));
        return reply.code(200).send(response);
    });
    deleteStock = asyncHandler(async (request, reply) => {
        const { id } = stockParamsSchema.parse(request.params);
        await this.stockService.delete(id);
        const response = createSuccessResponse('Stock deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertStock = asyncHandler(async (request, reply) => {
        const data = upsertStockSchema.parse(request.body);
        const stock = await this.stockService.upsert(data);
        const message = data.id ? 'Stock updated successfully' : 'Stock created successfully';
        const response = createSuccessResponse(message, formatStockForAPI(stock));
        return reply.code(200).send(response);
    });
    updateQuantities = asyncHandler(async (request, reply) => {
        const { id } = stockParamsSchema.parse(request.params);
        const quantities = request.body;
        const stock = await this.stockService.updateQuantities(id, quantities);
        const response = createSuccessResponse('Stock quantities updated successfully', formatStockForAPI(stock));
        return reply.code(200).send(response);
    });
    updateStockByRfid = asyncHandler(async (request, reply) => {
        const { rfid, orderlineid } = rfidUpdateStockSchema.parse(request.body);
        const stock = await this.stockService.updateByRfid(rfid, orderlineid);
        const response = createSuccessResponse('Stock updated successfully via RFID scan', formatStockForAPI(stock));
        return reply.code(200).send(response);
    });
    bulkUpdateStockByRfid = asyncHandler(async (request, reply) => {
        const updates = bulkRfidUpdateStockSchema.parse(request.body);
        const result = await this.stockService.bulkUpdateByRfid(updates);
        // Format the successful stock results
        const formattedResults = result.results.map(item => {
            if (item.success && 'data' in item) {
                return {
                    ...item,
                    data: formatStockForAPI(item.data)
                };
            }
            return item;
        });
        const responseData = {
            ...result,
            results: formattedResults
        };
        // Determine response code based on results
        const responseCode = result.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status
        const message = result.summary.failed === 0
            ? `All ${result.summary.successful} stocks updated successfully via RFID scan`
            : `Bulk RFID update completed: ${result.summary.successful} successful, ${result.summary.failed} failed`;
        const response = createSuccessResponse(message, responseData);
        return reply.code(responseCode).send(response);
    });
    /**
     * Export stocks to Excel file
     */
    exportStocks = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters
        const allFilters = request.query || {};
        // Generate Excel buffer
        const excelBuffer = await this.excelService.generateStockExcel(allFilters);
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `stock_export_${timestamp}.xlsx`;
        // Set response headers for file download
        reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.header('Content-Length', excelBuffer.length.toString());
        return reply.send(excelBuffer);
    });
    /**
     * Import bulk stocks (placeholder)
     */
    importBulkStocks = asyncHandler(async (request, reply) => {
        // TODO: Implement bulk import functionality
        const response = createSuccessResponse('Bulk import functionality not yet implemented', null);
        return reply.code(501).send(response);
    });
}
//# sourceMappingURL=stock.controller.js.map