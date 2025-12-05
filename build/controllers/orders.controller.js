import { OrdersService } from '../services/orders.service.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class OrdersController {
    ordersService = new OrdersService();
    getOrders = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.ordersService.findMany(filters, page, limit);
        // Format all orders in the result
        const formattedData = formatEntitiesForAPI(result.data, 'orders');
        const response = createSuccessResponse('Orders retrieved successfully', formattedData);
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
}
//# sourceMappingURL=orders.controller.js.map