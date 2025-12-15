import { OrderlineService } from '../services/orderline.service.js';
import { orderlineParamsSchema } from '../schemas/orderline.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class OrderlineController {
    orderlineService = new OrderlineService();
    getOrderlines = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.orderlineService.findMany(filters, page, limit);
        // Format all orderlines in the result
        const formattedData = formatEntitiesForAPI(result.data, 'orderline');
        const response = createSuccessResponse('Orderlines retrieved successfully', formattedData);
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
    getOrderline = asyncHandler(async (request, reply) => {
        const { id } = orderlineParamsSchema.parse(request.params);
        const orderline = await this.orderlineService.findById(id);
        const response = createSuccessResponse('Orderline retrieved successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(200).send(response);
    });
    cancelOrderline = asyncHandler(async (request, reply) => {
        const { id } = orderlineParamsSchema.parse(request.params);
        const { reason, additionalData } = request.body || {};
        // Prepare additional data including the cancellation reason
        const cancelData = {
            ...additionalData,
            ...(reason && { cancellation_reason: reason })
        };
        const orderline = await this.orderlineService.updateOrderlineStatus(id, 'cancelled', cancelData);
        const response = createSuccessResponse('Orderline cancelled successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=orderline.controller.js.map