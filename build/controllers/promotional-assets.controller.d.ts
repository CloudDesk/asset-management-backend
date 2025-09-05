import { FastifyRequest, FastifyReply } from "fastify";
import { PromotionalAssetsService } from "../services/promotional-assets.service.js";
export declare class PromotionalAssetsController {
    promotionalAssetsService: PromotionalAssetsService;
    getAssets: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getAsset: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createAsset: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateAsset: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertAsset: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteImage: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteAsset: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getAuditLogs: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=promotional-assets.controller.d.ts.map