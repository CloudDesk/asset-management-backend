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
import { PlatformStockService } from "./platformStock.service.js";

interface CreateStockOptions {
  skipProductUpdate?: boolean;
}

export class StockService {
  private productService = new ProductService();
  private platformStockService = new PlatformStockService();

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

  async getSummaryByPuc(puc: string): Promise<{
    quantity: number;
    availablequantity: number;
    orderedquantity: number;
    soldquantity: number;
    ecompublishedquantity: number;
    platforms: Array<{
      platform: string;
      quantity: number;
      availablequantity: number;
      orderedquantity: number;
      soldquantity: number;
      ecompublishedquantity: number;
    }>;
    platformStocks: Array<{
      platform: string;
      totalqty: number;
      availableqty: number;
      orderedqty: number;
      soldqty: number;
      lockqty: number;
    }>;
    locations: Array<{
      location: string;
      quantity: number;
      availablequantity: number;
      orderedquantity: number;
      soldquantity: number;
      ecompublishedquantity: number;
    }>;
  } | null> {
    try {
      const products = await dynamicFindMany('product', {
        where: { puc },
        take: 1
      });

      const productRecord = Array.isArray(products) && products.length > 0 ? products[0] : null;

      const summaryTotals = {
        quantity: productRecord?.quantity !== undefined ? Number(productRecord.quantity) : 0,
        availablequantity: productRecord?.availablequantity !== undefined ? Number(productRecord.availablequantity) : 0,
        orderedquantity: productRecord?.orderedquantity !== undefined ? Number(productRecord.orderedquantity) : 0,
        soldquantity: productRecord?.soldquantity !== undefined ? Number(productRecord.soldquantity) : 0,
        ecompublishedquantity: productRecord?.ecompublishedquantity !== undefined ? Number(productRecord.ecompublishedquantity) : 0
      };

      const platformSummaryRaw = await prisma.$queryRaw<Array<{
        platform: string | null;
        quantity: bigint | number | null;
        availablequantity: bigint | number | null;
        orderedquantity: bigint | number | null;
        soldquantity: bigint | number | null;
        ecompublishedquantity: bigint | number | null;
      }>>`
        SELECT
          NULLIF(TRIM(platform), '') AS platform,
          COUNT(*) AS quantity,
          SUM(CASE WHEN stockstatus = 'Available' AND ecompublish = true THEN 1 ELSE 0 END) AS availablequantity,
          SUM(CASE WHEN stockstatus = 'Ordered' THEN 1 ELSE 0 END) AS orderedquantity,
          SUM(CASE WHEN stockstatus = 'Sold' THEN 1 ELSE 0 END) AS soldquantity,
          SUM(CASE WHEN ecompublish = true THEN 1 ELSE 0 END) AS ecompublishedquantity
        FROM stock
        WHERE puc = ${puc}
          AND (isdeleted IS NULL OR isdeleted = false)
          AND (isarchive IS NULL OR isarchive = false)
        GROUP BY NULLIF(TRIM(platform), '')
        ORDER BY platform
      `;

      const platforms = (platformSummaryRaw || []).map((row) => {
        const platform = row.platform && row.platform.trim().length > 0 ? row.platform : '';

        return {
          platform,
          quantity: Number(row.quantity ?? 0),
          availablequantity: Number(row.availablequantity ?? 0),
          orderedquantity: Number(row.orderedquantity ?? 0),
          soldquantity: Number(row.soldquantity ?? 0),
          ecompublishedquantity: Number(row.ecompublishedquantity ?? 0)
        };
      });

      let platformStocks: Array<{
        platform: string;
        totalqty: number;
        availableqty: number;
        orderedqty: number;
        soldqty: number;
        lockqty: number;
      }> = [];

      if (productRecord?.id !== undefined && productRecord?.id !== null) {
        try {
          const productIdRaw = productRecord.id;
          const productId =
            typeof productIdRaw === 'bigint' ? productIdRaw : BigInt(productIdRaw);

          const platformStockRecords = await prisma.platformStock.findMany({
            where: { productid: productId },
            orderBy: { platform: 'asc' },
          });

          platformStocks = platformStockRecords.map((record) => ({
            platform: record.platform ?? '',
            totalqty: Number(record.totalqty ?? 0),
            availableqty: Number(record.availableqty ?? 0),
            orderedqty: Number(record.orderedqty ?? 0),
            soldqty: Number(record.soldqty ?? 0),
            lockqty: Number(record.lockqty ?? 0),
          }));
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : error,
              puc,
              productId: productRecord?.id,
            },
            'Failed to fetch platform stock summary'
          );
        }
      }

