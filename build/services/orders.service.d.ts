import { CreateOrdersInput, UpdateOrdersInput } from '../schemas/orders.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrdersService {
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
     * Mark order as shipped (after label printed)
     */
    markShipped(orderId: number, inventoryUserId: number): Promise<any>;
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
    getOrdersByUserIdWithDetails(userId: number, page?: number, limit?: number): Promise<{
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
}
//# sourceMappingURL=orders.service.d.ts.map