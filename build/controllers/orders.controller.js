import { OrdersService } from '../services/orders.service.js';
import { createOrdersSchema, updateOrdersSchema, upsertOrdersSchema, ordersParamsSchema } from '../schemas/orders.schema.js';
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
    getOrder = asyncHandler(async (request, reply) => {
        const { id } = ordersParamsSchema.parse(request.params);
        const order = await this.ordersService.findById(id);
        const response = createSuccessResponse('Order retrieved successfully', formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(200).send(response);
    });
    getOrderByOrderId = asyncHandler(async (request, reply) => {
        const { orderid } = request.params;
        const order = await this.ordersService.findByOrderId(orderid);
        const response = createSuccessResponse('Order retrieved successfully', formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(200).send(response);
    });
    createOrder = asyncHandler(async (request, reply) => {
        const data = createOrdersSchema.parse(request.body);
        const order = await this.ordersService.create(data);
        const response = createSuccessResponse('Order created successfully', formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(201).send(response);
    });
    updateOrder = asyncHandler(async (request, reply) => {
        const { id } = ordersParamsSchema.parse(request.params);
        const data = updateOrdersSchema.parse(request.body);
        const order = await this.ordersService.update(id, data);
        const response = createSuccessResponse('Order updated successfully', formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(200).send(response);
    });
    updateOrderStatus = asyncHandler(async (request, reply) => {
        const { id } = ordersParamsSchema.parse(request.params);
        const { status, additionalData } = request.body;
        if (!status) {
            return reply.code(400).send({
                success: false,
                message: 'Status is required',
                details: 'Please provide a valid status',
                statusCode: 400
            });
        }
        const order = await this.ordersService.updateOrderStatus(id, status, additionalData);
        const response = createSuccessResponse('Order status updated successfully', formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(200).send(response);
    });
    deleteOrder = asyncHandler(async (request, reply) => {
        const { id } = ordersParamsSchema.parse(request.params);
        await this.ordersService.delete(id);
        const response = createSuccessResponse('Order deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertOrder = asyncHandler(async (request, reply) => {
        const data = upsertOrdersSchema.parse(request.body);
        const order = await this.ordersService.upsert(data);
        const message = data.id ? 'Order updated successfully' : 'Order created successfully';
        const response = createSuccessResponse(message, formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=orders.controller.js.map