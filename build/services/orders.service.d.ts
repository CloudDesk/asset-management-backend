import { CreateOrdersInput } from '../schemas/orders.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrdersService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: Number): Promise<any>;
    create(data: CreateOrdersInput & Record<string, any>): Promise<any>;
    createOrderlinesForProducts(orderId: number, productIds: number[], orderData: any, orderidString: string, currentTime: number): Promise<any[]>;
    createOrderlinesFromOrderItems(orderId: number, orderItems: any[], orderidString: string, currentTime: number): Promise<any[]>;
}
//# sourceMappingURL=orders.service.d.ts.map