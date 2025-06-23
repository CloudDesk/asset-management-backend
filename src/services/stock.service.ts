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

      // First, try to find the product by PUC if provided
      let linkedProduct = null;
      if (data.puc) {
        try {
          // Try to find product by puc field match first
          const products = await dynamicFindMany('product', {
            where: { puc: data.puc },
            take: 1
          });
          if (products && products.length > 0) {
            linkedProduct = products[0];
            logger.debug({ puc: data.puc, productId: linkedProduct?.id }, "Found linked product by PUC field match");
          } else {
            // Try by ID as fallback
            linkedProduct = await this.productService.findById(data.puc);
            logger.debug({ puc: data.puc, productId: linkedProduct?.id }, "Found linked product by PUC as ID");
          }
        } catch (error: any) {
          logger.warn(
            { error: error.message, puc: data.puc },
            "Could not find product by PUC, stock will be created without product link"
          );
        }
      }

      // Try to verify product exists if productId is provided (legacy support)
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
          puc: stock.puc,
          stockstatus: stock.stockstatus,
          ecompublish: stock.ecompublish,
          availableFields: Object.keys(stock),
        },
        "Dynamic stock create completed"
      );

      // Update product quantities based on the new stock
      // Priority: 1. Use stock.puc, 2. Use linked product, 3. Use legacy productId
      const productIdentifier = stock.puc || 
                               linkedProduct?.puc || 
                               linkedProduct?.id || 
                               stock.productId || 
                               stock.product_id;

      if (productIdentifier) {
        try {
          const updateResult = await this.productService.updateStockTotals(productIdentifier);
          logger.info(
            { 
              stockId: stock.id, 
              productIdentifier,
              stockstatus: stock.stockstatus,
              ecompublish: stock.ecompublish,
              updateResult 
            },
            "Successfully updated product quantities after stock creation"
          );
        } catch (error: any) {
          logger.error(
            { 
              error: error.message, 
              stockId: stock.id, 
              productIdentifier,
              stockstatus: stock.stockstatus,
              ecompublish: stock.ecompublish
            },
            "Failed to update product quantities after stock creation"
          );
        }
      } else {
        logger.warn(
          { stockId: stock.id },
          "No product identifier found, skipping product quantity update"
        );
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
          oldStockStatus: existingStock.stockstatus,
          newStockStatus: stock.stockstatus,
          oldEcomPublish: existingStock.ecompublish,
          newEcomPublish: stock.ecompublish,
          availableFields: Object.keys(stock),
        },
        "Dynamic stock update completed"
      );

      // Update product quantities if stock status or ecompublish changed, or if PUC changed
      const shouldUpdateProduct = (
        existingStock.stockstatus !== stock.stockstatus ||
        existingStock.ecompublish !== stock.ecompublish ||
        existingStock.puc !== stock.puc ||
        data.stockstatus !== undefined ||
        data.ecompublish !== undefined
      );

      if (shouldUpdateProduct) {
        // Update quantities for old product if PUC changed
        if (existingStock.puc !== stock.puc && existingStock.puc) {
          try {
            await this.updateProductByPuc(existingStock.puc, "Stock removed/moved");
          } catch (error) {
            logger.warn(
              { error, oldPuc: existingStock.puc },
              "Failed to update old product after PUC change"
            );
          }
        }

        // Update quantities for current product
        const productIdentifier = stock.puc || 
                                 existingStock.puc || 
                                 stock.productId || 
                                 stock.product_id ||
                                 existingStock.productId ||
                                 existingStock.product_id;

        if (productIdentifier) {
          try {
            const updateResult = await this.productService.updateStockTotals(productIdentifier);
            logger.info(
              { 
                stockId: id, 
                productIdentifier,
                oldStockStatus: existingStock.stockstatus,
                newStockStatus: stock.stockstatus,
                oldEcomPublish: existingStock.ecompublish,
                newEcomPublish: stock.ecompublish,
                updateResult 
              },
              "Successfully updated product quantities after stock update"
            );
          } catch (error) {
            logger.error(
              { 
                error, 
                stockId: id, 
                productIdentifier,
                changes: {
                  stockstatus: { from: existingStock.stockstatus, to: stock.stockstatus },
                  ecompublish: { from: existingStock.ecompublish, to: stock.ecompublish }
                }
              },
              "Failed to update product quantities after stock update"
            );
          }
        } else {
          logger.warn(
            { stockId: id },
            "No product identifier found, skipping product quantity update after stock update"
          );
        }
      } else {
        logger.debug(
          { stockId: id },
          "No relevant fields changed, skipping product quantity update"
        );
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

  // Helper method to update product by PUC
  private async updateProductByPuc(puc: string, reason: string) {
    try {
      const products = await dynamicFindMany('product', {
        where: { puc },
        take: 1
      });
      
      if (products && products.length > 0) {
        await this.productService.updateStockTotals(products[0].id || puc);
        logger.debug({ puc, reason }, "Updated product by PUC");
      }
    } catch (error) {
      logger.warn({ error, puc, reason }, "Failed to update product by PUC");
      // Try with PUC as ID fallback
      try {
        await this.productService.updateStockTotals(puc);
        logger.debug({ puc, reason }, "Updated product using PUC as ID");
      } catch (fallbackError) {
        logger.warn({ error: fallbackError, puc, reason }, "Failed to update product using PUC as ID");
      }
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
        { 
          stockId: id,
          deletedStockPuc: existingStock.puc,
          deletedStockStatus: existingStock.stockstatus,
          deletedStockEcompublish: existingStock.ecompublish
        },
        "Dynamic stock delete completed successfully"
      );

      // Update product quantities based on the deleted stock
      // Priority: 1. Use stock.puc, 2. Use legacy productId
      const productIdentifier = existingStock.puc || 
                               existingStock.productId || 
                               existingStock.product_id;

      if (productIdentifier) {
        try {
          const updateResult = await this.productService.updateStockTotals(productIdentifier);
          logger.info(
            { 
              stockId: id, 
              productIdentifier,
              deletedStockStatus: existingStock.stockstatus,
              deletedStockEcompublish: existingStock.ecompublish,
              updateResult 
            },
            "Successfully updated product quantities after stock deletion"
          );
        } catch (error: any) {
          logger.error(
            { 
              error: error.message, 
              stockId: id, 
              productIdentifier,
              deletedStockStatus: existingStock.stockstatus,
              deletedStockEcompublish: existingStock.ecompublish
            },
            "Failed to update product quantities after stock deletion"
          );
        }
      } else {
        logger.warn(
          { stockId: id },
          "No product identifier found, skipping product quantity update after delete"
        );
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
