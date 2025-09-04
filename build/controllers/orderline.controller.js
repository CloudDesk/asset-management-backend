import { OrderlineService } from '../services/orderline.service.js';
import { createOrderlineSchema, updateOrderlineSchema, upsertOrderlineSchema, orderlineParamsSchema } from '../schemas/orderline.schema.js';
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
    getOrderlineByOrderlineNumber = asyncHandler(async (request, reply) => {
        const { orderlinenumber } = request.params;
        const orderline = await this.orderlineService.findByOrderlineNumber(orderlinenumber);
        const response = createSuccessResponse('Orderline retrieved successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(200).send(response);
    });
    getOrderlinesByOrderId = asyncHandler(async (request, reply) => {
        const { orderid } = request.params;
        const orderlines = await this.orderlineService.findByOrderId(parseInt(orderid));
        const response = createSuccessResponse('Orderlines retrieved successfully', formatEntitiesForAPI(orderlines, 'orderline'));
        return reply.code(200).send(response);
    });
    createOrderline = asyncHandler(async (request, reply) => {
        const data = createOrderlineSchema.parse(request.body);
        const orderline = await this.orderlineService.create(data);
        const response = createSuccessResponse('Orderline created successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(201).send(response);
    });
    updateOrderline = asyncHandler(async (request, reply) => {
        const { id } = orderlineParamsSchema.parse(request.params);
        const data = updateOrderlineSchema.parse(request.body);
        const orderline = await this.orderlineService.update(id, data);
        const response = createSuccessResponse('Orderline updated successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(200).send(response);
    });
    updateOrderlineStatus = asyncHandler(async (request, reply) => {
        const { id } = orderlineParamsSchema.parse(request.params);
        const { status, additionalData } = request.body;
        if (!status) {
            return reply.code(400).send({
                success: false,
                message: 'Status is required',
                details: 'Please provide a valid status',
                statusCode: 400
            });
        }
        const orderline = await this.orderlineService.updateOrderlineStatus(id, status, additionalData);
        const response = createSuccessResponse('Orderline status updated successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(200).send(response);
    });
    cancelOrderline = asyncHandler(async (request, reply) => {
        const { id } = orderlineParamsSchema.parse(request.params);
        const { reason } = request.body || {};
        const result = await this.orderlineService.cancelOrderline(id, reason);
        const response = createSuccessResponse(result.message, {
            orderline: formatEntitiesForAPI([result.orderline], 'orderline')[0],
            productUpdates: result.productUpdates,
            orderStatusUpdated: result.orderStatusUpdated,
            cancellationDetails: result.cancellationDetails
        });
        return reply.code(200).send(response);
    });
    bulkUpdateOrderlineStatus = asyncHandler(async (request, reply) => {
        const { orderlineIds, status, additionalData } = request.body;
        if (!orderlineIds || !Array.isArray(orderlineIds) || orderlineIds.length === 0) {
            return reply.code(400).send({
                success: false,
                message: 'Orderline IDs are required',
                details: 'Please provide an array of orderline IDs',
                statusCode: 400
            });
        }
        if (!status) {
            return reply.code(400).send({
                success: false,
                message: 'Status is required',
                details: 'Please provide a valid status',
                statusCode: 400
            });
        }
        const results = await this.orderlineService.bulkUpdateStatus(orderlineIds, status, additionalData);
        const response = createSuccessResponse('Bulk orderline status update completed', results);
        return reply.code(200).send(response);
    });
    deleteOrderline = asyncHandler(async (request, reply) => {
        const { id } = orderlineParamsSchema.parse(request.params);
        await this.orderlineService.delete(id);
        const response = createSuccessResponse('Orderline deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertOrderline = asyncHandler(async (request, reply) => {
        const data = upsertOrderlineSchema.parse(request.body);
        const orderline = await this.orderlineService.upsert(data);
        const message = data.id ? 'Orderline updated successfully' : 'Orderline created successfully';
        const response = createSuccessResponse(message, formatEntitiesForAPI([orderline], 'orderline')[0]);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=orderline.controller.js.map