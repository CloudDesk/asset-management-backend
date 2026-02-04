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
  /**
   * Calculate platform status based on available quantity
   * @param availableqty - Available quantity
   * @returns Platform status string
   */
  private calculatePlatformStatus(availableqty: number): string {
    if (availableqty === 0) {
      return 'out_of_stock';
    } else if (availableqty > 5) {
      return 'in_stock';
    } else {
      return 'low_stock';
    }
  }
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

      // Calculate platform status based on availableqty if provided
      const availableqty = data.availableqty || 0;
      const platformStatus = this.calculatePlatformStatus(Number(availableqty));

      // Add platform status and date fields to create data
      const dataWithStatus = {
        ...data,
        platformstatus: platformStatus,

      };

      const platformStock = await dynamicCreate("platformstock", dataWithStatus);

      if (!platformStock) {
        throw new Error("Failed to create platformStock - no valid fields provided");
      }

      logger.info(
        {
          platformStockId: platformStock.id,
          productId: platformStock.productId,
          platform: platformStock.platform,
          platformStatus: platformStatus,
          availableqty: availableqty,
          availableFields: Object.keys(platformStock),
        },
        "Dynamic platformStock create completed with calculated status"
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

      // Calculate platform status based on availableqty if provided
      const availableqty = data.availableqty;
      let dataWithStatus = { ...data };

      if (availableqty !== undefined) {
        const platformStatus = this.calculatePlatformStatus(Number(availableqty));
        dataWithStatus.platformstatus = platformStatus;

        logger.debug(
          {
            id,
            availableqty,
            calculatedPlatformStatus: platformStatus,
            dataToPassToDynamicUpdate: dataWithStatus,
            dataKeys: Object.keys(dataWithStatus),
            dataValues: Object.values(dataWithStatus)
          },
          "Data being passed to dynamicUpdate with calculated platform status"
        );
      } else {


        logger.debug(
          {
            id,
            dataToPassToDynamicUpdate: dataWithStatus,
            dataKeys: Object.keys(dataWithStatus),
            dataValues: Object.values(dataWithStatus)
          },
          "Data being passed to dynamicUpdate (no availableqty change)"
        );
      }

      const platformStock = await dynamicUpdate("platformstock", { id: Number(id) }, dataWithStatus);

      if (!platformStock) {
        throw new Error(`PlatformStock with ID ${id} not found`);
      }

      logger.info(
        {
          platformStockId: platformStock.id,
          productId: platformStock.productId,
          platform: platformStock.platform,
          updatedFields: Object.keys(dataWithStatus),
          platformStatus: dataWithStatus.platformstatus,
          availableqty: availableqty,
        },
        "Dynamic platformStock update completed with calculated status"
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

      // For upsert, we need to use the productid and platform as unique identifiers
      const { productid, platform, ...updateData } = data;

      logger.debug(
        {
          originalData: data,
          productid,
          platform,
          updateData
        },
        "Upsert method - destructured data"
      );

      if (!productid || !platform) {
        throw new Error("productid and platform are required for upsert operation");
      }

      // Try to find existing platformStock
      let existingPlatformStock = null;
      try {
        const existingStocks = await dynamicFindMany('platformstock', {
          where: {
            productid: Number(productid),
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

      // Calculate platform status based on availableqty if provided
      const availableqty = updateData.availableqty || existingPlatformStock?.availableqty || 0;
      const platformStatus = this.calculatePlatformStatus(Number(availableqty));

      // Add platform status and date fields to update data
      const dataWithStatus = {
        ...updateData,
        platformstatus: platformStatus
      };

      let platformStock;
      if (existingPlatformStock) {
        // Update existing
        platformStock = await this.update(existingPlatformStock.id, dataWithStatus);
        logger.info(
          {
            platformStockId: platformStock.id,
            action: "updated",
            platformStatus: platformStatus,
            availableqty: availableqty
          },
          "PlatformStock upsert - updated existing with calculated status"
        );
      } else {
        // Create new - ensure required fields are present
        const createData = {
          productid: Number(productid),
          platform: platform,
          ...dataWithStatus,
        };

        // Ensure productid is defined
        if (!createData.productid) {
          throw new Error("productid is required for creating platform stock");
        }
        platformStock = await this.create(createData);
        logger.info(
          {
            platformStockId: platformStock.id,
            action: "created",
            platformStatus: platformStatus,
            availableqty: availableqty
          },
          "PlatformStock upsert - created new with calculated status"
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

      let ecomQtyChange = 0; // Track e-commerce published quantity changes
      let soldQtyChange = 0;
      let totalQtyChange = 0;

      // Handle different operations
      switch (operation) {
        case 'create':
          // New stock added
          const quantityToAdd = stockInfo.quantity || 1; // Use provided quantity or default to 1
          if (stockInfo.stockstatus === 'available') {
            totalQtyChange = quantityToAdd; // Increase total quantity by provided quantity (ALL stocks)
            // Only increase ecomqty if e-commerce published
            if (stockInfo.ecompublish === true) {
              ecomQtyChange = quantityToAdd; // Increase e-commerce quantity if e-commerce enabled
            }
          } else if (stockInfo.stockstatus === 'sold') {
            totalQtyChange = quantityToAdd; // Increase total quantity by provided quantity
            soldQtyChange = quantityToAdd; // Increase sold quantity by provided quantity
          } else if (stockInfo.stockstatus === 'ordered') {
            totalQtyChange = quantityToAdd; // Increase total quantity by provided quantity
            // orderedqty is handled separately in the upsert logic
          }
          break;

        case 'delete':
          // Stock deleted - decrease quantities
          const quantityToRemove = stockInfo.quantity || 1; // Use provided quantity or default to 1
          if (stockInfo.stockstatus === 'available') {
            totalQtyChange = -quantityToRemove; // Decrease total quantity by provided quantity
            // Only decrease ecomqty if e-commerce was enabled
            if (stockInfo.ecompublish === true) {
              ecomQtyChange = -quantityToRemove; // Decrease e-commerce quantity if e-commerce was enabled
            }
          } else if (stockInfo.stockstatus === 'sold') {
            soldQtyChange = -quantityToRemove;
            totalQtyChange = -quantityToRemove;
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
          // IMPORTANT: Track ecomqty changes (only for available + ecompublish=true stocks)
          if (stockInfo.oldStockstatus !== stockInfo.stockstatus) {
            if (stockInfo.oldStockstatus === 'available' && stockInfo.stockstatus === 'sold') {
              // Stock moved from available to sold
              // Only decrease ecomqty if it was e-commerce published
              if (stockInfo.oldEcompublish === true || stockInfo.ecompublish === true) {
                ecomQtyChange = -1;
              }
              soldQtyChange = 1;
            } else if (stockInfo.oldStockstatus === 'sold' && stockInfo.stockstatus === 'available') {
              // Stock moved from sold to available
              // Only increase ecomqty if e-commerce published
              if (stockInfo.ecompublish === true) {
                ecomQtyChange = 1;
              }
              soldQtyChange = -1;
            }
          }

          // Handle e-com publish changes
          // Only applies when stock is in 'available' status
          if (stockInfo.oldEcompublish !== stockInfo.ecompublish && stockInfo.stockstatus === 'available') {
            if (stockInfo.ecompublish && !stockInfo.oldEcompublish) {
              // E-com enabled - increase ecomqty
              ecomQtyChange += 1;
            } else if (!stockInfo.ecompublish && stockInfo.oldEcompublish) {
              // E-com disabled - decrease ecomqty
              ecomQtyChange -= 1;
            }
          }
          break;
      }

      // Skip if no changes
      if (ecomQtyChange === 0 && soldQtyChange === 0 && totalQtyChange === 0) {
        logger.debug(
          { productId, platform, operation },
          "No quantity changes needed for platform stock"
        );
        return null;
      }

      // Use the existing upsert method to handle create or update
      // First get the current record to calculate new quantities
      let currentRecord = null;
      try {
        const existingRecords = await dynamicFindMany('platformstock', {
          where: {
            productid: productId,
            platform: platform,
          },
          take: 1
        });
        if (existingRecords && existingRecords.length > 0) {
          currentRecord = existingRecords[0];
        }
      } catch (error: any) {
        logger.debug({ error: error.message, productId, platform }, "No existing platform stock record found");
      }

      // Calculate new quantities - convert BigInt to Number for calculations
      const currentEcomQty = currentRecord ? Number(currentRecord.ecomqty || 0) : 0;
      const currentSoldQty = currentRecord ? Number(currentRecord.soldqty) : 0;
      const currentTotalQty = currentRecord ? Number(currentRecord.totalqty) : 0;
      const currentOrderedQty = currentRecord ? Number(currentRecord.orderedqty || 0) : 0;
      const currentLockQty = currentRecord ? Number(currentRecord.lockqty || 0) : 0;

      // Update ecomqty, totalqty, soldqty
      const newEcomQty = Math.max(0, currentEcomQty + ecomQtyChange);
      const newSoldQty = Math.max(0, currentSoldQty + soldQtyChange);
      const newTotalQty = Math.max(0, currentTotalQty + totalQtyChange);

      // Calculate availableqty using formula: ecomqty - orderedqty - soldqty - lockqty
      const newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - newSoldQty - currentLockQty);

      logger.debug(
        {
          productId,
          platform,
          currentRecord: currentRecord ? {
            ecomqty: currentRecord.ecomqty || 0,
            availableqty: currentRecord.availableqty,
            soldqty: currentRecord.soldqty,
            totalqty: currentRecord.totalqty,
            orderedqty: currentRecord.orderedqty || 0,
            lockqty: currentRecord.lockqty || 0
          } : null,
          calculatedNewValues: {
            newEcomQty,
            newAvailableQty,
            newSoldQty,
            newTotalQty
          },
          changes: {
            ecomQtyChange,
            soldQtyChange,
            totalQtyChange
          },
          formula: {
            availableqty: `${newEcomQty} - ${currentOrderedQty} - ${newSoldQty} - ${currentLockQty} = ${newAvailableQty}`
          }
        },
        "PlatformStock quantity calculations"
      );

      // Calculate platform status based on new available quantity
      const platformStatus = this.calculatePlatformStatus(newAvailableQty);

      // Use upsert to create or update
      const upsertData = {
        productid: productId,
        platform: platform,
        ecomqty: newEcomQty,
        availableqty: newAvailableQty,
        soldqty: newSoldQty,
        totalqty: newTotalQty,
        orderedqty: currentOrderedQty,
        lockqty: currentLockQty,
        platformstatus: platformStatus,
      };

      logger.debug(
        {
          upsertData,
          currentRecord: currentRecord ? {
            orderedqty: currentRecord.orderedqty,
            lockqty: currentRecord.lockqty
          } : null
        },
        "About to call upsert with data"
      );

      const platformStock = await this.upsert(upsertData);

      logger.info(
        {
          platformStockId: platformStock.id,
          productId,
          platform,
          operation,
          changes: {
            ecomQtyChange,
            soldQtyChange,
            totalQtyChange,
          },
          finalQuantities: {
            ecomqty: platformStock.ecomqty || 0,
            availableqty: platformStock.availableqty,
            soldqty: platformStock.soldqty,
            totalqty: platformStock.totalqty,
            orderedqty: platformStock.orderedqty || 0,
            lockqty: platformStock.lockqty || 0,
          },
          platformStatus: platformStatus,
        },
        "Platform stock quantities and status updated successfully"
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
            productid: productId,
            platform: fromPlatform,
          },
          take: 1
        });

        if (fromRecords && fromRecords.length > 0) {
          const fromRecord = fromRecords[0];
          const currentEcomQty = Number(fromRecord.ecomqty || 0);
          const currentOrderedQty = Number(fromRecord.orderedqty || 0);
          const currentSoldQty = Number(fromRecord.soldqty || 0);
          const currentLockQty = Number(fromRecord.lockqty || 0);
          
          const newEcomQty = Math.max(0, currentEcomQty - 1);
          const newTotalQty = Math.max(0, Number(fromRecord.totalqty) - 1);
          const newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - currentSoldQty - currentLockQty);
          
          fromPlatformStock = await dynamicUpdate('platformstock', { id: fromRecord.id }, {
            ecomqty: newEcomQty,
            availableqty: newAvailableQty,
            totalqty: newTotalQty,
          });
        } else {
          // Create with 0 quantities
          fromPlatformStock = await dynamicCreate('platformstock', {
            productid: productId,
            platform: fromPlatform,
            ecomqty: 0,
            availableqty: 0,
            soldqty: 0,
            totalqty: 0,
            orderedqty: 0,
            lockqty: 0,
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
            productid: productId,
            platform: toPlatform,
          },
          take: 1
        });

        if (toRecords && toRecords.length > 0) {
          const toRecord = toRecords[0];
          const currentEcomQty = Number(toRecord.ecomqty || 0);
          const currentOrderedQty = Number(toRecord.orderedqty || 0);
          const currentSoldQty = Number(toRecord.soldqty || 0);
          const currentLockQty = Number(toRecord.lockqty || 0);
          
          const newEcomQty = currentEcomQty + 1;
          const newTotalQty = Number(toRecord.totalqty) + 1;
          const newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - currentSoldQty - currentLockQty);
          
          toPlatformStock = await dynamicUpdate('platformstock', { id: toRecord.id }, {
            ecomqty: newEcomQty,
            availableqty: newAvailableQty,
            totalqty: newTotalQty,
          });
        } else {
          // Create new record
          toPlatformStock = await dynamicCreate('platformstock', {
            productid: productId,
            platform: toPlatform,
            ecomqty: 1,
            availableqty: 1,
            soldqty: 0,
            totalqty: 1,
            orderedqty: 0,
            lockqty: 0,
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
            availableqty: fromPlatformStock.availableqty,
            totalqty: fromPlatformStock.totalqty,
          },
          toPlatformStock: {
            id: toPlatformStock.id,
            availableqty: toPlatformStock.availableqty,
            totalqty: toPlatformStock.totalqty,
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
          productid: productId,
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

  /**
   * Recalculate PlatformStock quantities from scratch (similar to Product.updateStockTotals)
   * Counts actual stocks and recalculates all quantities
   * 
   * Formula:
   * - totalqty = Count of ALL stocks for this product+platform
   * - ecomqty = Count of stocks where stockstatus = 'available' AND ecompublish = true
   * - soldqty = Count of stocks where stockstatus = 'sold'
   * - availableqty = ecomqty - orderedqty - soldqty - lockqty
   */
  async recalculatePlatformStockQuantities(
    productId: number,
    platform: string
  ): Promise<any> {
    try {
      logger.debug(
        { productId, platform },
        "Starting PlatformStock recalculation from scratch"
      );

      // Find product by ID to get PUC
      const product = await dynamicFindUnique('product', { id: productId });
      if (!product || !product.puc) {
        logger.warn({ productId }, "Product not found or has no PUC, skipping recalculation");
        return null;
      }

      // Find all stocks for this product+platform
      const stocks = await dynamicFindMany('stock', {
        where: {
          puc: product.puc,
          platform: platform,
          isdeleted: { not: true },
          isarchive: { not: true }
        },
      });

      if (!Array.isArray(stocks) || stocks.length === 0) {
        logger.debug({ productId, platform }, "No active stocks found, setting quantities to zero");
        
        const updateData = {
          totalqty: 0,
          ecomqty: 0,
          soldqty: 0,
          availableqty: 0,
          platformstatus: 'out_of_stock',
          modifieddate: BigInt(Date.now())
        };

        const existing = await dynamicFindMany('platformstock', {
          where: {
            productid: productId,
            platform: platform
          },
          take: 1
        });

        if (existing && existing.length > 0) {
          const currentRecord = existing[0];
          await dynamicUpdate('platformstock', { id: currentRecord.id }, {
            ...updateData,
            orderedqty: currentRecord.orderedqty || 0,
            lockqty: currentRecord.lockqty || 0
          });
        } else {
          await dynamicCreate('platformstock', {
            productid: productId,
            platform: platform,
            ...updateData,
            orderedqty: 0,
            lockqty: 0
          });
        }

        return updateData;
      }

      // Calculate totals from actual stock records
      let totalQty = 0;
      let ecomQty = 0;
      let soldQty = 0;

      stocks.forEach(stock => {
        const stockStatus = stock.stockstatus?.toLowerCase();

        // totalqty = ALL stocks (regardless of status or ecompublish)
        totalQty += 1;

        if (stockStatus === 'available') {
          // ecomqty = Only available stocks with ecompublish = true
          if (stock.ecompublish === true) {
            ecomQty += 1;
          }
        } else if (stockStatus === 'sold') {
          soldQty += 1;
        }
      });

      // Get current orderedqty and lockqty (these are not recalculated from stocks)
      const existing = await dynamicFindMany('platformstock', {
        where: {
          productid: productId,
          platform: platform
        },
        take: 1
      });

      const currentOrderedQty = existing && existing.length > 0 ? Number(existing[0].orderedqty || 0) : 0;
      const currentLockQty = existing && existing.length > 0 ? Number(existing[0].lockqty || 0) : 0;

      // Calculate availableqty using formula: ecomqty - orderedqty - soldqty - lockqty
      const availableQty = Math.max(0, ecomQty - currentOrderedQty - soldQty - currentLockQty);

      // Calculate platform status
      const platformStatus = this.calculatePlatformStatus(availableQty);

      const updateData = {
        totalqty: totalQty,
        ecomqty: ecomQty,
        soldqty: soldQty,
        availableqty: availableQty,
        orderedqty: currentOrderedQty,
        lockqty: currentLockQty,
        platformstatus: platformStatus,
        modifieddate: BigInt(Date.now())
      };

      // Update or create PlatformStock record
      const platformStock = await this.upsert({
        productid: productId,
        platform: platform,
        ...updateData
      });

      logger.info(
        {
          platformStockId: platformStock.id,
          productId,
          platform,
          recalculatedQuantities: {
            totalqty: totalQty,
            ecomqty: ecomQty,
            soldqty: soldQty,
            availableqty: availableQty,
            orderedqty: currentOrderedQty,
            lockqty: currentLockQty
          },
          formula: {
            availableqty: `${ecomQty} - ${currentOrderedQty} - ${soldQty} - ${currentLockQty} = ${availableQty}`
          },
          platformStatus
        },
        "PlatformStock quantities recalculated from scratch successfully"
      );

      return platformStock;
    } catch (error: any) {
      logger.error(
        { error: error.message, productId, platform },
        "Error recalculating PlatformStock quantities"
      );
      throw error;
    }
  }
}
