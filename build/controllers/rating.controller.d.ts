import { FastifyRequest, FastifyReply } from 'fastify';
import { RatingService } from '../services/rating.service.js';
export declare class RatingController {
    ratingService: RatingService;
    getRatings: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRating: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createRating: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateRating: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteRating: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertRating: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRatingsByUserId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRatingsByProductId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRatingsByOrderId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getAverageRatingByProductId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getRatingsByStarLevel: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=rating.controller.d.ts.map