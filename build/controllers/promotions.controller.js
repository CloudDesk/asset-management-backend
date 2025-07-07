import { PromotionsService } from '../services/promotions.service.js';
import { PromotionEvaluationService } from '../services/promotion-evaluation.service.js';
import { createPromotionsSchema, updatePromotionsSchema, upsertPromotionsSchema, promotionEligibilitySchema } from '../schemas/promotions.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export class PromotionsController {
    promotionsService = new PromotionsService();
    promotionEvaluationService = new PromotionEvaluationService();
    getPromotions = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.promotionsService.findMany(filters, page, limit);
        const response = createSuccessResponse('Promotions retrieved successfully', result.data);
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
    getPromotion = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const promotion = await this.promotionsService.findById(id);
        const response = createSuccessResponse('Promotion retrieved successfully', promotion);
        return reply.code(200).send(response);
    });
    createPromotion = asyncHandler(async (request, reply) => {
        const data = createPromotionsSchema.parse(request.body);
        const promotion = await this.promotionsService.create(data);
        const response = createSuccessResponse('Promotion created successfully', promotion);
        return reply.code(201).send(response);
    });
    updatePromotion = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const data = updatePromotionsSchema.parse(request.body);
        const promotion = await this.promotionsService.update(id, data);
        const response = createSuccessResponse('Promotion updated successfully', promotion);
        return reply.code(200).send(response);
    });
    deletePromotion = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        await this.promotionsService.delete(id);
        const response = createSuccessResponse('Promotion deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertPromotion = asyncHandler(async (request, reply) => {
        const data = upsertPromotionsSchema.parse(request.body);
        const promotion = await this.promotionsService.upsert(data);
        const message = data.id ? 'Promotion updated successfully' : 'Promotion created successfully';
        const response = createSuccessResponse(message, promotion);
        return reply.code(200).send(response);
    });
    evaluateEligibility = asyncHandler(async (request, reply) => {
        const data = promotionEligibilitySchema.parse(request.body);
        const result = await this.promotionEvaluationService.evaluateEligibility(data);
        const response = createSuccessResponse('Promotion eligibility evaluated successfully', result);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=promotions.controller.js.map