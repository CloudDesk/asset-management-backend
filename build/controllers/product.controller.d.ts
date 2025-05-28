import { FastifyRequest, FastifyReply } from 'fastify';
export declare class ProductController {
    private productService;
    getProducts: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=product.controller.d.ts.map