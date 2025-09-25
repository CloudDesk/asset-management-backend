import { FastifyRequest, FastifyReply } from "fastify";
import { PlatformStockService } from "../services/platformStock.service.js";
import {
  CreatePlatformStockInput,
  UpdatePlatformStockInput,
  UpsertPlatformStockInput,
  validatePlatformStockDynamicFields,
} from "../schemas/platformStock.schema.js";
import { logger } from "../config/logger.js";
import { buildStockFilters } from "../utils/filterBuilder.js";

export class PlatformStockController {
  private platformStockService = new PlatformStockService();

  async getPlatformStocks(request: FastifyRequest, reply: FastifyReply) {
    try {
      const {
        page = "1",
        limit = "10",
        ...filters
      } = request.query as any;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);

      // Build filters from query parameters
      const filterOptions = buildStockFilters(filters);

      const result = await this.platformStockService.findMany(
        filterOptions,
        pageNum,
        limitNum
      );

      return reply.code(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, query: request.query },
        "Error in getPlatformStocks"
      );
      return reply.code(500).send({
        success: false,
        error: "Internal server error",
      });
    }
  }

  async getPlatformStockById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      const platformStock = await this.platformStockService.findById(id);

      return reply.code(200).send({
        success: true,
        data: platformStock,
        message: "Platform stock retrieved successfully",
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, id: (request.params as any).id },
        "Error in getPlatformStockById"
      );

      if (error.message.includes("not found")) {
        return reply.code(404).send({
          success: false,
          message: `Platform stock with ID ${(request.params as any).id} not found`,
          details: "The requested resource could not be found",
          statusCode: 404,
        });
      }

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
        details: "Something went wrong on the server",
        statusCode: 500,
      });
    }
  }

  async createPlatformStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as CreatePlatformStockInput & Record<string, any>;

      // Validate and clean dynamic fields
      const validatedData = validatePlatformStockDynamicFields(data);

      // Ensure required fields are present
      const createData = {
        ...validatedData,
        productId: validatedData.productId || Number(data.productId),
        platform: validatedData.platform || data.platform || 'nivapp'
      };

      const platformStock = await this.platformStockService.create(createData);

      return reply.code(201).send({
        success: true,
        data: platformStock,
        message: "Platform stock created successfully",
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, body: request.body },
        "Error in createPlatformStock"
      );

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
        details: "Something went wrong on the server",
        statusCode: 500,
      });
    }
  }

  async updatePlatformStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const data = request.body as UpdatePlatformStockInput & Record<string, any>;

      // Validate and clean dynamic fields
      const validatedData = validatePlatformStockDynamicFields(data);

      const platformStock = await this.platformStockService.update(id, validatedData);

      return reply.code(200).send({
        success: true,
        data: platformStock,
        message: "Platform stock updated successfully",
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, id: (request.params as any).id, body: request.body },
        "Error in updatePlatformStock"
      );

      if (error.message.includes("not found")) {
        return reply.code(404).send({
          success: false,
          message: `Platform stock with ID ${(request.params as any).id} not found`,
          details: "The requested resource could not be found",
          statusCode: 404,
        });
      }

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
        details: "Something went wrong on the server",
        statusCode: 500,
      });
    }
  }

  async deletePlatformStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      await this.platformStockService.delete(id);

      return reply.code(200).send({
        success: true,
        message: "Platform stock deleted successfully",
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, id: (request.params as any).id },
        "Error in deletePlatformStock"
      );

      if (error.message.includes("not found")) {
        return reply.code(404).send({
          success: false,
          message: `Platform stock with ID ${(request.params as any).id} not found`,
          details: "The requested resource could not be found",
          statusCode: 404,
        });
      }

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
        details: "Something went wrong on the server",
        statusCode: 500,
      });
    }
  }

  async upsertPlatformStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as UpsertPlatformStockInput & Record<string, any>;

      // Validate and clean dynamic fields
      const validatedData = validatePlatformStockDynamicFields(data);

      const platformStock = await this.platformStockService.upsert(validatedData);

      return reply.code(200).send({
        success: true,
        data: platformStock,
        message: "Platform stock upserted successfully",
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, body: request.body },
        "Error in upsertPlatformStock"
      );

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
        details: "Something went wrong on the server",
        statusCode: 500,
      });
    }
  }

  async getPlatformStocksByProduct(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId } = request.params as { productId: string };

      // Use the service to find platform stocks by product ID
      const filterOptions = buildStockFilters(
        { productId }
      );

      const result = await this.platformStockService.findMany(
        filterOptions,
        1,
        100 // Get all platform stocks for this product
      );

      return reply.code(200).send({
        success: true,
        data: result.data,
        message: `Platform stocks for product ${productId} retrieved successfully`,
      });
    } catch (error: any) {
      logger.error(
        { error: error.message, productId: (request.params as any).productId },
        "Error in getPlatformStocksByProduct"
      );

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
        details: "Something went wrong on the server",
        statusCode: 500,
      });
    }
  }
}
