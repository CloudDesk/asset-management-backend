/**
 * Updates the average rating for a product after rating changes
 * This function is designed to be called after rating creation, update, or deletion
 */
export declare function updateProductAverageRating(productId: number): Promise<{
    averageRating: number;
    totalRatings: number;
}>;
/**
 * Safely updates product average rating without failing the main operation
 * This is used when we want to update the average rating but don't want to fail
 * the primary operation (like rating creation) if the update fails
 */
export declare function safeUpdateProductAverageRating(productId: number, context: {
    operation: string;
    ratingId?: string | number;
}): Promise<void>;
//# sourceMappingURL=ratingUtils.d.ts.map