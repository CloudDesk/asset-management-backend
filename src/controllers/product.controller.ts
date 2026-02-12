import { FastifyRequest, FastifyReply } from "fastify";
import { ProductService } from "../services/product.service.js";
import {
  createProductSchema,
  updateProductSchema,
  upsertProductSchema,
  productParamsSchema,
  ProductParams,
} from "../schemas/product.schema.js";
import { getPaginationParams } from "../utils/pagination.js";
import { createSuccessResponse, asyncHandler } from "../utils/errorHandler.js";
import {
  formatProductForAPI,
  formatEntitiesForAPI,
} from "../utils/dynamicDbOperations.js";
import { logger } from "../config/logger.js";

export class ProductController {
  public productService = new ProductService();

  getProducts = asyncHandler(
    async (
      request: FastifyRequest<{ Querystring: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);

      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;

      const result = await this.productService.findMany(filters, page, limit);

      // Format all products in the result
      const formattedData = formatEntitiesForAPI(result.data, "product");

      const response = createSuccessResponse(
        "Products retrieved successfully",
        formattedData
      );
      return reply.code(200).send({
        ...response,
        pagination: result.pagination,
        meta: {
          filters: Object.keys(filters),
          total: result.pagination.total,
          filtered: Object.keys(filters).length > 0,
        },
      });
    }
  );

  getProduct = asyncHandler(
    async (
      request: FastifyRequest<{ Params: ProductParams }>,
      reply: FastifyReply
    ) => {
      const { id } = productParamsSchema.parse(request.params);

      const product = await this.productService.findById(id);

      const response = createSuccessResponse(
        "Product retrieved successfully",
        formatProductForAPI(product)
      );
      return reply.code(200).send(response);
    }
  );

  createProduct = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = createProductSchema.parse(request.body);

      const product = await this.productService.create(data);

