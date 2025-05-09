import { FastifyRequest, FastifyReply } from "fastify";
import { productrevoService } from "../services/productrevo.service.js";
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

interface ProductParams {
    id: string;
    productid: string;
}

export class ProductRevoController {
    constructor(private readonly productService = productrevoService) {}

    /**
     * Get all products data
     */
    public getProductsrevoData = async (request: FastifyRequest<{ Querystring: ProductQueryParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.getproductsData(request);
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'getProductsrevoData');
        }
    }

    /**
     * Get e-commerce products data
     */
    public getProductsEcomrevoData = async (request: FastifyRequest<{ Querystring: ProductQueryParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.getEcomProducts(request);
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'getProductsEcomrevoData');
        }
    }

    /**
     * Get similar products
     */
    public getSimilarProducts = async (request: FastifyRequest<{ Querystring: ProductQueryParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.getSimilarProducts(request);
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'getSimilarProducts');
        }
    }

    /**
     * Update product lock quantity
     */
    public upsertlockqty = async (request: FastifyRequest<{ Body: { productid: number; quantity: number }[] }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.bulkupsertProducttosetZero(request.body, true);
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'upsertlockqty');
        }
    }

    /**
     * Get archived products
     */
    public getArcheivedProductsRevo = async (request: FastifyRequest<{ Querystring: ProductQueryParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.getArcheivedProductsrevo(request);
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'getArcheivedProductsRevo');
        }
    }

    /**
     * Get a single product by ID
     */
    public getEachProductsRevo = async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const { id } = request.params;
            const result = await this.productService.getEachProductsRevo(request, Number(id));
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'getEachProductsRevo');
        }
    }

    /**
     * Update ordered quantity array
     */
    public updateOrderedQuantityarray = async (request: FastifyRequest<{ Body: { id: number; orderedquantity: number }[] }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.updateOrderedQuantityarray(request.body);
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'updateOrderedQuantityarray');
        }
    }

    /**
     * Delete a product
     */
    public deleteProductrevo = async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const { id } = request.params;
            const result = await this.productService.deleteProductrevo(Number(id));
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'deleteProductrevo');
        }
    }

    /**
     * Create or update a product
     */
    public upsertProductrevo = async (request: FastifyRequest<{ Body: ProductData }>, reply: FastifyReply): Promise<void> => {
        try {
            const result : any = await this.productService.upsertProductrevo(request.body);
            if (this.isSuccessfulOperation(result)) {
                const message = this.getOperationMessage(result.command);
                this.sendSuccessResponse(reply, { message });
            } else {
                this.sendErrorResponse(reply, 404, result);
            }
        } catch (error) {
            this.handleError(error, reply, 'upsertProductrevo');
        }
    }

    /**
     * Create or update a product with file
     */
    public upsertProductwithfileRevo = async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.upsertProductwithFileRevo(request) as ProductFileResponse;
            if (this.isSuccessfulOperation(result)) {
                if (result.productid) {
                    await uploadtos3(result.pathurldatas, result.productid);
                }
                const message = this.getOperationMessage(result.result.command, 'File');
                this.sendSuccessResponse(reply, { message });
            }
        } catch (error) {
            this.handleError(error, reply, 'upsertProductwithfileRevo');
        }
    }

    /**
     * Create or update a product with file in GCP
     */
    public upsertProductwithfileRevogcp = async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.upsertProductwithFileRevo(request) as ProductFileResponse;
            if (this.isSuccessfulOperation(result)) {
                const message = this.getOperationMessage(result.result.command, 'File');
                this.sendSuccessResponse(reply, { message });
            }
        } catch (error) {
            this.handleError(error, reply, 'upsertProductwithfileRevogcp');
        }
    }

    /**
     * Rearrange product images
     */
    public rearrangeImageRevo = async (request: FastifyRequest<{ Params: ProductParams; Body: Record<string, unknown> }>, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.rearrangeImageRevo({
                params: { productid: Number(request.params.productid) },
                body: request.body
            });
            if (this.isSuccessfulOperation(result)) {
                const message = 'Image Rearranged successfully';
                this.sendSuccessResponse(reply, { message });
            } else {
                this.sendErrorResponse(reply, 500, result);
            }
        } catch (error) {
            this.handleError(error, reply, 'rearrangeImageRevo');
        }
    }

    /**
     * Update removed from recycle bin
     */
    public updateRemovedFromRecyclebinRevo = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        try {
            const result = await this.productService.updateRemoveFromRecyclebinRevo();
            this.sendSuccessResponse(reply, result);
        } catch (error) {
            this.handleError(error, reply, 'updateRemovedFromRecyclebinRevo');
        }
    }

    // Private helper methods
    private sendSuccessResponse(reply: FastifyReply, data: unknown): void {
        console.log(data, ' Data is in controller ');
        reply.send(data);
    }

    private sendErrorResponse(reply: FastifyReply, statusCode: number, error: unknown): void {
        reply.status(statusCode).send(error instanceof Error ? error.message : String(error));
    }

    private handleError(error: unknown, reply: FastifyReply, methodName: string): void {
        console.error(`ERROR IN Controller ${methodName}:`, error);
        this.sendErrorResponse(reply, 500, error);
    }

    private isProductServiceResponse(result: ProductServiceResult): result is ProductServiceResponse {
        return 'command' in result && !('result' in result);
    }

    private isProductFileResponse(result: ProductServiceResult): result is ProductFileResponse {
        return 'result' in result && 'command' in result.result;
    }

    private isProductErrorResponse(result: ProductServiceResult): result is ProductErrorResponse {
        return 'errorMessage' in result;
    }

    private isSuccessfulOperation(result: ProductServiceResult): boolean {
        if (this.isProductServiceResponse(result)) {
            return result.command === 'INSERT' || result.command === 'UPDATE';
        }
        if (this.isProductFileResponse(result)) {
            return result.result.command === 'INSERT' || result.result.command === 'UPDATE';
        }
        return false;
    }

    private getOperationMessage(command: string, type: string = 'Product'): string {
        return `${type} ${command === 'UPDATE' ? 'Updated' : 'Inserted'} successfully`;
    }
}

// Export a singleton instance
export const productrevoController = new ProductRevoController();