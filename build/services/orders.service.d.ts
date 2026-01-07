import { CreateOrdersInput, UpdateOrdersInput } from '../schemas/orders.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrdersService {
    /**
     * Maps EKART webhook status to our system status
     * Handles various formats: "Shipped", "SHIPPED", "In Transit", "In_Transit", "Pick Up", "Picked Up", etc.
     *
     * EKART Status Mapping:
     * - "Shipped" or "Pick Up" or "Picked Up" → shipped (Picked Up)
     * - "In Transit" → in_transit
     * - "Out For Delivery" → out_for_delivery
     * - "Delivered" → delivered
     * - "COD Collected" → cod_payment_received
     *
     * @param ekartStatus - Status from EKART webhook (e.g., "Shipped", "In Transit", "Pick Up")
     * @returns Mapped system status (e.g., "shipped", "in_transit") or null if unknown
     */
    private mapEkartWebhookStatusToSystemStatus;
    private parseStatusHistory;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: Number): Promise<any>;
    create(data: CreateOrdersInput & Record<string, any>): Promise<any>;
    createOrderlinesForProducts(orderId: number, productIds: number[], orderData: any, orderidString: string, currentTime: number, mode?: string): Promise<any[]>;
    createOrderlinesFromOrderItems(orderId: number, orderItems: any[], orderidString: string, currentTime: number, mode?: string): Promise<any[]>;
    /**
     * Recalculate order status based on all orderline statuses
     * This automatically updates order status history
     */
    recalculateOrderStatus(orderId: number): Promise<void>;
    /**
     * Find order by tracking ID
     */
    findByTrackingId(trackingId: string): Promise<any>;
    /**
     * Find order by order number (orderid field)
     * Uses dynamicFindUnique - works when Prisma schema is available
     */
    findByOrderNumber(orderNumber: string): Promise<any>;
    /**
     * Find order by orderid field using dynamicFindManyWithFilters
     * Use this method when you need to search by orderid (string field) and dynamicFindUnique doesn't work
     */
    findByOrderIdString(orderIdString: string): Promise<any>;
    /**
     * Auto-select stocks using FIFO (First In First Out)
     */
    private autoSelectStocks;
    /**
     * Get stocks by IDs
     */
    private getStocksByIds;
    /**
     * Get stocks by SKUs
     */
    private getStocksBySKUs;
    /**
     * Allocate stock to orderlines based on stock mapping
     */
    private allocateStockToOrderlines;
    /**
     * Update stock status and quantities for dispatch
     */
    private updateStockForDispatch;
    /**
     * Mark order as ready for dispatch
     */
    markReadyForDispatch(orderId: number, inventoryUserId: number, stockMapping?: Array<{
        orderline_id: number;
        stock_ids?: number[];
        skus?: string[];
        batch_filter?: {
            batchno?: string;
            supplierid?: number;
            poid?: number;
        };
    }>): Promise<any>;
    /**
     * Generate invoice for an order
     * Fetches seller data from EKART and calls storage backend to generate invoice PDF
     * @param orderId - Order ID
     * @returns Invoice URL if successful, null otherwise
     */
    generateInvoice(orderId: number): Promise<string | null>;
    /**
     * Mark order as shipped (after label printed)
     * NOTE: This endpoint is kept for backward compatibility and manual override.
     * For EKART orders, the 'shipped' status is now set automatically via webhook.
     */
    markShipped(orderId: number, inventoryUserId: number): Promise<any>;
    /**
     * Manually ship order with vendor details
     * Automatically sets order status to 'shipped'
     * PATCH /v1/orders/:id/manual-ship
     *
     * Note: Allows updating from EKART to another vendor when EKART refuses to collect
     */
    updateShipmentDetails(orderIdOrNumber: string | number, trackingId: string, vendor: string, inventoryUserId: number, publicTrackingLink?: string, shipped?: boolean): Promise<any>;
    /**
     * Generate tracking link for manual vendors
     * Private helper method
     */
    private generateTrackingLink;
    /**
     * Update shipment tracking status manually
     * Works for ALL vendors (EKART + manual vendors)
     * PATCH /v1/orders/:id/shipment-status
     */
    updateShipmentStatus(orderIdOrNumber: string | number, status: string, inventoryUserId: number, location?: string, description?: string): Promise<any>;
    /**
     * Handle EKART webhook status update
     * Maps EKART webhook status to system status and updates order/orderlines
     * @param trackingId - EKART tracking ID (wbn from webhook)
     * @param ekartStatus - Original status from EKART webhook (e.g., "Shipped", "In Transit")
     * @param webhookData - Additional webhook data (location, description, ctime, etc.)
     */
    handleEkartWebhookStatusUpdate(trackingId: string, ekartStatus: string, webhookData: {
        location?: string;
        description?: string;
        ctime?: number;
        pickupTime?: number;
        attempts?: string;
        [key: string]: any;
    }, fullWebhookPayload?: Record<string, any>): Promise<any>;
    /**
     * Update order status
     */
    updateOrderStatus(id: string, status: string, additionalData?: Record<string, any>): Promise<any>;
    /**
     * Update order (generic update method)
     */
    update(id: string, data: UpdateOrdersInput & Record<string, any>): Promise<any>;
    /**
     * Get order details with orderlines and address
     * For Inventory App order detail page
     *
     * Returns specific fields only:
     * - order: Selected order fields
     * - orderlines[]: Array of orderlines with selected fields
     * - address: Address object with selected fields
     */
    getOrderDetails(idOrOrderNumber: string): Promise<{
        order: any;
        orderlines: any[];
        address: any | null;
    }>;
    /**
     * Get orders by userid with orderlines and address data
     * Returns orders with nested orderlines and address information
     */
    getOrdersByUserIdWithDetails(userId: number, page?: number, limit?: number, filters?: {
        orderstatus?: string;
        date_range?: string;
        start_date?: string;
        end_date?: string;
        mode?: string;
        amount_range?: string;
        min_amount?: string;
        max_amount?: string;
    }): Promise<{
        orders: Array<{
            id: number;
            orderamount: number | null;
            orderid: string | null;
            orderstatus: string | null;
            quantity: number | null;
            productamount: number | null;
            discountamount: number | null;
            ispaymentsucceed: boolean | null;
            mode: string | null;
            promotion_discount_total: number | null;
            original_total: number | null;
            shipping_cost: number | null;
            items_total: number | null;
            total_taxable_amount: number | null;
            total_cgst_amount: number | null;
            total_sgst_amount: number | null;
            total_igst_amount: number | null;
            total_gst_amount: number | null;
            createddate: number | null;
            modifieddate: number | null;
            refund_transaction_id: string | null;
            refund_amount: number | null;
            refund_reference: string | null;
            refund_initiated_date: number | null;
            refund_completed_date: number | null;
            status_history: any[];
            orderlines: Array<{
                id: number;
                productname: string | null;
                productcategory: string | null;
                productid: number | null;
                orderstatus: string | null;
                productamount: number | null;
                discountamount: number | null;
                orderamount: number | null;
                quantity: number | null;
                product_discount_amount: number | null;
                promotion_discount_amount: number | null;
                shipping_cost: number | null;
                createddate: number | null;
                modifieddate: number | null;
                status_history: any[];
            }>;
            address: {
                name: string | null;
                mobilenumber: string | null;
                doornumber: string | null;
                address: string | null;
                pincode: string | null;
                state: string | null;
                city: string | null;
            } | null;
        }>;
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    /**
     * Cancel order (customer or admin initiated)
     * Handles stock reversal based on order status
     */
    cancelOrder(orderId: number, userId?: number, inventoryUserId?: number, cancellationReason?: string, source?: 'customer' | 'inventoryuser'): Promise<any>;
    /**
     * DEPRECATED: Manual refund process is now used
     *
     * This method is kept for reference purposes only.
     * Refunds are now manually processed by admins via PhonePe portal.
     *
     * @deprecated Use manual refund workflow instead
     * @see updateRefundStatus for manual refund status management
     */
    private handleCancellationRefundAndNotification;
    /**
     * Update refund status for cancelled orders (admin-only operation)
     * Transitions: cancelled → cancelled_refund_processing → cancelled_refunded
     * Or: cancelled → cancelled_completed (for COD orders)
     */
    updateRefundStatus(orderId: number | string, newStatus: 'cancelled_refund_processing' | 'cancelled_refunded' | 'cancelled_completed', adminUserId: number, notes?: string, refundTransactionId?: string, refundAmount?: number, refundReference?: string): Promise<any>;
    /**
     * Cancel order before ready_for_dispatch
     * Reverses orderedqty → availableqty
     */
    private cancelOrderBeforeReadyForDispatch;
    /**
     * Cancel order after ready_for_dispatch
     * Reverses stock allocations and soldqty → availableqty
     */
    private cancelOrderAfterReadyForDispatch;
}
//# sourceMappingURL=orders.service.d.ts.map