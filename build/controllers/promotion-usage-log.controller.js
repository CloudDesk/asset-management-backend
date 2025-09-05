import { PromotionUsageLogService } from '../services/promotion-usage-log.service.js';
import { createPromotionUsageLogSchema, updatePromotionUsageLogSchema, upsertPromotionUsageLogSchema } from '../schemas/promotion-usage-log.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export class PromotionUsageLogController {
    promotionUsageLogService = new PromotionUsageLogService();
    getPromotionUsageLogs = asyncHandler(async (request, reply) => {
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.promotionUsageLogService.findMany(filters, page, limit);
        const response = createSuccessResponse('Promotion usage logs retrieved successfully', result.data);
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
    getPromotionUsageLog = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const promotionUsageLog = await this.promotionUsageLogService.findById(id);
        const response = createSuccessResponse('Promotion usage log retrieved successfully', promotionUsageLog);
        return reply.code(200).send(response);
    });
    createPromotionUsageLog = asyncHandler(async (request, reply) => {
        const data = createPromotionUsageLogSchema.parse(request.body);
        const promotionUsageLog = await this.promotionUsageLogService.create(data);
        const response = createSuccessResponse('Promotion usage log created successfully', promotionUsageLog);
        return reply.code(201).send(response);
    });
    updatePromotionUsageLog = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const data = updatePromotionUsageLogSchema.parse(request.body);
        const promotionUsageLog = await this.promotionUsageLogService.update(id, data);
        const response = createSuccessResponse('Promotion usage log updated successfully', promotionUsageLog);
        return reply.code(200).send(response);
    });
    deletePromotionUsageLog = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        await this.promotionUsageLogService.delete(id);
        const response = createSuccessResponse('Promotion usage log deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertPromotionUsageLog = asyncHandler(async (request, reply) => {
        const data = upsertPromotionUsageLogSchema.parse(request.body);
        const promotionUsageLog = await this.promotionUsageLogService.upsert(data);
        const message = data.id ? 'Promotion usage log updated successfully' : 'Promotion usage log created successfully';
        const response = createSuccessResponse(message, promotionUsageLog);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=promotion-usage-log.controller.js.map