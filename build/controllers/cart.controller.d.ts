import { FastifyRequest, FastifyReply } from 'fastify';
import { CartService } from '../services/cart.service.js';
export declare class CartController {
    cartService: CartService;
    getCarts: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getCart: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createCart: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateCart: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteCart: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertCart: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getCartsByUserId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getWishlistByUserId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    clearCartByUserId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=cart.controller.d.ts.map