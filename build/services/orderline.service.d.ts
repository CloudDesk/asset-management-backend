import { CreateOrderlineInput, UpdateOrderlineInput, UpsertOrderlineInput } from '../schemas/orderline.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class OrderlineService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByOrderlineNumber(orderlinenumber: string): Promise<any>;
    findByOrderId(orderid: number): Promise<any[]>;
    create(data: CreateOrderlineInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateOrderlineInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertOrderlineInput & Record<string, any>): Promise<any>;
    updateOrderlineStatus(id: string, status: string, additionalData?: Record<string, any>): Promise<any>;
    bulkUpdateStatus(orderlineIds: string[], status: string, additionalData?: Record<string, any>): Promise<({
        success: boolean;
        id: string;
        data: any;
        error?: never;
    } | {
        success: boolean;
        id: string;
        error: string;
        data?: never;
    })[]>;
    cancelOrderline(id: string, reason?: string): Promise<{
        success: boolean;
        message: string;
        orderline: any;
        productUpdates: {
            productId: number;
            success: boolean;
            error: string;
        }[] | {
            productId: number;
            success: boolean;
            productName: string;
            quantityRestored: number;
            oldQuantities: {
                ordered: number;
                available: number;
                status: string | null;
            };
            newQuantities: {
                ordered: number;
                available: number;
                status: string;
            };
        }[];
        orderStatusUpdated: boolean;
        cancellationDetails: {
            orderlineId: string;
            productId: any;
            orderId: any;
            restoredQuantity: any;
            reason: string | undefined;
        };
    }>;
    private restoreProductQuantities;
    private checkAndUpdateOrderStatus;
}
//# sourceMappingURL=orderline.service.d.ts.map