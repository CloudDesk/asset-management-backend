import { RatingService } from '../services/rating.service.js';
import { createRatingSchema, updateRatingSchema, upsertRatingSchema, ratingParamsSchema } from '../schemas/rating.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class RatingController {
    ratingService = new RatingService();
    getRatings = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.ratingService.findMany(filters, page, limit);
        // Format all ratings in the result
        const formattedData = formatEntitiesForAPI(result.data, 'rating');
        const response = createSuccessResponse('Ratings retrieved successfully', formattedData);
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
    getRating = asyncHandler(async (request, reply) => {
        const { id } = ratingParamsSchema.parse(request.params);
        const rating = await this.ratingService.findById(id);
        // Format the individual rating data
        const formattedRating = formatEntitiesForAPI([rating], 'rating')[0];
        const response = createSuccessResponse('Rating retrieved successfully', formattedRating);
        return reply.code(200).send(response);
    });
    createRating = asyncHandler(async (request, reply) => {
        const data = createRatingSchema.parse(request.body);
        const rating = await this.ratingService.create(data);
        // Format the created rating data
        const formattedRating = formatEntitiesForAPI([rating], 'rating')[0];
        const response = createSuccessResponse('Rating created successfully', formattedRating);
        return reply.code(201).send(response);
    });
    updateRating = asyncHandler(async (request, reply) => {
        const { id } = ratingParamsSchema.parse(request.params);
        const data = updateRatingSchema.parse(request.body);
        const rating = await this.ratingService.update(id, data);
        // Format the updated rating data
        const formattedRating = formatEntitiesForAPI([rating], 'rating')[0];
        const response = createSuccessResponse('Rating updated successfully', formattedRating);
        return reply.code(200).send(response);
    });
    deleteRating = asyncHandler(async (request, reply) => {
        const { id } = ratingParamsSchema.parse(request.params);
        await this.ratingService.delete(id);
        const response = createSuccessResponse('Rating deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertRating = asyncHandler(async (request, reply) => {
        const data = upsertRatingSchema.parse(request.body);
        const rating = await this.ratingService.upsert(data);
        // Format the upserted rating data
        const formattedRating = formatEntitiesForAPI([rating], 'rating')[0];
        const message = data.id ? 'Rating updated successfully' : 'Rating created successfully';
        const response = createSuccessResponse(message, formattedRating);
        return reply.code(200).send(response);
    });
    getRatingsByUserId = asyncHandler(async (request, reply) => {
        const userId = parseInt(request.params.userId);
        if (isNaN(userId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid user ID',
                details: 'User ID must be a valid number',
                statusCode: 400,
            });
        }
        const ratings = await this.ratingService.findByUserId(userId);
        // Format the ratings data
        const formattedRatings = formatEntitiesForAPI(ratings, 'rating');
        const response = createSuccessResponse('User ratings retrieved successfully', formattedRatings);
        return reply.code(200).send(response);
    });
    getRatingsByProductId = asyncHandler(async (request, reply) => {
        const productId = parseInt(request.params.productId);
        if (isNaN(productId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid product ID',
                details: 'Product ID must be a valid number',
                statusCode: 400,
            });
        }
        const ratings = await this.ratingService.findByProductId(productId);
        // Format the ratings data
        const formattedRatings = formatEntitiesForAPI(ratings, 'rating');
        const response = createSuccessResponse('Product ratings retrieved successfully', formattedRatings);
        return reply.code(200).send(response);
    });
    getRatingsByOrderId = asyncHandler(async (request, reply) => {
        const orderId = parseInt(request.params.orderId);
        if (isNaN(orderId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid order ID',
                details: 'Order ID must be a valid number',
                statusCode: 400,
            });
        }
        const ratings = await this.ratingService.findByOrderId(orderId);
        // Format the ratings data
        const formattedRatings = formatEntitiesForAPI(ratings, 'rating');
        const response = createSuccessResponse('Order ratings retrieved successfully', formattedRatings);
        return reply.code(200).send(response);
    });
    getAverageRatingByProductId = asyncHandler(async (request, reply) => {
        const productId = parseInt(request.params.productId);
        if (isNaN(productId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid product ID',
                details: 'Product ID must be a valid number',
                statusCode: 400,
            });
        }
        const result = await this.ratingService.getAverageRatingByProductId(productId);
        const response = createSuccessResponse('Average rating retrieved successfully', result);
        return reply.code(200).send(response);
    });
    getRatingsByStarLevel = asyncHandler(async (request, reply) => {
        let productId;
        // Check for productId in params or query
        if (request.params?.productId) {
            productId = parseInt(request.params.productId);
            if (isNaN(productId)) {
                return reply.code(400).send({
                    success: false,
                    message: 'Invalid product ID',
                    details: 'Product ID must be a valid number',
                    statusCode: 400,
                });
            }
        }
        else if (request.query && typeof request.query === 'object' && 'productId' in request.query) {
            const queryProductId = request.query.productId;
            if (queryProductId) {
                productId = parseInt(queryProductId);
                if (isNaN(productId)) {
                    return reply.code(400).send({
                        success: false,
                        message: 'Invalid product ID in query',
                        details: 'Product ID must be a valid number',
                        statusCode: 400,
                    });
                }
            }
        }
        const result = await this.ratingService.getRatingsByStarLevel(productId);
        const response = createSuccessResponse('Star level distribution retrieved successfully', result);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=rating.controller.js.map