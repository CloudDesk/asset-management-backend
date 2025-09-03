import { logger } from "../config/logger.js";
/**
 * Updates the average rating for a product after rating changes
 * This function is designed to be called after rating creation, update, or deletion
 */
export async function updateProductAverageRating(productId) {
    try {
        logger.debug({ productId }, "Starting product average rating update via utility");
        // Import services dynamically to avoid circular dependencies
        const { ProductService } = await import("../services/product.service.js");
        const productService = new ProductService();
        const result = await productService.updateAverageRating(productId);
        logger.info({
            productId,
            averageRating: result.averageRating,
            totalRatings: result.totalRatings,
        }, "Product average rating update completed via utility");
        return result;
    }
    catch (error) {
        logger.error({ error, productId }, "Error in product average rating update utility");
        throw error;
    }
}
/**
 * Safely updates product average rating without failing the main operation
 * This is used when we want to update the average rating but don't want to fail
 * the primary operation (like rating creation) if the update fails
 */
export async function safeUpdateProductAverageRating(productId, context) {
    try {
        await updateProductAverageRating(productId);
        logger.info({
            productId,
            operation: context.operation,
            ratingId: context.ratingId,
        }, "Product average rating updated successfully");
    }
    catch (error) {
        // Log error but don't throw - this is a "safe" operation
        logger.error({
            error,
            productId,
            operation: context.operation,
            ratingId: context.ratingId,
        }, "Failed to update product average rating (safe operation)");
    }
}
//# sourceMappingURL=ratingUtils.js.map