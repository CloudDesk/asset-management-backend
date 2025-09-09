import { FastifyRequest, FastifyReply } from 'fastify';
export declare class PromotionEvaluationController {
    private evaluationService;
    evaluatePromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    removeEvaluation: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getEvaluation: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    evaluateAutomaticPromotions: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getUserActiveEvaluations: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    applyManualCoupon: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    removeManualCoupon: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotion-evaluation.controller.d.ts.map