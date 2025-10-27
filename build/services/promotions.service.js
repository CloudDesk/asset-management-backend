import { PrismaClient } from '@prisma/client';
import { createPaginationResult } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { getTimezoneFromGeo } from '../utils/geoUtils.js';
import { logger } from '../config/logger.js';
// Configuration constants for user segments
const USER_SEGMENT_CONFIG = {
    NEW_USER_DAYS: parseInt(process.env.NEW_USER_DAYS || '30'), // Default 30 days, configurable via env
    FIRST_ORDER_THRESHOLD: parseInt(process.env.FIRST_ORDER_THRESHOLD || '0'), // Default 0 orders
};
export class PromotionsService {
    prisma = new PrismaClient();
    // Get auto-applied promotions from user's active evaluation record
    async getAutoAppliedPromotionsFromEvaluation(userId) {
        try {
            // Find the user's active evaluation
            const activeEvaluation = await this.prisma.promotion_evaluations.findFirst({
                where: {
                    user_id: userId,
                    status: 'active'
                },
                orderBy: {
                    created_at: 'desc' // Get most recent active evaluation
                }
            });
            if (!activeEvaluation || !activeEvaluation.applied_promotions) {
                return [];
            }
            // Parse applied promotions and filter for auto-applied ones
            const appliedPromotions = Array.isArray(activeEvaluation.applied_promotions)
                ? activeEvaluation.applied_promotions
                : JSON.parse(activeEvaluation.applied_promotions);
            const autoAppliedPromotions = appliedPromotions.filter((promo) => promo.is_auto === true);
            logger.info({
                userId,
                evaluationId: activeEvaluation.evaluation_id,
                totalApplied: appliedPromotions.length,
                autoAppliedCount: autoAppliedPromotions.length
            }, 'Retrieved auto-applied promotions from active evaluation');
            return autoAppliedPromotions;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error getting auto-applied promotions from evaluation');
            return [];
        }
    }
    // Helper function to convert date string to Unix timestamp
    convertDateToUnixTimestamp(dateString) {
        if (!dateString)
            return 0;
        // If it's already a number, return it
        if (typeof dateString === 'number')
            return dateString;
        // Convert date string to Unix timestamp (seconds since epoch)
        const date = new Date(dateString);
        return Math.floor(date.getTime() / 1000);
    }
    // Helper function to convert Unix timestamp to readable date string
    convertUnixTimestampToDateString(timestamp) {
        if (!timestamp)
            return null;
        const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
        if (isNaN(numTimestamp))
            return null;
        // Convert Unix timestamp to ISO string
        return new Date(numTimestamp * 1000).toISOString();
    }
    // Helper function to convert Unix timestamp to Date object
    convertUnixTimestampToDate(timestamp) {
        if (!timestamp)
            return null;
        const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
        if (isNaN(numTimestamp))
            return null;
        return new Date(numTimestamp * 1000);
    }
    // Transform frontend data structure to backend format
    transformFrontendDataToBackend(data) {
        const transformed = { ...data };
        // If frontend sends discount_type and discount_value, create single action object
        if (data.discount_type && data.discount_value !== undefined) {
            const action = {
                type: data.discount_type,
                value: data.discount_value
            };
            // Add type-specific properties based on promotion type
            if (data.type === 'PERCENT_OFF_CART' || data.type === 'PERCENT_OFF_ITEM') {
                if (data.max_discount_cap) {
                    action.max_discount = data.max_discount_cap;
                }
            }
            if (data.type === 'BOGO') {
                action.buy_quantity = data.buy_quantity || 1;
                action.get_quantity = data.get_quantity || 1;
                if (data.product_ids && data.product_ids.length > 0) {
                    action.product_ids = data.product_ids;
                }
                if (data.max_free_items) {
                    action.max_free_items = data.max_free_items;
                }
            }
            if (data.type === 'FREE_PRODUCT') {
                if (data.free_product_id) {
                    action.free_product_id = data.free_product_id;
                }
                if (data.minimum_purchase) {
                    action.min_purchase = data.minimum_purchase;
                }
                if (data.max_free_items) {
                    action.max_free_items = data.max_free_items;
                }
            }
            if (data.type === 'FREE_SHIPPING') {
                if (data.minimum_order_value) {
                    action.min_order_value = data.minimum_order_value;
                }
            }
            // Set single action object (new database structure)
            transformed.action = action;
            // Remove redundant fields
            delete transformed.discount_type;
            delete transformed.discount_value;
            delete transformed.max_discount_cap;
            delete transformed.buy_quantity;
            delete transformed.get_quantity;
            delete transformed.product_ids;
            delete transformed.free_product_id;
            delete transformed.minimum_purchase;
            delete transformed.max_free_items;
            delete transformed.minimum_order_value;
        }
        return transformed;
    }
    // Get public promotions for guest users
    async getPublicPromotions(options) {
        try {
            logger.info({ options }, 'Getting public promotions for guest users');
            // Convert geo code to timezone
            const timezone = getTimezoneFromGeo(options.geo);
            logger.info({ geo: options.geo, timezone }, 'Geo to timezone mapping');
            // Get attractive public promotions that are:
            // 1. Active and currently running
            // 2. Public visibility (not private)
            // 3. Auto-apply or general promotions (not user-specific)
            // 4. Ordered by priority and discount value
            const filters = {
                status: 'active',
                visibility: 'public',
                auto_apply: 'true', // Show auto-apply promotions to guests
                timezone: timezone // Filter by timezone
            };
            const { data: promotions } = await dynamicFindManyWithFilters('promotions', filters, {
                skip: 0,
                take: options.limit,
                useAllColumns: true
            });
            // Filter and format promotions for guest users
            const publicPromotions = promotions
                .filter((promo) => {
                // Additional filtering for guest-appropriate promotions
                const now = new Date();
                const startDate = this.convertUnixTimestampToDate(promo.start_date);
                const endDate = this.convertUnixTimestampToDate(promo.end_date);
                // Date filtering for active promotions
                // Check if promotion is currently active
                if (startDate && startDate > now)
                    return false;
                if (endDate && endDate < now)
                    return false;
                return true;
            })
                .map((promo) => ({
                id: promo.id,
                name: promo.name,
                description: promo.description,
                type: promo.type,
                discount_value: promo.discount_value,
                discount_type: promo.discount_type,
                start_date: promo.start_date,
                end_date: promo.end_date,
                priority: promo.priority,
                status: promo.status,
                // Don't expose sensitive fields like budget, max_redemptions, etc.
            }))
                .sort((a, b) => {
                // Sort by priority (lower number = higher priority) then by discount value
                if (a.priority !== b.priority) {
                    return (a.priority || 999) - (b.priority || 999);
                }
                return (b.discount_value || 0) - (a.discount_value || 0);
            });
            logger.info({
                totalPromotions: promotions.length,
                publicPromotions: publicPromotions.length,
                channel: options.channel,
                geo: options.geo
            }, 'Public promotions retrieved for guest users');
            return publicPromotions;
        }
        catch (error) {
            logger.error({ error, options }, 'Error getting public promotions for guest users');
            throw error;
        }
    }
    // Get personalized promotions for identified users
    async getIdentifiedUserPromotions(options) {
        try {
            logger.info({ options }, 'Getting personalized promotions for identified user');
            const currentDate = options.currentDate || new Date().toISOString();
            // Convert geo code to timezone
            const timezone = getTimezoneFromGeo(options.geo);
            logger.info({ geo: options.geo, timezone }, 'Geo to timezone mapping');
            // Get user segments for personalized targeting
            const userSegments = await this.getUserSegments(options.userId);
            // Build filters with date constraints
            const filters = {
                status: 'active',
                timezone: timezone // Filter by timezone
            };
            // Add date filtering
            if (currentDate) {
                // Convert currentDate to Unix timestamp for comparison
                const currentTimestamp = this.convertDateToUnixTimestamp(currentDate);
                filters.start_date_lte = currentTimestamp.toString();
                filters.end_date_gte = currentTimestamp.toString();
            }
            const { data: promotions } = await dynamicFindManyWithFilters('promotions', filters, {
                skip: 0,
                take: options.limit,
                useAllColumns: true
            });
            // Filter promotions based on user segments and visibility
            const personalizedPromotions = promotions
                .filter((promo) => {
                return this.isPromotionCurrentlyActive(promo);
            })
                .filter((promo) => {
                return this.isPromotionApplicableToUser(promo, userSegments);
            })
                .map((promo) => this.formatPromotionForDisplay(promo))
                .sort((a, b) => {
                return (a.priority || 999) - (b.priority || 999);
            });
            logger.info({
                userId: options.userId,
                totalPromotions: promotions.length,
                personalizedPromotions: personalizedPromotions.length,
                userSegments
            }, 'Personalized promotions retrieved for identified user');
            return personalizedPromotions;
        }
        catch (error) {
            logger.error({ error, options }, 'Error getting personalized promotions');
            throw error;
        }
    }
    // Get user segments for personalization
    async getUserSegments(userId) {
        try {
            const user = await this.prisma.users.findUnique({
                where: { id: parseInt(userId) },
                select: {
                    id: true,
                    createddate: true,
                    firstname: true,
                    usermobilenumber: true
                }
            });
            if (!user) {
                return ['guest'];
            }
            const segments = ['authenticated_user'];
            // Check if new user (created within configured days)
            const daysSinceCreation = Math.floor((Date.now() - Number(user.createddate)) / (1000 * 60 * 60 * 24));
            if (daysSinceCreation <= USER_SEGMENT_CONFIG.NEW_USER_DAYS) {
                segments.push('new_user');
            }
            // Check order count
            const orderCount = await this.getUserOrderCount(userId);
            if (orderCount === 0) {
                segments.push('first_order');
            }
            logger.info({ userId, segments }, 'User segments determined');
            return segments;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error getting user segments');
            return ['authenticated_user'];
        }
    }
    // Check if promotion is currently active
    isPromotionCurrentlyActive(promotion) {
        const now = new Date();
        const startDate = this.convertUnixTimestampToDate(promotion.start_date);
        const endDate = this.convertUnixTimestampToDate(promotion.end_date);
        if (startDate && startDate > now)
            return false;
        if (endDate && endDate < now)
            return false;
        return true;
    }
    // Check if promotion is applicable to user
    isPromotionApplicableToUser(promotion, userSegments) {
        // If no conditions, check if it's public or hhaas user-specific targeting
        if (!promotion.conditions || promotion.conditions.length === 0) {
            // For identified users, show both public and private promotions without conditions
            return true;
        }
        const conditions = Array.isArray(promotion.conditions) ?
            promotion.conditions : JSON.parse(promotion.conditions);
        return conditions.every((condition) => {
            return this.evaluateCondition(condition, userSegments);
        });
    }
    // Evaluate individual condition
    evaluateCondition(condition, userSegments) {
        switch (condition.attribute) {
            case 'user.segment':
                return condition.value.some((segment) => userSegments.includes(segment));
            case 'user.created_date':
                return true; // Simplified for now
            case 'user.order_count':
                return true; // Simplified for now
            default:
                return true;
        }
    }
    async findMany(filters, page, limit, adminMode = false) {
        try {
            logger.info({ filters, page, limit, adminMode }, 'Starting dynamic promotions findMany with filters');
            // Handle userid filtering for personalized promotions
            const { userid, channel = 'web', geo = 'IN', current_date, ...otherFilters } = filters;
            // Convert geo code to timezone
            const geoString = Array.isArray(geo) ? (geo[0] || 'IN') : (geo || 'IN');
            const timezone = getTimezoneFromGeo(geoString);
            let baseFilters;
            if (adminMode && Object.keys(otherFilters).length === 0) {
                // Admin mode with no filters - get ALL promotions
                logger.info('Admin mode: Getting all promotions without default filters');
                baseFilters = {};
            }
            else {
                // Build base filters (existing behavior for e-commerce app)
                baseFilters = {
                    status: 'active',
                    timezone: timezone,
                    ...otherFilters
                };
            }
            // Add date filtering if current_date provided
            if (current_date) {
                // Convert current_date to Unix timestamp for comparison
                const dateString = Array.isArray(current_date) ? current_date[0] : current_date;
                if (dateString) {
                    const currentTimestamp = this.convertDateToUnixTimestamp(dateString);
                    baseFilters.start_date_lte = currentTimestamp.toString();
                    baseFilters.end_date_gte = currentTimestamp.toString();
                }
            }
            let finalPromotions = [];
            let total = 0;
            if (adminMode && Object.keys(otherFilters).length === 0) {
                // Admin mode with no filters - get ALL promotions
                logger.info('Admin mode: Getting all promotions for admin portal');
                const { data: allPromotions, total: promotionTotal } = await dynamicFindManyWithFilters('promotions', baseFilters, {
                    skip: (page - 1) * limit,
                    take: limit,
                    useAllColumns: true
                });
                // Format and sort all promotions (active first, then by priority)
                finalPromotions = allPromotions
                    .map((promo) => this.formatPromotionForDisplay(promo))
                    .sort((a, b) => {
                    // Active promotions first
                    if (a.status !== b.status) {
                        const statusOrder = { 'active': 0, 'draft': 1, 'expired': 2, 'inactive': 3 };
                        return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
                    }
                    // Then by priority
                    return (a.priority || 999) - (b.priority || 999);
                });
                total = promotionTotal;
                logger.info({
                    totalPromotions: promotionTotal,
                    returnedPromotions: finalPromotions.length,
                    adminMode: true
                }, 'All promotions retrieved for admin portal');
            }
            else if (userid) {
                // Identified user - get personalized promotions
                logger.info({ userid }, 'Getting personalized promotions for identified user');
                // Get user segments for personalization
                const userIdString = Array.isArray(userid) ? (userid[0] || '') : (userid || '');
                const userSegments = await this.getUserSegments(userIdString);
                // Get all active promotions (both public and private)
                const { data: allPromotions } = await dynamicFindManyWithFilters('promotions', baseFilters, {
                    skip: 0,
                    take: 1000, // Get more to filter by user segments
                    useAllColumns: true
                });
                // Filter promotions based on user segments and visibility
                const personalizedPromotions = allPromotions
                    .filter((promo) => this.isPromotionCurrentlyActive(promo))
                    .filter((promo) => {
                    // For identified users, show:
                    // 1. All promotions (since visibility is mostly null in current data)
                    // 2. Filter by user segments for personalized targeting
                    return this.isPromotionApplicableToUser(promo, userSegments);
                })
                    .map((promo) => this.formatPromotionForDisplay(promo))
                    .sort((a, b) => (a.priority || 999) - (b.priority || 999));
                finalPromotions = personalizedPromotions.slice(0, limit);
                total = personalizedPromotions.length;
                logger.info({
                    userid,
                    totalPromotions: allPromotions.length,
                    personalizedPromotions: finalPromotions.length,
                    userSegments
                }, 'Personalized promotions retrieved for identified user');
            }
            else {
                // Guest user - get ONLY public promotions
                logger.info('Getting public promotions for guest user');
                const publicFilters = {
                    ...baseFilters,
                    visibility: 'public'
                };
                const { data: promotions, total: promotionTotal } = await dynamicFindManyWithFilters('promotions', publicFilters, {
                    skip: 0,
                    take: limit,
                    useAllColumns: true
                });
                // Filter and format promotions for guest users
                finalPromotions = promotions
                    .filter((promo) => this.isPromotionCurrentlyActive(promo))
                    .map((promo) => this.formatPromotionForDisplay(promo)) // Use the same formatting method
                    .sort((a, b) => {
                    // Sort by priority (lower number = higher priority) then by discount value
                    if (a.priority !== b.priority) {
                        return (a.priority || 999) - (b.priority || 999);
                    }
                    return (b.discount_value || 0) - (a.discount_value || 0);
                });
                total = finalPromotions.length;
                logger.info({
                    totalPromotions: promotions.length,
                    publicPromotions: finalPromotions.length,
                    channel,
                    geo
                }, 'Public promotions retrieved for guest user');
            }
            logger.info({
                promotionsCount: finalPromotions.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                userType: userid ? 'identified' : 'guest'
            }, 'Dynamic promotions findMany with filters completed');
            return createPaginationResult(finalPromotions, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic promotions findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ promotionId: id }, 'Starting dynamic promotion findById operation');
            const promotion = await dynamicFindUnique('promotions', { id: parseInt(id) });
            if (!promotion) {
                throw new Error('Promotion not found');
            }
            logger.debug({
                promotionId: id,
                availableFields: Object.keys(promotion)
            }, 'Dynamic promotion findById completed');
            return promotion;
        }
        catch (error) {
            logger.error({ error, promotionId: id }, 'Error in promotion findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ data }, 'Starting dynamic promotion create operation');
            // Transform frontend data structure to backend format
            const transformedData = this.transformFrontendDataToBackend(data);
            // Add timestamps
            const promotionData = {
                ...transformedData,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const promotion = await dynamicCreate('promotions', promotionData);
            if (!promotion) {
                throw new Error('Failed to create promotion - no valid fields provided');
            }
            logger.info({
                promotionId: promotion.id,
                availableFields: Object.keys(promotion)
            }, 'Dynamic promotion create completed');
            return promotion;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in promotion create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            logger.debug({ promotionId: id, data }, 'Starting dynamic promotion update operation');
            // Transform frontend data structure to backend format
            const transformedData = this.transformFrontendDataToBackend(data);
            // Add modified timestamp
            const updateData = {
                ...transformedData,
                modifieddate: Date.now()
            };
            const promotion = await dynamicUpdate('promotions', { id: parseInt(id) }, updateData);
            if (!promotion) {
                throw new Error('Promotion not found or update failed');
            }
            logger.info({
                promotionId: id,
                availableFields: Object.keys(promotion)
            }, 'Dynamic promotion update completed');
            return promotion;
        }
        catch (error) {
            logger.error({ error, promotionId: id, data }, 'Error in promotion update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            logger.debug({ promotionId: id }, 'Starting promotion delete operation');
            const success = await dynamicDelete('promotions', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete promotion');
            }
            logger.info({ promotionId: id }, 'Promotion delete completed');
            return success;
        }
        catch (error) {
            logger.error({ error, promotionId: id }, 'Error in promotion delete operation');
            throw error;
        }
    }
    // Calculate potential discount for recommendation
    calculatePotentialDiscount(promotion, cartInfo) {
        let discountAmount = 0;
        let discountPercentage = 0;
        let savingsAmount = 0;
        // Get discount value from either discount_value field or action object
        const getDiscountValue = () => {
            if (promotion.discount_value !== null && promotion.discount_value !== undefined) {
                return promotion.discount_value;
            }
            if (promotion.action && promotion.action.value !== null && promotion.action.value !== undefined) {
                return promotion.action.value;
            }
            return 0;
        };
        const discountValue = getDiscountValue();
        switch (promotion.type) {
            case 'FIXED_AMOUNT_OFF_CART':
                discountAmount = Math.min(discountValue, cartInfo.total);
                discountPercentage = cartInfo.total > 0 ? (discountAmount / cartInfo.total) * 100 : 0;
                savingsAmount = discountAmount;
                break;
            case 'PERCENT_OFF_CART':
                const percentage = discountValue / 100;
                discountAmount = cartInfo.total * percentage;
                // Apply max_discount cap if specified in action
                if (promotion.action && promotion.action.max_discount) {
                    discountAmount = Math.min(discountAmount, promotion.action.max_discount);
                }
                discountPercentage = discountValue;
                savingsAmount = discountAmount;
                break;
            case 'FREE_SHIPPING':
                // Assume shipping cost is 50 for now - this should be calculated properly
                const shippingCost = 50;
                discountAmount = shippingCost;
                discountPercentage = cartInfo.total > 0 ? (shippingCost / cartInfo.total) * 100 : 0;
                savingsAmount = shippingCost;
                break;
            case 'FIXED_AMOUNT_OFF_ITEM':
                // Apply to eligible items
                for (const item of cartInfo.items) {
                    if (this.isItemEligibleForRecommendation(item, promotion)) {
                        const itemDiscount = Math.min(discountValue, item.price * item.qty);
                        discountAmount += itemDiscount;
                    }
                }
                discountPercentage = cartInfo.total > 0 ? (discountAmount / cartInfo.total) * 100 : 0;
                savingsAmount = discountAmount;
                break;
            case 'PERCENT_OFF_ITEM':
                // Apply percentage to eligible items
                let totalItemDiscount = 0;
                for (const item of cartInfo.items) {
                    if (this.isItemEligibleForRecommendation(item, promotion)) {
                        const percentage = discountValue / 100;
                        const itemDiscount = (item.price * item.qty) * percentage;
                        totalItemDiscount += itemDiscount;
                    }
                }
                // Apply max_discount cap at promotion level (not per item)
                if (promotion.action && promotion.action.max_discount) {
                    discountAmount = Math.min(totalItemDiscount, promotion.action.max_discount);
                }
                else {
                    discountAmount = totalItemDiscount;
                }
                discountPercentage = discountValue;
                savingsAmount = discountAmount;
                break;
            case 'BOGO':
                // Buy One Get One Free logic
                for (const item of cartInfo.items) {
                    if (this.isItemEligibleForRecommendation(item, promotion) && item.qty >= 2) {
                        const freeItems = Math.floor(item.qty / 2);
                        const itemDiscount = freeItems * item.price;
                        discountAmount += itemDiscount;
                    }
                }
                discountPercentage = cartInfo.total > 0 ? (discountAmount / cartInfo.total) * 100 : 0;
                savingsAmount = discountAmount;
                break;
            case 'FREE_PRODUCT':
                // Free product logic - free gifts don't reduce cart total
                // They provide additional value without discounting existing items
                discountAmount = 0; // No monetary discount on cart
                discountPercentage = 0;
                savingsAmount = 0;
                // Note: The free product value should be communicated separately to frontend
                // via action.free_product_id and product lookup
                break;
        }
        return {
            discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
            discountPercentage: Math.round(discountPercentage * 100) / 100,
            savingsAmount: Math.round(savingsAmount * 100) / 100
        };
    }
    // Check if item is eligible for recommendation
    isItemEligibleForRecommendation(item, promotion) {
        // Check promotion conditions to determine if item is eligible
        if (!promotion.conditions)
            return true;
        try {
            const conditions = Array.isArray(promotion.conditions) ?
                promotion.conditions : JSON.parse(promotion.conditions);
            for (const condition of conditions) {
                switch (condition.attribute) {
                    case 'cart.items.category':
                        if (condition.operator === 'IN') {
                            if (!condition.value.includes(item.category)) {
                                return false;
                            }
                        }
                        break;
                    case 'cart.category':
                        if (condition.operator === 'IN') {
                            if (!condition.value.includes(item.category)) {
                                return false;
                            }
                        }
                        break;
                    case 'product.id':
                        if (condition.operator === 'IN') {
                            if (!condition.value.includes(item.productId)) {
                                return false;
                            }
                        }
                        break;
                    // Add more item-level conditions as needed
                }
            }
            return true;
        }
        catch (error) {
            logger.warn({ error, promotionId: promotion.id }, 'Error checking item eligibility for recommendation');
            return false;
        }
    }
    // Helper methods for condition evaluation
    evaluateNumericCondition(condition, value) {
        // Convert condition value to number if it's a string
        const conditionValue = typeof condition.value === 'string' ?
            parseFloat(condition.value) : condition.value;
        if (isNaN(conditionValue)) {
            logger.warn({ condition, value }, 'Invalid numeric condition value');
            return false;
        }
        switch (condition.operator) {
            case 'GTE': return value >= conditionValue;
            case 'LTE': return value <= conditionValue;
            case 'EQ': return value === conditionValue;
            case 'GT': return value > conditionValue;
            case 'LT': return value < conditionValue;
            default:
                logger.warn({ operator: condition.operator }, 'Unknown numeric condition operator');
                return false;
        }
    }
    evaluateDateCondition(condition, date) {
        try {
            const { operator, value, comparison, compare_with } = condition;
            switch (operator) {
                case 'DATE_ADD_DAYS':
                    // Handle DATE_ADD_DAYS: Add specified days to user's created date
                    const targetDate = new Date(date.getTime() + (value * 24 * 60 * 60 * 1000));
                    const currentDate = new Date();
                    switch (comparison) {
                        case 'GTE': // Greater than or equal
                            return currentDate >= targetDate;
                        case 'GT': // Greater than
                            return currentDate > targetDate;
                        case 'LTE': // Less than or equal
                            return currentDate <= targetDate;
                        case 'LT': // Less than
                            return currentDate < targetDate;
                        case 'EQ': // Equal
                            return Math.abs(currentDate.getTime() - targetDate.getTime()) < (24 * 60 * 60 * 1000); // Within 1 day
                        default:
                            logger.warn({ operator, comparison }, 'Unknown date comparison operator');
                            return false;
                    }
                case 'DATE_SUBTRACT_DAYS':
                    // Handle DATE_SUBTRACT_DAYS: Subtract specified days from current date
                    const referenceDate = new Date(Date.now() - (value * 24 * 60 * 60 * 1000));
                    switch (comparison) {
                        case 'GTE': // User created date >= reference date (user is newer than X days ago)
                            return date >= referenceDate;
                        case 'GT': // User created date > reference date
                            return date > referenceDate;
                        case 'LTE': // User created date <= reference date (user is older than X days ago)
                            return date <= referenceDate;
                        case 'LT': // User created date < reference date
                            return date < referenceDate;
                        case 'EQ': // User created date equals reference date (within 1 day)
                            return Math.abs(date.getTime() - referenceDate.getTime()) < (24 * 60 * 60 * 1000);
                        default:
                            logger.warn({ operator, comparison }, 'Unknown date comparison operator');
                            return false;
                    }
                case 'GTE':
                case 'GT':
                case 'LTE':
                case 'LT':
                case 'EQ':
                    // Direct date comparison
                    const compareDate = new Date(value);
                    if (isNaN(compareDate.getTime())) {
                        logger.warn({ value }, 'Invalid date value for comparison');
                        return false;
                    }
                    switch (operator) {
                        case 'GTE':
                            return date >= compareDate;
                        case 'GT':
                            return date > compareDate;
                        case 'LTE':
                            return date <= compareDate;
                        case 'LT':
                            return date < compareDate;
                        case 'EQ':
                            return Math.abs(date.getTime() - compareDate.getTime()) < (24 * 60 * 60 * 1000);
                        default:
                            return false;
                    }
                default:
                    logger.warn({ operator }, 'Unknown date condition operator');
                    return false;
            }
        }
        catch (error) {
            logger.error({ error, condition }, 'Error evaluating date condition');
            return false;
        }
    }
    // Database helper methods
    async getUserCreatedDate(userId) {
        try {
            const user = await this.prisma.users.findUnique({
                where: { id: parseInt(userId) },
                select: { createddate: true }
            });
            return user?.createddate ? new Date(Number(user.createddate)) : null;
        }
        catch (error) {
            logger.warn({ error, userId }, 'Error getting user created date');
            return null;
        }
    }
    async getUserOrderCount(userId) {
        try {
            const count = await this.prisma.orders.count({
                where: { userid: parseInt(userId) }
            });
            return count;
        }
        catch (error) {
            logger.warn({ error, userId }, 'Error getting user order count');
            return 0;
        }
    }
    // Format promotion for display
    formatPromotionForDisplay(promotion) {
        return {
            id: promotion.id,
            name: promotion.name,
            description: promotion.description,
            type: promotion.type,
            code: promotion.code,
            auto_apply: promotion.auto_apply,
            start_date: promotion.start_date, // Keep as Unix timestamp for API consistency
            end_date: promotion.end_date, // Keep as Unix timestamp for API consistency
            status: promotion.status,
            priority: promotion.priority,
            visibility: promotion.visibility,
            max_redemptions: promotion.max_redemptions,
            per_user_limit: promotion.per_user_limit,
            stackable: promotion.stackable,
            budget: promotion.budget,
            timezone: promotion.timezone,
            evaluation_expiry_minutes: promotion.evaluation_expiry_minutes,
            discount_type: promotion.discount_type,
            discount_value: promotion.discount_value,
            conditions: promotion.conditions,
            action: promotion.action,
            createddate: promotion.createddate,
            modifieddate: promotion.modifieddate
        };
    }
    // Get unified promotion offers (best recommendation + all eligible/ineligible)
    async getUnifiedPromotionOffers(request) {
        // Check for existing active evaluation to determine promotion states
        const activeEvaluation = await this.prisma.promotion_evaluations.findFirst({
            where: {
                user_id: request.userId,
                status: 'active'
            },
            orderBy: { created_at: 'desc' }
        });
        let alreadyAppliedPromotionIds = [];
        let appliedPromotionDetails = [];
        if (activeEvaluation?.applied_promotions) {
            const appliedPromotions = Array.isArray(activeEvaluation.applied_promotions)
                ? activeEvaluation.applied_promotions
                : JSON.parse(activeEvaluation.applied_promotions);
            alreadyAppliedPromotionIds = appliedPromotions.map((p) => p.promotion_id);
            appliedPromotionDetails = appliedPromotions;
        }
        try {
            logger.info({
                userId: request.userId,
                cartItemsCount: request.cartItems.length,
                mode: request.mode
            }, 'Getting eligible and ineligible promotions');
            // Calculate cart totals
            const cartTotal = request.cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const categories = [...new Set(request.cartItems.map(item => item.category).filter(Boolean))];
            const itemCount = request.cartItems.reduce((sum, item) => sum + item.qty, 0);
            logger.info({
                cartTotal,
                categories,
                itemCount
            }, 'Cart analysis completed');
            // Get all active promotions
            const filters = {
                status: 'active'
            };
            const { data: allPromotions } = await dynamicFindManyWithFilters('promotions', filters, {
                skip: 0,
                take: 100, // Get more promotions to evaluate
                useAllColumns: true
            });
            logger.info(allPromotions, "allPromotions");
            logger.info({ totalPromotions: allPromotions.length }, 'Retrieved active promotions');
            // Evaluate each promotion against the cart
            const eligibleCoupons = [];
            const ineligibleCoupons = [];
            const now = new Date();
            for (const promotion of allPromotions) {
                try {
                    // Check if promotion is currently active
                    const startDate = this.convertUnixTimestampToDate(promotion.start_date);
                    const endDate = this.convertUnixTimestampToDate(promotion.end_date);
                    if (startDate && startDate > now) {
                        const promotionData = this.formatPromotionForDisplay(promotion);
                        ineligibleCoupons.push({
                            ...promotionData,
                            promotion_id: promotionData.id, // Add promotion_id for API schema compatibility
                            ineligibleReason: 'Promotion has not started yet',
                            ineligibleDetails: {
                                startDate: startDate ? startDate.toISOString() : null,
                                currentDate: now.toISOString()
                            }
                        });
                        continue;
                    }
                    if (endDate && endDate < now) {
                        const promotionData = this.formatPromotionForDisplay(promotion);
                        ineligibleCoupons.push({
                            ...promotionData,
                            promotion_id: promotionData.id, // Add promotion_id for API schema compatibility
                            ineligibleReason: 'Promotion has expired',
                            ineligibleDetails: {
                                endDate: endDate ? endDate.toISOString() : null,
                                currentDate: now.toISOString()
                            }
                        });
                        continue;
                    }
                    // Check user eligibility if user_id provided
                    let userEligible = true;
                    let userIneligibleReason = '';
                    if (request.userId && promotion.conditions) {
                        const userEligibilityResult = await this.checkUserEligibilityForEligible(promotion, request.userId);
                        userEligible = userEligibilityResult.isEligible;
                        userIneligibleReason = userEligibilityResult.reason;
                    }
                    // Check cart eligibility
                    const cartEligibilityResult = this.checkCartEligibilityForEligible(promotion, {
                        total: cartTotal,
                        categories,
                        itemCount,
                        items: request.cartItems
                    });
                    // Check if promotion is already applied
                    const isAlreadyApplied = alreadyAppliedPromotionIds.includes(promotion.id);
                    if (isAlreadyApplied) {
                        // Skip already applied promotions from regular categorization
                        // They will be handled separately in the response
                        continue;
                    }
                    // If either user or cart is ineligible, add to ineligible
                    if (!userEligible || !cartEligibilityResult.isEligible) {
                        const promotionData = this.formatPromotionForDisplay(promotion);
                        ineligibleCoupons.push({
                            ...promotionData,
                            promotion_id: promotionData.id, // Add promotion_id for API schema compatibility
                            ineligibleReason: userIneligibleReason || cartEligibilityResult.reason,
                            ineligibleDetails: {
                                userEligible,
                                cartEligible: cartEligibilityResult.isEligible,
                                userReason: userIneligibleReason,
                                cartReason: cartEligibilityResult.reason
                            }
                        });
                        continue;
                    }
                    // Calculate potential discount
                    const discountInfo = this.calculatePotentialDiscount(promotion, {
                        total: cartTotal,
                        items: request.cartItems,
                        mode: request.mode
                    });
                    // FREE_PRODUCT promotions are eligible even with 0 discount (they provide free gifts)
                    const isFreeProduct = promotion.type === 'FREE_PRODUCT';
                    if (discountInfo.discountAmount > 0 || isFreeProduct) {
                        const promotionData = this.formatPromotionForDisplay(promotion);
                        eligibleCoupons.push({
                            ...promotionData,
                            promotion_id: promotionData.id, // Add promotion_id for API schema compatibility
                            discountInfo: {
                                originalTotal: cartTotal,
                                discountAmount: discountInfo.discountAmount,
                                discountedTotal: cartTotal - discountInfo.discountAmount,
                                discountPercentage: discountInfo.discountPercentage,
                                savingsAmount: discountInfo.savingsAmount
                            },
                            cartInfo: {
                                totalItems: itemCount,
                                categories: categories,
                                totalValue: cartTotal
                            },
                            mode: request.mode,
                            expiresAt: promotion.end_date ? this.convertUnixTimestampToDateString(promotion.end_date) : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                        });
                    }
                    else {
                        const promotionData = this.formatPromotionForDisplay(promotion);
                        ineligibleCoupons.push({
                            ...promotionData,
                            promotion_id: promotionData.id, // Add promotion_id for API schema compatibility
                            ineligibleReason: 'No discount applicable to current cart',
                            ineligibleDetails: {
                                cartTotal,
                                discountAmount: discountInfo.discountAmount
                            }
                        });
                    }
                }
                catch (error) {
                    logger.warn({ error, promotionId: promotion.id }, 'Error evaluating promotion for eligibility');
                    const promotionData = this.formatPromotionForDisplay(promotion);
                    ineligibleCoupons.push({
                        ...promotionData,
                        promotion_id: promotionData.id, // Add promotion_id for API schema compatibility
                        ineligibleReason: 'Error evaluating promotion',
                        ineligibleDetails: {
                            error: error instanceof Error ? error.message : 'Unknown error'
                        }
                    });
                }
            }
            // Sort eligible coupons by best value
            eligibleCoupons.sort((a, b) => {
                // Primary sort: by actual discount amount
                if (a.discountInfo.discountAmount !== b.discountInfo.discountAmount) {
                    return b.discountInfo.discountAmount - a.discountInfo.discountAmount;
                }
                // Secondary sort: by priority (lower number = higher priority)
                if (a.priority !== b.priority) {
                    return (a.priority || 999) - (b.priority || 999);
                }
                // Tertiary sort: by discount percentage
                return b.discountInfo.discountPercentage - a.discountInfo.discountPercentage;
            });
            // Get auto-applied promotions from user's active evaluation record (not live calculation)
            const autoAppliedFromEvaluation = await this.getAutoAppliedPromotionsFromEvaluation(request.userId);
            // Fetch full promotion details for auto-applied promotions
            const autoAppliedPromotions = [];
            for (const evalPromo of autoAppliedFromEvaluation) {
                try {
                    // Get full promotion details from database
                    const fullPromotion = await this.findById(evalPromo.promotion_id.toString());
                    if (fullPromotion) {
                        const promotionData = this.formatPromotionForDisplay(fullPromotion);
                        autoAppliedPromotions.push({
                            ...promotionData,
                            promotion_id: promotionData.id,
                            discountInfo: {
                                originalTotal: cartTotal,
                                discountAmount: evalPromo.discount_amount || 0,
                                discountedTotal: cartTotal - (evalPromo.discount_amount || 0),
                                discountPercentage: cartTotal > 0 ? ((evalPromo.discount_amount || 0) / cartTotal) * 100 : 0,
                                savingsAmount: evalPromo.discount_amount || 0
                            },
                            cartInfo: {
                                totalItems: itemCount,
                                categories: categories,
                                totalValue: cartTotal
                            },
                            mode: request.mode,
                            expiresAt: fullPromotion.end_date ? this.convertUnixTimestampToDateString(fullPromotion.end_date) : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                        });
                    }
                }
                catch (error) {
                    logger.warn({ error, promotionId: evalPromo.promotion_id }, 'Error fetching full promotion details for auto-applied promotion');
                }
            }
            const autoAppliedIds = autoAppliedPromotions.map(promo => promo.promotion_id);
            // Remove auto-applied promotions from eligible coupons (they shouldn't be offered as choices)
            // Also remove any promotions that are already applied in the evaluation
            const manualEligibleCoupons = eligibleCoupons.filter(promo => promo.auto_apply !== true && !autoAppliedIds.includes(promo.id));
            // Get the best coupon from manual coupons only (auto-applied are already applied)
            // const bestCoupon = manualEligibleCoupons.length > 0 ? manualEligibleCoupons[0] : null;
            // ✅ FIXED: Create separate lists for UI that include applied promotions with proper states
            // For bestCoupon: Include all eligible promotions (including applied ones) with state indicators
            const allEligibleForUI = [...manualEligibleCoupons];
            // Add applied promotions back with 'applied' state for UI
            if (activeEvaluation && appliedPromotionDetails.length > 0) {
                for (const appliedPromo of appliedPromotionDetails) {
                    // Find the original promotion data
                    const originalPromo = allPromotions.find(p => p.id === appliedPromo.promotion_id);
                    if (originalPromo && !appliedPromo.is_auto) {
                        // Add applied manual promotion with state indicator
                        const promotionData = this.formatPromotionForDisplay(originalPromo);
                        allEligibleForUI.push({
                            ...promotionData,
                            promotion_id: promotionData.id,
                            promotionState: 'applied', // ✅ NEW: State indicator for frontend
                            evaluation_id: activeEvaluation.evaluation_id, // ✅ For remove operations
                            applied_discount: appliedPromo.discount_amount
                        });
                    }
                }
            }
            // Sort by best value for user (prioritize actual savings, then priority)
            allEligibleForUI.sort((a, b) => {
                // For applied promotions, use applied_discount; for available ones, use potential discount
                const aDiscount = a.applied_discount || a.discountInfo?.discountAmount || 0;
                const bDiscount = b.applied_discount || b.discountInfo?.discountAmount || 0;
                // Primary sort: by actual discount amount (higher discount = better)
                if (aDiscount !== bDiscount) {
                    return bDiscount - aDiscount;
                }
                // Secondary sort: by priority (lower number = higher priority)
                return (a.priority || 999) - (b.priority || 999);
            });
            const bestCoupon = allEligibleForUI.length > 0 ? allEligibleForUI[0] : null;
            // Stackable promotions that user can ADD (exclude auto-applied ones)
            // const stackablePromotions = manualEligibleCoupons.filter(promo => 
            // For stackablePromotions: Include stackable promotions (both available and applied)
            const stackablePromotions = allEligibleForUI.filter(promo => promo.stackable === true);
            logger.info({
                totalEligibleCount: eligibleCoupons.length,
                manualEligibleCount: manualEligibleCoupons.length,
                autoAppliedCount: autoAppliedPromotions.length,
                ineligibleCount: ineligibleCoupons.length,
                hasBestCoupon: !!bestCoupon
            }, 'Unified promotion offers evaluation completed');
            return {
                bestCoupon,
                eligibleCoupons: manualEligibleCoupons, // ✅ Only manual coupons, not auto-applied
                ineligibleCoupons,
                stackablePromotions,
                autoAppliedPromotions, // ✅ Auto-applied promotions separate
                currentEvaluation: activeEvaluation ? {
                    evaluation_id: activeEvaluation.evaluation_id,
                    original_total: activeEvaluation.original_total,
                    discounted_total: activeEvaluation.discounted_total,
                    applied_promotions: appliedPromotionDetails // ✅ Enhanced applied promotions with new fields
                } : null,
                summary: {
                    totalPromotions: allPromotions.length,
                    eligibleCount: manualEligibleCoupons.length, // ✅ Count manual coupons only
                    ineligibleCount: ineligibleCoupons.length,
                    stackableCount: stackablePromotions.length,
                    autoAppliedCount: autoAppliedPromotions.length,
                    appliedCount: appliedPromotionDetails.length, // ✅ Applied promotions count
                    hasActiveEvaluation: !!activeEvaluation, // ✅ Evaluation state flag
                    cartTotal,
                    cartItems: itemCount,
                    categories: categories
                }
            };
        }
        catch (error) {
            logger.error({ error, request }, 'Error getting eligible promotions');
            throw error;
        }
    }
    // Check user eligibility for eligible promotions (with detailed reasons)
    async checkUserEligibilityForEligible(promotion, userId) {
        if (!promotion.conditions)
            return { isEligible: true, reason: '' };
        try {
            const conditions = Array.isArray(promotion.conditions) ?
                promotion.conditions : JSON.parse(promotion.conditions);
            for (const condition of conditions) {
                switch (condition.attribute) {
                    case 'user.segment':
                        const userSegments = await this.getUserSegments(userId);
                        if (!condition.value.some((segment) => userSegments.includes(segment))) {
                            return {
                                isEligible: false,
                                reason: `User segment not eligible. Required: ${condition.value.join(', ')}, Current: ${userSegments.join(', ')}`
                            };
                        }
                        break;
                    case 'user.created_date':
                        const userCreatedDate = await this.getUserCreatedDate(userId);
                        if (userCreatedDate && !this.evaluateDateCondition(condition, userCreatedDate)) {
                            return {
                                isEligible: false,
                                reason: `User creation date not eligible. Required: ${condition.value}, Current: ${userCreatedDate.toISOString()}`
                            };
                        }
                        break;
                    case 'user.order_count':
                        const orderCount = await this.getUserOrderCount(userId);
                        if (!this.evaluateNumericCondition(condition, orderCount)) {
                            return {
                                isEligible: false,
                                reason: `User order count not eligible. Required: ${condition.operator} ${condition.value}, Current: ${orderCount}`
                            };
                        }
                        break;
                }
            }
            return { isEligible: true, reason: '' };
        }
        catch (error) {
            logger.warn({ error, promotionId: promotion.id, userId }, 'Error checking user eligibility');
            return {
                isEligible: false,
                reason: `Error checking user eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    // Check cart eligibility for eligible promotions (with detailed reasons)
    checkCartEligibilityForEligible(promotion, cartInfo) {
        if (!promotion.conditions)
            return { isEligible: true, reason: '' };
        try {
            const conditions = Array.isArray(promotion.conditions) ?
                promotion.conditions : JSON.parse(promotion.conditions);
            for (const condition of conditions) {
                switch (condition.attribute) {
                    case 'cart.total_value':
                        if (!this.evaluateNumericCondition(condition, cartInfo.total)) {
                            return {
                                isEligible: false,
                                reason: `Cart total value not eligible. Required: ${condition.operator} ${condition.value}, Current: ${cartInfo.total}`
                            };
                        }
                        break;
                    case 'cart.item_count':
                        if (!this.evaluateNumericCondition(condition, cartInfo.itemCount)) {
                            return {
                                isEligible: false,
                                reason: `Cart item count not eligible. Required: ${condition.operator} ${condition.value}, Current: ${cartInfo.itemCount}`
                            };
                        }
                        break;
                    case 'cart.category':
                        if (!condition.value.some((cat) => cartInfo.categories.includes(cat))) {
                            return {
                                isEligible: false,
                                reason: `Cart category not eligible. Required: ${condition.value.join(', ')}, Current: ${cartInfo.categories.join(', ')}`
                            };
                        }
                        break;
                    case 'cart.items.category':
                        // Handle cart.items.category condition for individual item category matching
                        if (condition.operator === 'IN') {
                            // Check if any cart item has a category that matches the condition values
                            const hasMatchingCategory = cartInfo.items.some(item => condition.value.includes(item.category));
                            if (!hasMatchingCategory) {
                                return {
                                    isEligible: false,
                                    reason: `Cart items category not eligible. Required: ${condition.value.join(', ')}, Current items: ${cartInfo.items.map(item => `${item.productId}(${item.category})`).join(', ')}`
                                };
                            }
                        }
                        else {
                            // For other operators, use the aggregated categories approach
                            if (!condition.value.some((cat) => cartInfo.categories.includes(cat))) {
                                return {
                                    isEligible: false,
                                    reason: `Cart items category not eligible. Required: ${condition.value.join(', ')}, Current: ${cartInfo.categories.join(', ')}`
                                };
                            }
                        }
                        break;
                }
            }
            return { isEligible: true, reason: '' };
        }
        catch (error) {
            logger.warn({ error, promotionId: promotion.id }, 'Error checking cart eligibility');
            return {
                isEligible: false,
                reason: `Error checking cart eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
//# sourceMappingURL=promotions.service.js.map