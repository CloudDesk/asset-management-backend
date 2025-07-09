import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class RatingService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic rating findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: ratings, total } = await dynamicFindManyWithFilters('rating', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                ratingCount: ratings.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: ratings.length > 0 ? Object.keys(ratings[0]) : []
            }, 'Dynamic rating findMany with filters completed');
            return createPaginationResult(ratings, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic rating findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ ratingId: id }, 'Starting dynamic rating findById operation');
            const rating = await dynamicFindUnique('rating', { id: parseInt(id) });
            if (!rating) {
                throw new Error('Rating not found');
            }
            logger.debug({
                ratingId: id,
                availableFields: Object.keys(rating)
            }, 'Dynamic rating findById completed');
            return rating;
        }
        catch (error) {
            logger.error({ error, ratingId: id }, 'Error in rating findById operation');
            throw error;
        }
    }
    async findByUserId(userId) {
        try {
            logger.debug({ userId }, 'Starting dynamic rating findByUserId operation');
            const ratings = await dynamicFindManyWithFilters('rating', { userid: userId }, {
                skip: 0,
                take: 1000, // Get all ratings for user
                useAllColumns: true
            });
            logger.debug({
                userId,
                found: ratings.data.length,
                availableFields: ratings.data.length > 0 ? Object.keys(ratings.data[0]) : []
            }, 'Dynamic rating findByUserId completed');
            return ratings.data;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error in rating findByUserId operation');
            throw error;
        }
    }
    async findByProductId(productId) {
        try {
            logger.debug({ productId }, 'Starting dynamic rating findByProductId operation');
            const ratings = await dynamicFindManyWithFilters('rating', { productid: productId }, {
                skip: 0,
                take: 1000, // Get all ratings for product
                useAllColumns: true
            });
            logger.debug({
                productId,
                found: ratings.data.length,
                availableFields: ratings.data.length > 0 ? Object.keys(ratings.data[0]) : []
            }, 'Dynamic rating findByProductId completed');
            return ratings.data;
        }
        catch (error) {
            logger.error({ error, productId }, 'Error in rating findByProductId operation');
            throw error;
        }
    }
    async findByOrderId(orderId) {
        try {
            logger.debug({ orderId }, 'Starting dynamic rating findByOrderId operation');
            const ratings = await dynamicFindManyWithFilters('rating', { orderid: orderId }, {
                skip: 0,
                take: 1000, // Get all ratings for order
                useAllColumns: true
            });
            logger.debug({
                orderId,
                found: ratings.data.length,
                availableFields: ratings.data.length > 0 ? Object.keys(ratings.data[0]) : []
            }, 'Dynamic rating findByOrderId completed');
            return ratings.data;
        }
        catch (error) {
            logger.error({ error, orderId }, 'Error in rating findByOrderId operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic rating create operation');
            // Add timestamps
            const ratingData = {
                ...data,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const rating = await dynamicCreate('rating', ratingData);
            if (!rating) {
                throw new Error('Failed to create rating - no valid fields provided');
            }
            logger.info({
                ratingId: rating.id,
                availableFields: Object.keys(rating)
            }, 'Dynamic rating create completed');
            return rating;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in rating create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if rating exists
            await this.findById(id);
            logger.debug({ originalData: data, ratingId: id }, 'Starting dynamic rating update operation');
            // Add modified timestamp
            const ratingData = {
                ...data,
                modifieddate: Date.now()
            };
            const rating = await dynamicUpdate('rating', { id: parseInt(id) }, ratingData);
            if (!rating) {
                throw new Error('Failed to update rating - no valid fields provided');
            }
            logger.info({
                ratingId: id,
                availableFields: Object.keys(rating)
            }, 'Dynamic rating update completed');
            return rating;
        }
        catch (error) {
            logger.error({ error, data, ratingId: id }, 'Error in rating update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if rating exists
            await this.findById(id);
            logger.debug({ ratingId: id }, 'Starting dynamic rating delete operation');
            const result = await dynamicDelete('rating', { id: parseInt(id) });
            logger.info({ ratingId: id }, 'Dynamic rating delete completed');
            return result;
        }
        catch (error) {
            logger.error({ error, ratingId: id }, 'Error in rating delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic rating upsert operation');
            if (data.id) {
                // Update existing rating
                return await this.update(data.id.toString(), data);
            }
            else {
                // Create new rating
                const { id, ...createData } = data;
                return await this.create(createData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in rating upsert operation');
            throw error;
        }
    }
    async getAverageRatingByProductId(productId) {
        try {
            logger.debug({ productId }, 'Starting getAverageRatingByProductId operation');
            const ratings = await this.findByProductId(productId);
            if (ratings.length === 0) {
                return { averageRating: 0, totalRatings: 0 };
            }
            const validRatings = ratings.filter(rating => rating.starrating && rating.starrating > 0);
            if (validRatings.length === 0) {
                return { averageRating: 0, totalRatings: 0 };
            }
            const sum = validRatings.reduce((total, rating) => total + rating.starrating, 0);
            const averageRating = Math.round((sum / validRatings.length) * 10) / 10; // Round to 1 decimal
            logger.debug({
                productId,
                averageRating,
                totalRatings: validRatings.length
            }, 'getAverageRatingByProductId completed');
            return { averageRating, totalRatings: validRatings.length };
        }
        catch (error) {
            logger.error({ error, productId }, 'Error in getAverageRatingByProductId operation');
            throw error;
        }
    }
    async getRatingsByStarLevel(productId) {
        try {
            logger.debug({ productId }, 'Starting getRatingsByStarLevel operation');
            let ratings;
            if (productId) {
                ratings = await this.findByProductId(productId);
            }
            else {
                const allRatings = await this.findMany({}, 1, 10000); // Get all ratings
                ratings = allRatings.data;
            }
            const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            ratings.forEach(rating => {
                if (rating.starrating && rating.starrating >= 1 && rating.starrating <= 5) {
                    const starLevel = rating.starrating;
                    starCounts[starLevel]++;
                }
            });
            logger.debug({
                productId,
                starCounts
            }, 'getRatingsByStarLevel completed');
            return starCounts;
        }
        catch (error) {
            logger.error({ error, productId }, 'Error in getRatingsByStarLevel operation');
            throw error;
        }
    }
}
//# sourceMappingURL=rating.service.js.map