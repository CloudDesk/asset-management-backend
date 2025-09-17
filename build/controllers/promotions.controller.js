import { PromotionsService } from '../services/promotions.service.js';
import { createPromotionsSchema, updatePromotionsSchema } from '../schemas/promotions.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class PromotionsController {
    promotionsService = new PromotionsService();
    // Get user segments for debugging
    getUserSegments = asyncHandler(async (request, reply) => {
        const { userId } = request.params;
        const segments = await this.promotionsService.getUserSegments(userId);
        const response = createSuccessResponse('User segments retrieved', segments);
        return reply.code(200).send(response);
    });
    getPromotions = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        console.log(page, limit, "getpromotions page and limit");
        console.log(request.query, "ALLFILTERS");
        // Check for admin mode flag
        const { admin_mode, ...filtersWithoutAdmin } = allFilters;
        const adminMode = admin_mode === 'true' || admin_mode === true;
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = filtersWithoutAdmin;
        const result = await this.promotionsService.findMany(filters, page, limit, adminMode);
        const response = createSuccessResponse('Promotions retrieved successfully', result.data);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0,
                adminMode: adminMode
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
    // Get unified promotion offers (best recommendation + all eligible/ineligible)
    getUnifiedPromotionOffers = asyncHandler(async (request, reply) => {
        const { userId, cartItems, mode } = request.body;
        logger.info({ userId, cartItemsCount: cartItems.length, mode }, 'Getting unified promotion offers');
        const offers = await this.promotionsService.getUnifiedPromotionOffers({
            userId,
            cartItems,
            mode
        });
        const response = createSuccessResponse('Unified promotion offers retrieved', offers);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=promotions.controller.js.map