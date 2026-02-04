export declare class EnhancedOrderCreationService {
    private prisma;
    constructor();
    /**
     * Enhanced order creation with comprehensive promotion tracking
     */
    createOrderWithPromotionData(orderData: any, evaluationId: string, promotionData: any): Promise<{
        order: {
            id: number;
            createddate: bigint | null;
            modifieddate: bigint | null;
            quantity: number | null;
            productid: number[];
            orderid: string | null;
            userid: number | null;
            addressid: number | null;
            productamount: import("@prisma/client/runtime/library").Decimal | null;
            discountamount: import("@prisma/client/runtime/library").Decimal | null;
            orderamount: import("@prisma/client/runtime/library").Decimal | null;
            merchanttransactionid: string | null;
            readytodispatchdate: bigint | null;
            delivereddate: bigint | null;
            cancelleddate: bigint | null;
            returneddate: bigint | null;
            orderstatus: string | null;
            deliveryfrom: string | null;
            dispatcheddate: bigint | null;
            paymentfaileddate: bigint | null;
            evaluation_id: string | null;
            shipping_cost: import("@prisma/client/runtime/library").Decimal | null;
            total_gst_amount: import("@prisma/client/runtime/library").Decimal | null;
            tracking_id: string | null;
            shipdate: bigint | null;
            status_history: import("@prisma/client/runtime/library").JsonValue | null;
            transactionid: string | null;
            orderprocessingtime: bigint | null;
            ispaymentsucceed: boolean | null;
            promotion_discount_total: import("@prisma/client/runtime/library").Decimal | null;
            original_total: import("@prisma/client/runtime/library").Decimal | null;
            tax_amount: import("@prisma/client/runtime/library").Decimal | null;
            mode: string | null;
            cod_payment_received_date: bigint | null;
            cod_transaction_reference: string | null;
            cod_amount: import("@prisma/client/runtime/library").Decimal | null;
            vendor: string | null;
            barcodes: import("@prisma/client/runtime/library").JsonValue | null;
            label_url: string | null;
            public_tracking_link: string | null;
            shipment_created_at: bigint | null;
            label_downloaded_at: bigint | null;
            label_printed_at: bigint | null;
            items_total: import("@prisma/client/runtime/library").Decimal | null;
            total_taxable_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_cgst_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_sgst_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_igst_amount: import("@prisma/client/runtime/library").Decimal | null;
            refund_transaction_id: string | null;
            refund_amount: import("@prisma/client/runtime/library").Decimal | null;
            refund_reference: string | null;
            refund_initiated_date: bigint | null;
            refund_completed_date: bigint | null;
            order_invoice_url: string | null;
        };
        orderlines: {
            id: number;
            createddate: bigint | null;
            modifieddate: bigint | null;
            quantity: number | null;
            productid: bigint | null;
            orderid: number;
            orderlinenumber: string | null;
            userid: number | null;
            addressid: number | null;
            productamount: import("@prisma/client/runtime/library").Decimal | null;
            discountamount: import("@prisma/client/runtime/library").Decimal | null;
            orderamount: import("@prisma/client/runtime/library").Decimal | null;
            merchanttransactionid: string | null;
            productname: string | null;
            productcategory: string | null;
            productcolour: string | null;
            readytodispatchdate: bigint | null;
            delivereddate: bigint | null;
            cancelleddate: bigint | null;
            returneddate: bigint | null;
            orderstatus: string | null;
            uniqueordderid: string | null;
            deliveryfrom: string | null;
            location: string | null;
            dispatcheddate: bigint | null;
            ordereddate: bigint | null;
            paymentfaileddate: bigint | null;
            evaluation_id: string | null;
            original_price: import("@prisma/client/runtime/library").Decimal | null;
            product_discount_amount: import("@prisma/client/runtime/library").Decimal | null;
            promotion_discount_amount: import("@prisma/client/runtime/library").Decimal | null;
            shipping_cost: import("@prisma/client/runtime/library").Decimal | null;
            hsn_code: string | null;
            gst_rate: import("@prisma/client/runtime/library").Decimal | null;
            taxable_amount: import("@prisma/client/runtime/library").Decimal | null;
            cgst_amount: import("@prisma/client/runtime/library").Decimal | null;
            sgst_amount: import("@prisma/client/runtime/library").Decimal | null;
            igst_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_gst_amount: import("@prisma/client/runtime/library").Decimal | null;
            tracking_id: string | null;
            shipdate: bigint | null;
            status_history: import("@prisma/client/runtime/library").JsonValue | null;
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
            createddate: bigint | null;
            modifieddate: bigint | null;
            quantity: number | null;
            productid: number[];
            orderid: string | null;
            userid: number | null;
            addressid: number | null;
            productamount: import("@prisma/client/runtime/library").Decimal | null;
            discountamount: import("@prisma/client/runtime/library").Decimal | null;
            orderamount: import("@prisma/client/runtime/library").Decimal | null;
            merchanttransactionid: string | null;
            readytodispatchdate: bigint | null;
            delivereddate: bigint | null;
            cancelleddate: bigint | null;
            returneddate: bigint | null;
            orderstatus: string | null;
            deliveryfrom: string | null;
            dispatcheddate: bigint | null;
            paymentfaileddate: bigint | null;
            evaluation_id: string | null;
            shipping_cost: import("@prisma/client/runtime/library").Decimal | null;
            total_gst_amount: import("@prisma/client/runtime/library").Decimal | null;
            tracking_id: string | null;
            shipdate: bigint | null;
            status_history: import("@prisma/client/runtime/library").JsonValue | null;
            transactionid: string | null;
            orderprocessingtime: bigint | null;
            ispaymentsucceed: boolean | null;
            promotion_discount_total: import("@prisma/client/runtime/library").Decimal | null;
            original_total: import("@prisma/client/runtime/library").Decimal | null;
            tax_amount: import("@prisma/client/runtime/library").Decimal | null;
            mode: string | null;
            cod_payment_received_date: bigint | null;
            cod_transaction_reference: string | null;
            cod_amount: import("@prisma/client/runtime/library").Decimal | null;
            vendor: string | null;
            barcodes: import("@prisma/client/runtime/library").JsonValue | null;
            label_url: string | null;
            public_tracking_link: string | null;
            shipment_created_at: bigint | null;
            label_downloaded_at: bigint | null;
            label_printed_at: bigint | null;
            items_total: import("@prisma/client/runtime/library").Decimal | null;
            total_taxable_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_cgst_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_sgst_amount: import("@prisma/client/runtime/library").Decimal | null;
            total_igst_amount: import("@prisma/client/runtime/library").Decimal | null;
            refund_transaction_id: string | null;
            refund_amount: import("@prisma/client/runtime/library").Decimal | null;
            refund_reference: string | null;
            refund_initiated_date: bigint | null;
            refund_completed_date: bigint | null;
            order_invoice_url: string | null;
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