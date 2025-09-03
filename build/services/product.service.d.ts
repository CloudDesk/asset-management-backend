import { CreateProductInput, UpdateProductInput, UpsertProductInput } from "../schemas/product.schema.js";
import { PaginationResult } from "../utils/pagination.js";
import { FilterOptions } from "../utils/filterBuilder.js";
export declare class ProductService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateProductInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateProductInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertProductInput & Record<string, any>): Promise<any>;
    updateStockTotals(productIdentifier: string, insertedStock?: {
        ecompublish?: boolean;
        stockstatus?: string;
        quantity?: number;
    }): Promise<{
        totalQuantity: number;
        totalAvailable: number;
        totalSold: number;
        totalEcomPublished: number;
    } | {
        updatedProduct: any;
        totalQuantity: number;
        totalAvailable: any;
        totalSold: number;
        totalEcomPublished: number;
    }>;
    /**
     * Upsert product with file upload handling - merges image URLs into size arrays
     */
    upsertProductWithFile(data: any): Promise<{
        result: any;
        productid: any;
        pathurldatas: any;
    }>;
    /**
     * Rearrange image URLs within product arrays (large, medium, small)
     */
    rearrangeProductImages(productId: string, rearrangeData: {
        large?: string[];
        medium?: string[];
        small?: string[];
    }): Promise<any>;
    /**
     * Helper method to check if two arrays contain the same elements (order doesn't matter)
     */
    private arraysContainSameElements;
    /**
     * Update product's average rating based on all ratings for the product
     */
    updateAverageRating(productId: number): Promise<{
        averageRating: number;
        totalRatings: number;
    }>;
    /**
     * Delete specific URLs from product image arrays
     */
    deleteProductImageUrls(productId: string, deleteData: {
        large?: string[];
        medium?: string[];
        small?: string[];
    }): Promise<{
        product: any;
        deletionSummary: any;
    }>;
}
//# sourceMappingURL=product.service.d.ts.map