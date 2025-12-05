import { CreateOrderlineInput, UpdateOrderlineInput } from '../schemas/orderline.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrderlineService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateOrderlineInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateOrderlineInput & Record<string, any>): Promise<any>;
    /**
     * Update orderline status with complete lifecycle management
     *
     * For CANCELLATION specifically (status === 'cancelled'):
     *
     * Flow according to ORDER_FULFILLMENT_EKART_INTEGRATION_PLAN.md Section 6:
     * 1. Check if order has tracking_id (EKART shipment created)
     * 2. If yes, attempt to cancel EKART shipment first
     *    - Scenario B (ready_for_dispatch): Should succeed
     *    - Scenario C (shipped/in_transit): May fail, but continue anyway
     * 3. Update orderline status to 'cancelled'
     * 4. Restore stock (Product + PlatformStock) - automatic via adjustProductQuantitiesOnCancellation
     * 5. Update status_history (orderline)
     * 6. Recalculate order status (may become 'cancelled' or 'partially_cancelled')
     * 7. Update order status_history (automatic via recalculateOrderStatus)
     *
     * Stock Restoration (ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md Section 12):
     * - Product: availablequantity ↑, orderedquantity ↓
     * - PlatformStock: availableqty ↑, orderedqty ↓
     * - lockqty is NOT updated (only orderedqty restored)
     *
     * @param id - Orderline ID
     * @param status - New status (e.g., 'cancelled', 'delivered', 'shipped')
     * @param additionalData - Additional data including:
     *   - source: 'customer' | 'inventoryuser' | 'ekart' | 'phonepe' | 'system'
     *   - inventory_user_id: Required when source is 'inventoryuser'
     *   - cancellation_reason: Reason for cancellation
     */
    updateOrderlineStatus(id: string, status: string, additionalData?: Record<string, any>): Promise<any>;
    /**
     * Adjust product quantities when an orderline is cancelled or returned
     *
     * According to ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md Section 12:
     * - Decrease orderedquantity by the cancelled quantity (Product + PlatformStock)
     * - Increase availablequantity by the cancelled quantity (Product + PlatformStock)
     * - Recalculate productstatus and platformstatus
     *
     * Stock restoration happens for both:
     * - Product table (orderedquantity ↓, availablequantity ↑)
     * - PlatformStock table (orderedqty ↓, availableqty ↑)
     *
     * Note: lockqty is NOT updated (only orderedqty is restored)
     */
    private adjustProductQuantitiesOnCancellation;
    findByOrderId(orderid: number): Promise<any[]>;
}
//# sourceMappingURL=orderline.service.d.ts.map