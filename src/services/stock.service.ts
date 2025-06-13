import { prisma } from "../models/prisma.js";
import {
  CreateStockInput,
  UpdateStockInput,
  UpsertStockInput,
  validateStockDynamicFields,
} from "../schemas/stock.schema.js";
import {
  PaginationResult,
  createPaginationResult,
  getPrismaSkipTake,
} from "../utils/pagination.js";
import { buildStockFilters, FilterOptions } from "../utils/filterBuilder.js";
import {
  dynamicFindMany,
  dynamicCount,
  dynamicFindUnique,
  dynamicCreate,
  dynamicUpdate,
  dynamicDelete,
  dynamicFindManyWithFilters,
} from "../utils/dynamicDbOperations.js";
import { logger } from "../config/logger.js";
import { ProductService } from "./product.service.js";

export class StockService {
  private productService = new ProductService();

  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info(
        { filters, page, limit },
        "Starting dynamic stock findMany with filters"
      );

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: stocks, total } = await dynamicFindManyWithFilters(
        "stock",
        filters,
        {
          skip,
          take,
          useAllColumns: true, // Get all available columns
        }
      );

      logger.info(
        {
          stockCount: stocks.length,
          total,
          filtered: Object.keys(filters).length > 0,
          appliedFilters: Object.keys(filters),
          availableFields: stocks.length > 0 ? Object.keys(stocks[0]) : [],
        },
        "Dynamic stock findMany with filters completed"
      );

      return createPaginationResult(stocks, total, page, limit);
    } catch (error) {
      logger.error(
        { error, filters, page, limit },
        "Error in dynamic stock findMany operation"
      );
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug(
        { stockId: id },
        "Starting dynamic stock findById operation"
      );

      const stock = await dynamicFindUnique("stock", { id });

      if (!stock) {
        throw new Error("Stock not found");
      }

      logger.debug(
        {
          stockId: id,
          availableFields: Object.keys(stock),
        },
        "Dynamic stock findById completed"
      );

      return stock;
    } catch (error) {
      logger.error({ error, stockId: id }, "Error in stock findById operation");
      throw error;
    }
  }

  async create(data: CreateStockInput & Record<string, any>) {
    try {
      logger.debug(
        { originalData: data },
        "Starting dynamic stock create operation"
      );

      // Try to verify product exists if productId is provided
      if (data.productId || data.product_id) {
        try {
          const productId = data.productId || data.product_id;
          if (productId) {
            await this.productService.findById(productId);
            logger.debug({ productId }, "Product verification successful");
          }
        } catch (error) {
          logger.warn(
            { error, data },
            "Product verification failed, continuing with stock creation"
          );
        }
      }

      const stock = await dynamicCreate("stock", data);

      if (!stock) {
        throw new Error("Failed to create stock - no valid fields provided");
      }

      logger.info(
        {
          stockId: stock.id,
          availableFields: Object.keys(stock),
        },
        "Dynamic stock create completed"
      );

      // Try to update product stock totals if possible
      const productId = stock.productId || stock.product_id;
      if (productId) {
        try {
          await this.productService.updateStockTotals(productId);
        } catch (error) {
          logger.warn(
            { error, productId },
            "Failed to update product stock totals"
          );
        }
      }

      return stock;
    } catch (error) {
      logger.error({ error, data }, "Error in stock create operation");
      throw error;
    }
  }

  async update(id: string, data: UpdateStockInput & Record<string, any>) {
    try {
      // Check if stock exists
      const existingStock = await this.findById(id);

      logger.debug(
        { originalData: data, stockId: id },
        "Starting dynamic stock update operation"
      );

      const stock = await dynamicUpdate("stock", { id }, data);

      if (!stock) {
        throw new Error("Failed to update stock - no valid fields provided");
      }

      logger.info(
        {
          stockId: id,
          availableFields: Object.keys(stock),
        },
        "Dynamic stock update completed"
      );

      // Try to update product stock totals if possible
      const productId =
        existingStock.productId ||
        existingStock.product_id ||
        stock.productId ||
        stock.product_id;
      if (productId) {
        try {
          await this.productService.updateStockTotals(productId);
        } catch (error) {
          logger.warn(
            { error, productId },
            "Failed to update product stock totals"
          );
        }
      }

      return stock;
    } catch (error) {
      logger.error(
        { error, data, stockId: id },
        "Error in stock update operation"
      );
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if stock exists and get product info
      const existingStock = await this.findById(id);

      logger.debug({ stockId: id }, "Starting dynamic stock delete operation");

      const success = await dynamicDelete("stock", { id });

      if (!success) {
        throw new Error("Failed to delete stock");
      }

      logger.info(
        { stockId: id },
        "Dynamic stock delete completed successfully"
      );

      // Try to update product stock totals if possible
      const productId = existingStock.productId || existingStock.product_id;
      if (productId) {
        try {
          await this.productService.updateStockTotals(productId);
        } catch (error) {
          logger.warn(
            { error, productId },
            "Failed to update product stock totals after delete"
          );
        }
      }
    } catch (error) {
      logger.error({ error, stockId: id }, "Error in stock delete operation");
      throw error;
    }
  }

  async upsert(data: UpsertStockInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing stock by ID
        logger.debug(
          { stockId: id, data: updateData },
          "Upserting existing stock by ID"
        );
        return this.update(id, updateData);
      } else {
        // Try to find existing stock by unique fields
        let existingStock = null;

        // Strategy 1: Try to find by productId and batchNumber
        const productId = data.productId || data.product_id;
        const batchNumber = data.batchNumber || data.batch_number;

        if (productId && batchNumber) {
          try {
            const existingStocks = await dynamicFindMany("stock", {
              where: {
                OR: [
                  { productId, batchNumber },
                  { product_id: productId, batch_number: batchNumber },
                  { productId, batch_number: batchNumber },
                  { product_id: productId, batchNumber },
                ],
              },
              take: 1,
            });

            if (existingStocks.length > 0) {
              existingStock = existingStocks[0];
              logger.debug(
                { stockId: existingStock.id },
                "Found existing stock by productId and batchNumber"
              );
            }
          } catch (error) {
            logger.debug(
              { error },
              "Could not search by productId and batchNumber"
            );
          }
        }

        // Strategy 2: Try to find by RFID if not found yet
        if (!existingStock && (data.rfid || data.rfid === "")) {
          try {
            const existingStocks = await dynamicFindMany("stock", {
              where: { rfid: data.rfid },
              take: 1,
            });

            if (existingStocks.length > 0) {
              existingStock = existingStocks[0];
              logger.debug(
                { stockId: existingStock.id },
                "Found existing stock by RFID"
              );
            }
          } catch (error) {
            logger.debug({ error }, "Could not search by RFID");
          }
        }

        // Strategy 3: Try to find by serial number if not found yet
        if (!existingStock && (data.serialnumber || data.serialNumber)) {
          try {
            const serialNumber = data.serialnumber || data.serialNumber;
            const existingStocks = await dynamicFindMany("stock", {
              where: {
                OR: [
                  { serialnumber: serialNumber },
                  { serialNumber: serialNumber },
                ],
              },
              take: 1,
            });

            if (existingStocks.length > 0) {
              existingStock = existingStocks[0];
              logger.debug(
                { stockId: existingStock.id },
                "Found existing stock by serial number"
              );
            }
          } catch (error) {
            logger.debug({ error }, "Could not search by serial number");
          }
        }

        if (existingStock) {
          // Update existing stock
          logger.debug(
            { stockId: existingStock.id, data: updateData },
            "Upserting found existing stock"
          );
          return this.update(existingStock.id.toString(), updateData);
        } else {
          // Create new stock
          logger.debug(
            { data: updateData },
            "Upserting new stock (no existing found)"
          );
          return this.create(updateData);
        }
      }
    } catch (error) {
      logger.error({ error, data }, "Error in stock upsert operation");
      throw error;
    }
  }

  async findByProduct(productId: string) {
    try {
      logger.debug({ productId }, "Finding stocks by product");

      const stocks = await dynamicFindMany("stock", {
        where: {
          OR: [{ productId }, { product_id: productId }],
        },
        orderBy: { createdAt: "desc" },
      });

      logger.debug(
        { productId, stockCount: stocks.length },
        "Found stocks by product"
      );
      return stocks;
    } catch (error) {
      logger.error({ error, productId }, "Error finding stocks by product");
      throw error;
    }
  }

  async updateQuantities(
    id: string,
    quantities: {
      quantity?: number;
      availableQuantity?: number;
      soldQuantity?: number;
    }
  ) {
    try {
      const existingStock = await this.findById(id);

      logger.debug({ stockId: id, quantities }, "Updating stock quantities");

      // Map field names to handle both camelCase and snake_case
      const updateData: Record<string, any> = {};
      if (quantities.quantity !== undefined) {
        updateData.quantity = quantities.quantity;
      }
      if (quantities.availableQuantity !== undefined) {
        updateData.availableQuantity = quantities.availableQuantity;
        updateData.available_quantity = quantities.availableQuantity; // Also try snake_case
      }
      if (quantities.soldQuantity !== undefined) {
        updateData.soldQuantity = quantities.soldQuantity;
        updateData.sold_quantity = quantities.soldQuantity; // Also try snake_case
      }

      const stock = await dynamicUpdate("stock", { id }, updateData);

      if (!stock) {
        throw new Error(
          "Failed to update stock quantities - no valid fields provided"
        );
      }

      logger.info(
        { stockId: id, quantities },
        "Stock quantities updated successfully"
      );

      // Try to update product stock totals if possible
      const productId = existingStock.productId || existingStock.product_id;
      if (productId) {
        try {
          await this.productService.updateStockTotals(productId);
        } catch (error) {
          logger.warn(
            { error, productId },
            "Failed to update product stock totals after quantity update"
          );
        }
      }

      return stock;
    } catch (error) {
      logger.error(
        { error, stockId: id, quantities },
        "Error updating stock quantities"
      );
      throw error;
    }
  }
}
