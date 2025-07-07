import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionRulesService } from '../services/promotion-rules.service.js';
export declare class PromotionRulesController {
    promotionRulesService: PromotionRulesService;
    getPromotionRules: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotionRule: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPromotionRule: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePromotionRule: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePromotionRule: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertPromotionRule: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotion-rules.controller.d.ts.map