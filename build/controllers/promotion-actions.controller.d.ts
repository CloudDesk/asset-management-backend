import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionActionsService } from '../services/promotion-actions.service.js';
export declare class PromotionActionsController {
    promotionActionsService: PromotionActionsService;
    getPromotionActions: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotionAction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPromotionAction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePromotionAction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePromotionAction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertPromotionAction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotion-actions.controller.d.ts.map