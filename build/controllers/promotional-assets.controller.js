import { PromotionalAssetsService } from "../services/promotional-assets.service.js";
import { createPromotionalAssetSchema, updatePromotionalAssetSchema, upsertPromotionalAssetSchema, promotionalAssetParamsSchema, } from "../schemas/promotional-assets.schema.js";
import { getPaginationParams } from "../utils/pagination.js";
import { createSuccessResponse, asyncHandler } from "../utils/errorHandler.js";
import { formatPromotionalAssetForAPI, formatEntitiesForAPI } from "../utils/dynamicDbOperations.js";
export class PromotionalAssetsController {
    promotionalAssetsService = new PromotionalAssetsService();
    getAssets = asyncHandler(async (request, reply) => {
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.promotionalAssetsService.findMany(filters, page, limit);
        const formattedData = formatEntitiesForAPI(result.data, 'promotional_assets');
        const response = createSuccessResponse("Promotional assets retrieved successfully", formattedData);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0,
            },
        });
    });
    getAsset = asyncHandler(async (request, reply) => {
        const { id } = promotionalAssetParamsSchema.parse(request.params);
        const asset = await this.promotionalAssetsService.findById(parseInt(id));
        const response = createSuccessResponse("Promotional asset retrieved successfully", formatPromotionalAssetForAPI(asset));
        return reply.code(200).send(response);
    });
    createAsset = asyncHandler(async (request, reply) => {
        const authRequest = request;
        const data = createPromotionalAssetSchema.parse(request.body);
        const userId = authRequest.user?.useremail || 'test-user@example.com';
        const asset = await this.promotionalAssetsService.create(data, userId);
        const response = createSuccessResponse("Promotional asset created successfully", formatPromotionalAssetForAPI(asset));
        return reply.code(201).send(response);
    });
    updateAsset = asyncHandler(async (request, reply) => {
        const authRequest = request;
        const { id } = promotionalAssetParamsSchema.parse(request.params);
        const data = updatePromotionalAssetSchema.parse(request.body);
        const userId = authRequest.user?.useremail || 'test-user@example.com';
        const asset = await this.promotionalAssetsService.update(parseInt(id), data, userId);
        const response = createSuccessResponse("Promotional asset updated successfully", formatPromotionalAssetForAPI(asset));
        return reply.code(200).send(response);
    });
    upsertAsset = asyncHandler(async (request, reply) => {
        const authRequest = request;
        const data = upsertPromotionalAssetSchema.parse(request.body);
        const userId = authRequest.user?.useremail || 'test-user@example.com';
        const result = await this.promotionalAssetsService.upsert(data, userId);
        const statusCode = result.operation === 'created' ? 201 : 200;
        const message = result.operation === 'created'
            ? "Promotional asset created successfully"
            : "Promotional asset updated successfully";
        const response = {
            success: true,
            message,
            operation: result.operation,
            data: formatPromotionalAssetForAPI(result.asset)
        };
        return reply.code(statusCode).send(response);
    });
    deleteImage = asyncHandler(async (request, reply) => {
        const authRequest = request;
        const { id } = promotionalAssetParamsSchema.parse(request.params);
        const body = request.body;
        if (!body.imageUrl) {
            return reply.code(400).send({
                success: false,
                message: "Image URL is required",
                statusCode: 400
            });
        }
        const userId = authRequest.user?.useremail || 'test-user@example.com';
        const asset = await this.promotionalAssetsService.deleteImage(parseInt(id), body.imageUrl, userId);
        const response = createSuccessResponse("Image deleted from promotional asset successfully", formatPromotionalAssetForAPI(asset));
        return reply.code(200).send(response);
    });
    deleteAsset = asyncHandler(async (request, reply) => {
        const authRequest = request;
        const { id } = promotionalAssetParamsSchema.parse(request.params);
        const userId = authRequest.user?.useremail || 'test-user@example.com';
        await this.promotionalAssetsService.delete(parseInt(id), userId);
        const response = createSuccessResponse("Promotional asset deleted successfully", null);
        return reply.code(200).send(response);
    });
    getAuditLogs = asyncHandler(async (request, reply) => {
        const { id } = promotionalAssetParamsSchema.parse(request.params);
        const { page, limit } = getPaginationParams(request.query || {});
        const result = await this.promotionalAssetsService.getAuditLogs(parseInt(id), page, limit);
        const response = createSuccessResponse("Audit logs retrieved successfully", result.data);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
        });
    });
}
//# sourceMappingURL=promotional-assets.controller.js.map