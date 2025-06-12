import { FastifyRequest, FastifyReply } from 'fastify';
export declare class SamplePurchaseRequestController {
    private readonly samplePurchaseRequestService;
    /**
     * Get sample purchase requests with optimized filtering and pagination
     * Supports any field that exists in the database with enhanced performance
     */
    getSamplePurchaseRequests: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get single sample purchase request by ID with optimized caching
     */
    getSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new sample purchase request with enhanced validation
     */
    createSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update sample purchase request with optimized validation
     */
    updateSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete sample purchase request by ID with optimized logging
     */
    deleteSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert sample purchase request with enhanced logic
     */
    upsertSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get sample purchase requests by supplier ID with enhanced performance
     */
    getSamplePurchaseRequestsBySupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get service statistics for monitoring and debugging
     */
    getStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Clear service cache (for admin/debugging purposes)
     */
    clearCache: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=samplepurchaserequest.controller.d.ts.map