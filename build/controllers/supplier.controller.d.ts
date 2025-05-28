import { FastifyRequest, FastifyReply } from 'fastify';
export declare class SupplierController {
    private supplierService;
    /**
     * Get all suppliers with dynamic filtering and pagination
     */
    getSuppliers: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get supplier by ID
     */
    getSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new supplier with dynamic field support
     */
    createSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update supplier by ID
     */
    updateSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete supplier by ID
     */
    deleteSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert supplier - create or update based on ID presence
     */
    upsertSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get supplier statistics
     */
    getSupplierStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=supplier.controller.d.ts.map