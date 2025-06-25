import { CreatePromotionalAssetInput, UpdatePromotionalAssetInput, UpsertPromotionalAssetInput } from "../schemas/promotional-assets.schema.js";
import { PaginationResult } from "../utils/pagination.js";
export declare class PromotionalAssetsService {
    private auditLog;
    findMany(filters: Record<string, any>, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: number): Promise<any>;
    create(data: CreatePromotionalAssetInput, userId: string): Promise<any>;
    update(id: number, data: UpdatePromotionalAssetInput, userId: string): Promise<any>;
    upsert(data: UpsertPromotionalAssetInput, userId: string): Promise<{
        asset: any;
        operation: 'created' | 'updated';
    }>;
    deleteImage(id: number, imageUrl: string, userId: string): Promise<any>;
    delete(id: number, userId: string): Promise<void>;
    getAuditLogs(assetId: number, page?: number, limit?: number): Promise<PaginationResult<any>>;
    private createDiff;
}
//# sourceMappingURL=promotional-assets.service.d.ts.map