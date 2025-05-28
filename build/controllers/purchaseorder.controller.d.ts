import { FastifyRequest, FastifyReply } from 'fastify';
import { PurchaseOrderService } from '../services/purchaseorder.service.js';
export declare class PurchaseOrderController {
    purchaseOrderService: PurchaseOrderService;
    /**
     * Get purchase orders with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getPurchaseOrders: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get single purchase order by ID
     */
    getPurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new purchase order with dynamic field support
     */
    createPurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update purchase order with dynamic field support
     */
    updatePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete purchase order by ID
     */
    deletePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert purchase order - create or update based on ID presence
     */
    upsertPurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get purchase orders by supplier ID
     */
    getPurchaseOrdersBySupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update purchase order status
     */
    updatePurchaseOrderStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=purchaseorder.controller.d.ts.map