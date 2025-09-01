import { FastifyRequest, FastifyReply } from 'fastify';
import { SamplePurchaseRequestService } from '../services/samplepurchaserequest.service.js';
export declare class SamplePurchaseRequestController {
    samplePurchaseRequestService: SamplePurchaseRequestService;
    /**
     * Get sample purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getSamplePurchaseRequests: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get single sample purchase request by ID
     */
    getSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create new sample purchase request with dynamic field support
     */
    createSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update sample purchase request with dynamic field support
     */
    updateSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Delete sample purchase request by ID
     */
    deleteSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Upsert sample purchase request - create or update based on ID presence
     */
    upsertSamplePurchaseRequest: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get sample purchase requests by supplier ID
     */
    getSamplePurchaseRequestsBySupplier: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=samplepurchaserequest.controller.d.ts.map