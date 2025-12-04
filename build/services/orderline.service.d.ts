import { CreateOrderlineInput, UpdateOrderlineInput } from '../schemas/orderline.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrderlineService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateOrderlineInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateOrderlineInput & Record<string, any>): Promise<any>;
    updateOrderlineStatus(id: string, status: string, additionalData?: Record<string, any>): Promise<any>;
    /**
    * Adjust product quantities when an orderline is cancelled or returned
    * - Decrease orderedquantity by the cancelled quantity
    * - Increase availablequantity by the cancelled quantity
    */
    private adjustProductQuantitiesOnCancellation;
    findByOrderId(orderid: number): Promise<any[]>;
}
//# sourceMappingURL=orderline.service.d.ts.map