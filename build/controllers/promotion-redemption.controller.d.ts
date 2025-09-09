import { FastifyRequest, FastifyReply } from 'fastify';
export declare class PromotionRedemptionController {
    private redemptionService;
    redeemPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRedemptionsForOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRedemptionById: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getUserRedemptionHistory: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotion-redemption.controller.d.ts.map