import { FastifyRequest, FastifyReply } from 'fastify';
import { SamplePurchaseOrderService } from '../services/samplepurchaseorder.service.js';
export declare class SamplePurchaseOrderController {
    samplePurchaseOrderService: SamplePurchaseOrderService;
    /**
     * Get sample purchase orders with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getSamplePurchaseOrders: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get single sample purchase order by ID
     */
    getSamplePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new sample purchase order with dynamic field support
     */
    createSamplePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update sample purchase order with dynamic field support
     */
    updateSamplePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete sample purchase order by ID
     */
    deleteSamplePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert sample purchase order - create or update based on ID presence
     */
    upsertSamplePurchaseOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get sample purchase orders by supplier ID
     */
    getSamplePurchaseOrdersBySupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=samplepurchaseorder.controller.d.ts.map