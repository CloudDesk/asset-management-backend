import { FastifyRequest, FastifyReply } from "fastify";
import { ProductRevoService, productrevoService } from "../services/productrevo.service.js";
import uploadtos3 from "../aws/uploadtos3.js";
import { 
    ProductRequest, 
    ProductResponse, 
    ProductServiceResponse,
    ProductFileResponse,
    ProductServiceResult,
    ProductQueryParams,
    ProductData,
    ProductErrorResponse
} from "../interfaces/product.interface.js";
import {
    sendSuccessResponse,
    sendErrorResponse,
    handleControllerError,
    isSuccessfulOperation,
    getOperationMessage,
    formatResponse,
    validateRequiredFields
} from "../utils/controllerHelpers.js";

interface ProductParams {
    id: string;
    productid: string;
}

export class ProductRevoController {
    constructor(private readonly productService: ProductRevoService = productrevoService) {
        // Bind all methods to this instance
        this.getProductsrevoData = this.getProductsrevoData.bind(this);
        this.getProductsEcomrevoData = this.getProductsEcomrevoData.bind(this);
        this.getSimilarProducts = this.getSimilarProducts.bind(this);
        this.upsertlockqty = this.upsertlockqty.bind(this);
        this.getArcheivedProductsRevo = this.getArcheivedProductsRevo.bind(this);
        this.getEachProductsRevo = this.getEachProductsRevo.bind(this);
        this.updateOrderedQuantityarray = this.updateOrderedQuantityarray.bind(this);
        this.deleteProductrevo = this.deleteProductrevo.bind(this);
        this.upsertProductrevo = this.upsertProductrevo.bind(this);
        this.upsertProductwithfileRevo = this.upsertProductwithfileRevo.bind(this);
        this.upsertProductwithfileRevogcp = this.upsertProductwithfileRevogcp.bind(this);
        this.rearrangeImageRevo = this.rearrangeImageRevo.bind(this);
        this.updateRemovedFromRecyclebinRevo = this.updateRemovedFromRecyclebinRevo.bind(this);
    }

    /**
     * Get all products data
     */
    public async getProductsrevoData(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.getproductsData(request);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getProductsrevoData');
        }
    }

    /**
     * Get e-commerce products data
     */
    public async getProductsEcomrevoData(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.getEcomProducts(request);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getProductsEcomrevoData');
        }
    }

    /**
     * Get similar products
     */
    public async getSimilarProducts(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.getSimilarProducts(request);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getSimilarProducts');
        }
    }

    /**
     * Update product lock quantity
     */
    public async upsertlockqty(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.bulkupsertProducttosetZero(request.body, true);
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(result, 'Lock quantity updated successfully'));
            } else {
                sendErrorResponse(reply, 400, 'Failed to update lock quantity');
            }
        } catch (error) {
            handleControllerError(error, reply, 'upsertlockqty');
        }
    }

    /**
     * Get archived products
     */
    public async getArcheivedProductsRevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.getArcheivedProductsrevo(request);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getArcheivedProductsRevo');
        }
    }

    /**
     * Get single product by ID
     */
    public async getEachProductsRevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.getEachProductsRevo(request, request.params.id);
            sendSuccessResponse(reply, result);
        } catch (error) {
            handleControllerError(error, reply, 'getEachProductsRevo');
        }
    }

    /**
     * Update ordered quantity array
     */
    public async updateOrderedQuantityarray(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.updateOrderedQuantityarray(request.body);
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(result, 'Ordered quantity updated successfully'));
            } else {
                sendErrorResponse(reply, 400, 'Failed to update ordered quantity');
            }
        } catch (error) {
            handleControllerError(error, reply, 'updateOrderedQuantityarray');
        }
    }

    /**
     * Delete product
     */
    public async deleteProductrevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.deleteProductrevo(request.params.id);
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(null, 'Product deleted successfully'));
            } else {
                const message = 'command' in result ? result.message : 'Product not found';
                sendErrorResponse(reply, 404, message);
            }
        } catch (error) {
            handleControllerError(error, reply, 'deleteProductrevo');
        }
    }

    /**
     * Create or update product
     */
    public async upsertProductrevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.upsertProductrevo(request.body);
            if (isSuccessfulOperation(result)) {
                const message = 'command' in result ? getOperationMessage(result.command) : 'Operation successful';
                sendSuccessResponse(reply, formatResponse(result, message));
            } else {
                sendErrorResponse(reply, 400, 'Failed to create/update product');
            }
        } catch (error) {
            handleControllerError(error, reply, 'upsertProductrevo');
        }
    }

    /**
     * Create or update product with file
     */
    public async upsertProductwithfileRevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.upsertProductwithFileRevo(request);
            if (isSuccessfulOperation(result)) {
                const message = 'result' in result ? getOperationMessage(result.result.command) : 'Operation successful';
                sendSuccessResponse(reply, formatResponse(result, message));
            } else {
                sendErrorResponse(reply, 400, 'Failed to create/update product with file');
            }
        } catch (error) {
            handleControllerError(error, reply, 'upsertProductwithfileRevo');
        }
    }

    /**
     * Create or update product with file in GCP
     */
    public async upsertProductwithfileRevogcp(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.upsertProductwithFileRevo(request);
            if (isSuccessfulOperation(result)) {
                const message = 'result' in result ? getOperationMessage(result.result.command) : 'Operation successful';
                sendSuccessResponse(reply, formatResponse(result, message));
            } else {
                sendErrorResponse(reply, 400, 'Failed to create/update product with file in GCP');
            }
        } catch (error) {
            handleControllerError(error, reply, 'upsertProductwithfileRevogcp');
        }
    }

    /**
     * Rearrange product images
     */
    public async rearrangeImageRevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.rearrangeImageRevo({
                params: { productid: request.params.id },
                body: request.body
            });
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(result, 'Images rearranged successfully'));
            } else {
                sendErrorResponse(reply, 400, 'Failed to rearrange images');
            }
        } catch (error) {
            handleControllerError(error, reply, 'rearrangeImageRevo');
        }
    }

    /**
     * Update removed from recycle bin
     */
    public async updateRemovedFromRecyclebinRevo(request: ProductRequest, reply: FastifyReply): Promise<void> {
        try {
            const result = await this.productService.updateRemoveFromRecyclebinRevo();
            if (isSuccessfulOperation(result)) {
                sendSuccessResponse(reply, formatResponse(result, 'Recycle bin updated successfully'));
            } else {
                sendErrorResponse(reply, 400, 'Failed to update recycle bin');
            }
        } catch (error) {
            handleControllerError(error, reply, 'updateRemovedFromRecyclebinRevo');
        }
    }
}

// Create and export a singleton instance with proper dependency injection
export const productrevoController = new ProductRevoController(productrevoService);