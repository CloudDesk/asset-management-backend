import { prisma } from "../models/prisma.js";
import {
  CreatePlatformStockInput,
  UpdatePlatformStockInput,
  UpsertPlatformStockInput,
  validatePlatformStockDynamicFields,
} from "../schemas/platformStock.schema.js";
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

export class PlatformStockService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info(
        { filters, page, limit },
        "Starting dynamic platformStock findMany with filters"
      );

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: platformStocks, total } = await dynamicFindManyWithFilters(
        "platformstock",
        filters,
        {
          skip,
          take,
        }
      );

      const paginationResult = createPaginationResult(
        platformStocks,
        total,
        page,
        limit
      );

      logger.info(
        {
          total,
          returned: platformStocks.length,
          page,
          limit,
        },
        "Dynamic platformStock findMany completed"
      );

      return paginationResult;
    } catch (error: any) {
      logger.error(
        { error: error.message, filters, page, limit },
        "Error in dynamic platformStock findMany"
      );
      throw error;
    }
  }

  async findById(id: string | number): Promise<any> {
    try {
      logger.debug({ id }, "Starting platformStock findById");

      const platformStock = await dynamicFindUnique("platformstock", {
        where: { id: Number(id) },
      });

      if (!platformStock) {
        throw new Error(`PlatformStock with ID ${id} not found`);
      }

      logger.debug(
        { id, platformStockId: platformStock.id },
        "PlatformStock findById completed"
      );

      return platformStock;
    } catch (error: any) {
      logger.error(
        { error: error.message, id },
        "Error in platformStock findById"
      );
      throw error;
    }
  }

  async create(data: CreatePlatformStockInput & Record<string, any>) {
    try {
      logger.debug(
        { originalData: data },
        "Starting dynamic platformStock create operation"
      );

      const platformStock = await dynamicCreate("platformstock", data);

      if (!platformStock) {
        throw new Error("Failed to create platformStock - no valid fields provided");
      }

      logger.info(
        {
          platformStockId: platformStock.id,
          productId: platformStock.productId,
          platform: platformStock.platform,
          availableFields: Object.keys(platformStock),
        },
        "Dynamic platformStock create completed"
      );

      return platformStock;
    } catch (error: any) {
      logger.error(
        { error: error.message, data },
        "Error in dynamic platformStock create"
      );
      throw error;
    }
  }

  async update(id: string | number, data: UpdatePlatformStockInput & Record<string, any>) {
    try {
      logger.debug(
        { id, originalData: data },
        "Starting dynamic platformStock update operation"
      );

      const platformStock = await dynamicUpdate("platformstock", {
        where: { id: Number(id) },
        data,
      }, {});

      if (!platformStock) {
        throw new Error(`PlatformStock with ID ${id} not found`);
      }

      logger.info(
        {
          platformStockId: platformStock.id,
          productId: platformStock.productId,
          platform: platformStock.platform,
          updatedFields: Object.keys(data),
        },
        "Dynamic platformStock update completed"
      );

      return platformStock;
    } catch (error: any) {
      logger.error(
        { error: error.message, id, data },
        "Error in dynamic platformStock update"
      );
      throw error;
    }
  }

  async delete(id: string | number) {
    try {
      logger.debug({ id }, "Starting platformStock delete operation");

      const result = await dynamicDelete("platformstock", {
        where: { id: Number(id) },
      });

      if (!result) {
        throw new Error(`PlatformStock with ID ${id} not found`);
      }

      logger.info(
        { id, deletedPlatformStockId: id },
        "PlatformStock delete completed"
      );

      return result;
    } catch (error: any) {
      logger.error(
        { error: error.message, id },
        "Error in platformStock delete"
      );
      throw error;
    }
  }

  async upsert(data: UpsertPlatformStockInput & Record<string, any>) {
    try {
      logger.debug(
        { originalData: data },
        "Starting dynamic platformStock upsert operation"
      );

      // For upsert, we need to use the productId and platform as unique identifiers
      const { productId, platform, ...updateData } = data;

      if (!productId || !platform) {
        throw new Error("productId and platform are required for upsert operation");
      }

      // Try to find existing platformStock
      let existingPlatformStock = null;
      try {
        const existingStocks = await dynamicFindMany('platformstock', {
          where: {
            productId: Number(productId),
            platform: platform,
          },
          take: 1
        });
        if (existingStocks && existingStocks.length > 0) {
          existingPlatformStock = existingStocks[0];
        }
      } catch (error: any) {
        logger.debug({ error: error.message }, "No existing platformStock found");
      }

      let platformStock;
      if (existingPlatformStock) {
        // Update existing
        platformStock = await this.update(existingPlatformStock.id, updateData);
        logger.info(
          { platformStockId: platformStock.id, action: "updated" },
          "PlatformStock upsert - updated existing"
        );
      } else {
        // Create new - ensure required fields are present
        const createData = {
          productId: Number(productId),
          platform: platform,
          ...updateData
        };
        platformStock = await this.create(createData);
        logger.info(
          { platformStockId: platformStock.id, action: "created" },
          "PlatformStock upsert - created new"
        );
      }

      return platformStock;
    } catch (error: any) {
      logger.error(
        { error: error.message, data },
        "Error in dynamic platformStock upsert"
      );
      throw error;
    }
  }

  /**
   * Update platform stock quantities based on stock changes
   * Handles multiple business scenarios:
   * 1. Platform transfers (decrease old platform, increase new platform)
   * 2. E-com publish changes (increase/decrease available quantity)
   * 3. Stock status changes (available/sold)
   * 4. Stock deletions (decrease quantities)
   * 5. New stock additions (increase quantities)
   */
  async updatePlatformStockQuantities(
    productId: number,
    platform: string,
    stockInfo: {
      ecompublish?: boolean;
      stockstatus?: string;
      quantity?: number;
      isNewStock?: boolean;
      operation?: 'create' | 'update' | 'delete' | 'transfer';
      oldPlatform?: string; // For platform transfers
      oldEcompublish?: boolean; // For e-com changes
      oldStockstatus?: string; // For status changes
    }
  ) {
    try {
      logger.debug(
        { productId, platform, stockInfo },
        "Starting platform stock quantities update"
      );

      const operation = stockInfo.operation || (stockInfo.isNewStock ? 'create' : 'update');
      
      let availableQtyChange = 0;
      let soldQtyChange = 0;
      let totalQtyChange = 0;

      // Handle different operations
      switch (operation) {
        case 'create':
          // New stock added
          if (stockInfo.ecompublish && stockInfo.stockstatus === 'available') {
            availableQtyChange = 1;
            totalQtyChange = 1;
          }
          break;

        case 'delete':
          // Stock deleted - decrease quantities
          if (stockInfo.ecompublish && stockInfo.stockstatus === 'available') {
            availableQtyChange = -1;
            totalQtyChange = -1;
          } else if (stockInfo.stockstatus === 'sold') {
            soldQtyChange = -1;
            totalQtyChange = -1;
          }
          break;

        case 'transfer':
          // Platform transfer - handled separately in transferStockBetweenPlatforms
          return await this.transferStockBetweenPlatforms(
            productId,
            stockInfo.oldPlatform!,
            platform,
            stockInfo
          );

        case 'update':
        default:
          // Handle status changes
          if (stockInfo.oldStockstatus !== stockInfo.stockstatus) {
            if (stockInfo.oldStockstatus === 'available' && stockInfo.stockstatus === 'sold') {
              availableQtyChange = -1;
              soldQtyChange = 1;
            } else if (stockInfo.oldStockstatus === 'sold' && stockInfo.stockstatus === 'available') {
              availableQtyChange = 1;
              soldQtyChange = -1;
            }
          }

          // Handle e-com publish changes
          if (stockInfo.oldEcompublish !== stockInfo.ecompublish && stockInfo.stockstatus === 'available') {
            if (stockInfo.ecompublish && !stockInfo.oldEcompublish) {
              // E-com enabled - increase available
              availableQtyChange += 1;
            } else if (!stockInfo.ecompublish && stockInfo.oldEcompublish) {
              // E-com disabled - decrease available
              availableQtyChange -= 1;
            }
          }
          break;
      }

      // Skip if no changes
      if (availableQtyChange === 0 && soldQtyChange === 0 && totalQtyChange === 0) {
        logger.debug(
          { productId, platform, operation },
          "No quantity changes needed for platform stock"
        );
        return null;
      }

      // Use upsert to create or update platform stock
      // First try to find existing record
      let existingRecord = null;
      try {
        const existingRecords = await dynamicFindMany('platformstock', {
          where: {
            productId: productId,
            platform: platform,
          },
          take: 1
        });
        if (existingRecords && existingRecords.length > 0) {
          existingRecord = existingRecords[0];
        }
      } catch (error) {
        // Record doesn't exist, will create new
      }

      let platformStock;
      if (existingRecord) {
        // Update existing record
        platformStock = await dynamicUpdate('platformstock', {
          where: { id: existingRecord.id },
          data: {
            availableQty: existingRecord.availableQty + availableQtyChange,
            soldQty: existingRecord.soldQty + soldQtyChange,
            totalQty: existingRecord.totalQty + totalQtyChange,
            modifieddate: Date.now(),
          }
        }, {});
      } else {
        // Create new record
        platformStock = await dynamicCreate('platformstock', {
          productId: productId,
          platform: platform,
          availableQty: Math.max(0, availableQtyChange),
          soldQty: Math.max(0, soldQtyChange),
          totalQty: Math.max(0, totalQtyChange),
          orderedQty: 0,
          lockQty: 0,
          createddate: Date.now(),
          modifieddate: Date.now(),
        });
      }

      logger.info(
        {
          platformStockId: platformStock.id,
          productId,
          platform,
          operation,
          changes: {
            availableQtyChange,
            soldQtyChange,
            totalQtyChange,
          },
          finalQuantities: {
            availableQty: platformStock.availableQty,
            soldQty: platformStock.soldQty,
            totalQty: platformStock.totalQty,
          },
        },
        "Platform stock quantities updated successfully"
      );

      return platformStock;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, platform, stockInfo },
        "Error updating platform stock quantities"
      );
      throw error;
    }
  }

  /**
   * Transfer stock between platforms
   * Decreases quantities from old platform and increases in new platform
   */
  async transferStockBetweenPlatforms(
    productId: number,
    fromPlatform: string,
    toPlatform: string,
    stockInfo: {
      ecompublish?: boolean;
      stockstatus?: string;
      quantity?: number;
    }
  ) {
    try {
      logger.debug(
        { productId, fromPlatform, toPlatform, stockInfo },
        "Starting platform stock transfer"
      );

      // Only transfer if e-com is published and stock is available
      if (!stockInfo.ecompublish || stockInfo.stockstatus !== 'available') {
        logger.debug(
          { productId, fromPlatform, toPlatform },
          "Skipping platform transfer - stock not e-com published or not available"
        );
        return null;
      }

      // Decrease from old platform
      let fromPlatformStock = null;
      try {
        const fromRecords = await dynamicFindMany('platformstock', {
          where: {
            productId: productId,
            platform: fromPlatform,
          },
          take: 1
        });
        
        if (fromRecords && fromRecords.length > 0) {
          const fromRecord = fromRecords[0];
          fromPlatformStock = await dynamicUpdate('platformstock', {
            where: { id: fromRecord.id },
            data: {
              availableQty: Math.max(0, fromRecord.availableQty - 1),
              totalQty: Math.max(0, fromRecord.totalQty - 1),
              modifieddate: Date.now(),
            }
          }, {});
        } else {
          // Create with 0 quantities
          fromPlatformStock = await dynamicCreate('platformstock', {
            productId: productId,
            platform: fromPlatform,
            availableQty: 0,
            soldQty: 0,
            totalQty: 0,
            orderedQty: 0,
            lockQty: 0,
            createddate: Date.now(),
            modifieddate: Date.now(),
          });
        }
      } catch (error: any) {
        logger.error({ error: error.message, productId, fromPlatform }, "Error updating from platform stock");
      }

      // Increase in new platform
      let toPlatformStock = null;
      try {
        const toRecords = await dynamicFindMany('platformstock', {
          where: {
            productId: productId,
            platform: toPlatform,
          },
          take: 1
        });
        
        if (toRecords && toRecords.length > 0) {
          const toRecord = toRecords[0];
          toPlatformStock = await dynamicUpdate('platformstock', {
            where: { id: toRecord.id },
            data: {
              availableQty: toRecord.availableQty + 1,
              totalQty: toRecord.totalQty + 1,
              modifieddate: Date.now(),
            }
          }, {});
        } else {
          // Create new record
          toPlatformStock = await dynamicCreate('platformstock', {
            productId: productId,
            platform: toPlatform,
            availableQty: 1,
            soldQty: 0,
            totalQty: 1,
            orderedQty: 0,
            lockQty: 0,
            createddate: Date.now(),
            modifieddate: Date.now(),
          });
        }
      } catch (error: any) {
        logger.error({ error: error.message, productId, toPlatform }, "Error updating to platform stock");
      }

      logger.info(
        {
          productId,
          fromPlatform,
          toPlatform,
          fromPlatformStock: {
            id: fromPlatformStock.id,
            availableQty: fromPlatformStock.availableQty,
            totalQty: fromPlatformStock.totalQty,
          },
          toPlatformStock: {
            id: toPlatformStock.id,
            availableQty: toPlatformStock.availableQty,
            totalQty: toPlatformStock.totalQty,
          },
        },
        "Platform stock transfer completed successfully"
      );

      return { fromPlatformStock, toPlatformStock };
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, fromPlatform, toPlatform, stockInfo },
        "Error transferring stock between platforms"
      );
      throw error;
    }
  }

  /**
   * Get platform stock for a specific product and platform
   */
  async getByProductAndPlatform(productId: number, platform: string) {
    try {
      const platformStocks = await dynamicFindMany('platformstock', {
        where: {
          productId: productId,
          platform: platform,
        },
        take: 1
      });

      return platformStocks && platformStocks.length > 0 ? platformStocks[0] : null;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, platform },
        "Error getting platform stock by product and platform"
      );
      throw error;
    }
  }
}
