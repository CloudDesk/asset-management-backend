import { CreateOrdersInput, UpdateOrdersInput } from '../schemas/orders.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrdersService {
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
     */
    findByOrderNumber(orderNumber: string): Promise<any>;
    /**
     * Mark order as ready for dispatch
     */
    markReadyForDispatch(orderId: number, inventoryUserId: number): Promise<any>;
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
}
//# sourceMappingURL=orders.service.d.ts.map