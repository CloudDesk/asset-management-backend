import { PromotionRulesService } from '../services/promotion-rules.service.js';
import { createPromotionRulesSchema, updatePromotionRulesSchema, upsertPromotionRulesSchema } from '../schemas/promotion-rules.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export class PromotionRulesController {
    promotionRulesService = new PromotionRulesService();
    getPromotionRules = asyncHandler(async (request, reply) => {
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.promotionRulesService.findMany(filters, page, limit);
        const response = createSuccessResponse('Promotion rules retrieved successfully', result.data);
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
    getPromotionRule = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const promotionRule = await this.promotionRulesService.findById(id);
        const response = createSuccessResponse('Promotion rule retrieved successfully', promotionRule);
        return reply.code(200).send(response);
    });
    createPromotionRule = asyncHandler(async (request, reply) => {
        const data = createPromotionRulesSchema.parse(request.body);
        const promotionRule = await this.promotionRulesService.create(data);
        const response = createSuccessResponse('Promotion rule created successfully', promotionRule);
        return reply.code(201).send(response);
    });
    updatePromotionRule = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const data = updatePromotionRulesSchema.parse(request.body);
        const promotionRule = await this.promotionRulesService.update(id, data);
        const response = createSuccessResponse('Promotion rule updated successfully', promotionRule);
        return reply.code(200).send(response);
    });
    deletePromotionRule = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        await this.promotionRulesService.delete(id);
        const response = createSuccessResponse('Promotion rule deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertPromotionRule = asyncHandler(async (request, reply) => {
        const data = upsertPromotionRulesSchema.parse(request.body);
        const promotionRule = await this.promotionRulesService.upsert(data);
        const message = data.id ? 'Promotion rule updated successfully' : 'Promotion rule created successfully';
        const response = createSuccessResponse(message, promotionRule);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=promotion-rules.controller.js.map