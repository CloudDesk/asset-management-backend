import { dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { DatabaseError } from '../utils/errorHandler.js';
export class PromotionEvaluationService {
    /**
     * Main method to evaluate promotion eligibility
     * Implements the logic described in the requirements
     */
    async evaluateEligibility(data) {
        try {
            logger.info({
                user_id: data.user_id,
                cart_items: data.cart?.length || 0,
                platform: data.platform
            }, 'Starting promotion eligibility evaluation');
            // Step 1: Filter active promotions within date range
            const activePromotions = await this.getActivePromotions(data.order_date);
            if (activePromotions.length === 0) {
                logger.info('No active promotions found');
                return { eligible_promotions: [] };
            }
            // Step 2: Evaluate each promotion for eligibility
            const eligiblePromotions = [];
            for (const promotion of activePromotions) {
                try {
                    const isEligible = await this.checkPromotionEligibility(promotion, data);
                    if (isEligible) {
                        const actions = await this.getPromotionActions(promotion.id);
                        const eligiblePromotion = await this.formatEligiblePromotion(promotion, actions);
                        eligiblePromotions.push(eligiblePromotion);
                    }
                }
                catch (promotionError) {
                    logger.error({
                        error: promotionError,
                        promotion_id: promotion.id
                    }, `Error evaluating promotion ${promotion.id}`);
                    // Continue with next promotion
                    continue;
                }
            }
            // Step 3: Handle stackable logic and priority sorting
            const finalEligiblePromotions = this.handleStackableLogic(eligiblePromotions);
            logger.info({
                user_id: data.user_id,
                total_evaluated: activePromotions.length,
                eligible_count: finalEligiblePromotions.length,
                eligible_promotion_ids: finalEligiblePromotions.map(p => p.promotion_id)
            }, 'Promotion eligibility evaluation completed');
            return { eligible_promotions: finalEligiblePromotions };
        }
        catch (error) {
            logger.error({ error, data }, 'Error in promotion eligibility evaluation');
            // Provide specific error messages based on the error type
            if (error.code === 'P2025') {
                throw new DatabaseError('Failed to evaluate promotion eligibility', 'One or more referenced records not found', 404);
            }
            if (error.code === 'P2002') {
                throw new DatabaseError('Failed to evaluate promotion eligibility', 'Duplicate entry found in promotion data', 400);
            }
            if (error.code === 'P2003') {
                throw new DatabaseError('Failed to evaluate promotion eligibility', 'Invalid reference in promotion data', 400);
            }
            if (error.message.includes('validation')) {
                throw new DatabaseError('Failed to evaluate promotion eligibility', 'Invalid promotion data format', 400);
            }
            throw new DatabaseError('Failed to evaluate promotion eligibility', error.message || 'An unexpected error occurred while processing promotions', 500);
        }
    }
    /**
     * Step 1: Get active promotions within date range
     */
    async getActivePromotions(orderDate) {
        try {
            const today = orderDate ? new Date(orderDate) : new Date();
            const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            // Query active promotions with date filtering
            const { data: promotions } = await dynamicFindManyWithFilters('promotions', {
                status: 'active'
            }, {
                skip: 0,
                take: 1000, // Get all active promotions
                useAllColumns: true
            });
            // Filter by date range (since dynamic filtering might not handle date comparisons well)
            const activePromotions = promotions.filter(promotion => {
                if (!promotion.start_date && !promotion.end_date) {
                    return true; // No date restrictions
                }
                if (promotion.start_date && new Date(promotion.start_date) > today) {
                    return false; // Not started yet
                }
                if (promotion.end_date && new Date(promotion.end_date) < today) {
                    return false; // Already ended
                }
                return true;
            });
            logger.debug({
                total_promotions: promotions.length,
                active_promotions: activePromotions.length,
                filter_date: todayISO
            }, 'Filtered active promotions');
            return activePromotions;
        }
        catch (error) {
            logger.error({ error }, 'Error getting active promotions');
            return [];
        }
    }
    /**
     * Step 2: Check if a specific promotion is eligible for the given request
     */
    async checkPromotionEligibility(promotion, data) {
        try {
            // Check usage limits
            const usageLimitPassed = await this.checkUsageLimits(promotion, data.user_id);
            if (!usageLimitPassed) {
                logger.debug({ promotion_id: promotion.id }, 'Promotion failed usage limit check');
                return false;
            }
            // Check target links (user/product/category restrictions)
            const targetLinkPassed = await this.checkTargetLinks(promotion, data);
            if (!targetLinkPassed) {
                logger.debug({ promotion_id: promotion.id }, 'Promotion failed target link check');
                return false;
            }
            // Check promotion rules
            const rulesPassed = await this.checkPromotionRules(promotion, data);
            if (!rulesPassed) {
                logger.debug({ promotion_id: promotion.id }, 'Promotion failed rules check');
                return false;
            }
            logger.debug({ promotion_id: promotion.id }, 'Promotion passed all eligibility checks');
            return true;
        }
        catch (error) {
            logger.error({ error, promotion_id: promotion.id }, 'Error checking promotion eligibility');
            return false;
        }
    }
    /**
     * Check usage limits (per_user_limit and max_redemptions)
     */
    async checkUsageLimits(promotion, userId) {
        try {
            // Get usage logs for this promotion
            const { data: usageLogs } = await dynamicFindManyWithFilters('promotion_usage_log', {
                promotion_id: promotion.id.toString()
            }, {
                skip: 0,
                take: 10000, // Get all usage logs
                useAllColumns: true
            });
            // Check max_redemptions (global limit)
            if (promotion.max_redemptions && usageLogs.length >= promotion.max_redemptions) {
                logger.debug({
                    promotion_id: promotion.id,
                    current_usage: usageLogs.length,
                    max_redemptions: promotion.max_redemptions
                }, 'Promotion exceeded max redemptions');
                return false;
            }
            // Check per_user_limit
            if (promotion.per_user_limit) {
                const userUsage = usageLogs.filter(log => log.user_id === userId).length;
                if (userUsage >= promotion.per_user_limit) {
                    logger.debug({
                        promotion_id: promotion.id,
                        user_id: userId,
                        user_usage: userUsage,
                        per_user_limit: promotion.per_user_limit
                    }, 'User exceeded per-user limit for promotion');
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            logger.error({ error, promotion_id: promotion.id }, 'Error checking usage limits');
            return false;
        }
    }
    /**
     * Check target links (user_id, product_id, category restrictions)
     */
    async checkTargetLinks(promotion, data) {
        try {
            // Get target links for this promotion
            const { data: targetLinks } = await dynamicFindManyWithFilters('promotion_target_link', {
                promotion_id: promotion.id.toString(),
                is_active: 'true'
            }, {
                skip: 0,
                take: 1000,
                useAllColumns: true
            });
            // If no target links, promotion applies to everyone
            if (targetLinks.length === 0) {
                return true;
            }
            // Check if any target link matches
            for (const link of targetLinks) {
                const linkMatches = this.checkSingleTargetLink(link, data);
                if (linkMatches) {
                    return true; // At least one target link matches
                }
            }
            logger.debug({ promotion_id: promotion.id }, 'No target links matched');
            return false;
        }
        catch (error) {
            logger.error({ error, promotion_id: promotion.id }, 'Error checking target links');
            return false;
        }
    }
    /**
     * Check a single target link
     */
    checkSingleTargetLink(link, data) {
        switch (link.target_type) {
            case 'user_id':
                return link.target_id === data.user_id;
            case 'product_id':
                return Array.isArray(data.cart) && data.cart.some(item => item.product_id.toString() === link.target_id);
            case 'category':
                // Would need to fetch product details to check category
                // For now, assume it matches (implement product category lookup if needed)
                return true;
            case 'platform':
                return link.target_id === data.platform;
            default:
                logger.warn({ target_type: link.target_type }, 'Unknown target link type');
                return false;
        }
    }
    /**
     * Check promotion rules with logic_group support
     */
    async checkPromotionRules(promotion, data) {
        try {
            // Get rules for this promotion
            const { data: rules } = await dynamicFindManyWithFilters('promotion_rules', {
                promotion_id: promotion.id.toString(),
                is_active: 'true'
            }, {
                skip: 0,
                take: 1000,
                useAllColumns: true
            });
            // If no rules, promotion is eligible
            if (rules.length === 0) {
                return true;
            }
            // Group rules by logic_group
            const ruleGroups = this.groupRulesByLogicGroup(rules);
            // Evaluate each logic group (OR between groups, AND within groups)
            for (const [logicGroup, groupRules] of Object.entries(ruleGroups)) {
                const groupResult = this.evaluateRuleGroup(groupRules, data);
                if (groupResult) {
                    return true; // At least one logic group passed
                }
            }
            logger.debug({ promotion_id: promotion.id }, 'No rule groups passed');
            return false;
        }
        catch (error) {
            logger.error({ error, promotion_id: promotion.id }, 'Error checking promotion rules');
            return false;
        }
    }
    /**
     * Group rules by logic_group
     */
    groupRulesByLogicGroup(rules) {
        const groups = {};
        for (const rule of rules) {
            const group = rule.logic_group || 'default';
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(rule);
        }
        return groups;
    }
    /**
     * Evaluate a single rule group (AND logic within group)
     */
    evaluateRuleGroup(rules, data) {
        for (const rule of rules) {
            const ruleResult = this.evaluateSingleRule(rule, data);
            const finalResult = rule.exclude ? !ruleResult : ruleResult;
            if (!finalResult) {
                return false; // AND logic: all rules must pass
            }
        }
        return true; // All rules in group passed
    }
    /**
     * Evaluate a single rule
     */
    evaluateSingleRule(rule, data) {
        const { condition_key, rule_type, operator, value, value_type } = rule;
        // Convert value to appropriate type
        let comparisonValue = value;
        if (value_type === 'number' || (value && !isNaN(parseFloat(value)))) {
            comparisonValue = parseFloat(value);
        }
        else if (value_type === 'boolean') {
            comparisonValue = value.toLowerCase() === 'true';
        }
        // Use condition_key if provided, otherwise use rule_type
        const keyToEvaluate = condition_key || rule_type;
        // Get the actual value to compare against
        const actualValue = this.getConditionValue(keyToEvaluate, data);
        // Perform comparison based on operator
        return this.performComparison(actualValue, operator, comparisonValue);
    }
    /**
     * Get the actual value for a condition key
     */
    getConditionValue(conditionKey, data) {
        switch (conditionKey) {
            case 'cart_total':
                // Use cart_total if provided directly, otherwise calculate from cart items
                if ('cart_total' in data && data.cart_total !== undefined) {
                    return data.cart_total;
                }
                // Calculate from cart items if they have amount/price
                return (data.cart ?? []).reduce((sum, item) => {
                    const itemAmount = item.amount ||
                        (item.price ? Number(item.price) * item.quantity : 0);
                    return sum + (Number(itemAmount) || 0);
                }, 0);
            case 'cart_amount':
                // Use cart_total if provided directly, otherwise calculate from cart items  
                if ('cart_total' in data && data.cart_total !== undefined) {
                    return data.cart_total;
                }
                return (data.cart ?? []).reduce((sum, item) => {
                    const itemAmount = item.amount ||
                        (item.price ? Number(item.price) * item.quantity : 0);
                    return sum + (Number(itemAmount) || 0);
                }, 0);
            case 'platform':
                return data.platform;
            case 'payment_method':
                return data.payment_method || '';
            case 'product_count':
                return (data.cart ?? []).length;
            case 'total_quantity':
                return (data.cart ?? []).reduce((sum, item) => sum + item.quantity, 0);
            default:
                logger.warn({ condition_key: conditionKey }, 'Unknown condition key');
                return null;
        }
    }
    /**
     * Perform comparison based on operator
     */
    performComparison(actualValue, operator, expectedValue) {
        switch (operator) {
            case 'equals':
            case 'eq':
            case '=':
                return actualValue === expectedValue;
            case 'not_equals':
            case 'ne':
            case '!=':
                return actualValue !== expectedValue;
            case 'greater_than':
            case 'gt':
            case '>':
                return actualValue > expectedValue;
            case 'greater_than_or_equal':
            case 'gte':
            case '>=':
                return actualValue >= expectedValue;
            case 'less_than':
            case 'lt':
            case '<':
                return actualValue < expectedValue;
            case 'less_than_or_equal':
            case 'lte':
            case '<=':
                return actualValue <= expectedValue;
            case 'contains':
                return String(actualValue).includes(String(expectedValue));
            case 'in':
                const arrayValue = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
                return arrayValue.includes(actualValue);
            default:
                logger.warn({ operator }, 'Unknown operator');
                return false;
        }
    }
    /**
     * Get promotion actions sorted by action_order
     */
    async getPromotionActions(promotionId) {
        try {
            const { data: actions } = await dynamicFindManyWithFilters('promotion_actions', {
                promotion_id: promotionId.toString()
            }, {
                skip: 0,
                take: 1000,
                useAllColumns: true
            });
            // Sort by action_order
            return actions.sort((a, b) => (a.action_order || 0) - (b.action_order || 0));
        }
        catch (error) {
            logger.error({ error, promotion_id: promotionId }, 'Error getting promotion actions');
            return [];
        }
    }
    /**
     * Format eligible promotion for response
     */
    async formatEligiblePromotion(promotion, actions) {
        const formattedActions = actions.map(action => ({
            type: action.action_type || 'unknown',
            target: action.target || 'unknown',
            value: action.value || 0
        }));
        return {
            promotion_id: promotion.id,
            name: promotion.name || 'Unnamed Promotion',
            type: promotion.type || 'automatic',
            description: this.generatePromotionDescription(promotion, actions),
            stackable: promotion.stackable || false,
            actions: formattedActions
        };
    }
    /**
     * Generate description for promotion
     */
    generatePromotionDescription(promotion, actions) {
        if (actions.length === 0) {
            return promotion.name || 'Special promotion';
        }
        const action = actions[0]; // Use first action for description
        switch (action.action_type) {
            case 'flat_discount':
                return `₹${action.value} off`;
            case 'percentage_discount':
                return `${action.value}% off`;
            case 'waive_fee':
                return `₹${action.value} fee waived`;
            case 'free_product':
                return `Free product included`;
            default:
                return promotion.name || 'Special offer';
        }
    }
    /**
     * Handle stackable logic and priority sorting
     */
    handleStackableLogic(eligiblePromotions) {
        if (eligiblePromotions.length === 0) {
            return [];
        }
        // Sort by priority (assuming higher number = higher priority)
        const sortedPromotions = [...eligiblePromotions].sort((a, b) => {
            // We'd need priority from the original promotion data
            // For now, sort by promotion_id (lower ID = higher priority)
            return a.promotion_id - b.promotion_id;
        });
        // Handle stackable logic
        const result = [];
        let hasNonStackable = false;
        for (const promotion of sortedPromotions) {
            if (!promotion.stackable && hasNonStackable) {
                continue; // Skip non-stackable if we already have one
            }
            result.push(promotion);
            if (!promotion.stackable) {
                hasNonStackable = true;
            }
        }
        return result;
    }
}
//# sourceMappingURL=promotion-evaluation.service.js.map