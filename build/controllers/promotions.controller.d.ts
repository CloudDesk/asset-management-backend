import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionsService } from '../services/promotions.service.js';
export declare class PromotionsController {
    promotionsService: PromotionsService;
    getUserSegments: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotions: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    recommendPromotion: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotions.controller.d.ts.map