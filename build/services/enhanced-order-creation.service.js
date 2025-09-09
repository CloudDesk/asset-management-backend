import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';
export class EnhancedOrderCreationService {
    prisma;
    constructor() {
        this.prisma = new PrismaClient();
    }
    /**
     * Enhanced order creation with comprehensive promotion tracking
     */
    async createOrderWithPromotionData(orderData, evaluationId, promotionData) {
        try {
            logger.info({
                evaluationId,
                orderData: orderData.orderid,
                promotionData: promotionData
            }, 'Creating enhanced order with promotion tracking');
            // Get evaluation data for promotion breakdown
            const evaluation = await this.prisma.promotion_evaluations.findUnique({
                where: { evaluation_id: evaluationId },
                select: {
                    evaluation_id: true,
                    original_total: true,
                    discounted_total: true,
                    applied_promotions: true,
                    cart_data: true
                }
            });
            if (!evaluation) {
                throw new Error(`Evaluation not found: ${evaluationId}`);
            }
            // Calculate promotion breakdown
            const promotionBreakdown = this.calculatePromotionBreakdown(evaluation, orderData.orderItems || []);
            // Enhanced order data with promotion tracking
            const enhancedOrderData = {
                ...orderData,
                evaluation_id: evaluationId,
                promotion_discount_total: promotionBreakdown.totalPromotionDiscount,
                original_total: evaluation.original_total,
                final_total: evaluation.discounted_total,
                promotion_breakdown: promotionBreakdown.orderLevelBreakdown
            };
            // Create the order
            const order = await this.prisma.orders.create({
                data: enhancedOrderData
            });
            // Create enhanced orderlines with promotion data
            const enhancedOrderlines = await this.createEnhancedOrderlines(order.id, evaluationId, orderData.orderItems || [], promotionBreakdown.lineLevelBreakdown);
            logger.info({
                orderId: order.id,
                evaluationId,
                totalPromotionDiscount: promotionBreakdown.totalPromotionDiscount,
                orderlinesCreated: enhancedOrderlines.length
            }, 'Enhanced order created successfully with promotion tracking');
            return {
                order,
                orderlines: enhancedOrderlines,
                promotionBreakdown
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                evaluationId,
                orderData: orderData.orderid
            }, 'Error creating enhanced order with promotion data');
            throw error;
        }
    }
    /**
     * Calculate detailed promotion breakdown for order and orderlines
     */
    calculatePromotionBreakdown(evaluation, orderItems) {
        const appliedPromotions = evaluation.applied_promotions || [];
        const originalTotal = Number(evaluation.original_total || 0);
        const discountedTotal = Number(evaluation.discounted_total || 0);
        const totalPromotionDiscount = originalTotal - discountedTotal;
        // Categorize promotions by type
        const productLevelPromotions = appliedPromotions.filter((p) => p.promotion_type?.includes('ITEM') || p.promotion_type?.includes('PRODUCT'));
        const cartLevelPromotions = appliedPromotions.filter((p) => p.promotion_type?.includes('CART') || p.promotion_type === 'FREE_SHIPPING');
        // Calculate line-level breakdown
        const lineLevelBreakdown = orderItems.map((item) => {
            const itemOriginalPrice = item.productamount || 0;
            const itemDiscount = item.discountamount || 0;
            // Find promotions that apply to this specific product
            const itemPromotions = productLevelPromotions.filter((p) => p.applied_to_products?.includes(item.productid) ||
                p.promotion_type?.includes('ITEM'));
            // Calculate promotion discount for this line
            const promotionDiscount = itemPromotions.reduce((sum, p) => sum + (p.discount_amount || 0), 0);
            return {
                productid: item.productid,
                original_price: itemOriginalPrice,
                product_discount: itemDiscount,
                promotion_discount: promotionDiscount,
                applied_promotions: itemPromotions.map((p) => ({
                    promotion_id: p.promotion_id,
                    promotion_name: p.promotion_name,
                    discount_amount: p.discount_amount,
                    promotion_type: p.promotion_type
                }))
            };
        });
        // Order-level breakdown
        const orderLevelBreakdown = {
            total_original: originalTotal,
            total_discounted: discountedTotal,
            total_promotion_discount: totalPromotionDiscount,
            applied_promotions: appliedPromotions.map((p) => ({
                promotion_id: p.promotion_id,
                promotion_name: p.promotion_name,
                discount_amount: p.discount_amount,
                promotion_type: p.promotion_type,
                is_cart_level: cartLevelPromotions.includes(p),
                is_product_level: productLevelPromotions.includes(p)
            })),
            promotion_summary: {
                product_level_discounts: productLevelPromotions.reduce((sum, p) => sum + (p.discount_amount || 0), 0),
                cart_level_discounts: cartLevelPromotions.reduce((sum, p) => sum + (p.discount_amount || 0), 0),
                free_shipping_applied: appliedPromotions.some((p) => p.promotion_type === 'FREE_SHIPPING')
            }
        };
        return {
            totalPromotionDiscount,
            orderLevelBreakdown,
            lineLevelBreakdown
        };
    }
    /**
     * Create enhanced orderlines with promotion tracking
     */
    async createEnhancedOrderlines(orderId, evaluationId, orderItems, lineLevelBreakdown) {
        const orderlines = [];
        for (let i = 0; i < orderItems.length; i++) {
            const item = orderItems[i];
            const breakdown = lineLevelBreakdown[i] || {};
            const orderlineData = {
                orderid: orderId,
                productid: item.productid,
                userid: item.userid,
                addressid: item.addressid,
                productamount: item.productamount,
                discountamount: item.discountamount,
                orderamount: item.orderamount,
                quantity: item.quantity,
                productname: item.productname,
                productcategory: item.productcategory,
                orderstatus: 'payment_completed',
                // Enhanced promotion tracking fields
                original_price: breakdown.original_price,
                product_discount: breakdown.product_discount,
                promotion_discount: breakdown.promotion_discount,
                applied_promotions: breakdown.applied_promotions,
                evaluation_id: evaluationId,
                createddate: Date.now(),
                modifieddate: Date.now(),
                ordereddate: Date.now()
            };
            const orderline = await this.prisma.orderline.create({
                data: orderlineData
            });
            orderlines.push(orderline);
            logger.info({
                orderlineId: orderline.id,
                productid: item.productid,
                originalPrice: breakdown.original_price,
                promotionDiscount: breakdown.promotion_discount,
                appliedPromotions: breakdown.applied_promotions?.length || 0
            }, 'Enhanced orderline created with promotion tracking');
        }
        return orderlines;
    }
    /**
     * Get order with comprehensive promotion data
     */
    async getOrderWithPromotionData(orderId) {
        try {
            const order = await this.prisma.orders.findUnique({
                where: { id: orderId },
                include: {
                    orderline: {
                        select: {
                            id: true,
                            productid: true,
                            // productname: true, // This field doesn't exist in the schema
                            quantity: true,
                            // original_price: true, // This field doesn't exist in the schema
                            // product_discount: true, // This field doesn't exist in the schema
                            // promotion_discount: true, // This field doesn't exist in the schema
                            // applied_promotions: true, // This field doesn't exist in the schema
                            // evaluation_id: true, // This field doesn't exist in the schema
                            // productamount: true, // This field doesn't exist in the schema
                            // discountamount: true, // This field doesn't exist in the schema
                            // orderamount: true // This field doesn't exist in the schema
                        }
                    }
                }
            });
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }
            // Get evaluation data if available
            let evaluation = null;
            if (order.evaluation_id) {
                evaluation = await this.prisma.promotion_evaluations.findUnique({
                    where: { evaluation_id: order.evaluation_id },
                    select: {
                        evaluation_id: true,
                        original_total: true,
                        discounted_total: true,
                        applied_promotions: true,
                        created_at: true,
                        status: true
                    }
                });
            }
            return {
                order,
                evaluation,
                promotionSummary: {
                    totalPromotionDiscount: order.promotion_discount_total || 0,
                    originalTotal: order.original_total || 0,
                    finalTotal: order.final_total || 0,
                    promotionBreakdown: order.promotion_breakdown || null
                }
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                orderId
            }, 'Error getting order with promotion data');
            throw error;
        }
    }
}
//# sourceMappingURL=enhanced-order-creation.service.js.map