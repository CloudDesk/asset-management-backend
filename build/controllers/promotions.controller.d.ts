import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionsService } from '../services/promotions.service.js';
import { PromotionEvaluationService } from '../services/promotion-evaluation.service.js';
export declare class PromotionsController {
    promotionsService: PromotionsService;
    promotionEvaluationService: PromotionEvaluationService;
    getPromotions: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    evaluateEligibility: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotions.controller.d.ts.map