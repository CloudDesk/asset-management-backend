import { FastifyRequest, FastifyReply } from 'fastify';
import { SupplierService } from '../services/supplier.service.js';
export declare class SupplierController {
    supplierService: SupplierService;
    /**
     * Get all suppliers with dynamic filtering and pagination
     */
    getSuppliers: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get supplier by ID with proper validation
     */
    getSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new supplier with dynamic field support
     */
    createSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update supplier by ID with proper validation
     */
    updateSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete supplier by ID with proper validation
     */
    deleteSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert supplier - create or update based on ID presence
     */
    upsertSupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get supplier statistics with proper validation
     */
    getSupplierStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=supplier.controller.d.ts.map