      const response = createSuccessResponse(
        "Product created successfully",
        formatProductForAPI(product)
      );
      return reply.code(201).send(response);
    }
  );

  updateProduct = asyncHandler(
    async (
      request: FastifyRequest<{ Params: ProductParams }>,
      reply: FastifyReply
    ) => {
      const { id } = productParamsSchema.parse(request.params);
      const data = updateProductSchema.parse(request.body);

      const product = await this.productService.update(id, data);

      const response = createSuccessResponse(
        "Product updated successfully",
        formatProductForAPI(product)
      );
      return reply.code(200).send(response);
    }
  );

  validateComboComponents = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { components?: Array<{ productid: string | number; requiredqty: number }> };

      if (!body.components || !Array.isArray(body.components)) {
        return reply.code(400).send({
          success: false,
          message: "Components array is required",
          details: "Please provide a components array with productid and requiredqty"
        });
      }

      const validationResult = await this.productService.validateComboComponents(body.components);

      if (validationResult.isValid) {
        return reply.code(200).send({
          success: true,
          isValid: true,
          message: validationResult.message
        });
      } else {
        return reply.code(409).send({
          success: false,
          isValid: false,
          message: validationResult.message,
          existingCombo: validationResult.existingCombo
        });
      }
    }
  );

  deleteProduct = asyncHandler(
    async (
      request: FastifyRequest<{ Params: ProductParams }>,
      reply: FastifyReply
    ) => {
      const { id } = productParamsSchema.parse(request.params);

      await this.productService.delete(id);

      const response = createSuccessResponse(
        "Product deleted successfully",
        null
      );
      return reply.code(200).send(response);
    }
  );

  upsertProduct = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = upsertProductSchema.parse(request.body);

      const product = await this.productService.upsert(data);

      const message = data.id
        ? "Product updated successfully"
        : "Product created successfully";
      const response = createSuccessResponse(
        message,
        formatProductForAPI(product)
      );
      return reply.code(200).send(response);
    }
  );

  upsertProductWithFile = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Debug request information
      logger.debug(
        {
          contentType: request.headers["content-type"],
          rawBody: request.body,
          bodyType: typeof request.body,
          bodyKeys: request.body ? Object.keys(request.body) : "no body",
        },
        "Request debugging info for upsertProductWithFile"
      );

      // Parse and validate the request body
      const requestBody = request.body as any;

      // Basic validation for required structure
      if (!requestBody) {
        return reply.code(400).send({
          success: false,
          message: "Request body is required",
          details: "Please provide product data and/or file URLs",
          statusCode: 400,
        });
      }

      // Validate URL structure if provided
      if (requestBody.url) {
        if (typeof requestBody.url !== "object") {
          return reply.code(400).send({
            success: false,
            message: "Invalid URL data format",
            details:
              "URL data must be an object with Large, Medium, and/or Small arrays",
            statusCode: 400,
          });
        }

        // Validate that URL arrays are actually arrays
        const { Large, Medium, Small } = requestBody.url;
        if (Large && !Array.isArray(Large)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid Large URL format",
            details: "Large URLs must be provided as an array",
            statusCode: 400,
          });
        }
        if (Medium && !Array.isArray(Medium)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid Medium URL format",
            details: "Medium URLs must be provided as an array",
            statusCode: 400,
          });
        }
        if (Small && !Array.isArray(Small)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid Small URL format",
            details: "Small URLs must be provided as an array",
            statusCode: 400,
          });
        }
      }

      // Validate productid if provided (should be numeric string or number)
      if (requestBody.productid) {
        const productId = requestBody.productid;
        if (typeof productId !== "string" && typeof productId !== "number") {
          return reply.code(400).send({
            success: false,
            message: "Invalid product ID format",
            details: "Product ID must be a string or number",
            statusCode: 400,
          });
        }

        // If it's a string, validate it's numeric
        if (typeof productId === "string" && !/^\d+$/.test(productId)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid product ID format",
            details: "Product ID must be a valid numeric value",
            statusCode: 400,
          });
        }
      }

      try {
        const result = await this.productService.upsertProductWithFile(
          requestBody
        );

        const message = requestBody.productid
          ? "Product updated successfully with file data"
          : "Product created successfully with file data";

        const response = createSuccessResponse(message, {
          product: formatProductForAPI(result.result),
          productId: result.productid,
          imageData: result.pathurldatas,
        });

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          { error: error.message, requestBody },
          "Error in upsertProductWithFile controller"
        );

        if (error.message.includes("not found")) {
          return reply.code(404).send({
            success: false,
            message: error.message,
            details: "The requested product could not be found",
            statusCode: 404,
          });
        }

        if (error.message.includes("already exists")) {
          return reply.code(400).send({
            success: false,
            message: error.message,
            details: "Duplicate entry detected",
            statusCode: 400,
          });
        }

        // Default error response
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
          details: "Something went wrong while processing the file upload",
          statusCode: 500,
        });
      }
    }
  );

  rearrangeProductImages = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = productParamsSchema.parse(request.params);
      const requestBody = request.body as any;

      // Validate request body structure
      if (!requestBody || typeof requestBody !== "object") {
        return reply.code(400).send({
          success: false,
          message: "Request body is required",
          details:
            "Please provide rearrangement data for large, medium, and/or small arrays",
          statusCode: 400,
        });
      }

      // Validate that at least one array is provided
      const { large, medium, small } = requestBody;
      if (!large && !medium && !small) {
        return reply.code(400).send({
          success: false,
          message: "No rearrangement data provided",
          details:
            "Please provide at least one of: large, medium, or small arrays",
          statusCode: 400,
        });
      }

      // Validate array formats
      if (large && !Array.isArray(large)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid large array format",
          details: "Large field must be an array of strings",
          statusCode: 400,
        });
      }
      if (medium && !Array.isArray(medium)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid medium array format",
          details: "Medium field must be an array of strings",
          statusCode: 400,
        });
      }
      if (small && !Array.isArray(small)) {
        return reply.code(400).send({
          success: false,
          message: "Invalid small array format",
          details: "Small field must be an array of strings",
          statusCode: 400,
        });
      }

      try {
        const result = await this.productService.rearrangeProductImages(id, {
          large,
          medium,
          small,
        });

        const response = createSuccessResponse(
          "Product images rearranged successfully",
          {
            product: formatProductForAPI(result),
            rearrangedArrays: Object.keys(requestBody).filter((key) =>
              ["large", "medium", "small"].includes(key)
            ),
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          { error: error.message, productId: id, requestBody },
          "Error in rearrangeProductImages controller"
        );

        if (error.message.includes("not found")) {
          return reply.code(404).send({
            success: false,
            message: error.message,
            details: "The requested product could not be found",
            statusCode: 404,
          });
        }

        if (error.message.includes("must contain exactly the same URLs")) {
          return reply.code(400).send({
            success: false,
            message: "Invalid rearrangement data",
            details: error.message,
            statusCode: 400,
          });
        }

        // Default error response
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
          details: "Something went wrong while rearranging product images",
          statusCode: 500,
        });
      }
    }
  );

  deleteProductImageUrls = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = productParamsSchema.parse(request.params);
      const requestBody = request.body as any;

      // Validate request body structure
      if (!requestBody || typeof requestBody !== "object") {
        return reply.code(400).send({
          success: false,
          message: "Request body is required",
          details:
            "Please provide URLs to delete from large, medium, and/or small arrays",
          statusCode: 400,
        });
      }

      // Validate that at least one array is provided
      const { large, medium, small } = requestBody;
      if (!large && !medium && !small) {
        return reply.code(400).send({
          success: false,
          message: "No deletion data provided",
          details:
            "Please provide at least one of: large, medium, or small arrays with URLs to delete",
          statusCode: 400,
        });
      }

      // Validate array formats and non-empty arrays
      if (large) {
        if (!Array.isArray(large) || large.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Invalid large array format",
            details: "Large field must be a non-empty array of strings",
            statusCode: 400,
          });
        }
      }
      if (medium) {
        if (!Array.isArray(medium) || medium.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Invalid medium array format",
            details: "Medium field must be a non-empty array of strings",
            statusCode: 400,
          });
        }
      }
      if (small) {
        if (!Array.isArray(small) || small.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Invalid small array format",
            details: "Small field must be a non-empty array of strings",
            statusCode: 400,
          });
        }
      }

      try {
        const result = await this.productService.deleteProductImageUrls(id, {
          large,
          medium,
          small,
        });

        const response = createSuccessResponse(
          "Product image URLs deleted successfully",
          {
            product: formatProductForAPI(result.product),
            deletionSummary: result.deletionSummary,
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          { error: error.message, productId: id, requestBody },
          "Error in deleteProductImageUrls controller"
        );

        if (error.message.includes("not found")) {
          return reply.code(404).send({
            success: false,
            message: error.message,
            details: "The requested product could not be found",
            statusCode: 404,
          });
        }

        if (error.message.includes("No URLs were found to delete")) {
          return reply.code(400).send({
            success: false,
            message: "No matching URLs found",
            details: error.message,
            statusCode: 400,
          });
        }

        // Default error response
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
          details: "Something went wrong while deleting product image URLs",
          statusCode: 500,
        });
      }
    }
  );

  // Add these methods to ProductController class

  getProductsForPlatform = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { platform: string },
        Querystring: Record<string, any>
      }>,
      reply: FastifyReply
    ) => {
      const { platform } = request.params;
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);

      // Extract sorting parameters
      const sortBy = allFilters.sortBy || 'createddate';
      const sortOrder = allFilters.sortOrder || 'desc';

      const { page: _, limit: __, sortBy: _sortBy, sortOrder: _sortOrder, ...filters } = allFilters;

      const result = await this.productService.findManyForPlatform(
        platform,
        filters,
        page,
        limit,
        sortBy,
        sortOrder
      );

      const formattedData = formatEntitiesForAPI(result.data, "product");

      // Transform data: remove platformStocks array and add availablequantity from platform stock
      const transformedData = formattedData.map((product: any) => {
        const { platformStocks, ...productWithoutPlatformStocks } = product;

        // Extract availablequantity from the platform stock (first item since we only fetch one)
        const platformStock = platformStocks && platformStocks[0];
        const availablequantity = platformStock?.availableqty ?? null;

        return {
          ...productWithoutPlatformStocks,
          availablequantity, // Add availablequantity from platform stock
        };
      });

      const response = createSuccessResponse(
        `Products for ${platform} platform retrieved successfully`,
        transformedData
      );

      return reply.code(200).send({
        ...response,
        pagination: result.pagination,
        meta: {
          platform,
          filters: Object.keys(filters),
          total: result.pagination.total,
          filtered: Object.keys(filters).length > 0,
          sortBy,
          sortOrder,
        },
      });
    }
  );

  getProductForPlatform = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { id: string; platform: string }
      }>,
      reply: FastifyReply
    ) => {
      const { id, platform } = request.params;

      const product = await this.productService.findByIdForPlatform(id, platform);

      const formattedProduct = formatProductForAPI(product);

      // Extract platformStock from platformStocks array and include it in the response
      const { platformStocks, ...transformedProduct } = formattedProduct;

      // Add platformStock (singular) - take the first record since we only fetch one per platform
      const platformStock = platformStocks && platformStocks[0] ? platformStocks[0] : null;

      const response = createSuccessResponse(
        `Product ${id} for ${platform} platform retrieved successfully`,
        {
          ...transformedProduct,
          platformStock // Include platform-specific stock data
        }
      );

      return reply.code(200).send(response);
    }
  );

  getProductCountsByCategory = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { platform: string }
      }>,
      reply: FastifyReply
    ) => {
      const { platform } = request.params;

      const result = await this.productService.getProductCountsByCategory(platform);

      const response = createSuccessResponse(
        `Product counts for ${platform} platform retrieved successfully`,
        result
      );

      return reply.code(200).send(response);
    }
  );
}
