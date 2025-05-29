import { StockService } from '../services/stock.service.js';
import { createStockSchema, updateStockSchema, upsertStockSchema, stockParamsSchema } from '../schemas/stock.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatStockForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class StockController {
    stockService = new StockService();
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
}
//# sourceMappingURL=stock.controller.js.map