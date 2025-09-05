import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionUsageLogService } from '../services/promotion-usage-log.service.js';
export declare class PromotionUsageLogController {
    promotionUsageLogService: PromotionUsageLogService;
    getPromotionUsageLogs: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotionUsageLog: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPromotionUsageLog: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePromotionUsageLog: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePromotionUsageLog: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertPromotionUsageLog: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotion-usage-log.controller.d.ts.map