import { CreateOrdersInput, UpdateOrdersInput, UpsertOrdersInput } from '../schemas/orders.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrdersService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByOrderId(orderid: string): Promise<any>;
    create(data: CreateOrdersInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateOrdersInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertOrdersInput & Record<string, any>): Promise<any>;
    updateOrderStatus(id: string, status: string, additionalData?: Record<string, any>): Promise<any>;
}
//# sourceMappingURL=orders.service.d.ts.map