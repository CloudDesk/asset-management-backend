import { FastifyRequest, FastifyReply } from "fastify";
import { productrevoService } from "../services/productrevo.service.js";
import uploadtos3 from "../aws/uploadtos3.js";
import { 
  ProductParams, 
  ProductQueryParams, 
  ProductResponse,
  ProductControllerResponse,
  ProductLockData,
  ProductImageData
} from "../interfaces/product.interface.js";

export class ProductRevoController {
  private productRevoService: typeof productrevoService;

  constructor() {
    this.productRevoService = productrevoService;
  }

  public async getProductsrevoData(
    request: FastifyRequest<{ Querystring: ProductQueryParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
        console.log("request.query in get productsrevo data", request.query);    
      const result = await productrevoService.getProductsData(request.query);
    
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);
    }
  }

  public async getProductById(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.getProductById(request.params.id);
  
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async deleteProduct(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.deleteProduct(request.params.id);

      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async upsertProductWithFile(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.upsertProductwithFileRevo(request);
     
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async upsertProductWithFileGcp(
    request: FastifyRequest<{ Body: { productid: number; url: string } }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.upsertProductwithfileRevogcp(request);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async bulkupsertProducttosetZero(
    request: FastifyRequest<{ Body: { data: any[]; setZero: boolean } }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.bulkupsertProducttosetZero(request);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async getArcheivedProductsrevo(
    request: FastifyRequest<{ Querystring: ProductQueryParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.getArcheivedProductsrevo(request);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async getEachProductsRevo(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.getEachProductsRevo(request.params.id);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async updateOrderedQuantityarray(
    request: FastifyRequest<{ Body: { data: { id: number; orderedquantity: number }[] } }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.updateOrderedQuantityarray(request);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async rearrangeImageRevo(
    request: FastifyRequest<{ Body: { productid: number; image: string[] } }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.rearrangeImageRevo(request);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async updateRemoveFromRecyclebinRevo(
    request: FastifyRequest<{ Params: ProductParams }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.updateRemoveFromRecyclebinRevo(request.params.id);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }

  public async upsertProduct(
    request: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ): Promise<ProductResponse> {
    try {
      const result = await this.productRevoService.upsertProduct(request.body);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(500).send(error.message);

    }
  }
}

export const productrevoController = new ProductRevoController();