import { FastifyRequest, FastifyReply } from 'fastify';
import { PurchaseRequestService } from '../services/purchaseRequest.service.js';
export declare class PurchaseRequestController {
    purchaseRequestService: PurchaseRequestService;
    /**
     * Get purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getPurchaseRequests: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get single purchase request by ID
     */
    getPurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new purchase request with dynamic field support
     */
    createPurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update purchase request with dynamic field support
     */
    updatePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete purchase request by ID
     */
    deletePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert purchase request - create or update based on ID presence
     */
    upsertPurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get purchase requests by supplier ID
     */
    getPurchaseRequestsBySupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get purchase requests by requester
     */
    getPurchaseRequestsByRequester: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Approve purchase request
     */
    approvePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Reject purchase request
     */
    rejectPurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=purchaserequest.controller.d.ts.map