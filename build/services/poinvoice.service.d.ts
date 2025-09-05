import { CreatePoinvoiceInput, UpdatePoinvoiceInput, UpsertPoinvoiceInput } from '../schemas/poinvoice.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PoinvoiceService {
    /**
     * Helper method to extract payment amount from payment data
     * For PUT operations, supports primarily direct array format:
     * Direct array: [{paymentamount: 100}, {paymentamount: 200}]
     * Also supports: Single payment object: {paymentamount: 300}
     * Legacy support: Object with items array: {items: [{paymentamount: 100}, {paymentamount: 200}]}
     */
    private extractPaymentAmount;
    /**
     * Validate purchase order exists and get its current state
     * Production-ready validation following existing project structure
     */
    private validateAndGetPurchaseOrder;
    /**
     * Helper method to calculate total payments for a ponumber
     */
    private calculateTotalPaymentsForPO;
    /**
     * Specialized function to update purchase order status by ponumber
     * Uses existing dynamicDbOperations following the project structure
     */
    private updatePurchaseOrderStatusByPonumber;
    /**
     * Helper method to update purchase order status based on payment amounts
     * Production-ready with comprehensive validation and error handling
     */
    private updatePurchaseOrderStatus;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePoinvoiceInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePoinvoiceInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertPoinvoiceInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=poinvoice.service.d.ts.map