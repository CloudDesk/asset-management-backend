export declare class EnhancedOrderCreationService {
    private prisma;
    constructor();
    /**
     * Enhanced order creation with comprehensive promotion tracking
     */
    createOrderWithPromotionData(orderData: any, evaluationId: string, promotionData: any): Promise<{
        order: {
            id: number;
            quantity: number | null;
            createddate: bigint | null;
            modifieddate: bigint | null;
            orderid: string | null;
            productid: number[];
            userid: number | null;
            addressid: number | null;
            orderamount: import("@prisma/client/runtime/library").Decimal | null;
            orderstatus: string | null;
            delivereddate: bigint | null;
            cancelleddate: bigint | null;
            returneddate: bigint | null;
            transactionid: string | null;
            readytodispatchdate: bigint | null;
            dispatcheddate: bigint | null;
            productamount: import("@prisma/client/runtime/library").Decimal | null;
            discountamount: import("@prisma/client/runtime/library").Decimal | null;
            deliveryfrom: string | null;
            orderprocessingtime: bigint | null;
            ispaymentsucceed: boolean | null;
            merchanttransactionid: string | null;
            paymentfaileddate: bigint | null;
        };
        orderlines: {
            status: string | null;
            id: number;
            quantity: number | null;
            price: import("@prisma/client/runtime/library").Decimal | null;
            createddate: bigint | null;
            modifieddate: bigint | null;
            orderid: number;
            orderlinenumber: string | null;
            productid: bigint | null;
            userid: number | null;
            addressid: number | null;
            ordertype: string | null;
        }[];
        promotionBreakdown: {
            totalPromotionDiscount: number;
            orderLevelBreakdown: {
                total_original: number;
                total_discounted: number;
                total_promotion_discount: number;
                applied_promotions: any;
                promotion_summary: {
                    product_level_discounts: any;
                    cart_level_discounts: any;
                    free_shipping_applied: any;
                };
            };
            lineLevelBreakdown: {
                productid: any;
                original_price: any;
                product_discount: any;
                promotion_discount: any;
                applied_promotions: any;
            }[];
        };
    }>;
    /**
     * Calculate detailed promotion breakdown for order and orderlines
     */
    private calculatePromotionBreakdown;
    /**
     * Create enhanced orderlines with promotion tracking
     */
    private createEnhancedOrderlines;
    /**
     * Get order with comprehensive promotion data
     */
    getOrderWithPromotionData(orderId: number): Promise<{
        order: {
            orderline: {
                id: number;
                quantity: number | null;
                productid: bigint | null;
            }[];
        } & {
            id: number;
            quantity: number | null;
            createddate: bigint | null;
            modifieddate: bigint | null;
            orderid: string | null;
            productid: number[];
            userid: number | null;
            addressid: number | null;
            orderamount: import("@prisma/client/runtime/library").Decimal | null;
            orderstatus: string | null;
            delivereddate: bigint | null;
            cancelleddate: bigint | null;
            returneddate: bigint | null;
            transactionid: string | null;
            readytodispatchdate: bigint | null;
            dispatcheddate: bigint | null;
            productamount: import("@prisma/client/runtime/library").Decimal | null;
            discountamount: import("@prisma/client/runtime/library").Decimal | null;
            deliveryfrom: string | null;
            orderprocessingtime: bigint | null;
            ispaymentsucceed: boolean | null;
            merchanttransactionid: string | null;
            paymentfaileddate: bigint | null;
        };
        evaluation: {
            status: string | null;
            evaluation_id: string;
            original_total: import("@prisma/client/runtime/library").Decimal | null;
            discounted_total: import("@prisma/client/runtime/library").Decimal | null;
            applied_promotions: import("@prisma/client/runtime/library").JsonValue;
            created_at: bigint;
        } | null;
        promotionSummary: {
            totalPromotionDiscount: any;
            originalTotal: any;
            finalTotal: any;
            promotionBreakdown: any;
        };
    }>;
}
//# sourceMappingURL=enhanced-order-creation.service.d.ts.map