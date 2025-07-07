import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionTargetLinkService } from '../services/promotion-target-link.service.js';
export declare class PromotionTargetLinkController {
    promotionTargetLinkService: PromotionTargetLinkService;
    getPromotionTargetLinks: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotionTargetLink: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPromotionTargetLink: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePromotionTargetLink: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePromotionTargetLink: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertPromotionTargetLink: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotion-target-link.controller.d.ts.map