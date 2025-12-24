import { FastifyRequest, FastifyReply } from "fastify";
import { ProductService } from "../services/product.service.js";
export declare class ProductController {
    productService: ProductService;
    getProducts: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    validateComboComponents: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertProduct: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertProductWithFile: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    rearrangeProductImages: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteProductImageUrls: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getProductsForPlatform: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getProductForPlatform: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=product.controller.d.ts.map