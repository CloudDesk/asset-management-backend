import { ProductService } from '../services/product.service.js';
import { createProductSchema, updateProductSchema, upsertProductSchema, productParamsSchema } from '../schemas/product.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
export class ProductController {
    productService = new ProductService();
    getProducts = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.productService.findMany(filters, page, limit);
        const response = createSuccessResponse('Products retrieved successfully', result.data);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0
            }
        });
    });
    getProduct = asyncHandler(async (request, reply) => {
        const { id } = productParamsSchema.parse(request.params);
        const product = await this.productService.findById(id);
        const response = createSuccessResponse('Product retrieved successfully', product);
        return reply.code(200).send(response);
    });
    createProduct = asyncHandler(async (request, reply) => {
        const data = createProductSchema.parse(request.body);
        const product = await this.productService.create(data);
        const response = createSuccessResponse('Product created successfully', product);
        return reply.code(201).send(response);
    });
    updateProduct = asyncHandler(async (request, reply) => {
        const { id } = productParamsSchema.parse(request.params);
        const data = updateProductSchema.parse(request.body);
        const product = await this.productService.update(id, data);
        const response = createSuccessResponse('Product updated successfully', product);
        return reply.code(200).send(response);
    });
    deleteProduct = asyncHandler(async (request, reply) => {
        const { id } = productParamsSchema.parse(request.params);
        await this.productService.delete(id);
        const response = createSuccessResponse('Product deleted successfully', null);
        return reply.code(200).send(response);
    });
    upsertProduct = asyncHandler(async (request, reply) => {
        const data = upsertProductSchema.parse(request.body);
        const product = await this.productService.upsert(data);
        const message = data.id ? 'Product updated successfully' : 'Product created successfully';
        const response = createSuccessResponse(message, product);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=product.controller.js.map