      return {
        ...summaryTotals,
        platforms,
        platformStocks,
        locations: platforms.map((platformSummary) => ({
          location: platformSummary.platform,
          quantity: platformSummary.quantity,
          availablequantity: platformSummary.availablequantity,
          orderedquantity: platformSummary.orderedquantity,
          soldquantity: platformSummary.soldquantity,
          ecompublishedquantity: platformSummary.ecompublishedquantity,
        })),
      };
    } catch (error: any) {
      logger.error({ error: error.message, puc }, 'Failed to build stock summary by PUC');
      return null;
    }
  }

  async create(
    data: CreateStockInput & Record<string, any>,
    options: CreateStockOptions = {}
  ) {
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

      // Update product quantities and platform stock based on the new stock
      // Priority: 1. Use stock.puc, 2. Use linked product, 3. Use legacy productId
      const productIdentifier = stock.puc || 
                               linkedProduct?.puc || 
                               linkedProduct?.id || 
                               stock.productId || 
                               stock.product_id;

      if (!options.skipProductUpdate && productIdentifier) {
        try {
          // Pass the inserted stock information to updateStockTotals
          const insertedStockInfo = {
            ecompublish: stock.ecompublish,
            stockstatus: stock.stockstatus,
            quantity: stock.quantity || 1 // Default to 1 if not specified
          };
          
          // Update parent product quantities
          const updateResult = await this.productService.updateStockTotals(productIdentifier, insertedStockInfo);
          logger.info(
            { 
              stockId: stock.id, 
              productIdentifier,
              stockstatus: stock.stockstatus,
              ecompublish: stock.ecompublish,
              insertedStockInfo,
              updateResult 
            },
            "Successfully updated product quantities after stock creation"
          );

          // Update PlatformStock if we have a valid product ID and platform
          logger.debug(
            {
              stockId: stock.id,
              stockPlatform: stock.platform,
              linkedProductId: linkedProduct?.id,
              hasPlatform: !!stock.platform,
              hasLinkedProduct: !!linkedProduct?.id,
            },
            "PlatformStock update check"
          );
          
          if (stock.platform && linkedProduct?.id) {
            try {
              logger.info(
                {
                  stockId: stock.id,
                  productId: linkedProduct.id,
                  platform: stock.platform,
                  ecompublish: stock.ecompublish,
                  stockstatus: stock.stockstatus,
                },
                "Calling updatePlatformStockQuantities"
              );
              
              await this.platformStockService.updatePlatformStockQuantities(
                Number(linkedProduct.id),
                stock.platform,
                {
                  ecompublish: stock.ecompublish,
                  stockstatus: stock.stockstatus,
                  quantity: stock.quantity || 1,
                  operation: 'create'
                }
              );
              
              logger.info(
                {
                  stockId: stock.id,
                  productId: linkedProduct.id,
                  platform: stock.platform,
                  stockstatus: stock.stockstatus,
                  ecompublish: stock.ecompublish,
                },
                "Successfully updated platform stock quantities after stock creation"
              );
            } catch (platformError: any) {
              logger.error(
                {
                  error: platformError.message,
                  stockId: stock.id,
                  productId: linkedProduct.id,
                  platform: stock.platform,
                },
                "Failed to update platform stock quantities after stock creation"
              );
              // Don't throw here - stock creation was successful, platform update is secondary
            }
          } else {
            logger.warn(
              {
                stockId: stock.id,
                hasPlatform: !!stock.platform,
                hasLinkedProduct: !!linkedProduct?.id,
                platform: stock.platform,
                productId: linkedProduct?.id,
              },
              "Skipping platform stock update - missing platform or product ID"
            );
          }
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
      } else if (!options.skipProductUpdate) {
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
            // Pass stock status change information if status changed
            let stockStatusChange = undefined;
            if (existingStock.stockstatus !== stock.stockstatus) {
              stockStatusChange = {
                from: existingStock.stockstatus,
                to: stock.stockstatus
              };
            }
            
            const updateResult = await this.productService.updateStockTotals(productIdentifier, undefined, stockStatusChange);
            logger.info(
              { 
                stockId: id, 
                productIdentifier,
                oldStockStatus: existingStock.stockstatus,
                newStockStatus: stock.stockstatus,
                oldEcomPublish: existingStock.ecompublish,
                newEcomPublish: stock.ecompublish,
                stockStatusChange: stockStatusChange || 'no status change',
                updateResult 
              },
              "Successfully updated product quantities after stock update"
            );

            // Update PlatformStock if platform, status, or e-com publish changed
            if (stock.platform) {
              try {
                // Find the product to get the product ID
                const products = await dynamicFindMany('product', {
                  where: { puc: stock.puc },
                  take: 1
                });
                
                if (products && products.length > 0) {
                  const product = products[0];
                  const productId = Number(product.id);
                
                // Check if platform changed (transfer scenario)
                if (existingStock.platform !== stock.platform) {
                  // Platform transfer
                  await this.platformStockService.updatePlatformStockQuantities(
                    productId,
                    stock.platform,
                    {
                      ecompublish: stock.ecompublish,
                      stockstatus: stock.stockstatus,
                      operation: 'transfer',
                      oldPlatform: existingStock.platform
                    }
                  );
                  
                  logger.info(
                    {
                      stockId: id,
                      productId: productId,
                      fromPlatform: existingStock.platform,
                      toPlatform: stock.platform,
                      stockstatus: stock.stockstatus,
                      ecompublish: stock.ecompublish,
                    },
                    "Successfully transferred platform stock between platforms"
                  );
                } else {
                  // Regular update (status or e-com changes)
                  await this.platformStockService.updatePlatformStockQuantities(
                    productId,
                    stock.platform,
                    {
                      ecompublish: stock.ecompublish,
                      stockstatus: stock.stockstatus,
                      operation: 'update',
                      oldEcompublish: existingStock.ecompublish,
                      oldStockstatus: existingStock.stockstatus
                    }
                  );
                  
                  logger.info(
                    {
                      stockId: id,
                      productId: productId,
                      platform: stock.platform,
                      oldStockstatus: existingStock.stockstatus,
                      newStockstatus: stock.stockstatus,
                      oldEcompublish: existingStock.ecompublish,
                      newEcompublish: stock.ecompublish,
                    },
                    "Successfully updated platform stock quantities after stock update"
                  );
                }
                } else {
                  logger.warn(
                    {
                      stockId: id,
                      puc: stock.puc,
                    },
                    "Product not found for platform stock update"
                  );
                }
              } catch (platformError: any) {
                logger.error(
                  {
                    error: platformError.message,
                    stockId: id,
                    platform: stock.platform,
                    stockstatus: stock.stockstatus,
                  },
                  "Failed to update platform stock quantities after stock update"
                );
                // Don't throw here - stock update was successful, platform update is secondary
              }
            } else {
              logger.warn(
                {
                  stockId: id,
                  hasPlatform: !!stock.platform,
                },
                "Skipping platform stock update - missing platform"
              );
            }
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
          // Update parent product quantities
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

          // Update PlatformStock if we have platform information
          if (existingStock.platform) {
            try {
              // Find the product to get the product ID
              const products = await dynamicFindMany('product', {
                where: { puc: existingStock.puc },
                take: 1
              });
              
              if (products && products.length > 0) {
                const product = products[0];
                
                await this.platformStockService.updatePlatformStockQuantities(
                  Number(product.id),
                  existingStock.platform,
                  {
                    ecompublish: existingStock.ecompublish,
                    stockstatus: existingStock.stockstatus,
                    operation: 'delete'
                  }
                );
                
                logger.info(
                  {
                    stockId: id,
                    productId: product.id,
                    platform: existingStock.platform,
                    deletedStockStatus: existingStock.stockstatus,
                    deletedStockEcompublish: existingStock.ecompublish,
                  },
                  "Successfully updated platform stock quantities after stock deletion"
                );
              }
            } catch (platformError: any) {
              logger.error(
                {
                  error: platformError.message,
                  stockId: id,
                  platform: existingStock.platform,
                },
                "Failed to update platform stock quantities after stock deletion"
              );
              // Don't throw here - stock deletion was successful, platform update is secondary
            }
          }
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
          // Create new stock - ensure required fields are present
          logger.debug(
            { data: updateData },
            "Upserting new stock (no existing found)"
          );
          
          // Ensure required fields for creation
          const createData = {
            ...updateData,
            // Provide defaults if missing required fields
            puc: updateData.puc || updateData.productId || 'TEMP-PUC',
            platform: updateData.platform || 'nivapp', // Default platform
          };
          
          return this.create(createData);
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

  async updateByRfid(rfid: string, orderlineid: string) {
    try {
      logger.info(
        { rfid, orderlineid },
        "Starting stock update by RFID"
      );

      // Find stock by RFID
      const stockList = await dynamicFindMany("stock", {
        where: { rfid: rfid },
        take: 1
      });

      if (!stockList || stockList.length === 0) {
        throw new Error(`Stock not found with RFID: ${rfid}`);
      }

      const stock = stockList[0];
      const stockId = stock.id; // Keep as integer, don't convert to string

      logger.debug(
        { stockId, currentStatus: stock.stockstatus, rfid },
        "Found stock by RFID"
      );

      // Update stock with new orderlinenumber and status
      const currentTime = Date.now();
      const updateData = {
        orderlinenumber: orderlineid,
        stockstatus: "Sold",
        solddate: BigInt(currentTime),
        rfidscannedtime: BigInt(currentTime)
      };

      const updatedStock = await dynamicUpdate("stock", { id: stockId }, updateData);

      if (!updatedStock) {
        throw new Error("Failed to update stock");
      }

      logger.info(
        {
          stockId,
          rfid,
          orderlineid,
          oldStatus: stock.stockstatus,
          newStatus: "Sold"
        },
        "Stock updated successfully"
      );

      // Update product quantities using existing logic if PUC is available
      if (updatedStock.puc) {
        try {
          // Pass stock status change information for orderedquantity handling
          const stockStatusChange = {
            from: stock.stockstatus,
            to: "Sold"
          };
          
          await this.productService.updateStockTotals(updatedStock.puc, undefined, stockStatusChange);
          logger.info(
            { 
              stockId, 
              puc: updatedStock.puc,
              stockStatusChange,
              reason: "RFID stock sale"
            },
            "Product quantities updated after RFID sale (including orderedquantity decrease)"
          );
        } catch (error: any) {
          logger.error(
            { 
              error: error.message, 
              stockId, 
              puc: updatedStock.puc
            },
            "Failed to update product quantities after RFID sale"
          );
          // Don't throw error here, stock update was successful
        }
      } else {
        logger.warn(
          { stockId, rfid },
          "No PUC found for stock, skipping product quantity update"
        );
      }

      return updatedStock;
    } catch (error) {
      logger.error(
        { error, rfid, orderlineid },
        "Error in updateByRfid operation"
      );
      throw error;
    }
  }

  async bulkUpdateByRfid(updates: Array<{ rfid: string; orderlineid: string }>) {
    try {
      logger.info(
        { updateCount: updates.length },
        "Starting bulk stock update by RFID"
      );

      const results = [];
      const errors = [];
      let successCount = 0;
      let failureCount = 0;

      // Process each update
      for (const [index, { rfid, orderlineid }] of updates.entries()) {
        try {
          logger.debug(
            { index: index + 1, total: updates.length, rfid, orderlineid },
            "Processing individual RFID update"
          );

          const updatedStock = await this.updateByRfid(rfid, orderlineid);
          
          results.push({
            index,
            rfid,
            orderlineid,
            success: true,
            data: updatedStock,
            stockId: updatedStock.id,
            status: updatedStock.stockstatus
          });
          
          successCount++;
          
          logger.debug(
            { index: index + 1, rfid, stockId: updatedStock.id },
            "Individual RFID update successful"
          );
          
        } catch (error: any) {
          const errorResult = {
            index,
            rfid,
            orderlineid,
            success: false,
            error: error.message,
            errorDetails: error.stack
          };
          
          results.push(errorResult);
          errors.push(errorResult);
          failureCount++;
          
          logger.warn(
            { index: index + 1, rfid, error: error.message },
            "Individual RFID update failed"
          );
        }
      }

      const summary = {
        total: updates.length,
        successful: successCount,
        failed: failureCount,
        successRate: `${((successCount / updates.length) * 100).toFixed(1)}%`
      };

      logger.info(
        { 
          summary,
          hasErrors: errors.length > 0
        },
        "Bulk RFID update completed"
      );

      return {
        summary,
        results,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      logger.error(
        { error, updateCount: updates.length },
        "Error in bulkUpdateByRfid operation"
      );
      throw error;
    }
  }
}
